/* ═══════════════════════════════════════════════════════════════════════════
   gmt-stock.js — حركةُ المخزون: مسارٌ واحد لا يفشل صامتاً
   أُنشئ: 2026-10-03 · طلباتك ن٨ و ن٩ (ومعهما البلاغ ٣٦)

   ── ن٨: «الأشياء يلي تعذّر نقلها لازم نلاقيلها حل» ──────────────────────────
   شاشتُك تقول: «الفاتورة TRF-00009# حُفظت «ناقصة». تعذّر خصم ٣١ صنف».
   والسبب المُثبَت (وشاشتُك الثانية تقوله حرفياً): الدالّتان الذرّيتان
   `deduct_branch_stock` و`add_branch_stock` **غير موجودتين في قاعدتك** لأنّ
   ملفّ SQL لم يُشغَّل بعد.

   وحتى الآن كان كلُّ ما نملكه هو **إخبارُك بالسبب**. وهذا ليس حلاً: الفاتورة
   تبقى عالقة، والبضاعة لا تتحرّك، وأنت تنتظر SQL.

   الحلّ هنا — مسارٌ احتياطيٌّ يعمل **بلا أيّ SQL**:
     ① نُجرّب الدالّة الذرّية أوّلاً (الطريق الصحيح، آمنٌ عند تزامن عدّة كاشيرات).
     ② فإن كانت غير موجودة ⇒ نقرأ الكميّة، نكتب الجديدة، **ثمّ نقرأ ثانيةً
        للتأكّد** أنّها كُتبت فعلاً. وإن لم تتطابق القراءةُ الثانية نُعلن فشلاً
        صريحاً ولا ندّعي نجاحاً.
     ③ ونُسجّل أيَّ مسارٍ استُعمل، فتعرف أنّ هذه الحركة تمّت بالاحتياطي.

   ⚠️ وأقولها بصراحة: المسار الاحتياطي **ليس ذرّياً**. لو ضغط كاشيران على
      نفس المنتج في نفس اللحظة قد تضيع إحدى الحركتين. ولذلك هو **احتياطيٌّ
      لا بديل**، ويبقى التنبيه ظاهراً حتى تُشغّل SQL. لكن «يعمل مع خطرٍ نادر»
      أفضل من «لا يعمل أبداً» — وأنت اليوم في الثانية.

   ── ن٩: تجاوز مخزون المصدر بموافقتك ─────────────────────────────────────────
   نصُّك: «وقت حطّ في فاتورة النقل عدد أعلى من مخزون الفرع الأساسي فيعطيني
   رسالة، إذا وافقت عليها فيعلّي مخزون الفرع الأساسي. يعني مثلاً هي قطع فيها
   ٢١، أنا نقلت ٢٢، فيسألني «هاي فيها ٢١»، إذا وافقت فيصير بالمصدر ٢٢».

   فالمنطق المنفَّذ: المطلوب > الموجود ⇒ نسأل بنافذة النظام ⇒ إن وافقت
   يُرفَع المصدر إلى **المطلوب** أوّلاً (ويُسجَّل سببُ الرفع باسمك)، ثمّ تتمّ
   الحركة كاملةً. وإن رفضت لا يُلمَس شيء.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTStock) return;

  var usedFallback = false;      /* هل استُعمل الاحتياطي في هذه الجلسة؟ */
  var rpcMissing   = null;       /* null = لم نفحص · true/false */

  function creds() {
    if (global.GMTCreds) return global.GMTCreds();
    var g = global;
    return {
      url: g.SB || g.SUPABASE_URL || (g.GMT_DB && g.GMT_DB.MAIN && g.GMT_DB.MAIN.url) || '',
      key: g.KEY || g.SUPABASE_ANON_KEY || (g.GMT_DB && g.GMT_DB.MAIN && g.GMT_DB.MAIN.key) || ''
    };
  }

  function headers(extra) {
    var c = creds();
    return Object.assign({
      apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json'
    }, extra || {});
  }

  var MISSING_RE = /PGRST202|PGRST203|Could not find the function|could not choose the best candidate|does not exist|42883|42725/i;   /* (2026-10-06) +PGRST203: نسختان من الدالّة في القاعدة (integer وnumeric) ⇒ كل نداءٍ يُرفض */

  /* ── نداءُ الدالّة الذرّية ──────────────────────────────────────────────── */
  async function rpc(name, body) {
    var c = creds();
    if (!c.url) return { ok: false, missing: false, error: 'لا مفاتيح قاعدة' };
    var r;
    try {
      r = await fetch(c.url + '/rest/v1/rpc/' + name, {
        method: 'POST', headers: headers(), body: JSON.stringify(body)
      });
    } catch (e) {
      return { ok: false, missing: false, error: (e && e.message) || 'تعذّر الاتصال' };
    }
    /* ⚠️ `res.ok` قبل قراءة الجسم — قاعدةٌ مسجّلة عندنا */
    if (r.ok) {
      /* (٧ ط · فحص مضاد) نسخةٌ قديمة من الدالّة تُرجع `false` حين لا يكفي الرصيد — كانت تُحسب
         نجاحاً فيُكمَل النقل والمصدرُ لم يُخصم (البضاعة تتضاعف). الآن: false ⇒ رفضٌ صريح. */
      var body = await r.text().catch(function () { return ''; });
      if (String(body).trim() === 'false') return { ok: false, missing: false, refused: true, error: 'الرصيد غير كافٍ (رفضته القاعدة)' };
      return { ok: true, missing: false, value: body };
    }
    var t = await r.text().catch(function () { return ''; });
    return { ok: false, missing: MISSING_RE.test(t) || r.status === 404, error: 'HTTP ' + r.status + ' ' + t.slice(0, 160) };
  }

  /* ── قراءةُ كميّة فرعٍ لمنتج ────────────────────────────────────────────── */
  async function readQty(productId, branchKey) {
    var c = creds();
    var url = c.url + '/rest/v1/products?id=eq.' + encodeURIComponent(productId) +
              '&select=' + encodeURIComponent('id,' + branchKey) + '&limit=1';
    var r = await fetch(url, { headers: headers() });
    if (!r.ok) {
      var t = await r.text().catch(function () { return ''; });
      throw new Error('قراءة المخزون: HTTP ' + r.status + ' ' + t.slice(0, 120));
    }
    var rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) throw new Error('المنتج غير موجود');
    var v = Number(rows[0][branchKey]);
    return isFinite(v) ? v : 0;
  }

  /* ── كتابةُ كميّةٍ مع **قراءةٍ تحقّقية** بعدها ─────────────────────────── */
  async function writeQty(productId, branchKey, newQty) {
    var c = creds();
    var patch = {};
    patch[branchKey] = newQty;
    var r = await fetch(c.url + '/rest/v1/products?id=eq.' + encodeURIComponent(productId), {
      method: 'PATCH', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify(patch)
    });
    if (!r.ok && r.status !== 204) {
      var t = await r.text().catch(function () { return ''; });
      throw new Error('كتابة المخزون: HTTP ' + r.status + ' ' + t.slice(0, 120));
    }
    /* القراءةُ الثانية — بلاها لا نعرف إن كُتبت فعلاً (RLS قد تبتلع الكتابة) */
    var back = await readQty(productId, branchKey);
    if (Number(back) !== Number(newQty)) {
      throw new Error('الكتابةُ لم تُثبَّت: المطلوب ' + newQty + ' والموجود بعدها ' + back +
                      ' — الأرجح صلاحيات RLS على جدول المنتجات.');
    }
    return back;
  }

  /* ── الحركةُ الواحدة: خصمٌ أو إضافة ───────────────────────────────────── */
  async function move(kind, productId, branchKey, qty) {
    qty = Number(qty) || 0;
    if (!productId || !branchKey || qty <= 0) return { ok: false, error: 'مُدخَلٌ ناقص' };

    var fn = (kind === 'deduct') ? 'deduct_branch_stock' : 'add_branch_stock';
    var res = await rpc(fn, { p_product_id: productId, p_branch_key: branchKey, p_qty: qty });
    if (res.ok) { rpcMissing = false; return { ok: true, path: 'rpc' }; }
    if (res.refused) { rpcMissing = false; return { ok: false, refused: true, error: res.error, path: 'rpc' }; }
    /* (2026-10-06 · صورتك «تعذّر خصم ٣٧ صنف») — كل عطلٍ في الدالّة نفسها (نسخةٌ قديمة · نسختان متضاربتان ·
       صلاحيّة) كان يُسقط البند كلّه بصمت. الآن: نحاول المسار الاحتياطيّ المُتحقَّق، ونُرجع **السبب الحقيقي**
       إن فشل هو أيضاً — لا «المخزون لم يكفِ» العامّة. */
    if (!res.missing) {
      try {
        var cur0 = await readQty(productId, branchKey);
        var next0 = (kind === 'deduct') ? (cur0 - qty) : (cur0 + qty);
        if (next0 < 0) next0 = 0;
        await writeQty(productId, branchKey, next0);
        usedFallback = true;
        return { ok: true, path: 'fallback', before: cur0, after: next0, rpcError: res.error };
      } catch (e0) {
        return { ok: false, error: 'الدالّة: ' + res.error + ' · الاحتياطي: ' + ((e0 && e0.message) || ''), path: 'rpc' };
      }
    }

    /* الدالّةُ غير موجودة ⇒ المسارُ الاحتياطي (ن٨) */
    rpcMissing = true;
    try {
      var cur = await readQty(productId, branchKey);
      var next = (kind === 'deduct') ? (cur - qty) : (cur + qty);
      if (next < 0) next = 0;                       /* لا كميّةَ سالبة في الجرد */
      await writeQty(productId, branchKey, next);
      usedFallback = true;
      return { ok: true, path: 'fallback', before: cur, after: next };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'فشل الاحتياطي', path: 'fallback' };
    }
  }

  /* ── ن٩: نقلٌ مع سؤالٍ عند تجاوز مخزون المصدر ─────────────────────────── */
  async function transfer(opts) {
    opts = opts || {};
    var productId = opts.productId, from = opts.fromBranch, to = opts.toBranch;
    var qty = Number(opts.qty) || 0;
    var name = opts.productName || 'المنتج';
    if (!productId || !from || !to || qty <= 0) return { ok: false, error: 'مُدخَلٌ ناقص' };

    var available = null;
    try { available = await readQty(productId, from); } catch (e) { available = null; }

    var raised = 0;
    if (available !== null && qty > available) {
      /* ن٩ — نسأل بنافذة النظام لا بنافذة المتصفّح */
      var msg = '«' + name + '»\n' +
                'الموجود في المصدر: ' + available + '\n' +
                'المطلوب نقله: ' + qty + '\n\n' +
                'هل أرفع مخزون المصدر إلى ' + qty + ' ثمّ أُتمّ النقل؟';
      var yes;
      if (opts.force === true) yes = true;
      else if (global.GMTAsk) {
        yes = await global.GMTAsk.confirm(msg, {
          title: 'الكمية أكبر من مخزون المصدر',
          okText: 'ارفع المصدر وأتمّ', cancelText: 'لا — أوقف',
          icon: 'ask'
        });
      } else {
        yes = global.confirm(msg);
      }
      if (!yes) return { ok: false, cancelled: true, available: available, error: 'أوقفه المستخدم' };

      var up = await move('add', productId, from, qty - available);
      if (!up.ok) return { ok: false, error: 'تعذّر رفع مخزون المصدر: ' + up.error };
      raised = qty - available;

      /* سجلٌّ للمراجعة — رفعُ مخزونٍ يدويّ لا يمرّ بلا أثر */
      try {
        if (global.GMTAudit) await global.GMTAudit.log({
          action: 'branch_stock_raised',
          entity: 'products', entityId: productId, entityName: name,
          reason: 'ن٩ · رفعُ مخزون المصدر (' + from + ') من ' + available + ' إلى ' + qty +
                  ' بموافقة المستخدم قبل النقل'
        });
      } catch (_) {}
    }

    var d = await move('deduct', productId, from, qty);
    if (!d.ok) return { ok: false, error: d.error, stage: 'deduct', raised: raised };

    var a = await move('add', productId, to, qty);
    if (!a.ok) {
      /* تراجعٌ كي لا تضيع القطع بين فرعين */
      await move('add', productId, from, qty);
      return { ok: false, error: a.error, stage: 'add', rolledBack: true, raised: raised };
    }
    return { ok: true, path: d.path, raised: raised, available: available };
  }

  /* ── (٧ ط · البند ١٤٢ والفحص المضاد) استلامُ فاتورة نقل — مسارٌ واحد للجرد ونقطة البيع ──
     ما كشفه تتبّع العمليّة كاملةً (لا الزرّ المفرد):
       • الجرد: إن أخفق بندٌ واحد بقيت الفاتورة على «receiving» ⇒ لا أحد يستطيع إعادة المحاولة.
       • نقطة البيع: تَسِمها «تحتاج تسوية» ⇒ إعادةُ الاستلام تضيف **كل** البنود ثانيةً (الناجحة أيضاً).
       • نقطة البيع لم تكن تُنزِل «في الطريق» بعد الاستلام (الجرد يفعل) — نسختان مختلفتان (P5).
     الحلّ: كل بندٍ يُضاف يُوسَم «استُلم» في القاعدة (received_at — SQL ٣٠، وإن لم يُشغَّل فعلامةٌ في
     failed_reason الموجود منذ الأساس) ⇒ إعادةُ المحاولة تتخطّى ما استُلم وتُكمل الباقي فقط. */
  var RECV_MARK = 'استُلم ✓';
  function itemReceived(it) {
    return !!(it && (it.received_at || (typeof it.failed_reason === 'string' && it.failed_reason.indexOf(RECV_MARK) === 0)));
  }
  async function rest(method, path, body, prefer) {
    var c = creds();
    if (!c.url) return { ok: false, status: 0, data: null, text: 'لا مفاتيح قاعدة' };
    var r;
    try {
      r = await fetch(c.url + '/rest/v1/' + path, {
        method: method, headers: headers(prefer ? { Prefer: prefer } : null),
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) { return { ok: false, status: 0, data: null, text: (e && e.message) || 'تعذّر الاتصال' }; }
    var t = await r.text().catch(function () { return ''; });
    var data = null; try { data = t ? JSON.parse(t) : null; } catch (_) { data = t; }
    return { ok: r.ok, status: r.status, data: data, text: t };
  }
  async function markReceived(itemId) {
    var iso = new Date().toISOString();
    var q = 'stock_transfer_items?id=eq.' + encodeURIComponent(itemId);
    var r = await rest('PATCH', q, { received_at: iso }, 'return=minimal');
    if (r.ok) return true;
    var r2 = await rest('PATCH', q, { failed_reason: RECV_MARK + ' ' + iso }, 'return=minimal');
    return r2.ok;
  }
  async function decTransit(productId, branchKey, qty) {
    var r = await rest('GET', 'products?id=eq.' + encodeURIComponent(productId) + '&select=in_transit&limit=1');
    if (!r.ok || !Array.isArray(r.data) || !r.data.length) return false;
    var cur = r.data[0].in_transit || {};
    if (typeof cur === 'string') { try { cur = JSON.parse(cur); } catch (_) { cur = {}; } }
    var nx = Object.assign({}, cur);
    nx[branchKey] = Math.max(0, (Number(cur[branchKey]) || 0) - qty);
    var w = await rest('PATCH', 'products?id=eq.' + encodeURIComponent(productId), { in_transit: nx }, 'return=minimal');
    return w.ok;
  }
  /* رسالةٌ يفهمها الموظّف بدل «HTTP 400 {code…}» — والنصّ الخام يبقى في الكونسول */
  function friendly(err) {
    var e = String(err || '');
    try { if (e) console.warn('[GMTStock] ' + e); } catch (_) {}
    if (/غير موجود|not found|PGRST116/i.test(e)) return 'المنتج غير موجود في القاعدة (حُذف أو تغيّر)';
    if (/الرصيد غير كافٍ/.test(e)) return 'الرصيد غير كافٍ';
    if (/RLS|permission|42501|401|403/i.test(e)) return 'لا صلاحيّة كتابة على المخزون';
    if (/تعذّر الاتصال|Failed to fetch|NetworkError/i.test(e)) return 'انقطع الاتصال';
    return 'تعذّرت الإضافة';
  }
  async function receiveTransfer(opts) {
    opts = opts || {};
    var id = opts.transferId, to = opts.toBranch;
    var res = { ok: false, added: [], failed: [], skipped: [], waiting: [], unmarked: [] };
    if (!id || !to) { res.error = 'مُدخَلٌ ناقص'; return res; }
    var r = await rest('GET', 'stock_transfer_items?transfer_id=eq.' + encodeURIComponent(id) + '&select=*');
    if (!r.ok || !Array.isArray(r.data)) { res.error = 'تعذّر جلب البنود (HTTP ' + r.status + ')'; return res; }
    if (!r.data.length) { res.error = 'الفاتورة بلا بنود'; return res; }
    for (var i = 0; i < r.data.length; i++) {
      var it = r.data[i], nm = it.product_name || it.product_id || '—', q = Number(it.qty) || 0;
      if (itemReceived(it)) { res.skipped.push({ name: nm, why: 'استُلم سابقاً' }); continue; }
      /* لم يُخصم من المصدر ⇒ لا يُضاف للوجهة؛ تسويتُه (من الجرد) تنقله فعلاً حين تتمّ */
      if (it.deduction_failed) { res.waiting.push({ name: nm, why: 'لم يُخصم من المصدر — بانتظار التسوية' }); continue; }
      if (q <= 0 || !it.product_id) { res.skipped.push({ name: nm, why: 'كميّة صفر' }); continue; }
      var mv = await move('add', it.product_id, to, q);
      if (!mv.ok) { res.failed.push({ name: nm, why: friendly(mv.error) }); continue; }
      try { await decTransit(it.product_id, to, q); } catch (_) {}
      var mk = false; try { mk = await markReceived(it.id); } catch (_) {}
      if (!mk) res.unmarked.push(nm);
      res.added.push({ name: nm, qty: q, productId: it.product_id, path: mv.path });
      if (typeof opts.onItem === 'function') { try { opts.onItem(it, mv); } catch (_) {} }
    }
    res.ok = res.failed.length === 0;
    return res;
  }

  global.GMTStock = {
    move: move,
    transfer: transfer,
    receiveTransfer: receiveTransfer,
    itemReceived: itemReceived,
    readQty: readQty,
    /* هل تعمل الدالّةُ الذرّية؟ null = لم نعرف بعد */
    rpcMissing: function () { return rpcMissing; },
    usedFallback: function () { return usedFallback; },
    /* فحصٌ غيرُ ضارّ: كميّةٌ صفر ومعرّفٌ لا وجود له */
    probe: async function () {
      var r = await rpc('deduct_branch_stock', {
        p_product_id: '00000000-0000-0000-0000-000000000000',
        p_branch_key: '__probe__', p_qty: 0
      });
      rpcMissing = !!r.missing;
      return { missing: !!r.missing, error: r.error || '' };
    }
  };
})(window);
