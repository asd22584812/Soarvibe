/**
 * Editorial build: Tokyo Anime — strict official-name Places resolution.
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

const LANDMARK_TYPES = ['tourist_attraction', 'route', 'establishment', 'shopping_district', 'point_of_interest', 'neighborhood', 'locality'];
const LANDMARK_DENIED = ['lodging', 'movie_theater', 'apartment', 'restaurant', 'cafe', 'bar', 'hostel'];
const AKIHABARA_ATTR_DENY = ['cinema neon', 'シネマネオン', 'ポッド', 'pod', '映画館', 'movie theater'];

const HERO_QUERY = {
  sectionId: 'hero-anime',
  subject: '秋葉原電氣街',
  officialName: 'Radio Kaikan',
  officialNameLocal: 'ラジオ会館',
  mapsQuery: 'Radio Kaikan Akihabara Tokyo',
  placeId: 'ChIJ__-AdayOGGAR6EGPwvcpzTA',
  role: 'hero',
  sectionType: 'landmark',
  isSpecificVenue: true,
  addressHints: ['秋葉原', 'Akihabara', 'Sotokanda'],
  allowedPlaceTypes: LANDMARK_TYPES.concat(['shopping_mall', 'store']),
  deniedPlaceTypes: ['lodging', 'movie_theater', 'apartment', 'hostel'],
  visualKeywords: ['Radio Kaikan', 'ラジオ会館', '秋葉原', '霓虹', '中央通', '動漫']
};

const SECTION_QUERIES = [
  {
    sectionId: 'akihabara',
    subject: '秋葉原電氣街',
    officialName: 'Akihabara Electric Town',
    officialNameLocal: '秋葉原電気街',
    mapsQuery: 'Akihabara Electric Town Tokyo Japan',
    placeId: 'ChIJzdWdgh2MGGARh4kg2pVZL3c',
    sectionType: 'landmark',
    role: 'section',
    addressHints: ['秋葉原', 'Akihabara', '秋葉原駅', 'Sotokanda', 'Chiyoda'],
    allowedPlaceTypes: LANDMARK_TYPES,
    deniedPlaceTypes: LANDMARK_DENIED,
    deniedAttributionPatterns: AKIHABARA_ATTR_DENY,
    visualKeywords: ['動漫', '霓虹', 'Animate', 'Radio Kaikan', '中央通', '招牌', '秋葉原', '電氣街']
  },
  {
    sectionId: 'nakano',
    subject: '中野百老匯',
    officialName: 'Nakano Broadway',
    officialNameLocal: '中野ブロードウェイ',
    mapsQuery: 'Nakano Broadway Tokyo Japan',
    placeId: 'ChIJg-7dspDyGGARvvDv4E5-tuE',
    sectionType: 'landmark',
    role: 'section',
    addressHints: ['中野', 'Nakano', 'Nakano City'],
    allowedPlaceTypes: LANDMARK_TYPES.concat(['shopping_mall', 'store']),
    deniedPlaceTypes: LANDMARK_DENIED,
    visualKeywords: ['中野百老匯', 'Nakano Broadway', '公仔', '模型', '復古玩具', '漫畫']
  },
  {
    sectionId: 'gachapon',
    subject: 'GACHAPON 扭蛋會館',
    officialName: 'Akihabara Gachapon Hall',
    officialNameLocal: '秋葉原ガチャポン会館',
    mapsQuery: 'Gachapon Kaikan Akihabara Tokyo',
    placeId: 'ChIJBztW3x2MGGARadHYl5vTEK0',
    sectionType: 'shopping',
    role: 'section',
    isSpecificVenue: true,
    addressHints: ['秋葉原', 'Akihabara', 'Sotokanda'],
    allowedPlaceTypes: ['store', 'shopping_mall', 'point_of_interest', 'establishment'],
    deniedPlaceTypes: ['lodging', 'movie_theater', 'restaurant', 'cafe'],
    visualKeywords: ['扭蛋', 'GACHAPON', '轉蛋', '機台', 'capsule', 'ガチャ']
  },
  {
    sectionId: 'ichiran',
    subject: '田中そば店 秋葉原店',
    officialName: 'Ramen Tanaka Soba Akihabara',
    officialNameLocal: '田中そば店 秋葉原店',
    mapsQuery: '田中そば店 秋葉原店',
    placeId: 'ChIJXTeLYx6MGGARNivhJ55nYVw',
    sectionType: 'food',
    role: 'section',
    isSpecificVenue: true,
    addressHints: ['秋葉原', 'Akihabara', 'Sotokanda'],
    allowedPlaceTypes: ['restaurant', 'food', 'meal_takeaway', 'ramen_restaurant', 'establishment'],
    deniedPlaceTypes: ['lodging', 'movie_theater', 'hostel'],
    visualKeywords: ['拉麵', '醬油', '湯頭', '田中そば', 'soba', 'ramen']
  },
  {
    sectionId: 'maid-cafe',
    subject: '女僕咖啡廳 秋葉原',
    officialName: 'MAID MADE Akihabara',
    officialNameLocal: 'メイドメイド秋葉原駅前店',
    mapsQuery: 'MAID MADE Akihabara Tokyo',
    placeId: 'ChIJvQtxBAaNGGARTiTMJ-Nzhvc',
    sectionType: 'cafe',
    role: 'section',
    isSpecificVenue: true,
    addressHints: ['秋葉原', 'Akihabara'],
    allowedPlaceTypes: ['cafe', 'restaurant', 'food', 'establishment', 'point_of_interest'],
    deniedPlaceTypes: ['lodging', 'movie_theater', 'hostel'],
    visualKeywords: ['女僕', '咖啡', '甜點', 'maid', '主題咖啡', 'メイド']
  },
  {
    sectionId: 'hotel-gracery',
    subject: '秋葉原ワシントンホテル',
    officialName: 'Akihabara Washington Hotel',
    officialNameLocal: '秋葉原ワシントンホテル',
    mapsQuery: 'Akihabara Washington Hotel Tokyo',
    placeId: 'ChIJnxZoFqiOGGAReYJ1ck2lXiw',
    sectionType: 'hotel',
    role: 'section',
    isSpecificVenue: true,
    addressHints: ['秋葉原', 'Akihabara', 'Sakumacho'],
    allowedPlaceTypes: ['lodging', 'hotel', 'establishment'],
    deniedPlaceTypes: ['movie_theater', 'restaurant', 'cafe'],
    visualKeywords: ['飯店', '外觀', '秋葉原', '華盛頓', 'Washington Hotel', 'ワシントン']
  },
  {
    sectionId: 'nui-hostel',
    subject: 'Nui Hostel Tokyo',
    officialName: 'Nui. Hostel & Bar Lounge',
    officialNameLocal: 'Nui. HOSTEL & BAR LOUNGE',
    mapsQuery: 'Nui Hostel & Bar Tokyo',
    placeId: 'ChIJ4U-9KsiOGGARARhaBLZLqS0',
    sectionType: 'hostel',
    role: 'section',
    isSpecificVenue: true,
    addressHints: ['蔵前', 'Kuramae', '淺草橋'],
    allowedPlaceTypes: ['lodging', 'hostel', 'hotel', 'establishment'],
    deniedPlaceTypes: ['movie_theater'],
    visualKeywords: ['hostel', '旅館', '吧台', '交誼廳', 'Nui']
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
  const fields = ['officialName', 'officialNameLocal', 'subject', 'mapsQuery', 'placeId', 'googleRating', 'googleAddress', 'googlePhotoUrl', 'googleAttribution', 'imageSource', 'caption'];
  let out = src;
  for (const key of fields) {
    let val;
    if (key === 'caption' && row.photoCaption) val = jsString(row.photoCaption);
    else if (key === 'googlePhotoUrl' && !row.googlePhotoUrl) val = 'null';
    else if (key === 'googleAttribution' && !row.googleAttribution) val = 'null';
    else if (key === 'imageSource' && !row.imageSource) val = 'null';
    else val = jsString(row[key]);
    out = patchField(out, key, val, start, blockEnd);
  }
  return out;
}

function patchHeroFields(src, row) {
  const heroFields = {
    heroSubject: row.subject,
    heroOfficialName: row.officialName,
    heroOfficialNameLocal: row.officialNameLocal,
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
    if (!fieldRe.test(out)) continue;
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
    const attr = row.googleAttribution ? ' attr:' + row.googleAttribution.slice(0, 24) : '';
    const cap = row.photoCaption ? ' caption:' + row.photoCaption.slice(0, 24) + '…' : '';
  console.log(row.sectionId, row.matched ? 'OK' : 'PLACEHOLDER', row.placeName || '', row.searchUsed || '', row.rejectReason || '', attr, cap);
    src = patchSectionRow(src, row);
  }
  if (hero) {
    console.log('hero-anime', hero.matched ? 'OK' : 'PLACEHOLDER', hero.placeName, hero.searchUsed || '', hero.rejectReason || '');
    src = patchHeroFields(src, hero);
  }
  fs.writeFileSync(DATA_PATH, src, 'utf8');
  console.log('[PATCHED]', DATA_PATH);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
