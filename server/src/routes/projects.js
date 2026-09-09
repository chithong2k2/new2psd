const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios   = require('axios');

const { createProject, getProject, updateProject } = require('../store');
const { extractArticle } = require('../articleExtractor');
const { inspectPsd, processPsd } = require('../psdProcessor');
const { findRelatedNewsImages } = require('../relatedNewsCrawler');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'projects');

// ─── Multer: PSD upload ───────────────────────────────────────────────────────
const psdStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(DATA_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, 'template.psd'),
});
const uploadPsdMiddleware = multer({
  storage: psdStorage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.psd')) cb(null, true);
    else cb(new Error('Only .psd files are allowed'));
  },
  limits: { fileSize: 200 * 1024 * 1024 },
});

// ─── Multer: custom image upload ─────────────────────────────────────────────
const imageStorage = multer.memoryStorage(); // keep in memory, convert to buffer
const uploadImageMiddleware = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed (jpg, png, webp)'));
  },
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});

// ─── POST /api/projects ───────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const id = uuidv4();
    fs.mkdirSync(path.join(DATA_DIR, id), { recursive: true });
    res.status(201).json(createProject(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/projects/:id ────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try { res.json(getProject(req.params.id)); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

// ─── POST /api/projects/:id/upload-psd ───────────────────────────────────────
router.post('/:id/upload-psd', (req, res) => {
  try { getProject(req.params.id); }
  catch (e) { return res.status(404).json({ error: e.message }); }

  uploadPsdMiddleware.single('psd')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No PSD file received' });

    try {
      const psdBuffer  = fs.readFileSync(req.file.path);
      const inspection = await inspectPsd(psdBuffer);
      const { renderTemplateBase } = require('../psdProcessor');
      let templateBgPng = null;
      let templateFgPng = null;
      try {
        const { bg, fg } = await renderTemplateBase(psdBuffer);
        if (bg) {
          fs.writeFileSync(path.join(DATA_DIR, req.params.id, 'template_bg.png'), bg);
          templateBgPng = bg.toString('base64');
        }
        if (fg) {
          fs.writeFileSync(path.join(DATA_DIR, req.params.id, 'template_fg.png'), fg);
          templateFgPng = fg.toString('base64');
        }
      } catch (err) {
        console.warn('Could not pre-render template layers:', err.message);
      }

      const project = updateProject(req.params.id, {
        status: 'PSD_UPLOADED',
        psdFilename: req.file.originalname,
        psdFileSize: req.file.size,
        psdCompatible: inspection.compatible,
        incompatibilityReason: inspection.reason || null,
        psdWidth:  inspection.width,
        psdHeight: inspection.height,
        psdLayers: inspection.layers,
        defaultCaptionStyle: inspection.defaultCaptionStyle,
        imageLayerBounds: inspection.imageLayerBounds || null,
        templateBgPng,
        templateFgPng,
      });
      res.json(project);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// ─── POST /api/projects/:id/upload-image ─────────────────────────────────────
// Accepts: multipart file (field "image") OR JSON body { url: "..." }
router.post('/:id/upload-image', (req, res) => {
  try { getProject(req.params.id); }
  catch (e) { return res.status(404).json({ error: e.message }); }

  uploadImageMiddleware.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const projectDir = path.join(DATA_DIR, req.params.id, 'uploads');
    fs.mkdirSync(projectDir, { recursive: true });

    try {
      let imageBuffer, filename, mimeType;

      if (req.file) {
        // File upload
        imageBuffer = req.file.buffer;
        filename    = `upload_${Date.now()}_${req.file.originalname}`;
        mimeType    = req.file.mimetype;
      } else if (req.body.url) {
        // URL fetch
        const response = await axios.get(req.body.url, {
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
        });
        imageBuffer = Buffer.from(response.data);
        mimeType    = response.headers['content-type'] || 'image/jpeg';
        filename    = `upload_${Date.now()}.jpg`;
      } else {
        return res.status(400).json({ error: 'Provide a file or url' });
      }

      const savedPath = path.join(projectDir, filename);
      fs.writeFileSync(savedPath, imageBuffer);

      // Serve via /api/projects/:id/uploads/:filename
      res.json({
        url:      `/api/projects/${req.params.id}/uploads/${filename}`,
        filename,
        mimeType,
        size:     imageBuffer.length,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// ─── GET /api/projects/:id/uploads/:filename ─────────────────────────────────
router.get('/:id/uploads/:filename', (req, res) => {
  const filePath = path.join(DATA_DIR, req.params.id, 'uploads', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// ─── POST /api/projects/:id/analyze-article ──────────────────────────────────
router.post('/:id/analyze-article', async (req, res) => {
  try { getProject(req.params.id); }
  catch (e) { return res.status(404).json({ error: e.message }); }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const articleData = await extractArticle(url);
    if (!articleData.images || articleData.images.length === 0) {
      return res.status(422).json({ error: 'No suitable images found in this article.' });
    }

    // Try finding related news images in background or immediately
    let relatedImages = [];
    try {
      relatedImages = await findRelatedNewsImages(articleData.title, url, articleData.entities || []);
    } catch (err) {
      console.warn('Could not fetch related news images:', err.message);
    }

    articleData.relatedImages = relatedImages;

    const project = updateProject(req.params.id, { status: 'ARTICLE_ANALYZED', articleData });
    res.json(project);
  } catch (e) {
    console.error('Article extraction error:', e.message);
    const msg = e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND'
      ? 'Cannot reach this URL. Please check the link and try again.'
      : `Unable to extract article content: ${e.message}`;
    res.status(422).json({ error: msg });
  }
});

// ─── POST /api/projects/:id/search-related-news ─────────────────────────────
router.post('/:id/search-related-news', async (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project.articleData) return res.status(400).json({ error: 'Analyze article first' });

    const { query } = req.body;
    const searchTitle = query || project.articleData.title;
    const entities = project.articleData.entities || [];

    const relatedImages = await findRelatedNewsImages(searchTitle, project.articleData.url, entities);
    
    // Merge into project's existing related images
    const currentRelated = project.articleData.relatedImages || [];
    const existingUrls = new Set(currentRelated.map((i) => i.url));
    const newItems = relatedImages.filter((i) => !existingUrls.has(i.url));
    project.articleData.relatedImages = [...currentRelated, ...newItems];

    updateProject(req.params.id, { articleData: project.articleData });

    res.json({
      relatedImages: project.articleData.relatedImages,
      foundCount: newItems.length,
    });
  } catch (e) {
    console.error('Search related news error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/projects/:id/article ───────────────────────────────────────────
router.get('/:id/article', (req, res) => {
  try {
    const p = getProject(req.params.id);
    if (!p.articleData) return res.status(404).json({ error: 'No article analyzed yet' });
    res.json(p.articleData);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// ─── POST /api/projects/:id/preview ──────────────────────────────────────────
// Body (new multi-image API):
// {
//   images: [{ url, focusX?, focusY? }],   ← array of image sources
//   layout: 'single' | 'side-by-side' | 'left-big' | 'right-big' |
//            'top-bottom' | '3-equal' | '1-top-2-bottom',
//   caption: { text, x?, y?, width?, height?, fontFamily?, fontSize?,
//              bold?, italic?, color?, align?, backgroundColor? }
// }
router.post('/:id/preview', async (req, res) => {
  let project;
  try { project = getProject(req.params.id); }
  catch (e) { return res.status(404).json({ error: e.message }); }

  const psdPath = path.join(DATA_DIR, req.params.id, 'template.psd');
  if (!fs.existsSync(psdPath)) return res.status(400).json({ error: 'No PSD uploaded yet' });
  if (!project.psdCompatible)  return res.status(400).json({ error: project.incompatibilityReason || 'PSD not compatible' });

  const { images, layout, caption } = req.body;
  if (!images || images.length === 0) return res.status(400).json({ error: 'At least one image is required' });

  try {
    // Resolve image buffers
    const imageSlots = [];
    for (const img of images) {
      let buffer;
      if (img.url && img.url.startsWith('/api/')) {
        // Local uploaded file — read from disk
        const localPath = path.join(DATA_DIR, req.params.id, 'uploads',
          path.basename(img.url));
        if (fs.existsSync(localPath)) {
          buffer = fs.readFileSync(localPath);
        }
      }
      if (!buffer && img.url) {
        const response = await axios.get(
          img.url.startsWith('http') ? img.url : `http://localhost:${process.env.PORT || 3001}${img.url}`,
          {
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              Accept: 'image/*',
              Referer: project.articleData?.url || img.url,
            },
          }
        );
        buffer = Buffer.from(response.data);
      }
      if (buffer) imageSlots.push({ buffer, focusX: img.focusX ?? 0.5, focusY: img.focusY ?? 0.5 });
    }

    if (imageSlots.length === 0) return res.status(400).json({ error: 'Could not load any images' });

    const psdBuffer = fs.readFileSync(psdPath);
    const { modifiedPsd, previewPng, basePreviewPng } = await processPsd(
      psdBuffer, imageSlots, layout || 'single', caption || {}
    );

    const projectDir = path.join(DATA_DIR, req.params.id);
    fs.writeFileSync(path.join(projectDir, 'modified.psd'), modifiedPsd);
    fs.writeFileSync(path.join(projectDir, 'preview.png'), previewPng);
    if (basePreviewPng) {
      fs.writeFileSync(path.join(projectDir, 'preview_base.png'), basePreviewPng);
    }

    updateProject(req.params.id, { status: 'PREVIEW_READY' });

    res.json({
      previewPng: previewPng.toString('base64'),
      basePreviewPng: basePreviewPng ? basePreviewPng.toString('base64') : previewPng.toString('base64'),
      width:  project.psdWidth,
      height: project.psdHeight,
    });
  } catch (e) {
    console.error('Preview generation error:', e);
    res.status(500).json({ error: `Preview failed: ${e.message}` });
  }
});

// ─── POST /api/projects/:id/export/prepare ─────────────────────────────────
router.post('/:id/export/prepare', async (req, res) => {
  try {
    const { images, layout, caption } = req.body;
    const projectDir = path.join(DATA_DIR, req.params.id);
    const psdPath = path.join(projectDir, 'template.psd');
    if (!fs.existsSync(psdPath)) return res.status(400).json({ error: 'PSD not found' });

    // Load image buffers
    const imageSlots = [];
    if (images && images.length > 0) {
      for (const img of images) {
        let buffer;
        if (img.url && img.url.startsWith('/api/')) {
          const localPath = path.join(DATA_DIR, req.params.id, 'uploads', path.basename(img.url));
          if (fs.existsSync(localPath)) buffer = fs.readFileSync(localPath);
        }
        if (!buffer && img.url) {
          const response = await axios.get(
            img.url.startsWith('http') ? img.url : `http://localhost:${process.env.PORT || 3001}${img.url}`,
            {
              responseType: 'arraybuffer',
              timeout: 20000,
              headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
            }
          );
          buffer = Buffer.from(response.data);
        }
        if (buffer) imageSlots.push({ buffer, focusX: img.focusX ?? 0.5, focusY: img.focusY ?? 0.5 });
      }
    }

    const psdBuffer = fs.readFileSync(psdPath);
    const { processPsd } = require('../psdProcessor');
    const { modifiedPsd, previewPng } = await processPsd(
      psdBuffer,
      imageSlots.length > 0 ? imageSlots : null,
      layout || 'single',
      caption || {}
    );

    fs.writeFileSync(path.join(projectDir, 'modified.psd'), modifiedPsd);
    fs.writeFileSync(path.join(projectDir, 'preview.png'), previewPng);
    res.json({ success: true });
  } catch (e) {
    console.error('Export prepare error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/export/png', (req, res) => {
  const fp = path.join(DATA_DIR, req.params.id, 'preview.png');
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Preview not generated yet' });
  res.setHeader('Content-Disposition', 'attachment; filename="news2psd-export.png"');
  res.setHeader('Content-Type', 'image/png');
  res.sendFile(fp);
});
router.get('/:id/export/psd', (req, res) => {
  const fp = path.join(DATA_DIR, req.params.id, 'modified.psd');
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Modified PSD not generated yet' });
  res.setHeader('Content-Disposition', 'attachment; filename="news2psd-modified.psd"');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.sendFile(fp);
});

// ─── GET /api/projects/:id/proxy-image ───────────────────────────────────────
router.get('/:id/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param required' });
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer', timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
    });
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(response.data));
  } catch (e) {
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

module.exports = router;
