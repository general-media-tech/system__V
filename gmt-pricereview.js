/* ═════════════════════════════════════════════════════════════════════
   gmt-pricereview.js — مراجعة الأسعار + «وين راح المشترى» (حساب صافٍ · يُختبر بلا متصفّح)
   TASK-B0536 · المالك seq B1040: «راجع كل شيء مسعر · في اشياء سعرها في المتجر غير الجرد وما هي موجوده في
   الفواتير الشراء يعني ما في سعر مبيع … ايضا في اشياء مشتريه ومثلا معاد موجود منها فلازم نحن نعرف وين راح …
   الهدف انه بواحد واحد 2027 نسيطر على المخزون».

   القواعد:
     • الجرد هو المرجع الوحيد لسعر المنتج (seq 579) ⇒ سعر المتجر المختلف يُوحَّد على الجرد.
     • `net_cost` في هذا النظام = **الحدّ الأدنى** للبيع لا الكلفة ⇒ «بيعٌ بخسارة» يُقاس على `cost_price` وحده،
       و«مبيعٌ تحت الحدّ الأدنى» فحصٌ مستقلّ.
     • «وين راح»: المُشترى (فواتير شراء واصلة + فواتير تسوية مستلَمة) − المبيع (بنود فواتير البيع − المرتجعات)
       − الموجود (كلّ الفروع + بالطريق) = الفجوة. المبيعات تُسجَّل منذ salesStart فقط ⇒ ما اشتُري قبله
       يُصنَّف «قبل تسجيل المبيعات» (لا يُحكم عليه فاقداً) · ما ذُكر اسمه بأوردرات نصّية يُصنَّف «ربما بأوردر».
   ═════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var LOCAL = ['homs', 'daraa', 'haleb', 'kurani', 'fakhouri', 'sarmada', 'hny_sbyl'], TRANSIT = ['germany', 'china'];
  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function arr(v) { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return []; } } return Array.isArray(v) ? v : []; }
  function low(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  /* ── ① الأسعار ── */
  function pricing(products, store, changes, opt) {
    opt = opt || {};
    var cols = opt.local || LOCAL;
    var byId = {}; (products || []).forEach(function (p) { byId[String(p.id)] = p; });
    var stockOf = function (p) { return cols.reduce(function (s, k) { return s + n(p[k]); }, 0); };
    var out = { storeDiff: [], optDiff: [], storeOrphan: [], noSale: [], noCost: [], loss: [], belowMin: [], strike: [] };
    (store || []).forEach(function (s) {
      var iv = byId[String(s.inv_id || '')];
      if (!iv) { out.storeOrphan.push({ name: s.name, store_id: s.id }); return; }
      if (Math.abs(n(s.price) - n(iv.price)) > 0.009) out.storeDiff.push({ name: s.name, store_id: s.id, inv_id: iv.id, store: n(s.price), inv: n(iv.price) });
      arr(s.options).forEach(function (g) { (g && g.values || []).forEach(function (v) {
        var vi = byId[String(v.inv_id || '')];
        if (vi && v.price !== '' && v.price != null && Math.abs(n(v.price) - n(vi.price)) > 0.009) out.optDiff.push({ name: s.name + ' / ' + (v.name || ''), store_id: s.id, inv_id: vi.id, store: n(v.price), inv: n(vi.price) });
      }); });
    });
    (products || []).forEach(function (p) {
      var st = stockOf(p), sale = n(p.price), cost = n(p.cost_price), min = n(p.net_cost);
      if (sale <= 0) out.noSale.push({ id: p.id, name: p.name, stock: st });
      if (cost <= 0 && st > 0) out.noCost.push({ id: p.id, name: p.name, stock: st, sale: sale });
      if (sale > 0 && cost > 0 && cost >= sale) out.loss.push({ id: p.id, name: p.name, sale: sale, cost: cost });
      if (sale > 0 && min > 0 && min > sale) out.belowMin.push({ id: p.id, name: p.name, sale: sale, min: min });
    });
    var now = opt.now || Date.now();
    (changes || []).filter(function (c) { return !c.reverted_at; }).forEach(function (c) {
      var p = byId[String(c.product_id || '')], expired = c.ends_at && new Date(c.ends_at).getTime() < now;
      if (expired || (p && Math.abs(n(p.price) - n(c.new_price)) > 0.009)) out.strike.push({ name: c.product_name || (p && p.name) || '', old: n(c.old_price), now: n(c.new_price), inv: p ? n(p.price) : null, expired: !!expired });
    });
    out.noSale.sort(function (a, b) { return b.stock - a.stock; }); out.noCost.sort(function (a, b) { return b.stock - a.stock; });
    return out;
  }

  /* ── ② وين راح المشترى ── */
  function trace(d, opt) {
    opt = opt || {};
    var cols = opt.local || LOCAL, tcols = opt.transit || TRANSIT, start = d.salesStart ? new Date(d.salesStart).getTime() : 0;
    var P = {}; (d.products || []).forEach(function (p) { P[String(p.id)] = { p: p, bought: 0, boughtAfter: 0, firstBuy: null, invs: [], rb: 0, sold: 0, inOrders: 0 }; });
    var at = function (x) { return new Date(x || 0).getTime(); };
    (d.purchases || []).forEach(function (inv) {
      if (inv.status !== 'arrived') return;
      var t = at(inv.arrived_at || inv.created_at);
      arr(inv.items_snapshot).forEach(function (it) {
        var r = P[String(it.id || '')]; if (!r) return; var q = n(it.qty); if (!(q > 0)) return;
        r.bought += q; if (t >= start) r.boughtAfter += q; if (r.firstBuy == null || t < r.firstBuy) r.firstBuy = t;
        r.invs.push({ n: inv.inv_number, q: q, at: inv.arrived_at || inv.created_at });
      });
    });
    (d.rebuilds || []).forEach(function (x) { var r = P[String(x.product_id || '')]; if (r) { r.rb += n(x.qty); r.invs.push({ n: x.transfer_number || 'تسوية', q: n(x.qty), at: x.at, rb: 1 }); } });
    (d.sales || []).forEach(function (x) { var r = P[String(x.product_id || '')]; if (r) r.sold += x.is_refund ? -Math.abs(n(x.qty)) : n(x.qty); });
    var ordTxt = (d.orderTexts || []).map(low);
    var rows = [];
    Object.keys(P).forEach(function (k) {
      var r = P[k], p = r.p; if (!(r.bought + r.rb > 0)) return;
      var loc = cols.reduce(function (s, c) { return s + n(p[c]); }, 0), tr = tcols.reduce(function (s, c) { return s + n(p[c]); }, 0);
      var gap = r.bought + r.rb - r.sold - loc - tr;
      var nm = low(p.name); r.inOrders = nm.length >= 4 ? ordTxt.filter(function (t) { return t.indexOf(nm) >= 0; }).length : 0;
      var kind = gap <= 0 ? (gap < 0 ? 'surplus' : 'ok') : (r.boughtAfter + r.rb - r.sold - loc - tr > 0 ? 'lost' : 'before');
      if (kind === 'lost' && r.inOrders > 0) kind = 'orders';
      var by = {}; cols.concat(tcols).forEach(function (c) { if (n(p[c])) by[c] = n(p[c]); });
      rows.push({ id: p.id, name: p.name, bought: r.bought + r.rb, sold: r.sold, loc: loc, tr: tr, gap: gap, kind: kind, by: by, invs: r.invs, inOrders: r.inOrders, cost: n(p.cost_price),
        value: gap > 0 ? Math.round(gap * n(p.cost_price) * 100) / 100 : 0 });
    });
    rows.sort(function (a, b) { return (b.value - a.value) || (b.gap - a.gap); });
    var sum = function (k) { return rows.filter(function (r) { return r.kind === k; }).reduce(function (s, r) { return { n: s.n + 1, u: s.u + Math.max(0, k === 'surplus' ? -r.gap : r.gap), v: Math.round((s.v + r.value) * 100) / 100 }; }, { n: 0, u: 0, v: 0 }); };
    return { rows: rows, lost: sum('lost'), orders: sum('orders'), before: sum('before'), surplus: sum('surplus') };
  }

  var api = { pricing: pricing, trace: trace, LOCAL: LOCAL, TRANSIT: TRANSIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') global.GMTPriceReview = api;
})(typeof window !== 'undefined' ? window : globalThis);
