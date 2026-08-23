/**
 * City Shares UX / Data P0 regression tests (local, no deploy).
 * Run: node scripts/test-city-shares-ux-p0.mjs
 */
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import vm from 'vm';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
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

function loadBrowserScript(path) {
  const code = readFileSync(path, 'utf8');
  const sandbox = {
    window: {},
    globalThis: {},
    console,
    URL,
    document: {
      createElement: () => ({ style: {}, setAttribute() {}, classList: { add() {}, remove() {}, contains() { return false; } } }),
      getElementById: () => null,
      addEventListener() {},
      readyState: 'complete'
    },
    navigator: {},
    localStorage: { getItem() { return null; }, setItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    firebase: undefined,
    fetch: async () => ({ ok: true, json: async () => ({}) })
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  vm.runInNewContext(code, sandbox, { filename: path });
  return sandbox;
}

console.log('\n=== source wiring ===');
const uiSrc = readFileSync(join(root, 'city-shares-ui.js'), 'utf8');
const cssSrc = readFileSync(join(root, 'city-shares-ui.css'), 'utf8');
const fsSrc = readFileSync(join(root, 'city-shares-firestore.js'), 'utf8');

assert(cssSrc.includes('cs-page--no-media'), '1. no-media detail safe-area class');
assert(cssSrc.includes('safe-area-inset-top') && cssSrc.includes('4.75rem'), '1b. top spacer for no-media');
assert(cssSrc.includes('scroll-snap-type: x mandatory'), '2. scroll-snap carousel');
assert(cssSrc.includes('cs-media-carousel'), '3. carousel class');
assert(!cssSrc.includes('cs-detail-gallery--3'), '7. mosaic gallery CSS removed');
assert(uiSrc.includes('cs-media-carousel--detail'), '4. detail carousel markup');
assert(uiSrc.includes('openPhotoViewer'), '6. fullscreen viewer');
assert(uiSrc.includes('isSubmitting'), '8. submit lock');
assert(uiSrc.includes('clientPublishId'), '10. clientPublishId');
assert(uiSrc.includes('composePostId'), '10b. composePostId');
assert(fsSrc.includes('allocatePostId'), '10c. allocatePostId API');
assert(fsSrc.includes('clientPublishId'), '10d. persist clientPublishId');
assert(uiSrc.includes('isDeleting'), '16. delete lock');
assert(uiSrc.includes('貼文已刪除'), '13. optimistic delete toast');
assert(fsSrc.includes('R2 cleanup after delete failed'), '15. R2 cleanup failure log');
const deleteFn = fsSrc.slice(fsSrc.indexOf('function deletePost(postId)'), fsSrc.indexOf('function listComments'));
assert(
  deleteFn.indexOf("status: 'removed'") !== -1 &&
    deleteFn.indexOf("status: 'removed'") < deleteFn.indexOf('deletePostMediaAll(postId).catch'),
  '14/H. Firestore remove before R2 async'
);

console.log('\n=== dedupe + carousel helpers ===');
const sandbox = loadBrowserScript(join(root, 'city-shares-firestore.js'));
// feature flags needed
sandbox.SOARVIBE_FEATURE_FLAGS = { citySharesMediaUpload: true };
vm.runInNewContext(readFileSync(join(root, 'feature-flags.js'), 'utf8'), sandbox);
vm.runInNewContext(readFileSync(join(root, 'city-shares-firestore.js'), 'utf8'), sandbox);
vm.runInNewContext(readFileSync(join(root, 'city-shares-ui.js'), 'utf8'), sandbox);

const api = sandbox.SOARVIBE_CITY_SHARES_API;
const uiTest = sandbox.SOARVIBE_CITY_SHARES_UI_TEST;
assert(api && typeof api.dedupePostsById === 'function', '11. dedupePostsById exported');
const duped = api.dedupePostsById([
  { postId: 'a', title: '1' },
  { postId: 'a', title: '2' },
  { postId: 'b', title: '3' }
]);
assert(duped.length === 2 && duped.find((p) => p.postId === 'a').title === '2', '11b. same postId once (last wins)');

const list0 = uiTest.sortedMediaList({ media: [] });
assert(list0.length === 0, '18. 0 media ok');
const list1 = uiTest.sortedMediaList({
  media: [{ src: 'https://x/a.webp', sortOrder: 0 }]
});
assert(list1.length === 1, '2. 1 media list');
const list3 = uiTest.sortedMediaList({
  media: [
    { src: 'https://x/c.webp', sortOrder: 2 },
    { src: 'https://x/a.webp', sortOrder: 0 },
    { src: 'https://x/b.webp', sortOrder: 1 },
    { src: 'https://x/d.webp', sortOrder: 3 }
  ]
});
assert(list3.length === 3 && list3[0].src.indexOf('/a.webp') !== -1, '4/18. 3 media capped & ordered');

const html1 = uiTest.renderMediaGallery({ title: 't', media: list1 });
assert(html1.indexOf('cs-media-carousel') !== -1 && html1.indexOf('cs-detail-gallery') === -1, '2b. 1 image uses carousel not mosaic');
const html3 = uiTest.renderCarousel(list3, 't', { variant: 'detail' });
assert(html3.indexOf('data-cs-media-index="2"') !== -1, '4b. 3 slides');
assert(html3.indexOf('1 / 3') !== -1, '5. indicator counter present');
assert(html3.indexOf('cs-media-dot') !== -1, '5b. dots present');
assert(html3.indexOf('cs-detail-gallery--') === -1, '7b. no mosaic class in HTML');

console.log('\n=== submit / delete lock semantics ===');
assert(uiTest.isSubmitting() === false, '8b. initial not submitting');
uiTest.setSubmitting(true);
assert(uiTest.isSubmitting() === true, '8c. submitting flag set');
uiTest.setSubmitting(false);

assert(fsSrc.includes('idempotent') || fsSrc.includes('Idempotent') || fsSrc.includes('already published'), '9. idempotent existing post path');
assert(uiSrc.includes('a.deletePost(postId)') && uiSrc.indexOf("csState.view = 'feed'") < uiSrc.indexOf('a.deletePost(postId)'), '13b. UI leaves detail before await delete');

console.log('\n=== summary ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
