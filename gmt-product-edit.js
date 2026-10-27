/* ═══════════════════════════════════════════════════════════════════════════
   gmt-product-edit.js — صفحة تعديل كلّ بيانات المنتج: الجرد · الأسعار · جدول المواصفات · المتجر
   أُنشئ: 2026-10-27 · TASK-0201 (المالك seq 133) — للأدمن فقط

   طلبُك: «صفحه تعديل بيانات المنتج … بعدل فيه كل شيء سواء في المتجر او في الجرد او في الجدول او في الفئه او في فئته في المتجر
   او في الاسامي الاخرى او في تصنيف او كل شيء كل شيء كل شيء عنه حتى الاسعار».
   صفحةٌ واحدة (ملء الشاشة) بأقسام:
     ① الجرد: الاسم · المختصر · الباركود · المجموعة · التصنيف · الماركة · الأسماء الأخرى (تُضاف لكلمات البحث)
     ② الأسعار: البيع · الجملة · الحدّ الأدنى (والتكلفة للقراءة — تكتبها فواتير الشراء) · وسعر المتجر (أو «مثل سعر البيع»)
     ③ جدول المواصفات: صفوفٌ تُعدَّل وتُضاف وتُحذف · الوصف · الموديل · التوافق
     ④ المتجر (إن كان مربوطاً): الاسم فيه · أقسامه · وصفه · صوره (ترتيب · حذف · إضافة · «صورة الجرد»)
   «💾 احفظ» يكتب ما تغيّر فقط: الجرد عبر دالّة الصفحة (saveInv) ثمّ منتج المتجر المربوط بكتابةٍ مشروطة واحدة (GMTSpecs.pushToStore).
   الكميات لا تُعدَّل من هنا (لها النقل والجرد وإعادة الإنشاء).

   GMTProductEdit.open(p, { saveInv(patch) ⇒ Promise<{error}>, groups, categories, onSaved(p2) })
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTProductEdit) return;
  var doc = global.document;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function asObj(sp) { if (!sp) return {}; if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch (_) { return {}; } } return (sp && typeof sp === 'object' && !Array.isArray(sp)) ? sp : {}; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  function storeDb() { return global.GMT_DB && GMT_DB.STORE && GMT_DB.STORE.url ? GMT_DB.STORE : null; }
  async function storeRec() {
    var D = storeDb(); if (!D) return null;
    var r = await fetch(D.url + '/rest/v1/gmt_store?id=eq.1&select=categories,products', { headers: { apikey: D.key, Authorization: 'Bearer ' + D.key } });
    if (!r.ok) throw new Error('المتجر HTTP ' + r.status);
    return (await r.json())[0] || null;
  }
  function css() {
    if (doc.getElementById('gmt-pe-css')) return;
    var s = doc.createElement('style'); s.id = 'gmt-pe-css';
    s.textContent =
      '#gmt-pe{position:fixed;inset:0;z-index:2147483100;background:#f3f4f6;display:flex;flex-direction:column;direction:rtl;font-family:Cairo,Tajawal,system-ui,sans-serif;color:#0f1219}' +
      '#gmt-pe .pe-top{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #e5e7eb}' +
      '#gmt-pe .pe-top b{flex:1;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#gmt-pe button{font:inherit;font-weight:800;cursor:pointer;border-radius:10px;border:1px solid #e5e7eb;background:#fff;padding:8px 12px;font-size:13px}' +
      '#gmt-pe button.p{background:#D5001C;border-color:#D5001C;color:#fff}#gmt-pe button:disabled{opacity:.5}' +
      '#gmt-pe .pe-body{flex:1;overflow:auto;padding:12px;display:grid;gap:12px;align-content:start;max-width:980px;width:100%;margin:0 auto;box-sizing:border-box}' +
      '@media(min-width:900px){#gmt-pe .pe-body{grid-template-columns:1fr 1fr}#gmt-pe .pe-wide{grid-column:1/-1}}' +
      '#gmt-pe section{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:12px}' +
      '#gmt-pe h3{margin:0 0 10px;font-size:14px;font-weight:900}' +
      '#gmt-pe label{display:block;font-size:12px;font-weight:800;color:#374151;margin-bottom:8px}' +
      '#gmt-pe input,#gmt-pe textarea,#gmt-pe select{display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #d1d5db;border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;background:#fff;color:inherit}' +
      '#gmt-pe input[type=checkbox]{display:inline-block;width:auto;margin:0 0 0 6px}' +
      '#gmt-pe .pe-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '#gmt-pe .pe-row{display:grid;grid-template-columns:1fr 1.4fr auto;gap:6px;margin-bottom:6px;align-items:center}#gmt-pe .pe-row input{margin:0}' +
      '#gmt-pe .pe-imgs{display:flex;flex-wrap:wrap;gap:8px}#gmt-pe .pe-img{width:92px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#f9fafb}' +
      '#gmt-pe .pe-img img{width:92px;height:92px;object-fit:cover;display:block}#gmt-pe .pe-img div{display:flex;justify-content:space-between}#gmt-pe .pe-img button{border:0;border-radius:0;padding:4px 8px;background:transparent}' +
      '#gmt-pe .pe-cats{display:flex;flex-wrap:wrap;gap:6px}#gmt-pe .pe-cats label{display:inline-flex;align-items:center;border:1px solid #e5e7eb;border-radius:999px;padding:5px 10px;margin:0;font-weight:700}' +
      '#gmt-pe .pe-note{font-size:12px;color:#6b7280;line-height:1.7;margin:4px 0 0}#gmt-pe .pe-msg{font-size:12.5px;font-weight:800;padding:0 12px 8px;min-height:18px}';
    (doc.head || doc.documentElement).appendChild(s);
  }

  function open(p, ctx) {
    ctx = ctx || {};
    if (!p) return null;
    css(); var old = doc.getElementById('gmt-pe'); if (old) old.remove();
    var sp0 = asObj(p.specs), rows0 = Object.keys(sp0).filter(function (k) { return k.indexOf('__') !== 0; }).map(function (k) { return { k: k, v: typeof sp0[k] === 'string' ? sp0[k] : (global.GMTSpecs ? (GMTSpecs.rows({ x: sp0[k] })[0] || {}).value || '' : String(sp0[k])) }; });
    var root = doc.createElement('div'); root.id = 'gmt-pe'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('data-keep-fab', '1');
    var dl = function (id, list) { return '<datalist id="' + id + '">' + (list || []).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>'; };
    root.innerHTML =
      '<div class="pe-top"><button type="button" data-pe-x aria-label="إغلاق">✕</button><b>✏️ تعديل كلّ بيانات المنتج — ' + esc(p.name) + '</b><button type="button" class="p" data-pe-save>💾 احفظ</button></div>' +
      '<div class="pe-msg" role="status" data-pe-msg></div>' +
      '<div class="pe-body">' +
        '<section><h3>📦 الجرد</h3>' +
          '<label>الاسم<input data-f="name" value="' + esc(p.name) + '"></label>' +
          '<div class="pe-2"><label>الاسم المختصر<input data-f="short" value="' + esc(p.short) + '"></label><label>الباركود<input data-f="barcode" dir="ltr" value="' + esc(p.barcode) + '"></label></div>' +
          '<div class="pe-2"><label>المجموعة<input data-f="group_name" list="pe-groups" value="' + esc(p.group_name) + '"></label><label>التصنيف<input data-f="category" list="pe-cats" value="' + esc(p.category) + '"></label></div>' +
          dl('pe-groups', ctx.groups) + dl('pe-cats', ctx.categories) +
          '<label>الماركة<input data-f="brand" value="' + esc(p.brand || sp0.__brand) + '"></label>' +
          '<label>الأسماء الأخرى (عربي وإنجليزي — بينها فاصلة)<textarea data-f="alt_names" rows="2">' + esc(p.alt_names) + '</textarea></label>' +
          '<p class="pe-note">الأسماء الأخرى تُضاف لكلمات البحث: الجرد ونقطة البيع والأوردرات يجدون المنتج بها.</p>' +
        '</section>' +
        '<section><h3>💲 الأسعار</h3>' +
          '<div class="pe-2"><label>سعر البيع $<input data-f="price" type="number" step="0.01" min="0" inputmode="decimal" value="' + esc(p.price) + '"></label><label>سعر الجملة $<input data-f="wholesale_price" type="number" step="0.01" min="0" inputmode="decimal" value="' + esc(p.wholesale_price) + '"></label></div>' +
          '<div class="pe-2"><label>الحدّ الأدنى للمخزون<input data-f="min_stock" type="number" step="1" min="0" value="' + esc(p.min_stock) + '"></label><label>التكلفة $ (للقراءة)<input value="' + esc(p.cost_price) + '" disabled></label></div>' +
          '<div data-pe-sprice></div>' +
        '</section>' +
        '<section class="pe-wide"><h3>📋 جدول المواصفات</h3><div data-pe-rows></div>' +
          '<button type="button" data-pe-addrow>+ بند</button>' +
          '<div class="pe-2" style="margin-top:10px"><label>الموديل<input data-f="__model" value="' + esc(sp0.__model) + '"></label><label>التوافق (متوافق مع)<input data-f="compat" value="' + esc(p.compat) + '"></label></div>' +
          '<label>الوصف<textarea data-f="__desc" rows="3">' + esc(sp0.__desc) + '</textarea></label>' +
          '<p class="pe-note">الجدول والموديل والتوافق والوصف تنتقل لمنتج المتجر المربوط عند الحفظ.</p>' +
        '</section>' +
        '<section class="pe-wide" data-pe-store><h3>🛒 المتجر</h3><p class="pe-note">⏳ جارٍ قراءة منتج المتجر…</p></section>' +
      '</div>';
    doc.body.appendChild(root);
    var $ = function (q) { return root.querySelector(q); }, msg = $('[data-pe-msg]');
    function say(t, bad) { msg.textContent = t || ''; msg.style.color = bad ? '#b91c1c' : '#047857'; }
    /* صفوف الجدول */
    var rowsEl = $('[data-pe-rows]');
    function addRow(k, v) {
      var d = doc.createElement('div'); d.className = 'pe-row';
      d.innerHTML = '<input data-rk placeholder="البند (مثل: الوزن)" value="' + esc(k) + '"><input data-rv placeholder="القيمة" value="' + esc(v) + '"><button type="button" aria-label="احذف البند">✕</button>';
      d.querySelector('button').onclick = function () { d.remove(); };
      rowsEl.appendChild(d); return d;
    }
    rows0.forEach(function (r) { addRow(r.k, r.v); });
    if (!rows0.length) addRow('', '');
    $('[data-pe-addrow]').onclick = function () { addRow('', '').querySelector('input').focus(); };
    /* المتجر */
    var S = { rec: null, sp: null, imgs: [], cats: [] };
    function paintImgs() {
      var box = $('[data-pe-imgs]'); if (!box) return; box.innerHTML = '';
      S.imgs.forEach(function (u, i) {
        var d = doc.createElement('div'); d.className = 'pe-img';
        d.innerHTML = '<img alt="" src="' + esc(u) + '"><div><button type="button" data-a="r" aria-label="قدّم">›</button><button type="button" data-a="x" aria-label="احذف">✕</button><button type="button" data-a="l" aria-label="أخّر">‹</button></div>';
        d.querySelector('[data-a=x]').onclick = function () { S.imgs.splice(i, 1); paintImgs(); };
        d.querySelector('[data-a=r]').onclick = function () { if (i > 0) { var t = S.imgs[i - 1]; S.imgs[i - 1] = S.imgs[i]; S.imgs[i] = t; paintImgs(); } };
        d.querySelector('[data-a=l]').onclick = function () { if (i < S.imgs.length - 1) { var t = S.imgs[i + 1]; S.imgs[i + 1] = S.imgs[i]; S.imgs[i] = t; paintImgs(); } };
        box.appendChild(d);
      });
      var inv = $('[data-pe-invimg]'); if (inv) inv.style.display = p.image_url && S.imgs.indexOf(p.image_url) === -1 ? '' : 'none';
    }
    storeRec().then(function (rec) {
      var sec = $('[data-pe-store]'); S.rec = rec;
      var prods = rec && Array.isArray(rec.products) ? rec.products : [], sp = prods.length && global.GMTSpecs && GMTSpecs._findStore ? GMTSpecs._findStore(prods, p) : null;
      S.sp = sp;
      if (!sp) { sec.innerHTML = '<h3>🛒 المتجر</h3><p class="pe-note">هذا المنتج غير مربوط بمنتجٍ في المتجر. اربطه من «🌉 الجسر» ثمّ عُد هنا لتعديل اسمه وأقسامه وصوره في المتجر.</p>'; return; }
      S.imgs = (Array.isArray(sp.images) ? sp.images : []).slice(); S.cats = (Array.isArray(sp.category_ids) && sp.category_ids.length ? sp.category_ids : (sp.category_id ? [sp.category_id] : [])).map(String);
      var cats = (rec.categories || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      sec.innerHTML = '<h3>🛒 المتجر</h3>' +
        '<div class="pe-2"><label>الاسم في المتجر<input data-s="name" value="' + esc(sp.name) + '"></label><label>السعر في المتجر $<input data-s="price" type="number" step="0.01" min="0" inputmode="decimal" value="' + esc(sp.price) + '"></label></div>' +
        '<label style="display:flex;align-items:center;font-weight:700"><input type="checkbox" data-s-same> السعر في المتجر = سعر البيع في الجرد</label>' +
        '<div style="font-size:12px;font-weight:800;color:#374151;margin:8px 0 6px">أقسامه في المتجر</div><div class="pe-cats">' +
          cats.map(function (c) { return '<label><input type="checkbox" data-scat="' + esc(c.id) + '"' + (S.cats.indexOf(String(c.id)) !== -1 ? ' checked' : '') + '>' + esc(c.name) + '</label>'; }).join('') + '</div>' +
        '<label style="margin-top:10px">الوصف في المتجر<textarea data-s="description" rows="3">' + esc(sp.description) + '</textarea></label>' +
        '<div style="font-size:12px;font-weight:800;color:#374151;margin:8px 0 6px">صوره في المتجر (الأولى هي الرئيسية)</div><div class="pe-imgs" data-pe-imgs></div>' +
        '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><input data-pe-newimg dir="ltr" placeholder="https://… رابط صورة" style="flex:1;min-width:180px;margin:0"><button type="button" data-pe-addimg>+ أضف</button><button type="button" data-pe-invimg>+ صورة الجرد</button></div>';
      paintImgs();
      $('[data-pe-addimg]').onclick = function () { var i = $('[data-pe-newimg]'), u = i.value.trim(); if (/^https?:\/\//.test(u) && S.imgs.indexOf(u) === -1) { S.imgs.push(u); i.value = ''; paintImgs(); } };
      $('[data-pe-invimg]').onclick = function () { if (p.image_url && S.imgs.indexOf(p.image_url) === -1) { S.imgs.push(p.image_url); paintImgs(); } };
      var same = $('[data-s-same]'), spr = $('[data-s="price"]');
      same.checked = num(sp.price) === num(p.price);
      var sync = function () { if (same.checked) { spr.value = $('[data-f="price"]').value; spr.disabled = true; } else spr.disabled = false; };
      same.onchange = sync; $('[data-f="price"]').addEventListener('input', sync); sync();
    }, function (e) { $('[data-pe-store]').innerHTML = '<h3>🛒 المتجر</h3><p class="pe-note" style="color:#b91c1c">تعذّرت قراءة المتجر: ' + esc(e && e.message || e) + '</p>'; });

    function close() { root.remove(); doc.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape' && !root.querySelector(':focus-within textarea:focus')) { e.preventDefault(); close(); } }
    doc.addEventListener('keydown', onKey, true);
    $('[data-pe-x]').onclick = close;

    function collect() {
      var f = function (k) { var e = $('[data-f="' + k + '"]'); return e ? e.value.trim() : ''; };
      var specs = {};
      rowsEl.querySelectorAll('.pe-row').forEach(function (r) { var k = r.querySelector('[data-rk]').value.trim().slice(0, 60), v = r.querySelector('[data-rv]').value.trim().slice(0, 300); if (k && v) specs[k] = v; });
      if (f('__desc')) specs.__desc = f('__desc').slice(0, 2000);
      if (f('brand')) specs.__brand = f('brand');
      if (f('__model')) specs.__model = f('__model');
      var inv = { name: f('name'), short: f('short'), barcode: f('barcode'), group_name: f('group_name'), category: f('category') || null, brand: f('brand') || null,
        alt_names: f('alt_names') || null, price: num(f('price')), wholesale_price: num(f('wholesale_price')), min_stock: parseInt(f('min_stock'), 10) || 0, specs: specs, compat: f('compat') || null };
      return inv;
    }
    function changed(inv) {
      var patch = {};
      Object.keys(inv).forEach(function (k) {
        var a = inv[k], b = p[k];
        if (k === 'specs') { if (JSON.stringify(a) !== JSON.stringify(asObj(b))) patch.specs = a; return; }
        if (typeof a === 'number') { if (num(b) !== a) patch[k] = a; return; }
        if (String(a == null ? '' : a) !== String(b == null ? '' : b)) patch[k] = a;
      });
      /* الأسماء الأخرى ⇒ كلمات البحث (كما في نافذة المنتج) */
      if ('alt_names' in patch) {
        var cur = String(p.search_terms || '').split(/\s*[,،·]\s*/).filter(Boolean);
        String(patch.alt_names || '').split(/\s*[,،·]\s*/).filter(Boolean).forEach(function (a) { if (cur.indexOf(a) === -1) cur.push(a); });
        if (cur.length) patch.search_terms = cur.join(' · ');
      }
      return patch;
    }
    $('[data-pe-save]').onclick = async function () {
      var b = this, inv = collect();
      if (!inv.name) { say('❌ الاسم مطلوب', true); return; }
      if (!(inv.price >= 0)) { say('❌ السعر غير صحيح', true); return; }
      var patch = changed(inv), sp = S.sp, sUpd = null;
      if (sp) {
        var g = function (k) { var e = $('[data-s="' + k + '"]'); return e ? e.value.trim() : ''; };
        var cats = [].map.call(root.querySelectorAll('[data-scat]:checked'), function (x) { return x.getAttribute('data-scat'); });
        var sPrice = $('[data-s-same]') && $('[data-s-same]').checked ? inv.price : num(g('price'));
        var want = { name: g('name') || sp.name, price: sPrice, description: g('description'), images: S.imgs.slice() };
        if (cats.length) { want.category_ids = cats; want.category_id = cats[0]; }
        sUpd = {};
        Object.keys(want).forEach(function (k) { if (JSON.stringify(want[k]) !== JSON.stringify(k === 'price' ? num(sp[k]) : (sp[k] == null ? (k === 'description' ? '' : sp[k]) : sp[k]))) sUpd[k] = want[k]; });
        if (patch.specs || 'compat' in patch) { var fs = global.GMTSpecs ? GMTSpecs.forStore(inv.specs) : []; sUpd.specs = fs; sUpd.compat = inv.compat || ''; }
        if (!Object.keys(sUpd).length) sUpd = null;
      }
      if (!Object.keys(patch).length && !sUpd) { say('لا تغيير لحفظه'); return; }
      b.disabled = true; b.textContent = '⏳ …'; say('');
      try {
        if (Object.keys(patch).length) {
          var r = await ctx.saveInv(patch);
          if (r && r.error) throw new Error('الجرد: ' + r.error);
          Object.assign(p, patch);
        }
        var st = null;
        if (sUpd) {
          st = await GMTSpecs.pushToStore(p, { only: function (cur) { var o = {}; for (var k in sUpd) o[k] = sUpd[k]; if (!('description' in o) && sUpd.specs && inv.specs.__desc) { var d = String(cur.description || ''); if (d.indexOf(inv.specs.__desc) === -1) o.description = inv.specs.__desc + (d ? '\n' + d : ''); } return o; } });
          if (!st) throw new Error('لم يُعثر على منتج المتجر المربوط');
        }
        say('✅ حُفظ' + (Object.keys(patch).length ? ' في الجرد' : '') + (st ? (Object.keys(patch).length ? ' والمتجر' : ' في المتجر') : ''));
        if (ctx.onSaved) try { ctx.onSaved(p, { inv: patch, store: sUpd }); } catch (_) {}
        if (sp && sUpd) Object.assign(sp, sUpd);
      } catch (e) { say('❌ ' + (e && e.message || e), true); }
      b.disabled = false; b.textContent = '💾 احفظ';
    };
    return root;
  }
  global.GMTProductEdit = { open: open };
})(typeof window !== 'undefined' ? window : this);
