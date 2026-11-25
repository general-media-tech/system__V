/* ═════════════════════════════════════════════════════════════════════
   gmt-poreports.js — تقارير المشتريات وتحليلاتها (A1004 P6 · الخطّة 1.8 · طابور Q1 · seq B1095)
   «كم صرفنا · على مين · قدّيش التكاليف فوق البضاعة · شو غلي سعره» — من فواتير الشراء نفسها (import_log)، بلا جدول جديد.

   GMTPoReports.build(invoices, { months, type, supplier, now }) ⇒ تقرير صافٍ (يُختبر بلا متصفّح):
     { cur, others:[{cur,n,value}], kpi:{ n, value, costs, overhead, landed, units, suppliers },
       months:[{ m, value, costs, n }], suppliers:[{ name, n, value, costs, overhead, last }],
       types:[{ type, n, value, costs }], products:[{ id, name, qty, spend, n, first, last, change }],
       rises:[{ id, name, prev, last, pct, prevInv, lastInv, prevSup, lastSup }] }
     • القيمة = سعر الشراء الأصلي × الكمية (orig_unit_price ⇐ وإلّا unit_price) — مو الكلفة الواصلة
     • التكاليف = نقل + شحن + جمارك + داخلي + تحويل · نسبة التكاليف = التكاليف ÷ القيمة
     • العملة: التقرير بعملة الأكثريّة (USD) والباقي يُعدّ لحاله (ما في سعر صرف مسجّل ⇒ ما منخلط)
     • الملغاة ما بتدخل
   GMTPoReports.csv(R) · GMTPoReports.open(getInvoices, { onOpenInv })
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTPoReports) return;
  var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function arr(v) { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return []; } } return Array.isArray(v) ? v : []; }
  function supKey(s) { return String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase(); }
  var TYPE = { china: 'صينية 🇨🇳', germany: 'أوروبية 🇩🇪', instant: 'فورية ⚡' };
  function canonSup(inv) { try { if (g.GMTSuppliers && GMTSuppliers.canon) return GMTSuppliers.canon(inv); } catch (_) {} return String((inv && inv.supplier) || '').replace(/\s+/g, ' ').trim(); }   /* (B1097) مورّد واحد بأكتر من اسم */
  function dateOf(inv) { return String(inv.inv_date || inv.created_at || '').slice(0, 10); }
  function costsOf(inv) { return ['cost_transport', 'cost_shipping', 'cost_customs', 'cost_local', 'cost_transfer'].reduce(function (s, k) { return s + (Number(inv[k]) || 0); }, 0); }
  function unitOf(it) { var o = Number(it.orig_unit_price); return o > 0 ? o : (Number(it.unit_price) || 0); }
  function valueOf(inv) {
    var items = arr(inv.items_snapshot), v = items.reduce(function (s, it) { return s + unitOf(it) * (Number(it.qty) || 0); }, 0);
    return v > 0 ? v : (Number(inv.total_amount) || 0);
  }
  function monthsBack(now, n) { var d = new Date(now); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - (n - 1)); return d.toISOString().slice(0, 7); }

  function build(invoices, o) {
    o = o || {};
    var now = o.now || new Date().toISOString(), from = o.months ? monthsBack(now, o.months) : '';
    var all = (invoices || []).filter(function (inv) { return inv && !/cancel|void|ملغ/i.test(String(inv.status || '')); });
    var curCount = {}; all.forEach(function (inv) { var c = inv.currency || 'USD'; curCount[c] = (curCount[c] || 0) + 1; });
    var cur = Object.keys(curCount).sort(function (a, b) { return curCount[b] - curCount[a]; })[0] || 'USD';
    var others = {};
    var sel = all.filter(function (inv) {
      var d = dateOf(inv);
      if (from && d.slice(0, 7) < from) return false;
      if (o.type && inv.inv_type !== o.type) return false;
      if (o.supplier && supKey(canonSup(inv)) !== supKey(o.supplier)) return false;
      if ((inv.currency || 'USD') !== cur) { var x = others[inv.currency] || (others[inv.currency] = { cur: inv.currency, n: 0, value: 0 }); x.n++; x.value += valueOf(inv); return false; }
      return true;
    });
    var kpi = { n: sel.length, value: 0, costs: 0, units: 0 }, M = {}, S = {}, T = {}, P = {};
    sel.forEach(function (inv) {
      var v = valueOf(inv), c = costsOf(inv), d = dateOf(inv), m = d.slice(0, 7);
      kpi.value += v; kpi.costs += c;
      var mm = M[m] || (M[m] = { m: m, value: 0, costs: 0, n: 0 }); mm.value += v; mm.costs += c; mm.n++;
      var cs = canonSup(inv), sk = supKey(cs) || '—', ss = S[sk] || (S[sk] = { name: cs || 'بلا مورّد', n: 0, value: 0, costs: 0, last: '' });
      ss.n++; ss.value += v; ss.costs += c; if (d > ss.last) ss.last = d;
      var tk = inv.inv_type || 'other', tt = T[tk] || (T[tk] = { type: tk, label: TYPE[tk] || tk, n: 0, value: 0, costs: 0 }); tt.n++; tt.value += v; tt.costs += c;
      arr(inv.items_snapshot).forEach(function (it) {
        if (!it) return; var q = Number(it.qty) || 0, u = unitOf(it); kpi.units += q;
        var k = it.id != null && it.id !== '' ? 'p:' + it.id : 'n:' + String(it.name || '').trim().toLowerCase(); if (k === 'n:') return;
        var p = P[k] || (P[k] = { id: it.id != null ? it.id : null, name: it.name || '', qty: 0, spend: 0, n: 0, buys: [] });
        p.qty += q; p.spend += u * q; p.n++; if (it.name) p.name = it.name;
        if (u > 0) p.buys.push({ at: d, u: u, inv: inv.inv_number || '#' + inv.id, sup: canonSup(inv) });
      });
    });
    kpi.value = r2(kpi.value); kpi.costs = r2(kpi.costs); kpi.landed = r2(kpi.value + kpi.costs);
    kpi.overhead = kpi.value > 0 ? Math.round(kpi.costs / kpi.value * 1000) / 10 : 0;
    kpi.suppliers = Object.keys(S).length;
    /* الأشهر الفاضية بالنصّ بتنعرض صفر (محور الزمن ما بيقفز) */
    var mk = Object.keys(M).sort();
    if (mk.length > 1) { var cur0 = mk[0], end = mk[mk.length - 1]; while (cur0 < end) { var dd = new Date(cur0 + '-01T00:00:00Z'); dd.setUTCMonth(dd.getUTCMonth() + 1); cur0 = dd.toISOString().slice(0, 7); if (!M[cur0]) M[cur0] = { m: cur0, value: 0, costs: 0, n: 0 }; } }
    var months = Object.keys(M).sort().map(function (k) { var x = M[k]; return { m: x.m, value: r2(x.value), costs: r2(x.costs), n: x.n }; });
    var suppliers = Object.keys(S).map(function (k) { var x = S[k]; return { name: x.name, n: x.n, value: r2(x.value), costs: r2(x.costs), overhead: x.value > 0 ? Math.round(x.costs / x.value * 1000) / 10 : 0, last: x.last }; })
      .sort(function (a, b) { return b.value - a.value; });
    var types = Object.keys(T).map(function (k) { var x = T[k]; return { type: x.type, label: x.label, n: x.n, value: r2(x.value), costs: r2(x.costs) }; }).sort(function (a, b) { return b.value - a.value; });
    var products = [], rises = [];
    Object.keys(P).forEach(function (k) {
      var p = P[k]; p.buys.sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; });
      var f = p.buys[0], l = p.buys[p.buys.length - 1];
      products.push({ id: p.id, name: p.name, qty: p.qty, spend: r2(p.spend), n: p.n, first: f ? r2(f.u) : null, last: l ? r2(l.u) : null, change: f && l && f.u > 0 && p.buys.length > 1 ? Math.round((l.u - f.u) / f.u * 1000) / 10 : null });
      if (p.buys.length > 1) { var pv = p.buys[p.buys.length - 2]; var pct = pv.u > 0 ? (l.u - pv.u) / pv.u * 100 : 0;
        if (pct >= 5) rises.push({ id: p.id, name: p.name, prev: r2(pv.u), last: r2(l.u), pct: Math.round(pct * 10) / 10, prevInv: pv.inv, lastInv: l.inv, prevSup: pv.sup, lastSup: l.sup, at: l.at }); }
    });
    products.sort(function (a, b) { return b.spend - a.spend; });
    rises.sort(function (a, b) { return b.pct - a.pct; });
    return { cur: cur, from: from, others: Object.keys(others).map(function (k) { var x = others[k]; return { cur: x.cur, n: x.n, value: r2(x.value) }; }),
      kpi: kpi, months: months, suppliers: suppliers, types: types, products: products, rises: rises };
  }

  function csv(R) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var L = [['القسم', 'البند', 'عدد', 'القيمة (' + R.cur + ')', 'التكاليف', 'نسبة التكاليف %', 'ملاحظة']];
    R.months.forEach(function (x) { L.push(['شهر', x.m, x.n, x.value, x.costs, x.value ? Math.round(x.costs / x.value * 1000) / 10 : 0, '']); });
    R.suppliers.forEach(function (x) { L.push(['مورّد', x.name, x.n, x.value, x.costs, x.overhead, 'آخر شراء ' + x.last]); });
    R.products.forEach(function (x) { L.push(['منتج', x.name, x.qty, x.spend, '', '', 'أوّل سعر ' + (x.first == null ? '' : x.first) + ' · آخر سعر ' + (x.last == null ? '' : x.last)]); });
    R.rises.forEach(function (x) { L.push(['ارتفاع سعر', x.name, '', x.last, '', x.pct, 'كان ' + x.prev + ' (' + x.prevInv + ') ⇐ ' + x.last + ' (' + x.lastInv + ')']); });
    return '﻿' + L.map(function (r) { return r.map(q).join(','); }).join('\n');
  }

  /* ── الواجهة ── */
  var fmt = function (n) { return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }); };
  function chart(R) {
    if (!R.months.length) return '';
    var max = Math.max.apply(null, R.months.map(function (x) { return x.value + x.costs; })) || 1;
    return '<div data-pr-chart style="display:flex;align-items:flex-end;justify-content:center;gap:4px;height:150px;padding:6px 4px 0;border-bottom:1px solid #cbd5e1;overflow-x:auto" role="img" aria-label="الصرف الشهري">' +
      R.months.map(function (x) {
        var h = x.value ? Math.max(2, Math.round(x.value / max * 130)) : 0, hc = Math.round(x.costs / max * 130);
        var tip = x.m + ' · ' + x.n + ' فاتورة · بضاعة ' + fmt(x.value) + ' · تكاليف ' + fmt(x.costs) + ' ' + R.cur;
        return '<div title="' + esc(tip) + '" style="flex:1;min-width:22px;max-width:64px;display:flex;flex-direction:column;justify-content:flex-end;align-items:stretch;cursor:default">' +
          (hc ? '<div style="height:' + hc + 'px;background:#f59e0b;border-radius:4px 4px 0 0;margin-bottom:2px"></div>' : '') +
          '<div style="height:' + h + 'px;background:#1f348f;border-radius:' + (hc ? '0' : '4px 4px 0 0') + '"></div></div>';
      }).join('') + '</div>' +
      '<div style="display:flex;justify-content:center;gap:4px;padding:2px 4px;overflow-x:auto">' + R.months.map(function (x) { return '<div style="flex:1;min-width:22px;max-width:64px;text-align:center;font-size:9.5px;color:#64748b;direction:ltr">' + esc(x.m.slice(2)) + '</div>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:12px;font-size:11px;color:#475569;margin-top:4px"><span><i style="display:inline-block;width:10px;height:10px;background:#1f348f;border-radius:2px;vertical-align:middle"></i> البضاعة (السعر الأصلي)</span><span><i style="display:inline-block;width:10px;height:10px;background:#f59e0b;border-radius:2px;vertical-align:middle"></i> التكاليف (شحن · جمارك · نقل…)</span></div>';
  }
  function tile(k, v, sub) { return '<div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:8px 10px"><div style="font-size:11px;color:#64748b;font-weight:800">' + k + '</div><div style="font-size:18px;font-weight:900;color:#0f1219">' + v + '</div>' + (sub ? '<div style="font-size:10.5px;color:#64748b">' + sub + '</div>' : '') + '</div>'; }
  var TH = 'style="padding:5px 6px;text-align:right;background:#f1f5f9;font-size:11.5px;position:sticky;top:0"', TD = 'style="padding:5px 6px;border-bottom:1px solid #f1f5f9"';
  function table(head, rows) { return '<div style="max-height:320px;overflow:auto;border:1px solid #eef1f5;border-radius:10px"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr>' + head.map(function (h) { return '<th ' + TH + '>' + h + '</th>'; }).join('') + '</tr>' + (rows.join('') || '<tr><td ' + TD + ' colspan="' + head.length + '">ما في بيانات بهالفترة.</td></tr>') + '</table></div>'; }
  function render(R, st, sups) {
    var k = R.kpi, c = ' ' + R.cur;
    var tabs = [['sum', '📊 الملخّص'], ['sup', '🏭 الموردون'], ['prod', '📦 المنتجات'], ['rise', '📈 ارتفاع الأسعار (' + R.rises.length + ')']];
    var body = '';
    if (st.tab === 'sum') body = '<div style="display:flex;gap:6px;flex-wrap:wrap">' + tile('البضاعة (الأصلي)', fmt(k.value) + c, k.n + ' فاتورة · ' + fmt(k.units) + ' قطعة') + tile('التكاليف', fmt(k.costs) + c, 'شحن · جمارك · نقل · داخلي · تحويل') +
        tile('نسبة التكاليف', k.overhead + '%', 'فوق سعر البضاعة') + tile('الكلفة الواصلة', fmt(k.landed) + c, k.suppliers + ' مورّد') + '</div>' +
        (R.others.length ? '<div data-pr-other style="font-size:11.5px;color:#b45309;font-weight:800;margin-top:6px">⚠️ ' + R.others.map(function (x) { return x.n + ' فاتورة بـ' + esc(x.cur) + ' (' + fmt(x.value) + ')'; }).join(' · ') + ' — محسوبة لحالها (ما في سعر صرف مسجّل)</div>' : '') +
        '<div style="font-weight:900;font-size:13px;margin:12px 0 4px">الصرف بالشهر</div>' + chart(R) +
        '<div style="font-weight:900;font-size:13px;margin:12px 0 4px">حسب نوع الفاتورة</div>' + table(['النوع', 'فواتير', 'البضاعة', 'التكاليف', 'النسبة'], R.types.map(function (x) { return '<tr><td ' + TD + '>' + esc(x.label) + '</td><td ' + TD + '>' + x.n + '</td><td ' + TD + '>' + fmt(x.value) + '</td><td ' + TD + '>' + fmt(x.costs) + '</td><td ' + TD + '>' + (x.value ? Math.round(x.costs / x.value * 1000) / 10 : 0) + '%</td></tr>'; })) +
        '<div style="font-weight:900;font-size:13px;margin:12px 0 4px">جدول الأشهر</div>' + table(['الشهر', 'فواتير', 'البضاعة', 'التكاليف', 'النسبة'], R.months.slice().reverse().map(function (x) { return '<tr><td ' + TD + ' dir="ltr">' + x.m + '</td><td ' + TD + '>' + x.n + '</td><td ' + TD + '>' + fmt(x.value) + '</td><td ' + TD + '>' + fmt(x.costs) + '</td><td ' + TD + '>' + (x.value ? Math.round(x.costs / x.value * 1000) / 10 : 0) + '%</td></tr>'; }));
    if (st.tab === 'sup') body = table(['المورّد', 'فواتير', 'البضاعة', 'الحصّة', 'التكاليف', 'النسبة', 'آخر شراء'], R.suppliers.map(function (x) { return '<tr><td ' + TD + '><a href="#" data-pr-sup="' + esc(x.name) + '" style="font-weight:900;color:#1f348f">' + esc(x.name) + '</a></td><td ' + TD + '>' + x.n + '</td><td ' + TD + '>' + fmt(x.value) + '</td><td ' + TD + '>' + (k.value ? Math.round(x.value / k.value * 100) : 0) + '%</td><td ' + TD + '>' + fmt(x.costs) + '</td><td ' + TD + '>' + x.overhead + '%</td><td ' + TD + ' dir="ltr">' + esc(x.last) + '</td></tr>'; })) +
        '<div style="font-size:11px;color:#64748b;margin-top:4px">اضغط اسم المورّد لتصفية التقرير عليه.</div>';
    if (st.tab === 'prod') body = table(['المنتج', 'كمّية', 'الصرف', 'مرّات', 'أوّل سعر', 'آخر سعر', 'التغيّر'], R.products.slice(0, 200).map(function (x) { return '<tr><td ' + TD + '>' + esc(x.name) + '</td><td ' + TD + '>' + x.qty + '</td><td ' + TD + '>' + fmt(x.spend) + '</td><td ' + TD + '>' + x.n + '</td><td ' + TD + '>' + (x.first == null ? '—' : x.first) + '</td><td ' + TD + '>' + (x.last == null ? '—' : x.last) + '</td><td style="padding:5px 6px;border-bottom:1px solid #f1f5f9;font-weight:900;color:' + (x.change > 0 ? '#b91c1c' : x.change < 0 ? '#15803d' : '#64748b') + '">' + (x.change == null ? '—' : (x.change > 0 ? '+' : '') + x.change + '%') + '</td></tr>'; })) +
        (R.products.length > 200 ? '<div style="font-size:11px;color:#64748b">أوّل 200 حسب الصرف — الكلّ بملف CSV.</div>' : '');
    if (st.tab === 'rise') body = '<div style="font-size:11.5px;color:#475569;margin-bottom:6px">منتجات آخر سعر شراء أصلي إلها أعلى بـ5% أو أكتر من الشراء اللي قبله — راجع المورّد أو قارن بغيره (ℹ️ بالفاتورة ⇐ 🏆 مقارنة الموردين).</div>' +
        table(['المنتج', 'كان', 'صار', 'الزيادة', 'من ⇐ إلى'], R.rises.map(function (x) { return '<tr><td ' + TD + '>' + esc(x.name) + '</td><td ' + TD + '>' + x.prev + '</td><td style="padding:5px 6px;border-bottom:1px solid #f1f5f9;font-weight:900">' + x.last + '</td><td style="padding:5px 6px;border-bottom:1px solid #f1f5f9;font-weight:900;color:#b91c1c">+' + x.pct + '%</td><td style="padding:5px 6px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#475569">' + esc(x.prevInv) + (x.prevSup && x.prevSup !== x.lastSup ? ' (' + esc(x.prevSup) + ')' : '') + ' ⇐ ' + esc(x.lastInv) + (x.lastSup ? ' (' + esc(x.lastSup) + ')' : '') + '</td></tr>'; }));
    var sel = function (name, opts, val) { return '<select data-pr-f="' + name + '" style="border:1.5px solid #e5e7eb;border-radius:10px;padding:6px 8px;font:inherit;font-size:12.5px;font-weight:800;background:#fff">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val || '') ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><div style="flex:1;font-weight:900;font-size:16px">📈 تقارير المشتريات</div>' +
      '<button data-pr-csv style="border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:6px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer">⬇️ CSV</button><button data-pr-x style="border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:6px 10px;font:inherit;font-weight:900;cursor:pointer">✕</button></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' +
      sel('months', [[3, 'آخر 3 أشهر'], [6, 'آخر 6 أشهر'], [12, 'آخر سنة'], ['', 'كلّ الفترة']], st.months) +
      sel('type', [['', 'كلّ الأنواع'], ['china', TYPE.china], ['germany', TYPE.germany], ['instant', TYPE.instant]], st.type) +
      sel('supplier', [['', 'كلّ الموردين']].concat(sups.map(function (s) { return [s, s]; })), st.supplier) + '</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">' + tabs.map(function (t) { return '<button data-pr-tab="' + t[0] + '" style="border:0;border-radius:999px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:900;cursor:pointer;background:' + (st.tab === t[0] ? '#0f1219;color:#fff' : '#f1f5f9;color:#334155') + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div data-pr-body>' + body + '</div>' +
      '<div style="font-size:10.5px;color:#94a3b8;margin-top:10px">القيمة = سعر الشراء الأصلي من المورّد × الكمية · التكاليف من خانات الفاتورة · الملغاة ما بتدخل.</div>';
  }
  function open(getInvoices, o) {
    o = o || {};
    var old = document.querySelector('[data-poreports]'); if (old) old.remove();
    var w = document.createElement('div'); w.setAttribute('data-poreports', '');
    w.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(15,18,25,.55);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    var box = document.createElement('div'); box.dir = 'rtl';
    box.style.cssText = 'background:#fff;border-radius:16px;padding:14px;width:100%;max-width:880px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:inherit';
    w.appendChild(box); document.body.appendChild(w);
    var st = { months: o.months == null ? 12 : o.months, type: '', supplier: '', tab: 'sum' };
    var inv = function () { return (typeof getInvoices === 'function' ? getInvoices() : getInvoices) || []; };
    var sups = function () { var m = {}; inv().forEach(function (x) { var c = canonSup(x), k = supKey(c); if (k && !m[k]) m[k] = c; }); return Object.keys(m).map(function (k) { return m[k]; }).sort(); };
    var R;
    function paint() { R = build(inv(), { months: st.months ? Number(st.months) : 0, type: st.type, supplier: st.supplier }); box.innerHTML = render(R, st, sups()); }
    paint();
    w.addEventListener('click', function (e) {
      if (e.target === w || e.target.closest('[data-pr-x]')) { w.remove(); return; }
      var t = e.target.closest('[data-pr-tab]'); if (t) { st.tab = t.getAttribute('data-pr-tab'); paint(); return; }
      var s = e.target.closest('[data-pr-sup]'); if (s) { e.preventDefault(); st.supplier = s.getAttribute('data-pr-sup'); st.tab = 'sum'; paint(); return; }
      if (e.target.closest('[data-pr-csv]')) {
        var b = new Blob([csv(R)], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
        a.href = URL.createObjectURL(b); a.download = 'تقرير_المشتريات_' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }
    });
    w.addEventListener('change', function (e) { var f = e.target.closest('[data-pr-f]'); if (f) { st[f.getAttribute('data-pr-f')] = f.value; paint(); } });
    return w;
  }
  g.GMTPoReports = { build: build, csv: csv, open: open };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTPoReports;
})(typeof window !== 'undefined' ? window : globalThis);
