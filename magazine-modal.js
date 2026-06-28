(function (global) {
    'use strict';

    var currentMagCity = '';

    var magazineData = {
        tokyo: {
            name: '東京．TOKYO',
            budget: '【築地場外市場與平價丼飯指南】—— 避開高價觀光陷阱，跟著在地上班族用百元日幣品嚐最鮮的海鮮丼與連鎖鳥貴族居酒屋，玩出最高 CP 值。',
            classic: '【初訪東京的鋼鐵地標巡禮】—— 從晴空塔的落日極致視野，到淺草寺的暮鼓晨鐘，為第一次踏上東京的你，鎖定絕對不踩雷的經典座標。',
            trendy: '【麻布台之丘 ✕ 未來城市新地標】—— 直擊東京當下最具話題性的複合式立體綠化空間，走進數位藝術的魔幻現實。',
            foodie: '【Tabelog 頂級高分老店深挖】—— 嚴選炭火鰻魚飯與米其林必比登推薦拉麵，客觀預留 90 分鐘排隊空檔，一場味蕾的極致修行。',
            netbeauty: '【極簡採光與幾何咖啡館機位】—— 精選清澄白河與表參道的高視覺張力網美咖啡廳，停留嚴格鎖定 45 分鐘，捕捉魔幻時刻的最佳逆光。',
            otaku: '【Threads熱議！秋葉原與中野塊狀掃街】—— 揚棄無聊景點，直奔一番賞旗艦店與中古盲盒聖地，2.5小時縱深探索，骨灰級玩家的挖寶天堂。',
            trendplayer: '【裏原宿古著與小眾調香私房地圖】—— 穿梭在下北澤與裏原宿的設計師買手店，親手調配一瓶屬於東京秋季的冷冽感木質香水。'
        },
        kyoto: {
            name: '京都．KYOTO',
            budget: '【錦市場小吃散策與平價町家定食】—— 用銅板價打包玉子燒與章魚串，夜晚入住平價木造町家，漫步鴨川體驗最老派的京式小資慢活。',
            classic: '【清水舞台千本鳥居經典視覺】—— 穿梭在伏見稻荷大社的硃紅長廊，午後漫步清水寺二年坂，捕捉京都最鋼鐵卻百看不厭的傳統靈魂。',
            trendy: '【ACE HOTEL 與新興文創美學空間】—— 直擊由隈研吾操刀的新風館，看百年舊磚牆與現代設計語彙如何咬合，重生成潮流文青聚集地。',
            foodie: '【百年湯豆腐與祇園本格懷石料理】—— 靜心品嚐純淨地下水交織出的清甜豆腐，夜晚探訪鴨川納涼床，體驗極致細膩的季節限定料理滋味。',
            netbeauty: '【八坂庚申堂彩色猴子與嵐山竹林】—— 在彩虹小猴許願牆前留下高飽和度視覺照片，清晨 6 點前往嵐山竹林，捕捉限定無人光影短影音。',
            otaku: '【京都動漫博物館與東映太秦映畫村】—— 走進由舊學校改建的漫畫聖地，漫步在還原江戶時代的時代劇影城，體驗關西特有的動漫底蘊。',
            trendplayer: '【三條通設計師買手店與黑膠文青咖啡】—— 避開觀光主街，深入三條通的百年紅磚洋樓，發掘小眾工藝品牌與日系木質調生活選品。'
        },
        osaka: {
            name: '大阪．OSAKA',
            budget: '【黑門市場小點與新世界平價串炸】—— 避開浮誇店鋪，深入通天閣巷弄，用百元日幣品嚐金黃酥脆的在地炸串與正宗章魚燒，吃飽絕不傷錢包。',
            classic: '【道頓堀跑跑卡丁人與大阪城天守閣】—— 站在戎橋上與固力果招牌留下經典合影，清晨登上雄偉的大阪城，體驗關西最豪邁的地標脈動。',
            trendy: '【心齋橋 PARCO 潮流新地標】—— 直擊極具話題性的複合式商場，從奢華名品到地下潮流動漫重鎮，展現大阪當下最前衛的街頭消費美學。',
            foodie: '【本格黑毛和牛燒肉與極致大阪燒】—— 嚴選道頓堀高評分和牛老店，餐期預留 80 分鐘排隊與現點現煎空檔，享受醬汁在鐵板上滋滋作響的極致香氣。',
            netbeauty: '【難波八阪神社獅子頭與空庭溫泉】—— 在巨大的墨綠獅子巨口前捕捉極具張力的視覺照片，傍晚換上浴衣在復古日式庭園拍下絕美剪影。',
            otaku: '【日本橋電電城與二手公仔挖寶大樓】—— 關西版秋葉原！專攻日本橋地下街、一番賞二手現貨、中古卡牌交易站，2.5小時塊狀掃街絕不拉車。',
            trendplayer: '【橘子街 Orange Street 潮流與古著美學】—— 橫縱漫步在堀江商圈，直擊 Supreme、微透現代選品店與美式 Vintage 古著，潮流玩家的終極天堂。'
        },
        seoul: {
            name: '首爾．SEOUL',
            budget: '【通仁市場銅錢便當與平價飯捲】—— 體驗用復古銅錢兌換在地小菜的樂趣，搭配東大門超佛心平價一隻雞，用最精省的預算吃垮首爾。',
            classic: '【景福宮韓服散策與南山塔夜景】—— 穿上精緻韓服穿梭在古老宮殿的瓦牆間，夜晚登上 N首爾塔俯瞰整座城市的璀璨霓虹，初訪必收。',
            trendy: '【聖水洞 DIOR 概念店與現代百貨】—— 直擊當前全亞洲最具話題性的潮流聚落，看廢棄鐵皮工廠如何重生成為頂級奢侈品與設計師快閃的最高殿堂。',
            foodie: '【廣藏市場生牛肉與米其林醬蟹】—— 挑戰當下最鮮甜的生拌牛肉與章魚，夜晚預約高分醬油蟹老店，體驗白飯小偷的極致魅力，餐期嚴格預留充足排隊時間。',
            netbeauty: '【延南洞英倫復古甜點與絕美露台】—— 隱藏在巷弄中的獨棟紅磚咖啡廳，極致的採光與高顏值蛋糕，拍片打卡限制 45 分鐘，光影張力直接拉滿。',
            otaku: '【弘大國漫商城與 TCG 卡牌聖地】—— 專攻弘大週邊的一番賞現貨店、大牌動漫旗艦店與限定聯名 Cafe，塊狀漫遊 2 小時，脆友大推的尋寶大本營。',
            trendplayer: '【漢南洞小眾買手店與設計師香氛】—— 避開大眾商場，深入漢南洞山坡尋找南韓本土設計師品牌（Mardi, Depound）與高級微透極簡調香概念店。'
        },
        hokkaido: {
            name: '北海道．HOKKAIDO',
            budget: '【札幌二條市場平價海鮮丼與湯咖哩】—— 跟著在地大學生清晨排隊，用極限小資價品嚐鮮甜鮭魚卵丼與濃郁香料湯咖哩，抗寒又省錢包。',
            classic: '【小樽運河煤氣燈與函館百萬夜景】—— 漫步在黃昏時分浪漫點燈的小樽運河畔，夜晚搭乘纜車登上函館山，收錄全球鋼鐵級的雙弧線夜景璀璨視覺。',
            trendy: '【白老町民族博物館與全新星野美學】—— 深入體驗新興北海道藝文立體空間，直擊大自然景觀與北歐/日系極簡交織的全新滑雪渡假潮流地標。',
            foodie: '【三大蟹吃到飽與本格成吉思汗烤羊肉】—— 炭火直烤多汁鮮嫩的羔羊肉，搭配薄野極高分雪場蟹老店，餐期預留 90 分鐘，在冰天雪地中享受頂級的味覺修行。',
            netbeauty: '【美瑛青池魔幻藍與富良野薰衣草】—— 捕捉在枯木交織下呈現微透 Tiffany 藍的夢幻湖面，黃昏魔幻時刻限制 60 分鐘捕捉短影音，張力爆棚。',
            otaku: '【新千歲機場多啦A夢與動漫雪祭限定】—— 機場直奔大型主題樂園，若逢冬季則專攻大通公園雪祭的巨型動漫冰雕與初音未來限定周邊，冷門珍品極致集結。',
            trendplayer: '【美式大牌工裝與北國小眾手工皮革工坊】—— 深入札幌狸小路巷弄，發掘頂級防寒戶外潮流品牌與在地職人親手鞣製的木質調冷冽感皮革選品。'
        },
        bangkok: {
            name: '曼谷．BANGKOK',
            budget: '【恰圖恰週末市集與夜市百元熱炒】—— 在全球最大的週末市集瘋狂殺價，夜晚留給火山排骨與手標泰奶，用百元台幣換取極致的快樂。',
            classic: '【大皇宮玉佛寺與鄭王廟落日】—— 讚嘆泰國佛教建築的極致雕刻工藝，黃昏時分坐在湄南河畔，靜靜欣賞鄭王廟點亮夜空的魔幻金光。',
            trendy: '【EMSPHERE 最新潮流不夜城商場】—— 走進曼谷最前衛的室內霓虹市集與複合式設計商場，直擊東南亞最前線的時尚與夜生活文化。',
            foodie: '【建興酒家咖哩螃蟹與米其林路邊攤】—— 品嚐肥美滑嫩的招牌咖哩螃蟹，與摘星的痣姐熱炒排隊朝盛，享受酸辣與香料在舌尖的大爆炸。',
            netbeauty: '【湄南河畔透明玻璃景觀餐廳】—— 預約能 180 度遠眺對岸古蹟的高顏值微透餐酒館，黃昏魔幻時刻限制 60 分鐘迅速開拍短影音，視覺張力拉滿。',
            otaku: '【Mega Plaza 全泰最大復古玩具城】—— 超過 6 層樓的中古模型、鋼彈、老玩具與一番賞天堂，冷門珍品大集結，骨灰級玩具人的大本營。',
            trendplayer: '【通羅街區文青選品與精品咖啡】—— 漫步在曼谷的代官山「通羅區」，探索小眾香氛、泰國原創設計服飾店與極具工業風的黑膠音樂咖啡館。'
        },
        vietnam: {
            name: '越南．VIETNAM',
            budget: '【三十六古街法式麵包與越式路邊滴濾咖啡】—— 坐在藍色塑膠椅上，用幾十塊台幣品嚐酥脆爆漿的越式法包，搭配煉乳滴濾冰咖啡，玩出最道地的小資煙火氣。',
            classic: '【下龍灣海上石林與會安古鎮燈籠夜】—— 搭乘仿古木船穿梭在宛如潑墨山水的海上奇景，夜晚漫步在會安古城，點亮整條街的傳統手工彩繪絲綢燈籠。',
            trendy: '【胡志明市咖啡公寓與全新藝文極簡基地】—— 直擊整棟由舊軍事公寓改建、塞滿數十家風格咖啡與獨立買手店的九層樓魔幻立體地標，社群熱議最高點。',
            foodie: '【高分生牛肉河粉與本格越式宮廷料理】—— 嚴選河內評論破千的清甜牛骨湯河粉，夜晚預約西貢高階私房菜，享受香草、魚露與青檸在舌尖上的酸甜大咬合。',
            netbeauty: '【峴港粉紅大教堂與巴拿山佛手黃金橋】—— 站在巨大的雙手托起金色絲帶橋樑的震撼視覺前，黃昏魔幻時刻限制 60 分鐘卡位拍照，短影音張力直接封神。',
            otaku: '【西貢中心玩具市集與日系原宿動漫格子商圈】—— 探尋隱藏在複合式商場高樓層的日系一番賞、高達模型現貨店，發掘東南亞特有的復古玩具交易市集。',
            trendplayer: '【當代極簡亞麻服飾與西貢小眾文青香氛】—— 漫步在胡志明市第二區，直擊越南新銳設計師的高級微透亞麻剪裁服飾，與結合熱帶香料的獨特木質調香水體驗。'
        },
        london: {
            name: '倫敦．LONDON',
            budget: '【波羅市場免費試吃與紅色大巴士散策】—— 用小資價打包正宗英式肉派與草莓巧克力，搭乘雙層巴士坐在第一排，用超低成本刷完倫敦經典街景。',
            classic: '【大笨鐘倫敦眼與大英博物館聖殿】—— 站在西敏橋上捕捉大笨鐘敲響的鋼鐵瞬間，午後免費沉浸在大英博物館的歷史洪流中，初訪英倫靈魂座標。',
            trendy: '【巴特西發電廠重生成潮流新核心】—— 直擊由巨大廢棄工業發電廠改建的頂級未來購物聖地，看賽博朋克風玻璃電梯與前衛設計大牌如何完美融合。',
            foodie: '【高階英式下午茶與炸魚薯條網紅名店】—— 預約奢華酒店的本格三層英式下午茶，搭配皮脆肉嫩的傳統名店，餐期預留 90 分鐘感受最優雅的英倫味蕾修行。',
            netbeauty: '【諾丁丘彩色歐風小屋與碎片大廈落日】—— 穿梭在粉嫩色系的維多利亞式排屋巷弄間，黃昏時登上西歐最高觀景台，捕捉限定 45 分鐘的霧都夕陽剪影。',
            otaku: '【哈利波特九又四分之三月台與樂高旗艦店】—— 骨灰級影迷與玩具人的天堂！專攻國王十字車站經典推車機位，與萊斯特廣場全球最大 LEGO 旗艦店。',
            trendplayer: '【肖爾迪奇街區與攝政街精品選物】—— 深入東倫敦塗鴉巷弄與獨立設計師小店，午後轉戰攝政街旗艦，捕捉英倫街頭與高訂交織的潮流脈動。'
        },
        paris: {
            name: '巴黎．PARIS',
            budget: '【左岸街角平價牛排與神級平價可麗餅】—— 避開香榭麗舍高價陷阱，跟著巴黎大學生深入瑪黑區巷弄，用小資價品嚐現做榛果醬可麗餅與正宗平價油封鴨。',
            classic: '【艾菲爾鐵塔閃耀與羅浮宮玻璃金字塔】—— 坐在戰神廣場草地上靜待鐵塔整點點亮的鑽石視覺，清晨前往羅浮宮，捕捉無人干擾的鋼鐵幾何極致線條。',
            trendy: '【莎瑪麗丹百貨與全新當代藝術基金會】—— 直擊由 LVMH 集團重金打造、極具話題性的藝術零售殿堂，欣賞拜占庭壁畫與極簡玻璃幕牆咬合的時尚巔峰。',
            foodie: '【米其林三星本格法餐與傳奇熱巧克力】—— 體驗一場嚴謹至極的法式宮廷美學味蕾饗宴，午後探訪 Angelina 冰室，享受濃郁如絲綢的極致巧克力修行。',
            netbeauty: '【凱旋門頂層放射街景與凡爾賽鏡廳】—— 站在凡爾賽宮無數鏡面折射出的採光大廳中，黃昏魔幻時刻限制 60 分鐘卡位，拍出極致奢華的圖文與短影音。',
            otaku: '【巴黎漫畫老街與迪士尼限定皮克斯周邊】—— 漫步在聖米歇爾大道的百年漫畫書店，或專攻巴黎迪士尼樂園特有的限定版料理鼠王與皮克斯珍品挖寶。',
            trendplayer: '【瑪黑區概念選品與聖日耳曼小眾香氛】—— 穿梭瑪黑區設計師概念店，午後漫步聖日耳曼尋找法式極簡香氛與高級剪裁單品，收藏巴黎秋季的冷調質感。'
        }
    };

    var coverUrls = {
        tokyo: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?q=80&w=1200',
        kyoto: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200',
        osaka: 'https://images.unsplash.com/photo-1590559899731-a3826db94655?q=80&w=1200',
        seoul: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=1200',
        hokkaido: 'https://images.unsplash.com/photo-1578507065211-17efed996086?q=80&w=1200',
        bangkok: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=1200',
        vietnam: 'https://images.unsplash.com/photo-1509060464153-44667396260f?q=80&w=1200',
        london: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200',
        paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200'
    };

    var localCoverUrls = {
        tokyo: './cover-photos/tokyo.jpg',
        kyoto: './cover-photos/kyoto.jpg',
        osaka: './cover-photos/osaka.jpg',
        seoul: './cover-photos/seoul.jpg',
        hokkaido: './cover-photos/hokkaido.jpg',
        bangkok: './cover-photos/bangkok.jpg',
        vietnam: './cover-photos/tokyo.jpg',
        london: './cover-photos/london.jpg',
        paris: './cover-photos/paris.jpg'
    };

    function getMagCoverUrl(cityId) {
        return localCoverUrls[cityId] || coverUrls[cityId] || '';
    }

    function openMagazine(cityId) {
        if (!magazineData[cityId]) return;
        currentMagCity = cityId;

        var titleEl = document.getElementById('magTitle');
        var coverEl = document.getElementById('magCover');
        var modalEl = document.getElementById('magazineModal');
        var tabsEl = document.getElementById('magTabsContainer');
        if (!titleEl || !coverEl || !modalEl || !tabsEl) return;

        titleEl.textContent = magazineData[cityId].name;
        coverEl.style.backgroundImage = "url('" + getMagCoverUrl(cityId).replace(/'/g, '%27') + "')";

        var firstTab = tabsEl.firstElementChild;
        if (firstTab) {
            switchMagStyle('budget', firstTab);
        }

        modalEl.classList.remove('hidden');
        modalEl.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeMagazine() {
        var modalEl = document.getElementById('magazineModal');
        if (!modalEl) return;
        modalEl.classList.add('hidden');
        modalEl.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        currentMagCity = '';
    }

    function switchMagStyle(styleKey, element) {
        if (!currentMagCity || !magazineData[currentMagCity]) return;

        var allTabs = document.querySelectorAll('.mag-tab-btn');
        allTabs.forEach(function (btn) {
            btn.classList.remove('bg-white/30', 'text-white', 'border-white/40');
            btn.classList.add('bg-white/10', 'text-white/70', 'border-white/10');
        });

        if (element) {
            element.classList.remove('bg-white/10', 'text-white/70', 'border-white/10');
            element.classList.add('bg-white/30', 'text-white', 'border-white/40');
        }

        var articleText = magazineData[currentMagCity][styleKey] || '本期精彩專欄正在策展中，敬請期待 SoarVibe 下期創刊號！🌸';
        var contentEl = document.getElementById('magContent');
        if (!contentEl) return;

        contentEl.innerHTML =
            '<div class="animate-fade-in">' +
            '<p class="leading-relaxed tracking-wide font-light text-white/90 drop-shadow-sm"></p>' +
            '</div>';
        contentEl.querySelector('p').textContent = articleText;
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var modalEl = document.getElementById('magazineModal');
        if (modalEl && !modalEl.classList.contains('hidden')) {
            closeMagazine();
        }
    });

    global.openMagazine = openMagazine;
    global.closeMagazine = closeMagazine;
    global.switchMagStyle = switchMagStyle;
    global.magazineData = magazineData;
})(typeof window !== 'undefined' ? window : this);
