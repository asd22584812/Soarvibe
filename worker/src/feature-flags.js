/**
 * Worker feature flags — disable costly editorial / Places photo pipeline.
 */
export var FEATURE_FLAGS = Object.freeze({
  EDITORIAL_RESOLVE_ENABLED: false,
  EDITORIAL_GENERATE_ENABLED: false,
  EDITORIAL_VISION_ENABLED: false,
  PLACES_TEXT_SEARCH_ENABLED: false,
  PLACES_RESOLVE_ENABLED: false,
  PLACES_PHOTO_FETCH_ENABLED: false
});

export function editorialDisabledResponse() {
  return {
    ok: false,
    disabled: true,
    error: 'editorial_pipeline_disabled',
    message: 'City Journal editorial pipeline is disabled. Use city shares with user-uploaded images.'
  };
}

export function placesPhotoDisabledResponse() {
  return {
    ok: false,
    disabled: true,
    error: 'places_photo_pipeline_disabled',
    message: 'Google Places photo search is disabled. Metadata-only endpoints remain available in Phase 1.'
  };
}

/** Second-layer guard — call at top of searchGooglePlace before any Google request. */
export function assertPlacesTextSearchEnabled() {
  if (!FEATURE_FLAGS.PLACES_TEXT_SEARCH_ENABLED) {
    throw new Error('PLACES_TEXT_SEARCH_DISABLED');
  }
}

/** Second-layer guard — call at top of resolveGooglePhotoUri before any Google request. */
export function assertPlacesPhotoFetchEnabled() {
  if (!FEATURE_FLAGS.PLACES_PHOTO_FETCH_ENABLED) {
    throw new Error('PLACES_PHOTO_FETCH_DISABLED');
  }
}
