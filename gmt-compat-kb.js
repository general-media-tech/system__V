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
    t = lat(t);
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
  function codesOf(t) {
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
    ['EF 28-300mm f/3.5-5.6L IS USM', 77, 'EW-83G'], ['EF 70-200mm f/2.8L USM', 77, 'ET-86'], ['EF 70-200mm f/2.8L IS USM', 77, 'ET-86'],
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
  function hk(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
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
    } else if (k.kind === 'battery' && BAT[hk(k.key)]) { out = BAT[hk(k.key)].map(function (c) { return 'Canon ' + c; }); }
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

  global.GMTCompatKB = { load: load, ready: ready, rows: function () { return S.rows; }, keyOf: keyOf, keysOf: keysOf, kindOf: kindOf, codesOf: codesOf, diamOf: diamOf,
    fitsFor: fitsFor, rowsFor: rowsFor, refFor: refFor, _lenses: LENSES, add: add, remove: remove };
  if (typeof setTimeout === 'function') setTimeout(function () { load(); }, 1200);
})(typeof window !== 'undefined' ? window : this);
