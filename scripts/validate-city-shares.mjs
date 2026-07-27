#!/usr/bin/env node
/**
 * Validate city share seed data against schema and project rules.
 * Usage: node scripts/validate-city-shares.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const errors = [];
const warnings = [];
let postCount = 0;
let placeholderCount = 0;

function loadBrowserModule(relativePath, exportName) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing module: ${relativePath}`);
    return null;
  }
  const code = fs.readFileSync(filePath, 'utf8');
  const ctx = { window: {}, globalThis: {} };
  ctx.window = ctx.globalThis;
  vm.runInNewContext(code, ctx, { filename: filePath });
  return ctx.globalThis[exportName] ?? ctx.window[exportName];
}

function addError(msg) {
  errors.push(msg);
}

function addWarning(msg) {
  warnings.push(msg);
}

function isBlank(s) {
  return typeof s !== 'string' || s.trim().length === 0;
}

function countCjkChars(text) {
  return (text.match(/[\u4e00-\u9fff]/g) || []).length;
}

function resolveMediaPath(src) {
  if (!src || !src.startsWith('./')) return null;
  return path.normalize(path.join(ROOT, src.replace(/^\.\//, '')));
}

function validateForbiddenUrl(url, ctx) {
  if (!url) return;
  const patterns = [
    /googleusercontent\.com\/place-photos/i,
    /\/api\/cover-image/i,
    /images\.unsplash\.com/i
  ];
  for (const re of patterns) {
    if (re.test(url)) {
      addError(`${ctx}: forbidden media URL pattern (${re.source}): ${url}`);
    }
  }
  if (/^https?:\/\//i.test(url)) {
    addWarning(`${ctx}: external HTTP URL (prefer local ./assets/): ${url}`);
  }
}

function validateMediaItem(item, post, index) {
  const ctx = `post ${post.postId} media[${index}]`;
  const required = ['mediaId', 'src', 'slot', 'sortOrder'];
  for (const key of required) {
    if (item[key] === undefined || item[key] === null || item[key] === '') {
      addError(`${ctx}: missing required field "${key}"`);
    }
  }
  if (item.sortOrder != null && (typeof item.sortOrder !== 'number' || item.sortOrder < 0)) {
    addError(`${ctx}: sortOrder must be >= 0`);
  }
  if (item.slot && !MEDIA_SLOTS.includes(item.slot)) {
    addError(`${ctx}: invalid slot "${item.slot}"`);
  }
  if (item.src) {
    if (!/^(\.\/assets\/|\.\/cover-photos\/)/.test(item.src)) {
      addError(`${ctx}: src must start with ./assets/ or ./cover-photos/`);
    }
    validateForbiddenUrl(item.src, ctx);
    const abs = resolveMediaPath(item.src);
    if (abs && !fs.existsSync(abs)) {
      addError(`${ctx}: file not found: ${item.src}`);
    }
  }
  if (item.thumbSrc) validateForbiddenUrl(item.thumbSrc, `${ctx} thumbSrc`);
  if (isBlank(item.alt)) addWarning(`${ctx}: missing alt text`);
  if (isBlank(item.caption)) addWarning(`${ctx}: missing caption`);
}

function validatePost(post, expectedCityId) {
  const ctx = `post ${post.postId || '(no postId)'}`;

  const required = [
    'postId',
    'cityId',
    'type',
    'source',
    'status',
    'title',
    'body',
    'author',
    'place',
    'visitMeta',
    'stats',
    'publishedAt',
    'updatedAt'
  ];
  for (const key of required) {
    if (post[key] === undefined || post[key] === null) {
      addError(`${ctx}: missing required field "${key}"`);
    }
  }

  if (post.postId && !/^[a-z0-9][a-z0-9-]{2,80}$/.test(post.postId)) {
    addError(`${ctx}: postId format invalid`);
  }

  if (expectedCityId && post.cityId !== expectedCityId) {
    addError(`${ctx}: cityId "${post.cityId}" !== expected "${expectedCityId}"`);
  }

  if (post.type && !SHARE_TYPES.includes(post.type)) {
    addError(`${ctx}: invalid type "${post.type}"`);
  }

  if (post.source && !SHARE_SOURCES.includes(post.source)) {
    addError(`${ctx}: invalid source "${post.source}"`);
  }

  if (post.status && !SHARE_STATUSES.includes(post.status)) {
    addError(`${ctx}: invalid status "${post.status}"`);
  }

  if (isBlank(post.title)) addError(`${ctx}: title is blank`);
  else if (post.title.length > LIMITS.titleMaxLength) {
    addError(`${ctx}: title exceeds ${LIMITS.titleMaxLength} chars`);
  }

  if (isBlank(post.body)) addError(`${ctx}: body is blank`);
  else {
    if (post.body.length < LIMITS.bodyMinLength) {
      addError(`${ctx}: body shorter than ${LIMITS.bodyMinLength} chars`);
    }
    if (post.body.length > LIMITS.bodyMaxLength) {
      addError(`${ctx}: body exceeds ${LIMITS.bodyMaxLength} chars`);
    }
    const cjk = countCjkChars(post.body);
    if (post.source === 'official' && (cjk < 120 || cjk > 300)) {
      addWarning(`${ctx}: official body has ${cjk} CJK chars (target 120–300)`);
    }
  }

  if (!post.author || isBlank(post.author.authorId) || isBlank(post.author.displayName)) {
    addError(`${ctx}: author.authorId and author.displayName required`);
  }

  if (!post.place || isBlank(post.place.placeId) || isBlank(post.place.displayName)) {
    addError(`${ctx}: place.placeId and place.displayName required`);
  }

  const rl = post.visitMeta && post.visitMeta.recommendLevel;
  if (rl == null) addError(`${ctx}: visitMeta.recommendLevel required`);
  else if (rl < LIMITS.recommendLevelMin || rl > LIMITS.recommendLevelMax) {
    addError(`${ctx}: recommendLevel must be ${LIMITS.recommendLevelMin}–${LIMITS.recommendLevelMax}`);
  }

  const statKeys = ['likeCount', 'commentCount', 'saveCount', 'beenCount', 'wantCount', 'avoidCount'];
  if (!post.stats) addError(`${ctx}: stats required`);
  else {
    for (const k of statKeys) {
      if (typeof post.stats[k] !== 'number' || post.stats[k] < 0) {
        addError(`${ctx}: stats.${k} must be non-negative number`);
      }
    }
  }

  if (post.tags && post.tags.length > LIMITS.tagsMaxCount) {
    addError(`${ctx}: too many tags (max ${LIMITS.tagsMaxCount})`);
  }

  const placeholder = post.mediaPlaceholder === true;
  const media = Array.isArray(post.media) ? post.media : [];

  if (!placeholder && media.length === 0) {
    addError(`${ctx}: media must have at least 1 item (or set mediaPlaceholder: true)`);
  }

  if (placeholder && media.length === 0) {
    addWarning(`${ctx}: mediaPlaceholder=true — awaiting verified local images`);
  }

  if (media.length > LIMITS.mediaMaxCount) {
    addError(`${ctx}: too many media items (max ${LIMITS.mediaMaxCount})`);
  }

  const sortOrders = new Set();
  media.forEach((item, i) => {
    validateMediaItem(item, post, i);
    if (item.sortOrder != null) {
      if (sortOrders.has(item.sortOrder)) {
        addError(`${ctx}: duplicate sortOrder ${item.sortOrder}`);
      }
      sortOrders.add(item.sortOrder);
    }
  });

  if (media.length > 0) {
    const slots = media.map((m) => m.slot).filter(Boolean);
    const rule = SLOT_RULES_BY_TYPE[post.type];
    if (rule) {
      const hasRequired = rule.anyOf.some((s) => slots.includes(s));
      if (!hasRequired) {
        const msg = `${ctx}: missing recommended slot for type "${post.type}" (need one of: ${rule.anyOf.join(', ')})`;
        if (post.source === 'official') addWarning(msg);
        else addError(msg);
      }
      if (rule.firstMustBe && media[0] && !rule.firstMustBe.includes(media[0].slot)) {
        const msg = `${ctx}: first media slot should be ${rule.firstMustBe.join(' or ')} for type "${post.type}"`;
        if (post.source === 'official') addWarning(msg);
        else addError(msg);
      }
    }

    if (post.type === 'food') {
      const hasLocationSlot = slots.some((s) => ['exterior', 'entrance'].includes(s));
      const onlyFood = slots.length > 0 && slots.every((s) => s === 'food');
      if (onlyFood || (!hasLocationSlot && slots.includes('food'))) {
        const msg = `${ctx}: food post should include exterior or entrance, not food-only photos`;
        if (post.source === 'official') addWarning(msg);
        else addError(msg);
      }
    }
  }
}

// --- load config via vm ---
const CONFIG = loadBrowserModule('city-shares-config.js', 'SOARVIBE_CITY_SHARES_CONFIG');
const DATA = loadBrowserModule('city-shares-data.js', 'SOARVIBE_CITY_SHARES');

if (!CONFIG || !DATA) {
  printReport();
  process.exit(1);
}

const {
  SHARE_TYPES,
  SHARE_SOURCES,
  SHARE_STATUSES,
  MEDIA_SLOTS,
  SLOT_RULES_BY_TYPE,
  LIMITS
} = CONFIG;

// --- schema file exists ---
const schemaPath = path.join(ROOT, 'city-shares-schema.json');
if (!fs.existsSync(schemaPath)) {
  addError('Missing city-shares-schema.json');
} else {
  try {
    JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (e) {
    addError(`city-shares-schema.json is invalid JSON: ${e.message}`);
  }
}

// --- validate all posts ---
const seenIds = new Set();

for (const [cityId, city] of Object.entries(DATA.cities || {})) {
  if (!city || !Array.isArray(city.posts)) {
    addError(`City "${cityId}" has no posts array`);
    continue;
  }
  for (const post of city.posts) {
    postCount++;
    if (post.mediaPlaceholder) placeholderCount++;
    if (seenIds.has(post.postId)) {
      addError(`Duplicate postId: ${post.postId}`);
    } else {
      seenIds.add(post.postId);
    }
    validatePost(post, cityId);
  }
}

if (postCount === 0) {
  addError('No posts found in SOARVIBE_CITY_SHARES');
}

function printReport() {
  console.log('=== City Shares Seed Validation ===\n');
  console.log(`Posts scanned: ${postCount}`);
  console.log(`Media placeholders: ${placeholderCount}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}\n`);

  if (errors.length) {
    console.log('--- ERRORS ---');
    errors.forEach((e) => console.log('  ✗', e));
    console.log('');
  }

  if (warnings.length) {
    console.log('--- WARNINGS ---');
    warnings.forEach((w) => console.log('  ⚠', w));
    console.log('');
  }

  if (!errors.length && !warnings.length) {
    console.log('All checks passed.\n');
  } else if (!errors.length) {
    console.log('Validation passed with warnings (official slot/image rules are warn-only).\n');
  } else {
    console.log('Validation FAILED.\n');
  }
}

printReport();
process.exit(errors.length > 0 ? 1 : 0);
