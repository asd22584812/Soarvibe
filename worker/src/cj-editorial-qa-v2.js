/**
 * Editorial QA v2 — verify title, body, image, caption, attribution consistency.
 */
import { callGeminiJSON } from './cj-gemini-client.js';

function buildQAPrompt(section, selected, caption, placeMeta) {
  return [
    'You are an editorial QA lead for a premium travel magazine.',
    'Check if title, body, selected image review, caption, and place attribution are CONSISTENT.',
    'Return JSON:',
    '{',
    '  "pass": boolean,',
    '  "issues": string[],',
    '  "recommendation": "approve" | "swap_image" | "rewrite_caption" | "rewrite_body" | "use_placeholder",',
    '  "summary": string',
    '}',
    '',
    'FAIL if:',
    '- Body mentions Mandarake/figures but image shows generic mall corridor',
    '- Caption describes elements not visible in image review',
    '- Image cannot support the section story',
    '- Attribution clearly wrong venue type',
    '',
    'Section title:', section.title || section.subject,
    'Section heading:', section.heading || '',
    'Body excerpt:', String(section.content || '').slice(0, 400),
    'Photo intent:', section.photoIntent || '',
    'Image review:', JSON.stringify(selected && selected.aiReview ? {
      pass: selected.aiReview.pass,
      matchedElements: selected.aiReview.matchedElements,
      visibleDescription: selected.aiReview.visibleDescription,
      rejectedReasons: selected.aiReview.rejectedReasons,
      priorityTier: selected.aiReview.priorityTier
    } : null),
    'Caption:', caption || '',
    'Attribution:', (selected && selected.attribution) || '',
    'Place:', placeMeta.placeName || '',
    'Address:', placeMeta.googleAddress || ''
  ].join('\n');
}

export async function runEditorialQAV2(section, selected, caption, placeMeta, env) {
  if (!selected || !selected.aiReview || !selected.aiReview.pass) {
    return {
      pass: false,
      issues: ['no_passing_image'],
      recommendation: 'use_placeholder',
      summary: 'No AI-approved image for this section.',
      usePlaceholder: true
    };
  }

  var prompt = buildQAPrompt(section, selected, caption, placeMeta);
  var result = await callGeminiJSON(prompt, env, {
    temperature: 0.2,
    maxOutputTokens: 1024
  });

  if (!result.ok || !result.data) {
    var heuristicPass = selected.aiReview.pass && caption && caption.length >= 8;
    return {
      pass: heuristicPass,
      issues: heuristicPass ? [] : ['qa_gemini_unavailable'],
      recommendation: heuristicPass ? 'approve' : 'use_placeholder',
      summary: heuristicPass ? 'Heuristic QA pass (Gemini QA unavailable)' : 'QA failed',
      usePlaceholder: !heuristicPass
    };
  }

  var qa = result.data;
  var usePlaceholder = qa.recommendation === 'use_placeholder'
    || qa.recommendation === 'swap_image'
    || qa.pass === false;

  return {
    pass: qa.pass === true && !usePlaceholder,
    issues: qa.issues || [],
    recommendation: qa.recommendation || (qa.pass ? 'approve' : 'use_placeholder'),
    summary: qa.summary || '',
    usePlaceholder: usePlaceholder
  };
}
