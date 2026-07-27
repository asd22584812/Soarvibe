/**
 * SoarVibe feature flags — single source for frontend.
 * Phase 0: disable costly City Journal / Places photo pipeline.
 */
(function (global) {
  'use strict';

  global.SOARVIBE_FEATURE_FLAGS = Object.freeze({
    /** City Journal 七刊月刊 UI（Phase 1 改為城市旅人分享後關閉） */
    CITY_JOURNAL_ENABLED: false,
    /** 旅人分享模組（Phase 1 開啟） */
    CITY_SHARES_ENABLED: true,
    /** 前端是否允許呼叫 editorial / places resolve（應永遠 false） */
    EDITORIAL_API_CLIENT: false
  });
})(typeof window !== 'undefined' ? window : globalThis);
