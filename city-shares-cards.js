/**
 * Data-driven City Shares homepage cards.
 * Existing 9 cards keep exact image URLs / order relative to each other.
 * New country/city cards appended around them without mutating frozen assets.
 */
(function (global) {
  'use strict';

  var UNS = 'https://images.unsplash.com/';
  var Q = '?auto=format&fit=crop&w=600&q=85';

  /**
   * frozen: true → do not change image/url/crop in future edits without explicit approval.
   */
  var CARDS = [
    /* —— Main country entries (new) —— */
    {
      id: 'japan',
      type: 'country',
      countryId: 'japan',
      displayName: '日本',
      image: UNS + 'photo-1770705871999-49558f3dd827' + Q,
      imageSource: 'unsplash',
      imageAttribution: 'Josip Ivanković (@piak) / Unsplash — Mount Fuji, Fujinomiya, Japan',
      imageAlt: '富士山景觀',
      imagePosition: 'center 40%',
      enabled: true,
      sortOrder: 10,
      frozen: false
    },
    {
      id: 'korea',
      type: 'country',
      countryId: 'korea',
      displayName: '韓國',
      image: UNS + 'photo-1677107129789-3b0241fb727a' + Q,
      imageSource: 'unsplash',
      imageAttribution: 'Ji Yong Won (@jiyong7) / Unsplash — Bukchon Hanok Village, Seoul',
      imageAlt: '首爾北村韓屋',
      imagePosition: 'center 35%',
      enabled: true,
      sortOrder: 20,
      frozen: false
    },
    {
      id: 'usa',
      type: 'country',
      countryId: 'usa',
      displayName: '美國',
      image: UNS + 'photo-1476664498204-2675a18e89d0' + Q,
      imageSource: 'unsplash',
      imageAttribution: 'JOHN TOWNER (@heytowner) / Unsplash — Golden Gate Bridge, San Francisco',
      imageAlt: '舊金山金門大橋',
      imagePosition: 'center 45%',
      enabled: true,
      sortOrder: 30,
      frozen: false
    },
    {
      id: 'australia',
      type: 'country',
      countryId: 'australia',
      displayName: '澳洲',
      image: UNS + 'photo-1577601082559-fbc23f45fff4' + Q,
      imageSource: 'unsplash',
      imageAttribution: 'Kyle Hinkson (@whereiskylenow) / Unsplash — Sydney Opera House',
      imageAlt: '雪梨歌劇院',
      imagePosition: 'center 40%',
      enabled: true,
      sortOrder: 40,
      frozen: false
    },

    /* —— Original 9 cards: image URLs frozen exactly —— */
    {
      id: 'tokyo',
      type: 'city',
      countryId: 'japan',
      cityId: 'tokyo',
      displayName: '東京',
      image: UNS + 'photo-1648301184879-28c6ed4964d7' + Q,
      imageSource: 'unsplash',
      imageAlt: '東京鐵塔夜景',
      imagePosition: 'center',
      enabled: true,
      sortOrder: 100,
      frozen: true
    },
    {
      id: 'kyoto',
      type: 'city',
      countryId: 'japan',
      cityId: 'kyoto',
      displayName: '京都',
      image: UNS + 'photo-1573047330192-4e6bb1594325' + Q,
      imageSource: 'unsplash',
      imageAlt: '京都祇園傳統街道',
      imagePosition: 'center',
      enabled: true,
      sortOrder: 110,
      frozen: true
    },
    {
      id: 'osaka',
      type: 'city',
      countryId: 'japan',
      cityId: 'osaka',
      displayName: '大阪',
      image: UNS + 'photo-1773467223754-b9f3eb4d2c0f' + Q,
      imageSource: 'unsplash',
      imageAlt: '大阪城黃昏夜景',
      imagePosition: 'center',
      enabled: true,
      sortOrder: 120,
      frozen: true
    },
    {
      id: 'seoul',
      type: 'city',
      countryId: 'korea',
      cityId: 'seoul',
      displayName: '首爾',
      image: UNS + 'photo-1517154421773-0529f29ea451' + Q,
      imageSource: 'unsplash',
      imageAlt: '首爾潮流城市夜景',
      imagePosition: 'center',
      enabled: true,
      sortOrder: 130,
      frozen: true
    },
    {
      id: 'hokkaido',
      type: 'region',
      countryId: 'japan',
      regionId: 'hokkaido',
      displayName: '北海道',
      image: UNS + 'photo-1741225241678-0c7f8fa07917' + Q,
      imageSource: 'unsplash',
      imageAlt: '北海道札幌雪景',
      imagePosition: 'center',
      enabled: true,
      sortOrder: 140,
      frozen: true
    },
    {
      id: 'bangkok',
      type: 'city',
      countryId: 'thailand',
      cityId: 'bangkok',
      displayName: '曼谷',
      image: UNS + 'photo-1768392810963-017c92313d79' + Q,
      imageSource: 'unsplash',
      imageAlt: '曼谷鄭王廟泰式建築',
      imagePosition: 'center',
      enabled: true,
      sortOrder: 150,
      frozen: true
    },
    {
      id: 'vietnam',
      type: 'country',
      countryId: 'vietnam',
      displayName: '越南',
      image: './cover-photos/vietnam.jpg',
      imageSource: 'local',
      imageAlt: '越南下龍灣景色',
      imagePosition: 'center',
      imageFallback: './cover-photos/default.jpg',
      enabled: true,
      sortOrder: 160,
      frozen: true
    },
    {
      id: 'london',
      type: 'city',
      countryId: 'uk',
      cityId: 'london',
      displayName: '倫敦',
      image: UNS + 'photo-1513635269975-59663e0ac1ad' + Q,
      imageSource: 'unsplash',
      imageAlt: '倫敦泰晤士河天際線',
      imagePosition: 'center',
      enabled: true,
      sortOrder: 170,
      frozen: true
    },
    {
      id: 'paris',
      type: 'city',
      countryId: 'france',
      cityId: 'paris',
      displayName: '巴黎',
      image: UNS + 'photo-1502602898657-3e91760cbb34' + Q,
      imageSource: 'unsplash',
      imageAlt: '巴黎艾菲爾鐵塔',
      imagePosition: 'center',
      enabled: true,
      sortOrder: 180,
      frozen: true
    },

    /* —— New popular city shortcut —— */
    {
      id: 'busan',
      type: 'city',
      countryId: 'korea',
      cityId: 'busan',
      displayName: '釜山',
      image: UNS + 'photo-1655829183245-ce1ce04ad326' + Q,
      imageSource: 'unsplash',
      imageAttribution: 'sehoon ye (@_3bread) / Unsplash — Gwangan Bridge, Busan',
      imageAlt: '釜山廣安大橋夜景',
      imagePosition: 'center 40%',
      enabled: true,
      sortOrder: 200,
      frozen: false
    }
  ];

  function getEnabledCards() {
    return CARDS.filter(function (c) {
      return c && c.enabled !== false;
    }).slice().sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }

  function getCardById(id) {
    var key = String(id || '');
    var i;
    for (i = 0; i < CARDS.length; i++) {
      if (CARDS[i].id === key) return CARDS[i];
    }
    return null;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderHomepageCardsHtml() {
    return getEnabledCards()
      .map(function (card) {
        var openId = card.id;
        var pos = card.imagePosition || 'center';
        var fb = '';
        if (card.imageFallback) {
          fb =
            ' onerror="if(!this.dataset.magCardFb){this.dataset.magCardFb=\'1\';this.src=\'' +
            escapeHtml(card.imageFallback) +
            '\';}else{this.src=\'./assets/city-journal/placeholder-city-journal.jpg\';}"';
        }
        return (
          '<article class="city-card mag-city-card flex-shrink-0 w-[6.75rem] h-full rounded-3xl overflow-hidden relative shadow-lg snap-start bg-white/20" role="button" tabindex="0" data-cs-card="' +
          escapeHtml(card.id) +
          '" data-cs-type="' +
          escapeHtml(card.type) +
          '" onclick="openCityDestination(\'' +
          escapeHtml(openId) +
          '\')" aria-label="開啟' +
          escapeHtml(card.displayName) +
          '旅人分享">' +
          '<img src="' +
          escapeHtml(card.image) +
          '" alt="' +
          escapeHtml(card.imageAlt || card.displayName) +
          '" loading="lazy" class="mag-city-card-img absolute inset-0 w-full h-full object-cover pointer-events-none" style="object-position:' +
          escapeHtml(pos) +
          ';"' +
          fb +
          '>' +
          '<div class="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/75 to-transparent pointer-events-none">' +
          '<span class="text-white font-bold text-sm">' +
          escapeHtml(card.displayName) +
          '</span></div></article>'
        );
      })
      .join('');
  }

  function mountHomepageCards(root) {
    var el =
      root ||
      (typeof document !== 'undefined' ? document.getElementById('mag-city-list') : null);
    if (!el) return false;
    el.innerHTML = renderHomepageCardsHtml();
    return true;
  }

  global.SOARVIBE_CITY_SHARES_CARDS = Object.freeze({
    CARDS: CARDS,
    getEnabledCards: getEnabledCards,
    getCardById: getCardById,
    renderHomepageCardsHtml: renderHomepageCardsHtml,
    mountHomepageCards: mountHomepageCards
  });

  if (typeof document !== 'undefined') {
    function bootCards() {
      try {
        mountHomepageCards();
      } catch (e) {
        /* silent */
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootCards);
    } else {
      bootCards();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
