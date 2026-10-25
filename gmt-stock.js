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
    /* (11 ت١ · T-02) الفواتير القديمة بلا عمود «المطلوب»: الأصناف الفاشلة لم تُصفَّر كميّتها (qty = المطلوب) وتُعرَف فقط بأسمائها في ملاحظة الفاتورة.
       استلامُها كان يُضيف للوجهة كميّةً **لم تُخصم من المصدر** (تضاعف المخزون). الآن تُتخطّى حتى تُسوَّى. */
    var legacy = [];
    try {
      var hdr = await rest('GET', 'branch_stock_transfers?id=eq.' + encodeURIComponent(id) + '&select=note,settled&limit=1');
      if (hdr.ok && Array.isArray(hdr.data) && hdr.data[0] && !hdr.data[0].settled) {
        var mm = String(hdr.data[0].note || '').match(/تعذّر خصم\s*\d+\s*صنف\s*:\s*(.+)$/);
        if (mm) legacy = mm[1].split(/[،,]\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
      }
    } catch (_) {}
    for (var i = 0; i < r.data.length; i++) {
      var it = r.data[i], nm = it.product_name || it.product_id || '—', q = Number(it.qty) || 0;
      /* (24 ت1 · TASK-0147) تقدّمٌ لكلّ بند: «جارٍ الاستلام: البند ٥ من ٢٨» (اختياري — لا يغيّر شيئاً لمن لا يمرّره) */
      if (typeof opts.onProgress === 'function') { try { opts.onProgress(i + 1, r.data.length, nm); } catch (_) {} }
      if (itemReceived(it)) { res.skipped.push({ name: nm, why: 'استُلم سابقاً' }); continue; }
      var noReq = (it.requested_qty == null || it.requested_qty === '');
      if (noReq && legacy.indexOf(String(it.product_name || '').trim()) >= 0) { res.waiting.push({ name: nm, why: 'لم يُخصم من المصدر — بانتظار التسوية' }); continue; }
      /* لم يُخصم من المصدر ⇒ لا يُضاف للوجهة؛ تسويتُه (من الجرد) تنقله فعلاً حين تتمّ.
         بند ناقصٌ جزئياً (qty > 0 وdeduction_failed) يُستلم منه ما نُقل فعلاً فقط، والباقي يُضاف عند تسويته. */
      if (it.deduction_failed && q <= 0) { res.waiting.push({ name: nm, why: 'لم يُخصم من المصدر — بانتظار التسوية' }); continue; }
      if (q <= 0 || !it.product_id) { res.skipped.push({ name: nm, why: 'كميّة صفر' }); continue; }
      var mv = await move('add', it.product_id, to, q);
      /* (TASK-0150) id البند + هل السبب انقطاع اتصال (net) — لفصل البنود المتعذّرة فعلاً إلى فاتورةٍ جديدة، لا ما فشل لانقطاعٍ عابر */
      if (!mv.ok) { var _why = friendly(mv.error); res.failed.push({ name: nm, why: _why, id: it.id, net: _why === 'انقطع الاتصال' }); continue; }
      try { await decTransit(it.product_id, to, q); } catch (_) {}
      var mk = false; try { mk = await markReceived(it.id); } catch (_) {}
      if (!mk) res.unmarked.push(nm);
      res.added.push({ name: nm, qty: q, productId: it.product_id, path: mv.path });
      if (typeof opts.onItem === 'function') { try { opts.onItem(it, mv); } catch (_) {} }
    }
    res.ok = res.failed.length === 0;
    return res;
  }

  /* (24 ت1 · TASK-0150 · المالك seq 57) «إذا في أصناف تعذّر نقلها لا تتعلّق الفاتورة كاملة … ننقصها هالبند وهذاك البند تتحوّل
     لفاتورة جديدة معلّقة لبين ما نصلح الموضوع». البنود غير المستلَمة المعطاة تُنقل إلى فاتورةٍ جديدة «في الطريق» بالمصدر والوجهة
     نفسيهما («متبقٍّ من TRF-…»)، فتُختم الأصلية مستلَمةً بما وصل. وإن تعذّر نقل أيٍّ منها يُتراجَع كلّياً (لا فاتورة فارغة ولا بندٌ يتيم). */
  /* رقم فاتورة نقل جديد: الدالّة المتسلسلة في القاعدة، وإلّا رقمٌ زمنيّ فريد */
  async function newTransferNumber() {
    var nr = await rest('POST', 'rpc/next_stock_transfer_number', {});
    if (nr.ok && typeof nr.data === 'string' && /^TRF-/.test(nr.data)) return nr.data;
    var d = new Date(), p = function (x) { return String(x).padStart(2, '0'); };
    return 'TRF-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  async function splitFailed(opts) {
    opts = opts || {};
    var id = opts.transferId, ids = (opts.itemIds || []).filter(Boolean).map(String);
    var out = { ok: false, number: '', id: null, error: '' };
    if (!id || !ids.length) { out.error = 'مُدخَلٌ ناقص'; return out; }
    var h = await rest('GET', 'branch_stock_transfers?id=eq.' + encodeURIComponent(id) + '&select=*&limit=1');
    if (!h.ok || !Array.isArray(h.data) || !h.data[0]) { out.error = 'تعذّر قراءة الفاتورة (HTTP ' + h.status + ')'; return out; }
    var t = h.data[0];
    var num = await newTransferNumber();
    var ins = await rest('POST', 'branch_stock_transfers?select=*', {
      transfer_number: num, from_branch: t.from_branch, from_branch_name: t.from_branch_name || null,
      to_branch: t.to_branch, to_branch_name: t.to_branch_name || null, status: 'pending',
      created_by: opts.by || 'فصلٌ تلقائي عند الاستلام', is_locked: true,
      title: 'متبقٍّ من ' + (t.transfer_number || ''),
      note: 'فُصلت من ' + (t.transfer_number || id) + ' عند الاستلام' + (opts.reason ? ' — ' + String(opts.reason).slice(0, 400) : '')
    }, 'return=representation');
    if (!ins.ok || !Array.isArray(ins.data) || !ins.data[0]) { out.error = 'تعذّر إنشاء الفاتورة الجديدة (HTTP ' + ins.status + ')'; return out; }
    var nt = ins.data[0];
    var mv = await rest('PATCH', 'stock_transfer_items?transfer_id=eq.' + encodeURIComponent(id) + '&id=in.(' + ids.map(encodeURIComponent).join(',') + ')',
      { transfer_id: nt.id }, 'return=representation');
    var moved = (mv.ok && Array.isArray(mv.data)) ? mv.data.length : 0;
    if (moved !== ids.length) {
      if (moved) await rest('PATCH', 'stock_transfer_items?transfer_id=eq.' + encodeURIComponent(nt.id), { transfer_id: id }, 'return=minimal');
      await rest('DELETE', 'branch_stock_transfers?id=eq.' + encodeURIComponent(nt.id), null, 'return=minimal');   // رأسٌ أنشأناه للتوّ فارغ
      out.error = 'تعذّر نقل البنود إلى الفاتورة الجديدة (نُقل ' + moved + ' من ' + ids.length + ') — أُلغيت ولم يتغيّر شيء';
      return out;
    }
    out.ok = true; out.number = nt.transfer_number || num; out.id = nt.id;
    return out;
  }

  /* ══ (TASK-0158 = TASK-0013 · المالك seq 60 + seq 68) فاتورة إعادة إنشاء نقطة البيع ══════════════════════════════════
     «حدّد كل نقطة بيع شو عندها بضائع … أعدّل كميات كل منتج أو كل المنتجات — تعديل سيادي كامل، فقط في بداية الإنشاء …
      وترجع تعمل فاتورة مثل فاتورة النقل: فاتورة إعادة إنشاء». وقرار ١٨ ت١ (ثُبّت seq 68): «يسأل كلّ مرّة» — الفرق في النقطة وحدها،
     أو نقلٌ من/إلى فرعٍ يُختار.
     • الكمّية المحدَّدة **مطلقة**: الفرق يُحسب من قراءةٍ حديثة لحظة الاعتماد (لا من نسخة الشاشة) فتصير النقطة على ما حدّدتَه تماماً.
     • تُكتب كفاتورة نقل (مستلَمة · مقفلة) — وحتى يبقى «سجل الفرع الشامل» صحيحاً (خارجٌ من الفرع/مستلَمٌ فيه) تُقسم بحسب الاتّجاه:
       الزيادات فاتورةٌ **إلى** النقطة، والنقص فاتورةٌ **منها** — والطرف الآخر الفرع المختار أو «تعديل سيادي (إعادة إنشاء)».
     • الحالة أثناء التطبيق `rebuilding` (لا تظهر «واردة» في نقطة البيع ولا تقبل استلاماً) · كل بندٍ طُبّق يُختم received_at
       · ما تعذّر يُذكر في failed_reason (لا deduction_failed: ليست فاتورة تسوية) وفي ملاحظة الفاتورة. */
  var REBUILD_TITLE = 'فاتورة إعادة إنشاء';
  var REBUILD_PSEUDO = { key: 'rebuild', name: 'تعديل سيادي (إعادة إنشاء)' };
  function isRebuild(t) { return !!t && String(t.title || '').indexOf(REBUILD_TITLE) === 0; }
  async function rebuild(opts) {
    opts = opts || {};
    var br = opts.branch || {}, other = opts.mode === 'move' ? (opts.other || null) : null;
    var out = { ok: false, numbers: [], applied: 0, failed: [], skipped: 0, error: '' };
    if (!br.key || !/^[a-z_][a-z0-9_]*$/.test(br.key)) { out.error = 'نقطة البيع غير محدّدة'; return out; }
    if (opts.mode === 'move' && (!other || !other.key || other.key === br.key)) { out.error = 'اختر الفرع الآخر'; return out; }
    var lines = (opts.lines || []).filter(function (l) { return l && l.product_id && isFinite(Number(l.after)) && Number(l.after) >= 0; });
    if (!lines.length) { out.error = 'لا بنود'; return out; }
    /* قراءةٌ حديثة للكمّيات الحاليّة (دفعات) */
    var fresh = {}, ids = lines.map(function (l) { return String(l.product_id); });
    for (var k = 0; k < ids.length; k += 60) {
      var part = ids.slice(k, k + 60);
      var rr = await rest('GET', 'products?id=in.(' + part.map(encodeURIComponent).join(',') + ')&select=id,' + br.key);
      if (!rr.ok || !Array.isArray(rr.data)) { out.error = 'تعذّر قراءة الكمّيات الحاليّة (HTTP ' + rr.status + ')'; return out; }
      rr.data.forEach(function (p) { fresh[String(p.id)] = Number(p[br.key]) || 0; });
    }
    var work = [];
    lines.forEach(function (l) {
      var pid = String(l.product_id);
      if (!(pid in fresh)) { out.failed.push({ name: l.name || pid, why: 'المنتج غير موجود' }); return; }
      var before = fresh[pid], after = Math.round(Number(l.after)), d = after - before;
      if (!d) { out.skipped++; return; }
      work.push({ l: l, pid: pid, before: before, after: after, d: d });
    });
    if (!work.length) { out.ok = !out.failed.length; return out; }
    var src = other || REBUILD_PSEUDO;
    var how = other ? ('نقلٌ من/إلى «' + (other.name || other.key) + '»') : 'في النقطة وحدها (تصحيح سيادي)';
    var groups = [{ dir: 'up', from: src, to: br, w: work.filter(function (x) { return x.d > 0; }) },
                  { dir: 'down', from: br, to: src, w: work.filter(function (x) { return x.d < 0; }) }].filter(function (g) { return g.w.length; });
    var by = opts.by || '', rcv = opts.receivedBy || '';
    for (var gi = 0; gi < groups.length; gi++) {
      var g = groups[gi];
      g.num = await newTransferNumber();
      var hd = await rest('POST', 'branch_stock_transfers?select=*', {
        transfer_number: g.num, from_branch: g.from.key, from_branch_name: g.from.name || g.from.key,
        to_branch: g.to.key, to_branch_name: g.to.name || g.to.key, status: 'rebuilding', is_locked: true,
        title: REBUILD_TITLE + ' — ' + (br.name || br.key) + (groups.length > 1 ? (g.dir === 'up' ? ' · الزيادات' : ' · النقص') : ''),
        created_by: by || null, received_by: rcv || null,
        note: 'إعادة إنشاء «' + (br.name || br.key) + '» — ' + how + (by ? ' · اعتمدها ' + by : '') + (rcv ? ' · المستلم ' + rcv : '')
      }, 'return=representation');
      if (!hd.ok || !Array.isArray(hd.data) || !hd.data[0]) {
        for (var gj = 0; gj < gi; gj++) await rest('DELETE', 'branch_stock_transfers?id=eq.' + encodeURIComponent(groups[gj].id), null, 'return=minimal');
        out.error = 'تعذّر إنشاء الفاتورة (HTTP ' + hd.status + ') — لم يتغيّر شيء'; return out;
      }
      g.id = hd.data[0].id;
      var it = await rest('POST', 'stock_transfer_items?select=id,product_id', g.w.map(function (x) {
        return { transfer_id: g.id, product_id: x.pid, product_name: x.l.name || '', barcode: x.l.barcode || null, image_url: x.l.image_url || null,
                 qty: Math.abs(x.d), requested_qty: Math.abs(x.d), unit_cost: Number(x.l.unit_cost) || 0, sale_price: Number(x.l.sale_price) || 0,
                 notes: 'قبل ' + x.before + ' ⇐ بعد ' + x.after + ' (' + (x.d > 0 ? '+' : '−') + Math.abs(x.d) + ')' };
      }), 'return=representation');
      if (!it.ok || !Array.isArray(it.data) || it.data.length !== g.w.length) {
        for (var gk = 0; gk <= gi; gk++) await rest('DELETE', 'branch_stock_transfers?id=eq.' + encodeURIComponent(groups[gk].id), null, 'return=minimal');
        out.error = 'تعذّر كتابة بنود الفاتورة (HTTP ' + it.status + ') — لم يتغيّر شيء'; return out;
      }
      var byPid = {}; it.data.forEach(function (r) { byPid[String(r.product_id)] = r.id; });
      g.w.forEach(function (x) { x.itemId = byPid[x.pid]; x.g = g; });
    }
    /* التطبيق — بنداً بنداً، مع التقدّم */
    var all = [].concat.apply([], groups.map(function (g) { return g.w; })), n = all.length;
    for (var i = 0; i < n; i++) {
      var x = all[i], qty = Math.abs(x.d), why = '';
      try { if (typeof opts.onProgress === 'function') opts.onProgress(i + 1, n, x.l.name || ''); } catch (_) {}
      if (!other) {
        var r1 = await move(x.d > 0 ? 'add' : 'deduct', x.pid, br.key, qty);
        if (!r1.ok) why = r1.error || 'تعذّر';
      } else if (x.d > 0) {                                  // الزيادة تُخصم من الفرع المختار ثمّ تُضاف للنقطة
        /* رصيد الفرع الآخر يُفحص أوّلاً: المسار الاحتياطي يقصّ الخصم عند الصفر (لا سالب) فيبدو ناجحاً وتُخلق بضاعةٌ من لا شيء */
        var av = null; try { av = await readQty(x.pid, other.key); } catch (_) {}
        var a1 = (av !== null && av < qty) ? { ok: false, error: 'الرصيد فيه ' + av + ' أقلّ من ' + qty } : await move('deduct', x.pid, other.key, qty);
        if (!a1.ok) why = 'لم يُخصم من «' + (other.name || other.key) + '»: ' + (a1.error || '');
        else { var a2 = await move('add', x.pid, br.key, qty); if (!a2.ok) { await move('add', x.pid, other.key, qty); why = a2.error || 'تعذّرت الإضافة'; } }
      } else {                                                // النقص يُخصم من النقطة ويُعاد للفرع المختار
        var b1 = await move('deduct', x.pid, br.key, qty);
        if (!b1.ok) why = b1.error || 'تعذّر الخصم';
        else { var b2 = await move('add', x.pid, other.key, qty); if (!b2.ok) { await move('add', x.pid, br.key, qty); why = 'لم يُعَد إلى «' + (other.name || other.key) + '»: ' + (b2.error || ''); } }
      }
      if (why) {
        out.failed.push({ name: x.l.name || x.pid, why: friendly(why) });
        if (x.itemId) await rest('PATCH', 'stock_transfer_items?id=eq.' + encodeURIComponent(x.itemId), { failed_reason: 'لم يُطبَّق: ' + String(friendly(why)).slice(0, 200) }, 'return=minimal');
      } else {
        out.applied++;
        if (x.itemId) await rest('PATCH', 'stock_transfer_items?id=eq.' + encodeURIComponent(x.itemId), { received_at: new Date().toISOString() }, 'return=minimal');
      }
    }
    /* الختم: مستلَمة · والملاحظة تذكر الفاتورة الأخرى وما تعذّر */
    for (var gm = 0; gm < groups.length; gm++) {
      var G = groups[gm], bad = G.w.filter(function (x) { return out.failed.some(function (f) { return f.name === (x.l.name || x.pid); }); });
      var mate = groups.length > 1 ? groups[1 - gm].num : '';
      await rest('PATCH', 'branch_stock_transfers?id=eq.' + encodeURIComponent(G.id), {
        status: 'received', received_at: new Date().toISOString(),
        note: 'إعادة إنشاء «' + (br.name || br.key) + '» — ' + how + (by ? ' · اعتمدها ' + by : '') + (rcv ? ' · المستلم ' + rcv : '') +
              (mate ? ' · مع ' + mate : '') + (bad.length ? ' | لم يُطبَّق ' + bad.length + ': ' + bad.map(function (x) { return x.l.name || x.pid; }).join('، ').slice(0, 300) : '')
      }, 'return=minimal');
      out.numbers.push(G.num);
    }
    out.ok = !out.failed.length;
    return out;
  }

  global.GMTStock = {
    move: move,
    transfer: transfer,
    receiveTransfer: receiveTransfer,
    splitFailed: splitFailed,
    rebuild: rebuild,
    isRebuild: isRebuild,
    REBUILD_TITLE: REBUILD_TITLE,
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
