/**
 * eventAnalyzer.js
 * Extracts key entities, date window, and core semantic fingerprint from Vietnamese news articles.
 */

// Common Vietnamese stopwords to eliminate when building search query & matching
const STOP_WORDS = new Set([
  'va', 'và', 'la', 'là', 'cua', 'của', 'trong', 'tai', 'tại', 'tren', 'trên',
  'duoi', 'dưới', 'cho', 'voi', 'với', 'nhung', 'những', 'cac', 'các', 'mot', 'một',
  'hai', 'ba', 'bon', 'bốn', 'nam', 'năm', 'sau', 'khi', 'de', 'để', 'tu', 'từ',
  'den', 'đến', 'ra', 'vao', 'vào', 'do', 'được', 'duoc', 'bi', 'bị', 'se', 'sẽ',
  'da', 'đã', 'dang', 'đang', 'nay', 'này', 'do', 'đó', 'kia', 'theo', 'nhu', 'như',
  've', 'về', 'thi', 'thì', 'ma', 'mà', 'cung', 'cũng', 'con', 'còn', 'co', 'có',
  'khong', 'không', 'chua', 'chưa', 'rat', 'rất', 'qua', 'quá', 'nhieu', 'nhiều',
  'it', 'ít', 'moi', 'mới', 'cu', 'cũ', 'ngay', 'ngày', 'thang', 'tháng', 'tin',
  'tuc', 'tức', 'bao', 'báo', 'moi', 'vua', 'vừa', 'xem', 'them', 'thêm', 'cho',
  'biet', 'biết', 'noi', 'nói', 'rang', 'rằng', 'hom', 'hôm', 'chieu', 'chiều',
  'sang', 'sáng', 'toi', 'tối', 'dem', 'đêm', 'trua', 'trưa',
]);

/**
 * Normalizes text to lowercase, removes punctuation.
 */
function cleanText(str = '') {
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts proper nouns / capitalized word phrases (potential entities like person names, places, brands).
 */
function extractEntities(rawText = '') {
  // Matches capitalized phrases like: "Quảng Ninh", "Phú Thọ", "Cầu Phong Châu", "HLV Kim Sang-sik", "VinFast"
  const regex = /\b[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ0-9_/-]*(?:\s+[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ0-9_/-]*)*\b/g;

  const matches = rawText.match(regex) || [];
  const entities = new Set();

  for (const m of matches) {
    const trimmed = m.trim();
    // Skip if it's just 1 short common capitalized word at start of sentence like "Ngày", "Theo", "Sau"
    if (trimmed.length > 2) {
      const lower = cleanText(trimmed);
      if (!STOP_WORDS.has(lower)) {
        entities.add(trimmed);
      }
    }
  }

  return Array.from(entities);
}

/**
 * Extracts meaningful non-stopword tokens from text.
 */
function extractSignificantTokens(text = '') {
  const cleaned = cleanText(text);
  const words = cleaned.split(' ');
  return words.filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Computes Jaccard Similarity between two sets of significant tokens.
 */
function computeSimilarity(titleA, titleB) {
  const tokensA = new Set(extractSignificantTokens(titleA));
  const tokensB = new Set(extractSignificantTokens(titleB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Builds an optimal search query from title and extracted entities.
 * Focuses on 3-5 strongest keywords for Google News/Search.
 */
function buildSearchQuery(title = '', entities = []) {
  if (Array.isArray(entities)) {
    const validEntities = entities.filter((e) => typeof e === 'string' && e.trim().length > 0);
    if (validEntities.length >= 2) {
      return validEntities.slice(0, 3).join(' ');
    }
  }

  // Otherwise take top significant keywords from title
  const tokens = extractSignificantTokens(title);
  return tokens.slice(0, 5).join(' ');
}

module.exports = {
  extractEntities,
  extractSignificantTokens,
  computeSimilarity,
  buildSearchQuery,
  cleanText,
  STOP_WORDS,
};
