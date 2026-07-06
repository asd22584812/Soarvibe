/**
 * Rule-based Editorial Pipeline — zero AI tokens.
 * Google Places = place verify + photo metadata scoring only.
 */
import { normalizeSection, normalizeArticle, runEngineQA } from './cj-editorial-engine.js';
import { resolveRegionCode } from './cj-locale-search.js';
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
  placeInTargetRegion
} from './cj-place-resolve.js';
import { resolveVenueFallback } from './cj-venue-fallback.js';
import {
  getTravelPhotoSlots,
  validateTravelSlotGate,
  validateCopyTravelAlignment,
  validateDistrictPhotoQuality,
  resolveTravelProfile
} from './cj-travel-photo-rules.js';
import {
  buildPhotoSearchRetryPlan,
  createPhotoSearchDebug,
  logPhotoSearchAttempt
} from './cj-photo-search-strategy.js';

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

function isSingleStorePlaceForDistrict(place, item) {
  if (!place || item.subjectType !== 'district') return false;
  var name = placeDisplayName(place).toLowerCase();
  var districtTerms = [
    item.officialName,
    item.officialNameLocal,
    item.subject,
    'electric town',
    '電気街',
    'akihabara',
    'broadway',
    'ブロードウェイ'
  ].filter(Boolean).map(function (t) { return String(t).toLowerCase(); });
  for (var i = 0; i < districtTerms.length; i++) {
    if (name.indexOf(districtTerms[i]) !== -1) return false;
  }
  return /animate|アニメイト|mandarake|まんだらけ|gigo|ゲーセン|cafe|カフェ|hotel|ホテル|ramen|ラーメン/i.test(name);
}

async function pickScoredPhoto(mapsKey, place, context, excludeUrls, item, deps, pickOptions) {
  var placeName = placeDisplayName(place);
  var visualKeywords = (item.imageChecklist || []).concat(item.searchKeywords || []).slice(0, 24);
  var photos = place.photos || [];
  var deepScan = pickOptions && pickOptions.deepScan;
  var debug = pickOptions && pickOptions.debug;
  var queryMeta = pickOptions && pickOptions.queryMeta;

  if (deepScan && photos.length > 1) {
    photos = photos.slice(0, 12);
  }

  var ranked = rankPhotos(
    photos,
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
  var profile = resolveTravelProfile(item);
  var multiSlot = profile === 'restaurant' || profile === 'shop' || profile === 'cafe' || profile === 'gachapon';
  var travelSlots = getTravelPhotoSlots(item, { primaryOnly: !multiSlot });
  var uriResolveBudget = 6;

  for (var si = 0; si < travelSlots.length; si++) {
    var slot = travelSlots[si];
    for (var r = 0; r < ranked.length && r < 10; r++) {
      var row = ranked[r];
      if (!row.photo || !row.photo.name) continue;
      if (!row.gate || row.gate.score < 40 || !row.gate.photoEvidence) {
        if (debugRejects.length < 12) debugRejects.push(row.gate && row.gate.rejectReason || 'gate_fail');
        continue;
      }
      if (row.gate.rejectReason === 'logo_only' || row.gate.rejectReason === 'unknown_evidence') {
        if (debugRejects.length < 12) debugRejects.push(row.gate.rejectReason);
        continue;
      }
      var slotGate = validateTravelSlotGate(row.gate.photoEvidence, row.photo._index, slot, item, row.photo, {
        fallbackSlot: si > 0
      });
      if (!slotGate.ok) {
        if (debugRejects.length < 12) debugRejects.push(slotGate.reason || 'travel_slot_fail');
        continue;
      }
      var districtOk = validateDistrictPhotoQuality(row.gate.photoEvidence, item, placeName);
      if (!districtOk.ok) {
        if (debugRejects.length < 12) debugRejects.push(districtOk.reason || 'travel_district_fail');
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
        photoEvidence: row.gate.photoEvidence,
        travelPhotoSlot: slot.id
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
        if (debugRejects.length < 12) debugRejects.push(copyAlign.reason || 'travel_copy_mismatch');
        continue;
      }

      if (uriResolveBudget <= 0) continue;

      var url = await deps.resolveGooglePhotoUri(mapsKey, row.photo.name);
      uriResolveBudget -= 1;
      if (url && !exclude[url]) {
        if (debug) {
          logPhotoSearchAttempt(debug, {
            sectionId: item.sectionId,
            slot: slot.id,
            query: queryMeta && queryMeta.query,
            phase: queryMeta && queryMeta.phase,
            candidateCount: photos.length,
            photoIndex: row.photo._index,
            selectedImageUrl: url,
            selectedReason: 'slot_' + slot.id + '_score_' + row.score,
            rejectReason: null
          });
        }
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

async function tryPickFromPlace(mapsKey, place, item, photoContext, excludeUrls, deps, pickOptions) {
  if (!place) return null;
  return pickScoredPhoto(
    mapsKey,
    place,
    Object.assign({}, photoContext, { placeName: placeDisplayName(place) }),
    excludeUrls,
    item,
    deps,
    pickOptions
  );
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

  var isDistrict = item.subjectType === 'district';
  var debug = createPhotoSearchDebug(item.sectionId);
  item._photoSearchDebug = debug;

  var retryPlan = buildPhotoSearchRetryPlan(item, articleCtx, { maxQueries: 28 });
  item._photoSearchPlan = retryPlan;

  if (contentPlace) {
    logPhotoSearchAttempt(debug, {
      sectionId: item.sectionId,
      slot: getTravelPhotoSlots(item, { primaryOnly: true })[0] && getTravelPhotoSlots(item, { primaryOnly: true })[0].id,
      query: 'placeId:' + placeIdFromResource(contentPlace.id || contentPlace.name),
      phase: 'place_photos',
      candidateCount: (contentPlace.photos || []).length,
      selectedImageUrl: null,
      selectedReason: null,
      rejectReason: null
    });
    var contentPick = await tryPickFromPlace(
      mapsKey,
      contentPlace,
      item,
      photoContext,
      excludeUrls,
      deps,
      { debug: debug, queryMeta: { query: 'content_place', phase: 'place_photos' }, deepScan: false }
    );
    if (contentPick && contentPick.googlePhotoUrl) {
      contentPick.photoSearchUsed = 'content_place';
      contentPick.photoSearchDebug = debug.toJSON();
      return contentPick;
    }

    logPhotoSearchAttempt(debug, {
      sectionId: item.sectionId,
      slot: null,
      query: 'placeId:' + placeIdFromResource(contentPlace.id || contentPlace.name),
      phase: 'review_photos',
      candidateCount: (contentPlace.photos || []).length,
      selectedImageUrl: null,
      selectedReason: null,
      rejectReason: 'content_place_no_match'
    });
    var deepPick = await tryPickFromPlace(
      mapsKey,
      contentPlace,
      item,
      photoContext,
      excludeUrls,
      deps,
      { debug: debug, queryMeta: { query: 'content_place_deep', phase: 'review_photos' }, deepScan: true }
    );
    if (deepPick && deepPick.googlePhotoUrl) {
      deepPick.photoSearchUsed = 'content_place_review_photos';
      deepPick.photoSearchDebug = debug.toJSON();
      return deepPick;
    }
  }

  var qi;
  for (qi = 0; qi < retryPlan.queries.length; qi++) {
    var queryRow = retryPlan.queries[qi];
    var places = await deps.searchGooglePlace(mapsKey, queryRow.query, queryRow.lang, deps.regionCode);
    logPhotoSearchAttempt(debug, {
      sectionId: item.sectionId,
      slot: null,
      query: queryRow.query,
      phase: queryRow.phase,
      candidateCount: places.length,
      selectedImageUrl: null,
      selectedReason: null,
      rejectReason: places.length ? null : 'zero_places'
    });

    var p;
    for (p = 0; p < places.length && p < 3; p++) {
      if (!placeInTargetRegion(places[p], item, deps.regionCode || 'JP')) continue;
      if (isDistrict && isSingleStorePlaceForDistrict(places[p], item)) continue;
      var placeVal = validatePlaceResult(places[p], item);
      if (!placeVal.ok) continue;

      var pick = await tryPickFromPlace(
        mapsKey,
        places[p],
        item,
        photoContext,
        excludeUrls,
        deps,
        { debug: debug, queryMeta: queryRow, deepScan: false }
      );
      if (pick && pick.googlePhotoUrl) {
        pick.photoSearchUsed = queryRow.query;
        pick.photoSearchPhase = queryRow.phase;
        pick.photoSearchDebug = debug.toJSON();
        return pick;
      }
    }
  }

  return {
    googlePhotoUrl: null,
    photoSearchDebug: debug.toJSON(),
    photoDebugRejects: item._photoDebugRejects || ['exhausted_retry_plan']
  };
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
  var pipelineLog = { version: 'photo-search-retry-v1', steps: [], aiTokens: 0 };

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

    pipelineLog.steps.push('photo_search_retry');
    pipelineLog.steps.push('photo_first_pick');

    var photoPick = await resolvePhotoForSection(
      mapsKey,
      section,
      chosen,
      section.excludeUrls || [],
      deps,
      articleCtx
    );

    if (photoPick && photoPick.photoSearchDebug) {
      pipelineLog.photoSearchDebug = photoPick.photoSearchDebug;
    }
    if (photoPick && photoPick.photoDebugRejects) {
      section._photoDebugRejects = photoPick.photoDebugRejects;
    }

    if (photoPick && !photoPick.googlePhotoUrl) {
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
        function (mapsKeyInner, place, context, exclude, sec, depsInner) {
          return pickScoredPhoto(mapsKeyInner, place, context, exclude, sec, depsInner, {
            debug: sec._photoSearchDebug || createPhotoSearchDebug(sec.sectionId),
            queryMeta: { query: 'venue_swap', phase: 'place_photos' }
          });
        }
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
      travelPhotoSlot: photoPick ? photoPick.travelPhotoSlot : null,
      copySemantics: section.copySemantics || null,
      copyDerivedPhotoIntent: section.copyDerivedPhotoIntent || null,
      matchedKeywords: photoPick ? photoPick.matchedKeywords : [],
      photoPlaceName: photoPick ? photoPick.photoPlaceName : null,
      searchUsed: resolved.searchUsed || null,
      photoSearchUsed: photoPick ? photoPick.photoSearchUsed : null,
      photoSearchPhase: photoPick ? photoPick.photoSearchPhase : null,
      photoSearchDebug: photoPick ? photoPick.photoSearchDebug : (pipelineLog.photoSearchDebug || null),
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

  return { results: results, excludeUrls: excludeUrls, pipelineVersion: 'photo-search-retry-v1' };
}
