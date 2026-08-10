/**
 * SoarVibe feature flags — single source for frontend.
 * Phase 0: disable costly City Journal / Places photo pipeline.
 * City Shares media: Cloudflare R2 via Worker (not Firebase Storage / Blaze).
 */
(function (global) {
  'use strict';

  global.SOARVIBE_FEATURE_FLAGS = Object.freeze({
    /** City Journal 七刊月刊 UI（Phase 1 改為城市旅人分享後關閉） */
    CITY_JOURNAL_ENABLED: false,
    /** 旅人分享模組（Phase 1 開啟） */
    CITY_SHARES_ENABLED: true,
    /**
     * City Shares 使用者照片上傳（Cloudflare R2）。
     * Worker / R2 需就緒後才會實際上傳成功；本機可測壓縮與 Composer UI。
     */
    citySharesMediaUpload: true,
    /**
     * 個人中心頭像上傳（同樣依賴 Storage；顯示既有 avatarUrl 不受影響）。
     */
    avatarUploadEnabled: false,
    /** 前端是否允許呼叫 editorial / places resolve（應永遠 false） */
    EDITORIAL_API_CLIENT: false
  });
})(typeof window !== 'undefined' ? window : globalThis);
