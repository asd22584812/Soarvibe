/**
 * Auth modal + personal-center auth wiring helpers.
 */
(function (global) {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function setMsg(text, isError) {
    var el = $('svAuthMsg');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', !!isError);
    el.classList.toggle('hidden', !text);
  }

  function humanizeAuthError(err) {
    var code = (err && err.code) || '';
    var raw = (err && err.message) || '';
    if (code) {
      console.warn('[SOARVIBE] Auth error code:', code, raw);
    } else if (raw) {
      console.warn('[SOARVIBE] Auth error:', raw);
    }
    if (code === 'auth/redirect-session-lost') {
      return (
        raw ||
        'Google 登入導回後無法恢復工作階段。請改用 Email 登入，或改在 Firebase Hosting 網域使用 Google 登入。'
      );
    }
    if (
      code === 'auth/api-key-not-valid' ||
      /api-key-not-valid|API key not valid/i.test(raw)
    ) {
      return '登入服務暫時無法使用，請稍後再試。';
    }
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return '帳號或密碼不正確，請再試一次。';
    }
    if (code === 'auth/user-not-found') {
      return '找不到此帳號，請先註冊。';
    }
    if (code === 'auth/email-already-in-use') {
      return '此 Email 已註冊，請直接登入。';
    }
    if (code === 'auth/weak-password') {
      return '密碼太弱，請至少使用 6 個字元。';
    }
    if (code === 'auth/invalid-email') {
      return 'Email 格式不正確。';
    }
    if (code === 'auth/too-many-requests') {
      return '嘗試次數過多，請稍後再試。';
    }
    if (code === 'auth/network-request-failed') {
      return '網路不穩，請檢查連線後再試。';
    }
    if (code === 'auth/popup-blocked') {
      return '瀏覽器封鎖了登入視窗，請允許後再試。';
    }
    if (
      code === 'auth/web-storage-unsupported' ||
      /persistence|indexedDB|localStorage|storage/i.test(code + ' ' + raw)
    ) {
      return '無法儲存登入狀態，請檢查瀏覽器是否封鎖網站資料後再試。';
    }
    return '登入服務暫時無法使用，請稍後再試。';
  }

  function blurActive() {
    try {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } catch (e) {
      /* silent */
    }
  }

  function openSoarvibeAuthModal(opts) {
    opts = opts || {};
    var AUTH = global.SOARVIBE_AUTH;
    var openNow = function () {
      if (AUTH && AUTH.isSignedIn && AUTH.isSignedIn()) {
        closeSoarvibeAuthModal();
        if (AUTH.resumePendingAction) AUTH.resumePendingAction();
        return;
      }
      blurActive();
      var modal = $('svAuthModal');
      if (!modal) return;
      setMsg(opts.reason || '', false);
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      if (opts.focus === false) return;
      var email = $('svAuthEmail');
      window.setTimeout(function () {
        if (!email || modal.classList.contains('hidden')) return;
        try {
          email.focus({ preventScroll: true });
        } catch (focusErr) {
          try {
            email.focus();
          } catch (e2) {
            /* silent */
          }
        }
      }, 60);
    };

    // Never flash login modal while Firebase is still restoring session.
    if (AUTH && AUTH.whenAuthReady && !(AUTH.isAuthReady && AUTH.isAuthReady())) {
      AUTH.whenAuthReady().then(openNow).catch(openNow);
      return;
    }
    openNow();
  }

  function closeSoarvibeAuthModal() {
    var modal = $('svAuthModal');
    if (!modal) return;
    blurActive();
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    setMsg('', false);
  }

  function renderAuthStatus() {
    var AUTH = global.SOARVIBE_AUTH;
    var box = $('svAuthStatus');
    var loginBtn = $('svAuthOpenBtn');
    var logoutBtn = $('svAuthLogoutBtn');
    if (!box) return;

    if (!AUTH || (AUTH.isAuthReady && !AUTH.isAuthReady())) {
      box.textContent = '登入狀態確認中…';
      if (loginBtn) loginBtn.classList.add('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
      return;
    }

    if (!AUTH.isSignedIn()) {
      box.textContent = '尚未登入 — 瀏覽 City Shares 不用登入；留言／按讚／發文時會請您登入。';
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
      return;
    }
    var p = AUTH.getProfile() || {};
    var u = AUTH.currentUser();
    box.textContent =
      '已登入：' +
      (p.nickname || (u && u.displayName) || (u && u.email) || (u && u.uid) || '');
    if (loginBtn) loginBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
  }

  function syncProfileToUserCenter() {
    var AUTH = global.SOARVIBE_AUTH;
    if (!AUTH || !AUTH.isSignedIn()) return;
    var p = AUTH.getProfile() || {};
    var nick = document.getElementById('user-nickname');
    if (nick && p.nickname) nick.value = p.nickname;
    if (p.avatarUrl && typeof global.applyUserAvatar === 'function') {
      global.applyUserAvatar(p.avatarUrl);
    } else if (p.avatarUrl) {
      var img = document.getElementById('user-avatar-img');
      var icon = document.getElementById('user-avatar-icon');
      if (img) {
        img.src = p.avatarUrl;
        img.classList.remove('hidden');
      }
      if (icon) icon.classList.add('hidden');
    }
  }

  function bindAuthUi() {
    var AUTH = global.SOARVIBE_AUTH;
    if (!AUTH) return;

    var openBtn = $('svAuthOpenBtn');
    var logoutBtn = $('svAuthLogoutBtn');
    var closeBtn = $('svAuthCloseBtn');
    var backdrop = $('svAuthBackdrop');
    var tabLogin = $('svAuthTabLogin');
    var tabRegister = $('svAuthTabRegister');
    var form = $('svAuthForm');
    var googleBtn = $('svAuthGoogleBtn');
    var nickWrap = $('svAuthNicknameWrap');
    var mode = 'login';

    function setMode(next) {
      mode = next;
      if (tabLogin) tabLogin.classList.toggle('is-active', mode === 'login');
      if (tabRegister) tabRegister.classList.toggle('is-active', mode === 'register');
      if (nickWrap) nickWrap.classList.toggle('hidden', mode !== 'register');
      var submit = $('svAuthSubmitBtn');
      if (submit) submit.textContent = mode === 'login' ? '登入' : '註冊';
    }

    if (openBtn) {
      openBtn.addEventListener('click', function () {
        openSoarvibeAuthModal();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeSoarvibeAuthModal);
    if (backdrop) backdrop.addEventListener('click', closeSoarvibeAuthModal);
    if (tabLogin) {
      tabLogin.addEventListener('click', function () {
        setMode('login');
      });
    }
    if (tabRegister) {
      tabRegister.addEventListener('click', function () {
        setMode('register');
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        AUTH.signOut().then(renderAuthStatus);
      });
    }
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (($('svAuthEmail') && $('svAuthEmail').value) || '').trim();
        var password = ($('svAuthPassword') && $('svAuthPassword').value) || '';
        var nickname = ($('svAuthNickname') && $('svAuthNickname').value) || '';
        setMsg('處理中…', false);
        var job =
          mode === 'register'
            ? AUTH.signUpEmail(email, password, nickname)
            : AUTH.signInEmail(email, password);
        job
          .then(function () {
            setMsg('成功！', false);
            closeSoarvibeAuthModal();
            renderAuthStatus();
            syncProfileToUserCenter();
            if (AUTH.resumePendingAction) AUTH.resumePendingAction();
          })
          .catch(function (err) {
            setMsg(humanizeAuthError(err), true);
          });
      });
    }
    if (googleBtn) {
      googleBtn.addEventListener('click', function () {
        setMsg('開啟 Google 登入…', false);
        AUTH.signInGoogle()
          .then(function () {
            // Redirect navigates away; popup/email-like completion lands here.
            closeSoarvibeAuthModal();
            renderAuthStatus();
            syncProfileToUserCenter();
            if (AUTH.resumePendingAction) AUTH.resumePendingAction();
          })
          .catch(function (err) {
            setMsg(humanizeAuthError(err), true);
          });
      });
    }

    AUTH.onAuthStateChanged(function (snap) {
      renderAuthStatus();
      syncProfileToUserCenter();
      if (snap && snap.signedIn) {
        closeSoarvibeAuthModal();
        if (AUTH.resumePendingAction) AUTH.resumePendingAction();
      }
    });

    try {
      global.addEventListener('soarvibe-auth-redirect-failed', function (evt) {
        var detail = (evt && evt.detail) || {};
        openSoarvibeAuthModal({
          reason: humanizeAuthError({
            code: detail.code || 'auth/redirect-session-lost',
            message: detail.message || ''
          })
        });
        setMsg(
          humanizeAuthError({
            code: detail.code || 'auth/redirect-session-lost',
            message: detail.message || ''
          }),
          true
        );
      });
      global.addEventListener('soarvibe-auth-persistence-failed', function (evt) {
        var detail = (evt && evt.detail) || {};
        openSoarvibeAuthModal({
          reason: humanizeAuthError({
            code: detail.code || 'auth/web-storage-unsupported',
            message: detail.message || ''
          })
        });
        setMsg(
          humanizeAuthError({
            code: detail.code || 'auth/web-storage-unsupported',
            message: detail.message || ''
          }),
          true
        );
      });
    } catch (evtBindErr) {
      /* silent */
    }

    // Catch redirect errors that fired before this UI was bound.
    if (AUTH.whenAuthReady) {
      AUTH.whenAuthReady().then(function () {
        var redirectErr = AUTH.consumeRedirectError && AUTH.consumeRedirectError();
        if (redirectErr) {
          openSoarvibeAuthModal({ reason: humanizeAuthError(redirectErr) });
          setMsg(humanizeAuthError(redirectErr), true);
        }
        var persistErr = AUTH.getPersistenceError && AUTH.getPersistenceError();
        if (persistErr) {
          openSoarvibeAuthModal({ reason: humanizeAuthError(persistErr) });
          setMsg(humanizeAuthError(persistErr), true);
        }
        renderAuthStatus();
      });
    }

    setMode('login');
    renderAuthStatus();
  }

  global.openSoarvibeAuthModal = openSoarvibeAuthModal;
  global.closeSoarvibeAuthModal = closeSoarvibeAuthModal;
  global.bindSoarvibeAuthUi = bindAuthUi;
  global.renderSoarvibeAuthStatus = renderAuthStatus;
  global.humanizeSoarvibeAuthError = humanizeAuthError;
})(typeof window !== 'undefined' ? window : globalThis);
