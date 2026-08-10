/**
 * SoarVibe Firebase Web config (public client config — not a secret).
 * Security is enforced by Authentication + Firestore/Storage Rules.
 *
 * Source: Firebase Console → Project settings → Your apps → Web app
 * Project: soarvibe-885c8
 */
(function (global) {
  'use strict';

  global.SOARVIBE_FIREBASE_CONFIG = Object.freeze({
    // NOTE: apiKey is case-sensitive. Typo H vs h previously caused auth/api-key-not-valid.
    apiKey: 'AIzaSyCecAOqW264hYUxEdWOclotGU8Ci4VZKGE',
    // Primary PWA host is Firebase Hosting (web.app). Same-site authDomain avoids
    // Safari / iOS third-party storage breakage with signInWithRedirect.
    authDomain: 'soarvibe-885c8.web.app',
    projectId: 'soarvibe-885c8',
    storageBucket: 'soarvibe-885c8.firebasestorage.app',
    messagingSenderId: '1010057383556',
    appId: '1:1010057383556:web:f7796ded2f37f22d0e7cd1',
    measurementId: 'G-6ZP8R3FQ99'
  });
})(typeof window !== 'undefined' ? window : globalThis);
