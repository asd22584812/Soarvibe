/**
 * Featured Admin v1 — unit tests (no deploy).
 * Run: node scripts/test-featured-admin-v1.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  parseAdminUids,
  isFeaturedAdminUser,
  assertFeaturedAdmin
} from '../worker/src/featured-admin.js';
import {
  FEATURED_MEDIA_PREFIX,
  buildFeaturedObjectKey,
  parseFeaturedObjectKey,
  publicFeaturedMediaUrl,
  isFeaturedMediaPath
} from '../worker/src/featured-media.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  OK  ' + msg);
  } else {
    failed += 1;
    console.error('  FAIL  ' + msg);
  }
}

console.log('\n=== admin identity ===');
assert(parseAdminUids({}).length === 0, 'empty ADMIN_UIDS → []');
assert(
  parseAdminUids({ ADMIN_UIDS: ' uid1 ,uid2 ' }).join(',') === 'uid1,uid2',
  'parse ADMIN_UIDS csv'
);
assert(
  isFeaturedAdminUser({ uid: 'x', claims: { admin: true } }, {}) === true,
  'claim admin:true grants admin'
);
assert(
  isFeaturedAdminUser({ uid: 'uid1', claims: {} }, { ADMIN_UIDS: 'uid1,uid2' }) === true,
  'ADMIN_UIDS allowlist grants admin'
);
assert(
  isFeaturedAdminUser({ uid: 'nope', claims: {} }, { ADMIN_UIDS: 'uid1' }) === false,
  'random uid denied'
);
assert(
  isFeaturedAdminUser({ uid: 'nope', claims: { isAdmin: true } }, {}) === false,
  'bogus isAdmin claim ignored'
);
try {
  assertFeaturedAdmin({ uid: 'x', claims: {} }, {});
  assert(false, 'assertFeaturedAdmin should throw');
} catch (e) {
  assert(e && e.code === 'forbidden', 'assertFeaturedAdmin → forbidden');
}

console.log('\n=== featured R2 keys (not city-shares) ===');
assert(FEATURED_MEDIA_PREFIX === 'featured', 'prefix featured');
assert(
  buildFeaturedObjectKey('p1', 'img1', 'webp') === 'featured/p1/img1.webp',
  'build key'
);
assert(parseFeaturedObjectKey('city-shares/u/p/i.webp') === null, 'reject city-shares path');
assert(
  parseFeaturedObjectKey('featured/p1/img1.webp').partnerId === 'p1',
  'parse featured key'
);
assert(
  publicFeaturedMediaUrl(
    { CITY_SHARES_WORKER_PUBLIC_BASE: 'https://soarvibe-api.soarvibe.workers.dev' },
    'p1',
    'img1',
    'webp'
  ) ===
    'https://soarvibe-api.soarvibe.workers.dev/api/featured/media/object/p1/img1.webp',
  'public url'
);
assert(isFeaturedMediaPath('/api/featured/media/upload') === true, 'upload path');
assert(isFeaturedMediaPath('/api/city-shares/media/upload') === false, 'not city-shares path');

console.log('\n=== source wiring ===');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');
const wrangler = readFileSync(join(root, 'worker/wrangler.toml'), 'utf8');
assert(indexHtml.includes('featured-partners-data.js'), 'index wires data js');
assert(indexHtml.includes('featured-admin.js'), 'index wires admin js');
assert(indexHtml.includes('soarvibeFeaturedAdmin'), 'admin modal shell');
assert(indexHtml.includes('featuredAdminOpenBtn'), 'admin open button');
assert(rules.includes('match /featuredPartners/{partnerId}'), 'rules featuredPartners');
assert(rules.includes('isFeaturedAdmin()'), 'rules isFeaturedAdmin');
assert(
  !/allow\s+(read|write|create|update|delete):\s*if\s+.*isAdmin/.test(rules.replace(/\/\/[^\n]*/g, '')),
  'no client-writable isAdmin gate in allow rules'
);
assert(!/resource\.data\.isAdmin|request\.resource\.data\.isAdmin/.test(rules), 'no users.isAdmin field checks');
assert(rules.includes('request.auth.token.admin == true'), 'custom claim path');
assert(wrangler.includes('ADMIN_UIDS'), 'wrangler documents ADMIN_UIDS');
assert(sw.includes('./featured-admin.js'), 'SW precaches admin js');
assert(sw.includes('./featured-partners-data.js'), 'SW precaches data js');

console.log('\n=== firestore normalize + schedule ===');
{
  const sandbox = {
    console,
    window: {},
    globalThis: {},
    Date,
    URL,
    firebase: {
      firestore: {
        FieldValue: { serverTimestamp: () => 'SERVER_TS' },
        Timestamp: { fromDate: (d) => d }
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  vm.runInNewContext(
    readFileSync(join(root, 'featured-partners-data.js'), 'utf8'),
    sandbox,
    { filename: 'featured-partners-data.js' }
  );
  const data = sandbox.SOARVIBE_FEATURED_DATA;
  const norm = data.normalizeFeaturedDoc('fp1', {
    partner: 'Acme',
    title: 'Tokyo Deal',
    bannerImageUrl: 'https://cdn.example/b.webp',
    affiliateUrl: 'https://aff.example/x',
    sortOrder: 2,
    active: true
  });
  assert(norm.source === 'firestore', 'normalize source=firestore');
  assert(norm.affiliateUrl === 'https://aff.example/x', 'normalize affiliateUrl');
  assert(norm.url === norm.affiliateUrl, 'url mirrors affiliate only');
  assert(data.isHttpsAffiliateUrl('https://x.com') === true, 'https ok');
  assert(data.isHttpsAffiliateUrl('http://x.com') === false, 'http rejected');
  assert(data.isPublishableActive({ ...norm, active: true }) === true, 'publishable');
  assert(
    data.isPublishableActive({ ...norm, affiliateUrl: '' }) === false,
    'empty affiliate not publishable'
  );
  const future = Date.now() + 86400000;
  assert(
    data.isWithinSchedule({ startAt: future }) === false,
    'future startAt hidden'
  );
  assert(
    data.isWithinSchedule({ endAt: Date.now() - 1000 }) === false,
    'past endAt hidden'
  );
}

console.log('\n=== featured partners affiliate-only for firestore ===');
{
  const sandbox = {
    console,
    window: {},
    globalThis: {},
    document: {
      readyState: 'complete',
      documentElement: { classList: { add() {}, remove() {} }, style: {} },
      body: { classList: { add() {}, remove() {} }, style: {} },
      getElementById() {
        return null;
      },
      createElement() {
        return {
          classList: { add() {}, remove() {} },
          style: {},
          children: [],
          setAttribute() {},
          appendChild() {},
          addEventListener() {}
        };
      },
      addEventListener() {}
    },
    location: { href: 'https://soarvibe.local/', search: '' },
    URL,
    scrollY: 0,
    pageYOffset: 0,
    scrollTo() {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  vm.runInNewContext(
    readFileSync(join(root, 'featured-partners.js'), 'utf8'),
    sandbox,
    { filename: 'featured-partners.js' }
  );
  const api = sandbox.SOARVIBE_FEATURED;
  const resolved = api.resolvePartnerOpenUrl({
    source: 'firestore',
    affiliateUrl: 'https://aff.example/deal',
    url: 'https://should-not-use.example'
  });
  assert(resolved.primary === 'https://aff.example/deal', 'firestore uses affiliateUrl');
  assert(resolved.fallback === '', 'no generic fallback');
  const blocked = api.resolvePartnerOpenUrl({
    source: 'firestore',
    affiliateUrl: '',
    url: 'https://official.example'
  });
  assert(blocked.primary === '', 'empty affiliate → no open (no official fallback)');
  assert(api.getActivePartners().length === 3, 'hardcoded fallback still 3 when no firestore');
  assert(api.usesFirestoreWhenAvailable === true, 'flag usesFirestoreWhenAvailable');
}

console.log('\n=== summary ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
