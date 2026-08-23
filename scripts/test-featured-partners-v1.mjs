/**
 * SoarVibe Featured Partners v1 tests.
 * Run: node scripts/test-featured-partners-v1.mjs
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

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

function makeDom() {
  const nodes = new Map();
  function el(tag, id) {
    const classList = {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); }
    };
    const node = {
      tagName: String(tag).toUpperCase(),
      id: id || '',
      className: '',
      classList,
      style: {},
      children: [],
      attributes: {},
      listeners: {},
      textContent: '',
      innerHTML: '',
      href: '',
      target: '',
      rel: '',
      src: '',
      alt: '',
      loading: '',
      decoding: '',
      scrollTop: 0,
      parentNode: null,
      firstChild: null,
      __featuredBound: false,
      __featuredEscBound: false,
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k] == null ? null : this.attributes[k]; },
      removeAttribute(k) { delete this.attributes[k]; },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        this.firstChild = this.children[0] || null;
        return child;
      },
      removeChild(child) {
        this.children = this.children.filter((c) => c !== child);
        this.firstChild = this.children[0] || null;
        return child;
      },
      addEventListener(type, fn) {
        (this.listeners[type] || (this.listeners[type] = [])).push(fn);
      },
      removeEventListener(type, fn) {
        this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
      },
      focus() {},
      querySelectorAll() { return []; },
      querySelector() { return null; }
    };
    if (id) nodes.set(id, node);
    return node;
  }

  const shell = el('div', 'soarvibeFeatured');
  shell.classList.add('hidden');
  shell.setAttribute('aria-hidden', 'true');
  const viewport = el('main', 'featuredViewport');
  const content = el('div', 'featuredContent');
  const closeBtn = el('button', 'featuredCloseBtn');
  viewport.appendChild(content);
  shell.appendChild(viewport);

  const document = {
    readyState: 'complete',
    documentElement: { classList: { add() {}, remove() {} } },
    body: {
      classList: { add() {}, remove() {} },
      style: {}
    },
    getElementById(id) { return nodes.get(id) || null; },
    createElement(tag) { return el(tag); },
    addEventListener() {}
  };

  return { document, shell, viewport, content, closeBtn, nodes };
}

function loadFeatured(extra) {
  const dom = makeDom();
  const sandbox = {
    console,
    window: {},
    globalThis: {},
    document: dom.document,
    location: { href: 'https://soarvibe.local/', search: '' },
    URL,
    scrollY: 0,
    pageYOffset: 0,
    scrollTo() {},
    __FEATURED_USE_FIXTURES__: false,
    ...(extra || {})
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  if (extra && extra.__FEATURED_USE_FIXTURES__) {
    sandbox.__FEATURED_USE_FIXTURES__ = true;
  }
  vm.runInNewContext(
    readFileSync(join(root, 'featured-partners.js'), 'utf8'),
    sandbox,
    { filename: 'featured-partners.js' }
  );
  return { api: sandbox.SOARVIBE_FEATURED, sandbox, dom };
}

console.log('\n=== source wiring ===');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const featuredJs = readFileSync(join(root, 'featured-partners.js'), 'utf8');
const featuredCss = readFileSync(join(root, 'featured-partners.css'), 'utf8');
const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');

assert(indexHtml.includes('id="nav-featured"') || indexHtml.includes('data-affiliate-type="featured"'), 'homepage has featured entry');
assert(/精選/.test(indexHtml) && /nav-featured|data-affiliate-type="featured"/.test(indexHtml), 'featured entry label 精選');
assert(!/data-affiliate-type="featured"/.test(indexHtml), 'featured not in tool panel (bottom nav only)');
assert(/id="nav-featured"/.test(indexHtml), 'featured in bottom nav');
assert(indexHtml.includes('id="soarvibeFeatured"'), 'featured modal shell in index');
assert(indexHtml.includes('id="featuredContent"'), 'featured content container');
assert(indexHtml.includes('featured-partners.js'), 'featured JS wired');
assert(indexHtml.includes('featured-partners.css'), 'featured CSS wired');
assert(indexHtml.includes('openFeaturedModal'), 'openFeaturedModal wired');
assert(featuredJs.includes('function openFeaturedModal') || featuredJs.includes('openFeaturedModal:'), 'openFeaturedModal exists');
assert(featuredJs.includes('function closeFeaturedModal') || featuredJs.includes('closeFeaturedModal:'), 'closeFeaturedModal exists');
assert(featuredCss.includes('safe-area-inset'), 'safe-area CSS');
assert(featuredCss.includes('max-width: 560px'), 'desktop content max-width');
assert(sw.includes('./featured-partners.js'), 'SW precaches featured JS');
assert(sw.includes('./featured-partners.css'), 'SW precaches featured CSS');

console.log('\n=== City Journal isolation ===');
assert(indexHtml.includes('id="cityJournal"'), 'City Journal still present');
assert(indexHtml.includes('openCityJournal') || indexHtml.includes('function openCityJournal'), 'City Journal open still present');
assert(!featuredJs.includes('cityJournal'), 'featured JS does not touch cityJournal id');
assert(!featuredJs.includes('openMagazine'), 'featured JS does not call openMagazine');
assert(!featuredJs.includes('openCityJournal'), 'featured JS does not call openCityJournal');

console.log('\n=== production Tokyo demo banners ===');
{
  const { api } = loadFeatured();
  assert(api.FEATURED_PARTNERS_PRODUCTION.length === 3, 'production has 3 Tokyo demo banners');
  assert(api.FEATURED_PARTNERS_PRODUCTION.every((p) => p.isDemo === true), 'production partners marked isDemo');
  assert(api.getActivePartners().length === 3, 'prod active list = 3');
  assert(api.getActivePartners().every((p) => /DEMO|合作版位示意/.test(p.sponsorLabel || '')), 'DEMO label present');
  assert(api.getActivePartners().every((p) => !/Partner A|Partner B|TEST Partner/i.test(p.name)), 'no Partner A/B TEST names');
  assert(api.getActivePartners().every((p) => p.url && p.ctaLabel && ('deepLink' in p)), 'url + cta + deepLink fields');
  assert(api.forbidsItineraryInjection === true, 'forbidsItineraryInjection guard');
}
{
  const { api, sandbox, dom } = loadFeatured({ __FEATURED_USE_FIXTURES__: true });
  const active = api.getActivePartners();
  assert(active.length === 4, 'fixtures: 4 active (inactive hidden)');
  assert(active.every((p) => p.active === true), 'fixtures: only active');
  assert(active[0].id === 'tokyo-experiences-demo', 'sortOrder starts with experiences');
  assert(!active.some((p) => p.id === 'fixture-inactive'), 'inactive hidden');

  api.openFeaturedModal();
  assert(!dom.shell.classList.contains('hidden'), 'click/open removes hidden');
  assert(dom.shell.getAttribute('aria-hidden') === 'false', 'aria-hidden false when open');

  const htmlDump = JSON.stringify(dom.content.children.map(function walk(n) {
    return {
      tag: n.tagName,
      className: n.className,
      text: n.textContent,
      href: n.href,
      target: n.target,
      rel: n.rel,
      children: (n.children || []).map(walk)
    };
  }));
  assert(htmlDump.includes('TripNest') || htmlDump.includes('東京熱門體驗'), 'renders Tokyo experience banner');
  assert(htmlDump.includes('DEMO・合作版位示意') || htmlDump.includes('DEMO'), 'demo disclosure supported');
  assert(htmlDump.includes('並非已正式簽約') || htmlDump.includes('合作版位示意'), 'demo notice shown');
  assert(htmlDump.includes('noopener noreferrer'), 'noopener noreferrer on external links');
  assert(htmlDump.includes('kkday.com') || htmlDump.includes('waysim.net'), 'external URL wired safely');
  assert(!htmlDump.includes('已下架合作 D'), 'inactive not rendered');
  assert(!htmlDump.includes('Partner A'), 'Partner A gone');

  api.closeFeaturedModal();
  assert(dom.shell.classList.contains('hidden'), 'close works');
  assert(dom.shell.getAttribute('aria-hidden') === 'true', 'aria-hidden true when closed');

  sandbox.__FEATURED_PARTNERS_OVERRIDE__ = [];
  api.openFeaturedModal();
  function collectText(n, out) {
    if (n.textContent) out.push(String(n.textContent));
    (n.children || []).forEach(function (c) { collectText(c, out); });
  }
  const emptyTexts = [];
  collectText(dom.content, emptyTexts);
  assert(emptyTexts.join(' ').includes('精選內容準備中'), 'empty state works');
}

console.log('\n=== URL safety / broken image / missing desc ===');
{
  const { api, sandbox, dom } = loadFeatured();
  assert(api.isSafeHttpUrl('https://ok.example') === true, 'https url ok');
  assert(api.isSafeHttpUrl('http://ok.example') === true, 'http url ok');
  assert(api.isSafeHttpUrl('javascript:alert(1)') === false, 'javascript: blocked');
  assert(api.isSafeHttpUrl('') === false, 'empty url blocked');

  sandbox.__FEATURED_PARTNERS_OVERRIDE__ = [
    {
      id: 'bad-url',
      name: '無連結品牌',
      description: '仍可閱讀',
      image: './broken.webp',
      url: 'javascript:alert(1)',
      active: true,
      sortOrder: 1,
      sponsored: false,
      affiliate: false
    },
    {
      id: 'no-desc',
      name: '只有名稱',
      description: '',
      image: './cover-photos/default.jpg',
      url: 'https://example.com/ok',
      active: true,
      sortOrder: 2
    }
  ];
  api.openFeaturedModal();
  const cards = [];
  function findCards(n) {
    if (String(n.className || '').split(/\s+/).includes('featured-partner-card')) cards.push(n);
    (n.children || []).forEach(findCards);
  }
  findCards(dom.content);
  assert(cards.length === 2, 'two cards for override');
  assert(cards[0].tagName === 'BUTTON' || cards[0].tagName === 'DIV', 'invalid URL renders non-link card');
  assert(cards[1].tagName === 'A', 'valid URL renders anchor');
  assert(cards[1].rel === 'noopener noreferrer' && cards[1].target === '_blank', 'safe link attrs');

  const img = cards[0].children[0] && cards[0].children[0].children[0];
  assert(img && img.tagName === 'IMG', 'image node present');
  assert(Array.isArray(img.listeners.error) && img.listeners.error.length > 0, 'broken image fallback handler bound');
  img.listeners.error[0]();
  assert(cards[0].children[0].classList.contains('is-fallback'), 'broken image fallback applied');
  assert(
    cards[0].children[0].children.some((c) => String(c.className || '').includes('featured-partner-fallback')),
    'fallback shows brand name container'
  );
}

console.log('\n=== no itinerary injection (static scan) ===');
const geminiFiles = [
  'index.html',
  'itinerary-planner-v2.js',
  'itinerary-style-engine.js',
  'itinerary-time-integrity.js'
];
geminiFiles.forEach(function (f) {
  const src = readFileSync(join(root, f), 'utf8');
  const mentionsFeaturedData =
    /featuredPartners|FEATURED_PARTNERS|SOARVIBE_FEATURED\.getActivePartners|getActivePartners\(\)/.test(src) &&
    f !== 'index.html';
  if (f === 'index.html') {
    assert(!/buildGemini[\s\S]{0,200}FEATURED|FEATURED[\s\S]{0,200}buildGemini/.test(src), 'index: featured not in Gemini builders');
    assert(!src.includes('SOARVIBE_FEATURED.getActivePartners'), 'index: featured partners not read into itinerary');
  } else {
    assert(!src.includes('featuredPartners') && !src.includes('SOARVIBE_FEATURED') && !src.includes('FEATURED_PARTNERS'), f + ': no featured data');
  }
});
assert(!featuredJs.includes('buildGemini'), 'featured JS has no Gemini builders');
assert(!featuredJs.includes('planHiddenItinerary'), 'featured JS has no Planner');
assert(!featuredJs.includes('applyStyleEngine'), 'featured JS has no Style Engine');
assert(!featuredJs.includes('gtag') && !featuredJs.includes('fbq') && !featuredJs.includes('analytics'), 'no tracking SDK in featured v1');
assert(!featuredJs.includes('firebase.firestore') && !featuredJs.includes('fetch('), 'featured UI has no direct firestore/fetch (data layer owns it)');
assert(!/buildGemini|SOARVIBE_FEATURED_PARTNERS_PRODUCTION/.test(readFileSync(join(root, 'itinerary-planner-v2.js'), 'utf8')), 'planner still isolated');

console.log('\n=== existing homepage functions remain ===');
assert(indexHtml.includes('data-affiliate-type="attractions"'), '票券 intact');
assert(indexHtml.includes('data-affiliate-type="travel-ledger"'), '旅行帳本 intact');
assert(indexHtml.includes('data-affiliate-type="forex"'), '匯率 intact');
assert(indexHtml.includes('data-affiliate-type="foodspot"'), '地圖 intact');
assert(indexHtml.includes("type === 'travel-ledger'"), 'travel-ledger handler intact');

console.log('\n=== RESULT ===');
console.log('passed=' + passed + ' failed=' + failed);
if (failed) process.exit(1);
