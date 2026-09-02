/**
 * City Shares guest-read regressions (offline source + rules intent).
 * node scripts/test-city-shares-guest-read.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  OK  ' + msg);
    passed += 1;
  } else {
    console.error('  FAIL  ' + msg);
    failed += 1;
  }
}

const ui = fs.readFileSync(path.join(root, 'city-shares-ui.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'city-shares-firestore.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const authUi = fs.readFileSync(path.join(root, 'soarvibe-auth-ui.js'), 'utf8');

console.log('\n=== guest feed path ===');
assert(/function whenAuthSettled/.test(ui), '1. whenAuthSettled helper exists (timeout race)');
assert(/Promise\.race/.test(ui) && /whenAuthSettled/.test(ui), '1a. auth wait races a timeout (no hang)');
assert(
  /Published posts are guest-readable[\s\S]*return runLoader\(\)/.test(ui) &&
    !/refreshRemoteFeed[\s\S]*requireUser|refreshRemoteFeed[\s\S]*isSignedIn\(\)\s*\)\s*return/.test(
      ui.slice(ui.indexOf('function refreshRemoteFeed'), ui.indexOf('function showCitySharesLoadError'))
    ),
  '1b. refreshRemoteFeed loads immediately — no Auth gate / no sign-in required'
);
assert(
  /Soft-fail: NEVER replace last-good UGC|keep any prior remote posts|soft-fail/i.test(ui),
  '1c. feed soft-fails without wiping last-good UGC'
);
assert(/throwOnError/.test(ui) && /更新失敗，請稍後再試/.test(ui), '1c2. PTR failure toast, keep current screen');
assert(
  /onAuthStateChanged[\s\S]*refreshRemoteFeed/.test(ui),
  '1d. auth settle re-refreshes open feed (guest or signed-in)'
);
assert(/function ensureFirebaseReady/.test(ui), '1f. ensures Firebase init before public list');
assert(/function withListRetry/.test(api), '1e. list queries retry before failing');
assert(
  /never pretend "empty feed"|Promise\.reject\(err/.test(api),
  '1e2. exhausted list failure rejects (does not fake [])'
);
assert(/remoteFeedCache|hydrateRemoteFromCache|rememberRemoteFeed/.test(ui), '1g. session cache for remote UGC');
assert(/Cold start retry once if first open still has no posts/.test(ui), '1h. follow-up fetch when UGC still missing');
assert(/Firestore-only: never merge local official\/demo seeds|never merge local official\/demo seeds/.test(ui), '1i. feed is Firestore-only (no seed merge)');
assert(/還沒有旅人分享/.test(ui), '1j. empty state when no published posts');
assert(/正在載入旅人們的最新分享/.test(ui), '1k. initial feed loading copy');
assert(/function finishPtrRefresh/.test(ui) && /PTR_TIMEOUT_MS/.test(ui), '1l. PTR spinner always finishes');
assert(
  /where\('status',\s*'==',\s*'published'\)/.test(api),
  '3. feed query filters status == published'
);

console.log('\n=== Firestore rules ===');
assert(/function isPublicPost\(\)/.test(rules), 'rules: isPublicPost exists');
assert(
  /allow list:\s*if isPublicPost\(\)\s*\|\|\s*isPostAuthor\(\)/.test(rules),
  'rules: published posts listable without auth via isPublicPost'
);
assert(
  /allow get:\s*if resource == null\s*\|\|\s*isPublicPost\(\)/.test(rules),
  'rules: guest get published posts allowed'
);
assert(
  /match \/likes\/\{uid\}[\s\S]*allow read:\s*if signedIn\(\)/.test(rules),
  '4. likes still auth-only'
);
assert(
  /match \/users\/\{uid\}[\s\S]*allow read:\s*if isSelf\(uid\)/.test(rules),
  '9. private user profile read still self-only'
);
assert(
  /match \/users\/\{uid\}[\s\S]*private\/\{docId\}[\s\S]*allow read,\s*write:\s*if isSelf\(uid\)/.test(
    rules
  ) || /private\/\{docId\}[\s\S]*isSelf\(uid\)/.test(rules),
  '9b. private notes/checklist still self-only'
);

console.log('\n=== interaction gates ===');
assert(
  /function handleLike[\s\S]*!au\.isSignedIn\(\)[\s\S]*requireAuth\('按讚'/.test(ui) ||
    /requireAuth\('按讚'/.test(ui),
  '4. guest cannot like without auth'
);
assert(
  /requireAuth\('留言'/.test(ui) && /function handleCommentSubmit/.test(ui),
  '5. guest cannot comment without auth'
);
assert(
  /requireAuth\('分享投稿'/.test(ui) || /pendingAction:\s*'city_share_compose'/.test(ui),
  '6. guest cannot create post without auth'
);
assert(
  /瀏覽 City Shares 不用登入/.test(authUi),
  'product copy: browse without login'
);
assert(/id="csComposeOpenBtn"/.test(ui) && /分享這次旅行/.test(ui), '8. signed-in compose entry retained');
assert(/function handleLike/.test(ui) && /patchLikeUi/.test(ui), '8b. like path unchanged (patch)');
assert(/loading="eager"|fetchpriority="high"/.test(ui), '8c. image first-paint path retained');

console.log('\n=== draft / private not public ===');
assert(
  /status == 'published'/.test(rules) && /draft/.test(rules),
  '7. rules distinguish published vs draft'
);
assert(
  !/allow list:\s*if true/.test(rules.slice(rules.indexOf('match /posts'))),
  '7b. posts list is not blanket allow-all'
);

console.log('\n=== syntax ===');
const syn = spawnSync(process.execPath, ['--check', path.join(root, 'city-shares-ui.js')], {
  encoding: 'utf8'
});
assert(syn.status === 0, 'city-shares-ui.js syntax');
const syn2 = spawnSync(process.execPath, ['--check', path.join(root, 'city-shares-firestore.js')], {
  encoding: 'utf8'
});
assert(syn2.status === 0, 'city-shares-firestore.js syntax');

console.log('\n=== totals ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
