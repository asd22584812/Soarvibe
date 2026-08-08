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

  function openSoarvibeAuthModal(opts) {
    opts = opts || {};
    var modal = $('svAuthModal');
    if (!modal) return;
    setMsg(opts.reason || '', false);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    var email = $('svAuthEmail');
    if (email) email.focus();
  }

  function closeSoarvibeAuthModal() {
    var modal = $('svAuthModal');
    if (!modal) return;
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
    if (!AUTH || !AUTH.isSignedIn()) {
      box.textContent = '尚未登入 — 瀏覽 City Shares 不用登入；留言／按讚／發文時會請您登入。';
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
      return;
    }
    var p = AUTH.getProfile() || {};
    var u = AUTH.currentUser();
    box.textContent =
      '已登入：' +
      (p.nickname || u.displayName || u.email || u.uid);
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

    if (openBtn) openBtn.addEventListener('click', function () {
      openSoarvibeAuthModal();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeSoarvibeAuthModal);
    if (backdrop) backdrop.addEventListener('click', closeSoarvibeAuthModal);
    if (tabLogin) tabLogin.addEventListener('click', function () {
      setMode('login');
    });
    if (tabRegister) tabRegister.addEventListener('click', function () {
      setMode('register');
    });
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        AUTH.signOut().then(renderAuthStatus);
      });
    }
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = ($('svAuthEmail') && $('svAuthEmail').value || '').trim();
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
          })
          .catch(function (err) {
            setMsg((err && err.message) || '登入失敗', true);
          });
      });
    }
    if (googleBtn) {
      googleBtn.addEventListener('click', function () {
        setMsg('開啟 Google 登入…', false);
        AUTH.signInGoogle()
          .then(function () {
            closeSoarvibeAuthModal();
            renderAuthStatus();
            syncProfileToUserCenter();
          })
          .catch(function (err) {
            setMsg((err && err.message) || 'Google 登入失敗', true);
          });
      });
    }

    AUTH.onAuthStateChanged(function () {
      renderAuthStatus();
      syncProfileToUserCenter();
    });
    setMode('login');
    renderAuthStatus();
  }

  global.openSoarvibeAuthModal = openSoarvibeAuthModal;
  global.closeSoarvibeAuthModal = closeSoarvibeAuthModal;
  global.bindSoarvibeAuthUi = bindAuthUi;
  global.renderSoarvibeAuthStatus = renderAuthStatus;
})(typeof window !== 'undefined' ? window : globalThis);
