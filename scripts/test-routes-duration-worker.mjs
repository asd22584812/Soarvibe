/**
 * Worker routes-duration unit tests (mocked fetch — no live Google calls).
 * Run: node scripts/test-routes-duration-worker.mjs
 */
import assert from 'assert';
import {
  normalizeTravelMode,
  validateWaypoint,
  parseDurationSeconds,
  roundCoord,
  resolveGoogleDuration,
  handleRoutesDuration
} from '../worker/src/routes-duration.js';

let passed = 0;
let failed = 0;

function ok(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  OK  ' + msg);
  } else {
    failed += 1;
    console.error('  FAIL  ' + msg);
  }
}

console.log('\n=== validate / normalize ===');
ok(normalizeTravelMode('TRANSIT') === 'TRANSIT', 'mode TRANSIT');
ok(normalizeTravelMode('walk') === 'WALK', 'mode walk→WALK');
ok(normalizeTravelMode('teleport') === null, 'reject unsupported mode');
ok(roundCoord(25.0339641) === roundCoord(25.0339640), 'coord round collapses noise');
ok(validateWaypoint({ placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' }, 'o').ok, 'placeId ok');
ok(!validateWaypoint({ lat: 999, lng: 0 }, 'o').ok, 'reject bad lat');
ok(parseDurationSeconds('2280s') === 2280, 'parse duration string');

console.log('\n=== resolveGoogleDuration: Routes success ===');
const origFetch = globalThis.fetch;
globalThis.fetch = async function (url, init) {
  const u = String(url);
  if (u.includes('routes.googleapis.com')) {
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ routes: [{ duration: '2280s', distanceMeters: 9400 }] }),
      json: async () => ({ routes: [{ duration: '2280s', distanceMeters: 9400 }] })
    };
  }
  throw new Error('unexpected ' + u);
};
{
  const r = await resolveGoogleDuration(
    'AIzaSyTESTKEY00000000000000000000000',
    { placeId: 'ChIJaaa', lat: 43.06, lng: 141.35 },
    { placeId: 'ChIJbbb', lat: 43.07, lng: 141.36 },
    'TRANSIT',
    { timeoutMs: 2000 }
  );
  ok(r.ok && r.durationSeconds === 2280, 'routes ok duration');
  ok(r.source === 'google_routes', 'source google_routes');
  ok(r.routeConfidence === 'verified', 'verified confidence');
  ok(r.distanceMeters === 9400, 'distance meters');
}

console.log('\n=== resolveGoogleDuration: Routes fail → Distance Matrix ===');
globalThis.fetch = async function (url) {
  const u = String(url);
  if (u.includes('routes.googleapis.com')) {
    return {
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { message: 'PERMISSION_DENIED' } }),
      json: async () => ({ error: { message: 'PERMISSION_DENIED' } })
    };
  }
  if (u.includes('distancematrix')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 'OK',
        rows: [{ elements: [{ status: 'OK', duration: { value: 1500 }, distance: { value: 5000 } }] }]
      })
    };
  }
  throw new Error('unexpected ' + u);
};
{
  const r = await resolveGoogleDuration(
    'AIzaSyTESTKEY00000000000000000000000',
    { lat: 43.06, lng: 141.35 },
    { lat: 43.07, lng: 141.36 },
    'WALK',
    { timeoutMs: 2000 }
  );
  ok(r.ok && r.durationSeconds === 1500, 'matrix fallback duration');
  ok(r.source === 'google_distance_matrix', 'source distance_matrix');
}

console.log('\n=== handleRoutesDuration HTTP handler ===');
function jsonResponse(body, status) {
  return { status: status || 200, body };
}
{
  const req = {
    text: async () =>
      JSON.stringify({
        origin: { lat: 43.068, lng: 141.35 },
        destination: { lat: 43.055, lng: 141.353 },
        travelMode: 'TRANSIT',
        apiKey: 'leak-attempt'
      })
  };
  const res = await handleRoutesDuration(
    req,
    { GOOGLE_MAPS_SERVER_KEY: 'AIzaSyTESTKEY00000000000000000000000' },
    { origin: 'https://soarvibe-885c8.web.app' },
    jsonResponse
  );
  ok(res.status === 400 && res.body.error === 'forbidden_fields', 'reject client apiKey');
}
{
  const req = {
    text: async () =>
      JSON.stringify({
        origin: { lat: 43.068, lng: 141.35 },
        destination: { lat: 43.055, lng: 141.353 },
        travelMode: 'FLY'
      })
  };
  const res = await handleRoutesDuration(
    req,
    { GOOGLE_MAPS_API_KEY: 'AIzaSyTESTKEY00000000000000000000000' },
    { origin: 'https://soarvibe-885c8.web.app' },
    jsonResponse
  );
  ok(res.status === 400 && res.body.error === 'unsupported_travelMode', 'reject FLY');
}
{
  const big = 'x'.repeat(5000);
  const req = { text: async () => '{"a":"' + big + '"}' };
  const res = await handleRoutesDuration(
    req,
    { GOOGLE_MAPS_API_KEY: 'AIzaSyTESTKEY00000000000000000000000' },
    { origin: 'https://soarvibe-885c8.web.app' },
    jsonResponse
  );
  ok(res.status === 413, 'payload too large');
}
{
  globalThis.fetch = async function (url) {
    if (String(url).includes('routes.googleapis.com')) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ routes: [{ duration: '900s', distanceMeters: 1200 }] })
      };
    }
    throw new Error('unexpected');
  };
  const req = {
    text: async () =>
      JSON.stringify({
        origin: { placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' },
        destination: { lat: 43.06, lng: 141.35 },
        travelMode: 'DRIVE'
      })
  };
  const res = await handleRoutesDuration(
    req,
    { GOOGLE_MAPS_SERVER_KEY: 'AIzaSyTESTKEY00000000000000000000000' },
    { origin: 'https://soarvibe-885c8.web.app' },
    jsonResponse
  );
  ok(res.status === 200 && res.body.ok && res.body.durationSeconds === 900, 'handler success');
  ok(res.body.routeConfidence === 'verified', 'handler confidence');
  ok(!JSON.stringify(res.body).includes('AIza'), 'never leak key');
}

globalThis.fetch = origFetch;
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
