/**
 * Gemini-powered article + per-section copy for City Journal.
 * Districts stay fixed; food / cafe / lodging rotate each month.
 */
import { callGeminiJSON, callGeminiText, repairTruncatedJSON } from './cj-gemini-client.js';

const REQUIRED_SECTION_IDS = [
  'akihabara',
  'nakano',
  'gachapon',
  'ikebukuro-route',
  'ichiran',
  'maid-cafe',
  'hotel-gracery'
];

/** Regional pillars — keep every month */
const FIXED_DISTRICT_IDS = ['akihabara', 'nakano', 'gachapon', 'ikebukuro-route'];

/** These must change month-to-month (do NOT lock to previous venue) */
const ROTATING_VENUE_IDS = ['ichiran', 'maid-cafe', 'hotel-gracery'];

const STYLE_GUIDE = [
  '你是資深世界旅遊導遊、旅遊部落客與旅遊雜誌主編，寫作像專業旅遊雜誌專題。',
  '具體、有現場感：店名、街道、交通、為何值得停留。',
  '介紹地區／商圈／景點時，文案預設讀者會看到廣角街景或地標外觀照片——寫街區氛圍，不寫單一室內店。',
  '禁止：「彷彿置身動畫」「奇幻驚喜」「洗禮」「魔力」「守護」等空泛行銷句。',
  '禁止：「歡迎來到」「準備好」「一同探索」等開場白套話。',
  '禁止：「與本段介紹的地標一致」「景觀清楚可見」「方便對照地圖找路」等空泛圖說。',
  '用編輯帶路的語氣，像資深記者寫給懂行的讀者。'
].join('\n');

function sectionVenueFromExisting(existing, sectionId) {
  var sec = ((existing && existing.sections) || []).find(function (s) {
    return s && s.sectionId === sectionId;
  }) || {};
  return {
    officialName: sec.officialName || '',
    officialNameLocal: sec.officialNameLocal || '',
    mapsQuery: sec.mapsQuery || '',
    title: sec.title || sec.subject || '',
    photoIntent: sec.photoIntent || '',
    editorialAngle: sec.editorialAngle || ''
  };
}

function previousRotatedVenues(existing) {
  return ROTATING_VENUE_IDS.map(function (id) {
    var v = sectionVenueFromExisting(existing, id);
    return '- 上月 ' + id + '：' + (v.officialNameLocal || v.officialName || '（無）') +
      '／' + (v.mapsQuery || '');
  }).join('\n');
}

function buildGeneratePrompt(opts) {
  var month = opts.month || '7';
  var year = opts.year || '2026';
  var existing = opts.existingEditorial || null;

  var fixedLines = FIXED_DISTRICT_IDS.map(function (id) {
    var v = sectionVenueFromExisting(existing, id);
    return '- ' + id + '（固定區域）：必須寫「' + (v.officialNameLocal || v.officialName || v.title) +
      '」，mapsQuery「' + v.mapsQuery + '」，文案可換角度但地點區域不可換';
  });

  return [
    '你是資深世界旅遊導遊、旅遊部落客與旅遊雜誌主編。撰寫' + year + '年' + month + '月東京動漫主題專題（全新一期，不是改寫上月）。',
    STYLE_GUIDE,
    '',
    '【工作流程——必須遵守】',
    '1. 先寫完整文案（intro、各段 heading + content、outro）',
    '2. 地區／商圈段落（akihabara、nakano、ikebukuro-route）文案必須對應「廣角街景／地標外觀」，不可寫室內特寫',
    '3. 圖片將事後以 Google Maps 街景／地標照配對；圖說會依實際照片撰寫',
    '',
    '【硬性規定】',
    '1. sections 恰好 7 個，sectionId 依序：' + REQUIRED_SECTION_IDS.join(', '),
    '2. 固定區域：akihabara=秋葉原電氣街、nakano=中野百老匯、gachapon=池袋扭蛋百貨、ikebukuro-route=池袋動漫聖地巡禮動線',
    '3. 輪替段落本月必須全新店家：ichiran=拉麵、maid-cafe=特色咖啡、hotel-gracery=飯店（僅一個住宿段落，禁止青旅／hostel）',
    '4. 輪替店家「禁止」與上月相同，也禁止：一蘭、めいどりーみん、グリッズ浅草橋、レム秋葉原、ホテルグレイスリー新宿／哥吉拉',
    '5. 輪替店要真實可查、在東京、適合動漫／次文化旅人',
    '6. intro／outro／各段 content 必須是本月新寫，不可複用上月措辭',
    '7. intro 90–110 字；outro 80–100 字——直接切入主題',
    '8. 每段 content 75–95 字，含一個具體細節（交通、排隊、必看）',
    '9. ikebukuro-route 寫一日動線：池袋東口→サンシャイン通り→アニメイト→乙女路，附建議停留時間',
    '10. venueAlternatives 留空陣列 []',
    '11. 緊湊 JSON，無 markdown',
    '',
    '【固定區域】',
    fixedLines.join('\n'),
    '',
    '【上月輪替店家——本月禁止再選】',
    previousRotatedVenues(existing),
    '',
    '【本月輪替請自選真實店家並填 officialName / officialNameLocal / mapsQuery】',
    '- ichiran: 拉麵（例：AFURI 秋葉原、鬼金棒、一風堂——但不可一蘭）',
    '- maid-cafe: 主題咖啡（例：@home cafe、アニメイトカフェ——但不可めいどりーみん）',
    '- hotel-gracery: 飯店（例：Tokyu Stay 秋葉原、Hotel Mystays、JR九州ホテルブラッサム——但不可グレイスリー／哥吉拉）',
    '',
    'JSON：{ title, subtitle, intro, outro, issueLabel, sections:[{ sectionId, heading, content, officialName, officialNameLocal, mapsQuery, meta:{recommendation,stayDuration,nearestStation,priceRange,bestTime}, venueAlternatives:[] }] }'
  ].join('\n');
}

function buildSectionCopyPrompt(section, place, article, photoCaption) {
  var roleHints = {
    akihabara: '秋葉原電氣街街區廣角街景：中央通、招牌霓虹、Radio Kaikan／GIGO 立面——寫掃街節奏，不要寫單一室內店',
    nakano: '中野百老匯街區／Sun Mall 入口廣角：寫挖寶動線與商場外觀，不要單一家甜點店特寫',
    gachapon: '扭蛋百貨：整面扭蛋牆、機台種類、怎麼控制預算',
    'ikebukuro-route': '池袋動漫聖地一日動線：東口→サンシャイン通り→アニメイト本店→乙女路，寫步行節奏與街景',
    ichiran: '拉麵店：湯頭、點餐、排隊，依實際店名',
    'maid-cafe': '主題咖啡：低消、拍照規則、互動，依實際店名',
    'hotel-gracery': '飯店：位置、交通、房型亮點，依實際店名'
  };
  return [
    '你是旅遊雜誌編輯。為已確認的地點重寫 heading + content。',
    STYLE_GUIDE,
    '',
    '實際地點（文案主體必須是這裡）：' + (place.placeName || place.officialNameLocal || place.officialName),
    '地址線索：' + (place.googleAddress || ''),
    '段落類型：' + (section.sectionId || ''),
    '寫作提示：' + (roleHints[section.sectionId] || section.photoIntent || ''),
    '照片圖說（可參考畫面）：' + (photoCaption || '（尚無）'),
    '專題主題：' + (article.articleTheme || ''),
    '',
    '回傳格式（各一行，不要 JSON）：',
    'HEADING: （15字內含地點）',
    'CONTENT: （75-95字）',
    'OFFICIAL_NAME: （英文店名）',
    'OFFICIAL_NAME_LOCAL: （日文店名）',
    'content 必須以「' + (place.placeName || '') + '」為主體，不可提及其他店名。'
  ].join('\n');
}

function parsePlainSectionCopy(text) {
  var s = String(text || '').trim();
  var heading = /HEADING[:：]\s*(.+)/im.exec(s);
  var content = /CONTENT[:：]\s*([\s\S]+?)(?=\n\s*OFFICIAL_NAME|$)/im.exec(s);
  var officialName = /OFFICIAL_NAME[:：]\s*(.+)/im.exec(s);
  var officialNameLocal = /OFFICIAL_NAME_LOCAL[:：]\s*(.+)/im.exec(s);
  if (!heading || !content) return null;
  return {
    heading: heading[1].trim(),
    content: content[1].trim().replace(/\nOFFICIAL[\s\S]*$/i, '').trim(),
    officialName: officialName ? officialName[1].trim() : '',
    officialNameLocal: officialNameLocal ? officialNameLocal[1].trim() : ''
  };
}

function isRotating(sectionId) {
  return ROTATING_VENUE_IDS.indexOf(sectionId) !== -1;
}

function normalizeSection(raw, sectionId, existing) {
  var locked = sectionVenueFromExisting(existing, sectionId);
  var s = raw && typeof raw === 'object' ? raw : {};
  var useLock = !isRotating(sectionId);
  return {
    sectionId: sectionId,
    heading: String(s.heading || locked.title || sectionId).trim(),
    content: String(s.content || '').trim(),
    officialName: useLock
      ? (locked.officialName || String(s.officialName || '').trim())
      : (String(s.officialName || '').trim() || locked.officialName),
    officialNameLocal: useLock
      ? (locked.officialNameLocal || String(s.officialNameLocal || '').trim())
      : (String(s.officialNameLocal || '').trim() || locked.officialNameLocal),
    mapsQuery: useLock
      ? (locked.mapsQuery || String(s.mapsQuery || '').trim())
      : (String(s.mapsQuery || '').trim() || locked.mapsQuery),
    meta: {
      recommendation: (s.meta && s.meta.recommendation) || '★★★★☆',
      stayDuration: (s.meta && s.meta.stayDuration) || '',
      nearestStation: (s.meta && s.meta.nearestStation) || '',
      priceRange: (s.meta && s.meta.priceRange) || '',
      bestTime: (s.meta && s.meta.bestTime) || ''
    },
    venueAlternatives: []
  };
}

function normalizeArticleSections(sections, existing) {
  var byId = {};
  (Array.isArray(sections) ? sections : []).forEach(function (s) {
    if (!s || !s.sectionId) return;
    var id = String(s.sectionId).trim();
    if (REQUIRED_SECTION_IDS.indexOf(id) !== -1) byId[id] = s;
  });
  return REQUIRED_SECTION_IDS.map(function (id) {
    return normalizeSection(byId[id], id, existing);
  });
}

function mergePhotoRules(generated, existing) {
  var existingSections = (existing && existing.sections) || [];
  var photoById = {};
  existingSections.forEach(function (s) {
    if (s && s.sectionId) photoById[s.sectionId] = s;
  });

  return {
    title: generated.title || existing.title,
    subtitle: generated.subtitle || existing.subtitle,
    intro: generated.intro || existing.intro,
    outro: generated.outro || existing.outro,
    issueLabel: generated.issueLabel || existing.issueLabel,
    sections: generated.sections.map(function (genSec) {
      var photo = photoById[genSec.sectionId] || {};
      var rotating = isRotating(genSec.sectionId);
      var merged = Object.assign({}, photo, genSec, {
        sectionId: genSec.sectionId,
        heading: genSec.heading,
        content: genSec.content,
        officialName: genSec.officialName || photo.officialName,
        officialNameLocal: genSec.officialNameLocal || photo.officialNameLocal,
        mapsQuery: genSec.mapsQuery || photo.mapsQuery,
        meta: genSec.meta,
        venueAlternatives: rotating ? [] : (photo.venueAlternatives || []),
        placeId: rotating ? null : photo.placeId
      });
      if (rotating) {
        // Clear stale photos / place when venue rotates
        merged.googlePhotoUrl = null;
        merged.googleAttribution = null;
        merged.caption = null;
        merged.aliases = [
          genSec.officialName,
          genSec.officialNameLocal
        ].filter(Boolean);
        merged.photoAnchorTerms = [
          genSec.officialNameLocal,
          genSec.officialName
        ].filter(Boolean);
        merged.photoPlaceQueries = [
          (genSec.officialNameLocal || genSec.officialName) + ' 外観',
          (genSec.officialName || '') + ' exterior',
          genSec.mapsQuery
        ].filter(Boolean);
      }
      return merged;
    })
  };
}

export function placeCopyNeedsResync(section, placeName) {
  var pn = String(placeName || '').toLowerCase().replace(/[^\w\u3040-\u9fff]+/g, ' ');
  var blob = [
    section.heading, section.content,
    section.officialName, section.officialNameLocal, section.subject
  ].join(' ').toLowerCase();
  if (!pn.trim() || !blob.trim()) return false;

  var conflict = [
    { copy: /一蘭|ichiran/i, place: /tanaka|田中|そば|soba|afuri|柚子/i },
    { copy: /格拉斯麗|gracery|哥吉拉|godzilla/i, place: /remm|レム|washington|ワシントン|mystays/i },
    { copy: /nui|bar lounge/i, place: /グリッズ|grids|浅草橋|remm|レム/i },
    { copy: /maidreamin|めいどりーみん/i, place: /@home|home cafe|アニメイトカフェ/i }
  ];
  for (var i = 0; i < conflict.length; i++) {
    if (conflict[i].copy.test(blob) && conflict[i].place.test(pn)) return true;
  }

  var tokens = pn.split(/\s+/).filter(function (t) { return t.length > 1; });
  var hit = tokens.some(function (t) { return blob.indexOf(t) !== -1; });
  return !hit && tokens.length >= 2;
}

function salvageSectionCopy(text) {
  var s = String(text || '');
  var heading = /"heading"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(s);
  var content = /"content"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(s);
  var officialName = /"officialName"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(s);
  var officialNameLocal = /"officialNameLocal"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(s);
  if (!heading || !content) return null;
  return {
    heading: heading[1].replace(/\\"/g, '"').replace(/\\n/g, ''),
    content: content[1].replace(/\\"/g, '"').replace(/\\n/g, ''),
    officialName: officialName ? officialName[1].replace(/\\"/g, '"') : '',
    officialNameLocal: officialNameLocal ? officialNameLocal[1].replace(/\\"/g, '"') : ''
  };
}

export async function generateSectionCopy(env, opts) {
  var section = opts.section || {};
  var place = opts.place || {};
  var article = opts.article || {};
  var prompt = buildSectionCopyPrompt(section, place, article, opts.photoCaption);
  var result = await callGeminiText(prompt, env, {
    temperature: 0.45,
    maxOutputTokens: 2048
  });

  if (!result.ok || !result.text) {
    return { ok: false, error: result.error || 'generate_failed' };
  }

  var data = repairTruncatedJSON(result.text) ||
    salvageSectionCopy(result.text) ||
    parsePlainSectionCopy(result.text);

  if (!data || !data.heading || !data.content) {
    return { ok: false, error: 'parse_failed', detail: result.text.slice(0, 200) };
  }
  return {
    ok: true,
    heading: String(data.heading || '').trim(),
    content: String(data.content || '').trim(),
    officialName: String(data.officialName || place.officialName || '').trim(),
    officialNameLocal: String(data.officialNameLocal || place.officialNameLocal || '').trim()
  };
}

export async function generateEditorialArticle(env, opts) {
  var existing = (opts && opts.existingEditorial) || null;
  var prompt = buildGeneratePrompt(Object.assign({}, opts || {}, { existingEditorial: existing }));
  var result = await callGeminiJSON(prompt, env, {
    temperature: 0.65,
    maxOutputTokens: 16384
  });

  if (!result.ok) {
    return { ok: false, error: result.error, detail: { raw: result.raw || null } };
  }

  var data = result.data || {};
  var normalized = {
    title: String(data.title || '').trim(),
    subtitle: String(data.subtitle || '').trim(),
    intro: String(data.intro || '').trim(),
    outro: String(data.outro || '').trim(),
    issueLabel: String(data.issueLabel || '').trim(),
    sections: normalizeArticleSections(data.sections, existing)
  };

  if (!normalized.title || normalized.sections.some(function (s) { return !s.content; })) {
    return {
      ok: false,
      error: 'incomplete_article',
      detail: { salvaged: !!result.salvaged, sections: normalized.sections.length }
    };
  }

  var article = existing ? mergePhotoRules(normalized, existing) : normalized;

  return {
    ok: true,
    article: article,
    meta: {
      model: result.model,
      keySlot: result.keySlot,
      salvaged: !!result.salvaged
    }
  };
}
