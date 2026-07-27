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
    hokkaido: { name: '北海道', dest: '北海道' },
    bangkok: { name: '曼谷', dest: '曼谷' },
    vietnam: { name: '越南', dest: '越南' },
    london: { name: '倫敦', dest: '倫敦' },
    paris: { name: '巴黎', dest: '巴黎' }
  };

  var csState = {
    view: 'closed',
    cityId: null,
    postId: null,
    typeFilter: 'all'
  };

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getCityMeta(cityId) {
    var data = global.SOARVIBE_CITY_SHARES;
    if (data && data.cities && data.cities[cityId]) return data.cities[cityId];
    var label = CITY_LABELS[cityId];
    return {
      cityId: cityId,
      title: (label && label.name ? label.name : cityId) + '旅人分享',
      subtitle: '真正去過的人的照片與心得'
    };
  }

  function getPosts(cityId, typeFilter) {
    if (typeof global.getCityShares !== 'function') return [];
    var posts = global.getCityShares(cityId) || [];
    if (typeFilter && typeFilter !== 'all') {
      posts = posts.filter(function (p) {
        return p.type === typeFilter;
      });
    }
    return posts;
  }

  function getCoverMedia(post) {
    if (!post || !post.media || !post.media.length) return null;
    var sorted = post.media.slice().sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
    return sorted[0];
  }

  function renderMediaBlock(media, altFallback) {
    if (media && media.src) {
      return (
        '<img src="' +
        escapeHtml(media.src) +
        '" alt="' +
        escapeHtml(media.alt || altFallback || '') +
        '" loading="lazy" decoding="async">'
      );
    }
    return '<div class="cs-card-placeholder"><span aria-hidden="true">📷</span><span>照片準備中</span></div>';
  }

  function renderFeed(cityId) {
    var meta = getCityMeta(cityId);
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
          var cover = getCoverMedia(post);
          var typeLabel = TYPE_LABELS[post.type] || post.type;
          return (
            '<button type="button" class="cs-card" data-cs-post="' +
            escapeHtml(post.postId) +
            '">' +
            '<div class="cs-card-media">' +
            renderMediaBlock(cover, post.title) +
            '<span class="cs-card-type">' +
            escapeHtml(typeLabel) +
            '</span></div>' +
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
      '<header class="cs-hero">' +
      '<p class="cs-kicker">SOARVIBE CITY SHARES</p>' +
      '<h1 class="cs-hero-title">' +
      escapeHtml(meta.title) +
      '</h1>' +
      '<p class="cs-hero-sub">' +
      escapeHtml(meta.subtitle || '') +
      '</p></header>' +
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
    var metaChips = [];
    if (vm.stayDuration) metaChips.push('停留 ' + vm.stayDuration);
    if (vm.budget) metaChips.push('預算 ' + vm.budget);
    if (vm.bestTime) metaChips.push('最佳時段 ' + vm.bestTime);
    if (vm.recommendLevel) metaChips.push('推薦 ' + vm.recommendLevel + '/5');

    var tagsHtml = (post.tags || [])
      .map(function (tag) {
        return '<span class="cs-tag">#' + escapeHtml(tag) + '</span>';
      })
      .join('');

    return (
      '<div class="cs-page">' +
      '<div class="cs-detail-hero">' +
      renderMediaBlock(cover, post.title) +
      '</div>' +
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
        : post.mediaPlaceholder
          ? '<p class="cs-attribution">照片準備中</p>'
          : '') +
      '</div>' +
      '<div class="cs-actions">' +
      '<button type="button" class="cs-action-btn cs-action-primary" id="csPlanAiBtn">用 AI 規劃含此景點</button>' +
      '<button type="button" class="cs-action-btn cs-action-secondary" id="csAddTripBtn">加入我的行程規劃</button>' +
      '</div></div>'
    );
  }

  function updateChrome() {
    var backBtn = document.getElementById('csBackBtn');
    if (!backBtn) return;
    if (csState.view === 'detail') {
      backBtn.classList.remove('is-hidden');
      backBtn.textContent = '← 返回';
    } else {
      backBtn.classList.add('is-hidden');
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

  function renderCurrentView() {
    var viewport = document.getElementById('csViewport');
    if (!viewport || !csState.cityId) return;
    if (csState.view === 'detail' && csState.postId) {
      var post =
        typeof global.getCityShareById === 'function'
          ? global.getCityShareById(csState.postId)
          : null;
      viewport.innerHTML = renderDetail(post);
    } else {
      viewport.innerHTML = renderFeed(csState.cityId);
    }
    updateChrome();
  }

  function openCityShares(cityId, postId) {
    var shell = document.getElementById('cityShares');
    var viewport = document.getElementById('csViewport');
    if (!shell || !viewport) return;

    csState.cityId = cityId;
    csState.typeFilter = csState.typeFilter || 'all';
    if (postId) {
      csState.view = 'detail';
      csState.postId = postId;
    } else {
      csState.view = 'feed';
      csState.postId = null;
    }

    renderCurrentView();
    shell.classList.remove('hidden');
    shell.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    viewport.scrollTop = 0;
    setHash(cityId, postId || null);
  }

  function closeCityShares() {
    var shell = document.getElementById('cityShares');
    if (!shell) return;
    shell.classList.add('hidden');
    shell.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    csState.view = 'closed';
    csState.cityId = null;
    csState.postId = null;
    csState.typeFilter = 'all';
    clearHashIfShares();
  }

  function goBackCityShares() {
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
    renderCurrentView();
    setHash(csState.cityId, postId);
    var viewport = document.getElementById('csViewport');
    if (viewport) viewport.scrollTop = 0;
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

  function applyShareToTrip(post) {
    if (!post) return;
    var cityLabel = (CITY_LABELS[post.cityId] && CITY_LABELS[post.cityId].dest) || post.cityId;
    closeCityShares();
    focusPlannerWithDestination(cityLabel);
  }

  function planShareWithAI(post) {
    if (!post) return;
    var cityLabel = (CITY_LABELS[post.cityId] && CITY_LABELS[post.cityId].dest) || post.cityId;
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
        e.preventDefault();
        openCityShareDetail(cardBtn.getAttribute('data-cs-post'));
        return;
      }
      if (e.target.id === 'csAddTripBtn' || e.target.closest('#csAddTripBtn')) {
        var post =
          csState.postId && typeof global.getCityShareById === 'function'
            ? global.getCityShareById(csState.postId)
            : null;
        applyShareToTrip(post);
        return;
      }
      if (e.target.id === 'csPlanAiBtn' || e.target.closest('#csPlanAiBtn')) {
        var postAi =
          csState.postId && typeof global.getCityShareById === 'function'
            ? global.getCityShareById(csState.postId)
            : null;
        planShareWithAI(postAi);
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
            div.className = img.closest('.cs-detail-hero') ? 'cs-card-placeholder' : 'cs-card-placeholder';
            div.innerHTML = '<span aria-hidden="true">📷</span><span>照片準備中</span>';
            return div;
          })()
        );
      },
      true
    );

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || shell.classList.contains('hidden')) return;
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
  }

  global.openCityShares = openCityShares;
  global.closeCityShares = closeCityShares;
  global.openCityDestination = openCityDestination;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCityShares);
  } else {
    initCityShares();
  }
})(typeof window !== 'undefined' ? window : globalThis);
