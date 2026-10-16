/* ═══════════════════════════════════════════════════════════════════════════
   gmt-ledger.js — دفتر المحاسبة (مصدرٌ واحد لصندوق الإدارة المركزي والربح وربط فواتير الشراء بالمصاريف)
   ───────────────────────────────────────────────────────────────────────────
   لماذا؟ لوحة المحاسبة كانت تُظهر «الصندوق المركزي 0.00$» و«الربح 0.00$» بينما بقية البطاقات أرقامها كبيرة:
     • الصندوق كان يُحسب لشهرٍ واحدٍ فقط (فشهرٌ بلا فواتير = صفر) — والصندوق رصيدٌ متراكم لا حركة شهر؛
     • الربح يُعدّ فواتيراً بلا كلفة معروفة كأنّ كلفتها صفر (فيتضخّم) أو يصير صفراً بلا تفسير؛
     • دفعات فواتير الشراء والجمارك لم تكن تدخل الحسابات إلّا بزرٍّ يدويّ يُدخلها «مصروفاً» فتُحسب مرّتين (الكلفة + المصروف).
   ما يقدّمه هذا الملف (دوالّ صرفة قابلة للاختبار بلا شبكة، ثم مزامنة الشراء):
     GMTLedger.centralCash(ctx, range) — صندوق الإدارة المركزي: افتتاحي + (مقبوض مبيعات المقرّ + ما رُحّل من الفروع
         + التحصيلات) − (مصاريف المقرّ من درجه + عمولات مدفوعة + مصاريف الإدارة + مشتريات واستيراد دفعتها الإدارة).
         المصروف الذي دُفع من صندوق فرعٍ **لا** يُنقَص من المركزي ثانيةً (نقص من درج الفرع فوصل المركزيَّ أقلّ).
     GMTLedger.profit(ctx, range, costFn) — الربح على الفواتير **معروفة الكلفة فقط**، ومبيعات بلا كلفة تُعدّ وتُقال.
         المشتريات والجمارك ليست مصروفاً في الربح (هي كلفة بضاعة تدخل net_cost) — تظهر خروجَ نقدٍ فقط.
     GMTLedger.syncPurchase(api, purchase, opts) — يطابق دفعات فاتورة شراء مع gmt_expenses بدفترٍ إضافيّ فقط
         (صفٌّ جديد بالفرق، موجبٌ أو سالب، بوسم [PO:<id>:<g|c>:<n>] في الملاحظة) — لا تعديل ولا حذف لصفّ سابق
         فيبقى الأثر كاملاً، و«من دفع» محفوظٌ في كل صفّ. التكرار آمن: الفرق صفرٌ ⇒ لا كتابة.
   لا SQL جديد: كل شيءٍ على أعمدة gmt_expenses الموجودة (والأعمدة غير الموجودة تُسقَط عند PGRST204 ثم يُعاد).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTLedger) return;

  var TAG_RE = /\[PO:([^:\]]+):([gc]):(\d+)\]/;
  var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  var num = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };

  /* ── تعريفات ── */
  function usd(e) {
    var a = num(e && e.amount);
    if (!e || !e.currency || String(e.currency).toLowerCase() === 'usd') return a;
    var rt = num(e.exchange_rate) || num(window.GMT_DEFAULT_RATE) || 140;
    return a / rt;
  }
  function poInfo(e) {
    var m = TAG_RE.exec(String((e && e.note) || ''));
    return m ? { pid: m[1], part: m[2], seq: num(m[3]) } : null;
  }
  function isCapital(e) {
    return /^رأسمالي/.test(String((e && e.kind) || '')) || /النوع:\s*رأسمالي/.test(String((e && e.note) || ''));
  }
  function paidByAdmin(e) { return /دفعتها الإدارة/.test(String((e && e.note) || '')); }
  /* من أين خرج النقد؟ central = جيب الإدارة/صندوقها · branch = درج فرع (نقص منه بحركة type='expense') */
  function cashSource(e) {
    if (!e) return 'central';
    if (poInfo(e)) return e.branch_key && !e.is_general ? 'branch' : 'central';
    if (e.is_general || !e.branch_key) return 'central';
    return paidByAdmin(e) ? 'central' : 'branch';
  }
  /* نوع المصروف للحساب: po (مشتريات/استيراد — خروج نقد لا مصروف ربح) · capital · op */
  function expClass(e) { return poInfo(e) ? 'po' : (isCapital(e) ? 'capital' : 'op'); }

  /* مفتاح التكرار: الوسم + المبلغ + الفرع — فالتكرار الحقيقيّ (سباق مزامنتين بنفس القيمة) يُسقَط، أمّا صفّان بنفس الوسم
     ومبلغين مختلفين فكلاهما حقيقيّ ويُحسبان (ثم تتقارب المزامنة التالية إلى المجموع الصحيح) — لا يُسقَط أحدهما بحسب ترتيب المصفوفة. */
  function dupKey(e, t) { return t.pid + ':' + t.part + ':' + t.seq + '|' + r2(e.amount) + '|' + (e.branch_key || ''); }
  /* صفوف الدفتر لفاتورة شراء — بلا تكرار حرفيّ، وبلا صفوف ملغاة */
  function ledgerRows(expenses, pid) {
    var seen = {}, out = [];
    (expenses || []).forEach(function (e) {
      if (!e || e.voided) return;
      var t = poInfo(e); if (!t) return;
      if (pid != null && String(t.pid) !== String(pid)) return;
      var k = dupKey(e, t);
      if (seen[k]) return; seen[k] = 1; out.push(e);
    });
    return out;
  }
  function sumRows(rows, part) {
    return r2(rows.reduce(function (s, e) { var t = poInfo(e); return t && t.part === part ? s + usd(e) : s; }, 0));
  }
  function costsTotal(p) {
    return r2(num(p && p.cost_customs) + num(p && p.cost_shipping) + num(p && p.cost_transport) + num(p && p.cost_local));
  }
  /* فواتير الأرشفة (جرد أثري ARC- · جرد تدقيق AUDIT-) ليست مشتريات من مورد: لا دفعة ولا دَين */
  function isArchival(p) {
    return !!p && (String(p.inv_type || '') === 'athenaeum' || /^(ARC|AUDIT)-/.test(String(p.inv_number || '')));
  }
  function isCancelled(p) { return !!p && /cancel|ملغ/i.test(String(p.status || '')); }
  /* ما دُفع على بضاعة الفاتورة. القاعدة (واحدة في الدفتر وفي شاشة الشراء والطباعة):
       • خانة الدفعة النقدية **فارغة** (null) = دُفعت البضاعة كاملةً  → إجمالي البضاعة
       • رقمٌ صريح (ومنه 0 = «آجل: لم يُدفع شيء») = ذلك الرقم
     purchase.html يحفظ الفراغ null والصفر 0 صراحةً (كانا يُحفظان null كلاهما فتعذّر تسجيل فاتورة غير مدفوعة). */
  function paidGoods(p) {
    if (!p || isArchival(p)) return 0;
    var raw = p.cash_payment;
    if (raw == null || raw === '') return Math.max(0, r2(num(p.total_amount)));
    return Math.max(0, r2(num(raw)));
  }
  /* المطلوب تسجيله لفاتورة الشراء: g = ما دُفع على البضاعة · c = تكاليف الجمارك/الشحن إن «دُفعت» */
  function desired(p) {
    if (!p || isArchival(p)) return { g: 0, c: 0 };
    return { g: paidGoods(p), c: (p.costs_paid ? costsTotal(p) : 0) };
  }
  /* الفرق بين المطلوب والمسجَّل — لإظهار «N فاتورة تحتاج ربطاً» دون كتابة.
     transfers (اختياريّ): صفوف branch_transfers — يُكتشف بها صفّ دفتر لفرعٍ بلا حركة درج (فشلٌ جزئيّ سابق).
     وتُكتشف الصفوف **اليتيمة**: وسوم PO لفاتورةٍ لم تعد موجودة ومجموعها غير صفر (بقيت بعد حذفٍ فشل عكسُه). */
  function drift(purchases, expenses, transfers) {
    var out = [], known = {};
    var haveT = Array.isArray(transfers), tagged = {};
    if (haveT) transfers.forEach(function (t) { var m = TAG_RE.exec(String((t && t.note) || '')); if (m) tagged[m[0]] = 1; });
    (purchases || []).forEach(function (p) {
      if (!p || p.id == null) return;
      known[String(p.id)] = 1;
      var rows = ledgerRows(expenses, p.id), d = desired(p);
      var dg = r2(d.g - sumRows(rows, 'g')), dc = r2(d.c - sumRows(rows, 'c'));
      var miss = haveT ? rows.filter(function (e) {
        var t = poInfo(e); return e.branch_key && !e.is_general && !tagged[ '[PO:' + t.pid + ':' + t.part + ':' + t.seq + ']' ];
      }).length : 0;
      if (Math.abs(dg) >= 0.005 || Math.abs(dc) >= 0.005 || miss) out.push({ purchase: p, dg: dg, dc: dc, missingMoves: miss });
    });
    var orphans = {};
    ledgerRows(expenses, null).forEach(function (e) {
      var t = poInfo(e); if (known[t.pid]) return;
      (orphans[t.pid] = orphans[t.pid] || []).push(e);
    });
    Object.keys(orphans).forEach(function (pid) {
      var rows = orphans[pid], dg = sumRows(rows, 'g'), dc = sumRows(rows, 'c');
      if (Math.abs(dg) >= 0.005 || Math.abs(dc) >= 0.005)
        out.push({ purchase: { id: pid, inv_number: pid, cash_payment: 0, costs_paid: false, orphan: true }, dg: -dg, dc: -dc, orphan: true, missingMoves: 0 });
    });
    return out;
  }

  /* ── الفترة ──
     🔴 (مراجعة ACCT-11) الحدود بالتوقيت **المحلّي** لا UTC: فاتورة 01:30 صباح ١ تشرين (+٠٣) هي ٣٠ أيلول 22:30 بالتوقيت العالميّ ⇒ كانت تُحسب في الشهر السابق. */
  function localYMD(v) {
    var s = String(v == null ? '' : v);
    if (s.length <= 10) return s;
    var d = new Date(s);
    if (isNaN(d.getTime())) return s.slice(0, 10);
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function inRange(dateStr, range) {
    if (!range || (!range.ym && !range.from && !range.to)) return true;
    var s = String(dateStr || '');
    if (!s) return false;
    var d = localYMD(s);
    if (range.ym) return d.slice(0, 7) === range.ym;
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    return true;
  }
  function realInvoices(ctx) {
    var ex = ctx.isExcluded || function () { return false; };
    return (ctx.invoices || []).filter(function (i) {
      return i && !String(i.customer_name || '').startsWith('[تدريب]') && !ex(i.branch_key);
    });
  }

  /* ═════════ صندوق الإدارة المركزي ═════════
     ctx = { invoices, transfers, comm, expenses, isMgmt(key), isExcluded(key), opening }
     range = null (منذ البداية) | {ym:'YYYY-MM'} | {from,to}   — الافتتاحي يدخل «منذ البداية» وحدها */
  function centralCash(ctx, range) {
    var isMgmt = ctx.isMgmt || function () { return false; };
    var L = { opening: 0, salesCash: 0, collections: 0, branchIn: 0, drawerExp: 0, commPaid: 0,
              expCentral: 0, capitalCentral: 0, purchasesPaid: 0, importPaid: 0 };
    var full = !range || (!range.ym && !range.from && !range.to);
    if (full) L.opening = r2(num(ctx.opening));

    realInvoices(ctx).forEach(function (i) {
      if (!isMgmt(i.branch_key) || !inRange(i.created_at, range)) return;
      var v = (window.GMTCash && GMTCash.invCash) ? GMTCash.invCash(i)
        : ((i.paid_amount != null && i.paid_amount !== '') ? num(i.paid_amount) : num(i.total));
      L.salesCash += v - num(i.paid_external);
    });
    (ctx.transfers || []).forEach(function (t) {
      if (!t || !inRange(t.created_at || t.transfer_date, range)) return;
      var mg = isMgmt(t.branch_key), a = num(t.amount);
      if (t.type === 'collection') { if (mg) L.collections += Math.abs(a); return; }
      if (t.type === 'expense') { if (mg) L.drawerExp += -a; return; }    /* سالب = خصم · موجب = استرداد */
      if (!mg) L.branchIn += a;     /* سحوبات المقرّ من درجه داخليّة: النقد يبقى في المركز */
    });
    (ctx.comm || []).forEach(function (c) {
      if (!c || !c.paid || c.zeroed) return;
      if (!inRange(c.paid_at || c.created_at, range)) return;
      L.commPaid += num(c.amount);
    });
    ledgerAll(ctx.expenses).forEach(function (e) {
      if (!e.approved || e.voided || !inRange(e.created_at, range)) return;
      if (cashSource(e) !== 'central') return;
      var a = usd(e), t = poInfo(e);
      if (t) { if (t.part === 'c') L.importPaid += a; else L.purchasesPaid += a; }
      else if (isCapital(e)) L.capitalCentral += a;
      else L.expCentral += a;
    });
    Object.keys(L).forEach(function (k) { L[k] = r2(L[k]); });
    var total = r2(L.opening + L.salesCash + L.collections + L.branchIn - L.drawerExp - L.commPaid
                   - L.expCentral - L.capitalCentral - L.purchasesPaid - L.importPaid);
    return { lines: L, total: total, full: full };
  }
  /* كل المصاريف مع إسقاط التكرار في صفوف الدفتر (سباق مزامنتين) */
  function ledgerAll(expenses) {
    var seen = {}, out = [];
    (expenses || []).forEach(function (e) {
      if (!e) return;
      var t = poInfo(e);
      if (t && !e.voided) { var k = dupKey(e, t); if (seen[k]) return; seen[k] = 1; }   /* الملغى لا يُخفي بديله الحيّ */
      out.push(e);
    });
    return out;
  }

  /* ═════════ الربح ═════════
     الربح = (مبيعات − كلفة − عمولة) للفواتير **معروفة الكلفة** − المصاريف التشغيلية.
     ctx = { invoices, comm, expenses, isExcluded(key) } · costFn(invId) → {cost, known} */
  function profit(ctx, range, costFn) {
    var out = { salesAll: 0, salesKnown: 0, cogs: 0, comm: 0, expenses: 0, capital: 0, poOut: 0,
                invCount: 0, unknownCount: 0, unknownSales: 0, profit: 0 };
    var commBy = {};
    (ctx.comm || []).forEach(function (c) {
      if (!c || c.zeroed) return;
      var k = String(c.invoice_id); commBy[k] = (commBy[k] || 0) + num(c.amount);
    });
    realInvoices(ctx).forEach(function (i) {
      if (!inRange(i.created_at, range)) return;
      var t = num(i.total), ret = t < 0 ? -1 : 1;
      out.salesAll += t; out.invCount++;
      var k = costFn ? costFn(i.id) : { known: false, cost: 0 };
      if (k && k.known) {
        out.salesKnown += t; out.cogs += ret * num(k.cost); out.comm += commBy[String(i.id)] || 0;
      } else { out.unknownCount++; out.unknownSales += t; }
    });
    ledgerAll(ctx.expenses).forEach(function (e) {
      if (!e.approved || e.voided || !inRange(e.created_at, range)) return;
      var c = expClass(e), a = usd(e);
      if (c === 'po') out.poOut += a; else if (c === 'capital') out.capital += a; else out.expenses += a;
    });
    Object.keys(out).forEach(function (k) { if (typeof out[k] === 'number' && k !== 'invCount' && k !== 'unknownCount') out[k] = r2(out[k]); });
    out.profit = r2(out.salesKnown - out.cogs - out.comm - out.expenses);
    return out;
  }

  /* مستحق للموردين (بضاعة): ما بقي من قيمة فواتير الشراء بعد المدفوع — لا يُعدّ فاتورةً مُلغاة */
  function supplierPayable(purchases) {
    return r2((purchases || []).reduce(function (s, p) {
      if (!p || isCancelled(p) || isArchival(p)) return s;
      return s + Math.max(0, num(p.total_amount) - paidGoods(p));
    }, 0));
  }

  /* ═════════ المزامنة ═════════
     api = { sb(method, path, body, headers) → data | throws }
     opts = { payer: 'اسم من دفع', payerBranch: 'مفتاح فرعٍ إن دُفع من درجه · null = الإدارة · (غائب) = ورِث من آخر قيد',
              backdate: ISO (للربط الأوّل لفواتير قديمة فقط), now: ISO }
     تُرجع { posted: [{part, delta, seq}], error? } — لا ترمي: فشلُ الربط لا يُفشل حفظ الفاتورة.
     🔴 (مراجعة) التسلسل: مزامنتان لنفس الفاتورة في الصفحة تُنفَّذان **بالتتابع** (لا «مشغول فتجاهل» الذي كان يُضيع التعديل السريع وعكس الحذف). */
  function esc(s) { return encodeURIComponent(s); }
  /* UUID حتميّ من الوسم: صفّان من تبويبين لنفس (فاتورة · جزء · تسلسل) يتصادمان على المفتاح الأساسيّ فيفوز واحدٌ ويُعيد الآخر القراءة —
     فلا يتكرّر القيد ولا خصم الدرج (كان التكرار يحدث بقراءةٍ ثم كتابةٍ بلا حارس). */
  function detUuid(str) {
    var h = [0x811c9dc5, 0x01000193, 0xdeadbeef, 0x12345678];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      for (var j = 0; j < 4; j++) { h[j] = Math.imul(h[j] ^ (c + j * 31), 0x01000193 + 2 * j) >>> 0; h[j] ^= h[(j + 1) % 4] >>> 13; }
    }
    var x = h.map(function (v) { return ('00000000' + (v >>> 0).toString(16)).slice(-8); }).join('');
    return x.slice(0, 8) + '-' + x.slice(8, 12) + '-4' + x.slice(13, 16) + '-a' + x.slice(17, 20) + '-' + x.slice(20, 32);
  }
  var DUP_RE = /duplicate key|23505|unique constraint|\b409\b/i;
  async function postAdaptive(api, table, row) {
    var r = Object.assign({}, row);
    for (var n = 0; n < 8; n++) {
      try {
        var res = await api.sb('POST', '/rest/v1/' + table, r, { Prefer: 'return=representation' });
        return Array.isArray(res) ? res[0] : (res && res.data ? (Array.isArray(res.data) ? res.data[0] : res.data) : res);
      } catch (e) {
        var msg = String(e && e.message);
        var m = /Could not find the '([^']+)' column|column "?([a-z_]+)"? (?:of relation|does not exist)/i.exec(msg);
        var col = m && (m[1] || m[2]);
        if (col && col in r) { delete r[col]; continue; }
        if (('id' in r) && /invalid input syntax for type/i.test(msg)) { delete r.id; continue; }   /* id ليس uuid في هذه القاعدة */
        throw e;
      }
    }
    throw new Error('تعذّر الكتابة في ' + table);
  }
  function rowsOf(got) { return Array.isArray(got) ? got : (got && got.data) || []; }
  /* حركة الدرج لقيود الفروع: تُنشأ **بالوسم** وتُعاد محاولتها عند كل مزامنة (حتى لو لا فرق جديد) — فلا يضيع خصمٌ بفشلٍ جزئيّ */
  async function ensureDrawerMoves(api, pid, rows, opts) {
    var br = rows.filter(function (e) { return e && e.branch_key && !e.is_general && poInfo(e); });
    if (!br.length) return 0;
    var got = rowsOf(await api.sb('GET', '/rest/v1/branch_transfers?note=like.' + esc('*[PO:' + pid + ':*') + '&select=note&limit=1000'));
    var have = {};
    got.forEach(function (t) { var m = TAG_RE.exec(String((t && t.note) || '')); if (m) have[m[0]] = 1; });
    var made = 0;
    for (var i = 0; i < br.length; i++) {
      var e = br[i], t = poInfo(e), tag = '[PO:' + t.pid + ':' + t.part + ':' + t.seq + ']';
      if (have[tag]) continue;
      var who = (/دفعها:\s*([^·\]]+)/.exec(String(e.note || '')) || [])[1] || e.requested_by || 'الإدارة';
      try {
        await postAdaptive(api, 'branch_transfers', (window.GMTCashTx ? GMTCashTx.fill : function (r) { return r; })({
          id: detUuid('PT:' + tag),      /* مفتاحٌ حتميّ: تبويبان معاً ⇒ يفوز واحد ويُرفض الآخر بتعارض المفتاح فلا يتكرّر الخصم */
          branch_key: e.branch_key, branch_name: (opts && opts.branchName) || e.branch_key, amount: -num(e.amount), type: 'expense',
          note: 'مصروف: ' + (e.title || 'دفعة فاتورة شراء') + ' ' + tag, created_by: String(who).trim(),
          created_at: e.created_at || e.approved_at || new Date().toISOString()
        }));
        made++;
      } catch (err) {
        if (!DUP_RE.test(String((err && err.message) || err))) throw err;   /* كتبه تبويبٌ آخر قبلنا */
      }
      have[tag] = 1;
    }
    return made;
  }
  async function syncOnce(api, p, opts) {
    var pid = String(p.id), posted = [];
    try {
      var want = desired(p);
      var nowIso = opts.now || new Date().toISOString();
      var label = '#' + (p.inv_number || pid) + (p.supplier ? ' (' + p.supplier + ')' : '');
      var parts = [['g', 'دفعة شراء — فاتورة ', 'مشتريات'], ['c', 'جمارك/شحن — فاتورة شراء ', 'استيراد']];
      var existing = ledgerRows(rowsOf(await api.sb('GET', '/rest/v1/gmt_expenses?note=like.' + esc('*[PO:' + pid + ':*') + '&select=*&order=created_at.asc&limit=1000')), pid);
      var explicitBranch = Object.prototype.hasOwnProperty.call(opts, 'payerBranch') && opts.payerBranch !== undefined;
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i][0], saved = null;
        for (var attempt = 0; attempt < 4 && !saved; attempt++) {
          var rows = existing.filter(function (e) { return poInfo(e).part === part; });
          var cur = sumRows(rows, part);
          var delta = r2(want[part] - cur);
          if (Math.abs(delta) < 0.005) break;
          var seq = rows.reduce(function (m, e) { return Math.max(m, poInfo(e).seq); }, 0) + 1;
          var last = rows.slice().sort(function (a, b) { return poInfo(a).seq - poInfo(b).seq; }).pop();
          var payer = String(opts.payer || '').trim() ||
            (last && (/دفعها:\s*([^·\]]+)/.exec(String(last.note || '')) || [])[1]) || String(opts.payerDefault || '').trim() || 'الإدارة';
          payer = String(payer).trim();
          /* صراحةً: null/'' = الإدارة (لا يرث درج فرعٍ سبق) · غائب = ورِث من آخر قيد (إعادة تلقائية بلا واجهة) */
          var branch = explicitBranch ? (opts.payerBranch || null) : ((last && last.branch_key) || null);
          var tag = '[PO:' + pid + ':' + part + ':' + seq + ']';
          var title = parts[i][1] + label + (delta < 0 ? ' — تخفيض/تصحيح' : '');
          var row = {
            id: detUuid('PO:' + pid + ':' + part + ':' + seq),
            branch_key: branch || null, title: title, amount: delta, currency: 'usd', exchange_rate: null,
            note: tag + ' دفعها: ' + payer + (delta < 0 ? ' · تخفيض' : ''),
            is_general: !branch, approved: true, approved_at: nowIso,
            created_at: (!rows.length && opts.backdate) ? opts.backdate : nowIso,
            kind: parts[i][2], requested_by: payer, created_by: payer     /* created_by موجودٌ في قاعدتك؛ kind/requested_by تُسقَط إن غابت */
          };
          try {
            saved = await postAdaptive(api, 'gmt_expenses', row);
          } catch (e) {
            if (!DUP_RE.test(String((e && e.message) || e))) throw e;
            /* كتبها تبويبٌ آخر قبلنا: أعد القراءة واحسب من جديد (لا نكرّر القيد) */
            existing = ledgerRows(rowsOf(await api.sb('GET', '/rest/v1/gmt_expenses?note=like.' + esc('*[PO:' + pid + ':*') + '&select=*&order=created_at.asc&limit=1000')), pid);
            continue;
          }
          if (!saved) throw new Error('لم يُسجَّل صفُّ الدفتر');
          posted.push({ part: part, delta: delta, seq: seq, row: saved });
          existing.push(saved);
        }
      }
      /* حركات الدرج لقيود الفروع — دائماً (تُصلح فشلاً جزئيّاً سابقاً حتى بلا فرق جديد) */
      await ensureDrawerMoves(api, pid, existing, opts);
      return { posted: posted };
    } catch (e) {
      return { posted: posted, error: String((e && e.message) || e) };
    }
  }
  var _chain = {};
  function syncPurchase(api, p, opts) {
    opts = opts || {};
    if (!p || p.id == null) return Promise.resolve({ posted: [], skipped: true });
    var pid = String(p.id);
    var run = (_chain[pid] || Promise.resolve()).then(function () { return syncOnce(api, p, opts); });
    _chain[pid] = run.then(function () {}, function () {});
    return run;
  }
  /* يُنادى عند حذف فاتورة شراء: يعكس كل دفعاتها (دفتر إضافيّ، لا حذف) — يتبع أيّ مزامنةٍ جارية لنفس الفاتورة */
  function reversePurchase(api, p, opts) {
    return syncPurchase(api, Object.assign({}, p, { cash_payment: 0, costs_paid: false }), opts);
  }

  window.GMTLedger = {
    centralCash: centralCash, profit: profit, supplierPayable: supplierPayable,
    syncPurchase: syncPurchase, reversePurchase: reversePurchase, drift: drift,
    desired: desired, paidGoods: paidGoods, isArchival: isArchival, costsTotal: costsTotal, ledgerRows: ledgerRows, poInfo: poInfo,
    expClass: expClass, cashSource: cashSource, usd: usd, inRange: inRange, localYMD: localYMD
  };
})();
