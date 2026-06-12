/**
 * SOARVIBE API Proxy — Cloudflare Worker（免費方案）
 * 支援多把 Gemini 金鑰自動輪替 + Google Maps 金鑰發放
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-SOARVIBE-Token',
  'Access-Control-Max-Age': '86400'
};

function parseAllowedOrigins(env) {
  var raw = String(env.ALLOWED_ORIGINS || 'https://asd22584812.github.io');
  return raw.split(',').map(function (o) { return o.trim(); }).filter(Boolean);
}

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  var allowed = parseAllowedOrigins(env);
  return allowed.some(function (entry) {
    if (entry === origin) return true;
    if (entry.endsWith('*')) {
      return origin.startsWith(entry.slice(0, -1));
    }
    return false;
  });
}

function corsHeaders(origin, env) {
  var headers = Object.assign({}, CORS_HEADERS);
  if (origin && isAllowedOrigin(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

function jsonResponse(body, status, origin, env) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin, env))
  });
}

function isValidGeminiKey(key) {
  var k = String(key || '').trim();
  return /^AIza[0-9A-Za-z_-]{30,}$/.test(k) || /^AQ\.[0-9A-Za-z_-]{20,}$/.test(k);
}

function parseGeminiKeys(env) {
  var combined = [
    String(env.GEMINI_API_KEYS || ''),
    String(env.GEMINI_API_KEY || '')
  ].join('\n');
  var seen = {};
  return combined
    .split(/[\n,]+/)
    .map(function (k) { return k.trim(); })
    .filter(function (k) {
      if (!k || !isValidGeminiKey(k) || seen[k]) return false;
      seen[k] = true;
      return true;
    });
}

function extractGeminiText(result) {
  try {
    var text = result.candidates
      && result.candidates[0]
      && result.candidates[0].content
      && result.candidates[0].content.parts
      && result.candidates[0].content.parts[0]
      && result.candidates[0].content.parts[0].text;
    return String(text || '').trim();
  } catch (e) {
    return '';
  }
}

function getErrorMessage(result) {
  return String((result && result.error && result.error.message) || '');
}

function isBillingDepleted(result) {
  return /prepayment credits are depleted|depleted.*billing|billing.*depleted/i.test(getErrorMessage(result));
}

function isRpmThrottle(result) {
  var msg = getErrorMessage(result);
  if (/limit:\s*0/i.test(msg)) return false;
  if (isBillingDepleted(result)) return false;
  return /Please retry in [\d.]+s/i.test(msg)
    || (/free_tier/i.test(msg) && /limit:\s*20/i.test(msg));
}

function isModelOnlyQuota(result) {
  return /limit:\s*0/i.test(getErrorMessage(result));
}

function isKeyLevelQuota(status, result) {
  if (status !== 429) return false;
  if (isBillingDepleted(result)) return true;
  var msg = getErrorMessage(result);
  if (/free_tier/i.test(msg)) return false;
  return /quota exceeded|RESOURCE_EXHAUSTED|exhausted/i.test(msg);
}

function isModelNotFound(status, result) {
  return status === 404
    || /not found for API version|is not supported for generateContent/i.test(getErrorMessage(result));
}

function authorizeRequest(request, env) {
  var origin = request.headers.get('Origin') || '';
  var referer = request.headers.get('Referer') || '';

  if (origin && isAllowedOrigin(origin, env)) {
    return { ok: true, origin: origin };
  }

  if (!origin && referer) {
    try {
      var refOrigin = new URL(referer).origin;
      if (isAllowedOrigin(refOrigin, env)) {
        return { ok: true, origin: refOrigin };
      }
    } catch (e) { /* ignore */ }
  }

  var token = request.headers.get('X-SOARVIBE-Token') || '';
  var secret = String(env.WORKER_AUTH_SECRET || '').trim();
  if (secret && token === secret) {
    return { ok: true, origin: origin || '*' };
  }

  return { ok: false, origin: origin };
}

async function callGeminiUpstream(prompt, modelId, apiKey) {
  var geminiUrl = GEMINI_BASE + modelId + ':generateContent';
  var upstream;
  try {
    upstream = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      })
    });
  } catch (e) {
    return { ok: false, status: 502, result: { error: { message: String(e.message || e) } }, network: true };
  }

  var result = {};
  try {
    result = await upstream.json();
  } catch (e) {
    return { ok: false, status: 502, result: { error: { message: 'invalid_json' } } };
  }

  if (!upstream.ok) {
    return { ok: false, status: upstream.status, result: result };
  }

  var text = extractGeminiText(result);
  if (!text) {
    return { ok: false, status: 502, result: result, empty: true };
  }

  return { ok: true, status: 200, result: result, text: text };
}

function pickRoundRobinStartIndex(totalKeys) {
  if (totalKeys <= 1) return 0;
  return Math.abs(Math.floor(Date.now() / 1000)) % totalKeys;
}

async function handleGemini(request, env, auth) {
  var keys = parseGeminiKeys(env);
  if (!keys.length) {
    return jsonResponse({
      error: 'server_misconfigured',
      message: 'GEMINI_API_KEYS not set'
    }, 503, auth.origin, env);
  }

  var body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400, auth.origin, env);
  }

  var prompt = String(body.prompt || '').trim();
  if (!prompt) {
    return jsonResponse({ error: 'missing_prompt' }, 400, auth.origin, env);
  }
  if (prompt.length > 120000) {
    return jsonResponse({ error: 'prompt_too_long' }, 413, auth.origin, env);
  }

  var modelId = String(body.model || DEFAULT_MODEL).trim();
  if (!/^gemini-[a-z0-9.-]+$/i.test(modelId)) {
    return jsonResponse({ error: 'invalid_model' }, 400, auth.origin, env);
  }

  var startIdx = pickRoundRobinStartIndex(keys.length);
  var lastFailure = null;
  var keysTried = 0;

  for (var attempt = 0; attempt < keys.length; attempt++) {
    var keyIndex = (startIdx + attempt) % keys.length;
    var apiKey = keys[keyIndex];
    keysTried++;
    var upstream = await callGeminiUpstream(prompt, modelId, apiKey);

    if (upstream.ok) {
      return jsonResponse({
        text: upstream.text,
        model: modelId,
        keySlot: keyIndex + 1,
        keyTotal: keys.length
      }, 200, auth.origin, env);
    }

    lastFailure = upstream;
    var status = upstream.status;
    var result = upstream.result || {};

    if (status === 401 || status === 403) {
      continue;
    }
    if (status === 429) {
      if (isRpmThrottle(result)) {
        continue;
      }
      if (isModelOnlyQuota(result)) {
        break;
      }
      if (isKeyLevelQuota(status, result) || isBillingDepleted(result)) {
        continue;
      }
      continue;
    }
    if (isModelNotFound(status, result)) {
      break;
    }
    if (status === 503 || status === 500 || status === 502 || status === 529) {
      continue;
    }
    break;
  }

  if (lastFailure && lastFailure.status === 429) {
    return jsonResponse({
      error: 'all_keys_exhausted',
      message: 'All Gemini keys exhausted',
      keysTried: keysTried,
      keyTotal: keys.length,
      details: lastFailure.result
    }, 429, auth.origin, env);
  }

  return jsonResponse({
    error: 'gemini_error',
    status: lastFailure ? lastFailure.status : 502,
    keysTried: keysTried,
    keyTotal: keys.length,
    details: lastFailure ? lastFailure.result : null
  }, lastFailure && lastFailure.status ? lastFailure.status : 502, auth.origin, env);
}

async function handleMapsKey(env, auth) {
  var mapsKey = String(env.GOOGLE_MAPS_API_KEY || '').trim();
  if (!mapsKey || mapsKey.indexOf('AIzaSy') !== 0) {
    return jsonResponse({ error: 'maps_not_configured' }, 503, auth.origin, env);
  }
  return jsonResponse({ key: mapsKey }, 200, auth.origin, env);
}

async function handleCoverImage(request, env, auth) {
  var url = new URL(request.url);
  var imageUrl = String(url.searchParams.get('url') || '').trim();
  if (!/^https:\/\/images\.unsplash\.com\//i.test(imageUrl)) {
    return jsonResponse({ error: 'invalid_cover_url' }, 400, auth.origin, env);
  }
  try {
    var upstream = await fetch(imageUrl, {
      headers: { 'Accept': 'image/jpeg,image/png,image/*' }
    });
    if (!upstream.ok) {
      return jsonResponse({ error: 'cover_fetch_failed', status: upstream.status }, 502, auth.origin, env);
    }
    var headers = new Headers(upstream.headers);
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=86400');
    var cors = corsHeaders(auth.origin, env);
    Object.keys(cors).forEach(function (key) {
      headers.set(key, cors[key]);
    });
    return new Response(upstream.body, { status: 200, headers: headers });
  } catch (e) {
    return jsonResponse({ error: 'cover_fetch_error' }, 502, auth.origin, env);
  }
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var origin = request.headers.get('Origin') || '';
    var geminiKeys = parseGeminiKeys(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({
        ok: true,
        service: 'soarvibe-api',
        geminiKeyCount: geminiKeys.length,
        geminiRotation: geminiKeys.length > 1,
        maps: !!env.GOOGLE_MAPS_API_KEY
      }, 200, origin, env);
    }

    var auth = authorizeRequest(request, env);
    if (!auth.ok) {
      return jsonResponse({ error: 'forbidden', message: 'Origin not allowed' }, 403, origin, env);
    }

    if (url.pathname === '/api/gemini' && request.method === 'POST') {
      return handleGemini(request, env, auth);
    }

    if (url.pathname === '/api/maps-key' && request.method === 'GET') {
      return handleMapsKey(env, auth);
    }

    if (url.pathname === '/api/cover-image' && request.method === 'GET') {
      return handleCoverImage(request, env, auth);
    }

    return jsonResponse({ error: 'not_found' }, 404, auth.origin, env);
  }
};
