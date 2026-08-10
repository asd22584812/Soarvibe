/**
 * City Shares R2 media — local unit tests (no deploy required for this file).
 * Run: node scripts/test-city-shares-r2-media.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  MEDIA_MAX_PER_POST,
  MEDIA_MAX_BYTES,
  MEDIA_CACHE_CONTROL,
  detectImageMagic,
  isWebpMagic,
  isSafeId,
  buildObjectKey,
  parseObjectKey,
  postPrefix,
  listPostImageKeys,
  enforceMaxAfterPut
} from '../worker/src/city-shares-media.js';
import {
  DAILY_UPLOAD_MAX,
  DAILY_BYTES_MAX,
  BURST_UID_MAX,
  assertAndConsumeUploadQuota,
  assertPostClaimOrAuthor
} from '../worker/src/city-shares-limits.js';

var __dirname = dirname(fileURLToPath(import.meta.url));
var root = join(__dirname, '..');
var passed = 0;
var failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  OK  ' + msg);
  } else {
    failed += 1;
    console.error('  FAIL  ' + msg);
  }
}

function makeWebpBytes(size) {
  var buf = new Uint8Array(Math.max(12, size || 12));
  buf[0] = 0x52;
  buf[1] = 0x49;
  buf[2] = 0x46;
  buf[3] = 0x46;
  buf[8] = 0x57;
  buf[9] = 0x45;
  buf[10] = 0x42;
  buf[11] = 0x50;
  return buf;
}

function makeJpegBytes() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
}

function makePngBytes() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
}

function createMockBucket(seed) {
  var map = new Map();
  (seed || []).forEach(function (row) {
    map.set(row[0], {
      bytes: row[1],
      uploadedAt: row[2] || Date.now(),
      uploaded: new Date(row[2] || Date.now()).toISOString()
    });
  });
  return {
    async list(opts) {
      var prefix = (opts && opts.prefix) || '';
      var objects = [];
      map.forEach(function (v, key) {
        if (key.indexOf(prefix) === 0) {
          objects.push({
            key: key,
            uploaded: v.uploaded,
            size: v.bytes && v.bytes.length,
            customMetadata: { uploadedAt: String(v.uploadedAt) }
          });
        }
      });
      return { objects: objects, truncated: false };
    },
    async put(key, bytes, opts) {
      var uploadedAt = Date.now();
      if (opts && opts.customMetadata && opts.customMetadata.uploadedAt) {
        uploadedAt = parseInt(opts.customMetadata.uploadedAt, 10) || uploadedAt;
      }
      map.set(key, {
        bytes: bytes,
        uploadedAt: uploadedAt,
        uploaded: new Date(uploadedAt).toISOString()
      });
    },
    async delete(key) {
      map.delete(key);
    },
    async get(key) {
      if (!map.has(key)) return null;
      return { body: map.get(key).bytes };
    },
    _map: map
  };
}

function createMockKv() {
  var map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, value);
    },
    _map: map
  };
}

console.log('\n=== constants ===');
assert(MEDIA_MAX_PER_POST === 3, 'MEDIA_MAX_PER_POST === 3');
assert(MEDIA_MAX_BYTES === 2 * 1024 * 1024, 'MEDIA_MAX_BYTES === 2MB');
assert(DAILY_UPLOAD_MAX === 30, 'daily uploads 30');
assert(DAILY_BYTES_MAX === 40 * 1024 * 1024, 'daily bytes 40MB');
assert(BURST_UID_MAX === 10, 'burst 10/min');
assert(MEDIA_CACHE_CONTROL.indexOf('3600') !== -1, 'cache TTL 1h');

console.log('\n=== magic bytes ===');
assert(detectImageMagic(makeWebpBytes()).ext === 'webp', 'webp magic');
assert(detectImageMagic(makeJpegBytes()).ext === 'jpg', 'jpeg magic');
assert(detectImageMagic(makePngBytes()).ext === 'png', 'png magic');
assert(detectImageMagic(new Uint8Array([0x47, 0x49, 0x46])) === null, 'gif rejected');
assert(detectImageMagic(new TextEncoder().encode('%PDF-1.4')) === null, 'pdf rejected');
assert(detectImageMagic(new TextEncoder().encode('<svg')) === null, 'svg rejected');
assert(isWebpMagic(makeWebpBytes()), 'isWebpMagic');

console.log('\n=== ids / paths ===');
assert(isSafeId('abc_DEF-123'), 'safe id');
assert(!isSafeId('../x'), 'traversal rejected');
assert(!isSafeId('a/b'), 'slash rejected');
assert(buildObjectKey('u', 'p', 'i', 'webp') === 'city-shares/u/p/i.webp', 'webp path');
assert(parseObjectKey('city-shares/u/p/i.jpg').ext === 'jpg', 'parse jpg');
assert(postPrefix('u', 'p') === 'city-shares/u/p/', 'prefix');

console.log('\n=== race: 2 existing + 5 concurrent puts ===');
(async function () {
  var t0 = 1000;
  var bucket = createMockBucket([
    ['city-shares/u/p/a.webp', makeWebpBytes(), t0],
    ['city-shares/u/p/b.webp', makeWebpBytes(), t0 + 1]
  ]);
  var puts = [];
  for (var i = 0; i < 5; i++) {
    var key = 'city-shares/u/p/n' + i + '.webp';
    await bucket.put(key, makeWebpBytes(), {
      customMetadata: { uploadedAt: String(t0 + 10 + i) }
    });
    puts.push(key);
  }
  var results = [];
  for (var j = 0; j < puts.length; j++) {
    results.push(await enforceMaxAfterPut(bucket, 'u', 'p', puts[j]));
  }
  var left = await listPostImageKeys(bucket, 'u', 'p');
  assert(left.length <= 3, 'final R2 objects <= 3 (got ' + left.length + ')');
  assert(left.indexOf('city-shares/u/p/a.webp') !== -1, 'kept oldest a');
  assert(left.indexOf('city-shares/u/p/b.webp') !== -1, 'kept oldest b');
  var successCount = results.filter(function (r) {
    return r.ok;
  }).length;
  assert(successCount === 1, 'exactly one of the 5 concurrent wins a slot (got ' + successCount + ')');
  assert(
    results.filter(function (r) {
      return !r.ok;
    }).length === 4,
    'four overflow requests rejected'
  );

  console.log('\n=== quotas ===');
  var kv = createMockKv();
  for (var q = 0; q < 10; q++) {
    await assertAndConsumeUploadQuota(kv, { uid: 'user1', ip: '1.1.1.1', bytes: 1000 });
  }
  var burstHit = false;
  try {
    await assertAndConsumeUploadQuota(kv, { uid: 'user1', ip: '1.1.1.1', bytes: 1000 });
  } catch (e) {
    burstHit = e.code === 'burst_uid_limit';
  }
  assert(burstHit, '11th upload in same minute → 429 burst');

  var kv2 = createMockKv();
  // Simulate day nearly full via direct put
  var day = new Date();
  var dayKey =
    'cs-day:user2:' +
    day.getUTCFullYear() +
    '-' +
    String(day.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(day.getUTCDate()).padStart(2, '0');
  await kv2.put(dayKey, JSON.stringify({ uploads: 30, bytes: 0 }));
  var dayHit = false;
  try {
    await assertAndConsumeUploadQuota(kv2, { uid: 'user2', ip: '2.2.2.2', bytes: 100 });
  } catch (e2) {
    dayHit = e2.code === 'daily_upload_limit';
  }
  assert(dayHit, '31st daily upload blocked');

  console.log('\n=== ownership claim ===');
  var kv3 = createMockKv();
  var c1 = await assertPostClaimOrAuthor(kv3, 'alice', 'postX', null);
  assert(c1.mode === 'claimed', 'first claim');
  var c2 = await assertPostClaimOrAuthor(kv3, 'alice', 'postX', null);
  assert(c2.mode === 'claim_owner', 'same uid reclaim');
  var foreign = false;
  try {
    await assertPostClaimOrAuthor(kv3, 'bob', 'postX', null);
  } catch (e3) {
    foreign = e3.code === 'forbidden';
  }
  assert(foreign, 'foreign claim denied');
  var pub = await assertPostClaimOrAuthor(kv3, 'alice', 'postY', 'alice');
  assert(pub.mode === 'published_author', 'published author ok');
  var pubForeign = false;
  try {
    await assertPostClaimOrAuthor(kv3, 'bob', 'postY', 'alice');
  } catch (e4) {
    pubForeign = e4.code === 'forbidden';
  }
  assert(pubForeign, 'foreign published post denied');

  console.log('\n=== wiring ===');
  var wrangler = readFileSync(join(root, 'worker/wrangler.toml'), 'utf8');
  assert(wrangler.indexOf('bucket_name = "soarvibe-city-shares"') !== -1, 'prod bucket');
  assert(!/^\s*preview_bucket_name\s*=/m.test(wrangler), 'no preview_bucket_name setting');
  assert(wrangler.indexOf('CITY_SHARES_LIMITS') !== -1, 'KV binding');
  assert(wrangler.indexOf('CITY_SHARES_PUBLIC_BASE = ""') !== -1, 'public base empty');

  var flags = readFileSync(join(root, 'feature-flags.js'), 'utf8');
  assert(/citySharesMediaUpload:\s*true/.test(flags), 'media flag on');
  assert(/avatarUploadEnabled:\s*false/.test(flags), 'avatar stays off');

  var sw = readFileSync(join(root, 'service-worker.js'), 'utf8');
  assert(sw.indexOf('soarvibe-v155') !== -1, 'SW v155');
  assert(sw.indexOf('city-shares-image.js') !== -1, 'SW precaches image module');

  var html = readFileSync(join(root, 'index.html'), 'utf8');
  assert(html.indexOf("SOARVIBE_APP_BUILD = 'v155'") !== -1, 'BUILD v155');

  var rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
  assert(rules.indexOf('mediaWithinCap') !== -1, 'rules mediaWithinCap');
  assert(rules.indexOf('media.size() <= 3') !== -1, 'rules media <= 3');

  var imgSrc = readFileSync(join(root, 'city-shares-image.js'), 'utf8');
  assert(imgSrc.indexOf('最相容') !== -1, 'HEIC human message');

  console.log('\n=== summary ===');
  console.log('passed=' + passed + ' failed=' + failed);
  if (failed) process.exit(1);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
