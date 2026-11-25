/* ═════════════════════════════════════════════════════════════════════
   gmt-quotes.js — عروض الأسعار بالقاعدة (gmt_quotes) · مشترك بين quote.html ونقطة البيع
   TASK-B0541 · المالك seq B1073: «عرض السعر ليش ما فيه أسماء زبائن؟ ولا اقتراح ولا تسييف أسماء منه · ولا اقتراح منتجات ·
   ولازم فوراً: إنشاء فاتورة منه أو استيراد من عرض سعر · وتذكيرات».

   كان العرض مسودّةً على الجهاز فقط ⇒ الآن:
     save(q)            يحفظ/يحدّث بالرقم (ref) · ويحفظ الزبون بسجلّ الزبائن (gmt_customers) إن كان له رقم
     list(opt)          العروض (الأحدث أوّلاً) · opt.open = المفتوحة فقط
     get(ref)           عرضٌ واحد
     mark(ref, patch)   تغيير الحالة (sent · converted · lost) أو موعد التذكير — العرض لا يُحذف أبداً
     due(rows)          العروض المفتوحة يلي موعد تذكيرها اليوم أو فات
     total(q)           الإجمالي بعد الخصم
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTQuotes) return;
  function db() { var M = g.GMT_DB && g.GMT_DB.MAIN; if (!M || !M.url) throw new Error('إعدادات القاعدة غير محمّلة'); return M; }
  function hdr(M, extra) {
    var h = g.GMT_DB && g.GMT_DB.headers ? g.GMT_DB.headers(M) : { apikey: M.key, Authorization: 'Bearer ' + M.key };
    h = Object.assign({ 'Content-Type': 'application/json' }, h); return Object.assign(h, extra || {});
  }
  async function req(method, path, body, extra) {
    var M = db(), r = await fetch(M.url + '/rest/v1/' + path, { method: method, headers: hdr(M, extra), body: body == null ? undefined : JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) { var t = ''; try { t = await r.text(); } catch (_) {} throw new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 160) : '')); }
    var s = await r.text(); return s ? JSON.parse(s) : null;
  }
  function phone09(p) {
    var d = String(p || '').replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x660; }).replace(/\D/g, '').replace(/^00963|^963/, '');
    if (/^9\d{8}$/.test(d)) d = '0' + d; return /^09\d{8}$/.test(d) ? d : '';
  }
  function total(q) {
    var sub = (q.items || []).reduce(function (t, x) { return t + (Number(x.price) || 0) * (Number(x.qty) || 1); }, 0);
    return Math.max(0, Math.round((sub - (Number(q.discount) || 0)) * 100) / 100);
  }
  function row(q) {
    return { ref: q.ref, customer_name: q.name || null, customer_phone: q.phone || null,
      items: (q.items || []).map(function (x) { return { pid: x.pid || null, name: x.name || '', qty: Number(x.qty) || 1, price: Number(x.price) || 0 }; }),
      discount: Number(q.discount) || 0, currency: q.currency || 'usd', rate: Number(q.rate) || null, valid_days: Number(q.valid_days) || 7,
      notes: q.notes || null, total: total(q), follow_up_at: q.follow_up_at || null, created_by: q.user || null, updated_at: new Date().toISOString() };
  }
  /* الزبون: نفس طريقة المتجر ونقطة البيع — إدراجٌ بالرقم بلا تكرار، والاسم يُكمَّل إن كان فاضياً (لا نكتب فوق اسمٍ موجود) */
  async function saveCustomer(name, phone) {
    var ph = phone09(phone), nm = String(name || '').trim(); if (!ph) return false;
    try {
      await req('POST', 'gmt_customers?on_conflict=phone', { phone: ph, name: nm || null }, { Prefer: 'resolution=ignore-duplicates,return=minimal' });
      if (nm) await req('PATCH', 'gmt_customers?phone=eq.' + ph + '&or=(name.is.null,name.eq.)', { name: nm }, { Prefer: 'return=minimal' });
      try { if (g.GMTCustCache && g.GMTCustCache.remember) g.GMTCustCache.remember([{ name: nm, phone: ph }]); } catch (_) {}
      return true;
    } catch (_) { return false; }
  }
  async function save(q) {
    if (!q || !q.ref) throw new Error('عرض بلا رقم');
    var body = row(q);
    var out = await req('POST', 'gmt_quotes?on_conflict=ref', body, { Prefer: 'resolution=merge-duplicates,return=representation' });
    var cust = await saveCustomer(q.name, q.phone);
    return { row: (out && out[0]) || body, customer: cust };
  }
  async function list(opt) {
    opt = opt || {};
    var rows = await req('GET', 'gmt_quotes?select=*' + (opt.open ? '&or=(status.in.(open,sent),status.is.null)' : '') + '&order=created_at.desc&limit=' + (opt.limit || 200));
    (rows || []).forEach(function (r) { if (!r.status) r.status = 'open'; });   /* الحالة الفاضية = مفتوح */
    return rows || [];
  }
  async function get(ref) { var r = await req('GET', 'gmt_quotes?ref=eq.' + encodeURIComponent(ref) + '&select=*&limit=1'); r = (r && r[0]) || null; if (r && !r.status) r.status = 'open'; return r; }
  async function mark(ref, patch) {
    return req('PATCH', 'gmt_quotes?ref=eq.' + encodeURIComponent(ref), Object.assign({ updated_at: new Date().toISOString() }, patch), { Prefer: 'return=minimal' });
  }
  function today() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function due(rows) { var t = today(); return (rows || []).filter(function (r) { return (r.status === 'open' || r.status === 'sent') && r.follow_up_at && String(r.follow_up_at).slice(0, 10) <= t; }); }
  /* من صفّ القاعدة ⇒ شكل المحرّر في quote.html */
  function toDraft(r) {
    return { ref: r.ref, created_at: r.created_at, name: r.customer_name || '', phone: r.customer_phone || '', items: (r.items || []).map(function (x) { return Object.assign({}, x); }),
      discount: Number(r.discount) || 0, currency: r.currency || 'usd', rate: Number(r.rate) || 0, valid_days: Number(r.valid_days) || 7, notes: r.notes || '',
      follow_up_at: r.follow_up_at || '', status: r.status, invoice_number: r.invoice_number || '' };
  }
  var ST = { open: 'مفتوح', sent: 'انبعت', converted: 'صار فاتورة', lost: 'ما تمّ' };
  g.GMTQuotes = { save: save, list: list, get: get, mark: mark, due: due, total: total, toDraft: toDraft, saveCustomer: saveCustomer, phone09: phone09, today: today, ST: ST };
})(typeof window !== 'undefined' ? window : globalThis);
