/* ═════════════════════════════════════════════════════════════════════
   gmt-poskit.js — «🧩 كمّل طقمك» بنقطة البيع (الخطّة 3.1 · المالك seq 982 · طابور Q4 · seq B1110)
   نفس منطق المتجر بالضبط (GMTKit.complements + دليل التوافقيات GMTCompatKB) — ما في قواعد تانية:
   منتج السلّة ⇐ نسخته بالمتجر (inv_id أو الباركود) ⇐ اقتراحات المتجر ⇐ رجوعاً لمنتجات الجرد ⇐ مخزون هالفرع.
   سجلّ المتجر (gmt_store id=1) بينحمّل بس لمّا يصير بالسلّة شي، وبينحفظ مختصَر على الجهاز ٦ ساعات.

   صافٍ:  suggest(cartProds, storeRec, mainProds, branchKey) ⇒ [{ prod, stock, other, for }]
   واجهة: ensure() · render(host, { cart, products, branchKey, onAdd(id) })
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTPosKit) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function catPathOf(cats) {
    var by = {}; (cats || []).forEach(function (c) { by[String(c.id)] = c; });
    return function (id) { var c = by[String(id)]; if (!c) return ['', '']; var t = c.parent_id ? by[String(c.parent_id)] : null; return t ? [t.name || '', c.name || ''] : [c.name || '', '']; };
  }
  /* الربط: منتج الجرد ⇔ منتج المتجر (inv_id أوّلاً ثمّ الباركود) */
  function index(rec) {
    var byInv = {}, byBc = {};
    (rec.products || []).forEach(function (p) { if (p.inv_id != null) byInv[String(p.inv_id)] = p; var b = String(p.barcode || '').trim().toLowerCase(); if (b) byBc[b] = p; });
    return { byInv: byInv, byBc: byBc };
  }
  function suggest(cartProds, rec, mainProds, branchKey, kb) {
    if (!g.GMTKit || !rec || !(rec.products || []).length) return [];
    var I = index(rec), cp = catPathOf(rec.categories), inCart = {}, mainBy = {}, mainBc = {};
    (mainProds || []).forEach(function (m) { mainBy[String(m.id)] = m; var b = String(m.barcode || '').trim().toLowerCase(); if (b) mainBc[b] = m; });
    (cartProds || []).forEach(function (m) { inCart[String(m.id)] = 1; });
    var out = [], seen = {};
    (cartProds || []).forEach(function (m) {
      var sp = I.byInv[String(m.id)] || I.byBc[String(m.barcode || '').trim().toLowerCase()]; if (!sp) return;
      var list = []; try { list = g.GMTKit.complements(sp, { products: rec.products, catPath: cp, KB: kb || g.GMTCompatKB }) || []; } catch (_) { list = []; }
      list.forEach(function (s) {
        var mm = (s.inv_id != null && mainBy[String(s.inv_id)]) || mainBc[String(s.barcode || '').trim().toLowerCase()]; if (!mm) return;
        var k = String(mm.id); if (inCart[k] || seen[k]) return; seen[k] = 1;
        out.push({ prod: mm, stock: Number(mm[branchKey]) || 0, for: m.name || '', img: (s.images || [])[0] || mm.image_url || '' });
      });
    });
    out.sort(function (a, b) { return (b.stock > 0) - (a.stock > 0); });
    return out.slice(0, 10);
  }

  /* ── سجلّ المتجر: مختصَر (الحقول اللي بيحتاجها GMTKit) + نسخة على الجهاز ── */
  var LS = 'gmt_poskit_store_v1', REC = null, LOADING = null;
  function slim(rec) {
    return { products: (rec.products || []).map(function (p) { return { id: p.id, inv_id: p.inv_id, barcode: p.barcode, name: p.name, short_name: p.short_name, price: p.price, category_id: p.category_id, category_ids: p.category_ids, compat: p.compat, specs: p.specs, alt_names: p.alt_names, images: (p.images || []).slice(0, 1) }; }),
      categories: (rec.categories || []).map(function (c) { return { id: c.id, name: c.name, parent_id: c.parent_id }; }) };
  }
  function ensure() {
    if (REC) return Promise.resolve(REC);
    try { var c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c && c.rec && Date.now() - c.at < 6 * 3600e3) { REC = c.rec; return Promise.resolve(REC); } } catch (_) {}
    if (LOADING) return LOADING;
    var S = g.GMT_DB && g.GMT_DB.STORE; if (!S || !S.url) return Promise.resolve(null);
    LOADING = fetch(S.url + '/rest/v1/gmt_store?id=eq.1&select=products,categories', { headers: { apikey: S.key, Authorization: 'Bearer ' + S.key } })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (rows) {
        if (!rows || !rows[0]) return null; REC = slim(rows[0]);
        try { localStorage.setItem(LS, JSON.stringify({ at: Date.now(), rec: REC })); } catch (_) {}
        return REC;
      }).catch(function () { return null; }).then(function (x) { LOADING = null; return x; });
    return LOADING;
  }
  function render(host, o) {
    if (!host) return;
    var cartProds = (o.cart || []).filter(function (x) { return x && x.id != null && !String(x.id).startsWith('OFFER_'); });
    if (!cartProds.length) { host.innerHTML = ''; return; }
    if (!REC) { host.innerHTML = ''; ensure().then(function (r) { if (r) render(host, o); }); return; }
    var L = suggest(cartProds, REC, o.products, o.branchKey);
    if (!L.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<div data-poskit style="margin-top:10px;border:1.5px solid #c7d2fe;background:#eef2ff;border-radius:14px;padding:8px 10px">' +
      '<div style="font-weight:900;font-size:13px;margin-bottom:6px">🧩 كمّل طقمك <span style="font-weight:700;color:#64748b;font-size:11px">— بيمشي مع اللي بالسلّة (نفس اقتراحات المتجر)</span></div>' +
      '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px">' + L.map(function (s) {
        var p = s.prod, st = s.stock > 0 ? '<span style="color:#15803d">✅ عندك ' + s.stock + '</span>' : '<span style="color:#b45309">بفرع تاني/الشركة</span>';
        return '<div data-poskit-item="' + esc(p.id) + '" style="flex:none;width:132px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:6px;font-size:11px">' +
          (s.img ? '<img src="' + esc(s.img) + '" loading="lazy" alt="" style="width:100%;height:60px;object-fit:contain;border-radius:8px;background:#f8fafc" onerror="this.style.display=\'none\'">' : '') +
          '<div style="font-weight:900;line-height:1.3;max-height:2.6em;overflow:hidden" title="' + esc(p.name) + '">' + esc(p.name) + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px"><b>' + (Number(p.price) || 0) + '$</b>' + st + '</div>' +
          '<div style="color:#94a3b8;font-size:10px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">مع: ' + esc(s.for) + '</div>' +
          (s.stock > 0 ? '<button type="button" data-poskit-add="' + esc(p.id) + '" style="margin-top:4px;width:100%;border:0;background:#0f1219;color:#fff;border-radius:8px;padding:4px;font:inherit;font-size:11px;font-weight:900;cursor:pointer">＋ أضف</button>' : '') + '</div>';
      }).join('') + '</div></div>';
    host.onclick = function (e) { var b = e.target.closest('[data-poskit-add]'); if (b && o.onAdd) o.onAdd(b.getAttribute('data-poskit-add')); };
  }
  g.GMTPosKit = { suggest: suggest, ensure: ensure, render: render, _set: function (r) { REC = r; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTPosKit;
})(typeof window !== 'undefined' ? window : globalThis);
