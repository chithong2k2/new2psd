const axios = require('axios');
const cheerio = require('cheerio');
const { extractEntities } = require('./eventAnalyzer');

/**
 * Extracts article title, source, entities, and verified news images from a news URL.
 * Automatically discards advertising banners and unrelated icon/sponsor media.
 */
async function extractArticle(url) {
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      Referer: 'https://www.google.com/',
    },
    maxRedirects: 5,
  });

  const $ = cheerio.load(response.data);
  const baseUrl = new URL(url);

  const title = extractTitle($);
  const description = extractDescription($);
  const snippet = extractSnippet($, title);
  const source = extractSource($, baseUrl);
  const entities = extractEntities(title + ' ' + description);
  const images = extractImages($, url, baseUrl, source, title);

  // Mark first image as recommended
  if (images.length > 0) images[0].recommended = true;

  return { title, description, snippet, source, url, entities, images, extractedAt: new Date().toISOString() };
}

function extractTitle($) {
  return (
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text() ||
    ''
  ).trim();
}

function extractDescription($) {
  return (
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    ''
  ).trim();
}

function extractSnippet($, title = '') {
  let snippet = '';
  $('article p, .detail-content p, .article-body p, .content-detail p, main p, p').each((_, el) => {
    if (snippet) return;
    const text = $(el).text().trim();
    if (text.length >= 40 && text !== title && !isAdOrJunk('', text)) {
      snippet = text;
    }
  });
  return snippet;
}

function extractSource($, baseUrl) {
  return (
    $('meta[property="og:site_name"]').attr('content') ||
    baseUrl.hostname.replace(/^www\./, '')
  ).trim();
}

const AD_BLACKLIST = [
  'banner', 'quangcao', 'quảng cáo', 'ads', 'advertisement', 'sponsor', 'tài trợ',
  'logo', 'avatar', 'icon', 'favicon', 'widget', 'thumb_share', 'btn_', 'button',
  'tracking', 'pixel', '1x1'
];

function isAdOrJunk(url = '', text = '') {
  const lowerUrl = url.toLowerCase();
  const lowerText = text.toLowerCase();
  return AD_BLACKLIST.some((term) => lowerUrl.includes(term) || lowerText.includes(term));
}

function extractImages($, originalUrl, baseUrl, sourceName, articleTitle) {
  const imageMap = new Map(); // key: normalized url → ArticleImage

  // 1. Open Graph image (hero image)
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage && !isAdOrJunk(ogImage)) {
    const resolved = resolveUrl(ogImage, baseUrl);
    if (resolved && isContentImage(resolved)) {
      const caption =
        $('meta[property="og:image:alt"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        articleTitle;
      if (!isAdOrJunk(resolved, caption)) {
        imageMap.set(normalizeUrl(resolved), {
          url: resolved,
          caption: caption.trim(),
          sourceName,
          sourceArticleTitle: articleTitle,
          isFromMainArticle: true,
          recommended: false,
        });
      }
    }
  }

  // 2. JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        extractJsonLdImages(entry, baseUrl, imageMap, sourceName, articleTitle);
      }
    } catch (_) {}
  });

  // 3. figure > figcaption (primary source for authentic editorial photos)
  $('figure, .tplCaption, [class*="photo"], [class*="image"]').each((_, el) => {
    const img = $(el).find('img').first();
    if (!img.length) return;

    const src = getBestSrc($, img);
    const resolved = resolveUrl(src, baseUrl);
    if (!resolved || !isContentImage(resolved)) return;

    const figcaption = $(el).find('figcaption, .caption, .desc').first().text().trim();
    const alt = (img.attr('alt') || '').trim();
    const caption = figcaption || alt;

    if (isAdOrJunk(resolved, caption)) return;

    const key = normalizeUrl(resolved);
    if (!imageMap.has(key)) {
      imageMap.set(key, {
        url: resolved,
        caption: caption || articleTitle,
        sourceName,
        sourceArticleTitle: articleTitle,
        isFromMainArticle: true,
        recommended: false,
      });
    }
  });

  // 4. Article body images (exclude sidebars, widgets, headers)
  const containers = $('article, main, [class*="content"], [class*="article-body"], [class*="post-body"]');
  const imgEls = containers.length ? containers.find('img') : $('img');

  imgEls.each((_, el) => {
    const img = $(el);
    const src = getBestSrc($, img);
    const resolved = resolveUrl(src, baseUrl);
    if (!resolved || !isContentImage(resolved)) return;

    const alt = (img.attr('alt') || '').trim();
    if (isAdOrJunk(resolved, alt)) return;

    // Skip tiny icons
    const w = parseInt(img.attr('width') || '0', 10);
    const h = parseInt(img.attr('height') || '0', 10);
    if ((w > 0 && w < 200) || (h > 0 && h < 200)) return;

    const key = normalizeUrl(resolved);
    if (!imageMap.has(key)) {
      imageMap.set(key, {
        url: resolved,
        caption: alt || articleTitle,
        sourceName,
        sourceArticleTitle: articleTitle,
        isFromMainArticle: true,
        recommended: false,
      });
    }
  });

  return Array.from(imageMap.values()).slice(0, 20); // cap at 20 clean images
}

function extractJsonLdImages(data, baseUrl, imageMap) {
  if (!data || typeof data !== 'object') return;

  for (const key of ['image', 'thumbnailUrl', 'contentUrl']) {
    const val = data[key];
    if (typeof val === 'string') {
      addJsonLdImage(val, baseUrl, imageMap);
    } else if (Array.isArray(val)) {
      val.forEach((v) => {
        if (typeof v === 'string') addJsonLdImage(v, baseUrl, imageMap);
        else if (v && v.url) addJsonLdImage(v.url, baseUrl, imageMap);
      });
    } else if (val && val.url) {
      addJsonLdImage(val.url, baseUrl, imageMap);
    }
  }
}

function addJsonLdImage(urlStr, baseUrl, imageMap) {
  const resolved = resolveUrl(urlStr, baseUrl);
  if (resolved && isContentImage(resolved)) {
    const k = normalizeUrl(resolved);
    if (!imageMap.has(k)) {
      imageMap.set(k, { url: resolved, caption: '', recommended: false });
    }
  }
}

function getBestSrc($, img) {
  for (const attr of ['data-src', 'data-lazy-src', 'data-original', 'data-url']) {
    const v = img.attr(attr);
    if (v && v.startsWith('http')) return v;
  }
  const srcset = img.attr('srcset');
  if (srcset) {
    const parts = srcset.split(',').map((s) => s.trim().split(/\s+/));
    // Take the largest (last or highest width descriptor)
    const sorted = parts.sort((a, b) => {
      const wa = parseFloat((a[1] || '0').replace(/[wx]/i, '')) || 0;
      const wb = parseFloat((b[1] || '0').replace(/[wx]/i, '')) || 0;
      return wb - wa;
    });
    if (sorted[0]?.[0]) return sorted[0][0];
  }
  return img.attr('src') || '';
}

function resolveUrl(src, baseUrl) {
  if (!src || src.startsWith('data:')) return null;
  try {
    if (src.startsWith('//')) return 'https:' + src;
    if (src.startsWith('http')) return src;
    return new URL(src, baseUrl.origin).href;
  } catch (_) {
    return null;
  }
}

function normalizeUrl(url) {
  const idx = url.indexOf('?');
  return idx > 0 ? url.substring(0, idx) : url;
}

function isContentImage(url) {
  const lower = url.toLowerCase();
  // Skip icons, logos, ads, tracking pixels
  const skip = ['logo', 'icon', 'avatar', 'banner', '1x1', 'pixel', 'tracker', 'ad/', '/ads/', 'favicon'];
  if (skip.some((s) => lower.includes(s))) return false;
  // Must look like an image
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(lower) ||
    lower.includes('/image') ||
    lower.includes('/photo') ||
    lower.includes('/media') ||
    lower.includes('/img');
}

module.exports = { extractArticle };
