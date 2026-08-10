/**
 * Firebase app bootstrap (compat SDK — works with GitHub Pages static scripts).
 * Requires: firebase-app-compat, auth, firestore (+ optional storage) CDNs + firebase-config.js
 *
 * Auth + Firestore must succeed even when Storage is not provisioned / Blaze-locked.
 */
(function (global) {
  'use strict';

  var app = null;
  var auth = null;
  var db = null;
  var storage = null;
  var storageAvailable = false;
  var ready = false;
  var initError = null;

  function getConfig() {
    return global.SOARVIBE_FIREBASE_CONFIG || null;
  }

  function logFirebaseDiagnostics(cfg, appsCount) {
    try {
      var key = cfg && cfg.apiKey ? String(cfg.apiKey) : '';
      var appId = cfg && cfg.appId ? String(cfg.appId) : '';
      var standalone =
        typeof window !== 'undefined' &&
        ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
          (window.navigator && window.navigator.standalone === true));
      console.info('[SOARVIBE] Firebase diagnostics', {
        projectId: (cfg && cfg.projectId) || '',
        authDomain: (cfg && cfg.authDomain) || '',
        appIdTail: appId ? appId.slice(-4) : '',
        apiKeyPresent: !!key,
        apiKeyLength: key.length,
        firebaseAppsCount: appsCount,
        displayMode: standalone ? 'standalone' : 'browser',
        pathname: typeof location !== 'undefined' ? location.pathname : '',
        origin: typeof location !== 'undefined' ? location.origin : ''
      });
    } catch (diagErr) {
      /* silent */
    }
  }

  function initFirebase() {
    if (ready) return { app: app, auth: auth, db: db, storage: storage };
    if (typeof firebase === 'undefined') {
      initError = new Error('Firebase SDK not loaded');
      console.warn('[SOARVIBE] Firebase SDK missing');
      return null;
    }
    var cfg = getConfig();
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      initError = new Error('SOARVIBE_FIREBASE_CONFIG missing');
      console.warn('[SOARVIBE] Firebase config missing');
      return null;
    }
    try {
      var beforeCount = firebase.apps ? firebase.apps.length : 0;
      if (!beforeCount) {
        app = firebase.initializeApp(cfg);
      } else {
        app = firebase.app();
      }
      auth = firebase.auth();
      db = firebase.firestore();
      storage = null;
      storageAvailable = false;
      try {
        if (typeof firebase.storage === 'function') {
          storage = firebase.storage();
          storageAvailable = !!storage;
        }
      } catch (storageInitErr) {
        storage = null;
        storageAvailable = false;
        console.warn(
          '[SOARVIBE] Firebase Storage init skipped (Auth/Firestore still ready)',
          storageInitErr && storageInitErr.message
        );
      }
      ready = true;
      initError = null;
      logFirebaseDiagnostics(cfg, firebase.apps ? firebase.apps.length : 0);
      return { app: app, auth: auth, db: db, storage: storage };
    } catch (e) {
      initError = e;
      console.error('[SOARVIBE] Firebase init failed:', e && e.code, e && e.message);
      return null;
    }
  }

  function isReady() {
    return ready;
  }

  function getAuth() {
    if (!ready) initFirebase();
    return auth;
  }

  function getDb() {
    if (!ready) initFirebase();
    return db;
  }

  function getStorage() {
    if (!ready) initFirebase();
    return storageAvailable ? storage : null;
  }

  function isStorageAvailable() {
    if (!ready) initFirebase();
    return storageAvailable && !!storage;
  }

  function getInitError() {
    return initError;
  }

  global.SOARVIBE_FIREBASE = {
    init: initFirebase,
    isReady: isReady,
    getAuth: getAuth,
    getDb: getDb,
    getStorage: getStorage,
    isStorageAvailable: isStorageAvailable,
    getInitError: getInitError,
    getDiagnostics: function () {
      var cfg = getConfig() || {};
      var key = cfg.apiKey ? String(cfg.apiKey) : '';
      var appId = cfg.appId ? String(cfg.appId) : '';
      return {
        projectId: cfg.projectId || '',
        authDomain: cfg.authDomain || '',
        appIdTail: appId ? appId.slice(-4) : '',
        apiKeyPresent: !!key,
        apiKeyLength: key.length,
        firebaseAppsCount:
          typeof firebase !== 'undefined' && firebase.apps ? firebase.apps.length : 0,
        ready: ready
      };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
