/**
 * Rule-based Editorial Pipeline — zero AI tokens.
 * Google Places = place verify + photo metadata scoring only.
 */
import { normalizeSection, normalizeArticle, runEngineQA } from './cj-editorial-engine.js';
import { buildKeywordSearchPlan } from './cj-keyword-planning.js';
import { rankPhotos, photoAttrText } from './cj-photo-scoring.js';
import { generateCaptionWithEvidence } from './cj-caption.js';
import { runEditorialQA } from './cj-editorial-pipeline.js';
import { validateLodgingVenueAttribution } from './cj-photo-evidence.js';
import {
  resolveOfficialPlace,
  validatePlaceResult,
  validatePhotoAttribution,
  placeDisplayName
} from './cj-place-resolve.js';

function placeIdFromResource(id) {
  return String(id || '').replace(/^places\//, '').trim();
}

function buildPhotoAttribution(photo) {
  if (!photo || !photo.authorAttributions || !photo.authorAttributions.length) return 'Google Maps';
  return photo.authorAttributions
    .map(function (a) { return a.displayName || ''; })
    .filter(Boolean)
    .join(' / ') || 'Google Maps';
}

function buildPhotoSearchQueries(section) {
  var plan = buildKeywordSearchPlan(section, { maxQueries: 8 });
  var seen = {};
  var out = [];
  var isDistrict = section.subjectType === 'district';

  function push(q) {
    var s = String(q || '').trim();
    if (!s || seen[s]) return;
    seen[s] = true;
    var lang = /[\u3040-\u30ff\u4e00-\u9faf]/.test(s) ? 'ja' : (/[\u4e00-\u9fff]/.test(s) ? 'zh-TW' : 'en');
    out.push({ query: s, lang: lang });
  }

  if (isDistrict) {
    (section.searchKeywords || []).forEach(push);
    if (section.mapsQuery) push(section.mapsQuery);
    (section.photoPlaceQueries || []).forEach(push);
  } else {
    (section.photoPlaceQueries || []).forEach(push);
    plan.queries.forEach(function (row) { push(row.query); });
    if (section.mapsQuery) push(section.mapsQuery);
  }

  return out.slice(0, 12);
}

async function pickScoredPhoto(mapsKey, place, context, excludeUrls, item, deps) {
  var placeName = placeDisplayName(place);
  var visualKeywords = (item.imageChecklist || []).concat(item.searchKeywords || []).slice(0, 24);
  var ranked = rankPhotos(
    place.photos || [],
    Object.assign({}, context, {
      placeName: placeName,
      visualKeywords: visualKeywords,
      sectionPurpose: item.sectionPurpose || item.sectionType,
      sectionRole: item.sectionRole || item.sectionPurpose || item.sectionType,
      rejectExteriorPhoto: item.rejectExteriorPhoto
    }),
    item
  );
  var exclude = {};
  (excludeUrls || []).forEach(function (u) { if (u) exclude[u] = true; });

  for (var r = 0; r < ranked.length && r < 20; r++) {
    var row = ranked[r];
    if (!row.photo || !row.photo.name) continue;
    if (!row.gate || !row.gate.ok) continue;
    var attribution = buildPhotoAttribution(row.photo);
    var attrVal = validatePhotoAttribution(attribution, item || {});
    if (!attrVal.ok) continue;
    var lodgingVal = validateLodgingVenueAttribution(attribution, item || {});
    if (!lodgingVal.ok) continue;

    var captionCtx = {
      placeName: placeName,
      photoPlaceName: placeName,
      photoAttribution: attribution,
      sectionId: item.sectionId,
      sectionType: item.sectionType,
      sectionRole: item.sectionRole,
      sectionPurpose: item.sectionPurpose,
      subjectType: item.subjectType,
      photoIntent: item.photoIntent,
      subject: item.subject || item.title,
      matchedKeywords: row.gate.matchedKeywords || [],
      photoEvidence: row.gate.photoEvidence
    };
    var capPack = generateCaptionWithEvidence(captionCtx);
    if (!capPack.caption) continue;

    var url = await deps.resolveGooglePhotoUri(mapsKey, row.photo.name);
    if (url && !exclude[url]) {
      var candidate = {
        googlePhotoUrl: url,
        googleAttribution: attribution,
        photoScore: row.score,
        photoIndex: row.photo._index,
        matchedKeywords: row.gate.matchedKeywords || [],
        photoPlaceName: placeName,
        photoEvidence: capPack.photoEvidence,
        photoCaption: capPack.caption,
        anchorPlace: row.gate.anchorPlace || false,
        rejectReason: null
      };
      var preQa = runEngineQA(item, candidate, capPack.caption);
      if (preQa.usePlaceholder) continue;
      return candidate;
    }
  }
  return null;
}

async function resolvePhotoForSection(mapsKey, item, contentPlace, excludeUrls, deps) {
  var photoContext = {
    role: item.role || (String(item.sectionId || '').indexOf('hero') === 0 ? 'hero' : 'section'),
    sectionType: item.sectionType || 'landmark',
    sectionRole: item.sectionRole || item.sectionPurpose || 'landmark',
    sectionPurpose: item.sectionPurpose || item.sectionRole || 'landmark',
    mapsQuery: item.mapsQuery,
    officialName: item.officialName || null,
    officialNameLocal: item.officialNameLocal || null,
    visualKeywords: item.imageChecklist || []
  };

  var queries = buildPhotoSearchQueries(item);
  var q;
  for (q = 0; q < queries.length; q++) {
    var places = await deps.searchGooglePlace(mapsKey, queries[q].query, queries[q].lang);
    var p;
    for (p = 0; p < places.length; p++) {
      var placeVal = validatePlaceResult(places[p], item);
      if (!placeVal.ok) continue;
      var pn = placeDisplayName(places[p]);
      var pick = await pickScoredPhoto(
        mapsKey,
        places[p],
        Object.assign({}, photoContext, { placeName: pn }),
        excludeUrls,
        item,
        deps
      );
      if (pick) {
        pick.photoSearchUsed = queries[q].query;
        return pick;
      }
    }
  }

  if (item.allowGenericPhotoFallback !== false && contentPlace) {
    var fallbackName = placeDisplayName(contentPlace);
    var fallback = await pickScoredPhoto(
      mapsKey,
      contentPlace,
      Object.assign({}, photoContext, { placeName: fallbackName }),
      excludeUrls,
      item,
      deps
    );
    if (fallback) {
      fallback.photoSearchUsed = 'content_place';
      return fallback;
    }
  }
  return null;
}

function failedRow(sectionId, subject, mapsQuery, reason, pipelineLog) {
  return {
    sectionId: sectionId,
    subject: subject,
    mapsQuery: mapsQuery,
    placeId: null,
    googleRating: null,
    googleAddress: null,
    googlePhotoUrl: null,
    googleAttribution: null,
    imageSource: null,
    matched: false,
    rejectReason: reason,
    pipeline: pipelineLog,
    editorialQA: { pass: false, issues: [reason], usePlaceholder: true }
  };
}

export async function resolveSectionRules(mapsKey, item, articleCtx, deps) {
  var section = normalizeSection(item, articleCtx);
  var sectionId = String(section.sectionId || '').trim();
  var subject = String(section.subject || section.title || '').trim();
  var mapsQuery = String(section.mapsQuery || '').trim();
  var pipelineLog = { version: 'photo-first', steps: [], aiTokens: 0 };

  if (!sectionId) {
    return { sectionId: sectionId, error: 'missing_section_id' };
  }

  try {
    pipelineLog.steps.push('place_verify');
    var resolved = await resolveOfficialPlace(mapsKey, section, {
      getGooglePlaceById: deps.getGooglePlaceById,
      searchGooglePlace: deps.searchGooglePlace
    });
    if (!resolved || !resolved.place) {
      return failedRow(sectionId, subject, mapsQuery, 'no_valid_place', pipelineLog);
    }

    var chosen = resolved.place;
    var placeId = placeIdFromResource(chosen.id || chosen.name);
    var placeName = placeDisplayName(chosen);

    pipelineLog.steps.push('keyword_search');
    pipelineLog.steps.push('photo_first_pick');

    var photoPick = await resolvePhotoForSection(
      mapsKey,
      section,
      chosen,
      section.excludeUrls || [],
      deps
    );

    var photoCaption = photoPick ? photoPick.photoCaption : null;
    if (photoPick && photoPick.googlePhotoUrl && !photoCaption) {
      photoPick = null;
    }

    pipelineLog.steps.push('evidence_caption');
    var qa = runEditorialQA(section, photoPick);
    var engineQa = runEngineQA(section, photoPick, photoCaption);
    if (engineQa.usePlaceholder) {
      qa = Object.assign({}, qa, engineQa);
    }
    if (qa.usePlaceholder) {
      photoPick = null;
      photoCaption = null;
    }

    pipelineLog.steps.push('rule_qa');

    return {
      sectionId: sectionId,
      subject: subject,
      mapsQuery: mapsQuery,
      placeId: placeId,
      googleRating: chosen.rating != null ? chosen.rating : null,
      googleAddress: chosen.formattedAddress || null,
      googlePhotoUrl: photoPick ? photoPick.googlePhotoUrl : null,
      googleAttribution: photoPick ? photoPick.googleAttribution : null,
      imageSource: photoPick && photoPick.googlePhotoUrl ? 'google_places' : null,
      matched: !!(photoPick && photoPick.googlePhotoUrl),
      placeName: placeName,
      photoScore: photoPick ? photoPick.photoScore : null,
      photoIndex: photoPick ? photoPick.photoIndex : null,
      photoCaption: photoCaption,
      photoEvidence: photoPick ? photoPick.photoEvidence : null,
      matchedKeywords: photoPick ? photoPick.matchedKeywords : [],
      photoPlaceName: photoPick ? photoPick.photoPlaceName : null,
      searchUsed: resolved.searchUsed || null,
      photoSearchUsed: photoPick ? photoPick.photoSearchUsed : null,
      sectionType: section.sectionType || null,
      role: section.role || null,
      rejectReason: photoPick ? null : (qa.issues && qa.issues.length ? qa.issues.join(',') : 'no_valid_photo'),
      editorialQA: qa,
      pipeline: pipelineLog
    };
  } catch (err) {
    return Object.assign(failedRow(sectionId, subject, mapsQuery, String(err.message || err), pipelineLog), {
      error: String(err.message || err)
    });
  }
}

export async function resolveArticleRules(mapsKey, payload, deps) {
  var articleCtx = payload.article || {};
  var sections = Array.isArray(payload.sections) ? payload.sections : [];
  var results = [];
  var excludeUrls = Array.isArray(payload.excludeUrls) ? payload.excludeUrls.slice() : [];

  for (var i = 0; i < sections.length; i++) {
    var item = Object.assign({}, sections[i], { excludeUrls: excludeUrls });
    var row = await resolveSectionRules(mapsKey, item, articleCtx, deps);
    results.push(row);
    if (row.googlePhotoUrl) excludeUrls.push(row.googlePhotoUrl);
  }

  return { results: results, excludeUrls: excludeUrls, pipelineVersion: 'photo-first' };
}
