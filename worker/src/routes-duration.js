/**
 * Google Routes / Distance Matrix duration helper for Cloudflare Worker.
 * Minimal field mask — duration + distance only. No polylines / steps.
 *
 * Prefers GOOGLE_MAPS_SERVER_KEY (server-side). Falls back to GOOGLE_MAPS_API_KEY
 * but browser-restricted keys often fail for Routes — caller must handle that.
 */
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

const ALLOWED_MODES = {
  TRANSIT: true,
  WALK: true,
  DRIVE: true,
  walk: 'WALK',
  transit: 'TRANSIT',
  drive: 'DRIVE',
  WALKING: 'WALK',
  DRIVING: 'DRIVE'
};

export function normalizeTravelMode(mode) {
  var raw = String(mode || 'TRANSIT').trim();
  if (ALLOWED_MODES[raw] === true) return raw;
  if (typeof ALLOWED_MODES[raw] === 'string') return ALLOWED_MODES[raw];
  return null;
}

export function getRoutesMapsKey(env) {
  return String(env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_MAPS_API_KEY || '').trim();
}

export function roundCoord(n) {
  var x = Number(n);
  if (!isFinite(x)) return null;
  return Math.round(x * 1e5) / 1e5;
}

export function validateWaypoint(point, label) {
  if (!point || typeof point !== 'object') {
    return { ok: false, error: 'missing_' + label };
  }
  var placeId = String(point.placeId || '').replace(/^places\//, '').trim();
  var lat = roundCoord(point.lat);
  var lng = roundCoord(point.lng);
  if (placeId) {
    if (placeId.length < 8 || placeId.length > 256) {
      return { ok: false, error: 'invalid_placeId_' + label };
    }
    return { ok: true, placeId: placeId, lat: lat, lng: lng };
  }
  if (lat == null || lng == null) {
    return { ok: false, error: 'missing_coords_' + label };
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: 'coords_out_of_range_' + label };
  }
  return { ok: true, placeId: '', lat: lat, lng: lng };
}

export function parseDurationSeconds(duration) {
  if (duration == null) return NaN;
  if (typeof duration === 'number' && isFinite(duration)) return Math.round(duration);
  var s = String(duration);
  var m = s.match(/^(\d+(?:\.\d+)?)s$/);
  if (m) return Math.round(Number(m[1]));
  var n = Number(s);
  return isFinite(n) ? Math.round(n) : NaN;
}

function waypointToRoutesBody(wp) {
  if (wp.placeId) {
    return { placeId: wp.placeId };
  }
  return {
    location: {
      latLng: {
        latitude: wp.lat,
        longitude: wp.lng
      }
    }
  };
}

function waypointToMatrixString(wp) {
  if (wp.placeId) return 'place_id:' + wp.placeId;
  return wp.lat + ',' + wp.lng;
}

/**
 * Call Google Routes API computeRoutes (traffic-unaware).
 */
export async function computeRoutesDuration(mapsKey, origin, destination, travelMode, opt) {
  opt = opt || {};
  var body = {
    origin: waypointToRoutesBody(origin),
    destination: waypointToRoutesBody(destination),
    travelMode: travelMode,
    languageCode: opt.languageCode || 'zh-TW',
    units: 'METRIC'
  };
  // Avoid TRAFFIC_AWARE / TRAFFIC_AWARE_OPTIMAL SKUs for itinerary planning.
  if (travelMode === 'DRIVE') {
    body.routingPreference = 'TRAFFIC_UNAWARE';
  }
  if (travelMode === 'TRANSIT' && opt.departureTimeIso) {
    body.departureTime = opt.departureTimeIso;
  } else if (travelMode === 'TRANSIT') {
    // Routes API may require departureTime for transit — use a near-future planning window.
    body.departureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = null;
  if (controller && opt.timeoutMs) {
    timer = setTimeout(function () {
      try {
        controller.abort();
      } catch (e) {
        /* ignore */
      }
    }, opt.timeoutMs);
  }

  var response;
  try {
    response = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': mapsKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
      },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  var text = await response.text();
  var json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    json = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: 'routes_api_http_' + response.status,
      details: json && json.error ? json.error : null,
      sourceAttempt: 'google_routes'
    };
  }

  var route = json && json.routes && json.routes[0];
  if (!route) {
    return {
      ok: false,
      status: 200,
      error: 'routes_empty',
      sourceAttempt: 'google_routes'
    };
  }

  var durationSeconds = parseDurationSeconds(route.duration);
  if (!isFinite(durationSeconds) || durationSeconds <= 0) {
    return {
      ok: false,
      status: 200,
      error: 'routes_invalid_duration',
      sourceAttempt: 'google_routes'
    };
  }

  return {
    ok: true,
    durationSeconds: durationSeconds,
    distanceMeters:
      typeof route.distanceMeters === 'number' ? Math.round(route.distanceMeters) : null,
    travelMode: travelMode,
    source: 'google_routes',
    routeConfidence: 'verified'
  };
}

/**
 * Legacy Distance Matrix REST fallback (still Google verified when successful).
 */
export async function computeDistanceMatrixDuration(mapsKey, origin, destination, travelMode, opt) {
  opt = opt || {};
  var mode =
    travelMode === 'WALK' ? 'walking' : travelMode === 'DRIVE' ? 'driving' : 'transit';
  var params = new URLSearchParams({
    origins: waypointToMatrixString(origin),
    destinations: waypointToMatrixString(destination),
    mode: mode,
    key: mapsKey,
    language: opt.languageCode || 'zh-TW',
    units: 'metric'
  });
  // No departure_time for driving → avoids traffic-aware billed paths.
  if (mode === 'transit' && opt.departureTimeIso) {
    params.set('departure_time', Math.floor(new Date(opt.departureTimeIso).getTime() / 1000));
  }

  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = null;
  if (controller && opt.timeoutMs) {
    timer = setTimeout(function () {
      try {
        controller.abort();
      } catch (e) {
        /* ignore */
      }
    }, opt.timeoutMs);
  }

  var response;
  try {
    response = await fetch(DISTANCE_MATRIX_URL + '?' + params.toString(), {
      method: 'GET',
      signal: controller ? controller.signal : undefined
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  var json = await response.json().catch(function () {
    return null;
  });
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: 'distance_matrix_http_' + response.status,
      sourceAttempt: 'google_distance_matrix'
    };
  }
  if (!json || json.status !== 'OK') {
    return {
      ok: false,
      status: 200,
      error: 'distance_matrix_status_' + ((json && json.status) || 'unknown'),
      sourceAttempt: 'google_distance_matrix',
      details: json
    };
  }
  var el = json.rows && json.rows[0] && json.rows[0].elements && json.rows[0].elements[0];
  if (!el || el.status !== 'OK' || !el.duration || el.duration.value == null) {
    return {
      ok: false,
      status: 200,
      error: 'distance_matrix_element_' + ((el && el.status) || 'missing'),
      sourceAttempt: 'google_distance_matrix'
    };
  }
  return {
    ok: true,
    durationSeconds: Math.round(el.duration.value),
    distanceMeters: el.distance && el.distance.value != null ? Math.round(el.distance.value) : null,
    travelMode: travelMode,
    source: 'google_distance_matrix',
    routeConfidence: 'verified'
  };
}

export async function resolveGoogleDuration(mapsKey, origin, destination, travelMode, opt) {
  opt = opt || {};
  var timeoutMs = opt.timeoutMs || 4000;
  var routesResult = await computeRoutesDuration(mapsKey, origin, destination, travelMode, {
    timeoutMs: timeoutMs,
    departureTimeIso: opt.departureTimeIso,
    languageCode: opt.languageCode
  });
  if (routesResult.ok) return routesResult;

  // If Routes not enabled / restricted, try Distance Matrix REST.
  var matrixResult = await computeDistanceMatrixDuration(mapsKey, origin, destination, travelMode, {
    timeoutMs: timeoutMs,
    departureTimeIso: opt.departureTimeIso,
    languageCode: opt.languageCode
  });
  if (matrixResult.ok) {
    matrixResult.fallbackFrom = routesResult.error;
    return matrixResult;
  }

  return {
    ok: false,
    error: 'google_duration_unavailable',
    routesError: routesResult.error,
    matrixError: matrixResult.error,
    routesStatus: routesResult.status,
    matrixStatus: matrixResult.status,
    hint:
      routesResult.status === 403 || matrixResult.status === 403
        ? 'key_or_api_not_authorized_for_routes_or_distance_matrix'
        : 'upstream_failed'
  };
}

export async function handleRoutesDuration(request, env, auth, jsonResponse) {
  var mapsKey = getRoutesMapsKey(env);
  if (!mapsKey || mapsKey.indexOf('AIza') !== 0) {
    return jsonResponse(
      {
        ok: false,
        error: 'maps_not_configured',
        hint: 'Set GOOGLE_MAPS_SERVER_KEY (preferred) or GOOGLE_MAPS_API_KEY on Worker'
      },
      503,
      auth.origin,
      env
    );
  }

  var rawText = '';
  try {
    rawText = await request.text();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'invalid_body' }, 400, auth.origin, env);
  }
  // Limit request size — adjacent-leg payload is tiny
  if (rawText.length > 4096) {
    return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, auth.origin, env);
  }

  var body = {};
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400, auth.origin, env);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ ok: false, error: 'invalid_body' }, 400, auth.origin, env);
  }
  // Reject client-specified Google URLs / keys
  if (body.googleUrl || body.apiKey || body.key || body.url) {
    return jsonResponse({ ok: false, error: 'forbidden_fields' }, 400, auth.origin, env);
  }

  var travelMode = normalizeTravelMode(body.travelMode || body.mode);
  if (!travelMode) {
    return jsonResponse({ ok: false, error: 'unsupported_travelMode' }, 400, auth.origin, env);
  }

  var origin = validateWaypoint(body.origin, 'origin');
  var destination = validateWaypoint(body.destination, 'destination');
  if (!origin.ok) {
    return jsonResponse({ ok: false, error: origin.error }, 400, auth.origin, env);
  }
  if (!destination.ok) {
    return jsonResponse({ ok: false, error: destination.error }, 400, auth.origin, env);
  }

  try {
    var result = await resolveGoogleDuration(mapsKey, origin, destination, travelMode, {
      timeoutMs: 4000,
      departureTimeIso: body.departureTimeIso || null,
      languageCode: body.languageCode || 'zh-TW'
    });
    if (!result.ok) {
      var status =
        result.hint === 'key_or_api_not_authorized_for_routes_or_distance_matrix' ? 502 : 502;
      return jsonResponse(
        {
          ok: false,
          error: result.error,
          routesError: result.routesError,
          matrixError: result.matrixError,
          hint: result.hint,
          // Do not leak key. Advise server-side key when 403-like.
          needsServerSideKey:
            result.hint === 'key_or_api_not_authorized_for_routes_or_distance_matrix' ||
            result.routesStatus === 403 ||
            result.matrixStatus === 403
        },
        status,
        auth.origin,
        env
      );
    }
    return jsonResponse(
      {
        ok: true,
        durationSeconds: result.durationSeconds,
        distanceMeters: result.distanceMeters,
        travelMode: result.travelMode,
        source: result.source,
        routeConfidence: 'verified'
      },
      200,
      auth.origin,
      env
    );
  } catch (err) {
    var aborted = err && (err.name === 'AbortError' || /aborted/i.test(String(err.message || '')));
    return jsonResponse(
      {
        ok: false,
        error: aborted ? 'timeout' : 'routes_internal_error',
        message: aborted ? 'route_request_timeout' : 'route_resolve_failed'
      },
      aborted ? 504 : 500,
      auth.origin,
      env
    );
  }
}
