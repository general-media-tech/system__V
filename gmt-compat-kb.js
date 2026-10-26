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
    if (!S.rows.length) return '';
    var sig = textOf(p) + '|' + p.id + '|' + S.ver, c = _PK && _PK.get(p);
    if (c && c.sig === sig) return c.v;
    var kp = keysOf(p), seen = {}, list = [];
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
    fitsFor: fitsFor, rowsFor: rowsFor, add: add, remove: remove };
  if (typeof setTimeout === 'function') setTimeout(function () { load(); }, 1200);
})(typeof window !== 'undefined' ? window : this);
