/**
 * SoarVibe Featured Admin v2 — mobile banner manager.
 * Gate: Worker /api/featured/admin-status (ADMIN_UIDS or claim admin:true).
 * UI hide is NOT security — rules + Worker enforce writes.
 * CSS classes use `svfa-*` (not `fa-*`) to avoid Font Awesome collisions.
 */
(function (global) {
  'use strict';

  var isAdmin = false;
  var adminChecked = false;
  var editingId = null;
  var pendingImage = null;
  var knownIds = Object.create(null);
  var saving = false;
  var deleting = false;

  function apiBase() {
    try {
      if (typeof global.getSoarvibeApiBase === 'function') {
        return String(global.getSoarvibeApiBase() || '').replace(/\/$/, '');
      }
    } catch (e) { /* ignore */ }
    try {
      var stored = localStorage.getItem('SOARVIBE_API_BASE');
      if (stored) return String(stored).replace(/\/$/, '');
    } catch (e2) { /* ignore */ }
    return 'https://soarvibe-api.soarvibe.workers.dev';
  }

  function authApi() {
    return global.SOARVIBE_AUTH || null;
  }

  function dataApi() {
    return global.SOARVIBE_FEATURED_DATA || null;
  }

  function getIdToken() {
    var a = authApi();
    if (a && typeof a.getIdToken === 'function') return a.getIdToken(true);
    return Promise.reject(new Error('請先登入'));
  }

  function setStatus(msg, isError) {
    var el = document.getElementById('featuredAdminStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className =
      'featured-admin-status' +
      (isError ? ' is-error' : '') +
      (!isError && msg ? ' is-ok' : '');
  }

  function formatError(err, fallback) {
    if (!err) return fallback || '發生未知錯誤';
    if (typeof err === 'string') return err;
    var status = err.status;
    var code = err.code || (err.body && err.body.error) || '';
    var msg = String(err.message || fallback || '操作失敗');
    if (/Load failed/i.test(msg)) {
      msg =
        '連線失敗（iPhone 常顯示 Load failed）。請檢查網路，確認已登入 Admin，並重試。';
    }
    if (status === 401) msg = '登入已過期，請重新登入後再試';
    if (status === 403 || code === 'forbidden' || code === 'featured_admin_required') {
      msg = '沒有 Admin 權限，無法上傳或儲存 Banner';
    }
    if (code === 'invalid_image_magic') {
      msg = '圖片格式不支援。請使用 JPG、PNG 或 WebP（iPhone 請勿直接用 HEIC）';
    }
    if (code === 'file_too_large') {
      msg = '圖片太大，請壓縮後再上傳（上限約 2MB）';
    }
    if (status) msg = msg + '（HTTP ' + status + (code ? ' / ' + code : '') + '）';
    else if (code && msg.indexOf(String(code)) === -1) msg = msg + '（' + code + '）';
    return msg;
  }

  function refreshChrome() {
    var btn = document.getElementById('featuredAdminOpenBtn');
    if (!btn) return;
    checkAdmin().then(function (ok) {
      if (ok) {
        btn.classList.remove('hidden');
        btn.setAttribute('aria-hidden', 'false');
      } else {
        btn.classList.add('hidden');
        btn.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function checkAdmin(force) {
    if (adminChecked && !force) return Promise.resolve(isAdmin);
    var a = authApi();
    if (!a || typeof a.isSignedIn !== 'function' || !a.isSignedIn()) {
      isAdmin = false;
      adminChecked = true;
      return Promise.resolve(false);
    }
    return getIdToken()
      .then(function (token) {
        return fetch(apiBase() + '/api/featured/admin-status', {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token }
        }).then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) {
              var err = new Error(
                (body && (body.message || body.error)) || 'admin_status_failed'
              );
              err.status = res.status;
              err.body = body;
              throw err;
            }
            isAdmin = !!(body && body.admin === true);
            adminChecked = true;
            return isAdmin;
          });
        });
      })
      .catch(function (err) {
        console.warn('[FEATURED_ADMIN] admin-status failed', err);
        isAdmin = false;
        adminChecked = true;
        return false;
      });
  }

  function assertAllowedImage(file) {
    if (!file) return;
    var type = String(file.type || '').toLowerCase();
    var name = String(file.name || '').toLowerCase();
    if (
      type.indexOf('heic') !== -1 ||
      type.indexOf('heif') !== -1 ||
      /\.heic$|\.heif$/i.test(name)
    ) {
      var err = new Error('iPhone HEIC 無法上傳，請先轉成 JPG／PNG／WebP');
      err.code = 'invalid_image_magic';
      throw err;
    }
  }

  function uploadBanner(file, partnerId) {
    assertAllowedImage(file);
    return getIdToken().then(function (token) {
      var form = new FormData();
      form.append('partnerId', partnerId);
      form.append('file', file, file.name || 'banner.jpg');
      return fetch(apiBase() + '/api/featured/media/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form
      }).then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var err = new Error((body && (body.message || body.error)) || 'upload_failed');
            err.status = res.status;
            err.body = body;
            err.code = body && body.error;
            throw err;
          }
          return body;
        });
      });
    });
  }

  function deleteBannerMedia(storagePath) {
    if (!storagePath) return Promise.resolve({ ok: true, deleted: 0 });
    return getIdToken().then(function (token) {
      return fetch(apiBase() + '/api/featured/media', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ storagePath: storagePath })
      }).then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var err = new Error((body && (body.message || body.error)) || 'delete_failed');
            err.status = res.status;
            err.body = body;
            throw err;
          }
          return body;
        });
      });
    });
  }

  function parseDatetimeLocal(value) {
    var raw = String(value || '').trim();
    if (!raw) return null;
    var d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function toDatetimeLocalValue(ts) {
    if (ts == null) return '';
    var ms = null;
    if (typeof ts.toMillis === 'function') ms = ts.toMillis();
    else if (typeof ts.toDate === 'function') ms = ts.toDate().getTime();
    else if (typeof ts === 'number') ms = ts;
    if (ms == null || !isFinite(ms)) return '';
    var d = new Date(ms);
    var pad = function (n) {
      return (n < 10 ? '0' : '') + n;
    };
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      'T' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }

  function parseSortOrder(raw) {
    var n = parseInt(String(raw == null ? '' : raw).replace(/[^\d]/g, ''), 10);
    if (!isFinite(n) || n < 0) return 0;
    if (n > 9999) return 9999;
    return n;
  }

  function readForm() {
    return {
      partner: (document.getElementById('faPartner') || {}).value || '',
      title: (document.getElementById('faTitle') || {}).value || '',
      affiliateUrl: (document.getElementById('faAffiliateUrl') || {}).value || '',
      sortOrder: parseSortOrder((document.getElementById('faSortOrder') || {}).value),
      active: !!(document.getElementById('faActive') || {}).checked,
      startAt: parseDatetimeLocal((document.getElementById('faStartAt') || {}).value),
      endAt: parseDatetimeLocal((document.getElementById('faEndAt') || {}).value),
      bannerImageUrl: (document.getElementById('faBannerUrl') || {}).value || '',
      bannerImagePath: (document.getElementById('faBannerPath') || {}).value || ''
    };
  }

  function setPreviewSrc(src) {
    var preview = document.getElementById('faBannerPreview');
    var wrap = document.getElementById('faBannerPreviewWrap');
    if (!preview) return;
    if (src) {
      preview.src = src;
      preview.classList.remove('hidden');
      if (wrap) wrap.classList.remove('hidden');
    } else {
      preview.removeAttribute('src');
      preview.classList.add('hidden');
      if (wrap) wrap.classList.add('hidden');
    }
  }

  function isEditMode() {
    var partnerId = String((document.getElementById('faPartnerId') || {}).value || '').trim();
    return !!(partnerId && knownIds[partnerId]);
  }

  function syncActionMode() {
    var edit = isEditMode();
    var saveBtn = document.getElementById('faSaveBtn');
    var delBtn = document.getElementById('faDeleteBtn');
    if (saveBtn) saveBtn.textContent = edit ? '儲存變更' : '儲存 Banner';
    if (delBtn) {
      if (edit) delBtn.classList.remove('hidden');
      else delBtn.classList.add('hidden');
    }
    var list = document.getElementById('featuredAdminList');
    if (list) {
      var id = String((document.getElementById('faPartnerId') || {}).value || '').trim();
      var rows = list.querySelectorAll('.featured-admin-row');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (id && row.getAttribute('data-id') === id) row.classList.add('is-selected');
        else row.classList.remove('is-selected');
      }
    }
  }

  function fillForm(partner) {
    editingId = partner && partner.id ? partner.id : null;
    if (editingId) knownIds[editingId] = true;
    var idEl = document.getElementById('faPartnerId');
    if (idEl) idEl.value = editingId || '';
    var set = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val == null ? '' : String(val);
    };
    set('faPartner', (partner && (partner.partner || partner.name)) || '');
    set('faTitle', (partner && partner.title) || '');
    set('faAffiliateUrl', (partner && partner.affiliateUrl) || '');
    set('faSortOrder', partner && partner.sortOrder != null ? partner.sortOrder : 10);
    set('faBannerUrl', (partner && (partner.bannerImageUrl || partner.image)) || '');
    set('faBannerPath', (partner && partner.bannerImagePath) || '');
    // New banner / missing schedule → blank (長期顯示). Never invent dates.
    set('faStartAt', partner && partner.startAt != null ? toDatetimeLocalValue(partner.startAt) : '');
    set('faEndAt', partner && partner.endAt != null ? toDatetimeLocalValue(partner.endAt) : '');
    var active = document.getElementById('faActive');
    if (active) active.checked = !!(partner && partner.active);
    setPreviewSrc(partner && (partner.bannerImageUrl || partner.image));
    pendingImage = null;
    var fileInput = document.getElementById('faBannerFile');
    if (fileInput) fileInput.value = '';
    syncActionMode();
    setStatus(isEditMode() ? '編輯既有 Banner' : '新增 Banner（未填日期＝長期顯示）');
  }

  function resetForm() {
    var data = dataApi();
    var newId = data && data.newPartnerId ? data.newPartnerId() : '';
    fillForm({
      id: newId,
      partner: '',
      title: '',
      affiliateUrl: '',
      sortOrder: 10,
      active: false,
      startAt: null,
      endAt: null,
      bannerImageUrl: '',
      bannerImagePath: ''
    });
    if (newId) delete knownIds[newId];
    syncActionMode();
    setStatus('新增 Banner（未填日期＝長期顯示）');
  }

  function renderAdminList(items) {
    var list = document.getElementById('featuredAdminList');
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    knownIds = Object.create(null);
    if (!items || !items.length) {
      var empty = document.createElement('p');
      empty.className = 'featured-admin-empty';
      empty.textContent = '尚無 Banner。點「＋ 新增 Banner」後填寫資料並儲存即可發布。';
      list.appendChild(empty);
      return;
    }
    items.forEach(function (p) {
      if (p && p.id) knownIds[p.id] = true;
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'featured-admin-row';
      row.setAttribute('data-id', p.id);
      var label =
        (p.active ? '已上架' : '未上架') +
        ' · 順序 ' +
        (p.sortOrder != null ? p.sortOrder : '?') +
        ' · ' +
        (p.partner || p.name || p.id);
      row.textContent = label;
      row.addEventListener('click', function () {
        fillForm(p);
      });
      list.appendChild(row);
    });
  }

  function reloadList() {
    var data = dataApi();
    if (!data || typeof data.fetchAllForAdmin !== 'function') {
      setStatus('資料層未載入，請重新整理頁面', true);
      return Promise.resolve();
    }
    return data
      .fetchAllForAdmin()
      .then(function (items) {
        renderAdminList(items);
        setStatus(items.length ? '目前共 ' + items.length + ' 筆 Banner' : '尚無 Banner，可新增一筆');
      })
      .catch(function (err) {
        setStatus(formatError(err, '讀取 Banner 列表失敗'), true);
      });
  }

  function openAdmin() {
    return checkAdmin(true).then(function (ok) {
      if (!ok) {
        setStatus('沒有 Featured Admin 權限（請用 asd22584812@gmail.com 登入）', true);
        return;
      }
      var shell = document.getElementById('soarvibeFeaturedAdmin');
      if (!shell) return;
      shell.classList.remove('hidden');
      shell.setAttribute('aria-hidden', 'false');
      resetForm();
      return reloadList();
    });
  }

  function closeAdmin() {
    var shell = document.getElementById('soarvibeFeaturedAdmin');
    if (!shell) return;
    shell.classList.add('hidden');
    shell.setAttribute('aria-hidden', 'true');
  }

  function onFileChange(ev) {
    var file = ev && ev.target && ev.target.files && ev.target.files[0];
    pendingImage = file || null;
    if (!file) return;
    try {
      assertAllowedImage(file);
    } catch (err) {
      pendingImage = null;
      if (ev && ev.target) ev.target.value = '';
      setStatus(formatError(err), true);
      return;
    }
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      setPreviewSrc(URL.createObjectURL(file));
    }
  }

  function setSaveBusy(busy) {
    var saveBtn = document.getElementById('faSaveBtn');
    var delBtn = document.getElementById('faDeleteBtn');
    var newBtn = document.getElementById('faNewBtn');
    if (saveBtn) {
      saveBtn.disabled = !!busy;
      if (busy) {
        saveBtn.textContent = '儲存中…';
      } else {
        syncActionMode();
      }
    }
    if (delBtn) delBtn.disabled = !!busy;
    if (newBtn) newBtn.disabled = !!busy;
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function invalidateAndRefreshFeatured() {
    var data = dataApi();
    if (data && typeof data.clearCache === 'function') data.clearCache();
    var featured = global.SOARVIBE_FEATURED;
    if (featured && typeof featured.refreshOpenList === 'function') {
      return featured.refreshOpenList(true);
    }
    if (featured && typeof featured.openFeaturedModal === 'function') {
      // Featured not open / no refresh helper — ensure consumer opens with fresh fetch.
      return Promise.resolve();
    }
    return Promise.resolve();
  }

  function finishSaveSuccess(message) {
    setStatus(message, false);
    return delay(1000).then(function () {
      closeAdmin();
      return invalidateAndRefreshFeatured();
    });
  }

  function onSave() {
    if (saving || deleting) return;
    var data = dataApi();
    if (!data) {
      setStatus('資料層未載入，請重新整理頁面', true);
      return;
    }
    var fields = readForm();
    if (!String(fields.partner || '').trim()) {
      setStatus('請填合作商名稱', true);
      return;
    }
    if (!String(fields.title || '').trim()) {
      setStatus('請填標題', true);
      return;
    }
    var partnerId =
      String((document.getElementById('faPartnerId') || {}).value || '').trim() ||
      data.newPartnerId();
    var isNew = !knownIds[partnerId];
    fields.__isNew = isNew;
    var wasEdit = !isNew;

    saving = true;
    setSaveBusy(true);
    setStatus('儲存中…');
    var uploadedOk = false;
    var chain = Promise.resolve(fields);

    if (pendingImage) {
      chain = uploadBanner(pendingImage, partnerId).then(function (up) {
        uploadedOk = true;
        fields.bannerImageUrl = up.bannerImageUrl || up.src;
        fields.bannerImagePath = up.bannerImagePath || up.path;
        var urlEl = document.getElementById('faBannerUrl');
        var pathEl = document.getElementById('faBannerPath');
        if (urlEl) urlEl.value = fields.bannerImageUrl;
        if (pathEl) pathEl.value = fields.bannerImagePath;
        return fields;
      });
    }

    chain
      .then(function (f) {
        return data.savePartner(partnerId, f);
      })
      .then(function (saved) {
        pendingImage = null;
        knownIds[partnerId] = true;
        if (data.clearCache) data.clearCache();
        editingId = partnerId;
        var idEl = document.getElementById('faPartnerId');
        if (idEl) idEl.value = partnerId;
        var active = !!(saved && saved.active);
        var msg;
        if (wasEdit) msg = 'Banner 已更新';
        else if (active) msg = 'Banner 已上架';
        else msg = 'Banner 已儲存';
        return finishSaveSuccess(msg);
      })
      .catch(function (err) {
        var msg = formatError(err, '儲存失敗');
        if (uploadedOk) {
          msg =
            '圖片已上傳，但 Banner 資料儲存失敗：' +
            msg +
            '。請再按一次「儲存」（不必重選圖片）。';
        }
        setStatus(msg, true);
      })
      .then(function () {
        saving = false;
        setSaveBusy(false);
      });
  }

  function onDelete() {
    if (saving || deleting) return;
    var data = dataApi();
    var partnerId = String((document.getElementById('faPartnerId') || {}).value || '').trim();
    if (!partnerId || !data) return;
    if (!global.confirm('確定刪除此 Banner？')) return;
    var path = String((document.getElementById('faBannerPath') || {}).value || '').trim();
    deleting = true;
    setSaveBusy(true);
    setStatus('刪除中…');
    var mediaFailed = false;
    deleteBannerMedia(path)
      .catch(function (err) {
        mediaFailed = true;
        console.warn('[FEATURED_ADMIN] R2 delete failed', err);
        return null;
      })
      .then(function () {
        return data.deletePartner(partnerId);
      })
      .then(function () {
        delete knownIds[partnerId];
        var msg = mediaFailed ? 'Banner 資料已刪除（圖片清理可能未完成）' : 'Banner 已刪除';
        return finishSaveSuccess(msg);
      })
      .catch(function (err) {
        setStatus(formatError(err, '刪除失敗'), true);
      })
      .then(function () {
        deleting = false;
        setSaveBusy(false);
      });
  }

  function bindOnce() {
    var openBtn = document.getElementById('featuredAdminOpenBtn');
    if (openBtn && !openBtn.__faBound) {
      openBtn.__faBound = true;
      openBtn.addEventListener('click', function () {
        openAdmin();
      });
    }
    var closeBtn = document.getElementById('featuredAdminCloseBtn');
    if (closeBtn && !closeBtn.__faBound) {
      closeBtn.__faBound = true;
      closeBtn.addEventListener('click', closeAdmin);
    }
    var saveBtn = document.getElementById('faSaveBtn');
    if (saveBtn && !saveBtn.__faBound) {
      saveBtn.__faBound = true;
      saveBtn.addEventListener('click', onSave);
    }
    var newBtn = document.getElementById('faNewBtn');
    if (newBtn && !newBtn.__faBound) {
      newBtn.__faBound = true;
      newBtn.addEventListener('click', resetForm);
    }
    var delBtn = document.getElementById('faDeleteBtn');
    if (delBtn && !delBtn.__faBound) {
      delBtn.__faBound = true;
      delBtn.addEventListener('click', onDelete);
    }
    var fileInput = document.getElementById('faBannerFile');
    if (fileInput && !fileInput.__faBound) {
      fileInput.__faBound = true;
      fileInput.addEventListener('change', onFileChange);
    }
    var sortInput = document.getElementById('faSortOrder');
    if (sortInput && !sortInput.__faBound) {
      sortInput.__faBound = true;
      sortInput.addEventListener('blur', function () {
        sortInput.value = String(parseSortOrder(sortInput.value));
      });
      sortInput.addEventListener('input', function () {
        var cleaned = String(sortInput.value || '').replace(/[^\d]/g, '').slice(0, 4);
        if (cleaned !== sortInput.value) sortInput.value = cleaned;
      });
    }
    var auth = authApi();
    if (auth && typeof auth.onAuthStateChanged === 'function' && !global.__featuredAdminAuthBound) {
      global.__featuredAdminAuthBound = true;
      auth.onAuthStateChanged(function () {
        adminChecked = false;
        refreshChrome();
      });
    }
  }

  function init() {
    bindOnce();
    refreshChrome();
  }

  global.SOARVIBE_FEATURED_ADMIN = {
    version: '2.2',
    init: init,
    open: openAdmin,
    close: closeAdmin,
    refreshChrome: refreshChrome,
    checkAdmin: checkAdmin,
    isAdminCached: function () {
      return isAdmin;
    }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
