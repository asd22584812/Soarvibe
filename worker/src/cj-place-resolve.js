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

export function buildSearchSequence(item) {
  return buildPhotoSearchSequence(item);
}

export function placeDisplayName(place) {
  return place && place.displayName && place.displayName.text ? place.displayName.text : '';
}

export function placeTypes(place) {
  var types = Array.isArray(place && place.types) ? place.types.slice() : [];
  if (place && place.primaryType && types.indexOf(place.primaryType) === -1) {
    types.push(place.primaryType);
  }
  return types;
}

export function nameValidationTerms(item) {
  var terms = [item.officialNameLocal, item.officialName, item.subject];
  if (Array.isArray(item.aliases)) terms = terms.concat(item.aliases);
  return terms.filter(Boolean);
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
    nameOk = containsAny(addr, addressHints);
  }
  if (!nameOk) {
    return { ok: false, reason: 'name_mismatch', name: name, address: addr };
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

export async function resolveOfficialPlace(mapsKey, item, deps) {
  var getById = deps.getGooglePlaceById;
  var search = deps.searchGooglePlace;

  if (item.placeId) {
    var byId = await getById(mapsKey, item.placeId);
    if (byId) {
      var idVal = validatePlaceResult(byId, item);
      if (idVal.ok) {
        return { place: byId, searchUsed: 'placeId:' + item.placeId, validation: idVal };
      }
    }
  }

  var sequence = buildSearchSequence(item);
  for (var s = 0; s < sequence.length; s++) {
    var step = sequence[s];
    var places = await search(mapsKey, step.query, step.lang);
    for (var p = 0; p < places.length; p++) {
      var val = validatePlaceResult(places[p], item);
      if (val.ok) {
        return { place: places[p], searchUsed: step.query, validation: val };
      }
    }
  }

  return null;
}
