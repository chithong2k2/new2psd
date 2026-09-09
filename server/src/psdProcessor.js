const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { readPsd, writePsdBuffer, initializeCanvas } = require('ag-psd');
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

// ─── Pre-load all bundled fonts ───────────────────────────────────────────────
const BUNDLED_FONTS_DIR = path.join(__dirname, '..', 'fonts');
if (fs.existsSync(BUNDLED_FONTS_DIR)) {
  GlobalFonts.loadFontsFromDir(BUNDLED_FONTS_DIR);
  console.log('Loaded fonts from:', BUNDLED_FONTS_DIR);
}

// ─── ag-psd canvas integration ────────────────────────────────────────────────
function safeCreateCanvas(width, height) {
  const w = Math.max(1, parseInt(width)  || 1);
  const h = Math.max(1, parseInt(height) || 1);
  return createCanvas(w, h);
}
function safeCreateImageData(width, height) {
  const w = Math.max(1, parseInt(width)  || 1);
  const h = Math.max(1, parseInt(height) || 1);
  return createCanvas(w, h).getContext('2d').createImageData(w, h);
}
initializeCanvas(safeCreateCanvas, safeCreateImageData);

// ─── Layer name matching ──────────────────────────────────────────────────────
function matchesImageLayer(name) {
  if (!name) return false;
  return name.replace(/[\[\]]/g, '').trim().toUpperCase() === 'NEWS_IMAGE';
}
function matchesCaptionLayer(name) {
  if (!name) return false;
  return name.replace(/[\[\]]/g, '').trim().toUpperCase() === 'NEWS_CAPTION';
}

// ─── inspectPsd ───────────────────────────────────────────────────────────────
async function inspectPsd(psdBuffer) {
  const psd = readPsd(psdBuffer, { skipCompositeImageData: true, skipLayerImageData: true });
  const allLayers    = flattenLayers(psd.children || []);
  const imageLayer   = allLayers.find((l) => matchesImageLayer(l.name));
  const captionLayer = allLayers.find((l) => matchesCaptionLayer(l.name));

  const compatible = !!(imageLayer && captionLayer);
  let reason = null;
  if (!imageLayer && !captionLayer) reason = 'Missing both NEWS_IMAGE and NEWS_CAPTION layers.';
  else if (!imageLayer)             reason = 'Missing NEWS_IMAGE layer.';
  else if (!captionLayer)           reason = 'Missing NEWS_CAPTION layer.';

  // Return default caption style read from PSD
  let defaultCaptionStyle = null;
  if (captionLayer) {
    const { family, bold, italic, fontSize, fillColor, align } = resolveTextStyle(captionLayer);
    defaultCaptionStyle = {
      x:          captionLayer.left   || 0,
      y:          captionLayer.top    || 0,
      width:      (captionLayer.right  || 0) - (captionLayer.left || 0),
      height:     (captionLayer.bottom || 0) - (captionLayer.top  || 0),
      fontFamily: family,
      fontSize:   Math.round(fontSize),
      bold, italic,
      color:      rgbaToHex(fillColor || { r: 0, g: 0, b: 0 }),
      align,
      backgroundColor: null,
    };
  }

  return {
    compatible, reason,
    width: psd.width, height: psd.height,
    defaultCaptionStyle,
    imageLayerBounds: imageLayer ? {
      left:   imageLayer.left   || 0,
      top:    imageLayer.top    || 0,
      right:  imageLayer.right  || psd.width,
      bottom: imageLayer.bottom || psd.height,
    } : null,
    layers: allLayers.map((l) => ({ name: l.name, type: l.text ? 'text' : 'pixel' })),
  };
}

// ─── processPsd (new API) ─────────────────────────────────────────────────────
/**
 * @param {Buffer}   psdBuffer
 * @param {Array}    imageSlots  — [{buffer: Buffer, focusX: 0-1, focusY: 0-1}]
 * @param {string}   layout     — 'single'|'side-by-side'|'left-big'|'right-big'|
 *                                'top-bottom'|'3-equal'|'1-top-2-bottom'
 * @param {Object}   captionStyle — { text, x, y, width, height, fontFamily, fontSize,
 *                                   bold, italic, color, align, backgroundColor }
 */
async function processPsd(psdBuffer, imageSlots, layout, captionStyle) {
  const psd = readPsd(psdBuffer, { skipCompositeImageData: true });

  const allLayers    = flattenLayers(psd.children || []);
  const imageLayer   = allLayers.find((l) => matchesImageLayer(l.name));
  const captionLayer = allLayers.find((l) => matchesCaptionLayer(l.name));

  if (!imageLayer)   throw new Error('Layer NEWS_IMAGE not found in PSD');
  if (!captionLayer) throw new Error('Layer NEWS_CAPTION not found in PSD');

  // Replace image layer with composed multi-image
  if (imageSlots && imageSlots.length > 0) {
    await replaceImageLayerMulti(imageLayer, imageSlots, layout || 'single');
  }

  // Replace caption
  if (captionStyle) {
    replaceCaptionText(captionLayer, captionStyle.text || '');
    await renderCaptionCanvas(captionLayer, captionStyle);
  }

  const modifiedPsd = Buffer.from(writePsdBuffer(psd, { generateThumbnail: false, trimImageData: false }));
  const previewPng      = await renderPreview(psd, false);
  const basePreviewPng  = await renderPreview(psd, true);

  return { modifiedPsd, previewPng, basePreviewPng };
}

// ─── Compose multiple images into one layer ───────────────────────────────────
async function replaceImageLayerMulti(layer, imageSlots, layout) {
  const left   = layer.left   || 0;
  const top    = layer.top    || 0;
  const right  = layer.right  || 0;
  const bottom = layer.bottom || 0;
  const layerW = Math.max(right - left, 1);
  const layerH = Math.max(bottom - top, 1);

  const composed = await composeImages(imageSlots, layout, layerW, layerH);
  const img      = await loadImage(composed);
  const canvas   = safeCreateCanvas(layerW, layerH);
  canvas.getContext('2d').drawImage(img, 0, 0, layerW, layerH);
  layer.canvas = canvas;
}

// ─── composeImages: layout engine ────────────────────────────────────────────
async function composeImages(slots, layout, W, H) {
  // Resolve rects for each slot: [{x, y, w, h}]
  const rects = getLayoutRects(layout, slots.length, W, H);

  const composites = [];
  for (let i = 0; i < rects.length; i++) {
    const slot = slots[i];
    if (!slot || !slot.buffer) continue;
    const { x, y, w, h } = rects[i];

    // focusX/Y: 0-1 crop anchor. default center (0.5, 0.5)
    const fx = slot.focusX ?? 0.5;
    const fy = slot.focusY ?? 0.5;

    const cropped = await sharpCoverWithFocus(slot.buffer, w, h, fx, fy);
    composites.push({ input: cropped, left: Math.round(x), top: Math.round(y) });
  }

  const base = sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  });

  return composites.length > 0
    ? base.composite(composites).png().toBuffer()
    : base.png().toBuffer();
}

// Compute where each image slot goes in the layer area
function getLayoutRects(layout, count, W, H) {
  const gap = Math.round(Math.min(W, H) * 0.01); // 1% gap
  switch (layout) {
    case 'side-by-side': {
      const w = Math.floor((W - gap) / 2);
      return [
        { x: 0,       y: 0, w, h: H },
        { x: w + gap, y: 0, w: W - w - gap, h: H },
      ];
    }
    case 'left-big': {
      const bigW = Math.floor(W * 0.65);
      const smallW = W - bigW - gap;
      return [
        { x: 0,           y: 0, w: bigW,   h: H },
        { x: bigW + gap,  y: 0, w: smallW, h: H },
      ];
    }
    case 'right-big': {
      const smallW = Math.floor(W * 0.35);
      const bigW   = W - smallW - gap;
      return [
        { x: 0,             y: 0, w: smallW, h: H },
        { x: smallW + gap,  y: 0, w: bigW,   h: H },
      ];
    }
    case 'top-bottom': {
      const h1 = Math.floor((H - gap) / 2);
      return [
        { x: 0, y: 0,        w: W, h: h1 },
        { x: 0, y: h1 + gap, w: W, h: H - h1 - gap },
      ];
    }
    case '3-equal': {
      const w = Math.floor((W - gap * 2) / 3);
      return [
        { x: 0,            y: 0, w, h: H },
        { x: w + gap,      y: 0, w, h: H },
        { x: (w + gap) * 2, y: 0, w: W - (w + gap) * 2, h: H },
      ];
    }
    case '1-top-2-bottom': {
      const topH    = Math.floor(H * 0.6);
      const botH    = H - topH - gap;
      const botW    = Math.floor((W - gap) / 2);
      return [
        { x: 0,          y: 0,          w: W,    h: topH },
        { x: 0,          y: topH + gap, w: botW, h: botH },
        { x: botW + gap, y: topH + gap, w: W - botW - gap, h: botH },
      ];
    }
    default: // 'single'
      return [{ x: 0, y: 0, w: W, h: H }];
  }
}

// Cover crop with focus point
async function sharpCoverWithFocus(buffer, targetW, targetH, focusX, focusY) {
  const meta   = await sharp(buffer).metadata();
  const srcW   = meta.width  || targetW;
  const srcH   = meta.height || targetH;
  const scaleX = targetW / srcW;
  const scaleY = targetH / srcH;
  const scale  = Math.max(scaleX, scaleY);
  const scaledW = Math.round(srcW * scale);
  const scaledH = Math.round(srcH * scale);

  const cropX = Math.round((scaledW - targetW) * focusX);
  const cropY = Math.round((scaledH - targetH) * focusY);

  return sharp(buffer)
    .resize(scaledW, scaledH, { fit: 'fill' })
    .extract({
      left:   Math.max(0, cropX),
      top:    Math.max(0, cropY),
      width:  targetW,
      height: targetH,
    })
    .png()
    .toBuffer();
}

// ─── Update text layer data ───────────────────────────────────────────────────
function replaceCaptionText(layer, text) {
  if (!layer.text) return;
  const t = layer.text;
  t.text = text;
  if (t.styleRuns?.length) {
    t.styleRuns = [{ length: text.length, style: t.styleRuns[0]?.style || {} }];
  }
  if (t.paragraphRuns?.length) {
    t.paragraphRuns = [{ length: text.length, style: t.paragraphRuns[0]?.style || {} }];
  }
}

// ─── Resolve style from PSD text layer ───────────────────────────────────────
function resolveTextStyle(layer) {
  const root     = layer.text?.style || {};
  const runStyle = layer.text?.styleRuns?.[0]?.style || {};

  const rawFontName = root.font?.name || runStyle.font?.name || 'Arial';
  const bold   = /bold/i.test(rawFontName)   || root.bold   || false;
  const italic = /italic/i.test(rawFontName) || root.italic || false;
  const family = rawFontName
    .replace(/-?(Bold|Italic|BoldItalic|Regular|Light|Medium|SemiBold|Black|Thin|ExtraLight|ExtraBold|Heavy)(Italic)?$/i, '')
    .replace(/-$/, '').trim() || 'Arial';
  const fontSize  = root.fontSize   || runStyle.fontSize   || 24;
  const fillColor = root.fillColor  || runStyle.fillColor  || { r: 0, g: 0, b: 0 };
  const just      = layer.text?.paragraphStyle?.justification || 'left';
  const align     = just === 'right' ? 'right' : just === 'center' ? 'center' : 'left';

  return { family, bold, italic, fontSize, fillColor, align };
}

// ─── Render caption canvas with full captionStyle overrides ──────────────────
async function renderCaptionCanvas(layer, captionStyle) {
  // Position/size: use captionStyle override OR fall back to layer bounds
  const x = captionStyle.x      ?? (layer.left   || 0);
  const y = captionStyle.y      ?? (layer.top     || 0);
  const w = Math.max(captionStyle.width  ?? ((layer.right  || layer.left  || 400) - (layer.left  || 0)), 1);
  const h = Math.max(captionStyle.height ?? ((layer.bottom || layer.top   || 80)  - (layer.top   || 0)), 1);

  // Update layer position if user moved it
  if (captionStyle.x !== undefined) {
    layer.left   = Math.round(x);
    layer.top    = Math.round(y);
    layer.right  = Math.round(x + w);
    layer.bottom = Math.round(y + h);
    if (layer.text) {
      // Update text transform position
      if (Array.isArray(layer.text.transform)) {
        layer.text.transform[4] = x;
        layer.text.transform[5] = y;
      }
    }
  }

  // Resolve style: captionStyle overrides take priority over PSD defaults
  const psdStyle   = resolveTextStyle(layer);
  const fontFamily = captionStyle.fontFamily || psdStyle.family;
  const fontSize   = captionStyle.fontSize   || psdStyle.fontSize;
  const bold       = captionStyle.bold       ?? psdStyle.bold;
  const italic     = captionStyle.italic     ?? psdStyle.italic;
  const color      = captionStyle.color      ? hexToRgb(captionStyle.color) : psdStyle.fillColor;
  const align      = captionStyle.align      || psdStyle.align;
  const bgColor    = captionStyle.backgroundColor;

  // Load font
  tryLoadSystemFont(fontFamily);

  const canvas = safeCreateCanvas(w, h);
  const ctx    = canvas.getContext('2d');

  // Optional background
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }

  const weight  = bold   ? 'bold'   : 'normal';
  const styleS  = italic ? 'italic' : 'normal';
  ctx.font         = `${styleS} ${weight} ${Math.round(fontSize)}px "${fontFamily}", Arial, sans-serif`;
  ctx.fillStyle    = rgbaToHex(color);
  ctx.textAlign    = align;
  ctx.textBaseline = 'top';

  const xPos       = align === 'right' ? w - 4 : align === 'center' ? w / 2 : 4;
  const lineHeight = fontSize * 1.3;
  const text       = captionStyle.text || layer.text?.text || '';
  const lines      = wordWrap(ctx, text, w - 8);

  lines.forEach((line, i) => {
    const yPos = 4 + i * lineHeight;
    if (yPos + lineHeight > h + lineHeight) return;
    ctx.fillText(line, xPos, yPos);
  });

  layer.canvas = canvas;
}

// ─── Render preview PNG ───────────────────────────────────────────────────────
async function renderPreview(psd, skipCaption = false) {
  const W = psd.width  || 1080;
  const H = psd.height || 1080;
  const overlays   = [];
  const allLayers  = flattenLayers(psd.children || []);

  for (const layer of allLayers) {
    if (layer.hidden || !layer.canvas) continue;
    if (skipCaption && matchesCaptionLayer(layer.name)) continue;
    try {
      const rawX   = layer.left || 0;
      const rawY   = layer.top  || 0;
      const layerW = layer.canvas.width  || 1;
      const layerH = layer.canvas.height || 1;
      const destX  = Math.max(0, Math.min(rawX, W - 1));
      const destY  = Math.max(0, Math.min(rawY, H - 1));
      const visW   = Math.min(layerW, W - destX);
      const visH   = Math.min(layerH, H - destY);
      if (visW <= 0 || visH <= 0) continue;

      let pngBuf = layer.canvas.toBuffer('image/png');
      const srcX = rawX < 0 ? -rawX : 0;
      const srcY = rawY < 0 ? -rawY : 0;
      if (srcX > 0 || srcY > 0 || visW < layerW || visH < layerH) {
        pngBuf = await sharp(pngBuf)
          .extract({ left: Math.min(srcX, layerW-1), top: Math.min(srcY, layerH-1), width: Math.max(1,visW), height: Math.max(1,visH) })
          .png().toBuffer();
      }
      overlays.push({ input: pngBuf, left: destX, top: destY });
    } catch (e) {
      console.warn(`Skipping layer "${layer.name}":`, e.message);
    }
  }

  const base = { create: { width: W, height: H, channels: 4, background: { r:255,g:255,b:255,alpha:1 } } };
  return overlays.length > 0
    ? sharp(base).composite(overlays).png().toBuffer()
    : sharp(base).png().toBuffer();
}

// ─── Font loader ──────────────────────────────────────────────────────────────
const _loadedFonts = new Set();
function tryLoadSystemFont(family) {
  if (_loadedFonts.has(family)) return;
  _loadedFonts.add(family);
  const dirs = [
    BUNDLED_FONTS_DIR,
    'C:/Windows/Fonts',
    (process.env.LOCALAPPDATA || '') + '/Microsoft/Windows/Fonts',
  ];
  const variants = ['','-Regular','-Bold','-Italic','-BoldItalic','-Medium','-SemiBold','-Light'];
  const exts = ['.ttf','.otf','.TTF','.OTF'];
  for (const dir of dirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    for (const v of variants) for (const ext of exts) {
      const fp = path.join(dir, `${family}${v}${ext}`);
      if (fs.existsSync(fp)) { try { GlobalFonts.registerFromPath(fp, family); } catch(_){} }
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function wordWrap(ctx, text, maxWidth) {
  const lines = [];
  for (const para of (text || '').split('\n')) {
    const words = para.split(' ');
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) { cur = test; }
      else { if (cur) lines.push(cur); cur = word; }
    }
    lines.push(cur);
  }
  return lines;
}

function flattenLayers(layers, result = []) {
  for (const l of layers) { result.push(l); if (l.children) flattenLayers(l.children, result); }
  return result;
}

function rgbaToHex({ r=0, g=0, b=0 } = {}) {
  const h = (v) => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexToRgb(hex) {
  const c = hex.replace('#','');
  return {
    r: parseInt(c.slice(0,2),16),
    g: parseInt(c.slice(2,4),16),
    b: parseInt(c.slice(4,6),16),
  };
}

// ─── Render template base (separates background below image and foreground above image) ─
async function renderTemplateBase(psdBuffer) {
  const psd = readPsd(psdBuffer, { skipCompositeImageData: true });
  const W = psd.width  || 1080;
  const H = psd.height || 1080;
  const bgOverlays = [];
  const fgOverlays = [];
  let passedImageLayer = false;

  const allLayers = flattenLayers(psd.children || []);

  for (const layer of allLayers) {
    if (layer.hidden || !layer.canvas) continue;
    if (matchesImageLayer(layer.name)) {
      passedImageLayer = true;
      continue;
    }
    if (matchesCaptionLayer(layer.name)) continue;

    try {
      const rawX   = layer.left || 0;
      const rawY   = layer.top  || 0;
      const layerW = layer.canvas.width  || 1;
      const layerH = layer.canvas.height || 1;
      const destX  = Math.max(0, Math.min(rawX, W - 1));
      const destY  = Math.max(0, Math.min(rawY, H - 1));
      const visW   = Math.min(layerW, W - destX);
      const visH   = Math.min(layerH, H - destY);
      if (visW <= 0 || visH <= 0) continue;

      let pngBuf = layer.canvas.toBuffer('image/png');
      const srcX = rawX < 0 ? -rawX : 0;
      const srcY = rawY < 0 ? -rawY : 0;
      if (srcX > 0 || srcY > 0 || visW < layerW || visH < layerH) {
        pngBuf = await sharp(pngBuf)
          .extract({ left: Math.min(srcX, layerW-1), top: Math.min(srcY, layerH-1), width: Math.max(1,visW), height: Math.max(1,visH) })
          .png().toBuffer();
      }

      const overlay = { input: pngBuf, left: destX, top: destY };
      if (!passedImageLayer) {
        bgOverlays.push(overlay);
      } else {
        fgOverlays.push(overlay);
      }
    } catch (e) {
      console.warn(`Skipping template layer "${layer.name}":`, e.message);
    }
  }

  const baseTransparent = { create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } };

  const bgBuffer = bgOverlays.length > 0
    ? await sharp(baseTransparent).composite(bgOverlays).png().toBuffer()
    : null;

  const fgBuffer = fgOverlays.length > 0
    ? await sharp(baseTransparent).composite(fgOverlays).png().toBuffer()
    : null;

  return { bg: bgBuffer, fg: fgBuffer };
}

module.exports = { inspectPsd, processPsd, renderTemplateBase };
