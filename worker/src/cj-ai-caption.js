/**
 * AI Caption Generation — based on what the image actually shows.
 */
import { callGeminiJSON } from './cj-gemini-client.js';
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
