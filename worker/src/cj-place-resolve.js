/**
 * Strict Google Places resolution — official names + photoIntent search.
 */

import { buildPhotoSearchSequence } from './cj-editorial-pipeline.js';

function normalizeForMatch(text) {
  return String(text || '').toLowerCase().replace(/[\s　]+/g, '');
}

function containsTerm(blob, term) {
  if (!term) return false;
  return normalizeForMatch(blob).indexOf(normalizeForMatch(term)) !== -1;
}

function containsAny(blob, terms) {
  return (terms || []).some(function (term) {
    return containsTerm(blob, term);
  });
}

export function buildSearchSequence(item, articleCtx) {
  return buildPhotoSearchSequence(item, articleCtx);
}

export function placeDisplayName(place) {
  return place && place.displayName && place.displayName.text ? place.displayName.text : '';
}

var FOREIGN_REGION_DENY = /台北|Taipei|Taichung|台中|高雄|Kaohsiung|Taiwan|台灣|Hong Kong|香港|Seoul|서울|Korea|新加坡|Singapore|Bangkok|曼谷/i;
var JP_REGION_OK = /Japan|日本|〒|Tokyo|東京|Chiyoda|Taito|Shibuya|Shinjuku|Akihabara|秋葉原|Odaiba|台場|Nakano|中野|Ikebukuro|池袋|豊島|Minato|港区|Shibuya|渋谷/i;

function isCityOnlyHint(hint) {
  return /^(東京|Tokyo|Japan|日本)$/i.test(String(hint || '').trim());
}

export function blobInTargetRegion(blob, regionCode, addressHints) {
  var text = String(blob || '');
  if (FOREIGN_REGION_DENY.test(text)) return false;
  if (regionCode === 'JP' && !JP_REGION_OK.test(text)) return false;
  var hints = Array.isArray(addressHints) ? addressHints.filter(Boolean) : [];
  if (!hints.length) return true;
  var hintHit = hints.some(function (hint) {
    return text.indexOf(hint) !== -1;
  });
  if (hintHit) return true;
  var districtHints = hints.filter(function (hint) {
    return !isCityOnlyHint(hint);
  });
  if (districtHints.length) return false;
  return JP_REGION_OK.test(text);
}

export function placeInTargetRegion(place, item, regionCode) {
  var addr = String(place && place.formattedAddress || '');
  var name = placeDisplayName(place);
  var hints = Array.isArray(item && item.addressHints) ? item.addressHints : [];
  return blobInTargetRegion(name + ' ' + addr, regionCode, hints);
}

export function attributionInTargetRegion(attribution, item, regionCode) {
  var text = String(attribution || '');
  if (FOREIGN_REGION_DENY.test(text)) return false;
  var hints = Array.isArray(item && item.addressHints) ? item.addressHints.filter(Boolean) : [];
  var districtHints = hints.filter(function (hint) {
    return !isCityOnlyHint(hint);
  });
  if (!districtHints.length) return true;
  var looksLocated = /店|caf[eé]|カフェ|咖啡|hotel|hostel|ホテル|旅館|restaurant|餐廳|館/i.test(text);
  if (!looksLocated) return true;
  return blobInTargetRegion(text, regionCode, hints);
}

export function placeTypes(place) {
  var types = Array.isArray(place && place.types) ? place.types.slice() : [];
  if (place && place.primaryType && types.indexOf(place.primaryType) === -1) {
    types.push(place.primaryType);
  }
  return types;
}

export function nameValidationTerms(item) {
  var terms = [item.officialNameLocal, item.officialName];
  var specific = item.isSpecificVenue === true ||
    item.sectionType === 'food' || item.sectionType === 'cafe' ||
    item.sectionType === 'hotel' || item.sectionType === 'hostel' ||
    item.sectionRole === 'food' || item.sectionRole === 'cafe' ||
    item.sectionRole === 'hotel' || item.sectionRole === 'hostel';

  if (specific) {
    if (item.mapsQuery) terms.push(item.mapsQuery);
    if (Array.isArray(item.photoAnchorTerms)) terms = terms.concat(item.photoAnchorTerms);
    return terms.filter(Boolean);
  }

  terms = terms.concat([item.subject]);
  if (Array.isArray(item.aliases)) terms = terms.concat(item.aliases);
  return terms.filter(Boolean);
}

export function primaryVenueTerms(item) {
  return [item.officialNameLocal, item.officialName, item.mapsQuery].filter(Boolean);
}

export function placeMatchesPrimaryVenue(place, item) {
  var name = placeDisplayName(place);
  var addr = place && place.formattedAddress ? place.formattedAddress : '';
  var blob = name + ' ' + addr;
  if (containsAny(blob, primaryVenueTerms(item))) return true;
  if (containsAny(name, item.photoAnchorTerms || [])) return true;
  return containsAny(name, [item.officialNameLocal, item.officialName].filter(Boolean));
}

export function validatePlaceResult(place, item) {
  var name = placeDisplayName(place);
  var addr = place && place.formattedAddress ? place.formattedAddress : '';
  var blob = name + ' ' + addr;
  var terms = nameValidationTerms(item);
  var addressHints = Array.isArray(item.addressHints) ? item.addressHints : [];
  var types = placeTypes(place);

  var nameOk = containsAny(name, terms);
  if (!nameOk && addressHints.length) {
    var role = item.sectionRole || item.sectionType;
    var strictLodging = item.isSpecificVenue && (role === 'hotel' || role === 'hostel' || item.sectionType === 'hotel' || item.sectionType === 'hostel');
    if (!strictLodging) {
      nameOk = containsAny(addr, addressHints);
    }
  }
  if (!nameOk && addressHints.length && containsAny(addr, addressHints)) {
    nameOk = containsAny(name, terms) || containsAny(name, item.photoAnchorTerms || []);
  }
  if (!nameOk) {
    return { ok: false, reason: 'name_mismatch', name: name, address: addr };
  }

  var role = item.sectionRole || item.sectionType;
  var strictLodging = item.isSpecificVenue && (role === 'hotel' || role === 'hostel' || item.sectionType === 'hotel' || item.sectionType === 'hostel');
  if (strictLodging && /居酒屋|restaurant|ramen|ラーメン|カフェ|cafe|coffee shop/i.test(name) &&
    !/hostel|hotel|ホテル|ホステル|inn|旅館|レム|ドーミー|dormy|grids|グリッド|グリッズ|citan|シータン/i.test(name)) {
    return { ok: false, reason: 'lodging_nearby_business', name: name };
  }

  var deniedTypes = Array.isArray(item.deniedPlaceTypes) ? item.deniedPlaceTypes : [];
  for (var d = 0; d < deniedTypes.length; d++) {
    if (types.indexOf(deniedTypes[d]) !== -1) {
      return { ok: false, reason: 'denied_type:' + deniedTypes[d], name: name };
    }
  }

  var allowedTypes = Array.isArray(item.allowedPlaceTypes) ? item.allowedPlaceTypes : [];
  if (allowedTypes.length) {
    var typeOk = allowedTypes.some(function (t) {
      return types.indexOf(t) !== -1;
    });
    if (!typeOk) {
      return { ok: false, reason: 'type_not_allowed', name: name, types: types };
    }
  }

  if (item.sectionType === 'landmark' && !item.isSpecificVenue) {
    var nearbyBusiness = /cinema|movie[_ ]?theater|theatre|pod|ポッド|映画館|hostel|hotel|旅館|民宿|カフェ|咖啡廳|餐廳|restaurant/i.test(name);
    if (nearbyBusiness && !containsAny(name, terms)) {
      return { ok: false, reason: 'nearby_business', name: name };
    }
  }

  return { ok: true, name: name, address: addr, types: types };
}

export function validatePhotoAttribution(attribution, item) {
  var attr = String(attribution || '').trim();
  if (!attr) return { ok: true };

  var terms = nameValidationTerms(item);
  var deniedPatterns = Array.isArray(item.deniedAttributionPatterns) ? item.deniedAttributionPatterns : [];

  for (var i = 0; i < deniedPatterns.length; i++) {
    try {
      if (new RegExp(deniedPatterns[i], 'i').test(attr)) {
        return { ok: false, reason: 'attribution_denied_pattern' };
      }
    } catch (e) { /* skip invalid regex */ }
  }

  var looksLikeVenue = /店|館|hotel|hostel|restaurant|cafe|咖啡|旅館|ホテル|カフェ|pod|ポッド|cinema|theater|theatre|映画|メイド|maid/i.test(attr);
  var role = item.sectionRole || item.sectionType;
  var strictLodging = role === 'hotel' || role === 'hostel' || item.sectionType === 'hotel' || item.sectionType === 'hostel';
  var strictFood = (role === 'food' || item.sectionType === 'food') && item.isSpecificVenue === true;

  if (strictLodging) {
    if (!containsAny(attr, terms)) {
      return { ok: false, reason: 'lodging_attribution_strict_mismatch', attribution: attr };
    }
    return { ok: true };
  }

  if (strictFood) {
    if (!containsAny(attr, terms) && !containsAny(attr, primaryVenueTerms(item))) {
      return { ok: false, reason: 'food_attribution_strict_mismatch', attribution: attr };
    }
    return { ok: true };
  }

  if (looksLikeVenue) {
    if (!containsAny(attr, terms)) {
      var hints = Array.isArray(item.addressHints) ? item.addressHints : [];
      if (!containsAny(attr, hints)) {
        return { ok: false, reason: 'attribution_venue_mismatch', attribution: attr };
      }
    }
  }

  return { ok: true };
}

export async function resolveOfficialPlace(mapsKey, item, deps, articleCtx) {
  var getById = deps.getGooglePlaceById;
  var search = deps.searchGooglePlace;
  var regionCode = deps.regionCode || null;

  var sequence = buildSearchSequence(item, articleCtx);

  for (var s = 0; s < sequence.length; s++) {
    var step = sequence[s];
    var places = await search(mapsKey, step.query, step.lang, regionCode);
    for (var p = 0; p < places.length; p++) {
      if (!placeInTargetRegion(places[p], item, regionCode || 'JP')) continue;
      var val = validatePlaceResult(places[p], item);
      if (val.ok && placeMatchesPrimaryVenue(places[p], item)) {
        return { place: places[p], searchUsed: step.query, validation: val };
      }
    }
  }

  if (item.placeId) {
    var byId = await getById(mapsKey, item.placeId);
    if (byId) {
      var idVal = validatePlaceResult(byId, item);
      if (idVal.ok && placeMatchesPrimaryVenue(byId, item)) {
        return { place: byId, searchUsed: 'placeId:' + item.placeId, validation: idVal };
      }
    }
  }

  for (var s2 = 0; s2 < sequence.length; s2++) {
    var step2 = sequence[s2];
    var places2 = await search(mapsKey, step2.query, step2.lang, regionCode);
    for (var p2 = 0; p2 < places2.length; p2++) {
      if (!placeInTargetRegion(places2[p2], item, regionCode || 'JP')) continue;
      var val2 = validatePlaceResult(places2[p2], item);
      if (val2.ok) {
        return { place: places2[p2], searchUsed: step2.query + ':relaxed', validation: val2 };
      }
    }
  }

  return null;
}
