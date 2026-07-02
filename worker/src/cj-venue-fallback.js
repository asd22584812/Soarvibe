/**
 * Venue Fallback — when primary venue has no valid photo, swap to an alternative
 * venue and rewrite copy so text and image stay aligned (zero AI tokens).
 */
import { normalizeSection, resolveSectionRole } from './cj-editorial-engine.js';
import { buildLocaleSearchQueries, resolveRegionCode } from './cj-locale-search.js';
import {
  placeDisplayName,
  validatePlaceResult,
  placeInTargetRegion
} from './cj-place-resolve.js';

function placeIdFromResource(id) {
  return String(id || '').replace(/^places\//, '').trim();
}

function extractArea(address) {
  var addr = String(address || '');
  if (/秋葉原|Akihabara|Sotokanda/.test(addr)) return '秋葉原';
  if (/中野|Nakano|野方|Nogata/.test(addr)) return '中野';
  if (/台場|Odaiba|Ariake/.test(addr)) return '台場';
  if (/渋谷|Shibuya/.test(addr)) return '澀谷';
  if (/新宿|Shinjuku/.test(addr)) return '新宿';
  if (/浅草|Asakusa|蔵前|Kuramae|浅草橋|Asakusabashi/.test(addr)) return '淺草橋一帶';
  if (/日本橋|Nihonbashi|人形町|Ningyocho/.test(addr)) return '日本橋一帶';
  if (/豊島|Toshima|池袋|Ikebukuro|Higashiikebukuro/.test(addr)) return '池袋';
  if (/Chiyoda|千代田/.test(addr)) return '千代田區';
  return '東京';
}

function shortDisplayName(name) {
  var s = String(name || '').trim();
  if (s.length <= 28) return s;
  return s.replace(/\s+Tokyo\s+Japan$/i, '').replace(/\s+東京$/i, '').trim();
}

function buildCafeCopy(placeName, area, swapAngle, articleCtx) {
  var theme = (articleCtx && articleCtx.articleTheme) || '動漫巡禮';
  var angle = swapAngle || '動漫聯名甜點與主題內裝';
  return [
    area + '的' + placeName + '，以' + angle + '著稱，是' + theme + '途中常見的咖啡補給點。',
    '把時間控制在六十分鐘內，邊吃甜點邊整理剛買的戰利品，剛好留體力給下一間店。'
  ].join('');
}

function buildFoodCopy(placeName, area, swapAngle) {
  var angle = swapAngle || '在地餐點';
  return [
    area + '的' + placeName + '，主打' + angle + '，適合掃街中途快速補給。',
    '尖峰時段先排隊，出餐後控制在三十分鐘內，再回周邊繼續逛。'
  ].join('');
}

function buildHotelCopy(placeName, area, swapAngle) {
  var angle = swapAngle || '交通方便';
  return [
    placeName + '落在' + area + '，' + angle + '，是把時間留給街上的務實落腳處。',
    '以秋葉原為基地、搭山手線往返各區，動線直覺。展期與週末記得提早訂房。'
  ].join('');
}

function buildHostelCopy(placeName, area, swapAngle) {
  var angle = swapAngle || '簡潔客房與交誼空間';
  return [
    area + '的' + placeName + '，' + angle + '，適合獨旅或預算控管。',
    '若喜歡交流，公共空間傍晚仍常有旅人聚集。週末床位記得提早訂。'
  ].join('');
}

export function rewriteSectionCopyForVenue(section, placeMeta, articleCtx) {
  var role = resolveSectionRole(section || {});
  var placeName = shortDisplayName(placeMeta.placeName || placeMeta.displayName || section.subject);
  var area = extractArea(placeMeta.googleAddress || placeMeta.address);
  var swapAngle = placeMeta.swapCopyAngle || section.venueSwapIntent || '';
  var headingSuffix = {
    cafe: '次文化體驗的一杯咖啡',
    food: '掃街中途的熱湯補給',
    hotel: '步行可達電氣街',
    hostel: '設計感旅宿落腳'
  };
  var suffix = headingSuffix[role] || '巡禮途中的推薦停留';
  var content;

  if (role === 'cafe') content = buildCafeCopy(placeName, area, swapAngle, articleCtx);
  else if (role === 'food') content = buildFoodCopy(placeName, area, swapAngle);
  else if (role === 'hotel') content = buildHotelCopy(placeName, area, swapAngle);
  else if (role === 'hostel') content = buildHostelCopy(placeName, area, swapAngle);
  else content = area + '的' + placeName + '，適合這條路線的節奏。';

  return {
    subject: placeName,
    heading: placeName + ' · ' + suffix,
    content: content,
    copyRewritten: true,
    venueSwapped: true,
    swappedFrom: section.officialName || section.subject,
    swappedTo: placeName
  };
}

function buildSwapPreviewCopy(altConfig, baseSection) {
  var role = resolveSectionRole(baseSection);
  var name = altConfig.officialNameLocal || altConfig.officialName || baseSection.subject;
  var angle = altConfig.swapCopyAngle || baseSection.venueSwapIntent || '';
  var headingSuffix = {
    cafe: '次文化體驗的一杯咖啡',
    food: '掃街中途的熱湯補給',
    hotel: '步行可達電氣街',
    hostel: '設計感旅宿落腳'
  };
  var suffix = headingSuffix[role] || '巡禮途中的推薦停留';
  var content;
  if (role === 'hotel') {
    content = name + '，' + (angle || '步行可達車站、客房實用') + '，適合以秋葉原為基地的動漫巡禮。';
  } else if (role === 'hostel') {
    content = name + '以' + (angle || '簡潔客房與交誼空間') + '著稱，適合獨旅或預算控管。';
  } else if (role === 'cafe') {
    content = name + '以' + (angle || '動漫聯名甜點與主題內裝') + '著稱，適合以甜點與店內氛圍補給體力。';
  } else {
    content = name + '，' + (angle || '適合這條路線的節奏') + '。';
  }
  return {
    heading: name + ' · ' + suffix,
    content: content
  };
}

function defaultPhotoIntent(role) {
  if (role === 'hotel') return '客房、Lobby、公共空間優先，外觀次之';
  if (role === 'hostel') return '客房、公共吧台、交誼廳、Lobby 優先，外觀次之';
  if (role === 'food') return '成品料理、餐點本體';
  return '甜點、飲品、店內氛圍、主題內裝';
}

function defaultRejectRules(role) {
  if (role === 'hotel') return ['parking', 'garage', 'restaurant only', 'resort', 'pool'];
  if (role === 'hostel') return ['parking', 'restaurant only', 'resort', 'pool'];
  return ['logo', '招牌のみ', 'sign only', 'hotel', 'hostel', 'empty table'];
}

export function buildAlternativeSection(baseSection, altConfig) {
  var role = resolveSectionRole(baseSection);
  var checklist = altConfig.imageChecklist ||
    (role === 'cafe' ? ['dessert', '甜點', 'drink', 'cafe', 'カフェ', 'interior'] :
      role === 'food' ? ['ramen', 'food', 'dish', '料理'] :
        role === 'hotel' ? ['room', 'lobby', 'hotel', 'ホテル'] :
          ['room', 'hostel', 'dorm']);

  var swapName = altConfig.officialNameLocal || altConfig.officialName || baseSection.subject;
  var previewCopy = buildSwapPreviewCopy(altConfig, baseSection);

  return Object.assign({}, baseSection, altConfig, previewCopy, {
    subject: swapName,
    title: swapName,
    placeId: Object.prototype.hasOwnProperty.call(altConfig, 'placeId') ? altConfig.placeId : null,
    photoIntent: altConfig.photoIntent || defaultPhotoIntent(role),
    imageChecklist: checklist,
    imageRejectRules: altConfig.imageRejectRules || defaultRejectRules(role),
    allowGenericPhotoFallback: true,
    allowVenueSwap: false,
    venueAlternatives: [],
    isSpecificVenue: true,
    primaryVenueFailed: true
  });
}

async function pickPhotoFromChosenPlace(mapsKey, chosen, altSectionForPhoto, excludeUrls, deps, articleCtx, pickScoredPhotoFn) {
  var placeName = placeDisplayName(chosen);
  var photoContext = {
    role: 'section',
    sectionType: altSectionForPhoto.sectionType || 'cafe',
    sectionRole: altSectionForPhoto.sectionRole || altSectionForPhoto.sectionPurpose || 'cafe',
    sectionPurpose: altSectionForPhoto.sectionPurpose || altSectionForPhoto.sectionRole || 'cafe',
    mapsQuery: altSectionForPhoto.mapsQuery,
    officialName: altSectionForPhoto.officialName || null,
    officialNameLocal: altSectionForPhoto.officialNameLocal || null,
    visualKeywords: altSectionForPhoto.imageChecklist || []
  };
  var pick = await pickScoredPhotoFn(
    mapsKey,
    chosen,
    Object.assign({}, photoContext, { placeName: placeName }),
    excludeUrls,
    altSectionForPhoto,
    deps
  );
  if (!pick || !pick.googlePhotoUrl) return null;
  pick.photoPlaceName = placeName;
  pick.photoSearchUsed = 'venue_chosen_place';
  return pick;
}

export async function tryVenueAlternative(mapsKey, baseSection, altConfig, articleCtx, deps, excludeUrls, pickScoredPhotoFn) {
  var altSection = buildAlternativeSection(baseSection, altConfig);
  var normalized = normalizeSection(altSection, articleCtx);
  var queries = buildLocaleSearchQueries(normalized, articleCtx, { maxQueries: 8 }).queries;
  var regionCode = deps.regionCode || resolveRegionCode(articleCtx, normalized);
  var q;
  var chosen = null;
  var searchUsed = null;

  if (normalized.placeId) {
    var byId = await deps.getGooglePlaceById(mapsKey, normalized.placeId);
    if (byId && validatePlaceResult(byId, normalized).ok && placeInTargetRegion(byId, normalized, regionCode)) {
      chosen = byId;
      searchUsed = 'placeId:' + normalized.placeId;
    }
  }

  if (!chosen) {
    for (q = 0; q < queries.length; q++) {
      var places = await deps.searchGooglePlace(mapsKey, queries[q].query, queries[q].lang, regionCode);
      var p;
      for (p = 0; p < places.length; p++) {
        if (!validatePlaceResult(places[p], normalized).ok) continue;
        if (!placeInTargetRegion(places[p], normalized, regionCode)) continue;
        chosen = places[p];
        searchUsed = queries[q].query;
        break;
      }
      if (chosen) break;
    }
  }

  if (!chosen) return null;

  var placeName = placeDisplayName(chosen);
  var altSectionForPhoto = normalizeSection(
    Object.assign({}, buildAlternativeSection(baseSection, altConfig), {
      officialName: altConfig.officialName || placeName,
      officialNameLocal: altConfig.officialNameLocal || placeName,
      mapsQuery: altConfig.mapsQuery || searchUsed || placeName,
      placeId: placeIdFromResource(chosen.id || chosen.name),
      venueSwapped: true
    }),
    articleCtx
  );

  var photoPick = await pickPhotoFromChosenPlace(
    mapsKey,
    chosen,
    altSectionForPhoto,
    excludeUrls,
    deps,
    articleCtx,
    pickScoredPhotoFn
  );
  if (!photoPick || !photoPick.googlePhotoUrl) return null;

  var resolvedName = shortDisplayName(placeName);
  var placeMeta = {
    placeName: resolvedName,
    googleAddress: chosen.formattedAddress || null,
    swapCopyAngle: altConfig.swapCopyAngle || baseSection.venueSwapIntent || null
  };
  var copyPatch = rewriteSectionCopyForVenue(baseSection, placeMeta, articleCtx);
  altSectionForPhoto = normalizeSection(
    Object.assign({}, altSectionForPhoto, copyPatch, {
      officialName: resolvedName,
      officialNameLocal: altConfig.officialNameLocal || resolvedName,
      mapsQuery: altConfig.mapsQuery || searchUsed || resolvedName,
      venueSwapped: true
    }),
    articleCtx
  );

  return {
    section: altSectionForPhoto,
    place: chosen,
    photoPick: photoPick,
    searchUsed: searchUsed,
    copyPatch: copyPatch
  };
}

export async function resolveVenueFallback(mapsKey, section, articleCtx, deps, excludeUrls, pickScoredPhotoFn) {
  if (section.allowVenueSwap === false) return null;
  var alts = Array.isArray(section.venueAlternatives) ? section.venueAlternatives : [];
  if (!alts.length) return null;

  var i;
  for (i = 0; i < alts.length; i++) {
    var result = await tryVenueAlternative(
      mapsKey,
      section,
      alts[i],
      articleCtx,
      deps,
      excludeUrls,
      pickScoredPhotoFn
    );
    if (result) {
      result.alternativeIndex = i;
      result.alternativeId = alts[i].id || alts[i].officialName || ('alt_' + i);
      return result;
    }
  }
  return null;
}
