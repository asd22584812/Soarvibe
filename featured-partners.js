/**
 * SoarVibe Featured Partners — commercial curated showcase.
 * Completely independent from Gemini itinerary / Planner / Style / TimeQA.
 *
 * Production list = Tokyo commercial DEMO banners for partner pitches.
 * Swap `url` / `deepLink` when real partners provide links.
 */
(function (global) {
  'use strict';

  /**
   * Tokyo tourism commercial demo inventory.
   * Not real partnerships — labeled DEMO for sales / prototype demos.
   */
  var FEATURED_PARTNERS_PRODUCTION = [
    {
      id: 'tokyo-experiences-demo',
      brandName: 'TripNest 東京體驗',
      name: 'TripNest 東京體驗',
      title: '東京熱門體驗／景點票券',
      headline: '東京熱門體驗／景點票券',
      subheadline: '晴空塔・teamLab・和服・一日遊，出發前先挑好想玩的',
      description: '晴空塔・teamLab・和服・一日遊，出發前先挑好想玩的',
      ctaLabel: '查看東京體驗 →',
      image: './assets/featured/tokyo-experiences-demo.svg',
      alt: '東京熱門體驗與景點票券合作版位示意 Banner',
      url: 'https://www.kkday.com/zh-tw/city/tokyo',
      deepLink: '',
      universalLink: '',
      active: true,
      sortOrder: 1,
      order: 1,
      isDemo: true,
      isTest: false,
      theme: 'tokyo-neon',
      sponsorLabel: 'DEMO・合作版位示意',
      sponsored: false,
      affiliate: false
    },
    {
      id: 'tokyo-esim-demo',
      brandName: 'SkyLink eSIM',
      name: 'SkyLink eSIM',
      title: '日本旅遊 eSIM',
      headline: '日本旅遊 eSIM',
      subheadline: '出發前裝好方案，落地東京就能開地圖與翻譯',
      description: '出發前裝好方案，落地東京就能開地圖與翻譯',
      ctaLabel: '查看 eSIM 方案 →',
      image: './assets/featured/tokyo-esim-demo.svg',
      alt: '日本旅遊 eSIM 合作版位示意 Banner',
      url: 'https://waysim.net/search?q=' + encodeURIComponent('日本 eSIM'),
      deepLink: '',
      universalLink: '',
      active: true,
      sortOrder: 2,
      order: 2,
      isDemo: true,
      isTest: false,
      theme: 'esim-teal',
      sponsorLabel: 'DEMO・合作版位示意',
      sponsored: false,
      affiliate: false
    },
    {
      id: 'tokyo-airport-demo',
      brandName: 'AirportGo 機場交通',
      name: 'AirportGo 機場交通',
      title: '羽田／成田機場交通',
      headline: '羽田／成田機場交通',
      subheadline: '快線、巴士、接送一次比較，進出東京更順',
      description: '快線、巴士、接送一次比較，進出東京更順',
      ctaLabel: '查看機場交通 →',
      image: './assets/featured/tokyo-airport-demo.svg',
      alt: '羽田與成田機場交通合作版位示意 Banner',
      url: 'https://www.kkday.com/zh-tw/product/list?city=tokyo&keyword=' + encodeURIComponent('機場'),
      deepLink: '',
      universalLink: '',
      active: true,
      sortOrder: 3,
      order: 3,
      isDemo: true,
      isTest: false,
      theme: 'airport-blue',
      sponsorLabel: 'DEMO・合作版位示意',
      sponsored: false,
      affiliate: false
    }
  ];

  /** Extra unit-test fixtures (inactive / edge). Enable: ?featured_demo=1 */
  var FEATURED_PARTNERS_FIXTURES = FEATURED_PARTNERS_PRODUCTION.concat([
    {
      id: 'fixture-inactive',
      name: '已下架合作 D',
      brandName: '已下架合作 D',
      headline: '已下架',
      subheadline: '不應出現在列表。',
      description: '不應出現在列表。',
      ctaLabel: '即將開放',
      image: './assets/featured/tokyo-experiences-demo.svg',
      url: 'https://example.com/inactive',
      deepLink: '',
      universalLink: '',
      active: false,
      sortOrder: 0,
      isDemo: true,
      isTest: true,
      sponsorLabel: 'DEMO・合作版位示意',
      sponsored: true,
      affiliate: false
    },
    {
      id: 'fixture-no-desc',
      name: '無介紹品牌 E',
      brandName: '無介紹品牌 E',
      headline: '無介紹品牌 E',
      subheadline: '',
      description: '',
      ctaLabel: '了解更多 →',
      image: './assets/featured/tokyo-esim-demo.svg',
      url: 'https://example.com/partner-e',
      deepLink: '',
      universalLink: '',
      active: true,
      sortOrder: 99,
      isDemo: true,
      isTest: true,
      sponsorLabel: 'DEMO・合作版位示意',
      sponsored: false,
      affiliate: false
    }
  ]);

  var scrollLockY = 0;
  var isOpen = false;

  function fixturesEnabled() {
    try {
      if (global.__FEATURED_USE_FIXTURES__ === true) return true;
      if (typeof location !== 'undefined' && /(?:\?|&)featured_demo=1(?:&|$)/.test(String(location.search || ''))) {
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function dataApi() {
    return global.SOARVIBE_FEATURED_DATA || null;
  }

  function getHardcodedPartners() {
    if (Array.isArray(global.__FEATURED_PARTNERS_OVERRIDE__)) {
      return global.__FEATURED_PARTNERS_OVERRIDE__.slice();
    }
    if (fixturesEnabled()) return FEATURED_PARTNERS_FIXTURES.slice();
    return FEATURED_PARTNERS_PRODUCTION.slice();
  }

  function getAllPartners() {
    var data = dataApi();
    if (data && typeof data.hasFirestoreInventory === 'function' && data.hasFirestoreInventory()) {
      return data.getCachedActivePartners();
    }
    return getHardcodedPartners();
  }

  function getActivePartners() {
    var data = dataApi();
    if (data && typeof data.hasFirestoreInventory === 'function' && data.hasFirestoreInventory()) {
      return data.getCachedActivePartners();
    }
    if (data && typeof data.getCacheMeta === 'function') {
      var meta = data.getCacheMeta();
      if (meta && meta.loaded &&
          (meta.source === 'firestore' || meta.source === 'firestore-empty')) {
        return data.getCachedActivePartners();
      }
    }
    return getHardcodedPartners()
      .filter(function (p) {
        return p && p.active === true;
      })
      .sort(function (a, b) {
        var ao = Number(a.sortOrder != null ? a.sortOrder : a.order) || 0;
        var bo = Number(b.sortOrder != null ? b.sortOrder : b.order) || 0;
        return ao - bo;
      });
  }

  function partnersFingerprint(list) {
    return (list || [])
      .map(function (p) {
        return [
          p.id || '',
          p.sortOrder != null ? p.sortOrder : p.order,
          p.title || p.headline || '',
          p.bannerImageUrl || p.image || '',
          p.affiliateUrl || p.url || '',
          p.active === true ? '1' : '0'
        ].join('|');
      })
      .join(';');
  }

  function hasSessionFeaturedCache() {
    var data = dataApi();
    if (!data || typeof data.getCacheMeta !== 'function') return false;
    var meta = data.getCacheMeta();
    return !!(meta && meta.loaded &&
      (meta.source === 'firestore' || meta.source === 'firestore-empty'));
  }

  function preloadFirstBannerImage(partners) {
    if (!partners || !partners.length) return;
    var url = String((partners[0] && (partners[0].bannerImageUrl || partners[0].image)) || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) return;
    try {
      if (typeof document === 'undefined' || !document.head) return;
      var id = 'featured-preload-first';
      var existing = document.getElementById(id);
      if (existing && existing.getAttribute('href') === url) return;
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      var link = document.createElement('link');
      link.id = id;
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    } catch (e) { /* ignore */ }
  }

  function isSafeHttpUrl(url) {
    var raw = String(url == null ? '' : url).trim();
    if (!raw) return false;
    try {
      var u = new URL(raw, typeof location !== 'undefined' ? location.href : 'https://soarvibe.local/');
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function isSafeOpenUrl(url) {
    var raw = String(url == null ? '' : url).trim();
    if (!raw) return false;
    if (isSafeHttpUrl(raw)) return true;
    try {
      var u = new URL(raw);
      var proto = String(u.protocol || '').toLowerCase();
      return (
        proto === 'http:' ||
        proto === 'https:' ||
        proto === 'soarvibe:' ||
        /\.app$/i.test(proto) ||
        /link$/i.test(proto.replace(':', ''))
      );
    } catch (e2) {
      return false;
    }
  }

  function escapeText(s) {
    return String(s == null ? '' : s);
  }

  function partnerDisplayName(partner) {
    return escapeText(partner.brandName || partner.partner || partner.name || partner.title || '合作夥伴');
  }

  function partnerHeadline(partner) {
    return escapeText(partner.headline || partner.title || partner.name || '');
  }

  function partnerSubheadline(partner) {
    return escapeText(partner.subheadline || partner.description || '');
  }

  function partnerCtaLabel(partner, hasUrl) {
    if (partner.ctaLabel) return escapeText(partner.ctaLabel);
    return hasUrl ? '查看詳情 →' : '即將開放';
  }

  function partnerBadgeText(partner) {
    if (partner.sponsorLabel) return escapeText(partner.sponsorLabel);
    if (partner.isDemo || partner.isTest) return 'DEMO・合作版位示意';
    if (partner.sponsored) return '合作推薦';
    if (partner.affiliate) return '合作夥伴';
    return '';
  }

  function buildLimitedContentHint() {
    var wrap = document.createElement('div');
    wrap.className = 'featured-limited';
    wrap.setAttribute('role', 'status');
    var title = document.createElement('p');
    title.className = 'featured-limited-title';
    title.textContent = '更多精選即將登場';
    var copy = document.createElement('p');
    copy.className = 'featured-limited-copy';
    copy.textContent = '目前先為你精選這一檔合作靈感，之後會陸續補上更多推薦。';
    wrap.appendChild(title);
    wrap.appendChild(copy);
    return wrap;
  }

  /**
   * Firestore formal banners: affiliateUrl only (no generic site fallback).
   * Hardcoded migration demos may still use url / deepLink.
   */
  function resolvePartnerOpenUrl(partner) {
    if (partner && partner.source === 'firestore') {
      var aff = String(partner.affiliateUrl || '').trim();
      if (aff && isSafeHttpUrl(aff) && /^https:/i.test(aff)) {
        return { primary: aff, fallback: '' };
      }
      return { primary: '', fallback: '' };
    }
    var deep = String((partner && (partner.deepLink || partner.universalLink)) || '').trim();
    var web = String((partner && (partner.affiliateUrl || partner.url)) || '').trim();
    if (deep && isSafeOpenUrl(deep)) return { primary: deep, fallback: isSafeHttpUrl(web) ? web : '' };
    if (isSafeHttpUrl(web)) return { primary: web, fallback: '' };
    return { primary: '', fallback: '' };
  }

  function openPartnerLink(partner, ev) {
    var resolved = resolvePartnerOpenUrl(partner);
    if (!resolved.primary) {
      if (ev) ev.preventDefault();
      return false;
    }
    var isHttp = isSafeHttpUrl(resolved.primary);
    var hasAppFallback = !isHttp && resolved.fallback;
    if (hasAppFallback) {
      if (ev) ev.preventDefault();
      var fellBack = false;
      var timer = setTimeout(function () {
        fellBack = true;
        try {
          global.open(resolved.fallback, '_blank', 'noopener,noreferrer');
        } catch (eOpen) { /* silent */ }
      }, 900);
      function cancelFallback() {
        if (fellBack) return;
        clearTimeout(timer);
        global.removeEventListener('pagehide', cancelFallback);
        global.removeEventListener('blur', cancelFallback);
      }
      global.addEventListener('pagehide', cancelFallback);
      global.addEventListener('blur', cancelFallback);
      try {
        global.location.href = resolved.primary;
      } catch (eNav) {
        cancelFallback();
        global.open(resolved.fallback, '_blank', 'noopener,noreferrer');
      }
      return false;
    }
    if (ev && ev.currentTarget && ev.currentTarget.tagName === 'A') return true;
    if (ev) ev.preventDefault();
    try {
      global.open(resolved.primary, '_blank', 'noopener,noreferrer');
    } catch (e2) { /* silent */ }
    return false;
  }

  function lockBodyScroll() {
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add('featured-modal-open');
    document.body.classList.add('featured-modal-open');
    // Overflow-only lock — avoid position:fixed / background swaps that
    // flash black and briefly rescale the home wallpaper on iOS PWA.
    try {
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.overflow = 'hidden';
      }
      if (document.body && document.body.style) {
        document.body.style.overflow = 'hidden';
      }
    } catch (eLock) { /* ignore */ }
  }

  function unlockBodyScroll() {
    document.documentElement.classList.remove('featured-modal-open');
    document.body.classList.remove('featured-modal-open');
    try {
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.overflow = '';
      }
      if (document.body && document.body.style) {
        document.body.style.overflow = '';
      }
    } catch (eUnlock) { /* ignore */ }
    if (scrollLockY) {
      try { window.scrollTo(0, scrollLockY); } catch (e) { /* ignore */ }
    }
  }

  function buildEmptyState() {
    var wrap = document.createElement('div');
    wrap.className = 'featured-empty';
    wrap.setAttribute('role', 'status');
    var title = document.createElement('p');
    title.className = 'featured-empty-title';
    title.textContent = '精選內容準備中';
    var copy = document.createElement('p');
    copy.className = 'featured-empty-copy';
    copy.textContent = '旅途中值得看的合作品牌，即將在這裡登場。';
    wrap.appendChild(title);
    wrap.appendChild(copy);
    return wrap;
  }

  function buildPartnerCard(partner, opts) {
    opts = opts || {};
    var isPriority = opts.priority === true;
    var resolved = resolvePartnerOpenUrl(partner);
    var hasUrl = !!resolved.primary;
    var card = document.createElement(hasUrl && isSafeHttpUrl(resolved.primary) ? 'a' : 'button');
    card.className = 'featured-partner-card';
    if (partner.theme) card.className += ' theme-' + String(partner.theme).replace(/[^a-z0-9-]/gi, '');
    if (partner.isDemo || partner.isTest) card.className += ' is-demo';
    if (hasUrl && isSafeHttpUrl(resolved.primary)) {
      card.href = resolved.primary;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    } else {
      card.type = 'button';
      if (!hasUrl) card.setAttribute('aria-disabled', 'true');
    }
    card.setAttribute('data-partner-id', escapeText(partner.id || ''));
    card.setAttribute(
      'aria-label',
      partnerHeadline(partner) + '｜' + partnerCtaLabel(partner, hasUrl)
    );
    card.addEventListener('click', function (ev) {
      openPartnerLink(partner, ev);
    });

    var media = document.createElement('div');
    media.className = 'featured-partner-media';

    var img = document.createElement('img');
    img.className = 'featured-partner-image';
    img.alt = '';
    // First banner: eager + high priority; rest lazy (don't block paint on all images).
    img.loading = isPriority ? 'eager' : 'lazy';
    img.decoding = isPriority ? 'sync' : 'async';
    try {
      if (isPriority) img.setAttribute('fetchpriority', 'high');
      else img.setAttribute('fetchpriority', 'low');
    } catch (eFp) { /* ignore */ }
    var imageSrc = partner.bannerImageUrl || partner.image;
    if (imageSrc) img.src = String(imageSrc);
    img.addEventListener('error', function onImgErr() {
      img.removeEventListener('error', onImgErr);
      if (img.parentNode) img.parentNode.removeChild(img);
      media.classList.add('is-fallback');
      var fb = document.createElement('div');
      fb.className = 'featured-partner-fallback-rich';
      var fbBrand = document.createElement('p');
      fbBrand.className = 'featured-partner-brand';
      fbBrand.textContent = partnerDisplayName(partner);
      var fbH = document.createElement('h3');
      fbH.className = 'featured-partner-headline';
      fbH.textContent = partnerHeadline(partner) || partnerDisplayName(partner);
      var fbSub = document.createElement('p');
      fbSub.className = 'featured-partner-sub';
      fbSub.textContent = partnerSubheadline(partner);
      fb.appendChild(fbBrand);
      fb.appendChild(fbH);
      if (partnerSubheadline(partner)) fb.appendChild(fbSub);
      media.appendChild(fb);
    });
    media.appendChild(img);

    var nameText = partnerDisplayName(partner);
    var headlineText = partnerHeadline(partner);
    var sr = document.createElement('span');
    sr.className = 'featured-sr-only';
    sr.textContent =
      nameText + '。' +
      headlineText + '。' +
      partnerSubheadline(partner) + '。' +
      partnerCtaLabel(partner, hasUrl);
    media.appendChild(sr);
    card.appendChild(media);

    var body = document.createElement('div');
    body.className = 'featured-partner-body';
    var nameEl = document.createElement('p');
    nameEl.className = 'featured-partner-name';
    nameEl.textContent = nameText;
    body.appendChild(nameEl);
    if (headlineText && headlineText !== nameText) {
      var titleEl = document.createElement('p');
      titleEl.className = 'featured-partner-desc';
      titleEl.textContent = headlineText;
      body.appendChild(titleEl);
    }
    var cta = document.createElement('span');
    cta.className = 'featured-partner-cta';
    cta.textContent = hasUrl ? '查看詳情 →' : '即將開放';
    body.appendChild(cta);
    card.appendChild(body);

    return card;
  }

  function renderLoadingSkeleton(viewport) {
    while (viewport.firstChild) viewport.removeChild(viewport.firstChild);
    var list = document.createElement('div');
    list.className = 'featured-partner-list';
    list.setAttribute('aria-busy', 'true');
    list.setAttribute('aria-label', '精選載入中');
    for (var i = 0; i < 2; i++) {
      var card = document.createElement('div');
      card.className = 'featured-skeleton-card';
      card.setAttribute('aria-hidden', 'true');
      var media = document.createElement('div');
      media.className = 'featured-skeleton-media';
      var body = document.createElement('div');
      body.className = 'featured-skeleton-body';
      var l1 = document.createElement('div');
      l1.className = 'featured-skeleton-line w55';
      var l2 = document.createElement('div');
      l2.className = 'featured-skeleton-line w80';
      var l3 = document.createElement('div');
      l3.className = 'featured-skeleton-line w35';
      body.appendChild(l1);
      body.appendChild(l2);
      body.appendChild(l3);
      card.appendChild(media);
      card.appendChild(body);
      list.appendChild(card);
    }
    viewport.appendChild(list);
  }

  function renderList(viewport) {
    while (viewport.firstChild) viewport.removeChild(viewport.firstChild);

    var partners = getActivePartners();
    preloadFirstBannerImage(partners);
    if (!partners.length) {
      viewport.appendChild(buildEmptyState());
      return;
    }

    var hasDemo = partners.some(function (p) { return p && (p.isDemo || p.isTest); });
    if (hasDemo) {
      var notice = document.createElement('p');
      notice.className = 'featured-test-notice';
      notice.setAttribute('role', 'note');
      notice.textContent = '以下為 DEMO・合作版位示意，並非已正式簽約之官方合作。';
      viewport.appendChild(notice);
    }

    var list = document.createElement('div');
    list.className = 'featured-partner-list';
    list.setAttribute('role', 'list');
    partners.forEach(function (p, idx) {
      var item = document.createElement('div');
      item.className = 'featured-partner-item';
      item.setAttribute('role', 'listitem');
      item.appendChild(buildPartnerCard(p, { priority: idx === 0 }));
      list.appendChild(item);
    });
    viewport.appendChild(list);

    if (partners.length === 1) {
      viewport.appendChild(buildLimitedContentHint());
    }
  }

  function refreshOpenList(forceNetwork) {
    var content = document.getElementById('featuredContent') ||
      document.getElementById('featuredViewport');
    if (!content || !isOpen) return Promise.resolve();
    var data = dataApi();
    if (!data || typeof data.loadActivePartners !== 'function' || fixturesEnabled()) {
      renderList(content);
      return Promise.resolve();
    }
    var beforeFp = partnersFingerprint(getActivePartners());
    return data
      .loadActivePartners(forceNetwork !== false)
      .then(function () {
        if (!isOpen) return;
        var afterFp = partnersFingerprint(getActivePartners());
        if (beforeFp !== afterFp || forceNetwork) {
          renderList(content);
        }
      })
      .catch(function () {
        if (isOpen) renderList(content);
      });
  }

  function openFeaturedModal() {
    var shell = document.getElementById('soarvibeFeatured');
    var viewport = document.getElementById('featuredViewport');
    var content = document.getElementById('featuredContent') || viewport;
    if (!shell || !content) {
      console.warn('[FEATURED] modal shell missing');
      return;
    }
    // A: shell/header already in DOM — reveal immediately.
    shell.classList.remove('hidden');
    shell.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    isOpen = true;
    if (viewport) viewport.scrollTop = 0;

    var cacheReady = hasSessionFeaturedCache();
    if (cacheReady) {
      // C: paint session cache instantly
      renderList(content);
    } else {
      // B: skeleton while first Firestore fetch runs (avoid blank / wrong demos flash)
      renderLoadingSkeleton(content);
    }

    var closeBtn = document.getElementById('featuredCloseBtn');
    if (closeBtn && typeof closeBtn.focus === 'function') {
      try { closeBtn.focus(); } catch (e) { /* ignore */ }
    }

    var data = dataApi();
    if (data && typeof data.loadActivePartners === 'function' && !fixturesEnabled()) {
      var beforeFp = partnersFingerprint(getActivePartners());
      // Soft path: cache already painted; still background-refresh. First open: force fetch.
      data
        .loadActivePartners(true)
        .then(function () {
          if (!isOpen) return;
          var afterFp = partnersFingerprint(getActivePartners());
          // G: only re-render when data changed (or first load from skeleton)
          if (!cacheReady || beforeFp !== afterFp) {
            renderList(content);
          } else {
            preloadFirstBannerImage(getActivePartners());
          }
          if (global.SOARVIBE_FEATURED_ADMIN &&
              typeof global.SOARVIBE_FEATURED_ADMIN.refreshChrome === 'function') {
            global.SOARVIBE_FEATURED_ADMIN.refreshChrome();
          }
        })
        .catch(function () {
          if (!isOpen) return;
          // Network fail: keep cache if any; else fall back to hardcoded demos
          renderList(content);
        });
    } else if (global.SOARVIBE_FEATURED_ADMIN &&
        typeof global.SOARVIBE_FEATURED_ADMIN.refreshChrome === 'function') {
      if (!cacheReady) renderList(content);
      global.SOARVIBE_FEATURED_ADMIN.refreshChrome();
    } else if (!cacheReady) {
      renderList(content);
    }
  }

  function closeFeaturedModal() {
    var shell = document.getElementById('soarvibeFeatured');
    if (!shell) return;
    var nav = document.getElementById('nav-featured');
    if (nav) nav.classList.remove('nav-active');
    // Unlock while overlay still covers home — then hide on next frame
    // so body #000 never flashes and app-shell bg does not reflow/zoom.
    if (isOpen) unlockBodyScroll();
    isOpen = false;
    function hideShell() {
      shell.classList.add('hidden');
      shell.setAttribute('aria-hidden', 'true');
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(hideShell);
    } else {
      hideShell();
    }
  }

  function bindOnce() {
    var closeBtn = document.getElementById('featuredCloseBtn');
    if (closeBtn && !closeBtn.__featuredBound) {
      closeBtn.__featuredBound = true;
      closeBtn.addEventListener('click', function () {
        closeFeaturedModal();
      });
    }
    var shell = document.getElementById('soarvibeFeatured');
    if (shell && !shell.__featuredEscBound) {
      shell.__featuredEscBound = true;
      document.addEventListener('keydown', function (ev) {
        if (!isOpen) return;
        if (ev.key === 'Escape') closeFeaturedModal();
      });
    }
  }

  function init() {
    bindOnce();
    // Warm session cache so first Featured open paints without skeleton when possible.
    var data = dataApi();
    if (data && typeof data.loadActivePartners === 'function' && !fixturesEnabled()) {
      data.loadActivePartners(false).then(function (items) {
        preloadFirstBannerImage(items || getActivePartners());
      }).catch(function () { /* silent */ });
    }
  }

  var api = {
    version: '2.2-featured-fast-open',
    FEATURED_PARTNERS_PRODUCTION: FEATURED_PARTNERS_PRODUCTION,
    FEATURED_PARTNERS_FIXTURES: FEATURED_PARTNERS_FIXTURES,
    getAllPartners: getAllPartners,
    getActivePartners: getActivePartners,
    getHardcodedPartners: getHardcodedPartners,
    isSafeHttpUrl: isSafeHttpUrl,
    isSafeOpenUrl: isSafeOpenUrl,
    resolvePartnerOpenUrl: resolvePartnerOpenUrl,
    openPartnerLink: openPartnerLink,
    openFeaturedModal: openFeaturedModal,
    closeFeaturedModal: closeFeaturedModal,
    refreshOpenList: refreshOpenList,
    open: openFeaturedModal,
    close: closeFeaturedModal,
    init: init,
    forbidsItineraryInjection: true,
    usesFirestoreWhenAvailable: true
  };

  global.SOARVIBE_FEATURED = api;
  global.openFeaturedModal = openFeaturedModal;
  global.closeFeaturedModal = closeFeaturedModal;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
