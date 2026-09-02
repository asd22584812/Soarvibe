/**
 * SoarVibe City Shares — city meta + read helpers (no DOM).
 * Feed posts come from Firestore only — no official/demo seed articles.
 */
(function (global) {
  'use strict';

  var DATA = {
    version: 2,
    cities: {
      tokyo: {
        cityId: 'tokyo',
        title: '東京旅人分享',
        subtitle: '真正去過的人的照片與心得',
        heroImage: './assets/city-shares/tokyo/tokyo-hero-kaminarimon.jpg',
        heroPosition: 'center 40%',
        heroAlt: '淺草寺雷門，東京城市辨識橫幅',
        posts: []
      }
    }
  };

  function getCityShares(cityId) {
    var city = DATA.cities[cityId];
    if (!city || !city.posts) return [];
    return city.posts.slice();
  }

  function getCityShareById(postId) {
    var keys = Object.keys(DATA.cities);
    for (var i = 0; i < keys.length; i++) {
      var posts = DATA.cities[keys[i]].posts || [];
      for (var j = 0; j < posts.length; j++) {
        if (posts[j].postId === postId) return posts[j];
      }
    }
    return null;
  }

  function getCitySharesByType(cityId, type) {
    return getCityShares(cityId).filter(function (p) {
      return p.type === type;
    });
  }

  function getCityShareTypes(cityId) {
    var seen = {};
    var out = [];
    getCityShares(cityId).forEach(function (p) {
      if (p && p.type && !seen[p.type]) {
        seen[p.type] = true;
        out.push(p.type);
      }
    });
    return out;
  }

  global.SOARVIBE_CITY_SHARES = DATA;
  global.getCityShares = getCityShares;
  global.getCityShareById = getCityShareById;
  global.getCitySharesByType = getCitySharesByType;
  global.getCityShareTypes = getCityShareTypes;
})(typeof window !== 'undefined' ? window : globalThis);
