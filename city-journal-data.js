(function (global) {
    'use strict';

    var CJ_BASE = './assets/city-journal';
    var CJ_PLACEHOLDER = CJ_BASE + '/placeholder-city-journal.jpg';

    var EDITION_CATALOG = [
        { key: 'budget', label: '小資旅行', icon: '💰', coverSuffix: 'budget' },
        { key: 'sightseeing', label: '初次觀光', icon: '🗺️', coverSuffix: 'sightseeing' },
        { key: 'trendy', label: '新潮熱門', icon: '⚡', coverSuffix: 'trendy' },
        { key: 'foodie', label: '美食吃貨', icon: '🍜', coverSuffix: 'food' },
        { key: 'photospot', label: '網美必拍', icon: '📸', coverSuffix: 'instagram' },
        { key: 'anime', label: '玩具動漫', icon: '🎮', coverSuffix: 'anime' },
        { key: 'streetwear', label: '潮流玩家', icon: '👟', coverSuffix: 'streetwear' }
    ];

    function cjPath(cityId, fileName) {
        return CJ_BASE + '/' + cityId + '/' + fileName;
    }

    function cityHeroImage(cityId) {
        return cjPath(cityId, cityId + '-hero.jpg');
    }

    function editionCoverImage(cityId, editionKey) {
        var edition = EDITION_CATALOG.filter(function (e) { return e.key === editionKey; })[0];
        var suffix = edition ? edition.coverSuffix : 'budget';
        return cjPath(cityId, cityId + '-' + suffix + '-cover.jpg');
    }

    function resolveJournalImage(localPath) {
        if (localPath && typeof localPath === 'string' && localPath.indexOf('./assets/city-journal/') === 0) {
            return localPath;
        }
        return CJ_PLACEHOLDER;
    }

    function buildMeta(cityId, name, nameEn, destinationLabel, hubSubtitle, publishedEditions) {
        return {
            id: cityId,
            name: name,
            nameEn: nameEn,
            destinationLabel: destinationLabel,
            heroImage: cityHeroImage(cityId),
            hubSubtitle: hubSubtitle,
            publishedEditions: publishedEditions || [],
            editionCovers: EDITION_CATALOG.reduce(function (acc, edition) {
                acc[edition.key] = editionCoverImage(cityId, edition.key);
                return acc;
            }, {})
        };
    }

    var META = {
        tokyo: buildMeta('tokyo', '東京', 'TOKYO', '東京', '七種節奏，讀懂這座永遠不睡的城市', ['anime']),
        kyoto: buildMeta('kyoto', '京都', 'KYOTO', '京都', '專題即將推出', []),
        osaka: buildMeta('osaka', '大阪', 'OSAKA', '大阪', '專題即將推出', []),
        seoul: buildMeta('seoul', '首爾', 'SEOUL', '首爾', '專題即將推出', []),
        hokkaido: buildMeta('hokkaido', '北海道', 'HOKKAIDO', '北海道', '專題即將推出', []),
        bangkok: buildMeta('bangkok', '曼谷', 'BANGKOK', '曼谷', '專題即將推出', []),
        vietnam: buildMeta('vietnam', '越南', 'VIETNAM', '越南', '專題即將推出', []),
        london: buildMeta('london', '倫敦', 'LONDON', '倫敦', '專題即將推出', []),
        paris: buildMeta('paris', '巴黎', 'PARIS', '巴黎', '專題即將推出', [])
    };

    META.vietnam.heroImage = CJ_PLACEHOLDER;
    Object.keys(META.vietnam.editionCovers).forEach(function (key) {
        META.vietnam.editionCovers[key] = CJ_PLACEHOLDER;
    });

    var T = 'tokyo';

    var ARTICLES = {
        tokyo: {
            anime: {
                id: 'tokyo-anime',
                cityId: 'tokyo',
                styleKey: 'anime',
                status: 'published',
                title: '秋葉原與中野：東京動漫聖地巡禮指南',
                subtitle: '從一番賞到復古玩具，骨灰級玩家的 48 小時地圖',
                heroImage: cjPath(T, 'tokyo-anime-hero.jpg'),
                coverImage: cjPath(T, 'tokyo-anime-cover.jpg'),
                issueLabel: '2026 年 6 月號',
                intro: '東京對動漫迷而言，從來不是「去幾個景點打卡」就能結束的旅程。這座城市把次文化藏進電氣街的霓虹裡、藏進中野百老匯的二手櫃位中，也藏進巷弄轉角那台你以為只是路過的扭蛋機。動漫系東京旅行的核心，不是趕場把清單劃掉，而是以 2 到 3 小時為單位做「塊狀掃街」：先鎖定一番賞現貨與期間限定，再慢慢挖中古公仔、模型與冷門周邊。你不需要成為資深藏家才能玩得盡興——但你需要一份把體力留給真正想逛的店的節奏。',
                sections: [
                    {
                        image: cjPath(T, 'akihabara-electric-town.jpg'),
                        caption: '秋葉原電氣街主幹道，電器行與動漫店櫥窗連成一片。',
                        heading: '秋葉原電氣街 · 動漫朝聖的起點',
                        content: '東京動漫朝聖的起點。高樓與巷弄交錯，從大型連鎖動漫店到地下卡牌、模型專賣應有盡有。建議從 JR 秋葉原站電氣街口出發，先逛 2 至 3 間主題明確的店，避免在第一眼就被拉進無限迴圈。📍 JR 秋葉原站（電氣街口）・千代田區・秋葉原'
                    },
                    {
                        image: cjPath(T, 'nakano-broadway.jpg'),
                        caption: '中野百老匯樓層內，公仔與漫畫櫃位密集排列的尋寶空間。',
                        heading: '中野百老匯 · 老玩家公認的挖寶聖地',
                        content: '被許多老玩家視為比秋葉原更好挖寶的聖地。多層樓匯集漫畫、公仔、卡牌與復古玩具，價格常有驚喜。適合下午進場，光線較暖，邊逛邊比價，預留至少 2 小時。📍 JR 中野站（北口）・中野区・中野'
                    },
                    {
                        image: cjPath(T, 'gachapon-hall.jpg'),
                        caption: '秋葉原扭蛋會館內，成排膠囊玩具機台組成的色彩牆。',
                        heading: 'GACHAPON 扭蛋會館 · 整面牆都是驚喜',
                        content: '秋葉原周邊知名的扭蛋專門空間，整面牆的機台適合快速試手氣與收藏入門。建議先設定預算上限，避免不知不覺轉到行李箱爆滿——這是過來人的溫柔提醒。📍 JR 秋葉原站・千代田區・秋葉原'
                    },
                    {
                        image: cjPath(T, 'ichiran-ramen.jpg'),
                        caption: '一蘭招牌豚骨拉麵，一人一格的專注食事體驗。',
                        heading: '一蘭拉麵 秋葉原店 · 掃街中途的熱湯補給',
                        content: '掃街到一半最需要熱湯補給的標準答案。一人一格的設計讓獨旅也自在，濃郁豚骨湯底快速回血。建議避開 12:00–13:30 午餐尖峰，或先取號再回周邊逛一圈。'
                    },
                    {
                        image: cjPath(T, 'maid-cafe.jpg'),
                        caption: '秋葉原巷弄內的主題咖啡廳，色彩與角色氛圍是體驗重點。',
                        heading: '秋葉原女僕咖啡廳街 · 次文化體驗的一杯咖啡',
                        content: '體驗東京次文化氛圍的經典方式之一。各家風格不同，從經典女僕到主題聯名皆有。若第一次嘗試，選評價穩定、規則說明清楚的分店，把時間控制在 60 分鐘內，留體力給下一間店。'
                    },
                    {
                        image: cjPath(T, 'japanese-curry.jpg'),
                        caption: '日式咖哩飯與炸物配菜，是動漫街區常見的務實晚餐選擇。',
                        heading: '咖哩屋香料 秋葉原 · 平價又飽足的能量餐',
                        content: '動漫街區常見的平價能量補給。香料層次分明、飯量足夠，適合傍晚掃街後的晚餐。上菜快、翻桌率高，是趕夜間活動前的務實選擇。'
                    },
                    {
                        image: cjPath(T, 'hotel-gracery.jpg'),
                        caption: '都會型商務飯店客房，適合把時間留給街上的旅人。',
                        heading: 'Hotel Gracery 秋葉原 · 步行可達電氣街',
                        content: '步行可達電氣街，動漫迷的經典落腳處。房間緊湊但機能完整，適合把時間花在街上而非飯店的人。週末房型建議提早預訂。參考價格 ¥12,000–18,000／晚。'
                    },
                    {
                        image: cjPath(T, 'hostel-nui.jpg'),
                        caption: '木質調公共空間的設計旅宿，適合獨旅與輕預算玩家。',
                        heading: 'Nui. HOSTEL & BAR LOUNGE · 文青感旅宿',
                        content: '公共空間寬敞，適合獨旅或輕預算玩家。到秋葉原約 15 分鐘電車，適合想平衡住宿質感與交通的旅人。參考價格 ¥4,500–8,000／晚。📍 淺草橋站'
                    }
                ],
                outro: '秋葉原與中野皆在 JR 山手線沿線，動漫一日掃街建議以 Suica 或 Pasmo 為主。成田機場可搭 N\'EX 或 Skyliner 轉山手線至秋葉原；羽田則以京急線轉 JR 最為直覺。兩站僅一站、約 5 分鐘——建議上午秋葉原、下午中野，把體力留給真正想逛的店。帶上空行李箱的一格與行動電源，東京會在你以為已經逛完時，再送出一個驚喜。',
                cta: {
                    buttonText: '用這種風格產生行程',
                    destinationLabel: '東京',
                    styleKey: 'anime'
                }
            }
        }
    };

    global.SOARVIBE_CITY_JOURNAL = {
        editionCatalog: EDITION_CATALOG,
        meta: META,
        articles: ARTICLES,
        assetBase: CJ_BASE,
        placeholderImage: CJ_PLACEHOLDER,
        cityHeroImage: cityHeroImage,
        editionCoverImage: editionCoverImage,
        resolveJournalImage: resolveJournalImage
    };
})(typeof window !== 'undefined' ? window : this);
