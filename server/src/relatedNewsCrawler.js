const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleDecoder } = require('google-news-url-decoder');
const {
  extractEntities,
  extractSignificantTokens,
  computeSimilarity,
  buildSearchQuery,
  cleanText,
} = require('./eventAnalyzer');

const googleDecoder = new GoogleDecoder();

// Verified major Vietnamese news outlets to search from
const TRUSTED_OUTLETS = [
  { name: 'VnExpress', domain: 'vnexpress.net' },
  { name: 'Tuổi Trẻ', domain: 'tuoitre.vn' },
  { name: 'Thanh Niên', domain: 'thanhnien.vn' },
  { name: 'Dân Trí', domain: 'dantri.com.vn' },
  { name: 'VietnamNet', domain: 'vietnamnet.vn' },
  { name: 'Znews (Zing)', domain: 'znews.vn' },
  { name: 'VTC News', domain: 'vtcnews.vn' },
  { name: 'Tiền Phong', domain: 'tienphong.vn' },
];

/**
 * Searches and crawls related articles, verifying that they report on the EXACT SAME EVENT.
 * Then gathers high-quality photos whose `alt` or `figcaption` strictly matches the event's entities.
 *
 * @param {string} originalTitle
 * @param {string} originalUrl
 * @param {Array<string>} originalEntities
 */
async function findRelatedNewsImages(originalTitle, originalUrl, originalEntities = []) {
  const query = buildSearchQuery(originalTitle, originalEntities);
  if (!query) return [];

  const candidateArticles = await searchArticles(query, originalUrl);
  if (candidateArticles.length === 0) return [];

  // Filter articles: strictly same event (similarity >= 0.35 or sharing at least 2 key entities)
  const matchingArticles = [];
  const origTokens = new Set(extractSignificantTokens(originalTitle));

  for (const art of candidateArticles) {
    const sim = computeSimilarity(originalTitle, art.title);
    const artTokens = extractSignificantTokens(art.title);
    const sharedTokenCount = artTokens.filter((t) => origTokens.has(t)).length;

    // Must share at least 3 significant words OR have similarity >= 35%
    if (sim >= 0.35 || sharedTokenCount >= 3) {
      matchingArticles.push({
        ...art,
        similarity: Math.round(sim * 100),
      });
    }
  }

  // Limit to top 4 most relevant related articles
  const topArticles = matchingArticles
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);

  // Crawl images from each matching article in parallel
  const allImages = [];
  const crawledPromises = topArticles.map(async (art) => {
    try {
      const images = await crawlImagesFromArticle(art, originalTitle, originalEntities);
      return images;
    } catch (err) {
      console.warn(`Failed to crawl images from ${art.url}:`, err.message);
      return [];
    }
  });

  const results = await Promise.all(crawledPromises);
  for (const imgList of results) {
    allImages.push(...imgList);
  }

  // Deduplicate images by normalized URL
  const seenUrls = new Set();
  const deduped = [];
  for (const img of allImages) {
    const key = img.url.split('?')[0].toLowerCase();
    if (!seenUrls.has(key)) {
      seenUrls.add(key);
      deduped.push(img);
    }
  }

  return deduped.slice(0, 15); // Return up to 15 verified related images
}

/**
 * Searches articles via Google News RSS (Vietnamese edition) which is free, fast, and highly reliable.
 */
async function searchArticles(query, originalUrl) {
  const articles = [];
  try {
    const encodedQuery = encodeURIComponent(query);
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=vi&gl=VN&ceid=VN:vi`;

    const res = await axios.get(rssUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'application/xml,text/xml,*/*',
      },
    });

    const $ = cheerio.load(res.data, { xmlMode: true });

    $('item').each((_, el) => {
      const title = $(el).find('title').text().trim();
      let link = $(el).find('link').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const source = $(el).find('source').text().trim() || 'Báo điện tử';

      if (!link || link === originalUrl) return;

      // Clean title: Google News often appends " - Báo VnExpress"
      const cleanTitle = title.replace(/\s+-\s+[^-]+$/, '').trim();

      articles.push({
        title: cleanTitle,
        url: link,
        sourceName: source,
        pubDate,
      });
    });
  } catch (err) {
    console.warn('Google News search failed:', err.message);
  }

  return articles.slice(0, 12);
}

/**
 * Crawls and validates images from an article page.
 * Strictly verifies `alt` or `figcaption` to ensure images belong to the news event and are NOT ads.
 */
async function crawlImagesFromArticle(article, originalTitle, originalEntities) {
  let targetUrl = article.url;
  if (targetUrl.includes('news.google.com')) {
    try {
      const decoded = await googleDecoder.decode(targetUrl);
      if (decoded && decoded.status && decoded.decoded_url) {
        targetUrl = decoded.decoded_url;
        article.url = targetUrl;
      }
    } catch (decErr) {
      console.warn('Could not decode Google News URL:', decErr.message);
    }
  }

  const response = await axios.get(targetUrl, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    maxRedirects: 5,
  });

  const $ = cheerio.load(response.data);
  const baseUrl = new URL(response.request?.res?.responseUrl || targetUrl);
  const foundImages = [];

  // Keywords that must NOT appear in alt (anti-ad blacklist)
  const AD_KEYWORDS = ['quangcao', 'quảng cáo', 'banner', 'logo', 'avatar', 'icon', 'advertisement', 'sponsor', 'tài trợ'];

  // Keywords from the original story (at least one should match alt/caption)
  const significantTokens = extractSignificantTokens(originalTitle);

  // Extract from figure > img (most reliable news images)
  $('figure, .tplCaption, [class*="photo"], [class*="image"]').each((_, container) => {
    const img = $(container).find('img').first();
    if (!img.length) return;

    const src = getBestSrc($, img);
    const resolvedUrl = resolveUrl(src, baseUrl);
    if (!resolvedUrl || !isLikelyNewsPhoto(resolvedUrl)) return;

    const figcaption = $(container).find('figcaption, .caption, .desc').text().trim();
    const alt = (img.attr('alt') || '').trim();
    const captionText = figcaption || alt;

    // 1. Anti-ad check
    const lowerCaption = captionText.toLowerCase();
    if (AD_KEYWORDS.some((ad) => lowerCaption.includes(ad))) return;

    // 2. Alt/Caption Content Verification:
    // Does the caption or alt share meaningful words with the original story?
    const hasEventMatch = isCaptionRelevant(captionText, significantTokens, originalEntities);

    if (hasEventMatch) {
      foundImages.push({
        url: resolvedUrl,
        caption: captionText || article.title,
        alt: alt || captionText,
        sourceName: article.sourceName,
        sourceArticleTitle: article.title,
        isFromMainArticle: false,
        similarityScore: article.similarity,
      });
    }
  });

  return foundImages;
}

/**
 * Checks if an image caption/alt is related to the news event.
 */
function isCaptionRelevant(caption, significantTokens, entities) {
  if (!caption || caption.length < 5) return false;
  const cleanCap = cleanText(caption);

  // Match entities (names, places)
  for (const ent of entities) {
    if (cleanCap.includes(cleanText(ent))) return true;
  }

  // Or match significant tokens from event
  let tokenMatches = 0;
  for (const token of significantTokens) {
    if (cleanCap.includes(token)) {
      tokenMatches++;
      if (tokenMatches >= 2) return true;
    }
  }

  return false;
}

function getBestSrc($, img) {
  for (const attr of ['data-src', 'data-original', 'data-lazy-src', 'data-url', 'src']) {
    const v = img.attr(attr);
    if (v && v.startsWith('http')) return v;
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

function isLikelyNewsPhoto(url) {
  const lower = url.toLowerCase();
  const skip = ['banner', 'logo', 'avatar', 'icon', 'ad/', '/ads/', 'tracking', 'pixel', 'facebook', 'twitter'];
  if (skip.some((s) => lower.includes(s))) return false;
  return /\.(jpe?g|png|webp)(\?|$)/i.test(lower) || lower.includes('/photo') || lower.includes('/image') || lower.includes('/upload');
}

module.exports = {
  findRelatedNewsImages,
  searchArticles,
};
