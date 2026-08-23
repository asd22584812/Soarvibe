/**
 * SoarVibe adjacent-leg route duration (Planner v2.2).
 *
 * Cost rules:
 * - Only final adjacent itinerary pairs (A→B, B→C, …)
 * - Session cache by placeIdA|placeIdB|mode (else rounded lat/lng|mode)
 * - No NxN matrix (routeMatrixElements always 0)
 * - No traffic-aware by default
 * - Per-trip Google route call cap + concurrency limit
 *
 * Resolution order:
 * 1) injected fetchRouteDuration (tests)
 * 2) Worker POST /api/routes/duration → google_routes (or DM fallback on Worker)
 * 3) cached Google duration
 * 4) Maps JS DistanceMatrixService (if available)
 * 5) Haversine from Places lat/lng
 * 6) Travel Time Engine heuristic
 *
 * routeConfidence: verified | estimated
 */
(function (global) {
  'use strict';

  var ROUTE_CACHE = Object.create(null);
  var ROUTE_INFLIGHT = Object.create(null);
  var liveFetcher = null;

  var SPEEDS_KMH = {
    walk: 4.5,
    transit: 22,
    drive: 28,
    mixed: 20
  };

  function isVerifiedSource(source) {
    var s = String(source || '');
    return (
      s === 'google_routes' ||
      s === 'google_distance_matrix' ||
      s.indexOf('google_routes') === 0 ||
      s.indexOf('google_distance_matrix') === 0
    );
  }

  function confidenceForSource(source) {
    return isVerifiedSource(source) ? 'verified' : 'estimated';
  }

  function normalizeClientMode(mode) {
    var m = String(mode || 'transit').toLowerCase();
    if (m === 'walking' || m === 'walk') return 'walk';
    if (m === 'driving' || m === 'drive') return 'drive';
    return 'transit';
  }

  function toWorkerTravelMode(mode) {
    var m = normalizeClientMode(mode);
    if (m === 'walk') return 'WALK';
    if (m === 'drive') return 'DRIVE';
    return 'TRANSIT';
  }

  function roundCoord(n) {
    var x = Number(n);
    if (!isFinite(x)) return null;
    return Math.round(x * 1e5) / 1e5;
  }

  function placeIdOf(item) {
    if (!item) return '';
    var p = item.__places || {};
    return String(item.placeId || p.placeId || p.id || '')
      .replace(/^places\//, '')
      .trim();
  }

  function labelCacheKey(fromLabel, toLabel, mode) {
    return [
      String(fromLabel || '')
        .trim()
        .toLowerCase(),
      String(toLabel || '')
        .trim()
        .toLowerCase(),
      String(mode || 'transit')
    ].join('|');
  }

  function cacheKey(fromItem, toItem, mode) {
    mode = normalizeClientMode(mode);
    var aId = placeIdOf(fromItem);
    var bId = placeIdOf(toItem);
    if (aId && bId) return aId + '|' + bId + '|' + mode;
    var a = coordsOf(fromItem);
    var b = coordsOf(toItem);
    if (a && b) {
      var al = roundCoord(a.lat);
      var ag = roundCoord(a.lng);
      var bl = roundCoord(b.lat);
      var bg = roundCoord(b.lng);
      if (al != null && ag != null && bl != null && bg != null) {
        return [al, ag, bl, bg, mode].join('|');
      }
    }
    return labelCacheKey(labelOf(fromItem), labelOf(toItem), mode);
  }

  function clearRouteCache() {
    Object.keys(ROUTE_CACHE).forEach(function (k) {
      delete ROUTE_CACHE[k];
    });
    Object.keys(ROUTE_INFLIGHT).forEach(function (k) {
      delete ROUTE_INFLIGHT[k];
    });
  }

  function setLiveFetcher(fn) {
    liveFetcher = typeof fn === 'function' ? fn : null;
  }

  function haversineMeters(a, b) {
    if (!a || !b || a.lat == null || b.lat == null || a.lng == null || b.lng == null) {
      return NaN;
    }
    var R = 6371000;
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLng = (b.lng - a.lng) * toRad;
    var lat1 = a.lat * toRad;
    var lat2 = b.lat * toRad;
    var x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }

  function coordsOf(item) {
    if (!item) return null;
    if (item.__places && item.__places.lat != null && item.__places.lng != null) {
      return { lat: item.__places.lat, lng: item.__places.lng };
    }
    if (item.lat != null && item.lng != null) return { lat: item.lat, lng: item.lng };
    if (item.location && item.location.lat != null) {
      return { lat: item.location.lat, lng: item.location.lng };
    }
    return null;
  }

  function labelOf(item) {
    return String((item && (item.title || item.name)) || '').trim();
  }

  function waypointPayload(item) {
    var placeId = placeIdOf(item);
    var c = coordsOf(item);
    var out = {};
    if (placeId) out.placeId = placeId;
    if (c) {
      out.lat = roundCoord(c.lat);
      out.lng = roundCoord(c.lng);
    }
    return out;
  }

  function minutesFromHaversine(meters, mode) {
    if (!isFinite(meters) || meters < 0) return NaN;
    var kmh = SPEEDS_KMH[mode] || SPEEDS_KMH.transit;
    var hours = meters / 1000 / kmh;
    var mins = Math.ceil(hours * 60);
    if (mode === 'walk') return Math.max(5, mins);
    if (meters < 700) return Math.max(8, mins);
    return Math.max(12, mins + 4);
  }

  function heuristicFallback(fromItem, toItem, mode) {
    var engine = global.SOARVIBE_TRAVEL_TIME_ENGINE;
    if (engine && typeof engine.estimateTransferMinutes === 'function') {
      try {
        var est = engine.estimateTransferMinutes(labelOf(fromItem), labelOf(toItem), mode || 'transit');
        if (est && typeof est.estimatedMinutes === 'number') {
          return {
            estimatedMinutes: est.estimatedMinutes,
            durationSeconds: Math.round(est.estimatedMinutes * 60),
            source: 'heuristic',
            routeConfidence: 'estimated',
            from: labelOf(fromItem),
            to: labelOf(toItem),
            mode: mode || 'transit'
          };
        }
      } catch (e) {
        /* fall through */
      }
    }
    return {
      estimatedMinutes: 20,
      durationSeconds: 1200,
      source: 'heuristic',
      routeConfidence: 'estimated',
      from: labelOf(fromItem),
      to: labelOf(toItem),
      mode: mode || 'transit'
    };
  }

  function getApiBase(opt) {
    if (opt && opt.apiBase) return String(opt.apiBase).replace(/\/$/, '');
    if (typeof global.getSoarvibeApiBase === 'function') {
      try {
        return String(global.getSoarvibeApiBase() || '').replace(/\/$/, '');
      } catch (e) {
        return '';
      }
    }
    return '';
  }

  function withTimeout(promise, timeoutMs) {
    timeoutMs = timeoutMs || 4000;
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        resolve(null);
      }, timeoutMs);
      Promise.resolve(promise)
        .then(function (v) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(v);
        })
        .catch(function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(null);
        });
    });
  }

  async function tryWorkerRoutes(fromItem, toItem, mode, opt) {
    opt = opt || {};
    if (opt.allowWorkerRoutes === false) return null;
    var base = getApiBase(opt);
    if (!base || typeof global.fetch !== 'function') return null;

    var origin = waypointPayload(fromItem);
    var destination = waypointPayload(toItem);
    if (!origin.placeId && (origin.lat == null || origin.lng == null)) return null;
    if (!destination.placeId && (destination.lat == null || destination.lng == null)) return null;

    var body = {
      origin: origin,
      destination: destination,
      travelMode: toWorkerTravelMode(mode)
    };
    if (opt.departureTimeIso) body.departureTimeIso = opt.departureTimeIso;

    var fetchPromise = global
      .fetch(base + '/api/routes/duration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit'
      })
      .then(function (res) {
        return res.json().then(function (json) {
          return { status: res.status, json: json };
        });
      });

    var wrapped = await withTimeout(fetchPromise, opt.timeoutMs || 4000);
    if (!wrapped || !wrapped.json || !wrapped.json.ok) return null;
    var json = wrapped.json;
    if (typeof json.durationSeconds !== 'number' || !(json.durationSeconds > 0)) return null;

    var source = json.source === 'google_distance_matrix' ? 'google_distance_matrix' : 'google_routes';
    return {
      estimatedMinutes: Math.max(1, Math.ceil(json.durationSeconds / 60)),
      durationSeconds: Math.round(json.durationSeconds),
      meters: json.distanceMeters != null ? Math.round(json.distanceMeters) : null,
      source: source,
      routeConfidence: 'verified',
      from: labelOf(fromItem),
      to: labelOf(toItem),
      mode: mode || 'transit'
    };
  }

  function tryMapsJsDistanceMatrix(fromItem, toItem, mode) {
    return new Promise(function (resolve) {
      try {
        if (!global.google || !global.google.maps || !global.google.maps.DistanceMatrixService) {
          resolve(null);
          return;
        }
        var fromC = coordsOf(fromItem);
        var toC = coordsOf(toItem);
        var origins = fromC
          ? [new global.google.maps.LatLng(fromC.lat, fromC.lng)]
          : [labelOf(fromItem)];
        var destinations = toC
          ? [new global.google.maps.LatLng(toC.lat, toC.lng)]
          : [labelOf(toItem)];
        var travelMode = global.google.maps.TravelMode.TRANSIT;
        if (mode === 'walk') travelMode = global.google.maps.TravelMode.WALKING;
        if (mode === 'drive') travelMode = global.google.maps.TravelMode.DRIVING;

        var svc = new global.google.maps.DistanceMatrixService();
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          resolve(null);
        }, 4000);

        svc.getDistanceMatrix(
          {
            origins: origins,
            destinations: destinations,
            travelMode: travelMode,
            drivingOptions: undefined
          },
          function (response, status) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
              if (status !== 'OK' || !response || !response.rows || !response.rows[0]) {
                resolve(null);
                return;
              }
              var el = response.rows[0].elements && response.rows[0].elements[0];
              if (!el || el.status !== 'OK' || !el.duration || el.duration.value == null) {
                resolve(null);
                return;
              }
              resolve({
                estimatedMinutes: Math.max(1, Math.ceil(el.duration.value / 60)),
                durationSeconds: Math.round(el.duration.value),
                source: 'google_distance_matrix',
                routeConfidence: 'verified',
                from: labelOf(fromItem),
                to: labelOf(toItem),
                mode: mode || 'transit',
                meters: el.distance && el.distance.value
              });
            } catch (cbErr) {
              resolve(null);
            }
          }
        );
      } catch (e) {
        resolve(null);
      }
    });
  }

  function defaultRouteCallCap(dayCount) {
    var d = Math.max(1, Number(dayCount) || 1);
    // Empirically: ~4–6 adjacent legs/day; 2nd annotate pass is mostly cache.
    // Cap Google calls: min 16, max 56, ≈ 8 × days
    return Math.min(56, Math.max(16, d * 8));
  }

  /**
   * Resolve one adjacent leg duration.
   */
  async function resolveLegDuration(fromItem, toItem, opt) {
    opt = opt || {};
    var mode = normalizeClientMode(opt.mode || 'transit');
    var key = cacheKey(fromItem, toItem, mode);
    if (ROUTE_CACHE[key]) {
      return Object.assign({}, ROUTE_CACHE[key], { cacheHit: true });
    }
    if (ROUTE_INFLIGHT[key]) {
      var shared = await ROUTE_INFLIGHT[key];
      return Object.assign({}, shared, { cacheHit: true });
    }

    var pending = resolveLegDurationUncached(fromItem, toItem, mode, opt, key);
    ROUTE_INFLIGHT[key] = pending;
    try {
      return await pending;
    } finally {
      delete ROUTE_INFLIGHT[key];
    }
  }

  async function resolveLegDurationUncached(fromItem, toItem, mode, opt, key) {
    var result = null;
    var usedGoogle = false;
    var budget = opt.routeBudget;

    var fetcher = opt.fetchRouteDuration || liveFetcher;
    if (typeof fetcher === 'function') {
      var allowInjected = !budget || budget.tryAcquire();
      if (allowInjected) {
        try {
          result = await withTimeout(fetcher(fromItem, toItem, mode), opt.timeoutMs || 4000);
          if (result && typeof result.estimatedMinutes === 'number') {
            result = Object.assign(
              {
                source: result.source || 'injected',
                routeConfidence:
                  result.routeConfidence || confidenceForSource(result.source || 'injected'),
                from: labelOf(fromItem),
                to: labelOf(toItem),
                mode: mode,
                durationSeconds:
                  result.durationSeconds != null
                    ? result.durationSeconds
                    : Math.round(result.estimatedMinutes * 60)
              },
              result
            );
            if (isVerifiedSource(result.source)) {
              usedGoogle = true;
            } else if (budget) {
              budget._refund && budget._refund(1);
            }
          } else {
            result = null;
            if (budget) budget._refund && budget._refund(1);
          }
        } catch (e) {
          result = null;
          if (budget) budget._refund && budget._refund(1);
        }
      }
    }

    if (!result && (!budget || budget.tryAcquire())) {
      result = await tryWorkerRoutes(fromItem, toItem, mode, opt);
      if (result) {
        usedGoogle = true;
      } else if (opt.allowMapsJs !== false) {
        result = await tryMapsJsDistanceMatrix(fromItem, toItem, mode);
        if (result) usedGoogle = true;
      }
    } else if (!result && opt.allowMapsJs !== false && (!budget || budget.tryAcquire())) {
      result = await tryMapsJsDistanceMatrix(fromItem, toItem, mode);
      if (result) usedGoogle = true;
    }

    if (!result) {
      var meters = haversineMeters(coordsOf(fromItem), coordsOf(toItem));
      if (isFinite(meters)) {
        var mins = minutesFromHaversine(meters, mode);
        result = {
          estimatedMinutes: mins,
          durationSeconds: Math.round(mins * 60),
          source: 'geo_haversine',
          routeConfidence: 'estimated',
          from: labelOf(fromItem),
          to: labelOf(toItem),
          mode: mode,
          meters: Math.round(meters)
        };
      }
    }

    if (!result) {
      result = heuristicFallback(fromItem, toItem, mode);
    }

    if (!result.routeConfidence) {
      result.routeConfidence = confidenceForSource(result.source);
    }
    result.cacheHit = false;
    result.usedGoogle = !!usedGoogle;

    ROUTE_CACHE[key] = {
      estimatedMinutes: result.estimatedMinutes,
      durationSeconds: result.durationSeconds,
      source: result.source,
      routeConfidence: result.routeConfidence,
      from: result.from,
      to: result.to,
      mode: result.mode,
      meters: result.meters
    };
    return result;
  }

  function flattenDayItems(day) {
    var items = [];
    (day && day.phases ? day.phases : []).forEach(function (phase) {
      (phase.items || []).forEach(function (it) {
        if (it) items.push(it);
      });
    });
    return items;
  }

  function createRouteBudget(cap) {
    var used = 0;
    var limit = Math.max(0, Number(cap) || 0);
    return {
      limit: limit,
      used: function () {
        return used;
      },
      remaining: function () {
        return Math.max(0, limit - used);
      },
      /** Reserve one Google call slot before await (safe under parallel mapPool). */
      tryAcquire: function () {
        if (used >= limit) return false;
        used += 1;
        return true;
      },
      _refund: function (n) {
        used = Math.max(0, used - (n || 1));
      },
      consume: function (n) {
        used += n || 1;
      }
    };
  }

  async function mapPool(items, concurrency, mapper) {
    var results = new Array(items.length);
    var idx = 0;
    var workers = [];
    concurrency = Math.max(1, Math.min(concurrency || 3, 4));

    async function worker() {
      while (idx < items.length) {
        var i = idx;
        idx += 1;
        results[i] = await mapper(items[i], i);
      }
    }

    var w;
    for (w = 0; w < concurrency; w++) workers.push(worker());
    await Promise.all(workers);
    return results;
  }

  /**
   * Annotate only adjacent legs across the itinerary.
   * Writes item.__routeToNext and returns cost stats.
   */
  async function annotateAdjacentLegs(hidden, opt) {
    opt = opt || {};
    var mode = normalizeClientMode(opt.mode || 'transit');
    var dayCount = ((hidden && hidden.days) || []).length || 1;
    var cap =
      typeof opt.routeCallCap === 'number' ? opt.routeCallCap : defaultRouteCallCap(dayCount);
    var budget = createRouteBudget(cap);
    var concurrency =
      typeof opt.concurrency === 'number' ? Math.max(1, Math.min(opt.concurrency, 4)) : 3;

    var stats = {
      googleRouteCalls: 0,
      routesCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      fallbackCalls: 0,
      routeMatrixElements: 0,
      routeCallCap: cap,
      concurrency: concurrency,
      legs: []
    };

    var pairs = [];
    var days = (hidden && hidden.days) || [];
    var d;
    for (d = 0; d < days.length; d++) {
      var items = flattenDayItems(days[d]);
      var i;
      for (i = 0; i < items.length - 1; i++) {
        var a = items[i];
        var b = items[i + 1];
        if (!labelOf(a) || !labelOf(b)) continue;
        pairs.push({
          day: days[d].dayNum || d + 1,
          a: a,
          b: b
        });
      }
    }

    var t0 =
      typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

    var legs = await mapPool(pairs, concurrency, async function (pair) {
      var leg = await resolveLegDuration(pair.a, pair.b, {
        mode: mode,
        fetchRouteDuration: opt.fetchRouteDuration,
        allowMapsJs: opt.allowMapsJs,
        allowWorkerRoutes: opt.allowWorkerRoutes,
        apiBase: opt.apiBase,
        timeoutMs: opt.timeoutMs || 4000,
        departureTimeIso: opt.departureTimeIso,
        routeBudget: budget
      });
      return { pair: pair, leg: leg };
    });

    var t1 =
      typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    stats.resolveLatencyMs = Math.round(t1 - t0);

    legs.forEach(function (entry) {
      var pair = entry.pair;
      var leg = entry.leg;
      if (leg.cacheHit) stats.cacheHits += 1;
      else {
        stats.cacheMisses += 1;
        if (isVerifiedSource(leg.source) || leg.usedGoogle) {
          stats.googleRouteCalls += 1;
          stats.routesCalls += 1;
        } else {
          stats.fallbackCalls += 1;
          stats.routesCalls += 1;
        }
      }
      pair.a.__routeToNext = {
        to: labelOf(pair.b),
        estimatedMinutes: leg.estimatedMinutes,
        durationSeconds: leg.durationSeconds,
        source: leg.source,
        routeConfidence: leg.routeConfidence || confidenceForSource(leg.source),
        meters: leg.meters,
        mode: mode
      };
      stats.legs.push({
        day: pair.day,
        from: labelOf(pair.a),
        to: labelOf(pair.b),
        estimatedMinutes: leg.estimatedMinutes,
        source: leg.source,
        routeConfidence: leg.routeConfidence || confidenceForSource(leg.source),
        cacheHit: !!leg.cacheHit
      });
    });

    hidden.meta = hidden.meta || {};
    hidden.meta.routeDuration = {
      version: 2,
      stats: stats,
      mode: mode
    };
    return { hidden: hidden, stats: stats };
  }

  var api = {
    cacheKey: cacheKey,
    labelCacheKey: labelCacheKey,
    clearRouteCache: clearRouteCache,
    setLiveFetcher: setLiveFetcher,
    haversineMeters: haversineMeters,
    resolveLegDuration: resolveLegDuration,
    annotateAdjacentLegs: annotateAdjacentLegs,
    defaultRouteCallCap: defaultRouteCallCap,
    confidenceForSource: confidenceForSource,
    roundCoord: roundCoord,
    SPEEDS_KMH: SPEEDS_KMH
  };

  global.SOARVIBE_ROUTE_DURATION = api;
})(typeof window !== 'undefined' ? window : globalThis);
