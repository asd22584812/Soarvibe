/**
 * Ticket / affiliate fail-closed hotfix regressions.
 * Run: node scripts/test-ticket-failclosed.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('OK', msg);
  } else {
    failed += 1;
    console.error('FAIL', msg);
  }
}

function extractFn(src, name) {
  let start = src.indexOf('async function ' + name + '(');
  if (start < 0) start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

function extractConstObj(src, name) {
  const start = src.indexOf('const ' + name + ' =');
  if (start < 0) throw new Error('missing ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed const ' + name);
}

console.log('=== Static contracts ===');
assert(!/kkdayProductUrl\(20376/.test(index) && !/product\/20376/.test(index), 'Hokkaido 20376 product URL removed');
assert(/KKDAY_FORBIDDEN_PRODUCT_IDS[\s\S]*'20376'/.test(index), '20376 remains only as forbidden guard');
assert(!/JR 北海道鐵路周遊券/.test(index), 'Hokkaido JR wrong title removed');
assert(!/catalog = \(KKDAY_TICKET_CATALOG\['東京'\]/.test(index), 'Tokyo catalog fallback removed');
assert(!/'巴黎':\s*'東京'/.test(index) && !/'倫敦':\s*'東京'/.test(index), 'Paris/London→Tokyo alias removed');
assert(/目前尚無已驗證票券推薦/.test(index), 'empty state copy present');
assert(/KKDAY_FORBIDDEN_PRODUCT_IDS/.test(index), 'forbidden product guard present');
assert(/function isTicketRegionSafe\(/.test(index), 'region-safe guard present');
assert(/function openAffiliateUrl\(/.test(index) && /data-soarvibe-affiliate-nav/.test(index), 'iOS affiliate <a> nav present');
assert(/appendKkdayCid\(/.test(index) && /KKDAY_CID/.test(index), 'cid affiliate retained');
assert(!/window\.open\(appendKkdayCid\(url\),\s*'_blank'\)\s*;\s*\}/.test(index), 'raw window.open(_blank) affiliate path replaced');

console.log('\n=== Runtime catalog behavior ===');
const sandbox = {
  console,
  KKDAY_CID: '25299',
  currentItineraryMeta: null,
  destinationInput: { value: '' },
  currentTripHiddenData: null,
  currentItineraryMarkdown: '',
  aiContent: { classList: { contains: () => true }, innerText: '', textContent: '' },
  CITY_GEO_PROFILE: null,
  REGION_PROFILE: null,
  matchDestinationCurrency: null,
  extractAllAttractionsFromItinerary: () => [],
  resolveCurrentCity: function () { return sandbox.__city; },
  getCurrentTripRegion: function () { return sandbox.__city; },
  getRegionProfile: function () {
    const city = sandbox.__city;
    if (sandbox.REGION_PROFILE[city]) return sandbox.REGION_PROFILE[city];
    const matched = sandbox.matchDestinationCurrency(city);
    if (matched) return matched;
    return { country: city, currency: 'USD', currencyName: '美元', waysimQuery: city + ' eSIM' };
  },
  getCityGeoProfile: function (city) {
    const c = city || sandbox.__city;
    if (sandbox.CITY_GEO_PROFILE[c]) return sandbox.CITY_GEO_PROFILE[c];
    const alias = sandbox.KKDAY_CITY_CATALOG_ALIAS[c];
    if (alias && sandbox.CITY_GEO_PROFILE[alias]) return sandbox.CITY_GEO_PROFILE[alias];
    return sandbox.CITY_GEO_PROFILE['東京'];
  },
  kkdayProductUrl(productId, slug) {
    const base = 'https://www.kkday.com/zh-tw/product/' + productId;
    return slug ? base + '-' + slug : base;
  },
  __city: '東京'
};

vm.createContext(sandbox);
vm.runInContext(
  extractConstObj(index, 'CITY_GEO_PROFILE') + ';\n' +
  extractConstObj(index, 'KKDAY_TICKET_CATALOG') + ';\n' +
  extractConstObj(index, 'KKDAY_COUNTRY_TICKETS') + ';\n' +
  extractConstObj(index, 'KKDAY_ESIM_CATALOG') + ';\n' +
  extractConstObj(index, 'KKDAY_CITY_CATALOG_ALIAS') + ';\n' +
  extractConstObj(index, 'KKDAY_FORBIDDEN_PRODUCT_IDS') + ';\n' +
  extractConstObj(index, 'KKDAY_CITY_TO_COUNTRY') + ';\n' +
  'this.CITY_GEO_PROFILE = CITY_GEO_PROFILE;\n' +
  'this.KKDAY_TICKET_CATALOG = KKDAY_TICKET_CATALOG;\n' +
  'this.KKDAY_COUNTRY_TICKETS = KKDAY_COUNTRY_TICKETS;\n' +
  'this.KKDAY_ESIM_CATALOG = KKDAY_ESIM_CATALOG;\n' +
  'this.KKDAY_CITY_CATALOG_ALIAS = KKDAY_CITY_CATALOG_ALIAS;\n' +
  'this.KKDAY_FORBIDDEN_PRODUCT_IDS = KKDAY_FORBIDDEN_PRODUCT_IDS;\n' +
  'this.KKDAY_CITY_TO_COUNTRY = KKDAY_CITY_TO_COUNTRY;\n' +
  extractFn(index, 'appendKkdayCid') + '\n' +
  extractFn(index, 'extractKkdayProductId') + '\n' +
  extractFn(index, 'resolveTicketDestinationCountry') + '\n' +
  extractFn(index, 'resolveTicketCatalogCity') + '\n' +
  extractFn(index, 'isKkdaySingleProductUrl') + '\n' +
  extractFn(index, 'isTicketRegionSafe') + '\n' +
  extractFn(index, 'getKkdayTicketCatalogForCity') + '\n' +
  extractFn(index, 'buildKkdayTicketsForTrip') + '\n' +
  extractFn(index, 'openAffiliateUrl') + '\n',
  sandbox
);

sandbox.REGION_PROFILE = {
  東京: { country: '日本' },
  大阪: { country: '日本' },
  北海道: { country: '日本' },
  首爾: { country: '韓國' },
  巴黎: { country: '法國' },
  倫敦: { country: '英國' },
  香港: { country: '香港' }
};
sandbox.matchDestinationCurrency = function (raw) {
  const t = String(raw || '');
  if (/台灣|台湾|Taiwan|台北/i.test(t)) return { country: '台灣' };
  if (/香港|Hong\s*Kong/i.test(t)) return { country: '香港' };
  if (/巴黎|France|Paris/i.test(t)) return { country: '法國' };
  if (/倫敦|London|UK/i.test(t)) return { country: '英國' };
  if (/東京|大阪|京都|北海道|日本|Japan/i.test(t)) return { country: '日本' };
  if (/首爾|韓國|Korea/i.test(t)) return { country: '韓國' };
  if (/福岡|九州|名古屋/i.test(t)) return { country: '日本' };
  return null;
};

function titlesFor(city) {
  sandbox.__city = city;
  return sandbox.buildKkdayTicketsForTrip(city).map((t) => t.title + '|' + t.productUrl);
}

const hokkaido = titlesFor('北海道');
assert(hokkaido.every((t) => !/20376/.test(t)), 'Hokkaido tickets exclude 20376');
assert(hokkaido.every((t) => !/JR 北海道鐵路周遊券/.test(t)), 'Hokkaido wrong JR title gone');
assert(hokkaido.some((t) => /旭山|電視塔|富良野/.test(t)), 'Hokkaido keeps verified local tickets');

const paris = titlesFor('巴黎');
assert(paris.every((t) => !/東京|SHIBUYA|迪士尼|Suica|teamLab/i.test(t)), 'Paris has no Tokyo tickets');
assert(paris.length === 0, 'Paris empty without verified catalog');

const london = titlesFor('倫敦');
assert(london.length === 0 && london.every((t) => !/東京/.test(t)), 'London empty / no Tokyo');

sandbox.__city = '台灣';
const taiwan = sandbox.buildKkdayTicketsForTrip('台灣');
assert(taiwan.length === 0, 'Taiwan empty — no Japan tickets');
assert(taiwan.every((t) => !/日本|東京|JR Pass|Suica/i.test(JSON.stringify(t))), 'Taiwan no Japan product rows');

sandbox.__city = '香港';
const hk = sandbox.buildKkdayTicketsForTrip('香港');
assert(hk.length === 0, 'Hong Kong empty — no Tokyo tickets');

sandbox.__city = 'Unknownville';
const unknown = sandbox.buildKkdayTicketsForTrip('Unknownville');
assert(unknown.length === 0, 'unknown destination no Tokyo fallback');

const seoul = titlesFor('首爾');
assert(seoul.length > 0 && seoul.some((t) => /樂天|T-money|景福|愛寶/i.test(t)), 'Seoul region-safe catalog still works');

const tokyo = titlesFor('東京');
assert(tokyo.length > 0 && tokyo.some((t) => /SHIBUYA|迪士尼|Metro/i.test(t)), 'Tokyo catalog still works');
assert(tokyo.every((u) => {
  const url = u.split('|')[1] || '';
  return !url || /[?&]cid=25299/.test(sandbox.appendKkdayCid(url.replace(/\?cid=25299$/, '').replace(/&cid=25299$/, ''))) || true;
}), 'appendKkdayCid available');

const sample = sandbox.buildKkdayTicketsForTrip('東京')[0];
assert(sample && /cid=25299/.test(sandbox.appendKkdayCid(sample.productUrl)), 'retained URLs get cid');

console.log('\n=== iOS nav contract ===');
assert(/isStandalone/.test(extractFn(index, 'openAffiliateUrl')), 'standalone branch in openAffiliateUrl');
assert(/target = '_blank'/.test(extractFn(index, 'openAffiliateUrl')), 'uses target=_blank anchor');
assert(/noopener/.test(extractFn(index, 'openAffiliateUrl')), 'noopener on affiliate nav');

console.log('\n=== Empty state wiring ===');
assert(/目前尚無已驗證票券推薦/.test(index) && /if \(!items\.length\)/.test(index), 'ticket panel empty state branch');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
