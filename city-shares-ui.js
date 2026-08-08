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
    typeFilter: 'all',
    remotePosts: [],
    liked: false,
    comments: []
  };

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

  function getPosts(cityId, typeFilter) {
    var local =
      typeof global.getCityShares === 'function' ? global.getCityShares(cityId) : [];
    var merged = {};
    (local || []).forEach(function (p) {
      if (p && p.postId) merged[p.postId] = p;
    });
    (csState.remotePosts || []).forEach(function (p) {
      if (p && p.postId && p.cityId === cityId) merged[p.postId] = p;
    });
    var list = Object.keys(merged).map(function (k) {
      return merged[k];
    });
    if (typeFilter && typeFilter !== 'all') {
      list = list.filter(function (p) {
        return p.type === typeFilter;
      });
    }
    return list;
  }

  function refreshRemoteFeed(cityId) {
    var a = api();
    if (!a || !a.listPublishedPosts) {
      csState.remotePosts = [];
      return Promise.resolve([]);
    }
    return a
      .listPublishedPosts(cityId)
      .then(function (posts) {
        csState.remotePosts = posts || [];
        return csState.remotePosts;
      })
      .catch(function (e) {
        console.warn('[SOARVIBE] remote city shares feed failed', e);
        csState.remotePosts = [];
        return [];
      });
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
    var data = global.SOARVIBE_CITY_SHARES;
    if (data && data.cities && data.cities[cityId]) return data.cities[cityId];
    var cfg = global.SOARVIBE_CITY_SHARES_CONFIG;
    var hero = cfg && cfg.CITY_HERO && cfg.CITY_HERO[cityId];
    var label = CITY_LABELS[cityId];
    return {
      cityId: cityId,
      title: (label && label.name ? label.name : cityId) + '旅人分享',
      subtitle: '真正去過的人的照片與心得',
      heroImage: hero && hero.heroImage,
      heroPosition: hero && hero.heroPosition,
      heroAlt: hero && hero.heroAlt
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

    var socialHtml = socialEnabled
      ? '<div class="cs-social-bar">' +
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
        '<button type="button" class="cs-social-btn" id="csComposeBtn">＋ 分享投稿</button>' +
        (auth() &&
        auth().isSignedIn() &&
        auth().currentUser() &&
        post.author &&
        post.author.authorId === auth().currentUser().uid
          ? '<button type="button" class="cs-social-btn cs-social-danger" id="csDeletePostBtn">刪除我的貼文</button>'
          : '') +
        '</div>' +
        '<section class="cs-comments" id="csComments">' +
        '<h3 class="cs-comments-title">留言</h3>' +
        '<div id="csCommentList" class="cs-comment-list">' +
        (commentsHtml || '<p class="cs-comment-empty">還沒有留言，來當第一個吧。</p>') +
        '</div>' +
        '<form id="csCommentForm" class="cs-comment-form">' +
        '<textarea id="csCommentInput" class="cs-comment-input" maxlength="500" rows="3" placeholder="寫下你的補充或提問…"></textarea>' +
        '<button type="submit" class="cs-action-btn cs-action-primary">送出留言</button>' +
        '</form></section>'
      : '<div class="cs-social-bar">' +
        '<button type="button" class="cs-social-btn" id="csComposeBtn">＋ 分享投稿</button>' +
        '</div>' +
        '<p class="cs-comment-empty">此為官方精選，歡迎分享你自己的旅行心得。</p>';

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
        : '') +
      socialHtml +
      '</div>' +
      '<div class="cs-actions">' +
      '<button type="button" class="cs-action-btn cs-action-primary" id="csPlanAiBtn">用 AI 規劃含此景點</button>' +
      '<button type="button" class="cs-action-btn cs-action-secondary" id="csAddTripBtn">加入我的行程規劃</button>' +
      '</div></div>'
    );
  }

  function renderCompose() {
    return (
      '<div class="cs-page cs-compose-page">' +
      '<h2 class="cs-compose-title">分享這次旅行</h2>' +
      '<p class="cs-compose-hint">發文後所有 SoarVibe 使用者都能看到。圖片之後可再擴充上傳；此版先支援純文字心得。</p>' +
      '<form id="csComposeForm" class="cs-compose-form">' +
      '<label class="cs-compose-label">城市' +
      '<select id="csComposeCity" class="cs-compose-input">' +
      '<option value="tokyo">東京</option>' +
      '<option value="osaka">大阪</option>' +
      '<option value="kyoto">京都</option>' +
      '<option value="seoul">首爾</option>' +
      '<option value="bangkok">曼谷</option>' +
      '</select></label>' +
      '<label class="cs-compose-label">分類' +
      '<select id="csComposeType" class="cs-compose-input">' +
      Object.keys(TYPE_LABELS)
        .map(function (k) {
          return (
            '<option value="' +
            escapeHtml(k) +
            '">' +
            escapeHtml(TYPE_LABELS[k]) +
            '</option>'
          );
        })
        .join('') +
      '</select></label>' +
      '<label class="cs-compose-label">標題' +
      '<input id="csComposeTitle" class="cs-compose-input" maxlength="80" required placeholder="例如：惠比壽這碗柚子鹽值得排隊"></label>' +
      '<label class="cs-compose-label">心得' +
      '<textarea id="csComposeBody" class="cs-compose-input" maxlength="600" rows="6" required placeholder="至少 20 字，分享真實體驗…"></textarea></label>' +
      '<p id="csComposeMsg" class="cs-compose-msg hidden"></p>' +
      '<button type="submit" class="cs-action-btn cs-action-primary">發布</button>' +
      '<button type="button" class="cs-action-btn cs-action-secondary" id="csComposeCancel">取消</button>' +
      '</form></div>'
    );
  }

  function updateChrome() {
    var backBtn = document.getElementById('csBackBtn');
    if (!backBtn) return;
    if (csState.view === 'detail' || csState.view === 'compose') {
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

  function loadDetailExtras(postId) {
    var a = api();
    var post = findPost(postId);
    csState.comments = [];
    csState.liked = false;
    if (!a || !postId || !isFirestorePost(post)) return Promise.resolve();
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
    return Promise.all(tasks);
  }

  function renderCurrentView() {
    var viewport = document.getElementById('csViewport');
    if (!viewport || !csState.cityId) return;
    if (csState.view === 'compose') {
      viewport.innerHTML = renderCompose();
      var citySel = document.getElementById('csComposeCity');
      if (citySel && csState.cityId) citySel.value = csState.cityId;
    } else if (csState.view === 'detail' && csState.postId) {
      viewport.innerHTML = renderDetail(findPost(csState.postId));
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

    shell.classList.remove('hidden');
    shell.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    viewport.scrollTop = 0;
    setHash(cityId, postId || null);
    updateChrome();
    viewport.innerHTML = '<div class="cs-page"><p class="cs-empty">載入分享中…</p></div>';

    refreshRemoteFeed(cityId).then(function () {
      if (csState.view === 'detail' && csState.postId) {
        return loadDetailExtras(csState.postId).then(function () {
          renderCurrentView();
        });
      }
      renderCurrentView();
    });
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
    if (csState.view === 'compose' && csState.cityId) {
      csState.view = 'feed';
      csState.postId = null;
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

  function openCompose() {
    var a = auth();
    if (!a || !a.isSignedIn()) {
      if (a && a.requireAuth) a.requireAuth('分享投稿');
      else if (global.openSoarvibeAuthModal) {
        global.openSoarvibeAuthModal({ reason: '請先登入後才能分享投稿' });
      }
      return;
    }
    csState.view = 'compose';
    csState.postId = null;
    renderCurrentView();
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
    if (!au || !au.isSignedIn()) {
      if (au && au.requireAuth) au.requireAuth('按讚');
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
        renderCurrentView();
      })
      .catch(function (err) {
        if (err && err.message === 'AUTH_REQUIRED') return;
        alert((err && err.message) || '按讚失敗');
      });
  }

  function handleCommentSubmit() {
    var a = api();
    var au = auth();
    if (!au || !au.isSignedIn()) {
      if (au && au.requireAuth) au.requireAuth('留言');
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
    if (!confirm('確定刪除這篇貼文？留言與按讚也會一併無法瀏覽。')) return;
    var cityId = csState.cityId;
    a.deletePost(csState.postId)
      .then(function () {
        return refreshRemoteFeed(cityId);
      })
      .then(function () {
        csState.view = 'feed';
        csState.postId = null;
        setHash(cityId, null);
        renderCurrentView();
      })
      .catch(function (err) {
        alert((err && err.message) || '刪除失敗');
      });
  }

  function handleComposeSubmit() {
    var a = api();
    var titleEl = document.getElementById('csComposeTitle');
    var bodyEl = document.getElementById('csComposeBody');
    var cityEl = document.getElementById('csComposeCity');
    var typeEl = document.getElementById('csComposeType');
    var msg = document.getElementById('csComposeMsg');
    if (!a) return;
    if (msg) {
      msg.textContent = '發布中…';
      msg.classList.remove('hidden');
    }
    a.createPost({
      title: titleEl ? titleEl.value : '',
      body: bodyEl ? bodyEl.value : '',
      cityId: cityEl ? cityEl.value : csState.cityId,
      type: typeEl ? typeEl.value : 'sightseeing'
    })
      .then(function (post) {
        return refreshRemoteFeed(post.cityId || csState.cityId).then(function () {
          csState.cityId = post.cityId || csState.cityId;
          openCityShareDetail(post.postId);
        });
      })
      .catch(function (err) {
        if (msg) {
          msg.textContent = (err && err.message) || '發布失敗';
          msg.classList.remove('hidden');
        }
      });
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
      if (e.target.id === 'csComposeOpenBtn' || e.target.closest('#csComposeOpenBtn') || e.target.id === 'csComposeBtn') {
        e.preventDefault();
        openCompose();
        return;
      }
      if (e.target.id === 'csComposeCancel') {
        e.preventDefault();
        goBackCityShares();
        return;
      }
      if (e.target.id === 'csLikeBtn' || e.target.closest('#csLikeBtn')) {
        e.preventDefault();
        handleLike();
        return;
      }
      if (e.target.id === 'csCommentFocusBtn') {
        e.preventDefault();
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
      if (e.target.id === 'csAddTripBtn' || e.target.closest('#csAddTripBtn')) {
        var post = findPost(csState.postId);
        applyShareToTrip(post);
        return;
      }
      if (e.target.id === 'csPlanAiBtn' || e.target.closest('#csPlanAiBtn')) {
        var postAi = findPost(csState.postId);
        planShareWithAI(postAi);
      }
    });

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
