/* ═════════════════════════════════════════════════════════════════════
   gmt-serial.js — قراءة وتحليل IMEI والرقم التسلسلي (محلّي فوري · بلا ذكاء اصطناعي ولا شبكة)
   TASK-B0537 · المالك seq B1038–B1039 «نظام GMT الذكي لإدارة IMEI و Serial Numbers».

   القواعد من نصّ المالك:
     • «حلّل محتوى القراءة · استخرج الرقم من النص · تعرّف على IMEI ضمن نصّ أطول · Serial حتى لو مسبوقاً
        بكلمات أو رموز · تعامل مع الفواصل والمسافات · لا تعتمد على طول الرقم وحده».
     • «إذا احتوت القراءة على أكثر من رقم اعرض الأرقام المستخرجة ليتم اعتمادها».
     • «إذا لم يكن نوع الرقم واضحاً لا تخمّن ولا تحفظ رقماً غير موثوق».
     • «لا تستخدم الذكاء الاصطناعي كشرط لكل عملية مسح» ⇒ هذا الملفّ محلّي بالكامل.

   GMTSerial.parse(raw) ⇒ { candidates:[{code, kind:'imei'|'serial', why, sure}], clear:bool }
     clear = مرشّحٌ واحد موثوق (sure) ⇒ يُعتمد مباشرة؛ غير ذلك ⇒ يُعرض للاختيار ولا يُحفظ تلقائياً.
   GMTSerial.luhn(d) · GMTSerial.norm(code) · GMTSerial.need(product) ⇒ ''|'serial'|'imei'|'both'
   ═════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  function luhn(d) {
    d = String(d || ''); if (!/^\d+$/.test(d)) return false;
    var s = 0, alt = false;
    for (var i = d.length - 1; i >= 0; i--) { var n = d.charCodeAt(i) - 48; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; }
    return s % 10 === 0;
  }
  /* الأرقام العربية/الفارسية ⇒ لاتينية · حروف كبيرة · بلا فواصل داخلية */
  function latin(s) {
    return String(s == null ? '' : s).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x660; }).replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 0x6F0; });
  }
  function norm(code) { return latin(code).toUpperCase().replace(/[\s\-_.:\/]/g, ''); }
  function add(list, code, kind, why, sure) {
    code = norm(code); if (!code || code.length < 5) return;
    if (list.some(function (c) { return c.code === code; })) return;
    list.push({ code: code, kind: kind, why: why, sure: !!sure });
  }

  function parse(raw) {
    var s = latin(raw).replace(/ /g, ' ').trim(), out = [];
    if (!s) return { candidates: [], clear: false };
    /* ① حقولٌ موسومة: «IMEI: …» · «IMEI1/IMEI2» · «S/N» · «SN» · «Serial No» · «الرقم التسلسلي» */
    var reImei = /IMEI\s*\d?\s*[:#=\-]?\s*([0-9][0-9\s\-]{13,20}[0-9])/gi, m;
    while ((m = reImei.exec(s))) { var d = m[1].replace(/\D/g, ''); if (d.length === 15 && luhn(d)) add(out, d, 'imei', 'موسوم IMEI · Luhn ✓', true); else if (d.length >= 14 && d.length <= 16) add(out, d, 'imei', 'موسوم IMEI لكن التحقّق (Luhn) لم ينجح', false); }
    var reSn = /(?:S\s*\/\s*N|\bSN\b|SERIAL\s*(?:NO|NUMBER|#)?|الرقم\s*التسلسلي|سيريال)\s*[:#=\-]?\s*([A-Z0-9][A-Z0-9\-]{3,30})/gi;
    while ((m = reSn.exec(s))) add(out, m[1], 'serial', 'موسوم S/N', true);
    /* ② GS1 (باركود ثنائي الأبعاد): المعرّف (21) = رقم تسلسلي · مفصولٌ بـ GS أو بين قوسين */
    var reGs = /\(21\)([A-Z0-9\-]{4,20})|\x1d21([A-Z0-9\-]{4,20})/gi;
    while ((m = reGs.exec(s))) add(out, m[1] || m[2], 'serial', 'GS1 (21)', true);
    if (out.length) return { candidates: out, clear: out.length === 1 && out[0].sure };
    /* ③ بلا وسم: كلّ «كلمة» مرشّحة — ١٥ رقماً تحقّق Luhn ⇒ IMEI · أحرف وأرقام مختلطة ⇒ رقم تسلسلي · رقمٌ صرف بغير ذلك ⇒ غير واضح */
    var toks = s.split(/[\s,;|]+/).map(function (t) { return t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''); }).filter(Boolean);
    toks.forEach(function (t) {
      var d = t.replace(/\D/g, '');
      if (/^\d+$/.test(t.replace(/-/g, ''))) {
        if (d.length === 15 && luhn(d)) add(out, d, 'imei', '١٥ رقماً · Luhn ✓', true);
        else if (d.length >= 8) add(out, d, 'serial', 'رقمٌ صرف — قد يكون باركود صنف لا رقم قطعة', false);
      } else if (/[A-Za-z]/.test(t) && /\d/.test(t) && t.replace(/-/g, '').length >= 6) add(out, t, 'serial', 'أحرف وأرقام', true);
    });
    return { candidates: out, clear: out.length === 1 && out[0].sure };
  }
  /* ما يحتاجه المنتج: من إعداده (products.serial_req) — لا افتراض بالتصنيف (المالك: «لا تفترض … اجعل الإدارة قادرة على التحكم») */
  function need(p) { var v = String((p && p.serial_req) || '').trim(); return /^(serial|imei|both)$/.test(v) ? v : ''; }
  /* هل يناسب الرقمُ ما يحتاجه المنتج؟ (IMEI لمنتجٍ يطلب IMEI · رقم تسلسلي لمنتجٍ يطلبه · «both» يقبل الاثنين) */
  function fits(c, req) { return !req || req === 'both' || c.kind === req; }

  /* (TASK-B0544 · المالك seq B1038 «المرتجع/الاستبدال يطابق الرقم») الأجهزة المرتجعة ⇒ «مرتجع» بسجلّها + حدث بتاريخها.
     o = { url, headers() } · codes = الأرقام · info = { saleInvoiceId, refundInv, by }
     الشرط: الرقم مبيوع بنفس الفاتورة (لا نلمس جهازاً بِيع بفاتورة أخرى) ⇒ يرجع عدد ما تعلّم. */
  async function markReturned(o, codes, info) {
    info = info || {}; var n = 0;
    var H = function (x) { var h = typeof o.headers === 'function' ? o.headers() : (o.headers || {}); return Object.assign({ 'Content-Type': 'application/json' }, h, x || {}); };
    for (var i = 0; i < (codes || []).length; i++) {
      var code = norm(codes[i]); if (!code) continue;
      try {
        var q = o.url + '/rest/v1/gmt_serials?code=eq.' + encodeURIComponent(code) + '&status=eq.sold' + (info.saleInvoiceId != null ? '&sale_invoice_id=eq.' + encodeURIComponent(String(info.saleInvoiceId)) : '') + '&select=id,history&limit=1';
        var g = await fetch(q, { headers: H() }); var ex = g.ok ? (await g.json())[0] : null; if (!ex) continue;
        var ev = { at: new Date().toISOString(), ev: 'returned', ref: info.refundInv || '', by: info.by || '' };
        var r = await fetch(o.url + '/rest/v1/gmt_serials?id=eq.' + encodeURIComponent(ex.id) + '&status=eq.sold', { method: 'PATCH', headers: H({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ status: 'returned', history: (Array.isArray(ex.history) ? ex.history : []).concat([ev]) }) });
        if (r.ok) n++;
      } catch (_) {}
    }
    return n;
  }
  /* أرقام بند فاتورة (invoice_items.serials — jsonb أو نصّ) */
  function codesOf(item) { var v = item && item.serials; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { v = []; } } return (Array.isArray(v) ? v : []).map(function (x) { return x && (x.code || x); }).filter(Boolean); }

  var api = { parse: parse, luhn: luhn, norm: norm, need: need, fits: fits, markReturned: markReturned, codesOf: codesOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') global.GMTSerial = api;
})(typeof window !== 'undefined' ? window : globalThis);
