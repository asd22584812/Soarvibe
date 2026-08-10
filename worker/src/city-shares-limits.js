/**
 * City Shares upload abuse protection (Workers KV).
 * Daily + burst limits — billing safety for paid R2.
 */

export const DAILY_UPLOAD_MAX = 30; // images / uid / UTC day
export const DAILY_BYTES_MAX = 40 * 1024 * 1024; // 40 MB / uid / UTC day
export const BURST_UID_MAX = 10; // uploads / uid / minute
export const BURST_IP_MAX = 30; // uploads / IP / minute (coarse)

function utcDayKey(d) {
  var x = d || new Date();
  return (
    x.getUTCFullYear() +
    '-' +
    String(x.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(x.getUTCDate()).padStart(2, '0')
  );
}

function minuteBucket(d) {
  return String(Math.floor((d || Date.now()) / 60000));
}

function quotaError(code, message, retryAfterSec) {
  var err = new Error(message || code);
  err.code = code;
  err.status = 429;
  if (retryAfterSec) err.retryAfter = retryAfterSec;
  return err;
}

/**
 * @param {KVNamespace|undefined} kv
 * @param {{ uid: string, ip: string, bytes: number }} opts
 */
export async function assertAndConsumeUploadQuota(kv, opts) {
  if (!kv) {
    // Fail closed on production misconfig — do not allow unlimited uploads.
    throw quotaError('limits_not_configured', '上傳配額服務未設定');
  }
  var uid = String(opts.uid || '');
  var ip = String(opts.ip || 'unknown').slice(0, 64);
  var bytes = Math.max(0, Number(opts.bytes) || 0);
  var now = Date.now();
  var day = utcDayKey(new Date(now));
  var minute = minuteBucket(now);

  var dayKey = 'cs-day:' + uid + ':' + day;
  var burstUidKey = 'cs-burst-uid:' + uid + ':' + minute;
  var burstIpKey = 'cs-burst-ip:' + ip + ':' + minute;

  var dayRaw = await kv.get(dayKey);
  var dayData = { uploads: 0, bytes: 0 };
  try {
    if (dayRaw) dayData = Object.assign(dayData, JSON.parse(dayRaw));
  } catch (e) {
    /* reset */
  }

  if (dayData.uploads >= DAILY_UPLOAD_MAX) {
    throw quotaError('daily_upload_limit', '今日上傳張數已達上限（' + DAILY_UPLOAD_MAX + ' 張），請明日再試');
  }
  if (dayData.bytes + bytes > DAILY_BYTES_MAX) {
    throw quotaError('daily_bytes_limit', '今日上傳容量已達上限，請明日再試');
  }

  var burstUid = parseInt((await kv.get(burstUidKey)) || '0', 10) || 0;
  if (burstUid >= BURST_UID_MAX) {
    throw quotaError('burst_uid_limit', '上傳太頻繁，請稍候再試', 60);
  }
  var burstIp = parseInt((await kv.get(burstIpKey)) || '0', 10) || 0;
  if (burstIp >= BURST_IP_MAX) {
    throw quotaError('burst_ip_limit', '上傳太頻繁，請稍候再試', 60);
  }

  // Consume after checks (best-effort; slight overage possible under extreme KV lag — acceptable for billing guardrails)
  dayData.uploads += 1;
  dayData.bytes += bytes;
  await Promise.all([
    kv.put(dayKey, JSON.stringify(dayData), { expirationTtl: 172800 }),
    kv.put(burstUidKey, String(burstUid + 1), { expirationTtl: 120 }),
    kv.put(burstIpKey, String(burstIp + 1), { expirationTtl: 120 })
  ]);

  return {
    dayUploads: dayData.uploads,
    dayBytes: dayData.bytes,
    burstUid: burstUid + 1
  };
}

/**
 * Draft post claim: binds postId → uid for pre-publish uploads (24h).
 */
export async function assertPostClaimOrAuthor(kv, uid, postId, firestoreAuthorId) {
  if (firestoreAuthorId) {
    if (firestoreAuthorId !== uid) {
      var err = new Error('foreign_post');
      err.code = 'forbidden';
      err.status = 403;
      throw err;
    }
    return { mode: 'published_author' };
  }

  if (!kv) {
    // Without KV, path uid==token.uid still scopes objects; claim skipped.
    return { mode: 'unclaimed_no_kv' };
  }

  var key = 'cs-claim:' + postId;
  var raw = await kv.get(key);
  if (!raw) {
    await kv.put(
      key,
      JSON.stringify({ uid: uid, createdAt: Date.now() }),
      { expirationTtl: 86400 }
    );
    return { mode: 'claimed' };
  }
  var claim;
  try {
    claim = JSON.parse(raw);
  } catch (e) {
    claim = null;
  }
  if (!claim || claim.uid !== uid) {
    var err2 = new Error('post_claimed_by_other');
    err2.code = 'forbidden';
    err2.status = 403;
    throw err2;
  }
  return { mode: 'claim_owner' };
}

/**
 * Read posts/{postId}.authorId via Firestore REST using the caller's ID token.
 * Returns null if doc missing / unreadable (treat as draft).
 */
export async function fetchPostAuthorId(projectId, postId, idToken) {
  var url =
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(projectId) +
    '/databases/(default)/documents/posts/' +
    encodeURIComponent(postId);
  try {
    var res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + idToken }
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    var body = await res.json();
    var fields = body && body.fields;
    if (!fields || !fields.authorId) return null;
    return String(fields.authorId.stringValue || '') || null;
  } catch (e) {
    return null;
  }
}

export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'unknown'
  );
}
