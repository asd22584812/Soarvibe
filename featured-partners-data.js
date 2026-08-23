/**
 * SoarVibe Featured — Firestore data layer (featuredPartners).
 * Public reads active banners; schedule filter applied client-side.
 * Independent from itinerary / City Shares / Gemini.
 */
(function (global) {
  'use strict';

  var COLLECTION = 'featuredPartners';
  var cache = {
    loaded: false,
    loading: null,
    items: [],
    error: null,
    source: 'none'
  };

  function getDb() {
    try {
      var fb = global.SOARVIBE_FIREBASE;
      if (fb && typeof fb.getDb === 'function') {
        var db = fb.getDb();
        if (db) return db;
      }
    } catch (e) { /* ignore */ }
    try {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        return firebase.firestore();
      }
    } catch (e2) { /* ignore */ }
    return null;
  }

  function toMillis(value) {
    if (value == null || value === '') return null;
    if (typeof value.toMillis === 'function') {
      try {
        return value.toMillis();
      } catch (e) {
        return null;
      }
    }
    if (typeof value.toDate === 'function') {
      try {
        return value.toDate().getTime();
      } catch (e2) {
        return null;
      }
    }
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string') {
      var t = Date.parse(value);
      return isNaN(t) ? null : t;
    }
    if (value && typeof value.seconds === 'number') {
      return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
    }
    return null;
  }

  function isWithinSchedule(doc, nowMs) {
    var now = typeof nowMs === 'number' ? nowMs : Date.now();
    var start = toMillis(doc.startAt);
    var end = toMillis(doc.endAt);
    if (start != null && now < start) return false;
    if (end != null && now > end) return false;
    return true;
  }

  function isHttpsAffiliateUrl(url) {
    var raw = String(url == null ? '' : url).trim();
    if (!raw) return false;
    try {
      var u = new URL(raw);
      return u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  /**
   * Normalize a Firestore doc into Featured partner card shape.
   * Formal banners open ONLY via affiliateUrl (no generic site fallback).
   */
  function normalizeFeaturedDoc(id, data) {
    var d = data || {};
    var affiliateUrl = String(d.affiliateUrl || '').trim();
    var partner = String(d.partner || d.brandName || d.name || '').trim();
    var title = String(d.title || d.headline || '').trim();
    var bannerImageUrl = String(d.bannerImageUrl || d.image || '').trim();
    var sortOrder = Number(d.sortOrder != null ? d.sortOrder : d.order);
    if (!isFinite(sortOrder)) sortOrder = 999;
    return {
      id: String(id || d.id || ''),
      partner: partner,
      brandName: partner,
      name: partner,
      title: title,
      headline: title,
      subheadline: String(d.subheadline || d.description || '').trim(),
      description: String(d.description || d.subheadline || '').trim(),
      ctaLabel: String(d.ctaLabel || '查看詳情 →').trim(),
      image: bannerImageUrl,
      bannerImageUrl: bannerImageUrl,
      bannerImagePath: String(d.bannerImagePath || '').trim(),
      affiliateUrl: affiliateUrl,
      url: affiliateUrl,
      deepLink: '',
      universalLink: '',
      active: d.active === true,
      sortOrder: sortOrder,
      order: sortOrder,
      startAt: d.startAt == null ? null : d.startAt,
      endAt: d.endAt == null ? null : d.endAt,
      isDemo: d.isDemo === true,
      isTest: false,
      sponsorLabel: d.sponsorLabel || (d.isDemo ? 'DEMO・合作版位示意' : ''),
      sponsored: !d.isDemo,
      affiliate: true,
      source: 'firestore',
      updatedBy: d.updatedBy || '',
      updatedAt: d.updatedAt || null,
      createdAt: d.createdAt || null
    };
  }

  function isPublishableActive(partner) {
    if (!partner || partner.active !== true) return false;
    if (!isHttpsAffiliateUrl(partner.affiliateUrl)) return false;
    if (!partner.bannerImageUrl && !partner.image) return false;
    if (!isWithinSchedule(partner)) return false;
    return true;
  }

  function sortByOrder(list) {
    return (list || []).slice().sort(function (a, b) {
      var ao = Number(a.sortOrder != null ? a.sortOrder : a.order) || 0;
      var bo = Number(b.sortOrder != null ? b.sortOrder : b.order) || 0;
      if (ao !== bo) return ao - bo;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  function fetchActiveFromFirestore() {
    var database = getDb();
    if (!database) {
      return Promise.reject(new Error('firestore_unavailable'));
    }
    return database
      .collection(COLLECTION)
      .where('active', '==', true)
      .get()
      .then(function (snap) {
        var items = [];
        snap.forEach(function (docSnap) {
          items.push(normalizeFeaturedDoc(docSnap.id, docSnap.data()));
        });
        return sortByOrder(items.filter(isPublishableActive));
      });
  }

  /** Admin: load all partners (active + inactive). Client-side sort — no orderBy index dependency. */
  function fetchAllForAdmin() {
    var database = getDb();
    if (!database) {
      return Promise.reject(new Error('無法連線 Firestore（資料庫未初始化）'));
    }
    return database
      .collection(COLLECTION)
      .get()
      .then(function (snap) {
        var items = [];
        snap.forEach(function (docSnap) {
          items.push(normalizeFeaturedDoc(docSnap.id, docSnap.data()));
        });
        return sortByOrder(items);
      })
      .catch(function (err) {
        throw mapFirestoreError(err, '讀取 Banner 列表失敗');
      });
  }

  function mapFirestoreError(err, fallback) {
    var code = err && err.code ? String(err.code) : '';
    var raw = String((err && err.message) || err || '');
    if (code === 'permission-denied') {
      return new Error('沒有權限寫入／讀取精選 Banner（請確認已用 Admin 帳號登入，且 rules 已部署）');
    }
    if (code === 'unavailable' || /offline|network|Load failed/i.test(raw)) {
      return new Error('網路連線失敗，無法連到 Firestore。請確認網路後重試。（原始訊息：' + raw + '）');
    }
    if (/Load failed/i.test(raw)) {
      return new Error(
        '請求失敗（iOS 常顯示 Load failed）。常見原因：權限不足或網路中斷。請重新登入後再試。（' +
          (code || raw) +
          '）'
      );
    }
    return new Error((fallback || '操作失敗') + '：' + (code ? code + ' — ' : '') + raw);
  }

  function loadActivePartners(force) {
    if (!force && cache.loaded && cache.source === 'firestore') {
      return Promise.resolve(cache.items.slice());
    }
    if (!force && cache.loading) return cache.loading;
    cache.loading = fetchActiveFromFirestore()
      .then(function (items) {
        cache.loaded = true;
        cache.error = null;
        cache.items = items;
        cache.source = items.length ? 'firestore' : 'firestore-empty';
        cache.loading = null;
        return items.slice();
      })
      .catch(function (err) {
        cache.loading = null;
        cache.error = err;
        if (!cache.loaded) {
          cache.source = 'error';
          cache.items = [];
        }
        throw mapFirestoreError(err, '讀取精選 Banner 失敗');
      });
    return cache.loading;
  }

  function getCachedActivePartners() {
    return cache.items.slice();
  }

  function hasFirestoreInventory() {
    // Treat empty Firestore result as authoritative so we don't flash hardcoded demos.
    return cache.loaded === true &&
      (cache.source === 'firestore' || cache.source === 'firestore-empty');
  }

  function clearCache() {
    cache.loaded = false;
    cache.loading = null;
    cache.items = [];
    cache.error = null;
    cache.source = 'none';
  }

  function newPartnerId() {
    return (
      'fp_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function savePartner(partnerId, fields) {
    var database = getDb();
    if (!database) return Promise.reject(new Error('無法連線 Firestore（資料庫未初始化）'));
    var auth = global.SOARVIBE_AUTH;
    var user = auth && typeof auth.currentUser === 'function' ? auth.currentUser() : null;
    if (!user) return Promise.reject(new Error('請先登入 Admin 帳號'));
    var id = String(partnerId || '').trim() || newPartnerId();
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var affiliateUrl = String(fields.affiliateUrl || '').trim();
    var active = fields.active === true;
    if (active && !isHttpsAffiliateUrl(affiliateUrl)) {
      return Promise.reject(new Error('上架前必須填寫有效的 https 合作連結'));
    }
    var payload = {
      partner: String(fields.partner || '').trim(),
      title: String(fields.title || '').trim(),
      bannerImageUrl: String(fields.bannerImageUrl || fields.image || '').trim(),
      bannerImagePath: String(fields.bannerImagePath || '').trim(),
      affiliateUrl: affiliateUrl,
      sortOrder: Number(fields.sortOrder) || 0,
      active: active,
      ctaLabel: String(fields.ctaLabel || '查看詳情 →').trim(),
      updatedAt: now,
      updatedBy: user.uid,
      startAt: null,
      endAt: null
    };
    if (!payload.partner) return Promise.reject(new Error('請填合作商名稱'));
    if (!payload.title) return Promise.reject(new Error('請填標題'));
    if (!payload.bannerImageUrl) return Promise.reject(new Error('請先選擇並上傳 Banner 圖'));

    if (fields.startAt instanceof Date) {
      payload.startAt = firebase.firestore.Timestamp.fromDate(fields.startAt);
    } else if (fields.startAt && typeof fields.startAt.toMillis === 'function') {
      payload.startAt = fields.startAt;
    } else {
      payload.startAt = null;
    }
    if (fields.endAt instanceof Date) {
      payload.endAt = firebase.firestore.Timestamp.fromDate(fields.endAt);
    } else if (fields.endAt && typeof fields.endAt.toMillis === 'function') {
      payload.endAt = fields.endAt;
    } else {
      payload.endAt = null;
    }

    var ref = database.collection(COLLECTION).doc(id);
    // Avoid get()-before-set on missing docs (rules historically denied resource==null gets,
    // and iOS often surfaces that as opaque "Load failed").
    var isNew = fields && fields.__isNew === true;
    if (isNew) {
      payload.createdAt = now;
      return ref
        .set(payload)
        .then(function () {
          clearCache();
          return Object.assign({ id: id }, payload);
        })
        .catch(function (err) {
          throw mapFirestoreError(err, '儲存 Banner 失敗');
        });
    }
    return ref
      .set(payload, { merge: true })
      .then(function () {
        clearCache();
        return Object.assign({ id: id }, payload);
      })
      .catch(function (err) {
        throw mapFirestoreError(err, '儲存 Banner 失敗');
      });
  }

  function deletePartner(partnerId) {
    var database = getDb();
    if (!database) return Promise.reject(new Error('firestore_unavailable'));
    var id = String(partnerId || '').trim();
    if (!id) return Promise.reject(new Error('missing_partnerId'));
    return database
      .collection(COLLECTION)
      .doc(id)
      .delete()
      .then(function () {
        clearCache();
        return { ok: true, id: id };
      });
  }

  var api = {
    COLLECTION: COLLECTION,
    normalizeFeaturedDoc: normalizeFeaturedDoc,
    isWithinSchedule: isWithinSchedule,
    isHttpsAffiliateUrl: isHttpsAffiliateUrl,
    isPublishableActive: isPublishableActive,
    sortByOrder: sortByOrder,
    loadActivePartners: loadActivePartners,
    fetchAllForAdmin: fetchAllForAdmin,
    getCachedActivePartners: getCachedActivePartners,
    hasFirestoreInventory: hasFirestoreInventory,
    clearCache: clearCache,
    savePartner: savePartner,
    deletePartner: deletePartner,
    newPartnerId: newPartnerId,
    getCacheMeta: function () {
      return {
        loaded: cache.loaded,
        source: cache.source,
        count: cache.items.length,
        error: cache.error ? String(cache.error.message || cache.error) : null
      };
    }
  };

  global.SOARVIBE_FEATURED_DATA = api;
})(typeof window !== 'undefined' ? window : globalThis);
