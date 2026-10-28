/* ═══════════════════════════════════════════════════════════════════════
   gmt-config.js — مصدر الحقيقة الوحيد لمفاتيح قواعد البيانات
   استُخرج كملف مستقل: 2026-08-18

   سبب الاستخراج: الصفحات تستدعي <script src="gmt-config.js"> وتتوقّع كائن
   GMT_DB، لكن الملف لم يكن موجوداً في المستودع (كان مدموجاً داخل gmt-core.js
   فقط) ⇒ رسالة «مفاتيح Supabase غير موجودة — الصفحة لا تعرف عنوان القاعدة».
   المحتوى منسوخ حرفياً من الكتلة المدموجة — لا تغيير في أي مفتاح.

   ⚠️ يجب أن يُستدعى **قبل** باقي السكربتات:
       <script src="gmt-config.js"></script>
       <script src="gmt-core.js"></script>
   ═══════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════
   gmt-config.js — مصدر الحقيقة الوحيد لمفاتيح قواعد البيانات
   أُنشئ 2026-07-12 · توصية المهندس المعتمدة من المالك.

   المشكلة التي يحلّه: رابط القاعدة والمفتاح كانا مكرَّرين يدوياً في 16 ملفاً
   عبر 4 قواعد مختلفة. أي تدوير مفتاح = 16 تعديل يدوي — وأول ملف تنساه يفشل
   بصمت (لا رسالة خطأ، فقط بيانات لا تُحمَّل).

   بعد اليوم: أي مفتاح جديد يُغيَّر هنا فقط، ويُنشر هذا الملف على المجلدات.
   ⚠️ الملفات القديمة ما زالت تحمل مفاتيحها المضمّنة (لم نلمسها كي لا تنكسر)؛
   الهجرة تدريجية: كل ملف يُعدَّل مستقبلاً يقرأ من هنا:
       const { url, key } = GMT_DB.MAIN;
   ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const GMT_DB = {
    /* القاعدة الرئيسية — نقاط البيع · الجرد · الأوردرات · المشتريات · العمولات */
    MAIN: {
      url: 'https://ysawzwtmodkqqbqoiojj.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzYXd6d3Rtb2RrcXFicW9pb2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NjI0OTUsImV4cCI6MjA5MjAzODQ5NX0.g-dBDpHzMsP_0IQAKFxzWkKzc_I13bGUMeYNgcUmrKQ',
    },

    /* قاعدة الكفالات — إنشاء الكفالة · إدارتها · البحث عنها */
    WARRANTY: {
      url: 'https://abppuwylukzpqckazegk.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFicHB1d3lsdWt6cHFja2F6ZWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTQ4NzYsImV4cCI6MjA5ODczMDg3Nn0.Dx6WCUfXD4T8D_tJclB9VuMUS3B0YSwejexrRrYhnqo',
    },

    /* قاعدة المتجر — المنتجات · الطلبات · العروض */
    STORE: {
      url: 'https://tupldwylzrkjzqtaiscv.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGxkd3lsenJranpxdGFpc2N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTEzNTQsImV4cCI6MjA5MTA2NzM1NH0.RKsdAg4v7TcuMhBepztJtRdTtsR-f8cMcoDXKmnZXO0',
    },

    /* قاعدة الموقع الرئيسي — الأخبار · الوكلاء · بطاقات العروض */
    SITE: {
      url: 'https://znpakcaizvkwqzhosxvm.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpucGFrY2FpenZrd3F6aG9zeHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMzM0NTMsImV4cCI6MjA5NTkwOTQ1M30.YW3YuT-RRTpKw5WeFHkPeTUcXBBtaQFGCaCrBQWykks',
    },

  };

  /* رؤوس REST جاهزة لأي قاعدة: GMT_DB.headers(GMT_DB.MAIN) */
  GMT_DB.headers = (db, extra) => Object.assign({
    apikey         : db.key,
    Authorization  : 'Bearer ' + db.key,
    'Content-Type' : 'application/json',
  }, extra || {});

  /* عميل supabase-js جاهز (إن كانت المكتبة محمّلة) */
  GMT_DB.client = (db) => (global.supabase && global.supabase.createClient)
    ? global.supabase.createClient(db.url, db.key)
    : null;

  Object.freeze(GMT_DB);
  /* روابط عامّة يستعملها النظام في رسائل الزبائن (2026-08-26)
     كان رابط التتبّع يُسأل عبر prompt في كل مرّة لا يُحفظ فيها (مثلاً عند فتح الملف
     محلياً) ⇒ إزعاج وتبليغ في تقرير الصحة. يُضبط هنا مرّة واحدة. */
  /* (2026-10-06 · البند ١١٦ وصيد نمطه) كانت الروابط ثابتةً على النشر القديم «system_17» بينما النظام
     يُرفع اليوم إلى «rebrand_system» ⇒ رسائل الزبائن تفتح النسخة القديمة. صار الأساس **مكانَ النشر الحاليّ**
     تلقائياً (ويُحفظ آخر عنوانٍ منشور لاستعماله من نسخةٍ محلّية)، والقديم احتياطٌ أخير فقط. */
  var _pub = (function () {
    try {
      var u = location.origin + location.pathname.replace(/[^/]*$/, '');
      if (/^https?:/.test(u) && !/localhost|127\.0\.0\.1/.test(u)) { try { localStorage.setItem('gmt_public_base', u); } catch (_) {} return u; }
      var sv = localStorage.getItem('gmt_public_base'); if (sv) return sv;
    } catch (_) {}
    return 'https://general-media-tech.github.io/rebrand_system/';
  })();
  global.GMT_LINKS = global.GMT_LINKS || {
    base:  _pub,
    track: _pub + 'track_order.html',
    store: _pub + 'store.html',
    /* (2026-09-26) رابط «كيف تحصل على كوبون» — يُرسل في كليشة استلام الطلب.
       إن تغيّر النطاق بعد النشر: عدّله هنا فقط (مصدر واحد)، أو من الأوردرات
       بـ setCouponUrl('...') وتُحفظ محلياً بلا تعديل ملف. */
    coupon: _pub + 'site.html#coupons'
  };

  global.GMT_DB = GMT_DB;

  /* ══════════════════════════════════════════════════════════════════════
     🔧 (2026-08-18) أسماء مرادفة للتوافق — لا تُستعمل في الكود الجديد.
     السبب: صفحات قديمة تبحث عن أسماء مختلفة لنفس البيانات:
        • checks.html  ⇐ GMT_CONFIG.SUPABASE_URL / .SUPABASE_ANON_KEY
        • صفحات أخرى   ⇐ window.SUPABASE_URL / window.SUPABASE_ANON_KEY / SB / KEY
     ولأن هذا الملف يعرّف GMT_DB.MAIN.url فقط، كانت تلك الصفحات تُبلّغ
     «رابط/مفتاح القاعدة غير متوفر» رغم أن المفاتيح محمّلة فعلاً (نمط P1 على
     مستوى الأسماء: عدم تطابق صامت). نُوفّر المرادفات هنا **دون أن ندهس** أي
     قيمة عرّفتها الصفحة لنفسها.
     ══════════════════════════════════════════════════════════════════════ */
  if (!global.GMT_CONFIG) {
    global.GMT_CONFIG = Object.freeze({
      SUPABASE_URL      : GMT_DB.MAIN.url,
      SUPABASE_ANON_KEY : GMT_DB.MAIN.key,
      WARRANTY_URL      : GMT_DB.WARRANTY.url,
      WARRANTY_ANON_KEY : GMT_DB.WARRANTY.key,
      STORE_URL         : GMT_DB.STORE.url,
      STORE_ANON_KEY    : GMT_DB.STORE.key,
      SITE_URL          : GMT_DB.SITE.url,
      SITE_ANON_KEY     : GMT_DB.SITE.key,
    });
  }
  if (!global.SUPABASE_URL)      global.SUPABASE_URL      = GMT_DB.MAIN.url;
  if (!global.SUPABASE_ANON_KEY) global.SUPABASE_ANON_KEY = GMT_DB.MAIN.key;
  if (!global.SUPABASE_KEY)      global.SUPABASE_KEY      = GMT_DB.MAIN.key;

  /* ══════════════════════════════════════════════════════════════════════
     ☎️ رقم واتساب المتجر — موجودٌ أصلاً في إعداد `store.html` في مشروعك
     (`CONFIG.WHATSAPP_NUMBER`). نُظهره هنا كي يقرأه `GMTContact` في بقيّة
     الصفحات بدل الرقم المُختلَق `963900000000` الذي كان في ثلاث صفحات.
     ⚠️ لم أخترع هذا الرقم: هو رقمُك الموجود في ملفّك. وإن كان رقم **خدمة
     العملاء** غيره (القرار ق١) فأعطني إيّاه ويُضبط من هنا وحده.
     ══════════════════════════════════════════════════════════════════════ */
  if (!global.GMT_STORE_WHATSAPP) global.GMT_STORE_WHATSAPP = '963939773715';

  /* (2026-10-04 ك) بوت التبليغ — هو نفسُه الذي تستعمله نقطة البيع (TG_BOT_TOKEN في pos.html).
     يُقرأ من هنا لإشعار «حساب جديد». (17 ت1) «gmt-relay» علامةٌ لا مفتاح: المفتاح الحقيقي سرّ TG_BOT_TOKEN في الوسيط gmt-tg،
     وتغيير البوت يكون بتغيير السرّ في Supabase فقط — لا تكتب مفتاح بوتٍ في أي ملفّ هنا (المستودع عامّ). */
  global.GMT_TELEGRAM = { token: 'gmt-relay', chat: '-1003870992994' };
})(window);

/* ═══ (17 ت1 2026) الوسيط — مفاتيح البوت وJSONBin لا تُكتب في الصفحات العامّة ═══
   بلاغك (17 ت1): «كان هناك وصول غريب إلى البوت… غيّر اسمه إلى اسمٍ روسي وجعله يعمل لصالحه، فحذفته تيليغرام. السبب المرجّح
   وجود توكن البوت في كل مكان». المستودع عامّ ⇒ أيّ أحدٍ قرأ المفتاح. الآن الصفحات تكتب علامةً لا قيمة لها «gmt-relay» مكان المفتاح،
   وكل طلبٍ إلى api.telegram.org/botgmt-relay/<عملية> يُحوَّل إلى دالّة الخادم gmt-tg (المفتاح سرٌّ فيها وحدها: TG_BOT_TOKEN).
   لا رجوع للطريق المباشر أبداً (لم يعد في الصفحات مفتاحٌ يُرجَع إليه) — إن لم يُضبط السرّ تُرجع الدالّة 503 فتعرف الصفحة أن التبليغ لم يصل.
   بوتٌ آخر أدخله المستخدم بيده على جهازه (بثّ العروض) لا يحمل العلامة ⇒ يمرّ كما هو.
   نسخةٌ مطابقة في gmt-config.js و gmt-core.js — تعمل مرّةً واحدة أيّهما حُمِّل أوّلاً. */
(function (g) {
  if (!g || g.__gmtTgRelay || typeof g.fetch !== 'function') return;
  g.__gmtTgRelay = true;
  var nativeFetch = g.fetch, MARK = 'gmt-relay', warned = false;
  var RE = /^https:\/\/api\.telegram\.org\/bot([^/]+)\/([A-Za-z]+)(\?[^#]*)?$/;
  function fail(desc) {
    return new Response(JSON.stringify({ ok: false, relay: 'unreachable', description: desc }),
      { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  function warn(r) {
    if (r && r.status === 503 && !warned) {
      warned = true;
      try { console.warn('[GMT] بوت تيليغرام غير مضبوط بعد في الوسيط — ضع TG_BOT_TOKEN في أسرار Supabase (Edge Functions ← Secrets). التبليغ لم يُرسَل.'); } catch (_) {}
    }
    return r;
  }
  /* نداءٌ للوسيط بمسارٍ ما (sendMessage · jsonbin-order …) بمفتاح القاعدة العامّ — لا سرّ في المتصفّح.
     مهلةٌ ٢٠ ثانية (كما بقيّة طلبات النظام)، وانقطاع الشبكة **يُرفَض** كما كان مع الطريق المباشر — فلا تظنّ صفحةٌ أنّ التبليغ وصل. */
  function relay(path, opts) {
    var db = g.GMT_DB && g.GMT_DB.MAIN;
    if (!db || !db.url || !db.key) return Promise.resolve(fail('لا قاعدة للوسيط في هذه الصفحة'));
    opts = Object.assign({}, opts || {});
    var headers = new Headers(opts.headers || {});
    headers.set('Authorization', 'Bearer ' + db.key); headers.set('apikey', db.key);
    var ac = (typeof AbortController === 'function' && !opts.signal) ? new AbortController() : null, tm = null;
    if (ac) { opts.signal = ac.signal; tm = setTimeout(function () { try { ac.abort(); } catch (_) {} }, opts.timeoutMs || 20000); }
    delete opts.timeoutMs;
    return nativeFetch.call(g, db.url + '/functions/v1/gmt-tg/' + path, Object.assign(opts, { method: 'POST', headers: headers }))
      .then(function (r) { if (tm) clearTimeout(tm); return warn(r); }, function (e) { if (tm) clearTimeout(tm); throw e; });
  }
  /* نسخة الطلب للصندوق الاحتياطي: الحقول النصّية الأساسيّة فقط (لا كائنات المنتجات الكاملة) */
  var ORDER_KEYS = ['id', 'name', 'phone', 'address', 'product', 'price', 'subtotal', 'delivery', 'branch', 'notes', 'status', 'payment', 'coupon', 'discount', 'created_at', 'source'];
  g.GMTRelay = {
    call: relay,
    /* نسخة الطلب الاحتياطيّة في JSONBin (مفتاحها سرّ JSONBIN_MASTER_KEY في الوسيط) ⇒ true/false — بمهلة ٨ ثوانٍ */
    jsonbinOrder: function (order) {
      var o = {}; ORDER_KEYS.forEach(function (k) { if (order && order[k] != null && typeof order[k] !== 'object') o[k] = order[k]; });
      return relay('jsonbin-order', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: o }), timeoutMs: 8000 })
        .then(function (r) { return !!(r && r.ok); }, function () { return false; });
    }
  };
  g.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var m = RE.exec(url);
    if (!m || m[1] !== MARK) return nativeFetch.apply(g, arguments);
    var opts = Object.assign({}, init || {}), body = opts.body;
    var headers = new Headers(opts.headers || {});
    if (m[3] && (body == null || body === '')) {            // نداءٌ بمعاملات في الرابط ⇒ جسم JSON
      var o = {}; new URLSearchParams(m[3].slice(1)).forEach(function (v, k) { o[k] = v; });
      body = JSON.stringify(o); headers.set('Content-Type', 'application/json');
    }
    return relay(m[2], Object.assign(opts, { headers: headers, body: body }));
  };
})(typeof window !== 'undefined' ? window : this);
