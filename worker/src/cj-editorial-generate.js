/**
 * Gemini-powered article + per-section copy for City Journal.
 */
import { callGeminiJSON, callGeminiText, repairTruncatedJSON } from './cj-gemini-client.js';

const REQUIRED_SECTION_IDS = [
  'akihabara',
  'nakano',
  'gachapon',
  'ichiran',
  'maid-cafe',
  'nui-hostel',
  'hotel-gracery'
];

const STYLE_GUIDE = [
  '寫作風格參考：日本觀光局雜誌、樂吃購東京版。',
  '具體、有現場感：店名、街道、交通、為何值得停留。',
  '禁止：「彷彿置身動畫」「奇幻驚喜」「洗禮」「魔力」「守護」等空泛行銷句。',
  '禁止：「歡迎來到」「準備好」「一同探索」等開場白套話。',
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

function buildGeneratePrompt(opts) {
  var month = opts.month || '6';
  var year = opts.year || '2026';
  var existing = opts.existingEditorial || null;

  var venueLines = REQUIRED_SECTION_IDS.map(function (id) {
    var v = sectionVenueFromExisting(existing, id);
    return '- ' + id + ': 必須寫「' + (v.officialNameLocal || v.officialName || v.title) + '」，mapsQuery 固定為「' + v.mapsQuery + '」';
  });

  return [
    '你是旅遊雜誌主編。撰寫' + year + '年' + month + '月東京動漫主題專題。',
    STYLE_GUIDE,
    '',
    '【硬性規定】',
    '1. sections 恰好 7 個，sectionId 依序：' + REQUIRED_SECTION_IDS.join(', '),
    '2. 每段 heading、content 必須對應下方指定店家／地點，不可寫成其他店名',
    '3. intro 90–110 字；outro 80–100 字——直接切入主題，不要問候語',
    '4. 每段 content 75–95 字，含一個具體細節（交通、排隊、必看什麼）',
    '5. officialName / officialNameLocal / mapsQuery 必須與下方一致，不可改',
    '6. venueAlternatives 留空陣列 []',
    '7. 緊湊 JSON，無 markdown',
    '',
    '【各段指定地點——文案必須寫這些】',
    venueLines.join('\n'),
    '',
    'JSON：{ title, subtitle, intro, outro, sections:[{ sectionId, heading, content, officialName, officialNameLocal, mapsQuery, meta:{recommendation,stayDuration,nearestStation,priceRange,bestTime}, venueAlternatives:[] }] }'
  ].join('\n');
}

function buildSectionCopyPrompt(section, place, article, photoCaption) {
  var roleHints = {
    akihabara: '秋葉原電氣街街區：Radio Kaikan、Animate、GIGO、中央通，寫掃街節奏與必看店面',
    nakano: '中野百老匯：Mandarake、らしんばん，寫挖寶與中古收藏',
    gachapon: '扭蛋會館：整面扭蛋牆、機台種類、怎麼控制預算',
    ichiran: '拉麵店：湯頭、點餐方式、尖峰排隊，依實際店名撰寫',
    'maid-cafe': '女僕咖啡：低消、拍照規則、店內互動，依實際店名撰寫',
    'nui-hostel': '青年旅館：交通、交誼空間、適合誰住',
    'hotel-gracery': '飯店：位置、交通、房型特色，依實際店名撰寫'
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

function normalizeSection(raw, sectionId, existing) {
  var locked = sectionVenueFromExisting(existing, sectionId);
  var s = raw && typeof raw === 'object' ? raw : {};
  return {
    sectionId: sectionId,
    heading: String(s.heading || locked.title || sectionId).trim(),
    content: String(s.content || '').trim(),
    officialName: locked.officialName || String(s.officialName || '').trim(),
    officialNameLocal: locked.officialNameLocal || String(s.officialNameLocal || '').trim(),
    mapsQuery: locked.mapsQuery || String(s.mapsQuery || '').trim(),
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
    sections: generated.sections.map(function (genSec) {
      var photo = photoById[genSec.sectionId] || {};
      return Object.assign({}, photo, genSec, {
        sectionId: genSec.sectionId,
        heading: genSec.heading,
        content: genSec.content,
        officialName: genSec.officialName || photo.officialName,
        officialNameLocal: genSec.officialNameLocal || photo.officialNameLocal,
        mapsQuery: genSec.mapsQuery || photo.mapsQuery,
        meta: genSec.meta,
        venueAlternatives: photo.venueAlternatives || []
      });
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
    { copy: /一蘭|ichiran/i, place: /tanaka|田中|そば|soba/i },
    { copy: /格拉斯麗|gracery|哥吉拉|godzilla/i, place: /remm|レム|washington|ワシントン/i },
    { copy: /nui|bar lounge/i, place: /グリッズ|grids|浅草橋/i },
    { copy: /@home|home cafe/i, place: /maidreamin|めいどりーみん/i }
  ];
  for (var i = 0; i < conflict.length; i++) {
    if (conflict[i].copy.test(blob) && conflict[i].place.test(pn)) return true;
  }

  var tokens = pn.split(/\s+/).filter(function (t) { return t.length > 1; });
  if (!tokens.length) return false;
  var hits = tokens.filter(function (t) { return blob.indexOf(t) !== -1; }).length;
  return hits < 1;
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
    temperature: 0.55,
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
