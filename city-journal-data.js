(function (global) {
    'use strict';

    var CJ_PLACEHOLDER = './assets/city-journal/placeholder-city-journal.svg';

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
                title: '2026東京動漫夏日祭典：次元壁突破之旅',
                subtitle: '編輯部特選！六月東京動漫主題城區漫遊攻略',
                editorialPlan: {
                    theme: '東京玩具動漫',
                    storyArc: '用 1～2 天把秋葉原、中野、扭蛋、拉麵與住宿串成一條有節奏的動漫巡禮路線',
                    readingRhythm: '上午電氣街朝聖 → 午後中野挖寶 → 傍晚扭蛋與補給 → 夜宿交通樞紐'
                },
                articleTheme: '東京動漫聖地巡禮——電氣街與中野的挖寶節奏',
                editorialAngle: '不是購物清單，而是動漫迷的朝聖路線',
                readerPersona: '動漫迷、老玩家、想深度逛秋葉原與中野的旅人',
                travelStyle: '步行掃街、深度挖寶、夜宿交通樞紐',
                emotion: '興奮、懷舊、驚喜挖到寶',
                articleGoal: '讓讀者感受到動漫聖地巡禮的節奏，而非景點清單',
                heroImageKey: 'tokyo-anime-hero',
                coverImageKey: 'tokyo-anime-cover',
                heroSubject: '秋葉原電氣街',
                heroOfficialName: 'Akihabara Electric Town',
                heroOfficialNameLocal: '秋葉原電気街',
                heroMapsQuery: 'Akihabara Electric Town Chuo Dori Tokyo',
                heroVisualKeywords: ['Radio Kaikan', 'ラジオ会館', 'Animate', '秋葉原', '霓虹', '中央通'],
                heroPlaceId: 'ChIJ__-AdayOGGAR6EGPwvcpzTA',
                heroGooglePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPItBmF2eIxAcm6GMXPTOz5QU1sa-LApntOrszyDk98eo0ocO8SOpKnWz3lqDZkVgjqQ0WpXX-Zh2R6JnVdG11hh07d5LU4NlsCZy4SSSVhnZ6Bo0KIxPKvQP1tA0RoqEomnf8xjrvUYh4a=s4800-w1600-h1200',
                heroGoogleAttribution: 'Blake Bishop',
                heroImageSource: 'google_places',
                coverSubject: '秋葉原電氣街',
                coverMapsQuery: 'Akihabara Electric Town Chuo Dori Tokyo',
                coverPlaceId: 'ChIJ__-AdayOGGAR6EGPwvcpzTA',
                coverGooglePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPItBmF2eIxAcm6GMXPTOz5QU1sa-LApntOrszyDk98eo0ocO8SOpKnWz3lqDZkVgjqQ0WpXX-Zh2R6JnVdG11hh07d5LU4NlsCZy4SSSVhnZ6Bo0KIxPKvQP1tA0RoqEomnf8xjrvUYh4a=s4800-w1600-h1200',
                coverGoogleAttribution: 'Blake Bishop',
                coverImageSource: 'google_places',
                issueLabel: '2026 年 6 月號',
                intro: '歡迎來到2026年的東京！六月盛夏，這座城市不僅熱情如火，更瀰漫著一股難以言喻的動漫魔力。從秋葉原的電波系氛圍，到中野百老匯的懷舊寶藏，每個角落都藏著屬於你的故事。準備好跟著我們的腳步，一同穿梭於現實與二次元之間，探索這場視覺與心靈的盛宴了嗎？這趟旅程，將是獻給所有動漫迷的夢幻篇章！',
                sections: [
                    {
                        sectionId: 'akihabara',
                        sectionRole: 'landmark',
                        subjectType: 'district',
                        sectionType: 'landmark',
                        visualKeywords: ['動漫', '霓虹', 'Animate', 'Radio Kaikan', '中央通', '招牌', '秋葉原', '電氣街'],
                        officialName: 'Akihabara Electric Town',
                        officialNameLocal: '秋葉原電気街',
                        aliases: ['Akihabara Electric Town', '秋葉原中央通り', 'ラジオ会館', 'アニメイト秋葉原', 'GIGO秋葉原'],
                        photoIntent: '動漫招牌、霓虹、Radio Kaikan、Animate、GIGO、中央通、人潮、廣角街景',
                        imageChecklist: ['Animate', 'Radio', 'GIGO', '中央通', 'アニメイト', 'ラジオ会館'],
                        imageRejectRules: ['室內房間', '普通人行道', 'pod', 'cinema', 'hotel', 'hostel', 'restaurant', '映画館'],
                        subject: '秋葉原電氣街：動漫聖地巡禮',
                        mapsQuery: 'Akihabara Electric Town',
                        placeId: 'ChIJAVf7lh2MGGARJylRnQ_3dpI',
                        googleRating: 4.5,
                        googleAddress: '〒101-0021 東京都千代田区外神田４丁目３−１',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPMILnrBsPlga96Y5ufCHIO0RbtW_YpeyN5tkGw7i18KvCR8E5yfdln9QGUP9wcKF_y_a55_elxkwZXLnH9aCThqxrb-v_CRjavrAgO4u0G-4E-eGPkcGmMvzhXwRml5Y2xDA8DbVbhxuZIQ0A=s4800-w1600-h1200',
                        googleAttribution: 'Marta',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-akihabara',
                        caption: '街道兩側店招與建築立面清楚可見，街區個性一眼可辨。',
                        secondaryGooglePhotoUrl: null,
                        secondaryGoogleAttribution: null,
                        secondaryCaption: null,
                        heading: '秋葉原：アニメイト尋寶攻略',
                        content: '沿中央通步行，高聳的アニメイト秋葉原是動漫迷的指標。館內七層樓，從漫畫、周邊到限定商品應有盡有，是挖寶首選。這裡總能找到最新發售品與獨家活動，是秋葉原動漫巡禮',
                        editorialMeta: [
                            { icon: '⭐', label: '推薦程度', value: '必訪' },
                            { icon: '⏰', label: '建議停留', value: '2–3 小時' },
                            { icon: '🚉', label: '最近車站', value: 'JR 秋葉原' },
                            { icon: '📷', label: '最佳拍攝', value: '傍晚霓虹時分' }
                        ]
                    },
                    {
                        sectionId: 'nakano',
                        sectionRole: 'anime',
                        subjectType: 'district',
                        sectionType: 'landmark',
                        visualKeywords: ['中野百老匯', 'Nakano Broadway', '公仔', '模型', '復古玩具', '漫畫'],
                        officialName: 'Nakano Broadway',
                        officialNameLocal: '中野ブロードウェイ',
                        aliases: ['Nakano Broadway', 'まんだらけ 中野', 'Mandarake Nakano', 'らしんばん 中野'],
                        photoIntent: 'Mandarake、公仔、模型、漫畫、復古玩具、收藏店、玩具櫃',
                        imageChecklist: ['まんだらけ', 'Mandarake', 'フィギュア', 'figure', '漫画'],
                        imageRejectRules: ['普通走道', 'empty corridor', 'corridor', '住宅', 'hotel', 'lobby', 'entrance'],
                        subject: '中野百老匯：尋寶者的天堂',
                        mapsQuery: 'Nakano Broadway',
                        placeId: 'ChIJg-7dspDyGGARvvDv4E5-tuE',
                        googleRating: 4.2,
                        googleAddress: '〒164-0001 東京都中野区中野５丁目５２−１５',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMigFyleAUe57AfEEaYBxf1hNecm_KlklS3iCWK3vZZpkRFyzvFm49SWH9HhbHzohIRzUzwESCmuih3YmySkxkDnhcNHIiSRDOnBwN8tPeq766Pz16WfbcioTV2FIMdWZuhv2qZ7MVtFZcFzA=s4800-w1600-h1200',
                        googleAttribution: '加藤展康',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-nakano',
                        caption: '中野百老匯商場外牆與入口，是老玩家公認的挖寶起點。',
                        secondaryGooglePhotoUrl: null,
                        secondaryGoogleAttribution: null,
                        secondaryCaption: null,
                        heading: '中野百老匯：老玩家挖寶起點',
                        content: '中野車站北口，步行數分鐘即抵中野ブロードウェイ。這棟複合式商場，是資深動漫迷與收藏家公認的中古寶物殿堂。從稀有漫畫、絕版公仔到懷舊遊戲，琳瑯滿目的珍品在此匯聚。耐心尋覓，總能挖到屬於你的獨家收藏。',
                        editorialMeta: [
                            { icon: '⭐', label: '推薦程度', value: '老玩家必訪' },
                            { icon: '⏰', label: '建議停留', value: '2 小時以上' },
                            { icon: '🚉', label: '最近車站', value: 'JR 中野（北口）' },
                            { icon: '🛍', label: '必挖', value: '中古公仔・卡牌' }
                        ]
                    },
                    {
                        sectionId: 'gachapon',
                        sectionRole: 'anime',
                        sectionType: 'shopping',
                        visualKeywords: ['扭蛋', 'GACHAPON', '轉蛋', '機台', 'capsule'],
                        officialName: 'Gashapon Department Store Ikebukuro',
                        officialNameLocal: 'ガシャポン百貨店 池袋総本店',
                        aliases: ['Gachapon Kaikan', 'ガチャポン会館', 'Akihabara Gachapon Hall'],
                        photoIntent: '整排扭蛋機、扭蛋牆、膠囊玩具、色彩豐富、ガチャ',
                        imageChecklist: ['ガチャ', 'gachapon', 'capsule', '扭蛋', 'gashapon', 'ガチャポン'],
                        imageRejectRules: ['外観', 'facade', 'exterior', 'storefront', '空桌', '走廊', 'hotel', 'restaurant'],
                        subject: '扭蛋會館：驚喜轉不停',
                        mapsQuery: 'Gashapon Department Store Ikebukuro',
                        placeId: 'ChIJBztW3x2MGGARadHYl5vTEK0',
                        googleRating: 4,
                        googleAddress: '〒101-0021 東京都千代田区外神田３丁目１５−５ MNビル 1F',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AG9NLjCqVwK2qLVKXEt_6P5oaH7y360WlZjzeW6pkuBwNg67f8JQB56zAoR0dAnS1QRETsa4kdmaPqv0gWANpkS_f1LrYcROCOJZsPm2wGDeasqryUkWAg8czyveq-u77cIE-0jAOC6DTADOVQK48GHdXKY8bA=s4800-w1600-h1200',
                        googleAttribution: 'Loki',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-gachapon',
                        caption: '整排扭蛋機一路延伸，色彩與機台本身就是風景。',
                        secondaryGooglePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AG9NLjBK_tB9VervAAKptY4gJl5U0Icc70nGcqXU5swBoIYYDomxJPHMVBIFnPVCEziSFM7qRz-LaFuKM8MA6sTx_xTVaXxcA_OwqOMm0OSNfBDAq8M3s2dRoM_rfQ-4fi73d8PTxeHNd_Mfq2k_HA=s4800-w1600-h1200',
                        secondaryGoogleAttribution: 'iris soh',
                        secondaryCaption: '整排扭蛋機一路延伸，色彩與機台本身就是風景。',
                        heading: '秋葉原扭蛋會館：百機攻略',
                        content: '位於外神田三丁目的秋葉原ガチャポン会館，整面扭蛋牆綿延不絕，數百台機台從動漫角色到日常小物應有盡有。面對這片色彩風景，建議先設定預算，鎖定目標，才能在琳瑯滿目的機海中，精準挖到心儀逸品。',
                        editorialMeta: [
                            { icon: '⏰', label: '建議停留', value: '20–40 分鐘' },
                            { icon: '✨', label: '特色', value: '整面扭蛋牆、期間限定機台' },
                            { icon: '🎁', label: '限定扭蛋', value: '季節聯名・地區限定' },
                            { icon: '🔥', label: 'Tips', value: '先逛後轉，設定上限再出手' }
                        ]
                    },
                    {
                        sectionId: 'ichiran',
                        sectionRole: 'food',
                        sectionType: 'food',
                        visualKeywords: ['拉麵', '醬油', '湯頭', '田中そば', 'soba', 'ramen'],
                        officialName: 'Ichiran Ramen Shinjuku',
                        officialNameLocal: '一蘭ラーメン 新宿店',
                        aliases: ['Ichiran', '一蘭', '一蘭ラーメン'],
                        photoIntent: '店門口、招牌、外觀優先，其次拉麵本體',
                        imageChecklist: ['ラーメン', 'ramen', 'Ichiran', '一蘭', '拉麵', '味集中'],
                        imageRejectRules: ['空桌', 'bathroom', 'parking'],
                        subject: '一蘭拉麵：獨享美味的秘密',
                        mapsQuery: '一蘭ラーメン 新宿店 Tokyo',
                        placeId: 'ChIJ8QwFX9qMGGARVm0p0caIeTk',
                        googleRating: 4.2,
                        googleAddress: '〒160-0022 東京都新宿区新宿３丁目３４−１１ ピースビル B1F',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMdIBczI4Wdv05GbKUV8w1yDgc_fn7ngocMZvWzvG9yW4EKSMdDxNgIGlLFWoFOlGeBsgRb90OG_W7abMBGJCQd-W31FjBqOAiaFOpG4B3Y8WZWxRthNb_XZ0IAhjRfaQ_0Yy1ov6PNJa7Qr-RHkz1O=s4800-w1600-h1200',
                        googleAttribution: 'yuka sake',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-ichiran',
                        caption: '一蘭新宿中央東口店的外觀與入口清楚可見，方便對照地圖找路。',
                        secondaryGooglePhotoUrl: null,
                        secondaryGoogleAttribution: null,
                        secondaryCaption: null,
                        heading: '新宿中央東口一蘭：獨享豚骨拉麵',
                        content: '一蘭新宿中央東口店以濃郁豚骨湯頭聞名，透過點餐紙客製化麵條硬度與湯頭濃度，是其魅力。尖峰時段雖需排隊，但獨特味集中座讓食客專注品嚐。從新宿站東口步行五分即達，是動漫挖寶後的最佳補給點。',
                        editorialMeta: [
                            { icon: '🍜', label: '推薦餐點', value: '醬油拉麵' },
                            { icon: '💴', label: '預算', value: '¥900–1,200' },
                            { icon: '⏰', label: '建議停留', value: '30–45 分鐘' }
                        ]
                    },
                    {
                        sectionId: 'maid-cafe',
                        sectionRole: 'cafe',
                        sectionType: 'cafe',
                        visualKeywords: ['女僕', '咖啡', '甜點', 'maid', '主題咖啡'],
                        officialName: 'Maidreamin Akihabara Main Store',
                        officialNameLocal: 'めいどりーみん 秋葉原 本店',
                        aliases: ['maidreamin', 'メイドリーミン', 'Maid Cafe Akihabara', 'メイドカフェ 秋葉原'],
                        photoIntent: '女僕服裝、店內互動或店門口優先，甜點次之',
                        imageChecklist: ['maid', 'メイド', 'costume', '女僕', 'cafe', 'カフェ', 'interior'],
                        imageRejectRules: ['logo', '招牌のみ', 'sign only', '走廊', 'hotel', 'hostel', 'empty table'],
                        subject: '女僕咖啡廳：萌萌的魔法體驗',
                        mapsQuery: 'Maidreamin Akihabara Main Store',
                        placeId: 'ChIJyR7AdR6MGGAROowxIYdMsj0',
                        googleRating: 4.9,
                        googleAddress: '〒101-0021 東京都千代田区外神田３丁目１６−１７ 住吉ビル 6階',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNITb7PuqmPsudYDTtK9E7G0BJy34Ym29KpPImatViUdPPaAOwdBGVILsi6ZZ0zaVas3YTwRdCkhSNXnz2qF_T7Eizx0f0V8CMZtGj7uEzLotBwMGA4RUC88pNfpQiO1EE8nvJpBRgN8J40krOFa-uDFA=s4800-w543-h345',
                        googleAttribution: 'めいどりーみん 秋葉原 本店',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-maid-cafe',
                        caption: 'めいどりーみん秋葉原本店的外觀與入口清楚可見，方便對照地圖找路。',
                        secondaryGooglePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPm6ky5pnCyu6UMabQZ4Uf6cGN8-RgpXVgWx4o2q2MbFIL_8Q9yRcbixgxSqkeegO6NWqBfjglYtNrF2kQAAzklifkYPWTsM8LTcP4RLMRu5BDMr-vwRP7JbNFnX9RBeBwFx4aS-1XFHAlUJ0MwYURciw=s4800-w1600-h1200',
                        secondaryGoogleAttribution: 'めいどりーみん 秋葉原 本店',
                        secondaryCaption: '主題內裝與座位區呈現店內氛圍，一眼就知道這是主題咖啡廳。',
                        heading: '秋葉原：めいどりーみん本店',
                        content: '位於秋葉原外神田三丁目住吉ビル6樓的めいどりーみん本店，是電氣街女僕咖啡的經典。入店低消一份餐飲，可與女僕互動施展「萌萌心動魔法」。店內禁止拍攝女僕，餐點則可自由記錄。想體驗秋葉原文化，此處提供道地且趣味的交流。',
                        editorialMeta: [
                            { icon: '⏰', label: '建議停留', value: '45–60 分鐘' },
                            { icon: '💴', label: '預算', value: '¥1,500–3,000' },
                            { icon: '🔥', label: '小 Tips', value: '先確認低消與拍照規則' }
                        ]
                    },
                    {
                        sectionId: 'nui-hostel',
                        sectionRole: 'hostel',
                        sectionType: 'hostel',
                        visualKeywords: ['hostel', '旅館', 'Grids', '浅草橋', '交誼廳'],
                        officialName: 'Grids Tokyo Asakusabashi Hotel&Hostel',
                        officialNameLocal: 'グリッズ 東京 浅草橋 ホテル & ホステル',
                        aliases: ['Grids Tokyo Asakusabashi', 'グリッドホテル浅草橋', 'GRIDS HOSTEL'],
                        photoIntent: '旅宿外觀、入口優先，其次交誼廳，最後客房',
                        imageChecklist: ['facade', 'exterior', '外観', 'lounge', 'bar', 'room', 'hostel'],
                        imageRejectRules: ['parking', 'restaurant only', 'resort', 'pool', 'unmade', 'messy bed'],
                        subject: 'グリッズ 東京 浅草橋 ホテル & ホステル',
                        mapsQuery: 'グリッズ 東京 浅草橋 ホテル & ホステル Tokyo',
                        placeId: 'ChIJjTWKIa6OGGAR6kmG9UpLIIU',
                        googleRating: 4.5,
                        googleAddress: '〒111-0053 東京都台東区浅草橋４丁目１１−６',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPb6mT4en-v58XQEAi1EHk2n4CX-XKv-g5LjVyWQEkkNbPIz_wRzThp0y22bfqYqMUHDO8O88VkglbtE85BV_VYx2YrIIUYG1XlH0jJC5yzlOtmT9cQletlHlI2bhJHUk3fUDIVilwT7Fbnhrw=s4800-w1600-h1200',
                        googleAttribution: '百目木陽介',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-nui-hostel',
                        caption: 'グリッズ東京浅草橋ホテル&ホステル的建築外觀與入口，從街上就能確認位置。',
                        secondaryGooglePhotoUrl: null,
                        secondaryGoogleAttribution: null,
                        secondaryCaption: null,
                        heading: 'グリッズ 東京 浅草橋 ホテル & ホステル · 設計感旅宿落腳',
                        content: '淺草橋一帶的グリッズ 東京 浅草橋 ホテル & ホステル，簡潔客房、公共吧台、交誼空間，適合獨旅或預算控管。從淺草橋站步行數分鐘，搭 JR 總武線往秋葉原約 5 分鐘。週末床位記得提早訂。',
                        editorialMeta: [
                            { icon: '⭐', label: '推薦程度', value: '預算型首選' },
                            { icon: '💴', label: '預算', value: '¥3,500–6,000／晚' },
                            { icon: '🚉', label: '最近車站', value: '淺草橋・蔵前' }
                        ]
                    },
                    {
                        sectionId: 'hotel-gracery',
                        sectionRole: 'hotel',
                        sectionType: 'hotel',
                        visualKeywords: ['飯店', '外觀', '秋葉原', 'remm', 'レム'],
                        officialName: 'Hotel Gracery Shinjuku',
                        officialNameLocal: 'ホテルグレイスリー新宿',
                        aliases: ['Gracery Shinjuku', '格拉斯麗', '哥吉拉酒店', 'Godzilla Hotel'],
                        photoIntent: '飯店外觀、建築入口優先，其次 Lobby，最後客房',
                        imageChecklist: ['facade', 'exterior', '外観', 'entrance', 'lobby', 'room', 'ホテル'],
                        imageRejectRules: ['parking', 'garage', 'restaurant only', 'resort', 'pool', 'unmade', 'messy bed'],
                        subject: '新宿格拉斯麗酒店：哥吉拉的守護',
                        mapsQuery: 'Hotel Gracery Shinjuku Tokyo Japan',
                        placeId: 'ChIJzRzI3HSNGGARRwZW6AtJfi0',
                        googleRating: 4.2,
                        googleAddress: '〒160-0021 東京都新宿区歌舞伎町１丁目１９−１',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AG9NLjAbdKdG3LwLmw0gN6YvsvSbNKXYCTaVSFRdJ2WS5iPqwQwZBZfhzafL02E0F1M7IRbRwK2fCISmU4DG_Mn0fcqo0PKWTviE0bHF6ESMD49rhfJinnjyg-y-EFer3nKGFRf1vrBM0cUL3EUmXQ=s4800-w1600-h1200',
                        googleAttribution: 'S H',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-hotel-gracery',
                        caption: 'ゴジラヘッド的外觀與入口清楚可見，方便對照地圖找路。',
                        secondaryGooglePhotoUrl: null,
                        secondaryGoogleAttribution: null,
                        secondaryCaption: null,
                        heading: '新宿格拉斯麗酒店：哥吉拉的守護',
                        content: '提到新宿格拉斯麗，最吸睛的莫過於矗立在樓頂的巨大哥吉拉頭像！這不僅是酒店特色，更是新宿的地標。酒店位置優越，房間舒適，部分客房還能近距離欣賞哥吉拉。夜晚，哥吉拉的眼睛會發光，為你的東京之夜增添一份奇幻色彩。',
                        editorialMeta: [
                            { icon: '⭐', label: '推薦程度', value: '交通首選' },
                            { icon: '🚉', label: '最近車站', value: 'JR 秋葉原（1 分鐘）' },
                            { icon: '💴', label: '預算', value: '¥10,000–16,000／晚' }
                        ]
                    }
                ],
                outro: '東京的動漫之旅，總是充滿無限驚喜與感動。無論是沉浸在女僕咖啡的萌系魔法，還是獨享一蘭拉麵的溫暖滋味，每段體驗都將成為你珍貴的回憶。當哥吉拉在新宿夜空下靜靜守望，你會發現，這座城市不僅是動漫的發源地，更是能讓夢想成真的地方。期待下次再見，在東京的某個角落，再次與動漫相遇！',
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
