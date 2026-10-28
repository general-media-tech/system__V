/* ═══════════════════════════════════════════════════════════════════════════
   gmt-refund.js — مرتجعٌ كامل لفاتورة (تلقائي) من خارج نقطة البيع
   أُنشئ: 2026-10-29 · TASK-0261 (المالك seq 189–190)

   طلبُك: «لا ينشأ مرتجع بالفاتورة ولا يدخل الأوردر حالة المرتجع إلا عند تأكيد الاستلام — يعود إلى المخزون ويُخصم المبلغ
   والتكاليف» · «مرتجع الفاتورة: تلقائي من الأوردرات».
   يفعل ما يفعله «تأكيد الإرجاع» في نقطة البيع (confirmRefund) لمرتجعٍ **كامل**، بالترتيب نفسه وبالحسابات نفسها:
   ① ما أُرجع سابقاً من الفاتورة لا يُرجَع ثانيةً (original_invoice_id) — فالتكرار لا يضاعف شيئاً.
   ② القيمة = ما دفعه الزبون فعلاً (نسبة الصافي ÷ قبل الخصم) · يُلغى من دين الفاتورة أوّلاً ثمّ الباقي نقداً من الصندوق.
   ③ فاتورة الإرجاع (R-…) وبنودها ⇐ ④ المخزون يعود (الدالّة الذرّية add_branch_stock) ⇐ ⑤ تخفيض دين الأصل
   ⇐ ⑥ عكس العمولة المسجَّلة (لا لفاتورة أوردر — كنقطة البيع) ⇐ ⑦ إلغاء كفالات الفاتورة.
   فشل حفظ فاتورة الإرجاع ⇒ لا شيء يتغيّر (يُرمى خطأ). فشلٌ بعده ⇒ يُعاد في issues ليُراجَع.

   GMTRefund.full({ url, headers(), invoiceId | invNo, reason, stockBranch, cashier, warranty:{url,key} })
     ⇒ Promise<{ already, refundInv, totalRefund, cashBack, debtCancelled, items, issues }>
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTRefund) return;
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function H(o, extra) { var h = typeof o.headers === 'function' ? o.headers() : (o.headers || {}); return Object.assign({}, h, extra || {}); }
  async function getJ(o, path) {
    var r = await fetch(o.url + path, { headers: H(o) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  /* POST مع إسقاط عمودٍ غير موجود في قاعدةٍ أقدم (كـ sbPostAdaptive في نقطة البيع) */
  async function postAdaptive(o, path, rows, keep) {
    var payload = JSON.parse(JSON.stringify(rows)), dropped = [];
    for (var i = 0; i < 8; i++) {
      var r = await fetch(o.url + path, { method: 'POST', headers: H(o, { 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(payload) });
      var d = await r.json().catch(function () { return null; });
      if (r.ok) return { data: Array.isArray(d) ? d : [d], error: null, dropped: dropped };
      var err = (d && (d.message || d.error)) || ('HTTP ' + r.status);
      var m = String(err).match(/Could not find the '([^']+)' column|column "?([a-z0-9_]+)"? (?:of relation "?\w+"? )?does not exist/i), col = m && (m[1] || m[2]);
      if (!col || (keep || []).indexOf(col) >= 0) return { data: null, error: err, dropped: dropped };
      var had = false;
      (Array.isArray(payload) ? payload : [payload]).forEach(function (x) { if (Object.prototype.hasOwnProperty.call(x, col)) { delete x[col]; had = true; } });
      if (!had) return { data: null, error: err, dropped: dropped };
      dropped.push(col);
    }
    return { data: null, error: 'تكرّر إسقاط الأعمدة: ' + dropped.join('، '), dropped: dropped };
  }
  /* إعادة المخزون: الدالّة الذرّية · وإن لم تُنشَر: قراءة ← كتابة من القاعدة (لا من كاش) */
  async function addStock(o, pid, bk, qty) {
    try {
      var r = await fetch(o.url + '/rest/v1/rpc/add_branch_stock', { method: 'POST', headers: H(o, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ p_product_id: String(pid), p_branch_key: bk, p_qty: Number(qty) || 0 }) });
      var txt = await r.text().catch(function () { return ''; });
      if (r.ok) return { ok: String(txt).trim() !== 'false' };
      if (!(/PGRST202|PGRST203|Could not find the function|does not exist|42883/i.test(txt) || r.status === 404)) return { ok: false, error: 'HTTP ' + r.status };
    } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
    try {
      var rows = await getJ(o, '/rest/v1/products?id=eq.' + encodeURIComponent(pid) + '&select=' + encodeURIComponent(bk) + '&limit=1');
      if (!rows || !rows[0]) return { ok: false, error: 'المنتج غير موجود' };
      var nq = (Number(rows[0][bk]) || 0) + (Number(qty) || 0), body = {}; body[bk] = nq;
      var p = await fetch(o.url + '/rest/v1/products?id=eq.' + encodeURIComponent(pid), { method: 'PATCH', headers: H(o, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(body) });
      return { ok: p.ok || p.status === 204, error: p.ok ? '' : 'HTTP ' + p.status };
    } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
  }
  function invCash(inv) {   /* المقبوض فعلاً (كـ GMTCash.invCash) */
    if (global.GMTCash && GMTCash.invCash) { try { return GMTCash.invCash(inv); } catch (_) {} }
    return (inv.paid_amount != null && isFinite(Number(inv.paid_amount))) ? Number(inv.paid_amount) : Number(inv.total) || 0;
  }
  async function full(o) {
    o = o || {};
    if (!o.url) throw new Error('لا اتصال بالقاعدة');
    var q = o.invoiceId ? 'id=eq.' + encodeURIComponent(o.invoiceId) : 'inv_number=eq.' + encodeURIComponent(o.invNo || '');
    var invs = await getJ(o, '/rest/v1/invoices?' + q + '&select=*&limit=1');
    var inv = invs && invs[0]; if (!inv) throw new Error('الفاتورة #' + (o.invNo || o.invoiceId || '') + ' غير موجودة');
    if (Number(inv.total) < 0 || inv.original_invoice_id) throw new Error('هذه فاتورة مرتجع — لا تُرجَع');
    var items = await getJ(o, '/rest/v1/invoice_items?invoice_id=eq.' + encodeURIComponent(inv.id) + '&select=*');
    items = Array.isArray(items) ? items : [];
    /* ① ما أُرجع سابقاً */
    var already = {};
    try {
      var prev = await getJ(o, '/rest/v1/invoices?original_invoice_id=eq.' + encodeURIComponent(inv.id) + '&select=id');
      if (prev && prev.length) {
        var pi = await getJ(o, '/rest/v1/invoice_items?invoice_id=in.(' + prev.map(function (x) { return x.id; }).join(',') + ')&select=product_id,qty');
        (pi || []).forEach(function (x) { already[x.product_id] = (already[x.product_id] || 0) + (Number(x.qty) || 0); });
      }
    } catch (_) {}
    var refunded = items.map(function (it) {
      var pid = it.product_id || it.id, max = Math.max(0, (Number(it.qty) || 0) - (already[pid] || 0));
      return Object.assign({}, it, { refundQty: max });
    }).filter(function (x) { return x.refundQty > 0; });
    if (!refunded.length) return { already: true, refundInv: null, totalRefund: 0, cashBack: 0, debtCancelled: 0, items: [], issues: [], invoice: inv };
    /* ② القيمة والدين والنقد */
    var bk = inv.branch_key || o.stockBranch, stockBk = o.stockBranch || bk;
    var origRaw = items.reduce(function (s, i) { return s + Number(i.unit_price || i.price || 0) * (Number(i.qty) || 0); }, 0);
    var ratio = (origRaw > 0 && isFinite(Number(inv.total))) ? Math.max(0, Math.min(1, Number(inv.total) / origRaw)) : 1;
    var raw = refunded.reduce(function (s, i) { return s + Number(i.unit_price || i.price || 0) * i.refundQty; }, 0);
    var total = r2(raw * ratio), debtRem = Math.max(0, Number(inv.remaining_amount) || 0), paidNow = invCash(inv);
    var debtCancelled = r2(Math.min(debtRem, total)), cashBack = r2(Math.max(0, total - debtCancelled));
    var reason = o.reason || 'مرتجع شحن';
    /* ③ فاتورة الإرجاع — لا شيء قبلها */
    var res = await postAdaptive(o, '/rest/v1/invoices', {
      inv_number: 'R-' + (inv.inv_number || inv.id) + '-' + Date.now().toString(36).toUpperCase(),
      branch_key: bk, branch_name: inv.branch_name || bk, total: -total,
      items_count: refunded.reduce(function (s, i) { return s + i.refundQty; }, 0), customer_name: inv.customer_name || null,
      notes: 'مرتجع: ' + reason + ' | فاتورة أصل: #' + inv.inv_number + (debtCancelled > 0 ? ' | أُلغي من الدين: $' + debtCancelled.toFixed(2) : '') + ' | تلقائي من الأوردرات (تأكيد استلام المرتجع)',
      sale_type: 'مرتجع', payment_status: 'paid', paid_amount: -cashBack, remaining_amount: 0,
      cashier_name: o.cashier || null, original_invoice_id: String(inv.id)
    }, ['inv_number', 'branch_key', 'total']);
    if (res.error) throw new Error('فشل حفظ فاتورة الإرجاع: ' + res.error + ' — لم يتغيّر مخزونٌ ولا صندوق');
    var rinv = res.data[0], issues = [];
    var ir = await postAdaptive(o, '/rest/v1/invoice_items', refunded.map(function (i) {
      return { invoice_id: rinv.id, product_id: i.product_id || i.id, product_name: i.product_name || i.name || '—', branch_key: stockBk, qty: i.refundQty,
        unit_price: r2(Number(i.unit_price || i.price || 0) * ratio), wholesale_price: Number(i.wholesale_price || 0), total: r2(Number(i.unit_price || i.price || 0) * i.refundQty * ratio) };
    }), ['invoice_id', 'product_id', 'qty']);
    if (ir.error) issues.push('تعذّر حفظ بنود المرتجع (' + String(ir.error).slice(0, 70) + ')');
    /* ④ المخزون */
    for (var k = 0; k < refunded.length; k++) {
      var it = refunded[k], pid = it.product_id || it.id;
      if (!pid) continue;
      var st = await addStock(o, pid, stockBk, it.refundQty);
      if (!st.ok) issues.push('تعذّر إعادة المخزون لـ«' + (it.product_name || pid) + '»' + (st.error ? ' (' + String(st.error).slice(0, 60) + ')' : ''));
    }
    /* ⑤ دين الأصل — تحديثٌ مشروط بالقيمة المقروءة */
    if (debtCancelled > 0) {
      var okD = false;
      for (var t = 0; t < 3 && !okD; t++) {
        try {
          var cur = t === 0 ? debtRem : Math.max(0, Number(((await getJ(o, '/rest/v1/invoices?id=eq.' + encodeURIComponent(inv.id) + '&select=remaining_amount'))[0] || {}).remaining_amount) || 0);
          var next = r2(Math.max(0, cur - Math.min(cur, debtCancelled)));
          var pr = await fetch(o.url + '/rest/v1/invoices?id=eq.' + encodeURIComponent(inv.id) + '&remaining_amount=eq.' + cur, { method: 'PATCH', headers: H(o, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
            body: JSON.stringify({ remaining_amount: next, payment_status: next <= 0.004 ? 'paid' : (paidNow > 0.004 ? 'partial' : 'unpaid') }) });
          if (pr.ok) { var rr = await pr.json().catch(function () { return []; }); okD = Array.isArray(rr) && rr.length > 0; }
        } catch (_) {}
      }
      if (!okD) issues.push('لم يُخفَّض دين الفاتورة الأصلية (' + debtCancelled.toFixed(2) + '$)');
    }
    /* ⑥ العمولة — كنقطة البيع: لا لفاتورة أوردر */
    if (!inv.order_id && !o.orderLinked) {
      try {
        var cm = await getJ(o, '/rest/v1/invoice_commissions?invoice_id=eq.' + encodeURIComponent(inv.id) + '&select=amount,approved,cashier_name');
        var net = (cm || []).reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0);
        if (net > 0.004) {
          var orig = (cm || []).find(function (x) { return x.cashier_name; }) || {};
          var cr = await postAdaptive(o, '/rest/v1/invoice_commissions', [{ invoice_id: inv.id, branch_key: bk, cashier_name: orig.cashier_name || inv.cashier_name || null, amount: -r2(net),
            note: 'عكس عمولة تلقائي — مرتجع كامل (من الأوردرات)', paid: false, approved: (cm || []).length > 0 && cm.every(function (x) { return x.approved === true; }), created_by: 'auto_refund_reversal' }], ['invoice_id', 'amount']);
          if (cr.error) issues.push('تعذّر تسجيل عكس العمولة');
        }
      } catch (e) { issues.push('تعذّر عكس العمولة'); }
    }
    /* ⑦ الكفالات */
    var wc = 0;
    try {
      var W = o.warranty;
      if (W && W.url && inv.inv_number) {
        var wh = { apikey: W.key, Authorization: 'Bearer ' + W.key, 'Content-Type': 'application/json' };
        var wr = await fetch(W.url + '/rest/v1/warranties?invoice_no=eq.' + encodeURIComponent(inv.inv_number) + '&status=neq.cancelled&select=short_id', { headers: wh });
        var ws = wr.ok ? await wr.json() : [];
        for (var j = 0; j < (ws || []).length; j++) {
          var u = await fetch(W.url + '/rest/v1/warranties?short_id=eq.' + encodeURIComponent(ws[j].short_id), { method: 'PATCH', headers: Object.assign({}, wh, { Prefer: 'return=minimal' }),
            body: JSON.stringify({ status: 'cancelled', cancel_reason: 'مرتجع — فاتورة #' + inv.inv_number }) });
          if (u.ok) wc++;
        }
      }
    } catch (_) {}
    return { already: false, refundInv: rinv, totalRefund: total, cashBack: cashBack, debtCancelled: debtCancelled, items: refunded, issues: issues, warrantiesCancelled: wc, invoice: inv };
  }
  global.GMTRefund = { full: full };
})(typeof window !== 'undefined' ? window : this);
