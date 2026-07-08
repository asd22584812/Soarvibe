/**
 * Landmark sections: place is verified → pick from that place's photos only.
 * Metadata gate is relaxed; vision verify happens client-side (fetch script).
 */
import { buildPhotoAttribution } from './cj-image-candidates.js';
import { photoAttrText } from './cj-photo-scoring.js';
import { placeDisplayName } from './cj-place-resolve.js';
import { logPhotoSearchAttempt } from './cj-photo-search-strategy.js';

var BAD_GLOBAL = /tiger|white tiger|zoo|garden|residential|repair shop|garage|pool|beach|villa|白老虎|修車|住宅|花園|泳池/i;

export function isStrictLandmarkSection(section) {
  if (!section) return false;
  if (section.strictVenueLock === true) return true;
  return section.sectionType === 'landmark' && section.isSpecificVenue === true;
}

function photoRatio(photo) {
  var w = photo.widthPx || 0;
  var h = photo.heightPx || 0;
  if (!w || !h) return 1.5;
  return w / h;
}

function passesLandmarkPhotoMinGate(photo) {
  var attr = photoAttrText(photo).toLowerCase();
  if (BAD_GLOBAL.test(attr)) return false;
  var ratio = photoRatio(photo);
  if (ratio < 0.55 || ratio > 2.8) return false;
  if ((photo.heightPx || 0) > 0 && photo.heightPx < 280) return false;
  return true;
}

/**
 * Pick photo indices from the verified place only (no cross-venue photo search).
 */
export async function pickLandmarkPhotoFromPlace(mapsKey, place, item, deps, options) {
  if (!place || !place.photos || !place.photos.length) return null;

  var placeName = placeDisplayName(place);
  var photos = place.photos;
  var exclude = {};
  (options && options.excludeUrls || []).forEach(function (u) { if (u) exclude[u] = true; });
  var minIndex = options && typeof options.minPhotoIndex === 'number' ? options.minPhotoIndex : 0;
  var maxIndex = Math.min(photos.length - 1, (options && options.maxPhotoIndex) || 5);
  var debug = options && options.debug;
  var uriBudget = (options && options.uriBudget) || 4;

  for (var idx = minIndex; idx <= maxIndex; idx++) {
    var photo = photos[idx];
    if (!photo || !photo.name) continue;
    if (!passesLandmarkPhotoMinGate(photo)) continue;
    if (uriBudget <= 0) break;

    var url = await deps.resolveGooglePhotoUri(mapsKey, photo.name);
    uriBudget -= 1;
    if (!url || exclude[url]) continue;

    var attribution = buildPhotoAttribution(photo);
    if (debug) {
      logPhotoSearchAttempt(debug, {
        sectionId: item.sectionId,
        slot: 'landmark_verified',
        query: 'placeId:' + (item.placeId || placeName),
        phase: 'landmark_pick',
        candidateCount: photos.length,
        photoIndex: idx,
        selectedImageUrl: url,
        selectedReason: 'landmark_verified_index_' + idx,
        rejectReason: null
      });
    }

    return {
      googlePhotoUrl: url,
      googleAttribution: attribution,
      photoScore: 100,
      photoIndex: idx,
      matchedKeywords: (item.photoAnchorTerms || []).slice(0, 4),
      photoPlaceName: placeName,
      photoEvidence: {
        primary: 'landmark_building',
        types: ['landmark_building', 'facade'],
        subjectType: 'landmark',
        role: item.sectionRole || 'landmark',
        blob: placeName
      },
      travelPhotoSlot: 'landmark_exterior',
      photoSearchUsed: 'landmark_verified_place',
      photoSearchPhase: 'landmark_pick',
      landmarkPickMode: true,
      rejectReason: null
    };
  }

  return null;
}
