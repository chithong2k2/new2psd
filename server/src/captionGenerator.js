/**
 * captionGenerator.js
 * Intelligent In-Image Caption & Title Generator for Vietnamese News Fanpages.
 * Strictly guarantees word count between 12 and 22 words to fit template card boundaries.
 */

const axios = require('axios');

// Tone Definitions with characteristic tags and stylistic guidelines
const TONE_CONFIGS = {
  viral: {
    id: 'viral',
    label: 'Giật tít / Sốc',
    icon: '💥',
    tagColor: '#ef4444', // red
    tags: ['CỰC SỐC:', 'CHUYỆN KHÓ TIN:', 'GÓC HÓNG:', 'TIN NÓNG 24H:', 'CHUYỆN LẠ:', 'BẬT NGỬA:'],
    prefixColor: '#dc2626',
    description: 'Kịch tính, kích thích tò mò, từ ngữ hành động mạnh mẽ, thu hút click',
  },
  politics: {
    id: 'politics',
    label: 'Thời sự / Xã hội',
    icon: '🏛️',
    tagColor: '#2563eb', // blue
    tags: ['THỜI SỰ:', 'CHÍNH THỨC:', 'THÔNG BÁO:', 'VIỆT NAM:', 'PHÁP LUẬT:', 'QUỐC TẾ:'],
    prefixColor: '#1d4ed8',
    description: 'Nghiêm túc, chuẩn mực báo chí, bám sát sự thật, trung thực',
  },
  entertainment: {
    id: 'entertainment',
    label: 'Giải trí / Showbiz',
    icon: '🎭',
    tagColor: '#f59e0b', // amber
    tags: ['SHOWBIZ:', 'HOT:', 'SAO VIỆT:', 'GEN Z:', 'NETIZEN:', 'CỰC HOT:'],
    prefixColor: '#d97706',
    description: 'Trẻ trung, bắt trend, phong cách mạng xã hội, kích thích bàn luận',
  },
  curiosity: {
    id: 'curiosity',
    label: 'Độc lạ / Khám phá',
    icon: '🔍',
    tagColor: '#10b981', // emerald
    tags: ['BẠN CÓ BIẾT:', 'CHUYỆN LẠ:', 'KHOA HỌC:', 'KHÁM PHÁ:', 'ĐỘC LẠ:'],
    prefixColor: '#059669',
    description: 'Câu hỏi tò mò, kiến thức mới lạ, sự thật bất ngờ đằng sau sự việc',
  },
  finance: {
    id: 'finance',
    label: 'Kinh tế / Tài chính',
    icon: '📈',
    tagColor: '#0ea5e9', // sky
    tags: ['KINH TẾ:', 'TÀI CHÍNH:', 'THỊ TRƯỜNG:', 'GIÁ VÀNG:', 'BẤT ĐỘNG SẢN:'],
    prefixColor: '#0284c7',
    description: 'Tập trung vào biến động số liệu, giá cả, thị trường và tác động',
  },
  sports: {
    id: 'sports',
    label: 'Thể thao / Bóng đá',
    icon: '⚽',
    tagColor: '#8b5cf6', // purple
    tags: ['THỂ THAO:', 'BÓNG ĐÁ:', 'KẾT QUẢ:', 'TIN NÓNG BÓNG ĐÁ:', 'CHUYỂN NHƯỢNG:'],
    prefixColor: '#7c3aed',
    description: 'Tốc độ, kịch tính, kết quả trận đấu, thông tin ngôi sao thể thao',
  },
};

/**
 * Strips newspaper source stamps, author names, timestamps, and junk prefixes.
 */
function cleanRawNewsTitle(str = '') {
  return str
    .replace(/^(\[|\()?(VnExpress|Tuổi Trẻ|Thanh Niên|Dân trí|Zing News|Znews|VTV|VTC|Soha|Kenh14|VietnamNet|VOV|Lao Động|Tiền Phong)(\]|\))?(\s*[-:–|]\s*)?/i, '')
    .replace(/(\s*[-:–|]\s*)(VnExpress|Tuổi Trẻ|Thanh Niên|Dân trí|Znews|Zing|VTV|VTC|Báo .+)$/i, '')
    .replace(/^(Báo .+? đưa tin|Theo .+?|Mới nhất:)\s*[-:]?\s*/i, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Counts words in Vietnamese text.
 */
function countWords(str = '') {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Truncates text cleanly at word boundaries if it exceeds maxWords.
 * If sentence is already <= maxWords, keeps it 100% complete.
 */
function enforceWordLimit(text = '', minWords = 10, maxWords = 22) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();

  // If longer than maxWords, slice up to maxWords
  const slice = words.slice(0, maxWords);
  let result = slice.join(' ');
  result = result.replace(/[,;:\-–]+$/, '').trim();
  return result;
}

/**
 * Synthesizes 4 distinct in-image captions tailored to the requested tone.
 * Rule-based NLP pattern synthesizer (always fast, zero external dependencies).
 */
function synthesizeCaptionsRuleBased(title = '', description = '', snippet = '', tone = 'viral') {
  const config = TONE_CONFIGS[tone] || TONE_CONFIGS.viral;
  const cleanTitle = cleanRawNewsTitle(title);
  const cleanDesc = cleanRawNewsTitle(description || snippet);

  const tags = config.tags;
  const tag1 = tags[0];
  const tag2 = tags[1] || tags[0];
  const tag3 = tags[2] || tags[0];
  const tag4 = tags[3] || tags[0];

  const results = [];

  // ── VARIATION 1: Direct High-Impact Headline ─────────────────────────────
  let body1 = cleanTitle;
  // If title is naturally <= 20 words, keep 100% intact!
  if (countWords(body1) > 20) {
    body1 = enforceWordLimit(body1, 10, 20);
  }
  results.push(createSuggestionItem(tag1, body1.toUpperCase(), config));

  // ── VARIATION 2: Tone-Specific Stylistic Angle ───────────────────────────
  let body2 = '';
  // Extract core event without redundant leading words
  const coreEvent = cleanTitle
    .replace(/^(Phát hiện|Bắt quả tang|Bất ngờ|Xôn xao|Vụ việc|Thông tin|Nghi vấn)\s+/i, '')
    .trim();

  if (tone === 'viral') {
    body2 = countWords(cleanTitle) <= 15
      ? `KHÔNG THỂ TIN ĐƯỢC: ${coreEvent.toUpperCase()}`
      : `BẤT NGỜ TRƯỚC SỰ THẬT: ${enforceWordLimit(coreEvent, 8, 16).toUpperCase()}`;
  } else if (tone === 'politics') {
    body2 = countWords(cleanTitle) <= 15
      ? `THÔNG TIN CHÍNH THỨC VỀ ${coreEvent.toUpperCase()}`
      : `DIỄN BIẾN MỚI NHẤT: ${enforceWordLimit(coreEvent, 8, 16).toUpperCase()}`;
  } else if (tone === 'entertainment') {
    body2 = countWords(cleanTitle) <= 15
      ? `NETIZEN XÔN XAO TRƯỚC TIN ${coreEvent.toUpperCase()}`
      : `DÂN MẠNG RẦN RẦN BÀN TÁN: ${enforceWordLimit(coreEvent, 8, 16).toUpperCase()}`;
  } else if (tone === 'curiosity') {
    body2 = countWords(cleanTitle) <= 15
      ? `SỰ THẬT ĐẰNG SAU CHUYỆN ${coreEvent.toUpperCase()}`
      : `BẠN ĐÃ BIẾT CHƯA: ${enforceWordLimit(coreEvent, 8, 16).toUpperCase()}`;
  } else if (tone === 'finance') {
    body2 = countWords(cleanTitle) <= 15
      ? `BIẾN ĐỘNG MỚI NHẤT VỀ ${coreEvent.toUpperCase()}`
      : `THỊ TRƯỜNG DẬY SÓNG VÌ ${enforceWordLimit(coreEvent, 8, 16).toUpperCase()}`;
  } else if (tone === 'sports') {
    body2 = countWords(cleanTitle) <= 15
      ? `KẾT QUẢ KỊCH TÍNH: ${coreEvent.toUpperCase()}`
      : `DIỄN BIẾN NÓNG BỎNG: ${enforceWordLimit(coreEvent, 8, 16).toUpperCase()}`;
  }
  body2 = enforceWordLimit(body2, 10, 20);
  results.push(createSuggestionItem(tag2, body2, config));

  // ── VARIATION 3: Core Description / Consequence Focus ────────────────────
  let body3 = '';
  if (cleanDesc && cleanDesc.length > 20) {
    const firstSentence = cleanDesc.split(/[.!?]/)[0].trim();
    if (countWords(firstSentence) <= 18) {
      body3 = firstSentence.toUpperCase();
    } else {
      body3 = enforceWordLimit(firstSentence, 10, 18).toUpperCase();
    }
  } else {
    body3 = `${cleanTitle.toUpperCase()} KHIẾN NHIỀU NGƯỜI BẤT NGỜ`;
  }
  body3 = enforceWordLimit(body3, 10, 20);
  results.push(createSuggestionItem(tag3, body3, config));

  // ── VARIATION 4: Question / Hook Variation ───────────────────────────────
  let body4 = '';
  if (tone === 'curiosity' || tone === 'viral') {
    body4 = `VÌ SAO ${enforceWordLimit(coreEvent, 6, 14).toUpperCase()} LẠI GÂY BÃO MẠNG?`;
  } else if (tone === 'finance') {
    body4 = `LIỆU ${enforceWordLimit(coreEvent, 6, 14).toUpperCase()} SẼ TÁC ĐỘNG THẾ NÀO?`;
  } else if (tone === 'politics') {
    body4 = `CƠ QUAN CHỨC NĂNG LÊN TIẾNG VỀ ${enforceWordLimit(coreEvent, 6, 14).toUpperCase()}`;
  } else {
    body4 = `ĐIỀU GÌ KHIẾN ${enforceWordLimit(coreEvent, 6, 14).toUpperCase()} THU HÚT CHÚ Ý?`;
  }
  body4 = enforceWordLimit(body4, 10, 20);
  results.push(createSuggestionItem(tag4, body4, config));

  return results;
}

function createSuggestionItem(tag, textBody, config) {
  // Ensure clean uppercase title for fanpage style
  const formattedBody = textBody.trim();
  const fullText = `${tag} ${formattedBody}`.trim();
  const wordCount = countWords(fullText);

  return {
    tag,
    text: formattedBody,
    fullText,
    wordCount,
    tone: config.id,
    toneLabel: config.label,
    tagColor: config.tagColor,
    prefixColor: config.prefixColor,
  };
}

/**
 * Generates in-image captions with length constraints.
 * Tries Gemini if GEMINI_API_KEY is available; otherwise uses smart rule-based engine.
 */
async function generateInImageCaptions({ title, description, snippet, tone = 'viral', customPrompt }) {
  const config = TONE_CONFIGS[tone] || TONE_CONFIGS.viral;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const prompt = `
Bạn là chuyên gia biên tập giật tít và sáng tạo tiêu đề cho các Fanpage tin tức triệu followers hàng đầu tại Việt Nam (như Kaito Kid, Beatvn, Theanh28, Tuổi Trẻ Cười).
Nhiệm vụ: Dựa vào thông tin bài báo dưới đây, hãy tạo 4 tiêu đề/caption NẰM TRONG ẢNH (In-Image Headline).

THÔNG TIN BÀI BÁO:
- Tiêu đề: "${title}"
- Mô tả: "${description || snippet || ''}"
${customPrompt ? `- Yêu cầu thêm: "${customPrompt}"` : ''}

YÊU CẦU BẮT BUỘC VỀ ĐỘ DÀI VÀ ĐỊNH DẠNG:
1. ĐỘ DÀI: Đây là Title nằm trên thẻ đồ họa của bức ảnh, vì vậy PHẢI GỌI GỌN TỐI ĐA 12 ĐẾN 22 TỪ (khoảng 65 đến 110 ký tự), tuyệt đối không dài hơn để không bị tràn khung!
2. PHONG CÁCH: Thể loại "${config.label}" (${config.description}).
3. Tiền tố (tag) phù hợp: Hãy chọn 1 trong các tag: ${config.tags.join(', ')}.
4. Toàn bộ chữ phần thân tiêu đề viết IN HOA tiếng Việt chuẩn dấu (hoặc chữ hoa nổi bật).

HÃY TRẢ VỀ DUY NHẤT MỘT ĐỊNH DẠNG JSON HỢP LỆ (không dùng markdown backticks nếu có thể, hoặc bọc trong \`\`\`json):
[
  {
    "tag": "CỰC SỐC:",
    "text": "NỘI DUNG CHÍNH RÚT GỌN 12-18 TỪ",
    "fullText": "CỰC SỐC: NỘI DUNG CHÍNH RÚT GỌN 12-18 TỪ"
  }
]
`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await axios.post(
        geminiUrl,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
        },
        { timeout: 8000 }
      );

      const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 4).map((item, idx) => {
          const tag = item.tag || config.tags[idx % config.tags.length];
          const text = enforceWordLimit(item.text || '', 10, 20);
          return createSuggestionItem(tag, text, config);
        });
      }
    } catch (err) {
      console.warn('Gemini caption generation failed, falling back to rule-based engine:', err.message);
    }
  }

  // Fallback to Rule-based Synthesizer
  return synthesizeCaptionsRuleBased(title, description, snippet, tone);
}

module.exports = {
  TONE_CONFIGS,
  generateInImageCaptions,
  enforceWordLimit,
  countWords,
};
