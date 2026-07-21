/**
 * SOARVIBE API Proxy — Cloudflare Worker（免費方案）
 * 支援多把 Gemini 金鑰自動輪替 + Google Maps 金鑰發放
 */

import { rankPhotos } from './cj-photo-scoring.js';
import { generateCaption } from './cj-caption.js';
import { resolveOfficialPlace, validatePhotoAttribution, placeDisplayName } from './cj-place-resolve.js';
import { runEditorialQA } from './cj-editorial-pipeline.js';
import { resolveArticleRules } from './cj-pipeline-rules.js';
import { generateEditorialArticle, generateSectionCopy, placeCopyNeedsResync } from './cj-editorial-generate.js';
import { generateAICaption } from './cj-ai-caption.js';
import { callGeminiVisionInlineJSON } from './cj-gemini-client.js';
import { resolveRegionCode } from './cj-locale-search.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-SOARVIBE-Token',
  'Access-Control-Max-Age': '86400'
};

function parseAllowedOrigins(env) {
  var raw = String(env.ALLOWED_ORIGINS || 'https://asd22584812.github.io');
  return raw.split(',').map(function (o) { return o.trim(); }).filter(Boolean);
}

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  var allowed = parseAllowedOrigins(env);
  return allowed.some(function (entry) {
    if (entry === origin) return true;
    if (entry.endsWith('*')) {
      return origin.startsWith(entry.slice(0, -1));
    }
    return false;
  });
}

function corsHeaders(origin, env) {
  var headers = Object.assign({}, CORS_HEADERS);
  if (origin && isAllowedOrigin(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

function jsonResponse(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin, env))
  });
}

function isValidGeminiKey(key) {
  var k = String(key || '').trim();
  return /^AIza[0-9A-Za-z_-]{30,}$/.test(k) || /^AQ\.[0-9A-Za-z_-]{20,}$/.test(k);
}

function parseGeminiKeys(env) {
  var combined = [
    String(env.GEMINI_API_KEYS || ''),
    String(env.GEMINI_API_KEY || '')
  ].join('\n');
  var seen = {};
  return combined
    .split(/[\n,]+/)
    .map(function (k) { return k.trim(); })
    .filter(function (k) {
      if (!k || !isValidGeminiKey(k) || seen[k]) return false;
      seen[k] = true;
      return true;
    });
}

function extractGeminiText(result) {
  try {
    var text = result.candidates
      && result.candidates[0]
      && result.candidates[0].content
      && result.candidates[0].content.parts
      && result.candidates[0].content.parts[0]
      && result.candidates[0].content.parts[0].text;
    return String(text || '').trim();
  } catch (e) {
    return '';
  }
}

function getErrorMessage(result) {
  return String((result && result.error && result.error.message) || '');
}

function isBillingDepleted(result) {
  return /prepayment credits are depleted|depleted.*billing|billing.*depleted/i.test(getErrorMessage(result));
}

function isRpmThrottle(result) {
  var msg = getErrorMessage(result);
  if (/limit:\s*0/i.test(msg)) return false;
  if (isBillingDepleted(result)) return false;
  return /Please retry in [\d.]+s/i.test(msg)
    || (/free_tier/i.test(msg) && /limit:\s*20/i.test(msg));
}

function isModelOnlyQuota(result) {
  return /limit:\s*0/i.test(getErrorMessage(result));
}

function isKeyLevelQuota(status, result) {
  if (status !== 429) return false;
  if (isBillingDepleted(result)) return true;
  var msg = getErrorMessage(result);
  if (/free_tier/i.test(msg)) return false;
  return /quota exceeded|RESOURCE_EXHAUSTED|exhausted/i.test(msg);
}

function isModelNotFound(status, result) {
  return status === 404
    || /not found for API version|is not supported for generateContent/i.test(getErrorMessage(result));
}

function authorizeRequest(request, env) {
  var origin = request.headers.get('Origin') || '';
  var referer = request.headers.get('Referer') || '';

  if (origin && isAllowedOrigin(origin, env)) {
    return { ok: true, origin: origin };
  }

  if (!origin && referer) {
    try {
      var refOrigin = new URL(referer).origin;
      if (isAllowedOrigin(refOrigin, env)) {
        return { ok: true, origin: refOrigin };
      }
    } catch (e) { /* ignore */ }
  }

  var token = request.headers.get('X-SOARVIBE-Token') || '';
  var secret = String(env.WORKER_AUTH_SECRET || '').trim();
  if (secret && token === secret) {
    return { ok: true, origin: origin || '*' };
  }

  return { ok: false, origin: origin };
}

async function callGeminiUpstream(prompt, modelId, apiKey) {
  var geminiUrl = GEMINI_BASE + modelId + ':generateContent';
  var upstream;
  try {
    upstream = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      })
    });
  } catch (e) {
    return { ok: false, status: 502, result: { error: { message: String(e.message || e) } }, network: true };
  }

  var result = {};
  try {
    result = await upstream.json();
  } catch (e) {
    return { ok: false, status: 502, result: { error: { message: 'invalid_json' } } };
  }

  if (!upstream.ok) {
    return { ok: false, status: upstream.status, result: result };
  }

  var text = extractGeminiText(result);
  if (!text) {
    return { ok: false, status: 502, result: result, empty: true };
  }

  return { ok: true, status: 200, result: result, text: text };
}

function pickRoundRobinStartIndex(totalKeys) {
  if (totalKeys <= 1) return 0;
  return Math.abs(Math.floor(Date.now() / 1000)) % totalKeys;
}

async function handleGemini(request, env, auth) {
  var keys = parseGeminiKeys(env);
  if (!keys.length) {
    return jsonResponse({
      error: 'server_misconfigured',
      message: 'GEMINI_API_KEYS not set'
    }, 503, auth.origin, env);
  }

  var body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400, auth.origin, env);
  }

  var prompt = String(body.prompt || '').trim();
  if (!prompt) {
    return jsonResponse({ error: 'missing_prompt' }, 400, auth.origin, env);
  }
  if (prompt.length > 120000) {
    return jsonResponse({ error: 'prompt_too_long' }, 413, auth.origin, env);
  }

  var modelId = String(body.model || DEFAULT_MODEL).trim();
  if (!/^gemini-[a-z0-9.-]+$/i.test(modelId)) {
    return jsonResponse({ error: 'invalid_model' }, 400, auth.origin, env);
  }

  var startIdx = pickRoundRobinStartIndex(keys.length);
  var lastFailure = null;
  var keysTried = 0;

  for (var attempt = 0; attempt < keys.length; attempt++) {
    var keyIndex = (startIdx + attempt) % keys.length;
    var apiKey = keys[keyIndex];
    keysTried++;
    var upstream = await callGeminiUpstream(prompt, modelId, apiKey);

    if (upstream.ok) {
      return jsonResponse({
        text: upstream.text,
        model: modelId,
        keySlot: keyIndex + 1,
        keyTotal: keys.length
      }, 200, auth.origin, env);
    }

    lastFailure = upstream;
    var status = upstream.status;
    var result = upstream.result || {};

    if (status === 401 || status === 403) {
      continue;
    }
    if (status === 429) {
      if (isRpmThrottle(result)) {
        continue;
      }
      if (isModelOnlyQuota(result)) {
        break;
      }
      if (isKeyLevelQuota(status, result) || isBillingDepleted(result)) {
        continue;
      }
      continue;
    }
    if (isModelNotFound(status, result)) {
      break;
    }
    if (status === 503 || status === 500 || status === 502 || status === 529) {
      continue;
    }
    break;
  }

  if (lastFailure && lastFailure.status === 429) {
    return jsonResponse({
      error: 'all_keys_exhausted',
      message: 'All Gemini keys exhausted',
      keysTried: keysTried,
      keyTotal: keys.length,
      details: lastFailure.result
    }, 429, auth.origin, env);
  }

  return jsonResponse({
    error: 'gemini_error',
    status: lastFailure ? lastFailure.status : 502,
    keysTried: keysTried,
    keyTotal: keys.length,
    details: lastFailure ? lastFailure.result : null
  }, lastFailure && lastFailure.status ? lastFailure.status : 502, auth.origin, env);
}

async function handleMapsKey(env, auth) {
  var mapsKey = getMapsKey(env);
  if (!mapsKey || mapsKey.indexOf('AIzaSy') !== 0) {
    return jsonResponse({ error: 'maps_not_configured' }, 503, auth.origin, env);
  }
  return jsonResponse({ key: mapsKey }, 200, auth.origin, env);
}

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

function getMapsKey(env) {
  return String(env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_MAPS_API_KEY || '').trim();
}

async function googlePlacesFetch(mapsKey, url, init) {
  var headers = Object.assign({}, (init && init.headers) || {}, {
    'X-Goog-Api-Key': mapsKey,
    Referer: 'https://asd22584812.github.io/'
  });
  return fetch(url, Object.assign({}, init || {}, { headers: headers }));
}

async function resolveGooglePhotoUri(mapsKey, photoName) {
  var resource = String(photoName || '').trim();
  if (!resource || resource.indexOf('places/') !== 0) return '';
  var mediaUrl =
    'https://places.googleapis.com/v1/' +
    resource +
    '/media?maxHeightPx=1200&maxWidthPx=1600&skipHttpRedirect=true&key=' +
    encodeURIComponent(mapsKey);
  var response = await googlePlacesFetch(mapsKey, mediaUrl);
  if (!response.ok) return '';
  var body = await response.json();
  return String(body.photoUri || '').trim();
}

async function getGooglePlaceById(mapsKey, placeId) {
  var id = placeIdFromResource(placeId);
  if (!id) return null;
  var response = await googlePlacesFetch(mapsKey, 'https://places.googleapis.com/v1/places/' + encodeURIComponent(id), {
    method: 'GET',
    headers: {
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,photos,photos.authorAttributions,photos.widthPx,photos.heightPx,types,primaryType'
    }
  });
  if (!response.ok) return null;
  return await response.json();
}

async function searchGooglePlace(mapsKey, mapsQuery, languageCode, regionCode) {
  var response = await googlePlacesFetch(mapsKey, 'https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.photos,places.photos.authorAttributions,places.photos.widthPx,places.photos.heightPx,places.types,places.primaryType'
    },
    body: JSON.stringify({
      textQuery: mapsQuery,
      languageCode: languageCode || 'ja',
      regionCode: regionCode || 'JP',
      maxResultCount: 5
    })
  });
  if (!response.ok) {
    var errText = await response.text();
    throw new Error('places_search_failed:' + response.status + ':' + errText);
  }
  var data = await response.json();
  return data.places || [];
}

function failedPlaceRow(sectionId, subject, mapsQuery, reason) {
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
    rejectReason: reason || null
  };
}

async function pickScoredPhoto(mapsKey, place, context, excludeUrls, item) {
  var placeName = placeDisplayName(place);
  var ranked = rankPhotos(place.photos || [], Object.assign({ placeName: placeName }, context || {}), item);
  var exclude = {};
  (excludeUrls || []).forEach(function (u) {
    if (u) exclude[u] = true;
  });
  for (var r = 0; r < ranked.length && r < 20; r++) {
    var row = ranked[r];
    if (!row.photo || !row.photo.name) continue;
    if (!row.gate || !row.gate.ok) continue;
    var attribution = buildPhotoAttribution(row.photo);
    var attrVal = validatePhotoAttribution(attribution, item || context || {});
    if (!attrVal.ok) continue;
    var url = await resolveGooglePhotoUri(mapsKey, row.photo.name);
    if (url && !exclude[url]) {
      return {
        googlePhotoUrl: url,
        googleAttribution: attribution,
        photoScore: row.score,
        photoIndex: row.photo._index,
        matchedKeywords: row.gate.matchedKeywords || [],
        photoPlaceName: placeName,
        anchorPlace: row.gate.anchorPlace || false,
        rejectReason: null
      };
    }
  }
  return null;
}

async function resolvePhotoForSection(mapsKey, item, contentPlace, excludeUrls) {
  var photoContext = {
    role: item.role || (String(item.sectionId || '').indexOf('hero') === 0 ? 'hero' : 'section'),
    sectionType: item.sectionType || 'landmark',
    mapsQuery: item.mapsQuery,
    officialName: item.officialName || null,
    officialNameLocal: item.officialNameLocal || null,
    visualKeywords: Array.isArray(item.visualKeywords) ? item.visualKeywords : []
  };
  var queries = Array.isArray(item.photoPlaceQueries) ? item.photoPlaceQueries : [];
  var q;
  for (q = 0; q < queries.length; q++) {
    var lang = /[\u3040-\u30ff\u4e00-\u9faf]/.test(queries[q]) ? 'ja' : 'en';
    var places = await searchGooglePlace(mapsKey, queries[q], lang);
    var p;
    for (p = 0; p < places.length; p++) {
      var pn = placeDisplayName(places[p]);
      var pick = await pickScoredPhoto(
        mapsKey,
        places[p],
        Object.assign({}, photoContext, { placeName: pn }),
        excludeUrls,
        item
      );
      if (pick) {
        pick.photoSearchUsed = queries[q];
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
      item
    );
    if (fallback) {
      fallback.photoSearchUsed = 'content_place';
      return fallback;
    }
  }
  return null;
}

async function resolvePlaceSection(mapsKey, item) {
  var sectionId = String(item.sectionId || '').trim();
  var subject = String(item.subject || '').trim();
  var mapsQuery = String(item.mapsQuery || '').trim();
  if (!sectionId || (!mapsQuery && !item.officialName && !item.officialNameLocal)) {
    return { sectionId: sectionId, error: 'missing_query' };
  }
  try {
    var resolved = await resolveOfficialPlace(mapsKey, item, {
      getGooglePlaceById: getGooglePlaceById,
      searchGooglePlace: searchGooglePlace,
      regionCode: 'JP'
    }, null);
    if (!resolved || !resolved.place) {
      return failedPlaceRow(sectionId, subject, mapsQuery, 'no_valid_place');
    }
    var chosen = resolved.place;
    var placeId = placeIdFromResource(chosen.id || chosen.name);
    var placeName = placeDisplayName(chosen);
    var photoPick = await resolvePhotoForSection(mapsKey, item, chosen, item.excludeUrls || []);
    var photoCaption = null;
    if (photoPick && photoPick.googlePhotoUrl) {
      photoCaption = generateCaption({
        placeName: placeName,
        photoPlaceName: photoPick.photoPlaceName || placeName,
        photoAttribution: photoPick.googleAttribution,
        sectionId: sectionId,
        mapsQuery: mapsQuery,
        officialName: item.officialName || null,
        officialNameLocal: item.officialNameLocal || null,
        sectionType: item.sectionType || 'landmark',
        subject: subject,
        matchedKeywords: photoPick.matchedKeywords || []
      });
      if (!photoCaption) {
        photoPick = null;
      }
    }
    var qa = runEditorialQA(item, photoPick);
    if (qa.usePlaceholder) {
      photoPick = null;
      photoCaption = null;
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
      matchedKeywords: photoPick ? photoPick.matchedKeywords : [],
      photoPlaceName: photoPick ? photoPick.photoPlaceName : null,
      searchUsed: resolved.searchUsed || null,
      photoSearchUsed: photoPick ? photoPick.photoSearchUsed : null,
      sectionType: item.sectionType || null,
      role: item.role || null,
      rejectReason: photoPick ? null : (qa.issues && qa.issues.length ? qa.issues.join(',') : 'no_valid_photo'),
      editorialQA: qa
    };
  } catch (err) {
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
      error: String(err && err.message ? err.message : err)
    };
  }
}

async function handleEditorialResolve(request, env, auth) {
  var mapsKey = getMapsKey(env);
  if (!mapsKey) {
    return jsonResponse({ error: 'maps_not_configured' }, 503, auth.origin, env);
  }

  var body = {};
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400, auth.origin, env);
  }

  var sections = Array.isArray(body.sections) ? body.sections : [];
  if (!sections.length) {
    return jsonResponse({ error: 'missing_sections' }, 400, auth.origin, env);
  }

  var deps = {
    getGooglePlaceById: getGooglePlaceById,
    searchGooglePlace: searchGooglePlace,
    resolveGooglePhotoUri: resolveGooglePhotoUri,
    regionCode: resolveRegionCode(body.article || {}, body.sections && body.sections[0] || {})
  };

  var output = await resolveArticleRules(mapsKey, body, deps);
  return jsonResponse(output, 200, auth.origin, env);
}

async function handleEditorialGenerate(request, env, auth) {
  var body = {};
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400, auth.origin, env);
  }
  var result = await generateEditorialArticle(env, {
    month: body.month || '7',
    year: body.year || '2026',
    styleKey: body.styleKey || 'anime',
    existingEditorial: body.existingEditorial || null,
    existingDataSrc: body.existingDataSrc || null
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error, detail: result.detail || null }, 502, auth.origin, env);
  }
  return jsonResponse(Object.assign({ _meta: result.meta || null }, result.article), 200, auth.origin, env);
}

async function handleEditorialSectionCopy(request, env, auth) {
  var body = {};
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400, auth.origin, env);
  }
  var result = await generateSectionCopy(env, {
    section: body.section || {},
    place: body.place || {},
    article: body.article || {},
    photoCaption: body.photoCaption || ''
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, 502, auth.origin, env);
  }
  return jsonResponse(result, 200, auth.origin, env);
}

async function handleEditorialVisionCaption(request, env, auth) {
  var body = {};
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400, auth.origin, env);
  }
  if (!body.imageBase64) {
    return jsonResponse({ error: 'missing_image' }, 400, auth.origin, env);
  }
  var section = body.section || {};
  var verifyMode = body.verifyVenue === true || section.strictVenueLock === true;
  var mustShow = []
    .concat(section.photoAnchorTerms || [])
    .concat(section.imageChecklist || [])
    .concat([section.officialNameLocal, section.officialName])
    .filter(Boolean)
    .slice(0, 8);

  var prompt = verifyMode
    ? [
      '你是旅遊雜誌圖片審核與圖說編輯。只看這張照片。',
      '目標地標：' + (section.officialNameLocal || section.officialName || body.placeName || ''),
      '英文名：' + (section.officialName || ''),
      '辨識特徵：' + mustShow.join('、'),
      '若照片主體清楚是這個地標（全景、外觀、入口、塔身、燈籠、雕像等皆可），venueMatch=true。',
      '僅在完全看不出是該地標、或明顯是別家店／室內商品時，venueMatch=false。',
      'caption 必填：14–26 字繁中，只描述照片裡看得見的主體（例：八公銅像、塔身、雷門大燈籠），禁止空話。',
      '禁止寫：與本段介紹的地標一致、景觀清楚可見、外觀清楚標示位置、氛圍。',
      '必須只回傳 JSON（不要 markdown）：',
      '{"venueMatch":true,"confidence":0.9,"visibleSubjects":["塔身"],"caption":"晴空塔塔身直向藍天，金屬骨架清楚可見"}'
    ].join('\n')
    : [
      '你是繁體中文旅遊雜誌圖說編輯。只看這張照片，寫一句圖說。',
      '14–26 字；只描述看得見的主體與場景；不可寫霓虹、人潮、氛圍除非照片裡真的有。',
      '禁止寫：與本段介紹的地標一致、景觀清楚可見、外觀清楚標示位置、空話套句。',
      '段落：' + (section.heading || section.subject || ''),
      '地點：' + (body.placeName || section.officialNameLocal || section.officialName || ''),
      '回傳 JSON: { "caption": "..." }'
    ].join('\n');

  var vision = await callGeminiVisionInlineJSON(prompt, {
    data: body.imageBase64,
    mimeType: body.mimeType || 'image/jpeg'
  }, env, {
    temperature: 0.2,
    maxOutputTokens: 512,
    salvage: verifyMode ? 'venue' : true
  });
  if (!vision.ok) {
    return jsonResponse({
      error: 'vision_failed',
      detail: vision.details || vision.error,
      raw: vision.raw || null
    }, 502, auth.origin, env);
  }
  var parsed = vision.data || {};
  if (verifyMode) {
    var venueMatch = parsed.venueMatch === true;
    // If Gemini returned review-salvage shape by mistake, treat pass as venueMatch.
    if (!venueMatch && parsed.pass === true && !Object.prototype.hasOwnProperty.call(parsed, 'venueMatch')) {
      venueMatch = true;
    }
    return jsonResponse({
      venueMatch: venueMatch,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
      visibleSubjects: Array.isArray(parsed.visibleSubjects) ? parsed.visibleSubjects : [],
      caption: parsed.caption || parsed.visibleDescription || null,
      keySlot: vision.keySlot || null
    }, 200, auth.origin, env);
  }
  return jsonResponse({
    caption: parsed.caption || null,
    keySlot: vision.keySlot || null
  }, 200, auth.origin, env);
}

async function handleEditorialCaption(request, env, auth) {
  var body = {};
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400, auth.origin, env);
  }
  var section = body.section || {};
  var selected = body.selected || {};
  if (!selected.imageUrl) {
    return jsonResponse({ error: 'missing_image_url' }, 400, auth.origin, env);
  }
  if (!selected.aiReview) {
    selected.aiReview = {
      visibleDescription: body.visibleDescription || '',
      matchedElements: body.matchedElements || [],
      photoType: body.photoType || section.travelPhotoSlot || ''
    };
  }
  var caption = await generateAICaption(section, Object.assign({}, selected, {
    imageUrl: selected.imageUrl,
    googlePhotoUrl: selected.imageUrl,
    sourcePlaceName: selected.sourcePlaceName || section.officialNameLocal || section.officialName
  }), body.article || {}, env);
  return jsonResponse({ caption: caption || null }, 200, auth.origin, env);
}

async function handlePlacesResolve(request, env, auth) {
  var mapsKey = getMapsKey(env);
  if (!mapsKey) {
    return jsonResponse({ error: 'maps_not_configured' }, 503, auth.origin, env);
  }
  var body = {};
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400, auth.origin, env);
  }
  var sections = Array.isArray(body.sections) ? body.sections : [];
  if (!sections.length) {
    return jsonResponse({ error: 'missing_sections' }, 400, auth.origin, env);
  }
  var results = [];
  var excludeUrls = Array.isArray(body.excludeUrls) ? body.excludeUrls.slice() : [];
  for (var j = 0; j < sections.length; j++) {
    var item = Object.assign({}, sections[j], { excludeUrls: excludeUrls });
    var row = await resolvePlaceSection(mapsKey, item);
    results.push(row);
    if (row.googlePhotoUrl) excludeUrls.push(row.googlePhotoUrl);
  }
  return jsonResponse({ results: results, excludeUrls: excludeUrls }, 200, auth.origin, env);
}

async function handleCoverImage(request, env, auth) {
  var url = new URL(request.url);
  var imageUrl = String(url.searchParams.get('url') || '').trim();
  if (!/^https:\/\/images\.unsplash\.com\//i.test(imageUrl)) {
    return jsonResponse({ error: 'invalid_cover_url' }, 400, auth.origin, env);
  }
  try {
    var upstream = await fetch(imageUrl, {
      headers: { 'Accept': 'image/jpeg,image/png,image/*' }
    });
    if (!upstream.ok) {
      return jsonResponse({ error: 'cover_fetch_failed', status: upstream.status }, 502, auth.origin, env);
    }
    var headers = new Headers(upstream.headers);
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=86400');
    var cors = corsHeaders(auth.origin, env);
    Object.keys(cors).forEach(function (key) {
      headers.set(key, cors[key]);
    });
    return new Response(upstream.body, { status: 200, headers: headers });
  } catch (e) {
    return jsonResponse({ error: 'cover_fetch_error' }, 502, auth.origin, env);
  }
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var origin = request.headers.get('Origin') || '';
    var geminiKeys = parseGeminiKeys(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({
        ok: true,
        service: 'soarvibe-api',
        geminiKeyCount: geminiKeys.length,
        geminiRotation: geminiKeys.length > 1,
        maps: !!(env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_MAPS_API_KEY)
      }, 200, origin, env);
    }

    var auth = authorizeRequest(request, env);
    if (!auth.ok) {
      return jsonResponse({ error: 'forbidden', message: 'Origin not allowed' }, 403, origin, env);
    }

    if (url.pathname === '/api/gemini' && request.method === 'POST') {
      return handleGemini(request, env, auth);
    }

    if (url.pathname === '/api/maps-key' && request.method === 'GET') {
      return handleMapsKey(env, auth);
    }

    if (url.pathname === '/api/places/resolve' && request.method === 'POST') {
      return handlePlacesResolve(request, env, auth);
    }

    if (url.pathname === '/api/editorial/resolve' && request.method === 'POST') {
      return handleEditorialResolve(request, env, auth);
    }

    if (url.pathname === '/api/editorial/generate' && request.method === 'POST') {
      return handleEditorialGenerate(request, env, auth);
    }

    if (url.pathname === '/api/editorial/section-copy' && request.method === 'POST') {
      return handleEditorialSectionCopy(request, env, auth);
    }

    if (url.pathname === '/api/editorial/vision-caption' && request.method === 'POST') {
      return handleEditorialVisionCaption(request, env, auth);
    }

    if (url.pathname === '/api/editorial/caption' && request.method === 'POST') {
      return handleEditorialCaption(request, env, auth);
    }

    if (url.pathname === '/api/cover-image' && request.method === 'GET') {
      return handleCoverImage(request, env, auth);
    }

    return jsonResponse({ error: 'not_found' }, 404, auth.origin, env);
  }
};
