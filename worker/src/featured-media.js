/**
 * Featured banner media — Cloudflare R2 (same bucket binding as City Shares).
 * Object key prefix: featured/{partnerId}/{imageId}.webp|jpg|png
 * Does NOT use city-shares/ paths.
 *
 * Upload / delete require Featured Admin (claim admin:true OR ADMIN_UIDS).
 * Public GET serves banners for all users.
 */

import { verifyFirebaseIdToken, extractBearerToken } from './firebase-jwt.js';
import { assertFeaturedAdmin, isFeaturedAdminUser } from './featured-admin.js';
import {
  detectImageMagic,
  isSafeId,
  MEDIA_MAX_BYTES,
  MEDIA_CACHE_CONTROL
} from './city-shares-media.js';

export const FEATURED_MEDIA_PREFIX = 'featured';
export const FEATURED_MEDIA_MAX_BYTES = MEDIA_MAX_BYTES;

function newServerImageId() {
  return (
    'img_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 10)
  );
}

export function buildFeaturedObjectKey(partnerId, imageId, ext) {
  var e = String(ext || 'webp').toLowerCase();
  if (e !== 'webp' && e !== 'jpg' && e !== 'png') e = 'webp';
  return FEATURED_MEDIA_PREFIX + '/' + partnerId + '/' + imageId + '.' + e;
}

export function parseFeaturedObjectKey(key) {
  var parts = String(key || '').split('/');
  if (parts.length !== 3) return null;
  if (parts[0] !== FEATURED_MEDIA_PREFIX) return null;
  var partnerId = parts[1];
  var file = parts[2];
  var m = /^([A-Za-z0-9_-]+)\.(webp|jpg|png)$/i.exec(file);
  if (!m) return null;
  if (!isSafeId(partnerId, 128) || !isSafeId(m[1], 128)) return null;
  return {
    partnerId: partnerId,
    imageId: m[1],
    ext: String(m[2]).toLowerCase()
  };
}

export function publicFeaturedMediaUrl(env, partnerId, imageId, ext) {
  var base = String(
    env.CITY_SHARES_WORKER_PUBLIC_BASE ||
      env.FEATURED_WORKER_PUBLIC_BASE ||
      ''
  ).replace(/\/$/, '');
  var e = String(ext || 'webp').toLowerCase();
  var path =
    '/api/featured/media/object/' +
    encodeURIComponent(partnerId) +
    '/' +
    encodeURIComponent(imageId) +
    '.' +
    e;
  return base ? base + path : path;
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

function mediaErrorResponse(e, corsOrigin, env, jsonResponse) {
  var code = (e && e.code) || 'error';
  var status = (e && e.status) || 500;
  if (code === 'unauthorized') status = 401;
  if (code === 'forbidden') status = 403;
  if (code === 'misconfigured') status = 503;
  return jsonResponse(
    { error: code, message: String((e && e.message) || code) },
    status,
    corsOrigin,
    env
  );
}

/**
 * GET /api/featured/admin-status
 */
export async function handleFeaturedAdminStatus(request, env, corsOrigin, jsonResponse) {
  try {
    var authUser = await requireUser(request, env);
    var admin = isFeaturedAdminUser(authUser.user, env);
    return jsonResponse(
      { ok: true, admin: admin, uid: authUser.user.uid },
      200,
      corsOrigin,
      env
    );
  } catch (e) {
    return mediaErrorResponse(e, corsOrigin, env, jsonResponse);
  }
}

/**
 * POST /api/featured/media/upload
 * multipart: partnerId, file, optional imageId
 */
export async function handleFeaturedMediaUpload(request, env, corsOrigin, jsonResponse) {
  try {
    var authUser = await requireUser(request, env);
    assertFeaturedAdmin(authUser.user, env);
    var bucket = requireBucket(env);

    var partnerId = '';
    var imageId = '';
    var bytes;

    var ct = String(request.headers.get('Content-Type') || '').toLowerCase();
    if (ct.indexOf('multipart/form-data') !== -1) {
      var form = await request.formData();
      partnerId = String(form.get('partnerId') || '').trim();
      imageId = String(form.get('imageId') || '').trim();
      var file = form.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') {
        return jsonResponse({ error: 'missing_file' }, 400, corsOrigin, env);
      }
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      partnerId = String(request.headers.get('X-Partner-Id') || '').trim();
      imageId = String(request.headers.get('X-Image-Id') || '').trim();
      bytes = new Uint8Array(await request.arrayBuffer());
    }

    if (!isSafeId(partnerId, 128)) {
      return jsonResponse({ error: 'invalid_partnerId' }, 400, corsOrigin, env);
    }
    if (imageId && !isSafeId(imageId, 128)) {
      return jsonResponse({ error: 'invalid_imageId' }, 400, corsOrigin, env);
    }
    if (!imageId) imageId = newServerImageId();

    if (!bytes || !bytes.length) {
      return jsonResponse({ error: 'empty_body' }, 400, corsOrigin, env);
    }
    if (bytes.length > FEATURED_MEDIA_MAX_BYTES) {
      return jsonResponse(
        { error: 'file_too_large', maxBytes: FEATURED_MEDIA_MAX_BYTES },
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

    var key = buildFeaturedObjectKey(partnerId, imageId, magic.ext);
    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType: magic.type,
        cacheControl: MEDIA_CACHE_CONTROL
      },
      customMetadata: {
        partnerId: partnerId,
        imageId: imageId,
        uploadedBy: authUser.user.uid,
        uploadedAt: String(Date.now())
      }
    });

    var src = publicFeaturedMediaUrl(env, partnerId, imageId, magic.ext);
    return jsonResponse(
      {
        ok: true,
        partnerId: partnerId,
        imageId: imageId,
        mediaId: imageId,
        src: src,
        path: key,
        storagePath: key,
        bannerImageUrl: src,
        bannerImagePath: key,
        type: magic.type,
        bytes: bytes.length
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
 * DELETE /api/featured/media
 * body: { partnerId, imageId } OR { storagePath }
 */
export async function handleFeaturedMediaDelete(request, env, corsOrigin, jsonResponse) {
  try {
    var authUser = await requireUser(request, env);
    assertFeaturedAdmin(authUser.user, env);
    var bucket = requireBucket(env);
    var body = {};
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }

    var keys = [];
    var storagePath = String(body.storagePath || body.path || '').trim();
    if (storagePath) {
      var parsed = parseFeaturedObjectKey(storagePath);
      if (!parsed) {
        return jsonResponse({ error: 'invalid_storagePath' }, 400, corsOrigin, env);
      }
      keys.push(storagePath);
    } else {
      var partnerId = String(body.partnerId || '').trim();
      var imageId = String(body.imageId || '').trim();
      if (!isSafeId(partnerId, 128) || !isSafeId(imageId, 128)) {
        return jsonResponse({ error: 'invalid_ids' }, 400, corsOrigin, env);
      }
      keys = ['webp', 'jpg', 'png'].map(function (ext) {
        return buildFeaturedObjectKey(partnerId, imageId, ext);
      });
    }

    var deleted = 0;
    for (var i = 0; i < keys.length; i++) {
      try {
        await bucket.delete(keys[i]);
        deleted += 1;
      } catch (e2) {
        /* ignore missing */
      }
    }
    return jsonResponse({ ok: true, deleted: deleted }, 200, corsOrigin, env);
  } catch (e) {
    return mediaErrorResponse(e, corsOrigin, env, jsonResponse);
  }
}

/**
 * GET /api/featured/media/object/{partnerId}/{imageId}.{ext}
 */
export async function handleFeaturedMediaObjectGet(request, env, corsOrigin) {
  try {
    var bucket = requireBucket(env);
    var url = new URL(request.url);
    var m = url.pathname.match(
      /^\/api\/featured\/media\/object\/([^/]+)\/([^/]+)\.(webp|jpg|png)$/i
    );
    if (!m) {
      return new Response(JSON.stringify({ error: 'bad_path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    var partnerId = decodeURIComponent(m[1]);
    var imageId = decodeURIComponent(m[2]);
    var ext = String(m[3] || 'webp').toLowerCase();
    if (!isSafeId(partnerId, 128) || !isSafeId(imageId, 128)) {
      return new Response(JSON.stringify({ error: 'invalid_ids' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    var key = buildFeaturedObjectKey(partnerId, imageId, ext);
    var obj = await bucket.get(key);
    if (!obj) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }
    var contentType =
      (obj.httpMetadata && obj.httpMetadata.contentType) ||
      (ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : 'image/webp');
    return new Response(obj.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': MEDIA_CACHE_CONTROL,
        'Access-Control-Allow-Origin': corsOrigin && corsOrigin !== '*' ? corsOrigin : '*',
        Vary: 'Origin'
      }
    });
  } catch (e) {
    var status = e && e.code === 'misconfigured' ? 503 : 500;
    return new Response(
      JSON.stringify({
        error: (e && e.code) || 'object_get_error',
        message: String(e && e.message)
      }),
      { status: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }
}

export function isFeaturedMediaPath(pathname) {
  return (
    pathname === '/api/featured/admin-status' ||
    pathname === '/api/featured/media/upload' ||
    pathname === '/api/featured/media' ||
    pathname.indexOf('/api/featured/media/object/') === 0
  );
}

export async function routeFeaturedMedia(request, env, auth, jsonResponse) {
  var url = new URL(request.url);
  var path = url.pathname;
  var origin = auth.origin;

  if (path === '/api/featured/admin-status' && request.method === 'GET') {
    return handleFeaturedAdminStatus(request, env, origin, jsonResponse);
  }
  if (path === '/api/featured/media/upload' && request.method === 'POST') {
    return handleFeaturedMediaUpload(request, env, origin, jsonResponse);
  }
  if (path === '/api/featured/media' && request.method === 'DELETE') {
    return handleFeaturedMediaDelete(request, env, origin, jsonResponse);
  }
  if (path.indexOf('/api/featured/media/object/') === 0 && request.method === 'GET') {
    return handleFeaturedMediaObjectGet(request, env, origin);
  }
  return null;
}
