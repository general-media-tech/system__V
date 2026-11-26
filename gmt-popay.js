/* ═════════════════════════════════════════════════════════════════════
   gmt-popay.js — دفعات فواتير الشراء المتعدّدة (gmt_po_payments) · P1 المالية بالمشتريات
   TASK-B0545 · المالك A1004 §1–2 (GMT PROCUREMENT) · الخطّة B 1.3 · seq B1076 «كمّل كلّ شي».

   قبل: خانة دفعة واحدة (import_log.cash_payment) — فارغة = «مدفوعة بالكامل» افتراضاً.
   الآن: دفعات بعدد ما بدّك (تاريخ · عملة · سعر صرف · طريقة · رقم الإيصال · استحقاق الباقي) · لا حذف (إلغاء بسبب).
   القواعد (الدراسة §٧.٣):
     • لا جمع عملات بلا سعر صرف محفوظ بالحركة ⇒ كلّ دفعة تحفظ usd = المبلغ ÷ سعر الصرف.
     • المحاسبة تبقى على آليّتها: بعد كلّ دفعة/إلغاء ⇒ cash_payment = مجموع الدفعات بالدولار ⇒ GMTLedger.syncPurchase
       (نفس وسم [PO:]) — لا مسار ثانٍ للمال.
     • الفاتورة القديمة بلا دفعات تُقرأ على قاعدتها (cash_payment · فارغة = مدفوعة) — لا ترحيل ولا تغيير.

   GMTPoPay.summary(p, pays) ⇒ { value, paid, remaining, status, source, nextDue, overdue, items, qty }
   GMTPoPay.chip(p, pays)    ⇒ HTML شارة الحالة للبطاقة
   GMTPoPay.loadAll() · GMTPoPay.of(id) · GMTPoPay.open(p, { onChange(pid) })
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTPoPay) return;
  var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  var num = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function arr(v) { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { return []; } } return Array.isArray(v) ? v : []; }

  /* ── حساب صافٍ (يُختبر بلا متصفّح) ── */
  function usdOf(x) { var c = String(x.currency || 'USD').toUpperCase(); if (c === 'USD') return r2(x.amount); var fx = num(x.fx_rate); return fx > 0 ? r2(num(x.amount) / fx) : 0; }
  function summary(p, pays) {
    p = p || {};
    /* (TASK-0378 · المالك C1121) الصينية: «باقي بالصين» = الفاتورة + النقل الداخلي + التحويل (قبل ما تنشحن) · «عند الوصول» = شحن لسوريا + جمارك + داخل سوريا
       — نفس GMTLedger.supplierDue/costsTotal/coveredByInvoice. الفائض المدفوع للمورّد فوق حصّة الصين يُحسب من تكاليف الوصول. */
    var china = String(p.inv_type || '') === 'china';
    var goods = r2(p.total_amount), trans = china ? r2(p.cost_transport) : 0, xfer = china ? r2(p.cost_transfer) : 0, ship = 0;
    var value = r2(goods + trans + xfer), live = (pays || []).filter(function (x) { return x && !x.voided; });
    var it = arr(p.items_snapshot), qty = it.reduce(function (s, x) { return s + num(x && x.qty); }, 0);
    var paid, source;
    if (live.length) { paid = r2(live.reduce(function (s, x) { return s + (x.usd != null ? num(x.usd) : usdOf(x)); }, 0)); source = 'payments'; }
    else { var raw = p.cash_payment; paid = (raw == null || raw === '') ? value : Math.max(0, r2(raw)); source = (raw == null || raw === '') ? 'legacy-full' : 'legacy'; }
    var remaining = r2(Math.max(0, value - paid));
    var cparts = china
      ? [['شحن لسوريا', r2(p.cost_shipping)], ['جمارك', r2(p.cost_customs)], ['داخل سوريا', r2(p.cost_local)]]
      : [['جمارك', r2(p.cost_customs)], ['شحن', r2(p.cost_shipping)], ['نقل', r2(p.cost_transport)], ['داخلي', r2(p.cost_local)]];
    cparts = cparts.filter(function (x) { return x[1] > 0; });
    var costs = r2(cparts.reduce(function (a, x) { return a + x[1]; }, 0)), costsPaid = !!p.costs_paid;
    var covered = china ? r2(Math.min(costs, Math.max(0, paid - value))) : 0;
    var costsDue = costsPaid ? 0 : r2(Math.max(0, costs - covered));
    var status = paid > value + covered + 0.005 ? 'over' : (remaining <= 0.005 ? 'paid' : (paid > 0.005 ? 'partial' : 'unpaid'));
    var dues = live.map(function (x) { return x.due_at; }).filter(Boolean).sort();
    var nextDue = remaining > 0.005 && dues.length ? String(dues[dues.length - 1]).slice(0, 10) : '';
    var chinaParts = china ? [['الفاتورة', goods], ['شحن داخلي', trans], ['أجور تحويل', xfer]].filter(function (x) { return x[1] > 0; }) : [];
    return { costs: costs, costParts: cparts, costsPaid: costsPaid, costsDue: costsDue, covered: covered, china: china, chinaParts: chinaParts,
             totalRemaining: r2(remaining + costsDue), goods: goods, ship: ship, value: value, paid: paid, remaining: remaining, status: status, source: source, nextDue: nextDue,
             overdue: !!(nextDue && nextDue < today()), qty: qty, items: it.length };   /* items رجع (انشال بـTASK-0378 بالغلط — t_popay) */
  }
  var ST = { paid: ['✅ مدفوعة', '#dcfce7', '#166534'], partial: ['🟡 جزئية', '#fef3c7', '#92400e'], unpaid: ['🔴 غير مدفوعة', '#fee2e2', '#991b1b'], over: ['⚠️ مدفوع أكثر', '#ede9fe', '#5b21b6'] };
  function chip(p, pays) {
    var s = summary(p, pays), t = ST[s.status];
    return '<span data-popay-chip="' + esc(p.id) + '" style="display:inline-block;border-radius:99px;padding:2px 9px;font-size:10.5px;font-weight:900;background:' + t[1] + ';color:' + t[2] + '">' + t[0] +
      (s.status === 'partial' || s.status === 'unpaid' ? ' · باقي ' + s.remaining.toFixed(2) + '$' : '') + (s.overdue ? ' · ⏰ مستحقّة' : (s.nextDue ? ' · 📅 ' + s.nextDue : '')) + '</span>' +
      (s.costsDue > 0.005 ? ' <span data-popay-costs="' + esc(p.id) + '" title="' + esc(s.costParts.map(function (x) { return x[0] + ' ' + x[1]; }).join(' · ')) + '" style="display:inline-block;border-radius:99px;padding:2px 9px;font-size:10.5px;font-weight:900;background:#fee2e2;color:#991b1b">🧾 تكاليف لسّا عليها ' + s.costsDue.toFixed(2) + '$</span>' : '');
  }

  /* ── القاعدة ── */
  function db() { var M = g.GMT_DB && g.GMT_DB.MAIN; if (M && M.url) return M; if (g.SB && g.KEY) return { url: g.SB, key: g.KEY }; throw new Error('إعدادات القاعدة غير محمّلة'); }
  async function req(method, path, body, prefer) {
    var M = db(), h = { apikey: M.key, Authorization: 'Bearer ' + M.key, 'Content-Type': 'application/json' }; if (prefer) h.Prefer = prefer;
    var r = await fetch(M.url + '/rest/v1/' + path, { method: method, headers: h, body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (_) {} throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 160) : '')); }
    var s = await r.text(); return s ? JSON.parse(s) : null;
  }
  var CACHE = {};
  async function loadAll() {
    var rows = await req('GET', 'gmt_po_payments?select=*&order=created_at.asc&limit=5000').catch(function () { return null; });
    if (!rows) return CACHE; CACHE = {}; rows.forEach(function (x) { (CACHE[String(x.purchase_id)] = CACHE[String(x.purchase_id)] || []).push(x); }); return CACHE;
  }
  function of(id) { return CACHE[String(id)] || []; }
  function who() { try { return (g.GMTRole && GMTRole.name && GMTRole.name()) || localStorage.getItem('gmt_operator_name') || ''; } catch (_) { return ''; } }
  async function writeCash(pid) {
    var live = (await req('GET', 'gmt_po_payments?purchase_id=eq.' + encodeURIComponent(pid) + '&voided=is.false&select=usd')) || [];
    var sum = r2(live.reduce(function (s, x) { return s + num(x.usd); }, 0));
    await req('PATCH', 'import_log?id=eq.' + encodeURIComponent(pid), { cash_payment: sum }, 'return=minimal');
    return sum;
  }
  async function add(p, v) {
    var pid = p.id, cur = String(v.currency || 'USD').toUpperCase(), fx = cur === 'USD' ? null : num(v.fx_rate);
    var existing = ((await req('GET', 'gmt_po_payments?purchase_id=eq.' + encodeURIComponent(pid) + '&voided=is.false&select=id')) || []).length;
    /* أوّل دفعة على فاتورة قديمة فيها مبلغ مسجَّل ⇒ يُحفظ كـ«دفعة افتتاحية» أوّلاً كي لا يضيع */
    if (!existing && p.cash_payment != null && p.cash_payment !== '' && num(p.cash_payment) > 0.004) {
      await req('POST', 'gmt_po_payments', { purchase_id: pid, kind: 'opening', amount: r2(p.cash_payment), currency: 'USD', usd: r2(p.cash_payment), note: 'مسجّلة على الفاتورة من قبل', created_by: who(), voided: false, paid_at: (p.inv_date || '').slice(0, 10) || null }, 'return=minimal');
    }
    /* (seq B1096) نوع الدفعة تلقائي (ما عاد سؤال بالنموذج): بتسكّر الباقي ⇒ نهائية · غير هيك جزئية */
    var _usd = usdOf({ amount: v.amount, currency: cur, fx_rate: fx }), _rem = summary(p, of(pid)).remaining;
    var row = { purchase_id: pid, kind: v.kind || (_usd >= _rem - 0.005 && _rem > 0 ? 'final' : 'partial'), amount: r2(v.amount), currency: cur, fx_rate: fx, usd: usdOf({ amount: v.amount, currency: cur, fx_rate: fx }),
      method: v.method || null, ref_no: v.ref_no || null, paid_at: v.paid_at || today(), due_at: v.due_at || null, paid_by: v.paid_by || who() || null, note: v.note || null, created_by: who() || null, voided: false };
    await req('POST', 'gmt_po_payments', row, 'return=minimal');
    var sum = await writeCash(pid);
    try { g.GMTAudit && GMTAudit.log({ action: 'po_payment_add', entity: 'import_log', entityId: String(pid), entityName: p.inv_number || '', newValue: row.amount + ' ' + cur + ' = ' + row.usd + '$' }); } catch (_) {}
    return sum;
  }
  async function voidPay(p, id, why) {
    await req('PATCH', 'gmt_po_payments?id=eq.' + encodeURIComponent(id) + '&voided=is.false', { voided: true, voided_at: new Date().toISOString(), voided_by: who() || null, void_reason: why }, 'return=minimal');
    var sum = await writeCash(p.id);
    try { g.GMTAudit && GMTAudit.log({ action: 'po_payment_void', entity: 'import_log', entityId: String(p.id), reason: why }); } catch (_) {}
    return sum;
  }

  /* ── النافذة: شريط ملخّص ثابت + الدفعات ── */
  var METH = { cash: 'نقداً', transfer: 'حوالة', bank: 'تحويل بنكي', other: 'أخرى' }, KIND = { opening: 'دفعة قديمة', advance: 'مقدّمة', partial: 'جزئية', final: 'نهائية' };
  async function open(p, opt) {
    opt = opt || {};
    var old = document.getElementById('gmt-popay'); if (old) old.remove();
    var w = document.createElement('div'); w.id = 'gmt-popay';
    w.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(15,18,25,.5);display:flex;align-items:flex-start;justify-content:center;padding:3vh 10px;overflow:auto;direction:rtl;font-family:inherit';
    w.setAttribute('data-gmt-modal', ''); document.body.appendChild(w);
    async function paint() {
      var pays = ((await req('GET', 'gmt_po_payments?purchase_id=eq.' + encodeURIComponent(p.id) + '&select=*&order=created_at.asc')) || []);
      CACHE[String(p.id)] = pays;
      var s = summary(p, pays), t = ST[s.status];
      var cell = function (k, v, c) { return '<div style="flex:1;min-width:92px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:6px 9px"><div style="font-size:10.5px;color:#64748b;font-weight:800">' + k + '</div><div style="font-weight:900;font-size:14px;' + (c ? 'color:' + c : '') + '" dir="ltr">' + v + '</div></div>'; };
      w.innerHTML = '<div style="background:#f8fafc;border-radius:18px;width:100%;max-width:760px;overflow:hidden">' +
        '<div data-popay-bar style="position:sticky;top:0;background:#f8fafc;padding:12px 14px;border-bottom:1px solid #e5e7eb;z-index:1">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="flex:1;font-size:15px">💳 الدفعات — ' + esc(p.inv_number || '#' + p.id) + (p.supplier ? '<div style="font-size:12px;font-weight:700;color:#64748b">' + esc(g.GMTSuppliers && GMTSuppliers.canon ? GMTSuppliers.canon(p) : p.supplier) + '</div>' : '') + '</b><span style="border-radius:99px;padding:3px 10px;font-size:12px;font-weight:900;background:' + t[1] + ';color:' + t[2] + '">' + t[0] + '</span><button type="button" data-popay-x style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:5px 10px;font:inherit;font-weight:800;cursor:pointer">✕</button></div>' +
        /* (TASK-0378 · المالك C1121) الصينية: ① باقي بالصين (قبل ما تنشحن) ② باقي عند الوصول (شحن لسوريا · جمارك) ③ باقي ككلّ */
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          cell(s.china ? 'المطلوب بالصين' : 'قيمة الفاتورة', s.value.toFixed(2) + '$' + (s.china && s.chinaParts.length > 1 ? '<div style="font-size:10px;font-weight:700;color:#64748b">' + esc(s.chinaParts.map(function (x) { return x[0] + ' ' + x[1].toFixed(2); }).join(' + ')) + '</div>' : '')) +
          cell('دفعت', s.paid.toFixed(2) + '$', '#166534') +
          cell(s.china ? 'باقي عليك بالصين' : 'باقي عليك', s.remaining.toFixed(2) + '$', s.remaining > 0.005 ? '#b91c1c' : '#166534') +
          (s.china && s.costs > 0.005 ? cell('باقي عند الوصول', s.costsDue.toFixed(2) + '$', s.costsDue > 0.005 ? '#b91c1c' : '#166534') : '') +
          (s.china ? '<div data-popay-total style="flex:1;min-width:92px;background:#0f1219;color:#fff;border-radius:12px;padding:6px 9px"><div style="font-size:10.5px;font-weight:800;opacity:.75">باقي ككلّ</div><div style="font-weight:900;font-size:14px" dir="ltr">' + s.totalRemaining.toFixed(2) + '$</div></div>' : '') +
        (s.nextDue ? cell('موعد دفع الباقي', s.nextDue + (s.overdue ? ' ⏰ فات' : ''), s.overdue ? '#b91c1c' : '') : '') + '</div>' +
        (s.costs > 0.005 ? '<div data-popay-costbox style="margin-top:8px;border-radius:12px;padding:8px 11px;font-size:12.5px;font-weight:800;background:' + (s.costsDue <= 0.005 ? '#f0fdf4;border:1px solid #bbf7d0' : '#fef2f2;border:1px solid #fecaca') + '">' +
          '<div style="display:flex;gap:8px;align-items:center"><span style="flex:1">🧾 ' + (s.china ? 'عند الوصول' : 'الشحن والجمارك') + ' (' + esc(s.costParts.map(function (x) { return x[0] + ' ' + x[1].toFixed(2); }).join(' · ')) + ') = <b dir="ltr">' + s.costs.toFixed(2) + '$</b>' +
          '<div style="font-size:11.5px;color:' + (s.costsDue <= 0.005 ? '#166534' : '#991b1b') + '">' + (s.costsPaid ? '✅ اندفعت' : (s.costsDue <= 0.005 ? '✅ اندفعت مع دفعة المورّد' : '⏳ لسّا عليها دفع ' + s.costsDue.toFixed(2) + '$')) + '</div></span>' +
          (s.costsPaid || s.costsDue <= 0.005 ? '' : '<button type="button" data-popay-costs-paid style="border:0;background:#15803d;color:#fff;border-radius:10px;padding:7px 11px;font:inherit;font-size:12px;font-weight:900;cursor:pointer">✅ اندفعت</button>') + '</div>' +
          (s.covered > 0.005 ? '<div style="font-size:11px;color:#64748b;margin-top:2px">' + s.covered.toFixed(2) + '$ منها اندفعت مع دفعة المورّد (فوق حصّة الصين)</div>' : '') + '</div>' : '') +
        '</div><div style="padding:10px 14px 14px">' +
        '<button type="button" data-popay-add style="width:100%;border:0;background:#0f1219;color:#fff;border-radius:12px;padding:11px;font:inherit;font-weight:900;cursor:pointer">➕ دفعة جديدة</button>' +
        (s.source === 'legacy' && s.paid > 0 ? '<div data-popay-legacy style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:8px 11px;margin-top:8px;font-size:12.5px;font-weight:700"><b dir="ltr">' + s.paid.toFixed(2) + '$</b> · دفعة قديمة<div style="color:#64748b">مسجّلة على الفاتورة من قبل</div></div>' : '') +
        (s.source === 'legacy-full' ? '<div data-popay-legacy style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:8px 11px;margin-top:8px;font-size:12.5px;font-weight:700">✅ فاتورة قديمة محسوبة مدفوعة كاملة<div style="color:#64748b">إذا مو صحيح: سجّل الدفعات الحقيقية وبتنحسب هي بدالها</div></div>' : '') +
        (pays.length ? '<div data-gmt-list data-gmt-title="دفعات الفاتورة">' + pays.slice().reverse().map(function (x) {
          return '<div data-popay-row="' + esc(x.id) + '" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:8px 11px;margin-top:8px;font-size:12.5px;font-weight:700;' + (x.voided ? 'opacity:.55;text-decoration:line-through' : '') + '">' +
            '<b dir="ltr">' + r2(x.amount) + ' ' + esc(x.currency) + '</b>' + (String(x.currency).toUpperCase() !== 'USD' ? ' ÷ ' + esc(x.fx_rate) + ' = <b>' + r2(x.usd) + '$</b>' : '') +
            ' · ' + esc(KIND[x.kind] || x.kind) + (x.method ? ' · ' + esc(METH[x.method] || x.method) : '') + (x.ref_no ? ' · إيصال ' + esc(x.ref_no) : '') +
            '<div style="color:#64748b">' + esc(x.paid_at || String(x.created_at || '').slice(0, 10)) + (x.paid_by ? ' · دفعها ' + esc(x.paid_by) : '') + (x.due_at ? ' · 📅 استحقاق الباقي ' + esc(x.due_at) : '') + (x.note ? ' · ' + esc(x.note) : '') + (x.voided ? ' · ملغاة: ' + esc(x.void_reason || '') : '') + '</div>' +
            (x.voided ? '' : '<button type="button" data-popay-void="' + esc(x.id) + '" style="margin-top:5px;border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:8px;padding:3px 9px;font:inherit;font-size:11.5px;font-weight:800;cursor:pointer">إلغاء الدفعة</button>') + '</div>';
        }).join('') + '</div>' : (s.source === 'legacy' || s.source === 'legacy-full' ? '' : '<div style="text-align:center;color:#64748b;padding:16px 6px;font-size:13px">لسّا ما دفعت شي على هالفاتورة.</div>')) + '</div></div>';
    }
    w.addEventListener('click', async function (e) {
      if (e.target === w || e.target.closest('[data-popay-x]')) { w.remove(); return; }
      if (e.target.closest('[data-popay-costs-paid]') && g.GMTAsk) {
        var sc = summary(p, of(p.id));
        var who2 = await GMTAsk.prompt('تأكيد دفع ' + (sc.china ? 'تكاليف الوصول' : 'الشحن والجمارك') + ' (' + sc.costsDue.toFixed(2) + '$) لفاتورة ' + (p.inv_number || '') + '.\nمين دفعها؟', { title: '🧾 دفع التكاليف', value: who() });
        if (who2 === null || who2 === undefined) return;
        try {
          await req('PATCH', 'import_log?id=eq.' + encodeURIComponent(p.id), { costs_paid: true }, 'return=minimal');
          try { g.GMTAudit && GMTAudit.log({ action: 'po_costs_paid', entity: 'import_log', entityId: String(p.id), entityName: p.inv_number || '', newValue: sc.costsDue + '$ · ' + (String(who2).trim() || 'الإدارة') }); } catch (_) {}
          p = Object.assign({}, p, { costs_paid: true }); await paint(); if (opt.onChange) opt.onChange(p.id, { payer: String(who2).trim() || 'الإدارة' });
        } catch (er) { if (typeof g.toast === 'function') g.toast('تعذّر: ' + er.message, 'err'); }
        return;
      }
      var b = e.target.closest('[data-popay-add],[data-popay-void]'); if (!b || !g.GMTAsk) return;
      try {
        if (b.hasAttribute('data-popay-add')) {
          var s = summary(p, of(p.id));
          var v = await GMTAsk.form('دفعة للمورّد على ' + (p.inv_number || '') + ' — الباقي ' + s.remaining.toFixed(2) + '$', { title: '💳 دفعة جديدة', okText: 'سجّل الدفعة',
            fields: [{ k: 'amount', label: 'المبلغ', type: 'number', value: s.remaining > 0 ? s.remaining : '' },
              { k: 'currency', label: 'العملة', options: [{ v: 'USD', t: 'دولار $' }, { v: 'EUR', t: 'يورو €' }, { v: 'CNY', t: 'يوان ¥' }, { v: 'SYP', t: 'ليرة سورية' }] },
              { k: 'fx_rate', label: 'سعر الصرف (كم وحدة = ١$) — لغير الدولار', type: 'number', placeholder: 'مثلاً 0.92 لليورو · 7.2 لليوان' },
              { k: 'method', label: 'الطريقة', options: [{ v: 'transfer', t: 'حوالة' }, { v: 'bank', t: 'تحويل بنكي' }, { v: 'cash', t: 'نقداً' }, { v: 'other', t: 'أخرى' }] },
              { k: 'ref_no', label: 'رقم الإيصال/الحوالة', placeholder: 'اختياري' },
              { k: 'paid_at', label: 'تاريخ الدفع', type: 'date', value: today() },
              { k: 'due_at', label: 'استحقاق الباقي (إن بقي شي)', type: 'date' },
              { k: 'paid_by', label: 'مين دفع', value: who() },
              { k: 'note', label: 'ملاحظة', placeholder: 'اختياري' }],
            submit: function (x) {
              if (!(num(x.amount) > 0)) return { error: 'اكتب مبلغاً أكبر من صفر', field: 'amount' };
              if (x.currency !== 'USD' && !(num(x.fx_rate) > 0)) return { error: 'اكتب سعر الصرف (لا جمع عملات بلا سعر صرف)', field: 'fx_rate' };
              return true;
            } });
          if (!v) return;
          await add(p, v);
        } else {
          var why = await GMTAsk.prompt('سبب إلغاء الدفعة (بتضلّ مسجّلة للتدقيق ولا بتنحذف):', { title: 'إلغاء دفعة' });
          if (!why || !String(why).trim()) return;
          await voidPay(p, b.getAttribute('data-popay-void'), String(why).trim());
        }
        var fresh = ((await req('GET', 'import_log?id=eq.' + encodeURIComponent(p.id) + '&select=*')) || [])[0]; if (fresh) p = fresh;
        await paint(); if (opt.onChange) opt.onChange(p.id);
      } catch (er) { GMTAsk.alert('تعذّر: ' + (er && er.message || er), { title: 'الدفعات' }); }
    });
    try { await paint(); } catch (er) { w.innerHTML = '<div style="background:#fff;border-radius:14px;padding:16px">تعذّر تحميل الدفعات: ' + esc(er.message) + '</div>'; }
    return w;
  }
  /* المستحقّ والمتأخّر (للإشعارات ولوحة المشتريات) */
  function dueList(purchases) {
    return (purchases || []).map(function (p) { return { p: p, s: summary(p, of(p.id)) }; }).filter(function (x) { return x.s.overdue; });
  }
  /* 📒 كشف الآجلة: كلّ فاتورة شراء باقي عليها للمورّد — المستحقّة أوّلاً ثمّ الأكبر · مجموع لكلّ مورّد */
  function aging(purchases) {
    var rows = (purchases || []).filter(function (p) { return p && p.inv_type !== 'instant' && !/cancel/i.test(p.status || ''); })
      .map(function (p) { return { p: p, s: summary(p, of(p.id)) }; }).filter(function (x) { return x.s.remaining > 0.005; })
      .sort(function (a, b) { return (b.s.overdue - a.s.overdue) || (String(a.s.nextDue || '9') < String(b.s.nextDue || '9') ? -1 : 1) || (b.s.remaining - a.s.remaining); });
    var bySup = {}; rows.forEach(function (x) { var k = x.p.supplier || '—'; bySup[k] = r2((bySup[k] || 0) + x.s.remaining); });
    return { rows: rows, total: r2(rows.reduce(function (t, x) { return t + x.s.remaining; }, 0)), bySupplier: bySup };
  }
  function openAging(purchases, onOpen) {
    var a = aging(purchases), old = document.getElementById('gmt-poaging'); if (old) old.remove();
    var w = document.createElement('div'); w.id = 'gmt-poaging';
    w.style.cssText = 'position:fixed;inset:0;z-index:9650;background:rgba(15,18,25,.5);display:flex;align-items:flex-start;justify-content:center;padding:3vh 10px;overflow:auto;direction:rtl;font-family:inherit';
    w.innerHTML = '<div style="background:#fff;border-radius:18px;width:100%;max-width:820px;padding:14px">' +
      '<div style="display:flex;align-items:center;gap:8px"><b style="flex:1;font-size:16px">📒 الآجلة — باقي للمورّدين ' + a.total.toFixed(2) + '$ · ' + a.rows.length + ' فاتورة</b><button type="button" data-ag-x style="border:1.5px solid #e5e7eb;background:#fff;border-radius:9px;padding:5px 10px;font:inherit;font-weight:800;cursor:pointer">✕</button></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">' + Object.keys(a.bySupplier).sort(function (x, y) { return a.bySupplier[y] - a.bySupplier[x]; }).map(function (k) { return '<span style="background:#f1f5f9;border-radius:99px;padding:4px 10px;font-size:12px;font-weight:800">' + esc(k) + ': ' + a.bySupplier[k].toFixed(2) + '$</span>'; }).join('') + '</div>' +
      (a.rows.length ? a.rows.map(function (x) { var p = x.p, s = x.s;
        return '<div data-ag-row="' + esc(p.id) + '" style="border:1px solid #e5e7eb;border-radius:12px;padding:8px 11px;margin-top:6px;font-size:12.5px;font-weight:700;cursor:pointer;' + (s.overdue ? 'background:#fef2f2;border-color:#fecaca' : '') + '">' +
          '<b>' + esc(p.inv_number || '#' + p.id) + '</b> · ' + esc(p.supplier || '—') + ' · قيمة ' + s.value.toFixed(2) + '$ · مدفوع ' + s.paid.toFixed(2) + '$ · <b style="color:#b91c1c">باقي ' + s.remaining.toFixed(2) + '$</b>' +
          (s.nextDue ? ' · 📅 ' + esc(s.nextDue) + (s.overdue ? ' <b style="color:#b91c1c">⏰ مستحقّة</b>' : '') : '') + '</div>'; }).join('')
        : '<div style="text-align:center;color:#64748b;padding:18px">ما في شي باقي للمورّدين ✅</div>') + '</div>';
    w.setAttribute('data-gmt-modal', ''); document.body.appendChild(w);
    w.addEventListener('click', function (e) {
      if (e.target === w || e.target.closest('[data-ag-x]')) { w.remove(); return; }
      var r = e.target.closest('[data-ag-row]'); if (r && onOpen) { w.remove(); onOpen(r.getAttribute('data-ag-row')); }
    });
    return w;
  }
  g.GMTPoPay = { aging: aging, openAging: openAging, summary: summary, chip: chip, usdOf: usdOf, loadAll: loadAll, of: of, open: open, add: add, voidPay: voidPay, dueList: dueList, ST: ST, _cache: function () { return CACHE; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.GMTPoPay;
})(typeof window !== 'undefined' ? window : globalThis);
