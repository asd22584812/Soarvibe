/**
 * Tokyo sightseeing — fixed curated copy + Google Places photos.
 * Usage: node scripts/fetch-tokyo-sightseeing-google-places.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { visionVerifyLandmarkViaWorker, visionCaptionViaWorker } from './lib/vision-caption.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'city-journal-data.js');
const EDITORIAL_PATH = path.join(ROOT, 'editorial', 'tokyo-sightseeing-editorial.json');
const OUT_JSON = path.join(__dirname, 'tokyo-sightseeing-google-places.json');
const HERO_ID = 'hero-sightseeing';
const ARTICLE_MARKER = "sightseeing: {";

const API_BASE = String(process.env.SOARVIBE_API_BASE || 'https://soarvibe-api.soarvibe.workers.dev').replace(/\/$/, '');
const ORIGIN = String(process.env.SOARVIBE_ORIGIN || 'https://asd22584812.github.io');
const USE_LEGACY_PLACES = process.env.EDITORIAL_PIPELINE === 'places';

function jsString(value) {
  if (value == null) return 'null';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return '[' + value.map(function (v) { return jsString(v); }).join(', ') + ']';
  }
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function findArticleBlockBounds(src) {
  const start = src.indexOf(ARTICLE_MARKER);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start + ARTICLE_MARKER.length - 1; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return { start: start, end: i + 1 };
    }
  }
  return null;
}

function extractSectionContent(dataSrc, sectionId) {
  const bounds = findArticleBlockBounds(dataSrc);
  const scope = bounds ? dataSrc.slice(bounds.start, bounds.end) : dataSrc;
  const marker = "sectionId: '" + sectionId + "'";
  const start = scope.indexOf(marker);
  if (start === -1) return {};
  const blockEnd = scope.indexOf('},', start);
  const block = scope.slice(start, blockEnd);
  const heading = (block.match(/heading:\s*'((?:\\.|[^'])*)'/)) || [];
  const content = (block.match(/content:\s*'((?:\\.|[^'])*)'/)) || [];
  return {
    heading: heading[1] ? heading[1].replace(/\\'/g, "'") : '',
    content: content[1] ? content[1].replace(/\\'/g, "'") : ''
  };
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
  const bounds = findArticleBlockBounds(src);
  const scopeStart = bounds ? bounds.start : 0;
  const scopeEnd = bounds ? bounds.end : src.length;
  const scope = src.slice(scopeStart, scopeEnd);
  const marker = "sectionId: '" + row.sectionId + "'";
  const relStart = scope.indexOf(marker);
  if (relStart === -1) {
    console.warn('[SKIP] section not found:', row.sectionId);
    return src;
  }
  const start = scopeStart + relStart;
  const blockEnd = src.indexOf('},', start);
  if (blockEnd === -1) return src;
  const fields = [
    'officialName', 'officialNameLocal', 'aliases', 'photoIntent', 'imageChecklist', 'imageRejectRules',
    'subject', 'mapsQuery', 'placeId', 'googleRating', 'googleAddress',
    'googlePhotoUrl', 'googleAttribution', 'imageSource', 'caption', 'photoPlaceName', 'matchedKeywords',
    'secondaryGooglePhotoUrl', 'secondaryGoogleAttribution', 'secondaryCaption',
    'heading', 'content'
  ];
  let out = src;
  for (const key of fields) {
    let val;
    if (key === 'caption' && row.photoCaption) val = jsString(row.photoCaption);
    else if (key === 'googlePhotoUrl' && !row.googlePhotoUrl) val = 'null';
    else if (key === 'googleAttribution' && !row.googleAttribution) val = 'null';
    else if (key === 'imageSource' && !row.imageSource) val = 'null';
    else if (key === 'aliases' || key === 'imageChecklist' || key === 'imageRejectRules' || key === 'matchedKeywords') {
      val = jsString(row[key] || []);
    } else if (key === 'photoPlaceName') {
      val = jsString(row.photoPlaceName || null);
    } else if (key === 'secondaryGooglePhotoUrl' && !row.secondaryGooglePhotoUrl) val = 'null';
    else if (key === 'secondaryGoogleAttribution' && !row.secondaryGoogleAttribution) val = 'null';
    else if (key === 'secondaryCaption') val = jsString(row.secondaryCaption || null);
    else if (key === 'heading') {
      if (!row.heading) continue;
      val = jsString(row.heading);
    } else if (key === 'content') {
      if (!row.content) continue;
      val = jsString(row.content);
    } else val = jsString(row[key]);
    out = patchField(out, key, val, start, blockEnd);
  }
  return out;
}

function patchHeroFields(src, row) {
  const bounds = findArticleBlockBounds(src);
  if (!bounds) {
    console.warn('[SKIP] sightseeing article block not found');
    return src;
  }
  const heroFields = {
    heroSubject: row.subject || row.title,
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
  let block = src.slice(bounds.start, bounds.end);
  for (const [key, value] of Object.entries(heroFields)) {
    const val = jsString(value);
    const fieldRe = new RegExp('(\\n\\s*' + key + ':\\s*)(null|\'(?:\\\\.|[^\'])*\')(,)?');
    if (!fieldRe.test(block)) continue;
    block = block.replace(fieldRe, function (_m, prefix, _old, suffix) {
      return prefix + val + (suffix || ',');
    });
  }
  return src.slice(0, bounds.start) + block + src.slice(bounds.end);
}

function buildPayload(editorial, dataSrc) {
  const hero = Object.assign({}, editorial.hero, {
    subject: editorial.hero.title || editorial.hero.subject
  });
  const sections = editorial.sections.map(function (s) {
    const contentBlock = extractSectionContent(dataSrc, s.sectionId);
    return Object.assign({}, s, {
      subject: s.title || s.subject,
      heading: s.heading || contentBlock.heading || '',
      content: s.content || contentBlock.content || '',
      placeId: s.placeId || null
    });
  });
  return {
    article: {
      articleId: editorial.articleId,
      articleTheme: editorial.articleTheme,
      editorialAngle: editorial.editorialAngle,
      targetReader: editorial.targetReader,
      readerPersona: editorial.readerPersona,
      travelStyle: editorial.travelStyle,
      emotion: editorial.emotion,
      articleGoal: editorial.articleGoal,
      storyline: editorial.storyline,
      readingRhythm: editorial.readingRhythm,
      editorialPlan: editorial.editorialPlan,
      destination: editorial.destination || null,
      countryCode: editorial.destination && editorial.destination.countryCode
        ? editorial.destination.countryCode
        : null
    },
    sections: sections.concat([hero])
  };
}

function isStrictLandmark(section) {
  return !!(section && section.sectionType === 'landmark' &&
    (section.strictVenueLock === true || section.isSpecificVenue === true));
}

async function resolveOneSection(payload, section, excludeUrls) {
  const endpoint = USE_LEGACY_PLACES ? '/api/places/resolve' : '/api/editorial/resolve';
  const body = USE_LEGACY_PLACES
    ? {
      sections: [Object.assign({}, section, { visualKeywords: section.imageChecklist || [], excludeUrls: excludeUrls })]
    }
    : {
      article: payload.article,
      sections: [Object.assign({}, section, { excludeUrls: excludeUrls })],
      excludeUrls: excludeUrls
    };

  const response = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error('Worker editorial resolve failed for ' + section.sectionId + ': ' + JSON.stringify(data));
  return (data.results && data.results[0]) || data;
}

function landmarkFallbackCaption(section, row) {
  const name = row.officialNameLocal || row.officialName || row.placeName || section.officialNameLocal || section.officialName || '此地標';
  return name + '的景觀清楚可見，與本段介紹的地標一致。';
}

async function resolveSectionWithLandmarkVision(payload, section, editorial, excludeUrls) {
  const editorialRow = (editorial.sections || []).find(function (s) { return s.sectionId === section.sectionId; })
    || (section.sectionId === HERO_ID ? editorial.hero : section);
  const strict = isStrictLandmark(editorialRow) || isStrictLandmark(section);
  const maxTries = strict ? 4 : 1;

  for (let tryIdx = 0; tryIdx < maxTries; tryIdx++) {
    const reqSection = Object.assign({}, section, {
      minPhotoIndex: tryIdx,
      strictVenueLock: strict || section.strictVenueLock,
      allowVenueSwap: false
    });
    const row = await resolveOneSection(payload, reqSection, excludeUrls);
    if (!row.googlePhotoUrl || !row.matched) return row;

    if (!strict || process.env.SOARVIBE_VISION_CAPTIONS === '0') {
      return row;
    }

    const ctx = {
      heading: row.heading || editorialRow.heading,
      subject: row.subject || editorialRow.title,
      placeName: row.placeName || row.photoPlaceName,
      officialName: row.officialName || editorialRow.officialName,
      officialNameLocal: row.officialNameLocal || editorialRow.officialNameLocal
    };
    try {
      const verified = await visionVerifyLandmarkViaWorker(row.googlePhotoUrl, ctx, editorialRow);
      if (verified.venueMatch === true) {
        row.photoCaption = verified.caption || landmarkFallbackCaption(editorialRow, row);
        console.log('[VISION OK]', section.sectionId, 'idx:' + tryIdx, row.photoCaption);
        return row;
      }
      if (verified.apiError) {
        row.photoCaption = landmarkFallbackCaption(editorialRow, row);
        row.visionSkipped = verified.apiError;
        console.warn('[VISION QUOTA]', section.sectionId, verified.apiError, '→ landmark pick kept');
        return row;
      }
      console.warn('[VISION REJECT]', section.sectionId, 'idx:' + tryIdx, verified.visibleSubjects || []);
      excludeUrls.push(row.googlePhotoUrl);
    } catch (err) {
      console.warn('[VISION ERR]', section.sectionId, err.message);
      excludeUrls.push(row.googlePhotoUrl);
    }
  }

  return {
    sectionId: section.sectionId,
    subject: section.subject || section.title,
    mapsQuery: section.mapsQuery,
    matched: false,
    googlePhotoUrl: null,
    rejectReason: 'vision_venue_mismatch'
  };
}

async function resolveAll(payload, editorial) {
  const sections = payload.sections || [];
  const results = [];
  let excludeUrls = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const row = await resolveSectionWithLandmarkVision(payload, section, editorial, excludeUrls.slice());
    results.push(row);
    if (row.googlePhotoUrl) excludeUrls.push(row.googlePhotoUrl);
    if (row.secondaryGooglePhotoUrl) excludeUrls.push(row.secondaryGooglePhotoUrl);
  }

  return results;
}

async function rewriteCaptionsWithVision(results, editorial) {
  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    if (!row.googlePhotoUrl || !row.matched || row.photoCaption) continue;
    const section = (editorial.sections || []).find(function (s) { return s.sectionId === row.sectionId; })
      || (row.sectionId === HERO_ID ? editorial.hero : {});
    if (isStrictLandmark(section)) continue;
    const ctx = {
      heading: row.heading || section.heading,
      subject: row.subject || section.title,
      placeName: row.placeName || row.photoPlaceName,
      officialName: row.officialName || section.officialName,
      officialNameLocal: row.officialNameLocal || section.officialNameLocal
    };
    try {
      const caption = await visionCaptionViaWorker(row.googlePhotoUrl, ctx, section);
      if (caption) {
        row.photoCaption = caption;
        console.log('[VISION]', row.sectionId, caption);
      }
    } catch (err) {
      console.warn('[VISION SKIP]', row.sectionId, err.message);
    }
  }
  return results;
}

async function main() {
  const editorial = JSON.parse(fs.readFileSync(EDITORIAL_PATH, 'utf8'));
  const dataSrc = fs.readFileSync(DATA_PATH, 'utf8');
  const payload = buildPayload(editorial, dataSrc);

  console.log('[PIPELINE] tokyo-sightseeing', USE_LEGACY_PLACES ? 'legacy-places' : 'semantic-match');
  const results = await resolveAll(payload, editorial);
  if (process.env.SOARVIBE_VISION_CAPTIONS !== '0') {
    await rewriteCaptionsWithVision(results, editorial);
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2), 'utf8');
  console.log('[WROTE]', OUT_JSON);

  let src = dataSrc;
  const hero = results.find(function (r) { return r.sectionId === HERO_ID; });
  const sections = results.filter(function (r) { return r.sectionId !== HERO_ID; });

  for (const row of sections) {
    const editorialRow = editorial.sections.find(function (s) { return s.sectionId === row.sectionId; }) || {};
    Object.assign(row, {
      aliases: row.venueSwapped ? (row.aliases || editorialRow.aliases) : editorialRow.aliases,
      photoIntent: editorialRow.photoIntent,
      imageChecklist: editorialRow.imageChecklist,
      imageRejectRules: editorialRow.imageRejectRules,
      officialName: row.venueSwapped ? (row.officialName || editorialRow.officialName) : editorialRow.officialName,
      officialNameLocal: row.venueSwapped ? (row.officialNameLocal || editorialRow.officialNameLocal) : editorialRow.officialNameLocal,
      photoPlaceName: row.photoPlaceName || null,
      matchedKeywords: row.matchedKeywords || row.aiReview && row.aiReview.matchedElements || []
    });
    const qa = row.editorialQA || {};
    const ai = row.aiReview || {};
    console.log(
      row.sectionId,
      row.matched ? 'PASS' : 'PLACEHOLDER',
      row.imageSource || '',
      'score:' + (row.photoScore || ai.score || '-'),
      row.venueSwapped ? 'SWAPPED→' + (row.swappedTo || '') : '',
      qa.recommendation || row.rejectReason || '',
      row.photoCaption ? row.photoCaption.slice(0, 28) : '(no caption)'
    );
    src = patchSectionRow(src, row);
  }
  if (hero) {
    Object.assign(hero, editorial.hero);
    console.log(
      HERO_ID,
      hero.matched ? 'PASS' : 'PLACEHOLDER',
      hero.placeName || '',
      'score:' + (hero.photoScore || '-'),
      hero.photoCaption || ''
    );
    if (hero.matched && hero.googlePhotoUrl) {
      src = patchHeroFields(src, hero);
    } else {
      console.log('[HERO] Keeping existing hero/cover photos (resolve did not pass)');
    }
  }
  fs.writeFileSync(DATA_PATH, src, 'utf8');
  console.log('[PATCHED]', DATA_PATH);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
