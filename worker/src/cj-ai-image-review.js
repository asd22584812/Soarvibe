/**
 * AI Image Reviewer — Gemini Vision evaluates candidates against photoIntent.
 */
import { callGeminiVisionJSON } from './cj-gemini-client.js';
import { buildImageReviewPromptContext } from './cj-keyword-planning.js';

function buildReviewPrompt(ctx) {
  return [
    'You are a senior travel photo editor for premium Japan travel magazines (楽吃購, MATCHA, LIVE JAPAN, Japan Travel).',
    'Review this photo for a City Journal article section.',
    'Return ONLY compact JSON:',
    '{"pass":boolean,"score":0-100,"matchedElements":[],"priorityTier":1|2|3,"visibleDescription":"..."}',
    '',
    'Rules:',
    '- matchedElements MUST list exact checklist items visible in the image (minimum ' + (ctx.minChecklistHits || 3) + ').',
    '- Reject generic mall corridors, plain sidewalks, wrong venue types, exterior-only when interior is required.',
    '- priorityTier 1 = matches primary photo priority, 2 = secondary, 3 = tertiary (lowest acceptable).',
    '- visibleDescription = factual description of what is IN the image pixels.',
    '- supportsBody = whether this image can support the section body text.',
    '',
    'Section context:',
    JSON.stringify(ctx, null, 2)
  ].join('\n');
}

export async function reviewImageCandidate(candidate, section, articleCtx, env) {
  var ctx = buildImageReviewPromptContext(section, articleCtx);
  ctx.candidateMeta = {
    sourcePlaceName: candidate.sourcePlaceName,
    searchQuery: candidate.searchQuery,
    attribution: candidate.attribution,
    photoIndex: candidate.photoIndex
  };

  var prompt = buildReviewPrompt(ctx);
  var result = await callGeminiVisionJSON(prompt, candidate.imageUrl, env, {
    temperature: 0.15,
    maxOutputTokens: 1024
  });

  if (!result.ok) {
    return {
      candidateId: candidate.candidateId,
      pass: false,
      score: 0,
      error: result.error,
      raw: result.raw ? String(result.raw).slice(0, 500) : null,
      review: null
    };
  }

  var review = result.data || {};
  var matched = Array.isArray(review.matchedElements) ? review.matchedElements : [];
  var minHits = section.minChecklistHits || 3;
  var score = typeof review.score === 'number' ? review.score : 0;
  var pass = review.pass !== false
    && score >= ((section.minPassScore || 70) - 5)
    && matched.length >= minHits
    && review.supportsBody !== false;

  return {
    candidateId: candidate.candidateId,
    pass: pass,
    score: typeof review.score === 'number' ? review.score : 0,
    matchedElements: matched,
    missingElements: review.missingElements || [],
    rejectedReasons: review.rejectedReasons || [],
    priorityTier: review.priorityTier || 3,
    photoType: review.photoType || '',
    visibleDescription: review.visibleDescription || '',
    supportsBody: review.supportsBody !== false,
    review: review,
    model: result.model
  };
}

export async function reviewCandidates(candidates, section, articleCtx, env, options) {
  var maxReview = (options && options.maxReview) || 5;
  var minPassScore = (options && options.minPassScore) || 72;
  var toReview = candidates.slice(0, maxReview);
  var results = [];
  var best = null;

  for (var i = 0; i < toReview.length; i++) {
    var candidate = toReview[i];
    var reviewed = await reviewImageCandidate(candidate, section, articleCtx, env);
    var row = Object.assign({}, candidate, { aiReview: reviewed });
    results.push(row);

    if (reviewed.pass && reviewed.score >= minPassScore) {
      if (!best || reviewed.score > best.aiReview.score
        || (reviewed.score === best.aiReview.score && reviewed.priorityTier < best.aiReview.priorityTier)) {
        best = row;
      }
      if (reviewed.score >= 85 && reviewed.priorityTier === 1) {
        break;
      }
    }
  }

  if (!best) {
    for (var j = 0; j < results.length; j++) {
      var r = results[j];
      if (r.aiReview && r.aiReview.pass) {
        if (!best || r.aiReview.score > best.aiReview.score) best = r;
      }
    }
  }

  return {
    reviewed: results,
    selected: best,
    reviewCount: results.length
  };
}
