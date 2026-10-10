/* ═══════════════════════════════════════════════════════════════════════════
   gmt-oplog.js — «سجل العمليات»: من فعل ماذا، ومتى، وما الذي تغيّر
   أُنشئ: 2026-10-11 · طلبك (Notes ٩ ت١ ٦:٤٧ ص): «ضيف شي غير التراجع هو السجل — سجل العمليات بيسجل شو انشغل».

   ما كان موجوداً قبل: «التراجع والسجلّ» في الجرد وحده، وسجلّه **على الجهاز** (آخر ٦٠ حركة) ⇒ لا يراه الأدمن من
   جهازه، ويزول بمسح المتصفّح. وجدول `gmt_audit` (SQL الأساس) تكتب فيه ثلاثةُ مواضع فقط (التعديل اليدوي للكمّيات...).

   الحلّ (نفس فلسفة «تراجع الجرد» و«سلّة المحذوفات»): نصطاد الكتابة عند **طبقة الشبكة** بدل تعديل مئة موضع حفظ:
     كلُّ POST/PATCH/DELETE ناجح على جدولٍ مهمّ ⇒ سطرٌ في `gmt_audit`: الفاعل (الأدمن باسمه أو الموظّف) · الصفحة ·
     الجدول · المعرّف · الاسم · الحقول المتغيّرة (قبل ← بعد إن عرفنا «قبل») · الوقت.
   • الكتابة دفعاتٌ كلّ ٢٫٥ ثانية (طلبٌ واحد لا طلب لكل عملية) وتُحفَظ محلّياً إن فشلت وتُعاد (لا يضيع أثرٌ دون إنترنت).
   • لا تُسجَّل كلماتُ السرّ ولا بصماتها ولا مفاتيح الإعدادات الحسّاسة (تُسجَّل «تغيّرت» دون قيمة).
   • لا تعطّل أيّ كتابة: التسجيل بعد نجاحها وفي try/catch، وبالمفتاح نفسه الذي تكتب به الصفحة.
   • جدول gmt_audit للإضافة والقراءة فقط (لا تعديل ولا حذف من المفتاح العام) ⇒ سجلٌّ لا يُمحى من الواجهة.
   • العرض: لوحةٌ (من زرّ «سجل العمليات» بجانب «تراجع» في الجرد) وصفحةٌ كاملة «سجل_العمليات.html» للأدمن.

   الواجهة:
     GMTOpLog.log({action, entity, entityId, entityName, field, oldValue, newValue, reason, meta})   ← حدثٌ يدويّ
     GMTOpLog.before(table, fn)   ← الصفحة تعرّف كيف تُرجع «الصفّ قبل التعديل» (لتظهر القيمة القديمة)
     GMTOpLog.skipTables([...])   ← جداولُ تسجّلها الصفحة بنفسها
     GMTOpLog.open(opts) · GMTOpLog.mount(el, opts)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTOpLog) return;

  var Q_KEY = 'gmt_oplog_q_v1', MAXQ = 200, FLUSH_MS = 2500;

  /* الجدول ⇒ اسمه للعرض. ما ليس هنا لا يُسجَّل (الضجيج: بنود الفواتير · التتبّع · الأخطاء · الرسائل…) */
  var T = {
    gmt_orders: 'أوردر', gmt_customers: 'زبون', invoices: 'فاتورة', invoice_commissions: 'عمولة', gmt_expenses: 'مصروف',
    gmt_manual_debts: 'دين', gmt_settlements: 'تسوية', gmt_daily_closes: 'تقفيل يومي', gmt_price_changes: 'تغيير سعر',
    gmt_offers: 'عرض', gmt_coupons: 'كوبون', branch_transfers: 'ترحيل صندوق', branch_stock_transfers: 'فاتورة نقل مخزون',
    warranties: 'كفالة', gmt_users: 'مستخدم', gmt_job_applications: 'طلب توظيف', stock_receipts: 'استلام بضاعة',
    stock_counts: 'جرد', inv_columns: 'فرع/عمود الجرد', gmt_settings: 'إعداد', products: 'منتج'
  };
  var VERB = { POST: ['create', 'إنشاء'], PATCH: ['update', 'تعديل'], PUT: ['update', 'تعديل'], DELETE: ['delete', 'حذف'] };
  var CAT = { // الفئة للفلاتر
    stock: ['products', 'inv_columns', 'branch_stock_transfers', 'stock_receipts', 'stock_counts', 'stock_moves'],
    orders: ['gmt_orders', 'gmt_customers', 'warranties', 'gmt_job_applications'],
    money: ['invoices', 'invoice_commissions', 'gmt_expenses', 'gmt_manual_debts', 'gmt_settlements', 'gmt_daily_closes', 'gmt_price_changes', 'gmt_offers', 'gmt_coupons', 'branch_transfers'],
    accounts: ['gmt_users'],
    system: ['gmt_settings']
  };
  var CAT_AR = { all: 'الكل', stock: 'المخزون', orders: 'الأوردرات والزبائن', money: 'الفواتير والمال', accounts: 'الحسابات', system: 'النظام' };
  var ACT_AR = { // أحداثٌ يدويّة
    admin_login: 'دخول أدمن', admin_add: 'إضافة حساب أدمن', admin_pw: 'تغيير كلمة سرّ أدمن', admin_remove: 'حذف حساب أدمن',
    admin_logout: 'خروج أدمن', admin_login_fail: 'محاولة دخول أدمن فاشلة', policy_orders_lock: 'قفل الأوردرات', user_pw: 'تغيير كلمة سرّ مستخدم', user_rename: 'تغيير اسم مستخدم',
    user_lock: 'قفل جهاز مستخدم', user_toggle: 'إيقاف/تفعيل مستخدم', user_delete: 'حذف مستخدم', user_approve: 'موافقة على حساب',
    product_edit: 'تعديل منتج', product_delete: 'حذف منتج', stock_add: 'إضافة كمّية', stock_deduct: 'خصم كمّية', qty_manual: 'تعديل كمّية يدوي',
    invoice_admin_create: 'فاتورة من الإدارة', password_change: 'تغيير كلمة سرّ', unmet_demand: 'طلب غير متوفّر', unmet_resolved: 'طلب غير متوفّر — عولج',
    rfq_export: 'تصدير طلب عرض سعر', write_noop: 'كتابة لم تُغيّر شيئاً (صلاحية أو سجلّ محذوف)'
  };
  var KEY_AR = {
    status: 'الحالة', name: 'الاسم', phone: 'الهاتف', price: 'السعر', wholesale_price: 'سعر الجملة', cost_price: 'الكلفة', qty: 'الكمية',
    address: 'العنوان', product: 'المنتج', shipping_company: 'شركة الشحن', tracking_number: 'رقم التتبّع', notified_arrival_at: 'تبليغ الوصول',
    invoice_id: 'الفاتورة', invoice_number: 'رقم الفاتورة', branch: 'الفرع', branch_key: 'الفرع', branch_name: 'الفرع', amount: 'المبلغ', total: 'الإجمالي',
    cashier_name: 'الكاشير', notes: 'ملاحظات', is_active: 'فعّال', display_name: 'الاسم الظاهر', username: 'اسم المستخدم', group_name: 'المجموعة',
    category: 'التصنيف', barcode: 'الباركود', approved: 'الموافقة', commission: 'العمولة', discount: 'الخصم', paid: 'المدفوع', title: 'العنوان',
    last_device_id: 'قفل الجهاز', center: 'المركز'
  };
  var ST_AR = { pending: 'قيد التجهيز', prepared: 'محضّرة', shipped: 'في الطريق', delivered: 'بانتظار التحصيل', completed: 'تم التحصيل', reserved: 'محجوز', cancelled: 'ملغى', canceled: 'ملغى' };
  /* إعدادات النظام: نسجّل الجوهريّ فقط (كلمات السرّ · الصلاحيات · القفل · الوسيط) — بقيّة المفاتيح ضجيجٌ (ملفّات تعريف · كاش) */
  var SET_AR = { orders_lock: 'قفل الأوردرات', admin_password: 'كلمة سرّ أدمن النقاط', pw_sovereign: 'كلمة السرّ السيادية', pw_store: 'كلمة سرّ المتجر',
    pw_warranty: 'كلمة سرّ الكفالات', pw_purchase: 'كلمة سرّ المشتريات', pw_backup: 'كلمة سرّ النسخ الاحتياطي', brain_endpoint: 'رابط وسيط عقل النظام',
    shop_endpoint: 'رابط وسيط المتجر' };
  var SET_OK = /^(pw_|tool_grants_|user_pending_|orders_lock$|admin_password$|brain_|shop_endpoint$|[a-z_]*endpoint$)/;
  var SECRET_K = /pass|pwd|token|secret|api_?key|hash|sha256|pw_|admin_accounts/i;
  var SKIP_K = { updated_at: 1, created_at: 1, id: 1 };

  var skip = {}, beforeFns = {}, queue = [], timer = null, off = false;
  var _raw = global.fetch ? global.fetch.bind(global) : null;

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} return null; }
  function db() { try { return (global.GMT_DB && global.GMT_DB.MAIN) || null; } catch (_) { return null; } }
  function page() { try { return decodeURIComponent(location.pathname.split('/').pop() || 'index.html'); } catch (_) { return 'unknown'; } }
  function trunc(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) + '…' : s; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function actor() {
    try { if (global.GMTRole && GMTRole.isAdmin && GMTRole.isAdmin()) { var n = GMTRole.name && GMTRole.name(); return n ? 'الأدمن ' + n : 'الأدمن'; } } catch (_) {}
    try { var s = JSON.parse(ls('gmt_session') || 'null'); if (s && (s.display_name || s.username)) return s.display_name || s.username; } catch (_) {}
    var op = ls('gmt_operator_name'); if (op) return op;
    return 'غير معروف';
  }

  /* ── الكتابة: طابورٌ يُفرَّغ دفعةً واحدة ── */
  function loadQ() { try { var a = JSON.parse(ls(Q_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
  function saveQ(a) { ls(Q_KEY, a.length ? JSON.stringify(a.slice(-MAXQ)) : null); }
  function enqueue(row) {
    queue.push(row);
    if (queue.length > MAXQ) queue.shift();
    if (!timer) timer = setTimeout(flush, FLUSH_MS);
  }
  async function flush(keepalive) {
    clearTimeout(timer); timer = null;
    var d = db(); if (!d || !_raw || off) return;
    var rows = loadQ().concat(queue); queue = [];
    if (!rows.length) return;
    try {
      var r = await _raw(d.url + '/rest/v1/gmt_audit', {
        method: 'POST', keepalive: keepalive === true && JSON.stringify(rows).length < 60000,
        headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(rows)
      });
      if (r.ok) { saveQ([]); return; }
      /* الجدول غير منشأ (404/400 مخطّط) ⇒ نتوقّف عن المحاولة في هذه الجلسة بدل إغراق الشبكة */
      if (r.status === 404 || r.status === 400) { off = true; saveQ([]); try { console.warn('[GMTOpLog] جدول gmt_audit غير متاح — السجلّ متوقّف (شغّل SQL الأساس)'); } catch (_) {} return; }
      saveQ(rows);
    } catch (_) { saveQ(rows); }
  }
  function rowOf(e) {
    return {
      at: new Date().toISOString(), actor: e.actor || actor(), page: page(),
      action: e.action || 'manual', entity: e.entity || null,
      entity_id: e.entityId != null ? String(e.entityId) : null, entity_name: e.entityName ? trunc(e.entityName, 120) : null,
      field: e.field ? trunc(e.field, 160) : null,
      old_value: e.oldValue != null ? trunc(typeof e.oldValue === 'string' ? e.oldValue : JSON.stringify(e.oldValue), 900) : null,
      new_value: e.newValue != null ? trunc(typeof e.newValue === 'string' ? e.newValue : JSON.stringify(e.newValue), 900) : null,
      reason: e.reason || null, sovereign: false, meta: e.meta || null
    };
  }
  function log(e) { try { enqueue(rowOf(e || {})); return true; } catch (_) { return false; } }

  /* ── الاصطياد عند طبقة الشبكة ── */
  function maskVal(k, v, table) {
    if (SECRET_K.test(k)) return '••• (تغيّرت)';
    if (v && typeof v === 'object') return trunc(JSON.stringify(v), 80);
    return trunc(v, 80);
  }
  function summarize(table, method, body, before) {
    var obj = Array.isArray(body) ? body[0] : body;
    if (!obj || typeof obj !== 'object') return { fields: [], nv: null, ov: null, name: '' };
    var keys = Object.keys(obj).filter(function (k) { return !SKIP_K[k]; });
    var nv = {}, ov = {};
    if (table === 'gmt_settings') {
      /* الإعدادات: المفتاح هو الاسم، والقيمة لا تُكتب إن كانت حسّاسة */
      var kk = obj.key != null ? String(obj.key) : '';
      var secret = SECRET_K.test(kk) || /^(pw_|admin_|brain|endpoint|gmt_brain)/.test(kk) || /endpoint$/.test(kk);
      var nm = SET_AR[kk] || (/^tool_grants_/.test(kk) ? 'صلاحيات المستخدم #' + kk.replace('tool_grants_', '') : kk);
      var val = secret ? '••• (تغيّرت)' : (kk === 'orders_lock' ? (String(obj.value) === '1' ? 'مُفعَّل' : 'مُعطَّل') : trunc(obj.value, 120));
      return { fields: [nm || 'قيمة'], nv: { value: val }, ov: null, name: nm };
    }
    var shown = keys.slice(0, 8);
    shown.forEach(function (k) {
      nv[k] = maskVal(k, obj[k], table);
      if (before && before[k] !== undefined && method !== 'POST') ov[k] = maskVal(k, before[k], table);
    });
    var name = obj.name || obj.customer_name || obj.inv_number || obj.invoice_number || obj.title || obj.display_name || obj.username || obj.transfer_number || obj.code
      || (before && (before.name || before.customer_name || before.inv_number || before.display_name || before.username)) || '';
    return { fields: shown, nv: nv, ov: Object.keys(ov).length ? ov : null, name: name, more: keys.length - shown.length };
  }
  function classify(url, method, init) {
    var m = url.match(/\/rest\/v1\/([a-z_0-9]+)(?:\?([^#]*))?$/);
    if (!m) return null;
    var table = m[1];
    if (!T[table] || skip[table] || (global.GMT_OPLOG_SKIP && global.GMT_OPLOG_SKIP.indexOf(table) >= 0) || global.__gmtOpLogMute) return null;
    var v = VERB[method]; if (!v) return null;
    var q = m[2] || '';
    var idm = q.match(/(?:^|&)(id|key|username)=eq\.([^&]+)/);
    var body = null;
    try { body = init && init.body && typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch (_) {}
    if (method !== 'DELETE' && !body) return null;
    var id = idm ? decodeURIComponent(idm[2]) : null;
    /* بيانات الفاحص الذاتي (موسومة) لا تدخل السجلّ — هي تُنشأ لتُحذف */
    try { if (body && /__GMT_TEST__|"barcode":"TEST-|"code":"TESTCP-|"username":"gmttest\d+/.test(JSON.stringify(body))) return null; } catch (_) {}
    if (table === 'gmt_settings') {
      var key = id || (body && !Array.isArray(body) ? body.key : (body && body[0] && body[0].key)) || '';
      if (!SET_OK.test(String(key)) || key === 'admin_accounts') return null;     // admin_accounts: أحداثه صريحة (admin_add…)
      if (method === 'POST') v = VERB.PATCH;                                       // upsert إعداد = تعديل لا «إنشاء»
      id = id || String(key);
    }
    return { table: table, method: method, verb: v, id: id, idKey: idm ? idm[1] : null, body: body, q: q };
  }
  var WRITE = /^(POST|PATCH|PUT|DELETE)$/;
  /* ── حارس «النجاح الصامت» ────────────────────────────────────────────────
     الجذر: PostgREST يردّ 204 «ناجحاً» حتى لو لم يُعدِّل أيَّ صفّ (سياسة RLS تمنع، أو السجلّ حُذف) — فتقول الصفحة
     «تمّ الحفظ» والقاعدة لم تتغيّر (وقعت في حذف المستخدم). عشرات المواضع تكتب بـ`return=minimal` فلا تستطيع التحقّق.
     العلاج عند طبقة الشبكة بلا لمس الصفحات: لكلّ PATCH/DELETE يستهدف سجلّاً واحداً (id|key|username=eq.) نضيف
     `count=exact` إلى Prefer (لا يغيّر الحالة ولا الجسم) ونقرأ `Content-Range`: إن انتهى بـ«/0» فلم يُعدَّل شيء ⇒ تنبيهٌ صريح
     + سطرٌ في السجلّ، ولا نُسجّل «تعديلاً ناجحاً» كاذباً. تنبيهٌ فقط — لا نغيّر ردّ القاعدة كي لا نكسر ما يعتمد عليه. */
  var GUARD_Q = /\/rest\/v1\/([a-z_0-9]+)\?(?:[^#]*&)?(id|key|username)=eq\.([^&#]+)/;
  var GUARD_NO = /^(gmt_audit|gmt_settings)$/;     // الإعدادات تُكتب بـupsert، وسجلّ التدقيق إدراجٌ فقط
  var _noopAt = {};
  function guardOf(url, method) {
    if ((method !== 'PATCH' && method !== 'DELETE') || global.__gmtOpLogMute) return null;
    var m = String(url || '').match(GUARD_Q);
    if (!m || GUARD_NO.test(m[1])) return null;
    return { table: m[1], key: m[2], id: decodeURIComponent(m[3]) };
  }
  function withCount(init) {
    var out = {}; for (var k in init) out[k] = init[k];
    var h = init.headers, add = 'count=exact';
    if (h && typeof h.get === 'function' && typeof h.set === 'function') {
      var nh = new Headers(h), cur = nh.get('Prefer') || '';
      if (/count=/.test(cur)) return init;
      nh.set('Prefer', cur ? cur + ',' + add : add); out.headers = nh; return out;
    }
    if (Array.isArray(h)) {
      for (var i = 0; i < h.length; i++) if (String(h[i][0]).toLowerCase() === 'prefer') {
        if (/count=/.test(h[i][1])) return init;
        out.headers = h.map(function (x) { return x.slice(); }); out.headers[i][1] = h[i][1] + ',' + add; return out;
      }
      out.headers = h.concat([['Prefer', add]]); return out;
    }
    var o = {}; h = h || {};
    var pk = null; for (var k2 in h) { o[k2] = h[k2]; if (k2.toLowerCase() === 'prefer') pk = k2; }
    if (pk) { if (/count=/.test(o[pk])) return init; o[pk] = o[pk] + ',' + add; } else o.Prefer = add;
    out.headers = o; return out;
  }
  function zeroRows(res) {
    try { var cr = res && res.headers && res.headers.get && res.headers.get('content-range'); return !!cr && /\/0$/.test(cr); } catch (_) { return false; }
  }
  function reportNoop(g, method) {
    var now = Date.now(), key = g.table + ':' + g.id;
    if (_noopAt[key] && now - _noopAt[key] < 5000) return; _noopAt[key] = now;
    var label = T[g.table] || g.table;
    try { console.warn('[GMT] كتابة لم تُغيّر أيَّ صفّ: ' + method + ' ' + g.table + ' ' + g.key + '=' + g.id); } catch (_) {}
    try {
      if (global.GMTUI && GMTUI.toast) GMTUI.toast('لم يُحفَظ التغيير في «' + label + '» — القاعدة لم تعدّل أيّ سجلّ (غالباً لا صلاحية، أو السجلّ حُذف). حدّث الصفحة وأعد المحاولة.', 6500);
    } catch (_) {}
    try {
      enqueue(rowOf({ action: 'write_noop', entity: g.table, entityId: g.id, entityName: label, field: method === 'DELETE' ? 'حذف' : 'تعديل', meta: { method: method } }));
    } catch (_) {}
  }
  function install() {
    if (!_raw || global.__gmtOpLogFetch) return;
    global.__gmtOpLogFetch = true;
    var inner = global.fetch.bind(global);
    global.fetch = function (input, init) {
      var info = null, before = null;
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if (WRITE.test(method) && /\/rest\/v1\//.test(url) && !/\/gmt_audit/.test(url)) {
          info = classify(url, method, init);
          var bf = beforeFns[info.table] || (global.GMT_OPLOG_BEFORE && global.GMT_OPLOG_BEFORE[info.table]);
          if (info && info.id && bf) { try { before = bf(info.id); } catch (_) { before = null; } }
        }
      } catch (_) { info = null; }
      var g = null;
      try {
        if (typeof input === 'string' && init && !global.__gmtOpLogMute) {
          var gm = String(init.method || 'GET').toUpperCase();
          g = guardOf(input, gm);
          if (g) g.method = gm;
          /* وما نتتبّعه في السجلّ نعدّه كذلك (أيّ فلتر): لا نكتب «تعديلاً ناجحاً» لعمليةٍ لم تغيّر شيئاً — بلا تنبيه للمستخدم */
          if (g || (info && (gm === 'PATCH' || gm === 'DELETE'))) init = withCount(init);
        }
      } catch (_) { g = null; }
      var p = inner(input, init);
      if (!info && !g) return p;
      return p.then(function (res) {
        var zero = false;
        try { zero = !!(res && res.ok && zeroRows(res)); if (zero && g) reportNoop(g, g.method); } catch (_) {}
        if (!info) return res;
        try {
          if (res && res.ok && !zero) {
            var s = summarize(info.table, info.method, info.body, before);
            var skipEmpty = info.method !== 'DELETE' && !s.fields.length;
            if (!skipEmpty) {
              var label = T[info.table];
              /* أوردر: تغيير الحالة يُسمّى باسمه */
              var act = info.verb[0] + ':' + info.table, special = '';
              if (info.table === 'gmt_orders' && info.method === 'PATCH' && info.body && info.body.status) special = 'order_status';
              if (info.table === 'gmt_settings' && info.method === 'DELETE' && /^user_pending_/.test(info.id || '')) { special = 'user_approve'; s.name = 'حساب #' + info.id.replace('user_pending_', ''); }
              enqueue(rowOf({
                action: special || act, entity: info.table, entityId: info.id || (Array.isArray(info.body) ? '' : (info.body && info.body.id)) || '',
                entityName: s.name || label, field: s.fields.join('، ') + (s.more > 0 ? ' +' + s.more : ''),
                oldValue: s.ov, newValue: s.nv, meta: { verb: info.verb[1], label: label, n: Array.isArray(info.body) ? info.body.length : 1 }
              }));
            }
          }
        } catch (_) {}
        return res;
      });
    };
  }

  /* ═══ العرض ═══ */
  function catOf(r) {
    var e = r.entity || '';
    for (var c in CAT) if (CAT[c].indexOf(e) >= 0) return c;
    if (/^(admin_|user_|password)/.test(r.action || '')) return 'accounts';
    if (/^unmet_/.test(r.action || '')) return 'orders';
    if (/^rfq_/.test(r.action || '')) return 'stock';
    if (/^(product_|stock_|qty_)/.test(r.action || '')) return 'stock';
    if (/^policy_/.test(r.action || '')) return 'system';
    if (/^invoice/.test(r.action || '')) return 'money';
    return 'system';
  }
  function actionLabel(r) {
    var a = String(r.action || '');
    if (a === 'order_status') return 'تغيير حالة أوردر';
    if (ACT_AR[a]) return ACT_AR[a];
    var m = a.match(/^(create|update|delete):(.+)$/);
    if (m) return ({ create: 'إنشاء', update: 'تعديل', delete: 'حذف' })[m[1]] + ' ' + (T[m[2]] || m[2]);
    return a;
  }
  function fmtVal(k, v, table) {
    if (v == null) return '—';
    if (k === 'status' && ST_AR[v]) return ST_AR[v];
    if (v === true) return 'نعم'; if (v === false) return 'لا';
    return String(v);
  }
  function changes(r) {
    var o = null, n = null;
    try { o = r.old_value ? JSON.parse(r.old_value) : null; } catch (_) { o = r.old_value; }
    try { n = r.new_value ? JSON.parse(r.new_value) : null; } catch (_) { n = r.new_value; }
    if (n && typeof n === 'object' && !Array.isArray(n)) {
      return Object.keys(n).map(function (k) {
        var lab = KEY_AR[k] || k;
        var nv = fmtVal(k, n[k], r.entity), ov = (o && typeof o === 'object' && k in o) ? fmtVal(k, o[k], r.entity) : null;
        return '<span class="ol-k">' + esc(lab) + '</span> ' + (ov != null ? '<span class="ol-o">' + esc(ov) + '</span> ← ' : '') + '<span class="ol-n">' + esc(nv) + '</span>';
      }).join(' &nbsp;·&nbsp; ');
    }
    if (o != null || n != null) return (o != null ? '<span class="ol-o">' + esc(typeof o === 'string' ? o : JSON.stringify(o)) + '</span> ← ' : '') + '<span class="ol-n">' + esc(typeof n === 'string' ? n : JSON.stringify(n)) + '</span>';
    return r.field ? '<span class="ol-k">' + esc(r.field) + '</span>' : '';
  }
  function when(at) {
    try {
      var d = new Date(at), now = new Date(), diff = (now - d) / 1000;
      var abs = d.toLocaleString('ar-SY', { dateStyle: 'medium', timeStyle: 'short' });
      var rel = diff < 60 ? 'الآن' : diff < 3600 ? 'قبل ' + Math.floor(diff / 60) + ' د' : diff < 86400 ? 'قبل ' + Math.floor(diff / 3600) + ' س' : '';
      return rel ? rel + ' · ' + abs : abs;
    } catch (_) { return String(at || ''); }
  }

  var CSS = '.ol{font-family:Cairo,Tajawal,"Segoe UI",Tahoma,system-ui,sans-serif;direction:rtl;color:#0f172a}' +
    '.ol-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 10px}' +
    '.ol-q{flex:1;min-width:150px;border:1.5px solid #e2e8f0;border-radius:11px;padding:9px 12px;font:inherit;font-size:13.5px;background:#f8fafc;outline:none}' +
    '.ol-q:focus{border-color:#D5001C;background:#fff}' +
    '.ol-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}' +
    '.ol-c{border:1.5px solid #e2e8f0;background:#fff;border-radius:99px;padding:5px 12px;font:inherit;font-size:12.5px;font-weight:800;color:#475569;cursor:pointer}' +
    '.ol-c.on{background:#D5001C;border-color:#D5001C;color:#fff}' +
    '.ol-b{border:1.5px solid #e2e8f0;background:#fff;border-radius:11px;padding:8px 13px;font:inherit;font-size:13px;font-weight:800;color:#334155;cursor:pointer}' +
    '.ol-row{border-top:1px solid #eef1f5;padding:10px 2px}.ol-row:first-child{border-top:0}' +
    '.ol-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:13.5px}' +
    '.ol-who{font-weight:900}.ol-what{font-weight:800;color:#D5001C}.ol-ent{font-weight:700;color:#0f172a}' +
    '.ol-t{font-size:11.5px;color:#64748b;margin-inline-start:auto;white-space:nowrap}' +
    '.ol-d{font-size:12.5px;color:#334155;line-height:1.9;margin-top:2px;word-break:break-word}' +
    '.ol-k{color:#64748b;font-weight:700}.ol-o{color:#b91c1c;text-decoration:line-through;text-decoration-color:#fca5a5}.ol-n{color:#15803d;font-weight:800}' +
    '.ol-p{font-size:11px;color:#94a3b8}.ol-em{text-align:center;color:#64748b;padding:26px 8px;font-size:13.5px}' +
    '.ol-w{padding:12px 14px;border-radius:14px;background:#fffbeb;border:1px solid #fde68a;color:#78350f;font-weight:700;font-size:13px;line-height:1.8}' +
    '@media (prefers-color-scheme:dark){.ol{color:#e2e8f0}.ol-q{background:#1e293b;border-color:#334155;color:#e2e8f0}.ol-c,.ol-b{background:#1e293b;border-color:#334155;color:#cbd5e1}.ol-row{border-color:#273449}.ol-ent{color:#e2e8f0}.ol-d{color:#cbd5e1}}';
  function injectCss() {
    if (document.getElementById('gmt-oplog-css')) return;
    var st = document.createElement('style'); st.id = 'gmt-oplog-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* يبني اللوحة داخل عنصر. opts: {entity (فئة ابتدائية), limit} */
  function mount(el, opts) {
    opts = opts || {};
    injectCss();
    var st = { rows: [], cat: opts.cat || 'all', q: '', days: 0, busy: false, end: false, err: '' };
    el.classList.add('ol');
    el.innerHTML =
      '<div class="ol-bar"><input class="ol-q" type="search" placeholder="بحث: اسم · فاعل · صفحة · قيمة…" aria-label="بحث في السجل">' +
      '<button class="ol-b" data-d="0">كل الأيام</button><button class="ol-b" data-d="1">اليوم</button><button class="ol-b" data-d="7">٧ أيام</button>' +
      '<button class="ol-b" data-r>تحديث</button><button class="ol-b" data-cp>نسخ</button></div>' +
      '<div class="ol-chips">' + Object.keys(CAT_AR).map(function (k) { return '<button class="ol-c' + (k === st.cat ? ' on' : '') + '" data-c="' + k + '">' + CAT_AR[k] + '</button>'; }).join('') + '</div>' +
      '<div class="ol-list"><div class="ol-em">جارٍ التحميل…</div></div><div class="ol-more" style="text-align:center;margin-top:8px"></div>';
    var list = el.querySelector('.ol-list'), more = el.querySelector('.ol-more'), qIn = el.querySelector('.ol-q');

    function visible() {
      var q = st.q.trim().toLowerCase(), since = st.days ? Date.now() - st.days * 864e5 : 0;
      return st.rows.filter(function (r) {
        if (st.cat !== 'all' && catOf(r) !== st.cat) return false;
        if (since && new Date(r.at).getTime() < since) return false;
        if (!q) return true;
        var hay = [r.actor, r.page, actionLabel(r), r.entity_name, r.entity_id, r.field, r.old_value, r.new_value, r.reason].join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
    }
    function paint() {
      if (st.err) { list.innerHTML = '<div class="ol-w">' + st.err + '</div>'; more.innerHTML = ''; return; }
      var v = visible();
      if (!v.length) { list.innerHTML = '<div class="ol-em">' + (st.rows.length ? 'لا نتائج لهذا الفلتر.' : 'لا عمليات مسجّلة بعد — تظهر هنا كلّ عمليةٍ تُنفَّذ من الآن.') + '</div>'; }
      else list.innerHTML = v.slice(0, 400).map(function (r) {
        var ch = changes(r);
        return '<div class="ol-row"><div class="ol-h"><span class="ol-who">' + esc(r.actor || 'غير معروف') + '</span><span class="ol-what">' + esc(actionLabel(r)) + '</span>' +
          (r.entity_name ? '<span class="ol-ent">' + esc(r.entity_name) + (r.entity_id && String(r.entity_id) !== String(r.entity_name) && r.entity !== 'gmt_settings' ? ' <span class="ol-p">#' + esc(trunc(r.entity_id, 12)) + '</span>' : '') + '</span>' : '') +
          '<span class="ol-t">' + esc(when(r.at)) + '</span></div>' +
          (ch ? '<div class="ol-d">' + ch + '</div>' : '') +
          (r.reason ? '<div class="ol-d"><span class="ol-k">السبب:</span> ' + esc(r.reason) + '</div>' : '') +
          '<div class="ol-p">' + esc(r.page || '') + '</div></div>';
      }).join('');
      more.innerHTML = st.end ? (st.rows.length > 20 ? '<span class="ol-p">انتهى السجلّ</span>' : '') : '<button class="ol-b" data-m>' + (st.busy ? 'جارٍ…' : 'عرض الأقدم') + '</button>';
    }
    async function load(reset) {
      if (st.busy) return; st.busy = true;
      var d = db(); if (!d) { st.err = 'إعدادات القاعدة غير محمّلة.'; st.busy = false; paint(); return; }
      if (reset) { st.rows = []; st.end = false; st.err = ''; }
      try { await flush(); } catch (_) {}                                   /* ما في الطابور يصل قبل القراءة */
      var lim = opts.limit || 200;
      try {
        var r = await _raw(d.url + '/rest/v1/gmt_audit?select=*&order=at.desc&limit=' + lim + '&offset=' + st.rows.length,
          { headers: { apikey: d.key, Authorization: 'Bearer ' + d.key }, cache: 'no-store' });
        if (!r.ok) {
          st.err = (r.status === 404 || r.status === 400) ? 'جدول <b>gmt_audit</b> غير منشأ — شغّل ملف SQL الأساس («0_الأساس_الرئيسية_جزء1.sql») ثم أعد التحديث.' : 'تعذّرت قراءة السجلّ (HTTP ' + r.status + ').';
        } else {
          var rows = await r.json(); if (!Array.isArray(rows)) rows = [];
          st.rows = st.rows.concat(rows); if (rows.length < lim) st.end = true;
        }
      } catch (e) { st.err = 'لا اتصال بالقاعدة الآن — أعد المحاولة.'; }
      st.busy = false; paint();
    }
    el.addEventListener('click', function (e) {
      var c = e.target.closest('[data-c]'), d = e.target.closest('[data-d]');
      if (c) { st.cat = c.getAttribute('data-c'); el.querySelectorAll('[data-c]').forEach(function (b) { b.classList.toggle('on', b === c); }); paint(); }
      else if (d) { st.days = +d.getAttribute('data-d'); paint(); }
      else if (e.target.closest('[data-r]')) load(true);
      else if (e.target.closest('[data-m]')) load(false);
      else if (e.target.closest('[data-cp]')) {
        var txt = visible().slice(0, 300).map(function (r) { return [new Date(r.at).toLocaleString('ar-SY'), r.actor, actionLabel(r), r.entity_name || '', r.field || '', r.old_value || '', r.new_value || '', r.page || ''].join(' | '); }).join('\n');
        try { navigator.clipboard.writeText(txt); if (global.GMTAsk && GMTAsk.alert) GMTAsk.alert('نُسخ ' + Math.min(300, visible().length) + ' سطراً من السجلّ.', { title: 'تمّ' }); } catch (_) {}
      }
    });
    qIn.addEventListener('input', function () { st.q = qIn.value; paint(); });
    load(true);
    return { reload: function () { return load(true); } };
  }

  /* نافذة اللوحة (للأدمن) */
  async function open(opts) {
    opts = opts || {};
    try {
      if (global.GMTRole && GMTRole.requireAdmin && !(await GMTRole.requireAdmin('سجل العمليات'))) return;
    } catch (_) {}
    injectCss();
    var old = document.getElementById('gmt-oplog-ov'); if (old) old.remove();
    var ov = document.createElement('div'); ov.id = 'gmt-oplog-ov'; ov.setAttribute('data-keep-fab', '1');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483200;background:rgba(15,23,42,.55);backdrop-filter:blur(2px);display:flex;align-items:flex-end;justify-content:center;direction:rtl';
    ov.innerHTML = '<div style="background:#fff;width:min(760px,100%);max-height:90vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;box-shadow:0 -12px 50px rgba(0,0,0,.35)">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #eef1f5"><b style="font-size:16px;flex:1;font-family:inherit">سجل العمليات</b>' +
      '<span style="font-size:12px;color:#64748b">من فعل ماذا ومتى</span><button data-x style="border:0;background:#f1f5f9;border-radius:10px;padding:7px 14px;font:inherit;font-weight:800;cursor:pointer">إغلاق</button></div>' +
      '<div data-body style="padding:12px 18px 18px;overflow:auto;flex:1"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) ov.remove(); });
    mount(ov.querySelector('[data-body]'), opts);
  }

  /* ── إقلاع ── */
  function boot() {
    try {
      if (global.GMT_PUBLIC === true || global.GMT_PUBLIC === 1) return;
      install();
      flush();                                              // ما بقي من جلسةٍ سابقة (انقطاع)
      global.addEventListener('online', function () { flush(); });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(true); });
      global.addEventListener('pagehide', function () { flush(true); });
    } catch (_) {}
  }
  global.GMTOpLog = {
    log: log, flush: flush, open: open, mount: mount,
    /* حدثٌ بتخفيف: لا يتكرّر نفس المفتاح أكثر من مرّة كلّ minGapMs (محاولات الدخول الفاشلة) */
    logThrottled: function (key, e, minGapMs) {
      try { var k = 'gmt_oplog_t_' + key, last = +ls(k) || 0; if (Date.now() - last < (minGapMs || 30000)) return false; ls(k, String(Date.now())); } catch (_) {}
      return log(e);
    },
    before: function (table, fn) { beforeFns[table] = fn; },
    skipTables: function (arr) { (arr || []).forEach(function (t) { skip[t] = 1; }); },
    labels: { tables: T, actions: ACT_AR, categories: CAT_AR },
    _classify: classify, _summarize: summarize
  };
  boot();
  try { global.dispatchEvent(new CustomEvent('gmt:oplog-ready')); } catch (_) {}
})(typeof window !== 'undefined' ? window : this);
