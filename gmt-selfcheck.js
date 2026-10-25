/* ══════════════════════════════════════════════════════════════════════════
   🔴 حرس السطح — لا واجهة داخلية على صفحة زبون (2026-09-26 · بلاغ المالك)
   ─────────────────────────────────────────────────────────────────────────
   «الأزرار العائمة تبعات التصليح وتبعات الأخطاء ما تطلع لصفحات الزبون أبداً».
   يُعرَّف على window لا داخل IIFE: هذا الملفّ فيه أكثر من نطاق مغلق، ووضع
   الحرس داخل أوّلها جعله غير معروف في البقيّة (ReferenceError حقيقي ظهر في
   الاختبار). المنع افتراضياً: الصفحة الداخلية تُعلن نفسها، والعامّة لا تتذكّر شيئاً.
   ══════════════════════════════════════════════════════════════════════════ */
window.gmtInternalUI = window.gmtInternalUI || function (who) {
  try { if (window.GMT_SURFACE) return window.GMT_SURFACE.guard(who); } catch (e) {}
  if (window.GMT_PUBLIC === true || window.GMT_PUBLIC === 1) return false;
  return window.GMT_INTERNAL === true || window.GMT_INTERNAL === 1;
};

/* ═══════════════════════════════════════════════════════════════════════════
   gmt-selfcheck.js — الفاحص الذاتي الآلي  ·  2026-08-26
   ─────────────────────────────────────────────────────────────────────────
   طلب المالك: «اللي ما بتقدر تفحصه هون يفحصه البوت بشكل سريع وآمن،
                بلا داعٍ لتدخّل بشري أو أشوفه بعيني».

   يفحص ما **لا يمكن** كشفه بالتحليل الثابت (يحتاج متصفّحاً حيّاً وشبكة):
     ① الأصول الفعلية (صور · مكتبات) — موجودة أم 404؟
     ② الاتصال بالقواعد الأربع — تستجيب؟
     ③ الجداول والدوال الحرجة — موجودة بالقاعدة؟ (SQL 23–29)
     ④ الهوية البصرية — ألوان الصفحة ضمن الطقم المعتمد؟
     ⑤ التطبيق (PWA) — عامل الخدمة مسجَّل؟ Tailwind محلي؟
     ⑥ قواعد المالك — محمّلة وكاملة؟

   🛡️ آمن تماماً: **قراءة فقط** — لا كتابة ولا تعديل ولا حذف. لا يلمس أي بيانات.
   يعمل تلقائياً مرّة يومياً بصمت، ويُبلّغ **فقط عند وجود مشكلة**.
   يدوياً: GMTSelfCheck.run()   ·   تقرير كامل: GMTSelfCheck.run(true)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  if (global.GMTSelfCheck) return;

  var KEY = 'gmt_selfcheck_last';
  var BRAND = {
    staff:    ['#D5001C', '#D5001C'],           // الموظفون والإدارة
    store:    ['#D5001C'],                       // المتجر
    warranty: ['#D5001C'],                       // الكفالات
  };

  function ok(t, d)   { return { level: 'ok',   title: t, detail: d || '' }; }
  function warn(t, d) { return { level: 'warn', title: t, detail: d || '' }; }
  function bad(t, d)  { return { level: 'bad',  title: t, detail: d || '' }; }

  /* ① الأصول: كل صورة/مكتبة تشير إليها الصفحة — موجودة فعلاً؟ */
  async function checkAssets() {
    var urls = new Set();
    document.querySelectorAll('img[src],link[href],script[src]').forEach(function (n) {
      var u = n.getAttribute('src') || n.getAttribute('href') || '';
      /* (١١ ت١ — ملاحظات) blob: معاينة صورةٍ رفعها الموظف للتوّ (إيصال الشحن مثلاً) لا ملفّ استضافة — فكانت تُحسب «أصلاً ناقصاً (تعذّر)»
         وتصل تقرير الصحّة على تيليغرام بلا سبب. كذلك mailto/tel/javascript. */
      if (!u || /^(data:|blob:|https?:|#|mailto:|tel:|javascript:|about:)/.test(u)) return;
      urls.add(u.split('?')[0]);
    });
    var missing = [];
    await Promise.all([...urls].map(async function (u) {
      try {
        var r = await fetch(u, { method: 'HEAD', cache: 'no-store' });
        if (r.status === 405 || r.status === 501) r = await fetch(u, { cache: 'no-store' });   /* (ر) الاستضافة ترفض HEAD — الملفّ موجود */
        if (!r.ok) missing.push(u + ' (' + r.status + ')');
      } catch (e) { missing.push(u + ' (تعذّر)'); }
    }));
    return missing.length
      ? bad('أصول ناقصة: ' + missing.length, missing.slice(0, 8).join(' · '))
      : ok('كل أصول الصفحة موجودة (' + urls.size + ')');
  }

  /* ② + ③ القواعد والجداول والدوال الحرجة — قراءة فقط */
  async function checkDatabase() {
    /* 🔧 (2026-08-26) الاسم الصحيح window.GMT_DB — كان يُقرأ GMT_CONFIG.DATABASES (غير موجود) */
    var C = global.GMT_CONFIG || {};
    var dbs = global.GMT_DB || C.DATABASES || null;
    if (!dbs) return warn('تعذّر قراءة إعداد القواعد', 'gmt-config.js غير محمّل في هذه الصفحة');
    var out = [], gone = [], probes = {
      MAIN:     ['gmt_orders', 'invoices', 'products', 'branch_transfers', 'gmt_daily_closes'],
      SITE:     ['site_settings', 'agents'],
      STORE:    ['products'],
      WARRANTY: [],
    };
    for (var k in dbs) {
      var d = dbs[k]; if (!d || !d.url || !d.key) continue;
      var tables = probes[k] || [];
      for (var i = 0; i < tables.length; i++) {
        try {
          var r = await fetch(d.url + '/rest/v1/' + tables[i] + '?select=*&limit=1',
            { headers: { apikey: d.key, Authorization: 'Bearer ' + d.key } });
          if (r.status === 404 || r.status === 400) out.push(k + '.' + tables[i] + ' مفقود');
          else if (!r.ok) out.push(k + '.' + tables[i] + ' (' + r.status + ')');
        } catch (e) { gone.push(k); break; }
      }
    }
    /* (TASK-0132) لا ردّ إطلاقاً (خطأ شبكة — لا رمز HTTP) وغيرها يردّ ⇒ المشروع نفسه غير موجود (حُذف أو أُوقف: عنوانه لم يعد له DNS)،
       لا «جداول مفقودة». كانت الرسالة «SITE تعذّر الاتصال» تتكرّر في كل تقرير بلا سبب ولا حلّ. */
    var anyUp = Object.keys(probes).some(function (k) { return gone.indexOf(k) < 0 && probes[k].length && dbs[k] && dbs[k].url && dbs[k].key; });
    if (gone.length && !out.length) return bad('قاعدةٌ لا تردّ: ' + gone.join(' · '), gone.map(function (k) {
      return anyUp ? k + ': المشروع لا يردّ إطلاقاً (' + (dbs[k].url || '').replace(/^https:\/\//, '').split('.')[0] + ' — محذوف أو موقوف في Supabase) — يُستعاد من لوحة الحساب المالك أو تُنقل جداوله؛ القرار عند المالك. صفحات الموقع تعمل بالاحتياطي.'
                   : k + ' تعذّر الاتصال (لا إنترنت؟)';
    }).join(' · '));
    gone.forEach(function (k) {
      out.push(anyUp ? k + ': المشروع لا يردّ إطلاقاً (' + (dbs[k].url || '').replace(/^https:\/\//, '').split('.')[0] + ' — محذوف أو موقوف في Supabase) — يُستعاد من لوحة الحساب المالك أو تُنقل جداوله؛ القرار عند المالك'
                     : k + ' تعذّر الاتصال (لا إنترنت؟)');
    });
    return out.length
      ? bad('جداول مفقودة أو غير متاحة: ' + out.length, out.slice(0, 6).join(' · ') + ' — راجع «SQL/أرشيف_SQL.html» (والقاعدة المتوقّفة تُستعاد من لوحة Supabase)')
      : ok('كل الجداول الحرجة موجودة');
  }

  /* الدالة الذرّية — شرط عمل الجرد والمشتريات */
  async function checkRpc() {
    var C = global.GMT_CONFIG || {};
    var d = (global.GMT_DB && global.GMT_DB.MAIN) || (C.DATABASES && C.DATABASES.MAIN) || null;
    if (!d || !d.url) return warn('تعذّر فحص الدوال', 'إعداد القاعدة الرئيسية غير متاح');
    try {
      // استدعاء بمعرّف غير موجود: 404 ⇒ الدالة مفقودة · أي ردّ آخر ⇒ موجودة
      var r = await fetch(d.url + '/rest/v1/rpc/add_branch_stock', {
        method: 'POST',
        headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_product_id: '00000000-0000-0000-0000-000000000000', p_branch_key: '__probe__', p_qty: 0 })
      });
      if (r.status === 404) return bad('الدالة add_branch_stock مفقودة', 'شغّل _SQL_2️⃣7️⃣ — الجرد والمشتريات لن يعملا بدونها');
      return ok('الدوال الذرّية للمخزون موجودة');
    } catch (e) { return warn('تعذّر فحص الدوال الذرّية', e.message); }
  }

  /* ④ الهوية البصرية */
  function checkBrand() {
    var page = location.pathname.split('/').pop() || 'index.html';
    var set = /^(store|admin_store)/.test(page) ? BRAND.store
            : /^(guarantee|search)/.test(page)  ? BRAND.warranty
            : BRAND.staff;
    var allowed = set.concat(BRAND.staff).map(function (c) { return c.toLowerCase(); });
    /* ══ أُلغي هذا الاستثناء في 2026-10-04 ══
       كان: «فاتورة الشراء زرقاء لتمييزها عن البيع» — بقرارك 2026-08-26 («عيّفها»).
       والسبب الوظيفيّ صحيحٌ ويجب أن يبقى: يجب أن تُميَّز فاتورةُ الشراء عن
       فاتورة المبيع بنظرة. لكنّك قلتَ لاحقاً وبصراحة: «شوف الألوان كيف خارج
       عن هويتنا البصرية لأنه نحن عندنا اللون الأبيض».
       فلم أحذف التمييزَ — بل **نقلتُه من لونٍ غريبٍ إلى معنى**:
         فاتورةُ المبيع (للزبون)  ⇐ خطٌّ أحمرُ تحت الترويسة + رأسُ جدولٍ رماديّ
         فاتورةُ الشراء (داخليّة) ⇐ شريطٌ رماديٌّ داكن + وسمٌ صريحٌ «فاتورة شراء»
       فالتمييزُ بقي، والهويّةُ الثانية زالت.
       ❓ وإن كنتَ تُفضّل بقاءَ الأزرق للشراء تحديداً، قُل لي وأُعيده في سطرٍ واحد. */
    var html = document.documentElement.innerHTML.toLowerCase();
    var found = (html.match(/#[0-9a-f]{6}/g) || []);
    var counts = {};
    found.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    // ألوان العلامة الشائعة الخاطئة (أزرق/بنفسجي بارز)
    var offenders = Object.keys(counts).filter(function (c) {
      return counts[c] >= 3 && /^#(1f34|2563|4f46|7c3a|1e40)/.test(c) && allowed.indexOf(c) === -1;
    });
    return offenders.length
      ? warn('ألوان خارج الهوية: ' + offenders.join(' · '), 'المعتمد لهذه الصفحة: ' + set.join(' · '))
      : ok('الهوية البصرية سليمة');
  }

  /* ⑤ التطبيق والاستقلال عن CDN */
  async function checkApp() {
    var res = [];
    if ('serviceWorker' in navigator) {
      try {
        var reg = await navigator.serviceWorker.getRegistration();
        res.push(reg ? ok('عامل الخدمة مسجَّل (يعمل بلا إنترنت)') : warn('عامل الخدمة غير مسجَّل', 'افتح الصفحة عبر https وليس file://'));
      } catch (e) { res.push(warn('تعذّر فحص عامل الخدمة', e.message)); }
    }
    var cdn = [];
    document.querySelectorAll('script[src],link[href]').forEach(function (n) {
      var u = n.getAttribute('src') || n.getAttribute('href') || '';
      if (/cdnjs\.cloudflare|cdn\.jsdelivr|cdn\.tailwindcss/.test(u)) cdn.push(u.slice(0, 60));
    });
    res.push(cdn.length
      ? bad('اعتماد على CDN: ' + cdn.length, cdn.join(' · ') + ' — يكسر العمل بلا إنترنت [OWN-NO-CDN]')
      : ok('صفر اعتماد على CDN'));
    return res;
  }

  /* ⑥ قواعد المالك */
  function checkRules() {
    var R = global.GMT_OWNER_RULES;
    if (!Array.isArray(R) || !R.length) return warn('قواعد المالك غير محمّلة', 'gmt-core.js غير موجود في هذه الصفحة');
    var incomplete = R.filter(function (r) { return !r.id || !r.rule || !r.why || !r.check || !r.severity; });
    return incomplete.length
      ? warn('قواعد ناقصة الحقول: ' + incomplete.length, incomplete.map(function (r) { return r.id; }).join(' · '))
      : ok('قواعد المالك محمّلة وكاملة (' + R.length + ')');
  }

  /* ⑦ حدّ الصفوف الصامت [OWN-ROW-CAP] — 2026-08-26
     Supabase يُرجع 1000 صفّ كحدّ أقصى افتراضياً (Max Rows) **مهما طلبتَ limit=5000**، وبلا خطأ.
     النظام يطلب 2000–5000 في 23 موضعاً ⇒ عند تجاوز 1000 سجلّ تُحسب الإجماليات من أول 1000 فقط.
     هذا الفحص يتحقّق **على قاعدتك الحقيقية**: يطلب 1500 صفّاً ويعدّ ما يعود. قراءة فقط. */
  async function checkRowCap() {
    var C = global.GMT_CONFIG || {};
    var d = (global.GMT_DB && global.GMT_DB.MAIN) || (C.DATABASES && C.DATABASES.MAIN) || null;
    if (!d || !d.url) return warn('تعذّر فحص حدّ الصفوف', 'إعداد القاعدة غير متاح');
    try {
      var r = await fetch(d.url + '/rest/v1/invoices?select=id&limit=1500',
        { headers: { apikey: d.key, Authorization: 'Bearer ' + d.key, Prefer: 'count=exact' } });
      if (!r.ok) return warn('تعذّر فحص حدّ الصفوف', 'HTTP ' + r.status);
      var rows = await r.json();
      var cr = r.headers.get('content-range') || '';          // مثال: 0-999/2340
      var total = Number((cr.split('/')[1]) || 0);
      if (rows.length === 1000 && total > 1000) {
        return bad('حدّ الصفوف 1000 يقطع بياناتك بصمت',
          'لديك ' + total + ' فاتورة والقاعدة تُرجع 1000 فقط ⇒ المحاسبة والتقارير ناقصة. ' +
          'الحلّ: Supabase ← Settings ← API ← Max Rows ← ارفعه إلى 50000');
      }
      if (total > 800 && rows.length === 1000) {
        return warn('تقترب من حدّ 1000 صفّ', total + ' فاتورة — ارفع Max Rows قبل أن تتجاوزه');
      }
      return ok('حدّ الصفوف لا يقطع البيانات (' + total + ' فاتورة)');
    } catch (e) { return warn('تعذّر فحص حدّ الصفوف', e.message); }
  }

  /* ⑦ (١١ ت١) رابط وسيط العقل: مضبوطٌ ويصلح؟ — «HTTP 405 Not Allowed» كان رابطَ موقعٍ ثابت لا دالة. قراءة فقط، بلا شبكة. */
  function checkEndpoints() {
    try {
      if (!global.GMTEndpoint || !GMTEndpoint.get || !GMTEndpoint.problem) return ok('فحص رابط الوسيط غير متاح على هذه الصفحة');
      var out = [];
      ['brain', 'shop'].forEach(function (k) {
        var u = GMTEndpoint.get(k); if (!u) return;
        var pr = GMTEndpoint.problem(u); if (pr) out.push((GMTEndpoint.kinds[k] || {}).label + ': ' + pr);
      });
      return out.length ? bad('رابط وسيطٍ لا يصلح: ' + out.length, out.join(' · ') + ' — صحّحه من «تفعيل عقل النظام»') : ok('روابط الوسيط (إن ضُبطت) صالحة الشكل');
    } catch (e) { return warn('تعذّر فحص رابط الوسيط', e.message); }
  }

  async function run(verbose) {
    var results = [];
    results.push(checkRules());
    results.push(checkBrand());
    results.push(checkEndpoints());
    results.push(await checkAssets());
    results.push(await checkDatabase());
    results.push(await checkRpc());
    results.push(await checkRowCap());
    (await checkApp()).forEach(function (r) { results.push(r); });

    var bads  = results.filter(function (r) { return r.level === 'bad'; });
    var warns = results.filter(function (r) { return r.level === 'warn'; });
    try { localStorage.setItem(KEY, String(Date.now())); } catch (_) {}

    var tag = '[GMT الفحص الذاتي]';
    if (bads.length) {
      /* الفحص يطبع نتيجته بـconsole.error، وعقل النظام يلتقط كلّ console.error «أخطاءَ جلسة»
         فكان تقرير الصحة يعدّ نتيجة الفحص نفسَها خطأً ثانياً ويكرّرها (بلاغ المالك ١٠ ت١).
         العلَم يُخبره أن هذا السطر ليس خطأ جلسة. */
      global.__gmtSelfLog = true;
      try {
        console.group('%c' + tag + ' 🔴 ' + bads.length + ' مشكلة', 'color:#D5001C;font-weight:bold');
        bads.forEach(function (r) { console.error('🔴 ' + r.title, r.detail); });
        warns.forEach(function (r) { console.warn('🟠 ' + r.title, r.detail); });
        console.groupEnd();
      } finally { global.__gmtSelfLog = false; }
      banner(bads, warns);
    } else if (verbose) {
      console.group('%c' + tag + ' ✅ سليم', 'color:#15803d;font-weight:bold');
      results.forEach(function (r) { console.log((r.level === 'ok' ? '✅ ' : '🟠 ') + r.title, r.detail); });
      console.groupEnd();
    } else if (warns.length) {
      warns.forEach(function (r) { console.warn(tag + ' 🟠 ' + r.title, r.detail); });
    }
    return results;
  }

  /* (TASK-0177 · المالك seq 97/99 «أخفِ الكلمات المكشوفة» + لقطة «قاعدةٌ لا تردّ: SITE … (معرّف المشروع) … Supabase») — الشريط والنافذة
     بكلامٍ واضح بلا معرّفات مشاريع ولا أسماء جداول ولا رموز ألوان؛ التفاصيل التقنيّة في سجلّ المتصفّح (console) وحده كما كانت */
  var DB_AR = { MAIN: 'القاعدة الرئيسية', SITE: 'قاعدة الموقع الإلكتروني (الأخبار · الوكلاء · بطاقات العروض)', STORE: 'قاعدة المتجر', WARRANTY: 'قاعدة الكفالة' };
  function dbAr(t) { var k = String(t || '').trim().split(/[.:\s]/)[0]; return DB_AR[k] || 'إحدى القواعد'; }
  function plain(r) {
    var t = String(r.title || ''), d = String(r.detail || ''), m;
    if ((m = t.match(/^قاعدةٌ لا تردّ: (.+)$/))) {
      var ks = m[1].split(/\s*·\s*/), off = /تعذّر الاتصال \(لا إنترنت؟\)/.test(d);
      return off ? { t: 'لا اتصال بالقواعد الآن', d: 'تأكّد من الإنترنت ثمّ أعد فتح الصفحة.' }
        : { t: ks.map(dbAr).join(' · ') + ' متوقّفة', d: 'لا تردّ إطلاقاً (محذوفة أو موقوفة في حساب القواعد). ' + (ks.indexOf('SITE') !== -1 ? 'الموقع الإلكتروني يعمل بالنسخة الاحتياطية. ' : '') + 'القرار عندك: استرجاعها أو نقل بياناتها إلى القاعدة الرئيسية.' };
    }
    if ((m = t.match(/^جداول مفقودة أو غير متاحة: (\d+)/))) {
      var dbs = []; d.split(' · ').forEach(function (x) { var a = dbAr(x); if (dbs.indexOf(a) === -1) dbs.push(a); });
      return { t: 'جزءٌ من البيانات غير متاح (' + m[1] + ')', d: 'في: ' + dbs.join(' · ') + ' — يحتاج تحديثاً في القاعدة؛ أرسل لي صورة هذه الرسالة.' };
    }
    if ((m = t.match(/^أصول ناقصة: (\d+)/))) return { t: 'ملفّات ناقصة في الصفحة (' + m[1] + ')', d: 'صورٌ أو ملفّات لم تُحمَّل — حدّث الصفحة، وإن تكرّر أرسل لي صورة هذه الرسالة.' };
    if (/add_branch_stock/.test(t)) return { t: 'دالّة المخزون غير مفعّلة في القاعدة', d: 'الجرد والمشتريات لن يعملا بدونها — أرسل لي صورة هذه الرسالة.' };
    if (/^اعتماد على CDN/.test(t)) return { t: 'الصفحة تعتمد على ملفٍّ من الإنترنت', d: 'لن تعمل بلا إنترنت — أرسل لي صورة هذه الرسالة.' };
    if (/^رابط وسيطٍ لا يصلح/.test(t)) return { t: 'رابط عقل النظام غير صالح', d: 'صحّحه من «تفعيل عقل النظام».' };
    if (/^ألوان خارج الهوية/.test(t)) return { t: 'ألوانٌ خارج هويّة الشركة في الصفحة', d: '' };
    if (/حدّ الصفوف/.test(t)) return { t: t, d: 'بعض الفواتير لا تظهر في القوائم والتقارير — أرسل لي صورة هذه الرسالة.' };
    return { t: t.replace(/\b[a-z]{20}\b/g, '').replace(/\s{2,}/g, ' ').trim(), d: '' };
  }
  /* تنبيه مرئي — فقط عند مشكلة حقيقية (لا إزعاج بلا سبب) */
  function banner(bads, warns) {
    if (!gmtInternalUI('selfcheck')) return;            // «الفحص الذاتي وجد N مشكلة» لغة داخلية
    /* (2026-10-04 م) قاعدتك: «مشاكل النظام والفحص الذاتي لا تظهر للمستخدم العادي — فقط عند الأدمن».
       كان الشريط يظهر لكلّ من يفتح صفحةً داخليّة، حتى في شاشة إنشاء الحساب. */
    try { if (!(global.GMTRole && GMTRole.isAdmin())) return; } catch (_) { return; }
    if (document.getElementById('gmt-sc-bar')) return;
    var b = document.createElement('div');
    b.id = 'gmt-sc-bar';
    /* (٨ ت — تدقيق المطابقة) كان شريطاً عائماً أسفل الشاشة يقول «التفاصيل في Console» — لا عائم في النظام،
       ولا «Console» لمالكٍ لا يفتحها. الآن شريطٌ ثابتٌ في أعلى الصفحة يذكر المشكلة نفسها، و«التفاصيل» تعرضها. */
    b.style.cssText = 'position:relative;z-index:5;background:#7f1d1d;color:#fff;' +
      'padding:10px 14px;font-family:Cairo,Tahoma,sans-serif;font-size:12px;font-weight:700;direction:rtl;' +
      'display:flex;align-items:center;gap:10px;justify-content:center;flex-wrap:wrap';
    var first = (bads[0] && plain(bads[0]).t) || '';
    b.innerHTML = '<span>⚠️ الفحص الذاتي وجد ' + bads.length + ' مشكلة' +
      (warns.length ? ' و' + warns.length + ' تنبيه' : '') + (first ? ' — أوّلها: ' + String(first).replace(/[<>&]/g, '') : '') + '</span>' +
      '<button id="gmt-sc-more" style="background:#fff;border:0;color:#7f1d1d;border-radius:8px;' +
      'padding:4px 12px;font-weight:800;cursor:pointer;font-family:inherit">التفاصيل</button>' +
      '<button id="gmt-sc-x" style="background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:8px;' +
      'padding:4px 12px;font-weight:800;cursor:pointer;font-family:inherit">إخفاء</button>';
    document.body.insertBefore(b, document.body.firstChild);
    try {
      document.getElementById('gmt-sc-more').onclick = function () {
        var txt = bads.map(function (r) { var x = plain(r); return '🔴 ' + x.t + (x.d ? '\n   ' + x.d : ''); })
          .concat(warns.map(function (r) { var x = plain(r); return '🟠 ' + x.t + (x.d ? '\n   ' + x.d : ''); })).join('\n\n');
        if (global.GMTAsk && GMTAsk.alert) GMTAsk.alert(txt, { title: 'نتيجة الفحص الذاتي' }); else alert(txt);
      };
    } catch (_) {}
    b.querySelector('#gmt-sc-x').onclick = function () { b.remove(); };
  }

  /* تشغيل تلقائي: مرّة كل 24 ساعة، بصمت، بعد استقرار الصفحة */
  function auto() {
    var last = 0;
    try { last = Number(localStorage.getItem(KEY)) || 0; } catch (_) {}
    if (Date.now() - last < 86400000) return;
    setTimeout(function () { run(false).catch(function () {}); }, 6000);
  }
  if (document.readyState === 'complete') auto();
  else addEventListener('load', auto);

  global.GMTSelfCheck = { _plain: plain, run: run, checkAssets: checkAssets, checkBrand: checkBrand, checkDatabase: checkDatabase };
})(window);
