/**
 * SoarVibe Auth — Email/Password + Google, users/{uid} bootstrap.
 *
 * Single source of truth: SOARVIBE_AUTH.currentUser (cached from onAuthStateChanged).
 * Boot order: init Firebase → setPersistence(LOCAL) → getRedirectResult → onAuthStateChanged.
 */
(function (global) {
  'use strict';

  var listeners = [];
  var authUser = null;
  var currentProfile = null;
  var unsubAuth = null;
  var started = false;
  var starting = null;
  var persistenceReady = false;
  var persistenceError = null;
  var firstAuthEventDone = false;
  var resumingPending = false;
  var lastRedirectError = null;

  var pendingActionKey = 'soarvibe_pending_action';
  var pendingActionPayloadKey = 'soarvibe_pending_action_payload';
  var redirectPendingKey = 'soarvibe_auth_redirect_pending';
  var pendingResumeFns = Object.create(null);

  var authReadyResolve = null;
  var authReadyReject = null;
  var authReadyPromise = new Promise(function (resolve, reject) {
    authReadyResolve = resolve;
    authReadyReject = reject;
  });

  function displayMode() {
    try {
      if (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(display-mode: standalone)').matches
      ) {
        return 'standalone';
      }
      if (typeof navigator !== 'undefined' && navigator.standalone === true) {
        return 'standalone';
      }
    } catch (e) {
      /* silent */
    }
    return 'browser';
  }

  function authDiag(event, extra) {
    try {
      var payload = Object.assign(
        {
          event: event,
          displayMode: displayMode(),
          pathname: typeof location !== 'undefined' ? location.pathname : '',
          origin: typeof location !== 'undefined' ? location.origin : ''
        },
        extra || {}
      );
      console.info('[SOARVIBE][auth]', payload);
    } catch (e) {
      /* silent */
    }
  }

  function storageGet(key) {
    try {
      var v = localStorage.getItem(key);
      if (v != null) return v;
    } catch (e1) {
      /* silent */
    }
    try {
      return sessionStorage.getItem(key);
    } catch (e2) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e1) {
      /* silent */
    }
    try {
      sessionStorage.setItem(key, value);
    } catch (e2) {
      /* silent */
    }
  }

  function storageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e1) {
      /* silent */
    }
    try {
      sessionStorage.removeItem(key);
    } catch (e2) {
      /* silent */
    }
  }

  function setPendingAction(actionId, payload) {
    if (!actionId) {
      storageRemove(pendingActionKey);
      storageRemove(pendingActionPayloadKey);
      return;
    }
    storageSet(pendingActionKey, String(actionId));
    storageSet(pendingActionPayloadKey, JSON.stringify(payload || {}));
  }

  function getPendingAction() {
    var id = storageGet(pendingActionKey);
    if (!id) return null;
    var payload = {};
    try {
      payload = JSON.parse(storageGet(pendingActionPayloadKey) || '{}');
    } catch (parseErr) {
      payload = {};
    }
    return { id: id, payload: payload };
  }

  function clearPendingAction() {
    setPendingAction(null);
  }

  function registerPendingActionHandler(actionId, fn) {
    if (!actionId || typeof fn !== 'function') return;
    pendingResumeFns[actionId] = fn;
  }

  function resumePendingAction() {
    if (!isSignedIn() || resumingPending) return false;
    var pending = getPendingAction();
    if (!pending || !pending.id) {
      authDiag('pendingAction restored', { restored: false });
      return false;
    }
    var fn = pendingResumeFns[pending.id];
    if (typeof fn !== 'function') {
      authDiag('pendingAction restored', {
        restored: false,
        reason: 'handler-missing',
        actionId: pending.id
      });
      return false;
    }
    resumingPending = true;
    clearPendingAction();
    authDiag('pendingAction restored', { restored: true, actionId: pending.id });
    try {
      fn(pending.payload || {});
    } catch (e) {
      console.warn('[SOARVIBE] resumePendingAction failed', e);
    }
    resumingPending = false;
    return true;
  }

  function auth() {
    return global.SOARVIBE_FIREBASE && global.SOARVIBE_FIREBASE.getAuth
      ? global.SOARVIBE_FIREBASE.getAuth()
      : null;
  }

  function db() {
    return global.SOARVIBE_FIREBASE && global.SOARVIBE_FIREBASE.getDb
      ? global.SOARVIBE_FIREBASE.getDb()
      : null;
  }

  function storage() {
    return global.SOARVIBE_FIREBASE && global.SOARVIBE_FIREBASE.getStorage
      ? global.SOARVIBE_FIREBASE.getStorage()
      : null;
  }

  function currentUser() {
    return authUser;
  }

  function isSignedIn() {
    return !!authUser;
  }

  function isAuthReady() {
    return firstAuthEventDone;
  }

  function whenAuthReady() {
    return authReadyPromise;
  }

  function notify() {
    var snap = {
      user: authUser,
      profile: currentProfile,
      signedIn: !!authUser,
      authReady: firstAuthEventDone,
      persistenceReady: persistenceReady,
      persistenceError: persistenceError
    };
    listeners.forEach(function (fn) {
      try {
        fn(snap);
      } catch (e) {
        console.warn('[SOARVIBE] auth listener error', e);
      }
    });
  }

  function onAuthStateChanged(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    if (firstAuthEventDone) {
      fn({
        user: authUser,
        profile: currentProfile,
        signedIn: !!authUser,
        authReady: true,
        persistenceReady: persistenceReady,
        persistenceError: persistenceError
      });
    }
    return function () {
      listeners = listeners.filter(function (x) {
        return x !== fn;
      });
    };
  }

  function markAuthReady() {
    if (firstAuthEventDone) return;
    firstAuthEventDone = true;
    authDiag('authReady resolved', { uidPresent: !!authUser });
    if (authReadyResolve) authReadyResolve({ user: authUser, signedIn: !!authUser });
  }

  function sanitizeNickname(name, fallback) {
    var n = String(name || '')
      .trim()
      .slice(0, 32);
    return n || fallback || '旅人';
  }

  function ensureUserDoc(user) {
    var database = db();
    if (!database || !user) return Promise.resolve(null);
    var ref = database.collection('users').doc(user.uid);
    return ref.get().then(function (snap) {
      var now = firebase.firestore.FieldValue.serverTimestamp();
      if (snap.exists) {
        currentProfile = Object.assign({ uid: user.uid }, snap.data());
        return currentProfile;
      }
      var nickname = sanitizeNickname(
        user.displayName || (user.email ? user.email.split('@')[0] : ''),
        '旅人'
      );
      var doc = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || nickname,
        nickname: nickname,
        avatarUrl: user.photoURL || '',
        createdAt: now,
        updatedAt: now,
        providerIds: (user.providerData || []).map(function (p) {
          return p.providerId;
        })
      };
      return ref.set(doc).then(function () {
        currentProfile = doc;
        return currentProfile;
      });
    });
  }

  function refreshProfile() {
    var user = currentUser();
    var database = db();
    if (!user || !database) {
      currentProfile = null;
      return Promise.resolve(null);
    }
    return database
      .collection('users')
      .doc(user.uid)
      .get()
      .then(function (snap) {
        if (!snap.exists) return ensureUserDoc(user);
        currentProfile = Object.assign({ uid: user.uid }, snap.data());
        return currentProfile;
      });
  }

  function updateProfile(partial) {
    var user = currentUser();
    var database = db();
    if (!user || !database) return Promise.reject(new Error('請先登入'));
    var patch = Object.assign({}, partial || {}, {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      uid: user.uid
    });
    delete patch.createdAt;
    return database
      .collection('users')
      .doc(user.uid)
      .set(patch, { merge: true })
      .then(function () {
        return refreshProfile();
      });
  }

  function uploadAvatar(file) {
    var flags = global.SOARVIBE_FEATURE_FLAGS || {};
    if (flags.avatarUploadEnabled !== true) {
      return Promise.reject(new Error('頭像上傳即將開放'));
    }
    var user = currentUser();
    var store = storage();
    if (!user) return Promise.reject(new Error('請先登入'));
    if (!store) return Promise.reject(new Error('頭像上傳尚未啟用'));
    if (!file) return Promise.reject(new Error('未選擇檔案'));
    var type = String(file.type || '');
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(type)) {
      return Promise.reject(new Error('僅支援 JPG / PNG / WEBP'));
    }
    if (file.size > 2 * 1024 * 1024) {
      return Promise.reject(new Error('頭像請小於 2MB'));
    }
    var ext = type.indexOf('png') !== -1 ? 'png' : type.indexOf('webp') !== -1 ? 'webp' : 'jpg';
    var path = 'users/' + user.uid + '/avatar.' + ext;
    var ref = store.ref().child(path);
    return ref
      .put(file, { contentType: type })
      .then(function () {
        return ref.getDownloadURL();
      })
      .then(function (url) {
        return updateProfile({ avatarUrl: url }).then(function () {
          return url;
        });
      });
  }

  function ensurePersistence(a) {
    if (!a) {
      return Promise.reject(new Error('Firebase Auth 未就緒'));
    }
    if (persistenceReady) return Promise.resolve(true);
    return a
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(function () {
        persistenceReady = true;
        persistenceError = null;
        authDiag('auth persistence set success');
        return true;
      })
      .catch(function (err) {
        persistenceReady = false;
        persistenceError = err;
        authDiag('auth persistence set fail', {
          code: (err && err.code) || '',
          message: (err && err.message) || ''
        });
        return Promise.reject(err);
      });
  }

  function afterCredentialUser(user) {
    if (!user) return Promise.resolve(null);
    authUser = user;
    return ensureUserDoc(user).then(function () {
      notify();
      resumePendingAction();
      return user;
    });
  }

  function signUpEmail(email, password, nickname) {
    return ensurePersistence(auth()).then(function () {
      var a = auth();
      if (!a) return Promise.reject(new Error('Firebase Auth 未就緒'));
      return a.createUserWithEmailAndPassword(email, password).then(function (cred) {
        var nick = sanitizeNickname(nickname, email.split('@')[0]);
        return cred.user
          .updateProfile({ displayName: nick })
          .catch(function () {})
          .then(function () {
            return ensureUserDoc(cred.user).then(function () {
              return updateProfile({ nickname: nick, displayName: nick });
            });
          })
          .then(function () {
            authUser = cred.user;
            notify();
            return cred.user;
          });
      });
    });
  }

  function signInEmail(email, password) {
    return ensurePersistence(auth()).then(function () {
      var a = auth();
      if (!a) return Promise.reject(new Error('Firebase Auth 未就緒'));
      return a.signInWithEmailAndPassword(email, password).then(function (cred) {
        return afterCredentialUser(cred.user);
      });
    });
  }

  function prefersRedirectSignIn() {
    var ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    var standalone = displayMode() === 'standalone';
    return standalone || /iPhone|iPad|iPod|Android/i.test(ua);
  }

  function crossOriginAuthDomain() {
    try {
      var cfg = global.SOARVIBE_FIREBASE_CONFIG || {};
      var authDomain = String(cfg.authDomain || '');
      var host = typeof location !== 'undefined' ? location.hostname : '';
      if (!authDomain || !host) return false;
      return authDomain !== host;
    } catch (e) {
      return true;
    }
  }

  function signInGoogle() {
    return ensurePersistence(auth()).then(function () {
      var a = auth();
      if (!a) return Promise.reject(new Error('Firebase Auth 未就緒'));
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      var useRedirect = prefersRedirectSignIn();
      if (useRedirect) {
        authDiag('before redirect', {
          crossOriginAuthDomain: crossOriginAuthDomain(),
          authDomain: (global.SOARVIBE_FIREBASE_CONFIG &&
            global.SOARVIBE_FIREBASE_CONFIG.authDomain) ||
            ''
        });
        storageSet(redirectPendingKey, '1');
        return a.signInWithRedirect(provider);
      }

      return a
        .signInWithPopup(provider)
        .then(function (cred) {
          return afterCredentialUser(cred.user);
        })
        .catch(function (err) {
          var code = err && err.code;
          if (
            code === 'auth/popup-blocked' ||
            code === 'auth/popup-closed-by-user' ||
            code === 'auth/cancelled-popup-request' ||
            code === 'auth/operation-not-supported-in-this-environment'
          ) {
            authDiag('before redirect', {
              reason: 'popup-fallback',
              code: code || '',
              crossOriginAuthDomain: crossOriginAuthDomain()
            });
            storageSet(redirectPendingKey, '1');
            return a.signInWithRedirect(provider);
          }
          return Promise.reject(err);
        });
    });
  }

  function signOut() {
    var a = auth();
    if (!a) {
      authUser = null;
      currentProfile = null;
      notify();
      return Promise.resolve();
    }
    return a.signOut().then(function () {
      authUser = null;
      currentProfile = null;
      notify();
    });
  }

  function handleRedirectResult(a) {
    return a
      .getRedirectResult()
      .then(function (cred) {
        var hadPending = storageGet(redirectPendingKey) === '1';
        if (cred && cred.user) {
          storageRemove(redirectPendingKey);
          authDiag('getRedirectResult', { result: 'user' });
          return afterCredentialUser(cred.user).then(function () {
            if (typeof global.closeSoarvibeAuthModal === 'function') {
              global.closeSoarvibeAuthModal();
            }
            return cred;
          });
        }
        authDiag('getRedirectResult', { result: 'null', hadRedirectPending: hadPending });
        if (hadPending) {
          storageRemove(redirectPendingKey);
          var err = new Error(
            'Google 登入導回後無法恢復工作階段。此環境可能封鎖跨站 Auth storage（常見於 iOS Safari / PWA + GitHub Pages）。請改用 Email 登入，或改在 Firebase Hosting 網域測試 Google 登入。'
          );
          err.code = 'auth/redirect-session-lost';
          err.crossOriginAuthDomain = crossOriginAuthDomain();
          lastRedirectError = err;
          return Promise.reject(err);
        }
        return null;
      })
      .catch(function (e) {
        storageRemove(redirectPendingKey);
        lastRedirectError = e;
        authDiag('getRedirectResult', {
          result: 'error',
          code: (e && e.code) || '',
          message: (e && e.message) || ''
        });
        return Promise.reject(e);
      });
  }

  function start() {
    if (started) return authReadyPromise;
    if (starting) return starting;

    authDiag('boot started');
    starting = Promise.resolve()
      .then(function () {
        if (global.SOARVIBE_FIREBASE && global.SOARVIBE_FIREBASE.init) {
          global.SOARVIBE_FIREBASE.init();
        }
        var a = auth();
        if (!a) {
          var missing = new Error('Firebase Auth 未就緒');
          markAuthReady();
          notify();
          if (authReadyReject) authReadyReject(missing);
          throw missing;
        }
        return ensurePersistence(a)
          .catch(function (err) {
            // Persistence failure must not pretend login works; still attach listener.
            return err;
          })
          .then(function (persistOutcome) {
            var persistFailed =
              persistOutcome && persistOutcome instanceof Error ? persistOutcome : null;
            return handleRedirectResult(a)
              .catch(function (redirectErr) {
                // Surface redirect loss to UI listeners; do not signOut.
                try {
                  global.dispatchEvent(
                    new CustomEvent('soarvibe-auth-redirect-failed', {
                      detail: {
                        code: (redirectErr && redirectErr.code) || '',
                        message: (redirectErr && redirectErr.message) || ''
                      }
                    })
                  );
                } catch (evtErr) {
                  /* silent */
                }
                return null;
              })
              .then(function () {
                if (unsubAuth) return;
                unsubAuth = a.onAuthStateChanged(function (user) {
                  if (!firstAuthEventDone) {
                    authDiag('first onAuthStateChanged', {
                      result: user ? 'uid-present' : 'null'
                    });
                  }
                  if (!user) {
                    authUser = null;
                    currentProfile = null;
                    markAuthReady();
                    notify();
                    return;
                  }
                  authUser = user;
                  ensureUserDoc(user)
                    .then(function () {
                      markAuthReady();
                      notify();
                      if (typeof global.closeSoarvibeAuthModal === 'function') {
                        global.closeSoarvibeAuthModal();
                      }
                      resumePendingAction();
                    })
                    .catch(function (e) {
                      console.warn('[SOARVIBE] ensureUserDoc failed', e);
                      markAuthReady();
                      notify();
                    });
                });
                if (persistFailed) {
                  try {
                    global.dispatchEvent(
                      new CustomEvent('soarvibe-auth-persistence-failed', {
                        detail: {
                          code: (persistFailed && persistFailed.code) || '',
                          message: (persistFailed && persistFailed.message) || ''
                        }
                      })
                    );
                  } catch (evtErr2) {
                    /* silent */
                  }
                }
                started = true;
                return authReadyPromise;
              });
          });
      })
      .catch(function (err) {
        markAuthReady();
        notify();
        return authReadyPromise;
      });

    return starting;
  }

  function requireAuth(actionLabel, opts) {
    opts = opts || {};
    return whenAuthReady().then(function () {
      if (isSignedIn()) return currentUser();
      if (opts.pendingAction) {
        setPendingAction(opts.pendingAction, opts.pendingPayload || {});
      }
      var label = actionLabel || '繼續';
      try {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
      } catch (blurErr) {
        /* silent */
      }
      if (typeof global.openSoarvibeAuthModal === 'function') {
        global.openSoarvibeAuthModal({ reason: '請先登入後才能' + label });
      }
      return Promise.reject(new Error('AUTH_REQUIRED'));
    });
  }

  function privateDocRef(docId) {
    var user = currentUser();
    var database = db();
    if (!user || !database) return null;
    return database.collection('users').doc(user.uid).collection('private').doc(docId);
  }

  function savePrivateDoc(docId, data) {
    var ref = privateDocRef(docId);
    if (!ref) return Promise.resolve(false);
    return ref
      .set(
        Object.assign({}, data || {}, {
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }),
        { merge: true }
      )
      .then(function () {
        return true;
      })
      .catch(function (e) {
        console.warn('[SOARVIBE] savePrivateDoc failed', docId, e);
        return false;
      });
  }

  function loadPrivateDoc(docId) {
    var ref = privateDocRef(docId);
    if (!ref) return Promise.resolve(null);
    return ref
      .get()
      .then(function (snap) {
        return snap.exists ? snap.data() : null;
      })
      .catch(function (e) {
        console.warn('[SOARVIBE] loadPrivateDoc failed', docId, e);
        return null;
      });
  }

  function getIdToken(forceRefresh) {
    var user = currentUser();
    if (!user || typeof user.getIdToken !== 'function') {
      return Promise.reject(new Error('請先登入'));
    }
    return user.getIdToken(!!forceRefresh);
  }

  global.SOARVIBE_AUTH = {
    start: start,
    whenAuthReady: whenAuthReady,
    isAuthReady: isAuthReady,
    onAuthStateChanged: onAuthStateChanged,
    currentUser: currentUser,
    getIdToken: getIdToken,
    isSignedIn: isSignedIn,
    getProfile: function () {
      return currentProfile;
    },
    refreshProfile: refreshProfile,
    updateProfile: updateProfile,
    uploadAvatar: uploadAvatar,
    signUpEmail: signUpEmail,
    signInEmail: signInEmail,
    signInGoogle: signInGoogle,
    signOut: signOut,
    requireAuth: requireAuth,
    setPendingAction: setPendingAction,
    clearPendingAction: clearPendingAction,
    getPendingAction: getPendingAction,
    registerPendingActionHandler: registerPendingActionHandler,
    resumePendingAction: resumePendingAction,
    sanitizeNickname: sanitizeNickname,
    savePrivateDoc: savePrivateDoc,
    loadPrivateDoc: loadPrivateDoc,
    getPersistenceError: function () {
      return persistenceError;
    },
    isPersistenceReady: function () {
      return persistenceReady;
    },
    consumeRedirectError: function () {
      var err = lastRedirectError;
      lastRedirectError = null;
      return err;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
