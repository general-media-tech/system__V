/* ═════════════════════════════════════════════════════════════════════
   gmt-carrierstmt.js — كشف شركات الشحن (TASK-B0554 · المالك seq B1041 «ملفّ الأوردرات ناقصه كتير: مرتجعات والكشوفات والأجور»
   · طابور Q3 «تحديث شامل للأوردرات» · seq B1089)
   «شو عند الشركة إلنا؟» — لكلّ شركة وفترة: شُحن · بالطريق · وصل وبانتظار التحصيل (مالنا عندهم) · تمّ التحصيل · مرتجعات وأجورها · أجور الشحن.
   قراءة فقط: ما بيغيّر أوردر ولا بيلمس مال.

   GMTCarrierStmt.build(orders, { company, from, to }) ⇒ { companies:[{ name, n, amount, transit, awaiting, collected, returned, retFees, fees, rows }], totals }  (صافٍ)
   GMTCarrierStmt.feeOf(order) ⇒ أجور الشحن المكتوبة بالملاحظات (بلا عمود — كما يحفظها orders.html)
   GMTCarrierStmt.open(orders)
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTCarrierStmt) return;
  var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var TRANSIT = { shipped: 1, arrived: 1, got: 1 };
  function amountOf(o) { var c = o.collect_amount; return r2(c != null && c !== '' ? c : o.price); }
  /* «أجور شحن مضافة على …: $3» أو «أجور شحن ضمن الإجمالي: $3» */
  function feeOf(o) { var m = String(o.notes || '').match(/أجور شحن[^$\n]*\$\s*([\d.]+)/); return m ? r2(m[1]) : 0; }
  function retInfo(o) { var ri = o.return_info; if (typeof ri === 'string') { try { ri = JSON.parse(ri); } catch (_) { ri = null; } } return ri || null; }
  function retFeesOf(o) {
    var ri = retInfo(o); if (!ri) return 0;
    var one = function (x) { return x ? (Number(x.total) || (Number(x.ship_out) || 0) + (Number(x.ship_back) || 0)) : 0; };
    return r2(one(ri) + (Array.isArray(ri.history) ? ri.history.reduce(function (s, x) { return s + one(x); }, 0) : 0));
  }
  function bucket(o) {
    var ri = retInfo(o);
    if (o.status === 'returned' || (ri && ri.stage && !ri.closed_at && o.status !== 'completed')) return 'returned';
    if (TRANSIT[o.status]) return 'transit';
    if (o.status === 'delivered') return 'awaiting';
    if (o.status === 'completed') return 'collected';
    return 'other';
  }
  var BL = { transit: '🚚 بالطريق', awaiting: '💰 وصل — بانتظار التحصيل', collected: '✅ تمّ التحصيل', returned: '↩️ مرتجع', other: 'قبل الشحن' };
  function build(orders, opt) {
    opt = opt || {};
    var from = opt.from ? new Date(opt.from).getTime() : -Infinity, to = opt.to ? new Date(opt.to).getTime() : Infinity, C = {};
    (orders || []).forEach(function (o) {
      if (!o || o.is_deleted || !o.shipping_company) return;
      if (opt.company && o.shipping_company !== opt.company) return;
      var t = new Date(o.shipped_at || o.created_at || 0).getTime(); if (!(t >= from && t <= to)) return;
      var b = bucket(o); if (b === 'other') return;
      var c = C[o.shipping_company] || (C[o.shipping_company] = { name: o.shipping_company, n: 0, amount: 0, transit: 0, awaiting: 0, collected: 0, returned: 0, retFees: 0, fees: 0, rows: [] });
      var a = amountOf(o), f = feeOf(o), rf = retFeesOf(o);
      c.n++; c.amount = r2(c.amount + a); c.fees = r2(c.fees + f); c.retFees = r2(c.retFees + rf);
      if (b === 'transit') c.transit = r2(c.transit + a); else if (b === 'awaiting') c.awaiting = r2(c.awaiting + a); else if (b === 'collected') c.collected = r2(c.collected + a); else c.returned++;
      c.rows.push({ id: o.id, serial: o.serial_code || o.order_number || ('#' + o.id), name: o.name || '', tracking: o.tracking_number || '', at: String(o.shipped_at || o.created_at || '').slice(0, 10), amount: a, fee: f, retFee: rf, bucket: b });
    });
    var companies = Object.keys(C).map(function (k) { var c = C[k]; c.rows.sort(function (x, y) { return x.at < y.at ? 1 : -1; }); return c; }).sort(function (a, b) { return b.awaiting - a.awaiting || b.amount - a.amount; });
    var totals = companies.reduce(function (t, c) { ['n', 'amount', 'transit', 'awaiting', 'collected', 'returned', 'retFees', 'fees'].forEach(function (k) { t[k] = r2((t[k] || 0) + c[k]); }); return t; }, {});
    return { companies: companies, totals: totals };
  }
  function csv(c) {
    var head = ['الأوردر', 'الزبون', 'رقم التتبّع', 'تاريخ الشحن', 'المبلغ $', 'أجور الشحن $', 'أجور المرتجع $', 'الحالة'];
    return '﻿' + [head.join(',')].concat(c.rows.map(function (r) { return [r.serial, r.name, r.tracking, r.at, r.amount, r.fee, r.retFee, BL[r.bucket]].map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); })).join('\n');
  }
  function period(k) {
    var d = new Date(), y = d.getFullYear(), m = d.getMonth();
    if (k === 'this') return { from: new Date(y, m, 1).toISOString(), to: null };
    if (k === 'last') return { from: new Date(y, m - 1, 1).toISOString(), to: new Date(y, m, 1, 0, 0, -1).toISOString() };
    return { from: null, to: null };
  }
  function open(orders) {
    var st = { company: '', per: 'all' }, old = document.getElementById('gmt-carrier'); if (old) old.remove();
    var w = document.createElement('div'); w.id = 'gmt-carrier'; w.setAttribute('data-keep-fab', '1');
    w.style.cssText = 'position:fixed;inset:0;z-index:9600;background:rgba(15,18,25,.5);display:flex;align-items:flex-start;justify-content:center;padding:3vh 10px;overflow:auto;direction:rtl;font-family:inherit';
    w.setAttribute('data-gmt-modal', '');   /* زرّ رجوع الهاتف بيسكّرها (الملحق «ح» ١ · seq B1117) */
    document.body.appendChild(w);
    var all = build(orders, {}).companies.map(function (c) { return c.name; });
    function paint() {
      var p = period(st.per), R = build(orders, { company: st.company, from: p.from, to: p.to }), T = R.totals;
      var card = function (k, v, col) { return '<div style="flex:1;min-width:120px;background:#f8fafc;border-radius:12px;padding:7px 10px"><div style="font-size:11px;color:#64748b;font-weight:800">' + k + '</div><b dir="ltr" style="font-size:15px;' + (col ? 'color:' + col : '') + '">' + v + '</b></div>'; };
      var chip = function (attr, val, label, on) { return '<button type="button" ' + attr + '="' + esc(val) + '" style="border:1.5px solid ' + (on ? '#0f1219' : '#e5e7eb') + ';background:' + (on ? '#0f1219' : '#fff') + ';color:' + (on ? '#fff' : '#0f1219') + ';border-radius:99px;padding:5px 11px;font:inherit;font-size:12px;font-weight:800;cursor:pointer">' + esc(label) + '</button>'; };
      w.innerHTML = '<div style="background:#fff;border-radius:18px;width:100%;max-width:900px;padding:14px">' +
        '<div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:16px">📑 كشف شركات الشحن</b><button type="button" data-cs-x style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:5px 10px;font:inherit;font-weight:800;cursor:pointer">✕</button></div>' +
        '<div style="font-size:12px;color:#64748b;margin:2px 0 8px">«شو عند الشركة إلنا؟» — قراءة فقط، ما بيغيّر شي. قارنه بكشف الشركة.</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' + chip('data-cs-co', '', 'كلّ الشركات', !st.company) + all.map(function (n) { return chip('data-cs-co', n, n, st.company === n); }).join('') + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' + [['all', 'الكلّ'], ['this', 'هالشهر'], ['last', 'الشهر الماضي']].map(function (x) { return chip('data-cs-per', x[0], x[1], st.per === x[0]); }).join('') + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">' + card('💰 عند الشركة إلنا (وصل — بانتظار التحصيل)', (T.awaiting || 0).toFixed(2) + '$', '#b45309') + card('🚚 بالطريق', (T.transit || 0).toFixed(2) + '$') + card('✅ تمّ التحصيل', (T.collected || 0).toFixed(2) + '$', '#15803d') +
          card('↩️ مرتجعات · أجورها', (T.returned || 0) + ' · ' + (T.retFees || 0).toFixed(2) + '$', '#b91c1c') + card('🚚 أجور الشحن المضافة', (T.fees || 0).toFixed(2) + '$') + card('📦 أوردرات', (T.n || 0) + ' · ' + (T.amount || 0).toFixed(2) + '$') + '</div>' +
        (R.companies.length ? R.companies.map(function (c) {
          return '<div style="border:1px solid #e5e7eb;border-radius:14px;padding:10px;margin-top:8px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="flex:1;font-size:14.5px">🚚 ' + esc(c.name) + '</b>' +
            '<span style="font-size:12px;font-weight:800;color:#b45309">عندهم إلنا ' + c.awaiting.toFixed(2) + '$</span><button type="button" data-cs-print="' + esc(c.name) + '" style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:4px 9px;font:inherit;font-size:12px;font-weight:800;cursor:pointer">🖨️</button><button type="button" data-cs-csv="' + esc(c.name) + '" style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:4px 9px;font:inherit;font-size:12px;font-weight:800;cursor:pointer">⬇️ Excel</button></div>' +
            '<div style="font-size:12px;color:#475569;margin-top:2px">' + c.n + ' أوردر · بالطريق ' + c.transit.toFixed(2) + '$ · تمّ التحصيل ' + c.collected.toFixed(2) + '$ · مرتجع ' + c.returned + ' (أجور ' + c.retFees.toFixed(2) + '$) · أجور شحن ' + c.fees.toFixed(2) + '$</div>' +
            '<div style="max-height:260px;overflow:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9"><th style="padding:4px;text-align:right">الأوردر</th><th style="text-align:right">الزبون</th><th>الشحن</th><th>المبلغ</th><th>الحالة</th></tr>' +
            c.rows.map(function (r) { return '<tr data-cs-row="' + esc(r.id) + '" style="border-bottom:1px solid #f1f5f9"><td style="padding:4px" dir="ltr">' + esc(r.serial) + '</td><td>' + esc(r.name) + '</td><td style="text-align:center">' + esc(r.at) + '</td><td style="text-align:center">' + r.amount.toFixed(2) + (r.fee ? ' <span style="color:#64748b">(+' + r.fee + ')</span>' : '') + '</td><td style="text-align:center">' + BL[r.bucket] + '</td></tr>'; }).join('') + '</table></div></div>';
        }).join('') : '<div style="text-align:center;color:#64748b;padding:18px">ما في أوردرات مشحونة بهالفترة.</div>') + '</div>';
      w._R = R;
    }
    w.addEventListener('click', function (e) {
      if (e.target === w || e.target.closest('[data-cs-x]')) { w.remove(); return; }
      var b;
      if ((b = e.target.closest('[data-cs-co]'))) { st.company = b.getAttribute('data-cs-co'); paint(); return; }
      if ((b = e.target.closest('[data-cs-per]'))) { st.per = b.getAttribute('data-cs-per'); paint(); return; }
      var co = function (attr) { var n = b.getAttribute(attr); return (w._R.companies || []).find(function (c) { return c.name === n; }); };
      if ((b = e.target.closest('[data-cs-csv]'))) { var c = co('data-cs-csv'); if (!c) return; var bl = new Blob([csv(c)], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'كشف-' + c.name + '-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove(); return; }
      if ((b = e.target.closest('[data-cs-print]'))) { var c2 = co('data-cs-print'); if (!c2) return; var ww = window.open('', '_blank'); if (!ww) return;
        ww.document.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف ' + esc(c2.name) + '</title><style>body{font-family:Tahoma,sans-serif;padding:18px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #ddd;padding:5px}</style></head><body><h2>كشف شركة الشحن: ' + esc(c2.name) + '</h2><p>' + new Date().toLocaleDateString('ar-SY') + ' · ' + c2.n + ' أوردر · عندهم إلنا ' + c2.awaiting.toFixed(2) + '$ · بالطريق ' + c2.transit.toFixed(2) + '$ · تمّ التحصيل ' + c2.collected.toFixed(2) + '$ · مرتجع ' + c2.returned + '</p><table><tr><th>الأوردر</th><th>الزبون</th><th>التتبّع</th><th>الشحن</th><th>المبلغ</th><th>أجور</th><th>الحالة</th></tr>' +
          c2.rows.map(function (r) { return '<tr><td>' + esc(r.serial) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.tracking) + '</td><td>' + esc(r.at) + '</td><td>' + r.amount.toFixed(2) + '</td><td>' + (r.fee || '') + '</td><td>' + BL[r.bucket] + '</td></tr>'; }).join('') + '</table><script>print()<\/script></body></html>'); ww.document.close(); return; }
    });
    paint();
    return w;
  }
  g.GMTCarrierStmt = { build: build, feeOf: feeOf, retFeesOf: retFeesOf, bucket: bucket, csv: csv, open: open };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTCarrierStmt;
})(typeof window !== 'undefined' ? window : globalThis);
