/**
 * Shared Gemini client — text + vision, key rotation.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const VISION_MODEL = 'gemini-2.5-flash';

function isValidGeminiKey(key) {
  var k = String(key || '').trim();
  return /^AIza[0-9A-Za-z_-]{30,}$/.test(k) || /^AQ\.[0-9A-Za-z_-]{20,}$/.test(k);
}

export function parseGeminiKeys(env) {
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
    var parts = result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts;
    if (!parts || !parts.length) return '';
    return parts.map(function (p) { return String(p.text || ''); }).join('').trim();
  } catch (e) {
    return '';
  }
}

function getErrorMessage(result) {
  return String((result && result.error && result.error.message) || '');
}

function isRpmThrottle(result) {
  var msg = getErrorMessage(result);
  if (/limit:\s*0/i.test(msg)) return false;
  if (/prepayment credits are depleted|depleted.*billing/i.test(msg)) return false;
  return /Please retry in [\d.]+s/i.test(msg)
    || (/free_tier/i.test(msg) && /limit:\s*20/i.test(msg));
}

function isKeyLevelQuota(status, result) {
  if (status !== 429) return false;
  var msg = getErrorMessage(result);
  if (/free_tier/i.test(msg)) return false;
  return /quota exceeded|RESOURCE_EXHAUSTED|exhausted/i.test(msg);
}

function pickRoundRobinStartIndex(totalKeys) {
  if (totalKeys <= 1) return 0;
  return Math.abs(Math.floor(Date.now() / 1000)) % totalKeys;
}

function extractPartialStringArray(text, key) {
  var re = new RegExp('"' + key + '"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)', 'm');
  var m = re.exec(String(text || ''));
  if (!m) return [];
  return (m[1].match(/"([^"\\]|\\.)*"/g) || []).map(function (s) {
    return s.replace(/^"|"$/g, '').replace(/\\"/g, '"');
  });
}

export function repairTruncatedJSON(text) {
  var s = String(text || '').trim();
  var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  var start = s.indexOf('{');
  if (start < 0) return null;
  s = s.slice(start);

  function closeJson(chunk) {
    var out = chunk.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '');
    out = out.replace(/,\s*"[^"]*"\s*:\s*$/, '');
    out = out.replace(/,\s*$/, '');
    var stack = [];
    var inString = false;
    var escape = false;
    for (var i = 0; i < out.length; i++) {
      var c = out[i];
      if (inString) {
        if (escape) escape = false;
        else if (c === '\\') escape = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') {
        if (stack.length && stack[stack.length - 1] === c) stack.pop();
      }
    }
    for (var j = stack.length - 1; j >= 0; j--) {
      out += stack[j];
    }
    return out;
  }

  for (var tryEnd = s.length; tryEnd > 200; tryEnd -= 40) {
    try {
      return JSON.parse(closeJson(s.slice(0, tryEnd)));
    } catch (e) { /* retry shorter */ }
  }
  return null;
}

function salvageReviewJSON(text) {
  var s = String(text || '');
  var passMatch = /"pass"\s*:\s*(true|false)/i.exec(s);
  var scoreMatch = /"score"\s*:\s*(\d+)/.exec(s);
  var tierMatch = /"priorityTier"\s*:\s*(\d)/.exec(s);
  var matched = extractPartialStringArray(s, 'matchedElements');
  var descMatch = /"visibleDescription"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(s);
  return {
    pass: passMatch ? passMatch[1].toLowerCase() === 'true' : false,
    score: scoreMatch ? parseInt(scoreMatch[1], 10) : 0,
    matchedElements: matched,
    priorityTier: tierMatch ? parseInt(tierMatch[1], 10) : 3,
    visibleDescription: descMatch ? descMatch[1] : '',
    supportsBody: true,
    photoType: 'salvaged'
  };
}

function parseJSONResponse(text, salvage) {
  var s = String(text || '').trim();
  var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch (e1) {
    var start = s.indexOf('{');
    var end = s.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch (e2) { /* fall through */ }
    }
    if (salvage) return salvageReviewJSON(s);
    throw e1;
  }
}

function bytesToBase64(bytes) {
  var binary = '';
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function fetchImageInline(imageUrl) {
  var res = await fetch(imageUrl, {
    redirect: 'follow',
    headers: {
      Accept: 'image/jpeg,image/png,image/webp,image/*,*/*',
      Referer: 'https://www.google.com/',
      'User-Agent': 'Mozilla/5.0 (compatible; SoarVibe-Editorial/1.0)'
    }
  });
  if (!res.ok) return null;
  var mimeType = res.headers.get('Content-Type') || 'image/jpeg';
  if (mimeType.indexOf(';') !== -1) mimeType = mimeType.split(';')[0].trim();
  var buf = await res.arrayBuffer();
  if (buf.byteLength > 4 * 1024 * 1024) return null;
  return { mimeType: mimeType, data: bytesToBase64(new Uint8Array(buf)) };
}

export async function callGeminiRaw(body, modelId, apiKey) {
  var geminiUrl = GEMINI_BASE + modelId + ':generateContent';
  var upstream;
  try {
    upstream = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body)
    });
  } catch (e) {
    return { ok: false, status: 502, result: { error: { message: String(e.message || e) } } };
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

export async function callGeminiJSON(prompt, env, options) {
  var keys = parseGeminiKeys(env);
  if (!keys.length) {
    return { ok: false, error: 'no_gemini_keys' };
  }

  var modelId = (options && options.model) || DEFAULT_MODEL;
  var startIdx = pickRoundRobinStartIndex(keys.length);
  var lastFailure = null;

  for (var attempt = 0; attempt < keys.length; attempt++) {
    var keyIndex = (startIdx + attempt) % keys.length;
    var body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: (options && options.temperature) != null ? options.temperature : 0.4,
        maxOutputTokens: (options && options.maxOutputTokens) || 8192,
        responseMimeType: 'application/json'
      }
    };
    var upstream = await callGeminiRaw(body, modelId, keys[keyIndex]);
    if (upstream.ok) {
      try {
        var parsed = parseJSONResponse(upstream.text, false);
        return { ok: true, data: parsed, model: modelId, keySlot: keyIndex + 1 };
      } catch (e) {
        var repaired = repairTruncatedJSON(upstream.text);
        if (repaired) {
          return { ok: true, data: repaired, model: modelId, keySlot: keyIndex + 1, salvaged: true };
        }
        return { ok: false, error: 'invalid_json_response', raw: upstream.text };
      }
    }
    lastFailure = upstream;
    if (upstream.status === 401 || upstream.status === 403) continue;
    if (upstream.status === 429) {
      if (isRpmThrottle(upstream.result)) continue;
      if (isKeyLevelQuota(upstream.status, upstream.result)) continue;
      continue;
    }
    break;
  }

  return {
    ok: false,
    error: 'gemini_failed',
    details: lastFailure ? lastFailure.result : null
  };
}

export async function callGeminiText(prompt, env, options) {
  var keys = parseGeminiKeys(env);
  if (!keys.length) {
    return { ok: false, error: 'no_gemini_keys' };
  }

  var modelId = (options && options.model) || DEFAULT_MODEL;
  var startIdx = pickRoundRobinStartIndex(keys.length);
  var lastFailure = null;

  for (var attempt = 0; attempt < keys.length; attempt++) {
    var keyIndex = (startIdx + attempt) % keys.length;
    var body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: (options && options.temperature) != null ? options.temperature : 0.4,
        maxOutputTokens: (options && options.maxOutputTokens) || 1024
      }
    };
    var upstream = await callGeminiRaw(body, modelId, keys[keyIndex]);
    if (upstream.ok && upstream.text) {
      return { ok: true, text: upstream.text, model: modelId, keySlot: keyIndex + 1 };
    }
    lastFailure = upstream;
    if (upstream.status === 401 || upstream.status === 403) continue;
    if (upstream.status === 429) {
      var retryMsg = getErrorMessage(upstream.result);
      var waitMatch = /retry in ([\d.]+)s/i.exec(retryMsg);
      if (waitMatch && attempt < keys.length - 1) {
        await new Promise(function (r) { setTimeout(r, Math.min(60000, Math.ceil(parseFloat(waitMatch[1], 10) * 1000) + 500)); });
        continue;
      }
      continue;
    }
    break;
  }

  return {
    ok: false,
    error: 'gemini_failed',
    details: lastFailure ? lastFailure.result : null
  };
}

export async function callGeminiVisionJSON(prompt, imageUrl, env, options) {
  var keys = parseGeminiKeys(env);
  if (!keys.length) {
    return { ok: false, error: 'no_gemini_keys' };
  }

  var inline = await fetchImageInline(imageUrl);
  if (!inline) {
    return { ok: false, error: 'image_fetch_failed', imageUrl: imageUrl };
  }

  var modelId = (options && options.model) || VISION_MODEL;
  var startIdx = pickRoundRobinStartIndex(keys.length);
  var lastFailure = null;

  for (var attempt = 0; attempt < keys.length; attempt++) {
    var keyIndex = (startIdx + attempt) % keys.length;
    var body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: inline.mimeType, data: inline.data } }
        ]
      }],
      generationConfig: {
        temperature: (options && options.temperature) != null ? options.temperature : 0.2,
        maxOutputTokens: (options && options.maxOutputTokens) || 4096,
        responseMimeType: 'application/json'
      }
    };
    var upstream = await callGeminiRaw(body, modelId, keys[keyIndex]);
    if (upstream.ok) {
      try {
        var parsed = parseJSONResponse(upstream.text, true);
        return { ok: true, data: parsed, model: modelId, keySlot: keyIndex + 1 };
      } catch (e) {
        return { ok: false, error: 'invalid_json_response', raw: upstream.text };
      }
    }
    lastFailure = upstream;
    if (upstream.status === 401 || upstream.status === 403) continue;
    if (upstream.status === 429) {
      if (isRpmThrottle(upstream.result)) continue;
      if (isKeyLevelQuota(upstream.status, upstream.result)) continue;
      continue;
    }
    break;
  }

  return {
    ok: false,
    error: 'gemini_vision_failed',
    details: lastFailure ? lastFailure.result : null
  };
}
