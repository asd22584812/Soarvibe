/**
 * AI Caption Generation — based on what the image actually shows.
 */
import { callGeminiJSON, callGeminiVisionJSON } from './cj-gemini-client.js';
import { trimCaption } from './cj-editorial-pipeline.js';

function buildCaptionPrompt(section, selected, articleCtx) {
  var review = selected.aiReview || {};
  return [
    'You are a Traditional Chinese (zh-TW) travel magazine caption writer.',
    'Write ONE photo caption based ONLY on what is visible in the image.',
    'The caption supplements the photo — it must NOT repeat the section title or body verbatim.',
    'Length: 12-25 Chinese characters (no line breaks).',
    'Return JSON: { "caption": string, "reasoning": string }',
    '',
    'Section title:', section.title || section.subject,
    'Section purpose:', section.sectionPurpose,
    'Photo intent:', section.photoIntent,
    'Caption intent:', section.captionIntent || 'Describe what the reader sees in the photo.',
    'Visible in image:', review.visibleDescription || '',
    'Matched elements:', (review.matchedElements || []).join(', '),
    'Photo type:', review.photoType || '',
    'Source place:', selected.sourcePlaceName || '',
    'Article theme:', articleCtx.articleTheme || ''
  ].join('\n');
}

export async function generateAICaption(section, selected, articleCtx, env) {
  var imageUrl = selected.imageUrl || selected.googlePhotoUrl;
  if (imageUrl) {
    var visionPrompt = [
      '你是繁體中文旅遊雜誌圖說編輯。只看這張照片，寫一句圖說。',
      '規則：12-28 字；只描述照片中看得見的內容；不可寫「外觀清楚標示位置」這類空話；',
      '若為女僕咖啡廳，要寫出女僕、服裝或甜點等實際畫面；若為拉麵，寫店面或碗麵；若為飯店，寫建築或入口特徵。',
      '回傳 JSON: { "caption": "..." }',
      '段落：' + (section.heading || section.title || section.subject || ''),
      '地點：' + (selected.sourcePlaceName || section.officialNameLocal || section.officialName || '')
    ].join('\n');
    var vision = await callGeminiVisionJSON(visionPrompt, imageUrl, env, { temperature: 0.4, maxOutputTokens: 256 });
    if (vision.ok && vision.data && vision.data.caption) {
      return trimCaption(String(vision.data.caption), 12, 28);
    }
  }

  if (!selected || !selected.aiReview) return null;

  var prompt = buildCaptionPrompt(section, selected, articleCtx);
  var result = await callGeminiJSON(prompt, env, {
    temperature: 0.5,
    maxOutputTokens: 512
  });

  if (!result.ok || !result.data || !result.data.caption) {
    return fallbackCaption(selected);
  }

  var caption = trimCaption(String(result.data.caption), 12, 25);
  return caption || fallbackCaption(selected);
}

function fallbackCaption(selected) {
  var desc = (selected.aiReview && selected.aiReview.visibleDescription) || '';
  if (!desc) return null;
  return trimCaption(desc.slice(0, 22) + '。', 12, 25);
}
