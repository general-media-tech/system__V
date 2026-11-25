/* ═════════════════════════════════════════════════════════════════════
   gmt-porecords.js — سجلّات المشتريات الموحّدة (P2 · A1004 · الخطّة 1.4 · طابور Q1 · seq B1078)
   «بحث واحد (رقم · مورّد · منتج · باركود · شحنة · دفعة) · فلاتر مدموجة محفوظة · فرز · تصدير» — كان السجلّ جدولين منفصلين
   (استيراد / فوري) بفلتر نوع وحالة بس.

   GMTPoRecords.query(ships, pays, opt) ⇒ [{ p, s, why }]   (حساب صافٍ يُختبر بلا متصفّح)
     opt = { q, f: 'all'|'transit'|'arrived'|'instant'|'owed'|'due'|'gaps'|'nosup', sort: 'new'|'old'|'value'|'owed' }
   GMTPoRecords.mount(host, { ships(), onOpen(id, kind), onPay(id) })   — الواجهة بتبويب «سجل»
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTPoRecords) return;
  var LS = 'gmt_porec_v1';
  function arr(v) { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return []; } } return Array.isArray(v) ? v : []; }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ًٌٍَُِّْـ]/g, '').replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x660; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sumOf(p, pays) {
    if (g.GMTPoPay && GMTPoPay.summary) return GMTPoPay.summary(p, pays || []);
    var v = Number(p.total_amount) || 0, c = p.cash_payment == null || p.cash_payment === '' ? v : Number(p.cash_payment) || 0;
    return { value: v, paid: c, remaining: Math.max(0, v - c), status: c >= v ? 'paid' : (c > 0 ? 'partial' : 'unpaid'), overdue: false };
  }
  /* لماذا طابقت؟ — أوّل حقل فيه كلّ الكلمات (يُعرض تحت السطر) */
  function matchWhy(p, pays, words) {
    if (!words.length) return '';
    var fields = [['رقم', p.inv_number], ['مورّد', p.supplier], ['شحن', [p.shipping_company, p.tracking_number].join(' ')], ['ملاحظة', p.shipping_notes]];
    arr(p.items_snapshot).forEach(function (it) { if (it) fields.push(['منتج', [it.name, it.barcode, it.model].filter(Boolean).join(' ')]); });
    (pays || []).forEach(function (x) { if (x && !x.voided) fields.push(['دفعة', [x.ref_no, x.note, x.paid_by].filter(Boolean).join(' ')]); });
    var all = norm(fields.map(function (f) { return f[1] || ''; }).join(' '));
    if (!words.every(function (w) { return all.indexOf(w) >= 0; })) return null;
    for (var i = 0; i < fields.length; i++) { var t = norm(fields[i][1]); if (t && words.some(function (w) { return t.indexOf(w) >= 0; })) return fields[i][0] + ': ' + String(fields[i][1]).slice(0, 60); }
    return '';
  }
  function gaps(p) { return arr(p.items_snapshot).some(function (x) { return x && Number(x.qty) > 0 && (!(Number(x.unit_price) > 0) || !x.id); }); }
  function query(ships, payOf, opt) {
    opt = opt || {};
    var words = norm(opt.q || '').trim().split(/\s+/).filter(Boolean), f = opt.f || 'all';
    var out = [];
    (ships || []).forEach(function (p) {
      if (!p || /cancel/i.test(p.status || '')) return;
      var pays = typeof payOf === 'function' ? payOf(p.id) : [];
      var why = matchWhy(p, pays, words); if (why === null) return;
      var s = sumOf(p, pays), inst = p.inv_type === 'instant';
      if (f === 'transit' && (inst || p.status === 'arrived')) return;
      if (f === 'arrived' && (inst || p.status !== 'arrived')) return;
      if (f === 'instant' && !inst) return;
      if (f === 'owed' && !(s.remaining > 0.005)) return;
      if (f === 'due' && !s.overdue) return;
      if (f === 'gaps' && !gaps(p)) return;
      if (f === 'nosup' && String(p.supplier || '').trim()) return;
      out.push({ p: p, s: s, why: why });
    });
    var t = function (x) { return new Date(x.p.inv_date || x.p.created_at || 0).getTime() || 0; };
    var srt = { 'new': function (a, b) { return t(b) - t(a); }, old: function (a, b) { return t(a) - t(b); }, value: function (a, b) { return b.s.value - a.s.value; }, owed: function (a, b) { return b.s.remaining - a.s.remaining; } }[opt.sort || 'new'];
    out.sort(srt);
    return out;
  }
  function totals(rows) { return rows.reduce(function (a, x) { a.value += x.s.value; a.paid += x.s.paid; a.remaining += x.s.remaining; a.qty += arr(x.p.items_snapshot).reduce(function (q, i) { return q + (Number(i && i.qty) || 0); }, 0); return a; }, { value: 0, paid: 0, remaining: 0, qty: 0 }); }
  function csv(rows) {
    var head = ['الرقم', 'النوع', 'المورّد', 'التاريخ', 'الحالة', 'القيمة $', 'المدفوع $', 'الباقي $', 'البنود', 'القطع'];
    var lines = rows.map(function (x) { var p = x.p, it = arr(p.items_snapshot);
      return [p.inv_number || '', p.inv_type || '', p.supplier || '', (p.inv_date || '').slice(0, 10), p.status || '', x.s.value.toFixed(2), x.s.paid.toFixed(2), x.s.remaining.toFixed(2), it.length, it.reduce(function (q, i) { return q + (Number(i && i.qty) || 0); }, 0)]
        .map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); });
    return '﻿' + [head.join(',')].concat(lines).join('\n');
  }

  /* ── الواجهة ── */
  var FL = [['all', 'الكلّ'], ['transit', '🚢 بالطريق'], ['arrived', '✅ واصلة'], ['instant', '⚡ فورية'], ['owed', '💳 باقي للمورّد'], ['due', '⏰ مستحقّة'], ['gaps', '⚠️ فيها نقص'], ['nosup', 'بلا مورّد']];
  var SR = [['new', 'الأحدث'], ['old', 'الأقدم'], ['value', 'الأعلى قيمة'], ['owed', 'الأكبر باقي']];
  var ST = { transit: '🚢 بالطريق', arrived: '✅ واصلة' }, TY = { instant: '⚡ فوري', china: '🇨🇳 صين', germany: '🇩🇪 ألمانيا' };
  function mount(host, o) {
    if (!host) return null;
    var st = { q: '', f: 'all', sort: 'new' }; try { var sv = JSON.parse(localStorage.getItem(LS) || 'null'); if (sv) st = Object.assign(st, sv); } catch (_) {}
    host.innerHTML = '<div data-porec style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:12px;margin-bottom:14px">' +
      '<div style="font-weight:900;font-size:14px;margin-bottom:8px">🔎 بحث موحّد بكلّ المشتريات</div>' +
      '<input data-pr-q placeholder="رقم فاتورة · مورّد · اسم منتج · باركود · رقم تتبّع شحنة · رقم إيصال دفعة…" style="width:100%;border:1.5px solid #e5e7eb;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px">' +
      '<div data-pr-f style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + FL.map(function (x) { return '<button type="button" data-f="' + x[0] + '" style="border:1.5px solid #e5e7eb;background:#fff;border-radius:99px;padding:5px 11px;font:inherit;font-size:12px;font-weight:800;cursor:pointer">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><select data-pr-sort style="border:1.5px solid #e5e7eb;border-radius:10px;padding:6px 9px;font:inherit;font-size:12.5px">' + SR.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('') + '</select>' +
      '<span data-pr-tot style="font-size:12px;font-weight:800;color:#334155;flex:1"></span><button type="button" data-pr-csv style="border:1.5px solid #e5e7eb;background:#fff;border-radius:10px;padding:6px 11px;font:inherit;font-size:12px;font-weight:800;cursor:pointer">⬇️ تصدير Excel</button></div>' +
      '<div data-pr-res style="margin-top:8px;max-height:520px;overflow:auto"></div></div>';
    var $ = function (s) { return host.querySelector(s); }, last = [];
    function draw() {
      try { localStorage.setItem(LS, JSON.stringify(st)); } catch (_) {}
      host.querySelectorAll('[data-pr-f] [data-f]').forEach(function (b) { var on = b.getAttribute('data-f') === st.f; b.style.background = on ? '#0f1219' : '#fff'; b.style.color = on ? '#fff' : 'inherit'; });
      $('[data-pr-sort]').value = st.sort;
      last = query(o.ships(), g.GMTPoPay ? GMTPoPay.of : null, st);
      var tt = totals(last);
      $('[data-pr-tot]').textContent = last.length + ' فاتورة · القيمة ' + tt.value.toFixed(2) + '$ · المدفوع ' + tt.paid.toFixed(2) + '$ · الباقي ' + tt.remaining.toFixed(2) + '$ · ' + tt.qty + ' قطعة';
      $('[data-pr-res]').innerHTML = last.length ? last.slice(0, 300).map(function (x) { var p = x.p, s = x.s, it = arr(p.items_snapshot);
        return '<div data-pr-row="' + esc(p.id) + '" style="border:1px solid #eef1f5;border-radius:12px;padding:8px 10px;margin-top:6px;font-size:12.5px;font-weight:700;cursor:pointer;' + (s.overdue ? 'background:#fef2f2;' : '') + '">' +
          '<b>' + esc(p.inv_number || '#' + p.id) + '</b> · ' + esc(TY[p.inv_type] || p.inv_type || '') + ' · ' + esc(p.supplier || 'بلا مورّد') + ' · ' + esc((p.inv_date || String(p.created_at || '')).slice(0, 10)) +
          (p.inv_type !== 'instant' ? ' · ' + esc(ST[p.status] || p.status || '') : '') +
          '<div style="color:#475569">القيمة ' + s.value.toFixed(2) + '$ · ' + (s.remaining > 0.005 ? '<b style="color:#b91c1c">باقي ' + s.remaining.toFixed(2) + '$</b>' : '✅ مدفوعة') + (s.overdue ? ' ⏰' : '') + ' · ' + it.length + ' بند' +
          (p.inv_type !== 'instant' ? ' <button type="button" data-pr-pay="' + esc(p.id) + '" style="border:0;background:#ecfdf5;color:#047857;border-radius:8px;padding:2px 8px;font:inherit;font-size:11.5px;font-weight:900;cursor:pointer">💳</button>' : '') + '</div>' +
          (x.why ? '<div style="color:#64748b;font-size:11.5px">↳ ' + esc(x.why) + '</div>' : '') + '</div>'; }).join('')
        : '<div style="text-align:center;color:#64748b;padding:16px">ما في نتائج.</div>';
    }
    $('[data-pr-q]').value = st.q;
    $('[data-pr-q]').addEventListener('input', function () { st.q = this.value; draw(); });
    $('[data-pr-sort]').addEventListener('change', function () { st.sort = this.value; draw(); });
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pr-f] [data-f]'); if (b) { st.f = b.getAttribute('data-f'); draw(); return; }
      var pay = e.target.closest('[data-pr-pay]'); if (pay) { e.stopPropagation(); if (o.onPay) o.onPay(pay.getAttribute('data-pr-pay')); return; }
      if (e.target.closest('[data-pr-csv]')) { var bl = new Blob([csv(last)], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'مشتريات-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove(); return; }
      var r = e.target.closest('[data-pr-row]'); if (r && o.onOpen) { var p = (o.ships() || []).find(function (x) { return String(x.id) === r.getAttribute('data-pr-row'); }); if (p) o.onOpen(p.id, p.inv_type); }
    });
    draw();
    return { draw: draw, state: st };
  }
  g.GMTPoRecords = { query: query, totals: totals, csv: csv, mount: mount, matchWhy: matchWhy };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTPoRecords;
})(typeof window !== 'undefined' ? window : globalThis);
