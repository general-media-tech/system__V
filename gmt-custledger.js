/* ═════════════════════════════════════════════════════════════════════
   gmt-custledger.js — الحساب الجاري للعميل الدائم (كشف حساب · سند قبض · رصيد)
   TASK-B0533 · المالك seq B1045: «سجل لعملاء شراء دائمين مثل بلال بكور … بالدين …
   يبحث بالفواتير … نظامنا يفتقر الى اقل مقومات برامج المحاسبة».

   القاعدة (docs/دراسة_المحاسبة_والعملاء_الدائمين.md §٣):
     • العميل الدائم = صفّ gmt_customers (is_regular · credit_limit) — لا جدول عملاء جديد.
     • الرصيد **مشتقّ لا مخزَّن**: ما بقي على فواتيره (remaining_amount) − سندات القبض غير المُلغاة
       − مرتجعات فواتير الدين ⇒ رقمٌ واحد لا يتناقض.
     • السند لا يُحذف أبداً — يُلغى بسببٍ مسجَّل (gmt_receipts.voided).
   الربط بالفواتير: رقم الهاتف (GMTPhone.norm = آخر الأرقام بلا بادئة).

   GMTCustLedger.statement(invoices, receipts) ⇒ { rows, balance, debit, credit }   (حسابٌ صافٍ · يُختبر بلا متصفّح)
   GMTCustLedger.load(customer) ⇒ { invoices, receipts, st }
   GMTCustLedger.open(customer)  ⇒ نافذة الكشف · قبض دفعة · إلغاء سند · بحث بالفواتير · طباعة
   GMTCustLedger.balance(customer) ⇒ الرصيد فقط (لنقطة البيع)
   ═════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n2(v) { var x = Number(v); return isFinite(x) ? Math.round(x * 100) / 100 : 0; }
  function norm(p) { return (global.GMTPhone && global.GMTPhone.norm) ? global.GMTPhone.norm(p) : String(p || '').replace(/\D/g, '').replace(/^(00963|963|0)/, ''); }
  /* السند بعملةٍ غير الدولار ⇒ يُحوَّل بسعر صرفه (المبلغ ÷ السعر) */
  function usdOf(r) {
    var a = Number(r.amount) || 0, cur = String(r.currency || 'USD').toUpperCase();
    if (cur === 'USD') return a;
    var x = Number(r.exchange_rate) || 0; return x > 0 ? a / x : 0;
  }

  /* ── الكشف: مدين (ما بقي على فاتورة) · دائن (سند · مرتجع فاتورة دين) · رصيد متراكم بالتاريخ ── */
  function statement(invoices, receipts) {
    var inv = (invoices || []).filter(function (i) { return i && !i.is_refund; });
    var byId = {}; inv.forEach(function (i) { byId[String(i.id)] = i; });
    var rows = [];
    inv.forEach(function (i) {
      var rem = n2(i.remaining_amount);
      if (rem > 0) rows.push({ at: i.created_at, kind: 'inv', ref: i.inv_number || i.invoice_number || String(i.id).slice(0, 8), id: i.id,
        text: 'فاتورة ' + (i.sale_type || '') + ' · المجموع ' + n2(i.total) + '$ · المدفوع ' + n2(i.paid_amount) + '$', debit: rem, credit: 0 });
    });
    /* مرتجع فاتورة دين ⇒ يُنقص الدين (لا الصندوق) بما لا يتجاوز ما بقي عليها */
    (invoices || []).filter(function (i) { return i && i.is_refund && i.original_invoice_id && byId[String(i.original_invoice_id)]; }).forEach(function (r) {
      var o = byId[String(r.original_invoice_id)], cap = n2(o.remaining_amount), amt = Math.min(Math.abs(n2(r.total)), cap);
      if (amt > 0) rows.push({ at: r.created_at, kind: 'ret', ref: r.inv_number || String(r.id).slice(0, 8), id: r.id, text: 'مرتجع على الفاتورة ' + (o.inv_number || ''), debit: 0, credit: n2(amt) });
    });
    (receipts || []).filter(function (r) { return r && !r.voided; }).forEach(function (r) {
      var u = n2(usdOf(r)), cur = String(r.currency || 'USD').toUpperCase();
      rows.push({ at: r.created_at, kind: 'rcpt', ref: 'سند', id: r.id,
        text: 'قبض ' + ({ cash: 'نقداً', transfer: 'حوالة', other: '' }[r.method] || r.method || '') + (cur !== 'USD' ? ' · ' + n2(r.amount) + ' ' + cur + ' بسعر ' + r.exchange_rate : '') + (r.note ? ' · ' + r.note : '') + (r.received_by ? ' · ' + r.received_by : ''),
        debit: 0, credit: u });
    });
    rows.sort(function (a, b) { return new Date(a.at || 0) - new Date(b.at || 0); });
    var bal = 0, debit = 0, credit = 0;
    rows.forEach(function (r) { bal = n2(bal + r.debit - r.credit); debit = n2(debit + r.debit); credit = n2(credit + r.credit); r.balance = bal; });
    return { rows: rows, balance: bal, debit: debit, credit: credit };
  }

  /* ── القاعدة ── */
  function db() {
    var D = global.GMT_DB || {}, M = D.MAIN || {};
    var url = M.url || global.SUPABASE_URL || (global.CONFIG && global.CONFIG.SUPABASE_URL) || '';
    var key = M.key || global.SUPABASE_ANON_KEY || (global.CONFIG && global.CONFIG.SUPABASE_KEY) || '';
    return { url: url, key: key };
  }
  async function rest(method, path, body, prefer) {
    var d = db(); if (!d.url) throw new Error('لا اتصال بالقاعدة');
    var h = { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' };
    if (prefer) h.Prefer = prefer;
    var r = await fetch(d.url + '/rest/v1/' + path, { method: method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (_) {} throw new Error('HTTP ' + r.status + (t ? ': ' + t.slice(0, 160) : '')); }
    if (r.status === 204) return null;
    var tx = await r.text(); return tx ? JSON.parse(tx) : null;
  }
  async function load(c) {
    var k = norm(c && c.phone);
    /* الهاتف بالفواتير بصيغٍ شتّى («+963 944 555 666» · «0944555666» · «944-555-666») ⇒ نمطٌ يسمح بأيّ فاصل بين الأرقام ثمّ مطابقةٌ دقيقة بـnorm */
    var pat = '*' + k.split('').join('*');
    var invoices = k.length >= 6 ? (await rest('GET', 'invoices?customer_phone=ilike.' + encodeURIComponent(pat) + '&select=id,inv_number,invoice_number,created_at,total,paid_amount,remaining_amount,payment_status,sale_type,is_refund,original_invoice_id,branch_key,branch_name,items_json,customer_name,customer_phone&order=created_at.asc&limit=2000') || []) : [];
    invoices = invoices.filter(function (i) { return norm(i.customer_phone) === k; });   /* ilike قد يطابق ذيلاً أطول */
    var receipts = c && c.id ? (await rest('GET', 'gmt_receipts?customer_id=eq.' + encodeURIComponent(c.id) + '&order=created_at.asc&limit=2000') || []) : [];
    return { invoices: invoices, receipts: receipts, st: statement(invoices, receipts) };
  }
  async function balance(c) { try { return (await load(c)).st.balance; } catch (_) { return null; } }
  function who() { try { return (global.GMTRole && GMTRole.name && GMTRole.name()) || localStorage.getItem('gmt_operator_name') || 'الأدمن'; } catch (_) { return 'الأدمن'; } }

  async function addReceipt(c, branchKey) {
    if (!global.GMTAsk) return null;
    var v = await GMTAsk.form('سند قبض من «' + (c.name || '') + '» — يُنقص دينه ويدخل الصندوق.', { title: '📥 قبض دفعة', icon: 'edit', okText: 'سجّل السند',
      fields: [{ k: 'amount', label: 'المبلغ', type: 'number', placeholder: '0' },
        { k: 'currency', label: 'العملة', options: [{ v: 'USD', t: 'دولار $' }, { v: 'SYP', t: 'ليرة سورية' }] },
        { k: 'rate', label: 'سعر الصرف (للّيرة فقط)', type: 'number', placeholder: 'مثلاً 11000' },
        { k: 'method', label: 'الطريقة', options: [{ v: 'cash', t: 'نقداً' }, { v: 'transfer', t: 'حوالة' }, { v: 'other', t: 'أخرى' }] },
        { k: 'note', label: 'ملاحظة', placeholder: 'اختياري' }],
      submit: function (x) {
        if (!(Number(x.amount) > 0)) return { error: 'اكتب مبلغاً أكبر من صفر', field: 'amount' };
        if (x.currency !== 'USD' && !(Number(x.rate) > 0)) return { error: 'اكتب سعر الصرف لليرة', field: 'rate' };
        return true;
      } });
    if (!v) return null;
    var row = { customer_id: c.id, customer_name: c.name || null, customer_phone: c.phone || null, amount: Number(v.amount), currency: v.currency || 'USD',
      exchange_rate: v.currency !== 'USD' ? Number(v.rate) : null, method: v.method || 'cash', note: v.note || null, branch_key: branchKey || c.branch_key || null, received_by: who(), voided: false };
    var res = await rest('POST', 'gmt_receipts', row, 'return=representation');
    try { global.GMTAudit && GMTAudit.log({ action: 'receipt_add', entity: 'gmt_receipts', entityId: String((res && res[0] && res[0].id) || ''), entityName: c.name || '', newValue: row.amount + ' ' + row.currency }); } catch (_) {}
    return res && res[0];
  }
  async function voidReceipt(id) {
    if (!global.GMTAsk) return false;
    var why = await GMTAsk.prompt('سبب إلغاء السند (يبقى مسجَّلاً للتدقيق ولا يُحذف):', { title: 'إلغاء سند قبض' });
    if (!why || !String(why).trim()) return false;
    await rest('PATCH', 'gmt_receipts?id=eq.' + encodeURIComponent(id) + '&voided=is.false', { voided: true, voided_at: new Date().toISOString(), voided_by: who(), void_reason: String(why).trim() }, 'return=minimal');
    try { global.GMTAudit && GMTAudit.log({ action: 'receipt_void', entity: 'gmt_receipts', entityId: String(id), reason: String(why).trim() }); } catch (_) {}
    return true;
  }
  async function setRegular(c) {
    if (!global.GMTAsk) return null;
    var v = await GMTAsk.form('العميل الدائم يُفتح له حساب جارٍ: فواتيره الآجلة تُسجَّل ديناً، وتقبض منه دفعات متى شاء.', { title: '⭐ عميل دائم', okText: 'احفظ',
      fields: [{ k: 'reg', label: 'عميل دائم؟', options: [{ v: '1', t: 'نعم — عميل دائم بالدين' }, { v: '0', t: 'لا' }], value: c.is_regular ? '1' : '0' },
        { k: 'limit', label: 'حدّ الدين $ (اتركه فارغاً بلا حدّ)', type: 'number', value: c.credit_limit == null ? '' : c.credit_limit }] });
    if (!v) return null;
    var patch = { is_regular: v.reg === '1', credit_limit: v.limit === '' || v.limit == null ? null : Number(v.limit) };
    await rest('PATCH', 'gmt_customers?id=eq.' + encodeURIComponent(c.id), patch, 'return=minimal');
    Object.assign(c, patch); return patch;
  }

  /* ── النافذة ── */
  var CSS = '#gacc-ov{position:fixed;inset:0;z-index:9200;background:rgba(15,18,25,.6);display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto;direction:rtl;font-family:Cairo,sans-serif}' +
    '#gacc-ov .bx{background:#fff;border-radius:18px;width:100%;max-width:860px;margin:auto;overflow:hidden;box-shadow:0 24px 60px rgba(2,6,23,.3)}' +
    '#gacc-ov .hd{background:#0f1219;color:#fff;padding:14px 16px;border-bottom:3px solid #D5001C;display:flex;gap:10px;align-items:center;flex-wrap:wrap}' +
    '#gacc-ov .bd{padding:14px 16px}#gacc-ov table{width:100%;border-collapse:collapse;font-size:12px}#gacc-ov th{background:#f1f5f9;padding:6px;text-align:right;font-weight:900}' +
    '#gacc-ov td{padding:6px;border-bottom:1px solid #f1f5f9;vertical-align:top}#gacc-ov .num{white-space:nowrap;text-align:left;direction:ltr;font-weight:800}' +
    '#gacc-ov .btn{border:0;border-radius:10px;padding:7px 12px;font-family:inherit;font-weight:800;font-size:12px;cursor:pointer}' +
    '#gacc-ov .k{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:12px}#gacc-ov .k div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:8px;text-align:center}' +
    '#gacc-ov .k b{display:block;font-size:18px}#gacc-ov .k span{font-size:10.5px;color:#64748b;font-weight:800}';
  function ensureCss() { if (!doc || doc.getElementById('gacc-css')) return; var s = doc.createElement('style'); s.id = 'gacc-css'; s.textContent = CSS; doc.head.appendChild(s); }
  function invText(i) {
    var it = i.items_json; if (typeof it === 'string') { try { it = JSON.parse(it); } catch (_) { it = []; } }
    return (Array.isArray(it) ? it : []).map(function (x) { return (x && (x.name || x.product_name)) || ''; }).join(' · ');
  }
  async function open(c, opt) {
    opt = opt || {}; if (!doc || !c) return;
    ensureCss();
    var old = doc.getElementById('gacc-ov'); if (old) old.remove();
    var ov = doc.createElement('div'); ov.id = 'gacc-ov';
    ov.innerHTML = '<div class="bx"><div class="hd"><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900">📒 الحساب الجاري — ' + esc(c.name || '') + '</div>' +
      '<div style="font-size:11.5px;color:#cbd5e1" dir="ltr">' + esc(c.phone || '') + '</div></div>' +
      '<button class="btn" data-gacc-close style="background:rgba(255,255,255,.15);color:#fff">✕</button></div><div class="bd" id="gacc-bd">⏳ جارٍ تحميل الحساب…</div></div>';
    doc.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-gacc-close]')) ov.remove(); });
    var data;
    async function reload() {
      var bd = doc.getElementById('gacc-bd'); if (!bd) return;
      try { data = await load(c); } catch (e) { bd.innerHTML = '<div style="color:#b91c1c;font-weight:800">تعذّر تحميل الحساب: ' + esc(e.message) + '</div>'; return; }
      var st = data.st, lim = c.credit_limit == null ? null : Number(c.credit_limit), over = lim != null && st.balance > lim;
      bd.innerHTML =
        '<div class="k">' +
          '<div><span>الرصيد (عليه)</span><b data-gacc-bal style="color:' + (st.balance > 0 ? '#D5001C' : '#15803d') + '">' + st.balance.toFixed(2) + '$</b></div>' +
          '<div><span>مجموع الدين</span><b>' + st.debit.toFixed(2) + '$</b></div><div><span>المقبوض</span><b>' + st.credit.toFixed(2) + '$</b></div>' +
          '<div><span>حدّ الدين</span><b style="color:' + (over ? '#D5001C' : '#0f172a') + '">' + (lim == null ? '—' : lim.toFixed(2) + '$') + '</b>' + (over ? '<span style="color:#D5001C">⚠️ تجاوز الحدّ</span>' : '') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' +
          '<button class="btn" data-gacc-rcpt style="background:#15803d;color:#fff">📥 قبض دفعة</button>' +
          '<button class="btn" data-gacc-reg style="background:' + (c.is_regular ? '#0f172a;color:#fff' : '#f1f5f9;color:#0f172a') + '">⭐ ' + (c.is_regular ? 'عميل دائم' : 'اجعله عميلاً دائماً') + '</button>' +
          '<button class="btn" data-gacc-print style="background:#f1f5f9;color:#0f172a">🖨️ طباعة الكشف</button></div>' +
        '<div style="font-size:13px;font-weight:900;margin-bottom:6px">كشف الحساب</div>' +
        (st.rows.length ? '<div style="overflow-x:auto"><table data-gacc-st><thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th><th></th></tr></thead><tbody>' +
          st.rows.map(function (r) {
            return '<tr data-kind="' + r.kind + '"><td style="white-space:nowrap">' + esc(r.at ? new Date(r.at).toLocaleDateString('ar-SY') : '') + '</td><td><b dir="ltr">' + esc(r.ref) + '</b> ' + esc(r.text) + '</td>' +
              '<td class="num">' + (r.debit ? r.debit.toFixed(2) : '') + '</td><td class="num" style="color:#15803d">' + (r.credit ? r.credit.toFixed(2) : '') + '</td><td class="num">' + r.balance.toFixed(2) + '</td>' +
              '<td>' + (r.kind === 'rcpt' ? '<button class="btn" data-gacc-void="' + esc(r.id) + '" style="background:#fef2f2;color:#b91c1c;padding:3px 8px;font-size:11px">إلغاء</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div style="color:#64748b;font-weight:700;font-size:12px;padding:8px 0">لا دين ولا سندات بعد — فواتيره الآجلة والجزئية تظهر هنا ديناً، وسندات القبض تُنقصه.</div>') +
        '<div style="font-size:13px;font-weight:900;margin:14px 0 6px">🔎 فواتيره (' + data.invoices.length + ')</div>' +
        '<input data-gacc-q placeholder="ابحث برقم الفاتورة أو اسم منتج أو تاريخ…" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;font-family:inherit;margin-bottom:6px">' +
        '<div data-gacc-invs style="max-height:260px;overflow:auto;border:1px solid #f1f5f9;border-radius:10px"></div>';
      var paint = function (q) {
        q = String(q || '').trim().toLowerCase();
        var list = data.invoices.slice().reverse().filter(function (i) {
          if (!q) return true;
          return [i.inv_number, i.invoice_number, invText(i), i.created_at ? new Date(i.created_at).toLocaleDateString('ar-SY') : '', i.created_at || ''].join(' ').toLowerCase().indexOf(q) >= 0;
        });
        bd.querySelector('[data-gacc-invs]').innerHTML = list.length ? list.map(function (i) {
          return '<div style="padding:7px 10px;border-bottom:1px solid #f8fafc;font-size:12px"><b dir="ltr">' + esc(i.inv_number || i.invoice_number || '') + '</b> · ' + esc(i.created_at ? new Date(i.created_at).toLocaleDateString('ar-SY') : '') +
            ' · ' + n2(i.total).toFixed(2) + '$' + (n2(i.remaining_amount) > 0 ? ' · <span style="color:#D5001C;font-weight:900">باقي ' + n2(i.remaining_amount).toFixed(2) + '$</span>' : '') + (i.is_refund ? ' · مرتجع' : '') +
            '<div style="color:#64748b;font-size:11px">' + esc(invText(i)) + '</div></div>';
        }).join('') : '<div style="padding:8px;color:#64748b;font-size:12px">لا نتائج</div>';
      };
      paint('');
      bd.querySelector('[data-gacc-q]').addEventListener('input', function (e) { paint(e.target.value); });
    }
    ov.addEventListener('click', async function (e) {
      var b = e.target.closest('button'); if (!b) return;
      try {
        if (b.hasAttribute('data-gacc-rcpt')) { if (await addReceipt(c, opt.branchKey)) { await reload(); if (opt.onChange) opt.onChange(); } }
        else if (b.hasAttribute('data-gacc-void')) { if (await voidReceipt(b.getAttribute('data-gacc-void'))) { await reload(); if (opt.onChange) opt.onChange(); } }
        else if (b.hasAttribute('data-gacc-reg')) { if (await setRegular(c)) { await reload(); if (opt.onChange) opt.onChange(); } }
        else if (b.hasAttribute('data-gacc-print')) printStatement(c, data && data.st);
      } catch (err) { (global.GMTAsk ? GMTAsk.alert('تعذّر: ' + err.message) : null); }
    });
    await reload();
  }
  function printStatement(c, st) {
    if (!st) return;
    var w = global.open('', '_blank'); if (!w) return;
    w.document.write('<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>كشف حساب ' + esc(c.name || '') + '</title><style>body{font-family:Cairo,Tahoma,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:5px}th{background:#f1f5f9}.n{direction:ltr;text-align:left}</style></head><body>' +
      '<h2>كشف حساب — ' + esc(c.name || '') + '</h2><div dir="ltr" style="text-align:right">' + esc(c.phone || '') + '</div><div>التاريخ: ' + new Date().toLocaleDateString('ar-SY') + '</div><br>' +
      '<table><thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>' +
      st.rows.map(function (r) { return '<tr><td>' + esc(r.at ? new Date(r.at).toLocaleDateString('ar-SY') : '') + '</td><td>' + esc(r.ref + ' ' + r.text) + '</td><td class="n">' + (r.debit ? r.debit.toFixed(2) : '') + '</td><td class="n">' + (r.credit ? r.credit.toFixed(2) : '') + '</td><td class="n">' + r.balance.toFixed(2) + '</td></tr>'; }).join('') +
      '</tbody></table><h3>الرصيد المستحقّ: ' + st.balance.toFixed(2) + '$</h3><script>setTimeout(function(){print()},300)<\/script></body></html>');
    w.document.close();
  }

  var api = { statement: statement, load: load, balance: balance, open: open, addReceipt: addReceipt, voidReceipt: voidReceipt, setRegular: setRegular, usdOf: usdOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (doc) global.GMTCustLedger = api;
})(typeof window !== 'undefined' ? window : globalThis);
