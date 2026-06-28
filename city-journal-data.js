(function (global) {
    'use strict';

    var CJ_PLACEHOLDER = './assets/city-journal/placeholder-city-journal.jpg';

    var EDITION_CATALOG = [
        { key: 'budget', label: '小資旅行', icon: '💰' },
        { key: 'sightseeing', label: '初次觀光', icon: '🗺️' },
        { key: 'trendy', label: '新潮熱門', icon: '⚡' },
        { key: 'foodie', label: '美食吃貨', icon: '🍜' },
        { key: 'photospot', label: '網美必拍', icon: '📸' },
        { key: 'anime', label: '玩具動漫', icon: '🎮' },
        { key: 'streetwear', label: '潮流玩家', icon: '👟' }
    ];

    function buildMeta(cityId, name, nameEn, destinationLabel, hubSubtitle, publishedEditions, heroImageKey) {
        return {
            id: cityId,
            name: name,
            nameEn: nameEn,
            destinationLabel: destinationLabel,
            heroImageKey: heroImageKey || null,
            hubSubtitle: hubSubtitle,
            publishedEditions: publishedEditions || [],
            editionCoverKeys: EDITION_CATALOG.reduce(function (acc, edition) {
                acc[edition.key] = null;
                return acc;
            }, {})
        };
    }

    var META = {
        tokyo: buildMeta('tokyo', '東京', 'TOKYO', '東京', '七種節奏，讀懂這座永遠不睡的城市', ['anime'], 'tokyo-hub-hero'),
        kyoto: buildMeta('kyoto', '京都', 'KYOTO', '京都', '專題即將推出', []),
        osaka: buildMeta('osaka', '大阪', 'OSAKA', '大阪', '專題即將推出', []),
        seoul: buildMeta('seoul', '首爾', 'SEOUL', '首爾', '專題即將推出', []),
        hokkaido: buildMeta('hokkaido', '北海道', 'HOKKAIDO', '北海道', '專題即將推出', []),
        bangkok: buildMeta('bangkok', '曼谷', 'BANGKOK', '曼谷', '專題即將推出', []),
        vietnam: buildMeta('vietnam', '越南', 'VIETNAM', '越南', '專題即將推出', []),
        london: buildMeta('london', '倫敦', 'LONDON', '倫敦', '專題即將推出', []),
        paris: buildMeta('paris', '巴黎', 'PARIS', '巴黎', '專題即將推出', [])
    };

    META.tokyo.editionCoverKeys.anime = 'tokyo-anime-cover';

    var ARTICLES = {
        tokyo: {
            anime: {
                id: 'tokyo-anime',
                cityId: 'tokyo',
                styleKey: 'anime',
                status: 'published',
                title: '秋葉原與中野：東京動漫聖地巡禮指南',
                subtitle: '從一番賞到復古玩具，骨灰級玩家的 48 小時地圖',
                heroImageKey: 'tokyo-anime-hero',
                coverImageKey: 'tokyo-anime-cover',
                heroSubject: '秋葉原電氣街',
                heroMapsQuery: 'Akihabara Electric Town Tokyo Japan',
                heroPlaceId: 'ChIJzdWdgh2MGGARh4kg2pVZL3c',
                heroGooglePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO-_8kdgYH3Ad4ZXbj2VE5My2BTDK8FiRt44_QFJve-voltAy3AwlCwFlAbxZyo6yXjjgMfg4Kg1I0TFYl0aPOzSgZYRXPoxJyi-Dg2lBxibMtViFdd4iPKkXoWqnsYYS7ji6vqzFqe-wNd03ldz0fy=s4800-w1600-h1200',
                heroGoogleAttribution: 'Alvin Leow',
                heroImageSource: 'google_places',
                coverSubject: '秋葉原電氣街',
                coverMapsQuery: 'Akihabara Electric Town Tokyo Japan',
                coverPlaceId: 'ChIJzdWdgh2MGGARh4kg2pVZL3c',
                coverGooglePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO-_8kdgYH3Ad4ZXbj2VE5My2BTDK8FiRt44_QFJve-voltAy3AwlCwFlAbxZyo6yXjjgMfg4Kg1I0TFYl0aPOzSgZYRXPoxJyi-Dg2lBxibMtViFdd4iPKkXoWqnsYYS7ji6vqzFqe-wNd03ldz0fy=s4800-w1600-h1200',
                coverGoogleAttribution: 'Alvin Leow',
                coverImageSource: 'google_places',
                issueLabel: '2026 年 6 月號',
                intro: '東京對動漫迷而言，從來不是「去幾個景點打卡」就能結束的旅程。這座城市把次文化藏進電氣街的霓虹裡、藏進中野百老匯的二手櫃位中，也藏進巷弄轉角那台你以為只是路過的扭蛋機。動漫系東京旅行的核心，不是趕場把清單劃掉，而是以 2 到 3 小時為單位做「塊狀掃街」：先鎖定一番賞現貨與期間限定，再慢慢挖中古公仔、模型與冷門周邊。你不需要成為資深藏家才能玩得盡興——但你需要一份把體力留給真正想逛的店的節奏。',
                sections: [
                    {
                        sectionId: 'akihabara',
                        subject: '秋葉原電氣街',
                        mapsQuery: 'Akihabara Electric Town Tokyo Japan',
                        placeId: 'ChIJzdWdgh2MGGARh4kg2pVZL3c',
                        googleRating: null,
                        googleAddress: 'Akihabara Electric Town, Tokyo',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO-_8kdgYH3Ad4ZXbj2VE5My2BTDK8FiRt44_QFJve-voltAy3AwlCwFlAbxZyo6yXjjgMfg4Kg1I0TFYl0aPOzSgZYRXPoxJyi-Dg2lBxibMtViFdd4iPKkXoWqnsYYS7ji6vqzFqe-wNd03ldz0fy=s4800-w1600-h1200',
                        googleAttribution: 'Alvin Leow',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-akihabara',
                        caption: '秋葉原電氣街主幹道，電器行與動漫店櫥窗連成一片。',
                        heading: '秋葉原電氣街 · 動漫朝聖的起點',
                        content: '東京動漫朝聖的起點。高樓與巷弄交錯，從大型連鎖動漫店到地下卡牌、模型專賣應有盡有。建議從 JR 秋葉原站電氣街口出發，先逛 2 至 3 間主題明確的店，避免在第一眼就被拉進無限迴圈。📍 JR 秋葉原站（電氣街口）・千代田區・秋葉原'
                    },
                    {
                        sectionId: 'nakano',
                        subject: '中野百老匯',
                        mapsQuery: 'Nakano Broadway Tokyo Japan',
                        placeId: 'ChIJg-7dspDyGGARvvDv4E5-tuE',
                        googleRating: 4.2,
                        googleAddress: '5-chōme-52-15 Nakano, Nakano City, Tokyo 164-0001',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOlZ4_LVYqQB6QfmfbhOJJkyn70NasmNaSKlqh9i4CHUmXAj19B1ZJVi4in5zIfHIbSxwUSwczIUZ-EwwlH1R7_D2JDu0x0Yo1C0ATEIgln1f0-FF3BrfEHJF6boL-OUUo7cGr4HZJXHff7ing=s4800-w1600-h1200',
                        googleAttribution: '加藤展康',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-nakano',
                        caption: '中野百老匯樓層內，公仔與漫畫櫃位密集排列的尋寶空間。',
                        heading: '中野百老匯 · 老玩家公認的挖寶聖地',
                        content: '被許多老玩家視為比秋葉原更好挖寶的聖地。多層樓匯集漫畫、公仔、卡牌與復古玩具，價格常有驚喜。適合下午進場，光線較暖，邊逛邊比價，預留至少 2 小時。📍 JR 中野站（北口）・中野区・中野'
                    },
                    {
                        sectionId: 'gachapon',
                        subject: 'GACHAPON 扭蛋會館',
                        mapsQuery: 'Gachapon Kaikan Akihabara Tokyo',
                        placeId: 'ChIJBztW3x2MGGARadHYl5vTEK0',
                        googleRating: 4,
                        googleAddress: '〒101-0021 Tokyo, Chiyoda City, Sotokanda, 3-chōme−15−５ MNビル 1F',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZN3lw-sSmkEWz9OTLfx_VUg1Tus4Q81rPkEWRYPNjvdGkf-kQricmDMc6aA_EC0wBJ7d5eqhNInGQk9xYAKVLC-8mugCMu6bI0nP7UWSypT0cHEeFNg4kLfIqeskB3_kf8mJNVAW9e4SEd5eIA=s4800-w1600-h1200',
                        googleAttribution: 'ブラウンチョコ',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-gachapon',
                        caption: '秋葉原扭蛋會館內，成排膠囊玩具機台組成的色彩牆。',
                        heading: 'GACHAPON 扭蛋會館 · 整面牆都是驚喜',
                        content: '秋葉原周邊知名的扭蛋專門空間，整面牆的機台適合快速試手氣與收藏入門。建議先設定預算上限，避免不知不覺轉到行李箱爆滿——這是過來人的溫柔提醒。📍 JR 秋葉原站・千代田區・秋葉原'
                    },
                    {
                        sectionId: 'ichiran',
                        subject: '田中そば店 秋葉原店',
                        mapsQuery: '田中そば店 秋葉原店',
                        placeId: 'ChIJXTeLYx6MGGARNivhJ55nYVw',
                        googleRating: 4.2,
                        googleAddress: 'Japan, 〒101-0021 Tokyo, Chiyoda City, Sotokanda, 3-chōme−8−３ 第一針谷ビル1Ｆ',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMYsqeMfq-2pUSrN2z5RC4XuYyadXAcp_Z4rGIRHXuRI2UeTj8TaYhpqedrvY8WqTvR_4MCn-ALJBnyF7eJnUWsvGfVcveT1C3ONXldESiJ5a8rnc79v3H_imTmX3onCImIKflaGzgs8RgwoQ=s4800-w720-h405',
                        googleAttribution: '田中そば店 秋葉原店',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-ichiran',
                        caption: '秋葉原電氣街步行圈內的醬油拉麵名店，適合掃街中途快速補給。',
                        heading: '田中そば店 秋葉原店 · 掃街中途的熱湯補給',
                        content: '秋葉原掃街到一半最需要熱湯補給的在地選擇。田中そば店以醬油湯頭與快速上菜聞名，適合把午餐控制在 30 至 45 分鐘內。建議避開 12:00–13:30 尖峰，或先排隊再回周邊逛一圈。📍 千代田區外神田・秋葉原電氣街步行圈'
                    },
                    {
                        sectionId: 'maid-cafe',
                        subject: '女僕咖啡廳 秋葉原',
                        mapsQuery: 'Maid Cafe Akihabara Tokyo',
                        placeId: 'ChIJvQtxBAaNGGARTiTMJ-Nzhvc',
                        googleRating: 4.9,
                        googleAddress: '〒101-0021 Tokyo, Chiyoda City, Sotokanda, 1-chōme−15−13 秋葉原 神田B&Vビル 10F',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNEWaov5aHNNKnBj0J0Ya6RJD4QHqC2Ph1XQUNxFoqJaWoUB_rYzdOr8X0yM-Uytw9XTvc3eWE5hr4CMx1Y1DppyN6375CmIcKHT72qj-Pq-q8jpKO2T2LxLRx1u8S5BkhbKep7cj-BDQ67NFQ=s4800-w1365-h1200',
                        googleAttribution: 'MAID MADE 秋葉原駅前店',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-maid-cafe',
                        caption: '秋葉原巷弄內的主題咖啡廳，色彩與甜點是體驗重點。',
                        heading: '秋葉原女僕咖啡廳街 · 次文化體驗的一杯咖啡',
                        content: '體驗東京次文化氛圍的經典方式之一。各家風格不同，從經典女僕到主題聯名皆有。若第一次嘗試，選評價穩定、規則說明清楚的分店，把時間控制在 60 分鐘內，留體力給下一間店。'
                    },
                    {
                        sectionId: 'nui-hostel',
                        subject: 'Nui Hostel Tokyo',
                        mapsQuery: 'Nui Hostel & Bar Tokyo',
                        placeId: 'ChIJ4U-9KsiOGGARARhaBLZLqS0',
                        googleRating: 4.5,
                        googleAddress: '2-chōme-14-13 Kuramae, Taito City, Tokyo 111-0051',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMO0KgiICCZV9dyfBhNT-71YuvcPBUsxIq58PyXwooJ0ouqKZ3nwYhN80T7QnlzlTVl52idH_dzoU_IM0q58zuUuZF56bBy3vhud-AqsRJwz-D65T0hyOXXSA1-jXXke-dkgYPDQqubYNWLhw=s4800-w1600-h1200',
                        googleAttribution: 'Nui. HOSTEL & BAR LOUNGE',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-nui-hostel',
                        caption: '淺草橋附近的設計型青年旅館，公共交誼空間適合獨旅與背包客交流。',
                        heading: 'Nui Hostel Tokyo · 淺草橋的設計旅宿',
                        content: '若想離電氣街稍遠、但仍能輕鬆搭 JR 往返，Nui Hostel 是動漫行程外的務實落腳選擇。公共吧台與交誼廳氣氛輕鬆，適合獨旅或預算控管。建議提早預訂週末床位。'
                    },
                    {
                        sectionId: 'hotel-gracery',
                        subject: '秋葉原ワシントンホテル',
                        mapsQuery: 'Akihabara Washington Hotel Tokyo',
                        placeId: 'ChIJnxZoFqiOGGAReYJ1ck2lXiw',
                        googleRating: 4.2,
                        googleAddress: 'Japan, 〒101-0025 Tokyo, Chiyoda City, Kanda Sakumachō, 1-chōme−８−３',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOJ2RGUQqzztwaYBu7jbowjtr4XO5cjA9joYo0w-zpAX1PLHcAAiCo41Vi7uEo7lPa2uZjM3NLeKMTVCTY2_h01or7ksXRjzGrLHtPn-YrydrlpEzu7J3Nqo3JDUU07sB2_IxdYRyTx6dejKg=s4800-w1280-h900',
                        googleAttribution: '秋葉原ワシントンホテル',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-hotel-gracery',
                        caption: 'JR 秋葉原站步行約 1 分鐘的商務飯店，動漫一日掃街的理想落腳處。',
                        heading: '秋葉原ワシントンホテル · 步行可達電氣街',
                        content: 'JR 秋葉原站中央改札口步行約 1 分鐘，是動漫迷把時間留給街上的務實選擇。客房機能完整、交通直覺，適合以秋葉原為基地、再搭山手線一站前往中野挖寶。週末與展期建議提早預訂。'
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
        placeholderImage: CJ_PLACEHOLDER
    };
})(typeof window !== 'undefined' ? window : this);
