/* gmt-compat-kb.js — «دليل التوافقيات» الذي يكبر (26 ت1 · TASK-0187)
   المالك seq 120: «خلّي العقل يبحث عن التوافقيات على الإنترنت … ما يعتمد فقط على دليل التوافقيات اللي عنده وإنّما يطوّره ويضيف عليه»
   · seq 121: ما يجده من الإنترنت يُضاف «تلقائياً فوراً» والبحث يستعمله، والمالك يحذف الغلط من صفحة الدليل.
   الجدول gmt_compat_kb: صفٌّ لكل «قطعة ⇐ ما تركّب عليه» بمصدره من الإنترنت. المفتاح المطبَّع يجمع المنتجات المتماثلة:
     • كودٌ بلاحقته — ES-68 ⇐ ES68 · ES-68 II ⇐ ES68II (الأجيال لا تتبادل: الدليل ②)
     • قطرٌ وصنف للأغطية والفلاتر والهود اللولبي — D77:cap (الغطاء بالقطر لا بالشركة: الدليل ⑤)
     • ما سواها (كيج · حامل · مايك بلا كود…) ⇐ المنتج نفسه P:<id>
   والصنف (هود · غطاء · بطارية · شاحن …) شرطٌ للمطابقة: كود الكاميرا في اسم بطاريةٍ لا يلصق توافقها بالكاميرا نفسها. */
(function (global) {
  'use strict';
  var LS = 'gmt_compat_kb_v1', TTL = 10 * 60 * 1000;
  var S = { rows: [], idx: {}, at: 0, tried: 0, ver: 0 }, loading = null;
  var COLS = 'id,uk,item_key,item,kind,fits,note,source_url,source_title,origin,product_id,product_name,created_by,created_at';

  function db() {
    var m = global.GMT_DB && global.GMT_DB.MAIN; if (m && m.url && m.key) return m;
    /* نقطة البيع لا تحمّل gmt-config.js: مفاتيحها في CONFIG داخل الصفحة */
    try { if (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY) return { url: CONFIG.SUPABASE_URL, key: CONFIG.SUPABASE_KEY }; } catch (_) {}
    return null;
  }
  function hdr(extra) { var d = db(), h = d ? { apikey: d.key, Authorization: 'Bearer ' + d.key } : {}; for (var k in (extra || {})) h[k] = extra[k]; return h; }
  function lat(s) {
    return String(s == null ? '' : s).replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
  }

  /* ── الصنف والمفتاح ── الترتيب مقصود: «شاحن بطارية» شاحن · «قبضة بطارية» قبضة · «تريغر فلاش» تريغر */
  function kindOf(t) {
    t = fixCodes(t);
    if (/تريغر|تريجر|ترغر|trigger|transmitter/i.test(t)) return 'trigger';
    if (/قبض[ةه]|\bgrip\b|\bBG-?[A-Z]?\d/i.test(t)) return 'grip';
    if (/شاحن|charger|\bLC-E\d|\bBC-[A-Z]/i.test(t)) return 'charger';
    if (/بطاري|battery|\bLP-E\d|\bNP-[A-Z]{0,2}\d|\bEN-EL\d|\bBP-\d|\bNB-\d|\bDMW-BL/i.test(t)) return 'battery';
    if (/هود|hood|\b(ET|EW|ES|HB|HS|LH)-\d/i.test(t)) return 'hood';
    if (/غطا|اغطي|أغطي|\bcaps?\b/i.test(t)) return 'cap';
    if (/فلتر|filter|\bCPL\b|\bUV\b|\bND\d*\b/i.test(t)) return 'filter';
    if (/محو[ّ]?ل|adapter|adaptor|speed ?booster/i.test(t)) return 'adapter';
    if (/فلاش|flash|speedlite|سبيد ?لايت/i.test(t)) return 'flash';
    if (/مايك|ميكروفون|مايكروفون|microphone|\bmic\b|lavalier/i.test(t)) return 'mic';
    return 'other';
  }
  var SUF = /^(II|III|IV|V|VI|PRO|MKII|MKIII|MKIV|C|N|NH)$/;
  var UNIT = /^\d+(MM|CM|W|V|MAH|WH|K|G|KG|M|FPS|P|X|IN)$/;
  /* «Ew 73c» · «EW－73B» · «Lc e17» · «ET-87lens» ⇒ EW-73C · EW-73B · LC-E17 · ET-87 (كتابات المحلّ الفعلية — seq 210) */
  function fixCodes(t) {
    return lat(t).replace(/[－–—‑]/g, '-').replace(/\b(ET|EW|ES|HB|LH|LP|LC|BG|NB|BP)\s*-?\s*(E?\d{1,3}[A-Z]{0,2})(?=lens|\b)/gi, function (m, a, c) { return a.toUpperCase() + '-' + c.toUpperCase() + ' '; })
      .replace(/\b(LP|LC)-(\d)/gi, '$1-E$2')
      .replace(/(^|\s)E(\d{1,2}(?:NH|N)?)(?=\s|$)/gi, function (m, sp, c) { return /بطاري|battery|شاحن|charger/i.test(t) ? sp + 'LP-E' + c.toUpperCase() : m; });
  }
  function codesOf(t) {
    t = fixCodes(t);
    var tk = lat(t).toUpperCase().replace(/[‐-―]/g, '-').split(/[^A-Z0-9\-]+/).filter(Boolean), out = [];
    for (var i = 0; i < tk.length; i++) {
      var w = tk[i].replace(/^-+|-+$/g, ''), c = w.replace(/-/g, '');
      if (c.length < 2 || c.length > 14 || !/[A-Z]/.test(c) || !/\d/.test(c) || UNIT.test(c)) continue;
      var nx = (tk[i + 1] || '').replace(/-/g, '');
      if (SUF.test(nx)) { c += nx; w += ' ' + tk[i + 1]; i++; }
      if (!out.some(function (o) { return o.k === c; })) out.push({ k: c, w: w });
    }
    return out;
  }
  function diamOf(t) { var m = lat(t).match(/(\d{2,3})\s*(?:mm|مم|ملم|ملي)/i), n = m ? +m[1] : 0; return n >= 25 && n <= 150 ? n : 0; }
  function textOf(p) { return p ? [p.name, p.name_en, p.model, p.short_name].filter(Boolean).join(' ') : ''; }
  var ITEM = { cap: 'غطاء عدسة', filter: 'فلتر', hood: 'هود لولبي' };
  function bayonet(codes) { return codes.some(function (c) { return /^(ET|EW|ES|HB|HS|LH|ALCSH)\d/.test(c.k); }); }
  /* مفتاح الإكسسوار الذي يُكتب به في الدليل — من اسمه عندنا (الاسم مرجع: TASK-0172) */
  function keyOf(p) {
    var t = textOf(p); if (!t.trim()) return null;
    var kind = kindOf(t), codes = codesOf(t), D = diamOf(t);
    if (D && (kind === 'cap' || kind === 'filter' || (kind === 'hood' && !bayonet(codes)))) return { key: 'D' + D + ':' + kind, item: ITEM[kind] + ' ' + D + 'مم', kind: kind };
    if (kind !== 'other' && codes.length) return { key: codes[0].k, item: codes[0].w, kind: kind };
    if (p.id != null && p.id !== '') return { key: 'P:' + p.id, item: String(p.name || t).slice(0, 80), kind: kind };
    return null;
  }
  /* كل المفاتيح التي يُعرف بها منتج (للبحث) */
  function keysOf(p) {
    var t = textOf(p), kind = kindOf(t), out = [], D = diamOf(t);
    if (D && ITEM[kind]) out.push('D' + D + ':' + kind);
    if (kind !== 'other') codesOf(t).forEach(function (c) { out.push(c.k); });
    if (p && p.id != null && p.id !== '') out.push('P:' + p.id);
    return { kind: kind, keys: out };
  }

  /* ══ المرجع الثابت (المالك seq 206: «البحث التلقائي في الأغطية والهودات والبطاريات ما عم يعطيني العدسات المتوافقة —
     الغطاء قطر 77 ما بيعطيني كل العدسات المتوافقة») ══
     بحث الإنترنت متعثّر وذاكرة العقل تعطي بضع عدسات فقط ⇒ جدولٌ ثابت لعدسات كانون (قطر الفلتر · كود الهود) وللبطاريات
     والشواحن والقبضات وكاميراتها — يُقرأ أوّلاً ويعطي **الكل**، ثمّ يُكمَّل بعدسات الجرد نفسها (قطرها في مواصفاتها) وبما يجده العقل.
     القيم من جداول كانون الرسمية؛ ما لم نتيقّن منه تُرك فارغاً (لا يُخمَّن). الصيغة: [الاسم · قطر الفلتر · كود الهود] */
  var LENSES = [
    ['RF 14-35mm f/4L IS USM', 77, 'EW-83P'], ['RF 15-35mm f/2.8L IS USM', 82, 'EW-88F'], ['RF 15-30mm f/4.5-6.3 IS STM', 67, ''],
    ['RF 16mm f/2.8 STM', 43, 'EW-65C'], ['RF 24mm f/1.8 Macro IS STM', 52, 'EW-65C'], ['RF 28mm f/2.8 STM', 43, ''],
    ['RF 35mm f/1.8 Macro IS STM', 52, 'EW-52'], ['RF 50mm f/1.8 STM', 43, 'ES-65B'], ['RF 50mm f/1.2L USM', 77, 'ES-83'],
    ['RF 85mm f/2 Macro IS STM', 67, 'ET-77'], ['RF 85mm f/1.2L USM', 82, 'ET-89'], ['RF 100mm f/2.8L Macro IS USM', 67, 'ET-73C'],
    ['RF 135mm f/1.8L IS USM', 82, 'ET-88B'], ['RF 24-50mm f/4.5-6.3 IS STM', 58, ''], ['RF 24-70mm f/2.8L IS USM', 82, 'EW-88E'],
    ['RF 24-105mm f/4L IS USM', 77, 'EW-83N'], ['RF 24-105mm f/4-7.1 IS STM', 67, 'EW-73D'], ['RF 24-240mm f/4-6.3 IS USM', 72, 'EW-78F'],
    ['RF 28-70mm f/2L USM', 95, 'EW-103B'], ['RF 70-200mm f/2.8L IS USM', 77, 'ET-83F'], ['RF 70-200mm f/4L IS USM', 77, ''],
    ['RF 100-400mm f/5.6-8 IS USM', 67, 'ET-74B'], ['RF 100-500mm f/4.5-7.1L IS USM', 77, ''], ['RF 200-800mm f/6.3-9 IS USM', 95, ''],
    ['RF 600mm f/11 IS STM', 82, ''], ['RF 800mm f/11 IS STM', 95, ''],
    ['RF-S 18-45mm f/4.5-6.3 IS STM', 49, ''], ['RF-S 18-150mm f/3.5-6.3 IS STM', 55, 'EW-60F'], ['RF-S 55-210mm f/5-7.1 IS STM', 55, 'ET-60B'],
    ['EF 16-35mm f/2.8L USM', 77, 'EW-83E'], ['EF 16-35mm f/2.8L II USM', 82, 'EW-88'], ['EF 16-35mm f/2.8L III USM', 82, 'EW-88D'],
    ['EF 16-35mm f/4L IS USM', 77, 'EW-82'], ['EF 17-40mm f/4L USM', 77, 'EW-83E'], ['EF 24mm f/1.4L II USM', 77, 'EW-83K'],
    ['EF 24mm f/2.8 IS USM', 58, 'EW-65 II'], ['EF 28mm f/2.8 IS USM', 58, 'EW-65 II'], ['EF 28mm f/1.8 USM', 58, 'EW-63 II'],
    ['EF 35mm f/1.4L II USM', 72, 'EW-77'], ['EF 35mm f/2 IS USM', 67, 'EW-72'], ['EF 40mm f/2.8 STM', 52, 'ES-52'],
    ['EF 50mm f/1.2L USM', 72, 'ES-78'], ['EF 50mm f/1.4 USM', 58, 'ES-71 II'], ['EF 50mm f/1.8 STM', 49, 'ES-68'], ['EF 50mm f/1.8 II', 52, 'ES-62'],
    ['EF 85mm f/1.2L II USM', 72, 'ES-79 II'], ['EF 85mm f/1.4L IS USM', 77, 'ET-83E'], ['EF 85mm f/1.8 USM', 58, 'ET-65 III'],
    ['EF 100mm f/2.8L Macro IS USM', 67, 'ET-73'], ['EF 100mm f/2.8 Macro USM', 58, 'ET-67'], ['EF 135mm f/2L USM', 72, 'ET-78 II'],
    ['EF 200mm f/2.8L II USM', 72, 'ET-83B II'],
    ['EF 24-70mm f/2.8L USM', 77, 'EW-83F'], ['EF 24-70mm f/2.8L II USM', 82, 'EW-88C'], ['EF 24-70mm f/4L IS USM', 77, 'EW-83L'],
    ['EF 24-105mm f/4L IS USM', 77, 'EW-83H'], ['EF 24-105mm f/4L IS II USM', 77, 'EW-83M'], ['EF 24-105mm f/3.5-5.6 IS STM', 77, 'EW-83M'],
    ['EF 28-300mm f/3.5-5.6L IS USM', 77, 'EW-83G'], ['EF 70-200mm f/2.8L USM', 77, 'ET-83II'], ['EF 70-200mm f/2.8L IS USM', 77, 'ET-86'],
    ['EF 70-200mm f/2.8L IS II USM', 77, 'ET-87'], ['EF 70-200mm f/2.8L IS III USM', 77, 'ET-87'], ['EF 70-200mm f/4L USM', 67, 'ET-74'],
    ['EF 70-200mm f/4L IS USM', 67, 'ET-74'], ['EF 70-200mm f/4L IS II USM', 72, 'ET-78B'], ['EF 70-300mm f/4-5.6 IS II USM', 67, 'ET-74B'],
    ['EF 70-300mm f/4-5.6L IS USM', 67, 'ET-73B'], ['EF 75-300mm f/4-5.6 III', 58, 'ET-60'], ['EF 100-400mm f/4.5-5.6L IS USM', 77, 'ET-83C'],
    ['EF 100-400mm f/4.5-5.6L IS II USM', 77, 'ET-83D'],
    ['EF-S 10-18mm f/4.5-5.6 IS STM', 67, 'EW-73C'], ['EF-S 10-22mm f/3.5-4.5 USM', 77, 'EW-83E'], ['EF-S 15-85mm f/3.5-5.6 IS USM', 72, 'EW-78E'],
    ['EF-S 17-55mm f/2.8 IS USM', 77, 'EW-83J'], ['EF-S 17-85mm f/4-5.6 IS USM', 67, 'EW-73B'], ['EF-S 18-55mm f/3.5-5.6 III', 58, 'EW-60C'],
    ['EF-S 18-55mm f/3.5-5.6 IS II', 58, 'EW-60C'], ['EF-S 18-55mm f/3.5-5.6 IS STM', 58, 'EW-63C'], ['EF-S 18-55mm f/4-5.6 IS STM', 58, 'EW-63C'],
    ['EF-S 18-135mm f/3.5-5.6 IS', 67, 'EW-73B'], ['EF-S 18-135mm f/3.5-5.6 IS STM', 67, 'EW-73B'], ['EF-S 18-135mm f/3.5-5.6 IS USM', 67, 'EW-73D'],
    ['EF-S 18-200mm f/3.5-5.6 IS', 72, 'EW-78D'], ['EF-S 24mm f/2.8 STM', 52, 'ES-52'], ['EF-S 55-250mm f/4-5.6 IS II', 58, 'ET-60'],
    ['EF-S 55-250mm f/4-5.6 IS STM', 58, 'ET-63'], ['EF-S 60mm f/2.8 Macro USM', 52, 'ET-67B'],
    ['EF-M 11-22mm f/4-5.6 IS STM', 55, 'EW-60E'], ['EF-M 15-45mm f/3.5-6.3 IS STM', 49, 'EW-53'], ['EF-M 18-55mm f/3.5-5.6 IS STM', 52, 'EW-54'],
    ['EF-M 18-150mm f/3.5-6.3 IS STM', 55, 'EW-60F'], ['EF-M 22mm f/2 STM', 43, 'EW-43'], ['EF-M 32mm f/1.4 STM', 43, ''], ['EF-M 55-200mm f/4.5-6.3 IS STM', 52, 'ET-54B']
  ];
  var CAM_E6 = ['EOS 5D Mark II', 'EOS 5D Mark III', 'EOS 5D Mark IV', 'EOS 5DS', 'EOS 5DS R', 'EOS 6D', 'EOS 6D Mark II', 'EOS 7D', 'EOS 7D Mark II',
    'EOS 60D', 'EOS 70D', 'EOS 80D', 'EOS 90D', 'EOS R', 'EOS Ra', 'EOS R5', 'EOS R6', 'EOS R6 Mark II', 'EOS R7'];
  var CAM_E17 = ['EOS 750D', 'EOS 760D', 'EOS 77D', 'EOS 800D', 'EOS 200D', 'EOS 250D', 'EOS 850D', 'EOS M3', 'EOS M5', 'EOS M6', 'EOS M6 Mark II', 'EOS RP', 'EOS R8', 'EOS R10', 'EOS R50', 'EOS R100'];
  var BAT = {
    LPE6: CAM_E6, LPE6N: CAM_E6, LPE6NH: CAM_E6, LPE17: CAM_E17,
    LPE10: ['EOS 1100D', 'EOS 1200D', 'EOS 1300D', 'EOS 2000D', 'EOS 4000D'],
    LPE12: ['EOS M', 'EOS M2', 'EOS M10', 'EOS M50', 'EOS M50 Mark II', 'EOS M100', 'EOS M200', 'EOS 100D'],
    LPE8: ['EOS 550D', 'EOS 600D', 'EOS 650D', 'EOS 700D'], LPE5: ['EOS 450D', 'EOS 500D', 'EOS 1000D'],
    NB13L: ['PowerShot G7 X', 'PowerShot G7 X Mark II', 'PowerShot G7 X Mark III', 'PowerShot G5 X', 'PowerShot G5 X Mark II', 'PowerShot G9 X', 'PowerShot G9 X Mark II',
      'PowerShot SX620 HS', 'PowerShot SX720 HS', 'PowerShot SX730 HS', 'PowerShot SX740 HS']
  };
  var CHARGER = { LCE6: 'LPE6', LCE6E: 'LPE6', LCE17: 'LPE17', LCE17E: 'LPE17', LCE10: 'LPE10', LCE10E: 'LPE10', LCE12: 'LPE12', LCE12E: 'LPE12', LCE8: 'LPE8', LCE8E: 'LPE8' };
  var GRIP = { BGE14: ['EOS 70D', 'EOS 80D', 'EOS 90D'], BGE13: ['EOS 6D'], BGE21: ['EOS 6D Mark II'], BGE16: ['EOS 7D Mark II'], BGE11: ['EOS 5D Mark III', 'EOS 5DS', 'EOS 5DS R'],
    BGE20: ['EOS 5D Mark IV'], BGE22: ['EOS R'], BGR10: ['EOS R5', 'EOS R6', 'EOS R6 Mark II'] };
  function hk(c) { var k = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return HOOD_ALIAS[k] || k; }
  /* (seq 212) أكواد السوق البديلة ⇐ كود كانون: «ET-60II» يُباع بديلاً لـET-60 (EF-S 55-250 IS II · EF 75-300 III) */
  var HOOD_ALIAS = { ET60II: 'ET60' };
  /* بطاريةٌ اسمها كاميرا لا كود («بطارية كوبي m50») ⇐ بطارية تلك الكاميرا */
  function batOfCam(key) {
    var k = hk(key); if (!k) return '';
    for (var b in BAT) if (BAT[b].some(function (c) { return hk(c.replace(/^EOS\s*/, '')) === k; })) return b;
    return '';
  }
  function lensTxt(l) { return 'Canon ' + l[0] + ' (' + l[1] + 'مم)'; }
  /* عدسات الجرد نفسه بقطر فلترها في مواصفاتها (أو في اسمها «Ø77») — قائمة المنتجات المحمّلة في الصفحة */
  function catalogLenses(D) {
    var all = (global.allProducts || global.products || global.prods || []), out = [];
    if (!Array.isArray(all)) return out;
    all.forEach(function (q) {
      if (!q || !q.name || kindOf(textOf(q)) !== 'other' || !/عدس|lens|\b(RF|EF|EF-S|EF-M|RF-S)\b/i.test(textOf(q) + ' ' + (q.category || ''))) return;
      var sp = q.specs && typeof q.specs === 'object' ? q.specs : {}, hit = false;
      Object.keys(sp).forEach(function (k) { if (!hit && /قطر|filter|فلتر/i.test(k) && new RegExp('(^|\\D)' + D + '(\\D|$)').test(lat(String(sp[k])))) hit = true; });
      if (!hit && new RegExp('[Øø⌀]\\s*' + D + '(\\D|$)').test(lat(q.name))) hit = true;
      if (hit) out.push(String(q.name).replace(/\s+/g, ' ').trim().slice(0, 80) + ' (' + D + 'مم)');
    });
    return out;
  }
  /* «متوافق مع» من المرجع الثابت + الجرد لمفتاح الدليل (keyOf) */
  function refFor(k) {
    if (!k || !k.key) return [];
    var out = [], m = k.key.match(/^D(\d{2,3}):(cap|filter|hood)$/);
    if (m) {
      var D = +m[1];
      LENSES.forEach(function (l) { if (l[1] === D) out.push(lensTxt(l)); });
      catalogLenses(D).forEach(function (x) { out.push(x); });
    } else if (k.kind === 'hood') {
      LENSES.forEach(function (l) { if (l[2] && hk(l[2]) === hk(k.key)) out.push(lensTxt(l)); });
    } else if (k.kind === 'battery' && (BAT[hk(k.key)] || batOfCam(k.key))) { var bk = BAT[hk(k.key)] ? hk(k.key) : batOfCam(k.key); out = (bk !== hk(k.key) ? ['بطارية ' + bk.replace(/^LPE/, 'LP-E').replace(/^NB/, 'NB-')] : []).concat(BAT[bk].map(function (c) { return 'Canon ' + c; })); }
    else if (k.kind === 'charger' && CHARGER[hk(k.key)]) { var b = CHARGER[hk(k.key)]; out = ['بطارية ' + b.replace(/^LPE/, 'LP-E')].concat(BAT[b].map(function (c) { return 'Canon ' + c; })); }
    else if (k.kind === 'grip' && GRIP[hk(k.key)]) { out = GRIP[hk(k.key)].map(function (c) { return 'Canon ' + c; }); }
    var seen = {}; return out.filter(function (x) { var z = x.toLowerCase(); if (seen[z]) return false; seen[z] = 1; return true; });
  }

  /* ── التحميل والذاكرة المحلية ── */
  function index() { S.idx = {}; S.rows.forEach(function (r) { (S.idx[r.item_key] = S.idx[r.item_key] || []).push(r); }); S.ver++; }
  function toCache() { try { localStorage.setItem(LS, JSON.stringify({ at: S.at, rows: S.rows })); } catch (_) {} }
  function notify() { try { global.dispatchEvent(new CustomEvent('gmt-compat-kb', { detail: { n: S.rows.length } })); } catch (_) {} }
  try { var c0 = JSON.parse(localStorage.getItem(LS) || 'null'); if (c0 && Array.isArray(c0.rows)) { S.rows = c0.rows; S.at = c0.at || 0; index(); } } catch (_) {}
  /* الجدول يُنشأ بموافقة المالك، ومعه صفّ gmt_settings «compat_kb_ready» في الهجرة نفسها. قبله: لا نداء للجدول إطلاقاً —
     مراقب الشبكة (gmt-core.js) يسجّل كل 404 خطأً حرجاً، فكانت كل صفحة جردٍ وبيع ستُنذر كذباً. التأكيد يُحفظ على الجهاز ولا يُسأل بعده. */
  var READY = 'gmt_compat_kb_ready';
  function ready() {
    try { if (localStorage.getItem(READY) === '1') return Promise.resolve(true); } catch (_) {}
    if (S.rdy) return S.rdy;
    var d = db(); if (!d || typeof fetch !== 'function') return Promise.resolve(false);
    S.rdy = fetch(d.url + '/rest/v1/gmt_settings?key=eq.compat_kb_ready&select=value', { headers: hdr() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (j) { var on = Array.isArray(j) && !!j[0] && String(j[0].value) === '1'; if (on) { try { localStorage.setItem(READY, '1'); } catch (_) {} } return on; })
      .catch(function () { return false; });
    S.rdy.then(function (on) { if (!on) setTimeout(function () { S.rdy = null; }, TTL); });
    return S.rdy;
  }
  function load(force) {
    if (loading) return loading;
    if (!force && Date.now() - Math.max(S.at, S.tried) < TTL && (S.at || S.tried)) return Promise.resolve(S.rows);
    var d = db(); if (!d || typeof fetch !== 'function') return Promise.resolve(S.rows);
    S.tried = Date.now();
    loading = ready().then(function (on) { return on ? fetch(d.url + '/rest/v1/gmt_compat_kb?select=' + COLS + '&order=created_at.desc&limit=5000', { headers: hdr() }) : null; })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) { if (Array.isArray(j)) { S.rows = j; S.at = Date.now(); index(); toCache(); notify(); } return S.rows; })
      .catch(function () { return S.rows; })
      .then(function (x) { loading = null; return x; });
    return loading;
  }

  /* «متوافق مع» من الدليل لمنتجٍ واحد — يقرؤه البحث (gmt-suggest.js · hitsProduct) */
  var _PK = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function fitsFor(p) {
    if (!p || typeof p !== 'object') return '';
    if (!loading && Date.now() - Math.max(S.at, S.tried) > TTL) load();
    var sig = textOf(p) + '|' + p.id + '|' + S.ver, c = _PK && _PK.get(p);
    if (c && c.sig === sig) return c.v;
    var kp = keysOf(p), seen = {}, list = [];
    /* (seq 206) المرجع الثابت أيضاً: «غطاء لعدسة 24-105» يجد غطاء 77 ولو لم يُكتب توافقه */
    var k0 = keyOf(p); (k0 && k0.key.slice(0, 2) !== 'P:' ? refFor(k0) : []).forEach(function (x) { if (!seen[x]) { seen[x] = 1; list.push(x); } });
    kp.keys.forEach(function (k) {
      (S.idx[k] || []).forEach(function (r) { if ((k.slice(0, 2) === 'P:' || r.kind === kp.kind) && !seen[r.fits]) { seen[r.fits] = 1; list.push(r.fits); } });
    });
    var v = list.join(' · ');
    if (_PK) _PK.set(p, { sig: sig, v: v });
    return v;
  }
  function rowsFor(key, kind) { return (S.idx[key] || []).filter(function (r) { return !kind || r.kind === kind; }); }

  function ukOf(key, fits) { return (key + '|' + String(fits).replace(/\s+/g, ' ').trim()).toLowerCase().slice(0, 320); }
  /* إضافة ما وُجد في الإنترنت — list: نصوص أو {fits, source_url, source_title} · المكرّر يُتجاهل (في الذاكرة وفي القاعدة) */
  async function add(k, list, o) {
    o = o || {};
    var d = db(); if (!d || !k || !k.key || !Array.isArray(list) || !list.length || !(await ready())) return 0;
    var by = ''; try { by = localStorage.getItem('gmt_operator_name') || ''; } catch (_) {}
    var seen = {}, rows = list.map(function (x) {
      var f = String(typeof x === 'string' ? x : (x && x.fits) || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (!f) return null;
      var u = ukOf(k.key, f);
      if (seen[u] || S.rows.some(function (r) { return r.uk === u; })) return null;
      seen[u] = 1;
      var src = (x && typeof x === 'object' && x.source_url) || o.source_url || '', st = (x && typeof x === 'object' && x.source_title) || o.source_title || '';
      return { uk: u, item_key: k.key, item: String(k.item || k.key).slice(0, 80), kind: k.kind || 'other', fits: f,
        note: String(o.note || '').slice(0, 300) || null, source_url: String(src).slice(0, 700) || null, source_title: String(st).slice(0, 200) || null,
        origin: 'web', product_id: o.product_id != null && o.product_id !== '' ? String(o.product_id) : null,
        product_name: String(o.product_name || '').slice(0, 200) || null, created_by: by || null };
    }).filter(Boolean);
    if (!rows.length) return 0;
    var r = await fetch(d.url + '/rest/v1/gmt_compat_kb?on_conflict=uk', { method: 'POST', headers: hdr({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' }), body: JSON.stringify(rows) });
    if (!r.ok) return 0;
    var j = []; try { j = await r.json(); } catch (_) {}
    j = Array.isArray(j) ? j : [];
    j.forEach(function (x) { if (x && !S.rows.some(function (y) { return y.uk === x.uk; })) S.rows.unshift(x); });
    index(); toCache(); notify();
    return j.length;
  }
  async function remove(id) {
    var d = db(); if (!d || id == null) return false;
    var r = await fetch(d.url + '/rest/v1/gmt_compat_kb?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: hdr({ Prefer: 'return=representation' }) });
    if (!r.ok) return false;
    var j = []; try { j = await r.json(); } catch (_) {}
    if (Array.isArray(j) && !j.length) return false;      // لم يُحذف شيء (صلاحية أو محذوفٌ من قبل)
    S.rows = S.rows.filter(function (x) { return String(x.id) !== String(id); });
    index(); toCache(); notify();
    return true;
  }

  /* ══ (المالك seq 217 «البحث عن الغطاء أو الهود أو البطارية من اسم التوافق لا يعمل: بجارية 700d · هود عدسة 18-55 · غطا عدسة 85») ══
     يُفهم البحث «نوعٌ + ما يركب عليه» من المرجع الثابت: بطارية 700D ⇐ LP-E8 · هود 18-55 ⇐ EW-63C / EW-60C أو هود لولبي 58مم ·
     غطاء 85 ⇐ قطر عدسات 85 (58 · 67 · 72 · 77 · 82). الأخطاء الإملائية الشائعة في اسم النوع مقبولة («بجارية» · «بطاريه» · «غطا» · «هوود»). */
  var INTENT = [['charger', /^(شاحن|شواحن|charger|charge)$/], ['battery', /^(ب[طتجظ]ا?ر[يى][هةا]?|بطاري\S*|batter\S*|battr\S*|باتري)$/], ['hood', /^(هود|هوود|هودات|hood|hoods|حاجب)$/],
    ['cap', /^(غطا|غطاء|غطاي|غطايه|اغطيه|اغطية|cap|caps|كاب)$/], ['filter', /^(فلتر|فلاتر|filter|filters)$/], ['grip', /^(قبضه|قبضة|grip)$/]];
  var INTENT_FILL = /^(عدسه|عدسة|لعدسه|لعدسة|للعدسه|العدسه|عدسات|lens|for|ل|لل|على|مع|تبع|حق|كاميرا|كمرا|كميرا|camera|canon|كانون|eos|ايوس|متوافق|يركب|يناسب|اصلي|كوبي|original|copy)$/;
  function intentKind(w) { for (var i = 0; i < INTENT.length; i++) if (INTENT[i][1].test(w)) return INTENT[i][0]; return ''; }
  function camsOf(key) { var k = hk(key), out = []; for (var b in BAT) BAT[b].forEach(function (c) { if (hk(c.replace(/^EOS\s*/, '')) === k && out.indexOf(c) < 0) out.push(c); }); return out; }
  /* العدسات المطابقة لكلمات البحث: البُعد البؤري (18-55 · 85) شرط · فتحة العدسة (1.8) والتركيب (RF · EF-S · M) إن كُتبت */
  function lensesOf(words) {
    var foc = '', ap = '', mount = '', vars = [];
    words.forEach(function (w, i) {
      if (/^(stm|usm|is|ii|iii|l|macro|nano)$/.test(w)) { vars.push(w.toUpperCase()); return; }   // «50 STM 1.8» ≠ «50 1.8 II»
      var r = /^(\d{1,3})[-_](\d{2,3})(mm)?$/.exec(w);
      if (r) { foc = r[1] + '-' + r[2]; return; }
      if (/^\d{2,3}(mm)?$/.test(w) && !foc) { var n = w.replace(/mm$/, ''), nx = words[i + 1] || ''; if (/^\d{2,3}(mm)?$/.test(nx) && +nx.replace(/mm$/, '') > +n) foc = n + '-' + nx.replace(/mm$/, ''); else foc = n; return; }
      var a = /^f?\/?(\d\.\d|\d)$/.exec(w); if (a && foc) { ap = a[1]; return; }
      if (/^(rf|ef|efs|ef-s|rfs|rf-s|m|efm|ef-m)$/.test(w)) mount = w.replace(/-/g, '');
    });
    if (!foc) return [];
    return LENSES.filter(function (l) {
      var nm = l[0], m = /^(RF-S|RF|EF-S|EF-M|EF)\s+([\d-]+)mm\s+f\/([\d.]+)/.exec(nm); if (!m) return false;
      if (m[2] !== foc) return false;
      if (ap && m[3].split('-')[0] !== ap) return false;
      if (vars.length) { var tk = nm.toUpperCase().replace(/(\d)L\b/g, '$1 L').split(/[\s\/]+/); if (!vars.every(function (v) { return v === 'NANO' ? tk.indexOf('USM') >= 0 : tk.indexOf(v) >= 0; })) return false; }
      if (mount) { var mm = m[1].toLowerCase().replace(/-/g, ''); if (mount === 'm' || mount === 'efm' ? mm !== 'efm' : mount === 'ef' ? mm !== 'ef' : mm !== mount) return false; }
      return true;
    });
  }
  /* يُرجع { kind, codes:[أكواد المنتج المطلوب] , diams:[أقطار], cams, lenses, say:«الجملة للعرض» } أو null إن لم يكن البحث «نوع + هدف» */
  var _RC = {};
  function resolve(q) {
    q = String(q == null ? '' : q); if (_RC[q] !== undefined) return _RC[q];
    var words = lat(q).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ء/g, '').replace(/[^\p{L}\p{N}.\-_\/]+/gu, ' ').trim().split(' ').filter(Boolean);
    var kind = '', rest = [];
    words.forEach(function (w) { var k = intentKind(w); if (k && !kind) kind = k; else if (!INTENT_FILL.test(w)) rest.push(w); });
    var out = null;
    if (kind && rest.length) {
      if (kind === 'battery' || kind === 'charger' || kind === 'grip') {
        var cams = [], tried = rest.concat(rest.slice(1).map(function (w, i) { return rest[i] + w; }), rest.slice(2).map(function (w, i) { return rest[i] + rest[i + 1] + w; }));   // «5D Mark IV» ثلاث كلمات
        tried.forEach(function (w) { camsOf(w).forEach(function (c) { if (cams.indexOf(c) < 0) cams.push(c); }); });
        cams.sort(function (a, b) { return b.length - a.length; });   // «R6 Mark II» قبل «R6»
        if (cams.length) {
          var bats = Object.keys(BAT).filter(function (b) { return cams.some(function (c) { return BAT[b].indexOf(c) >= 0; }); });
          if (kind === 'grip') { var gs = Object.keys(GRIP).filter(function (g) { return cams.some(function (c) { return GRIP[g].indexOf(c) >= 0; }); });
            out = { kind: kind, codes: gs, diams: [], cams: cams, lenses: [], say: 'قبضة Canon ' + cams[0] + (gs.length ? ' ⇐ ' + gs.map(function (g) { return g.replace(/^BG/, 'BG-'); }).join(' / ') : '') }; }
          else {
            var chg = Object.keys(CHARGER).filter(function (c) { return bats.indexOf(CHARGER[c]) >= 0; });
            var nice = function (b) { return b.replace(/^LPE/, 'LP-E').replace(/^LCE/, 'LC-E').replace(/^NB/, 'NB-'); };
            out = { kind: kind, codes: kind === 'battery' ? bats : chg.concat(bats), diams: [], cams: cams, lenses: [],
              say: (kind === 'battery' ? 'بطارية' : 'شاحن') + ' Canon ' + cams[0] + ' ⇐ ' + (kind === 'battery' ? bats.map(nice).join(' / ') : chg.filter(function (c) { return !/E$/.test(c); }).map(nice).join(' / ') + ' (لبطارية ' + bats.map(nice).join(' / ') + ')') };
          }
        }
      } else {
        var ls = lensesOf(rest), STD = [37, 39, 43, 46, 49, 52, 55, 58, 62, 67, 72, 77, 82, 86, 95, 105];
        var dd = rest.map(function (w) { var m = /^(\d{2,3})(mm|مم|ملم)?$/.exec(w); return m ? +m[1] : 0; }).filter(function (n) { return STD.indexOf(n) >= 0; });
        if (!ls.length && dd.length && kind !== 'hood') out = { kind: kind, codes: [], diams: dd, cams: [], lenses: [], say: (kind === 'cap' ? 'غطاء' : 'فلتر') + ' قطر ' + dd.join(' / ') + 'مم' };
        else if (ls.length) {
          var diams = [], hoods = [];
          ls.forEach(function (l) { if (l[1] && diams.indexOf(l[1]) < 0) diams.push(l[1]); if (l[2] && hoods.indexOf(hk(l[2])) < 0) hoods.push(hk(l[2])); });
          if (kind !== 'hood') ls = ls.slice().sort(function (a, b) { return a[1] - b[1]; });   // الأقطار من الأصغر (58 قبل 82)
          var by = ls.map(function (l) { return l[0] + ' ⇐ ' + (kind === 'hood' ? (l[2] || 'هود لولبي ' + l[1] + 'مم') : l[1] + 'مم'); });
          out = { kind: kind, codes: kind === 'hood' ? hoods : [], diams: diams, cams: [], lenses: ls.map(function (l) { return l[0]; }),
            say: (kind === 'hood' ? 'هود' : kind === 'cap' ? 'غطاء' : 'فلتر') + ' لعدسة ' + rest.join(' ') + ': ' + by.slice(0, 6).join(' · ') + (by.length > 6 ? ' …' : '') };
        }
      }
    }
    _RC[q] = out; return out;
  }
  /* هل يحقّق منتجُ الجرد/المتجر هذا البحثَ المفهوم؟ — النوع نفسه ثمّ الكود (LP-E8 · EW-63C) أو القطر (غطاء/فلتر/هود لولبي) أو الكاميرا في «متوافق مع» */
  function intentHit(p, it) {
    if (!p || !it) return false;
    var nm = [p.name, p.short_name, p.short].filter(Boolean).join(' '), k = kindOf(nm + ' ' + (p.group_name || ''));
    if (kindOf(nm) !== 'other') k = kindOf(nm);
    if (k !== it.kind) return false;
    /* الكود كاملاً بجيله (ES-68 ≠ ES-68 II) — والبديل المعروف في السوق يُقبل (ET-60II = ET-60) */
    var pc = codesOf([nm, p.alt_names, p.model].filter(Boolean).join(' ')).map(function (c) { return hk(c.k); });
    if (it.codes.some(function (c) { return pc.indexOf(c) >= 0; })) return true;
    if (it.diams.length && (it.kind === 'cap' || it.kind === 'filter' || it.kind === 'hood' && !bayonet(codesOf(nm)))) {
      var d = diamOf(nm) || diamOf(String(p.alt_names || '').split(/[،,]/)[0]);
      if (d && it.diams.indexOf(d) >= 0) return true;
    }
    if (it.cams.length) {
      var c = String(Array.isArray(p.compat) ? p.compat.join(' ') : p.compat || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
      if (it.cams.some(function (x) { return new RegExp(x.toUpperCase().replace(/[^A-Z0-9]+/g, '') + '(?![0-9A-Z])').test(c); })) return true;
    }
    return false;
  }
  global.GMTCompatKB = { load: load, ready: ready, rows: function () { return S.rows; }, keyOf: keyOf, keysOf: keysOf, kindOf: kindOf, codesOf: codesOf, diamOf: diamOf,
    fitsFor: fitsFor, rowsFor: rowsFor, refFor: refFor, resolve: resolve, intentHit: intentHit, intentKind: intentKind, _lenses: LENSES, add: add, remove: remove };
  /* المتجر (صفحة الزبون) يستعمل المرجع الثابت وحده للبحث بالتوافق (seq 221) — لا نداء لقاعدة الدليل منه */
  if (typeof setTimeout === 'function' && !global.GMT_COMPAT_NOLOAD) setTimeout(function () { load(); }, 1200);
})(typeof window !== 'undefined' ? window : this);
