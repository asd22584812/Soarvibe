/**
 * Image Candidates — collect 10~20 photos from Google Places searches.
 * Google Places is a candidate source, NOT the final image decision.
 */

function placeDisplayName(place) {
  if (!place) return '';
  if (place.displayName && place.displayName.text) return place.displayName.text;
  return String(place.displayName || '');
}

function buildPhotoAttribution(photo) {
  if (!photo || !photo.authorAttributions || !photo.authorAttributions.length) return 'Google Maps';
  return photo.authorAttributions
    .map(function (a) { return a.displayName || ''; })
    .filter(Boolean)
    .join(' / ') || 'Google Maps';
}

export async function collectImageCandidates(mapsKey, deps, section, options) {
  var resolveGooglePhotoUri = deps.resolveGooglePhotoUri;
  var searchGooglePlace = deps.searchGooglePlace;
  var keywordPlan = deps.keywordPlan;
  var excludeUrls = deps.excludeUrls || [];
  var exclude = {};
  excludeUrls.forEach(function (u) { if (u) exclude[u] = true; });

  var maxCandidates = (options && options.maxCandidates) || 12;
  var maxPhotosPerPlace = (options && options.maxPhotosPerPlace) || 5;
  var candidates = [];
  var seenPhotoNames = {};

  for (var q = 0; q < keywordPlan.queries.length && candidates.length < maxCandidates; q++) {
    var queryRow = keywordPlan.queries[q];
    var places;
    try {
      places = await searchGooglePlace(mapsKey, queryRow.query, queryRow.lang);
    } catch (e) {
      continue;
    }

    for (var p = 0; p < places.length && candidates.length < maxCandidates; p++) {
      var place = places[p];
      var placeName = placeDisplayName(place);
      var photos = place.photos || [];
      var limit = Math.min(photos.length, maxPhotosPerPlace);

      for (var i = 0; i < limit && candidates.length < maxCandidates; i++) {
        var photo = photos[i];
        if (!photo || !photo.name || seenPhotoNames[photo.name]) continue;
        seenPhotoNames[photo.name] = true;

        var url = await resolveGooglePhotoUri(mapsKey, photo.name);
        if (!url || exclude[url]) continue;

        candidates.push({
          candidateId: section.sectionId + '-' + candidates.length,
          imageUrl: url,
          photoName: photo.name,
          photoIndex: i,
          widthPx: photo.widthPx || null,
          heightPx: photo.heightPx || null,
          attribution: buildPhotoAttribution(photo),
          sourcePlaceName: placeName,
          searchQuery: queryRow.query,
          searchLang: queryRow.lang,
          source: 'google_places_candidate'
        });
      }
    }
  }

  return candidates;
}

export { placeDisplayName, buildPhotoAttribution };
