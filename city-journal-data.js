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
                heroOfficialName: 'Radio Kaikan',
                heroOfficialNameLocal: 'ラジオ会館',
                heroMapsQuery: 'Radio Kaikan Akihabara Tokyo',
                heroVisualKeywords: ['Radio Kaikan', 'ラジオ会館', 'Animate', '秋葉原', '霓虹', '中央通'],
                heroPlaceId: 'ChIJ__-AdayOGGAR6EGPwvcpzTA',
                heroGooglePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMe_u7MHUCtlmxvi13hLlj_FIl2RMOOCKW3CCVYv3Cp4EWxCPX4UQxR5qNsCctYBZrL5atHBIA5y_7KDn6C2PlvdKqP63yXJmRvc9VHvN58W52s3N6NPDZHw2gBhhGcE2epbscAsfwIaTkEV9c=s4800-w1600-h1200',
                heroGoogleAttribution: 'David Di',
                heroImageSource: 'google_places',
                coverSubject: '秋葉原電氣街',
                coverMapsQuery: 'Radio Kaikan Akihabara Tokyo',
                coverPlaceId: 'ChIJ__-AdayOGGAR6EGPwvcpzTA',
                coverGooglePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZMe_u7MHUCtlmxvi13hLlj_FIl2RMOOCKW3CCVYv3Cp4EWxCPX4UQxR5qNsCctYBZrL5atHBIA5y_7KDn6C2PlvdKqP63yXJmRvc9VHvN58W52s3N6NPDZHw2gBhhGcE2epbscAsfwIaTkEV9c=s4800-w1600-h1200',
                coverGoogleAttribution: 'David Di',
                coverImageSource: 'google_places',
                issueLabel: '2026 年 6 月號',
                intro: '動漫迷走東京，往往不是在趕行程，而是在電氣街與中野之間反覆迷路。Radio Kaikan 的模型櫥窗、Animate 本館的人潮、中野百老匯 Mandarake 深處那排中古公仔——真正讓人停下腳步的，從來不是「必買清單」，而是某個轉角突然對上了記憶裡的角色。這篇路線，想把這種節奏留給你。',
                sections: [
                    {
                        sectionId: 'akihabara',
                        sectionRole: 'landmark',
                        sectionType: 'landmark',
                        visualKeywords: ['動漫', '霓虹', 'Animate', 'Radio Kaikan', '中央通', '招牌', '秋葉原', '電氣街'],
                        officialName: 'Akihabara Electric Town',
                        officialNameLocal: '秋葉原電気街',
                        aliases: ['Akihabara Electric Town', '秋葉原中央通り', 'ラジオ会館', 'アニメイト秋葉原', 'GIGO秋葉原'],
                        photoIntent: '動漫招牌、霓虹、Radio Kaikan、Animate、GIGO、中央通、人潮、廣角街景',
                        imageChecklist: ['Animate', 'Radio', 'GIGO', '中央通', 'アニメイト', 'ラジオ会館'],
                        imageRejectRules: ['室內房間', '普通人行道', 'pod', 'cinema', 'hotel', 'hostel', 'restaurant', '映画館'],
                        subject: '秋葉原電氣街',
                        mapsQuery: 'Akihabara Electric Town Tokyo Japan',
                        placeId: 'ChIJ__-AdayOGGAR6EGPwvcpzTA',
                        googleRating: 4.5,
                        googleAddress: '〒101-0021 東京都千代田区外神田１丁目１５−１６',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZPBhCe7ID8YhpkgYpjj7i3ft7MBO85EcaEJy48A8o9tplrjK28bV-k0DGBsuoglvDfeXYyx6M3Md7vkzOmYK2U32yaroLAJxl4WDxDzVyOicV-diOLxWqWuZaDhE2eM1_B8eKXjEYk2QGNDhrQOuAi29w=s4800-w1600-h1200',
                        googleAttribution: 'Giampaolo Mancinelli',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-akihabara',
                        caption: 'RadioKaikan外牆滿版動漫廣告，是秋葉原最醒目的地標之一。',
                        heading: '秋葉原電氣街 · 動漫朝聖的起點',
                        content: '從 JR 秋葉原站電氣街口跨出去，中央通兩側的動漫招牌幾乎不給人思考的時間。Radio Kaikan 的模型櫥窗、Animate 本館的人潮、GIGO 大型看板——這裡不是單一景點，而是一整片會讓人自然放慢步調的街區。上午十點前人潮還算溫和，先把 Animate 與最想逛的兩間店鎖定；午後再鑽進卡牌專賣與地下復古遊戲機。傍晚霓虹亮起，電氣街才進入主場，廣角拍中央通最剛好。帶現金與行動電源，這條路線通常比預期多留兩小時。',
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
                        sectionType: 'landmark',
                        visualKeywords: ['中野百老匯', 'Nakano Broadway', '公仔', '模型', '復古玩具', '漫畫'],
                        officialName: 'Nakano Broadway',
                        officialNameLocal: '中野ブロードウェイ',
                        aliases: ['Nakano Broadway', 'まんだらけ 中野', 'Mandarake Nakano', 'らしんばん 中野'],
                        photoIntent: 'Mandarake、公仔、模型、漫畫、復古玩具、收藏店、玩具櫃',
                        imageChecklist: ['まんだらけ', 'Mandarake', 'フィギュア', 'figure', '漫画'],
                        imageRejectRules: ['普通走道', 'empty corridor', 'corridor', '住宅', 'hotel', 'lobby', 'entrance'],
                        subject: '中野百老匯',
                        mapsQuery: 'Nakano Broadway Tokyo Japan',
                        placeId: 'ChIJg-7dspDyGGARvvDv4E5-tuE',
                        googleRating: 4.2,
                        googleAddress: '5-chōme-52-15 Nakano, Nakano City, Tokyo 164-0001, Japan',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZNAOy_7kERNJmtGUYvQgLCLCgb-RDqpAkzvQPNUTJtnF3UQiD3fNhYbhWkYi0d3nII7xYJs3R0tPfqfJnggGN8MFzRmRqmapqgkTs6qOXPt-uz__bLwuCxrtSyloOiheshaUZdD0FLEh-bzr7Ma0Mk9-g=s4800-w1600-h1200',
                        googleAttribution: 'Alejandro arruebo rello',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-nakano',
                        caption: 'Mandarake櫥窗擺滿模型與收藏品，是動漫迷最容易停下腳步的地方。',
                        heading: '中野百老匯 · 老玩家公認的挖寶聖地',
                        content: 'JR 中野站北口走五分鐘，中野百老匯的電梯一開就是另一種東京。Mandarake 各樓層擠滿中古公仔、模型、卡牌與復古漫畫，價格常有意外驚喜；らしんばん 等店也適合比價。下午光線較暖，邊逛邊翻櫃剛好。預留兩小時以上，這座寶庫很少讓人空手而回。',
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
                        officialName: 'Akihabara Gachapon Hall',
                        officialNameLocal: '秋葉原ガチャポン会館',
                        aliases: ['Gachapon Kaikan', 'ガチャポン会館', 'Akihabara Gachapon Hall'],
                        photoIntent: '整排扭蛋機、扭蛋牆、膠囊玩具、色彩豐富、ガチャ',
                        imageChecklist: ['ガチャ', 'gachapon', 'capsule', '扭蛋', 'gashapon', 'ガチャポン'],
                        imageRejectRules: ['外観', 'facade', 'exterior', 'storefront', '空桌', '走廊', 'hotel', 'restaurant'],
                        subject: 'GACHAPON 扭蛋會館',
                        mapsQuery: 'Gachapon Kaikan Akihabara Tokyo',
                        placeId: 'ChIJBztW3x2MGGARadHYl5vTEK0',
                        googleRating: 4,
                        googleAddress: 'Japan, 〒101-0021 Tokyo, Chiyoda City, Sotokanda, 3-chōme−15−５ MNビル 1F',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOM39L_gKxeukZKY6FOuRhy_XmTZ0TGqVFkTRGDzpfTK6uybViVzstbpOQWKZEIKAWaFRln0GIYh-qNr5c53EURn__O9qtV-sPf62Ft32yJ9WFBHxfcqr2AELVO85RnP77GlG0uRcXdCpAJsub0d5z5hw=s4800-w1600-h1200',
                        googleAttribution: 'Loki',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-gachapon',
                        caption: '整排扭蛋機一路延伸，形成動漫迷最熟悉的風景。',
                        heading: 'GACHAPON 扭蛋會館 · 整面牆都是驚喜',
                        content: '整面牆的扭蛋機，轉一圈就可能入坑。先設定預算上限，再開始試手氣——這是過來人的溫柔提醒。',
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
                        officialName: 'Ramen Tanaka Soba Akihabara',
                        officialNameLocal: '田中そば店 秋葉原店',
                        aliases: ['田中そば', 'Tanaka Soba Akihabara'],
                        photoIntent: '拉麵本體、醬油湯頭、店內吧台、熱湯、ラーメン',
                        imageChecklist: ['ラーメン', 'ramen', 'soba', '田中', '拉麵', '麺'],
                        imageRejectRules: ['空桌', 'bathroom', 'parking'],
                        subject: '田中そば店 秋葉原店',
                        mapsQuery: '田中そば店 秋葉原店',
                        placeId: 'ChIJXTeLYx6MGGARNivhJ55nYVw',
                        googleRating: 4.2,
                        googleAddress: 'Japan, 〒101-0021 Tokyo, Chiyoda City, Sotokanda, 3-chōme−8−３ 第一針谷ビル1Ｆ',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOGemMyCtJtY4ox-MzrD_2Fp17Y0I5GL86Zm9pQurcbB-bI0PQv_Q4EUDaZ8DmGg7H1Y90XGFKR-PYoKGIV96H9sdSyy4qaU3nuj2ojgnhZyayXtho9WyL-SeBLUw9kOyTsK1tTLVudpfkUsbivMY7b9A=s4800-w1600-h1200',
                        googleAttribution: '田中そば店 秋葉原店',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-ichiran',
                        caption: '醬油湯頭與熱氣一同上桌，掃街中途最剛好的補給。',
                        heading: '田中そば店 秋葉原店 · 掃街中途的熱湯補給',
                        content: '醬油湯頭、出餐快，午餐控制在三十分鐘內剛好。尖峰時段先排隊，再回周邊繼續逛。',
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
                        officialName: 'MAID MADE Akihabara',
                        officialNameLocal: 'メイドメイド秋葉原駅前店',
                        aliases: ['MAID MADE', 'Maid Cafe Akihabara', 'メイドカフェ 秋葉原'],
                        photoIntent: '甜點、飲品、店內氛圍、主題內裝，不要只有 Logo',
                        imageChecklist: ['dessert', '甜點', 'drink', 'maid', 'メイド', 'cafe', 'カフェ'],
                        imageRejectRules: ['走廊', 'hotel', 'hostel', 'empty table'],
                        subject: '女僕咖啡廳 秋葉原',
                        mapsQuery: 'MAID MADE Akihabara Tokyo',
                        placeId: 'ChIJvQtxBAaNGGARTiTMJ-Nzhvc',
                        googleRating: 4.9,
                        googleAddress: 'Japan, 〒101-0021 Tokyo, Chiyoda City, Sotokanda, 1-chōme−15−13 秋葉原 神田B&Vビル 10F',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOUyqgrwMTWl3lM7gnXTjGrq0OuwG8yLijBp-k410VbbmkroisVOrm5NILgikRmtlqjzAtG1pd8EyXECtZzlC_FpQcH22M_iV2Mmpgi9fCyWeO7q1GGLMRga64V2_BZRRlifLk4afANyDmmQDM=s4800-w1365-h1200',
                        googleAttribution: 'MAID MADE 秋葉原駅前店',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-maid-cafe',
                        caption: '繽紛甜點與主題內裝並陳，把次文化體驗留在味蕾裡。',
                        heading: '秋葉原女僕咖啡廳街 · 次文化體驗的一杯咖啡',
                        content: '第一次體驗，選評價穩定、規則說明清楚的分店。把時間控制在六十分鐘內，留體力給下一間店。',
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
                        visualKeywords: ['hostel', '旅館', '吧台', '交誼廳', 'Nui'],
                        officialName: 'Nui. Hostel & Bar Lounge',
                        officialNameLocal: 'Nui. HOSTEL & BAR LOUNGE',
                        aliases: ['Nui Hostel Tokyo', 'Nui Hostel Kuramae'],
                        photoIntent: '客房、公共吧台、交誼廳、Lobby 優先，外觀次之',
                        imageChecklist: ['room', 'dorm', 'bar', 'lounge', 'Nui', 'hostel', 'ゲスト'],
                        imageRejectRules: ['parking', 'restaurant only', 'resort', 'pool'],
                        subject: 'Nui Hostel Tokyo',
                        mapsQuery: 'Nui Hostel & Bar Tokyo',
                        placeId: 'ChIJ4U-9KsiOGGARARhaBLZLqS0',
                        googleRating: 4.5,
                        googleAddress: '2-chōme-14-13 Kuramae, Taito City, Tokyo 111-0051, Japan',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZOg1D6WHfL76qkS3u8ZK4ZR8yjf4PbugRRaJ8bEYBjm_SHD15dCuMOHPD6S-xnMoWruo7mp8q-OuZsIcdTeoQhhbFbjaDsk5d2RvaKbI7C-CHqTPUgWSyjZj8PX7ieI7x3ljXCjmeUZEvxJTWc=s4800-w1600-h1200',
                        googleAttribution: 'Nui. HOSTEL & BAR LOUNGE',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-nui-hostel',
                        caption: '木質吧台夜間仍聚集旅人，交換著下一站的行程。',
                        heading: 'Nui Hostel Tokyo · 淺草橋的設計旅宿',
                        content: '離電氣街稍遠，搭 JR 往返仍方便。公共吧台與交誼廳氣氛輕鬆，獨旅或預算控管都合適。週末床位記得提早訂。',
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
                        visualKeywords: ['飯店', '外觀', '秋葉原', '華盛頓', 'Washington Hotel'],
                        officialName: 'Akihabara Washington Hotel',
                        officialNameLocal: '秋葉原ワシントンホテル',
                        aliases: ['Washington Hotel Akihabara', 'アキハバラワシントンホテル'],
                        photoIntent: '客房、Lobby、公共空間優先，外觀次之',
                        imageChecklist: ['room', 'lobby', 'Washington', 'ワシントン', 'ホテル', 'hotel'],
                        imageRejectRules: ['parking', 'garage', 'restaurant only', 'resort', 'pool'],
                        subject: '秋葉原ワシントンホテル',
                        mapsQuery: 'Akihabara Washington Hotel Tokyo',
                        placeId: 'ChIJnxZoFqiOGGAReYJ1ck2lXiw',
                        googleRating: 4.2,
                        googleAddress: 'Japan, 〒101-0025 Tokyo, Chiyoda City, Kanda Sakumachō, 1-chōme−８−３',
                        googlePhotoUrl: 'https://lh3.googleusercontent.com/place-photos/AJRVUZO5mjU060YMfaX123P9xa7rDCN-4bHqGwEr0YStpDQkeTyLQwmXir8w3mcubMptYWGSI0GuQZ4if38Wr6X9AN1IxFP4BuRNVz1ESlu6TBxM7eda3t9_XM1QunWjjbICJ-nGD694I-bkg5cvy3Q=s4800-w1600-h1200',
                        googleAttribution: '秋葉原ワシントンホテル',
                        imageSource: 'google_places',
                        imageKey: 'tokyo-section-hotel-gracery',
                        caption: '木質吧台夜間仍聚集旅人，交換著下一站的行程。',
                        heading: '秋葉原ワシントンホテル · 步行可達電氣街',
                        content: 'JR 秋葉原站中央改札口步行約一分鐘，是把時間留給街上的務實落腳處。以秋葉原為基地、搭山手線一站前往中野，動線直覺。展期與週末記得提早訂房。',
                        editorialMeta: [
                            { icon: '⭐', label: '推薦程度', value: '交通首選' },
                            { icon: '🚉', label: '最近車站', value: 'JR 秋葉原（1 分鐘）' },
                            { icon: '💴', label: '預算', value: '¥10,000–16,000／晚' }
                        ]
                    }
                ],
                outro: '秋葉原與中野都在山手線上，Suica 或 Pasmo 就夠用。上午留給秋葉原電氣街，下午搭一站到 JR 中野挖 Mandarake，傍晚回秋葉原轉扭蛋、補一碗拉麵。行李留一點空格，行動電源充飽——這條路線通常會比預期多留一兩個小時，而東京動漫巡禮最動人的，往往就在多出來的那一段路。',
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
