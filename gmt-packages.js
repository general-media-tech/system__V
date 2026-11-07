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
        return { id: String(o.id), name: o.name, description: o.description || '', images: imgs.slice(0, 8), items: items,
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
    '#gmt-pkg .cats{display:flex;gap:6px;flex-wrap:wrap}#gmt-pkg .cats button{border:1.5px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 11px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}#gmt-pkg .cats button.on{border-color:#D5001C;background:#fef2f2;color:#D5001C}' +
    '#gmt-pkg .chk{display:flex;gap:14px;flex-wrap:wrap;font-size:13.5px;font-weight:800}#gmt-pkg .err{min-height:1.2em;color:#b91c1c;font-size:13px;font-weight:800;margin-top:8px}' +
    '#gmt-pkg .go{width:100%;margin-top:6px;background:#D5001C;color:#fff;border:0;border-radius:14px;padding:13px;font:inherit;font-size:15px;font-weight:900;cursor:pointer}#gmt-pkg .go:disabled{opacity:.6}';

  function open(opts) {
    opts = opts || {};
    var o = opts.offer || null, t = targetsOf(o || { targets: { pos: true, store: true } });
    var S = { items: o ? parseItems(o) : [], mode: o ? (t.mode || 'price') : 'percent', value: o ? (t.value != null ? t.value : o.offer_price) : 10,
      cover: (o && o.image_url) || '', pos: o ? t.pos : true, store: o ? t.store : true, cats: t.cats.slice(), own: o ? t.own : true, CATS: null };
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
      '<label class="l">صورة الباقة <small style="color:#64748b">(اختر من صور منتجاتها أو ضع رابطاً)</small></label><div class="imgs" data-imgs></div><input type="url" data-cover placeholder="https://… (اختياري)" style="margin-top:6px">' +
      '<label class="l">الوصف (اختياري)</label><textarea data-desc rows="2">' + esc(o ? (o.description || '') : '') + '</textarea>' +
      '<label class="l">تنتهي في (اختياري)</label><input type="datetime-local" data-ends value="' + endsVal + '">' +
      (o ? '<label class="l"><input type="checkbox" data-active ' + (o.is_active !== false ? 'checked' : '') + '> فعّالة</label>' : '') +
      '<div class="err" data-err></div><button type="button" class="go" data-save>💾 حفظ الباقة</button></div>';
    doc.body.appendChild(w);
    var $ = function (s) { return w.querySelector(s); };
    $('[data-pos]').checked = !!S.pos; $('[data-store]').checked = !!S.store; $('[data-cover]').value = S.cover;
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
    if (!S.cover && S.items[0]) S.cover = S.items[0].image_url || '';
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
      var imgs = []; if (S.cover) imgs.push(S.cover); S.items.forEach(function (x) { if (x.image_url && imgs.indexOf(x.image_url) === -1) imgs.push(x.image_url); });
      $('[data-imgs]').innerHTML = imgs.slice(0, 12).map(function (u) { return '<img alt="" data-img="' + esc(u) + '" class="' + (u === S.cover ? 'on' : '') + '" src="' + esc(u) + '">'; }).join('');
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
    $('[data-cover]').addEventListener('change', function (e) { S.cover = e.target.value.trim(); paint(); });
    w.addEventListener('click', function (e) {
      var el;
      if (e.target === w || e.target.closest('[data-close]')) { w.remove(); return; }
      if ((el = e.target.closest('[data-add]'))) {
        var p = PR.find(function (y) { return String(y.id) === el.getAttribute('data-add'); }); if (!p) return;
        var ex = S.items.find(function (x) { return x.id === String(p.id); });
        if (ex) ex.qty++; else S.items.push({ id: String(p.id), name: p.name, qty: 1, price: Number(p.price) || 0, image_url: p.image_url || '', cost: Number(p.net_cost) || 0 });
        if (!S.cover) S.cover = p.image_url || '';
        $('[data-q]').value = ''; $('[data-res]').innerHTML = ''; paint(); return;
      }
      if ((el = e.target.closest('[data-inc]'))) { S.items[+el.getAttribute('data-inc')].qty++; paint(); return; }
      if ((el = e.target.closest('[data-dec]'))) { var it = S.items[+el.getAttribute('data-dec')]; if (it.qty > 1) it.qty--; paint(); return; }
      if ((el = e.target.closest('[data-del]'))) { S.items.splice(+el.getAttribute('data-del'), 1); paint(); return; }
      if ((el = e.target.closest('[data-m]'))) { var nm = el.getAttribute('data-m'); if (nm !== S.mode) { var cc = compute(S.items, S.mode, S.value); S.mode = nm; S.value = nm === 'price' ? cc.price : nm === 'percent' ? cc.pct : cc.save; } paint(); return; }
      if ((el = e.target.closest('[data-cat]'))) { var ck = el.getAttribute('data-cat'), ix = S.cats.indexOf(ck); if (ix === -1) S.cats.push(ck); else S.cats.splice(ix, 1); paintCats(); return; }
      if ((el = e.target.closest('[data-img]'))) { S.cover = el.getAttribute('data-img'); $('[data-cover]').value = S.cover; paint(); return; }
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
      var images = []; if (S.cover) images.push(S.cover); S.items.forEach(function (x) { if (x.image_url && images.indexOf(x.image_url) === -1) images.push(x.image_url); });
      var rec = {
        name: name, description: $('[data-desc]').value.trim() || null, image_url: S.cover || null, images: images.slice(0, 8),
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
