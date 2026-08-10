/**
 * City Shares media — Cloudflare R2 upload / delete / serve.
 * Path: city-shares/{uid}/{postId}/{imageId}.webp|jpg|png
 * Public Access stays Disabled — reads go through Worker GET.
 */

import { verifyFirebaseIdToken, extractBearerToken } from './firebase-jwt.js';
import {
  assertAndConsumeUploadQuota,
  assertPostClaimOrAuthor,
  fetchPostAuthorId,
  clientIp,
  DAILY_UPLOAD_MAX,
  DAILY_BYTES_MAX,
  BURST_UID_MAX
} from './city-shares-limits.js';

export const MEDIA_MAX_PER_POST = 3;
export const MEDIA_MAX_BYTES = 2 * 1024 * 1024;
export const MEDIA_PREFIX = 'city-shares';
/** Browser / CDN cache for GET — conservative so deleted objects fade within ~1h. */
export const MEDIA_CACHE_CONTROL = 'public, max-age=3600';

export function detectImageMagic(bytes) {
  if (!bytes || bytes.length < 12) return null;
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: 'image/jpeg', ext: 'jpg' };
  }
  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { type: 'image/png', ext: 'png' };
  }
  // WEBP RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { type: 'image/webp', ext: 'webp' };
  }
  return null;
}

/** @deprecated use detectImageMagic */
export function isWebpMagic(bytes) {
  var d = detectImageMagic(bytes);
  return !!(d && d.ext === 'webp');
}

export function isSafeId(id, maxLen) {
  var s = String(id || '');
  if (!s || s.length > (maxLen || 128)) return false;
  if (s.indexOf('..') !== -1) return false;
  return /^[A-Za-z0-9_-]+$/.test(s);
}

export function buildObjectKey(uid, postId, imageId, ext) {
  var e = String(ext || 'webp').toLowerCase();
  if (e !== 'webp' && e !== 'jpg' && e !== 'png') e = 'webp';
  return MEDIA_PREFIX + '/' + uid + '/' + postId + '/' + imageId + '.' + e;
}

export function parseObjectKey(key) {
  var parts = String(key || '').split('/');
  if (parts.length !== 4) return null;
  if (parts[0] !== MEDIA_PREFIX) return null;
  var file = parts[3];
  var m = /^([A-Za-z0-9_-]+)\.(webp|jpg|png)$/i.exec(file);
  if (!m) return null;
  if (!isSafeId(parts[1], 128) || !isSafeId(parts[2], 128)) return null;
  return {
    uid: parts[1],
    postId: parts[2],
    imageId: m[1],
    ext: m[2].toLowerCase()
  };
}

export function postPrefix(uid, postId) {
  return MEDIA_PREFIX + '/' + uid + '/' + postId + '/';
}

function isImageObjectKey(key) {
  return /\.(webp|jpg|png)$/i.test(String(key || ''));
}

/**
 * List image objects with uploaded timestamps for race trimming.
 */
export async function listPostImageObjects(bucket, uid, postId) {
  var prefix = postPrefix(uid, postId);
  var items = [];
  var cursor;
  do {
    var listed = await bucket.list({
      prefix: prefix,
      cursor: cursor,
      limit: 100,
      include: ['customMetadata', 'httpMetadata']
    });
    var objects = listed.objects || [];
    for (var i = 0; i < objects.length; i++) {
      var obj = objects[i];
      if (!obj || !obj.key || !isImageObjectKey(obj.key)) continue;
      var metaAt = 0;
      try {
        metaAt = parseInt(
          (obj.customMetadata && obj.customMetadata.uploadedAt) || '0',
          10
        );
      } catch (e) {
        metaAt = 0;
      }
      var uploadedMs = metaAt || (obj.uploaded ? Date.parse(obj.uploaded) : 0) || 0;
      items.push({
        key: obj.key,
        uploadedAt: uploadedMs,
        size: obj.size || 0
      });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return items;
}

export async function listPostImageKeys(bucket, uid, postId) {
  var items = await listPostImageObjects(bucket, uid, postId);
  return items.map(function (x) {
    return x.key;
  });
}

/**
 * After concurrent puts: keep the oldest MEDIA_MAX_PER_POST images, delete the rest.
 * Returns ok=true only if justPutKey is among the keepers.
 * Guarantees final object count <= MEDIA_MAX_PER_POST.
 */
export async function enforceMaxAfterPut(bucket, uid, postId, justPutKey) {
  var items = await listPostImageObjects(bucket, uid, postId);
  if (items.length <= MEDIA_MAX_PER_POST) {
    var present = items.some(function (x) {
      return x.key === justPutKey;
    });
    return {
      ok: present,
      count: items.length,
      keys: items.map(function (x) {
        return x.key;
      }),
      code: present ? undefined : 'media_limit',
      message: present ? undefined : '每篇最多 ' + MEDIA_MAX_PER_POST + ' 張照片'
    };
  }

  items.sort(function (a, b) {
    if (a.uploadedAt !== b.uploadedAt) return a.uploadedAt - b.uploadedAt;
    return String(a.key).localeCompare(String(b.key));
  });

  var keep = {};
  for (var i = 0; i < MEDIA_MAX_PER_POST; i++) {
    keep[items[i].key] = true;
  }

  for (var j = 0; j < items.length; j++) {
    if (!keep[items[j].key]) {
      try {
        await bucket.delete(items[j].key);
      } catch (e) {
        /* best-effort */
      }
    }
  }

  var after = await listPostImageKeys(bucket, uid, postId);
  // Safety net: if still > max (list lag), delete justPutKey
  if (after.length > MEDIA_MAX_PER_POST && justPutKey) {
    try {
      await bucket.delete(justPutKey);
    } catch (e2) {
      /* ignore */
    }
    after = await listPostImageKeys(bucket, uid, postId);
  }

  var kept = after.indexOf(justPutKey) !== -1 && after.length <= MEDIA_MAX_PER_POST;
  if (after.length > MEDIA_MAX_PER_POST) {
    kept = false;
  }

  return {
    ok: kept && after.length <= MEDIA_MAX_PER_POST,
    code: kept ? undefined : 'media_limit',
    count: after.length,
    keys: after,
    message: '每篇最多 ' + MEDIA_MAX_PER_POST + ' 張照片'
  };
}

export function publicMediaUrl(env, uid, postId, imageId, ext) {
  var e = String(ext || 'webp').toLowerCase();
  var workerBase = String(env.CITY_SHARES_WORKER_PUBLIC_BASE || '').trim().replace(/\/$/, '');
  var path =
    '/api/city-shares/media/object/' +
    encodeURIComponent(uid) +
    '/' +
    encodeURIComponent(postId) +
    '/' +
    encodeURIComponent(imageId) +
    '.' +
    e;
  if (workerBase) return workerBase + path;
  return path;
}

function newServerImageId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
  } catch (e) {
    /* fall through */
  }
  return 'img' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

async function requireUser(request, env) {
  var token = extractBearerToken(request);
  if (!token) {
    var err = new Error('missing_bearer');
    err.code = 'unauthorized';
    throw err;
  }
  var projectId = String(env.FIREBASE_PROJECT_ID || 'soarvibe-885c8').trim();
  var user = await verifyFirebaseIdToken(token, projectId);
  return { user: user, token: token, projectId: projectId };
}

function requireBucket(env) {
  if (!env.CITY_SHARES_BUCKET) {
    var err = new Error('r2_not_configured');
    err.code = 'misconfigured';
    throw err;
  }
  return env.CITY_SHARES_BUCKET;
}

/**
 * POST /api/city-shares/media/upload
 */
export async function handleMediaUpload(request, env, corsOrigin, jsonResponse) {
  try {
    var authUser = await requireUser(request, env);
    var uid = authUser.user.uid;
    var bucket = requireBucket(env);

    var postId = '';
    var imageId = '';
    var bytes;

    var ct = String(request.headers.get('Content-Type') || '').toLowerCase();
    if (ct.indexOf('multipart/form-data') !== -1) {
      var form = await request.formData();
      postId = String(form.get('postId') || '').trim();
      imageId = String(form.get('imageId') || '').trim();
      var file = form.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') {
        return jsonResponse({ error: 'missing_file' }, 400, corsOrigin, env);
      }
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      postId = String(request.headers.get('X-Post-Id') || '').trim();
      imageId = String(request.headers.get('X-Image-Id') || '').trim();
      bytes = new Uint8Array(await request.arrayBuffer());
    }

    // Never trust client-supplied uid / full object path.
    if (!isSafeId(postId, 128)) {
      return jsonResponse({ error: 'invalid_postId' }, 400, corsOrigin, env);
    }
    if (!isSafeId(uid, 128)) {
      return jsonResponse({ error: 'invalid_uid' }, 400, corsOrigin, env);
    }
    if (imageId && !isSafeId(imageId, 128)) {
      return jsonResponse({ error: 'invalid_imageId' }, 400, corsOrigin, env);
    }
    if (!imageId) imageId = newServerImageId();

    if (!bytes || !bytes.length) {
      return jsonResponse({ error: 'empty_body' }, 400, corsOrigin, env);
    }
    if (bytes.length > MEDIA_MAX_BYTES) {
      return jsonResponse(
        { error: 'file_too_large', maxBytes: MEDIA_MAX_BYTES },
        413,
        corsOrigin,
        env
      );
    }

    var magic = detectImageMagic(bytes);
    if (!magic) {
      return jsonResponse(
        { error: 'invalid_image_magic', allowed: ['image/jpeg', 'image/png', 'image/webp'] },
        400,
        corsOrigin,
        env
      );
    }

    // Ownership: Firestore author OR draft claim (KV). Path uid always = token.sub.
    var authorId = await fetchPostAuthorId(authUser.projectId, postId, authUser.token);
    await assertPostClaimOrAuthor(env.CITY_SHARES_LIMITS, uid, postId, authorId);

    // Quotas (daily + burst) — before put to limit R2 Class A waste
    await assertAndConsumeUploadQuota(env.CITY_SHARES_LIMITS, {
      uid: uid,
      ip: clientIp(request),
      bytes: bytes.length
    });

    var key = buildObjectKey(uid, postId, imageId, magic.ext);
    var existing = await listPostImageObjects(bucket, uid, postId);
    var already = existing.some(function (x) {
      return x.key === key;
    });
    if (!already && existing.length >= MEDIA_MAX_PER_POST) {
      return jsonResponse(
        {
          error: 'media_limit',
          max: MEDIA_MAX_PER_POST,
          count: existing.length,
          message: '每篇最多 ' + MEDIA_MAX_PER_POST + ' 張照片'
        },
        409,
        corsOrigin,
        env
      );
    }

    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: magic.type,
        cacheControl: MEDIA_CACHE_CONTROL
      },
      customMetadata: {
        uid: uid,
        postId: postId,
        imageId: imageId,
        uploadedAt: String(Date.now())
      }
    });

    var guard = await enforceMaxAfterPut(bucket, uid, postId, key);
    if (!guard.ok) {
      return jsonResponse(
        {
          error: 'media_limit',
          max: MEDIA_MAX_PER_POST,
          count: guard.count,
          message: guard.message || '每篇最多 ' + MEDIA_MAX_PER_POST + ' 張照片'
        },
        409,
        corsOrigin,
        env
      );
    }

    var src = publicMediaUrl(env, uid, postId, imageId, magic.ext);
    return jsonResponse(
      {
        ok: true,
        mediaId: imageId,
        imageId: imageId,
        src: src,
        path: key,
        storagePath: key,
        type: magic.type,
        bytes: bytes.length,
        count: guard.count,
        limits: {
          dailyUploadsMax: DAILY_UPLOAD_MAX,
          dailyBytesMax: DAILY_BYTES_MAX,
          burstPerMinute: BURST_UID_MAX
        }
      },
      200,
      corsOrigin,
      env
    );
  } catch (e) {
    return mediaErrorResponse(e, corsOrigin, env, jsonResponse);
  }
}

/**
 * DELETE /api/city-shares/media
 */
export async function handleMediaDelete(request, env, corsOrigin, jsonResponse) {
  try {
    var authUser = await requireUser(request, env);
    var uid = authUser.user.uid;
    var bucket = requireBucket(env);
    var body = {};
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }
    var postId = String(body.postId || '').trim();
    if (!isSafeId(postId, 128)) {
      return jsonResponse({ error: 'invalid_postId' }, 400, corsOrigin, env);
    }

    var authorId = await fetchPostAuthorId(authUser.projectId, postId, authUser.token);
    await assertPostClaimOrAuthor(env.CITY_SHARES_LIMITS, uid, postId, authorId);

    if (body.all === true) {
      var keys = await listPostImageKeys(bucket, uid, postId);
      for (var i = 0; i < keys.length; i++) {
        await bucket.delete(keys[i]);
      }
      return jsonResponse({ ok: true, deleted: keys.length, keys: keys }, 200, corsOrigin, env);
    }

    var imageId = String(body.imageId || '').trim();
    if (!isSafeId(imageId, 128)) {
      return jsonResponse({ error: 'invalid_imageId' }, 400, corsOrigin, env);
    }
    // Delete any known extension for this imageId
    var candidates = ['webp', 'jpg', 'png'].map(function (ext) {
      return buildObjectKey(uid, postId, imageId, ext);
    });
    var deleted = 0;
    for (var c = 0; c < candidates.length; c++) {
      try {
        await bucket.delete(candidates[c]);
        deleted += 1;
      } catch (e2) {
        /* ignore */
      }
    }
    var remaining = await listPostImageKeys(bucket, uid, postId);
    return jsonResponse(
      { ok: true, deleted: deleted, count: remaining.length },
      200,
      corsOrigin,
      env
    );
  } catch (e) {
    return mediaErrorResponse(e, corsOrigin, env, jsonResponse);
  }
}

/**
 * GET /api/city-shares/media/object/{uid}/{postId}/{imageId}.{ext}
 */
export async function handleMediaObjectGet(request, env, corsOrigin) {
  try {
    var bucket = requireBucket(env);
    var url = new URL(request.url);
    var m = url.pathname.match(
      /^\/api\/city-shares\/media\/object\/([^/]+)\/([^/]+)\/([^/]+)\.(webp|jpg|png)$/i
    );
    if (!m) {
      return new Response(JSON.stringify({ error: 'bad_path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    var uid = decodeURIComponent(m[1]);
    var postId = decodeURIComponent(m[2]);
    var imageId = decodeURIComponent(m[3]);
    var ext = String(m[4] || 'webp').toLowerCase();
    if (!isSafeId(uid, 128) || !isSafeId(postId, 128) || !isSafeId(imageId, 128)) {
      return new Response(JSON.stringify({ error: 'invalid_ids' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    var key = buildObjectKey(uid, postId, imageId, ext);
    var obj = await bucket.get(key);
    if (!obj) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }
    var contentType =
      (obj.httpMetadata && obj.httpMetadata.contentType) ||
      (ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : 'image/webp');
    var headers = {
      'Content-Type': contentType,
      'Cache-Control': MEDIA_CACHE_CONTROL,
      // Public image GET may omit Origin; allow any for <img> loads only.
      'Access-Control-Allow-Origin': corsOrigin && corsOrigin !== '*' ? corsOrigin : '*',
      Vary: 'Origin'
    };
    return new Response(obj.body, { status: 200, headers: headers });
  } catch (e) {
    var status = e && e.code === 'misconfigured' ? 503 : 500;
    return new Response(
      JSON.stringify({ error: (e && e.code) || 'object_get_error', message: String(e && e.message) }),
      { status: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }
}

function mediaErrorResponse(e, corsOrigin, env, jsonResponse) {
  var code = (e && e.code) || 'error';
  var status = (e && e.status) || 500;
  if (code === 'unauthorized') status = 401;
  if (code === 'forbidden') status = 403;
  if (code === 'misconfigured' || code === 'limits_not_configured') status = 503;
  if (code === 'daily_upload_limit' || code === 'daily_bytes_limit' || code === 'burst_uid_limit' || code === 'burst_ip_limit') {
    status = 429;
  }
  var body = { error: code, message: String((e && e.message) || code) };
  if (e && e.retryAfter) body.retryAfter = e.retryAfter;
  var res = jsonResponse(body, status, corsOrigin, env);
  if (e && e.retryAfter && res && res.headers) {
    try {
      res.headers.set('Retry-After', String(e.retryAfter));
    } catch (err) {
      /* ignore */
    }
  }
  return res;
}

export function isCitySharesMediaPath(pathname) {
  return (
    pathname === '/api/city-shares/media/upload' ||
    pathname === '/api/city-shares/media' ||
    pathname.indexOf('/api/city-shares/media/object/') === 0
  );
}

export async function routeCitySharesMedia(request, env, auth, jsonResponse) {
  var url = new URL(request.url);
  var path = url.pathname;
  var origin = auth.origin;

  if (path === '/api/city-shares/media/upload' && request.method === 'POST') {
    return handleMediaUpload(request, env, origin, jsonResponse);
  }
  if (path === '/api/city-shares/media' && request.method === 'DELETE') {
    return handleMediaDelete(request, env, origin, jsonResponse);
  }
  if (path.indexOf('/api/city-shares/media/object/') === 0 && request.method === 'GET') {
    return handleMediaObjectGet(request, env, origin);
  }
  return null;
}
