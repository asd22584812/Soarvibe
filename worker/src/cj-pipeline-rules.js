/**
 * Rule-based Editorial Pipeline — zero AI tokens.
 * Google Places = place verify + photo metadata scoring only.
 */
import { normalizeSection, normalizeArticle, runEngineQA } from './cj-editorial-engine.js';
import { buildLocaleSearchQueries, resolveRegionCode } from './cj-locale-search.js';
import { isAnchorPhotoPlace } from './cj-editorial-pipeline.js';
import { rankPhotos, photoAttrText } from './cj-photo-scoring.js';
import { generateCaptionWithEvidence } from './cj-caption.js';
import { trimCaption } from './cj-editorial-pipeline.js';
import { runEditorialQA } from './cj-editorial-pipeline.js';
import { validateLodgingVenueAttribution } from './cj-photo-evidence.js';
import {
  resolveOfficialPlace,
  validatePlaceResult,
  validatePhotoAttribution,
  placeDisplayName,
  placeInTargetRegion,
  attributionInTargetRegion
} from './cj-place-resolve.js';
import { resolveVenueFallback } from './cj-venue-fallback.js';
import {
  getTravelPhotoSlots,
  validateTravelSlotGate,
  validateCopyTravelAlignment
} from './cj-travel-photo-rules.js';

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

function buildPhotoSearchQueries(section, articleCtx) {
  var isDistrict = section.subjectType === 'district';
  var plan = buildLocaleSearchQueries(section, articleCtx, { maxQueries: 12 });
  if (isDistrict) {
    return plan.queries;
  }
  return plan.queries;
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
      rejectExteriorPhoto: item.rejectExteriorPhoto,
      photoAnchorTerms: item.photoAnchorTerms || []
    }),
    item
  );
  var exclude = {};
  (excludeUrls || []).forEach(function (u) { if (u) exclude[u] = true; });
  var debugRejects = [];
  var travelSlots = getTravelPhotoSlots(item, { primaryOnly: true });

  for (var si = 0; si < travelSlots.length; si++) {
    var slot = travelSlots[si];
    for (var r = 0; r < ranked.length && r < 15; r++) {
      var row = ranked[r];
      if (!row.photo || !row.photo.name) continue;
      if (!row.gate || !row.gate.ok) {
        if (debugRejects.length < 8) debugRejects.push(row.gate && row.gate.rejectReason || 'gate_fail');
        continue;
      }
      var slotGate = validateTravelSlotGate(row.gate.photoEvidence, row.photo._index, slot, item, row.photo);
      if (!slotGate.ok) {
        if (debugRejects.length < 8) debugRejects.push(slotGate.reason || 'travel_slot_fail');
        continue;
      }
      var attribution = buildPhotoAttribution(row.photo);
      var attrVal = validatePhotoAttribution(attribution, item || {});
      if (!attrVal.ok && !(item && (item.primaryVenueFailed || item.venueSwapped))) continue;
      var lodgingVal = validateLodgingVenueAttribution(attribution, item || {});
      if (!lodgingVal.ok && !(item && (item.primaryVenueFailed || item.venueSwapped))) continue;

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
      if (!capPack.caption && item && (item.primaryVenueFailed || item.venueSwapped)) {
        var swapRole = item.sectionRole || item.sectionType;
        if (swapRole === 'hotel' || swapRole === 'hostel') {
          capPack = {
            caption: trimCaption('旅宿外觀與入口清楚可見，方便確認是否抵達正確地點。', 12, 48),
            photoEvidence: { primary: 'facade', types: ['facade'], blob: placeName }
          };
        }
      }
      if (!capPack.caption) continue;

      var copyAlign = validateCopyTravelAlignment(item, capPack.photoEvidence || row.gate.photoEvidence, capPack.caption);
      if (!copyAlign.ok && !(item && (item.primaryVenueFailed || item.venueSwapped))) {
        if (debugRejects.length < 8) debugRejects.push(copyAlign.reason || 'travel_copy_mismatch');
        continue;
      }

      var url = await deps.resolveGooglePhotoUri(mapsKey, row.photo.name);
      if (url && !exclude[url]) {
        return {
          googlePhotoUrl: url,
          googleAttribution: attribution,
          photoScore: row.score,
          photoIndex: row.photo._index,
          matchedKeywords: row.gate.matchedKeywords || [],
          photoPlaceName: placeName,
          photoEvidence: capPack.photoEvidence,
          photoCaption: capPack.caption,
          placeId: item.placeId || null,
          anchorPlace: row.gate.anchorPlace || false,
          travelPhotoSlot: slot.id,
          rejectReason: null
        };
      }
    }
  }
  if (debugRejects.length) {
    return { googlePhotoUrl: null, photoDebugRejects: debugRejects };
  }
  return null;
}

async function resolvePhotoForSection(mapsKey, item, contentPlace, excludeUrls, deps, articleCtx) {
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

  var contentPlaceName = contentPlace ? placeDisplayName(contentPlace) : '';
  var tryContentPlaceFirst = contentPlace && isAnchorPhotoPlace(contentPlaceName, item.photoAnchorTerms || []);

  if (tryContentPlaceFirst) {
    var primaryName = placeDisplayName(contentPlace);
    var primaryPick = await pickScoredPhoto(
      mapsKey,
      contentPlace,
      Object.assign({}, photoContext, { placeName: primaryName }),
      excludeUrls,
      item,
      deps
    );
    if (primaryPick && primaryPick.googlePhotoUrl) {
      primaryPick.photoSearchUsed = 'content_place';
      return primaryPick;
    }
    if (primaryPick && primaryPick.photoDebugRejects) {
      item._photoDebugRejects = primaryPick.photoDebugRejects;
    }
  }

  var maxQueries = tryContentPlaceFirst ? 4 : 10;
  var queries = buildPhotoSearchQueries(item, articleCtx).slice(0, maxQueries);
  var q;
  for (q = 0; q < queries.length; q++) {
    var places = await deps.searchGooglePlace(mapsKey, queries[q].query, queries[q].lang, deps.regionCode);
    var p;
    for (p = 0; p < places.length; p++) {
      if (!placeInTargetRegion(places[p], item, deps.regionCode || 'JP')) continue;
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
      if (pick && pick.googlePhotoUrl) {
        pick.photoSearchUsed = queries[q].query;
        return pick;
      }
    }
  }

  if (!tryContentPlaceFirst && contentPlace) {
    var fallbackName = placeDisplayName(contentPlace);
    var fallbackPick = await pickScoredPhoto(
      mapsKey,
      contentPlace,
      Object.assign({}, photoContext, { placeName: fallbackName }),
      excludeUrls,
      item,
      deps
    );
    if (fallbackPick && fallbackPick.googlePhotoUrl) {
      fallbackPick.photoSearchUsed = 'content_place_fallback';
      return fallbackPick;
    }
    if (fallbackPick && fallbackPick.photoDebugRejects) {
      item._photoDebugRejects = fallbackPick.photoDebugRejects;
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
  var pipelineLog = { version: 'travel-photo-rules', steps: [], aiTokens: 0 };

  if (!sectionId) {
    return { sectionId: sectionId, error: 'missing_section_id' };
  }

  try {
    pipelineLog.steps.push('copy_semantic_analysis');
    pipelineLog.steps.push('derive_photo_intent');
    pipelineLog.steps.push('place_verify');
    var resolved = await resolveOfficialPlace(mapsKey, section, {
      getGooglePlaceById: deps.getGooglePlaceById,
      searchGooglePlace: deps.searchGooglePlace,
      regionCode: deps.regionCode
    }, articleCtx);
    if (!resolved || !resolved.place) {
      return failedRow(sectionId, subject, mapsQuery, 'no_valid_place', pipelineLog);
    }

    var chosen = resolved.place;
    var placeId = placeIdFromResource(chosen.id || chosen.name);
    var placeName = placeDisplayName(chosen);
    var originalPlace = chosen;
    var originalPlaceId = placeId;
    var originalPlaceName = placeName;

    pipelineLog.steps.push('keyword_search');
    pipelineLog.steps.push('photo_first_pick');

    var photoPick = await resolvePhotoForSection(
      mapsKey,
      section,
      chosen,
      section.excludeUrls || [],
      deps,
      articleCtx
    );

    if (photoPick && !photoPick.googlePhotoUrl) {
      if (photoPick.photoDebugRejects) {
        section._photoDebugRejects = photoPick.photoDebugRejects;
      }
      photoPick = null;
    }

    var photoCaption = photoPick ? photoPick.photoCaption : null;
    if (photoPick && photoPick.googlePhotoUrl && !photoCaption) {
      photoPick = null;
    }

    pipelineLog.steps.push('evidence_caption');
    var qa = runEditorialQA(section, photoPick);
    var engineQa = runEngineQA(section, photoPick, photoCaption, placeId);
    if (engineQa.usePlaceholder) {
      qa = Object.assign({}, qa, engineQa);
    }
    if (qa.usePlaceholder) {
      photoPick = null;
      photoCaption = null;
    }

    var venueSwap = null;
    var swappedSection = null;
    if (!photoPick && section.allowVenueSwap !== false && (section.venueAlternatives || []).length) {
      pipelineLog.steps.push('venue_fallback');
      venueSwap = await resolveVenueFallback(
        mapsKey,
        section,
        articleCtx,
        deps,
        section.excludeUrls || [],
        pickScoredPhoto
      );
      if (venueSwap) {
        swappedSection = venueSwap.section;
        chosen = venueSwap.place;
        placeId = placeIdFromResource(chosen.id || chosen.name);
        placeName = placeDisplayName(chosen);
        photoPick = venueSwap.photoPick;
        photoCaption = photoPick ? photoPick.photoCaption : null;
        var swapQa = runEditorialQA(swappedSection, photoPick);
        var swapEngineQa = runEngineQA(swappedSection, photoPick, photoCaption, placeId);
        if (swapEngineQa.usePlaceholder) {
          qa = Object.assign({}, swapQa, swapEngineQa);
          photoPick = null;
          photoCaption = null;
          venueSwap = null;
          swappedSection = null;
          chosen = originalPlace;
          placeId = originalPlaceId;
          placeName = originalPlaceName;
        } else {
          section = swappedSection;
          qa = Object.assign({}, swapQa, swapEngineQa, { usePlaceholder: false, recommendation: 'approve', modifyCopy: true });
        }
      }
    }

    pipelineLog.steps.push('rule_qa');

    if (venueSwap && photoPick) {
      subject = venueSwap.copyPatch.subject || subject;
      mapsQuery = section.mapsQuery || mapsQuery;
    }

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
      copySemantics: section.copySemantics || null,
      copyDerivedPhotoIntent: section.copyDerivedPhotoIntent || null,
      matchedKeywords: photoPick ? photoPick.matchedKeywords : [],
      photoPlaceName: photoPick ? photoPick.photoPlaceName : null,
      searchUsed: resolved.searchUsed || null,
      photoSearchUsed: photoPick ? photoPick.photoSearchUsed : null,
      sectionType: section.sectionType || null,
      role: section.role || null,
      rejectReason: photoPick ? null : ((section._photoDebugRejects && section._photoDebugRejects.join('|')) || (qa.issues && qa.issues.length ? qa.issues.join(',') : 'no_valid_photo')),
      editorialQA: qa,
      venueSwapped: !!(venueSwap && photoPick),
      swappedFrom: venueSwap && photoPick ? venueSwap.copyPatch.swappedFrom : null,
      swappedTo: venueSwap && photoPick ? venueSwap.copyPatch.swappedTo : null,
      alternativeId: venueSwap && photoPick ? venueSwap.alternativeId : null,
      heading: venueSwap && photoPick ? venueSwap.copyPatch.heading : (section.heading || null),
      content: venueSwap && photoPick ? venueSwap.copyPatch.content : (section.content || null),
      officialName: venueSwap && photoPick ? section.officialName : (section.officialName || null),
      officialNameLocal: venueSwap && photoPick ? section.officialNameLocal : (section.officialNameLocal || null),
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
  var regionCode = (deps && deps.regionCode) || resolveRegionCode(articleCtx, sections[0] || {});

  for (var i = 0; i < sections.length; i++) {
    var item = Object.assign({}, sections[i], { excludeUrls: excludeUrls });
    var row = await resolveSectionRules(mapsKey, item, articleCtx, Object.assign({}, deps, { regionCode: regionCode }));
    results.push(row);
    if (row.googlePhotoUrl) excludeUrls.push(row.googlePhotoUrl);
  }

  return { results: results, excludeUrls: excludeUrls, pipelineVersion: 'travel-photo-rules' };
}
