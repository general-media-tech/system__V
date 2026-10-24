/* ═══════════════════════════════════════════════════════════════════════════
   gmt-brain.js — 🧠 عقل النظام (مساعد ذكي داخلي)  ·  2026-08-26
   ─────────────────────────────────────────────────────────────────────────
   طلب المالك:
     «بوت داخلي للموظفين والأدمن — ليس للزبائن. يرتبط بتقارير الأخطاء ويفهمها:
      شو يعني هذا الخطأ؟ هل هو خطير؟ شو تأثيره؟ وإذا نسيت كيف أعمل خطوة أو
      عندي موظف جديد يسأله كيف. ويقترح تطويرات. يكون العقل المدبّر للنظام».

   من أين يعرف؟ **لا معرفة مخترعة** — يجمع سياقه من النظام نفسه:
     • `GMT_OWNER_RULES` (19 قاعدة) — كل قاعدة وُلدت من عطل حقيقي.
     • `GMT_GUIDE_*` — دليل الصفحة الحالية زرّاً بزرّ.
     • `GMTWarden.report()` · `GMTMoneyGuard.incidents()` — البلاغات الحيّة.
     • `GMTSelfCheck` — نتائج الفحص الذاتي (أصول · جداول · دوال · هوية).
     • أخطاء الكونسول الملتقطة في هذه الجلسة.

   🔒 الأمان:
     • **داخلي فقط** — لا يُحمَّل في صفحات الزبون (store · site · search · track_order).
     • **قراءة فقط** — لا يعدّل بيانات ولا ينفّذ إصلاحات. يشرح ويقترح، والتنفيذ بيدك.
       (قرار مقصود: نظام مالي — لا يُترك لبوت أن يغيّر أرقاماً.)
     • **المفتاح لا يُوضع في الكود** — يُنادى عبر وسيط (Edge Function). انظر
       `_تفعيل_عقل_النظام.md` لخطوات التفعيل.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTBrain) return;

  /* صفحات الزبون — لا يُحمَّل فيها إطلاقاً */
  var CUSTOMER_PAGES = ['store.html', 'site.html', 'search.html', 'track_order.html', 'hiring.html'];
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (CUSTOMER_PAGES.indexOf(page) !== -1) return;

  var CFG_KEY = 'gmt_brain_endpoint';
  var HIST = [];
  var errLog = [];

  /* التقاط أخطاء الجلسة — مادة خام لتفسيرها لاحقاً */
  (function captureErrors() {
    var oe = console.error;
    console.error = function () {
      try { if (!global.__gmtSelfLog) errLog.push(Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 300)); if (errLog.length > 40) errLog.shift(); } catch (_) {}
      return oe.apply(console, arguments);
    };
    addEventListener('error', function (e) {
      errLog.push('[JS] ' + (e.message || '') + ' @ ' + (e.filename || '').split('/').pop() + ':' + (e.lineno || ''));
      if (errLog.length > 40) errLog.shift();
    });
    addEventListener('unhandledrejection', function (e) {
      errLog.push('[Promise] ' + String((e.reason && e.reason.message) || e.reason).slice(0, 200));
      if (errLog.length > 40) errLog.shift();
    });
  })();

  /* ── جمع سياق النظام (من النظام نفسه لا من الذاكرة) ── */
  function collectContext() {
    var ctx = { page: page, when: new Date().toLocaleString('ar-SY') };
    try {
      var R = global.GMT_OWNER_RULES;
      if (Array.isArray(R)) ctx.rules = R.map(function (r) {
        return r.id + ' [' + r.severity + ']: ' + r.rule + ' — سببها: ' + r.why;
      });
    } catch (_) {}
    try {
      for (var k in global) {
        if (k.indexOf('GMT_GUIDE_') === 0 && global[k] && global[k].page) {
          var g = global[k];
          ctx.guide = { page: g.page, slides: (g.slides || []).map(function (s) {
            return (s.title || '') + ': ' + (s.body || '') +
              ((s.bullets || []).map(function (b) { return ' • ' + String(b.t || '').replace(/<[^>]+>/g, ''); }).join(''));
          }).slice(0, 12) };
          break;
        }
      }
    } catch (_) {}
    try { if (global.GMTWarden && GMTWarden.report) ctx.warden = String(GMTWarden.report()).slice(0, 2500); } catch (_) {}
    /* (2026-08-26) معرفة الميزات الجديدة — تُرفق دائماً. كان العقل يستقي فقط من دليل
       الصفحة، فلا يعرف الميزات المضافة لاحقاً (الطباعة الجماعية · التقفيل · سجل المبيعات…). */
    try {
      // مكاتب شركات الشحن — ليجيب العقل «وين مكتب المفتي بحماة؟» من بياناتك
      if (global.GMTOffices) {
        ctx.shippingOffices = GMTOffices.all().map(function (o) {
          return o.company + ' · ' + o.city + ' — ' + o.name + ': ' + o.addr + (o.phone ? ' ☎ ' + o.phone : '');
        });
        /* (2026-09-26) أي شركة مفعّل لها التتبّع الإلكتروني — كان العقل يعرف المكاتب
           ولا يعرف «مين فيه تتبّع»، فيجاوب من معرفته العامة بدل بياناتنا. */
        if (GMTOffices.trackUrlOf) {
          ctx.shippingTracking = GMTOffices.companies().map(function (c) {
            var u = GMTOffices.trackUrlOf(c);
            return c + ': ' + (u ? 'التتبّع مفعّل — ' + u : 'لا يوجد تتبّع إلكتروني بعد');
          });
        }
      }
      var U = global.GMT_GUIDE_UPDATES;
      if (U && Array.isArray(U.slides)) ctx.newFeatures = U.slides.map(function (s) {
        return s.title + ' [' + (s.page || '') + ']: ' + (s.body || '') +
          (s.bullets || []).map(function (b) { return ' • ' + (b.t || ''); }).join('');
      });
    } catch (_) {}
    try { if (global.GMTMoneyGuard && GMTMoneyGuard.incidents) ctx.money = JSON.stringify(GMTMoneyGuard.incidents()).slice(0, 1500); } catch (_) {}
    if (errLog.length) ctx.errors = errLog.slice(-15);
    return ctx;
  }

  /* ── ② طبقة البيانات الحيّة: يقرأ من قواعدك حسب السؤال (قراءة فقط) ──
     الهدف: لا يجيب كلود من معرفته العامة، بل من **بياناتك أنت**.
     يُستخرج من السؤال ما يلزم فقط — لا تُرسل القاعدة كاملة (خصوصية وتكلفة). */
  /* 🔧 (2026-08-26) الاسم الصحيح للإعداد هو window.GMT_DB (تحقّقت من gmt-config.js:70).
     كان يُقرأ GMT_CONFIG.DATABASES وهو غير موجود ⇒ كل قراءة بيانات كانت تفشل بصمت. */
  function db(name) {
    var C = global.GMT_CONFIG || {};
    var d = (global.GMT_DB && global.GMT_DB[name]) || (C.DATABASES && C.DATABASES[name]) || null;
    if (!d && name === 'MAIN' && global.SUPABASE_URL && global.SUPABASE_KEY) {
      d = { url: global.SUPABASE_URL, key: global.SUPABASE_KEY };   // احتياطي
    }
    return (d && d.url && d.key) ? d : null;
  }
  async function q(dbName, path) {
    var d = db(dbName); if (!d) return null;
    try {
      var r = await fetch(d.url + '/rest/v1/' + path,
        { headers: { apikey: d.key, Authorization: 'Bearer ' + d.key } });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  }
  /* يستخرج مصطلح البحث من السؤال (يتجاهل كلمات الاستفهام الشائعة) */
  function searchTerm(question) {
    var stop = ['كم','شو','وين','كيف','ليش','هل','في','من','على','عن','باقي','عندي','عنا','الـ','ال','بدي','اعطيني','أعطيني','كام','متى','الطلب','الاوردر','الأوردر','المنتج','القطعة','رقم'];
    return String(question).replace(/[؟?,.!]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length >= 3 && stop.indexOf(w) === -1; })
      .slice(0, 3);
  }
  async function collectLiveData(question) {
    var out = {}, qs = String(question);
    var terms = searchTerm(qs);
    var wantStock = /كمي|مخزون|باقي|متوفر|رصيد|قطعة|جرد|كام واحد/.test(qs);
    var wantOrder = /اوردر|أوردر|طلب|شحن|تتبع|زبون|تحصيل/.test(qs);
    var wantMoney = /صندوق|محصّل|محصل|مبيعات|تقفيل|عجز|مصروف|عمولة/.test(qs);
    /* نيّة الترشيح لزبون: يسأل بالمواصفات لا بالاسم («بدي راس إضاءة 100 وات») */
    var wantAdvise = /رشح|رشّح|اقترح|زبون بدو|زبون بيدور|بدو|شو عندنا|شو في عندي|شو الخيارات|بديل|مناسب|وات|w\b|انش|إنش|mm|ملم|ميجا|ma?h\b|بطارية|عدسة|اضاءة|إضاءة|حامل|مايك|ترايبود/i.test(qs);

    if (wantAdvise) {
      /* ابحث بالمواصفات عبر الاسم والوصف — المتجر يحمل الوصف التفصيلي */
      var found = [], seen = {};
      for (var a = 0; a < terms.length; a++) {
        var enc = encodeURIComponent(terms[a]);
        /* (ر) منتجات المتجر **ليست جدول products** — مصفوفة JSON في عمود products بصفّ gmt_store
           (كان الطلب يُرَدّ 400 في كل سؤال ترشيح). نقرأ الصفّ مرّة ونبحث فيه هنا. */
        if (!global.__gmtStoreProds) {
          var gs = await q('STORE', 'gmt_store?select=products&limit=1');
          var arr = gs && gs[0] && gs[0].products; if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (_) { arr = []; } }
          global.__gmtStoreProds = Array.isArray(arr) ? arr : [];
        }
        var low = String(terms[a]).toLowerCase();
        var st = global.__gmtStoreProds.filter(function (p) { return p && [p.name, p.short_name, p.description].some(function (v) { return String(v || '').toLowerCase().indexOf(low) >= 0; }); }).slice(0, 10);
        (st || []).forEach(function (p) {
          var k = p.barcode || p.name;
          if (!seen[k]) { seen[k] = 1; found.push(p); }
        });
        var mn = await q('MAIN', 'products?or=(name.ilike.*' + enc + '*,barcode.ilike.*' + enc +
          '*)&select=name,barcode,price,wholesale_price&limit=10');
        (mn || []).forEach(function (p) {
          var k = p.barcode || p.name;
          if (!seen[k]) { seen[k] = 1; found.push(p); }
        });
      }
      if (found.length) out.catalogMatches = found.slice(0, 14);
      out.adviseMode = true;
    }

    if (wantStock && terms.length) {
      for (var i = 0; i < terms.length && !out.products; i++) {
        var rows = await q('MAIN', 'products?or=(name.ilike.*' + encodeURIComponent(terms[i]) +
          '*,barcode.ilike.*' + encodeURIComponent(terms[i]) + '*)&limit=8');
        if (rows && rows.length) out.products = rows;
      }
    }
    if (wantOrder && terms.length) {
      for (var j = 0; j < terms.length && !out.orders; j++) {
        var o = await q('MAIN', 'gmt_orders?or=(name.ilike.*' + encodeURIComponent(terms[j]) +
          '*,serial_code.ilike.*' + encodeURIComponent(terms[j]) +
          '*,tracking_number.ilike.*' + encodeURIComponent(terms[j]) +
          '*)&select=id,serial_code,name,status,price,shipping_company,tracking_number,address,created_at&limit=8');
        if (o && o.length) out.orders = o;
      }
    }
    if (wantMoney) {
      var c = await q('MAIN', 'gmt_daily_closes?select=close_date,branch_name,expected_cash,counted_cash,variance,sales_total&order=close_date.desc&limit=8');
      if (c && c.length) out.recentCloses = c;
    }
    // ملخّص عام دائماً (رخيص ومفيد)
    if (global.orders && Array.isArray(global.orders)) {
      var st = {};
      global.orders.forEach(function (o) { st[o.status] = (st[o.status] || 0) + 1; });
      out.ordersOnPage = { total: global.orders.length, byStatus: st };
    }
    if (global.allProducts && Array.isArray(global.allProducts)) {
      out.productsOnPage = { total: global.allProducts.length };
    }
    /* (2026-10-06 ش) البند ١٤١: «العقل يقرأ النظام والمبيعات والأرباح والتحديثات».
       ① آخر التحديثات (ما الجديد) — كي يجيب «شو تغيّر؟» ويعرف الأدوات الجديدة.
       ② المبيعات والأرباح التقديريّة للشهر حين يُسأل عنها — للإدارة فقط. */
    try { if (global.GMTWhatsNew && GMTWhatsNew.news) out.updates = (GMTWhatsNew.news() || []).slice(0, 6).map(function (n) { return n.t; }); } catch (_) {}
    var wantProfit = /ربح|أرباح|ارباح|مبيعات الشهر|هالشهر|الشهر|دخل/.test(qs);
    var adm = false; try { adm = !!(global.GMTRole && GMTRole.isAdmin()); } catch (_) {}
    if (wantProfit && adm) {
      var d0 = new Date(); d0 = new Date(d0.getFullYear(), d0.getMonth(), 1).toISOString();
      var inv = await q('MAIN', 'invoices?select=total,sale_type,customer_name,branch_key&created_at=gte.' + encodeURIComponent(d0) + '&limit=20000');
      var com = await q('MAIN', 'invoice_commissions?select=amount&created_at=gte.' + encodeURIComponent(d0) + '&limit=20000');
      var exp = await q('MAIN', 'gmt_expenses?select=amount,currency,exchange_rate,kind,approved,note&approved=is.true&created_at=gte.' + encodeURIComponent(d0) + '&limit=5000');
      if (Array.isArray(inv)) {
        inv = inv.filter(function (r) { return !String(r.customer_name || '').startsWith('[تدريب]'); });
        var sales = inv.filter(function (r) { return !/مرتجع/.test(r.sale_type || '') && Number(r.total) > 0; }).reduce(function (s, r) { return s + Number(r.total); }, 0);
        var rets = inv.filter(function (r) { return /مرتجع/.test(r.sale_type || '') || Number(r.total) < 0; }).reduce(function (s, r) { return s + Math.abs(Number(r.total) || 0); }, 0);
        var cm = (com || []).reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
        var ex = (exp || []).filter(function (e) { return !/^رأسمالي/.test(e.kind || '') && !/\[PO:[^\]]+\]/.test(e.note || ''); })   /* قيود دفتر الشراء خروجُ نقدٍ لا مصروف (مراجعة ACCT-6) */.reduce(function (s, e) { return s + (e.currency === 'syp' ? (Number(e.amount) || 0) / (Number(e.exchange_rate) || 140) : (Number(e.amount) || 0)); }, 0);
        out.monthMoney = { sales: Math.round(sales), returns: Math.round(rets), commissions: Math.round(cm), expenses: Math.round(ex), note: 'الربح الصافي يحتاج تكلفة البضاعة — هذه أرقام المبيعات والمصاريف فقط' };
      }
    }
    return out;
  }

  var SYSTEM_PROMPT =
    'أنت «عقل نظام GMT» — مساعد داخلي **مخصّص حصراً** لنظام شركة جنرال ميديا تيك (متجر كاميرات، وكيل كانون في سوريا).\n' +
    'النظام ERP عربي: الجرد · المشتريات · الأوردرات · نقطة البيع وأدمنها · المتجر · الموقع · الكفالات · العقود · التوظيف.\n' +
    'أربع قواعد Supabase: MAIN (بيع/جرد/أوردرات/محاسبة) · WARRANTY · STORE · SITE.\n\n' +
    '🔒 **نطاقك مقفل — هذا أهم شرط:**\n' +
    '• تجيب **فقط** من «سياق النظام» المرفق مع كل سؤال (القواعد · دليل الصفحة · البلاغات · البيانات الحيّة).\n' +
    '• **ممنوع** أن تجيب من معرفتك العامة عن أي شيء خارج هذا النظام: لا معلومات عامة، ولا نصائح تقنية عامة،\n' +
    '  ولا مواضيع لا علاقة لها بالنظام (طقس · رياضة · برمجة عامة · أخبار · مواصفات كاميرات من معرفتك…).\n' +
    '• إن سُئلت خارج النطاق قل بأدب: «هاد خارج نطاقي — أنا مخصّص لنظام GMT بس» واقترح سؤالاً مفيداً.\n' +
    '• إن كان السؤال عن النظام لكن **المعلومة غير موجودة** في السياق، قل صراحةً:\n' +
    '  «ما لقيت هالمعلومة بالسياق» + أين يجدها (أي صفحة أو أي ملف توثيق). **لا تخمّن ولا تخترع رقماً أبداً.**\n' +
    '• الأرقام والأسماء والحالات: **انسخها كما هي من البيانات المرفقة** — لا تحسب أرقاماً من عندك ولا تقرّب.\n\n' +
    'دورك داخل النطاق:\n' +
    '① تفسير الأخطاء: ماذا يعني الخطأ، **هل هو خطير**، تأثيره العملي على الشغل والفلوس والمخزون، ثم الحل.\n' +
    '② تعليم الاستخدام: خطوة بخطوة لموظف جديد، من دليل الصفحة المرفق.\n' +
    '③ الإجابة من البيانات الحيّة: كميات · أوردرات · تقفيلات — من المرفق فقط.\n' +
    '④ اقتراح تطويرات عند نقص حقيقي مدعوم بالبلاغات.\n' +
    '⑤ **مساعدة المبيعات:** إذا وصلك `catalogMatches` (زبون يسأل بالمواصفات لا بالاسم):\n' +
    '   • رشّح من **هذه القائمة فقط** — هي بضاعتنا الموجودة. لا ترشّح منتجاً ليس فيها.\n' +
    '   • أعطِ **2–4 خيارات** كحدّ أقصى، كلٌّ بسطر واحد: الاسم · السعر · **سبب مختصر جداً** لماذا يناسب.\n' +
    '   • رتّبها من الأقرب لطلب الزبون للأبعد، واذكر الفرق بينها بكلمتين (أقوى · أرخص · أخفّ).\n' +
    '   • ثم أضف سطراً: «رسالة جاهزة للزبون:» يتبعه نصّ قصير مهذّب ينسخه الموظف ويرسله.\n' +
    '   • إن لم يطابق شيء قل: «ما عندنا شي مطابق — أقرب شي: …» أو «ما في بالمخزون».\n\n' +
    'قواعد الأسلوب:\n' +
    '• **بالعامية الشامية**، بإيجاز ووضوح (3–6 أسطر للسؤال العادي).\n' +
    '• **ممنوع الحشو**: لا مقدّمات («بكل سرور» · «سؤال ممتاز») ولا خواتيم ولا تكرار السؤال.\n' +
    '  ادخل بالجواب مباشرةً. لا مبالغات تسويقية ولا كلام عام.\n' +
    '• لا تعطِ تعليمات تعدّل بيانات مالية أو مخزون مباشرةً بالقاعدة — اشرح الطريقة الصحيحة **من داخل النظام**.\n' +
    '• رتّب الخطورة: 🔴 حرج (فلوس/مخزون يضيع) · 🟠 مهم (يعطّل عملاً) · ⚪ بسيط.';

  /* 🔧 (2026-10-03) المصدر الواحد أوّلاً — «مرّةً واحدة للنظام كلّه لا لكل جهاز» */

  /* ═══ (2026-10-05 ف) منتجٌ من علي بابا — بالرابط أو بالصورة ⇒ مواصفاتٌ كاملة للنظام والمتجر ═══
     يرسل للوسيط mode:"product" (الخادم يجلب الصفحة ويبحث في الويب)، ويعرض النتيجة للمراجعة قبل التطبيق. */
  function shrinkB64(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var z = 1280, sc = Math.min(1, z / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
        };
        im.onerror = rej; im.src = fr.result;
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  /* (11 ت١ · طلب المالك) «مواصفات علي بابا ما لازم يطلب مني ارفع صورة المنتج — لازم ياخذ الصورة اللي عندي مع الاسم اللي عندي».
     نقرأ صورة المنتج المحفوظة (رابط في القاعدة) كبايتات: fetch ثم Canvas كاحتياط CORS؛ وإن تعذّرتا يُكمَل البحث بالاسم وحده. */
  function urlToBlob(u) {
    return new Promise(function (resolve) {
      var done = false, fin = function (b) { if (!done) { done = true; resolve(b || null); } };
      setTimeout(function () { fin(null); }, 15000);
      try {
        fetch(u, { mode: 'cors' }).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
          if (b && /^image\//.test(b.type || 'image/')) return fin(b);
          viaCanvas();
        }).catch(viaCanvas);
      } catch (_) { viaCanvas(); }
      function viaCanvas() {
        try {
          var im = new Image(); im.crossOrigin = 'anonymous';
          im.onload = function () {
            try { var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); c.toBlob(function (b) { fin(b); }, 'image/jpeg', 0.9); }
            catch (_) { fin(null); }
          };
          im.onerror = function () { fin(null); };
          im.src = u;
        } catch (_) { fin(null); }
      }
    });
  }
  async function importProduct(o) {
    var url = endpoint(); if (!url) throw new Error('عقل النظام غير مفعّل — أدخل رابط الوسيط من «تفعيل عقل النظام»');
    var body = { mode: 'product', url: (o && o.url) || '', hint: (o && o.hint) || '' };
    if (o && o.file) { body.image = await shrinkB64(o.file); body.image_type = 'image/jpeg'; }
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = {}, rawTxt = ''; try { rawTxt = await r.text(); j = JSON.parse(rawTxt); } catch (_) {}
    if (!r.ok || j.error) throw new Error(j.error || (global.GMTEndpoint && GMTEndpoint.explain ? GMTEndpoint.explain(r.status, rawTxt, url) : ('HTTP ' + r.status)));
    /* (24 ت1 · seq 46 «البحث بعلي بابا مو شغال») ردٌّ بلا اسمٍ ولا مواصفات كان يُعرض «—» و«لم تُجمع مواصفات» كأنه نجاح ⇒ رسالةٌ واضحة بدلاً منه */
    if (j.empty || !j.product) throw new Error('لم يجد العقل مواصفاتٍ لهذا المنتج — الصق رابط صفحته على علي بابا، أو اكتب اسمه وموديله بدقّة ثمّ أعد البحث.');
    var p = j.product;
    /* مصدر النتيجة (google · duckduckgo · memory) — غير قابل للتعداد فلا يدخل فيما يُحفظ على المنتج */
    try { Object.defineProperty(p, '_meta', { value: { engine: j.engine || '', from_memory: !!j.from_memory, searched: !!j.searched, page_ok: !!j.page_ok, sources: Array.isArray(j.sources) ? j.sources : [] }, enumerable: false }); } catch (_) {}
    return p;
  }
  function h(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function productImportDialog(onApply, preset) {
    var w = document.createElement('div'); w.setAttribute('data-keep-fab', '1');
    /* (١٠ ت١ — ملاحظات) نفس نمط «نافذة الرابط خلف العقل»: هذه النافذة تُفتح من أزرار لوحة العقل (علي بابا · سجل المعرفة)
       ولوحةُ العقل 2147483400 فكانت تختفي تحتها. الآن فوقها (ودون نوافذ السؤال 2147483640). */
    w.style.cssText = 'position:fixed;inset:0;z-index:2147483500;background:rgba(15,18,25,.45);display:grid;place-items:center;padding:14px;direction:rtl;font-family:inherit';
    var inp = 'width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;box-sizing:border-box';
    w.innerHTML = '<div style="width:100%;max-width:560px;max-height:90vh;overflow:auto;background:#fff;border-radius:22px;padding:18px;box-shadow:0 30px 80px rgba(15,18,25,.25)">' +
      '<div style="display:flex;align-items:center;gap:8px"><b style="font-size:17px;flex:1">🧠 مواصفات منتج من علي بابا</b><button data-x style="border:0;background:#f1f5f9;border-radius:10px;padding:6px 12px;font:inherit;font-weight:800;cursor:pointer">إغلاق</button></div>' +
      ((preset && (preset.imageUrl || preset.name))
        ? '<div style="display:flex;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:14px;padding:8px 10px;margin:6px 0 10px;background:#f8fafc">' +
            (preset.imageUrl ? '<img src="' + h(preset.imageUrl) + '" alt="" style="width:54px;height:54px;object-fit:contain;border-radius:10px;background:#fff" onerror="this.remove()">' : '') +
            '<div style="flex:1;min-width:0"><b style="font-size:14px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + h(preset.name || '') + '</b>' +
            '<span style="font-size:12px;color:#526077">سأبحث بصورة المنتج واسمه الموجودَين عندك — لا حاجة لرفع صورة. تقدر تضيف رابطاً أو ملاحظة لدقّة أكبر.</span></div></div>'
        : '<div style="font-size:12.5px;color:#526077;margin:4px 0 10px">الصق رابط صفحة المنتج، أو ارفع صورته — يجمع العقل المواصفات كاملة، وتراجعها قبل التطبيق.</div>') +
      '<input id="pi-url" dir="ltr" style="' + inp + '" placeholder="https://www.alibaba.com/product-detail/..." value="' + h((preset && preset.url) || '') + '">' +
      '<div style="display:flex;gap:8px;margin-top:8px"><label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:1.5px dashed #cbd5e1;border-radius:12px;padding:10px;cursor:pointer;font-weight:800;font-size:13px">' + ((preset && preset.imageUrl) ? '📷 صورة أخرى (اختياري)' : '📷 صورة المنتج') + '<input id="pi-img" type="file" accept="image/*" hidden></label>' +
      '<input id="pi-hint" style="' + inp + ';flex:1.4" placeholder="ملاحظة (اختياري): اسم أو موديل" value="' + h((preset && preset.name) || '') + '"></div>' +
      '<div id="pi-err" style="min-height:1.2em;margin-top:8px;color:#b91c1c;font-size:13px;font-weight:800"></div>' +
      '<button id="pi-go" style="width:100%;background:#0f1219;color:#fff;border:0;border-radius:12px;padding:12px;font:inherit;font-weight:900;cursor:pointer">ابحث واجمع المواصفات</button>' +
      '<div id="pi-res" style="margin-top:12px"></div></div>';
    document.body.appendChild(w);
    var $ = function (id) { return w.querySelector('#' + id); }, file = null, last = null;
    w.addEventListener('click', function (e) { if (e.target === w || e.target.closest('[data-x]')) w.remove(); });
    $('pi-img').addEventListener('change', function () { file = this.files && this.files[0]; this.parentNode.firstChild.textContent = file ? '📷 ' + file.name.slice(0, 22) : ((preset && preset.imageUrl) ? '📷 صورة أخرى (اختياري)' : '📷 صورة المنتج'); });
    $('pi-go').addEventListener('click', async function () {
      var b = this; $('pi-err').textContent = '';
      var hasPreset = !!(preset && (preset.imageUrl || preset.name));
      if (!$('pi-url').value.trim() && !file && !hasPreset && !$('pi-hint').value.trim()) { $('pi-err').textContent = 'الصق رابطاً أو اختر صورة'; return; }
      b.disabled = true; b.textContent = 'العقل يبحث… (قد يأخذ نصف دقيقة)';
      try {
        var useFile = file;
        if (!useFile && preset && preset.imageUrl) {
          useFile = await urlToBlob(preset.imageUrl);
          if (!useFile) $('pi-err').textContent = 'تعذّرت قراءة صورة المنتج — سأبحث باسمه وحده.';
        }
        var pr = await importProduct({ url: $('pi-url').value.trim(), file: useFile, hint: $('pi-hint').value.trim() }); last = pr;
        var specs = Array.isArray(pr.specs) ? pr.specs.filter(function (s) { return s && s.k; }) : [];
        var meta = pr._meta || {};
        var srcLine = meta.from_memory ? '' : meta.engine === 'google' ? '🔎 من بحث Google' : meta.engine === 'duckduckgo' ? '🔎 من نتائج DuckDuckGo' : meta.page_ok ? '📄 من صفحة الرابط' : '';
        $('pi-res').innerHTML =
          (meta.from_memory ? '<div data-pi-memory style="border:1.5px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:14px;padding:10px 12px;margin-bottom:10px;font-size:12.5px;line-height:1.8">' +
            '<b>⚠ ليست من صفحة المنتج</b> — البحث في الويب غير متاح الآن، فهذه مواصفاتٌ عامّة من معرفة الذكاء الاصطناعي (ثقة منخفضة). راجعها قبل التطبيق، أو الصق رابط المنتج على علي بابا لنتيجةٍ دقيقة.</div>' : '') +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px">' +
          '<div style="display:flex;gap:10px">' + ((pr.images && pr.images[0]) ? '<img src="' + h(pr.images[0]) + '" style="width:72px;height:72px;object-fit:contain;border-radius:12px;background:#f8fafc" onerror="this.remove()">' : '') +
          '<div style="flex:1"><b style="font-size:15px">' + h(pr.name_ar || pr.name_en || '—') + '</b><div style="font-size:12px;color:#526077" dir="ltr">' + h([pr.brand, pr.model].filter(Boolean).join(' · ')) + '</div>' +
          '<div style="font-size:11.5px;margin-top:4px">الثقة: <b>' + h(pr.confidence || '—') + '</b>' + (pr.price_hint ? ' · سعر المصدر: ' + h(pr.price_hint) : '') + (srcLine ? ' · <span data-pi-src>' + srcLine + '</span>' : '') + '</div></div></div>' +
          (specs.length ? '<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px">' + specs.map(function (s) { return '<tr><td style="padding:5px 8px;border:1px solid #eef2f7;background:#f8fafc;font-weight:800;width:38%">' + h(s.k) + '</td><td style="padding:5px 8px;border:1px solid #eef2f7">' + h(s.v) + '</td></tr>'; }).join('') + '</table>' : '<div style="color:#94a3b8;font-size:12.5px;margin-top:8px">لم تُجمع مواصفات.</div>') +
          ((pr.compat && pr.compat.length) ? '<div style="margin-top:8px;font-size:12.5px"><b>متوافق مع:</b> ' + pr.compat.map(h).join(' · ') + '</div>' : '') +
          (pr.description_ar ? '<div style="margin-top:8px;font-size:12.5px;line-height:1.8;background:#fafbfc;border-radius:10px;padding:8px 10px">' + h(pr.description_ar) + '</div>' : '') +
          (pr.notes ? '<div style="margin-top:6px;font-size:11.5px;color:#b45309">' + h(pr.notes) + '</div>' : '') +
          (pr.source_url ? '<div style="margin-top:6px;font-size:11px"><a href="' + h(pr.source_url) + '" target="_blank" rel="noopener" dir="ltr">' + h(pr.source_url).slice(0, 70) + '</a></div>' : '') + '</div>' +
          (onApply ? '<button data-apply style="width:100%;margin-top:10px;background:#D5001C;color:#fff;border:0;border-radius:12px;padding:12px;font:inherit;font-weight:900;cursor:pointer">تطبيق على المنتج</button>' : '');
        var ap = w.querySelector('[data-apply]');
        if (ap) ap.addEventListener('click', async function () { ap.disabled = true; ap.textContent = 'لحظة…'; try { await onApply(last); w.remove(); } catch (e) { $('pi-err').textContent = 'تعذّر التطبيق: ' + (e.message || e); ap.disabled = false; ap.textContent = 'تطبيق على المنتج'; } });
      } catch (e) { $('pi-err').textContent = e.message || String(e); }
      b.disabled = false; b.textContent = 'ابحث واجمع المواصفات';
    });
    setTimeout(function () { $('pi-url').focus(); }, 50);
  }

  function endpoint() {
    try { if (global.GMTEndpoint && GMTEndpoint.get) { var u = GMTEndpoint.get('brain'); if (u) return u; } } catch (_) {}
    /* (17 ت1) رابطٌ محفوظ على الجهاز لا يُقبل إلا إن كان دالّة مشروعنا — لا يُحوَّل العقل لخادمٍ غريب */
    try { var v = localStorage.getItem(CFG_KEY) || ''; return /^https:\/\/ysawzwtmodkqqbqoiojj\.(?:supabase\.co\/functions\/v1|functions\.supabase\.co)\/gmt-brain\/?$/i.test(v) ? v : ''; } catch (_) { return ''; }
  }

  /* ═══ (2026-10-05 ص) البند ١٤٠: «ذكاءٌ محلّي للأسئلة البسيطة بلا استهلاك كريدت».
     «كم باقي من…» و«سعر…» تُجاب من القاعدة مباشرةً — بلا وسيط، بلا رصيد، وحتى قبل تفعيل العقل.
     إن لم يُعرف المنتج بيقين (لا نتائج أو أكثر من ٦) يذهب السؤال للعقل كالعادة. ═══ */
  /* ═══ (2026-10-05 ق) «نعم درّب أشياء صغيرة — البحث بلا مفاتيح للأشياء البسيطة جداً أو البديهيّة».
     ١) أسئلة «كيف أعمل…» الشائعة ⇐ جوابٌ مكتوب من النظام نفسه (لا ذكاء ولا رصيد).
     ٢) «وين وصل أوردر فلان / رقم…» ⇐ من جدول الأوردرات.
     ٣) «كم بعنا اليوم» ⇐ من فواتير اليوم (الموظّف يرى فرعه فقط).
     ٤) «كم باقي من…» و«سعر…» ⇐ من المنتجات (موجود).  وما سوى ذلك يذهب للعقل. ═══ */
  var FAQ = [
    [/مرتجع|ارجاع|إرجاع|رجّع|رجع الزبون/, 'المرتجع: نقطة البيع ⇠ «الفواتير» ⇠ افتح الفاتورة ⇠ «↩︎ مرتجع» — كلّياً أو جزئياً، فيعود المخزون وتنعكس العمولة. وإن كانت مربوطة بأوردر: من الأوردرات اضغط 🔗 على الأوردر ⇠ «مرتجع» أو «مرتجع + فكّ».'],
    [/مصروف|مصاريف/, 'تسجيل مصروف: نقطة البيع ⇠ «تسجيل مصروف» (بجانب تقفيل اليوم) ⇠ البند والمبلغ والعملة والنوع ⇠ «إرسال للموافقة». لا يُخصم من الصندوق حتى توافق الإدارة من «أدمن نقاط البيع ⇠ المصاريف».'],
    [/كفال/, 'الكفالة: بعد البيع اضغط «🛡 كفالة»، أو من «الفواتير» ⇠ أيّ فاتورة ⇠ «🛡 كفالة» — تُفتح معبّأة ببيانات الفاتورة، وإن كانت عدّة قطع تختار القطعة.'],
    [/ملصق|باركود.*طباع|طباعة.*باركود/, 'الملصقات: «طابعة الملصقات» من الرئيسيّة — باركود وأسعار وملصق الكفالة.'],
    [/كلمة (ال)?سر|باسورد|غيّر (اسمي|كلمة)|حسابي/, 'من الرئيسيّة ⇠ بطاقتك ⇠ «حسابي»: الاسم واسم المركز والصورة، وكلمة السرّ (تكتب الحاليّة أوّلاً).'],
    [/(اكثر|أكثر) من قطعة|كمية|كميّة|زيد قطعة/, 'في نقطة البيع كل ضغطة على «+» في بطاقة المنتج قطعةٌ إضافيّة، و«−» تُنقص — والسلّة بجانب المنتجات (أو تحتها على الهاتف).'],
    [/تراجع|رجّع التعديل|غلطت بالجرد/, 'في الجرد: زرّ «تراجع» أو Ctrl+Z — حتى ١٠ خطوات، والعمليّة الجماعيّة خطوةٌ واحدة، وفيه سجلّ آخر ٦٠ حركة.'],
    [/كشف حساب/, 'كشف الحساب: أدمن نقاط البيع ⇠ المحاسبة ⇠ «كشف حساب شهري» — لفرعٍ أو بائعٍ أو زبون، بكل قطعة وعمولتها.'],
    [/فكّ|فك الربط|فك الارتباط/, 'فكّ الأوردر عن فاتورته: من الأوردرات اضغط 🔗 ⇠ «مرتجع + فكّ ⇐ تعديل» أو «⇐ فاتورة جديدة». الفكّ يتمّ بعد مرتجعٍ كامل فقط.'],
  ];
  function todayIso() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  async function localAnswer(question) {
    var qn = String(question || '');
    if (/^(كيف|شلون|وين بلاقي|من وين|كيفية)/.test(qn.trim()) || /كيف (اعمل|أعمل|بعمل|بسجّل|بسجل|بطبع|بغيّر)/.test(qn)) {
      for (var fi = 0; fi < FAQ.length; fi++) if (FAQ[fi][0].test(qn)) return FAQ[fi][1] + '<br><span style="font-size:11px;color:#526077">⚡ من دليل النظام — بلا استهلاك رصيد</span>';
    }
    if (/(وين وصل|شو صار ب|حالة|تتبع|تتبّع).*(اوردر|أوردر|طلب|شحن)|(اوردر|أوردر) (فلان|الزبون)/.test(qn)) {
      var ws = (searchTerm(qn) || []).filter(function (t) { return !/^(وصل|حالة|تتبع|تتبّع|اوردر|أوردر|طلب|شحنة|الزبون)$/.test(t); });
      var key = ws.sort(function (x, y) { return y.length - x.length; })[0];
      if (key) {
        var digits = /^\d{4,}$/.test(key);
        var ord = await q('MAIN', 'gmt_orders?select=name,phone,status,shipping_company,tracking_number,created_at,price&' +
                  (digits ? 'or=(phone.ilike.*' + key + '*,tracking_number.ilike.*' + key + '*)' : 'name=ilike.*' + encodeURIComponent(key) + '*') + '&order=created_at.desc&limit=4');
        if (Array.isArray(ord) && ord.length) {
          return ord.map(function (o) {
            return '<b>' + h(o.name) + '</b> · ' + h(o.status || '—') + (o.shipping_company ? ' · ' + h(o.shipping_company) : '') +
                   (o.tracking_number ? ' · رقم التتبّع <b dir="ltr">' + h(o.tracking_number) + '</b>' : '') + ' · ' + new Date(o.created_at).toLocaleDateString('ar-SY');
          }).join('<br>') + '<br><span style="font-size:11px;color:#526077">⚡ من الأوردرات مباشرةً — بلا استهلاك رصيد</span>';
        }
      }
    }
    if (/(كم|قدي?ش) (بعنا|بعت|مبيعات|المبيعات)|مبيعات اليوم/.test(qn)) {
      var sess = null; try { sess = JSON.parse(localStorage.getItem('gmt_session') || 'null'); } catch (_) {}
      var adm = false; try { adm = !!(global.GMTRole && GMTRole.isAdmin()); } catch (_) {}
      var inv = await q('MAIN', 'invoices?select=total,branch_key,sale_type,customer_name&created_at=gte.' + encodeURIComponent(todayIso()) + (adm || !sess ? '' : '&branch_key=eq.' + encodeURIComponent(sess.branch_key)) + '&limit=3000');
      if (Array.isArray(inv)) {
        inv = inv.filter(function (r) { return !String(r.customer_name || '').startsWith('[تدريب]'); });
        var sum = inv.reduce(function (s, r) { return s + (Number(r.total) || 0); }, 0);
        return (adm ? 'مبيعات اليوم في كل الفروع' : 'مبيعات فرعك اليوم') + ': <b dir="ltr">$' + sum.toFixed(2) + '</b> · ' + inv.length + ' فاتورة<br><span style="font-size:11px;color:#526077">⚡ من فواتير اليوم مباشرةً — بلا استهلاك رصيد</span>';
      }
    }
    var isStock = /(كم|قدي?ش)\s*(باقي|بقي|في|موجود|عندي|عنا|متوفر)/.test(qn) || /^\s*مخزون\s+\S/.test(qn);
    var isPrice = /(سعر|بكم|بقديش)/.test(qn);
    if (!isStock && !isPrice) return null;
    /* searchTerm يعيد مصفوفة كلمات — نبحث بأطولها، ثمّ نُبقي ما يحوي كلّ الكلمات */
    var terms = (searchTerm(qn) || []).filter(function (t) { return !/^(قدي?ش|سعر|سعره|بكم|بقديش|متوفر|موجود|بقي|مخزون|كمية|عدد)$/.test(t); });
    if (!terms.length) return null;
    var t0 = terms.slice().sort(function (x, y) { return y.length - x.length; })[0];
    var rows = await q('MAIN', 'products?select=*&name=ilike.*' + encodeURIComponent(t0) + '*&limit=25');
    if (!Array.isArray(rows)) return null;
    var nz = function (s) { return String(s || '').toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); };
    rows = rows.filter(function (p) { var n = nz(p.name) + ' ' + nz(p.barcode); return terms.every(function (t) { return n.indexOf(nz(t)) >= 0; }); });
    if (!rows.length || rows.length > 6) return null;
    var brs = await q('MAIN', 'inv_columns?select=key_name,display_name&is_branch=eq.true') || [];
    try { if (global.GMTTransit && GMTTransit.filterOut) brs = GMTTransit.filterOut(brs, function (x) { return x.key_name; }); } catch (_) {}
    var admin = false; try { admin = !!(global.GMTRole && GMTRole.isAdmin()); } catch (_) {}
    var lines = rows.map(function (p) {
      var out = '<b>' + h(p.name) + '</b>';
      if (isPrice || !isStock) out += ' — السعر <b dir="ltr">$' + (Number(p.price) || 0) + '</b>' + (admin && p.wholesale_price ? ' · الجملة $' + p.wholesale_price : '');
      if (isStock) {
        var parts = brs.map(function (br) { var v = Number(p[br.key_name]) || 0; return v ? (h(br.display_name || br.key_name) + ' ' + v) : null; }).filter(Boolean);
        var tot = brs.reduce(function (s, br) { return s + (Number(p[br.key_name]) || 0); }, 0);
        out += '<br>المجموع <b>' + tot + '</b>' + (parts.length ? ' · ' + parts.join(' · ') : ' · غير متوفّر بأيّ فرع');
      }
      return out;
    });
    return lines.join('<br><br>') + '<br><span style="font-size:11px;color:#526077">⚡ جوابٌ فوريّ من بيانات النظام — بلا استهلاك رصيد</span>';
  }

  /* ═══ (2026-10-05 ش) البند ١٤٦: «سجلّ معرفةٍ داخلي» — كل جوابٍ من العقل يُحفظ على الجهاز (حتى ٣٠٠)،
     والسؤال نفسه إن تكرّر يُجاب من السجلّ فوراً بلا رصيد (أسئلة البيانات الحيّة مستثناة — قد تتغيّر). ═══ */
  var KB_KEY = 'gmt_brain_kb_v1';
  function kbNorm(q) { return String(q || '').toLowerCase().replace(/[؟?!.,،]/g, ' ').replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim(); }
  function kbAll() { try { return JSON.parse(localStorage.getItem(KB_KEY) || '[]'); } catch (_) { return []; } }
  function kbSave(q, a) {
    if (!q || !a || /(اليوم|الآن|هلق|هلّق|كم باقي|سعر|وين وصل|بعنا)/.test(q)) return;   // البيانات الحيّة لا تُخزَّن
    var all = kbAll().filter(function (x) { return x.k !== kbNorm(q); });
    all.push({ k: kbNorm(q), q: String(q).slice(0, 300), a: String(a).slice(0, 4000), at: Date.now() });
    try { localStorage.setItem(KB_KEY, JSON.stringify(all.slice(-300))); } catch (_) {}
  }
  function kbFind(q) { var k = kbNorm(q); var hit = kbAll().filter(function (x) { return x.k === k; })[0]; return hit || null; }
  function kbPanel() {
    var all = kbAll().slice().reverse();
    var w = document.createElement('div'); w.setAttribute('data-keep-fab', '1');
    /* (١٠ ت١ — ملاحظات) نفس نمط «نافذة الرابط خلف العقل»: هذه النافذة تُفتح من أزرار لوحة العقل (علي بابا · سجل المعرفة)
       ولوحةُ العقل 2147483400 فكانت تختفي تحتها. الآن فوقها (ودون نوافذ السؤال 2147483640). */
    w.style.cssText = 'position:fixed;inset:0;z-index:2147483500;background:rgba(15,18,25,.45);display:grid;place-items:center;padding:14px;direction:rtl;font-family:inherit';
    w.innerHTML = '<div style="width:100%;max-width:560px;max-height:86vh;overflow:auto;background:#fff;border-radius:22px;padding:18px">' +
      '<div style="display:flex;gap:8px;align-items:center"><b style="flex:1;font-size:17px">📚 ما تعلّمه العقل (' + all.length + ')</b>' +
      '<button data-clear style="border:0;background:#fff1f2;color:#b91c1c;border-radius:10px;padding:6px 10px;font:inherit;font-weight:800;cursor:pointer">مسح السجلّ</button>' +
      '<button data-x style="border:0;background:#f1f5f9;border-radius:10px;padding:6px 12px;font:inherit;font-weight:800;cursor:pointer">إغلاق</button></div>' +
      '<div style="font-size:12px;color:#526077;margin:4px 0 10px">الأسئلة المتكرّرة تُجاب من هنا فوراً وبلا رصيد. البيانات الحيّة (الأسعار · المخزون · اليوم) لا تُخزَّن.</div>' +
      (all.length ? all.map(function (x) { return '<details style="border:1px solid #eef2f7;border-radius:12px;padding:8px 10px;margin:6px 0"><summary style="cursor:pointer;font-weight:800;font-size:13px">' + h(x.q) + '</summary><div style="font-size:12.5px;line-height:1.8;margin-top:6px">' + x.a + '</div></details>'; }).join('')
                  : '<div style="color:#5b6472">لا شيء بعد — كل جوابٍ من العقل يُضاف هنا.</div>') + '</div>';
    document.body.appendChild(w);
    w.addEventListener('click', function (e) {
      if (e.target === w || e.target.closest('[data-x]')) w.remove();
      else if (e.target.closest('[data-clear]')) { try { localStorage.removeItem(KB_KEY); } catch (_) {} w.remove(); }
    });
  }

  async function ask(question) {
    try { var loc = await localAnswer(question); if (loc) { HIST.push({ q: question, a: loc.replace(/<[^>]+>/g, ' ') }); return loc; } } catch (_) {}
    try { var kb = kbFind(question); if (kb) return kb.a + '<br><span style="font-size:11px;color:#526077">📚 من سجلّ المعرفة — بلا استهلاك رصيد</span>'; } catch (_) {}
    var url = endpoint();
    if (!url) throw new Error('not-configured');
    try { var pb = global.GMTEndpoint && GMTEndpoint.problem && GMTEndpoint.problem(url); if (pb) { var e0 = new Error('رابط الوسيط المضبوط لا يصلح: ' + pb + '. صحّحه من «أدخل رابط الوسيط».'); e0.fixEndpoint = true; throw e0; } } catch (e1) { if (e1 && e1.fixEndpoint) throw e1; }
    var ctx = collectContext();
    // أرفق البيانات الحيّة المتعلّقة بالسؤال — كي يجيب من بياناتك لا من معرفته
    try { ctx.liveData = await collectLiveData(question); } catch (e) { ctx.liveData = { error: 'تعذّر جلب البيانات الحيّة' }; }
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: SYSTEM_PROMPT,
        context: ctx,
        history: HIST.slice(-6),
        question: question
      })
    });
    if (!r.ok) {
      var bodyTxt = await r.text().catch(function () { return ''; });
      var ex = global.GMTEndpoint && GMTEndpoint.explain ? GMTEndpoint.explain(r.status, bodyTxt, url) : ('HTTP ' + r.status + ' — ' + bodyTxt.slice(0, 160));
      var er = new Error(ex); er.fixEndpoint = (r.status === 405 || r.status === 404 || r.status === 401 || r.status === 403 || r.status === 0); throw er;
    }
    var d = await r.json();
    var answer = d.answer || d.reply || d.text || (d.content && d.content[0] && d.content[0].text) || '';
    if (!answer) throw new Error('ردّ فارغ من الوسيط');
    HIST.push({ q: question, a: answer });
    try { kbSave(question, answer); } catch (_) {}
    return answer;
  }

  /* ── الواجهة ── */
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmt(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }

  function openScreen(text) {
    if (global.GMTScreen) { GMTScreen.open({ text: text || '' }); return; }
    var sc = document.createElement('script'); sc.src = 'gmt-screen.js?v=20261024g';
    sc.onload = function () { if (global.GMTScreen) GMTScreen.open({ text: text || '' }); };
    sc.onerror = function () { try { GMTAsk.alert('تعذّر تحميل وحدة تحليل الشاشة — أعد المحاولة.', { title: 'تحليل الشاشة' }); } catch (_) {} };
    (document.head || document.documentElement).appendChild(sc);
  }
  function openPanel(preset) {
    var old = document.getElementById('gmt-brain-panel'); if (old) { old.remove(); }
    var p = document.createElement('div');
    p.id = 'gmt-brain-panel';
    p.style.cssText = 'position:fixed;inset:0;z-index:2147483400;background:rgba(0,0,0,.5);backdrop-filter:blur(3px);' +
      'display:flex;align-items:flex-end;justify-content:center;padding:0;font-family:Cairo,Tahoma,sans-serif;direction:rtl';
    p.onclick = function (e) { if (e.target === p) p.remove(); };
    p.innerHTML =
      '<div style="background:#fff;width:100%;max-width:560px;height:88vh;border-radius:20px 20px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,.3)" onclick="event.stopPropagation()">' +
        '<div style="background:#0f172a;color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between">' +
          '<div><div style="font-size:14px;font-weight:900">🧠 عقل النظام</div>' +
          '<div style="font-size:10px;opacity:.65;font-weight:700">مساعد داخلي — يفسّر الأخطاء ويشرح الاستخدام</div></div>' +
          '<button id="gb-x" style="background:rgba(255,255,255,.15);border:0;color:#fff;width:30px;height:30px;border-radius:9px;font-size:16px;cursor:pointer">✕</button>' +
        '</div>' +
        '<div id="gb-log" style="flex:1;overflow:auto;padding:14px;background:#f8fafc"></div>' +
        '<div style="padding:10px 12px;border-top:1px solid #e5e7eb;background:#fff">' +
          '<div id="gb-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"></div>' +
          '<div style="display:flex;gap:8px">' +
            '<input id="gb-in" placeholder="اسأل عن أي خطأ أو خطوة بالنظام…" style="flex:1;padding:11px 13px;border:1.5px solid #e5e7eb;border-radius:12px;font-family:inherit;font-size:13px;font-weight:600;outline:none">' +
            '<button id="gb-send" style="background:#D5001C;color:#fff;border:0;border-radius:12px;padding:0 18px;font-family:inherit;font-weight:900;font-size:13px;cursor:pointer">اسأل</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(p);

    var log = p.querySelector('#gb-log'), input = p.querySelector('#gb-in');
    p.querySelector('#gb-x').onclick = function () { p.remove(); };

    function add(who, html, tone) {
      var d = document.createElement('div');
      var mine = who === 'me';
      d.style.cssText = 'margin-bottom:10px;display:flex;' + (mine ? 'justify-content:flex-start' : 'justify-content:flex-end');
      d.innerHTML = '<div style="max-width:86%;padding:10px 13px;border-radius:14px;font-size:13px;line-height:1.85;font-weight:600;' +
        (mine ? 'background:#D5001C;color:#fff' : 'background:#fff;color:#0f172a;border:1px solid ' + (tone === 'err' ? '#fecaca' : '#e5e7eb')) + '">' + html + '</div>';
      log.appendChild(d); log.scrollTop = log.scrollHeight;
      return d;
    }

    var ctx = collectContext();
    var nErr = (ctx.errors || []).length;
    add('bot', '<b>أهلاً 👋</b><br>أنا عقل النظام. بقدر:<br>' +
      '• أفسّرلك أي خطأ — شو يعني وهل هو خطير وشو تأثيره<br>' +
      '• أشرحلك أي خطوة بالنظام (مفيد للموظف الجديد)<br>' +
      '• أقترح تطويرات<br><br>' +
      (nErr ? '<span style="color:#b91c1c">⚠️ رصدت <b>' + nErr + '</b> خطأ بهالجلسة — اسألني عنهم.</span>'
            : '<span style="color:#15803d">✅ ما في أخطاء مرصودة بهالجلسة.</span>'));

    var chips = [
      /* (١١ ت١ — Notes ٨ ت١ ١٠:٢٠م) «زر اسمه تحليل الشاشة: صورة منتج أو طلب زبون برسالة نصّية، أو الاثنين معاً» */
      ['🖼️ تحليل الشاشة', '__SCREEN__'],
      ['🔴 فسّرلي الأخطاء الحالية', 'في أخطاء مرصودة بالنظام هلق؟ فسّرلي كل واحد: شو يعني، هل هو خطير، شو تأثيره على الشغل، وشو الحل.'],
      ['📘 كيف أستعمل هالصفحة؟', 'أنا موظف جديد — اشرحلي هالصفحة خطوة بخطوة: شو بتعمل وشو أهم الأزرار وشو الأخطاء الشائعة.'],
      ['🏦 كيف بيتحسب الصندوق؟', 'كيف بيتحسب رقم الصندوق بالنظام؟ وشو بيزيده وشو بينقّصه؟'],
      ['📦 كم باقي من منتج؟', 'كم باقي من منتج (اكتب اسمه أو الباركود بدل هالجملة) وبأي فرع؟'],
      ['🚚 وين وصل أوردر؟', 'وين وصل أوردر الزبون (اكتب اسم الزبون أو رقم التتبع بدل هالجملة)؟'],
      ['🛍️ رشّحلي لزبون', 'زبون بدّو (اكتب المواصفات بدل هالجملة: مثلاً راس إضاءة 100 وات) — شو عندنا؟ أعطيني الخيارات بأسعارها ورسالة جاهزة أبعتلو ياها.'],
      ['🩺 افحص صحة النظام', '__HEALTH__'],
      ['💡 شو فيه يتطوّر؟', 'حسب القواعد والبلاغات المرفقة، شو أهم شي ناقص أو يحتاج تطوير بهالصفحة؟'],
      /* (ص) البند ١٤٥: «يولّد برومبتات للصور لا الصور نفسها» */
      ['🎨 برومبت صورة لمنتج', 'اكتب لي برومبت إنجليزي مفصّل لتوليد صورة إعلانيّة لمنتج (اكتب اسم المنتج بدل هالجملة): خلفية بيضاء نظيفة، إضاءة استوديو ناعمة، زاوية ثلاثة أرباع، ظلّ خفيف، بلا أيّ نص أو شعار. أعطني برومبتاً طويلاً وآخر قصيراً — البرومبت فقط، لا تولّد صورة.'],
      /* (ف) منتجٌ من علي بابا */
      ['🔎 منتج من علي بابا', '__ALIBABA__'],
      ['📚 ما تعلّمه العقل', '__KB__'],
      /* (ش) البند ٢١٣: كليشة البوست الدائمة — بصياغة العقل */
      ['📣 بوست عرض', 'اكتب بوست عرض لإنستغرام وفيسبوك لمنتج (اكتب اسمه وسعره بدل هالجملة). ابدأ دائماً بـ«احصل من مجموعة ميديا تيك التجارية على العرض…» واختم بـ«الحساب الرسمي بوكالة كانون — ميديا تيك». قصير، ٤–٦ أسطر، بلا مبالغة ولا وعود غير صحيحة، مع ٣ هاشتاغات.'],
    ];
    var chipBox = p.querySelector('#gb-chips');
    chips.forEach(function (c) {
      var b = document.createElement('button');
      b.textContent = c[0];
      b.style.cssText = 'background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:5px 11px;font-size:11px;font-weight:800;color:#475569;cursor:pointer;font-family:inherit';
      b.onclick = function () { send(c[1]); };
      chipBox.appendChild(b);
    });

    var busy = false;
    async function send(q) {
      q = (q || input.value || '').trim();
      if (q === '__ALIBABA__') { productImportDialog(null); return; }
      if (q === '__KB__') { kbPanel(); return; }
      if (q === '__SCREEN__') { openScreen(); return; }
      if (q === '__HEALTH__') {
        add('me', '🩺 افحص صحة النظام');
        var t0 = add('bot', '<span style="opacity:.5">جارٍ الفحص…</span>');
        var res = await healthReport(true).catch(function (e) { return { error: e.message }; });
        t0.querySelector('div').innerHTML = res && res.ok
          ? '<b style="color:#15803d">✅ النظام سليم</b><br>ما في مشاكل مرصودة.'
          : '<b style="color:#b91c1c">⚠️ ' + ((res && res.issues) || []).length + ' مشكلة</b><br>' +
            fmt(((res && res.issues) || []).join('\n')) +
            (res && res.sent ? '<br><br><span style="color:#15803d">📨 أُرسل التقرير على تيليجرام</span>'
                             : '<br><br><span style="opacity:.6">لإرسال التقارير تلقائياً: <button id="gb-tg" style="background:#0f172a;color:#fff;border:0;border-radius:8px;padding:4px 10px;font-weight:800;font-size:11px;cursor:pointer;font-family:inherit">اضبط تيليجرام</button></span>');
        var tb = t0.querySelector('#gb-tg'); if (tb) tb.onclick = function () { gmtSetTelegram(); };
        return;
      }
      if (!q || busy) return;
      busy = true; input.value = '';
      add('me', esc(q));
      var t = add('bot', '<span style="opacity:.5">جارٍ التفكير…</span>');
      try {
        var a = await ask(q);
        t.querySelector('div').innerHTML = fmt(a);
      } catch (e) {
        if (String(e.message) === 'not-configured') {
          t.querySelector('div').innerHTML =
            '<b>لم يُفعَّل بعد</b><br>عقل النظام يحتاج وسيطاً آمناً (Edge Function) — المفتاح لا يوضع في الكود.<br>' +
            'خطوات التفعيل في صفحة <b>تفعيل عقل النظام</b> (تفعيل_عقل_النظام.html).<br><br>' +
            '<button id="gb-cfg" style="background:#0f172a;color:#fff;border:0;border-radius:9px;padding:6px 14px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit">أدخل رابط الوسيط</button>';
          var cb = t.querySelector('#gb-cfg');
          if (cb) cb.onclick = function () { configure(); };
        } else {
          t.querySelector('div').innerHTML = '<span style="color:#b91c1c">تعذّر الاتصال: ' + fmt(e.message) + '</span>' +
            (e.fixEndpoint ? '<br><br><button id="gb-cfg2" style="background:#0f172a;color:#fff;border:0;border-radius:9px;padding:6px 14px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit">أدخل رابط الوسيط الصحيح</button>' : '');
          var cb2 = t.querySelector('#gb-cfg2'); if (cb2) cb2.onclick = function () { configure(); };
        }
      }
      busy = false;
      log.scrollTop = log.scrollHeight;
    }
    p.querySelector('#gb-send').onclick = function () { send(); };
    input.onkeydown = function (e) { if (e.key === 'Enter') send(); };
    if (preset) send(preset);
  }

  async function configure() {
    var cur = endpoint();
    var v = await (window.GMTAsk ? GMTAsk.prompt : function (m, o) { return Promise.resolve(window.prompt(m, o && o.value)); })('رابط وسيط عقل النظام (Supabase Edge Function):\n\nمثال:\nhttps://<project>.supabase.co/functions/v1/gmt-brain\n\n(المفتاح يبقى داخل الوسيط ولا يظهر في الكود)', { value: cur });
    if (v === null) return;
    v = v.trim();
    var pb2 = v && window.GMTEndpoint && GMTEndpoint.problem ? GMTEndpoint.problem(v) : '';
    if (pb2) { if (window.GMTAsk && GMTAsk.alert) GMTAsk.alert('لم يُحفَظ: ' + pb2, { title: 'رابط لا يصلح', icon: 'danger' }); else alert('⛔ لم يُحفَظ: ' + pb2); return; }
    try { v ? localStorage.setItem(CFG_KEY, v) : localStorage.removeItem(CFG_KEY); } catch (_) {}
    /* (٨ ت — تدقيق المطابقة) «يقول حُفظ ولا يُحفظ»: كان يكتب على هذا الجهاز فقط، ثمّ عند التحميل التالي تكتب
       gmt-endpoint.js قيمةَ القاعدة فوقه. الآن يُحفظ في إعدادات النظام (gmt_settings) لكل الأجهزة — كبقيّة الروابط. */
    var sys = false;
    try { if (window.GMTEndpoint && GMTEndpoint.set) { var r = await GMTEndpoint.set('brain', v); sys = !!(r && r.system !== false); } } catch (e) {
      alert('⚠️ حُفظ على هذا الجهاز فقط — تعذّر حفظه للنظام: ' + ((e && e.message) || e)); return;
    }
    alert(v ? ('✅ حُفظ الرابط' + (sys ? ' لكل الأجهزة' : ' على هذا الجهاز') + ' — جرّب السؤال الآن.') : '🗑️ أُزيل الرابط.');
  }

  /* ══ التقرير التلقائي: «إذا شاف أخطاء يراسلك» (2026-08-26 · طلب المالك) ══
     مرّة يومياً بصمت: يشغّل الفحص الذاتي + يقرأ البلاغات. إن وُجدت مشاكل،
     يطلب من كلود شرحاً مختصراً ثم **يرسله على تيليجرام**.
     🔕 لا يرسل شيئاً إن كان النظام سليماً — لا إزعاج بلا سبب.
     🔒 قراءة فقط · لا يصلح شيئاً · التنفيذ يبقى بيدك. */
  var RPT_KEY = 'gmt_brain_report_last';

  function tg() {
    var C = global.GMT_CONFIG || global.CONFIG || {};
    var G = global.GMT_TELEGRAM || {};   /* (ر) بوت التبليغ في مكانٍ واحد — كان التقرير يفشل لأنّ الرمز لم يكن على أغلب الصفحات */
    /* (17 ت1 · اختراق البوت) لا مفتاح بوتٍ في المتصفّح إطلاقاً: العلامة «gmt-relay» دائماً، والوسيط gmt-tg يعرف البوت.
       كان يقبل مفتاحاً محفوظاً على الجهاز (gmt_tg_token) فيرسل مباشرةً لتيليغرام خارج الوسيط. القناة الافتراضيّة: قناة الأدمن. */
    var tok = 'gmt-relay';
    var chat = global.TELEGRAM_CHAT_ID || C.TELEGRAM_CHAT_ID || G.chat || '-1003870992994';
    try { localStorage.removeItem('gmt_tg_token'); } catch (_) {}
    return { tok: tok, chat: chat };
  }

  async function sendTG(text) {
    var t = tg(); if (!t) return false;
    try {
      var r = await fetch('https://api.telegram.org/bot' + t.tok + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: t.chat, text: text, parse_mode: 'HTML' })
      });
      if (!r.ok) console.warn('[GMT] تعذّر إرسال تقرير الصحة:', r.status);
      return r.ok;
    } catch (e) { console.warn('[GMT] استثناء إرسال التقرير:', e); return false; }
  }

  async function healthReport(force) {
    var issues = [];
    // ① الفحص الذاتي (أصول · جداول · دوال · هوية · عامل الخدمة)
    try {
      if (global.GMTSelfCheck) {
        var res = await GMTSelfCheck.run(false);
        (res || []).forEach(function (r) {
          if (r.level === 'bad')  issues.push('🔴 ' + r.title + (r.detail ? ' — ' + r.detail : ''));
          if (r.level === 'warn') issues.push('🟠 ' + r.title + (r.detail ? ' — ' + r.detail : ''));
        });
      }
    } catch (_) {}
    // ② بلاغات البوتات
    try {
      if (global.GMTMoneyGuard && GMTMoneyGuard.incidents) {
        var mi = GMTMoneyGuard.incidents();
        if (mi && mi.length) issues.push('🔴 حوادث مالية مرصودة: ' + mi.length);
      }
    } catch (_) {}
    // ③ أخطاء الجلسة
    if (errLog.length) issues.push('🟠 أخطاء جلسة: ' + errLog.length + ' — ' + errLog.slice(-3).join(' | ').slice(0, 300));

    if (!issues.length) {
      if (force) showLocal('✅ النظام سليم — ما في مشاكل مرصودة');
      return { ok: true, issues: [] };
    }

    // اطلب شرحاً مختصراً من كلود (إن كان مُفعَّلاً)، وإلا أرسل القائمة الخام
    var body = issues.join('\n');
    if (endpoint()) {
      try {
        body = await ask('هاي المشاكل المرصودة بالنظام:\n' + issues.join('\n') +
          '\n\nاكتب تقريراً مختصراً جداً (بحدود 8 أسطر): لكل مشكلة سطر واحد فيه الخطورة (🔴/🟠/⚪) وشو تأثيرها العملي وشو الحل بكلمتين. بلا مقدّمات ولا خواتيم.');
      } catch (e) { /* نُرسل القائمة الخام */ }
    }
    var msg = '🩺 <b>تقرير صحة نظام GMT</b>\n' +
      new Date().toLocaleString('ar-SY') + ' · صفحة: ' + page + '\n' +
      '──────────\n' + body;
    var sent = await sendTG(msg);
    if (!sent) showLocal('⚠️ وُجدت ' + issues.length + ' مشكلة — تعذّر إرسال التقرير على تيليجرام');
    return { ok: false, issues: issues, sent: sent };
  }

  function showLocal(text) {
    try { console.warn('[GMT تقرير الصحة] ' + text); } catch (_) {}
  }

  /* تشغيل تلقائي: مرّة كل 24 ساعة، بصمت */
  (function autoReport() {
    function go() {
      var last = 0;
      try { last = Number(localStorage.getItem(RPT_KEY)) || 0; } catch (_) {}
      if (Date.now() - last < 86400000) return;
      setTimeout(function () {
        healthReport(false).then(function () {
          try { localStorage.setItem(RPT_KEY, String(Date.now())); } catch (_) {}
        }).catch(function () {});
      }, 12000);   // بعد استقرار الصفحة وانتهاء الفحص الذاتي
    }
    if (document.readyState === 'complete') go(); else addEventListener('load', go);
  })();

  window.gmtSetTelegram = async function () {
    /* (17 ت1) لم يعد يُطلب مفتاح بوت هنا — المفتاح سرٌّ في الوسيط (Supabase ← Edge Functions ← Secrets ← TG_BOT_TOKEN) */
    var msg = 'تقرير الصحة يُرسَل عبر وسيط النظام إلى قناة الأدمن. لا تكتب مفتاح البوت في أي مكانٍ داخل النظام: يوضع مرّةً واحدة في إعدادات الخادم (Supabase ← Edge Functions ← Secrets ← TG_BOT_TOKEN).';
    if (window.GMTAsk && GMTAsk.alert) await GMTAsk.alert(msg); else console.info(msg);
  };


  function mount() {
    /* (2026-08-26 · طلب المالك) الصفحة التي فيها زر «🧠 عقل النظام» ضمن أزرارها العلوية
       لا تحتاج زراً عائماً — كان يركب فوق المحتوى. */
    try { if (document.querySelector('[onclick*="GMTBrain.open"]')) return; } catch (_) {}
    if (document.getElementById('gmt-brain-fab')) return;
    var b = document.createElement('button');
    b.id = 'gmt-brain-fab';
    b.title = 'عقل النظام — اسأل عن أي خطأ أو خطوة';
    b.textContent = '🧠';
    b.style.cssText = 'position:fixed;bottom:18px;inset-inline-end:18px;z-index:2147483300;width:52px;height:52px;' +
      'border-radius:999px;background:#0f172a;color:#fff;border:0;font-size:22px;cursor:pointer;' +
      'box-shadow:0 6px 22px rgba(0,0,0,.3);transition:transform .15s';
    b.onmouseenter = function () { b.style.transform = 'scale(1.08)'; };
    b.onmouseleave = function () { b.style.transform = 'scale(1)'; };
    b.onclick = function () { openPanel(); };
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  global.GMTBrain = { _localAnswer: function (q) { return localAnswer(q); }, _searchTerm: function (q) { return searchTerm(q); }, importProduct: importProduct, productImportDialog: productImportDialog,
    open: openPanel,
    ask: ask,
    configure: configure,
    context: collectContext,
    explainErrors: function () { openPanel('في أخطاء مرصودة بالنظام هلق؟ فسّرلي كل واحد: شو يعني، هل هو خطير، شو تأثيره، وشو الحل.'); },
    analyzeScreen: openScreen,
    healthReport: function () { return healthReport(true); },   // تشغيل يدوي فوري
    isReady: function () { return !!endpoint(); },
    telegramReady: function () { return !!tg(); }
  };
})(window);
