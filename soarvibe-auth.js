/**
 * SoarVibe Auth — Email/Password + Google, users/{uid} bootstrap.
 */
(function (global) {
  'use strict';

  var listeners = [];
  var currentProfile = null;
  var unsubAuth = null;

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
    var a = auth();
    return a ? a.currentUser : null;
  }

  function isSignedIn() {
    return !!currentUser();
  }

  function notify() {
    var snap = {
      user: currentUser(),
      profile: currentProfile,
      signedIn: isSignedIn()
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
    fn({ user: currentUser(), profile: currentProfile, signedIn: isSignedIn() });
    return function () {
      listeners = listeners.filter(function (x) {
        return x !== fn;
      });
    };
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
    // Prevent clients from swapping uid
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
    var user = currentUser();
    var store = storage();
    if (!user) return Promise.reject(new Error('請先登入'));
    if (!store) return Promise.reject(new Error('Storage 尚未啟用'));
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

  function signUpEmail(email, password, nickname) {
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
          notify();
          return cred.user;
        });
    });
  }

  function signInEmail(email, password) {
    var a = auth();
    if (!a) return Promise.reject(new Error('Firebase Auth 未就緒'));
    return a.signInWithEmailAndPassword(email, password).then(function (cred) {
      return ensureUserDoc(cred.user).then(function () {
        notify();
        return cred.user;
      });
    });
  }

  function signInGoogle() {
    var a = auth();
    if (!a) return Promise.reject(new Error('Firebase Auth 未就緒'));
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    function afterCred(cred) {
      return ensureUserDoc(cred.user).then(function () {
        notify();
        return cred.user;
      });
    }

    var ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    var standalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true);
    var preferRedirect = standalone || /iPhone|iPad|iPod|Android/i.test(ua);

    if (preferRedirect) {
      return a.signInWithRedirect(provider);
    }

    return a.signInWithPopup(provider).then(afterCred).catch(function (err) {
      var code = err && err.code;
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        return a.signInWithRedirect(provider);
      }
      return Promise.reject(err);
    });
  }

  function signOut() {
    var a = auth();
    if (!a) return Promise.resolve();
    return a.signOut().then(function () {
      currentProfile = null;
      notify();
    });
  }

  function start() {
    if (global.SOARVIBE_FIREBASE && global.SOARVIBE_FIREBASE.init) {
      global.SOARVIBE_FIREBASE.init();
    }
    var a = auth();
    if (!a) return;
    if (unsubAuth) return;

    a.getRedirectResult()
      .then(function (cred) {
        if (cred && cred.user) {
          return ensureUserDoc(cred.user).then(function () {
            notify();
          });
        }
      })
      .catch(function (e) {
        console.warn('[SOARVIBE] Google redirect result failed', e);
      });

    unsubAuth = a.onAuthStateChanged(function (user) {
      if (!user) {
        currentProfile = null;
        notify();
        return;
      }
      ensureUserDoc(user)
        .then(function () {
          notify();
        })
        .catch(function (e) {
          console.warn('[SOARVIBE] ensureUserDoc failed', e);
          notify();
        });
    });
  }

  function requireAuth(actionLabel) {
    if (isSignedIn()) return Promise.resolve(currentUser());
    var label = actionLabel || '繼續';
    if (typeof global.openSoarvibeAuthModal === 'function') {
      global.openSoarvibeAuthModal({ reason: '請先登入後才能' + label });
    }
    return Promise.reject(new Error('AUTH_REQUIRED'));
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

  global.SOARVIBE_AUTH = {
    start: start,
    onAuthStateChanged: onAuthStateChanged,
    currentUser: currentUser,
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
    sanitizeNickname: sanitizeNickname,
    savePrivateDoc: savePrivateDoc,
    loadPrivateDoc: loadPrivateDoc
  };
})(typeof window !== 'undefined' ? window : globalThis);
