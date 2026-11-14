/* gmt-packages.js — الباقات (TASK-0321 · المالك seq 514)
   «اضافه بكجات سواء في المتجر او نقاط البيع — بكج اكثر من منتج ولهم سعر خاص او سعر محسوم»

   مصدرٌ واحد: جدول العروض نفسه (gmt_offers · offer_type = 'bundle') في القاعدة الرئيسية، فتظهر الباقة في:
     • نقطة البيع تحت «🔥 العروض الخاصة» (كانت تدعم الباقة: سطراً واحداً أو مفكّكة، وخصم مخزون كلّ مكوّن)،
     • المتجر في قسم «📦 الباقات» وتُضاف للسلّة، والطلب يُكتب بمكوّناتها (فيتحوّل لفاتورة بمخزونٍ صحيح).
   targets = { pos: true|false, store: true|false, mode: 'price'|'percent'|'amount', value: n } — غيابها (باقات قديمة) = نقطة البيع وحدها.
   المكوّنات products = [{ id, name, qty, price, image_url }] — تُحفظ نصّ JSON كما تحفظها الشاشات القديمة (يقرؤها الكلّ). */
(function (g) {
  'use strict';
  var doc = g.document;
  var r2 = function (x) { var n = Number(x); return isFinite(n) ? Math.round((n + (n >= 0 ? 1e-9 : -1e-9)) * 100) / 100 : 0; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function db() {
    var d = (g.GMT_DB && g.GMT_DB.MAIN) || null;
    if (d && d.url) return d;
    var C = g.CONFIG || {};
    return C.SUPABASE_URL ? { url: C.SUPABASE_URL, key: C.SUPABASE_ANON_KEY || C.SUPABASE_KEY } : null;
  }
  function H(extra) { var d = db(); var h = { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' }; for (var k in (extra || {})) h[k] = extra[k]; return h; }
  function parseItems(o) {
    var a = o && o.products; if (typeof a === 'string') { try { a = JSON.parse(a); } catch (_) { a = []; } }
    return (Array.isArray(a) ? a : []).filter(function (x) { return x && x.id != null; })
      .map(function (x) { return { id: String(x.id), name: String(x.name || ''), qty: Math.max(1, parseInt(x.qty, 10) || 1), price: Number(x.price) || 0, image_url: x.image_url || '' }; });
  }
  /* (seq 518) قسم المتجر «باقات وعروض» — الباقة تُصنَّف فيه وفي أيّ قسمٍ آخر كالمنتج */
  var PKG_CAT = 'c_bundles';
  function targetsOf(o) {
    var t = o && o.targets; if (typeof t === 'string') { try { t = JSON.parse(t); } catch (_) { t = null; } }
    t = (t && typeof t === 'object') ? t : {};
    return { pos: t.pos !== false, store: t.store === true, mode: t.mode || 'price', value: t.value,
      /* (seq 515) «البكج يكون في مكان معين وله تصنيف»: أقسام المتجر التي تظهر فيها (كاميرات · عروض حصرية …) + قسم «📦 الباقات» نفسه */
      cats: (function () { var c = Array.isArray(t.cats) ? t.cats.map(String) : []; if (t.own !== false && c.indexOf(PKG_CAT) === -1) c.unshift(PKG_CAT); return c; })(), own: false };
  }

  /* السعر: مجموع أسعار المكوّنات × كمّياتها ⇐ «سعر خاص» أو «خصم %» أو «خصم $» */
  function compute(items, mode, value) {
    var sum = r2((items || []).reduce(function (s, x) { return s + (Number(x.price) || 0) * (Number(x.qty) || 1); }, 0));
    var v = Number(value), price;
    if (mode === 'percent') price = sum * (1 - Math.min(100, Math.max(0, isFinite(v) ? v : 0)) / 100);
    else if (mode === 'amount') price = sum - Math.max(0, isFinite(v) ? v : 0);
    else price = isFinite(v) ? v : 0;
    price = r2(Math.max(0, price));
    var save = r2(Math.max(0, sum - price));
    return { sum: sum, price: price, save: save, pct: sum > 0 ? Math.round(save / sum * 100) : 0 };
  }

  /* توزيع سعر الباقة على مكوّناتها بنسبة أسعارها (آخر سطرٍ يأخذ الباقي فيساوي المجموع سعرها تماماً) — للطلب والفاتورة */
  function expand(pkgItems, pkgPrice, pkgQty) {
    var items = pkgItems || [], qn = Math.max(1, Number(pkgQty) || 1), total = r2(Number(pkgPrice) * qn);
    var base = items.reduce(function (s, x) { return s + (Number(x.price) || 0) * (Number(x.qty) || 1); }, 0);
    var used = 0;
    return items.map(function (x, i) {
      var q = (Number(x.qty) || 1) * qn;
      var w = base > 0 ? ((Number(x.price) || 0) * (Number(x.qty) || 1)) / base : 1 / items.length;
      var line = i === items.length - 1 ? r2(total - used) : r2(total * w);
      used = r2(used + line);
      return { id: x.id, name: x.name, qty: q, line: line, unit: q ? Math.round(line / q * 1e4) / 1e4 : 0, image_url: x.image_url || '' };
    });
  }

  /* ── القراءة ── */
  async function fetchAll(opts) {
    opts = opts || {}; var d = db(); if (!d) return [];
    var q = d.url + '/rest/v1/gmt_offers?offer_type=eq.bundle&select=*&order=created_at.desc' + (opts.active ? '&is_active=eq.true' : '');
    var r = await fetch(q, { headers: H() }); if (!r.ok) throw new Error('HTTP ' + r.status);
    var rows = await r.json(); return Array.isArray(rows) ? rows : [];
  }
  /* باقات المتجر: فعّالة · لم تنتهِ · «في المتجر» · مكوّناتها معروفة */
  async function forStore() {
    var now = new Date().toISOString();
    var rows = (await fetchAll({ active: true })).filter(function (o) { return targetsOf(o).store && !(o.ends_at && o.ends_at < now); });
    /* (seq 515) «يضغط على عرض المنتجات وياخذها لصفحة كل منتج» ⇒ رابط كلّ مكوّن في المتجر (store_url «#product=») */
    var sid = {}, inv = {};
    try {
      var ids = []; rows.forEach(function (o) { parseItems(o).forEach(function (x) { if (ids.indexOf(x.id) === -1) ids.push(x.id); }); });
      if (ids.length) {
        var d = db(), r = await fetch(d.url + '/rest/v1/products?id=in.(' + ids.map(encodeURIComponent).join(',') + ')&select=id,name,price,image_url,store_url', { headers: H() });
        /* (seq 516) باقاتٌ قديمة حُفظت مكوّناتها بلا سعرٍ ولا صورة ⇒ تُكمَل من الجرد نفسه (السعر الحالي · الصورة · رابط المتجر) */
        if (r.ok) (await r.json()).forEach(function (p) { var m = /#product=([^&\s]+)/.exec(String(p.store_url || '')); inv[String(p.id)] = p; if (m) sid[String(p.id)] = decodeURIComponent(m[1]); });
      }
    } catch (_) {}
    return rows
      .map(function (o) {
        var items = parseItems(o), imgs = [];
        try { imgs = Array.isArray(o.images) ? o.images : (typeof o.images === 'string' ? JSON.parse(o.images) : []); } catch (_) { imgs = []; }
        if (o.image_url && imgs.indexOf(o.image_url) === -1) imgs.unshift(o.image_url);
        items.forEach(function (x) { if (x.image_url && imgs.indexOf(x.image_url) === -1) imgs.push(x.image_url); });
        var sum = r2(items.reduce(function (s, x) { return s + x.price * x.qty; }, 0)), t = targetsOf(o);
        items.forEach(function (x) { var q = inv[x.id]; if (sid[x.id]) x.sid = sid[x.id]; if (q) { if (!(x.price > 0)) x.price = Number(q.price) || 0; if (!x.image_url && q.image_url) x.image_url = q.image_url; if (!x.name) x.name = q.name || ''; } });
        sum = r2(items.reduce(function (s, x) { return s + x.price * x.qty; }, 0));
        return { id: String(o.id), name: o.name, description: o.description || '', images: imgs.slice(0, 16), items: items,
          price: Number(o.offer_price) || 0,
          /* «قبل الخصم» = مجموع أسعار منتجاتها الحالية إن عُرفت كلّها، وإلّا الرقم المحفوظ */
          original: items.every(function (x) { return x.price > 0; }) && sum > 0 ? sum : (Number(o.original_price) || sum),
          ends_at: o.ends_at || null, cats: t.cats, own: t.own };
      }).filter(function (p) { return p.items.length && p.price > 0; });
  }

  /* ── المنتجات للاختيار (صفحاتٌ من ١٠٠٠ — حدّ القاعدة) ── */
  var _prods = null;
  async function products() {
    if (_prods) return _prods;
    var d = db(), all = [];
    for (var off = 0; off < 20000; off += 1000) {
      var r = await fetch(d.url + '/rest/v1/products?select=id,name,price,image_url,net_cost,wholesale_price,barcode&order=name.asc&limit=1000&offset=' + off, { headers: H() });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var rows = await r.json(); all = all.concat(rows || []); if (!rows || rows.length < 1000) break;
    }
    _prods = all.filter(function (p) { return p && p.name; }); return _prods;
  }

  /* ── الحفظ ── */
  async function save(rec, id) {
    var d = db(); if (!d) throw new Error('إعداد القاعدة غير متاح');
    var url = d.url + '/rest/v1/gmt_offers' + (id ? '?id=eq.' + encodeURIComponent(id) : '');
    var r = await fetch(url, { method: id ? 'PATCH' : 'POST', headers: H({ Prefer: 'return=representation' }), body: JSON.stringify(rec) });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text().catch(function () { return ''; })).slice(0, 140));
    var rows = await r.json().catch(function () { return []; });
    if (!Array.isArray(rows) || !rows.length) throw new Error('لم يُحفظ (لا صفّ بعد الكتابة)');
    return rows[0];
  }

  /* ── نافذة الإنشاء/التعديل ── */
  var CSS = '#gmt-pkg{position:fixed;inset:0;z-index:9600;background:rgba(15,18,25,.5);display:grid;place-items:center;padding:12px;direction:rtl;font-family:Cairo,Tajawal,Tahoma,sans-serif}' +
    '#gmt-pkg .bx{width:100%;max-width:640px;max-height:92vh;overflow:auto;background:#fff;border-radius:22px;padding:16px 16px 18px;box-sizing:border-box}' +
    '#gmt-pkg h3{margin:0;font-size:17px;flex:1}#gmt-pkg .hd{display:flex;align-items:center;gap:8px;margin-bottom:8px}' +
    '#gmt-pkg label.l{display:block;font-size:12px;font-weight:800;color:#334155;margin:10px 0 4px}' +
    '#gmt-pkg input[type=text],#gmt-pkg input[type=number],#gmt-pkg input[type=url],#gmt-pkg input[type=datetime-local],#gmt-pkg textarea{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px}' +
    '#gmt-pkg .x{border:0;background:#f1f5f9;border-radius:10px;padding:7px 12px;font:inherit;font-weight:800;cursor:pointer}' +
    '#gmt-pkg .res{border:1px solid #e2e8f0;border-radius:12px;margin-top:4px;max-height:220px;overflow:auto}#gmt-pkg .res:empty{display:none}' +
    '#gmt-pkg .ri{display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:13px}#gmt-pkg .ri:hover{background:#fef2f2}' +
    '#gmt-pkg .ri img,#gmt-pkg .it img{width:36px;height:36px;object-fit:contain;border-radius:8px;background:#f8fafc;flex-shrink:0}' +
    '#gmt-pkg .it{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #eef2f7;border-radius:12px;margin-top:6px}' +
    '#gmt-pkg .it .nm{flex:1;min-width:0;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#gmt-pkg .st{display:flex;align-items:center;gap:4px}#gmt-pkg .st button{width:30px;height:30px;border-radius:9px;border:1px solid #e2e8f0;background:#fff;font-size:16px;font-weight:900;cursor:pointer}' +
    '#gmt-pkg .st b{min-width:22px;text-align:center}#gmt-pkg .seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}' +
    '#gmt-pkg .seg button{padding:9px 6px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font:inherit;font-size:13px;font-weight:800;cursor:pointer}#gmt-pkg .seg button.on{border-color:#D5001C;color:#D5001C;background:#fef2f2}' +
    '#gmt-pkg .sum{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}#gmt-pkg .sum div{background:#f8fafc;border-radius:12px;padding:8px;text-align:center;font-size:11px;color:#526077;font-weight:700}' +
    '#gmt-pkg .sum b{display:block;font-size:16px;color:#0f172a}#gmt-pkg .sum .p b{color:#D5001C}#gmt-pkg .warn{color:#b45309;font-size:12px;font-weight:800;margin-top:6px}' +
    '#gmt-pkg .imgs{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}#gmt-pkg .imgs img{width:58px;height:58px;object-fit:contain;border-radius:10px;border:3px solid transparent;background:#f8fafc;cursor:pointer}#gmt-pkg .imgs img.on{border-color:#D5001C}' +
    '#gmt-pkg .pimgs{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}#gmt-pkg .pim{position:relative;width:86px;border:2px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:3px}#gmt-pkg .pim.first{border-color:#D5001C}#gmt-pkg .pim img{width:100%;height:76px;object-fit:contain;display:block;border-radius:8px}' +
    '#gmt-pkg .pim .tg{position:absolute;top:4px;right:4px;background:#D5001C;color:#fff;font-size:10px;font-weight:900;border-radius:6px;padding:0 5px}#gmt-pkg .pim .bt{display:flex;justify-content:space-between;margin-top:3px}#gmt-pkg .pim .bt button{border:0;background:#fff;border-radius:6px;width:20px;height:20px;font-size:11px;cursor:pointer;padding:0;box-shadow:0 1px 3px rgba(0,0,0,.12)}' +
    '#gmt-pkg .addimg{display:flex;gap:6px;margin-top:6px}#gmt-pkg .addimg input{flex:1}#gmt-pkg .addimg button,#gmt-pkg .upl{border:1.5px solid #e2e8f0;background:#fff;border-radius:10px;padding:0 12px;font:inherit;font-weight:800;cursor:pointer;white-space:nowrap}' +
    '#gmt-pkg .cats{display:flex;gap:6px;flex-wrap:wrap}#gmt-pkg .cats button{border:1.5px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 11px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}#gmt-pkg .cats button.on{border-color:#D5001C;background:#fef2f2;color:#D5001C}' +
    '#gmt-pkg .chk{display:flex;gap:14px;flex-wrap:wrap;font-size:13.5px;font-weight:800}#gmt-pkg .err{min-height:1.2em;color:#b91c1c;font-size:13px;font-weight:800;margin-top:8px}' +
    '#gmt-pkg .go{width:100%;margin-top:6px;background:#D5001C;color:#fff;border:0;border-radius:14px;padding:13px;font:inherit;font-size:15px;font-weight:900;cursor:pointer}#gmt-pkg .go:disabled{opacity:.6}';

  function open(opts) {
    opts = opts || {};
    var o = opts.offer || null, t = targetsOf(o || { targets: { pos: true, store: true } });
    var S = { items: o ? parseItems(o) : [], mode: o ? (t.mode || 'price') : 'percent', value: o ? (t.value != null ? t.value : o.offer_price) : 10,
      cover: (o && o.image_url) || '', images: (function () { var a = []; try { a = Array.isArray(o && o.images) ? o.images.slice() : (o && typeof o.images === 'string' ? JSON.parse(o.images) : []); } catch (_) { a = []; } if (o && o.image_url && a.indexOf(o.image_url) === -1) a.unshift(o.image_url); return a.filter(Boolean).map(String); })(), pos: o ? t.pos : true, store: o ? t.store : true, cats: t.cats.slice(), own: o ? t.own : true, CATS: null };
    if (!doc.getElementById('gmt-pkg-css')) { var st = doc.createElement('style'); st.id = 'gmt-pkg-css'; st.textContent = CSS; doc.head.appendChild(st); }
    var old = doc.getElementById('gmt-pkg'); if (old) old.remove();
    var w = doc.createElement('div'); w.id = 'gmt-pkg'; w.setAttribute('data-keep-fab', '1');
    var endsVal = '';
    if (o && o.ends_at) { var dd = new Date(o.ends_at); endsVal = new Date(dd.getTime() - dd.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    w.innerHTML = '<div class="bx"><div class="hd"><h3>📦 ' + (o ? 'تعديل الباقة' : 'باقة جديدة') + '</h3><button type="button" class="x" data-close>✕</button></div>' +
      '<label class="l">اسم الباقة *</label><input type="text" data-name maxlength="120" value="' + esc(o ? o.name : '') + '" placeholder="مثلاً: باقة صانع المحتوى">' +
      '<label class="l">منتجات الباقة * <small style="color:#64748b">(ابحث بالاسم أو الباركود)</small></label><input type="text" data-q placeholder="🔍 ابحث عن منتج لإضافته…"><div class="res" data-res></div><div data-items></div>' +
      '<label class="l">السعر</label><div class="seg"><button type="button" data-m="price">💲 سعر خاص</button><button type="button" data-m="percent">٪ خصم نسبة</button><button type="button" data-m="amount">➖ خصم مبلغ</button></div>' +
      '<input type="number" data-v step="0.01" min="0" style="margin-top:6px;font-size:18px;font-weight:900;text-align:center">' +
      '<div class="sum"><div>مجموع أسعارها<b data-s1>0</b></div><div class="p">سعر الباقة<b data-s2>0</b></div><div>توفير الزبون<b data-s3>0</b></div></div><div class="warn" data-warn></div>' +
      '<label class="l">تظهر في</label><div class="chk"><label><input type="checkbox" data-pos> نقاط البيع</label><label><input type="checkbox" data-store> المتجر الإلكتروني</label></div>' +
      '<div data-catsbox><label class="l">أقسامها في المتجر <small style="color:#64748b">(كالمنتج: «باقات وعروض» وأيّ قسمٍ آخر — مثلاً «الكاميرات»)</small></label><div class="cats" data-cats><span style="font-size:12px;color:#94a3b8">جارٍ تحميل أقسام المتجر…</span></div></div>' +
      /* (المالك seq B690) «الباقات ممكن أنا أتحكّم في تعديل الصور … المصمّمة هي الواجهة ثمّ صورة عدد القطع ثمّ بوستر كلّ منتج — وفيني أعدّل فيهم» */
      '<label class="l">صور الباقة <small style="color:#64748b">(الأولى هي الواجهة · رتّبها بالأسهم · ⭐ تجعلها الواجهة)</small></label><div class="pimgs" data-pimgs></div>' +
      '<div style="font-size:11.5px;color:#64748b;font-weight:800;margin-top:8px">أضف من صور منتجاتها:</div><div class="imgs" data-imgs></div>' +
      '<div class="addimg"><input type="url" data-cover placeholder="أو الصق رابط صورة https://…"><button type="button" data-addurl>➕ إضافة</button><label class="upl" style="display:flex;align-items:center">📤 رفع<input type="file" accept="image/*" data-upload multiple style="display:none"></label></div>' +
      '<button type="button" class="upl" data-gengrid style="margin-top:8px;padding:9px 12px;width:100%;border-color:#D5001C;color:#D5001C">🧩 توليد صورة المنتجات تلقائياً (كلّ منتج في مربّع أبيض + السعر)</button>' +
      '<label class="l">الوصف (اختياري)</label><textarea data-desc rows="2">' + esc(o ? (o.description || '') : '') + '</textarea>' +
      '<label class="l">تنتهي في (اختياري)</label><input type="datetime-local" data-ends value="' + endsVal + '">' +
      (o ? '<label class="l"><input type="checkbox" data-active ' + (o.is_active !== false ? 'checked' : '') + '> فعّالة</label>' : '') +
      '<div class="err" data-err></div><button type="button" class="go" data-save>💾 حفظ الباقة</button></div>';
    doc.body.appendChild(w);
    var $ = function (s) { return w.querySelector(s); };
    $('[data-pos]').checked = !!S.pos; $('[data-store]').checked = !!S.store;
    var PR = [];
    /* أقسام المتجر (قاعدة المتجر) — للاختيار */
    (async function () {
      var box = $('[data-cats]');
      try {
        var st = g.GMT_DB && g.GMT_DB.STORE, list = [];
        if (st && st.url) { var r = await fetch(st.url + '/rest/v1/gmt_store?id=eq.1&select=categories', { headers: { apikey: st.key, Authorization: 'Bearer ' + st.key } }); if (r.ok) { var rr = await r.json(); list = (rr && rr[0] && rr[0].categories) || []; } }
        S.CATS = (Array.isArray(list) ? list : []).filter(function (c) { return c && c.id && c.name && !/c1775889709555|c_hidden_products/.test(String(c.id)); });
      } catch (_) { S.CATS = []; }
      paintCats();
    })();
    function paintCats() {
      var box = $('[data-cats]'); if (!box || !S.CATS) return;
      if (!S.CATS.some(function (c) { return String(c.id) === PKG_CAT; })) S.CATS.unshift({ id: PKG_CAT, name: 'باقات وعروض' });
      box.innerHTML = S.CATS.map(function (c) { return '<button type="button" data-cat="' + esc(c.id) + '" class="' + (S.cats.indexOf(String(c.id)) !== -1 ? 'on' : '') + '">' + (c.parent_id ? '↳ ' : '') + esc(c.name) + '</button>'; }).join('');
      $('[data-catsbox]').style.display = $('[data-store]').checked ? '' : 'none';
    }
    $('[data-store]').addEventListener('change', paintCats);
    products().then(function (a) { PR = a; S.items.forEach(function (x) { var p = PR.find(function (y) { return String(y.id) === x.id; }); if (p) { x.cost = Number(p.net_cost) || 0; if (!x.image_url) x.image_url = p.image_url || ''; } }); paint(); }).catch(function (e) { $('[data-err]').textContent = 'تعذّر تحميل المنتجات: ' + e.message; });
    (opts.preselect || []).forEach(function (p) { if (!S.items.some(function (x) { return x.id === String(p.id); })) S.items.push({ id: String(p.id), name: p.name, qty: Math.max(1, Number(p.qty) || 1), price: Number(p.price) || 0, image_url: p.image_url || '', cost: Number(p.net_cost) || 0 }); });
    if (!S.images.length && S.items[0] && S.items[0].image_url) S.images.push(S.items[0].image_url);
    function paint() {
      var box = $('[data-items]');
      box.innerHTML = S.items.length ? S.items.map(function (x, i) {
        return '<div class="it"><img alt="" src="' + esc(x.image_url || '') + '" onerror="this.style.visibility=\'hidden\'"><div class="nm" title="' + esc(x.name) + '">' + esc(x.name) + '<div style="font-size:11px;color:#64748b;font-weight:700">$' + r2(x.price).toFixed(2) + ' للقطعة</div></div>' +
          '<div class="st"><button type="button" data-dec="' + i + '">−</button><b>' + x.qty + '</b><button type="button" data-inc="' + i + '">+</button></div><button type="button" class="x" data-del="' + i + '" title="إزالة">✕</button></div>';
      }).join('') : '<div style="font-size:12.5px;color:#94a3b8;padding:8px 2px">لم تُضَف منتجات بعد</div>';
      [].forEach.call(w.querySelectorAll('[data-m]'), function (b) { b.classList.toggle('on', b.getAttribute('data-m') === S.mode); });
      var v = $('[data-v]'); if (doc.activeElement !== v) v.value = S.value == null ? '' : S.value;
      v.placeholder = S.mode === 'percent' ? 'نسبة الخصم %' : S.mode === 'amount' ? 'مبلغ الخصم $' : 'سعر الباقة $';
      var c = compute(S.items, S.mode, S.value);
      $('[data-s1]').textContent = '$' + c.sum.toFixed(2); $('[data-s2]').textContent = '$' + c.price.toFixed(2); $('[data-s3]').textContent = '$' + c.save.toFixed(2) + (c.pct ? ' · ' + c.pct + '%' : '');
      var cost = r2(S.items.reduce(function (s, x) { return s + (Number(x.cost) || 0) * x.qty; }, 0));
      $('[data-warn]').textContent = (cost > 0 && c.price > 0 && c.price < cost) ? '⚠️ سعر الباقة ($' + c.price.toFixed(2) + ') أقلّ من كلفة منتجاتها ($' + cost.toFixed(2) + ')' : (S.mode === 'price' && c.price > c.sum && c.sum > 0 ? '⚠️ سعر الباقة أعلى من مجموع أسعار منتجاتها' : '');
      paintImgs();
    }
    function paintImgs() {
      var n = S.images.length;
      $('[data-pimgs]').innerHTML = n ? S.images.map(function (u, i) { return '<div class="pim' + (i ? '' : ' first') + '">' + (i ? '' : '<span class="tg">الواجهة</span>') + '<img alt="" src="' + esc(u) + '" onerror="this.style.opacity=.25">' +
        '<div class="bt"><button type="button" data-imv="' + i + ':-1" title="تقديم"' + (i ? '' : ' disabled') + '>→</button><button type="button" data-imf="' + i + '" title="اجعلها الواجهة">⭐</button><button type="button" data-imv="' + i + ':1" title="تأخير"' + (i < n - 1 ? '' : ' disabled') + '>←</button><button type="button" data-imx="' + i + '" title="حذف">✕</button></div></div>'; }).join('')
        : '<div style="font-size:12.5px;color:#94a3b8;padding:6px 2px">لا صور بعد — أضف من صور المنتجات أو ارفع صورة</div>';
      var cand = []; S.items.forEach(function (x) { if (x.image_url && S.images.indexOf(x.image_url) === -1 && cand.indexOf(x.image_url) === -1) cand.push(x.image_url); });
      $('[data-imgs]').innerHTML = cand.slice(0, 16).map(function (u) { return '<img alt="" data-img="' + esc(u) + '" src="' + esc(u) + '" title="إضافة">'; }).join('') || '<span style="font-size:11.5px;color:#94a3b8">كلّ صور المنتجات مضافة</span>';
    }
    function search(q) {
      q = String(q || '').trim().toLowerCase(); var res = $('[data-res]');
      if (!q) { res.innerHTML = ''; return; }
      var hits = PR.filter(function (p) { return (p.name || '').toLowerCase().indexOf(q) !== -1 || String(p.barcode || '').toLowerCase() === q; }).slice(0, 30);
      res.innerHTML = hits.length ? hits.map(function (p) { return '<div class="ri" data-add="' + esc(p.id) + '"><img alt="" src="' + esc(p.image_url || '') + '" onerror="this.style.visibility=\'hidden\'"><span style="flex:1">' + esc(p.name) + '</span><b style="color:#D5001C">$' + r2(p.price).toFixed(2) + '</b></div>'; }).join('')
        : '<div class="ri" style="cursor:default;color:#94a3b8">لا نتائج</div>';
    }
    $('[data-q]').addEventListener('input', function (e) { search(e.target.value); });
    $('[data-v]').addEventListener('input', function (e) { S.value = e.target.value === '' ? null : Number(e.target.value); paint(); });
    /* (المالك seq B692) «الأداة فقط تعمل هيك صورة نفس هذه الترتيبة — كلّ منتج على خلفية بيضاء في مربّع — أمّا الصورة الأساسية فأنا بصمّمها وبرفعها»
       ⇒ صورة المنتجات تُرسم في المتصفّح (ترويسة + شعار + مربّعات بيضاء بالاسم والكمّية + شريط السعر) وتُرفع وتوضع بعد الواجهة */
    function loadImg(u) { return new Promise(function (res) { if (!u) return res(null); var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = u; }); }
    async function makeGrid() {
      try { if (!doc.fonts.check('900 20px GMTCairo')) { var fa = new FontFace('GMTCairo', 'url(lib/fonts/Cairo-var-arabic.woff2)', { unicodeRange: 'U+0600-06FF,U+FB50-FDFF,U+FE70-FEFF' }), fl = new FontFace('GMTCairo', 'url(lib/fonts/Cairo-var-latin.woff2)'); await Promise.all([fa.load(), fl.load()]); doc.fonts.add(fa); doc.fonts.add(fl); } } catch (_) {}
      var F = '"GMTCairo",Cairo,Tajawal,sans-serif', items = S.items, n = items.length, cols = n <= 4 ? 2 : n <= 9 ? 3 : 4, rows = Math.ceil(n / cols);
      var W = 1200, M = 60, G = 20, cw = (W - 2 * M - G * (cols - 1)) / cols, ch = cw + 76, H = 250 + rows * (ch + G) + 190;
      var cv = doc.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d');
      var bg = x.createRadialGradient(W / 2, H * 0.38, 50, W / 2, H * 0.38, H); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, '#f7f8fa'); bg.addColorStop(1, '#eceef2'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
      x.fillStyle = '#D5001C'; x.fillRect(0, 0, W, 14);
      x.direction = 'rtl'; x.textAlign = 'right'; x.textBaseline = 'alphabetic';
      x.fillStyle = '#D5001C'; x.font = '800 19px ' + F; x.fillText('GENERAL MEDIA TECH · PACKAGE', W - M, 66);
      var name = $('[data-name]').value.trim() || 'باقة'; x.fillStyle = '#0d0e11'; var fs = 56; do { x.font = '900 ' + fs + 'px ' + F; fs -= 2; } while (x.measureText(name).width > W - 2 * M - 300 && fs > 28); x.fillText(name, W - M, 138);
      var qty = items.reduce(function (t, it) { return t + it.qty; }, 0); x.fillStyle = '#4b5158'; x.font = '700 26px ' + F; x.fillText(n + ' منتجات' + (qty > n ? ' · ' + qty + ' قطعة' : '') + ' — كلّ ما تحتاجه في باقة واحدة', W - M, 186);
      var logo = await loadImg('genrallogo.png'); if (logo) { var lh = 84, lw = logo.width * lh / logo.height; x.globalCompositeOperation = 'multiply'; x.drawImage(logo, M, 50, lw, lh); x.globalCompositeOperation = 'source-over'; }
      var imgs = await Promise.all(items.map(function (it) { return loadImg(it.image_url); }));
      var rr = function (X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
      items.forEach(function (it, i) {
        var c = i % cols, r = Math.floor(i / cols), X = W - M - (c + 1) * cw - c * G, Y = 240 + r * (ch + G);   // من اليمين كالترتيب العربي
        x.save(); x.shadowColor = 'rgba(15,20,30,.08)'; x.shadowBlur = 24; x.shadowOffsetY = 8; rr(X, Y, cw, ch, 24); x.fillStyle = '#fff'; x.fill(); x.restore();
        x.strokeStyle = '#e6e8ec'; x.lineWidth = 1.5; rr(X, Y, cw, ch, 24); x.stroke();
        var im = imgs[i], pad = 16, bw = cw - 2 * pad, bh = cw - 2 * pad;
        if (im) { var k = Math.min(bw / im.width, bh / im.height), dw = im.width * k, dh = im.height * k; x.drawImage(im, X + pad + (bw - dw) / 2, Y + pad + (bh - dh) / 2, dw, dh); }
        x.fillStyle = '#0d0e11'; x.textAlign = 'center'; var t = String(it.name || ''), f2 = 23; do { x.font = '900 ' + f2 + 'px ' + F; f2--; } while (x.measureText(t).width > cw - 24 && f2 > 14);
        if (x.measureText(t).width > cw - 24) { while (t.length > 3 && x.measureText(t + '…').width > cw - 24) t = t.slice(0, -1); t += '…'; }
        x.fillText(t, X + cw / 2, Y + cw + 44);
        if (it.qty > 1) { x.font = '900 28px ' + F; var qt = '×' + it.qty, qw = x.measureText(qt).width + 26; rr(X + 12, Y + 12, qw, 42, 14); x.fillStyle = '#D5001C'; x.fill(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.direction = 'ltr'; x.fillText(qt, X + 12 + qw / 2, Y + 44); x.direction = 'rtl'; }
        x.textAlign = 'right';
      });
      var c2 = compute(S.items, S.mode, S.value), Yp = H - 180; rr(M, Yp, W - 2 * M, 140, 30); x.fillStyle = '#0d0e11'; x.fill();
      x.fillStyle = '#c9ccd2'; x.font = '800 26px ' + F; x.textAlign = 'right'; x.fillText('مجموع أسعار المنتجات', W - M - 44, Yp + 58);
      x.direction = 'ltr'; x.textAlign = 'left'; x.fillStyle = '#9aa0a8'; x.font = '800 30px ' + F; var sumT = '$' + c2.sum.toFixed(2), sx = W - M - 44 - x.measureText('مجموع أسعار المنتجات ').width - 30 - x.measureText(sumT).width; x.fillText(sumT, sx, Yp + 58); x.fillRect(sx, Yp + 47, x.measureText(sumT).width, 3);
      x.direction = 'rtl'; x.textAlign = 'right'; x.fillStyle = '#fff'; x.font = '800 26px ' + F; x.fillText('وفّر مع الباقة', W - M - 44, Yp + 102);
      x.direction = 'ltr'; x.textAlign = 'left'; x.fillStyle = '#ff5a6e'; x.font = '900 28px ' + F; x.fillText('$' + c2.save.toFixed(2), W - M - 44 - x.measureText('وفّر مع الباقة ').width - 40 - x.measureText('$' + c2.save.toFixed(2)).width, Yp + 102);
      rr(M + 28, Yp + 14, 270, 112, 24); x.fillStyle = '#D5001C'; x.fill(); x.textAlign = 'center'; x.direction = 'rtl'; x.fillStyle = '#fff'; x.font = '800 22px ' + F; x.fillText('سعر الباقة', M + 163, Yp + 46); x.direction = 'ltr'; x.font = '900 60px ' + F; x.fillText('$' + (Math.round(c2.price * 100) / 100), M + 163, Yp + 108);
      return await new Promise(function (res) { cv.toBlob(res, 'image/jpeg', 0.9); });
    }
    function addImg(u) { u = String(u || '').trim(); if (!u || S.images.indexOf(u) !== -1) return; S.images.push(u); paintImgs(); }
    $('[data-upload]').addEventListener('change', async function (e) {
      var files = [].slice.call(e.target.files || []); e.target.value = ''; if (!files.length) return;
      var M = g.GMT_DB && g.GMT_DB.MAIN, err = $('[data-err]'); if (!M || !M.url) { err.textContent = 'تعذّر الرفع: لا اتصال بالقاعدة'; return; }
      for (var k = 0; k < files.length; k++) {
        var f = files[k], ext = (/\.(\w+)$/.exec(f.name) || [, 'jpg'])[1].toLowerCase(), path = 'packages/' + Date.now() + '_' + k + '.' + ext;
        err.textContent = '⏳ رفع ' + (k + 1) + ' / ' + files.length + '…';
        try { var r = await fetch(M.url + '/storage/v1/object/products-images/' + path, { method: 'POST', headers: { apikey: M.key, Authorization: 'Bearer ' + M.key, 'Content-Type': f.type || 'image/jpeg', 'x-upsert': 'true' }, body: f });
          if (!r.ok) throw new Error('HTTP ' + r.status); addImg(M.url + '/storage/v1/object/public/products-images/' + path);
        } catch (x) { err.textContent = 'تعذّر رفع ' + f.name + ': ' + (x && x.message || x); return; }
      }
      err.textContent = '';
    });
    w.addEventListener('click', function (e) {
      var el;
      if (e.target === w || e.target.closest('[data-close]')) { w.remove(); return; }
      if ((el = e.target.closest('[data-add]'))) {
        var p = PR.find(function (y) { return String(y.id) === el.getAttribute('data-add'); }); if (!p) return;
        var ex = S.items.find(function (x) { return x.id === String(p.id); });
        if (ex) ex.qty++; else S.items.push({ id: String(p.id), name: p.name, qty: 1, price: Number(p.price) || 0, image_url: p.image_url || '', cost: Number(p.net_cost) || 0 });
        if (!S.images.length && p.image_url) S.images.push(p.image_url);
        $('[data-q]').value = ''; $('[data-res]').innerHTML = ''; paint(); return;
      }
      if ((el = e.target.closest('[data-inc]'))) { S.items[+el.getAttribute('data-inc')].qty++; paint(); return; }
      if ((el = e.target.closest('[data-dec]'))) { var it = S.items[+el.getAttribute('data-dec')]; if (it.qty > 1) it.qty--; paint(); return; }
      if ((el = e.target.closest('[data-del]'))) { S.items.splice(+el.getAttribute('data-del'), 1); paint(); return; }
      if ((el = e.target.closest('[data-m]'))) { var nm = el.getAttribute('data-m'); if (nm !== S.mode) { var cc = compute(S.items, S.mode, S.value); S.mode = nm; S.value = nm === 'price' ? cc.price : nm === 'percent' ? cc.pct : cc.save; } paint(); return; }
      if ((el = e.target.closest('[data-cat]'))) { var ck = el.getAttribute('data-cat'), ix = S.cats.indexOf(ck); if (ix === -1) S.cats.push(ck); else S.cats.splice(ix, 1); paintCats(); return; }
      if ((el = e.target.closest('[data-img]'))) { addImg(el.getAttribute('data-img')); return; }
      if (e.target.closest('[data-gengrid]')) {
        (async function () { var err = $('[data-err]'), M = g.GMT_DB && g.GMT_DB.MAIN; if (!S.items.length) { err.textContent = 'أضف منتجات الباقة أوّلاً'; return; }
          if (!M || !M.url) { err.textContent = 'تعذّر الرفع: لا اتصال بالقاعدة'; return; }
          err.textContent = '⏳ توليد صورة المنتجات…';
          try { var blob = await makeGrid(); if (!blob) throw new Error('تعذّر رسم الصورة (صورة منتج من موقعٍ يمنع النسخ؟)');
            var path = 'packages/grid_' + Date.now() + '.jpg';
            var r = await fetch(M.url + '/storage/v1/object/products-images/' + path, { method: 'POST', headers: { apikey: M.key, Authorization: 'Bearer ' + M.key, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: blob });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var u = M.url + '/storage/v1/object/public/products-images/' + path; if (S.images.indexOf(u) === -1) S.images.splice(Math.min(1, S.images.length), 0, u);   // بعد الواجهة
            err.textContent = ''; paintImgs();
          } catch (x2) { err.textContent = 'تعذّر توليد صورة المنتجات: ' + (x2 && x2.message || x2); } })();
        return;
      }
      if (e.target.closest('[data-addurl]')) { addImg($('[data-cover]').value); $('[data-cover]').value = ''; return; }
      if ((el = e.target.closest('[data-imv]'))) { var pr = el.getAttribute('data-imv').split(':'), a = +pr[0], b = a + (+pr[1]); if (b < 0 || b >= S.images.length) return; var t0 = S.images[a]; S.images[a] = S.images[b]; S.images[b] = t0; paintImgs(); return; }
      if ((el = e.target.closest('[data-imf]'))) { var fi = +el.getAttribute('data-imf'); S.images.unshift(S.images.splice(fi, 1)[0]); paintImgs(); return; }
      if ((el = e.target.closest('[data-imx]'))) { S.images.splice(+el.getAttribute('data-imx'), 1); paintImgs(); return; }
      if (e.target.closest('[data-save]')) doSave();
    });
    async function doSave() {
      var err = $('[data-err]'), btn = $('[data-save]'); err.textContent = '';
      var name = $('[data-name]').value.trim(), c = compute(S.items, S.mode, S.value);
      if (!name) { err.textContent = 'اكتب اسم الباقة'; return; }
      /* (المالك seq 565 «العرض يُعدّ كمنتج أو يُعدّ كمجموعة منتجات») عرضٌ على منتجٍ واحد مسموح — والباقة منتجان فأكثر */
      if (S.items.length < 1 || S.items.reduce(function (s, x) { return s + x.qty; }, 0) < 1) { err.textContent = 'اختر منتجاً واحداً على الأقلّ (عرض على منتج) أو أكثر (باقة)'; return; }
      if (!(c.price > 0)) { err.textContent = 'سعر الباقة يجب أن يكون أكبر من صفر'; return; }
      var pos = $('[data-pos]').checked, sto = $('[data-store]').checked;
      if (!pos && !sto) { err.textContent = 'اختر أين تظهر: نقاط البيع أو المتجر'; return; }
      if (sto && !S.cats.length) { err.textContent = 'اختر قسماً واحداً على الأقلّ في المتجر («باقات وعروض» أو غيره)'; return; }
      var endsRaw = $('[data-ends]').value, act = $('[data-active]');
      /* (seq B690) الصور كما رتّبها المدير — لا تُعاد بناؤها من صور المنتجات عند الحفظ */
      var images = S.images.filter(function (u, i, a) { return u && a.indexOf(u) === i; }).slice(0, 16);
      var rec = {
        name: name, description: $('[data-desc]').value.trim() || null, image_url: images[0] || null, images: images,
        offer_type: 'bundle', offer_price: c.price, original_price: c.sum, product_id: null,
        products: JSON.stringify(S.items.map(function (x) { return { id: x.id, name: x.name, qty: x.qty, price: r2(x.price), image_url: x.image_url || '' }; })),
        targets: { pos: pos, store: sto, mode: S.mode, value: S.value == null ? null : Number(S.value), cats: S.cats.slice(), own: false },
        ends_at: endsRaw ? new Date(endsRaw).toISOString() : null, is_active: act ? act.checked : true
      };
      btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
      try {
        var row = await save(rec, o && o.id);
        try { if (g.GMTAudit && GMTAudit.log) GMTAudit.log({ action: o ? 'package_edit' : 'package_create', entity: 'gmt_offers', entityId: String(row.id), entityName: name, reason: S.items.length + ' منتجات · $' + c.price.toFixed(2) }); } catch (_) {}
        w.remove();
        if (typeof opts.onSaved === 'function') opts.onSaved(row);
      } catch (e) { err.textContent = 'تعذّر الحفظ: ' + (e && e.message || e); btn.disabled = false; btn.textContent = '💾 حفظ الباقة'; }
    }
    paint();
    setTimeout(function () { try { $('[data-name]').focus(); } catch (_) {} }, 50);
    return w;
  }

  g.GMTPackages = { PKG_CAT: PKG_CAT, open: open, compute: compute, expand: expand, parseItems: parseItems, targetsOf: targetsOf, fetchAll: fetchAll, forStore: forStore, save: save, _resetCache: function () { _prods = null; } };
})(window);
