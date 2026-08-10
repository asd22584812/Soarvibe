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
    /** @deprecated use feedScope.entryId — kept for hash / auth pending compat */
    cityId: null,
    postId: null,
    typeFilter: 'all',
    remotePosts: [],
    liked: false,
    saved: false,
    comments: [],
    composeMedia: [],
    feedScope: null,
    composeTaxonomy: null,
    composeLocked: false,
    composeNeedsCity: false,
    composeNeedsCountry: false
  };

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
    if (loc && loc.normalizePostTaxonomy) loc.normalizePostTaxonomy(post);
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

  function refreshRemoteFeed(cityId) {
    var a = api();
    var scope = csState.feedScope || buildScopeFromEntryId(cityId || csState.cityId);
    if (!a) {
      csState.remotePosts = [];
      return Promise.resolve([]);
    }
    var loader =
      a.listFeedForScope
        ? a.listFeedForScope(scope)
        : a.listPublishedPosts
          ? a.listPublishedPosts(scope.cityId || scope.entryId || cityId)
          : Promise.resolve([]);
    return loader
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
    var saveCount = stats.saveCount != null ? stats.saveCount : post.saveCount || 0;
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
      '<button type="button" class="cs-social-btn' +
      (csState.saved ? ' is-on' : '') +
      '" id="csSaveBtn" aria-pressed="' +
      (csState.saved ? 'true' : 'false') +
      '">☆ 收藏 <span id="csSaveCount">' +
      escapeHtml(String(saveCount)) +
      '</span></button>' +
      '<button type="button" class="cs-social-btn" id="csCommentFocusBtn">💬 留言 <span>' +
      escapeHtml(String(commentCount)) +
      '</span></button>' +
      '<button type="button" class="cs-social-btn" id="csComposeBtn">＋ 分享投稿</button>' +
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
        : '<p class="cs-comment-empty">官方精選可瀏覽；登入後按讚／收藏／留言請先「分享投稿」建立旅人貼文。</p>');

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

  function prepareComposeTaxonomy(opts) {
    opts = opts || {};
    var loc = locApi();
    var scope = csState.feedScope;
    var itineraryText = resolveItineraryDestinationText();
    var tax = null;
    var locked = false;
    var needsCity = false;
    var needsCountry = false;

    if (opts.fromItinerary && itineraryText && loc) {
      tax = loc.resolveLocation(itineraryText, { source: 'itinerary' });
      if (tax.countryId && tax.cityId) {
        locked = true;
      } else if (tax.countryId) {
        needsCity = true;
      } else {
        needsCountry = true;
        needsCity = true;
      }
    } else if (scope && scope.feedKind === 'city' && scope.taxonomy && scope.taxonomy.cityId) {
      tax = Object.assign({}, scope.taxonomy);
      tax.locationSource = 'card';
      locked = true;
    } else if (scope && scope.feedKind === 'region' && scope.taxonomy) {
      tax = Object.assign({}, scope.taxonomy);
      tax.locationSource = 'card';
      if (itineraryText && loc) {
        var it = loc.resolveLocation(itineraryText, {
          countryId: tax.countryId,
          regionId: tax.regionId,
          source: 'itinerary'
        });
        if (it.cityId) {
          tax = it;
          locked = true;
        } else {
          needsCity = true;
        }
      } else {
        needsCity = true;
      }
    } else if (scope && scope.feedKind === 'country' && scope.taxonomy) {
      tax = Object.assign({}, scope.taxonomy);
      tax.locationSource = 'card';
      if (itineraryText && loc) {
        var it2 = loc.resolveLocation(itineraryText, {
          countryId: tax.countryId,
          source: 'itinerary'
        });
        if (it2.countryId === tax.countryId && it2.cityId) {
          tax = it2;
          locked = true;
        } else {
          needsCity = true;
        }
      } else {
        needsCity = true;
      }
    } else if (itineraryText && loc) {
      tax = loc.resolveLocation(itineraryText, { source: 'itinerary' });
      if (tax.countryId && tax.cityId) locked = true;
      else if (tax.countryId) needsCity = true;
      else {
        needsCountry = true;
        needsCity = true;
      }
    } else {
      needsCountry = true;
      needsCity = true;
      tax = loc
        ? loc.resolveLocation('', { source: 'manual' })
        : { countryId: '', cityId: '', chipLabel: '' };
    }

    csState.composeTaxonomy = tax;
    csState.composeLocked = locked;
    csState.composeNeedsCity = needsCity && !locked;
    csState.composeNeedsCountry = needsCountry && !locked;
    return tax;
  }

  function renderComposeLocationBlock() {
    var tax = csState.composeTaxonomy || {};
    var locked = csState.composeLocked;
    var needsCity = csState.composeNeedsCity;
    var needsCountry = csState.composeNeedsCountry;
    var chip = tax.chipLabel || '';
    if (!chip && tax.cityName) {
      chip =
        '📍 ' +
        [tax.cityName, tax.regionName, tax.countryName].filter(Boolean).join('・');
    } else if (!chip && tax.countryName) {
      chip = '📍 ' + tax.countryName;
    }

    if (locked) {
      return (
        '<div class="cs-compose-location is-locked">' +
        '<p class="cs-compose-label">這趟去了哪裡？</p>' +
        '<p class="cs-compose-location-chip" id="csComposeLocationChip">' +
        escapeHtml(chip || '📍 已帶入目的地') +
        '</p>' +
        '<input type="hidden" id="csComposeCountryId" value="' +
        escapeHtml(tax.countryId || '') +
        '">' +
        '<input type="hidden" id="csComposeRegionId" value="' +
        escapeHtml(tax.regionId || '') +
        '">' +
        '<input type="hidden" id="csComposeCityId" value="' +
        escapeHtml(tax.cityId || '') +
        '">' +
        '<input type="hidden" id="csComposeCityName" value="' +
        escapeHtml(tax.cityName || '') +
        '">' +
        '</div>'
      );
    }

    var html =
      '<div class="cs-compose-location">' +
      '<p class="cs-compose-label">📍 這趟去了哪裡？</p>';
    if (chip && tax.countryId && !needsCountry) {
      html +=
        '<p class="cs-compose-location-chip">' + escapeHtml(chip) + '</p>';
    }
    if (needsCountry) {
      var countries = (locApi() && locApi().listCountries && locApi().listCountries()) || [];
      html +=
        '<label class="cs-compose-label">國家／地區' +
        '<select id="csComposeCountryId" class="cs-compose-input" required>' +
        '<option value="">請選擇</option>' +
        countries
          .map(function (c) {
            return (
              '<option value="' +
              escapeHtml(c.id) +
              '"' +
              (tax.countryId === c.id ? ' selected' : '') +
              '>' +
              escapeHtml(c.name) +
              '</option>'
            );
          })
          .join('') +
        '</select></label>';
    } else {
      html +=
        '<input type="hidden" id="csComposeCountryId" value="' +
        escapeHtml(tax.countryId || '') +
        '">';
    }
    html +=
      '<input type="hidden" id="csComposeRegionId" value="' +
      escapeHtml(tax.regionId || '') +
      '">';
    if (needsCity) {
      html +=
        '<label class="cs-compose-label">搜尋城市或地區' +
        '<input id="csComposeCityQuery" class="cs-compose-input" list="csComposeCityList" placeholder="例如：名古屋、札幌、濟州、釜山" autocomplete="off">' +
        '<datalist id="csComposeCityList"></datalist></label>' +
        '<input type="hidden" id="csComposeCityId" value="">' +
        '<input type="hidden" id="csComposeCityName" value="">';
    } else {
      html +=
        '<input type="hidden" id="csComposeCityId" value="' +
        escapeHtml(tax.cityId || '') +
        '">' +
        '<input type="hidden" id="csComposeCityName" value="' +
        escapeHtml(tax.cityName || '') +
        '">';
    }
    html += '</div>';
    return html;
  }

  function renderCompose() {
    var draftMedia = csState.composeMedia || [];
    var uploadOn = mediaUploadEnabled();
    prepareComposeTaxonomy({ fromItinerary: true });
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
            '<input id="csComposeMediaInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden>' +
            '</label>') +
        thumbs +
        '</div>';
    }
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
    csState.comments = [];
    csState.liked = false;
    csState.saved = false;
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

  function renderCurrentView() {
    var viewport = document.getElementById('csViewport');
    if (!viewport || !csState.cityId) return;
    if (csState.view === 'compose') {
      viewport.innerHTML = renderCompose();
      bindComposeLocationInputs();
    } else if (csState.view === 'detail' && csState.postId) {
      viewport.innerHTML = renderDetail(findPost(csState.postId));
    } else {
      viewport.innerHTML = renderFeed(csState.cityId);
    }
    updateChrome();
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
      var tax = locApi().resolveLocation(queryEl.value, {
        countryId: countryId,
        source: 'search'
      });
      if (cityIdEl) cityIdEl.value = tax.cityId || '';
      if (cityNameEl) cityNameEl.value = tax.cityName || queryEl.value || '';
      if (regionEl && tax.regionId) regionEl.value = tax.regionId;
      if (countryEl && tax.countryId && countryEl.tagName === 'SELECT') {
        countryEl.value = tax.countryId;
      }
      csState.composeTaxonomy = Object.assign({}, csState.composeTaxonomy || {}, tax);
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
        refreshSuggestions();
        if (csState.composeTaxonomy) {
          csState.composeTaxonomy.countryId = countryEl.value;
          var c =
            locApi() &&
            locApi().COUNTRIES &&
            locApi().COUNTRIES[countryEl.value];
          if (c) csState.composeTaxonomy.countryName = c.name;
        }
      });
    }
  }

  function openCityShares(cityId, postId) {
    var shell = document.getElementById('cityShares');
    var viewport = document.getElementById('csViewport');
    if (!shell || !viewport) return;

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
    csState.feedScope = null;
    csState.composeTaxonomy = null;
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
      if (!Array.isArray(csState.composeMedia)) csState.composeMedia = [];
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
          renderCurrentView();
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

  function handleComposeMediaPick(fileList) {
    if (!mediaUploadEnabled()) return;
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    if (!Array.isArray(csState.composeMedia)) csState.composeMedia = [];
    var room = Math.max(0, MEDIA_MAX_PER_POST - csState.composeMedia.length);
    files.slice(0, room).forEach(function (file) {
      if (!file || !/^image\/(jpeg|png|webp|gif)$/i.test(file.type || '')) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('單張照片請小於 2MB');
        return;
      }
      var previewUrl = '';
      try {
        previewUrl = URL.createObjectURL(file);
      } catch (e) {
        previewUrl = '';
      }
      csState.composeMedia.push({
        file: file,
        previewUrl: previewUrl,
        type: file.type
      });
    });
    renderCurrentView();
  }

  function handleComposeSubmit() {
    var a = api();
    var titleEl = document.getElementById('csComposeTitle');
    var bodyEl = document.getElementById('csComposeBody');
    var typeEl = document.getElementById('csComposeType');
    var countryEl = document.getElementById('csComposeCountryId');
    var regionEl = document.getElementById('csComposeRegionId');
    var cityIdEl = document.getElementById('csComposeCityId');
    var cityNameEl = document.getElementById('csComposeCityName');
    var cityQueryEl = document.getElementById('csComposeCityQuery');
    var msg = document.getElementById('csComposeMsg');
    if (!a) return;
    if (msg) {
      msg.textContent = '發布中…';
      msg.classList.remove('hidden');
    }
    var uploadOn = mediaUploadEnabled();
    var mediaDraft = uploadOn ? (csState.composeMedia || []).slice(0, MEDIA_MAX_PER_POST) : [];
    var countryId = countryEl ? String(countryEl.value || '').trim() : '';
    var regionId = regionEl ? String(regionEl.value || '').trim() : '';
    var cityId = cityIdEl ? String(cityIdEl.value || '').trim() : '';
    var cityName = cityNameEl ? String(cityNameEl.value || '').trim() : '';
    var cityQuery = cityQueryEl ? String(cityQueryEl.value || '').trim() : '';
    if (!cityId && cityQuery && locApi()) {
      var resolved = locApi().resolveLocation(cityQuery, {
        countryId: countryId,
        source: 'search'
      });
      cityId = resolved.cityId || '';
      cityName = resolved.cityName || cityQuery;
      if (resolved.countryId) countryId = resolved.countryId;
      if (resolved.regionId) regionId = resolved.regionId;
    }
    if (!countryId) {
      if (msg) {
        msg.textContent = '請選擇國家／地區';
        msg.classList.remove('hidden');
      }
      return;
    }
    if (csState.composeNeedsCity && !cityId && !cityQuery) {
      if (msg) {
        msg.textContent = '請輸入這趟去了哪裡';
        msg.classList.remove('hidden');
      }
      return;
    }
    var payload = {
      title: titleEl ? titleEl.value : '',
      body: bodyEl ? bodyEl.value : '',
      countryId: countryId,
      regionId: regionId,
      cityId: cityId,
      cityName: cityName || cityQuery,
      locationRaw: cityQuery || cityName || cityId,
      locationSource: csState.composeLocked
        ? (csState.composeTaxonomy && csState.composeTaxonomy.locationSource) || 'card'
        : cityQuery
          ? 'search'
          : 'manual',
      type: typeEl ? typeEl.value : 'sightseeing',
      media: [],
      mediaFiles: uploadOn
        ? mediaDraft.map(function (m) {
            return m.file;
          })
        : []
    };
    if (csState.composeTaxonomy) {
      if (!payload.countryName && csState.composeTaxonomy.countryName) {
        payload.countryName = csState.composeTaxonomy.countryName;
      }
      if (!payload.regionName && csState.composeTaxonomy.regionName) {
        payload.regionName = csState.composeTaxonomy.regionName;
      }
    }
    a.createPost(payload)
      .then(function (post) {
        (csState.composeMedia || []).forEach(function (m) {
          if (m && m.previewUrl) {
            try {
              URL.revokeObjectURL(m.previewUrl);
            } catch (e) {
              /* silent */
            }
          }
        });
        csState.composeMedia = [];
        var feedKey = csState.cityId;
        if (post.countryId && csState.feedScope && csState.feedScope.feedKind === 'country') {
          feedKey = csState.feedScope.entryId;
        } else if (post.cityId) {
          // Stay on current feed if post belongs; else jump to city feed
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
        if (msg) {
          msg.textContent = (err && err.message) || '發布失敗';
          msg.classList.remove('hidden');
        }
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
      var removeMedia = e.target.closest('[data-cs-remove-media]');
      if (removeMedia) {
        e.preventDefault();
        var rmIdx = parseInt(removeMedia.getAttribute('data-cs-remove-media'), 10);
        if (!isNaN(rmIdx) && Array.isArray(csState.composeMedia)) {
          var removed = csState.composeMedia.splice(rmIdx, 1)[0];
          if (removed && removed.previewUrl) {
            try {
              URL.revokeObjectURL(removed.previewUrl);
            } catch (revErr) {
              /* silent */
            }
          }
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

    shell.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'csComposeMediaInput') {
        handleComposeMediaPick(e.target.files);
        e.target.value = '';
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCityShares);
  } else {
    initCityShares();
  }
})(typeof window !== 'undefined' ? window : globalThis);
