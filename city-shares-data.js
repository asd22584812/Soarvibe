/**
 * SoarVibe City Shares — seed data + read-only API (no DOM, no Planner).
 * Phase 1A: Tokyo official seeds only.
 */
(function (global) {
  'use strict';

  var OFFICIAL_AUTHOR = {
    authorId: 'soarvibe-official',
    displayName: 'SoarVibe 編輯部',
    avatarUrl: ''
  };

  var EMPTY_STATS = {
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
    beenCount: 0,
    wantCount: 0,
    avoidCount: 0
  };

  var TOKYO_POSTS = [
    {
      postId: 'tokyo-akihabara-radio-kaikan-001',
      cityId: 'tokyo',
      type: 'anime',
      source: 'official',
      status: 'published',
      title: '秋葉原 Radio Kaikan：模型玩家很容易失控的一棟樓',
      body:
        '從 JR 秋葉原站電氣街出口走進中央通，Radio Kaikan 的立面很快就能認出來。' +
        '這棟樓本身不算大，但垂直分區清楚：模型、卡牌、同人周邊各自占樓層，動線是電梯上下掃描。' +
        '我會建議先搭到高樓看限定，再往下比價，不然很容易在某一層卡太久。' +
        '週末下午人潮明顯變多，若只想安靜逛，平日下午比較舒服。' +
        '這裡不是只看一家店，而是整棟樓的挖寶節奏，適合已經知道自己要什麼的人。',
      author: OFFICIAL_AUTHOR,
      place: {
        placeId: 'radio-kaikan',
        googlePlaceId: null,
        displayName: '秋葉原ラジオ会館',
        displayNameLocal: '秋葉原ラジオ会館',
        formattedAddress: null,
        latitude: null,
        longitude: null,
        mapsUrl: ''
      },
      media: [
        {
          mediaId: 'cover',
          src: './assets/city-shares/tokyo/tokyo-akihabara-radio-kaikan-001-exterior-0.jpg',
          thumbSrc: './assets/city-shares/tokyo/tokyo-akihabara-radio-kaikan-001-exterior-0.jpg',
          slot: 'exterior',
          caption: '秋葉原ラジオ会館外觀，垂直分區的模型與卡牌挖寶起點。',
          alt: '秋葉原 Radio Kaikan 建築外觀',
          width: 3024,
          height: 4032,
          sortOrder: 0,
          attribution: 'nakashi / Wikimedia Commons (CC BY-SA 2.0)'
        }
      ],
      visitMeta: {
        stayDuration: '1–2 小時',
        budget: '依購物內容而定',
        recommendLevel: 5,
        bestTime: '平日下午',
        tips: ['先逛高樓層再往下比價', '週末電氣街步行天國時段較擠']
      },
      stats: EMPTY_STATS,
      tags: ['秋葉原', 'Radio Kaikan', '模型', '動漫'],
      publishedAt: '2026-07-27T10:00:00+08:00',
      updatedAt: '2026-07-27T12:00:00+08:00'
    },
    {
      postId: 'tokyo-nakano-broadway-001',
      cityId: 'tokyo',
      type: 'anime',
      source: 'official',
      status: 'published',
      title: '中野百老匯：從車站走過去就開始挖寶',
      body:
        '中野站北口出來，沿著 Sun Mall 商店街走，約十分鐘就會看到 Broadway 招牌。' +
        '外觀看起來像普通商場，進去才是另一個世界：中古公仔、卡牌、同人本、復古玩具分散在不同樓層。' +
        '跟秋葉原的「新品節奏」不同，這裡更像在翻時間膠囊，常有意外的稀有品。' +
        '我通常會留半天，先快速掃一圈各樓，再回頭下手。' +
        '若你喜歡慢慢比價、不怕走回頭路，中野百老匯比中央通更適合挖寶型旅人。',
      author: OFFICIAL_AUTHOR,
      place: {
        placeId: 'nakano-broadway',
        googlePlaceId: null,
        displayName: '中野ブロードウェイ',
        displayNameLocal: '中野ブロードウェイ',
        formattedAddress: null,
        latitude: null,
        longitude: null,
        mapsUrl: ''
      },
      media: [
        {
          mediaId: 'cover',
          src: './assets/city-shares/tokyo/tokyo-nakano-broadway-001-exterior-0.jpg',
          thumbSrc: './assets/city-shares/tokyo/tokyo-nakano-broadway-001-exterior-0.jpg',
          slot: 'exterior',
          caption: '中野ブロードウェイ入口立面，Sun Mall 與商場之間的挖寶起點。',
          alt: '中野百老匯 Broadway 入口外觀',
          width: 1944,
          height: 2592,
          sortOrder: 0,
          attribution: 'Kentin / Wikimedia Commons (CC BY-SA 3.0)'
        }
      ],
      visitMeta: {
        stayDuration: '2–3 小時',
        budget: '依挖寶內容而定',
        recommendLevel: 5,
        bestTime: '平日下午',
        tips: ['先北口進 Sun Mall', '預留回頭比價時間']
      },
      stats: EMPTY_STATS,
      tags: ['中野', 'Broadway', '中古', '公仔'],
      publishedAt: '2026-07-27T10:15:00+08:00',
      updatedAt: '2026-07-27T12:00:00+08:00'
    },
    {
      postId: 'tokyo-sensoji-001',
      cityId: 'tokyo',
      type: 'sightseeing',
      source: 'official',
      status: 'published',
      title: '淺草寺：雷門到本堂，先把動線走順',
      body:
        '淺草寺最關鍵的是動線，不是單點打卡。從雷門進仲見通，再走到本堂與五重塔一帶，' +
        '整段步行約一個小時可以走完，但加上參拜、拍照、小吃就會拉長。' +
        '我會建議開門後或接近傍晚來，光線比較柔和，仲見通也比較不那麼擁擠。' +
        '若你想拍雷門全景，站在仲見通入口回頭通常比貼近雷門更容易構圖。' +
        '這裡適合第一次來東京的人建立「傳統東京」的感覺，節奏放慢會更舒服。',
      author: OFFICIAL_AUTHOR,
      place: {
        placeId: 'sensoji',
        googlePlaceId: null,
        displayName: '浅草寺',
        displayNameLocal: '浅草寺',
        formattedAddress: null,
        latitude: null,
        longitude: null,
        mapsUrl: ''
      },
      media: [
        {
          mediaId: 'cover',
          src: './assets/city-shares/tokyo/tokyo-sensoji-001-landmark-0.jpg',
          thumbSrc: './assets/city-shares/tokyo/tokyo-sensoji-001-landmark-0.jpg',
          slot: 'landmark',
          caption: '浅草寺雷門，仲見通動線的起點地標。',
          alt: '淺草寺雷門與大型提燈',
          width: 2000,
          height: 1500,
          sortOrder: 0,
          attribution: 'Tak1701d / Wikimedia Commons (CC BY-SA 3.0)'
        }
      ],
      visitMeta: {
        stayDuration: '1.5–2.5 小時',
        budget: '參拜免費，小吃另計',
        recommendLevel: 5,
        bestTime: '開門後或傍晚',
        tips: ['雷門全景可在仲見通入口回頭拍', '週末仲見通較擠']
      },
      stats: EMPTY_STATS,
      tags: ['淺草', '雷門', '寺廟', '仲見通'],
      publishedAt: '2026-07-27T10:30:00+08:00',
      updatedAt: '2026-07-27T12:00:00+08:00'
    },
    {
      postId: 'tokyo-shinjuku-gyoen-001',
      cityId: 'tokyo',
      type: 'sightseeing',
      source: 'official',
      status: 'published',
      title: '新宿御苑：在市中心換一個慢節奏',
      body:
        '新宿御苑是我會帶第一次來東京的朋友做「節奏轉換」的地方。' +
        '從新宿站步行約十分鐘，進園後噪音立刻降下來，英式、法式、日式庭園分區清楚，' +
        '即使不追櫻花或楓葉，光是長走道與大樹冠就值得待一兩小時。' +
        '園內可野餐但規則多，建議先在官網確認當日規範。' +
        '若行程前幾天都在電氣街或車站間快移動，這裡很適合排半日恢復體力。',
      author: OFFICIAL_AUTHOR,
      place: {
        placeId: 'shinjuku-gyoen',
        googlePlaceId: null,
        displayName: '新宿御苑',
        displayNameLocal: '新宿御苑',
        formattedAddress: null,
        latitude: null,
        longitude: null,
        mapsUrl: ''
      },
      media: [
        {
          mediaId: 'cover',
          src: './assets/city-shares/tokyo/tokyo-shinjuku-gyoen-001-landmark-0.jpg',
          thumbSrc: './assets/city-shares/tokyo/tokyo-shinjuku-gyoen-001-landmark-0.jpg',
          slot: 'landmark',
          caption: '新宿御苑園內綠地與樹冠，適合在快節奏行程中放慢半天。',
          alt: '新宿御苑國家公園綠樹與藍天',
          width: 4164,
          height: 2776,
          sortOrder: 0,
          attribution: 'Ibex73 / Wikimedia Commons (CC BY-SA 4.0)'
        }
      ],
      visitMeta: {
        stayDuration: '2–3 小時',
        budget: '門票依官網公告',
        recommendLevel: 4,
        bestTime: '平日上午',
        tips: ['進園前確認當日規則', '適合排在前幾天快節奏後']
      },
      stats: EMPTY_STATS,
      tags: ['新宿', '御苑', '公園', '散步'],
      publishedAt: '2026-07-27T10:45:00+08:00',
      updatedAt: '2026-07-27T12:00:00+08:00'
    },
    {
      postId: 'tokyo-ramen-afuri-ebisu-001',
      cityId: 'tokyo',
      type: 'food',
      source: 'official',
      status: 'published',
      title: '惠比壽 AFURI：柚子鹽拉麵適合觀光後的清爽一餐',
      body:
        'AFURI 恵比寿店在 117 ビル一樓，外觀低調，但排隊動線很明顯。' +
        '我點柚子鹽拉麵，湯頭偏清爽，跟重口味豚骨系不同，適合已經走了一整天的人。' +
        '尖峰時段常要排隊，若不想等，我會避開 12:00–13:00 和 18:00 前後。' +
        '這裡不是那種「拍一碗麵就結束」的店，建議先確認店門口與排隊位置，再決定要不要等。' +
        '若你行程在惠比壽或代官山一帶，可以當中繼餐點，不必特地跨區。',
      author: OFFICIAL_AUTHOR,
      place: {
        placeId: 'afuri-ebisu',
        googlePlaceId: null,
        displayName: 'AFURI 恵比寿',
        displayNameLocal: 'AFURI 恵比寿',
        formattedAddress: null,
        latitude: null,
        longitude: null,
        mapsUrl: ''
      },
      media: [],
      mediaPlaceholder: true,
      visitMeta: {
        stayDuration: '30–50 分鐘',
        budget: '依菜單為準',
        recommendLevel: 4,
        bestTime: '避開午餐尖峰',
        tips: ['尖峰常需排隊', '柚子鹽是招牌方向']
      },
      stats: EMPTY_STATS,
      tags: ['拉麵', '惠比壽', 'AFURI', '柚子'],
      publishedAt: '2026-07-27T11:00:00+08:00',
      updatedAt: '2026-07-27T11:00:00+08:00'
    },
    {
      postId: 'tokyo-lodging-mimaru-ueno-001',
      cityId: 'tokyo',
      type: 'lodging',
      source: 'official',
      status: 'published',
      title: 'MIMARU 上野東：動漫行程的中轉住宿',
      body:
        '若行程會在秋葉原、上野、池袋之間移動，MIMARU 上野イースト 是合理的落腳點。' +
        '這類公寓式飯店重點在房型：帶小廚房，連住時可以減少每天外食。' +
        'check-in 前先確認入口位置，上野站東側步行可達，拖行李比想像中輕鬆。' +
        '我不會只看房間照片選住宿，外觀與入口是否好認更重要，尤其第一天抵達時。' +
        '適合家庭或需要連住、不想每天換飯店的動漫/觀光混合行程。',
      author: OFFICIAL_AUTHOR,
      place: {
        placeId: 'mimaru-ueno-east',
        googlePlaceId: null,
        displayName: 'MIMARU東京 上野イースト',
        displayNameLocal: 'MIMARU東京 上野イースト',
        formattedAddress: null,
        latitude: null,
        longitude: null,
        mapsUrl: ''
      },
      media: [],
      mediaPlaceholder: true,
      visitMeta: {
        stayDuration: '連住 2 晚以上較划算',
        budget: '依房型與季節',
        recommendLevel: 4,
        bestTime: '下午 check-in',
        tips: ['先確認入口位置', '帶小廚房適合連住']
      },
      stats: EMPTY_STATS,
      tags: ['上野', 'MIMARU', '住宿', '連住'],
      publishedAt: '2026-07-27T11:15:00+08:00',
      updatedAt: '2026-07-27T11:15:00+08:00'
    }
  ];

  var DATA = {
    version: 1,
    cities: {
      tokyo: {
        cityId: 'tokyo',
        title: '東京旅人分享',
        subtitle: '真正去過的人的照片與心得',
        posts: TOKYO_POSTS
      }
    }
  };

  function getCityShares(cityId) {
    var city = DATA.cities[cityId];
    if (!city || !city.posts) return [];
    return city.posts.filter(function (p) {
      return p.status === 'published';
    });
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
      if (!seen[p.type]) {
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
