(function (global) {
    'use strict';

    var EDITION_CATALOG = [
        { key: 'budget', label: '小資旅行', icon: '💰' },
        { key: 'sightseeing', label: '初次觀光', icon: '🗺️' },
        { key: 'trendy', label: '新潮熱門', icon: '⚡' },
        { key: 'foodie', label: '美食吃貨', icon: '🍜' },
        { key: 'photospot', label: '網美必拍', icon: '📸' },
        { key: 'anime', label: '玩具動漫', icon: '🎮' },
        { key: 'streetwear', label: '潮流玩家', icon: '👟' }
    ];

    var TOKYO_HUB_HERO = 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=1600';

    var META = {
        tokyo: {
            id: 'tokyo',
            name: '東京',
            nameEn: 'TOKYO',
            destinationLabel: '東京',
            heroImage: TOKYO_HUB_HERO,
            hubHeroImage: TOKYO_HUB_HERO,
            hubSubtitle: '七種節奏，讀懂這座永遠不睡的城市',
            publishedEditions: ['anime']
        },
        kyoto: {
            id: 'kyoto',
            name: '京都',
            nameEn: 'KYOTO',
            destinationLabel: '京都',
            heroImage: 'https://images.pexels.com/photos/2169880/pexels-photo-2169880.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubHeroImage: 'https://images.pexels.com/photos/2169880/pexels-photo-2169880.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        osaka: {
            id: 'osaka',
            name: '大阪',
            nameEn: 'OSAKA',
            destinationLabel: '大阪',
            heroImage: 'https://images.pexels.com/photos/2404843/pexels-photo-2404843.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubHeroImage: 'https://images.pexels.com/photos/2404843/pexels-photo-2404843.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        seoul: {
            id: 'seoul',
            name: '首爾',
            nameEn: 'SEOUL',
            destinationLabel: '首爾',
            heroImage: 'https://images.pexels.com/photos/358442/pexels-photo-358442.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubHeroImage: 'https://images.pexels.com/photos/358442/pexels-photo-358442.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        hokkaido: {
            id: 'hokkaido',
            name: '北海道',
            nameEn: 'HOKKAIDO',
            destinationLabel: '北海道',
            heroImage: 'https://images.pexels.com/photos/1570118/pexels-photo-1570118.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubHeroImage: 'https://images.pexels.com/photos/1570118/pexels-photo-1570118.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        bangkok: {
            id: 'bangkok',
            name: '曼谷',
            nameEn: 'BANGKOK',
            destinationLabel: '曼谷',
            heroImage: 'https://images.pexels.com/photos/3182463/pexels-photo-3182463.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubHeroImage: 'https://images.pexels.com/photos/3182463/pexels-photo-3182463.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        vietnam: {
            id: 'vietnam',
            name: '越南',
            nameEn: 'VIETNAM',
            destinationLabel: '越南',
            heroImage: 'https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubHeroImage: 'https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        london: {
            id: 'london',
            name: '倫敦',
            nameEn: 'LONDON',
            destinationLabel: '倫敦',
            heroImage: 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubHeroImage: 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=1600',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        },
        paris: {
            id: 'paris',
            name: '巴黎',
            nameEn: 'PARIS',
            destinationLabel: '巴黎',
            heroImage: 'https://images.pexels.com/photos/2363/france-landmark-lights-night.jpg?auto=compress&cs=tinysrgb&w=1600',
            hubHeroImage: 'https://images.pexels.com/photos/2363/france-landmark-lights-night.jpg?auto=compress&cs=tinysrgb&w=1600',
            hubSubtitle: '專題即將推出',
            publishedEditions: []
        }
    };

    var ARTICLES = {
        tokyo: {
            anime: {
                id: 'tokyo-anime',
                cityId: 'tokyo',
                styleKey: 'anime',
                status: 'published',
                title: '秋葉原與中野：東京動漫聖地巡禮指南',
                subtitle: '從一番賞到復古玩具，骨灰級玩家的 48 小時地圖',
                heroImage: 'https://images.pexels.com/photos/32433838/pexels-photo-32433838/free-photo-of-vibrant-akihabara-street-at-night-in-tokyo.jpeg?auto=compress&cs=tinysrgb&w=1600',
                introImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&q=80',
                introImageCaption: '秋葉原電氣街入夜後，霓虹招牌與模型櫥窗交織成動漫迷熟悉的風景。',
                issueDate: '2026-06',
                issueLabel: '2026 年 6 月號',
                intro: '東京對動漫迷而言，從來不是「去幾個景點打卡」就能結束的旅程。這座城市把次文化藏進電氣街的霓虹裡、藏進中野百老匯的二手櫃位中，也藏進巷弄轉角那台你以為只是路過的扭蛋機。動漫系東京旅行的核心，不是趕場把清單劃掉，而是以 2 到 3 小時為單位做「塊狀掃街」：先鎖定一番賞現貨與期間限定，再慢慢挖中古公仔、模型與冷門周邊。你不需要成為資深藏家才能玩得盡興——但你需要一份把體力留給真正想逛的店的節奏。這篇專題為第一次以動漫視角認識東京的旅人，也為想重溫聖地、更新地圖的老玩家而寫。最佳季節是春秋兩季，步行舒適、排隊壓力較小；若逢週末或連假，熱門店建議開店前 30 分鐘抵達。帶上空行李箱的一格、行動電源，以及一顆願意在冷門樓層多繞一圈的心——東京會在你以為已經逛完時，再送出一個驚喜。',
                spots: [
                    {
                        id: 'spot-akihabara',
                        name: '秋葉原電氣街',
                        nameLocal: '秋葉原電気街',
                        subhead: '動漫朝聖的起點',
                        image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1600&q=80',
                        imageCaption: '秋葉原電氣街主幹道，電器行與動漫店櫥窗連成一片。',
                        imageKey: 'tokyo-akihabara',
                        intro: '東京動漫朝聖的起點。高樓與巷弄交錯，從大型連鎖動漫店到地下卡牌、模型專賣應有盡有。建議從 JR 秋葉原站電氣街口出發，先逛 2 至 3 間主題明確的店，避免在第一眼就被拉進無限迴圈。',
                        nearestStation: 'JR 秋葉原站（電氣街口）',
                        area: '千代田區・秋葉原',
                        rating: 4.5
                    },
                    {
                        id: 'spot-nakano',
                        name: '中野百老匯',
                        nameLocal: '中野ブロードウェイ',
                        subhead: '老玩家公認的挖寶聖地',
                        image: 'https://images.unsplash.com/photo-1601814933827-fca82567c22b?w=1600&q=80',
                        imageCaption: '中野百老匯樓層內，公仔與漫畫櫃位密集排列的尋寶空間。',
                        imageKey: 'tokyo-nakano-broadway',
                        intro: '被許多老玩家視為比秋葉原更好挖寶的聖地。多層樓匯集漫畫、公仔、卡牌與復古玩具，價格常有驚喜。適合下午進場，光線較暖，邊逛邊比價，預留至少 2 小時。',
                        nearestStation: 'JR 中野站（北口）',
                        area: '中野区・中野',
                        rating: 4.4
                    },
                    {
                        id: 'spot-gachapon',
                        name: 'GACHAPON 扭蛋會館',
                        nameLocal: 'ガシャポンのデパート',
                        subhead: '整面牆都是驚喜',
                        image: 'https://images.unsplash.com/photo-1613376021183-4127bb866ebd?w=1600&q=80',
                        imageCaption: '秋葉原扭蛋會館內，成排膠囊玩具機台組成的色彩牆。',
                        imageKey: 'tokyo-gachapon-hall',
                        intro: '秋葉原周邊知名的扭蛋專門空間，整面牆的機台適合快速試手氣與收藏入門。建議先設定預算上限，避免不知不覺轉到行李箱爆滿——這是過來人的溫柔提醒。',
                        nearestStation: 'JR 秋葉原站',
                        area: '千代田區・秋葉原',
                        rating: 4.3
                    }
                ],
                foods: [
                    {
                        id: 'food-ichiran-akiba',
                        name: '一蘭拉麵 秋葉原店',
                        subhead: '掃街中途的熱湯補給',
                        cuisine: '拉麵',
                        priceLevel: '¥',
                        image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1600&q=80',
                        imageCaption: '一蘭招牌豚骨拉麵，一人一格的專注食事體驗。',
                        imageKey: 'tokyo-ichiran-ramen',
                        intro: '掃街到一半最需要熱湯補給的標準答案。一人一格的設計讓獨旅也自在，濃郁豚骨湯底快速回血。建議避開 12:00–13:30 午餐尖峰，或先取號再回周邊逛一圈。',
                        nearestStation: 'JR 秋葉原站',
                        area: '千代田區・秋葉原',
                        rating: 4.2
                    },
                    {
                        id: 'food-maidcafe',
                        name: '秋葉原女僕咖啡廳街',
                        subhead: '次文化體驗的一杯咖啡',
                        cuisine: '主題咖啡',
                        priceLevel: '¥¥',
                        image: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1600',
                        imageCaption: '秋葉原巷弄內的主題咖啡廳，色彩與角色氛圍是體驗重點。',
                        imageKey: 'tokyo-akihabara-maid-cafe',
                        intro: '體驗東京次文化氛圍的經典方式之一。各家風格不同，從經典女僕到主題聯名皆有。若第一次嘗試，選評價穩定、規則說明清楚的分店，把時間控制在 60 分鐘內，留體力給下一間店。',
                        nearestStation: 'JR 秋葉原站',
                        area: '千代田區・秋葉原',
                        rating: 4.1
                    },
                    {
                        id: 'food-curry-akiba',
                        name: '咖哩屋香料 秋葉原',
                        subhead: '平價又飽足的能量餐',
                        cuisine: '日式咖哩',
                        priceLevel: '¥',
                        image: 'https://images.unsplash.com/photo-1604908176997-43162e978c67?w=1600&q=80',
                        imageCaption: '日式咖哩飯與炸物配菜，是動漫街區常見的務實晚餐選擇。',
                        imageKey: 'tokyo-japanese-curry',
                        intro: '動漫街區常見的平價能量補給。香料層次分明、飯量足夠，適合傍晚掃街後的晚餐。上菜快、翻桌率高，是趕夜間活動前的務實選擇。',
                        nearestStation: 'JR 秋葉原站',
                        area: '千代田區・秋葉原',
                        rating: 4.0
                    }
                ],
                hotels: [
                    {
                        id: 'hotel-gracery-akihabara',
                        name: 'Hotel Gracery 秋葉原',
                        subhead: '步行可達電氣街',
                        area: '秋葉原',
                        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1600&q=80',
                        imageCaption: '都會型商務飯店客房，適合把時間留給街上的旅人。',
                        imageKey: 'tokyo-urban-hotel-room',
                        intro: '步行可達電氣街，動漫迷的經典落腳處。房間緊湊但機能完整，適合把時間花在街上而非飯店的人。建議提早預訂週末房型。',
                        nearestStation: 'JR 秋葉原站',
                        priceRange: '¥12,000–18,000 / 晚',
                        rating: 4.3
                    },
                    {
                        id: 'hotel-nui-hostel',
                        name: 'Nui. HOSTEL & BAR LOUNGE',
                        subhead: '文青感旅宿與酒吧大廳',
                        area: '淺草橋',
                        image: 'https://images.unsplash.com/photo/1520250497591-112f2f40a3f4?w=1600&q=80',
                        imageCaption: '木質調公共空間的設計旅宿，適合獨旅與輕預算玩家。',
                        imageKey: 'tokyo-hostel-lounge',
                        intro: '文青感十足的旅宿，公共空間寬敞，適合獨旅或輕預算玩家。到秋葉原約 15 分鐘電車，適合想平衡住宿質感與交通的旅人。',
                        nearestStation: '淺草橋站',
                        priceRange: '¥4,500–8,000 / 晚',
                        rating: 4.5
                    }
                ],
                transport: {
                    title: '動漫聖地交通攻略',
                    summary: '秋葉原與中野皆在 JR 山手線沿線，動漫一日掃街建議以 Suica 或 Pasmo 為主，減少買票時間。',
                    sections: [
                        {
                            heading: '機場進市區',
                            body: '成田機場可搭 N\'EX 或 Skyliner 轉山手線至秋葉原；羽田機場則以京急線轉 JR 最為直覺。若行李較多，下午進城、先放飯店再開逛，體力會差很多。',
                            tips: ['建議在機場或車站購買 Suica', '週五晚間山手線較擁擠，預留站立空間']
                        },
                        {
                            heading: '聖地間移動',
                            body: '秋葉原 ↔ 中野僅一站山手線，約 5 分鐘。建議上午秋葉原、下午中野，或反過來，避免中午在兩站間來回拉車。',
                            tips: ['週末中野站北口較接近百老匯', '大型戰利品可暫放飯店再出門第二輪']
                        }
                    ]
                },
                itinerary: {
                    title: '動漫聖地一日精華',
                    summary: '適合第一次以動漫視角逛東京的旅人，不趕場、保留彈性。',
                    slots: [
                        { time: '09:30', label: '上午', title: '秋葉原開店掃街', desc: '從電氣街口出發，先攻一番賞與限定周邊。' },
                        { time: '12:30', label: '中午', title: '拉麵補給＋短休', desc: '一蘭或周邊平價咖哩，避開最尖峰時段。' },
                        { time: '14:00', label: '下午', title: '中野百老匯挖寶', desc: '搭山手線一站抵達，專攻中古公仔與冷門櫃位。' },
                        { time: '17:30', label: '傍晚', title: '扭蛋＋女僕咖啡體驗', desc: '回秋葉原收尾，GACHAPON 試手氣。' },
                        { time: '19:30', label: '晚上', title: '自由探索或回飯店', desc: '整理戰利品，為明天保留體力。' }
                    ]
                },
                cta: {
                    buttonText: '用這種風格產生行程',
                    destinationLabel: '東京',
                    styleKey: 'anime'
                }
            }
        }
    };

    var IMAGE_DEFAULTS = {
        spot: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&q=80',
        food: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200&q=80',
        hotel: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80',
        hero: TOKYO_HUB_HERO
    };

    global.SOARVIBE_CITY_JOURNAL = {
        editionCatalog: EDITION_CATALOG,
        meta: META,
        articles: ARTICLES,
        imageDefaults: IMAGE_DEFAULTS
    };
})(typeof window !== 'undefined' ? window : this);
