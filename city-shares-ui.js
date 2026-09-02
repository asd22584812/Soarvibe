/**
 * City Shares UI — feed + detail overlay (Phase 1B).
 * Depends on: feature-flags.js, city-shares-config.js, city-shares-data.js
 */
(function (global) {
  'use strict';

  var TYPE_LABELS = {
    sightseeing: '觀光',
    food: '美食',
    lodging: '住宿',
    shopping: '購物',
    anime: '動漫',
    cafe: '咖啡',
    nightview: '夜景',
    family: '親子',
    photospot: '打卡'
  };

  var CITY_LABELS = {
    tokyo: { name: '東京', dest: '東京' },
    kyoto: { name: '京都', dest: '京都' },
    osaka: { name: '大阪', dest: '大阪' },
    seoul: { name: '首爾', dest: '首爾' },
    busan: { name: '釜山', dest: '釜山' },
    hokkaido: { name: '北海道', dest: '北海道' },
    bangkok: { name: '曼谷', dest: '曼谷' },
    vietnam: { name: '越南', dest: '越南' },
    london: { name: '倫敦', dest: '倫敦' },
    paris: { name: '巴黎', dest: '巴黎' }
  };

  var csState = {
    view: 'closed',
    /** @deprecated use feedScope.entryId — kept for hash / auth pending compat */
    cityId: null,
    postId: null,
    typeFilter: 'all',
    remotePosts: [],
    liked: false,
    saved: false,
    comments: [],
    composeMedia: [],
    /** Persistent composer draft — survives media pick / re-render */
    composeDraft: null,
    feedScope: null,
    composeTaxonomy: null,
    composeLocked: false,
    composeNeedsCity: false,
    composeNeedsCountry: false,
    /** One publish operation per composer session */
    isSubmitting: false,
    isDeleting: false,
    composePostId: null,
    clientPublishId: null,
    toastTimer: null,
    /** Monotonic open generation — stale async must not paint after close/reopen */
    shareOpenGeneration: 0,
    feedAbort: null
  };

  function emptyComposeDraft() {
    return {
      postId: null,
      clientPublishId: null,
      countryId: '',
      regionId: '',
      cityId: '',
      cityName: '',
      cityQuery: '',
      type: 'sightseeing',
      title: '',
      body: '',
      selectedMedia: []
    };
  }

  function ensureComposeDraft() {
    if (!csState.composeDraft) {
      csState.composeDraft = emptyComposeDraft();
    }
    if (!Array.isArray(csState.composeDraft.selectedMedia)) {
      csState.composeDraft.selectedMedia = [];
    }
    // Keep legacy alias in sync for media helpers
    csState.composeMedia = csState.composeDraft.selectedMedia;
    if (csState.composePostId) csState.composeDraft.postId = csState.composePostId;
    if (csState.clientPublishId) csState.composeDraft.clientPublishId = csState.clientPublishId;
    return csState.composeDraft;
  }

  function clearComposeDraft() {
    var media = (csState.composeDraft && csState.composeDraft.selectedMedia) || csState.composeMedia || [];
    media.forEach(function (m) {
      if (m && m.previewUrl) {
        try {
          URL.revokeObjectURL(m.previewUrl);
        } catch (e) {
          /* silent */
        }
      }
    });
    csState.composeDraft = null;
    csState.composeMedia = [];
    csState.composePostId = null;
    csState.clientPublishId = null;
  }

  function syncComposeDraftFromDom() {
    var draft = ensureComposeDraft();
    var titleEl = document.getElementById('csComposeTitle');
    var bodyEl = document.getElementById('csComposeBody');
    var typeEl = document.getElementById('csComposeType');
    var countryEl = document.getElementById('csComposeCountryId');
    var regionEl = document.getElementById('csComposeRegionId');
    var cityIdEl = document.getElementById('csComposeCityId');
    var cityNameEl = document.getElementById('csComposeCityName');
    var cityQueryEl = document.getElementById('csComposeCityQuery');
    if (titleEl) draft.title = String(titleEl.value || '');
    if (bodyEl) draft.body = String(bodyEl.value || '');
    if (typeEl) draft.type = String(typeEl.value || 'sightseeing');
    if (countryEl) draft.countryId = String(countryEl.value || '');
    if (regionEl) draft.regionId = String(regionEl.value || '');
    if (cityIdEl) draft.cityId = String(cityIdEl.value || '');
    if (cityNameEl) draft.cityName = String(cityNameEl.value || '');
    if (cityQueryEl) draft.cityQuery = String(cityQueryEl.value || '');
    draft.postId = csState.composePostId || draft.postId;
    draft.clientPublishId = csState.clientPublishId || draft.clientPublishId;
    draft.selectedMedia = csState.composeMedia || draft.selectedMedia || [];
    csState.composeMedia = draft.selectedMedia;
    return draft;
  }

  function bindComposeDraftInputs() {
    var form = document.getElementById('csComposeForm');
    if (!form || form._csDraftBound) return;
    form._csDraftBound = true;
    form.addEventListener('input', function (e) {
      var t = e && e.target;
      if (!t || !t.id) return;
      if (
        t.id === 'csComposeTitle' ||
        t.id === 'csComposeBody' ||
        t.id === 'csComposeType' ||
        t.id === 'csComposeCountryId' ||
        t.id === 'csComposeCityQuery' ||
        t.id === 'csComposeCityId' ||
        t.id === 'csComposeCityName' ||
        t.id === 'csComposeRegionId'
      ) {
        syncComposeDraftFromDom();
      }
    });
    form.addEventListener('change', function (e) {
      var t = e && e.target;
      if (!t || !t.id) return;
      if (t.id === 'csComposeType' || t.id === 'csComposeCountryId') {
        syncComposeDraftFromDom();
      }
    });
  }

  function friendlyPublishError(err, postId) {
    var code = (err && (err.code || err.name)) || 'unknown';
    var raw = String((err && err.message) || '');
    var category = 'publish_failed';
    if (code === 'permission-denied' || /insufficient permissions|permission/i.test(raw)) {
      category = 'permission_denied';
    }
    try {
      console.warn('[SOARVIBE] publish failed', {
        category: category,
        code: code,
        postId: postId || null
      });
    } catch (logErr) {
      /* silent */
    }
    if (category === 'permission_denied' || /insufficient permissions/i.test(raw)) {
      return '發布失敗，內容已為你保留，請再試一次。';
    }
    if (raw && !/insufficient permissions/i.test(raw)) return raw;
    return '發布失敗，內容已為你保留，請再試一次。';
  }

  function locApi() {
    return global.SOARVIBE_CITY_SHARES_LOCATION || null;
  }

  function cardsApi() {
    return global.SOARVIBE_CITY_SHARES_CARDS || null;
  }

  function resolveItineraryDestinationText() {
    var destInput = document.getElementById('destination-input');
    if (destInput && destInput.value && String(destInput.value).trim()) {
      return String(destInput.value).trim();
    }
    try {
      if (typeof global.getCurrentTripRegion === 'function') {
        var region = String(global.getCurrentTripRegion() || '').trim();
        if (region) return region;
      }
    } catch (e2) { /* silent */ }
    try {
      if (typeof global.resolveCurrentCity === 'function') {
        var city = String(global.resolveCurrentCity() || '').trim();
        if (city) return city;
      }
    } catch (e1) { /* silent */ }
    return '';
  }

  function buildScopeFromEntryId(entryId) {
    var cards = cardsApi();
    var card = cards && cards.getCardById ? cards.getCardById(entryId) : null;
    var loc = locApi();
    var tax;
    if (card && loc && loc.resolveEntryCard) {
      tax = loc.resolveEntryCard(card);
    } else if (loc && loc.resolveLocation) {
      tax = loc.resolveLocation(entryId, { source: 'card' });
    } else {
      tax = {
        countryId: '',
        countryName: '',
        regionId: '',
        regionName: '',
        cityId: entryId,
        cityName: (CITY_LABELS[entryId] && CITY_LABELS[entryId].name) || entryId,
        feedKind: 'city',
        displayLabel: (CITY_LABELS[entryId] && CITY_LABELS[entryId].name) || entryId,
        chipLabel: ''
      };
    }
    return {
      entryId: entryId,
      feedKind: (card && card.type) || tax.feedKind || 'city',
      countryId: tax.countryId || (card && card.countryId) || '',
      regionId: tax.regionId || (card && card.regionId) || '',
      cityId: tax.cityId || (card && card.cityId) || '',
      displayName: (card && card.displayName) || tax.displayLabel || entryId,
      taxonomy: tax,
      card: card
    };
  }

  function postMatchesScope(post, scope) {
    if (!post || !scope) return false;
    var loc = locApi();
    if (loc && loc.normalizePostDestination) loc.normalizePostDestination(post);
    else if (loc && loc.normalizePostTaxonomy) loc.normalizePostTaxonomy(post);
    // Canonical equality — never use fuzzy string includes on location labels.
    if (scope.feedKind === 'country' && scope.countryId) {
      return post.countryId === scope.countryId;
    }
    if (scope.feedKind === 'region' && scope.regionId) {
      return post.regionId === scope.regionId || post.cityId === scope.regionId;
    }
    if (scope.cityId) {
      return post.cityId === scope.cityId;
    }
    if (scope.entryId) {
      return post.cityId === scope.entryId;
    }
    return true;
  }

  /** Future R2 / storage upload; keep at 3 when re-enabled. */
  var MEDIA_MAX_PER_POST = 3;

  function mediaUploadEnabled() {
    var flags = global.SOARVIBE_FEATURE_FLAGS || {};
    return flags.citySharesMediaUpload === true;
  }

  function api() {
    return global.SOARVIBE_CITY_SHARES_API || null;
  }

  function auth() {
    return global.SOARVIBE_AUTH || null;
  }

  function findPost(postId) {
    if (!postId) return null;
    var i;
    for (i = 0; i < (csState.remotePosts || []).length; i++) {
      if (csState.remotePosts[i].postId === postId) return csState.remotePosts[i];
    }
    if (typeof global.getCityShareById === 'function') {
      return global.getCityShareById(postId);
    }
    return null;
  }

  function isFirestorePost(post) {
    if (!post || !post.postId) return false;
    if (post.source === 'user') return true;
    var i;
    for (i = 0; i < (csState.remotePosts || []).length; i++) {
      if (csState.remotePosts[i].postId === post.postId) return true;
    }
    return false;
  }

  function postSortTimeMs(post) {
    if (!post) return 0;
    var raw = post.createdAt || post.publishedAt || post.updatedAt || null;
    if (!raw) {
      // Official static seeds without timestamps stay below fresh user posts.
      return post.source === 'user' ? Date.now() : 0;
    }
    if (typeof raw.toMillis === 'function') {
      try {
        return raw.toMillis();
      } catch (e1) {
        /* fall through */
      }
    }
    if (typeof raw.seconds === 'number') {
      return raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1e6);
    }
    var parsed = Date.parse(raw);
    return isNaN(parsed) ? 0 : parsed;
  }

  function getPosts(cityId, typeFilter) {
    var scope = csState.feedScope || buildScopeFromEntryId(cityId);
    var seedKey = scope.cityId || scope.entryId || cityId;
    var local =
      typeof global.getCityShares === 'function' ? global.getCityShares(seedKey) : [];
    var merged = {};
    (local || []).forEach(function (p) {
      if (p && p.postId && postMatchesScope(p, scope)) merged[p.postId] = p;
    });
    (csState.remotePosts || []).forEach(function (p) {
      if (p && p.postId && postMatchesScope(p, scope)) merged[p.postId] = p;
    });
    var list = Object.keys(merged).map(function (k) {
      return merged[k];
    });
    if (typeFilter && typeFilter !== 'all') {
      list = list.filter(function (p) {
        return p.type === typeFilter;
      });
    }
    list.sort(function (a, b) {
      var tb = postSortTimeMs(b);
      var ta = postSortTimeMs(a);
      if (tb !== ta) return tb - ta;
      if ((a.source === 'user') !== (b.source === 'user')) {
        return a.source === 'user' ? -1 : 1;
      }
      return String(b.postId || '').localeCompare(String(a.postId || ''));
    });
    return list;
  }

  function whenAuthSettled() {
    // Wait for first Auth event (signed-in OR confirmed guest).
    // Do NOT require sign-in — public feed must work for guests.
    var au = auth();
    if (au && typeof au.whenAuthReady === 'function' && !(au.isAuthReady && au.isAuthReady())) {
      return au.whenAuthReady().catch(function () {
        return null;
      });
    }
    return Promise.resolve(null);
  }

  function refreshRemoteFeed(cityId, options) {
    var a = api();
    var scope = csState.feedScope || buildScopeFromEntryId(cityId || csState.cityId);
    var opts = options || {};
    var requestId = opts.requestId;
    if (!a) {
      csState.remotePosts = csState.remotePosts || [];
      return Promise.resolve(csState.remotePosts);
    }
    if (csState.feedAbort && typeof csState.feedAbort.abort === 'function') {
      try { csState.feedAbort.abort(); } catch (eAbort) { /* silent */ }
    }
    csState.feedAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;

    function runLoader() {
      var loader =
        a.listFeedForScope
          ? a.listFeedForScope(scope)
          : a.listPublishedPosts
            ? a.listPublishedPosts(scope.cityId || scope.entryId || cityId)
            : Promise.resolve([]);
      return loader
        .then(function (posts) {
          if (requestId != null && requestId !== csState.shareOpenGeneration) return null;
          csState.remotePosts = posts || [];
          return csState.remotePosts;
        })
        .catch(function (e) {
          if (requestId != null && requestId !== csState.shareOpenGeneration) return null;
          console.warn('[SOARVIBE] remote city shares feed failed', e);
          // Soft-fail: keep any prior remote posts; never block guest browse.
          if (!Array.isArray(csState.remotePosts)) csState.remotePosts = [];
          return csState.remotePosts;
        });
    }

    return whenAuthSettled().then(runLoader);
  }

  function showCitySharesLoadError(cityId, postId, requestId) {
    var viewport = document.getElementById('csViewport');
    if (!viewport) return;
    if (requestId != null && requestId !== csState.shareOpenGeneration) return;
    viewport.innerHTML =
      '<div class="cs-page">' +
      '<div class="cs-empty">' +
      '<p>這篇分享暫時載入失敗，請再試一次</p>' +
      '<button type="button" class="cs-retry-btn" data-cs-retry="1">再試一次</button>' +
      '</div></div>';
    var btn = viewport.querySelector('[data-cs-retry]');
    if (btn) {
      btn.addEventListener('click', function () {
        if (requestId != null && requestId !== csState.shareOpenGeneration) return;
        openCityShares(cityId, postId || null);
      });
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getCityMeta(cityId) {
    var scope = csState.feedScope || buildScopeFromEntryId(cityId);
    var data = global.SOARVIBE_CITY_SHARES;
    if (data && data.cities && data.cities[cityId]) return data.cities[cityId];
    var cfg = global.SOARVIBE_CITY_SHARES_CONFIG;
    var heroKey = scope.cityId || cityId;
    var hero = cfg && cfg.CITY_HERO && cfg.CITY_HERO[heroKey];
    var label = CITY_LABELS[cityId] || CITY_LABELS[scope.cityId];
    var name = scope.displayName || (label && label.name) || cityId;
    return {
      cityId: cityId,
      title: name + '旅人分享',
      subtitle: '真正去過的人的照片與心得',
      heroImage: (scope.card && scope.card.image) || (hero && hero.heroImage),
      heroPosition:
        (scope.card && scope.card.imagePosition) || (hero && hero.heroPosition),
      heroAlt: (scope.card && scope.card.imageAlt) || (hero && hero.heroAlt) || name
    };
  }

  function resolveHero(meta, cityId) {
    var cfg = global.SOARVIBE_CITY_SHARES_CONFIG;
    var fromCfg = cfg && cfg.CITY_HERO && cfg.CITY_HERO[cityId];
    return {
      heroImage: (meta && meta.heroImage) || (fromCfg && fromCfg.heroImage) || '',
      heroPosition: (meta && meta.heroPosition) || (fromCfg && fromCfg.heroPosition) || 'center center',
      heroAlt: (meta && meta.heroAlt) || (fromCfg && fromCfg.heroAlt) || ((meta && meta.title) || '城市')
    };
  }

  function sortedMediaList(post) {
    if (!post || !Array.isArray(post.media)) return [];
    return post.media
      .slice()
      .sort(function (a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      })
      .filter(function (m) {
        return m && m.src;
      })
      .slice(0, MEDIA_MAX_PER_POST);
  }

  function getCoverMedia(post) {
    var list = sortedMediaList(post);
    return list.length ? list[0] : null;
  }

  function renderMediaBlock(media, altFallback, opts) {
    opts = opts || {};
    if (!(media && media.src)) return '';
    // First slide: eager + high priority so feed first-paint is not blocked by lazy.
    // Remaining slides stay lazy — do not wait for all carousel images.
    var eager = opts.eager === true;
    var cls =
      'cs-media-img' + (opts.fit === 'contain' ? ' cs-media-img--contain' : '');
    return (
      '<img src="' +
      escapeHtml(media.src) +
      '" alt="' +
      escapeHtml(media.alt || altFallback || '') +
      '" ' +
      (eager ? 'loading="eager" fetchpriority="high" ' : 'loading="lazy" ') +
      'decoding="async" class="' +
      cls +
      '">'
    );
  }

  function renderCarousel(list, altFallback, opts) {
    opts = opts || {};
    var variant = opts.variant || 'detail';
    if (!list || !list.length) return '';
    var fit = opts.fit || (variant === 'detail' ? 'contain' : 'cover');
    var slides = list
      .map(function (m, idx) {
        return (
          '<div class="cs-media-slide" data-cs-media-index="' +
          idx +
          '" role="group" aria-label="照片 ' +
          (idx + 1) +
          ' / ' +
          list.length +
          '">' +
          renderMediaBlock(m, altFallback, { fit: fit, eager: idx === 0 }) +
          '</div>'
        );
      })
      .join('');
    var dots =
      list.length > 1
        ? '<div class="cs-media-dots" aria-hidden="true">' +
          list
            .map(function (_m, idx) {
              return (
                '<span class="cs-media-dot' +
                (idx === 0 ? ' is-active' : '') +
                '" data-cs-dot="' +
                idx +
                '"></span>'
              );
            })
            .join('') +
          '</div>'
        : '';
    var counter =
      list.length > 1
        ? '<div class="cs-media-counter" data-cs-counter aria-live="polite">1 / ' +
          list.length +
          '</div>'
        : '';
    return (
      '<div class="cs-media-carousel cs-media-carousel--' +
      escapeHtml(variant) +
      '" data-cs-carousel data-cs-media-count="' +
      list.length +
      '">' +
      '<div class="cs-media-track" data-cs-track>' +
      slides +
      '</div>' +
      counter +
      dots +
      '</div>'
    );
  }

  function renderMediaGallery(post) {
    var list = sortedMediaList(post);
    if (!list.length) return '';
    return renderCarousel(list, post.title, { variant: 'detail', fit: 'contain' });
  }

  function showCsToast(text) {
    var shell = document.getElementById('cityShares');
    if (!shell) return;
    var el = document.getElementById('csToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'csToast';
      el.className = 'cs-toast';
      el.setAttribute('role', 'status');
      shell.appendChild(el);
    }
    el.textContent = text || '';
    el.classList.add('is-visible');
    if (csState.toastTimer) clearTimeout(csState.toastTimer);
    csState.toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 1800);
  }

  function ensurePhotoViewer() {
    var shell = document.getElementById('cityShares');
    if (!shell) return null;
    var viewer = document.getElementById('csPhotoViewer');
    if (viewer) return viewer;
    viewer = document.createElement('div');
    viewer.id = 'csPhotoViewer';
    viewer.className = 'cs-photo-viewer hidden';
    viewer.setAttribute('aria-hidden', 'true');
    viewer.innerHTML =
      '<button type="button" class="cs-photo-viewer-close" id="csPhotoViewerClose" aria-label="關閉">✕</button>' +
      '<div class="cs-photo-viewer-track" data-cs-viewer-track></div>' +
      '<div class="cs-photo-viewer-counter" data-cs-viewer-counter></div>';
    shell.appendChild(viewer);
    return viewer;
  }

  function closePhotoViewer() {
    var viewer = document.getElementById('csPhotoViewer');
    if (!viewer) return;
    viewer.classList.add('hidden');
    viewer.setAttribute('aria-hidden', 'true');
    var track = viewer.querySelector('[data-cs-viewer-track]');
    if (track) track.innerHTML = '';
  }

  function openPhotoViewer(list, startIndex, altFallback) {
    var viewer = ensurePhotoViewer();
    if (!viewer || !list || !list.length) return;
    var idx = Math.max(0, Math.min(list.length - 1, startIndex || 0));
    var track = viewer.querySelector('[data-cs-viewer-track]');
    var counter = viewer.querySelector('[data-cs-viewer-counter]');
    track.innerHTML = list
      .map(function (m, i) {
        return (
          '<div class="cs-photo-viewer-slide" data-cs-viewer-index="' +
          i +
          '">' +
          renderMediaBlock(m, altFallback, { fit: 'contain' }) +
          '</div>'
        );
      })
      .join('');
    viewer.classList.remove('hidden');
    viewer.setAttribute('aria-hidden', 'false');
    function syncCounter() {
      if (!counter) return;
      var slideW = track.clientWidth || 1;
      var cur = Math.round(track.scrollLeft / slideW);
      cur = Math.max(0, Math.min(list.length - 1, cur));
      counter.textContent = list.length > 1 ? cur + 1 + ' / ' + list.length : '';
    }
    track.onscroll = syncCounter;
    requestAnimationFrame(function () {
      var slideW = track.clientWidth || 1;
      track.scrollLeft = idx * slideW;
      syncCounter();
    });
  }

  function markMediaImgReady(img) {
    if (!img || !img.classList) return;
    img.classList.add('is-loaded');
  }

  function bindMediaFadeIn(root) {
    if (!root || !root.querySelectorAll) return;
    var imgs = root.querySelectorAll('.cs-media-img');
    Array.prototype.forEach.call(imgs, function (img) {
      if (img.dataset && img.dataset.csFadeBound === '1') return;
      if (img.dataset) img.dataset.csFadeBound = '1';
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add('is-cached');
        markMediaImgReady(img);
        return;
      }
      img.addEventListener(
        'load',
        function () {
          markMediaImgReady(img);
        },
        { once: true }
      );
    });
  }

  function bindCarousel(root) {
    if (!root) return;
    bindMediaFadeIn(root);
    var carousels = root.querySelectorAll('[data-cs-carousel]');
    Array.prototype.forEach.call(carousels, function (carousel) {
      var track = carousel.querySelector('[data-cs-track]');
      var counter = carousel.querySelector('[data-cs-counter]');
      var dots = carousel.querySelectorAll('[data-cs-dot]');
      if (!track) return;
      function sync() {
        var count = parseInt(carousel.getAttribute('data-cs-media-count') || '1', 10) || 1;
        var slideW = track.clientWidth || 1;
        var cur = Math.round(track.scrollLeft / slideW);
        cur = Math.max(0, Math.min(count - 1, cur));
        if (counter) counter.textContent = cur + 1 + ' / ' + count;
        Array.prototype.forEach.call(dots, function (dot, i) {
          if (i === cur) dot.classList.add('is-active');
          else dot.classList.remove('is-active');
        });
      }
      track.addEventListener('scroll', sync, { passive: true });
      sync();
    });
  }

  function renderFeed(cityId) {
    var meta = getCityMeta(cityId);
    var hero = resolveHero(meta, cityId);
    var types =
      typeof global.getCityShareTypes === 'function' ? global.getCityShareTypes(cityId) : [];
    var posts = getPosts(cityId, csState.typeFilter);

    var filterHtml =
      '<button type="button" class="cs-filter-chip' +
      (csState.typeFilter === 'all' ? ' is-active' : '') +
      '" data-cs-filter="all">全部</button>';
    types.forEach(function (type) {
      filterHtml +=
        '<button type="button" class="cs-filter-chip' +
        (csState.typeFilter === type ? ' is-active' : '') +
        '" data-cs-filter="' +
        escapeHtml(type) +
        '">' +
        escapeHtml(TYPE_LABELS[type] || type) +
        '</button>';
    });

    var cardsHtml = '';
    if (!posts.length) {
      cardsHtml =
        '<div class="cs-empty">' +
        (types.length
          ? '這個分類暫時還沒有分享。'
          : '這座城市的旅人分享準備中，先從首頁規劃行程吧。') +
        '</div>';
    } else {
      cardsHtml = posts
        .map(function (post) {
          var mediaList = sortedMediaList(post);
          var typeLabel = TYPE_LABELS[post.type] || post.type;
          var mediaHtml = mediaList.length
            ? '<div class="cs-card-media">' +
              renderCarousel(mediaList, post.title, { variant: 'feed', fit: 'cover' }) +
              '<span class="cs-card-type">' +
              escapeHtml(typeLabel) +
              '</span></div>'
            : '<div class="cs-card-media cs-card-media--text"><span class="cs-card-type">' +
              escapeHtml(typeLabel) +
              '</span></div>';
          return (
            '<button type="button" class="cs-card' +
            (mediaList.length ? '' : ' cs-card--text') +
            '" data-cs-post="' +
            escapeHtml(post.postId) +
            '">' +
            mediaHtml +
            '<div class="cs-card-body">' +
            '<h3 class="cs-card-title">' +
            escapeHtml(post.title) +
            '</h3>' +
            '<p class="cs-card-place">' +
            escapeHtml(post.place && post.place.displayName ? post.place.displayName : '') +
            '</p></div></button>'
          );
        })
        .join('');
    }

    return (
      '<div class="cs-page">' +
      '<header class="cs-hero' +
      (hero.heroImage ? ' has-photo' : '') +
      '"' +
      (hero.heroImage
        ? ' style="--cs-hero-image:url(\'' +
          escapeHtml(hero.heroImage) +
          '\');--cs-hero-position:' +
          escapeHtml(hero.heroPosition) +
          ';"'
        : '') +
      '>' +
      (hero.heroImage
        ? '<span class="cs-hero-sr-only">' + escapeHtml(hero.heroAlt) + '</span>'
        : '') +
      '<div class="cs-hero-scrim" aria-hidden="true"></div>' +
      '<div class="cs-hero-copy">' +
      '<p class="cs-kicker">SOARVIBE CITY SHARES</p>' +
      '<h1 class="cs-hero-title">' +
      escapeHtml(meta.title) +
      '</h1>' +
      '<p class="cs-hero-sub">' +
      escapeHtml(meta.subtitle || '') +
      '</p></div></header>' +
      '<div class="cs-feed-toolbar">' +
      '<button type="button" class="cs-compose-open" id="csComposeOpenBtn">＋ 分享這次旅行</button>' +
      '</div>' +
      '<div class="cs-filters">' +
      filterHtml +
      '</div>' +
      '<div class="cs-feed">' +
      cardsHtml +
      '</div></div>'
    );
  }

  function renderDetail(post) {
    if (!post) return '<div class="cs-page"><div class="cs-empty">找不到這篇分享。</div></div>';
    var cover = getCoverMedia(post);
    var vm = post.visitMeta || {};
    var stats = post.stats || {};
    var likeCount = stats.likeCount != null ? stats.likeCount : post.likeCount || 0;
    var commentCount = stats.commentCount != null ? stats.commentCount : post.commentCount || 0;
    var socialEnabled = isFirestorePost(post);
    var metaChips = [];
    if (vm.stayDuration) metaChips.push('停留 ' + vm.stayDuration);
    if (vm.budget) metaChips.push('預算 ' + vm.budget);
    if (vm.bestTime) metaChips.push('最佳時段 ' + vm.bestTime);
    if (vm.recommendLevel) metaChips.push('推薦 ' + vm.recommendLevel + '/5');
    if (post.author && post.author.displayName) metaChips.push('作者 ' + post.author.displayName);

    var tagsHtml = (post.tags || [])
      .map(function (tag) {
        return '<span class="cs-tag">#' + escapeHtml(tag) + '</span>';
      })
      .join('');

    var commentsHtml = (csState.comments || [])
      .map(function (c) {
        var canDelete =
          auth() &&
          auth().isSignedIn() &&
          auth().currentUser() &&
          c.authorId === auth().currentUser().uid;
        return (
          '<div class="cs-comment-item" data-cs-comment="' +
          escapeHtml(c.commentId || '') +
          '">' +
          '<p class="cs-comment-author">' +
          escapeHtml(c.authorDisplayName || '旅人') +
          '</p>' +
          '<p class="cs-comment-text">' +
          escapeHtml(c.text || '') +
          '</p>' +
          (canDelete
            ? '<button type="button" class="cs-comment-del" data-cs-del-comment="' +
              escapeHtml(c.commentId || '') +
              '">刪除</button>'
            : '') +
          '</div>'
        );
      })
      .join('');

    var socialHtml =
      '<div class="cs-social-bar">' +
      '<button type="button" class="cs-social-btn' +
      (csState.liked ? ' is-on' : '') +
      '" id="csLikeBtn" aria-pressed="' +
      (csState.liked ? 'true' : 'false') +
      '">♡ 按讚 <span id="csLikeCount">' +
      escapeHtml(String(likeCount)) +
      '</span></button>' +
      '<button type="button" class="cs-social-btn" id="csCommentFocusBtn">💬 留言 <span>' +
      escapeHtml(String(commentCount)) +
      '</span></button>' +
      (socialEnabled &&
      auth() &&
      auth().isSignedIn() &&
      auth().currentUser() &&
      post.author &&
      post.author.authorId === auth().currentUser().uid
        ? '<button type="button" class="cs-social-btn cs-social-danger" id="csDeletePostBtn">刪除我的貼文</button>'
        : '') +
      '</div>' +
      (socialEnabled
        ? '<section class="cs-comments" id="csComments">' +
          '<h3 class="cs-comments-title">留言</h3>' +
          '<div id="csCommentList" class="cs-comment-list">' +
          (commentsHtml || '<p class="cs-comment-empty">還沒有留言，來當第一個吧。</p>') +
          '</div>' +
          '<form id="csCommentForm" class="cs-comment-form">' +
          '<textarea id="csCommentInput" class="cs-comment-input" maxlength="500" rows="3" placeholder="寫下你的補充或提問…"></textarea>' +
          '<button type="submit" class="cs-action-btn cs-action-primary">送出留言</button>' +
          '</form></section>'
        : '<p class="cs-comment-empty">官方精選可瀏覽；登入後可按讚／留言（請先從「分享這次旅行」建立旅人貼文）。</p>');

    var hasMedia = sortedMediaList(post).length > 0;
    return (
      '<div class="cs-page cs-page--detail' +
      (hasMedia ? ' cs-page--has-media' : ' cs-page--no-media') +
      '">' +
      renderMediaGallery(post) +
      '<div class="cs-detail-body">' +
      '<span class="cs-detail-type">' +
      escapeHtml(TYPE_LABELS[post.type] || post.type) +
      '</span>' +
      '<h2 class="cs-detail-title">' +
      escapeHtml(post.title) +
      '</h2>' +
      '<p class="cs-detail-place">' +
      escapeHtml(post.place && post.place.displayName ? post.place.displayName : '') +
      '</p>' +
      '<p class="cs-detail-text">' +
      escapeHtml(post.body) +
      '</p>' +
      '<div class="cs-meta-row">' +
      metaChips
        .map(function (chip) {
          return '<span class="cs-meta-chip">' + escapeHtml(chip) + '</span>';
        })
        .join('') +
      '</div>' +
      (tagsHtml ? '<div class="cs-tags">' + tagsHtml + '</div>' : '') +
      (cover && cover.attribution
        ? '<p class="cs-attribution">照片：' + escapeHtml(cover.attribution) + '</p>'
        : '') +
      socialHtml +
      '</div></div>'
    );
  }

  function prepareComposeTaxonomy(opts) {
    opts = opts || {};
    var loc = locApi();
    var scope = csState.feedScope;
    var itineraryText = resolveItineraryDestinationText();
    var tax = loc
      ? loc.resolveLocation('', { source: 'manual' })
      : { countryId: '', cityId: '', cityName: '', countryName: '', chipLabel: '' };

    // Homepage / itinerary destination = PREFILL only (never lock).
    if (itineraryText && loc) {
      tax = loc.resolveLocation(itineraryText, { source: 'itinerary' });
    } else if (scope && scope.taxonomy) {
      tax = Object.assign({}, scope.taxonomy);
      tax.locationSource = tax.locationSource || 'card';
    }

    csState.composeTaxonomy = tax;
    csState.composeLocked = false;
    csState.composeNeedsCity = true;
    csState.composeNeedsCountry = true;

    if (!csState.composeDraft) csState.composeDraft = {};
    var draft = csState.composeDraft;
    if (tax.countryId && !draft.countryId) draft.countryId = tax.countryId;
    if (tax.regionId && !draft.regionId) draft.regionId = tax.regionId;
    if ((tax.cityName || tax.cityId) && !draft.cityQuery) {
      draft.cityQuery = tax.cityName || tax.cityId;
      draft.cityId = tax.cityId || '';
      draft.cityName = tax.cityName || '';
    }
    return tax;
  }

  function renderComposeLocationBlock() {
    var tax = csState.composeTaxonomy || {};
    var draft = csState.composeDraft || {};
    var countries = (locApi() && locApi().listCountries && locApi().listCountries()) || [];
    var countryId = draft.countryId || tax.countryId || '';
    var regionValue = draft.cityQuery || draft.cityName || tax.cityName || '';

    var html =
      '<div class="cs-compose-location" data-cs-location-editable="1">' +
      '<p class="cs-compose-label">📍 這趟去了哪裡？</p>' +
      '<label class="cs-compose-field-label" for="csComposeCountryId">國家' +
      '<select id="csComposeCountryId" class="cs-compose-input" required aria-label="國家">' +
      '<option value="">請選擇國家</option>' +
      countries
        .map(function (c) {
          return (
            '<option value="' +
            escapeHtml(c.id) +
            '"' +
            (countryId === c.id ? ' selected' : '') +
            '>' +
            escapeHtml(c.name) +
            '</option>'
          );
        })
        .join('') +
      '</select></label>' +
      '<input type="hidden" id="csComposeRegionId" value="' +
      escapeHtml(draft.regionId || tax.regionId || '') +
      '">' +
      '<label class="cs-compose-field-label" for="csComposeCityQuery">地區' +
      '<input id="csComposeCityQuery" class="cs-compose-input" list="csComposeCityList" placeholder="可選擇建議，也可直接輸入" autocomplete="off" value="' +
      escapeHtml(regionValue) +
      '" aria-label="地區" aria-autocomplete="list">' +
      '<datalist id="csComposeCityList"></datalist></label>' +
      '<input type="hidden" id="csComposeCityId" value="' +
      escapeHtml(draft.cityId || tax.cityId || '') +
      '">' +
      '<input type="hidden" id="csComposeCityName" value="' +
      escapeHtml(draft.cityName || tax.cityName || regionValue) +
      '">' +
      '<p class="cs-compose-location-hint">可從清單選擇，也可以輸入冷門地區名稱。</p>' +
      '</div>';
    return html;
  }

  function renderCompose() {
    var draft = ensureComposeDraft();
    var draftMedia = draft.selectedMedia || csState.composeMedia || [];
    var uploadOn = mediaUploadEnabled();
    // Taxonomy is prepared once in openCompose — never reset on media re-render
    if (!csState.composeTaxonomy) {
      prepareComposeTaxonomy({ fromItinerary: true });
    }
    var photosBlock;
    if (!uploadOn) {
      photosBlock =
        '<div class="cs-compose-photos cs-compose-photos--soon" aria-live="polite">' +
        '<p class="cs-compose-label">照片</p>' +
        '<p class="cs-compose-media-soon">📷 照片分享即將開放</p>' +
        '</div>';
    } else {
      var atCap = draftMedia.length >= MEDIA_MAX_PER_POST;
      var thumbs =
        '<div id="csComposeMediaPreview" class="cs-compose-media-preview">' +
        draftMedia
          .map(function (item, idx) {
            return (
              '<div class="cs-compose-thumb" data-cs-media-idx="' +
              idx +
              '">' +
              '<img src="' +
              escapeHtml(item.previewUrl || item.src || '') +
              '" alt="預覽">' +
              '<button type="button" class="cs-compose-thumb-remove" data-cs-remove-media="' +
              idx +
              '" aria-label="移除照片">×</button>' +
              '</div>'
            );
          })
          .join('') +
        '</div>';
      photosBlock =
        '<div class="cs-compose-photos">' +
        '<p class="cs-compose-label">新增照片（最多 ' +
        MEDIA_MAX_PER_POST +
        ' 張）</p>' +
        (atCap
          ? ''
          : '<label class="cs-compose-add-photo">' +
            '＋ 新增照片' +
            '<input id="csComposeMediaInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif" multiple hidden>' +
            '</label>') +
        thumbs +
        '</div>';
    }
    var typeVal = draft.type || 'sightseeing';
    return (
      '<div class="cs-page cs-compose-page">' +
      '<p class="cs-compose-hint">發文後所有 SoarVibe 使用者都能看到。</p>' +
      '<form id="csComposeForm" class="cs-compose-form">' +
      renderComposeLocationBlock() +
      '<label class="cs-compose-label">分類' +
      '<select id="csComposeType" class="cs-compose-input">' +
      Object.keys(TYPE_LABELS)
        .map(function (k) {
          return (
            '<option value="' +
            escapeHtml(k) +
            '"' +
            (k === typeVal ? ' selected' : '') +
            '>' +
            escapeHtml(TYPE_LABELS[k]) +
            '</option>'
          );
        })
        .join('') +
      '</select></label>' +
      '<label class="cs-compose-label">標題' +
      '<input id="csComposeTitle" class="cs-compose-input" maxlength="80" required placeholder="例如：惠比壽這碗柚子鹽值得排隊" value="' +
      escapeHtml(draft.title || '') +
      '"></label>' +
      '<label class="cs-compose-label">心得' +
      '<textarea id="csComposeBody" class="cs-compose-input" maxlength="600" rows="6" required placeholder="至少 20 字，分享真實體驗…">' +
      escapeHtml(draft.body || '') +
      '</textarea></label>' +
      photosBlock +
      '<p id="csComposeMsg" class="cs-compose-msg hidden"></p>' +
      '<button type="submit" class="cs-action-btn cs-action-primary">發布</button>' +
      '<button type="button" class="cs-action-btn cs-action-secondary" id="csComposeCancel">取消</button>' +
      '</form></div>'
    );
  }

  function updateChrome() {
    var backBtn = document.getElementById('csBackBtn');
    var titleEl = document.getElementById('csChromeTitle');
    var shell = document.getElementById('cityShares');
    if (!backBtn) return;
    if (csState.view === 'detail' || csState.view === 'compose') {
      backBtn.classList.remove('is-hidden');
      backBtn.textContent = '← 返回';
    } else {
      backBtn.classList.add('is-hidden');
    }
    if (titleEl) {
      if (csState.view === 'compose') {
        titleEl.textContent = '分享這次旅行';
        titleEl.classList.remove('is-hidden');
      } else {
        titleEl.classList.add('is-hidden');
      }
    }
    if (shell) {
      shell.classList.toggle('is-compose', csState.view === 'compose');
    }
  }

  function setHash(cityId, postId) {
    var hash = '#city/' + encodeURIComponent(cityId) + '/shares';
    if (postId) hash += '/' + encodeURIComponent(postId);
    if (location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  }

  function clearHashIfShares() {
    var hash = location.hash || '';
    if (/^#(?:city|journal)\/[^/]+/.test(hash)) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function loadDetailExtras(postId) {
    var a = api();
    var post = findPost(postId);
    var au = auth();
    csState.comments = [];
    csState.liked = false;
    csState.saved = false;
    if (!a || !postId || !isFirestorePost(post)) return Promise.resolve();

    function runQueries() {
      var tasks = [];
      if (a.listComments) {
        tasks.push(
          a
            .listComments(postId)
            .then(function (list) {
              csState.comments = list || [];
            })
            .catch(function () {
              csState.comments = [];
            })
        );
      }
      if (a.hasLiked) {
        tasks.push(
          a
            .hasLiked(postId)
            .then(function (liked) {
              csState.liked = !!liked;
            })
            .catch(function () {
              csState.liked = false;
            })
        );
      }
      if (a.hasSaved) {
        tasks.push(
          a
            .hasSaved(postId)
            .then(function (saved) {
              csState.saved = !!saved;
            })
            .catch(function () {
              csState.saved = false;
            })
        );
      }
      return Promise.all(tasks);
    }

    // Wait for auth so hasLiked sees the current user (otherwise first paint = unliked).
    if (au && au.whenAuthReady && !(au.isAuthReady && au.isAuthReady())) {
      return au.whenAuthReady().then(runQueries).catch(runQueries);
    }
    return runQueries();
  }

  function patchLikeUi() {
    var btn = document.getElementById('csLikeBtn');
    var countEl = document.getElementById('csLikeCount');
    var post = findPost(csState.postId);
    var likeCount = 0;
    if (post) {
      var stats = post.stats || {};
      likeCount = stats.likeCount != null ? stats.likeCount : post.likeCount || 0;
    }
    if (btn) {
      btn.classList.toggle('is-on', !!csState.liked);
      btn.setAttribute('aria-pressed', csState.liked ? 'true' : 'false');
    }
    if (countEl) {
      countEl.textContent = String(likeCount);
    }
  }

  function patchCommentsUi() {
    var listEl = document.getElementById('csCommentList');
    if (!listEl) return;
    var a = auth();
    var uid = a && a.currentUser && a.currentUser() ? a.currentUser().uid : null;
    var comments = csState.comments || [];
    if (!comments.length) {
      listEl.innerHTML = '<p class="cs-comment-empty">還沒有留言，來當第一個吧。</p>';
      return;
    }
    listEl.innerHTML = comments
      .map(function (c) {
        var canDelete = !!(uid && c.authorId && c.authorId === uid);
        return (
          '<div class="cs-comment" data-cs-comment="' +
          escapeHtml(c.commentId || '') +
          '">' +
          '<p class="cs-comment-author">' +
          escapeHtml(c.authorDisplayName || '旅人') +
          '</p>' +
          '<p class="cs-comment-text">' +
          escapeHtml(c.text || '') +
          '</p>' +
          (canDelete
            ? '<button type="button" class="cs-comment-del" data-cs-del-comment="' +
              escapeHtml(c.commentId || '') +
              '">刪除</button>'
            : '') +
          '</div>'
        );
      })
      .join('');
    var focusBtn = document.getElementById('csCommentFocusBtn');
    if (focusBtn) {
      var span = focusBtn.querySelector('span');
      if (span) span.textContent = String(comments.length);
    }
  }

  function patchDetailSocialFromExtras() {
    patchLikeUi();
    patchCommentsUi();
  }

  function renderCurrentView() {
    var viewport = document.getElementById('csViewport');
    var shell = document.getElementById('cityShares');
    if (!viewport || !csState.cityId) return;
    if (csState.view === 'compose') {
      viewport.innerHTML = renderCompose();
      bindComposeLocationInputs();
      bindComposeDraftInputs();
    } else if (csState.view === 'detail' && csState.postId) {
      viewport.innerHTML = renderDetail(findPost(csState.postId));
    } else {
      viewport.innerHTML = renderFeed(csState.cityId);
    }
    if (shell) {
      shell.classList.toggle('is-detail', csState.view === 'detail');
      shell.classList.toggle('is-detail-no-media', false);
      if (csState.view === 'detail' && csState.postId) {
        var p = findPost(csState.postId);
        shell.classList.toggle('is-detail-no-media', !(p && sortedMediaList(p).length));
      }
    }
    updateChrome();
    bindCarousel(viewport);
  }

  function bindComposeLocationInputs() {
    var queryEl = document.getElementById('csComposeCityQuery');
    var listEl = document.getElementById('csComposeCityList');
    var countryEl = document.getElementById('csComposeCountryId');
    var cityIdEl = document.getElementById('csComposeCityId');
    var cityNameEl = document.getElementById('csComposeCityName');
    var regionEl = document.getElementById('csComposeRegionId');
    function refreshSuggestions() {
      if (!listEl || !locApi() || !locApi().listCitySuggestions) return;
      var countryId = countryEl ? countryEl.value : (csState.composeTaxonomy && csState.composeTaxonomy.countryId) || '';
      var q = queryEl ? queryEl.value : '';
      var suggestions = locApi().listCitySuggestions(countryId, q);
      listEl.innerHTML = suggestions
        .map(function (c) {
          return '<option value="' + escapeHtml(c.cityName) + '"></option>';
        })
        .join('');
    }
    function applyQuery() {
      if (!queryEl || !locApi()) return;
      var countryId = countryEl ? countryEl.value : '';
      var raw = String(queryEl.value || '').trim();
      var tax = locApi().resolveLocation(raw, {
        countryId: countryId,
        source: 'search'
      });
      // Keep typed custom region even if unknown city — slugify under selected country.
      if (raw && countryId && (!tax.cityId || (tax.countryId && tax.countryId !== countryId))) {
        tax = locApi().resolveLocation(raw, {
          countryId: countryId,
          source: 'manual'
        });
        if (!tax.cityId && locApi().slugifyCity) {
          tax.cityId = locApi().slugifyCity(raw);
          tax.cityName = raw;
          tax.countryId = countryId;
          tax.countryName =
            (locApi().COUNTRIES[countryId] && locApi().COUNTRIES[countryId].name) || '';
          tax.feedKind = 'city';
        }
      }
      if (cityIdEl) cityIdEl.value = tax.cityId || '';
      if (cityNameEl) cityNameEl.value = tax.cityName || raw || '';
      if (regionEl) regionEl.value = tax.regionId || '';
      if (!csState.composeDraft) csState.composeDraft = {};
      csState.composeDraft.cityQuery = raw;
      csState.composeDraft.cityId = tax.cityId || '';
      csState.composeDraft.cityName = tax.cityName || raw;
      csState.composeDraft.countryId = countryId || tax.countryId || '';
      csState.composeDraft.regionId = tax.regionId || '';
      csState.composeTaxonomy = Object.assign({}, csState.composeTaxonomy || {}, tax, {
        countryId: countryId || tax.countryId || ''
      });
    }
    function clearIncompatibleRegion(newCountryId) {
      var raw = queryEl ? String(queryEl.value || '').trim() : '';
      if (!raw || !newCountryId || !locApi()) return;
      var belongs =
        locApi().regionBelongsToCountry &&
        (locApi().regionBelongsToCountry(raw, newCountryId) ||
          locApi().regionBelongsToCountry((cityIdEl && cityIdEl.value) || '', newCountryId));
      if (!belongs) {
        if (queryEl) queryEl.value = '';
        if (cityIdEl) cityIdEl.value = '';
        if (cityNameEl) cityNameEl.value = '';
        if (regionEl) regionEl.value = '';
        if (!csState.composeDraft) csState.composeDraft = {};
        csState.composeDraft.cityQuery = '';
        csState.composeDraft.cityId = '';
        csState.composeDraft.cityName = '';
        csState.composeDraft.regionId = '';
        if (csState.composeTaxonomy) {
          csState.composeTaxonomy.cityId = '';
          csState.composeTaxonomy.cityName = '';
          csState.composeTaxonomy.regionId = '';
          csState.composeTaxonomy.regionName = '';
        }
      }
    }
    if (queryEl) {
      queryEl.addEventListener('input', function () {
        refreshSuggestions();
        applyQuery();
      });
      queryEl.addEventListener('change', applyQuery);
      refreshSuggestions();
    }
    if (countryEl && countryEl.tagName === 'SELECT') {
      countryEl.addEventListener('change', function () {
        var newCountryId = countryEl.value;
        clearIncompatibleRegion(newCountryId);
        refreshSuggestions();
        if (!csState.composeDraft) csState.composeDraft = {};
        csState.composeDraft.countryId = newCountryId;
        if (csState.composeTaxonomy) {
          csState.composeTaxonomy.countryId = newCountryId;
          var c =
            locApi() &&
            locApi().COUNTRIES &&
            locApi().COUNTRIES[newCountryId];
          if (c) {
            csState.composeTaxonomy.countryName = c.name;
            csState.composeTaxonomy.countryCode = c.countryCode || '';
          }
        }
        applyQuery();
      });
    }
  }

  function openCityShares(cityId, postId) {
    var shell = document.getElementById('cityShares');
    var viewport = document.getElementById('csViewport');
    if (!shell || !viewport) return;

    var requestId = ++csState.shareOpenGeneration;
    var scope = buildScopeFromEntryId(cityId);
    csState.feedScope = scope;
    csState.cityId = cityId;
    csState.typeFilter = csState.typeFilter || 'all';
    if (postId) {
      csState.view = 'detail';
      csState.postId = postId;
    } else {
      csState.view = 'feed';
      csState.postId = null;
    }

    shell.classList.remove('hidden');
    shell.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    viewport.scrollTop = 0;
    setHash(cityId, postId || null);
    updateChrome();
    // Paint shell immediately (local feed / skeleton) — never leave a blank white panel
    // while waiting on Firestore. Images fill async; they must not block first paint.
    if (csState.view === 'detail' && csState.postId && findPost(csState.postId)) {
      renderCurrentView();
      // Hydrate like/comments ASAP (auth-ready); patch only — no second full detail paint.
      loadDetailExtras(csState.postId).then(function () {
        if (requestId !== csState.shareOpenGeneration) return;
        if (csState.view === 'detail' && csState.postId) patchDetailSocialFromExtras();
      });
    } else if (csState.view === 'feed') {
      renderCurrentView();
      if (!getPosts(cityId, csState.typeFilter).length) {
        var cardsHost = viewport.querySelector('.cs-feed') || viewport.querySelector('.cs-page');
        if (cardsHost && !viewport.querySelector('.cs-skeleton-card')) {
          var sk = document.createElement('div');
          sk.className = 'cs-skeleton-grid';
          sk.setAttribute('aria-busy', 'true');
          sk.innerHTML =
            '<div class="cs-skeleton-card"></div><div class="cs-skeleton-card"></div><div class="cs-skeleton-card"></div>';
          var emptyEl = viewport.querySelector('.cs-empty');
          if (emptyEl && emptyEl.parentNode) {
            emptyEl.parentNode.replaceChild(sk, emptyEl);
          } else {
            cardsHost.appendChild(sk);
          }
        }
      }
    } else {
      viewport.innerHTML =
        '<div class="cs-page"><div class="cs-skeleton-grid" aria-busy="true">' +
        '<div class="cs-skeleton-card"></div><div class="cs-skeleton-card"></div>' +
        '<div class="cs-skeleton-card"></div></div></div>';
    }

    refreshRemoteFeed(cityId, { requestId: requestId })
      .then(function (posts) {
        if (requestId !== csState.shareOpenGeneration) return;
        if (posts === null) return;
        if (csState.view === 'detail' && csState.postId) {
          var alreadyPainted = !!document.getElementById('csLikeBtn');
          return loadDetailExtras(csState.postId).then(function () {
            if (requestId !== csState.shareOpenGeneration) return;
            if (alreadyPainted && document.getElementById('csLikeBtn')) {
              patchDetailSocialFromExtras();
              return;
            }
            renderCurrentView();
          });
        }
        renderCurrentView();
      })
      .catch(function (err) {
        if (requestId !== csState.shareOpenGeneration) return;
        console.warn('[SOARVIBE] openCityShares failed', err);
        // Prefer painting local/remote cards over a full-screen error when anything is showable.
        if (getPosts(cityId, csState.typeFilter).length || findPost(csState.postId)) {
          renderCurrentView();
          return;
        }
        showCitySharesLoadError(cityId, postId, requestId);
      });
  }

  function closeCityShares() {
    var shell = document.getElementById('cityShares');
    if (!shell) return;
    csState.shareOpenGeneration += 1;
    if (csState.feedAbort && typeof csState.feedAbort.abort === 'function') {
      try { csState.feedAbort.abort(); } catch (eCloseAbort) { /* silent */ }
    }
    csState.feedAbort = null;
    closePhotoViewer();
    shell.classList.add('hidden');
    shell.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    csState.view = 'closed';
    csState.cityId = null;
    csState.postId = null;
    csState.typeFilter = 'all';
    csState.feedScope = null;
    csState.composeTaxonomy = null;
    csState.isSubmitting = false;
    csState.isDeleting = false;
    csState.remotePosts = [];
    csState.comments = [];
    clearComposeDraft();
    clearHashIfShares();
    var viewport = document.getElementById('csViewport');
    if (viewport) viewport.innerHTML = '';
  }

  function goBackCityShares() {
    var viewer = document.getElementById('csPhotoViewer');
    if (viewer && !viewer.classList.contains('hidden')) {
      closePhotoViewer();
      return;
    }
    if (csState.view === 'compose' && csState.cityId) {
      clearComposeDraft();
      csState.view = 'feed';
      csState.postId = null;
      csState.isSubmitting = false;
      csState.composeTaxonomy = null;
      renderCurrentView();
      setHash(csState.cityId, null);
      return;
    }
    if (csState.view === 'detail' && csState.cityId) {
      csState.view = 'feed';
      csState.postId = null;
      renderCurrentView();
      setHash(csState.cityId, null);
      var viewport = document.getElementById('csViewport');
      if (viewport) viewport.scrollTop = 0;
      return;
    }
    closeCityShares();
  }

  function openCityShareDetail(postId) {
    if (!csState.cityId) return;
    csState.view = 'detail';
    csState.postId = postId;
    setHash(csState.cityId, postId);
    loadDetailExtras(postId).then(function () {
      renderCurrentView();
      var viewport = document.getElementById('csViewport');
      if (viewport) viewport.scrollTop = 0;
    });
  }

  function openCompose(opts) {
    opts = opts || {};
    var a = auth();
    try {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } catch (blurErr) {
      /* silent */
    }
    function proceedSignedIn() {
      if (opts.cityId && opts.cityId !== csState.cityId) {
        csState.cityId = opts.cityId;
      }
      csState.view = 'compose';
      csState.postId = null;
      csState.isSubmitting = false;
      // Fresh composer session — new draft (keeps nothing from prior cancel/success)
      clearComposeDraft();
      ensureComposeDraft();
      prepareComposeTaxonomy({ fromItinerary: true });
      var tax = csState.composeTaxonomy || {};
      var draft = ensureComposeDraft();
      draft.countryId = tax.countryId || '';
      draft.regionId = tax.regionId || '';
      draft.cityId = tax.cityId || '';
      draft.cityName = tax.cityName || '';
      renderCurrentView();
    }
    function gate() {
      if (!a || !a.isSignedIn()) {
        if (a && a.requireAuth) {
          a.requireAuth('分享投稿', {
            pendingAction: 'city_share_compose',
            pendingPayload: { cityId: csState.cityId || null }
          });
        } else if (global.openSoarvibeAuthModal) {
          if (global.SOARVIBE_AUTH && global.SOARVIBE_AUTH.setPendingAction) {
            global.SOARVIBE_AUTH.setPendingAction('city_share_compose', {
              cityId: csState.cityId || null
            });
          }
          global.openSoarvibeAuthModal({ reason: '請先登入後才能分享投稿' });
        }
        // Never render composer / never focus inputs before auth.
        return;
      }
      proceedSignedIn();
    }
    if (a && a.whenAuthReady && !(a.isAuthReady && a.isAuthReady())) {
      a.whenAuthReady().then(gate).catch(gate);
      return;
    }
    gate();
  }

  function openCityShareComposer(payload) {
    payload = payload || {};
    if (payload.cityId && !csState.cityId) {
      // Ensure City Shares shell is open for the pending city when possible.
      if (typeof global.openCityShares === 'function') {
        global.openCityShares(payload.cityId);
      } else {
        csState.cityId = payload.cityId;
      }
    }
    openCompose({ cityId: payload.cityId || csState.cityId });
  }

  function focusPlannerWithDestination(value) {
    var destInput = document.getElementById('destination-input');
    if (destInput) {
      destInput.value = value;
      destInput.dispatchEvent(new Event('input', { bubbles: true }));
      destInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var phoneScroll = document.querySelector('.phone-scroll');
    if (phoneScroll) {
      phoneScroll.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (destInput) {
      destInput.focus({ preventScroll: true });
    }
  }

  function handleLike() {
    var a = api();
    var au = auth();
    function run() {
      if (!au || !au.isSignedIn()) {
        if (au && au.requireAuth) {
          au.requireAuth('按讚', {
            pendingAction: 'city_share_like',
            pendingPayload: { postId: csState.postId, cityId: csState.cityId }
          });
        } else if (global.openSoarvibeAuthModal) {
          global.openSoarvibeAuthModal({ reason: '請先登入後才能按讚' });
        }
        return;
      }
      if (!isFirestorePost(findPost(csState.postId))) {
        alert('官方精選暫不開放按讚。請先「分享投稿」建立旅人貼文後再互動。');
        return;
      }
      if (!a || !csState.postId) return;
      a.toggleLike(csState.postId)
        .then(function (res) {
          csState.liked = !!(res && res.liked);
          var post = findPost(csState.postId);
          if (post) {
            post.likeCount = Math.max(0, (post.likeCount || 0) + (csState.liked ? 1 : -1));
            if (!post.stats) post.stats = {};
            post.stats.likeCount = post.likeCount;
          }
          // Patch only — never full detail rerender (avoids scroll jump / carousel rebuild).
          patchLikeUi();
        })
        .catch(function (err) {
          if (err && err.message === 'AUTH_REQUIRED') return;
          alert((err && err.message) || '按讚失敗');
        });
    }
    if (au && au.whenAuthReady && !(au.isAuthReady && au.isAuthReady())) {
      au.whenAuthReady().then(run).catch(run);
      return;
    }
    run();
  }

  function handleSave() {
    var a = api();
    var au = auth();
    function run() {
      if (!au || !au.isSignedIn()) {
        if (au && au.requireAuth) {
          au.requireAuth('收藏', {
            pendingAction: 'city_share_save',
            pendingPayload: { postId: csState.postId, cityId: csState.cityId }
          });
        } else if (global.openSoarvibeAuthModal) {
          global.openSoarvibeAuthModal({ reason: '請先登入後才能收藏' });
        }
        return;
      }
      if (!isFirestorePost(findPost(csState.postId))) {
        alert('官方精選暫不開放收藏。請先「分享投稿」建立旅人貼文後再互動。');
        return;
      }
      if (!a || !csState.postId || !a.toggleSave) return;
      a.toggleSave(csState.postId)
        .then(function (res) {
          csState.saved = !!(res && res.saved);
          var post = findPost(csState.postId);
          if (post) {
            post.saveCount = Math.max(0, (post.saveCount || 0) + (csState.saved ? 1 : -1));
            if (!post.stats) post.stats = {};
            post.stats.saveCount = post.saveCount;
          }
          renderCurrentView();
        })
        .catch(function (err) {
          if (err && err.message === 'AUTH_REQUIRED') return;
          alert((err && err.message) || '收藏失敗');
        });
    }
    if (au && au.whenAuthReady && !(au.isAuthReady && au.isAuthReady())) {
      au.whenAuthReady().then(run).catch(run);
      return;
    }
    run();
  }

  function handleCommentSubmit() {
    var a = api();
    var au = auth();
    function run() {
      if (!au || !au.isSignedIn()) {
        if (au && au.requireAuth) {
          au.requireAuth('留言', {
            pendingAction: 'city_share_comment',
            pendingPayload: {
              postId: csState.postId,
              cityId: csState.cityId,
              draft: (document.getElementById('csCommentInput') &&
                document.getElementById('csCommentInput').value) ||
                ''
            }
          });
        } else if (global.openSoarvibeAuthModal) {
          global.openSoarvibeAuthModal({ reason: '請先登入後才能留言' });
        }
        return;
      }
      if (!isFirestorePost(findPost(csState.postId))) {
        alert('官方精選暫不開放留言。請先「分享投稿」建立旅人貼文後再互動。');
        return;
      }
      var input = document.getElementById('csCommentInput');
      var text = input ? input.value : '';
      if (!a || !csState.postId) return;
      a.addComment(csState.postId, text)
        .then(function () {
          return loadDetailExtras(csState.postId);
        })
        .then(function () {
          var post = findPost(csState.postId);
          if (post) {
            post.commentCount = (post.commentCount || 0) + 1;
            if (!post.stats) post.stats = {};
            post.stats.commentCount = post.commentCount;
          }
          renderCurrentView();
        })
        .catch(function (err) {
          if (err && err.message === 'AUTH_REQUIRED') return;
          alert((err && err.message) || '留言失敗');
        });
    }
    if (au && au.whenAuthReady && !(au.isAuthReady && au.isAuthReady())) {
      au.whenAuthReady().then(run).catch(run);
      return;
    }
    run();
  }

  function handleDeleteComment(commentId) {
    var a = api();
    if (!a || !csState.postId || !commentId) return;
    if (!confirm('刪除這則留言？')) return;
    a.deleteComment(csState.postId, commentId)
      .then(function () {
        return loadDetailExtras(csState.postId);
      })
      .then(function () {
        renderCurrentView();
      })
      .catch(function (err) {
        alert((err && err.message) || '刪除失敗');
      });
  }

  function handleDeletePost() {
    var a = api();
    var au = auth();
    if (!au || !au.isSignedIn()) {
      if (au && au.requireAuth) au.requireAuth('刪除貼文');
      return;
    }
    if (!a || !csState.postId) return;
    if (csState.isDeleting) return;
    if (!confirm('確定刪除這篇貼文？留言與按讚也會一併無法瀏覽。')) return;

    var cityId = csState.cityId;
    var postId = csState.postId;
    var removedSnapshot = findPost(postId);
    csState.isDeleting = true;

    // Optimistic UI: leave detail immediately (< 300ms feel).
    csState.remotePosts = (csState.remotePosts || []).filter(function (p) {
      return !(p && p.postId === postId);
    });
    csState.view = 'feed';
    csState.postId = null;
    setHash(cityId, null);
    renderCurrentView();
    showCsToast('貼文已刪除');

    a.deletePost(postId)
      .then(function () {
        return refreshRemoteFeed(cityId);
      })
      .catch(function (err) {
        // Firestore soft-remove failed → restore
        if (removedSnapshot) {
          csState.remotePosts = (csState.remotePosts || []).concat([removedSnapshot]);
        }
        renderCurrentView();
        alert((err && err.message) || '刪除失敗，請再試一次。');
      })
      .then(function () {
        csState.isDeleting = false;
      });
  }

  function handleComposeMediaPick(fileList) {
    if (!mediaUploadEnabled()) return;
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    // Capture title/body/type before any async work / re-render
    syncComposeDraftFromDom();
    var draft = ensureComposeDraft();
    if (!Array.isArray(draft.selectedMedia)) draft.selectedMedia = [];
    csState.composeMedia = draft.selectedMedia;
    var room = Math.max(0, MEDIA_MAX_PER_POST - draft.selectedMedia.length);
    if (!room) {
      alert('每篇最多 ' + MEDIA_MAX_PER_POST + ' 張照片');
      return;
    }
    var imgApi = global.SOARVIBE_CITY_SHARES_IMAGE;
    var picked = files.slice(0, room);
    var msg = document.getElementById('csComposeMsg');
    if (msg) {
      msg.textContent = '處理照片中…';
      msg.classList.remove('hidden');
    }

    var chain = Promise.resolve();
    picked.forEach(function (file) {
      chain = chain.then(function () {
        if (draft.selectedMedia.length >= MEDIA_MAX_PER_POST) return null;
        if (!file) return null;
        if (imgApi && typeof imgApi.isAcceptedInput === 'function' && !imgApi.isAcceptedInput(file)) {
          alert('請選擇 JPG、PNG、WebP 或 iPhone 照片');
          return null;
        }
        var compressPromise =
          imgApi && typeof imgApi.compressForUpload === 'function'
            ? imgApi.compressForUpload(file)
            : Promise.resolve({
                ok: false,
                code: 'no_compressor',
                message: '照片壓縮模組未載入'
              });
        return compressPromise.then(function (result) {
          if (!result || !result.ok) {
            var code = result && result.code;
            var text =
              (result && result.message) ||
              (code === 'heic_unsupported'
                ? '這張 HEIC 無法解碼。請轉成 JPG 後再試。'
                : '照片處理失敗');
            alert(text);
            return null;
          }
          if (draft.selectedMedia.length >= MEDIA_MAX_PER_POST) return null;
          var previewUrl = '';
          try {
            previewUrl = URL.createObjectURL(result.blob || result.file);
          } catch (e) {
            previewUrl = '';
          }
          draft.selectedMedia.push({
            file: result.file || result.blob,
            imageId: result.imageId,
            previewUrl: previewUrl,
            type: 'image/webp',
            bytes: result.bytes,
            width: result.width,
            height: result.height
          });
          csState.composeMedia = draft.selectedMedia;
          return null;
        });
      });
    });

    chain
      .then(function () {
        if (msg) {
          msg.textContent = '';
          msg.classList.add('hidden');
        }
        renderCurrentView();
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = (err && err.message) || '照片處理失敗';
          msg.classList.remove('hidden');
        }
        renderCurrentView();
      });
  }

  function handleComposeSubmit() {
    var a = api();
    var msg = document.getElementById('csComposeMsg');
    var submitBtn = document.querySelector('#csComposeForm button[type="submit"]');
    if (!a) return;
    if (csState.isSubmitting) return;

    var draft = syncComposeDraftFromDom();

    function setSubmitting(on) {
      csState.isSubmitting = !!on;
      if (submitBtn) {
        submitBtn.disabled = !!on;
        submitBtn.setAttribute('aria-busy', on ? 'true' : 'false');
      }
    }

    if (msg) {
      msg.textContent = '發布中…';
      msg.classList.remove('hidden');
    }
    var uploadOn = mediaUploadEnabled();
    var mediaDraft = uploadOn ? (draft.selectedMedia || []).slice(0, MEDIA_MAX_PER_POST) : [];
    var countryId = String(draft.countryId || '').trim();
    var regionId = String(draft.regionId || '').trim();
    var cityId = String(draft.cityId || '').trim();
    var cityName = String(draft.cityName || '').trim();
    var cityQuery = String(draft.cityQuery || '').trim();
    if (!cityId && cityQuery && locApi()) {
      var resolved = locApi().resolveLocation(cityQuery, {
        countryId: countryId,
        source: 'search'
      });
      cityId = resolved.cityId || '';
      cityName = resolved.cityName || cityQuery;
      if (resolved.countryId) countryId = resolved.countryId;
      if (resolved.regionId) regionId = resolved.regionId;
      draft.cityId = cityId;
      draft.cityName = cityName;
      draft.countryId = countryId;
      draft.regionId = regionId;
    }
    if (!countryId) {
      if (msg) {
        msg.textContent = '請選擇國家';
        msg.classList.remove('hidden');
      }
      return;
    }
    if (!cityId && !cityQuery) {
      if (msg) {
        msg.textContent = '請選擇或輸入地區';
        msg.classList.remove('hidden');
      }
      return;
    }
    if (!cityId && cityQuery && locApi() && locApi().slugifyCity) {
      cityId = locApi().slugifyCity(cityQuery);
      cityName = cityQuery;
      draft.cityId = cityId;
      draft.cityName = cityName;
    }

    // Allocate one postId / clientPublishId for this composer session (retry-safe).
    if (!csState.composePostId && a.allocatePostId) {
      try {
        csState.composePostId = a.allocatePostId();
      } catch (allocErr) {
        csState.composePostId = null;
      }
    }
    if (!csState.clientPublishId) {
      try {
        csState.clientPublishId =
          global.crypto && global.crypto.randomUUID
            ? global.crypto.randomUUID().replace(/-/g, '')
            : 'pub' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      } catch (idErr) {
        csState.clientPublishId = 'pub' + Date.now();
      }
    }
    draft.postId = csState.composePostId;
    draft.clientPublishId = csState.clientPublishId;

    var payload = {
      postId: csState.composePostId || undefined,
      clientPublishId: csState.clientPublishId,
      title: draft.title || '',
      body: draft.body || '',
      countryId: countryId,
      countryCode:
        (locApi() && locApi().countryCodeOf && locApi().countryCodeOf(countryId)) || '',
      countryName:
        (csState.composeTaxonomy && csState.composeTaxonomy.countryName) ||
        (locApi() && locApi().COUNTRIES && locApi().COUNTRIES[countryId] && locApi().COUNTRIES[countryId].name) ||
        '',
      regionId: regionId,
      regionKey: cityId,
      regionName: cityName || cityQuery,
      cityId: cityId,
      cityName: cityName || cityQuery,
      locationRaw: cityQuery || cityName || cityId,
      locationSource: cityQuery ? 'search' : 'manual',
      type: draft.type || 'sightseeing',
      media: [],
      mediaFiles: uploadOn
        ? mediaDraft.map(function (m, idx) {
            var file = m.imageId ? { file: m.file, imageId: m.imageId } : m.file;
            if (file && typeof file === 'object' && file.file) {
              file.sortOrder = idx;
              if (m.width) file.width = m.width;
              if (m.height) file.height = m.height;
            }
            return file;
          })
        : []
    };
    if (csState.composeTaxonomy) {
      if (!payload.regionName && csState.composeTaxonomy.regionName) {
        payload.regionName = csState.composeTaxonomy.regionName;
      }
    }

    setSubmitting(true);
    a.createPost(payload)
      .then(function (post) {
        clearComposeDraft();
        csState.composeTaxonomy = null;
        var feedKey = csState.cityId;
        if (post.countryId && csState.feedScope && csState.feedScope.feedKind === 'country') {
          feedKey = csState.feedScope.entryId;
        } else if (post.cityId) {
          if (csState.feedScope && postMatchesScope(post, csState.feedScope)) {
            feedKey = csState.cityId;
          } else {
            feedKey = post.cityId;
            csState.feedScope = buildScopeFromEntryId(post.cityId);
            csState.cityId = post.cityId;
          }
        }
        return refreshRemoteFeed(feedKey).then(function () {
          openCityShareDetail(post.postId);
        });
      })
      .catch(function (err) {
        // Keep draft (title/body/media/ids) so user can retry
        if (msg) {
          msg.textContent = friendlyPublishError(err, csState.composePostId);
          msg.classList.remove('hidden');
        }
      })
      .then(function () {
        setSubmitting(false);
      });
  }

  function applyShareToTrip(post) {
    if (!post) return;
    var cityLabel =
      post.cityName ||
      (CITY_LABELS[post.cityId] && CITY_LABELS[post.cityId].dest) ||
      post.cityId ||
      post.countryName ||
      '';
    closeCityShares();
    focusPlannerWithDestination(cityLabel);
  }

  function planShareWithAI(post) {
    if (!post) return;
    var cityLabel =
      post.cityName ||
      (CITY_LABELS[post.cityId] && CITY_LABELS[post.cityId].dest) ||
      post.cityId ||
      post.countryName ||
      '';
    var placeName = (post.place && post.place.displayName) || post.title;
    closeCityShares();
    focusPlannerWithDestination(cityLabel + '（含 ' + placeName + '）');
  }

  function openCityDestination(cityId) {
    var flags = global.SOARVIBE_FEATURE_FLAGS || {};
    if (flags.CITY_SHARES_ENABLED) {
      openCityShares(cityId);
      return;
    }
    if (flags.CITY_JOURNAL_ENABLED && typeof global.openCityJournal === 'function') {
      global.openCityJournal(cityId);
    }
  }

  function parseCitySharesHash() {
    var hash = (location.hash || '').replace(/^#/, '');
    var journalMatch = hash.match(/^journal\/([^/]+)/);
    if (journalMatch) {
      return { cityId: journalMatch[1], postId: null, redirect: true };
    }
    var match = hash.match(/^city\/([^/]+)\/shares(?:\/([^/]+))?/);
    if (match) {
      return { cityId: decodeURIComponent(match[1]), postId: match[2] ? decodeURIComponent(match[2]) : null };
    }
    return null;
  }

  function initCitySharesFromHash() {
    var parsed = parseCitySharesHash();
    if (!parsed) return;
    if (parsed.redirect) {
      history.replaceState(null, '', '#city/' + encodeURIComponent(parsed.cityId) + '/shares');
    }
    openCityShares(parsed.cityId, parsed.postId || null);
  }

  function initCityShares() {
    var shell = document.getElementById('cityShares');
    if (!shell) return;
    if (cardsApi() && typeof cardsApi().mountHomepageCards === 'function') {
      cardsApi().mountHomepageCards();
    }

    var closeBtn = document.getElementById('csCloseBtn');
    var backBtn = document.getElementById('csBackBtn');

    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeCityShares();
      });
    }
    if (backBtn) {
      backBtn.addEventListener('click', function (e) {
        e.preventDefault();
        goBackCityShares();
      });
    }

    shell.addEventListener('click', function (e) {
      var filterBtn = e.target.closest('[data-cs-filter]');
      if (filterBtn) {
        e.preventDefault();
        csState.typeFilter = filterBtn.getAttribute('data-cs-filter') || 'all';
        renderCurrentView();
        return;
      }
      var cardBtn = e.target.closest('[data-cs-post]');
      if (cardBtn) {
        // Ignore taps that began as a horizontal swipe on a feed carousel.
        if (e.target.closest('[data-cs-track]') && cardBtn.getAttribute('data-cs-swiping') === '1') {
          cardBtn.removeAttribute('data-cs-swiping');
          e.preventDefault();
          return;
        }
        e.preventDefault();
        openCityShareDetail(cardBtn.getAttribute('data-cs-post'));
        return;
      }
      var mediaSlide = e.target.closest('.cs-media-slide[data-cs-media-index]');
      if (mediaSlide && mediaSlide.closest('.cs-media-carousel--detail')) {
        e.preventDefault();
        e.stopPropagation();
        var detailPost = findPost(csState.postId);
        var list = sortedMediaList(detailPost);
        var startIdx = parseInt(mediaSlide.getAttribute('data-cs-media-index'), 10) || 0;
        openPhotoViewer(list, startIdx, detailPost && detailPost.title);
        return;
      }
      if (e.target.id === 'csPhotoViewerClose' || e.target.closest('#csPhotoViewerClose')) {
        e.preventDefault();
        closePhotoViewer();
        return;
      }
      if (e.target.id === 'csPhotoViewer') {
        e.preventDefault();
        closePhotoViewer();
        return;
      }
      if (e.target.id === 'csComposeOpenBtn' || e.target.closest('#csComposeOpenBtn')) {
        e.preventDefault();
        openCompose();
        return;
      }
      if (e.target.id === 'csComposeCancel') {
        e.preventDefault();
        goBackCityShares();
        return;
      }
      var removeMedia = e.target.closest('[data-cs-remove-media]');
      if (removeMedia) {
        e.preventDefault();
        syncComposeDraftFromDom();
        var draftRm = ensureComposeDraft();
        var rmIdx = parseInt(removeMedia.getAttribute('data-cs-remove-media'), 10);
        if (!isNaN(rmIdx) && Array.isArray(draftRm.selectedMedia)) {
          var removed = draftRm.selectedMedia.splice(rmIdx, 1)[0];
          if (removed && removed.previewUrl) {
            try {
              URL.revokeObjectURL(removed.previewUrl);
            } catch (revErr) {
              /* silent */
            }
          }
          csState.composeMedia = draftRm.selectedMedia;
          renderCurrentView();
        }
        return;
      }
      if (e.target.id === 'csLikeBtn' || e.target.closest('#csLikeBtn')) {
        e.preventDefault();
        handleLike();
        return;
      }
      if (e.target.id === 'csSaveBtn' || e.target.closest('#csSaveBtn')) {
        e.preventDefault();
        handleSave();
        return;
      }
      if (e.target.id === 'csCommentFocusBtn') {
        e.preventDefault();
        try {
          if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        } catch (blurC) {
          /* silent */
        }
        var auFocus = auth();
        if (!auFocus || !auFocus.isSignedIn()) {
          if (auFocus && auFocus.requireAuth) auFocus.requireAuth('留言');
          return;
        }
        var input = document.getElementById('csCommentInput');
        if (input) input.focus();
        return;
      }
      if (e.target.id === 'csDeletePostBtn' || e.target.closest('#csDeletePostBtn')) {
        e.preventDefault();
        handleDeletePost();
        return;
      }
      var delC = e.target.closest('[data-cs-del-comment]');
      if (delC) {
        e.preventDefault();
        handleDeleteComment(delC.getAttribute('data-cs-del-comment'));
        return;
      }
    });

    shell.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'csComposeMediaInput') {
        handleComposeMediaPick(e.target.files);
        e.target.value = '';
      }
    });

    // Feed carousel: mark horizontal swipes so card click does not open detail.
    var swipeStartX = 0;
    shell.addEventListener(
      'touchstart',
      function (e) {
        var track = e.target.closest('[data-cs-track]');
        if (!track) return;
        swipeStartX = e.touches && e.touches[0] ? e.touches[0].clientX : 0;
        var card = track.closest('[data-cs-post]');
        if (card) card.removeAttribute('data-cs-swiping');
      },
      { passive: true }
    );
    shell.addEventListener(
      'touchmove',
      function (e) {
        var track = e.target.closest('[data-cs-track]');
        if (!track || !e.touches || !e.touches[0]) return;
        var dx = Math.abs(e.touches[0].clientX - swipeStartX);
        if (dx > 12) {
          var card = track.closest('[data-cs-post]');
          if (card) card.setAttribute('data-cs-swiping', '1');
        }
      },
      { passive: true }
    );

    shell.addEventListener('submit', function (e) {
      if (e.target && e.target.id === 'csCommentForm') {
        e.preventDefault();
        handleCommentSubmit();
        return;
      }
      if (e.target && e.target.id === 'csComposeForm') {
        e.preventDefault();
        handleComposeSubmit();
      }
    });

    shell.addEventListener(
      'error',
      function (e) {
        var img = e.target;
        if (!img || img.tagName !== 'IMG' || !img.closest('#cityShares')) return;
        var wrap = img.parentElement;
        if (!wrap || wrap.querySelector('.cs-card-placeholder')) return;
        img.replaceWith(
          (function () {
            var div = document.createElement('div');
            div.className = 'cs-card-placeholder';
            div.setAttribute('role', 'img');
            div.setAttribute('aria-label', '照片無法載入');
            div.innerHTML = '<span class="cs-placeholder-mark">SV</span><span>照片暫時無法顯示</span>';
            return div;
          })()
        );
      },
      true
    );

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || shell.classList.contains('hidden')) return;
      var viewer = document.getElementById('csPhotoViewer');
      if (viewer && !viewer.classList.contains('hidden')) {
        closePhotoViewer();
        return;
      }
      if (csState.view === 'detail') goBackCityShares();
      else closeCityShares();
    });

    window.addEventListener('hashchange', function () {
      var parsed = parseCitySharesHash();
      if (parsed) {
        if (parsed.redirect) {
          history.replaceState(null, '', '#city/' + encodeURIComponent(parsed.cityId) + '/shares');
        }
        openCityShares(parsed.cityId, parsed.postId || null);
      } else if (!shell.classList.contains('hidden')) {
        closeCityShares();
      }
    });

    initCitySharesFromHash();

    // After Auth settles (guest OR signed-in), refresh open feed so early
    // pre-auth queries cannot leave guests without public posts.
    if (global.SOARVIBE_AUTH && typeof global.SOARVIBE_AUTH.onAuthStateChanged === 'function') {
      global.SOARVIBE_AUTH.onAuthStateChanged(function () {
        if (csState.view !== 'feed' && csState.view !== 'detail') return;
        if (!csState.cityId) return;
        var rid = csState.shareOpenGeneration;
        refreshRemoteFeed(csState.cityId, { requestId: rid }).then(function (posts) {
          if (rid !== csState.shareOpenGeneration || posts === null) return;
          if (csState.view === 'detail' && csState.postId) {
            return loadDetailExtras(csState.postId).then(function () {
              if (rid !== csState.shareOpenGeneration) return;
              if (document.getElementById('csLikeBtn')) patchDetailSocialFromExtras();
              else renderCurrentView();
            });
          }
          renderCurrentView();
        });
      });
    }

    if (global.SOARVIBE_AUTH && global.SOARVIBE_AUTH.registerPendingActionHandler) {
      global.SOARVIBE_AUTH.registerPendingActionHandler('city_share_compose', function (payload) {
        openCityShareComposer(payload || {});
      });
      global.SOARVIBE_AUTH.registerPendingActionHandler('city_share_like', function (payload) {
        payload = payload || {};
        if (payload.cityId) {
          openCityShares(payload.cityId, payload.postId || null);
        } else if (payload.postId) {
          openCityShareDetail(payload.postId);
        }
        window.setTimeout(function () {
          if (payload.postId) csState.postId = payload.postId;
          handleLike();
        }, 80);
      });
      global.SOARVIBE_AUTH.registerPendingActionHandler('city_share_save', function (payload) {
        payload = payload || {};
        if (payload.cityId) {
          openCityShares(payload.cityId, payload.postId || null);
        } else if (payload.postId) {
          openCityShareDetail(payload.postId);
        }
        window.setTimeout(function () {
          if (payload.postId) csState.postId = payload.postId;
          handleSave();
        }, 80);
      });
      global.SOARVIBE_AUTH.registerPendingActionHandler('city_share_comment', function (payload) {
        payload = payload || {};
        if (payload.cityId) {
          openCityShares(payload.cityId, payload.postId || null);
        } else if (payload.postId) {
          openCityShareDetail(payload.postId);
        }
        window.setTimeout(function () {
          if (payload.postId) csState.postId = payload.postId;
          var input = document.getElementById('csCommentInput');
          if (input && payload.draft) input.value = payload.draft;
          handleCommentSubmit();
        }, 80);
      });
      // Resume after redirect login if handler was not ready during auth start.
      if (global.SOARVIBE_AUTH.whenAuthReady) {
        global.SOARVIBE_AUTH.whenAuthReady().then(function () {
          global.SOARVIBE_AUTH.resumePendingAction();
        });
      } else {
        global.SOARVIBE_AUTH.resumePendingAction();
      }
    }
  }

  global.openCityShares = openCityShares;
  global.openCityShareComposer = openCityShareComposer;
  global.closeCityShares = closeCityShares;
  global.openCityDestination = openCityDestination;
  /** Test hooks (City Shares UX P0 / P0.4) */
  global.SOARVIBE_CITY_SHARES_UI_TEST = {
    sortedMediaList: sortedMediaList,
    renderCarousel: renderCarousel,
    renderMediaGallery: renderMediaGallery,
    prepareComposeTaxonomy: prepareComposeTaxonomy,
    renderComposeLocationBlock: renderComposeLocationBlock,
    postMatchesScope: postMatchesScope,
    buildScopeFromEntryId: buildScopeFromEntryId,
    getState: function () {
      return csState;
    },
    setSubmitting: function (v) {
      csState.isSubmitting = !!v;
    },
    isSubmitting: function () {
      return !!csState.isSubmitting;
    },
    resetComposeForTest: function () {
      csState.composeTaxonomy = null;
      csState.composeDraft = null;
      csState.composeLocked = false;
      csState.feedScope = null;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCityShares);
  } else {
    initCityShares();
  }
})(typeof window !== 'undefined' ? window : globalThis);
