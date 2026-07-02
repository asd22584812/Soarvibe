/**
 * Evidence-only captions — Photo First: describe what metadata proves is in the image.
 */
import { trimCaption } from './cj-editorial-pipeline.js';
import {
  classifyPhotoEvidence,
  captionFromEvidence,
  validateCaptionMatchesEvidence
} from './cj-photo-evidence.js';

function buildPhotoBlob(ctx) {
  return [
    ctx.photoPlaceName,
    ctx.photoAttribution || '',
    ctx.placeName,
    (ctx.matchedKeywords || []).join(' ')
  ].join(' ').toLowerCase();
}

export function generateCaption(ctx) {
  var blob = buildPhotoBlob(ctx || {});
  var evidence = ctx.photoEvidence || classifyPhotoEvidence(blob, ctx || {});
  var caption = captionFromEvidence(evidence, ctx || {}, ctx || {});
  if (!caption) return null;

  caption = trimCaption(caption, 12, 48);
  var valid = validateCaptionMatchesEvidence(caption, evidence);
  if (!valid.ok) return null;
  return caption;
}

export function generateCaptionWithEvidence(ctx) {
  var blob = buildPhotoBlob(ctx || {});
  var evidence = classifyPhotoEvidence(blob, ctx || {});
  var caption = generateCaption(Object.assign({}, ctx, { photoEvidence: evidence }));
  return { caption: caption, photoEvidence: evidence };
}
