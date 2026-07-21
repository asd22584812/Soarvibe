/**
 * Resolve photos for sections still missing googlePhotoUrl.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { visionCaptionViaWorker } from './lib/vision-caption.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'city-journal-data.js');
const API_BASE = 'https://soarvibe-api.soarvibe.workers.dev';
const ORIGIN = 'https://asd22584812.github.io';
const TARGETS = ['maid-cafe', 'hotel-gracery'];

function jsString(value) {
  if (value == null) return 'null';
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function patchField(src, key, val, sectionId) {
  const marker = "sectionId: '" + sectionId + "'";
  const start = src.indexOf(marker);
  if (start === -1) return src;
  const blockEnd = src.indexOf('},', start);
  const block = src.slice(start, blockEnd);
  const fieldRe = new RegExp('(\\n\\s*' + key + ':\\s*)(null|\'(?:\\\\.|[^\'])*\')(,)?');
  if (!fieldRe.test(block)) return src;
  const next = block.replace(fieldRe, function (_m, prefix, _old, suffix) {
    return prefix + val + (suffix || ',');
  });
  return src.slice(0, start) + next + src.slice(blockEnd);
}

async function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

async function resolve(section) {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await sleep(10000 * attempt);
    const response = await fetch(API_BASE + '/api/editorial/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({
        article: { articleId: 'tokyo-anime', articleTheme: 'July anime' },
        sections: [section]
      })
    });
    const text = await response.text();
    if (text.startsWith('<!')) {
      console.warn('[HTML]', section.sectionId, 'attempt', attempt + 1);
      continue;
    }
    const data = JSON.parse(text);
    const row = (data.results && data.results[0]) || data;
    if (row.googlePhotoUrl && row.matched) return row;
    console.warn('[MISS]', section.sectionId, row.rejectReason || 'no url');
  }
  return null;
}

async function main() {
  let src = fs.readFileSync(DATA_PATH, 'utf8');
  for (const sectionId of TARGETS) {
    const marker = "sectionId: '" + sectionId + "'";
    const start = src.indexOf(marker);
    const block = src.slice(start, src.indexOf('},', start));
    const officialName = (block.match(/officialName:\s*'((?:\\.|[^'])*)'/) || [])[1]?.replace(/\\'/g, "'");
    const officialNameLocal = (block.match(/officialNameLocal:\s*'((?:\\.|[^'])*)'/) || [])[1]?.replace(/\\'/g, "'");
    const mapsQuery = (block.match(/mapsQuery:\s*'((?:\\.|[^'])*)'/) || [])[1]?.replace(/\\'/g, "'");
    const placeId = (block.match(/placeId:\s*'((?:\\.|[^'])*)'/) || [])[1]?.replace(/\\'/g, "'");
    const heading = (block.match(/heading:\s*'((?:\\.|[^'])*)'/) || [])[1]?.replace(/\\'/g, "'");
    const sectionRole = sectionId === 'hotel-gracery' ? 'hotel' : 'cafe';
    const sectionType = sectionRole;

    console.log('\n[RESOLVE]', sectionId, officialName);
    const row = await resolve({
      sectionId, sectionRole, sectionType, officialName, officialNameLocal, mapsQuery, placeId,
      photoIntent: '外觀', imageChecklist: sectionId === 'hotel-gracery' ? ['MIMARU', '外観'] : ['@home', '外観']
    });
    if (!row) continue;

    let caption = null;
    try {
      caption = await visionCaptionViaWorker(row.googlePhotoUrl, {
        heading, subject: officialNameLocal || officialName,
        placeName: row.placeName, officialName, officialNameLocal
      }, { sectionRole, photoIntent: '外觀' });
    } catch (err) {
      console.warn('[CAPTION]', sectionId, err.message);
    }

    src = patchField(src, 'googlePhotoUrl', jsString(row.googlePhotoUrl), sectionId);
    src = patchField(src, 'googleAttribution', jsString(row.googleAttribution), sectionId);
    src = patchField(src, 'imageSource', jsString(row.imageSource || 'google_places'), sectionId);
    src = patchField(src, 'placeId', jsString(row.placeId || placeId), sectionId);
    if (row.googleAddress) src = patchField(src, 'googleAddress', jsString(row.googleAddress), sectionId);
    if (row.googleRating != null) src = patchField(src, 'googleRating', String(row.googleRating), sectionId);
    if (caption) src = patchField(src, 'caption', jsString(caption), sectionId);
    console.log('[OK]', sectionId, row.googleAttribution, caption ? caption.slice(0, 40) : '(no caption)');
  }
  fs.writeFileSync(DATA_PATH, src, 'utf8');
  console.log('\n[DONE] patched', DATA_PATH);
}

main().catch(console.error);
