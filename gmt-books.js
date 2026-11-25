/* ═════════════════════════════════════════════════════════════════════
   gmt-books.js — السجلّ المالي الكامل + إقفال السنة (seq B1101 · TASK-B0563)
   «سجلّ كامل نعرف فيه الدفعات… مربوط بالمحاسبة مشان على السنة الجديدة يسجّل: المبيعات · المصاريف · الواصل والأصول · حتى الدفعات المترتّبة علينا»
   ما في حساب جديد: كلّه من نفس مصادر لوحة المحاسبة وقواعد gmt-ledger.js (الصندوق · الربح · مستحقّ المورّد · شحن الصين).

   GMTBooks.journal(ctx, range)   ⇒ [{ at, kind, title, ref, amount(+داخل/−طالع), branch, by }]   كلّ حركة مال لحالها
   GMTBooks.summary(ctx, range)   ⇒ { sales, cash, profit, expenses, assets, drawings, supplierPaid, costsPaid, commPaid, collections, purchases{...}, months[] }
   GMTBooks.position(ctx)         ⇒ { cash, receivables{...}, payables{...}, stock, assets, net }   «ما لنا وما علينا» (هلّق)
   GMTBooks.closeSnapshot(ctx, year) ⇒ لقطة الإقفال (تنحفظ بـgmt_fiscal_years) · GMTBooks.open(getCtx) — النافذة
   ctx = { invoices, transfers, comm, expenses, purchases, poPays, receipts, debts, manualDebts, reservations, isMgmt, isExcluded, opening, stock }
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTBooks) return;
  var L = function () { return g.GMTLedger; };
  var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  var num = function (v) { v = Number(v); return isNaN(v) ? 0 : v; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ymd(v) { return L() && L().localYMD ? L().localYMD(v) : String(v || '').slice(0, 10); }
  function inR(v, range) { return L() && L().inRange ? L().inRange(v, range) : true; }
  function yearRange(y) { return { from: y + '-01-01', to: y + '-12-31' }; }
  function invCash(i) { return g.GMTCash && GMTCash.invCash ? GMTCash.invCash(i) : ((i.paid_amount != null && i.paid_amount !== '') ? num(i.paid_amount) : num(i.total)); }
  function realInv(ctx) { var ex = ctx.isExcluded || function () { return false; }; return (ctx.invoices || []).filter(function (i) { return i && !String(i.customer_name || '').startsWith('[تدريب]') && !ex(i.branch_key); }); }
  function usdOf(x) { var c = String(x.currency || 'USD').toUpperCase(); if (c === 'USD') return num(x.amount); var fx = num(x.exchange_rate || x.fx_rate); return fx > 0 ? num(x.amount) / fx : 0; }
  function poOf(ctx) { var m = {}; (ctx.purchases || []).forEach(function (p) { if (p) m[String(p.id)] = p; }); return m; }
  var KIND = { sale: ['🧾', 'مبيع'], ret: ['↩️', 'مرتجع'], collect: ['💵', 'تحصيل من زبون'], expense: ['💸', 'مصروف'], asset: ['🏗️', 'أصل (شراء معدّات/تجهيز)'],
    drawing: ['👤', 'سحب شخصي'], supplier: ['🏭', 'دفعة لمورّد'], costs: ['🛃', 'شحن وجمارك'], comm: ['🤝', 'عمولة'] };

  /* ── كلّ حركة مال لحالها ── */
  function journal(ctx, range) {
    var out = [], Lg = L(), PO = poOf(ctx);
    realInv(ctx).forEach(function (i) {
      if (!inR(i.created_at, range)) return;
      var t = num(i.total), cash = invCash(i), credit = r2(t - cash);
      out.push({ at: i.created_at, kind: t < 0 ? 'ret' : 'sale', title: (t < 0 ? 'مرتجع' : 'فاتورة مبيع') + ' #' + (i.inv_number || i.id) + (i.customer_name ? ' · ' + i.customer_name : '') + (credit > 0.005 && t > 0 ? ' · آجل ' + credit.toFixed(2) + '$' : ''),
        ref: i.inv_number || i.id, amount: r2(cash), total: r2(t), branch: i.branch_name || i.branch_key || '', by: i.cashier_name || i.created_by || '' });
    });
    (ctx.receipts || []).forEach(function (x) {
      if (!x || x.voided || !inR(x.created_at, range)) return;
      out.push({ at: x.created_at, kind: 'collect', title: 'تحصيل من ' + (x.customer_name || 'زبون') + (x.method ? ' · ' + x.method : ''), ref: x.id, amount: r2(usdOf(x)), branch: x.branch_key || '', by: x.received_by || '' });
    });
    /* دفعات المورّد: من سجلّ الدفعات بتاريخها الحقيقي · الفواتير القديمة بلا دفعات ⇒ من قيود الدفتر [PO:g] */
    var hasPays = {};
    (ctx.poPays || []).forEach(function (x) {
      if (!x || x.voided) return; hasPays[String(x.purchase_id)] = 1;
      var at = x.paid_at || x.created_at; if (!inR(at, range)) return;
      var p = PO[String(x.purchase_id)] || {};
      out.push({ at: at, kind: 'supplier', title: 'دفعة لمورّد ' + (p.supplier || '') + ' · فاتورة ' + (p.inv_number || '#' + x.purchase_id) + (x.kind === 'opening' ? ' (دفعة قديمة)' : ''), ref: p.inv_number || x.purchase_id, amount: -r2(num(x.usd != null ? x.usd : usdOf(x))), branch: '', by: x.paid_by || '' });
    });
    (Lg && Lg.ledgerRows ? Lg.ledgerRows(ctx.expenses || [], null) : []).forEach(function (e) {
      var t = Lg.poInfo(e); if (!t || !e.approved && e.approved !== undefined) return;
      if (!inR(e.created_at, range)) return;
      if (t.part === 'g' && hasPays[String(t.pid)]) return;   /* الدفعات الحقيقية مسجّلة فوق */
      var p = PO[String(t.pid)] || {};
      out.push({ at: e.created_at, kind: t.part === 'c' ? 'costs' : 'supplier', title: (t.part === 'c' ? 'شحن وجمارك · فاتورة ' : 'دفعة لمورّد ' + (p.supplier || '') + ' · فاتورة ') + (p.inv_number || '#' + t.pid) + (num(e.amount) < 0 ? ' (تصحيح)' : ''),
        ref: p.inv_number || t.pid, amount: -r2(Lg.usd(e)), branch: e.branch_key || '', by: (/دفعها:\s*([^·\]]+)/.exec(String(e.note || '')) || [])[1] || '' });
    });
    (ctx.expenses || []).forEach(function (e) {
      if (!e || e.voided || e.approved === false || (Lg && Lg.poInfo(e))) return;
      if (!inR(e.created_at, range)) return;
      var c = Lg ? Lg.expClass(e) : 'op';
      out.push({ at: e.created_at, kind: c === 'capital' ? 'asset' : c === 'drawing' ? 'drawing' : 'expense', title: (e.title || 'مصروف') + (e.kind && c === 'op' ? ' · ' + e.kind : ''), ref: e.id, amount: -r2(Lg ? Lg.usd(e) : num(e.amount)), branch: e.branch_key || (e.is_general ? 'الإدارة' : ''), by: e.requested_by || e.created_by || '' });
    });
    (ctx.comm || []).forEach(function (c) {
      if (!c || !c.paid || c.zeroed) return; var at = c.paid_at || c.created_at; if (!inR(at, range)) return;
      out.push({ at: at, kind: 'comm', title: 'عمولة' + (c.cashier_name ? ' · ' + c.cashier_name : '') + (c.note ? ' · ' + c.note : ''), ref: c.invoice_id, amount: -r2(num(c.amount)), branch: c.branch_key || '', by: c.cashier_name || '' });
    });
    out.sort(function (a, b) { return String(a.at) < String(b.at) ? 1 : -1; });
    return out;
  }

  /* ── ملخّص الفترة (السنة) ── */
  function summary(ctx, range) {
    var J = journal(ctx, range), s = { sales: 0, returns: 0, cash: 0, credit: 0, collections: 0, expenses: 0, assets: 0, drawings: 0, supplierPaid: 0, costsPaid: 0, commPaid: 0, count: J.length };
    var M = {};
    J.forEach(function (e) {
      var m = ymd(e.at).slice(0, 7), mm = M[m] || (M[m] = { m: m, sales: 0, in: 0, out: 0, expenses: 0, supplier: 0 });
      if (e.amount > 0) mm.in += e.amount; else mm.out -= e.amount;
      if (e.kind === 'sale') { s.sales += e.total; s.cash += e.amount; s.credit += Math.max(0, e.total - e.amount); mm.sales += e.total; }
      else if (e.kind === 'ret') { s.returns += -e.total; s.cash += e.amount; mm.sales += e.total; }
      else if (e.kind === 'collect') s.collections += e.amount;
      else if (e.kind === 'expense') { s.expenses -= e.amount; mm.expenses -= e.amount; }
      else if (e.kind === 'asset') s.assets -= e.amount;
      else if (e.kind === 'drawing') s.drawings -= e.amount;
      else if (e.kind === 'supplier') { s.supplierPaid -= e.amount; mm.supplier -= e.amount; }
      else if (e.kind === 'costs') { s.costsPaid -= e.amount; mm.supplier -= e.amount; }
      else if (e.kind === 'comm') s.commPaid -= e.amount;
    });
    Object.keys(s).forEach(function (k) { if (k !== 'count') s[k] = r2(s[k]); });
    s.months = Object.keys(M).sort().map(function (k) { var x = M[k]; return { m: k, sales: r2(x.sales), in: r2(x.in), out: r2(x.out), expenses: r2(x.expenses), supplier: r2(x.supplier), net: r2(x.in - x.out) }; });
    s.netCash = r2(J.reduce(function (a, e) { return a + e.amount; }, 0));
    /* الربح: نفس قاعدة لوحة المحاسبة (على الفواتير معروفة الكلفة) */
    s.profit = L() && L().profit ? L().profit(ctx, range, ctx.costFn) : null;
    /* المشتريات المسجّلة بالفترة: قيمة المورّد (مع شحن الصين) · منها واصل · منها بالطريق */
    var P = { count: 0, due: 0, arrived: 0, transit: 0, costs: 0 };
    (ctx.purchases || []).forEach(function (p) {
      if (!p || /cancel/i.test(String(p.status || '')) || (L() && L().isArchival(p))) return;
      if (!inR(p.inv_date || p.created_at, range)) return;
      var d = L() ? L().supplierDue(p) : num(p.total_amount);
      P.count++; P.due += d; P.costs += L() ? L().costsTotal(p) : 0; if (p.status === 'arrived' || p.inv_type === 'instant') P.arrived += d; else P.transit += d;
    });
    Object.keys(P).forEach(function (k) { if (k !== 'count') P[k] = r2(P[k]); });
    s.purchases = P;
    return s;
  }

  /* ── ما لنا وما علينا (هلّق) ── */
  function position(ctx) {
    var Lg = L(), pays = {};
    (ctx.poPays || []).forEach(function (x) { if (x && !x.voided) (pays[String(x.purchase_id)] = pays[String(x.purchase_id)] || []).push(x); });
    var sup = [], costsDue = [];
    (ctx.purchases || []).forEach(function (p) {
      if (!p || /cancel/i.test(String(p.status || '')) || (Lg && Lg.isArchival(p))) return;
      var S = g.GMTPoPay && GMTPoPay.summary ? GMTPoPay.summary(p, pays[String(p.id)] || []) : { remaining: Math.max(0, (Lg ? Lg.supplierDue(p) : num(p.total_amount)) - (Lg ? Lg.paidGoods(p) : num(p.cash_payment))), costsDue: p.costs_paid ? 0 : (Lg ? Lg.costsTotal(p) : 0) };
      if (S.remaining > 0.005) sup.push({ id: p.id, inv: p.inv_number || '#' + p.id, supplier: p.supplier || '', amount: r2(S.remaining), due: S.nextDue || '' });
      if (S.costsDue > 0.005) costsDue.push({ id: p.id, inv: p.inv_number || '#' + p.id, amount: r2(S.costsDue) });
    });
    var commDue = (ctx.comm || []).filter(function (c) { return c && !c.paid && !c.zeroed && c.approved !== false; });
    var iOwe = (ctx.manualDebts || []).filter(function (d) { return d && !d.voided && !d.settled && d.direction === 'i_owe'; });
    var owedMe = (ctx.manualDebts || []).filter(function (d) { return d && !d.voided && !d.settled && d.direction === 'owed_to_me'; });
    var deps = (ctx.reservations || []).filter(function (r) { return r && r.status !== 'completed' && r.status !== 'cancelled' && num(r.deposit) > 0; });
    var debts = (ctx.debts || []).filter(function (d) { return d && num(d.remaining_amount != null ? d.remaining_amount : d.total) > 0.005; });
    var sum = function (a, f) { return r2(a.reduce(function (s, x) { return s + num(f(x)); }, 0)); };
    var pay = { suppliers: sum(sup, function (x) { return x.amount; }), costs: sum(costsDue, function (x) { return x.amount; }), commissions: sum(commDue, function (x) { return x.amount; }), manual: sum(iOwe, function (x) { return x.amount; }), deposits: sum(deps, function (x) { return x.deposit; }) };
    pay.total = r2(pay.suppliers + pay.costs + pay.commissions + pay.manual + pay.deposits);
    var rec = { customers: sum(debts, function (x) { return x.remaining_amount != null ? x.remaining_amount : x.total; }), manual: sum(owedMe, function (x) { return x.amount; }) };
    rec.total = r2(rec.customers + rec.manual);
    var cash = Lg && Lg.centralCash ? Lg.centralCash(ctx, null).total : 0;
    var assets = r2((ctx.expenses || []).filter(function (e) { return e && !e.voided && e.approved !== false && Lg && !Lg.poInfo(e) && Lg.isCapital(e); }).reduce(function (s, e) { return s + Lg.usd(e); }, 0));
    var stock = ctx.stock || { value: 0, units: 0, noCost: 0 };
    return { cash: r2(cash), receivables: rec, payables: pay, stock: stock, assets: assets, net: r2(cash + rec.total + num(stock.value) + assets - pay.total),
      lists: { suppliers: sup.sort(function (a, b) { return b.amount - a.amount; }), costs: costsDue, commissions: commDue.length, manualIOwe: iOwe, manualOwedMe: owedMe, deposits: deps.length, debts: debts.length } };
  }
  function closeSnapshot(ctx, year) {
    var S = summary(ctx, yearRange(year)), P = position(ctx);
    return { year: year, at: new Date().toISOString(), summary: { sales: S.sales, returns: S.returns, cash: S.cash, credit: S.credit, collections: S.collections, expenses: S.expenses, assets: S.assets, drawings: S.drawings, supplierPaid: S.supplierPaid, costsPaid: S.costsPaid, commPaid: S.commPaid, profit: S.profit && S.profit.profit, purchases: S.purchases },
      position: { cash: P.cash, receivables: P.receivables, payables: P.payables, stock: P.stock, assets: P.assets, net: P.net }, suppliers: P.lists.suppliers.slice(0, 200), costs: P.lists.costs.slice(0, 200) };
  }
  function csv(J) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '﻿' + [['التاريخ', 'النوع', 'البيان', 'داخل $', 'طالع $', 'الفرع', 'مين']].concat(J.map(function (e) { return [ymd(e.at), (KIND[e.kind] || ['', e.kind])[1], e.title, e.amount > 0 ? e.amount : '', e.amount < 0 ? -e.amount : '', e.branch, e.by]; })).map(function (r) { return r.map(q).join(','); }).join('\n');
  }

  /* ── القاعدة (إقفال السنة + مصادر ما بتحمّلها لوحة المحاسبة) ── */
  function db() { var M = g.GMT_DB && g.GMT_DB.MAIN; if (M && M.url) return M; throw new Error('إعدادات القاعدة غير محمّلة'); }
  async function req(method, path, body, prefer) {
    var M = db(), h = { apikey: M.key, Authorization: 'Bearer ' + M.key, 'Content-Type': 'application/json' }; if (prefer) h.Prefer = prefer;
    var r = await fetch(M.url + '/rest/v1/' + path, { method: method, headers: h, body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (_) {} throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 160) : '')); }
    var s = await r.text(); return s ? JSON.parse(s) : null;
  }
  async function extras() {
    var got = await Promise.all([
      req('GET', 'gmt_po_payments?select=purchase_id,amount,currency,fx_rate,usd,kind,paid_at,paid_by,due_at,created_at,voided&limit=10000').catch(function () { return []; }),
      req('GET', 'gmt_receipts?select=id,customer_name,amount,currency,exchange_rate,method,branch_key,received_by,created_at,voided&limit=10000').catch(function () { return []; }),
      req('GET', 'gmt_fiscal_years?select=*&order=year.asc').catch(function () { return []; }),
      req('GET', 'inv_columns?select=key_name,include_in_total').catch(function () { return []; })]);
    var cols = (got[3] || []).filter(function (c) { return c.include_in_total; }).map(function (c) { return c.key_name; }).filter(function (k) { return /^[a-z0-9_]+$/i.test(k); });
    var stock = { value: 0, units: 0, noCost: 0 };
    if (cols.length) {
      var rows = await req('GET', 'products?select=id,cost_price,net_cost,' + cols.join(',') + '&limit=20000').catch(function () { return []; });
      (rows || []).forEach(function (p) { var q = cols.reduce(function (s, k) { return s + Math.max(0, num(p[k])); }, 0); if (!q) return; var c = num(p.cost_price) || 0; stock.units += q; if (c > 0) stock.value += q * c; else stock.noCost += q; });
      stock.value = r2(stock.value);
    }
    return { poPays: got[0] || [], receipts: got[1] || [], closed: got[2] || [], stock: stock };
  }
  function who() { try { return (g.GMTRole && GMTRole.name && GMTRole.name()) || ''; } catch (_) { return ''; } }

  /* ── النافذة ── */
  var fmt = function (n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var BTN = 'border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:6px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer';
  function tile(k, v, sub, col) { return '<div style="flex:1;min-width:130px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:8px 10px"><div style="font-size:11px;color:#64748b;font-weight:800">' + k + '</div><div style="font-size:16px;font-weight:900;color:' + (col || '#0f1219') + '" dir="ltr">' + v + '</div>' + (sub ? '<div style="font-size:10.5px;color:#64748b">' + sub + '</div>' : '') + '</div>'; }
  function line(k, v, col, sub) { return '<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="flex:1">' + k + (sub ? ' <span style="font-size:11px;color:#94a3b8">' + sub + '</span>' : '') + '</span><b dir="ltr" style="color:' + (col || '#0f1219') + '">' + fmt(v) + '$</b></div>'; }
  function open(getCtx, o) {
    o = o || {};
    var old = document.querySelector('[data-books]'); if (old) old.remove();
    var w = document.createElement('div'); w.setAttribute('data-books', '');
    w.style.cssText = 'position:fixed;inset:0;z-index:9600;background:rgba(15,18,25,.55);display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto';
    var box = document.createElement('div'); box.dir = 'rtl';
    box.style.cssText = 'background:#f8fafc;border-radius:16px;padding:14px;width:100%;max-width:920px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:inherit';
    w.appendChild(box); w.setAttribute('data-gmt-modal', ''); document.body.appendChild(w);
    var X = null, st = { year: o.year || new Date().getFullYear(), tab: 'sum', kind: '', q: '' };
    function ctx() { return Object.assign({}, typeof getCtx === 'function' ? getCtx() : getCtx, X || {}); }
    function closedRow(y) { return ((X && X.closed) || []).find(function (r) { return Number(r.year) === Number(y); }); }
    function paint() {
      if (!X) { box.innerHTML = '<div style="padding:30px;text-align:center;font-weight:800;color:#64748b">⏳ عم يجمع السجلّ المالي…</div>'; return; }
      var C = ctx(), R = yearRange(st.year), S = summary(C, R), P = position(C), J = journal(C, R), cr = closedRow(st.year), prev = closedRow(st.year - 1);
      var years = {}; years[new Date().getFullYear()] = 1; (C.invoices || []).concat(C.expenses || []).forEach(function (x) { var y = parseInt(ymd(x && x.created_at).slice(0, 4), 10); if (y > 2000) years[y] = 1; });
      var tabs = [['sum', '📊 السنة'], ['pos', '⚖️ ما لنا وما علينا'], ['jr', '📒 كلّ الحركات (' + J.length + ')'], ['close', cr ? '🔒 مقفولة' : '🔒 إقفال السنة']];
      var body = '';
      if (st.tab === 'sum') {
        var pr = S.profit || {};
        body = (prev ? '<div data-bk-carry style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:8px 10px;font-size:12.5px;margin-bottom:10px">↪️ <b>مدوّر من ' + prev.year + '</b>: الصندوق ' + fmt(prev.snapshot.position.cash) + '$ · لنا ' + fmt(prev.snapshot.position.receivables.total) + '$ · علينا ' + fmt(prev.snapshot.position.payables.total) + '$ · البضاعة ' + fmt(prev.snapshot.position.stock.value) + '$</div>' : '') +
          '<div style="display:flex;gap:6px;flex-wrap:wrap">' + tile('المبيعات', fmt(S.sales) + '$', 'منها آجل ' + fmt(S.credit) + '$' + (S.returns ? ' · مرتجع ' + fmt(S.returns) + '$' : '')) + tile('الربح', pr.profit != null ? fmt(pr.profit) + '$' : '—', pr.unknownCount ? pr.unknownCount + ' فاتورة بلا كلفة معروفة ما انحسبت' : 'على الفواتير معروفة الكلفة', pr.profit < 0 ? '#b91c1c' : '#15803d') +
          tile('المصاريف', fmt(S.expenses) + '$', 'تشغيلية') + tile('المشتريات', fmt(S.purchases.due) + '$', S.purchases.count + ' فاتورة · واصل ' + fmt(S.purchases.arrived) + ' · بالطريق ' + fmt(S.purchases.transit)) + '</div>' +
          '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:8px 12px;margin-top:10px"><div style="font-weight:900;margin-bottom:4px">💰 المال اللي دخل وطلع بالسنة</div>' +
          line('🧾 مقبوض من المبيعات', S.cash, '#15803d') + line('💵 تحصيل ديون زبائن', S.collections, '#15803d') + line('🏭 دفعات للمورّدين', -S.supplierPaid, '#b91c1c') + line('🛃 شحن وجمارك', -S.costsPaid, '#b91c1c') +
          line('💸 مصاريف', -S.expenses, '#b91c1c') + line('🏗️ أصول (معدّات/تجهيز)', -S.assets, '#b91c1c') + line('🤝 عمولات', -S.commPaid, '#b91c1c') + line('👤 سحوبات شخصية', -S.drawings, '#b91c1c') +
          '<div style="display:flex;padding:6px 0;font-size:14px;font-weight:900"><span style="flex:1">الصافي</span><b dir="ltr" style="color:' + (S.netCash < 0 ? '#b91c1c' : '#15803d') + '">' + fmt(S.netCash) + '$</b></div></div>' +
          '<div style="font-weight:900;margin:12px 0 4px">بالشهر</div><div style="overflow:auto;border:1px solid #e5e7eb;border-radius:12px;background:#fff"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9"><th style="padding:6px;text-align:right">الشهر</th><th>المبيعات</th><th>دخل</th><th>طلع</th><th>منها مورّدين</th><th>مصاريف</th><th>الصافي</th></tr>' +
          (S.months.length ? S.months.slice().reverse().map(function (m) { return '<tr style="border-top:1px solid #f1f5f9"><td style="padding:6px" dir="ltr">' + m.m + '</td><td style="text-align:center">' + fmt(m.sales) + '</td><td style="text-align:center;color:#15803d">' + fmt(m.in) + '</td><td style="text-align:center;color:#b91c1c">' + fmt(m.out) + '</td><td style="text-align:center">' + fmt(m.supplier) + '</td><td style="text-align:center">' + fmt(m.expenses) + '</td><td style="text-align:center;font-weight:900">' + fmt(m.net) + '</td></tr>'; }).join('') : '<tr><td colspan="7" style="padding:10px;text-align:center;color:#64748b">ما في حركات بهالسنة.</td></tr>') + '</table></div>';
      }
      if (st.tab === 'pos') {
        body = '<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">هلّق (' + ymd(new Date().toISOString()) + ') — من كلّ السنين</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px">' +
          '<div style="background:#fff;border:1px solid #bbf7d0;border-radius:12px;padding:8px 12px"><div style="font-weight:900;color:#15803d;margin-bottom:4px">✅ ما لنا</div>' + line('💰 الصندوق المركزي', P.cash) + line('🧾 ديون الزبائن (آجل)', P.receivables.customers, null, P.lists.debts + ' فاتورة') + line('📝 ديون يدوية لنا', P.receivables.manual) +
          line('📦 البضاعة بالمخزون (بالكلفة)', P.stock.value, null, P.stock.noCost ? P.stock.noCost + ' قطعة بلا كلفة ما انحسبت' : '') + line('🏗️ الأصول (معدّات/تجهيز)', P.assets) + '</div>' +
          '<div style="background:#fff;border:1px solid #fecaca;border-radius:12px;padding:8px 12px"><div style="font-weight:900;color:#b91c1c;margin-bottom:4px">⏳ علينا (مترتّب)</div>' + line('🏭 للمورّدين', P.payables.suppliers, '#b91c1c', P.lists.suppliers.length + ' فاتورة') + line('🛃 شحن وجمارك لسّا عليها', P.payables.costs, '#b91c1c', P.lists.costs.length + ' فاتورة') +
          line('🤝 عمولات ما اندفعت', P.payables.commissions, '#b91c1c') + line('📝 ديون يدوية علينا', P.payables.manual, '#b91c1c') + line('🎟️ عرابين زبائن (بضاعة لازم نسلّمها)', P.payables.deposits, '#b91c1c', P.lists.deposits + ' حجز') + '</div></div>' +
          '<div style="background:#0f1219;color:#fff;border-radius:12px;padding:10px 12px;margin-top:10px;display:flex;align-items:center"><span style="flex:1;font-weight:900">الصافي التقديري (ما لنا − ما علينا)</span><b dir="ltr" style="font-size:18px">' + fmt(P.net) + '$</b></div>' +
          (P.lists.suppliers.length ? '<div style="font-weight:900;margin:12px 0 4px">🏭 الدفعات المترتّبة للمورّدين</div><div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:4px 12px">' + P.lists.suppliers.map(function (x) { return line(esc(x.inv) + ' · ' + esc(x.supplier), x.amount, '#b91c1c', x.due ? '📅 ' + x.due : ''); }).join('') + '</div>' : '') +
          (P.lists.costs.length ? '<div style="font-weight:900;margin:12px 0 4px">🛃 شحن وجمارك لسّا عليها</div><div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:4px 12px">' + P.lists.costs.map(function (x) { return line(esc(x.inv), x.amount, '#b91c1c'); }).join('') + '</div>' : '');
      }
      if (st.tab === 'jr') {
        var q = st.q.trim().toLowerCase(), F = J.filter(function (e) { return (!st.kind || e.kind === st.kind) && (!q || (e.title + ' ' + e.branch + ' ' + e.by).toLowerCase().indexOf(q) >= 0); });
        body = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><select data-bk-kind style="border:1.5px solid #e5e7eb;border-radius:10px;padding:6px;font:inherit;font-size:12.5px;font-weight:800"><option value="">كلّ الأنواع</option>' + Object.keys(KIND).map(function (k) { return '<option value="' + k + '"' + (st.kind === k ? ' selected' : '') + '>' + KIND[k][0] + ' ' + KIND[k][1] + '</option>'; }).join('') + '</select>' +
          '<input data-bk-q value="' + esc(st.q) + '" placeholder="ابحث: مورّد · زبون · فاتورة · فرع…" style="flex:1;min-width:160px;border:1.5px solid #e5e7eb;border-radius:10px;padding:6px 10px;font:inherit;font-size:12.5px"><button data-bk-csv style="' + BTN + '">⬇️ CSV</button></div>' +
          '<div style="font-size:12px;color:#475569;margin-bottom:6px">' + F.length + ' حركة · داخل <b style="color:#15803d">' + fmt(F.reduce(function (a, e) { return a + Math.max(0, e.amount); }, 0)) + '$</b> · طالع <b style="color:#b91c1c">' + fmt(F.reduce(function (a, e) { return a + Math.max(0, -e.amount); }, 0)) + '$</b></div>' +
          '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;max-height:60vh;overflow:auto">' + (F.slice(0, 1500).map(function (e) { var k = KIND[e.kind] || ['•', e.kind];
            return '<div data-bk-row style="display:flex;gap:8px;align-items:center;padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12.5px"><span style="font-size:17px">' + k[0] + '</span><div style="flex:1;min-width:0"><div style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(e.title) + '</div><div style="font-size:11px;color:#64748b">' + esc(ymd(e.at)) + ' · ' + esc(k[1]) + (e.branch ? ' · ' + esc(e.branch) : '') + (e.by ? ' · ' + esc(e.by) : '') + '</div></div><b dir="ltr" style="color:' + (e.amount >= 0 ? '#15803d' : '#b91c1c') + '">' + (e.amount >= 0 ? '+' : '−') + fmt(Math.abs(e.amount)) + '$</b></div>'; }).join('') || '<div style="padding:14px;text-align:center;color:#64748b">ما في حركات.</div>') + '</div>';
      }
      if (st.tab === 'close') {
        if (cr) {
          var now = closeSnapshot(C, st.year), d1 = r2(now.position.payables.total - cr.snapshot.position.payables.total), d2 = r2(now.summary.sales - cr.snapshot.summary.sales);
          body = '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;font-size:13px;line-height:2">🔒 سنة <b>' + st.year + '</b> انقفلت ' + esc(String(cr.closed_at).slice(0, 10)) + (cr.closed_by ? ' · ' + esc(cr.closed_by) : '') + '<br>' +
            'وقت الإقفال: المبيعات ' + fmt(cr.snapshot.summary.sales) + '$ · الصندوق ' + fmt(cr.snapshot.position.cash) + '$ · لنا ' + fmt(cr.snapshot.position.receivables.total) + '$ · علينا ' + fmt(cr.snapshot.position.payables.total) + '$ · البضاعة ' + fmt(cr.snapshot.position.stock.value) + '$' +
            (Math.abs(d2) > 0.01 ? '<div data-bk-drift style="color:#b45309;font-weight:900">⚠️ مبيعات ' + st.year + ' تغيّرت بعد الإقفال بـ' + fmt(d2) + '$ — في فاتورة انضافت/انعدّلت بتاريخ قديم</div>' : '<div style="color:#15803d;font-weight:800">✓ أرقام السنة ما تغيّرت بعد الإقفال</div>') + '</div>';
        } else {
          body = '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;font-size:13px;line-height:2">' +
            '<b>🔒 إقفال سنة ' + st.year + '</b><br>بيحفظ لقطة آخر السنة: المبيعات · المصاريف · المشتريات · الصندوق · ما لنا · ما علينا (المورّدين والشحن والجمارك والعمولات والعرابين) · البضاعة · الأصول — وبتصير هي «المدوّر» أوّل السنة الجديدة.<br>' +
            '<span style="color:#64748b;font-size:12px">ما بيمنع أيّ تعديل — بس إذا تغيّر شي بالسنة بعد الإقفال، بيطلعلك الفرق هون. الأفضل تقفل أوّل يوم بالسنة الجديدة.</span>' +
            '<button data-bk-close style="display:block;width:100%;margin-top:10px;border:0;background:#0f1219;color:#fff;border-radius:12px;padding:10px;font:inherit;font-size:14px;font-weight:900;cursor:pointer">🔒 اقفل سنة ' + st.year + ' واحفظ المدوّر</button></div>';
        }
      }
      box.innerHTML = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap"><div style="flex:1;font-weight:900;font-size:16px">📒 السجلّ المالي</div>' +
        '<select data-bk-year style="border:1.5px solid #e5e7eb;border-radius:10px;padding:6px 8px;font:inherit;font-weight:900">' + Object.keys(years).sort().reverse().map(function (y) { return '<option' + (+y === +st.year ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
        '<button data-bk-x style="' + BTN + '">✕</button></div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">' + tabs.map(function (t) { return '<button data-bk-tab="' + t[0] + '" style="border:0;border-radius:999px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:900;cursor:pointer;background:' + (st.tab === t[0] ? '#0f1219;color:#fff' : '#fff;color:#334155') + '">' + t[1] + '</button>'; }).join('') + '</div>' + body;
    }
    w.addEventListener('click', async function (e) {
      var t = e.target;
      if (t === w || t.closest('[data-bk-x]')) { w.remove(); return; }
      var tb = t.closest('[data-bk-tab]'); if (tb) { st.tab = tb.getAttribute('data-bk-tab'); paint(); return; }
      if (t.closest('[data-bk-csv]')) { var b = new Blob([csv(journal(ctx(), yearRange(st.year)))], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'السجل_المالي_' + st.year + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); return; }
      if (t.closest('[data-bk-close]')) {
        var ok = g.GMTAsk && GMTAsk.confirm ? await GMTAsk.confirm('تقفل سنة ' + st.year + ' وتحفظ أرقامها كمدوّر للسنة الجديدة؟', { title: '🔒 إقفال السنة' }) : g.confirm('إقفال السنة؟');
        if (!ok) return;
        try {
          var row = { year: st.year, closed_by: who() || null, snapshot: closeSnapshot(ctx(), st.year) };
          await req('POST', 'gmt_fiscal_years', row, 'return=representation');
          X.closed = (X.closed || []).concat([Object.assign({ closed_at: new Date().toISOString() }, row)]);
          try { g.GMTAudit && GMTAudit.log({ action: 'fiscal_year_close', entity: 'gmt_fiscal_years', entityId: String(st.year), newValue: 'علينا ' + row.snapshot.position.payables.total + '$ · لنا ' + row.snapshot.position.receivables.total + '$' }); } catch (_) {}
          paint(); if (typeof g.toast === 'function') g.toast('🔒 انقفلت سنة ' + st.year + ' وانحفظ المدوّر', 'ok');
        } catch (er) { if (typeof g.toast === 'function') g.toast(/23505|duplicate/.test(er.message) ? 'السنة مقفولة من قبل' : 'تعذّر الإقفال: ' + er.message, 'err'); }
      }
    });
    w.addEventListener('change', function (e) {
      if (e.target.closest('[data-bk-year]')) { st.year = +e.target.value; paint(); }
      if (e.target.closest('[data-bk-kind]')) { st.kind = e.target.value; paint(); }
    });
    w.addEventListener('input', function (e) { var q = e.target.closest('[data-bk-q]'); if (q) { st.q = q.value; var pos = q.selectionStart; paint(); var n = box.querySelector('[data-bk-q]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } } });
    paint();
    extras().then(function (x) { X = x; paint(); }).catch(function (er) { X = { poPays: [], receipts: [], closed: [], stock: { value: 0, units: 0, noCost: 0 } }; paint(); if (typeof g.toast === 'function') g.toast('بعض المصادر ما تحمّلت: ' + er.message, 'err'); });
    return w;
  }
  g.GMTBooks = { journal: journal, summary: summary, position: position, closeSnapshot: closeSnapshot, csv: csv, yearRange: yearRange, open: open, KIND: KIND };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTBooks;
})(typeof window !== 'undefined' ? window : globalThis);
