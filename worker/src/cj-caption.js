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
  var evidence = ctx.photoEvidence || classifyPhotoEvidence(blob, ctx || {});
  if (ctx.travelPhotoSlot === 'storefront' || ctx.travelPhotoSlot === 'exterior' || ctx.travelPhotoSlot === 'district_panorama') {
    if (evidence.types.indexOf('facade') !== -1) evidence = Object.assign({}, evidence, { primary: 'facade' });
    else if (evidence.types.indexOf('street_landmark') !== -1) evidence = Object.assign({}, evidence, { primary: 'street_landmark' });
    else if (evidence.types.indexOf('landmark_building') !== -1) evidence = Object.assign({}, evidence, { primary: 'landmark_building' });
  }
  if (ctx.travelPhotoSlot === 'dish' && evidence.types.indexOf('food_dish') !== -1) {
    evidence = Object.assign({}, evidence, { primary: 'food_dish' });
  }
  if ((ctx.travelPhotoSlot === 'experience' || ctx.travelPhotoSlot === 'wall') && evidence.types.indexOf('dessert') !== -1) {
    evidence = Object.assign({}, evidence, { primary: 'dessert' });
  }
  if (ctx.travelPhotoSlot === 'wall' && evidence.types.indexOf('gachapon_wall') !== -1) {
    evidence = Object.assign({}, evidence, { primary: 'gachapon_wall' });
  }
  var caption = generateCaption(Object.assign({}, ctx, { photoEvidence: evidence }));
  return { caption: caption, photoEvidence: evidence };
}
