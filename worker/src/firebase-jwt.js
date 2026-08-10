/**
 * Verify Firebase Auth ID tokens (RS256) via Google Secure Token JWKS.
 * No Admin SDK / no npm deps — Web Crypto only.
 */

var JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
var jwksCache = { keys: null, fetchedAt: 0 };
var JWKS_TTL_MS = 60 * 60 * 1000;

function b64urlToUint8Array(s) {
  var str = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  var pad = (4 - (str.length % 4)) % 4;
  if (pad) str += '===='.slice(0, pad);
  var bin = atob(str);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJwtJson(part) {
  var bytes = b64urlToUint8Array(part);
  var text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

async function fetchJwks() {
  var now = Date.now();
  if (jwksCache.keys && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  var res = await fetch(JWKS_URL);
  if (!res.ok) {
    throw new Error('jwks_fetch_failed');
  }
  var body = await res.json();
  jwksCache = { keys: body.keys || [], fetchedAt: now };
  return jwksCache.keys;
}

function findJwk(keys, kid) {
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] && keys[i].kid === kid) return keys[i];
  }
  return null;
}

async function importRsaKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

/**
 * @param {string} idToken
 * @param {string} projectId Firebase project id (aud / iss)
 * @returns {Promise<{ uid: string, email?: string, claims: object }>}
 */
export async function verifyFirebaseIdToken(idToken, projectId) {
  var token = String(idToken || '').trim();
  var pid = String(projectId || '').trim();
  if (!token || !pid) {
    var err = new Error('missing_token_or_project');
    err.code = 'unauthorized';
    throw err;
  }

  var parts = token.split('.');
  if (parts.length !== 3) {
    var errFmt = new Error('invalid_token_format');
    errFmt.code = 'unauthorized';
    throw errFmt;
  }

  var header;
  var payload;
  try {
    header = decodeJwtJson(parts[0]);
    payload = decodeJwtJson(parts[1]);
  } catch (e) {
    var errParse = new Error('invalid_token_json');
    errParse.code = 'unauthorized';
    throw errParse;
  }

  if (header.alg !== 'RS256' || !header.kid) {
    var errAlg = new Error('unsupported_alg');
    errAlg.code = 'unauthorized';
    throw errAlg;
  }

  var nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < nowSec) {
    var errExp = new Error('token_expired');
    errExp.code = 'unauthorized';
    throw errExp;
  }
  if (typeof payload.iat === 'number' && payload.iat > nowSec + 60) {
    var errIat = new Error('token_iat_future');
    errIat.code = 'unauthorized';
    throw errIat;
  }
  if (payload.aud !== pid) {
    var errAud = new Error('token_aud_mismatch');
    errAud.code = 'unauthorized';
    throw errAud;
  }
  if (payload.iss !== 'https://securetoken.google.com/' + pid) {
    var errIss = new Error('token_iss_mismatch');
    errIss.code = 'unauthorized';
    throw errIss;
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    var errSub = new Error('token_missing_sub');
    errSub.code = 'unauthorized';
    throw errSub;
  }

  var keys = await fetchJwks();
  var jwk = findJwk(keys, header.kid);
  if (!jwk) {
    // Force refresh once if kid missed (rotation)
    jwksCache.fetchedAt = 0;
    keys = await fetchJwks();
    jwk = findJwk(keys, header.kid);
  }
  if (!jwk) {
    var errKid = new Error('unknown_kid');
    errKid.code = 'unauthorized';
    throw errKid;
  }

  var key = await importRsaKey(jwk);
  var data = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  var sig = b64urlToUint8Array(parts[2]);
  var ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
  if (!ok) {
    var errSig = new Error('invalid_signature');
    errSig.code = 'unauthorized';
    throw errSig;
  }

  return {
    uid: payload.sub,
    email: payload.email || '',
    claims: payload
  };
}

/** Extract Bearer token from Authorization header. */
export function extractBearerToken(request) {
  var h = request.headers.get('Authorization') || '';
  var m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : '';
}

/** Test helpers (pure). */
export const __test = {
  b64urlToUint8Array: b64urlToUint8Array,
  decodeJwtJson: decodeJwtJson
};
