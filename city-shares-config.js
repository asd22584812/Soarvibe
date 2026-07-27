/**
 * City Shares — shared enums and slot rules (frontend + validate script).
 */
(function (global) {
  'use strict';

  var SHARE_TYPES = [
    'sightseeing',
    'food',
    'lodging',
    'shopping',
    'anime',
    'cafe',
    'nightview',
    'family',
    'photospot'
  ];

  var SHARE_SOURCES = ['official', 'user'];
  var SHARE_STATUSES = ['draft', 'published', 'hidden', 'removed'];

  var MEDIA_SLOTS = [
    'streetscape',
    'exterior',
    'entrance',
    'landmark',
    'interior',
    'food',
    'lobby',
    'room',
    'public_space',
    'other'
  ];

  /** Minimum slot coverage per type — Phase 1 official: warn only; UGC publish: enforce later */
  var SLOT_RULES_BY_TYPE = {
    sightseeing: { anyOf: ['streetscape', 'landmark', 'entrance'], label: '街景／地標／入口' },
    anime: { anyOf: ['streetscape', 'exterior', 'landmark'], label: '街景／外觀／地標' },
    food: { anyOf: ['exterior', 'entrance', 'food'], label: '店門／入口／料理' },
    cafe: { anyOf: ['exterior', 'entrance', 'interior'], label: '店門／入口／室內' },
    lodging: { anyOf: ['exterior', 'entrance'], label: '外觀／入口', firstMustBe: ['exterior', 'entrance'] },
    shopping: { anyOf: ['exterior', 'entrance', 'interior'], label: '外觀／入口／室內' },
    nightview: { anyOf: ['streetscape', 'landmark', 'exterior'], label: '街景／地標／外觀' },
    family: { anyOf: ['streetscape', 'exterior', 'interior'], label: '街景／外觀／室內' },
    photospot: { anyOf: ['streetscape', 'landmark', 'exterior'], label: '街景／地標／外觀' }
  };

  var FORBIDDEN_MEDIA_URL_PATTERNS = [
    /googleusercontent\.com\/place-photos/i,
    /\/api\/cover-image/i,
    /images\.unsplash\.com/i
  ];

  global.SOARVIBE_CITY_SHARES_CONFIG = Object.freeze({
    version: 1,
    SHARE_TYPES: SHARE_TYPES,
    SHARE_SOURCES: SHARE_SOURCES,
    SHARE_STATUSES: SHARE_STATUSES,
    MEDIA_SLOTS: MEDIA_SLOTS,
    SLOT_RULES_BY_TYPE: SLOT_RULES_BY_TYPE,
    FORBIDDEN_MEDIA_URL_PATTERNS: FORBIDDEN_MEDIA_URL_PATTERNS,
    LIMITS: Object.freeze({
      titleMaxLength: 80,
      bodyMinLength: 80,
      bodyMaxLength: 600,
      mediaMaxCount: 10,
      tagsMaxCount: 12,
      recommendLevelMin: 1,
      recommendLevelMax: 5
    })
  });
})(typeof window !== 'undefined' ? window : globalThis);
