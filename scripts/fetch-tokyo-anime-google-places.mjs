/**
 * Editorial build: Tokyo Anime — article-first photo matching + dynamic captions.
 * Usage: node scripts/fetch-tokyo-anime-google-places.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'city-journal-data.js');
const OUT_JSON = path.join(__dirname, 'tokyo-anime-google-places.json');

const API_BASE = String(process.env.SOARVIBE_API_BASE || 'https://soarvibe-api.soarvibe.workers.dev').replace(/\/$/, '');
const ORIGIN = String(process.env.SOARVIBE_ORIGIN || 'https://asd22584812.github.io');

const HERO_QUERY = {
  sectionId: 'hero-anime',
  subject: '秋葉原電氣街',
  mapsQuery: 'Radio Kaikan Akihabara Tokyo',
  role: 'hero',
  sectionType: 'landmark',
  visualKeywords: ['Radio Kaikan', 'Animate', '秋葉原', '霓虹', '中央通', '動漫', '電氣街'],
  photoQueries: ['Radio Kaikan Akihabara Tokyo', 'Animate Akihabara Tokyo', 'Akihabara Chuo-dori Tokyo']
};

const SECTION_QUERIES = [
  {
    sectionId: 'akihabara',
    subject: '秋葉原電氣街',
    mapsQuery: 'Akihabara Electric Town Tokyo Japan',
    sectionType: 'landmark',
    role: 'section',
    visualKeywords: ['動漫', '霓虹', 'Animate', 'Radio Kaikan', '中央通', '招牌', '秋葉原', '電氣街'],
    photoQueries: ['Animate Akihabara Tokyo', 'Radio Kaikan Akihabara Tokyo', 'Akihabara Chuo-dori neon Tokyo']
  },
  {
    sectionId: 'nakano',
    subject: '中野百老匯',
    mapsQuery: 'Nakano Broadway Tokyo Japan',
    sectionType: 'landmark',
    role: 'section',
    visualKeywords: ['中野百老匯', 'Nakano Broadway', '公仔', '模型', '復古玩具', '漫畫'],
    photoQueries: ['Nakano Broadway Tokyo Japan']
  },
  {
    sectionId: 'gachapon',
    subject: 'GACHAPON 扭蛋會館',
    mapsQuery: 'Gachapon Kaikan Akihabara Tokyo',
    sectionType: 'shopping',
    role: 'section',
    visualKeywords: ['扭蛋', 'GACHAPON', '轉蛋', '機台', 'capsule'],
    photoQueries: ['Gachapon Kaikan Akihabara Tokyo']
  },
  {
    sectionId: 'ichiran',
    subject: '田中そば店 秋葉原店',
    mapsQuery: '田中そば店 秋葉原店',
    placeId: 'ChIJXTeLYx6MGGARNivhJ55nYVw',
    sectionType: 'food',
    role: 'section',
    visualKeywords: ['拉麵', '醬油', '湯頭', '田中そば', 'soba', 'ramen'],
    photoQueries: ['田中そば店 秋葉原店']
  },
  {
    sectionId: 'maid-cafe',
    subject: '女僕咖啡廳 秋葉原',
    mapsQuery: 'Maid Cafe Akihabara Tokyo',
    sectionType: 'cafe',
    role: 'section',
    visualKeywords: ['女僕', '咖啡', '甜點', 'maid', '主題咖啡'],
    photoQueries: ['MAID MADE Akihabara Tokyo']
  },
  {
    sectionId: 'hotel-gracery',
    subject: '秋葉原ワシントンホテル',
    mapsQuery: 'Akihabara Washington Hotel Tokyo',
    placeId: 'ChIJnxZoFqiOGGAReYJ1ck2lXiw',
    sectionType: 'hotel',
    role: 'section',
    visualKeywords: ['飯店', '外觀', '秋葉原', '華盛頓', 'Washington Hotel'],
    photoQueries: ['Akihabara Washington Hotel Tokyo']
  },
  {
    sectionId: 'nui-hostel',
    subject: 'Nui Hostel Tokyo',
    mapsQuery: 'Nui Hostel & Bar Tokyo',
    sectionType: 'hostel',
    role: 'section',
    visualKeywords: ['hostel', '旅館', '吧台', '交誼廳', 'Nui'],
    photoQueries: ['Nui Hostel Bar Lounge Tokyo']
  }
];

function jsString(value) {
  if (value == null) return 'null';
  if (typeof value === 'number') return String(value);
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function patchField(src, key, val, withinStart, withinEnd) {
  const block = src.slice(withinStart, withinEnd);
  const fieldRe = new RegExp('(\\n\\s*' + key + ':\\s*)(null|\'(?:\\\\.|[^\'])*\'|\\[[^\\]]*\\])(,)?');
  if (!fieldRe.test(block)) return src;
  const next = block.replace(fieldRe, function (_m, prefix, _old, suffix) {
    return prefix + val + (suffix || ',');
  });
  return src.slice(0, withinStart) + next + src.slice(withinEnd);
}

function patchSectionRow(src, row) {
  const marker = "sectionId: '" + row.sectionId + "'";
  const start = src.indexOf(marker);
  if (start === -1) {
    console.warn('[SKIP] section not found:', row.sectionId);
    return src;
  }
  const blockEnd = src.indexOf('},', start);
  if (blockEnd === -1) return src;
  const fields = ['subject', 'mapsQuery', 'placeId', 'googleRating', 'googleAddress', 'googlePhotoUrl', 'googleAttribution', 'imageSource', 'caption'];
  let out = src;
  for (const key of fields) {
    const val = key === 'caption' && row.photoCaption ? jsString(row.photoCaption) : jsString(row[key]);
    out = patchField(out, key, val, start, blockEnd);
  }
  return out;
}

function patchHeroFields(src, row) {
  const heroFields = {
    heroSubject: row.subject,
    heroMapsQuery: row.mapsQuery,
    heroPlaceId: row.placeId,
    heroGooglePhotoUrl: row.googlePhotoUrl,
    heroGoogleAttribution: row.googleAttribution,
    heroImageSource: row.imageSource,
    coverPlaceId: row.placeId,
    coverGooglePhotoUrl: row.googlePhotoUrl,
    coverGoogleAttribution: row.googleAttribution,
    coverImageSource: row.imageSource
  };
  let out = src;
  for (const [key, value] of Object.entries(heroFields)) {
    const val = jsString(value);
    const fieldRe = new RegExp('(\\n\\s*' + key + ':\\s*)(null|\'(?:\\\\.|[^\'])*\')(,)?');
    out = out.replace(fieldRe, function (_m, prefix, _old, suffix) {
      return prefix + val + (suffix || ',');
    });
  }
  return out;
}

async function resolveAll() {
  const payload = SECTION_QUERIES.concat([HERO_QUERY]);
  const response = await fetch(API_BASE + '/api/places/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ sections: payload })
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Worker places resolve failed: ' + JSON.stringify(data));
  return data.results || [];
}

async function main() {
  const results = await resolveAll();
  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2), 'utf8');
  console.log('[WROTE]', OUT_JSON);

  let src = fs.readFileSync(DATA_PATH, 'utf8');
  const hero = results.find(function (r) { return r.sectionId === 'hero-anime'; });
  const sections = results.filter(function (r) { return r.sectionId !== 'hero-anime'; });

  for (const row of sections) {
    const cap = row.photoCaption ? ' caption:' + row.photoCaption.slice(0, 28) + '…' : '';
    console.log(row.sectionId, row.matched ? 'OK' : 'PLACEHOLDER', row.placeName || '', row.photoScore != null ? 'score:' + row.photoScore : '', cap);
    src = patchSectionRow(src, row);
  }
  if (hero && hero.googlePhotoUrl) {
    console.log('hero-anime OK', hero.placeName, 'score:' + hero.photoScore);
    src = patchHeroFields(src, hero);
  } else {
    console.warn('[HERO] no scored hero photo — keep existing hero or library fallback');
  }
  fs.writeFileSync(DATA_PATH, src, 'utf8');
  console.log('[PATCHED]', DATA_PATH);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
