/**
 * Editorial build — rule-based pipeline (zero AI tokens).
 * Google Places = place verify + metadata photo scoring.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { visionVerifyLandmarkViaWorker, visionCaptionViaWorker } from './lib/vision-caption.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'city-journal-data.js');
const EDITORIAL_PATH = path.join(ROOT, 'editorial', 'tokyo-anime-editorial.json');
const OUT_JSON = path.join(__dirname, 'tokyo-anime-google-places.json');

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

function extractSectionContent(dataSrc, sectionId) {
  const marker = "sectionId: '" + sectionId + "'";
  const start = dataSrc.indexOf(marker);
  if (start === -1) return {};
  const blockEnd = dataSrc.indexOf('},', start);
  const block = dataSrc.slice(start, blockEnd);
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
  const marker = "sectionId: '" + row.sectionId + "'";
  const start = src.indexOf(marker);
  if (start === -1) {
    console.warn('[SKIP] section not found:', row.sectionId);
    return src;
  }
  const blockEnd = src.indexOf('},', start);
  if (blockEnd === -1) return src;
  const fields = [
    'officialName', 'officialNameLocal', 'aliases', 'photoIntent', 'imageChecklist', 'imageRejectRules',
    'subject', 'mapsQuery', 'placeId', 'googleRating', 'googleAddress',
    'googlePhotoUrl', 'googleAttribution', 'imageSource', 'caption',     'photoPlaceName', 'matchedKeywords',
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
      if (!row.heading || process.env.SOARVIBE_SYNC_COPY === '0') continue;
      val = jsString(row.heading);
    } else if (key === 'content') {
      if (!row.content || process.env.SOARVIBE_SYNC_COPY === '0') continue;
      val = jsString(row.content);
    } else val = jsString(row[key]);
    out = patchField(out, key, val, start, blockEnd);
  }
  return out;
}

function patchHeroFields(src, row) {
  // Cover must stay distinct from the article hero / intro image.
  // Prefer curated coverImageKey in city-journal-data.js over cloning heroGooglePhotoUrl.
  const heroFields = {
    heroSubject: row.subject || row.title,
    heroOfficialName: row.officialName,
    heroOfficialNameLocal: row.officialNameLocal,
    heroMapsQuery: row.mapsQuery,
    heroPlaceId: row.placeId,
    heroGooglePhotoUrl: row.googlePhotoUrl,
    heroGoogleAttribution: row.googleAttribution,
    heroImageSource: row.imageSource
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

function isDistrictSection(section) {
  return section && (section.subjectType === 'district' || section.requireStreetscape);
}

function isStorefrontSection(section) {
  if (!section) return false;
  return /外觀|店門口|storefront|招牌|facade|exterior|入口/i.test(String(section.photoIntent || ''));
}

function isDistrictPhotoMismatch(caption, subjects) {
  const blob = [caption].concat(subjects || []).join(' ').toLowerCase();
  return /幸福物産|菜市|grocery|supermarket|食材|物產|vegetable|蔬果|market|video gamer|tokyo video|吧台|bar counter|室內|店内|indoor|海報|poster only|拉麵碗|ramen bowl|浴缸|客房/.test(blob);
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

async function resolveSectionWithVision(payload, section, editorial, excludeUrls) {
  const editorialRow = (editorial.sections || []).find(function (s) { return s.sectionId === section.sectionId; })
    || (section.sectionId === 'hero-anime' ? editorial.hero : section);
  const needsVision = isDistrictSection(editorialRow) || isDistrictSection(section) || isStorefrontSection(editorialRow);
  const maxTries = needsVision ? 4 : 1;

  for (let tryIdx = 0; tryIdx < maxTries; tryIdx++) {
    const reqSection = Object.assign({}, section, {
      minPhotoIndex: tryIdx,
      placeId: tryIdx > 0 && isDistrictSection(editorialRow) ? null : section.placeId
    });
    const row = await resolveOneSection(payload, reqSection, excludeUrls);
    if (!row.googlePhotoUrl || !row.matched) return row;
    if (!needsVision || process.env.SOARVIBE_VISION_CAPTIONS === '0') return row;

    const ctx = {
      heading: row.heading || editorialRow.heading,
      subject: row.subject || editorialRow.title,
      placeName: row.placeName || row.photoPlaceName,
      officialName: row.officialName || editorialRow.officialName,
      officialNameLocal: row.officialNameLocal || editorialRow.officialNameLocal
    };
    try {
      const verified = await visionVerifyLandmarkViaWorker(row.googlePhotoUrl, ctx, editorialRow);
      const caption = verified.caption || '';
      const mismatch = isDistrictSection(editorialRow) && isDistrictPhotoMismatch(caption, verified.visibleSubjects);
      if (verified.venueMatch === true && !mismatch) {
        row.photoCaption = caption || row.photoCaption;
        console.log('[VISION OK]', section.sectionId, 'idx:' + tryIdx, row.photoCaption);
        return row;
      }
      if (verified.apiError) {
        row.photoCaption = caption || row.photoCaption;
        row.visionSkipped = verified.apiError;
        console.warn('[VISION QUOTA]', section.sectionId, verified.apiError);
        return row;
      }
      console.warn('[VISION REJECT]', section.sectionId, 'idx:' + tryIdx, caption.slice(0, 40));
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
    rejectReason: 'vision_photo_mismatch'
  };
}

async function resolveAll(payload, editorial) {
  const sections = payload.sections || [];
  const results = [];
  let excludeUrls = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const row = await resolveSectionWithVision(payload, section, editorial, excludeUrls);
    results.push(row);
    if (row.googlePhotoUrl) excludeUrls.push(row.googlePhotoUrl);
    if (row.secondaryGooglePhotoUrl) excludeUrls.push(row.secondaryGooglePhotoUrl);
  }

  return results;
}

async function rewriteCaptionsWithVision(results, article, editorial) {
  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    if (!row.googlePhotoUrl || !row.matched) continue;
    const section = (editorial.sections || []).find(function (s) { return s.sectionId === row.sectionId; }) || {};
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
      if (row.secondaryGooglePhotoUrl) {
        const secCap = await visionCaptionViaWorker(row.secondaryGooglePhotoUrl, ctx, section);
        if (secCap) row.secondaryCaption = secCap;
      }
    } catch (err) {
      console.warn('[VISION SKIP]', row.sectionId, err.message);
    }
  }
  return results;
}

async function syncSectionCopy(results, article, editorial) {
  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    if (!row.matched || row.sectionId === 'hero-anime') continue;
    const section = (editorial.sections || []).find(function (s) { return s.sectionId === row.sectionId; }) || {};
    if (!row.placeName) continue;
    try {
      const response = await fetch(API_BASE + '/api/editorial/section-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({
          article: article,
          section: section,
          place: {
            placeName: row.placeName,
            officialName: row.officialName || section.officialName,
            officialNameLocal: row.officialNameLocal || section.officialNameLocal,
            googleAddress: row.googleAddress
          },
          photoCaption: row.photoCaption || ''
        })
      });
      const data = await response.json();
      if (response.ok && data.heading && data.content) {
        row.heading = data.heading;
        row.content = data.content;
        if (data.officialName) row.officialName = data.officialName;
        if (data.officialNameLocal) row.officialNameLocal = data.officialNameLocal;
        console.log('[COPY]', row.sectionId, data.heading.slice(0, 24));
      } else {
        console.warn('[COPY FAIL]', row.sectionId, data.error || JSON.stringify(data).slice(0, 80));
      }
    } catch (err) {
      console.warn('[COPY SKIP]', row.sectionId, err.message);
    }
    await new Promise(function (r) { setTimeout(r, 1500); });
  }
  return results;
}

async function main() {
  const editorial = JSON.parse(fs.readFileSync(EDITORIAL_PATH, 'utf8'));
  const dataSrc = fs.readFileSync(DATA_PATH, 'utf8');
  const payload = buildPayload(editorial, dataSrc);

  console.log('[PIPELINE]', USE_LEGACY_PLACES ? 'legacy-places' : 'semantic-match');
  const results = await resolveAll(payload, editorial);
  if (process.env.SOARVIBE_VISION_CAPTIONS !== '0') {
    await rewriteCaptionsWithVision(results, payload.article, editorial);
  }
  if (process.env.SOARVIBE_SYNC_COPY !== '0') {
    await syncSectionCopy(results, payload.article, editorial);
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2), 'utf8');
  console.log('[WROTE]', OUT_JSON);

  let src = dataSrc;
  const hero = results.find(function (r) { return r.sectionId === 'hero-anime'; });
  const sections = results.filter(function (r) { return r.sectionId !== 'hero-anime'; });

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
      'slot:' + (row.travelPhotoSlot || '-'),
      'phase:' + (row.photoSearchPhase || '-'),
      'candidates:' + (row.candidatesReviewed || '-'),
      row.venueSwapped ? 'SWAPPED→' + (row.swappedTo || '') : '',
      qa.recommendation || row.rejectReason || '',
      row.photoCaption ? row.photoCaption.slice(0, 28) : '(no caption)'
    );
    if (row.photoSearchDebug && row.photoSearchDebug.attempts) {
      var last = row.photoSearchDebug.attempts[row.photoSearchDebug.attempts.length - 1];
      console.log('  [DEBUG]', row.sectionId, 'attempts:', row.photoSearchDebug.attempts.length,
        last && last.selectedImageUrl ? 'SELECTED' : 'NONE',
        last && last.query ? last.query.slice(0, 40) : '');
    }
    src = patchSectionRow(src, row);
  }
  if (hero) {
    Object.assign(hero, editorial.hero);
    console.log(
      'hero-anime',
      hero.matched ? 'PASS' : 'PLACEHOLDER',
      hero.placeName || '',
      'score:' + (hero.photoScore || '-'),
      hero.photoCaption || ''
    );
    src = patchHeroFields(src, hero);
  }
  fs.writeFileSync(DATA_PATH, src, 'utf8');
  console.log('[PATCHED]', DATA_PATH);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
