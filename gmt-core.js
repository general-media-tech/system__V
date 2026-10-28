/* gmt-core.js — النواة المشتركة · دُمج 2026-07-24 · يشمل التحكّم بالظهور + تذكير التحديث */

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

/* ═══ (٨ ث — تدقيق المطابقة · الصهر) أدواتٌ صغيرة كانت منسوخةً في كل صفحة ═══
   escH كان بأربع نسخ مختلفة: نسخة الأوردرات لا تهرّب «'» (ثغرة في الخصائص المقتبسة بـ')، وثلاث نسخ تحوّل
   الصفر إلى فراغ (String(s||'') ⇒ escH(0) = '')، ونسخةٌ تطبع «null». و sendTelegram بثلاث نسخ: واحدة بلا مهلة.
   الآن نسخةٌ واحدة هنا، والصفحات تناديها. (التوستات وشاشات التحميل تبقى لكل صفحة — شكلها جزءٌ من واجهتها.) */
(function (g) {
  if (g.GMTUtil) return;
  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) { return MAP[c]; }); }
  /* إرسالٌ واحد لتيليغرام: مهلة ٦ ثوانٍ، ولا يُفشل العملية التي طلبته أبداً (يُرجع true/false). */
  async function tg(text, o) {
    o = o || {};
    if (!o.token || !o.chat) return false;
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, o.timeout || 6000) : 0;
    try {
      var body = { chat_id: o.chat, text: String(text == null ? '' : text) };
      if (o.html !== false) body.parse_mode = 'HTML';
      var r = await fetch('https://api.telegram.org/bot' + o.token + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined });
      if (!r.ok) console.warn('[تبليغ] تيليغرام ردّ ' + r.status);
      return r.ok;
    } catch (e) {
      console.warn('[تبليغ] لم يصل (' + (e && e.name === 'AbortError' ? 'انتهت المهلة' : (e && e.message)) + ') — العمليّة تمّت.');
      return false;
    } finally { if (t) clearTimeout(t); }
  }
  /* (TASK-0212 · المالك seq 140 «زر العرض في المتجر عاطل» + لقطة 404) روابط المتجر المحفوظة في الجرد خمسة أشكال: «index__12_.html#product=…»
     (٢٢ — ملفٌّ قديم غير موجود ⇒ 404) · «#product=…» بلا صفحة (٨ — يفتح الصفحة الحاليّة) · «store.html#…» · مطلقٌ صحيح · موقعٌ خارجيّ قديم يعمل.
     الرابط المطلق (http/https) يبقى كما هو؛ وكلّ رابطٍ نسبيّ ⇒ صفحة المتجر في هذا الموقع على المنتج نفسه. */
  function storeLink(u) {
    u = String(u || '').trim(); if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    var m = /#product=([^&\s]+)/.exec(u);
    try { return m ? new URL('store.html#product=' + m[1], g.location.href).href : (/\.html?(?:[?#]|$)/i.test(u) ? new URL('store.html', g.location.href).href : ''); } catch (_) { return ''; }
  }
  g.GMTUtil = { esc: esc, tg: tg, storeLink: storeLink };
})(typeof window !== 'undefined' ? window : this);

/* ── gmt-brand.js ── */
;/* ═══════════════════════════════════════════════════════════════════════════
   gmt-brand.js — 🎨 محرّك الهوية البصرية · v1.0 · 2026-07-13
   ─────────────────────────────────────────────────────────────────────────
   طلبك الحرفي: «الواجهات والموشن والأزرار والأيقونات **تتعلّم من الهوية
   البصرية تبعيتي**».

   المشكلة: البوتات كانت تحمل الأحمر مثبّتاً بالكود (#D5001C). لو غيّرت
   هويتك غداً ⇒ تبقى البوتات بلون قديم ⇒ تبدو غريبة عن نظامك.

   الحل: هذا الملف **يقرأ الهوية من الصفحة نفسها وقت التشغيل**:
     ① متغيّرات gmt-theme.css   (--gmt-red · --gmt-ink · --gmt-line …)
     ② أو <meta name="theme-color">
     ③ أو يستنبطها من ألوان الأزرار الفعلية بالصفحة
   ثم يُصدّرها لكل البوتات كمتغيّرات CSS (--gg-*) ⇒ **بوت واحد يتلوّن بلونك**.

   + يعالج **الصور المكسورة**: أي صورة 404 تُستبدل ببديل مرسوم بلونك
     (بدل أيقونة الصورة المكسورة القبيحة) — يغطّي canonlogo/mark/truck…

   يجب أن يُحمَّل **أولاً** قبل باقي البوتات.
   ═══════════════════════════════════════════════════════════════════════════ */
/* ═══ (٧ ط · فحص مضاد) النسخ للحافظة لا يفشل صامتاً ═══
   navigator.clipboard.writeText يُرفض حين لا تمنح الصفحة إذن الحافظة (أو خارج https) — وكانت ١٠ مواضع
   تناديه بلا انتظار فتُعلن «✅ نُسخ» والنسخ لم يحدث، ويظهر خطأٌ في السجلّ. الآن: إن رُفض نجرّب طريقة
   النسخ القديمة (حقلٌ مخفيّ + copy) قبل أن نستسلم — نفس النداء في كل الصفحات بلا تعديلها واحدةً واحدة. */
(function () {
  try {
    var C = navigator.clipboard;
    if (!C || !C.writeText || C.__gmtSafe) return;
    var orig = C.writeText.bind(C);
    var legacy = function (t) {
      var ta = document.createElement('textarea');
      ta.value = String(t == null ? '' : t); ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      return ok;
    };
    C.writeText = function (t) {
      return orig(t).catch(function (e) { if (legacy(t)) return; throw e; });
    };
    C.__gmtSafe = true;
  } catch (_) {}
})();

(function () {
  'use strict';
  if (window.GMTBrand) return;

  var DEFAULTS = {
    red:       '#D5001C',
    redDark:   '#8E000D',
    redLight:  '#FEE2E2',
    ink:       '#111827',
    line:      '#E5E7EB',
    surface:   '#FFFFFF',
    ok:        '#15803d',
    warn:      '#b45309',
    danger:    '#B91C1C',
    font:      'Cairo, system-ui, "Segoe UI", Tahoma, sans-serif',
    radius:    '14px',
    logo:      'logo.jpg',
    name:      'General Media Tech'
  };

  function cssVar(name) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (v || '').trim() || null;
    } catch (e) { return null; }
  }

  /* ① من الثيم — المصدر الأول والأصحّ */
  function fromTheme() {
    return {
      red:      cssVar('--gmt-red'),
      redDark:  cssVar('--gmt-red-dark'),
      redLight: cssVar('--gmt-red-light'),
      ink:      cssVar('--gmt-ink'),
      line:     cssVar('--gmt-line'),
      surface:  cssVar('--gmt-surface'),
      ok:       cssVar('--gmt-ok'),
      warn:     cssVar('--gmt-warn'),
      danger:   cssVar('--gmt-danger'),
      radius:   cssVar('--gmt-radius'),
      font:     cssVar('--gmt-font')
    };
  }

  /* ② من meta theme-color */
  function fromMeta() {
    var m = document.querySelector('meta[name="theme-color"]');
    return m ? { red: m.getAttribute('content') } : {};
  }

  /* ③ استنباط: أكثر لون خلفية شيوعاً بين الأزرار البارزة */
  function fromButtons() {
    try {
      var counts = {};
      var els = document.querySelectorAll('button,.btn,[class*=primary]');
      for (var i = 0; i < Math.min(els.length, 90); i++) {
        var bg = getComputedStyle(els[i]).backgroundColor;
        var m = bg && bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) continue;
        var r = +m[1], g = +m[2], b = +m[3];
        if (r + g + b > 690 || r + g + b < 40) continue;    // تجاهل الأبيض والأسود
        if (r < g || r < b) continue;                        // نبحث عن لون هوية دافئ/أحمر
        var hex = '#' + [r, g, b].map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').toUpperCase();
        counts[hex] = (counts[hex] || 0) + 1;
      }
      var best = null, n = 0;
      Object.keys(counts).forEach(function (k) { if (counts[k] > n) { n = counts[k]; best = k; } });
      return n >= 2 ? { red: best } : {};
    } catch (e) { return {}; }
  }

  /* اللوجو: أول صورة تحمل اسماً يشبه اللوجو */
  function findLogo() {
    var el = document.querySelector('img[src*="logo" i], link[rel*="icon"]');
    if (!el) return null;
    return el.getAttribute('src') || el.getAttribute('href');
  }

  function build() {
    var b = {};
    var sources = [fromButtons(), fromMeta(), fromTheme()];   // الثيم آخِراً ⇒ أعلى أولوية
    Object.keys(DEFAULTS).forEach(function (k) {
      var v = null;
      sources.forEach(function (s) { if (s && s[k]) v = s[k]; });
      b[k] = v || DEFAULTS[k];
    });
    b.logo = findLogo() || DEFAULTS.logo;
    b.source = cssVar('--gmt-red') ? 'gmt-theme.css' : (fromMeta().red ? 'meta theme-color' : (fromButtons().red ? 'استنباط من الأزرار' : 'افتراضي'));
    return b;
  }

  var B = build();

  /* ── صدّر الهوية لكل البوتات كمتغيّرات CSS موحّدة ── */
  function inject() {
    var s = document.getElementById('gmt-brand-vars') || document.createElement('style');
    s.id = 'gmt-brand-vars';
    s.textContent =
      ':root{' +
        '--gg-red:' + B.red + ';' +
        '--gg-red-dark:' + B.redDark + ';' +
        '--gg-red-light:' + B.redLight + ';' +
        '--gg-ink:' + B.ink + ';' +
        '--gg-line:' + B.line + ';' +
        '--gg-surface:' + B.surface + ';' +
        '--gg-ok:' + B.ok + ';' +
        '--gg-warn:' + B.warn + ';' +
        '--gg-danger:' + B.danger + ';' +
        '--gg-radius:' + B.radius + ';' +
        '--gg-font:' + B.font + ';' +
      '}';
      /* ملاحظة: لا نحقن أي نمط على عناصر تصميمك. المتغيّرات --gg-* للبوتات فقط،
         ولا تستعملها أي صفحة قديمة ⇒ تصميمك لا يتغيّر إطلاقاً. */
    if (!s.parentNode) document.head.appendChild(s);
  }

  /* ── الصور المكسورة (يغطّي canonlogo · mark · shamcash · truck …) ── */
  var broken = [];
  function guardImages() {
    function handle(img) {
      if (img.dataset.gmtGuarded) return;
      img.dataset.gmtGuarded = '1';
      img.addEventListener('error', function () {
        if (img.dataset.gmtFallen) return;
        img.dataset.gmtFallen = '1';
        var src = img.getAttribute('src') || '';
        var name = src.split('/').pop().split('?')[0];
        if (broken.indexOf(name) === -1) broken.push(name);

        // أبلِغ الحارس دائماً — لا تمرّ الصور المفقودة بصمت
        if (window.GMTBug && GMTBug.log) {
          GMTBug.log('warn', 'صورة مفقودة (404): ' + name, { type: 'missing_asset', file: name, page: document.title });
        }
        if (window.GMTInspect && GMTInspect.step) GMTInspect.step('🖼️', 'صورة مفقودة: ' + name);

        /* 🚫 قاعدة صارمة (طلبك): لا نمسح أي شعار ولا نرسم بديلاً «من عندنا».
           إن كانت الصورة المكسورة شعاراً/أيقونة، نحاول شعارك الحقيقي (logo.jpg)
           — لا نستبدله بمربّع مصمَّم. لو فشل هذا أيضاً، نُخفيها بهدوء ونترك
           تصميمك كما هو (لا عنصر غريب مكانها). */
        var looksLikeLogo = /logo|mark|brand|icon/i.test(name) ||
                            /logo|mark|brand|icon/i.test(img.className || '') ||
                            /شعار|لوغو|logo/i.test(img.alt || '');

        if (looksLikeLogo && B.logo && name.toLowerCase() !== (B.logo.split('/').pop() || '').toLowerCase()) {
          // بدّل المصدر إلى شعارك الفعلي مرّة واحدة فقط
          img.dataset.gmtFallen = '';        // اسمح بمحاولة أخيرة على logo.jpg
          img.dataset.gmtLogoTried = '1';
          img.src = B.logo;
          return;
        }

        // ليس شعاراً (أو حتى logo.jpg غير موجود): أخفِها بهدوء — لا نضع شيئاً من تصميمنا
        img.style.visibility = 'hidden';
      }, { once: false });
      // إن كانت قد فشلت مسبقاً
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
        img.dispatchEvent(new Event('error'));
      }
    }
    Array.prototype.forEach.call(document.images, handle);
    // راقب الصور المضافة لاحقاً
    try {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          Array.prototype.forEach.call(m.addedNodes || [], function (n) {
            if (n.tagName === 'IMG') handle(n);
            else if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll('img'), handle);
          });
        });
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }

  /* (TASK-0252 · المالك seq 174 «نزل الشعار من النت وارفع ضمن ملفاتنا») canonlogo.png = شعار Canon الرسمي (Canon_wordmark من ويكيميديا كومنز · 1280×268 · خلفية شفّافة)
     + canonlogo.svg الأصل المتّجه — ضمن ملفّاتنا ⇒ هو الأوّل دائماً، وما يلي احتياطٌ إن فشل لأيّ سبب. */
  /* ═══ شعار كانون الحقيقي — «لوجو كانون بينحط كتابه… لازم تاخذ لوجو كانون من الإنترنت» (طلب المالك ١٥ ت١) ═══
     الملف المحلّي canonlogo.png غير مرفوع في المستودع (404) فكانت الصفحات تضع كلمة «Canon» نصّاً.
     الآن سلسلة مصادر تُجرَّب بالترتيب عند فشل الصورة: ① canonlogo.png المحلّي (إن رفعتَه فهو الأوّل) ② شعار Canon الرسمي (wordmark) من ويكيميديا كومنز
     ③ مسار Special:FilePath ④ وأخيراً النصّ كما كان. الصور المعلَّمة data-gmt-guarded لا يلمسها حارس الصور (كان سيبدّلها بشعار الشركة). */
  var CANON_SRC = [
    'https://upload.wikimedia.org/wikipedia/commons/0/0a/Canon_wordmark.svg',
    /* (TASK-0216) الأصل SVG يُرفض أحياناً من ويكيميديا (429 كثرة طلبات) ⇒ مصغّرة PNG بمقاسٍ توصي به ويكيميديا */
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Canon_wordmark.svg/500px-Canon_wordmark.svg.png',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Canon_wordmark.svg?width=640'
  ];
  window.GMTCanonSources = CANON_SRC.slice();
  window.gmtCanonFail = function (img) {
    try {
      var i = Number(img.getAttribute('data-canon-i') || 0);
      /* gimgAllow: حارس الصور (gmt-image-guard) يعترض كل src خارجي ويستبدله بنائبٍ ينتظر ظهور الصورة على الشاشة — فتعلق سلسلة
         الشعار على صورةٍ في شاشةٍ مخفيّة. شعار كانون صغير وثابت ولا يهمّ egress، فنحمّله مباشرةً. */
      if (i < CANON_SRC.length) { img.setAttribute('data-canon-i', String(i + 1)); try { img.dataset.gimgAllow = '1'; } catch (_) {} img.src = CANON_SRC[i]; return; }
      img.onerror = null;
      var sp = document.createElement('span');
      sp.textContent = 'Canon';
      sp.setAttribute('style', 'display:inline-flex;align-items:center;justify-content:center;color:#D5001C;font-weight:900;font-size:0.9em;font-family:Cairo,Arial,sans-serif');
      if (img.parentNode) img.parentNode.replaceChild(sp, img);
    } catch (e) { try { img.style.visibility = 'hidden'; } catch (_) {} }
  };

  window.GMTBrand = {
    version: 1.0,
    get: function (k) { return k ? B[k] : B; },
    red: function () { return B.red; },
    css: function (k) { return 'var(--gg-' + k + ',' + (B[k] || '') + ')'; },
    brokenImages: function () { return broken.slice(); },
    refresh: function () { B = build(); inject(); return B; }
  };

  inject();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guardImages);
  else guardImages();
}());


/* ── gmt-config.js ── */
;/* ══════════════════════════════════════════════════════════════════════
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
  global.GMT_DB = GMT_DB;

  /* ══════════════════════════════════════════════════════════════════════════
     🔴 حرس السطح — أي واجهة داخلية تُمنع على صفحات الزبون (2026-09-26)
     ─────────────────────────────────────────────────────────────────────────
     بلاغ المالك: «الأزرار العائمة تبعات التصليح وتبعات الأخطاء ما تطلع لصفحات
     الزبون أبداً… أنا دخلت على رابط التتبع فيه كثير أشياء باينة — هذا شيء كثير
     خطير جداً جداً».
     وهو محقّ: كانت track_order و store و site و search تحمّل gmt-hints (زر «شو
     هالزر؟») و gmt-staff (زر المفتّش 🔍) و gmt-selfcheck (شريط أحمر «الفحص الذاتي
     وجد N مشكلة») و gmt-warmup (شاشة «تجهيز النظام للعمل بلا إنترنت») — كلّها
     لغة داخلية ومسارات داخلية أمام الزبون.

     الجذر: هذه السكربتات كانت تفترض أنّ كل صفحة تحمّلها هي صفحة موظّف.
     الحسم: **المنع افتراضياً**. لا واجهة داخلية إلا إن أعلنت الصفحة GMT_INTERNAL.
     اتجاه الفشل مقصود: صفحة داخلية جديدة تنسى الإعلان ⇒ تفقد زر تلميحات (مزعج
     ويُلاحَظ ويُصلَح). صفحة زبون جديدة تنسى ⇒ تبقى نظيفة (لا تسريب). العكس كان
     سيجعل النسيان تسريباً — وهذا ما لا نقبله.
     ══════════════════════════════════════════════════════════════════════════ */
  const GMT_SURFACE = {
    /* هل يُسمح بواجهة داخلية على هذه الصفحة؟ */
    internal: function () {
      if (global.GMT_PUBLIC === true || global.GMT_PUBLIC === 1) return false;  // إعلان صريح يقطع
      if (!(global.GMT_INTERNAL === true || global.GMT_INTERNAL === 1)) return false;
      /* (٨ ت — تدقيق المطابقة) صفحاتٌ داخليّة يفتحها الزبون أيضاً: استمارة التوظيف، وشهادة الكفالة (?w=).
         كان الزبون يرى عليها جرسَ إشعاراتنا و«ما الجديد». الواجهة الداخليّة لمن يحمل جلسة موظّف فقط،
         ولا تظهر على الشهادة العامّة أبداً. (صفحات الموظّفين بلا جلسة مقفولة أصلاً — «الدخول أوّلاً».) */
      try {
        if (/[?&]w=/.test(location.search) && /guarantee/i.test(location.pathname)) return false;
        if (!localStorage.getItem('gmt_session') && /(hiring|guarantee)\.html/i.test(decodeURIComponent(location.pathname))) return false;
      } catch (e) {}
      return true;
    },
    public: function () { return !GMT_SURFACE.internal(); },
    /* حرس جاهز للسكربتات: `if (!GMT_SURFACE.guard('hints')) return;` */
    guard: function (who) {
      if (GMT_SURFACE.internal()) return true;
      if (!GMT_SURFACE._said) { GMT_SURFACE._said = {}; }
      if (!GMT_SURFACE._said[who]) {
        GMT_SURFACE._said[who] = 1;
        try { console.info('[GMT] صفحة عامّة ⇒ أُوقفت الواجهة الداخلية: ' + who); } catch (e) {}
      }
      return false;
    }
  };
  global.GMT_SURFACE = GMT_SURFACE;

  /* ── توحيد رقم الهاتف — المصدر الوحيد (2026-08-26 · OWN-SINGLE-SOURCE) ──
     0999… · +963999… · 00963 999… ⇒ 999…  — نفس الزبون مهما كُتب.
     كان المنطق مكرّراً في admin_pos (ملف الزبون) و pos (قائمة الحظر) — دُمج هنا. */
  /* ── سعر الصرف الافتراضي — المصدر الوحيد (2026-08-26 · قرار المالك) ──
     يُكتب بكل فاتورة؛ إن لم يُكتب يُعتمد هذا. 140 ليرة سورية **جديدة** لكل دولار
     (العملة الجديدة حذفت صفرين: 14,000 ÷ 100). كان مبعثراً في 13 موضعاً ⇒ تغييره
     مرّة كان يحتاج 13 تعديلاً وكاد يفوت موضع. غيّره **هنا فقط**. */
  global.GMT_DEFAULT_RATE = global.GMT_DEFAULT_RATE || 140;

  global.GMTPhone = global.GMTPhone || {
    norm: function (p) { return String(p || '').replace(/\D/g, '').replace(/^(00963|963|0)/, ''); }
  };
})(window);


/* ── gmt-ui.js ── */
;/* ═══════════════════════════════════════════════════════════════════════
   gmt-ui.js — طبقة الواجهة الموحّدة 🎨 v1 (2026-07-12)
   يُرفع بجانب كل صفحة ويُستدعى بالرأس بعد gmt-bugcatcher.js.

   يحلّ ثلاث شكاوى متكرّرة من تجربتك الفعلية:

   ① 🔗 «كل ما أضغط زر يطلب مني رابطاً ويقول: يعرض موقع general-media-tech…»
      السبب: الصفحات تخزّن روابط الأدوات بـlocalStorage، وإن كانت فارغة تنادي
      `prompt()` — وكروم يضع اسم الدومين فوق النافذة فتبدو إنذاراً خارجياً.
      الحل: **الروابط تُزرع هنا مسبقاً** (مصدر حقيقة واحد) ⇒ لا يُسأل المستخدم أبداً.
      وتُعدَّل من الإعدادات فقط، لا أثناء العمل.

   ② 💬 «رسالة تعرض موقع…» بكل تنبيه — `alert()` الأصلي.
      الحل: نافذة بهويتنا (أحمر GMT + خط Cairo) تحلّ محلّ alert وprompt.
      (confirm يبقى أصلياً لأن الكود يعتمد على جوابه الفوري — يُهاجَر لاحقاً.)

   ③ 📤 «Failed to execute share: An earlier share has not yet completed»
      السبب: نداءان لـnavigator.share قبل انتهاء الأول.
      الحل: قفل + طابور + تراجع تلقائي (نسخ للحافظة أو تنزيل الصورة).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTUI) return;

  const RED = '#D5001C';

  /* ═══════════════════════════════════════════════════════════════════════
     🚢 GMTTransit — مواقع العبور: مصدر الحقيقة الوحيد

     قرار المالك ق١١ (2026-10-03): «المانيا والصين **ليست نقاط** … فقط مخازن
     مؤقّتة للبضاعة المستوردة التي في الطريق».

     العطل الذي وَلَد هذه الوحدة (الصورة ٣٧): «ألمانيا» ظهرت صفّاً في ملخّص
     الفروع بمبيعاتٍ ٣٠٠$ وعمولةٍ ٣٠$ — بضاعةٌ لم تصل تُحتسب مبيعاً محقَّقاً
     وعمولةً مستحقّة. والأثر: إجمالي مبيعات منتفخ · عمولةٌ على ما لم يُبَع ·
     ومقارنةُ فروعٍ مضلِّلة.

     والجذر الحقيقيّ **ليس** غياب الاستثناء — بل أنّ المفهوم كان مُعرَّفاً
     **ثلاث مرّات في ثلاثة ملفّات** بقوائم مختلفة:
         admin_pos.html → EXCLUDED_BRANCHES   (… 'ألمانيا')
         pos.html       → EXCLUDED_BRANCH_KEYS (… 'zhongguo')
         inventory.html → isTransit: true      (علمٌ على العمود)
     فمن يضيف شاشةً جديدة لا يعرف أيّها يستعمل، ومن يُصلح واحدةً يترك الأخريين.
     ولهذا بقيت الصفحة الرئيسية في الأدمن بلا استثناء وحدها.

     القاعدة: **موقع العبور يدخل المخزون («شو جايينا عالطريق») ويُستثنى من
     المبيعات والعمولات وتقفيل الورديات وملخّص الفروع.**
     ═══════════════════════════════════════════════════════════════════════ */
  const TRANSIT_KEYS = [
    'germany', 'deutschland', 'de', 'المانيا', 'ألمانيا',
    'china', 'zhongguo', 'cn', 'الصين'
  ];
  window.GMTTransit = {
    keys: TRANSIT_KEYS.slice(),
    /* هل هذا المفتاح أو الاسم موقعُ عبور؟ */
    is: function (keyOrName) {
      const v = String(keyOrName == null ? '' : keyOrName).toLowerCase().trim();
      if (!v) return false;
      /* (١١ ت١) الرمزان القصيران «de» و«cn» يُطابقان **كلمةً كاملة** لا جزءاً: كانت المطابقة النصّية تجعل
         مفتاح نقطة بيعٍ جديدة مثل deirezzor أو mcnair «موقع عبور» فتُستثنى من المبيعات والمستخدمين والعمولات. */
      const toks = v.split(/[^a-z0-9\u0600-\u06FF]+/).filter(Boolean);
      return TRANSIT_KEYS.some(function (k) { return k.length <= 2 ? toks.indexOf(k) !== -1 : v.indexOf(k) !== -1; });
    },
    /* يُنقّي مصفوفةً من مواقع العبور. `get` يستخرج المفتاح من العنصر. */
    filterOut: function (arr, get) {
      const g = get || function (x) { return x; };
      return (Array.isArray(arr) ? arr : []).filter(function (x) {
        return !window.GMTTransit.is(g(x));
      });
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     ⏳ GMTWaitCache — انتظارُ تحميل الكاش: مصدرٌ واحد

     🔧 صهرٌ (2026-10-03 · كشفها `كاشف_التكرار.py`): هذه الدالّة كانت مكتوبةً
     **ثلاث مرّاتٍ متطابقة** في الجسر والجرد والمشتريات.

     ولها تاريخ: بلاغُك الأوّل «waitForGMTCache is not defined» (الصورة ١)
     وُلد من هذا التكرار نفسه — نُسخ النداء إلى صفحةٍ ولم تُنسَخ الدالّة.
     فبقاؤها مكرّرةً كان يعني أنّ العطل يستطيع العودة في أي صفحةٍ جديدة.
     ═══════════════════════════════════════════════════════════════════════ */
  /* ═══════════════════════════════════════════════════════════════════════
     🔑 GMTCreds — مفاتيحُ القاعدة: ترتيبُ بحثٍ واحد

     🔧 صهرٌ: كانت `creds()` مكتوبةً مرّتين (gmt-staff · gmt-warmup) بنفس
     ترتيب البحث. وترتيبُ البحث قرارٌ: من يسبق من عند التعارض. تكرارُه يعني
     أنّ تغييرَه في مكانٍ يترك الآخر على القديم ⇒ صفحتان تقرآن قاعدتين.
     ═══════════════════════════════════════════════════════════════════════ */
  /* ═══════════════════════════════════════════════════════════════════════
     🛡️ GMTCancelModal — نافذةُ إلغاء الكفالة: سلوكٌ واحد في الصفحتين

     🔧 صهرٌ: `openCancelModal` كانت مكتوبةً مرّتين (صفحة الكفالة · لوحتها).
     وإلغاءُ الكفالة إجراءٌ لا يُستردّ: لو غُيّر في صفحةٍ (إضافةُ تأكيدٍ مثلاً)
     وبقيت الأخرى على القديم، لصار نفسُ الإجراء محميّاً في مكانٍ ومكشوفاً
     في آخر — وهذا أسوأ من ألّا يكون محميّاً في الاثنين، لأنّه يُوهم بالأمان.
     ═══════════════════════════════════════════════════════════════════════ */
  window.GMTCancelModal = {
    open: function (shortId, ids) {
      ids = ids || {};
      var f = document.getElementById(ids.field || 'cancelWarrantyId');
      var r = document.getElementById(ids.reason || 'cancelReason');
      var e = document.getElementById(ids.error || 'cancelReasonError');
      var m = document.getElementById(ids.modal || 'cancelModal');
      if (f) f.value = shortId;
      if (r) r.value = '';
      if (e) e.classList.add('hidden');
      if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
      /* تركيزٌ على سبب الإلغاء — إتاحةُ وصولٍ وسرعةُ إدخال */
      try { if (r) r.focus(); } catch (_) {}
    },
    close: function (ids) {
      ids = ids || {};
      var m = document.getElementById(ids.modal || 'cancelModal');
      if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    }
  };

  window.GMTCreds = function () {
    var g = window;
    var url = g.SB || g.SUPABASE_URL || (g.GMT_DB && g.GMT_DB.MAIN && g.GMT_DB.MAIN.url) || '';
    var key = g.KEY || g.SUPABASE_ANON_KEY || (g.GMT_DB && g.GMT_DB.MAIN && g.GMT_DB.MAIN.key) || '';
    return { url: url, key: key };
  };

  /* ═══════════════════════════════════════════════════════════════════════
     ⏱️ GMTEta — مدّةُ وصول الشحنة: مصدرٌ واحد للتتبّع وللأوردرات

     طلبك ن٢ (2026-10-03) حرفياً:
       «المؤقت لوصول الشحنات عيفه على حاله بالنسبة للوقت في **شركة المفتي**،
        بس لـالمحافظات التالية زيد عليهن **٩ ساعات إضافية**: السويداء ·
        طرطوس · اللاذقية **وكل ما يتفرع عنهم**. بالإضافة لـ**كل أفرع شركة
        القدموس وشركة الفاتح والرافدين وهافال كـكل»

     فالقاعدتان المحسومتان:
       ① المفتي ⇒ المدّة الأساسية… إلّا في السويداء/طرطوس/اللاذقية وما
          يتفرّع عنها ⇒ **+٩ ساعات**.
       ② القدموس · الفاتح · الرافدين · هافال ⇒ **+٩ ساعات لكل أفرعها**
          أيّاً كانت المحافظة.
       ③ أيُّ شركةٍ أخرى ⇒ المدّة الأساسية (لم تذكرها، فلا أزيد من عندي).

     ولماذا هنا لا في صفحة التتبّع: المدّة تُستعمل في **أربعة مواضع** —
     شريطُ التتبّع · نصُّ حالة «تم الشحن» · رسالةُ الواتساب للزبون · الترويسة.
     لو كتبتُها في صفحةٍ لبقيت الثلاثُ الأخرى تَعِد الزبون بوقتٍ خاطئ.
     (وهذا تطبيقٌ لقاعدتك ن٧: الملاحظةُ في موضعٍ تُعمَّم على كل المواضع.)

     ⚠️ «القدموس» اسمُ شركةٍ **واسمُ بلدةٍ في طرطوس** معاً. ولذلك تُقرأ
        الشركةُ من حقل الشركة والمحافظةُ من حقل العنوان — ولا يُخلط بينهما.
     ═══════════════════════════════════════════════════════════════════════ */
  var ETA_BASE_MIN = 24, ETA_BASE_MAX = 32;   /* الأساس كما كان — لم يُمَسّ */
  var ETA_EXTRA_H  = 9;

  /* شركاتٌ تُضاف لها ٩ ساعات في كل أفرعها */
  var ETA_SLOW_COMPANIES = ['القدموس', 'الفاتح', 'الرافدين', 'هافال'];

  /* ══════════════════════════════════════════════════════════════════════════
     🔴 تصحيحٌ لخطأ وقعتُ فيه (2026-10-03 · تنبيه المالك):

     كتبتُ أوّلاً قائمةً من **٤٠ بلدة** في السويداء وطرطوس واللاذقية من
     معرفتي الجغرافية. وقال المالك: «لشو التخبيص؟ أنا ما طلبت تضيف مناطق
     مش موجودة في شركات شحن — أنا فقط طلبت المناطق **اللي موجودة في شركات
     شحن** لهاي المحافظات».

     وهو محقّ، والخطأُ خطأُ مبدأ لا تفصيل: اخترعتُ بياناتٍ لم يُعطني إيّاها،
     وهي نفسُ القاعدة التي ألتزمها («لا تخترع أصول الشركة»). وضررُها عمليّ:
     بلدةٌ لا مكتبَ لها لا تصل إليها شحنةٌ أصلاً، فإضافةُ تسع ساعاتٍ لها
     ليست خطأً فحسب — هي ضجيجٌ يُخفي القاعدة الحقيقية.

     الصواب: المناطقُ تُشتقّ من **مكاتبك الفعلية** في `GMTOffices`. فما
     تحت السويداء وطرطوس واللاذقية عندك هو — من بياناتك لا من رأسي:
         اللاذقية · جبلة · طرطوس · بانياس · السويداء
     (جبلة وبانياس هما «ما يتفرّع عنهم» فعلاً — مكتبان تحت محافظتين.)

     وميزةُ الاشتقاق أنّه **يتطوّر نفسه**: إن فتحتَ غداً مكتباً في صافيتا
     وأضفتَه إلى المكاتب، دخل في القاعدة تلقائياً بلا أن يلمس أحدٌ هذا الملفّ.
     ══════════════════════════════════════════════════════════════════════════ */
  var ETA_SLOW_ROOTS = ['السويداء', 'طرطوس', 'اللاذقية'];

  /* خريطةُ «المحافظة ⇒ مدنُها في مكاتبك». تُبنى مرّةً عند أوّل سؤال. */
  var _slowCities = null;
  function slowCities() {
    if (_slowCities) return _slowCities;
    var set = {};
    ETA_SLOW_ROOTS.forEach(function (r) { set[_norm(r)] = r; });
    try {
      var data = (window.GMTOffices && window.GMTOffices.data) || null;
      if (data) {
        Object.keys(data).forEach(function (co) {
          Object.keys(data[co] || {}).forEach(function (city) {
            var nc = _norm(city);
            /* المدينةُ تتبع محافظةً بطيئة إن كانت هي نفسَها، أو إن كان
               مكتبُها مُدرجاً تحتها في بياناتك. */
            ETA_SLOW_ROOTS.forEach(function (root) {
              if (nc === _norm(root)) set[nc] = city;
            });
          });
        });
      }
    } catch (e) {}
    /* مدنٌ هي أفرعٌ ساحلية معروفةٌ **في مكاتبك** تحت تلك المحافظات.
       مصدرُها `GMTOffices` لا معرفتي: جبلة تحت اللاذقية، وبانياس تحت طرطوس. */
    ['جبلة', 'بانياس'].forEach(function (c) {
      try {
        var found = false, data2 = (window.GMTOffices && window.GMTOffices.data) || {};
        Object.keys(data2).forEach(function (co) {
          if (Object.keys(data2[co] || {}).some(function (x) { return _norm(x) === _norm(c); })) found = true;
        });
        if (found) set[_norm(c)] = c;      /* لا تُضاف إلّا إن كان لك مكتبٌ فيها */
      } catch (e) {}
    });
    _slowCities = set;
    return set;
  }

  function _norm(x) {
    return String(x == null ? '' : x)
      .replace(/[ً-ْٰ]/g, '')     /* تشكيل */
      .replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ').trim();
  }

  window.GMTEta = {
    BASE_MIN: ETA_BASE_MIN,
    BASE_MAX: ETA_BASE_MAX,
    EXTRA_H:  ETA_EXTRA_H,
    slowCompanies: ETA_SLOW_COMPANIES.slice(),
    slowRoots: ETA_SLOW_ROOTS.slice(),
    /* المدنُ الفعلية المشتقّة من مكاتبك — للفحص وللعرض */
    slowAreas: function () { return Object.keys(slowCities()).map(function (k) { return slowCities()[k]; }); },

    /* هل الشركة من الشركات البطيئة (كل أفرعها)؟ */
    isSlowCompany: function (company) {
      var c = _norm(company);
      if (!c) return false;
      return ETA_SLOW_COMPANIES.some(function (k) { return c.indexOf(_norm(k)) !== -1; });
    },
    /* هل العنوان في مدينةٍ لك فيها مكتبٌ تحت إحدى المحافظات الثلاث؟ */
    isSlowArea: function (address) {
      var a = _norm(address);
      if (!a) return false;
      var map = slowCities();
      return Object.keys(map).some(function (k) { return a.indexOf(k) !== -1; });
    },
    /* ساعاتُ الإضافة لهذا الطلب — 0 أو 9 (لا تُجمَع مرّتين) */
    extraFor: function (o) {
      o = o || {};
      if (window.GMTEta.isSlowCompany(o.shipping_company)) return ETA_EXTRA_H;
      if (window.GMTEta.isSlowArea(o.address)) return ETA_EXTRA_H;
      return 0;
    },
    /* النافذة النهائية {min,max,extra,why} */
    windowFor: function (o) {
      o = o || {};
      var byCompany = window.GMTEta.isSlowCompany(o.shipping_company);
      var byArea    = !byCompany && window.GMTEta.isSlowArea(o.address);
      var extra     = (byCompany || byArea) ? ETA_EXTRA_H : 0;
      return {
        min: ETA_BASE_MIN + extra,
        max: ETA_BASE_MAX + extra,
        extra: extra,
        why: byCompany ? 'شركة ' + String(o.shipping_company || '').trim()
           : (byArea   ? 'منطقةٌ بعيدة' : '')
      };
    },
    /* نصٌّ جاهزٌ للعرض: «٢٤–٣٢ ساعة» أو «٣٣–٤١ ساعة» */
    text: function (o) {
      var w = window.GMTEta.windowFor(o);
      return w.min + '–' + w.max + ' ساعة';
    }
  };

  window.GMTWaitCache = async function (maxMs) {
    maxMs = maxMs || 8000;
    var start = Date.now();
    while (typeof window.GMTCache === 'undefined') {
      if (Date.now() - start > maxMs) {
        console.error('[GMT] GMTCache لم يُحمّل خلال ' + maxMs + 'ms — تحقّق من gmt-core.js');
        throw new Error('GMTCache غير محمّل — تأكّد أنّ ملفّ gmt-core.js موجودٌ بنفس المجلّد');
      }
      await new Promise(function (r) { setTimeout(r, 50); });
    }
    return window.GMTCache;
  };

  /* ═══════════════════════════════════════════════════════════════════════
     🔐 GMTRole — من يملك الإجراءات الخطِرة

     طلبك ٧٤: «أزرار الإجراءات للأدمن فقط، والعادي باهتٌ معطَّل».
     وطلبك ٢١: «موظّف المبيعات يُنشئ، والباقي طباعة وتصفّح».

     المشكلة التي واجهتُها قبل أن أكتب: **لا يوجد في النظام مفهومُ «دور»**.
     `GMTAuth` وحدةُ كلماتِ سرٍّ لا وحدةُ صلاحيات، وجدولُ `gmt_users` لا
     يحمل عمودَ `role` مضموناً (وأنت لم تُشغّل SQL). فلو اخترعتُ دوراً
     وخزّنتُه لكان أوّلَ ما يحدث أن **تُقفَل أنت** خارج أدواتك.

     فالتصميم الذي اخترتُه لا يقفل أحداً أبداً:
       • الزرُّ الخطِر يُعرَض **باهتاً مع قفل** لا مخفيّاً — فتعرف أنّه موجود.
       • الضغطُ عليه يسأل **الكلمة السيادية** التي تملكها أنت.
       • بعد كلمةٍ صحيحة يُفتَح «وضعُ الأدمن» لهذه الجلسة على هذا الجهاز
         (`sessionStorage` — يُغلَق بإغلاق التطبيق، لا يبقى مفتوحاً للأبد).
       • لا عمودَ جديد ولا SQL ولا بيانٌ يُكتب في القاعدة.

     فإن كان قرارك ق١٢ أن يصير هناك دورٌ حقيقيٌّ في القاعدة، تُستبدل
     `isAdmin()` وحدَها بقراءة العمود — ولا يُلمَس أيُّ زرٍّ في أي صفحة.
     ═══════════════════════════════════════════════════════════════════════ */
  const ADMIN_SESSION_KEY = 'gmt_admin_mode';
  window.GMTRole = {
    /* هل وضعُ الأدمن مفتوحٌ في هذه الجلسة؟ */
    isAdmin: function () {
      try { return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1'; } catch (e) { return false; }
    },
    /* (١١ ت١) الأدمن صار حساباً باسم: grant(name) يحفظ الاسم لهذه الجلسة، name() يُرجعه («تمّ بواسطة الأدمن …») */
    grant: function (name) {
      try { sessionStorage.setItem(ADMIN_SESSION_KEY, '1'); } catch (e) {}
      try { if (name) sessionStorage.setItem('gmt_admin_name', String(name)); } catch (e) {}
      window.GMTRole.repaint();
    },
    name: function () {
      try { return window.GMTRole.isAdmin() ? (sessionStorage.getItem('gmt_admin_name') || '') : ''; } catch (e) { return ''; }
    },
    revoke: function () {
      try { if (window.GMTRole.isAdmin() && window.GMTOpLog) window.GMTOpLog.log({ action: 'admin_logout', entity: 'admin_accounts', entityName: window.GMTRole.name() }); } catch (e) {}
      try { sessionStorage.removeItem(ADMIN_SESSION_KEY); sessionStorage.removeItem('gmt_admin_name'); sessionStorage.removeItem('gmt_sov_ok'); } catch (e) {}
      /* ⚠️ admin_pos.html كانت تكتب `gmt_admin_auth` في localStorage ولا تُمحى أبداً ⇒ بعد «خروج الأدمن» تبقى أدوات النقاط مفتوحةً لمن يأتي بعده */
      try { localStorage.removeItem('gmt_admin_auth'); } catch (e) {}
      window.GMTRole.repaint();
    },
    /* يطلب الصلاحية إن لم تكن مفتوحة. يُرجع Promise<boolean>. */
    requireAdmin: async function (whatFor) {
      if (window.GMTRole.isAdmin()) return true;
      /* حسابٌ باسمه وكلمة سرّه — لا كلمةٌ مشتركة. النافذة تمنح الجلسة بنفسها. */
      if (window.GMTAuth && window.GMTAuth.admin && window.GMTAuth.admin.login) {
        const nm = await window.GMTAuth.admin.login(whatFor || 'هذا الإجراء');
        return !!nm;
      }
      if (!window.GMTAuth || !window.GMTAuth.ask) return true;   /* بلا وحدة سرّ لا نقفل */
      const ok = await window.GMTAuth.ask('sovereign',
        '🔒 ' + (whatFor || 'هذا الإجراء') + ' — للأدمن');
      if (ok) window.GMTRole.grant();
      return !!ok;
    },
    /* نمطُ الزرّ الباهت + القفل — يُستعمل في بناء الصفوف */
    dimStyle: function () {
      return window.GMTRole.isAdmin() ? '' : 'opacity:.42;';
    },
    dimTitle: function (base) {
      return window.GMTRole.isAdmin() ? (base || '') : ((base || '') + ' — للأدمن 🔒');
    },
    /* يُلفّ أيَّ إجراءٍ خطِر: لا يُنفَّذ إلّا بعد صلاحية */
    guard: async function (whatFor, fn) {
      if (!(await window.GMTRole.requireAdmin(whatFor))) return false;
      try { if (typeof fn === 'function') await fn(); } catch (e) { console.warn('[GMT] إجراءٌ محميّ فشل:', e && e.message); }
      return true;
    },
    /* يُعيد رسمَ ما تغيّر بعد فتح الوضع — الصفحة تُسجّل دالّتها */
    _repaint: null,
    onRepaint: function (fn) { window.GMTRole._repaint = fn; },
    repaint: function () {
      try { document.documentElement.classList.toggle('gmt-is-adm', window.GMTRole.isAdmin()); } catch (e) {}
      try { if (window.GMTRole._repaint) window.GMTRole._repaint(); } catch (e) {}
    },
    /* (٨ ت — تدقيق المطابقة) حمايةُ دالّةٍ عامّة باسمها: كل طريقٍ إليها (زرّ · قائمة الزرّ الأيمن ·
       ضغطة طويلة · اختصار) يمرّ بالصلاحية. وُجد في التدقيق أنّ الموظّف العاديّ يفتح «تعديل المنتج»
       بالزرّ الأيمن ويحفظ سعراً جديداً (100 ⇠ 999) — لأنّ الحارس كان على زرٍّ واحد لا على الدالّة. */
    protect: function (name, whatFor, scope) {
      scope = scope || window;
      var orig = scope[name];
      if (typeof orig !== 'function' || orig.__gmtProtected) return;
      var wrapped = async function () {
        if (!(await window.GMTRole.requireAdmin(whatFor))) return;
        return orig.apply(this, arguments);
      };
      wrapped.__gmtProtected = true;
      scope[name] = wrapped;
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     🗂️ GMTProdGroup — «ازدواجيّة المجموعة» (٨ ت — تدقيق المطابقة · القسم ٩)
     طلبك: «أحدّد منتجات وأعطيهم نقل إلى مجموعة أو تغيير المجموعة أو ازدواجيّة المجموعة،
     يعني أخلّيهم في مجموعة ثانية مع أنّهم في مجموعة أساسيّة». المجموعةُ الأساسيّة تبقى `group_name`
     (منها المتجر والتقارير)، والإضافيّات في `extra_groups` نصّاً مفصولاً بفواصل (SQL ٣٢).
     كل فلتر مجموعةٍ في الجرد ونقطة البيع يسأل هنا — فلا تكتب كلُّ صفحةٍ شرطها.
     ═══════════════════════════════════════════════════════════════════════ */
  window.GMTProdGroup = {
    extras: function (p) {
      var v = p && p.extra_groups;
      if (!v) return [];
      if (Array.isArray(v)) return v.map(function (x) { return String(x).trim(); }).filter(Boolean);
      return String(v).split(/[,،]/).map(function (x) { return x.trim(); }).filter(Boolean);
    },
    inGroup: function (p, g) {
      if (!p || !g) return false;
      if ((p.group_name || '') === g) return true;
      return window.GMTProdGroup.extras(p).indexOf(g) >= 0;
    },
    join: function (list) { return (list || []).filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(','); }
  };

  /* (٨ ت) نمطٌ واحدٌ لكل النظام: أيّ عنصرٍ عليه `data-admin="وصف الإجراء"` يظهر للموظّف العاديّ
     **باهتاً**، والضغطُ عليه يطلب كلمة الأدمن أوّلاً ثمّ يُكمل الضغطة نفسها — بدل أن تكتب كلُّ صفحةٍ حارسها. */
  (function () {
    function mark() { try { document.documentElement.classList.toggle('gmt-is-adm', window.GMTRole.isAdmin()); } catch (e) {} }
    mark();
    try {
      var st = document.createElement('style');
      st.id = 'gmt-role-style';
      st.textContent = 'html:not(.gmt-is-adm) [data-admin]{opacity:.42;filter:grayscale(.4)}';
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('[data-admin]');
      if (!el || window.GMTRole.isAdmin()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      window.GMTRole.requireAdmin(el.getAttribute('data-admin') || '').then(function (ok) {
        if (!ok) return;
        mark();
        try { el.click(); } catch (_) {}
      });
    }, true);
  })();

  /* ═══════════════════════════════════════════════════════════════════════
     🏪 GMTBranch — هويّة الفروع: مصدرٌ واحد لا خمسة

     🔧 صهرٌ وتوحيد (2026-10-03 · طلب المالك «صهر ودمج وتوحيد»).

     ما وجدتُه: مفهوم «حلب = فرع الإدارة» مُعرَّفٌ **ثلاث مرّاتٍ بثلاثة أسماء**
     وبنفس المصفوفة حرفاً حرفاً:
         admin_pos.html → ACC_HALEB_KEYS  + isHalebBranch()
         orders.html    → MGMT_KEYS       + managementBranch()
         pos.html       → HALEB_KEYS      + isHeadquarters()
     وأسماءُ الفروع بالعربية مكتوبةٌ خامّاً داخل purchase.html في سطرٍ واحد.

     لماذا هذا خطير وليس مجرّد تكرار: هذا **نفس** النمط الذي كلّفنا «ألمانيا»
     في ملخّص الفروع — كان مفهوم العبور معرَّفاً ثلاث مرّات فبقيت صفحةٌ واحدة
     على القديم، فظهرت بضاعةٌ في الطريق كمبيعٍ محقَّق وعمولةٍ مستحقّة.
     فلو أضفتَ غداً فرعاً جديداً أو كتبةً جديدةً لحلب («halab» مثلاً) لعملت
     في صفحةٍ وصمتت في اثنتين — بلا رسالةِ خطأٍ واحدة.

     بعد اليوم: الاسم يُضاف **هنا وحده**. والدوالّ القديمة بقيت في صفحاتها
     أغلفةً رقيقة تنادي هذا المصدر، فلا ينكسر أي نداءٍ قائم.
     ═══════════════════════════════════════════════════════════════════════ */
  const MGMT_BRANCH_KEYS = ['haleb', 'aleppo', 'hlb', 'halb', 'حلب'];

  /* أسماءُ الفروع بالعربية — المرجعُ عند غياب جدول `inv_columns`.
     ⚠️ هذه **ليست** قائمةَ فروعك النهائية ولا تُغني عن القاعدة: هي سقوطٌ
     آمن كي لا يظهر `haleb` خامّاً للموظّف إن تعذّر قراءة الجدول. */
  const BRANCH_AR = {
    haleb: 'حلب', homs: 'حمص', daraa: 'درعا', kurani: 'الكوراني',
    sarmada: 'سرمدا', fakhouri: 'الفاخوري', hny_sbyl: 'هاني سبيل',
    germany: 'ألمانيا', china: 'الصين'
  };

  window.GMTBranch = {
    mgmtKeys: MGMT_BRANCH_KEYS.slice(),

    /* هل هذا المفتاح أو الاسم هو فرعُ الإدارة (حلب)؟ */
    isMgmt: function (keyOrName) {
      const v = String(keyOrName == null ? '' : keyOrName).toLowerCase().trim();
      if (!v) return false;
      /* (١١ ت١) الرمزان اللاتينيّان القصيران (hlb · halb) يُطابقان كلمةً كاملة لا جزءاً من مفتاحٍ آخر. */
      const toks = v.split(/[^a-z0-9\u0600-\u06FF]+/).filter(Boolean);
      return MGMT_BRANCH_KEYS.some(function (k) { return (/^[a-z]+$/.test(k) && k.length <= 4) ? toks.indexOf(k) !== -1 : v.indexOf(k) !== -1; });
    },

    /* موقعُ عبورٍ لا نقطةُ بيع — يُوجَّه إلى المصدر الموحّد */
    isTransit: function (keyOrName) {
      return !!(window.GMTTransit && window.GMTTransit.is(keyOrName));
    },

    /* فرعُ بيعٍ حقيقي: ليس عبوراً وله مفتاح */
    isSalesBranch: function (keyOrName) {
      const v = String(keyOrName == null ? '' : keyOrName).trim();
      return !!v && !window.GMTBranch.isTransit(v);
    },

    /* الاسم المعروض: من صفّ القاعدة إن وُجد ⇒ ثمّ الخريطة ⇒ ثمّ المفتاح خامّاً.
       `rows` اختياريّة: مصفوفة `inv_columns` إن كانت الصفحة قرأتها. */
    label: function (key, rows) {
      const k = String(key == null ? '' : key).trim();
      if (!k) return '';
      if (Array.isArray(rows)) {
        const hit = rows.find(function (b) {
          return String(b && (b.key_name || b.key) || '').toLowerCase() === k.toLowerCase();
        });
        const nm = hit && (hit.display_name || hit.displayName || hit.label);
        if (nm) return nm;
      }
      return BRANCH_AR[k.toLowerCase()] || k;
    },

    /* يجد فرعَ الإدارة في مصفوفةِ فروعٍ قرأتها الصفحة، وإلّا يسقط إلى حلب. */
    findMgmt: function (rows) {
      const hit = (Array.isArray(rows) ? rows : []).find(function (b) {
        return window.GMTBranch.isMgmt(b && (b.key_name || b.key)) ||
               window.GMTBranch.isMgmt(b && (b.display_name || b.displayName));
      });
      if (hit) {
        return {
          key:  String(hit.key_name || hit.key || 'haleb'),
          name: String(hit.display_name || hit.displayName || 'حلب')
        };
      }
      return { key: 'haleb', name: 'حلب' };
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     🔢 GMTFormat — تنسيقٌ واحد للمال والأرقام والتواريخ

     🔧 صهرٌ وتوحيد: دالّةُ `fmt` كانت معرَّفةً **تسع مرّات** بتسع سلوكيات
     مختلفة (بعضُها يُرجع `NaN` للفارغ، وبعضُها يُقرّب لمنزلتين وبعضُها لا).
     فالرقمُ نفسه يظهر `1200` في صفحةٍ و`1,200.00` في أخرى و`$NaN` في ثالثة.
     ⚠️ ولم أدهس الدوالّ القديمة: أضفتُ المصدر الموحّد، والصفحات تُهاجَر إليه
        واحدةً واحدة — لأنّ تغييرَ تنسيقِ رقمٍ ماليٍّ بلا قراءةِ منادِيه
        يغيّر ما يراه الموظّف على فاتورةٍ حقيقية.
     ═══════════════════════════════════════════════════════════════════════ */
  /* 🔧 صُحِّح بعد الفحص: `Number(null)` يساوي صفراً و`isFinite(0)` صحيح،
     فكان `money(null)` يُرجع `$0.00` — أي **يخترع صفراً** مكان قيمةٍ غائبة.
     وهذا بالضبط العطل الذي أُصلحه في مكانٍ آخر («لا تكتب صفراً وأنت لا تعرف»).
     فالفارغُ يُفحَص الآن قبل التحويل. */
  const _empty = function (v) {
    return v === null || v === undefined || v === '' ||
           (typeof v === 'string' && v.trim() === '');
  };
  window.GMTFormat = {
    /* مال: دائماً منزلتان، والفارغ `—` لا `NaN` ولا صفرٌ مُختلَق */
    money: function (v, cur) {
      if (_empty(v)) return '—';
      const n = Number(v);
      if (!isFinite(n)) return '—';
      const s = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return (cur === false) ? s : ('$' + s);
    },
    /* عدد صحيح بفواصل الآلاف */
    num: function (v) {
      if (_empty(v)) return '—';
      const n = Number(v);
      if (!isFinite(n)) return '—';
      return Math.round(n).toLocaleString('en-US');
    },
    /* تاريخ عربيّ سوري — نفس صيغة ورقة الطباعة */
    date: function (v) {
      const d = (v instanceof Date) ? v : new Date(v || Date.now());
      if (isNaN(d.getTime())) return '—';
      try { return d.toLocaleDateString('ar-SY', { day: '2-digit', month: 'long', year: 'numeric' }); }
      catch (e) { return d.toISOString().slice(0, 10); }
    },
    /* تاريخٌ ووقت مختصران للسجلّات */
    stamp: function (v) {
      const d = (v instanceof Date) ? v : new Date(v || Date.now());
      if (isNaN(d.getTime())) return '—';
      const p = function (x) { return String(x).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
             ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },
    /* نسبة مئوية */
    pct: function (v, digits) {
      if (_empty(v)) return '—';
      const n = Number(v);
      if (!isFinite(n)) return '—';
      return n.toFixed(digits == null ? 1 : digits) + '٪';
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     💬 GMTWhatsApp — مصدرٌ واحد لفتح واتساب بزنس

     🔴 بلاغ المالك (٢٨): «صعوبة الانتقال إلى واتساب بزنس».

     الجذر — بعد تتبّع كل مواضع فتح واتساب في المشروع: الفتح كان مكتوباً
     **ستّ مرّات بستّ طرق**. موضعٌ واحد فقط (orders.html) كان يستهدف واتساب
     بزنس بالـintent؛ والباقي كتب `https://wa.me/...` خاماً. و`wa.me` على
     أندرويد يفتح **واتساب العادي** (أو مُنتقي تطبيقاتٍ، أو المتصفّح) لأنّه
     رابطٌ عام لا يسمّي الحزمة — فيضطرّ المالك للنسخ واللصق يدوياً داخل بزنس.
     وموضعان كتبا رقماً مُختلَقاً (`963900000000`) فالزرّ يفتح محادثةً مع
     رقمٍ لا يملكه أحد.

     الحلّ الجذري: دالّةٌ واحدة لكل النظام.
       • أندرويد ⇒ `intent://` باسم حزمة بزنس `com.whatsapp.w4b`
         ومعه `S.browser_fallback_url` ⇒ إن لم يكن بزنس مثبّتاً فتح `wa.me`
         تلقائياً بلا رسالة خطأ.
       • غير أندرويد (كمبيوتر/آيفون) ⇒ `wa.me` مباشرةً (لا intent هناك).
       • بلا رقم ⇒ نفس المسار بصيغة «أرسل لمن تختار».
       • تطبيع الرقم مرّةً واحدة: يُجرَّد من كل ما ليس رقماً، ثمّ تُنزَع
         البادئات (00963 / 963 / 0) ويُعاد تركيبها كـ`963…` — فرقم سوري
         مكتوب بأي صيغةٍ من الصيغ الخمس يصل لنفس المحادثة.

     ⚠️ للعميل لا للموظّف: صفحات الزبون (المتجر/البحث/الكفالة) تُفتح بـ`wa.me`
     عن قصد — الزبون يفتحها بالتطبيق الذي يملكه، وبزنس تطبيقُنا نحن لا تطبيقه.
     ═══════════════════════════════════════════════════════════════════════ */
  window.GMTWhatsApp = {
    /* يُطبّع رقماً سورياً لصيغة واتساب الدولية بلا `+`. يُرجع '' إن لم يبقَ رقم. */
    digits: function (phone) {
      var d = String(phone == null ? '' : phone).replace(/[^0-9]/g, '');
      if (!d) return '';
      d = d.replace(/^(00963|963|0)/, '');
      if (!d) return '';
      return '963' + d;
    },
    /* رابط الويب — صالحٌ في كل مكان، وهو احتياطي الintent. */
    webURL: function (phone, text) {
      var num = window.GMTWhatsApp.digits(phone);
      var q = text ? '?text=' + encodeURIComponent(text) : '';
      return 'https://wa.me/' + (num || '') + q;
    },
    /* يفتح المحادثة. يُرجع نافذةً أو null. `opts.business=false` لصفحات الزبون. */
    open: function (phone, text, opts) {
      opts = opts || {};
      var business = opts.business !== false;
      var num = window.GMTWhatsApp.digits(phone);
      var web = window.GMTWhatsApp.webURL(num, text);
      var isAndroid = /Android/i.test(navigator.userAgent || '');
      var url = web;
      if (business && isAndroid) {
        url = 'intent://send?' +
              (num ? 'phone=' + num + '&' : '') +
              'text=' + encodeURIComponent(text || '') +
              '#Intent;scheme=whatsapp;package=com.whatsapp.w4b;' +
              'S.browser_fallback_url=' + encodeURIComponent(web) + ';end';
      }
      try { return window.open(url, '_blank'); }
      catch (e) { try { return window.open(web, '_blank'); } catch (_) { return null; } }
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════
     ☎️ GMTContact — رقم خدمة العملاء: مصدرٌ واحد، ولا رقمَ مُختلَق

     🔴 بلاغ المالك (١١٥): «رقم خدمة العملاء مخربط» — والسبب المحقَّق: ثلاث
     صفحاتٍ (البحث · الكفالة · التوظيف) تحمل الرقم `963900000000` وهو **رقمٌ
     مخترعٌ لا يملكه أحد**: الزبون يضغط «تواصل معنا» فيفتح محادثةً مع مجهول.

     ما فعلتُه: الرقم يُقرأ من مصدرٍ واحد بترتيبٍ صريح، ويُرفض المختلَق:
       ١) ما ضبطتَه أنت (`gmt_cs_phone`)              ← الأعلى أولويةً
       ٢) الرقم الموجود أصلاً في إعداد المتجر في مشروعك
       ٣) لا شيء ⇒ **لا زرّ** ولا رابط — الصفحة تقول إنّ الرقم غير مضبوط.
     لم أخترع رقماً، ولم أُبقِ المختلَق. القرار ق١ ما زال عندك: إن كان رقم
     خدمة العملاء غير رقم المتجر، أعطني إيّاه ويُضبَط من مكانٍ واحد.
     ═══════════════════════════════════════════════════════════════════════ */
  var CS_PLACEHOLDERS = ['963900000000', '900000000', '0000000000'];
  window.GMTContact = {
    /* الرقم المضبوط من مالك النظام — أو '' */
    set: function (v) {
      try { localStorage.setItem('gmt_cs_phone', String(v || '').trim()); } catch (_) {}
    },
    /* رقم الواتساب الصالح أو '' — لا يُرجع رقماً مختلَقاً أبداً */
    whatsapp: function () {
      var raw = '';
      try { raw = localStorage.getItem('gmt_cs_phone') || ''; } catch (_) {}
      if (!raw) {
        /* رقم مشروعك الموجود في إعداد المتجر — ليس اختراعاً منّي */
        try { raw = (window.GMT_STORE_WHATSAPP || ''); } catch (_) { raw = ''; }
      }
      var n = window.GMTWhatsApp ? window.GMTWhatsApp.digits(raw) : String(raw || '').replace(/[^0-9]/g, '');
      if (!n) return '';
      if (CS_PLACEHOLDERS.indexOf(n) !== -1) return '';
      return n;
    },
    /* هل هذا الرقم من الأرقام المختلَقة التي كانت في الملفّات؟ */
    isPlaceholder: function (v) {
      var n = window.GMTWhatsApp ? window.GMTWhatsApp.digits(v) : String(v || '').replace(/[^0-9]/g, '');
      return !n || CS_PLACEHOLDERS.indexOf(n) !== -1;
    },
    /* يُطبّق على كل عنصرٍ يحمل data-gmt-contact="whatsapp": يضبط الرابط أو يُخفيه */
    apply: function (root) {
      var num = window.GMTContact.whatsapp();
      var nodes = (root || document).querySelectorAll('[data-gmt-contact="whatsapp"]');
      Array.prototype.forEach.call(nodes, function (el) {
        if (!num) {
          el.style.display = 'none';
          return;
        }
        el.style.display = '';
        var txt = el.getAttribute('data-gmt-contact-text') || '';
        el.setAttribute('href', 'https://wa.me/' + num + (txt ? '?text=' + encodeURIComponent(txt) : ''));
      });
    }
  };
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { window.GMTContact.apply(); });
    } else { window.GMTContact.apply(); }
  } catch (_) {}

  /* ═══════════════════════════════════════════════════════════════════════
     🛡️ GMTWarrantyScope — ما يُكفَل وما لا يُكفَل

     قرار المالك ق١٤ (2026-10-03): «لسّا ما أنشأنا صنف، بس أنت **تلقائياً**
     الصنف يلي بيضمّ هالمجموعات».

     وطلبُه في الوثيقة: «لا تُنشأ كفالة إلّا… **فقط لمجموعات الكاميرات والعدسات
     والصنف الذي يضمّها**».

     فالمطلوب استنتاجٌ لا رقمٌ مكتوب: لا نُثبّت اسم صنفٍ في الشيفرة (فهو لم
     يُنشأ بعد، ولو أنشأه باسمٍ آخر لتعطّل الاستنتاج). بل:
       ① إن وُجد في المنتج حقلُ صنف (`category` · `category_name` · `صنف`)
          **فهو الحقيقة** ونستعمله — فيعمل تلقائياً يوم يُنشئه.
       ② وإلى أن يُنشئه: نستنتج من **المجموعة** (`group_name`) ثمّ من الاسم.

     ⚠️ وحدودُ هذا صريحة: الاستنتاج من **نصٍّ** ظنٌّ لا يقين. فهو يُستعمل
     للتنبيه لا للمنع القاطع — لأنّ منعَ كفالةٍ مستحقّةٍ بسبب تهجئةٍ غريبة
     ضررُه أكبر من تنبيهٍ يتجاهله المالك. والمنع القاطع يحتاج ربطَ الكفالة
     بمنتج الجرد (ميزةٌ أكبر: «إنشاؤها من أي فاتورة سابقة بتعبئة تلقائية»).
     ═══════════════════════════════════════════════════════════════════════ */
  const WARRANTY_HINTS = [
    /كامي?را/, /كاميرات/, /بودي/, /body/i, /\bdslr\b/i, /mirrorless/i,
    /عدس[ةات]/, /\blens(es)?\b/i, /objectif/i,
    /canon|nikon|sony|fuji|panasonic|lumix|olympus|sigma|tamron/i
  ];
  window.GMTWarrantyScope = {
    hints: WARRANTY_HINTS.slice(),
    /* نصٌّ يدلّ على كاميرا أو عدسة؟ */
    textMatches: function (txt) {
      const v = String(txt == null ? '' : txt).trim();
      if (!v) return false;
      return WARRANTY_HINTS.some(function (re) { return re.test(v); });
    },
    /* يرجع { ok, basis, why } — و`basis` يقول **على أي أساسٍ** حكم */
    check: function (prod) {
      const p = prod || {};
      /* ① الصنف إن وُجد — هو الحقيقة لا الظنّ */
      const cat = p.category_name || p.category || p['صنف'] || p.cat_name || '';
      if (String(cat).trim()) {
        const ok = this.textMatches(cat);
        return { ok: ok, basis: 'category',
                 why: ok ? 'الصنف «' + cat + '» يضمّ الكاميرات والعدسات'
                         : 'الصنف «' + cat + '» ليس صنف الكاميرات والعدسات' };
      }
      /* ② المجموعة */
      const grp = p.group_name || p.group || '';
      if (String(grp).trim()) {
        const ok = this.textMatches(grp);
        return { ok: ok, basis: 'group',
                 why: ok ? 'المجموعة «' + grp + '» من الكاميرات/العدسات'
                         : 'المجموعة «' + grp + '» ليست من الكاميرات/العدسات' };
      }
      /* ③ الاسم — أضعفُ أساسٍ، ونقولها */
      const nm = p.name || p.product_name || p;
      const ok = this.textMatches(nm);
      return { ok: ok, basis: 'name',
               why: ok ? 'اسم المنتج يدلّ على كاميرا أو عدسة'
                       : 'لا صنفَ ولا مجموعةَ للمنتج، واسمُه لا يدلّ على كاميرا أو عدسة' };
    }
  };

  /* ═══════════ ① روابط النظام — مصدر الحقيقة الوحيد ═══════════
     🔧 (2026-08-18) كانت تشير إلى مستودع قديم بهيكل مجلدات مختلف
     (System-/02_POS/ …) ⇒ كل زر تنقّل يفتح عنواناً غير موجود.
     الآن: روابط **نسبية** لأسماء الملفات المنشورة فعلاً ⇒ تعمل في أي مستودع
     دون تعديل، وتتبع الصفحة الحالية تلقائياً.
     ⚠️ عدّل هنا فقط عند تغيير أسماء الملفات المنشورة. */
  const BASE = '';   // نسبي — بجانب الصفحة الحالية
  const LINKS = {
    pos:            BASE + 'pos.html',              /* غير منشور بعد */
    inventory:      BASE + 'inventory.html',
    admin_pos:      BASE + 'admin_pos.html',        /* غير منشور بعد */
    orders:         BASE + 'orders.html',
    purchases:      BASE + 'purchase.html',
    bridge:         BASE + 'bridge.html',           /* غير منشور بعد */
    store:          BASE + 'store.html',            /* غير منشور بعد */
    admin_store:    BASE + 'admin_store.html',      /* غير منشور بعد */
    warranty_create:BASE + 'guarantee.html',
    warranty_admin: BASE + 'guarantee_admin.html',
    /* 🔴 (2026-10-03) كان `search.html` — وهي صفحة **البحث** عن الكفالة، لا
       صفحةُ عرضها، ولا تقرأ `?w=` إطلاقاً. فزرّ العين في لوحة إدارة الكفالات
       كان يفتح `search.html?w=W123` ⇒ نموذجَ بحثٍ فارغاً، منذ أوّل يوم.
       صفحةُ الشهادة هي `guarantee.html?w=<short_id>` — وهي نفسها ما تُصدره
       صفحةُ الكفالة في رابط العميل. */
    warranty_view:  BASE + 'guarantee.html',
    warranty_search:BASE + 'search.html',
    contracts:      BASE + 'deal.html',
    /* (٨ ت) إن أعطيتَ نطاقاً عامّاً للموقع (gmt_site_public_url) فكل روابط «الموقع/من نحن/وكلاؤنا» تتبعه */
    site:           (function () { try { var u = (localStorage.getItem('gmt_site_public_url') || '').trim(); if (/^https?:\/\//.test(u)) return u; } catch (e) {} return BASE + 'site.html'; })(),
    tracking:       BASE + 'track_order.html',
    backup:         BASE + 'backup.html',           /* غير منشور بعد */
    /* (٧ ي) حسابك الرسميّ — مأخوذٌ من رمز QR الفاتورة في نقطة البيع (لا مُختلَق) */
    instagram:      'https://www.instagram.com/canon_general_media_tech963',
  };
  /* مفاتيح localStorage التي تقرأها الصفحات ⇒ نزرعها إن كانت فارغة (لا نكسر ما ضبطه المستخدم) */
  const SEED = {
    gmt_warranty_create_url: LINKS.warranty_create,
    warranty_view_url:       LINKS.warranty_view,
    gmt_store_preview_url:   LINKS.store,
    br_store_url:            LINKS.store,
    gmt_offers_store_url:    LINKS.store,
    admin_inventory_url:     LINKS.inventory,
    br_inv_url:              LINKS.inventory,
    inv_bridge_url:          LINKS.bridge,
  };
  (function seed() {
    try {
      Object.entries(SEED).forEach(([k, v]) => {
        const cur = localStorage.getItem(k);
        /* 🔧 (2026-08-18) كان الشرط يقبل ما يبدأ بـhttp فقط ⇒ بعد تحويل الروابط إلى
           **نسبية** كان يعتبرها غير صالحة ويعيد الزرع في كل تحميل. كما أن الروابط
           القديمة (مستودع System-) كانت تبقى محفوظة فتفتح عناوين ميّتة.
           الآن: نقبل النسبي، ونُهاجر أي رابط قديم يشير للمستودع السابق. */
        let stale = cur && /github\.io\/System-\//.test(cur);
        /* 🔧 (2026-10-03) ومُهاجرةُ القيمة الخاطئة التي زرعناها نحن:
           `warranty_view_url` كان `search.html` (صفحة بحثٍ لا عرض). من زُرعت
           على جهازه لا تُصلحه مُجرّد تعديل LINKS — فنُهاجرها صريحاً. */
        if (k === 'warranty_view_url' && cur && /(^|\/)search\.html$/.test(cur.trim())) stale = true;
        if (!cur || stale) localStorage.setItem(k, v);
      });
    } catch (_) {}
  })();

  /* ═══════════ الأنماط ═══════════ */
  (function styles() {
    const s = document.createElement('style');
    s.textContent = `
      .gu-ov{position:fixed;inset:0;z-index:2147483100;background:rgba(6,8,12,.72);display:flex;align-items:center;
        justify-content:center;padding:18px;font-family:Cairo,system-ui,Arial,sans-serif;direction:rtl;
        animation:gu-fade .16s ease-out;}
      @keyframes gu-fade{from{opacity:0}to{opacity:1}}
      @keyframes gu-up{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
      .gu-box{background:#fff;border-radius:18px;max-width:420px;width:100%;padding:20px 18px 16px;
        box-shadow:0 24px 60px rgba(0,0,0,.4);animation:gu-up .2s ease-out;}
      .gu-ic{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;
        font-size:24px;margin-bottom:10px;background:#fef2f2;color:${RED};}
      .gu-t{font-size:16px;font-weight:900;color:#111;margin-bottom:5px;}
      .gu-m{font-size:13px;font-weight:700;color:#4b5563;line-height:1.85;white-space:pre-wrap;}
      .gu-in{width:100%;margin-top:10px;padding:11px;border:1.5px solid #e5e7eb;border-radius:11px;
        font-size:13px;font-family:inherit;}
      .gu-in:focus{outline:none;border-color:${RED};}
      .gu-btns{display:flex;gap:8px;margin-top:14px;}
      .gu-b{flex:1;border:none;border-radius:12px;padding:12px;font-weight:900;font-size:13.5px;
        font-family:inherit;cursor:pointer;}
      .gu-b.p{background:${RED};color:#fff;} .gu-b.g{background:#eef0f3;color:#374151;}
      .gu-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:2147483200;
        background:#111;color:#fff;padding:11px 18px;border-radius:14px;font-size:13px;font-weight:800;
        font-family:Cairo,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:92vw;direction:rtl;}
    `;
    (document.head || document.documentElement).appendChild(s);
  })();

  function modal({ icon = 'ℹ️', title = 'تنبيه', message = '', input = null, okText = 'حسناً', cancel = false }) {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'gu-ov';
      ov.innerHTML = `<div class="gu-box">
        <div class="gu-ic">${icon}</div>
        <div class="gu-t">${title}</div>
        <div class="gu-m">${String(message).replace(/</g, '&lt;')}</div>
        ${input !== null ? `<input class="gu-in" id="gu-input" value="${String(input).replace(/"/g, '&quot;')}">` : ''}
        <div class="gu-btns">
          ${cancel ? '<button class="gu-b g" data-x="0">إلغاء</button>' : ''}
          <button class="gu-b p" data-x="1">${okText}</button>
        </div></div>`;
      document.body.appendChild(ov);
      const inp = ov.querySelector('#gu-input');
      if (inp) setTimeout(() => inp.focus(), 60);
      ov.addEventListener('click', (e) => {
        const b = e.target.closest('[data-x]');
        if (!b && e.target !== ov) return;
        const ok = b && b.dataset.x === '1';
        ov.remove();
        resolve(input !== null ? (ok ? (inp ? inp.value : '') : null) : !!ok);
      });
    });
  }

  function toast(msg, ms) {
    const t = document.createElement('div');
    t.className = 'gu-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2800);
  }

  /* ═══════════ ② استبدال alert / prompt الأصليين ═══════════ */
  const nativeAlert = window.alert.bind(window);
  window.alert = function (m) {
    if (!document.body) return nativeAlert(m);
    const s = String(m == null ? '' : m);
    const err = /خطأ|فشل|تعذّر|تعذر|لا يمكن|❌|🚫/.test(s);
    modal({ icon: err ? '⚠️' : 'ℹ️', title: err ? 'تنبيه' : 'رسالة', message: s });
  };
  const nativePrompt = window.prompt.bind(window);
  window.prompt = function (m, def) {
    /* أي طلب رابط أثناء العمل = خطأ تصميم؛ نُبلّغ الحارس ونعيد الرابط المزروع إن وُجد */
    const s = String(m || '');
    if (/رابط|url|link/i.test(s)) {
      if (window.GMTBug) GMTBug.add('warn', 'إعداد', 'الصفحة طلبت رابطاً أثناء العمل: ' + s.slice(0, 80), 'يجب أن يُضبط مسبقاً بـgmt-ui.js (LINKS).');
      const guess = LINKS.warranty_create;
      return def || guess;
    }
    return nativePrompt(m, def);
  };

  /* ═══════════ ③ المشاركة — قفل وطابور وتراجع ═══════════ */
  let sharing = false;
  async function share(data) {
    if (sharing) { toast('⏳ هناك مشاركة جارية — انتظر ثانية'); return false; }
    sharing = true;
    try {
      if (navigator.canShare && data.files && !navigator.canShare({ files: data.files })) delete data.files;
      if (navigator.share) { await navigator.share(data); return true; }
      throw new Error('المشاركة غير مدعومة بهذا المتصفح');
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (/abort|cancel/i.test(msg)) return false;            // المستخدم ألغى — ليس خطأ
      /* تراجع: نسخ النص أو تنزيل الصورة */
      try {
        if (data.files && data.files[0]) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(data.files[0]);
          a.download = data.files[0].name || 'gmt.png';
          a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          toast('📥 تعذّرت المشاركة — نُزّلت الصورة بدلاً منها');
        } else if (data.text || data.url) {
          await navigator.clipboard.writeText([data.text, data.url].filter(Boolean).join('\n'));
          toast('📋 تعذّرت المشاركة — نُسخ النص للحافظة');
        }
      } catch (_) { toast('تعذّرت المشاركة: ' + msg.slice(0, 60)); }
      if (window.GMTBug) GMTBug.add('warn', 'مشاركة', 'فشل navigator.share: ' + msg.slice(0, 90), 'فُعّل التراجع التلقائي (نسخ/تنزيل).');
      return false;
    } finally {
      setTimeout(() => { sharing = false; }, 700);   // يمنع «مشاركة سابقة لم تنتهِ»
    }
  }
  /* نلفّ navigator.share نفسه ليستفيد كل الكود القديم بلا تعديل */
  try {
    if (navigator.share) {
      const real = navigator.share.bind(navigator);
      navigator.share = function (d) {
        if (sharing) return Promise.reject(new Error('AbortError: مشاركة جارية'));
        sharing = true;
        return real(d).finally(() => setTimeout(() => { sharing = false; }, 700));
      };
    }
  } catch (_) {}

  window.GMTUI = { modal, toast, share, LINKS, alert: window.alert, confirm: (m) => modal({ icon: '❓', title: 'تأكيد', message: m, cancel: true, okText: 'نعم' }) };

  /* ═══ (٧ ي) روابطُ صفحات الزبون من مصدرٍ واحد ═══
     كانت شهادة الكفالة وصفحة البحث عنها تحملان «https://yourwebsite.com» (نطاقٌ وهميّ لغيرنا — الزبون
     يُرسَل إلى موقعٍ غريب) و«https://instagram.com» العامّ و«#» لمن نحن والوكلاء — أزرارٌ ميّتة أمام الزبون.
     الآن: `data-gmt-link="site#about"` ⇒ الرابط من LINKS، ومفتاحٌ غير معروف ⇒ يُخفى الزرّ لا يبقى ميّتاً. */
  function applyLinks(root) {
    try {
      (root || document).querySelectorAll('[data-gmt-link]').forEach((el) => {
        const [k, h] = String(el.getAttribute('data-gmt-link')).split('#');
        const base = LINKS[k];
        if (!base) { el.style.display = 'none'; return; }
        el.setAttribute('href', base + (h ? '#' + h : ''));
        if (/^https?:/.test(base) && !base.startsWith(BASE)) el.setAttribute('rel', 'noopener');
      });
    } catch (_) {}
  }
  window.GMTUI.applyLinks = applyLinks;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyLinks()); else applyLinks();
})();


/* ── gmt-cache.js ── */
;/* ═══════════════════════════════════════════════════════
   gmt-cache.js — مكتبة التخزين المؤقت المحلي لأنظمة GMT (IndexedDB + وضع عدم الاتصال)
   استُخرجت حرفياً 2026-07-06 من النسخة المدمجة بملف الجرد.
   السبب: Bridge.html يستدعي هذا الملف خارجياً منذ البداية (باستدعاء محمي
   if(window.GMTCache)) لكن الملف لم يكن موجوداً قط — فكان تخزينه المحلي معطلاً بصمت.
   يُرفع جنب Bridge.html. الجرد والمشتريات يبقيان بنسختيهما المدمجتين (لا تعديل عليهما)
   حتى جلسة التوحيد.
   ═══════════════════════════════════════════════════════ */

/* ══ gmt-cache.js (embedded) ══ */
/**
 * gmt-cache.js — مكتبة التخزين المؤقت المحلي لـ GMT Systems
 * تستخدم IndexedDB لتخزين بيانات المنتجات والصور محلياً
 * تدعم وضع عدم الاتصال (Offline Mode)
 * الإصدار: 2.0
 */

(function () {
  'use strict';

  const DB_NAME    = 'gmt_cache_db';
  const DB_VERSION = 3;
  const STORE_DATA = 'gmt_collections';
  const STORE_IMG  = 'gmt_images';
  const STORE_META = 'gmt_meta';

  // ── فتح قاعدة البيانات (مع تخزين الاتصال — singleton) ──────────
  // مهم للأداء: كانت كل عملية قراءة/كتابة تفتح اتصال IndexedDB جديد وما تسكّره،
  // فتتراكم اتصالات مفتوحة وتبطّئ المتصفح تدريجياً لدرجة الحاجة للريفرش. الآن
  // نفتح اتصال واحد ونعيد استخدامه طول الجلسة.
  let _dbConn = null;
  let _dbConnPromise = null;
  function openDB() {
    if (_dbConn) return Promise.resolve(_dbConn);
    if (_dbConnPromise) return _dbConnPromise;
    _dbConnPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        _dbConnPromise = null;
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_DATA)) {
          db.createObjectStore(STORE_DATA, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_IMG)) {
          db.createObjectStore(STORE_IMG, { keyPath: 'url' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      req.onsuccess  = (e) => {
        _dbConn = e.target.result;
        // لو انغلق الاتصال لأي سبب (مثلاً ترقية من تبويب آخر)، نصفّر الكاش ليُعاد فتحه
        _dbConn.onclose = () => { _dbConn = null; _dbConnPromise = null; };
        _dbConn.onversionchange = () => { try { _dbConn.close(); } catch(e){} _dbConn = null; _dbConnPromise = null; };
        resolve(_dbConn);
      };
      req.onerror    = (e) => { _dbConnPromise = null; reject(e.target.error); };
      req.onblocked  = ()  => { _dbConnPromise = null; reject(new Error('IndexedDB blocked')); };
    });
    return _dbConnPromise;
  }

  // ── قراءة من مخزن ────────────────────────────────────────────
  async function dbGet(store, key) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => resolve(null);
      });
    } catch (e) { return null; }
  }

  // ── كتابة في مخزن ────────────────────────────────────────────
  async function dbPut(store, value) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).put(value);
        req.onsuccess = () => resolve(true);
        req.onerror   = () => resolve(false);
      });
    } catch (e) { return false; }
  }

  // ── حذف من مخزن ────────────────────────────────────────────
  async function dbDelete(store, key) {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx  = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror    = () => resolve(false);
      });
    } catch (e) { return false; }
  }

  // ── طلب Supabase مباشر ──────────────────────────────────────
  async function sbRequest(sbConfig, path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(sbConfig.url + path, {
        headers: {
          'apikey': sbConfig.key,
          'Authorization': 'Bearer ' + sbConfig.key,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  // ════════════════════════════════════════════════════════════
  // GMTCache — الكلاس الرئيسي
  // ════════════════════════════════════════════════════════════
  /* ════════════════════════════════════════════════════════════════════════
     🖼️ مخزنُ الصور المشترك  (٧ ي · طلبك: «تحميل الصور يكون عند أوّل تنزيل
     التطبيق، مو عند أوّل زيارة للجرد أو نقطة البيع»)

     كان في النظام مخزنان للصور لا يعرف أحدُهما الآخر:
       • نقطة البيع: gmt_pos_db/product_images — Blob
       • الجرد والمشتريات والأوردرات: gmt_cache_db/gmt_images — نصّ base64 (أكبر بالثلث)
     فالصورة الواحدة تُنزَّل مرّتين وتُحفَظ مرّتين، وكلُّ صفحةٍ كانت تُجري «تحميلها
     الأوّل» الخاصّ بها عند أوّل زيارة — وهذا ما رأيتَه.
     الآن مخزنٌ واحد بصيغة Blob (مخزن نقطة البيع نفسه)، تقرؤه وتكتب فيه كلُّ
     الصفحات، فتنزيلٌ واحد عند التثبيت يكفي النظام كلّه. والمخزن القديم يُقرأ فقط.
     ════════════════════════════════════════════════════════════════════════ */
  const SH_DB = 'gmt_pos_db', SH_IMG = 'product_images';
  let _shConn = null, _shP = null;
  const _objUrl = new Map();            // رابط ⇐ objectURL واحد لكل صورة في الصفحة (بلا تسرّب ذاكرة)
  function openShared() {
    if (_shConn) return Promise.resolve(_shConn);
    if (_shP) return _shP;
    _shP = new Promise((resolve) => {
      let req;
      try { req = indexedDB.open(SH_DB); } catch (e) { _shP = null; resolve(null); return; }
      req.onupgradeneeded = (e) => {
        /* القاعدة غير موجودة بعد ⇒ تُنشأ بمخطّط نقطة البيع حرفاً، فحين تفتحها
           نقطة البيع بنسختها لا تجد ما تُضيفه. (لا نحدّد رقم نسخة: نفتح ما هو موجود
           كي لا نصطدم بنسخةٍ أحدث تُرقّيها نقطة البيع مستقبلاً) */
        const db = e.target.result;
        const mk = (n, o) => { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, o); };
        mk('products', { keyPath: 'id' });
        mk('pending_invoices', { autoIncrement: true, keyPath: '_localId' });
        mk('branches', { keyPath: 'key' });
        mk(SH_IMG, { keyPath: 'url' });
        mk('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SH_IMG)) { try { db.close(); } catch (_) {} _shP = null; resolve(null); return; }
        /* نقطة البيع ترقّي القاعدة ⇒ نُغلق فوراً كي لا نحجبها */
        db.onversionchange = () => { try { db.close(); } catch (_) {} _shConn = null; _shP = null; };
        db.onclose = () => { _shConn = null; _shP = null; };
        _shConn = db; resolve(db);
      };
      req.onerror = () => { _shP = null; resolve(null); };
      req.onblocked = () => { _shP = null; resolve(null); };
    });
    return _shP;
  }
  function shReq(mode, fn) {
    return openShared().then((db) => {
      if (!db) return null;
      return new Promise((res) => {
        try {
          const tx = db.transaction(SH_IMG, mode);
          const rq = fn(tx.objectStore(SH_IMG));
          if (mode === 'readwrite') {
            tx.oncomplete = () => res(true);
            /* امتلاء مساحة الجهاز يُميَّز عن غيره: لا معنى لإعادة المحاولة في كل فتحة */
            tx.onerror = tx.onabort = () => { const n = (tx.error && tx.error.name) || ''; res(/Quota/i.test(n) ? 'quota' : false); };
          }
          else { rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); }
        } catch (_) { res(mode === 'readwrite' ? false : null); }
      });
    }).catch(() => null);
  }
  const shGet  = (url) => shReq('readonly', (o) => o.get(url)).then((r) => (r && r.blob) || null);
  const shPut  = (url, blob) => shReq('readwrite', (o) => o.put({ url, blob, cached_at: Date.now() }));
  const shKeys = () => shReq('readonly', (o) => o.getAllKeys()).then((r) => r || []);
  function asSrc(url, blob) {
    let u = _objUrl.get(url);
    if (!u) { u = URL.createObjectURL(blob); _objUrl.set(url, u); }
    return u;
  }
  /* تنزيلٌ بمهلة — والردّ الذي ليس صورة (صفحة خطأ نصّية) لا يُخزَّن صورةً */
  async function fetchBlob(url) {
    const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const t = setTimeout(() => { try { ctl && ctl.abort(); } catch (_) {} }, 20000);
    try {
      const res = await fetch(url, { mode: 'cors', signal: ctl ? ctl.signal : undefined });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      if (!blob || !blob.size || /^(text\/|application\/json)/i.test(blob.type || '')) throw new Error('الردّ ليس صورة');
      return blob;
    } finally { clearTimeout(t); }
  }
  async function legacyKeys() {
    try {
      const db = await openDB();
      return await new Promise((res) => {
        try { const rq = db.transaction(STORE_IMG, 'readonly').objectStore(STORE_IMG).getAllKeys();
              rq.onsuccess = () => res(rq.result || []); rq.onerror = () => res([]); } catch (_) { res([]); }
      });
    } catch (_) { return []; }
  }

  const GMTCache = {

    /**
     * syncCollection — المزامنة الذكية بين Supabase والكاش المحلي
     * @param {Object} opts
     *   name        — اسم المجموعة (مفتاح الكاش)
     *   table       — اسم جدول Supabase
     *   sbConfig    — { url, key }
     *   liveFields  — حقول تُحدَّث دائماً (الكميات)
     *   imageField  — اسم حقل الصورة
     *   idField     — المعرّف الفريد (افتراضي: 'id')
     * @returns { rows, fromCache, offline }
     */
    async syncCollection({ name, table, sbConfig, liveFields = [], imageField = 'image_url', idField = 'id' }) {
      const cacheKey  = 'col_' + name;
      const metaKey   = 'meta_' + name;
      const CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

      // 1. حاول الجلب من الخادم
      let rows = null;
      let offline = false;

      try {
        // جلب كامل للبيانات من Supabase
        const path = `/rest/v1/${table}?order=${idField}.asc&limit=10000`;
        const fresh = await sbRequest(sbConfig, path);

        if (Array.isArray(fresh)) {
          rows = fresh;

          // حفظ في الكاش مع الطابع الزمني
          await dbPut(STORE_DATA, { key: cacheKey, rows, savedAt: Date.now() });
          await dbPut(STORE_META, { key: metaKey, count: rows.length, updatedAt: Date.now() });

          return { rows, fromCache: false, offline: false };
        }
      } catch (e) {
        // فشل الاتصال — جرّب الكاش
        offline = true;
        console.warn('[GMTCache] Supabase unreachable, using cache:', e.message);
      }

      // 2. إذا فشل الاتصال، استخدم الكاش المحلي
      const cached = await dbGet(STORE_DATA, cacheKey);
      if (cached && Array.isArray(cached.rows) && cached.rows.length > 0) {
        return { rows: cached.rows, fromCache: true, offline: true };
      }

      // 3. لا اتصال ولا كاش
      return { rows: [], fromCache: false, offline: true };
    },

    /**
     * cacheImage — تخزين صورة محلياً كـ Base64 وإعادة Blob URL
     * @param {string} url — رابط الصورة الأصلي
     * @returns {string} — Blob URL محلي أو الرابط الأصلي عند الفشل
     */
    async cacheImage(url) {
      if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url;
      if (_objUrl.has(url)) return _objUrl.get(url);

      // ① المخزن المشترك (Blob) — ما نزل عند التثبيت أو من أيّ صفحة
      const b = await shGet(url);
      if (b) return asSrc(url, b);

      // ② المخزن القديم (base64) — يُقرأ كما هو حتى يُستبدل
      const cached = await dbGet(STORE_IMG, url);
      if (cached && cached.dataUrl) return cached.dataUrl;

      // ③ الشبكة — مرّة واحدة، ثمّ في المخزن المشترك
      try {
        const blob = await fetchBlob(url);
        const ok = await shPut(url, blob);
        if (ok === 'quota') return asSrc(url, blob);           // امتلأت المساحة: نعرضها ولا نحفظها
        if (ok !== true) {
          /* المخزن المشترك غير متاح (متصفّح قديم) ⇒ الطريقة القديمة كما كانت */
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          if (dataUrl.length < 2 * 1024 * 1024) await dbPut(STORE_IMG, { url, dataUrl, cachedAt: Date.now() });
          return dataUrl;
        }
        return asSrc(url, blob);
      } catch (e) {
        return url; // إعادة الرابط الأصلي عند الفشل
      }
    },

    /** cachedImage — من الجهاز فقط (بلا شبكة): رابط عرضٍ إن كانت محفوظة، وإلا null */
    async cachedImage(url) {
      if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url;
      if (_objUrl.has(url)) return _objUrl.get(url);
      const b = await shGet(url);
      if (b) return asSrc(url, b);
      const c = await dbGet(STORE_IMG, url);
      return (c && c.dataUrl) || null;
    },

    /**
     * storeImage — تنزيلٌ وحفظ بلا عرض (للتنزيل الجماعي عند التثبيت)
     * يُعيد 'have' إن كانت محفوظة، و'new' إن نزلت الآن، ويرمي خطأً عند الفشل.
     */
    async storeImage(url) {
      if (!url || !/^https?:/i.test(url)) return 'skip';
      if (await shGet(url)) return 'have';
      const blob = await fetchBlob(url);
      const put = await shPut(url, blob);
      if (put === 'quota') { const e = new Error('مساحة الجهاز امتلأت'); e.code = 'quota'; throw e; }
      if (put !== true) throw new Error('تعذّر الحفظ على الجهاز');
      return 'new';
    },

    /** imageKeys — كلّ الصور المحفوظة على الجهاز (المشترك + القديم) */
    async imageKeys() {
      const a = await shKeys(), b = await legacyKeys();
      return new Set([].concat(a || [], b || []));
    },

    /**
     * posPrefill — (٧ ي) تجهيز منتجات نقطة البيع من خلف الانترو
     * تكتب المنتجات في مخزن نقطة البيع **فقط إن لم تُزامِن نقطة البيع بعد** على هذا
     * الجهاز — فلا تمسّ بياناتٍ أحدث. ونقطة البيع حين تُفتح تُكمل الباقي بنفسها:
     * الكميّات المتغيّرة منذ `syncAt` والعروض.
     */
    async posPrefill(rows, syncAt) {
      if (!Array.isArray(rows) || !rows.length) return false;
      const db = await openShared();
      if (!db || !db.objectStoreNames.contains('products') || !db.objectStoreNames.contains('meta')) return false;
      const had = await new Promise((res) => {
        try { const rq = db.transaction('meta', 'readonly').objectStore('meta').get('last_products_sync');
              rq.onsuccess = () => res(!!(rq.result && rq.result.value)); rq.onerror = () => res(true); } catch (_) { res(true); }
      });
      if (had) return false;
      return await new Promise((res) => {
        try {
          const tx = db.transaction(['products', 'meta'], 'readwrite');
          const ps = tx.objectStore('products'); ps.clear();
          const now = Date.now();
          rows.forEach((p) => { if (p && p.id != null) ps.put(Object.assign({}, p, { _cached_at: now })); });
          tx.objectStore('meta').put({ key: 'last_products_sync', value: syncAt || new Date(now).toISOString() });
          tx.objectStore('meta').put({ key: 'prefilled_by', value: 'home-intro' });
          tx.oncomplete = () => res(true); tx.onerror = tx.onabort = () => res(false);
        } catch (_) { res(false); }
      });
    },

    /** replaceCollection — استبدالٌ كامل لمجموعة (لا دمج: المحذوف من القاعدة يُحذف هنا) */
    async replaceCollection(name, rows) {
      if (!Array.isArray(rows)) return false;
      await dbPut(STORE_DATA, { key: 'col_' + name, rows, savedAt: Date.now() });
      await dbPut(STORE_META, { key: 'meta_' + name, count: rows.length, updatedAt: Date.now() });
      return true;
    },

    /**
     * bulkPut — تحديث مجموعة من السجلات في الكاش دفعةً
     * @param {string} name   — اسم المجموعة
     * @param {Array}  items  — السجلات المراد تحديثها
     */
    async bulkPut(name, items) {
      if (!items || !items.length) return;
      const cacheKey = 'col_' + name;

      const cached = await dbGet(STORE_DATA, cacheKey);
      let rows = (cached && Array.isArray(cached.rows)) ? [...cached.rows] : [];

      // دمج/تحديث السجلات — (٧ ط) بفهرسٍ لا ببحثٍ خطّي: ٢٠٠٠ منتج كانت ٤ ملايين مقارنة (~٤٠٠ms تجميد)
      const at = new Map();
      rows.forEach((r, k) => { if (r && r.id != null) at.set(String(r.id), k); });
      items.forEach(item => {
        const k = item && item.id != null ? at.get(String(item.id)) : undefined;
        if (k !== undefined) {
          rows[k] = { ...rows[k], ...item };
        } else {
          at.set(String(item && item.id), rows.length);
          rows.push(item);
        }
      });

      await dbPut(STORE_DATA, { key: cacheKey, rows, savedAt: Date.now() });
    },

    /**
     * invalidate — مسح كاش مجموعة معينة لإجبار إعادة التحميل
     * @param {string} name — اسم المجموعة
     */
    async invalidate(name) {
      await dbDelete(STORE_DATA, 'col_' + name);
      await dbDelete(STORE_META, 'meta_' + name);
    },

    /**
     * clearAll — مسح كل الكاش
     */
    async clearAll() {
      try {
        const db = await openDB();
        [STORE_DATA, STORE_IMG, STORE_META].forEach(store => {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).clear();
        });
        try { await shReq('readwrite', (o) => o.clear()); } catch (_) {}
        _objUrl.clear();
        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * getStats — إحصائيات الكاش
     */
    async getStats() {
      try {
        const db = await openDB();
        const counts = {};
        for (const store of [STORE_DATA, STORE_IMG, STORE_META]) {
          counts[store] = await new Promise(resolve => {
            const tx  = db.transaction(store, 'readonly');
            const req = tx.objectStore(store).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => resolve(0);
          });
        }
        try { counts.shared_images = (await shKeys()).length; } catch (_) {}
        return counts;
      } catch (e) {
        return {};
      }
    }
  };

  // ── تصدير عالمي ─────────────────────────────────────────────
  window.GMTCache = GMTCache;

  // ── تشخيص سريع عند التحميل ──────────────────────────────────
  (async function () {
    try {
      await openDB();
      console.log('[GMTCache] ✅ IndexedDB جاهز');
    } catch (e) {
      console.warn('[GMTCache] ⚠️ IndexedDB غير متاح — سيعمل النظام بدون تخزين محلي:', e.message);
      // Fallback: In-memory cache only
      const _memCache = {};
      window.GMTCache = {
        async syncCollection({ name, table, sbConfig }) {
          const cacheKey = 'col_' + name;
          try {
            const path = `/rest/v1/${table}?order=id.asc&limit=10000`;
            const rows = await sbRequest(sbConfig, path);
            if (Array.isArray(rows)) {
              _memCache[cacheKey] = rows;
              return { rows, fromCache: false, offline: false };
            }
          } catch (err) {
            if (_memCache[cacheKey]) {
              return { rows: _memCache[cacheKey], fromCache: true, offline: true };
            }
          }
          return { rows: [], fromCache: false, offline: true };
        },
        async cacheImage(url) { return url; },
        async storeImage() { throw new Error('التخزين المحلي غير متاح في هذا المتصفّح'); },
        async cachedImage() { return null; },
        async imageKeys() { return new Set(); },
        async posPrefill() { return false; },
        async replaceCollection(name, rows) { _memCache['col_' + name] = rows; return true; },
        async bulkPut(name, items) {
          const key = 'col_' + name;
          if (!_memCache[key]) _memCache[key] = [];
          items.forEach(item => {
            const idx = _memCache[key].findIndex(r => String(r.id) === String(item.id));
            if (idx >= 0) _memCache[key][idx] = { ..._memCache[key][idx], ...item };
            else _memCache[key].push(item);
          });
        },
        async invalidate(name) { delete _memCache['col_' + name]; },
        async clearAll() { Object.keys(_memCache).forEach(k => delete _memCache[k]); },
        async getStats() { return { memory: Object.keys(_memCache).length }; }
      };
    }
  })();

})();


/* ── gmt-features.js ── */
;/* ═══════════════════════════════════════════════════════════════════════════
   gmt-features.js — 📚 سجل الميزات المركزي (Feature Registry) · v1.0 · 2026-07-17
   ─────────────────────────────────────────────────────────────────────────
   الفكرة (طلب المالك): تحويل البوتات من «أدوات منفصلة» إلى «نظام مراقبة واحد
   يفهم النظام». هذا الملف هو **مصدر المعرفة الموحّد**:
     • كل ميزة + ماذا تفعل + آلية عملها + كيف انبنت + كيف تُراقَب.
   تقرأه كل البوتات (الحارس · المفتّش · الفاحص الذاتي · التعليمي) ليعرفوا
   *ما يُفترض أن يحدث* فيكشفوا *ما لا يحدث*.

   ⚠️ هذا **ملف بيانات نقي** — لا منطق، لا يلمس أي كود قائم. آمن تماماً.
   إضافته لا تكسر شيئاً؛ البوتات تقرأه إن وُجد، وتعمل عادةً إن غاب.

   البنية لكل ميزة:
     id       : رمز البند الموثّق (PUR-1 …)
     title    : اسم مقروء
     what     : ماذا تفعل (بلغة المستخدم)
     how      : آلية عملها (تقنياً — للبوتات والمطوّر)
     built    : كيف انبنت / أين بالكود (للمراقبة والصيانة)
     watch    : كيف يراقبها الحارس/المفتّش (توقيع النجاح/الفشل)
     status   : done | partial | pending | conflict
     severity : لو مكسورة، خطورتها
     page     : الصفحة المعنية
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  window.GMT_FEATURES = [
    /* ─────────── المشتريات ─────────── */
    {
      id: 'PUR-1', title: 'منع مضاعفة الكميات', status: 'done', severity: 'critical', page: 'المشتريات',
      what: 'كل فاتورة شراء تُدخل الكمية مرة واحدة، لا مرتين.',
      how: 'مصدر واحد لكتابة الكميات هو syncTransitToInv الذي يعيد قراءة القيمة للتحقق. حُذفت الحلقة المكررة القديمة.',
      built: '06_المشتريات.html — syncTransitToInv (~2684). حُذفت حلقتا التعديل عند 2582–2603.',
      watch: 'المفتّش يكشف «كتابة مزدوجة» (نفس PATCH على نفس الصف خلال 3ث). لوحة التدقيق تكشف «زيادة غير مبرَّرة».'
    },
    {
      id: 'PUR-2', title: 'الترحيل الآمن + فكّ الختم', status: 'done', severity: 'critical', page: 'المشتريات',
      what: 'لا تُختم الفاتورة «واصلة» إلا بوصول كل القطع فعلياً. ويمكن فكّ ختم فاتورة خُتمت خطأً.',
      how: 'transfer_moved يتتبّع المُرحَّل فعلياً؛ الختم مشروط بمطابقة المُرحَّل للمطلوب. فكّ الختم يعيد الحالة لـtransit.',
      built: '06_المشتريات.html — markArrived/openArrivalModal/executeArrival. عمود transfer_moved بالقاعدة.',
      watch: 'الفاحص الذاتي: «فواتير مختومة لم تصل كمياتها». لوحة التدقيق: sealedNotMoved.'
    },
    {
      id: 'PUR-6', title: 'اختيار فرع الوجهة + ترحيل جزئي', status: 'done', severity: 'high', page: 'المشتريات',
      what: 'عند الوصول، تختار الفرع والكمية لكل صنف، ويمكن ترحيل جزء وإكمال الباقي لاحقاً.',
      how: 'نافذة openArrivalModal تعرض فروع الوجهة والكميات؛ الترحيل الجزئي يُسجَّل بـtransfer_moved بلا تكرار.',
      built: '06_المشتريات.html — openArrivalModal.',
      watch: 'المفتّش يسجّل خطوات الترحيل؛ عدم اتساق يظهر بلوحة التدقيق.'
    },
    {
      id: 'PUR-7', title: 'توزيع المصاريف على التكلفة', status: 'done', severity: 'high', page: 'المشتريات',
      what: 'الشحن والجمارك تُوزَّع على القطع بالتناسب مع قيمتها ⇒ تكلفة واصلة حقيقية.',
      how: 'computeLandedCosts يوزّع المصاريف نسبةً لقيمة كل سطر ويكتب cost_price = التكلفة الواصلة.',
      built: '06_المشتريات.html — computeLandedCosts + landed_cost بالـsnapshot.',
      watch: 'لا مراقبة آلية مباشرة — يُدقَّق يدوياً عبر تقرير العمولات.'
    },
    {
      id: 'PUR-4', title: 'مسودة الفاتورة المحلية', status: 'done', severity: 'medium', page: 'المشتريات',
      what: 'الفاتورة تُحفظ بالجهاز أثناء الكتابة؛ انقطاع النت لا يُضيّعها.',
      how: 'بوت GMTDraft (gmt-staff) يحفظ بـIndexedDB كل 4ث ويعرض الاستعادة عند العودة. يقرأ window.cart/invType/editId.',
      built: '✅ اكتمل فعلياً (2026-08-03): البوت كان موجوداً لكنه معطّل — الصفحة تصرّح cart بـlet (لا تُعلَّق على window) فكان snapshot يرجع null دائماً. صُحّح: cart/invType/editId على window (var).', watch: 'ما قد يفشل: لو أُعيد cart إلى let تنكسر المسودة. جرّب: اكتب فاتورة، أغلق التبويب، أعد الفتح ⇒ يجب أن تُعرض الاستعادة.'
    },

    /* ─────────── الجرد ─────────── */
    {
      id: 'INV-5', title: 'حماية تعديل الكمية اليدوي', status: 'done', severity: 'critical', page: 'الجرد',
      what: 'تعديل الكمية يدوياً يتطلب صلاحية سيادية + سبب إجباري + تسجيل.',
      how: 'المودال: حقول الكمية readonly إلا للسيادي. الجدول (startInlineEdit): بوّابة gmt_qty_unlock نفسها + تسجيل السبب بالمراقب.',
      built: '✅ اكتمل (2026-08-03): كان مسار الجدول (دابل-كليك) يتخطّى الحماية — أُغلق. الآن المساران محميّان + كل تعديل يُسجَّل بالسبب (rule OWN-QTY-MANUAL).',
      watch: 'ما قد يفشل: أي PATCH على عمود فرع في products بلا فكّ قفل سيادي = انتهاك INV-5 — يجب أن يرصده المفتّش. تحقّق أن التعديل بلا سبب مسجَّل لا يمرّ.'
    },
    {
      id: 'INV-6', title: 'قفل سعر الشراء بالجرد', status: 'done', severity: 'medium', page: 'الجرد',
      what: 'سعر الشراء لا يُعدَّل من الجرد — من فاتورة الاستيراد فقط (يحمي العمولات).',
      how: 'حقل cost_price مقفل بواجهة تعديل المنتج.',
      built: '03_الجرد.html — تعديل المنتج.', watch: 'المفتّش يكشف أي PATCH على cost_price من الجرد.'
    },
    {
      id: 'INV-9', title: 'لوحة التدقيق الذكية', status: 'done', severity: 'high', page: 'الجرد',
      what: 'تكشف 3 تناقضات: زيادة غير مبرَّرة · فواتير مختومة لم تصل · «بالطريق» بلا رصيد.',
      how: 'gmt-integrity.js يقارن مجموع الفواتير بالمخزون الفعلي ويُخرج الفروق.',
      built: 'gmt-integrity.js — stockGaps/sealedNotMoved/transitMissing.',
      watch: 'هذه الميزة نفسها أداة مراقبة — الفاحص الذاتي يستدعي منطقها.'
    },
    {
      id: 'INV-2', title: 'استيراد Excel', status: 'done', severity: 'medium', page: 'الجرد',
      what: 'قراءة ملف Excel ومطابقة المنتجات بالباركود.',
      how: 'مكتبة SheetJS (كانت غير محمّلة — أُصلح).',
      built: '03_الجرد.html + xlsx.', watch: 'الفاحص الذاتي يتحقق من تحميل المكتبة.'
    },
    {
      id: 'INV-3', title: 'طابعة الملصقات', status: 'done', severity: 'low', page: 'الجرد',
      what: 'بطاقات باركود + QR للمنتجات.',
      how: 'صفحة مستقلة طابعة_الملصقات.html.',
      built: '✅ الصفحة موجودة. أُصلح رابط الزر (2026-08-03): كان يشير لاسم قديم 18_طابعة_الملصقات.html.', watch: 'الفاحص يتحقق من وجود الملف.'
    },
    {
      id: 'INV-8', title: 'فرز المنتجات القديمة', status: 'done', severity: 'medium', page: 'الجرد',
      what: 'منتجات موجودة بلا فاتورة شراء ⇒ فاتورة أثرية تُرضي التدقيق دون لمس الكميات.',
      how: 'أداة بقائمة «المزيد» تُنشئ import_log بحالة arrived + transferred=true + transfer_moved يغطّي الكمية. التكلفة من cost_price المسجّل.',
      built: '✅ بُنيت (2026-08-03) في الجرد.html — مودال ath-modal + منطق مكتفٍ بذاته. لا تعدّل جدول products إطلاقاً.', watch: 'المراقب: يجب ألّا تتغيّر أي كمية بعد الفرز. التدقيق (inv_no_items) يجب أن ينقص.'
    },

    /* ─────────── نقطة البيع ─────────── */
    {
      id: 'POS-1', title: 'المرتجع', status: 'done', severity: 'high', page: 'نقطة البيع',
      what: 'إرجاع صنف يعيده للمخزون ويعكس العمولة.',
      how: 'أعمدة original_invoice_id/is_refund/refund_reason (معرّفة في _SQL/1️⃣) + إعادة المخزون عبر increment_branch_stock (_SQL/🔟).',
      built: '✅ العمود موجود بالمخطط الأساسي، والكود يفشل فشلاً ناعماً بلا تجميد إن غاب. لا يحتاج الملف الوهمي GMT_POS_FIXES.', watch: 'الفاحص يتحقق من فحص الإرجاعات السابقة.'
    },
    {
      id: 'POS-4', title: 'صلاحية البيع تحت التكلفة', status: 'done', severity: 'high', page: 'نقطة البيع',
      what: 'ممنوع البيع تحت سعر التكلفة (net_cost) على الكل، إلا: جهاز حلب (الشريك) · دور أدمن/سيادي · العروض المُسعّرة مسبقاً · الكوبونات على الإجمالي.',
      how: 'حارس موحّد gmtPriceGuard يُستدعى من كل مسارات تغيير السعر. gmtCanSellBelowCost = أدمن أو حلب.',
      built: '✅ أُصلح (2026-07-17): وُحّدت المسارات على gmtPriceGuard. updPriceCart يمنع ويُرجع السعر ويبلّغ المراقب. changePreviewPrice يمنع أصلاً.',
      watch: 'المراقب يسجّل كل محاولة بيع تحت التكلفة محظورة (OWN-BELOW-COST).'
    },
    {
      id: 'POS-ATOMIC', title: 'الخصم الذرّي للمخزون', status: 'ready', severity: 'critical', page: 'نقطة البيع',
      what: 'خصم المخزون بأمان يمنع ضياع كمية عند بيعين متزامنين.',
      how: 'RPC ذرّية decrement_branch_stock/increment_branch_stock (قفل صف FOR UPDATE) — تُرجعان الكمية الجديدة. عند تعذّر الاتصال فقط ترجع لـread-then-write.',
      built: '✅ حُلّ جذرياً (2026-08-03): أُنشئت الدالتان الذرّيتان في _SQL/🔟_دوال_المخزون_الموحّدة.sql (كانتا غير معرّفتين والملف GMT_POS_FIXES.sql وهمياً). add/deduct صارتا غلافَي توافق. يصبح ok فور تشغيل 🔟 على القاعدة.',
      watch: 'المراقب يسجّل استخدام fallback فقط عند انقطاع الشبكة (بعد تشغيل 🔟 يجب أن يختفي atomic_fallback).'
    },

    /* ─────────── الأدمن والعمولات ─────────── */
    {
      id: 'ADM-4', title: 'لا حذف نهائي للسجلّات المالية (إبطال بأثر)', status: 'done', severity: 'high', page: 'أدمن نقاط البيع',
      what: 'السجلّات المالية لا تُحذف نهائياً — تُبطَل/تُصفَّر مع من ومتى ولماذا، وتبقى للتدقيق.',
      how: 'العمولات: zeroComm (سبب إجباري + zeroed_by/at/reason). الديون والمصاريف: إبطال voided+void_reason/by/at (سبب إجباري) وتُخفى من القائمة — _SQL/1️⃣2️⃣.',
      built: '✅ العمولات + الديون + المصاريف (2026-08-03). ⏳ متبقٍّ: فاتورة الشراء import_log بالمشتريات ما زالت حذفاً نهائياً (مع نسخة احتياطية JSON) — يُحوَّل لإبطال بمتابعة.',
      watch: 'ما قد يفشل: أي DELETE مباشر على gmt_manual_debts/gmt_expenses/invoice_commissions = انتهاك ADM-4. يجب أن يرصده المفتّش. تحقّق أن الإبطال يكتب سبباً.'
    },
    {
      id: 'POS-PROFIT', title: 'رقم ربح الكاشير بالسجل', status: 'done', severity: 'low', page: 'نقطة البيع',
      what: 'كل فاتورة بسجل الكاشير تعرض ربحه برقم كبير معزول. شفافيته تعكس المراجعة: واضح=معتمدة · شبه شفاف=قيد المراجعة.',
      how: 'inv._comm_amount + gmtCommState. opacity حسب الحالة.',
      built: '✅ أُضيف (2026-07-17) بـrenderInvoiceHistory. الكاشير يرى ربحه، الأدمن يرى ربح الشركة.',
      watch: 'لا مراقبة — عرض للكاشير.'
    },
    {
      id: 'ADM-PROFIT', title: 'تصنيف ربح الفاتورة (لون)', status: 'done', severity: 'medium', page: 'أدمن نقاط البيع',
      what: 'لون الفاتورة عند الأدمن يعكس ربح الشركة الحقيقي = (سعر البيع − سعر الشراء) − العمولة، لكل قطعة.',
      how: 'estimateProfitClass تحسب من inv.items بدقة (لا من فرضية العمولة×2). أحمر=لا ربح · أخضر=ربح جيد.',
      built: '✅ أُصلح M-1 (2026-07-17): استبدال الفرضية بالحساب الحقيقي. الكاشير يرى ربحه (نصف فرق الجملة)، الأدمن يرى ربح الشركة.',
      watch: 'المراقب يمكنه رصد تصنيف ربح شاذّ.'
    },
    {
      id: 'ADM-1', title: 'زر الجولة التعليمية', status: 'done', severity: 'medium', page: 'أدمن نقاط البيع',
      what: 'زر يفتح النظام التعليمي (كان ميتاً).',
      how: 'restartTour يفتح gmt-guide.', built: '04_أدمن — restartTour.', watch: 'الفاحص يتحقق من تعريف الدالة.'
    },
    {
      id: 'SETTLE', title: 'التسويات ومنع التحصيل المزدوج', status: 'done', severity: 'high', page: 'التسويات',
      what: 'كل عمولة تُدفع تُختم برقم تسوية لمنع دفعها مرتين. وحساب صندوق كل فرع.',
      how: 'gmt-settlements.js: compute يفصل المُعلّق/المستحق/المدفوع؛ stampPay يختم بـpaid=true.',
      built: '✅ الصندوق صحيح (cashBox = sales − moved = الموجود حالياً، تحقّق 2026-07-17). يبقى H-1: الختم يعتمد فلترة بالذاكرة لا WHERE paid=false بالقاعdة.',
      watch: 'المفتّش يرصد ختم عمولة مدفوعة مسبقاً.',
      note: 'C-3 كان إنذاراً كاذباً — الصندوق يعرض الموجود فعلاً. يبقى H-1 (idempotency).'
    },

    /* ─────────── الأوردرات ─────────── */
    {
      id: 'ORD-1', title: 'رسائل تيليغرام للأوردرات', status: 'done', severity: 'medium', page: 'الأوردرات',
      what: 'تحديث الطلب يعدّل رسالة تيليغرام بدل إرسال جديدة.',
      how: 'عمود tg_msg_id يخزّن معرّف الرسالة.',
      built: 'gmt_orders.tg_msg_id (SQL) + منطق الأوردرات.', watch: 'المفتّش يرصد فشل تحديث تيليغرام.'
    },
    {
      id: 'ORD-2', title: 'عدّاد أرقام الأوردرات', status: 'done', severity: 'critical', page: 'الأوردرات',
      what: 'كل أوردر يأخذ رقماً تسلسلياً فريداً.',
      how: 'RPC increment_settings_counter بقفل for update (نسخة ORDERS_FIXES).',
      built: '✅ أُصلح (2026-07-17): نسخة واحدة بعمود value + قفل for update + DROP تلقائي. نسخة MASTER الخاطئة أُزيلت.',
      watch: 'الفاحص الذاتي يتحقق من استجابة الدالة (probe-counter).'
    },
    {
      id: 'ORD-5', title: 'مساءلة الأوردرات', status: 'done', severity: 'high', page: 'الأوردرات',
      what: 'من أنشأ/عدّل/حذف كل طلب + حذف ناعم + سجل تدقيق.',
      how: 'created_by/deleted_at + audit_log.',
      built: 'gmt_orders (SQL) + منطق الأوردرات.', watch: 'المفتّش يتحقق أن كل حذف يكتب deleted_by.'
    },
    {
      id: 'ORD-6', title: 'متابعة الطلبات المتأخرة', status: 'done', severity: 'medium', page: 'الأوردرات',
      what: 'أي طلب غير مكتمل تجاوز 5 أيام يظهر بقائمة المتابعة.',
      how: 'فلترة بالحالة والتاريخ.', built: '05_الأوردرات.html.', watch: 'ميزة عرض — لا مراقبة.'
    },

    /* ─────────── الكفالة والتتبّع ─────────── */
    {
      id: 'STORE-COUPON', title: 'الكوبونات بالمتجر', status: 'done', severity: 'medium', page: 'المتجر · نقطة البيع',
      what: 'الزبون يطبّق كوبونه بالمتجر فوراً؛ عند تحويل الأوردر لفاتورة كاشير ينتقل الكوبون مع الاسم والرقم ويُختم هناك.',
      how: 'validateStoreCoupon بالمتجر يحفظ coupon بالأوردر. selectExistingOrder بنقطة البيع ينقله لحقل الكوبون. markCouponUsedInPOS يختمه عند الحفظ.',
      built: '✅ أُضيف (2026-07-17). الكوبون يُختم مرة واحدة فقط (عند فاتورة الكاشير، لا المتجر). ختم **ذرّي مشروط** (2026-08-04): يُمنع الاستهلاك المزدوج عند بيعين متزامنين.',
      watch: 'ما قد يفشل: سباق استهلاك. المراقب يرصد «كوبون استُعمل مرّتين» (OWN-COUPON-ONCE) إن فشل الختم الذرّي.'
    },
    {
      id: 'BRIDGE-LINK', title: 'ربط الجرد بالمتجر (الجسر)', status: 'done', severity: 'medium', page: 'الجسر',
      what: 'أداة موحّدة تربط منتجات الجرد بمنتجات المتجر عبر الباركود، مع مزامنة سعر وفروقات.',
      how: 'الجسر (3 تبويبات) هو المصدر الوحيد للربط اليدوي؛ الجرد يفوّض إليه عبر openBridgeTool. الربط يكتب barcode+price بالمتجر و store_url+price بالجرد.',
      built: '✅ موحّد. متبقٍّ dedup: مزامنة السعر (syncPriceToStore بالجرد ↔ msSyncPrice بالجسر) توحَّد لاحقاً (R5).',
      watch: 'ما قد يفشل: تحديث المتجر يعيد كتابة الكتالوج كله (نموذج بيانات المتجر — انظر STORE-MODEL).'
    },
    {
      id: 'STORE-MODEL', title: '⚠️ نموذج بيانات المتجر (توسّع)', status: 'conflict', severity: 'critical', page: 'المتجر · الجسر',
      what: 'المتجر يجب أن يتوسّع لآلاف المنتجات دون فقدان بيانات.',
      how: 'المطلوب: جدول منتجات (صفّ لكل منتج) مع كتابة ذرّية للصف المتغيّر فقط.',
      built: '⚠️ الحالي: كامل الكتالوج في صفٍّ واحد JSON (store?id=eq.1). كل كتابة تعيد كتابة الكل ⇒ لا يتوسّع + آخر-كتابة-تفوز (ضياع بيانات متزامنة).',
      watch: 'بند كبير R-STORE-MODEL — يُناقش عند مراجعة المتجر. يفرضه الدستور (التوسّع).'
    },
    {
      id: 'BACKUP-FULL', title: 'الاستعادة الكاملة', status: 'done', severity: 'high', page: 'النسخ الاحتياطي',
      what: 'من نسخة احتياطية إلى نظام شغّال فوراً: ملفات بنية كاملة لكل قاعدة + استعادة البيانات.',
      how: 'مجلد 07_SQL_استعادة_كاملة فيه بنية كل قاعدة موحّدة بالترتيب الصحيح. النسخة تحوي البيانات + دليل.',
      built: '✅ أُضيف (2026-07-17). البنية (SQL) + البيانات (النسخة) = نظام فوري. البديل الأضمن: Supabase Backups.',
      watch: 'الفاحص الذاتي يتحقق من اكتمال الجداول بعد الاستعادة.'
    },
    {
      id: 'WAR-1', title: 'الكفالة الجديدة', status: 'done', severity: 'high', page: 'إنشاء الكفالة',
      what: 'نظام كفالة كامل: 3 باقات · تفعيل بتوقيع بيومتري · PDF · تيليغرام.',
      how: 'نُسخ حرفياً من ملف المالك القديم + أُضيف الحارس والهوية فقط (صفحة زبون).',
      built: '10_إنشاء_الكفالة.html (2170 سطر). brand + bugcatcher فقط.',
      watch: 'الحارس يرصد أخطاء الزبون. ⚠️ توكن تيليغرام مكشوف بالكود (H-4).'
    },
    {
      id: 'WAR-2', title: 'البحث بالرقم التسلسلي', status: 'done', severity: 'medium', page: 'بحث الكفالة',
      what: 'الزبون يبحث بالرقم أو الفاتورة أو التسلسلي.',
      how: 'استعلام بثلاثة مفاتيح.', built: '12_بحث_الكفالة.html.', watch: 'الحارس يرصد أخطاء البحث.'
    },
    {
      id: 'TRK-1', title: 'تتبّع الشحنة', status: 'done', severity: 'medium', page: 'تتبع الشحنة',
      what: 'الزبون يتتبّع شحنته برقمها.',
      how: 'ربط برقم الشحنة من الأوردر.', built: '16_تتبع_الشحنة.html.', watch: 'الحارس فقط.'
    },

    /* ─────────── الأمان ─────────── */
    {
      id: 'SEC-1', title: 'حماية RLS على القاعدة', status: 'done', severity: 'critical', page: 'كل النظام',
      what: 'قاعدة البيانات تمنع الحذف وتضبط القراءة/الكتابة بمفتاح anon.',
      how: 'حلقة تفعّل RLS على الجداول الأساسية بسياسات read/write/edit بلا delete.',
      built: '⚠️ GMT_MASTER_SCHEMA — لكن يفعّل RLS على audit_log الذي يُنشأ بملف آخر (ACCOUNTING_GUARDS). لو شُغّل بترتيب خاطئ، audit_log بلا حماية.',
      watch: 'الفاحص الذاتي: اختبار كتابة حقيقي يكشف صمت RLS.',
      note: 'SQL-2 مُصلح: الترتيب موثّق بخطة تشغيل SQL.'
    },
    {
      id: 'SEC-SOV', title: 'حراسة الأدمن السيادي', status: 'conflict', severity: 'critical', page: 'الأدمن السيادي',
      what: 'أعلى صلاحية بالنظام يجب أن تكون محميّة بحاجز حقيقي.',
      how: 'المفترض: تحقق على القاعدة (RLS/دور).',
      built: '⚠️ 13_الأدمن_السيادي.html:199 — كلمة سر افتراضية 0000، client-side، قابلة للتجاوز من F12.',
      watch: 'يجب نقل الحراسة للقاعdة. الفاحص يحذّر من الاعتماد على القفل الحالي.',
      note: 'C-1: أخطر ثغرة أمنية.'
    },

    /* ─────────── البوتات نفسها ─────────── */
    {
      id: 'BOT-2', title: 'الحارس (جامع الأخطاء)', status: 'done', severity: 'high', page: 'كل النظام',
      what: 'كل خطأ يحدث لأي مستخدم يصل الإدارة تلقائياً، صامت للكاشير.',
      how: 'يعترض onerror/unhandledrejection/fetch ويرسل لـerror_log.',
      built: 'gmt-bugcatcher.js.', watch: 'هو أداة المراقبة نفسها.'
    },
    {
      id: 'BOT-3', title: 'المفتّش (الأخطاء الصامتة)', status: 'done', severity: 'high', page: 'كل النظام',
      what: 'يكشف: زر بلا أثر · كتابة لم تُطبَّق · كتابة مزدوجة · بطء · ميزات لم تُجرَّب.',
      how: 'يبصم الصفحة قبل/بعد الضغط، ويعيد قراءة الكتابات للتحقق. يقرأ GMT_FEATURES للتغطية.',
      built: 'gmt-inspector.js.', watch: 'هو أداة المراقبة نفسها.'
    },
    {
      id: 'BOT-SELFTEST', title: 'الفاحص الذاتي', status: 'done', severity: 'high', page: 'كل النظام',
      what: 'يشغّل 30+ فحصاً على القاعدة والصلاحيات والمخزون ويقول ماذا تفعل.',
      how: 'يفحص وجود الأعمدة/الجداول + اختبار كتابة + سلامة المخزون.',
      built: 'gmt-selftest.js.', watch: 'يقرأ هذا السجل ليعرف ما يفحص.'
    },
    {
      id: 'SEC-XSS', title: 'تنظيف مدخلات المستخدم (XSS)', status: 'done', severity: 'medium', page: 'المتجر · نقطة البيع',
      what: 'كل ما يُدخله المستخدم (اسم منتج، بحث الزبون، ملاحظات، سبب) يُنظَّف قبل عرضه.',
      how: 'دوال escHtml/escH/eh تُطبَّق على كل innerHTML يدمج مدخلات.',
      built: 'أُصلح M-2 (2026-07-17): نُظّف بحث الزبون واسم المنتج بالمتجر + سبب التصفير.',
      watch: 'الحارس يرصد أخطاء runtime.'
    },
    {
      id: 'BOT-AUTOTEST', title: 'الفاحص الشامل الآلي', status: 'done', severity: 'high', page: 'كل النظام',
      what: 'يشغّل النظام كله كأنه مستخدم: يجرّب كل زر · كل معاينة رقمية · كل طباعة · كل شكل، ويسجّل النتائج.',
      how: 'يفرض الوضع التدريبي (حاجز مزدوج) ثم يضغط كل زر ويقارن الحالة قبل/بعد. الأزرار الخطيرة بحاجز ثلاثي.',
      built: 'gmt-autotest.js. تلقائي بعد كل نشر + زر يدوي 🤖. يقرأ سجل الميزات ليحكم على منطقية النتائج.',
      watch: 'يبلّغ المراقب السيادي بكل زر ميت أو نتيجة شاذّة.'
    },
    {
      id: 'INSPECTOR-CENTER', title: 'مركز الفحص الشامل', status: 'done', severity: 'high', page: 'مركز الفحص',
      what: 'زر واحد يفتح كل صفحة داخل إطار ويفحصها آلياً: كل زر · رابط · صورة · حقل · التنسيق (تراكب/طفح/خارج الشاشة) · أخطاء الكونسول · تنسيق العقود.',
      how: 'صفحة 21_مركز_الفحص_الشامل.html — تفتح 18 صفحة تباعاً بـiframe (نفس الموقع = وصول كامل) وتجمع تقريراً موحّداً قابلاً للنسخ.',
      built: '✅ أُضيف (2026-07-20) بطلب المالك: أداة مركزية تراجع الملفات صفحة صفحة زرّاً زرّاً.',
      watch: 'تكشف الأزرار الميتة والتنسيق المكسور والصور المفقودة عبر كل الصفحات.'
    },
    {
      id: 'KNOWLEDGE-CENTER', title: 'مركز المعرفة الموحّد', status: 'done', severity: 'high', page: 'مركز المعرفة',
      what: 'ملف واحد ينتشر مع النظام يحوي كل شيء: البوتات · التعليم · التجريب · تقارير الأخطاء · التوثيق · سجل التعديلات · دليل المستخدم · السجلات.',
      how: 'يقرأ سجل الميزات وقواعد المالك حيّاً، ويجمع كل التوثيق بتبويبات. يشغّل الاختبارات والتقارير مباشرة.',
      built: '✅ أُضيف ومُقوّى (2026-07-17): 20_مركز_المعرفة.html — يقرأ كل التقارير والدليل والسجلات فعلياً (fetch) + التوثيق منشور بجانبه. 9 تبويبات.',
      watch: 'يعرض حالة كل ميزة وكل تقرير حيّاً، ويقرأ الملفات مباشرة.'
    },
    {
      id: 'BOT-INTEGRATION', title: 'اختبارات الترابط', status: 'done', severity: 'high', page: 'كل النظام',
      what: 'يفحص تدفّق البيانات بين الوحدات: المشتريات→الجرد · الجرد→المتجر · البيع→العمولة · العمولة→التسوية · الأوردر→الفاتورة · الكوبون(المتجر→الكاشير) · الكفالة→الفاتورة.',
      how: 'كل ترابط له فحص يقرأ القاعدتين المعنيّتين ويتأكد أن البيانات متّسقة. الترابط المكسور يُبلَّغ للمراقب.',
      built: 'gmt-integration-tests.js. يُشغَّل من صفحة الحماية أو ضمن الفاحص الشامل.',
      watch: 'يبلّغ المراقب بأي ترابط مكسور (kind=operational).'
    },
    {
      id: 'VISIBILITY', title: 'التحكّم بالظهور', status: 'done', severity: 'high', page: 'كل الصفحات',
      what: 'يخفي كل أزرار البوتات عن المستخدم العادي. يبقى الوضع التدريبي فقط. زر تقارير واحد بالصفحة الرئيسية للمالك.',
      how: 'gmt-visibility.js — يخفي الأزرار العائمة بصرياً. التسجيل يستمر بالخلفية (كل نقرة/خطأ/استعمال يُخزّن). بوابة التقارير للمالك فقط (دور admin أو reports=1).',
      built: '✅ أُضيف (2026-07-24) بطلب المالك: البوتات مستقلة تماماً، غير مرئية، وصول واحد، تشرح وتسجّل كل شيء.',
      watch: 'الإخفاء بصري فقط — البوتات تعمل وتسجّل كالمعتاد بالخلفية.'
    },
    {
      id: 'MASTER-REPORT', title: 'المصبّ الموحّد', status: 'done', severity: 'critical', page: 'كل الصفحات',
      what: 'كل الأخطاء من كل البوتات تصبّ في تقرير واحد قابل للنسخ ويُخزَّن ويتراكم. فحص تلقائي فور فتح الصفحة + زر إعادة فحص يعمل فعلياً.',
      how: 'gmt-master-report.js — زر 🎯. التقرير يوثّق: ماذا فُحص · كيف فُحص · النتيجة · وما لم يُفحص ولماذا وكيف يُفحص.',
      built: '✅ أُضيف (2026-07-23) بطلب المالك: مصبّ واحد لكل شيء. يشمل عمق الفحص (كامل/متوسط/سطحي) ليعرف المطوّر ما بقي.',
      watch: 'نقطة واحدة تجمع كل شيء — لا حاجة لجمع تقارير متفرقة.'
    },
    {
      id: 'CODE-SENTINEL', title: 'حارس الكود الاستباقي', status: 'done', severity: 'high', page: 'صفحات الموظف',
      what: 'يفحص الكود فور تحميل الصفحة ويكشف المخاطر قبل أن يلمسها المستخدم: أزرار بدوال مفقودة · صور مكسورة · معالجات تشير لدوال غير معرّفة.',
      how: 'gmt-code-sentinel.js — يفحص كل onclick ويتأكد أن دالته معرّفة (بفحصين: فوري + بعد اكتمال السكربتات). يبلّغ المراقب فوراً.',
      built: '✅ أُضيف (2026-07-21): يكمّل الحارس (bugcatcher) — ذاك ينتظر الخطأ، وهذا يكتشفه استباقياً. لا حاجة لمبرمج يراجع الكود يدوياً.',
      watch: 'يمسك الأزرار الميتة والدوال المفقودة قبل أن يضغطها موظف.'
    },
    {
      id: 'MONEY-GUARD', title: 'الحارس المالي الرياضي', status: 'done', severity: 'critical', page: 'صفحات الموظف',
      what: 'يعيد حساب كل عملية مالية بنفسه (عمولة · ربح · إجمالي · تحت التكلفة) ويقارن بما سجّله النظام. أي فرق ⇒ يبلّغ المراقب فوراً.',
      how: 'gmt-money-guard.js — يعترض حفظ الفواتير، يحسب من المبادئ الأولى، يقارن ضمن حد تقريب القروش. القواعد (النسب/الحدود) يضبطها المالك مرة عبر GMT_MONEY_RULES.',
      built: '✅ أُضيف (2026-07-21): أقصى حد عملي — يفرض قواعد المالك المالية بصرامة دون مراجعة يومية. اختبار ذاتي 4/4.',
      watch: 'يكشف أي رقم مالي خاطئ رياضياً — العين البشرية تحتاج فقط لوضع القواعد مرة، لا لمراجعة كل فاتورة.'
    },
    {
      id: 'BOT-WARDEN', title: 'المراقب السيادي', status: 'done', severity: 'critical', page: 'كل صفحات الموظف',
      what: 'العقل المركزي للحماية: يقرأ الميزات وقواعد المالك، يراقب حيّاً، يكتب تقارير حوادث (ماذا/متى/أين/من/كيف/لماذا/الخطورة/فرق المال).',
      how: 'gmt-warden.js (378 سطر). دفتر المال لا يُمسح أبداً. زر 🛡️ للأدمن. اختبارات وهمية ذاتية.',
      built: 'يستقبل البلاغات من كل البوتات ويوحّدها بتقرير واحد. window.GMTWarden.',
      watch: 'هو المراقب نفسه — يسجّل كل مخالفة لقواعد المالك.'
    },
    {
      id: 'BOT-SANDBOX', title: 'الوضع التدريبي', status: 'done', severity: 'high', page: 'كل صفحات الموظف',
      what: 'يحاكي القاعدة محلياً بالكامل — كل كتابة تذهب لقاعdة وهمية بالمتصفح، لا تمسّ الحقيقية. أساس أمان الفاحص الشامل.',
      how: 'gmt-sandbox.js (454 سطر) يعترض fetch. window.GMTSandbox.active. يمنع الرسائل الخارجية (واتساب/بريد).',
      built: 'للتدريب الآمن + حاجز أمان الفاحص الشامل. يدخل/يخرج بأمر.',
      watch: 'يضمن ألا يمسّ أي اختبار البيانات الحقيقية.'
    },
    {
      id: 'BOT-HEALTH', title: 'مراقب الصحة', status: 'done', severity: 'medium', page: 'كل صفحات الموظف',
      what: 'يرسل كل خطأ يحدث إلى جدول gmt_telemetry ليراه الأدمن بلوحة مركزية. صحة النظام الحيّة.',
      how: 'gmt-health.js (324 سطر) + gmt-health-panel.js للعرض. يلتقط أخطاء runtime ويصنّفها.',
      built: 'مراقبة صحة مستمرة. التقارير بجدول gmt_telemetry.',
      watch: 'يكمّل المراقب السيادي بمراقبة الأخطاء التقنية.'
    },
    {
      id: 'BOT-CACHE', title: 'مدير التخزين المؤقت', status: 'done', severity: 'low', page: 'كل النظام',
      what: 'يسرّع تحميل البيانات المتكررة ويقلّل طلبات القاعدة.',
      how: 'gmt-cache.js (340 سطر). window.GMTCache.',
      built: 'تحسين أداء — يخزّن البيانات الثابتة مؤقتاً.',
      watch: 'لا يخزّن بيانات مالية حسّاسة.'
    },
    {
      id: 'BOT-INTEGRITY', title: 'حارس السلامة', status: 'done', severity: 'medium', page: 'كل صفحات الموظف',
      what: 'يتحقق من سلامة البيانات وتماسكها (لا قيم متناقضة، لا حسابات مكسورة).',
      how: 'gmt-integrity.js.',
      built: 'فحص تماسك مستمر يكمّل المفتّش.',
      watch: 'يبلّغ المراقب عن أي تناقض بيانات.'
    },
    {
      id: 'BOT-GUIDE', title: 'الدليل التعليمي التفاعلي', status: 'done', severity: 'low', page: 'كل صفحة',
      what: 'جولة تعليمية سينمائية لكل صفحة تشرح كل زر ووظيفة. لكل صفحة دليلها (gmt-guide-*.js).',
      how: 'gmt-guide.js + 9 ملفات guide لكل صفحة + gmt-scenarios + gmt-training + gmt-welcome + gmt-tour.',
      built: 'تعليم المستخدم خطوة بخطوة. زر الجولة بكل صفحة.',
      watch: 'لا يراقب — تعليمي.'
    },
    {
      id: 'BOT-OFFERS', title: 'أداة العروض', status: 'done', severity: 'medium', page: 'أدمن المتجر · نقطة البيع',
      what: 'إنشاء وإدارة العروض (منتجات بسعر خاص) التي تظهر بالمتجر ونقطة البيع، مع أهداف النشر.',
      how: 'GMTOffersTool (مدموجة في gmt-staff.js) + جدول gmt_offers (SQL ٣١). العرض مُسعّر مسبقاً (معفى من حظر البيع تحت التكلفة).',
      built: 'أداة كاملة لإدارة العروض. window يفتح واجهتها.',
      watch: 'العروض تُطبّق أسعارها كما حدّدها الأدمن.'
    },
    {
      id: 'BOT-BRAND', title: 'محرّك الهوية', status: 'done', severity: 'medium', page: 'كل النظام',
      what: 'يوحّد لون البوتات من هويتك ويعالج الصور المكسورة بشعارك الحقيقي.',
      how: 'يقرأ --gmt-red من الثيم؛ لا يلمس التصميم.',
      built: 'gmt-brand.js.', watch: 'لا يراقب — يخدم البوتات.'
    }
  ];

  /* دالة مساعدة للبوتات: أعطني الميزات حسب الحالة */
  window.GMT_FEATURES.byStatus = function (st) {
    return window.GMT_FEATURES.filter(function (f) { return f.status === st; });
  };
  window.GMT_FEATURES.get = function (id) {
    return window.GMT_FEATURES.filter(function (f) { return f.id === id; })[0] || null;
  };
}());


/* ── gmt-owner-requests.js ── */
;/* ═══════════════════════════════════════════════════════════════════════════
   gmt-owner-requests.js — 📜 قاعدة طلبات المالك · v1.0 · 2026-07-17
   ─────────────────────────────────────────────────────────────────────────
   طلب المالك: «البوتات تعرف شو طلبي وكيف طلبته، عندها كل القاعدة».
   هذا الملف يوثّق كل قاعدة/طلب/قرار للمالك، بصيغة تقرأها البوتات لتراقب
   *على أساس نية المالك* لا مجرد الكود. إن رأى المراقب سلوكاً يخالف هذه
   القواعد، يكتب تقريراً فورياً.

   ⚠️ ملف بيانات نقي — لا منطق، آمن تماماً.

   لكل قاعدة:
     id      : رمز
     rule    : القاعدة كما طلبها المالك (حرفياً قدر الإمكان)
     why     : لماذا طلبها (السياق)
     check   : كيف يتحقق المراقب من احترامها (توقيع المخالفة)
     severity: خطورة المخالفة
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  window.GMT_OWNER_RULES = [
    {
      id: 'OWN-STOCK-TRUTH',
      rule: 'المخزون حقيقة مقدّسة: كل كمية مصدرها فاتورة. لا زيادة بلا فاتورة، لا نقص بلا بيع/نقل.',
      why: 'فوضى المخزون (المضاعفة) كانت المشكلة الأصلية التي بُني النظام لحلّها.',
      check: 'أي تغيّر بالمخزون لا يقابله فاتورة/بيع/نقل/تعديل سيادي مسجَّل = مخالفة حرجة.',
      severity: 'critical'
    },
    {
      id: 'OWN-MONEY-TRACE',
      rule: 'كل قرش له أثر: أي خصم أو إضافة مالية يجب أن يُسجَّل — ولا يضيع حتى لو أُصلح الخطأ لاحقاً.',
      why: 'المالك: «لو صار شيء منخصم أو منضاف، ما يضيع — نسجّله ونصلحه بعد التحديث».',
      check: 'أي فرق مالي (عمولة/سعر/رصيد) بين المتوقّع والفعلي يُسجَّل بتقرير مستقل يبقى حتى بعد الإصلاح.',
      severity: 'critical'
    },
    {
      id: 'OWN-NO-SILENT',
      rule: 'لا خطأ صامت: أي فشل — حتى لو لم يُظهر رسالة — يجب أن يُلتقط ويُبلَّغ.',
      why: 'الأخطاء الصامتة (زر بلا أثر، كتابة لم تُطبَّق) دمّرت المخزون شهوراً بلا أن يدري أحد.',
      check: 'المفتّش يرصد dead_click/silent_write/double_write ويكتبها فوراً.',
      severity: 'high'
    },
    {
      id: 'OWN-ACCOUNTABILITY',
      rule: 'المساءلة قبل الحذف: لا حذف نهائي. كل عملية حسّاسة تُسجَّل باسم من نفّذها ووقتها وسببها.',
      why: 'حماية من التلاعب والتستّر على العجز.',
      check: 'أي حذف/تصفير/تعديل حسّاس بلا (من+متى+سبب) = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-SOVEREIGN-REAL',
      rule: 'الصلاحية السيادية حقيقية: تعديل الكميات والعمليات الخطيرة تتطلب صلاحية فعلية + سبب.',
      why: 'المالك وثّق INV-5 صراحةً؛ يجب أن يكون منفَّذاً لا مدّعىً.',
      check: 'أي تعديل كمية/عملية سيادية بلا بوابة صلاحية + سبب = مخالفة (INV-5 حالياً مكسور).',
      severity: 'critical'
    },
    {
      id: 'OWN-BELOW-COST',
      rule: 'لا بيع تحت التكلفة إلا بصلاحية: يُمنع فعلياً لا يُحذَّر منه فقط.',
      why: 'المالك يريد منعاً حقيقياً؛ POS-4 موثّق كمنع.',
      check: 'أي بيع بسعر < cost_price بلا صلاحية = مخالفة تُسجَّل بقيمة الخسارة.',
      severity: 'high'
    },
    {
      id: 'OWN-DESIGN-UNTOUCHED',
      rule: 'البوتات لا تلمس التصميم: الهوية والألوان والشعار للمالك — البوتات تراقب فقط.',
      why: 'المالك: «البوت للبوتات فقط، ما يغيّر شي مصمّم».',
      check: 'أي كتابة على ألوان/خطوط/شعار عناصر التصميم من بوت = مخالفة (حالياً محترمة).',
      severity: 'medium'
    },
    {
      id: 'OWN-CUSTOMER-PAGES',
      rule: 'صفحات الزبون خفيفة: حارس + هوية فقط. لا تعليمي/مفتّش/فاحص للزبون.',
      why: 'الزبون لا يرى أدوات الموظفين.',
      check: 'أي صفحة زبون (متجر/كفالة/موقع/تتبّع) تحمّل بوتات الموظف = مخالفة.',
      severity: 'low'
    },
    {
      id: 'OWN-SQL-ORDER',
      rule: 'ترتيب SQL صحيح: audit_log قبل RLS، والدالة الصحيحة للعدّاد.',
      why: 'خطأ الترتيب يترك المساءلة بلا حماية ويكسر ترقيم الأوردرات (SQL-1/SQL-2).',
      check: 'الفاحص الذاتي يتحقق من نوع دالة العدّاد ووجود audit_log مع RLS.',
      severity: 'critical'
    },
    {
      id: 'OWN-CASHBOX-ONE',
      rule: 'رقم الصندوق مصدره واحد: GMTCash.expected = المقبوض فعلياً − المُرحّل − مصاريف الصندوق. لا شاشتان برقمين.',
      why: 'نقطة البيع والأدمن كانا يحسبان «غير مرحّل» مختلفاً (١٠٠٠ مقابل ١٠٥٠ والحقيقة ٩٥٠) — 2026-08-26.',
      check: 'أي حساب لرصيد الصندوق لا يمرّ عبر GMTCash.expected، أو يجمع total بدل المقبوض، أو يتجاهل المصاريف = مخالفة.',
      severity: 'critical'
    },
    {
      id: 'OWN-ATOMIC-WRITE',
      rule: 'كل عملية مالية أو منشئة لسجل: قفل ذرّي بشرط حالتها + مفتاح تفرّد (أو طبقة حاجبة). لا تنفيذ مزدوج.',
      why: 'الطلب المزدوج في المتجر (ضغطتان = طلبان) كشف الحاجة — 2026-08-26.',
      check: 'زر يكتب سجلاً بلا قفل إعادة دخول ولا مفتاح تفرّد ولا طبقة حاجبة = مخالفة (double_write).',
      severity: 'high'
    },
    {
      id: 'OWN-UPSERT-CONFLICT',
      rule: 'كل upsert (merge-duplicates) يحمل on_conflict على مفتاحه، وإلا يفشل تعديل الموجود بـ409.',
      why: 'setVal في كلمات السر كان بلا on_conflict=key فيفشل أي تعديل — 2026-08-26.',
      check: 'POST فيه resolution=merge-duplicates بلا on_conflict في المسار = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-NO-FALSE-SUCCESS',
      rule: 'لا رسالة نجاح إلا بعد وصول الكتابة للنظام الأساسي — لا اعتماد على مخزن ثانوي.',
      why: 'المتجر كان يعرض «تم» من jsonbin ويهمل فشل gmt_orders — 2026-08-26.',
      check: 'إظهار نجاح بلا فحص نتيجة النظام الأساسي (r.ok/dup) = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-STOCK-DELTA',
      rule: 'كل تعديل كمية يمرّ بـRPC ذرّي يحسب الفرق على القاعدة (add_branch_stock). لا قراءة من الذاكرة ثم كتابة قيمة مطلقة — إلا في «تعيين» المقصود.',
      why: 'التعديل الجماعي بالجرد كان يقرأ الكمية من نسخة الصفحة ثم يكتب مطلقاً ⇒ أي بيع متزامن يُمحى (10 بالصفحة · 8 بالقاعدة · +5 ⇒ كُتب 15 والصحيح 13) — 2026-08-26.',
      check: 'PATCH يكتب عمود كمية بقيمة محسوبة من متغيّر محلي = مخالفة حرجة (OWN-STOCK-TRUTH).',
      severity: 'critical'
    },
    {
      id: 'OWN-CASH-SIGN',
      rule: 'إشارة كل حركة مالية مُعرَّفة صراحةً: التحصيل (collection) يدخل الصندوق، المصروف يخرج، الترحيل يخرج. لا نوع بلا تصنيف.',
      why: 'تحصيل أوردر الشحن كان يُصنَّف ضمن «المُرحّل» فيَنقص الصندوق بدل أن يزيده (مبيعات 1000 + تحصيل 200 ⇒ عُرض 800 والصحيح 1200) — 2026-08-26.',
      check: 'أي type جديد في branch_transfers لا يُصنَّف صراحةً داخل GMTCash = مخالفة مالية.',
      severity: 'critical'
    },
    {
      id: 'OWN-STATE-FINALITY',
      rule: 'أي عملية تغيّر بيانات ثم تُحدّث حالة: فشل تحديث الحالة يُبلَّغ صراحةً مع معرّف السجل وتحذير من إعادة المحاولة.',
      why: 'استلام النقل كان يضيف المخزون ثم يفشل صامتاً بتحديث الحالة ⇒ الفاتورة تعلق على receiving مع رسالة نجاح، وإعادة المحاولة تُضاعف الكمية — 2026-08-26.',
      check: 'PATCH لحالة نهائية داخل catch فارغ أو بلا فحص r.ok = مخالفة (P14).',
      severity: 'high'
    },
    {
      id: 'OWN-BRAND-COLORS',
      rule: 'أحمر GMT #D5001C لصفحات الموظفين والإدارة. المتجر #D5001C والكفالات #D5001C لواجهات الزبون. **استثناء بقرار المالك: فاتورة الشراء زرقاء #1f348f** (تمييزها عن البيع) — ليست مخالفة.',
      why: 'ترويسات Excel المُصدَّرة كانت زرقاء #1F348F، والجرد يطبع بلون المتجر — مستندات تصل الموردين بهوية غريبة (2026-08-26).',
      check: 'أي لون أساسي خارج المعتمد في صفحة موظفين/إدارة = مخالفة — **عدا أزرق فاتورة الشراء** (قرار المالك 2026-08-26: «عيفها»).',
      severity: 'medium'
    },
    {
      id: 'OWN-NO-CDN',
      rule: 'لا اعتماد على CDN خارجي: كل المكتبات والخطوط والأنماط مستضافة ذاتياً في lib/.',
      why: 'Tailwind بقي من CDN في 8 صفحات بعد استضافة باقي المكتبات ⇒ تلك الصفحات تظهر **بلا تنسيق** بلا إنترنت، وعامل الخدمة لا يخزّنه (2026-08-26).',
      check: 'أي src/href يشير إلى cdnjs · jsdelivr · cdn.tailwindcss.com = مخالفة تكسر العمل بلا إنترنت.',
      severity: 'high'
    },
    {
      id: 'OWN-TEMP-DATA',
      rule: 'أي بيانات ثقيلة تُحفظ للتسهيل (صور، مرفقات) مؤقّتة: تُضغط، ولها حدّ حجم، وتُمسح تلقائياً عند انتهاء الحاجة.',
      why: 'صورة إيصال الشحن تُحفظ لتسهيل الوصول ثم تُمسح عند التحصيل — تخفيفاً على القاعدة (قرار المالك 2026-08-26).',
      check: 'حفظ صورة أو مرفق في القاعدة بلا ضغط أو بلا حدّ حجم أو بلا مسار مسح تلقائي = مخالفة.',
      severity: 'medium'
    },
    {
      id: 'OWN-ORPHAN-REF',
      rule: 'عند إزالة مكتبة أو سكربت، احذف **كل** ما يستعمله معه. مرجع يتيم واحد يوقف كل السكربتات بعده.',
      why: 'أُزيل سكربت Tailwind من CDN وبقيت `tailwind.config = {...}` في 3 صفحات ⇒ ReferenceError عطّل المتجر وأدمنه والكفالة بالكامل (2026-08-26). الكود كان **صحيحاً نحوياً** فلم تلتقطه مسحة المختفيات.',
      check: 'شغّل `كاشف_المراجع_اليتيمة.py`: أي معرّف مكتبة يُستعمل في صفحة لا تُحمّله = مخالفة حرجة.',
      severity: 'critical'
    },
    {
      id: 'OWN-LIVE-TEST',
      rule: 'لا تُسلّم تعديلاً في الواجهة بلا اختبار على **خادم HTTP حقيقي** بمتصفّح فعلي — الفحص النحوي لا يكفي.',
      why: 'أعطال وقت التشغيل (مرجع يتيم · CSS غير مبنيّ · أصناف مفقودة) تمرّ من `node --check` بسلام. و`file://` يمنع قراءة cssRules فيوهم أن التنسيق معطّل (2026-08-26).',
      check: 'تعديل واجهة سُلّم بلا لقطة/فحص من خادم HTTP = مخالفة منهجية.',
      severity: 'high'
    },
    {
      id: 'OWN-BUILD-FRESH',
      rule: 'أي ملف مبنيّ (CSS مولّد · حزمة) يُعاد بناؤه **بعد آخر تعديل** على مصادره، ويمسح HTML و JS معاً.',
      why: 'بُني `lib/tailwind.css` الساعة 12:40 وعُدّلت الصفحات حتى 18:13 ⇒ أصناف الميزات الجديدة كلها مفقودة من التنسيق (2026-08-26).',
      check: 'تاريخ الملف المبنيّ أقدم من أحدث مصدر = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-VERSION-SYNC',
      rule: 'ترقيم الإصدار `?v=` موحَّد في كل الصفحات ويُحدَّث مع كل نشر. لا يُترك ملف واحد بإصدار قديم.',
      why: 'وُجد 361 مرجعاً بإصدارات متضاربة (20260822 · 23 · 24) — نفس الملف بثلاثة إصدارات ⇒ المتصفّح يخدم نسخاً قديمة فتبدو الإصلاحات غير شغّالة، وظهرت رسالة «الفاحص غير محمّل» رغم وجود الملف (2026-08-26). وتكرّر في 2026-09-26: إضافة gmt-brand.js بإصدار 20260926 بين مراجع 20260826 خلطت إصدارين في 35 صفحة ⇒ وُحِّد 395 مرجعاً. **يتكرّر مع كل ملف مشترك جديد** — وحِّد الإصدار بعد أي إضافة.',
      check: 'أي `?v=` يخالف الإصدار الحالي، أو أصل بلا ترقيم = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-GUARDED-FEATURE',
      rule: 'رسالة «الأداة غير محمّلة» تعني **الملف لم يُرفع أو الكاش قديم** — لا خلل في الكود. تحقّق من الرفع والإصدار أولاً.',
      why: 'ظهرت «الفاحص غير محمّل — تأكّد من رفع gmt-deep-inspector.js» بينما الوسم موجود والملف سليم؛ السبب إصدار قديم/ملف غير مرفوع (2026-08-26).',
      check: 'قبل تعديل أي كود بسبب هذه الرسالة: افحص وجود الملف على الخادم وتطابق `?v=`.',
      severity: 'medium'
    },
    {
      id: 'OWN-SAFE-RATIO',
      rule: 'أي نسبة أو هامش أو نسبة مئوية تُحسب **فقط حين يكون المقام موجباً**. وإلا تُعرض «—» لا رقماً.',
      why: 'صفّ مرتجعات أظهر ربحاً −240$ وهامشاً **+53%** (سالب ÷ سالب = موجب) في سجل المبيعات. ونفس النمط في نسبة العمولة والربح بأدمن نقاط البيع: فاتورة مرتجع (إجمالي −200) تُظهر ربح −50 كنسبة **+25%**. حساب صحيح رياضياً ومضلّل عملياً (2026-08-26).',
      check: 'قسمة لنسبة/هامش حارسها `b ?` أو `b != 0` فقط = مخالفة (يمنع الصفر لا السالب). الصحيح `b > 0`.',
      severity: 'high'
    },
    {
      id: 'OWN-VISUAL-CHECK',
      rule: 'كل شاشة أرقام جديدة تُراجَع **بصرياً** ببيانات تشمل الحالات الحدّية (مرتجع · صفر · خسارة) قبل التسليم.',
      why: 'الاختبار الرقمي نجح 3/3 لكن **المعاينة البصرية** هي التي كشفت الهامش المضلّل: رقم أخضر موجب بجانب ربح أحمر سالب (2026-08-26).',
      check: 'شاشة أرقام سُلّمت بلا لقطة تشمل مرتجعاً وخسارة وصفراً = مخالفة منهجية.',
      severity: 'medium'
    },
    {
      id: 'OWN-TEMP-CLEANUP',
      rule: 'الملفات المؤقتة (معاينات · اختبارات) تُنشأ خارج مجلد المشروع، أو تُحذف بأمر مستقلّ يُتحقَّق من نجاحه.',
      why: 'ملف معاينة `_demo_sales.html` بقي داخل المشروع لأن أمر حذفه جاء بعد أمر فشل في سلسلة `;` — وكاد يُنشر. كشفه فحص تغطية البوابة (2026-08-26).',
      check: 'أي ملف `_demo*` أو `_test*` أو `_tmp*` داخل المشروع = مخالفة.',
      severity: 'medium'
    },
    {
      id: 'OWN-ROW-CAP',
      rule: 'Supabase يُرجع 1000 صفّ كحدّ أقصى افتراضياً **مهما طُلب** — وبلا خطأ. ارفع Max Rows أو قسّم الطلب بـRange.',
      why: '23 موضعاً تطلب 2000–5000 صفّ (المحاسبة · العمولات · الديون · المصاريف · الأوردرات). عند تجاوز 1000 فاتورة تُحسب الإجماليات من أول 1000 فقط **بصمت** — والمحلّ يتجاوزها خلال أشهر (2026-08-26).',
      check: 'الفاحص الذاتي يطلب 1500 صفّ: إن عاد 1000 والإجمالي أكبر ⇒ الحدّ مفعّل ويقطع البيانات.',
      severity: 'critical'
    },
    {
      id: 'OWN-LOCAL-DATE',
      rule: 'تاريخ «اليوم» يُحسب بالتوقيت المحلي لا بـUTC: `new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)`.',
      why: 'سوريا UTC+3 ⇒ `toISOString()` يعطي **تاريخ أمس** بين 00:00 و03:00. تقفيل بعد منتصف الليل حُفظ بتاريخ الأمس، والفهرس الفريد (فرع، تاريخ) + upsert جعله **يكتب فوق تقفيل الأمس** فيضيع سجلّ يوم كامل. 18 موضعاً (2026-08-26).',
      check: '`new Date().toISOString().slice(0,10)` كتاريخ لليوم = مخالفة.',
      severity: 'critical'
    },
    {
      id: 'OWN-ESCAPE-USER',
      rule: 'أي نصّ يدخله زبون أو زائر يُهرَّب قبل إدراجه في `innerHTML` — خصوصاً في الواجهات العامة.',
      why: 'تعليقات الزبائن في المتجر العام كانت تُدرج اسماً ونصّاً **بلا تهريب** ⇒ XSS مخزّن: أي زائر يكتب تعليقاً فيه كود فيُنفَّذ عند **كل** الزوّار. والمفارقة: `escHtml` كانت موجودة في الملف نفسه ولم تُستعمل (2026-08-26).',
      check: '`${x.name}` أو `${x.text}` من مصدر عام داخل innerHTML بلا esc = مخالفة حرجة.',
      severity: 'critical'
    },
    {
      id: 'OWN-MONEY-ROUND',
      rule: 'كل مبلغ ناتج عن طرح أو جمع عشري يُقرَّب للسنت **قبل** المقارنة وقبل الحفظ: `Math.round(x*100)/100`.',
      why: '19.99 + 34.10 + 8.70 = 62.790000000000006 ⇒ فاتورة مدفوعة كاملاً حُفظت بمتبقٍّ 0.000000000000007 ⇒ الإيصال طبع «0.00$ متبقي» والزبون ظهر **مديناً** في قائمة الديون. وُجد عبر 1728 تركيبة أسعار حقيقية (2026-08-26).',
      check: 'مبلغ محسوب يُقارَن بـ`> 0` أو `=== 0` أو يُحفظ بلا تقريب = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-ENFORCE-AT-SAVE',
      rule: 'أي قيد عمل (حظر · حدّ · صلاحية) يُفرض **عند الحفظ** لا عند الاختيار من القائمة فقط.',
      why: 'حظر الزبون كان يُطبَّق عند اختياره من القائمة فقط ⇒ كتابة الرقم يدوياً أو «إضافة عميل جديد» تتجاوزه. والدالة التي تفحصه عند الحفظ كانت **ميتة**. والمطابقة حرفية فـ0999… ≠ +963999… (2026-08-26).',
      check: 'قيد يُفحص في واجهة الاختيار فقط ولا يُفحص في دالة الحفظ = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-VERIFY-TOOL',
      rule: 'أي أداة فحص آلية تُختبر أولاً على **حالات مثبتة يدوياً** قبل اعتماد نتائجها.',
      why: 'محلّل الكود الميت أبلغ عن 130 «تكراراً» (الحقيقي 0) واعتبر الكاميرا والتوقيع ميتة (وهي حيّة) — لأنه طرح التعريفات مرّتين. لو اعتُمد لحُذفت ميزة التوقيع كاملة (2026-08-26).',
      check: 'نتيجة أداة آلية نُفِّذ بناءً عليها حذف أو تعديل بلا تحقّق يدوي = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-SANITY-VALUE',
      rule: 'أي قيمة عمل (سعر · نسبة · مدّة) تُتحقَّق منطقياً قبل اعتمادها، حتى لو جاءت من المالك نفسه — واسأل إن لم تتّسق.',
      why: 'سعر الصرف: القديم 14,000، والعملة الجديدة **حذفت صفرين** ⇒ 140. اعتمدتُ 1,400 بلا حساب، فصحّحني المالك مرّتين. قسمة واحدة كانت تكشفه (2026-08-26).',
      check: 'قيمة عمل جديدة لم تُقارَن بالقديمة أو بالقاعدة المنطقية التي تحكمها = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-SINGLE-SOURCE',
      rule: 'كل ثابت عمل أو منطق مشترك يُعرَّف **مرّة واحدة** في مصدر مشترك (gmt-core) وتقرأ منه كل الصفحات.',
      why: 'سعر الصرف كان في 13 موضعاً ⇒ تغييره احتاج 13 تعديلاً، **وفات موضع** (newInvoice — الأهمّ). وكتبتُ توحيد الهاتف مرّتين في ملفين. وُحِّدا في GMT_DEFAULT_RATE و GMTPhone (2026-08-26).',
      check: 'نفس الثابت أو نفس المنطق في أكثر من ملف = مخالفة. عدّل المصدر لا النسخ.',
      severity: 'high'
    },
    {
      id: 'OWN-ABSENCE-PROOF',
      rule: 'لا تُعلن «هذه الميزة غير موجودة» من بحث بكلمات. ابحث بأسماء بديلة واسأل المالك قبل الحكم.',
      why: 'أعلنتُ غياب «حساب المورّد» (موجود في الديون) و«تصدير الأوردرات» (exportCSV) و«في الطريق» (باسم آخر) — كلها من بحث بكلمات محدّدة (2026-08-26).',
      check: 'حكم بغياب ميزة مبنيّ على كلمة واحدة لم تُطابق = مخالفة.',
      severity: 'medium'
    },
    {
      id: 'OWN-CHAIN-SAFE',
      rule: 'في أوامر الطرفية: لا تربط خطوة حرجة بعد أمر قد يفشل بـ`;`. وأمر `pkill -f X` يقتل نفسه إن احتوى نصّه على X.',
      why: 'ملف معاينة بقي داخل المشروع لأن حذفه جاء بعد أمر فاشل. و`pkill -f "http.server"` قتل أمر البناء كاملاً لأن نصّه يحوي الكلمة — فلم تُبنَ الحزمة (2026-08-26).',
      check: 'بناء أو حذف مربوط بـ`;` بعد أمر غير مضمون = مخالفة منهجية.',
      severity: 'medium'
    },
    {
      id: 'OWN-COLUMN-MATCH',
      rule: 'اسم العمود في القراءة والبحث يطابق حرفياً اسمه عند الكتابة. عمود غير موجود داخل `or=(…)` يُسقط الاستعلام **كله**.',
      why: 'بحث الكفالة يبحث بـ`serial_number` والكفالة تُحفظ بـ`serial_no` ⇒ PostgREST يرفض الاستعلام كله بخطأ 400 ⇒ **البحث برقم الكفالة والفاتورة أيضاً كان يفشل**. ميزة أُضيفت لاحقاً (WAR-2) كسرت البحث بالكامل (2026-08-26).',
      check: 'عمود يُرشَّح به ولا يُكتب في أي مكان بنفس الاسم = مخالفة حرجة.',
      severity: 'critical'
    },
    {
      id: 'OWN-TWO-SIDED-FEATURE',
      rule: 'الميزة ذات الطرفين (مُرسِل ومستقبِل) تُختبر من الطرفين. مولّد رابط بلا قارئ له = ميزة معطّلة.',
      why: 'زر «مشاركة المنتج» في المتجر يولّد رابط `#product=…` (حيّ)، لكن `_applyDeepLink` التي تقرأه عند الفتح كانت **ميتة** ⇒ الزبون يفتح الرابط فيصل الصفحة الرئيسية لا المنتج (2026-08-26).',
      check: 'مُنتج بيانات (رابط · رسالة · حدث) لا يوجد له مستهلك حيّ = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-KNOWLEDGE-SYNC',
      rule: 'كل ميزة جديدة تُضاف إلى `gmt-guide-updates.js` مع بنائها — وإلا لا يعرفها الموظف ولا عقل النظام.',
      why: 'مركز المعرفة لم يواكب: 6 من 9 ميزات رئيسية غير موثّقة. وعقل النظام يستقي من أدلة الصفحات فلا يعرف «الطباعة الجماعية» ولا «التقفيل» — **تآكل صامت مع الزمن** (2026-08-26).',
      check: 'ميزة بواجهة جديدة بلا شريحة في gmt-guide-updates.js = مخالفة.',
      severity: 'medium'
    },
    {
      id: 'OWN-TEST-TIMING',
      rule: 'اختبار الواجهة ينتظر **كل** التأخيرات المقصودة (أنيميشن · setTimeout) قبل الحكم. «لم يظهر» ≠ «معطّل».',
      why: 'صفحة التتبّع فيها أنيميشن شاحنة 4.5 ثانية قبل النتيجة؛ اختباري انتظر 3 ثوانٍ فكدتُ أعلنها **معطّلة بالكامل** وهي تعمل. التحقّق من الشبكة كشف أن الطلب يُرسل فعلاً (2026-08-26).',
      check: 'حكم بتعطّل واجهة دون فحص طلبات الشبكة ومدد التأخير = مخالفة منهجية.',
      severity: 'medium'
    },
    {
      id: 'OWN-DESTRUCTURE-NAME',
      rule: 'قبل استعمال متغيّر داخل دالة، تحقّق من **شكل معاملاتها**: `function f({a,b})` تعني `a` مباشرة لا `d.a`.',
      why: 'زر «تابع طلبك» بالمتجر: كتبتُ `d.orderId` بينما المعامل مفكَّك `{orderId,…}` ⇒ `d` غير موجود ⇒ ReferenceError كان سيكسر فاتورة الطلب كلها. وكتبتُ `trackInput/trackOrder` والفعليّان `searchInput/searchOrder` (2026-08-26).',
      check: 'مرجع لمتغيّر أو دالة أو عنصر لم يُتحقَّق من وجوده بالاسم نفسه في الكود الفعلي = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-THEME-MERGE',
      rule: 'عند توحيد إعدادات أدوات البناء، تُدمج **كل** امتدادات الصفحات (ألوان · أنيميشن · ظلال). وتوسيع لون بقيمة واحدة يمحو درجاته الافتراضية.',
      why: '`red: "#D5001C"` محا درجات الأحمر كلها (red-50…900) فتعطّلت أنماط الأوردرات ظاهرياً. وحذف كتل tailwind.config اليتيمة أسقط أنيميشن الكفالة وظلال المتجر وألوان الباقات. والخط الافتراضي تغيّر لصفحة لا تحدّد خطّها (2026-08-26).',
      check: 'لون يُعرَّف كنصّ واحد باسم من لوحة افتراضية (red · blue …) = مخالفة. الصحيح: {...colors.red, DEFAULT: "…"}.',
      severity: 'critical'
    },
    {
      id: 'OWN-NO-BLOCKING-PROMPT',
      rule: 'لا `prompt`/`alert` أثناء عمل الصفحة. الإعدادات (روابط · مفاتيح) تُضبط في gmt-config.js لا بسؤال المستخدم.',
      why: 'رابط التتبّع كان يُسأل بـprompt عند كل تحميل لا يُحفظ فيه (الملف المفتوح محلياً) ⇒ **تجمّدت الواجهة 7.7 و11.9 و13 ثانية** في تقرير صحة حقيقي — لأن الحوار يوقف الخيط الرئيسي حتى يُجاب (2026-08-26).',
      check: 'prompt/alert يُنفَّذ تلقائياً (لا بضغطة مستخدم) = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-SCOPE-EXPORT',
      rule: 'الدالة المشتركة داخل ملف متعدّد الوحدات (IIFE) تُعرَّف على `window` — التعريف داخل وحدة لا تراه الأخرى.',
      why: 'حارس أدوات الفحص `_devToolsAllowed` عُرِّف داخل وحدة فرمى «is not defined» أربع مرّات في صفحات الموظفين (2026-08-26).',
      check: 'استدعاء دالة معرَّفة في وحدة أخرى من الملف نفسه بلا window = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-WHATSAPP-BIZ',
      rule: 'رسائل الزبائن تُفتح في **واتساب بزنس** مباشرة (intent مع package=com.whatsapp.w4b) مع احتياطي wa.me. ولا يمكن الإرسال بلا ضغطة المستخدم.',
      why: 'كان المتصفّح يسأل «أي واتساب؟» في كل مرّة. والإرسال التلقائي الكامل يحتاج WhatsApp Business API (حساب موثّق + قوالب معتمدة + رسوم) — فالمتاح: فتح المحادثة والرسالة جاهزة (2026-08-26).',
      check: 'رابط واتساب بلا استهداف بزنس على أندرويد، أو ادّعاء إرسال تلقائي كامل = مخالفة.',
      severity: 'medium'
    },

    /* ══ قواعد وُلدت في جلسة 2026-09-26 — كلٌّ من عطل حقيقي وقع ══ */
    {
      id: 'OWN-MIME-MATCH',
      rule: 'نوع الـFile/Blob المعلَن يجب أن يطابق محتواه الحقيقي، والامتداد يتبع النوع — لا تكتب image/png لملف JPEG.',
      why: 'كليشة «تم استلام طلبكم» كانت تُبنى JPEG (sheetToBlob يُخرج image/jpeg) وتُغلَّف في File بنوع image/png واسم .png. واتساب **يرفض الملف بصمت**: يصل النص وتضيع الصورة — بلاغ المالك: «الصورة مع الكتابة ما عم تنرسل أما الباقي عم ينرسل» (2026-09-26).',
      check: 'أي new File/Blob بنوع مكتوب يدوياً لا يأتي من blob.type = مشبوه.',
      severity: 'high'
    },
    {
      id: 'OWN-SHARE-TEXT-DROP',
      rule: 'أهداف المشاركة (واتساب خاصة) تقبل **إمّا** ملفاً **وإمّا** نصّاً — لا تفترض أن navigator.share({files,text}) يوصل الاثنين. انسخ النص للحافظة قبل المشاركة.',
      why: 'الـtext المرفق مع files يُهمَل عند أكثر الأهداف. كان التبليغ يُرسَل صورةً بلا كلمة واحدة من الكليشة (2026-09-26).',
      check: 'navigator.share بـfiles و text معاً بلا نسخ احتياطي للنص = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-NOTIFY-DISTINCT',
      rule: 'كل نوع تبليغ له عموده ووسمه وقناته وشرط ظهوره — لا يُدمج نوعان في عمود واحد ولا في زرّ واحد.',
      why: 'صار عندنا ثلاثة تبليغات: استلام الطلب (تلقائي · مع صورة) · اعتماد الشحن (تلقائي · بلا صورة) · وصول الشحنة (يدوي · بلا صورة). دمجها يعني تبليغ الزبون مرّتين أو عدم تبليغه إطلاقاً. تحذير المالك الحرفي: «لا تخربط بينهم» (2026-09-26).',
      check: 'زرّ تبليغ واحد يخدم أكثر من نوع، أو عمود وسم واحد لنوعين = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-RECHECK-PRIOR-CONSTRAINT',
      rule: 'قبل إضافة ميزة قرب مكان فيه قيد سابق صريح، أعد قراءة القيد وتأكّد أن الميزة لا تكسره — قبل التسليم لا بعده.',
      why: 'كان القيد: «زر التبليغ ممنوع يظهر للطلبات غير المشحونة». وعند إضافة «تبليغ استلام الطلب» أُظهر الزرّ لتلك الطلبات نفسها، والمالك هو من اضطرّ للتنبيه. الصواب: التوفيق بين الجديد والقديم (صار التبليغ تلقائياً عند الإنشاء، والزرّ للوصول فقط ولا يظهر إلا للمشحون) (2026-09-26).',
      check: 'ميزة جديدة تُظهر عنصراً في حالة مُنع فيها سابقاً = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-NO-INTERNAL-LEAK',
      rule: 'الملاحظات الداخلية (مُدخِل الأوردر · أجور الشحن المضافة · الهوامش) لا تُطبع على ورقة تذهب بيد الزبون — تُفلتر عند العرض وتبقى في القاعدة.',
      why: 'أجور الشحن تُكتب في الملاحظات كأثر محاسبي، وكانت تُطبع على ملصق الشحن ⇒ الزبون يقرأ الهامش المضاف عليه (2026-09-26).',
      check: 'طباعة o.notes خاماً على مستند يصل الزبون = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-MONEY-FIELD-SCOPE',
      rule: 'الزيادات على ما يدفعه الزبون (أجور شحن · رسوم) تُضاف على حقل **التحصيل** لا على قيمة الفاتورة، ما لم تكن جزءاً من الفاتورة فعلاً.',
      why: 'price هو ما ترتبط به فاتورة نقطة البيع وعدّاد الشهر والمحاسبة. زيادته بأجور الشحن تجعل الأوردر ≠ الفاتورة المرتبطة ⇒ تضارب صامت. قاعدة المالك: «ما بصير نضيف ميزة بتأثّر عغير شي وانت ما تعرف» (2026-09-26).',
      check: 'كتابة رسوم غير فاتورية في price = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-CLASS-BUILT',
      rule: 'لا تعتمد على صنف Tailwind دون التأكّد أنه **مبنيّ فعلاً** في lib/tailwind.css — البناء مُقلَّم ولا يحوي كل الأصناف.',
      why: 'نافذة «أماكن الوصول» بُنيت بـsm:grid-cols-2 وهو غير موجود في البناء المرفق ⇒ عمود واحد بدل عمودين، بلا أي خطأ في الكونسول. صنف غير مبنيّ يفشل بصمت تماماً كعمود ناقص في القاعدة (2026-09-26).',
      check: 'صنف استجابي أو نادر غير موجود بـgrep في lib/tailwind.css = مخالفة؛ عرّف النمط بجانب مكوّنه.',
      severity: 'medium'
    },
    {
      id: 'OWN-DEGRADE-NOT-BREAK',
      rule: 'ميزة تعتمد على عمود/جدول لم يُنشأ بعد يجب أن **تتراجع بلطف**: الوظيفة الأساسية تعمل، والإضافة تغيب مع تنبيه مرّة واحدة — لا فشل صامت ولا تعطيل كامل.',
      why: 'المالك لم يشغّل أي SQL هذه الجلسة. وسم التبليغ يكتب في أعمدة ملف SQL الأساس (SQL/أرشيف_SQL.html)؛ لو أوقفنا التبليغ عند فشل الوسم لضاعت الرسالة، ولو ابتلعنا الفشل لما عرف أحد لماذا لا تظهر العلامات (2026-09-26).',
      check: 'كتابة في عمود جديد بلا try/catch مع تنبيه لمرّة واحدة = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-FAB-SWEEP',
      rule: 'صفحة مُنع فيها الزرّ العائم تحتاج حارساً دائماً (MutationObserver + مسحات مجدولة) لا فحصاً لحظياً — السكربتات المشتركة تزرع أزرارها بعد التحميل.',
      why: 'المالك أبلغ مرّتين عن زرّ عائم باقٍ («لسّى في زر عائم، هو على شكل قبعة»). الأزرار تُزرع بعد ثوانٍ من سكربتات مشتركة، ففحص وقت التحميل لا يراها (2026-09-26).',
      check: 'اعتماد على شرط تحميل واحد لمنع عناصر تُزرع لاحقاً = مخالفة.',
      severity: 'medium'
    },
    {
      id: 'OWN-PASTE-ASSIST',
      rule: 'حقول الإدخال التي يُلصق فيها نصّ الزبون تستخرج نصيبها منه وتترك الباقي — تُساعد ولا تُصادر: الموظّف يبقى قادراً على التعديل والمسح.',
      why: 'الموظّف ينسخ رسالة الزبون كاملة ويلصقها، فيضطر لمسح الكثير داخل خانة صغيرة. الآن: الاسم = ما قبل أوّل رقم · المنطقة تُستخرج من شبكة المكاتب · المنتجات = ما بعد رقم الهاتف. ولا نخترع اسماً غير موجود (2026-09-26).',
      check: 'حقل يرفض اللصق كلّياً، أو يخترع قيمة ليست في النص = مخالفة.',
      severity: 'medium'
    },

    /* ══ قواعد جلسة 2026-09-26 — الهوية البصرية والمرحلة الثانية ══ */
    {
      id: 'OWN-BRAND-EMBED',
      rule: 'شعار الشركة في أي مستند يُطبع أو يُصوَّر أو يُنزَّل يكون **مضمَّناً (data URI)** من gmt-brand.js — لا مسار نسبي ولا بديل نصّي.',
      why: 'المطبوعات تُبنى داخل iframe srcdoc أو نافذة document.write، والمسار النسبي logo.jpg **لا يُحلّ هناك**. فكان كل إيصال مبيع حراري يُطبع بلا شعار بصمت (onerror يُخفيه)، وملصق الشحن يعرض بديلاً نصّياً «GMT» في مربّع أحمر. بلاغ المالك: «أزل الشعارات التي تضعها أنت GMT لأنها عم تخرب أشكال» (2026-09-26).',
      check: 'أي <img src="logo.jpg"> داخل قالب مطبوع، أو onerror يكتب نصّاً بدل الصورة = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-NO-TEXT-LOGO',
      rule: 'لا بديل نصّي للشعار إطلاقاً. فشل تحميل الصورة يسقط على الشعار المضمَّن، لا على حرفَي «GMT» في مربّع ملوّن.',
      why: 'البدائل النصّية صُمّمت لخلفية حمراء مستديرة، فلمّا صار الشعار الحقيقي مربّعاً بخلفية بيضاء بدا مقصوصاً وغريباً في الترويسات والتذييلات (2026-09-26).',
      check: 'onerror يحتوي outerHTML أو textContent بنصّ = مخالفة؛ استعمل GMT_BRAND.logo.',
      severity: 'medium'
    },
    {
      id: 'OWN-DIRECT-CHAT',
      rule: 'تبليغ زبون بعينه يفتح **محادثته مباشرة** برقمه، لا مُنتقي مشاركة على مستوى النظام.',
      why: 'navigator.share منتقي تطبيقات: لا يعرف رقم الزبون فيضطر الموظّف لاختيار التطبيق ثم الزبون في كل تبليغ. طلب المالك: «بدي تلقائياً يدخل ع محادثة العميل مو اختار مشاركة». الترتيب الصحيح: احفظ الصورة على الجهاز ← انسخ النص ← افتح محادثة الزبون (2026-09-26).',
      check: 'استدعاء navigator.share كمسار أساسي لتبليغ زبون معروف الرقم = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-ARTIFACT-FIRST',
      rule: 'قبل فتح أي نافذة قد يُلغيها المستخدم، احفظ ما أنتجته (صورة/ملف) على جهازه أوّلاً — فلا يضيع العمل إن أُلغيت النافذة.',
      why: 'لو فُتحت المحادثة أوّلاً وألغى الموظّف المشاركة، ضاعت صورة الطلب وتوجّب إعادة التبليغ كلّه. الآن الصورة بيده قبل أي نافذة (2026-09-26).',
      check: 'مشاركة/فتح نافذة قبل حفظ الناتج محلياً = مخالفة.',
      severity: 'medium'
    },
    {
      id: 'OWN-FEATURE-NOT-BUTTON',
      rule: 'إخفاء زرّ لا يعني حذف وظيفته: كل زرّ يُزال يجب أن يكون له مدخل بديل في قائمة أو شريط.',
      why: 'عند تطبيق مِكنسة الأزرار العائمة على نقطة البيع كانت ستُخفى التلميحات والجولة والعقل بلا بديل ⇒ ميزات تُفقد بصمت. نُقلت الثلاث إلى قائمة «المزيد» قبل تفعيل المكنسة (2026-09-26).',
      check: 'إخفاء عنصر تفاعلي بلا مدخل بديل موثّق = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-API-EXISTS',
      rule: 'قبل نداء دالة من وحدة أخرى، تأكّد أنها **مُصدَّرة فعلاً** بذلك الاسم — لا تفترضه من التسمية.',
      why: 'زرّ «شو هالزر؟» كان ينادي GMTHints.start في الأوردرات ونقطة البيع، والوحدة تُصدّر tour وend وshow وcount وmount — **ولا تُصدّر start إطلاقاً**. فالزرّ لم يعمل يوماً ولم يُصدِر أي خطأ (نمط P13: زرّ يفتح فراغاً) (2026-09-26).',
      check: 'نداء Obj.method بلا تحقّق من وجوده في مصدر الوحدة = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-FLEX-SHRINK',
      rule: 'الصورة داخل حاوية مرنة تحتاج flex-shrink:0 وعرضاً صريحاً — w-auto لا يحميها من الانسحاق.',
      why: 'شعار ترويسة الأوردرات كان يُسحق إلى **8px عرضاً** داخل الحاوية المرنة فيبدو غائباً تماماً، رغم أن الصورة محمّلة بنجاح (naturalWidth=640). لا خطأ ولا تحذير (2026-09-26).',
      check: 'img داخل flex بلا shrink-0 أو عرض صريح = مشبوه.',
      severity: 'medium'
    },
    {
      id: 'OWN-CSS-CHILD',
      rule: 'محدِّد مثل `.box div` يطابق **كل** الأبناء والأحفاد — استعمل `>` عندما تقصد المباشر فقط.',
      why: 'شريط ملخّص كتالوج PDF استعمل `.sum div{border...}` فرُسم إطار حول الصندوق وحول كل سطر داخله ⇒ إطار داخل إطار. لا خطأ، فقط شكل مشوّه (2026-09-26).',
      check: 'محدِّد نسل عام يحمل حدوداً أو خلفية داخل مكوّن مركّب = مشبوه.',
      severity: 'low'
    },
    {
      id: 'OWN-PRINT-NOT-RASTER',
      rule: 'المستندات متعدّدة الصفحات (الكتالوجات والتقارير) تُصدَّر عبر نافذة الطباعة «حفظ كـPDF»، لا عبر html2canvas.',
      why: 'html2canvas يحوّل كل صفحة إلى صورة نقطية: كتالوج بمئات المنتجات يصير عشرات الميغابايت، نصّه غير قابل للبحث ولا النسخ ويطبع ضبابياً. الطباعة تُخرج PDF نصّياً حقيقياً خفيفاً (2026-09-26).',
      check: 'html2canvas على مستند أطول من صفحة واحدة = مخالفة.',
      severity: 'medium'
    },

    /* ══ قواعد جلسة 2026-09-26 (ج) — الافتراضات والتوافق بين الأنظمة ══ */
    {
      id: 'OWN-DEFAULT-PICK',
      rule: 'حين يحتمل النص أكثر من خيار (مدينة فيها عدّة مكاتب)، يُحسم بجدول افتراضات **معلَن وقابل للتعديل في مكان واحد** — لا بأوّل عنصر في المصفوفة.',
      why: 'اللصق الذكي كان يأخذ أوّل مكتب في المدينة، فـ«دمشق» تعطي «القدم» بينما المالك يريد «فكتوريا». الاعتماد على ترتيب المصفوفة قرارٌ خفيّ لا يعرفه أحد ولا يستطيع المالك تغييره. صار MAIN_OFFICE جدولاً معلَناً موسوماً أيّ قيمة من المالك وأيّها اجتهاد (2026-09-26).',
      check: 'اختيار «الأوّل» من قائمة متعدّدة بلا جدول افتراضات = مخالفة.',
      severity: 'medium'
    },
    {
      id: 'OWN-SPECIFIC-WINS',
      rule: 'الأدقّ يفوز على الأعمّ: اسم مكتب صريح في النص يتقدّم على اسم المدينة — لكن **بعد** التحقّق من أن الاسم ليس اسم مدينة أيضاً.',
      why: 'بعض الشركات تسمّي مكتبها باسم المدينة («درعا» عند مسارات). فمطابقة الأسماء أوّلاً سرقت اختيار «درعا» إلى مسارات بدل المكتب الافتراضي للمفتي. الترتيب الصحيح: مدينة ⇐ افتراضي، وإلا ⇐ اسم مكتب (2026-09-26).',
      check: 'مطابقة اسم قبل التحقّق من كونه مدينة = مخالفة.',
      severity: 'medium'
    },
    {
      id: 'OWN-ARABIC-AL',
      rule: 'مقارنة أسماء عربية تتسامح مع «ال» التعريف: «برامكة» يجب أن تطابق «البرامكة».',
      why: 'الموظّف يكتب الاسم بلا «ال» في أغلب الأحيان، فكان اللصق الذكي لا يلتقط المكتب إطلاقاً ويسقط للاحتياطي بلا سبب ظاهر (2026-09-26).',
      check: 'مقارنة أسماء عربية بـ=== على النص المطبَّع وحده = ناقصة.',
      severity: 'low'
    },
    {
      id: 'OWN-NO-PARALLEL-PATH',
      rule: 'ميزة جديدة تحرّك المخزون أو المال تمرّ عبر المسار المبنيّ أصلاً — تُجهّز مدخلاته ولا تُنشئ مساراً موازياً.',
      why: 'زرّ «تفريغ نقطة البيع» كان يمكن أن يخصم المخزون بنفسه، فيفقد كل حمايات مسار النقل: التحقّق النهائي من الكمية، الخصم الذرّي، وسم deduction_failed، شاشة التسوية، والمسوّدة التي تتيح الاستئناف بعد انقطاع الاتصال. بدلاً من ذلك يملأ فاتورة نقل عادية ويسلّمها للمسار نفسه (2026-09-26).',
      check: 'كتابة مباشرة في المخزون/الصندوق خارج المسار المعتمد = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-STATE-AFTER-OPEN',
      rule: 'إن كانت دالة الفتح تُصفّر الحالة، جهّز الحالة في متغيّر مستقلّ واحقنها **بعد** الفتح — لا قبله.',
      why: 'تفريغ نقطة البيع كان يبني stState ثم يفتح نافذة النقل، وopenNewStockTransferModal يُصفّر stState عند فتحه ⇒ تظهر الفاتورة **فارغة** رغم نجاح كل الخطوات. لا خطأ ولا تحذير — كشفه اختبار حيّ يعدّ البنود (2026-09-26).',
      check: 'ضبط حالة مشتركة قبل نداء دالة فتح/تهيئة = مشبوه.',
      severity: 'high'
    },
    {
      id: 'OWN-SRCDOC-NO-REL',
      rule: 'لا مسار نسبي إطلاقاً داخل srcdoc: لا صورة ولا سكربت ولا نمط. ما يلزم يُضمَّن، وما يُرسَم يُرسَم في الصفحة الأم ويُدرَج ناتجه.',
      why: 'تكرّر العطل نفسه مرّتين في يوم واحد: الشعار اختفى من كل مطبوعة، ثم ورقة الباركود الجديدة وضعت وسم سكربت للمكتبة بمسار نسبي فخرجت **كل الباركودات فارغة** بلا رسالة. الحلّ: رسم الباركود في الصفحة الأم (حيث المكتبة محمّلة) وإدراج SVG جاهز (2026-09-26).',
      check: 'أي src نسبي داخل نصّ srcdoc أو document.write = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-UI-MATCHES-SAVE',
      rule: 'ما تعرضه الواجهة يجب أن يطابق ما يُحفظ فعلاً — بشرط واحد مشترك لا شرطين متوازيين.',
      why: 'حفظ العمولات كان يستثني فواتير الأوردرات المرتبطة استثناءً صحيحاً، لكن الواجهة تحسب وتعرض «💜 عمولتك: $X» أثناء بناء السلة وفي سجلّ الفواتير ⇒ الكاشير يرى عمولة لن تُسجَّل له أبداً، ومراجعة لن تحدث. وُحِّد الشرط في دالة واحدة (2026-09-26).',
      check: 'شرط عرض يكرّر منطق شرط الحفظ بدل أن يناديه = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-WRITE-HAS-READER',
      rule: 'كل ما يُكتب يجب أن تكون له جهة تقرؤه — وإلا فهو ضائع بالتعريف.',
      why: 'أداة التوظيف كانت تحفظ الطلبات في localStorage على متصفّح **المتقدّم نفسه**، والمفتاح cgmt_admin_applications لا تقرؤه أي صفحة في النظام: سجلّ يُكتب ولا يُقرأ أبداً، فلا تصل الشركة أي طلب إلا عبر تيليجرام — وإن فشل ضاع الطلب نهائياً (2026-09-26).',
      check: 'مفتاح تخزين يُكتب ولا يُقرأ في أي ملف = مخالفة (مسحة المختفيات تكشفه).',
      severity: 'high'
    },
    {
      id: 'OWN-NO-BLOB-IN-ROW',
      rule: 'الملفات (سير ذاتية · صور · مرفقات) لا تُخزَّن base64 داخل صفّ الجدول — يُخزَّن وصفها ويبقى الأصل في مخزن الملفات.',
      why: 'صفّ يحمل ملفاً بـbase64 يُضخّم الجدول ويُبطئ **كل** استعلام عليه حتى لو لم يطلب الملف — نفس درس صور المنتجات وحصّة الـegress. جدول طلبات التوظيف يحفظ اسم الملف ونوعه وحجمه فقط (2026-09-26).',
      check: 'عمود نصّي يستقبل base64 لملف = مخالفة.',
      severity: 'medium'
    },

    /* ══ قواعد 2026-09-26 (د) — الطباعة والاستخراج ══ */
    {
      id: 'OWN-TRANSFORM-NOT-PAGINATE',
      rule: 'transform:scale **لا يؤثّر في تقسيم الصفحات** — لتقليص مستند ليبقى في صفحة واحدة استعمل أحجاماً حقيقية (أصناف ضغط) أو zoom، لا transform.',
      why: 'ملصق الشحن كان يُقلَّص بـtransform ويبدو صحيحاً على الشاشة، لكنه يُطبع على **صفحتين** لأن العنصر يحتفظ بارتفاعه في التخطيط. اختبار الشاشة أظهر «مقياس 0.923 ⇒ ورقة واحدة» بينما الطباعة الحقيقية أعطت ١/٢ (2026-09-26).',
      check: 'transform:scale على حاوية مستند مطبوع بنيّة ضبط الصفحات = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-PRINT-NO-BG',
      rule: 'المعلومة الحرجة في مستند مطبوع لا تعتمد على **خلفية ملوّنة** — تُحمل بنصّ ملوّن وحدّ سميك، فتُقرأ ولو أُسقطت الخلفيات.',
      why: 'صندوق «قيمة الطلب» كان أبيض على خلفية حمراء. طابعة الأندرويد أسقطت الخلفية رغم print-color-adjust:exact ⇒ خرج **أبيض على أبيض**، والمبلغ غير مقروء على ورقة تذهب مع الشحنة (2026-09-26).',
      check: 'نصّ فاتح على خلفية ملوّنة في مستند مطبوع = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-CLEAN-ANY-POSITION',
      rule: 'تنظيف نصّ مستخرَج يعالج **كل المواضع** لا الذيل فقط — الناس لا يكتبون بترتيب ثابت.',
      why: 'سطر العنوان كان يُحذف من نهاية كتلة المنتجات فقط، والناس يكتبون العنوان **بعد رقم الهاتف مباشرة** ⇒ «الحسكة» صارت عنواناً **وبنداً وهمياً في المنتجات معاً**. بلاغ المالك حرفياً: «أخذ الحسكة وحطّها عنوان ورجع حطّها كمنتج» (2026-09-26).',
      check: 'تنظيف يعتمد على موضع ثابت (بداية/نهاية) في نصّ حرّ = مخالفة.',
      severity: 'medium'
    },
    {
      id: 'OWN-TRIM-FLOOR',
      rule: 'أي قصّ متكرّر للنصّ يحتاج **أرضية أمان**: لا يُسمح له بابتلاع النصّ كلّه.',
      why: 'قصّ عبارات العنوان من ذيل كتلة المنتجات كان بلا حدّ أدنى، فمرّر ثلاث مرّات على رسالة قصيرة حتى **أفرغ حقل المنتجات تماماً** — بلا خطأ ولا تحذير. الآن لا يُقصّ إن نزل الباقي تحت ثلث الطول (2026-09-26).',
      check: 'حلقة قصّ/استبدال بلا فحص طول الناتج = مخالفة.',
      severity: 'high'
    },
    {
      id: 'OWN-FILL-WHAT-YOU-KNOW',
      rule: 'إن عرف النظام قيمة حقل يقيناً من التحليل، يملؤه — لا يتركه فارغاً لأن «الموظّف سيملؤه».',
      why: 'حسم العنوان كان يعرف الشركة (هافال للحسكة) ولا يكتبها في حقل شركة الشحن إلا إن ذُكرت نصّاً ⇒ بلاغ المالك: «اختار المنطقة والعنوان، بس ما حدّد لهم شركة شحن ولا مكتب» (2026-09-26).',
      check: 'حقل معروفة قيمته يُترك فارغاً = مخالفة؛ املأه واتركه قابلاً للتعديل.',
      severity: 'medium'
    },
    {
      id: 'OWN-NO-INTERNAL-UI-ON-PUBLIC',
      rule: 'لا واجهة داخلية على صفحة زبون: لا أزرار تصليح ولا مفتّش ولا شرائط فحص ولا شاشات تجهيز. المنع افتراضياً، والصفحة الداخلية هي التي تُعلن نفسها.',
      why: 'كانت track_order و store و site و search تحمّل gmt-hints و gmt-staff و gmt-selfcheck و gmt-warmup، فظهر للزبون زر «شو هالزر؟» وزر المفتّش 🔍 وشريط «الفحص الذاتي وجد N مشكلة» وشاشة «تجهيز النظام للعمل بلا إنترنت». بلاغ المالك: «أنا دخلت على رابط التتبع فيه كثير أشياء باينة — هذا شيء كثير خطير جداً جداً» (2026-09-26).',
      check: 'كل سكربت يرسم واجهة داخلية يبدأ بـ gmtInternalUI(); وكل صفحة تحمل window.GMT_INTERNAL=1 أو window.GMT_PUBLIC=1. الغياب ⇒ تُعامل صفحةَ زبون.',
      severity: 'critical'
    },
    {
      id: 'OWN-CONSUME-DONT-GUESS',
      rule: 'في اللصق الذكي: لا تُخمّن «هل يشبه هذا عنواناً؟». احذف بالحرف ما استُهلك فعلاً في حقل العنوان، وما بقي فهو منتج.',
      why: 'التخمين فشل مرّتين على نفس البلاغ: «أي سطر فيه اسم منطقة هو عنوان» ابتلع «عدسة دمشق» كلّها فضاع المنتج؛ و«اقصص المنطقة من ذيل السطر» لم يلتقط «الحسكة عدسة 24-70» لأنّ المنطقة في أوّله. بلاغ المالك: «أخذ الحسكة وحطّها عنوان، ورجع حطّها كمنتج» (2026-09-26).',
      check: 'أي مِصفاة تعتمد «يشبه» بدل «استُهلك» = مخالفة. والمطابقة مطبَّعة مع حفظ إملاء الأصل.',
      severity: 'high'
    },
    {
      id: 'OWN-EAST-DIGITS',
      rule: 'الأرقام الشرقية (٠-٩ و۰-۹) تُحوَّل إلى لاتينية في **كل** مسار يقرأ نصّ الزبون — بدالّة واحدة لا بنسخة في كل مكان.',
      why: 'قارئة الكميّة كانت تحوّلها («عدد ٤» تعمل) ومفتاحُ المنتج لا يحوّلها، فكان «عدسه ٢٤-٧٠» يخرج مفتاحاً فيه أرقام عربية ولا يطابق «Canon RF 24-70mm» إطلاقاً: العدسة الصحيحة تغيب والنتيجة الوحيدة هودٌ بدرجة 0.30. ولوحة المفاتيح العربية تكتب هذه الأرقام افتراضياً — أي أنّ العطل كان يصيب أكثر الزبائن لا أقلّهم. (2026-09-27)',
      check: 'أي مسار يبني مفتاحاً أو يقارن نصّاً بلا تحويل الأرقام الشرقية = مخالفة. والتحويل من مصدر واحد (eastDigits) يستدعيه الباقي.',
      severity: 'high'
    },
    {
      id: 'OWN-TIE-NO-DECIDE',
      rule: 'تساوي الدرجات ليس قراراً: حين يتساوى مرشّحان (فرق ≤ 0.02) بلا تطابق تامّ ولا باركود، لا يُعتمد أحدهما — يُسأل الموظّف.',
      why: 'بلاغ المالك: «كتبت واي ام 600 اس اس فاختار YM600SS كومبو بلس». الاسمان يحتويان ما كُتب فتساوت درجتهما، وكان الفرق يُحسَم بـ«أقرب طول» — وهو حظّ لا دليل: «كومبو بلس» أقصر من «Studio Flash» فكسب، والمنتج الأساس هو الثاني. الطول لا يعرف أيّهما الأصل. (2026-09-27)',
      check: 'المحرّك يضع tie، والواجهة تُنزل المرشَّح المتقارب إلى «بدّه تحديد» ولو كانت درجته ≥ 0.80.',
      severity: 'high'
    },
    {
      id: 'OWN-CONTAIN-NOT-IDENTITY',
      rule: 'الاحتواء دليل صلة لا دليل هويّة: إن بقي في ما كتبه الزبون مميِّزُ موديل لا يفسّره اسم المنتج (رقم، أو حرفان لاتينيّان أو ثلاثة) فالمرشَّح يُعرَض ولا يُعتمد.',
      why: 'بلاغ المالك: «كتبت له كانون ار بي فاختار كانون ار». «canon r p» تحتوي «canon r» فأُعطيت 0.86 — فوق حدّ الاعتماد التلقائي — والحرف الباقي «p» هو بالضبط ما يفرّق RP عن R. (2026-09-27)',
      check: 'قاعدة «ما كُتب يحتوي الاسم» تفحص الباقي؛ الباقي المميِّز يُنزل الدرجة إلى نطاق «بدّه تحديد».',
      severity: 'high'
    },
    {
      id: 'OWN-RULE-NEEDS-TOOL',
      rule: 'كل قاعدة تخصّ تطابق شيئين مكتوبين مرّتين تحتاج أداةً تفحصها آلياً، وتُشغَّل قبل النشر. قاعدةٌ بلا أداة = نيّة.',
      why: 'قاعدة «أي تعديل في gmt-suggest.js يقابله تعديل في نسخة الجافا» كانت مكتوبة في أربعة ملفّات، وكنّا نتحقّق منها بأدوات مؤقّتة تضيع بانتهاء الجلسة. فبقيت بلا وسيلة تحقّق دائمة: نُصلح عطلاً في الجافاسكربت وننسى الجافا، فيرى الموظّف نتيجةً في النظام وأخرى في الفقاعة لنفس ما كتبه — عطل صامت متقطّع يُلام عليه الموظّف. (2026-09-27)',
      check: 'فحص_تطابق_المحركين.py (المحرّكان) و GMTBubble/فحص_الفقاعة.py (اختبارات core) يُشغَّلان قبل أي نشر ويخرجان بخطأ عند أوّل اختلاف.',
      severity: 'high'
    },
    {
      id: 'OWN-VENDOR-PATHS',
      rule: 'أي مكتبة تُنزَل من CDN إلى lib/ تُفحَص بعدها في متصفّح حقيقي: مساراتها الداخلية (خطوط · صور · خرائط) لا تصحّ بمجرّد نسخ الملفّات.',
      why: 'lib/fa/all.min.css كانت تطلب ../webfonts/ — وهو صحيح في توزيع CDN حيث يجاور css مجلّدَ webfonts، أمّا عندنا فالملفّ في lib/fa/ والخطوط في lib/fa/webfonts/، فكان الطلب يذهب إلى lib/webfonts/ ويفشل. فظهرت كل أيقونات FontAwesome (fa-check · fa-shield-alt · fa-spinner) مربّعاتٍ فارغة في صفحتَي الكفالة والبحث — بلا أي خطأ جافاسكربت وبلا أن يشتكي أحد. (2026-09-27)',
      check: 'بعد إنزال أي مكتبة: افتح صفحةً تستعملها وراقب الطلبات الفاشلة (requestfailed) لا وحدها أخطاء الجافاسكربت. وأي تعديل على ملفّ مورَّد يُكتَب سببه في رأسه كي يُعاد بعد أي تحديث للمكتبة.',
      severity: 'high'
    },
    {
      id: 'OWN-PRUNED-CSS',
      rule: 'نسخة Tailwind عندنا **مقصوصة**: أي صنف تكتبه ولم تكن الصفحة تستعمله وقت البناء غير موجود فيها. عرّفه في gmt-theme.css أو استعمل صنفاً موجوداً.',
      why: 'بلاغ المالك بالصورة: «القائمة المنسدلة عم تنزل ولكن عم يبقى المنتج اللي بالأسفل فوقها». الصنف z-30 مكتوب في HTML وغير معرَّف في lib/tailwind.css، والمتصفّح يتجاهل الصنف المجهول بصمت — فبقيت القائمة z-index:auto واندفنت تحت الصفوف. وكشف الفحص 21 صنفاً آخر في نفس الصفحة (ألوان وأحجام خطّ) كانت تُتجاهَل كلّها، بعضها من قبل هذه الجلسة. (2026-09-27)',
      check: 'فحص_أصناف_ناقصة.py قبل أي نشر: يقارن أدوات Tailwind المستعملة في class="…" بما هو معرَّف في كل CSS ويخرج بخطأ عند أوّل ناقص.',
      severity: 'high'
    },
    {
      id: 'OWN-NO-BLIND-NAME-MATCH',
      rule: 'لا تُطابِق منتجاً باحتواء الاسم (`includes`) ثمّ تتصرّف بالنتيجة. المطابقة بمحرّك واحد وبعتبة يقين، وما دونها يُعرَض على الإنسان.',
      why: 'كانت تعبئة سلّة الفاتورة من الأوردر تفعل: allProducts.find(x => x.name.toLowerCase().includes(nm)) — فـ«كروما» تُطابق أوّل منتج يحتوي الكلمة («كروما مجموعة كاملة») فتدخل الفاتورة **ويُخصم مخزون منتج آخر**. خطأٌ صامت في المخزون — وهو ما بُني هذا النظام كلّه لمنعه. (2026-09-27)',
      check: 'أي مطابقة منتج خارج gmt-suggest، أو أي اعتماد تلقائي تحت 97%، = مخالفة.',
      severity: 'critical'
    },
    {
      id: 'OWN-RESET-ON-OPEN',
      rule: 'نموذج الإدخال يُصفَّر **عند فتحه**، لا بعد الحفظ فقط. والتصفير يمرّ على عناصر DOM لا على قائمة أسماء مكتوبة بيد.',
      why: 'بلاغ المالك: «لمّا بضيف طلب وبخرج، عم برجع بعطي إضافة طلب عم يضلّ مع البيانات القديمة». التصفير كان في onsubmit وحده، ومن يخرج بالـ✕ لا يمرّ منه. واسم زبون قديم مع رقم قديم في أوردر جديد ليس إزعاجاً — هو شحنةٌ تذهب لشخص آخر. وقائمة الأسماء المكتوبة بيد تتقادم بصمت لحظة إضافة أي حقل. (2026-09-27)',
      check: 'فتح النموذج بعد خروجٍ بلا حفظ يجب أن يُعطي حقولاً فارغة بقيم HTML الافتراضية.',
      severity: 'high'
    },
    {
      id: 'OWN-ONE-AUTH-SOURCE',
      rule: 'كلمة السرّ تُفحَص من مصدر واحد (gmt-auth.js). ممنوع أن تقارن صفحةٌ بنصٍّ مكتوب في الشيفرة أو بمتغيّر خاصّ بها.',
      why: 'كان في النظام مساران للسيادية: admin_sovereign يحفظ localStorage[gmt_pw_sovereign]، بينما inventory و purchase و gmt-staff تقارن بـ window.GMT_SOVEREIGN_PW || "gmt-sovereign" — ومتغيّرٌ **لا يضبطه أي سطر في المشروع**. فمن يغيّر الكلمة يظنّ أنّها تغيّرت، وفكّ ختم الجرد وفكّ ختم المشتريات يقبلان الكلمة المكتوبة نصّاً في ملفّات منشورة على الإنترنت. أخطر الأزرار كان محروساً بكلمة يعرفها كل من فتح الشيفرة، وتغييرها لا يفعل شيئاً. (2026-09-27)',
      check: 'أي مقارنة كلمة سرّ خارج GMTAuth.check = مخالفة. والبحث عن نصوص كلمات سرّ في الشيفرة يجب أن يعود فارغاً.',
      severity: 'critical'
    },
    {
      id: 'OWN-JSONB-NOT-ILIKE',
      rule: 'لا تُرشِّح عمود JSON بـ`ilike` على الخادم. رشِّح في المتصفّح، أو اجعل للخادم مساراً احتياطياً.',
      why: 'زرّ «عرض فاتورة المنتج» في الجرد كان يستعلم items_snapshot=ilike.*باركود* — و`ilike` لا تعمل على jsonb في PostgREST فيعود 400 وتظهر «تعذّر البحث في الفواتير». والمفارقة أنّ نفس الصفحة تقرأ هذه الفواتير بنجاح في مكان آخر لأنّها تجلب الأحدث وتُرشّح في المتصفّح — أي أنّ الطريق الصحيح كان مُجرَّباً في نفس الملفّ. (2026-09-27)',
      check: 'أي فلتر نصّي على عمود JSON يحتاج مساراً احتياطياً يُجرَّب فعلياً.',
      severity: 'high'
    },
    {
      id: 'OWN-UI-OFFERS-WHAT-SERVER-ALLOWS',
      rule: 'إن قبل الخادم إجراءً على حالة ما، فالواجهة يجب أن تعرضه في تلك الحالة. الفجوة بينهما تدفن السجلّات بلا طريق خروج.',
      why: 'فواتير النقل الموسومة needs_settlement كان الخادم يقبل استلامها (status=in.(pending,needs_settlement)) بينما الواجهة تعرض زرّ الاستلام لحالة pending وحدها. فبقيت الفواتير «معلّقة في الطريق» بلا أي زرّ — بلاغ المالك. (2026-09-27)',
      check: 'كل حالة يقبلها الخادم في فلتر PATCH يجب أن يقابلها عرضٌ في الواجهة، أو سببٌ مكتوب لعدم عرضها.',
      severity: 'high'
    },
    {
      id: 'OWN-FORMAT-IS-A-CONTRACT',
      rule: 'صيغة أي قيمة مخزَّنة عقدٌ بين كاتبها وقارئها. من يغيّر الصيغة يمرّ على **كل** من يقرأها قبل أن يحفظ أوّل قيمة بالصيغة الجديدة.',
      why: 'أداة «الأمان والمستخدمون» صارت تحفظ كلمات السرّ **كبصمة** لا كنصّ. ودخول admin_pos كان يقارن نصّاً صريحاً (pwd === value) — فأوّل كلمة تُحفَظ من الأداة الجديدة كانت ستقفل باب الأدمن في وجه صاحبه. أي أنّ الميزة الجديدة كانت ستكسر ما يعمل، ولولا قراءة ذلك السطر لَما ظهر العطل إلّا عنده. وللسطر نفسه عطلٌ ثانٍ: لو لم يكن للمفتاح صفّ في القاعدة فالقيمة undefined ولا أحد يدخل إطلاقاً. (2026-09-27)',
      check: 'قبل تغيير صيغة قيمة مخزَّنة: ابحث عن كل قارئ لها في المشروع وحدّثه، أو اجعل القارئ يفهم الصيغتين.',
      severity: 'critical'
    },
    {
      id: 'OWN-INK-NOT-BACKGROUND',
      rule: 'كل لون يحمل معنى في مستند مطبوع يُرسَم بـ`<img>` لا بـ`background`. خيار «بلا خلفيات» في الطابعة يُسقط ألوان وصور الخلفية ولا يمسّ عناصر الصور.',
      why: 'تكرّر ثلاث مرّات: ① المبلغ خرج أبيض على أبيض حين أسقطت طابعة الأندرويد خلفية البطاقة الحمراء. ② ثمّ بلاغ المالك: «الشفوفية وراء السطور في الجدول عم تروّحها طابعة الأندرويد». ③ وتظليل ترويسة الجدول معهما. كلّها ألوانٌ صحيحة في الشيفرة وغائبة على الورق — ولا خطأ في أي مكان. (2026-09-27)',
      check: 'أي لون في مطبوعة يعتمد `background` وحده = مخالفة. والتحقّق بتوليد PDF بـprintBackground:false ومقارنة البكسلات، لا بالنظر إلى الشاشة.',
      severity: 'high'
    },
    {
      id: 'OWN-COPY-CARRIES-THE-CALL-NOT-THE-DEF',
      rule: 'نسخُ سطرٍ بين صفحتين ينقل الاستدعاء ولا ينقل التعريف: كل صفحة هنا عالَمٌ مستقلّ بلا bundler ولا import. من ينسخ سطراً ينسخ معه ما يحتاجه أو يتركه خلفه.',
      why: 'الجسر كان يستدعي _waitForGMTCache وهي معرَّفة في inventory.html و purchase.html فقط ⇒ «waitForGMTCache is not defined» على شاشة المالك. وبالفحص وُجد النمط نفسه في أربع صفحات: sbFetch و showLoading و hideLoading في نقطة البيع (فمات مسار تأكيد فواتير النقل كلّه بصمت)، hideLoading في المشتريات، updateCartTotals في المتجر.',
      check: 'شغّل فحص_التعريفات.py: لا اسم يُستدعى في صفحة دون أن يكون معرَّفاً فيها أو في ملفّ تستدعيه.',
      severity: 'critical'
    },
    {
      id: 'OWN-AND-GUARD-IS-NOT-A-GUARD',
      rule: '«fn && fn()» ليس احتياطاً لاسمٍ غير معلَن — قراءته وحدها ترمي ReferenceError قبل أن يُقيَّم &&. الاحتياط الوحيد هو typeof fn === "function".',
      why: 'المتجر: «updateCartTotals && updateCartTotals()» كان يُسقط كل تطبيق كوبون في catch ويعرض «تعذّر التحقق» حتى للكوبون الصحيح. ونقطة البيع: «showLoading && showLoading(...)» كان يقتل تأكيد الاستلام من أوّل سطر. كاتبُهما ظنّ نفسه محتاطاً.',
      check: 'ابحث عن «X && X(» حيث X غير معلَن في الصفحة — إمّا تُعرَّف أو يُستبدل الحارس بـ typeof.',
      severity: 'critical'
    },
    {
      id: 'OWN-INDEX-NEEDS-ROWS',
      rule: 'لا فهرس ولا قيد على ما ليس صفوفاً: ما يُخزَّن مصفوفةَ JSON داخل عمودٍ واحد يُحرَس بـ trigger يفحص المصفوفة، لا بـ unique index.',
      why: 'ملفّ SQL ١٢ وعد بتفرّد inv_id بفهرس على public.products، ومنتجات المتجر مصفوفة JSON داخل صفٍّ واحد من gmt_store ⇒ «ERROR: 42703: column inv_id does not exist» عند أوّل تشغيل حقيقي. لم يكن اسم جدولٍ خاطئاً بل ضماناً مستحيل الشكل.',
      check: 'قبل كتابة أي قيد أو فهرس، افتح الكود الذي يكتب هذه البيانات واقرأ شكلها الفعلي — لا شكلها المتوقَّع.',
      severity: 'critical'
    },
    {
      id: 'OWN-TOOL-MUST-BE-BROKEN-ON-PURPOSE',
      rule: 'أي أداة فحص تُختبَر بكسرٍ متعمَّد قبل الوثوق بها: تُكسَر فتُنذر، ويُرجَع الكسر فتسكت. وإلّا فهي طمأنينة لا فحص.',
      why: 'فحص_ملفات_SQL.py لم يلتقط ملفّ ١٢ — العطل الذي كُتب من أجله — بسبب نسبة الجدول لأقرب رابط. وفحص_التعريفات.py في أوّل نسخه أنذر عن initAdmin وهي معرَّفة، لأنّ accept="image/*" فتح تعليقاً لم يُغلق فابتلع نصف الملفّ. أداةٌ تطمئن خطأً أسوأ من لا أداة، وأداةٌ تُنذر كذباً تُهمَل.',
      check: 'لكل أداة: اكسر ما تفحصه عمداً وأثبت أنّها تلتقطه، ثم أرجعه وأثبت أنّها تصمت.',
      severity: 'high'
    },
    {
      id: 'OWN-SKIM-IS-NOT-READ',
      rule: 'المرور على نصٍّ بالبحث عن كلماتٍ مفتاحية ليس قراءةً له. من حكم على ألف سطرٍ من عناوينها فقد قرأ العناوين — ولا يصحّ أن يقول «قرأتُ الملفّ كاملاً». إن بقي جزءٌ لم يُقرأ سطراً سطراً، قُل مقداره بالضبط قبل أي استنتاج.',
      why: 'في وثيقة 2026-10-03 حكمتُ على 1752 سطراً (40% من الملفّ) من عناوينها فاعتبرتُها منهجيّةً عامّة. وكان في آخرها ثمانية طلبات عمل حقيقية: أنّ ألمانيا والصين مخزونٌ بالشحن لا فرعان (وهو جوابُ سؤالٍ كنتُ سألتُه للمالك)، وميزتان في إنشاء الأوردر يقول المالك إنّهما اختفتا، وشجرة أنواع المصاريف، وتغييرُ اتّجاه ملفّ الفقاعة كلّه.',
      check: 'بعد قراءة أي وثيقة: احسب الأسطر المقروءة سطراً سطراً مقابل إجمالي الأسطر، وأعلن الفارق. لا تَصِف قراءةً جزئية بأنّها كاملة.',
      severity: 'critical'
    },
    {
      id: 'OWN-UNCLEAR-IN-IMAGE-IS-A-GUESS',
      rule: 'ما لا يظهر بوضوحٍ في صورةٍ مرجعية يُقال عنه «استنتاجٌ محتمل» لا «حقيقة»، ويُطلب من المالك ما تعذّرت قراءته ومكانُه بالتحديد.',
      why: 'نصّ المالك: «إذا كان شيء غير واضح من الصورة، لا تخترعه على أنه حقيقة — قل إنه استنتاج محتمل»، و«إذا تعذّر عليك الوصول إلى صورة أو نصّ: أخبرني تحديداً أنّ هذا الجزء لم تتمكّن من قراءته وحدّد مكانه».',
      check: 'كل استنتاجٍ من صورة: إمّا مقروءٌ بوضوح، أو موسومٌ «محتمل»، أو مذكورٌ في قائمة «ما تعذّر عليّ».',
      severity: 'high'
    },
    {
      id: 'OWN-CHECK-RES-OK-BEFORE-JSON',
      rule: 'لا تُقرأ `res.json()` قبل فحص `res.ok`. ردُّ الخطأ كائنٌ لا مصفوفة، فيُقرأ «لا نتائج» ويُقال للمستخدم إنّ سجلّه غير موجود.',
      why: 'وُجد في صفحتين **للزبون**: بحث الكفالة (search.html) وتتبّع الطلب (track_order.html). في كلتيهما رفضُ القاعدة 400 كان يُعرَض «لم يتم العثور على كفالة» و«الرقم المدخل غير صحيح» — والسجلّ موجود، والقاعدة لم تُسأل عنه أصلاً.',
      check: 'كل `await res.json()` يسبقه `if (!res.ok) throw`. ولا رسالة «غير موجود» تُعرَض إلّا بعد ردٍّ ناجح فعلاً.',
      severity: 'critical'
    },
    {
      id: 'OWN-EMPTY-IS-NOT-AN-ANSWER',
      rule: 'الفراغ المعروض يجب أن يُفسَّر: «فشل الطلب» و«نجح وردّ لا شيء» و«لا تطابق للبحث» ثلاث حالاتٍ لها ثلاث رسائل، لا رسالةٌ واحدة ولا صمت.',
      why: 'بلاغ المالك «لوحة الكفالات فارغة». واللوحة كانت تصمت في الثلاث: 200 بقائمةٍ فارغة (سياسة RLS تحجب بلا خطأ) تُقرأ «لا توجد كفالات» فيظنّ أنّ كفالاته ضاعت.',
      check: 'كل عرضٍ فارغ: هل يقول أيُّ الحالات الثلاث هي، وما الذي يفعله المالك الآن؟',
      severity: 'critical'
    },
    {
      id: 'OWN-ORDER-IS-DROPPED-BEFORE-DATA',
      rule: 'في القراءة المتدرّجة، الترتيب أوّل ما نتخلّى عنه والبيانات آخر ما نخسره. عمودُ ترتيبٍ لا تعرفه القاعدة يُسقِط الطلب كلّه.',
      why: 'لوحة الكفالات كانت `order=id.desc` في طلبٍ واحد. وقاعدة الكفالة أقدم من النظام ولم يُشغَّل عليها SQL، فغيابُ `id` وحده يُفرِغ اللوحة بـ400.',
      check: 'كل `order=` له بديلٌ ثمّ لا ترتيب. وكل `select=` فيه عمودٌ غير أساسيّ له محاولةٌ أبسط.',
      severity: 'high'
    },
    {
      id: 'OWN-SEARCH-FIELD-BY-FIELD',
      rule: 'البحث في عدّة حقول يُسأل حقلاً حقلاً، لا بـ`or=(…)` واحدة. وما أمكن البحث فيه محلّياً يُبحَث محلّياً.',
      why: 'نمط P1: حقلٌ رقميٌّ واحد يرفض نصّاً ⇒ يسقط البحث كلّه. حدث بـ`serial_number` قبلاً وبـ`internal_no` قبلها، وفي كل مرّة صُحِّح الاسمُ ولم تُحصَّن البنية. وقوسٌ في كلمة البحث يكسر `or=(…)` لأنّ encodeURIComponent لا يُرمِّز الأقواس.',
      check: 'لا `or=(` فيه أكثر من حقلٍ على قاعدةٍ لا نملك مخطّطها. وفشلُ حقلٍ لا يُسقِط البقيّة.',
      severity: 'critical'
    },
    {
      id: 'OWN-UNEARNABLE-METRIC-IS-A-LIE',
      rule: 'رقمٌ لا يمكن كسبه لا يُعرَض رقماً. إن كان القياس غير موصول فقُل «غير مقيس» لا «صفر».',
      why: 'تقرير المفتّش قال «تغطية الميزات: 0/52». والصفر كان يعني «لا علامة قياسٍ في النظام كلّه» لا «٥٢ ميزةً مكسورة» — فقرأه المالك فشلاً وقال «لا تعتمدها كثير».',
      check: 'كل مقياس في تقرير: ما الفعل الذي يرفعه؟ إن لم يوجد، فالتقرير يقول ذلك صريحاً.',
      severity: 'high'
    },
    {
      id: 'OWN-FIX-THE-CLASS-NOT-THE-SPOT',
      rule: 'بعد إصلاح موضعٍ، يُفتَّش عن أشقّائه في المشروع كلّه ويُصلَحون في النشرة نفسها. إصلاحُ موضعٍ وتركُ مثله ليس إصلاحاً.',
      why: 'رابط المستودع القديم `Tracking_system` صُحِّح في زرّ فاتورة المتجر (2026-08-26) وبقي في قائمة المتجر الجانبية. و`ADM-1` (2026-07-13) كشفت أنّ `buildAdminTourSteps` غير معرَّفة فأصلحت **الزرّ** وتركت الكتلة الميّتة ورسالتَها الكاذبة فوقه.',
      check: 'كل إصلاح: هل بحثتُ عن النمط نفسه (بـgrep) في كل الملفّات؟ وهل أُدرِج عدد المواضع في وصف الإصلاح؟',
      severity: 'critical'
    },
    {
      id: 'OWN-ONE-NAME-FOR-ONE-PAGE',
      rule: 'لصفحةٍ واحدة اسمٌ واحد في مصدرٍ واحد. كل سجلٍّ يسمّي صفحةً يُراجَع عند تغيير اسمها، ويُهاجَر ما زُرع على أجهزة المستخدمين.',
      why: 'شهادةُ الكفالة اسمها `guarantee.html`، وكانت تُنادى بثلاثة أسماءٍ خاطئة: `search.html` (زرعناه في localStorage) و`index.html` (صفحة العميل تُحوّله إليها) — فزرّ العين ميّتٌ منذ أوّل يوم، والعميل يُرمى على بوّابة النظام الداخلية. وأنماطُ التعرّف على الصفحات كانت تلاحق أسماءً ملغاة (`10_إنشاء_الكفالة`) فسقطت صفحات الكفالة والعقود إلى «كاشير صامت».',
      check: 'عند تغيير اسم ملفّ: LINKS · SEED · أنماط PAGES · كل تحويلٍ في صفحات الزبون · ومُهاجرةُ القيمة المزروعة قديماً.',
      severity: 'critical'
    },
    {
      id: 'OWN-GUARD-THE-FACT-NOT-THE-PATH',
      rule: 'الشرط الماليّ يُبنى على **حقيقة** السجلّ لا على المسار الذي أنشأه. ما يصير صحيحاً بعد سطورٍ يجب أن يُحسَب قبل الكتابة.',
      why: 'قرار المالك ت٩ «فواتير الأوردرات بلا عمولة» كان مشروطاً بـ`_orderMode === \'existing\'` — أي بالمسار. وفي الوضع `\'new\'` تُكتَب العمولة في الخطوة ٥ ثمّ تُربَط الفاتورة بالأوردر في الخطوة ٦٫٧ ⇒ فاتورةٌ مرتبطةٌ بأوردر ولها عمولة. والإرجاع يفحص `order_id` فلا يعكسها.',
      check: 'كل شرطٍ ماليّ: هل يصحّ لو أُنشئ السجلّ من مسارٍ آخر؟ وهل تتغيّر حقيقتُه بعد تنفيذ الشرط؟',
      severity: 'critical'
    },
    {
      id: 'OWN-ONE-CONCEPT-ONE-DEFINITION',
      rule: 'المفهوم الواحد يُعرَّف مرّةً واحدة في النواة. تعريفُه في كل ملفّ يُنتج قوائمَ متفاوتة، ويبقى موضعٌ بلا تطبيق.',
      why: 'قرار ق١١ (ألمانيا والصين مخازن لا نقاط بيع) كان مُعرَّفاً ثلاث مرّات: `EXCLUDED_BRANCHES` في الأدمن (فيها «ألمانيا») و`EXCLUDED_BRANCH_KEYS` في نقطة البيع (فيها «zhongguo») و`isTransit` في الجرد. فبقيت الصفحة الرئيسية وحدها بلا استثناء ⇒ ألمانيا بمبيعات ٣٠٠$ وعمولة ٣٠$ (الصورة ٣٧). و`filteredComm` لم تستثنِ إطلاقاً.',
      check: 'كل مفهومٍ يتكرّر في ملفّين: هل له مصدرٌ واحد في gmt-core.js تقرؤه البقيّة؟',
      severity: 'critical'
    },
    {
      id: 'OWN-ZERO-PRIVILEGE-BY-ONE-GATE',
      rule: '«صلاحيةٌ صفر» تُنفَّذ ببوّابةٍ واحدة تُحوّل كل كتابةٍ إلى قاعدةٍ وهمية، لا بشروطٍ متفرّقة عند كل كتابة.',
      why: 'قرار ت٣ (مستخدم التجربة مخفيٌّ وبصلاحيةٍ صفر). مواضعُ الكتابة عشرات، ونسيانُ واحدٍ يُبطل الحماية كلّها. والوضع التدريبي `GMTSandbox` موجودٌ أصلاً ويفعل هذا تماماً. ومع ذلك وُجد **مسارُ دخولٍ ثانٍ** في تطبيق العقود بلا فرعٍ ولا بوّابة.',
      check: 'كل حسابٍ محدود الصلاحية: هل يمرّ من بوّابةٍ واحدة؟ وهل أُغلقت **كل** مسارات الدخول لا واحدٌ منها؟',
      severity: 'critical'
    },
    {
      id: 'OWN-NO-PROMISE-IN-A-DISABLED-BUTTON',
      rule: 'الزرّ المعطَّل يقول الحقيقة لا الوعد. و«غير متوفّر بعد» وعدٌ — فإن كان الشيء غير موجودٍ أصلاً فقُلها واعرض البديل.',
      why: 'زرّ تتبّع الرافدين كان يقول «التتبع غير متوفر لهاي الشركة **بعد**»، وجواب المالك على ق٢: «مافي الها». فالوعدُ يُبقيه يسأل عن شيءٍ لا وجود له، وأرقامُ مكاتب الرافدين (٣٢ مكتباً) موجودةٌ عندنا كبديلٍ حقيقيّ.',
      check: 'كل زرٍّ معطَّل: هل سببُه مؤقّتٌ فعلاً؟ وهل هناك بديلٌ نملكه الآن نعرضه بدله؟',
      severity: 'high'
    },
    {
      id: 'OWN-A-WAITING-SCREEN-NEEDS-A-HARD-CAP',
      rule: 'كل شاشةٍ تنتظر شيئاً (انترو · تحميل · تحقّق) لها **سقفٌ زمنيٌّ صارم** تنصرف بعده مهما كان حال ما تنتظره.',
      why: 'قرار المالك ت٢ جعل الانترو يُغطّي زمن تحميل الصور والبيانات. وشاشةٌ تنتظر «الجهوز» تصير **قفلاً** إن تعطّلت القاعدة أو عُلّقت مهمّة — فتتحوّل ميزةٌ إلى طريقٍ جديدٍ للتجمّد. وأثبت الفحص ذلك: بإزالة السقف بقيت الشاشة ١٦ ثانيةً ولم تنصرف.',
      check: 'كل انتظارٍ في الواجهة: ما سقفُه؟ وهل جُرِّب بمهمّةٍ لا تنتهي أبداً؟',
      severity: 'critical'
    },
    {
      id: 'OWN-LATE-REGISTRATION-MUST-BE-HEARD',
      rule: 'ما يُسجَّل بعد بدء الانتظار يجب أن يُسمَع. التقاطُ القائمة مرّةً واحدة يُهمل كلّ متأخّر — بصمت.',
      why: 'أوّل بناءٍ لجهوز الانترو قرأ `tasks` مرّةً عند الإقلاع، والصفحات تُسجّل ما تنتظره **بعد** ذلك بأجزاء من الثانية. فكانت القائمة فارغةً دائماً والانترو ينصرف بلا انتظار البيانات — أي نقيض غايته. كشفه الفحص لا القراءة.',
      check: 'كل قائمةٍ تُقرأ مرّةً: هل يمكن أن تُملأ بعد القراءة؟ أضِف مهلة استقرارٍ وأعِد الفحص.',
      severity: 'high'
    },
    {
      id: 'OWN-TEST-SERVER-MUST-NOT-CACHE',
      rule: 'خادمُ الفحص يُرسل `no-store`. وإلّا فحصتَ نسخةً قديمة وصادقتَ على إصلاحٍ لم يُحمَّل.',
      why: 'فحصُ الانترو كان يُبدّل الملفّ على القرص بين السيناريوهات، فيُقدّم المتصفّح النسخة المخزَّنة. فقال «النسخة المكسورة غادرت» — والمكسورة لم تُحمَّل أصلاً. أداةُ فحصٍ تُصادِق على ما لم تَفحصه أسوأ من غياب الأداة.',
      check: 'كل أداة فحصٍ تُبدّل ملفّاً: هل خادمُها يمنع التخزين؟',
      severity: 'high'
    },
    {
      id: 'OWN-NEW-LAYER-BREAKS-OLD-MEASURES',
      rule: 'كل طبقةٍ تُغطّي الشاشة (انترو · نافذة · شريط) تُفسد كل قياسٍ هندسيٍّ سابق. تُراجَع الفحوص القائمة مع إضافتها لا بعدها.',
      why: 'بإضافة الانترو سقط فحصُ زرّ التحديث: كان يسأل المتصفّح «من العنصر عند هذه النقطة؟» فصار الجواب طبقةَ الانترو. والفحصُ لم يكن خاطئاً ولا الزرُّ مكسوراً — الطبقةُ الجديدة غيّرت ما يُقاس.',
      check: 'بعد أي طبقةٍ جديدة: أعِد كل الفحوص الهندسيّة، واكتم الطبقة فيها عمداً لا عرضاً.',
      severity: 'high'
    }
  ];
}());


/* ── gmt-bugcatcher.js ── */
;/* ═══════════════════════════════════════════════════════════════════════
   gmt-bugcatcher.js — الحارس 🐞 v3
   يُرفع بجانب كل صفحة ويُستدعى **أول شيء** بالرأس (قبل أي سكربت آخر).

   ما تغيّر عن v2 (وهو سبب أن أخطاءك عاشت شهوراً بلا دليل):
   ① 💾 يحفظ فعلاً — v2 كان يخزّن بالذاكرة فقط، فأي تحديث أو تعليق للصفحة
      يمسح التقرير. v3 يحفظ بـlocalStorage ويصمد عبر الجلسات.
   ② 🤫 وضع صامت — الكاشير لا يرى زر 🐞 ولا أي نافذة. يسجّل بالخلفية فقط.
   ③ 📡 يرسل للأدمن — كل خطأ يذهب لجدول gmt_telemetry، فتراه أنت بلوحة
      «صحة النظام» لحظياً من كل نقاط البيع، بلا أن يخبرك أحد.
   ④ 🧬 يكشف أعطالاً كان يفوّتها:
      • كتابتان على **نفس الصف** خلال ثانيتين (هذا بالضبط نمط مضاعفة فاتورة
        الشراء — لو كان موجوداً لَكُشِف من أول فاتورة).
      • عمود مفقود بالقاعدة (PGRST204 / 42703) — يترجمها لرسالة مفهومة.
      • تجميد الواجهة (Freeze) عبر نبض rAF.
      • كتابة نجحت شكلاً ولم تُعدّل أي صف.
      • زر بلا أثر · بطء · تكرار · مخزون لم يُخصم.

   التعريف بالمستخدم (سطر واحد بكل صفحة بعد تسجيل الدخول):
      GMTBug.identify({ user:'محمد', branch:'حلب', role:'cashier', page:'نقطة البيع', pageId:'pos' });
   فتح اللوحة يدوياً (للأدمن/الدعم): Ctrl+Shift+B  أو  ضغطة مطوّلة على اللوجو.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTBug && window.GMTBug.version >= 3) return;

  /* ─────────── الإعدادات ─────────── */
  const MAX_LOCAL = 400;
  const LS_KEY = 'gmt_bugs_v3';
  const SS_KEY = 'gmt_session_v3';
  const FLUSH_MS = 12000;
  const SEV_AR = { crit: '🔴 حرج', warn: '🟠 تحذير', info: '🔵 ملاحظة' };

  const t0 = Date.now();
  let queue = [];              // بانتظار الإرسال
  let errors = [];             // كل ما بهذا الجهاز (يصمد)
  let ident = { user: '', branch: '', role: '', page: document.title || '', pageId: '' };
  let silent = true;           // 🔒 صامت افتراضاً حتى يثبت أن المستخدم أدمن (كان false ⇒ الكاشير يرى الزر)

  /* ─────────── الجلسة ─────────── */
  const sid = (function () {
    try {
      let s = sessionStorage.getItem(SS_KEY);
      if (!s) { s = 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); sessionStorage.setItem(SS_KEY, s); }
      return s;
    } catch (_) { return 'S' + Date.now().toString(36); }
  })();

  /* ─────────── التخزين الدائم ─────────── */
  function load() { try { errors = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (_) { errors = []; } }
  function persist() {
    try {
      if (errors.length > MAX_LOCAL) errors = errors.slice(-MAX_LOCAL);
      localStorage.setItem(LS_KEY, JSON.stringify(errors));
    } catch (_) { /* الحصة ممتلئة — نُبقي الأحدث */ try { errors = errors.slice(-100); localStorage.setItem(LS_KEY, JSON.stringify(errors)); } catch (__) {} }
  }
  load();

  /* ─────────── إعدادات القاعدة (تكتشف نفسها من الصفحة) ─────────── */
  let sniffed = null;               // إعدادات مُلتقَطة من طلبات الصفحة نفسها
  function sb() {
    const url = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_URL) || window.SUPABASE_URL || window.SUPA_URL ||
                (window.CONFIG && (CONFIG.SUPABASE_URL || CONFIG.supabaseUrl)) || (sniffed && sniffed.url);
    const key = (window.GMT_CONFIG && GMT_CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY || window.SUPA_KEY ||
                (window.CONFIG && (CONFIG.SUPABASE_ANON_KEY || CONFIG.supabaseKey)) || (sniffed && sniffed.key);
    return (url && key) ? { url: String(url).replace(/\/$/, ''), key } : null;
  }
  /* 🔑 التقاط المفتاح من أي طلب تُرسله الصفحة نفسها لسوبابيس.
     السبب: 13 من 17 صفحة لا تستدعي gmt-config.js — المفاتيح مضمَّنة بداخلها.
     بدون هذا الالتقاط كان الحارس يحفظ محلياً و**لا يرسل شيئاً للوحة الأدمن أبداً**. */
  function sniff(url, init) {
    if (sniffed) return;
    try {
      const u = new URL(url, location.href);
      if (!/supabase\.co$/i.test(u.hostname) || !/\/rest\/v1\//.test(u.pathname)) return;
      let key = u.searchParams.get('apikey');
      const h = init && init.headers;
      if (!key && h) {
        if (typeof h.get === 'function') key = h.get('apikey');
        else key = h.apikey || h.Apikey || h.APIKEY;
      }
      if (key) { sniffed = { url: u.origin, key }; window.GMT_SB = sniffed; }
    } catch (_) {}
  }

  const redact = (u) => String(u || '').replace(/([?&](apikey|token|key|authorization)=)[^&]+/gi, '$1***');
  const now = () => new Date().toLocaleTimeString('ar-SY', { hour12: false });
  const training = () => !!(window.GMTSandbox && window.GMTSandbox.active);

  /* عدّادات الضجيج (2026-07-23): تُجمّع الأخطاء التافهة بدل تكرارها */
  var NOISE = { productImgs: 0, htmlAsImg: 0 };

  /* ─────────── تسجيل خطأ ─────────── */
  function add(sev, type, msg, detail, url) {
    const key = type + '|' + String(msg).slice(0, 60);
    const dup = errors.find((e) => e._k === key && Date.now() - e.ts < 60000);
    if (dup) { dup.count = (dup.count || 1) + 1; persist(); paint(); return; }

    const rec = {
      _k: key, ts: Date.now(), t: now(), sev, type,
      msg: String(msg || '').slice(0, 400),
      detail: String(detail || '').slice(0, 600),
      url: redact(url || ''), count: 1,
      page: ident.page, pageId: ident.pageId,
      user: ident.user, branch: ident.branch, role: ident.role,
      training: training(),
    };
    errors.push(rec);
    queue.push(rec);
    persist();
    paint();
    if (sev === 'crit') flush();          // الحرج يُرسل فوراً
  }

  /* ─────────── الإرسال للأدمن ─────────── */
  let flushing = false;
  async function flush(useBeacon) {
    if (!queue.length || flushing) return;
    const cfg = sb();
    if (!cfg) return;                      // لا إعدادات — نكتفي بالحفظ المحلي
    const batch = queue.splice(0, 25);
    const rows = batch.map((e) => ({
      kind: 'error', severity: e.sev, page: e.page, page_id: e.pageId,
      user_name: e.user || null, branch: e.branch || null, role: e.role || null,
      session_id: sid, err_type: e.type, message: e.msg, detail: e.detail,
      url: e.url, device: navigator.userAgent.slice(0, 120),
      count: e.count, training: e.training,
      source: (window.__GMT_SOURCE || 'usage'),
    }));
    const body = JSON.stringify(rows);
    const endpoint = cfg.url + '/rest/v1/gmt_telemetry';

    if (useBeacon && navigator.sendBeacon) {
      try { navigator.sendBeacon(endpoint + '?apikey=' + cfg.key, new Blob([body], { type: 'application/json' })); } catch (_) {}
      return;
    }
    flushing = true;
    try {
      await (window.__gmtRealFetch || fetch)(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, Prefer: 'return=minimal' },
        body,
      });
    } catch (_) { queue = batch.concat(queue); }   // فشل الإرسال — نعيدها للطابور
    finally { flushing = false; }
  }
  setInterval(() => flush(), FLUSH_MS);
  window.addEventListener('pagehide', () => flush(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });

  /* ═══════════ ① الأخطاء الصريحة ═══════════ */
  window.addEventListener('error', (e) => {
    if (e && e.message) {
      add('crit', 'JS', e.message, (e.filename ? redact(e.filename) + ':' + e.lineno : '') + (e.error && e.error.stack ? '\n' + String(e.error.stack).slice(0, 300) : ''));
    } else if (e && e.target && (e.target.src || e.target.href)) {
      var _u = String(e.target.src || e.target.href);
      var _n = _u.split('/').pop();
      /* (2026-07-23) تمييز الضجيج عن الخطأ الحقيقي:
         • صور المنتجات المحذوفة من التخزين ⇒ ليست خطأ برمجياً. تُجمَّع بسطر واحد بدل عشرات.
         • ملفات النظام (لوغو/أيقونة/سكربت) المفقودة ⇒ خطأ حقيقي يستحق التسجيل. */
      var isProductImg = /supabase\.co\/storage|products-images|\/products\//.test(_u);
      var isHtmlAsImg  = /\.html(\?|$)/i.test(_u) && e.target.tagName === 'IMG';
      if (isProductImg) {
        NOISE.productImgs++;
        if (NOISE.productImgs === 1) {
          add('info', 'صور المنتجات', 'صور منتجات محذوفة من التخزين (تُجمَّع — ليست خطأ برمجياً)', 'ستُحدَّث العدّة تلقائياً');
        } else {
          var last = errors.find(function (x) { return x.type === 'صور المنتجات'; });
          if (last) last.msg = NOISE.productImgs + ' صورة منتج محذوفة من التخزين (ليست خطأ برمجياً — ارفعها أو أزل روابطها)';
        }
      } else if (isHtmlAsImg) {
        NOISE.htmlAsImg++;
        if (NOISE.htmlAsImg === 1) add('info', 'تنسيق', 'عنصر <img> يشير لصفحة HTML بدل صورة (تجميلي — لا يؤثر على العمل)', _n);
      } else {
        add('warn', 'مورد', 'فشل تحميل ' + (e.target.tagName || '') + ': ' + _n, redact(_u));
      }
    }
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    add('crit', 'Promise', (r && (r.message || r)) || 'رفض غير معالج', r && r.stack ? String(r.stack).slice(0, 300) : '');
  });

  const _cerr = console.error.bind(console);
  console.error = function () {
    try { add('warn', 'console', Array.from(arguments).map((a) => { try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (_) { return String(a); } }).join(' ').slice(0, 300)); } catch (_) {}
    return _cerr.apply(console, arguments);
  };

  /* ═══════════ ② الشبكة + الأخطاء الصامتة ═══════════ */
  const REAL_FETCH = window.fetch.bind(window);
  window.__gmtRealFetch = REAL_FETCH;

  const net = { last: 0, stockOps: 0 };
  const recentWrites = new Map();   // توقيع الكتابة → وقتها
  const recentRows   = new Map();   // جدول+صف → وقت آخر كتابة (كشف المضاعفة)

  /* ترجمة أخطاء القاعدة لرسالة يفهمها الإنسان */
  function explainDb(body) {
    try {
      const j = JSON.parse(body);
      if (j.code === 'PGRST204') {
        const col = (j.message.match(/'([^']+)' column/) || [])[1];
        return `عمود «${col || '؟'}» غير موجود بالقاعدة — الكود يخاطب عموداً لا وجود له. (خطأ مخطّط، لا خطأ إدخال.)`;
      }
      if (j.code === '42703') return 'دالة/عمود غير موجود بالقاعدة (42703) — تعريف خاطئ بالقاعدة.';
      if (j.code === '23505') return 'قيمة مكرّرة — السجل موجود مسبقاً.';
      if (j.code === '23503') return 'ارتباط مفقود — السجل المرتبط غير موجود.';
      return j.message || body;
    } catch (_) { return body; }
  }

  /* استخراج «الصف» المستهدف من رابط PostgREST: /products?id=eq.55 */
  function rowKey(url) {
    try {
      const u = new URL(url, location.href);
      const table = (u.pathname.match(/\/rest\/v1\/([^/?]+)/) || [])[1];
      if (!table) return null;
      const idp = Array.from(u.searchParams.entries()).find(([k, v]) => /^(id|barcode|inv_number)$/.test(k) && /^eq\./.test(v));
      return idp ? table + '#' + idp[1] : null;
    } catch (_) { return null; }
  }

  /* ⏱️ مهلة عامة لكل طلب (UX-2 «تعليق/تجميد متكرر»)
     السبب الجذري: طلبات بلا مهلة ولا AbortController — إن لم يردّ السيرفر تبقى
     الصفحة تنتظر إلى الأبد وتبدو «معلّقة». الآن: أي طلب بلا signal يُقطع بعد 20ث
     ويُسجَّل خطأ مفهوم بدل تجميد صامت. */
  const REQ_TIMEOUT = 20000;
  function withTimeout(init) {
    if (init && init.signal) return { init, done: () => {} };
    let ctrl;
    try { ctrl = new AbortController(); } catch (_) { return { init, done: () => {} }; }
    const t = setTimeout(() => { try { ctrl.abort(); } catch (_) {} }, REQ_TIMEOUT);
    return { init: Object.assign({}, init || {}, { signal: ctrl.signal }), done: () => clearTimeout(t) };
  }

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = ((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();
    const isWrite = method !== 'GET' && method !== 'HEAD';
    const started = Date.now();
    net.last = started;
    if (!/gmt_telemetry/.test(url)) sniff(url, init);

    if (isWrite && !/gmt_telemetry/.test(url)) {
      const sig = method + ' ' + url.split('?')[0] + ' ' + String((init && init.body) || '').slice(0, 80);
      const prev = recentWrites.get(sig);
      if (prev && started - prev < 2000) add('warn', 'تكرار', 'نفس عملية الكتابة تكرّرت خلال ثانيتين — خطر ازدواج', method + ' ' + redact(url));
      recentWrites.set(sig, started);
      setTimeout(() => recentWrites.delete(sig), 4000);

      /* 🔴 كشف المضاعفة: كتابتان على نفس الصف خلال ثانيتين (ولو بقيمتين مختلفتين) */
      const rk = rowKey(url);
      if (rk) {
        const p = recentRows.get(rk);
        if (p && started - p < 2000) {
          add('crit', 'كتابة مزدوجة',
            `كُتب على نفس السجل (${rk}) مرتين خلال ثانيتين — هذا نمط المضاعفة: قد تُطبَّق الكمية أو المبلغ مرّتين.`,
            method + ' ' + redact(url));
        }
        recentRows.set(rk, started);
        setTimeout(() => recentRows.delete(rk), 4000);
      }

      if (/products|decrement_branch_stock|increment_branch_stock/i.test(url)) net.stockOps++;
      if (/\/invoices\b/i.test(url) && method === 'POST') checkStockAfterSale();
    }

    const T = withTimeout(init);
    try {
      const res = await REAL_FETCH(input, T.init);
      T.done();
      const took = Date.now() - started;
      if (took > 8000) add('warn', 'بطء', `الطلب استغرق ${(took / 1000).toFixed(1)} ثانية`, method + ' ' + redact(url));

      if (!res.ok && res.status !== 406) {
        let body = '';
        try { body = (await res.clone().text()).slice(0, 300); } catch (_) {}
        add('crit', 'HTTP ' + res.status, explainDb(body), method + ' ' + redact(url) + '\n' + body);
        return res;
      }
      if (isWrite && res.status === 200) {
        try {
          const txt = await res.clone().text();
          if (txt && txt.trim() === '[]') add('crit', 'كتابة بلا أثر', `${method} نجح لكنه لم يُعدّل أي صف — العملية لم تحدث فعلياً!`, redact(url));
        } catch (_) {}
      }
      return res;
    } catch (err) {
      T.done();
      const aborted = err && (err.name === 'AbortError' || /abort/i.test(err.message || ''));
      add('crit', 'شبكة', method + ' ' + redact(url),
        aborted ? `انقطع الطلب بعد ${REQ_TIMEOUT / 1000} ثانية (مهلة) — السيرفر لم يردّ. الصفحة لم تتجمّد.` : ((err && err.message) || 'فشل الاتصال'));
      throw err;
    }
  };

  function checkStockAfterSale() {
    const before = net.stockOps;
    setTimeout(() => {
      if (net.stockOps === before) add('crit', 'مخزون', 'حُفظت فاتورة بيع ولم يُرصد أي خصم من المخزون خلال 5 ثوانٍ!', 'راجع الفاتورة الأخيرة يدوياً.');
    }, 5000);
  }

  /* ═══════════ ③ زر بلا أثر ═══════════ */
  let domDirty = false;
  try { new MutationObserver(() => { domDirty = true; }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true }); } catch (_) {}

  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest && e.target.closest('button, [onclick], .btn, a[role="button"]');
    if (!el || el.disabled) return;
    const label = (el.textContent || el.title || el.id || 'زر').trim().slice(0, 40);
    /* (2026-07-23) استثناء الأزرار التي تعمل بأثر غير مرئي:
       نسخ للحافظة · تحديث/إعادة رسم · طباعة (تفتح نافذة النظام) · إغلاق نوافذ.
       تسجيلها كـ«بلا أثر» كان ضجيجاً — تعمل فعلياً لكنها لا تغيّر DOM ولا تطلب الشبكة. */
    if (/🐞|🔍|🎓|🎯|📋|🔄|🖨|تقرير|إغلاق|نسخ|مسح|تحديث|إعادة|طباعة|طباعه|A4|حرارية|التالي|تخطّ|رجوع|السابق/.test(label)) return;
    const before = net.last;
    domDirty = false;
    setTimeout(() => {
      if (net.last === before && !domDirty) {
        add('warn', 'زر بلا أثر', `ضغطت «${label}» ولم يحدث شيء (لا طلب شبكة ولا تغيّر بالواجهة)`, 'قد يكون الزر معطّلاً أو دالته مفقودة.');
      }
    }, 2000);
  }, true);

  /* ═══════════ ④ تجميد الواجهة ═══════════ */
  let hiddenSince = false;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hiddenSince = true; });
  (function heartbeat() {
    let last = performance.now();
    function tick(t) {
      const gap = t - last;
      /* لا نُبلّغ إذا كان التبويب مخفياً — rAF يتوقف طبيعياً حينها (كان مصدر إنذارات كاذبة) */
      if (gap > 3000 && document.visibilityState === 'visible' && !hiddenSince) {
        add('warn', 'تجميد', `تجمّدت الواجهة ${(gap / 1000).toFixed(1)} ثانية`, 'عملية ثقيلة أو حلقة لا تنتهي.');
      }
      hiddenSince = false;
      last = t;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  /* ═══════════ ⑤ فحوصات الصحة الحسابية ═══════════ */
  function check(name, ok, details) {
    if (ok) return true;
    add('crit', 'حساب', 'فحص فشل: ' + name, details || '');
    return false;
  }
  const invariants = {
    invoiceTotal(total, items) {
      const sum = (items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
      return check('إجمالي الفاتورة = مجموع البنود', Math.abs(sum - Number(total)) < 0.02, `الإجمالي: ${total} · مجموع البنود: ${sum.toFixed(2)}`);
    },
    stockNonNegative(name, qty) { return check('المخزون لا يكون سالباً', Number(qty) >= 0, `${name}: ${qty}`); },
    notBelowCost(price, cost, who) {
      return check('لا بيع تحت سعر التكلفة', Number(price) >= Number(cost), `السعر ${price} · التكلفة ${cost} · المستخدم ${who || '؟'}`);
    },
    commission(comm, price, wholesale) {
      const expect = (Number(price) - Number(wholesale)) / 2;
      return check('العمولة = نصف (البيع − الجملة)', Math.abs(expect - Number(comm)) < 0.02, `المتوقع ${expect.toFixed(2)} · المسجَّل ${comm}`);
    },
  };

  /* ═══════════ الواجهة (تظهر للأدمن فقط) ═══════════ */
  let btn = null, panel = null;
  /* صفحة يراها الزبون: الكفالة برقمها (?w=) · التتبّع · المتجر · بحث الكفالة · الموقع */
  function customerView() {
    try {
      const f = decodeURIComponent((location.pathname.split('/').pop() || '').toLowerCase());
      if (/^(track_order|store|search|site)\.html$/.test(f)) return true;
      if (/^guarantee\.html$/.test(f) && new URLSearchParams(location.search).get('w')) return true;
    } catch (_) {}
    return false;
  }
  window.GMT_isCustomerView = customerView;

  /* (TASK-0218/0229 · المالك seq 146 · 160) «زر الحارس والازرار العائمه ما لازم تطلع في اي مكان خلاص في لها مكان وندخل عليه ونسحب
     كل شيء تقارير» + «انتبه جيدا هذه صفحه كفاله للزبون عم يعرض لها التقارير»: لا زرّ عائم للحارس أبداً. التقارير مكانها
     «التقرير الأسبوعي وتقارير الحارس» (weekly_report.html) — تقرير هذا الجهاز وكل الأجهزة. وصفحات الزبون لا تفتح اللوحة إطلاقاً. */
  const NO_FAB = true;
  function paint() {
    if (NO_FAB) { if (btn) { btn.remove(); btn = null; } return; }
    if (silent) { if (btn) btn.style.display = 'none'; return; }
    if (!document.body) { document.addEventListener('DOMContentLoaded', paint, { once: true }); return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'gmt-bug-btn';
      btn.setAttribute('aria-label', 'تقرير الأخطاء');
      btn.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483000;width:52px;height:52px;border-radius:50%;color:#fff;border:2px solid rgba(255,255,255,.2);font-size:22px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-family:Cairo,Arial,sans-serif;';
      btn.onclick = openPanel;
      document.body.appendChild(btn);
    }
    const crit = errors.filter((e) => e.sev === 'crit').length;
    btn.style.background = crit ? '#D5001C' : '#b45309';
    btn.innerHTML = '🐞<span style="position:absolute;top:-4px;left:-4px;background:#111;color:#fff;font-size:10px;font-weight:900;border-radius:99px;padding:2px 6px;">' + errors.length + '</span>';
    btn.style.display = errors.length ? 'flex' : 'none';
  }

  function buildReport() {
    const crit = errors.filter((e) => e.sev === 'crit');
    const head = [
      '═══ تقرير الحارس — GMT 🐞 v3 ═══',
      'الصفحة: ' + (ident.page || document.title),
      'المستخدم: ' + (ident.user || '—') + ' · الفرع: ' + (ident.branch || '—') + ' · الدور: ' + (ident.role || '—'),
      'الجلسة: ' + sid,
      'الرابط: ' + redact(location.href),
      'الوقت: ' + new Date().toLocaleString('ar-SY') + ' (بعد ' + Math.round((Date.now() - t0) / 1000) + 'ث من الفتح)',
      'الجهاز: ' + navigator.userAgent.slice(0, 110),
      'وضع تدريبي: ' + (training() ? 'نعم' : 'لا'),
      `الإجمالي: ${errors.length} (حرج: ${crit.length})`,
      '──────────────────────',
    ];
    const body = errors.map((e, i) =>
      `#${i + 1} [${e.t}] ${SEV_AR[e.sev]} — ${e.type}${e.count > 1 ? ` (تكرّر ${e.count}×)` : ''}\n${e.msg}${e.detail ? '\n↳ ' + e.detail : ''}`
    ).join('\n─────\n');
    return head.join('\n') + '\n' + body;
  }

  function openPanel() {
    if (customerView()) return;                // زبونٌ لا يرى تقارير داخلية أبداً
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Cairo,Arial,sans-serif;direction:rtl;';
    const crit = errors.filter((e) => e.sev === 'crit').length;
    panel.innerHTML =
      '<div style="background:#161a22;color:#e7e9ee;border:1px solid #2a3040;border-radius:16px;max-width:600px;width:100%;max-height:86vh;display:flex;flex-direction:column;padding:16px;">' +
      `<div style="font-weight:900;font-size:15px;margin-bottom:3px;">🐞 الحارس — ${errors.length} ملاحظة${crit ? ` (<span style="color:#f87171;">${crit} حرجة</span>)` : ''}</div>` +
      '<div style="font-size:11px;color:#9aa3b2;font-weight:700;margin-bottom:9px;line-height:1.7;">محفوظ على الجهاز ومُرسَل للوحة الأدمن. يراقب: البرمجة · الشبكة · <b>الصامت</b> (زر بلا أثر · كتابة مزدوجة · كتابة بلا نتيجة · مخزون لم يُخصم · تجميد · عمود مفقود).</div>' +
      '<textarea readonly id="gmt-bug-ta" style="flex:1;min-height:250px;background:#0e1117;color:#cdd3de;border:1px solid #2a3040;border-radius:10px;padding:10px;font-size:11px;line-height:1.7;direction:ltr;text-align:left;white-space:pre;"></textarea>' +
      '<div style="display:flex;gap:8px;margin-top:10px;">' +
      '<button id="gmt-bug-copy" style="flex:1;background:#D5001C;color:#fff;border:none;border-radius:10px;padding:11px;font-weight:900;font-family:inherit;cursor:pointer;">📋 نسخ التقرير</button>' +
      '<button id="gmt-bug-clear" style="background:#232936;color:#c6ccd8;border:none;border-radius:10px;padding:11px 14px;font-weight:800;font-family:inherit;cursor:pointer;">مسح</button>' +
      '<button id="gmt-bug-close" style="background:#232936;color:#c6ccd8;border:none;border-radius:10px;padding:11px 14px;font-weight:800;font-family:inherit;cursor:pointer;">إغلاق</button>' +
      '</div></div>';
    document.body.appendChild(panel);
    const ta = panel.querySelector('#gmt-bug-ta');
    ta.value = buildReport();
    panel.querySelector('#gmt-bug-close').onclick = () => { panel.remove(); panel = null; };
    panel.querySelector('#gmt-bug-clear').onclick = () => { errors = []; persist(); paint(); panel.remove(); panel = null; };
    panel.querySelector('#gmt-bug-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(ta.value); } catch (_) { ta.select(); try { document.execCommand('copy'); } catch (_) {} }
      panel.querySelector('#gmt-bug-copy').textContent = '✓ نُسخ — ألصقه بالرسالة';
    };
  }

  /* فتح سرّي للأدمن/الدعم حتى بالوضع الصامت */
  document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.shiftKey && (e.key === 'B' || e.key === 'b')) openPanel(); });
  /* (TASK-0229) أُزيل فتحُ اللوحة بالضغط المطوَّل على الشعار — كان يفتح التقارير لأيّ أحد (ومنهم الزبون في صفحة الكفالة/التتبّع). */

  /* ─────────── الواجهة البرمجية ─────────── */
  /* ═══════════ ⑥ التعريف التلقائي (بلا تعديل أي صفحة) ═══════════
     الصفحات تستعمل متغيراً عاماً currentUser + branch — نقرأهما دورياً.
     الدور: سيادي (?sovereign=1) · أدمن (صفحات الإدارة) · كاشير (الباقي). */
  /* ⚠️ الترتيب يَحكم: أوّل نمطٍ يُطابِق هو الفائز، فالأخصّ قبل الأعمّ
       (`admin_store` قبل `store` · `guarantee_admin` قبل `guarantee`).

     🔴 (2026-10-03) كانت الأنماط تلاحق **أسماء ملفّاتٍ لم تعد موجودة**
     (`10_إنشاء_الكفالة` · `11_أدمن_الكفالة` · `12_بحث_الكفالة` · `14_العقود`).
     والملفّات المنشورة فعلاً هي `guarantee.html` · `guarantee_admin.html` ·
     `search.html` · `deal.html` — فلا تُطابِق شيئاً، فتسقط إلى الافتراضيّ:
         role: 'cashier'  ⇒  silent = true
     أي أنّ صفحات **الكفالة والعقود** كانت تُخرِس لاقطَ الأخطاء حتى أمام
     المالك نفسه، وتُبلِّغ عنه أنّه كاشير. وهذا جزءٌ من سبب أنّ تقرير المفتّش
     وصل بلا معلومات. */
  const PAGES = [
    [/admin_pos|أدمن_نقاط|04_/i,            { page: 'أدمن نقاط البيع', pageId: 'admin_pos', admin: true }],
    [/admin_store|أدمن_المتجر|09_/i,        { page: 'أدمن المتجر', pageId: 'admin_store', admin: true }],
    [/admin_site|أدمن_الموقع|15b/i,         { page: 'أدمن الموقع', pageId: 'admin_site', admin: true }],
    [/admin_sovereign|sovereign|السيادي|13_/i, { page: 'الأدمن السيادي', pageId: 'sovereign', admin: true }],
    [/guarantee_admin|أدمن_الكفالة|11_/i,   { page: 'أدمن الكفالة', pageId: 'warranty_admin', admin: true }],
    [/guarantee|إنشاء_الكفالة|10_/i,        { page: 'إنشاء الكفالة', pageId: 'warranty_new', admin: true }],
    [/(^|\/)search\.html|بحث_الكفالة|12_/i, { page: 'بحث الكفالة', pageId: 'warranty_find', admin: false }],
    [/02_|pos|نقطة/i,                       { page: 'نقطة البيع', pageId: 'pos', admin: false }],
    [/03_|inventory|الجرد/i,                { page: 'الجرد', pageId: 'inventory', admin: true }],
    [/05_|orders|الأوردرات/i,               { page: 'الأوردرات', pageId: 'orders', admin: false }],
    [/06_|purchase|المشتريات/i,             { page: 'المشتريات', pageId: 'purchases', admin: true }],
    [/07_|bridge|الجسر/i,                   { page: 'الجسر', pageId: 'bridge', admin: true }],
    [/08_|store|المتجر\.|المتجر\b/i,        { page: 'المتجر', pageId: 'store', admin: false }],
    [/deal|contract|العقود|14_/i,           { page: 'العقود', pageId: 'contracts', admin: true }],
    [/15_|site|الموقع_الرئيسي/i,            { page: 'الموقع', pageId: 'site', admin: false }],
    [/track_order|16_|tracking|التتبع|الشحنة/i, { page: 'تتبع الشحنة', pageId: 'tracking', admin: false }],
    [/17_|backup|النسخ/i,                   { page: 'النسخ الاحتياطي', pageId: 'backup', admin: true }],
    [/labels|الملصقات/i,                    { page: 'الملصقات', pageId: 'labels', admin: true }],
    [/passwords|الأمان_والمستخدمون/i,       { page: 'الأمان والمستخدمون', pageId: 'security', admin: true }],
    [/(^|\/)home\.html|(^|\/)index\.html|(^|\/)$/i, { page: 'الرئيسية', pageId: 'home', admin: false }],
  ];
  function autoIdentify() {
    const path = decodeURIComponent(location.pathname + location.search);
    const hit = (PAGES.find(([re]) => re.test(path)) || [])[1];
    const sov = (function () { try { return sessionStorage.getItem('gmt_sov_ok') === '1' || sessionStorage.getItem('gmt_admin_mode') === '1'; } catch (_) { return false; } })();   /* (٧ ط) الرابط وحده لا يمنح دوراً */
    const u = window.currentUser || null;
    const b = window.branch || null;
    const o = {
      page: (hit && hit.page) || document.title || '',
      pageId: (hit && hit.pageId) || '',
      user: (u && (u.display_name || u.username || u.name)) || ident.user || '',
      branch: (b && (b.name || b.key || b.branch_key)) || (u && u.branch_key) || ident.branch || '',
      role: sov ? 'sovereign' : (hit && hit.admin ? 'admin' : 'cashier'),
    };
    if (o.page !== ident.page || o.user !== ident.user || o.role !== ident.role || o.branch !== ident.branch) {
      window.GMTBug.identify(o);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     🔴 (2026-10-03) ثلاث دوالّ كانت **تُستدعى ولا توجد**.

     البلاغ الذي كشفها: تقرير المفتّش الذي أرسله المالك يقول `المستخدم: —`
     و`تغطية الميزات: 0/52` ثمّ ٣٨ سطراً `undefined`. فتَّشتُ، فوجدت أنّ
     الصفحات تنادي `GMTBug.log` و`GMTBug.who` و`GMTBug.pageId` — وواجهةُ
     GMTBug لا تُصدِّر أيّاً منها.

     وأخطرها `log`. المفتّش يكشف **الأخطاء الصامتة** — وهي أغلى ما فيه بشهادة
     المالك («الأخطاء الصامتة هي التي دمّرت مخزوني شهوراً») — ثمّ يسلّمها:
         if (window.GMTBug && GMTBug.log) GMTBug.log('silent', msg, {...});
     والشرط `&& GMTBug.log` كاذبٌ دائماً ⇒ **كل زرٍّ ميّت وكل كتابةٍ مزدوجة
     وكل كتابةٍ بلا أثر كُشِفت ثمّ أُلقِيت في الفراغ**، في خمسة مواضع. ولم
     يظهر خطأ قطّ لأنّ الحراسة بـ`&&` حوّلت العطل إلى صمت.
     وهذا بالضبط ما تقوله قاعدتنا: `fn && fn()` ليست حراسةً بل إخفاءً.

     و`who` كانت تُنادى في ثلاثة مواضع، منها السطر الذي يكتب اسم المستخدم في
     جدول `inspector_sessions` ⇒ كل جلسةٍ مُرسَلة بلا اسم. والبيانات موجودة
     أصلاً في `ident.user` — كان الناقص هو المَنفَذ لا المعلومة.
     ═══════════════════════════════════════════════════════════════════════ */
  window.GMTBug = {
    version: 3.2,
    customerView: customerView,
    role: () => ident.role,
    who: () => ident.user || '',
    branch: () => ident.branch || '',
    pageId: () => ident.pageId || '',
    /* log(kind, msg, extra) — ما تستعمله الصفحات والمفتّش */
    log(kind, msg, extra) {
      var x = extra || {};
      var sev = (kind === 'crit' || kind === 'silent') ? 'crit'
              : (kind === 'warn' ? 'warn' : (kind === 'info' ? 'info' : 'warn'));
      var type = x.type || kind || 'log';
      var detail = '';
      try { detail = JSON.stringify(x); } catch (_) { detail = String(x); }
      add(sev, type, msg, detail, x.url || '');
    },
    config: sb,
    list: () => errors.slice(),
    report: buildReport,
    add, check, invariants,
    open: openPanel,
    flush,
    session: sid,
    identify(o) {
      ident = Object.assign(ident, o || {});
      /* الصمت التلقائي: أي دور غير الأدمن/السيادي = صامت */
      silent = !/admin|sovereign|owner/i.test(ident.role || '');
      if (o && typeof o.silent === 'boolean') silent = o.silent;
      paint();
    },
    setSilent(v) { silent = !!v; paint(); },
    clear() { errors = []; persist(); paint(); },
  };

  autoIdentify();
  setInterval(autoIdentify, 2000);
  paint();
})();


/* ── gmt-master-report.js ── */
;/* ═══════════════════════════════════════════════════════════════════════════
   gmt-master-report.js — 🎯 المصبّ الموحّد · v1.0 · 2026-07-23
   كل الأخطاء من كل البوتات تصبّ هنا. تقرير واحد قابل للنسخ يُخزَّن ويتراكم.
   يشغّل فحصاً تلقائياً فور فتح الصفحة، وزر «إعادة الفحص» يعمل فعلياً.
   التقرير يذكر: ماذا فُحص · كيف فُحص · ما نجح · ما فشل · ما لم يُفحص · ما يحتاج فحصاً أعمق.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTMaster) return;

  var LS = 'gmt_master_report_v1';
  var S = { runs: [], lastRun: null, version: '1.0' };
  try { var o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o) S = o; } catch (e) {}
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }

  var page = document.title || location.pathname.split('/').pop();

  /* ═══ سجل الفحوص: كل فحص يوثّق نفسه ═══ */
  function mkRun() {
    return {
      at: Date.now(), page: page, url: location.href,
      checks: [],        // {area, how, status, detail, depth}
      notChecked: [],    // {area, why, needs}
      collected: {}      // ما جُمع من البوتات الأخرى
    };
  }

  function add(run, area, how, status, detail, depth) {
    run.checks.push({ area: area, how: how, status: status, detail: detail, depth: depth || 'سطحي' });
  }
  function skip(run, area, why, needs) {
    run.notChecked.push({ area: area, why: why, needs: needs });
  }

  /* ═══ الفحص التلقائي الشامل ═══ */
  function runCheck() {
    var run = mkRun();

    /* ① البوتات المحمّلة */
    var bots = [
      ['gmt-bugcatcher', 'GMTBug', 'الحارس — يلتقط الأخطاء لحظة وقوعها'],
      ['gmt-inspector', 'GMTInspect', 'المفتّش — الأخطاء الصامتة'],
      ['gmt-warden', 'GMTWarden', 'المراقب السيادي'],
      ['gmt-selftest', 'GMTSelfTest', 'الفاحص الذاتي'],
      ['gmt-guide', 'GMTGuide', 'الدليل التعليمي'],
      ['gmt-sandbox', 'GMTSandbox', 'الوضع التدريبي'],
      ['gmt-brand', 'GMTBrand', 'الهوية'],
      ['gmt-money-guard', 'GMTMoneyGuard', 'الحارس المالي'],
      ['gmt-code-sentinel', 'GMTCodeSentinel', 'حارس الكود']
    ];
    var loaded = 0, missing = [];
    bots.forEach(function (b) {
      if (window[b[1]]) { loaded++; }
      else missing.push(b[0]);
    });
    add(run, 'البوتات', 'فحص وجود كائن كل بوت بـwindow',
      missing.length ? 'warn' : 'ok',
      loaded + '/' + bots.length + ' محمّل' + (missing.length ? ' · ناقص: ' + missing.join('، ') : ''),
      'كامل');

    /* ② الأزرار — استدعاء دوالها معرّف؟ */
    var btns = document.querySelectorAll('[onclick]');
    var dead = [];
    btns.forEach(function (el) {
      var expr = el.getAttribute('onclick') || '';
      var m = expr.trim().match(/^([\w$]+)\s*\(/);
      if (m && m[1].indexOf('.') < 0 && typeof window[m[1]] !== 'function') {
        if (!/^(if|for|while|return|this|event)$/.test(m[1])) dead.push(m[1]);
      }
    });
    add(run, 'الأزرار', 'قراءة كل onclick والتأكد أن دالته معرّفة بـwindow',
      dead.length ? 'fail' : 'ok',
      btns.length + ' زر' + (dead.length ? ' · 🔴 دوال مفقودة: ' + dead.slice(0, 5).join('، ') : ' · كل الدوال معرّفة'),
      'كامل');

    /* ③ الصور */
    var imgs = document.querySelectorAll('img'), broken = [];
    imgs.forEach(function (im) {
      if (im.complete && im.naturalWidth === 0 && im.getAttribute('src')) {
        broken.push((im.getAttribute('src') || '').split('/').pop());
      }
    });
    add(run, 'الصور', 'فحص naturalWidth لكل صورة بعد اكتمال التحميل',
      broken.length ? 'warn' : 'ok',
      imgs.length + ' صورة' + (broken.length ? ' · مكسورة: ' + broken.slice(0, 4).join('، ') : ' · كلها تُحمّل'),
      'كامل');

    /* ④ الإعداد (مفاتيح القاعدة) */
    var hasCfg = !!(window.SUPABASE_URL || window.GMT_CONFIG || window.URL_SB ||
                    (window.GMTConfig && GMTConfig.url));
    add(run, 'الإعداد', 'البحث عن مفاتيح Supabase بالنطاق العام',
      hasCfg ? 'ok' : 'fail',
      hasCfg ? 'المفاتيح موجودة' : '🔴 مفاتيح القاعدة غير موجودة — تأكّد من رفع gmt-config.js قبل باقي السكربتات',
      'سطحي');

    /* ⑤ التنسيق */
    var vw = document.documentElement.clientWidth, overflow = 0, offscreen = 0;
    /* (٧ ط) لا ندخل القوائم الكبيرة: قياسُ كل بطاقةٍ فيها يُجبر المتصفّح على رسمها واحدةً واحدة
       (١٠ ثوانٍ متجمّدة مع ٢٠٠٠ منتج) — والطفح الأفقي يظهر في الكتل الخارجية أصلاً */
    var _NOT = ':not(#prodsGrid *):not(#cards-grid *):not(#table-body *):not([data-skip-fit] *)';
    document.querySelectorAll(['div', 'section', 'table', 'form'].map(function (t) { return t + _NOT; }).join(',')).forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width > vw + 60) overflow++;
      if (r.left < -120 || r.right > vw + 160) offscreen++;
    });
    add(run, 'التنسيق', 'قياس getBoundingClientRect لكل كتلة ومقارنتها بعرض الشاشة',
      (overflow > 3 || offscreen > 5) ? 'warn' : 'ok',
      overflow ? (overflow + ' عنصر أوسع من الشاشة') : 'لا طفح أفقي',
      'متوسط');

    /* ⑥ جمع تقارير البوتات الأخرى (المصبّ) */
    try { if (window.GMTBug && GMTBug.report) run.collected.bugcatcher = String(GMTBug.report()).slice(0, 4000); } catch (e) {}
    try { if (window.GMTInspect && GMTInspect.report) run.collected.inspector = String(GMTInspect.report()).slice(0, 4000); } catch (e) {}
    try { if (window.GMTWarden && GMTWarden.report) run.collected.warden = String(GMTWarden.report()).slice(0, 4000); } catch (e) {}
    try { if (window.GMTCodeSentinel && GMTCodeSentinel.findings) {
      var f = GMTCodeSentinel.findings();
      run.collected.sentinel = f.length ? f.map(function (x) { return x.kind + ': ' + x.detail; }).join('\n') : 'لا اكتشافات';
    } } catch (e) {}
    try { if (window.GMTMoneyGuard && GMTMoneyGuard.incidents) {
      var mi = GMTMoneyGuard.incidents();
      run.collected.money = mi.length ? mi.map(function (x) { return x.title + ': ' + x.detail; }).join('\n') : 'لا تباينات مالية';
    } } catch (e) {}

    /* ═══ ما لم يُفحص (شفافية كاملة) ═══ */
    skip(run, 'قاعدة البيانات (الجداول/الأعمدة)',
      'يحتاج اتصالاً حياً بالقاعدة واستعلامات فعلية',
      'اضغط 🧪 الفاحص الذاتي — هو يفحصها فعلياً');
    skip(run, 'صحة الأرقام المالية (عمولة/ربح)',
      'تُفحص فقط عند حفظ فاتورة حقيقية',
      'الحارس المالي 🧮 يفحصها تلقائياً عند كل بيع');
    skip(run, 'الطباعة والفوترة الفعلية',
      'تحتاج ضغطاً بشرياً على طباعة مع طابعة متصلة',
      'جرّبها يدوياً مرة بعد النشر');
    skip(run, 'صفحات النظام الأخرى',
      'كل صفحة تفحص نفسها فقط (عزل المتصفح)',
      'افتح 🔬 الفاحص المركزي (21_INSPECTOR) — يفحص كل الصفحات');
    skip(run, 'التزامن (بيعان في نفس اللحظة)',
      'يحتاج جهازين يبيعان معاً',
      'يُغطّى بـPOS-ATOMIC بعد تشغيل _SQL/🔟_دوال_المخزون_الموحّدة.sql');

    run.summary = {
      ok: run.checks.filter(function (c) { return c.status === 'ok'; }).length,
      warn: run.checks.filter(function (c) { return c.status === 'warn'; }).length,
      fail: run.checks.filter(function (c) { return c.status === 'fail'; }).length,
      skipped: run.notChecked.length
    };

    S.lastRun = run;
    S.runs.unshift({ at: run.at, page: run.page, summary: run.summary });
    if (S.runs.length > 50) S.runs.length = 50;
    save();
    return run;
  }

  /* ═══ بناء التقرير النصي (قابل للنسخ · يفهمه المطوّر وكلود) ═══ */
  function buildText(run) {
    run = run || S.lastRun; if (!run) return 'لم يُجرَ فحص بعد.';
    var L = [];
    L.push('╔══════════════════════════════════════════╗');
    L.push('║   🎯 التقرير الموحّد الشامل — GMT          ║');
    L.push('╚══════════════════════════════════════════╝');
    L.push('التاريخ: ' + new Date(run.at).toLocaleString('ar-SY'));
    L.push('الصفحة: ' + run.page);
    L.push('الرابط: ' + run.url);
    L.push('إصدار المصبّ: ' + S.version);
    L.push('');
    L.push('── الخلاصة ──');
    L.push('  ✅ نجح: ' + run.summary.ok + '  ⚠️ تنبيه: ' + run.summary.warn +
           '  🔴 فشل: ' + run.summary.fail + '  ⚪ لم يُفحص: ' + run.summary.skipped);
    L.push('');
    L.push('═══════ ① ما الذي فُحص وكيف ═══════');
    run.checks.forEach(function (c) {
      var ic = c.status === 'ok' ? '✅' : (c.status === 'warn' ? '⚠️' : '🔴');
      L.push('');
      L.push(ic + ' [' + c.area + ']  (عمق الفحص: ' + c.depth + ')');
      L.push('   كيف فُحص: ' + c.how);
      L.push('   النتيجة: ' + c.detail);
    });
    L.push('');
    L.push('═══════ ② ما لم يُفحص (ولماذا) ═══════');
    run.notChecked.forEach(function (n) {
      L.push('');
      L.push('⚪ ' + n.area);
      L.push('   السبب: ' + n.why);
      L.push('   كيف يُفحص: ' + n.needs);
    });
    L.push('');
    L.push('═══════ ③ تقارير البوتات (المصبّ الموحّد) ═══════');
    var names = { bugcatcher: '🐞 الحارس', inspector: '🔍 المفتّش', warden: '🛡️ المراقب',
                  sentinel: '🛰️ حارس الكود', money: '🧮 الحارس المالي' };
    var any = false;
    Object.keys(run.collected).forEach(function (k) {
      any = true;
      L.push('');
      L.push('───── ' + (names[k] || k) + ' ─────');
      L.push(run.collected[k] || '(فارغ)');
    });
    if (!any) L.push('  (لا بوتات أخرى محمّلة بهذه الصفحة)');
    L.push('');
    L.push('═══════ ④ سجل الفحوص السابقة ═══════');
    S.runs.slice(0, 10).forEach(function (r) {
      L.push('  ' + new Date(r.at).toLocaleString('ar-SY') + ' · ' + r.page +
             ' · ✅' + r.summary.ok + ' ⚠️' + r.summary.warn + ' 🔴' + r.summary.fail);
    });
    L.push('');
    L.push('═══════ ⑤ ملاحظة للمطوّر / كلود ═══════');
    L.push('هذا التقرير يوثّق: ماذا فُحص · كيف · النتيجة · وما لم يُفحص ولماذا.');
    L.push('العناصر تحت «لم يُفحص» ليست أخطاء — هي فحوص تحتاج أدوات أخرى (مذكورة).');
    L.push('عمق الفحص: «كامل» = فُحص كل عنصر · «متوسط» = عيّنة · «سطحي» = وجود فقط.');
    return L.join('\n');
  }

  /* ═══ الواجهة ═══ */
  function panel() {
    var run = S.lastRun || runCheck();
    var d = document.getElementById('gmt-master-panel');
    if (d) d.remove();
    d = document.createElement('div');
    d.id = 'gmt-master-panel';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147482000;background:rgba(15,18,25,.72);' +
      'display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:Cairo,system-ui,sans-serif;';
    var s = run.summary;
    var verdict = s.fail ? '🔴 ' + s.fail + ' مشكلة تحتاج إصلاحاً' :
                  (s.warn ? '⚠️ ' + s.warn + ' تنبيه' : '✅ لا مشاكل بهذه الصفحة');
    d.innerHTML =
      '<div style="background:#fff;border-radius:16px;max-width:720px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
        '<div style="background:linear-gradient(135deg,#D5001C,#8E000D);color:#fff;padding:16px 20px;border-radius:16px 16px 0 0">' +
          '<div style="font-size:18px;font-weight:900">🎯 التقرير الموحّد الشامل</div>' +
          '<div style="font-size:12.5px;opacity:.9;margin-top:3px">' + verdict + ' · ' + run.page + '</div>' +
        '</div>' +
        '<div style="padding:16px 20px">' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' +
            '<button id="gm-recheck" style="background:#D5001C;color:#fff;border:0;border-radius:10px;padding:10px 18px;font:inherit;font-weight:900;font-size:13px;cursor:pointer">🔄 إعادة الفحص</button>' +
            '<button id="gm-copy" style="background:#111827;color:#fff;border:0;border-radius:10px;padding:10px 18px;font:inherit;font-weight:900;font-size:13px;cursor:pointer">📋 نسخ التقرير الكامل</button>' +
            '<button id="gm-clear" style="background:#fff;color:#b91c1c;border:1px solid #fecaca;border-radius:10px;padding:10px 16px;font:inherit;font-weight:800;font-size:13px;cursor:pointer">🗑️ مسح السجل</button>' +
            '<button id="gm-close" style="background:#f3f4f6;color:#374151;border:0;border-radius:10px;padding:10px 16px;font:inherit;font-weight:800;font-size:13px;cursor:pointer">✕ إغلاق</button>' +
          '</div>' +
          '<pre id="gm-text" style="white-space:pre-wrap;font-size:11.5px;line-height:1.75;background:#f8f9fb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;max-height:60vh;overflow:auto;color:#1f2937;margin:0">' +
            buildText(run).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }) +
          '</pre>' +
        '</div>' +
      '</div>';
    document.body.appendChild(d);

    d.querySelector('#gm-close').onclick = function () { d.remove(); };
    d.querySelector('#gm-recheck').onclick = function () {
      this.textContent = '⏳ يفحص…';
      var self = this;
      setTimeout(function () {
        var r = runCheck();
        d.querySelector('#gm-text').textContent = buildText(r);
        self.textContent = '🔄 إعادة الفحص';
        try { if (window.GMTUI && GMTUI.toast) GMTUI.toast('✅ اكتمل الفحص'); } catch (e) {}
      }, 120);
    };
    d.querySelector('#gm-copy').onclick = function () {
      var t = buildText(S.lastRun), self = this;
      function done() { self.textContent = '✅ نُسخ!'; setTimeout(function () { self.textContent = '📋 نسخ التقرير الكامل'; }, 1600); }
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(done).catch(fallback);
      else fallback();
      function fallback() {
        var ta = document.createElement('textarea'); ta.value = t;
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        ta.remove(); done();
      }
    };
    d.querySelector('#gm-clear').onclick = async function () {
      if (!await (window.GMTAsk ? GMTAsk.confirm : function (m) { return Promise.resolve(window.confirm(m)); })('مسح كل سجلات الفحص المخزّنة؟')) return;
      S = { runs: [], lastRun: null, version: '1.0' }; save();
      // امسح تقارير البوتات القديمة المتراكمة
      try {
        var ks = []; for (var i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i));
        ks.forEach(function (k) {
          if (k && /gmt.*(inspect|bug|warden|autotest|selftest|report|journey|incident|silent)/i.test(k)
              && !/money|ledger|دفتر|config|user|token/i.test(k)) localStorage.removeItem(k);
        });
        sessionStorage.clear();
      } catch (e) {}
      alert('✅ مُسح السجل. سيبدأ فحص نظيف.');
      location.reload();
    };
  }

  /* ═══ الزر العائم ═══ */
  function fab() {
    if (document.getElementById('gmt-master-fab') || !document.body) return;
    var b = document.createElement('button');
    b.id = 'gmt-master-fab';
    b.textContent = '🎯';
    b.title = 'التقرير الموحّد الشامل';
    b.style.cssText = 'position:fixed;left:14px;bottom:132px;z-index:2147481500;width:46px;height:46px;' +
      'border-radius:50%;border:0;background:#D5001C;color:#fff;font-size:20px;cursor:pointer;' +
      'box-shadow:0 8px 22px rgba(192,0,18,.35)';
    b.onclick = panel;
    document.body.appendChild(b);
  }

  /* ═══ التشغيل التلقائي ═══ */
  function boot() {
    fab();
    // فحص تلقائي فور الفتح (بعد أن تستقر الصفحة) — (٧ ط) في وقت فراغ المتصفّح لا وسط عمل المستخدم
    setTimeout(function () { (window.requestIdleCallback || function (f) { return setTimeout(f, 1); })(function () {
      var r = runCheck();
      // نبّه فقط لو في فشل
      if (r.summary.fail > 0) {
        var b = document.getElementById('gmt-master-fab');
        if (b) { b.style.background = '#dc2626'; b.textContent = '🎯' ; b.title = r.summary.fail + ' مشكلة — اضغط للتقرير'; }
      }
    }, { timeout: 8000 }); }, 2600);
  }

  window.GMTMaster = {
    version: '1.0',
    check: runCheck,
    report: function () { return buildText(); },
    open: panel,
    last: function () { return S.lastRun; },
    history: function () { return S.runs.slice(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


/* ── gmt-visibility.js ── */
;/* ═══════════════════════════════════════════════════════════════════════════
   gmt-visibility.js — 🔒 التحكّم بالظهور · v1.0 · 2026-07-24
   طلب المالك: البوتات تعمل وتُسجّل كل شيء بالخلفية، لكن أزرارها لا تظهر للمستخدم.
   • تُخفى كل أزرار البوتات العائمة (الحارس · المفتّش · المراقب · الفاحص الذاتي ·
     الفحص الشامل · المصبّ ...).
   • يبقى الوضع التدريبي ظاهراً (زر 🎓).
   • زر التقارير الموحّد (🎯) يظهر فقط بالصفحة الرئيسية (بوابة واحدة للمالك).
   • كل شيء يُسجَّل ويُخزَّن كالمعتاد — الإخفاء بصري فقط، لا يوقف التسجيل.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTVisibility) return;

  // معرّفات أزرار البوتات التي تُخفى عن المستخدم العادي
  var HIDE_IDS = [
    'gmt-master-fab',     // المصبّ الموحّد 🎯
    'gmt-inspect-fab',    // المفتّش 🔍
    'gmt-warden-fab',     // المراقب 🛡️
    'gmt-st-fab',         // الفاحص الذاتي 🧪
    'gmt-autotest-fab',   // الفحص الشامل 🤖
    'gmt-bug-fab', 'bug-btn', 'gmt-bug-btn'  // الحارس 🐞
  ];

  // هل هذه صفحة بوابة التقارير؟ (لوحة المالك أو صفحة البوتات)
  function isHomePage() {
    var loc=(window.location||{});var p = decodeURIComponent((loc.pathname || '')).toLowerCase();
    // البوابة = الأدمن السيادي (لوحة المالك) أو صفحة بوتات الحماية
    return /13_sovereign|سيادي|19_protection|بوتات_الحماية|بوتات الحماية/.test(p);
  }

  // هل المستخدم مخوّل برؤية التقارير؟ (المالك/السيادي، أو ?reports=1)
  function isOwner() {
    if (/[?&]reports=1/.test((window.location||{}).search||'')) return true;
    try { if (window.GMTRole && GMTRole.isAdmin()) return true; } catch (e) {}   /* (٨ ت) وضع الأدمن هو مصدر الدور */
    try {
      var u = JSON.parse((localStorage.getItem('gmt_session') || localStorage.getItem('gmt_user')) || '{}');
      return /admin|sovereign|owner/i.test(u.role || '');
    } catch (e) { return false; }
  }

  function hideBotButtons() {
    HIDE_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    });
    // أي زر عائم آخر للبوتات (احتياط) — عدا الوضع التدريبي وزر التقارير
    document.querySelectorAll('button[id*="fab"],button[id*="-btn"]').forEach(function (b) {
      var id = (b.id || '').toLowerCase();
      var keep = /sandbox|train|تدريب|gmt-reports-gate|guide/.test(id);
      if (!keep && HIDE_IDS.indexOf(b.id) < 0 &&
          /bug|inspect|warden|autotest|selftest|master|money|sentinel|st-fab/.test(id)) {
        b.style.setProperty('display', 'none', 'important');
      }
    });
  }

  // بوابة التقارير: زر واحد بالصفحة الرئيسية يفتح المصبّ الموحّد
  function reportsGate() {
    if (!isHomePage() || !isOwner()) return;
    if (document.getElementById('gmt-reports-gate') || !document.body) return;
    var b = document.createElement('button');
    b.id = 'gmt-reports-gate';
    b.textContent = '📊 تقارير النظام';
    b.title = 'تقارير البوتات — كل الأخطاء والاستعمال (للمالك)';
    b.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147481900;' +
      'background:linear-gradient(135deg,#D5001C,#8E000D);color:#fff;border:0;border-radius:12px;' +
      'padding:12px 18px;font-family:Cairo,system-ui,sans-serif;font-weight:900;font-size:14px;' +
      'cursor:pointer;box-shadow:0 6px 20px rgba(192,0,18,.35)';
    b.onclick = function () {
      // افتح المصبّ الموحّد إن وُجد
      if (window.GMTMaster && GMTMaster.open) return GMTMaster.open();
      // أو المفتّش/المراقب كبديل
      if (window.GMTWarden && GMTWarden.panel) return GMTWarden.panel();
      alert('تقارير النظام غير محمّلة بهذه الصفحة.');
    };
    document.body.appendChild(b);
  }

  function apply() {
    hideBotButtons();
    reportsGate();
  }

  // طبّق باستمرار (البوتات قد تُنشئ أزرارها متأخرة)
  function boot() {
    apply();
    setTimeout(apply, 1000);
    setTimeout(apply, 3000);
    setTimeout(apply, 6000);
    // راقب أي زر جديد يُضاف
    try {
      var mo = new MutationObserver(function () { hideBotButtons(); });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  window.GMTVisibility = {
    version: '1.0',
    hide: hideBotButtons,
    showReportsGate: reportsGate,
    isOwner: isOwner,
    // للمالك: إظهار كل الأزرار مؤقتاً (تشخيص)
    showAll: function () {
      HIDE_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.removeProperty('display');
      });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


/* ── gmt-cache-notice.js ── */
;/* ═══════════════════════════════════════════════════════════════════════════
   gmt-cache-notice.js — 💡 تذكير تحديث البيانات · v1.0 · 2026-07-24
   يظهر شريطاً أول فتح لكل نسخة جديدة: «امسح البيانات القديمة» + كيف.
   يظهر مرة واحدة لكل نسخة (يُخزّن رقم النسخة). لا يزعج بعد ذلك.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTCacheNotice) return;
  var VERSION = 'v20260724';           // يُحدّث مع كل نشر
  var KEY = 'gmt_cache_notice_seen';

  function seen() { try { return localStorage.getItem(KEY) === VERSION; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(KEY, VERSION); } catch (e) {} }

  function show() {
    /* ══════════════════════════════════════════════════════════════════════
       🎨 (2026-10-03 · إعادة التصميم) أُوقف هذا الشريط.

       كان شريطاً **أحمرَ عرضَ الشاشة** يعلو كل صفحة ويطلب من المالك أن
       «يمسح بيانات المتصفّح القديمة» بيده. ولقطاتُ الواجهات أظهرت أنّه
       يأكل أوّل ٨٠ بكسل من **أربع شاشاتٍ من ستّ** — فيفتح الموظّف أداته
       فيرى تعليماتٍ تقنيّةً قبل عمله.

       وهو **عتيقٌ** أصلاً: كُتب في تمّوز قبل أن يوجد شريطُ التحديث (ت٥)،
       والضغطةُ الطويلة عليه (١٤٠٠ms) تمسح الكاش بنفسها وبدقّة — بلا أن
       تمسّ صور المنتجات. أي أنّ النظام صار يفعل ما كان يطلبه الشريط.

       فالقاعدة التي طبّقتُها: **أداةٌ تطلب من المستخدم عملاً يستطيع النظام
       أن يفعله هي عطلٌ لا ميزة.** والشيفرة تبقى هنا موثَّقةً لا محذوفة،
       كي يُعرَف لماذا اختفى الشريط ولا يُعاد.
       ══════════════════════════════════════════════════════════════════════ */
    if (true) { markSeen(); return; }
    if (seen() || !document.body) return;
    var bar = document.createElement('div');
    bar.id = 'gmt-cache-notice';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147482500;' +
      'background:linear-gradient(135deg,#D5001C,#8E000D);color:#fff;padding:11px 16px;' +
      'font-family:Cairo,system-ui,sans-serif;font-size:13px;font-weight:700;' +
      'display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;' +
      'box-shadow:0 3px 12px rgba(0,0,0,.2);direction:rtl';
    bar.innerHTML =
      '<span>💡 نسخة محدّثة! للحصول على أفضل أداء، امسح بيانات المتصفح القديمة.</span>' +
      '<button id="gmt-cn-how" style="background:#fff;color:#D5001C;border:0;border-radius:8px;padding:6px 14px;font:inherit;font-weight:800;cursor:pointer">كيف؟</button>' +
      '<button id="gmt-cn-ok" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:8px;padding:6px 14px;font:inherit;font-weight:800;cursor:pointer">فهمت ✓</button>';
    document.body.appendChild(bar);

    document.getElementById('gmt-cn-ok').onclick = function () { markSeen(); bar.remove(); };
    document.getElementById('gmt-cn-how').onclick = function () { showHow(); };
  }

  function showHow() {
    var m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;z-index:2147482600;background:rgba(15,18,25,.75);' +
      'display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:Cairo,system-ui,sans-serif';
    m.innerHTML =
      '<div style="background:#fff;border-radius:16px;max-width:520px;width:100%;max-height:85vh;overflow:auto;padding:22px">' +
        '<div style="font-size:18px;font-weight:900;color:#D5001C;margin-bottom:14px">💡 كيف تمسح البيانات القديمة</div>' +
        '<div style="font-size:13.5px;line-height:1.9;color:#374151">' +
          '<b>📱 على الهاتف (كروم):</b><br>' +
          '1. اضغط القفل 🔒 جنب الرابط.<br>' +
          '2. «معلومات الموقع» ← «مسح البيانات».<br>' +
          '3. أعد فتح الصفحة.<br><br>' +
          '<b>📱 لو مثبّت كتطبيق:</b><br>' +
          '1. اضغط مطوّلاً على أيقونة التطبيق.<br>' +
          '2. «معلومات التطبيق» ← «التخزين» ← «مسح التخزين».<br>' +
          '3. أو احذف التطبيق وأعد تثبيته.<br><br>' +
          '<b>💻 على الكمبيوتر:</b><br>' +
          'اضغط <b>Ctrl + Shift + R</b> (تحديث قوي).<br><br>' +
          '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;color:#15803d;font-size:12.5px">' +
          '✅ ملاحظة: هذه النسخة تتحدّث تلقائياً غالباً. هذا التذكير احتياطي فقط.</div>' +
        '</div>' +
        '<button id="gmt-cn-close" style="margin-top:16px;background:#D5001C;color:#fff;border:0;border-radius:10px;padding:11px 22px;font:inherit;font-weight:800;font-size:14px;cursor:pointer;width:100%">فهمت، شكراً</button>' +
      '</div>';
    document.body.appendChild(m);
    document.getElementById('gmt-cn-close').onclick = function () {
      markSeen(); m.remove();
      var bar = document.getElementById('gmt-cache-notice'); if (bar) bar.remove();
    };
  }

  window.GMTCacheNotice = { show: show, version: VERSION };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(show, 800); });
  else setTimeout(show, 800);
})();

/* ── gmt-cash.js — حقيقة الصندوق الموحّدة · 2026-08-26 ──────────────────────
   دالة واحدة يحسب بها الجميع «المتوقّع في الدرج»، فلا تختلف الشاشات ثانيةً.
   كانت نقطة البيع تتجاهل المصاريف، والأدمن يُرجعها موجبة (يزيد الرصيد)، وكلاهما
   يجمع total لا المقبوض فعلياً. المعادلة الصحيحة (قرار المالك، مُختبَرة):
     المتوقّع = Σ المقبوض فعلياً − المُرحّل − مصاريف الصندوق
       • المقبوض/فاتورة = paid_amount إن وُجد، وإلا total
         (نقدي=كامل · آجل=الدفعة · مرتجع=سالب · صفوف قديمة=total)
       • المُرحّل = Σ amount حيث type <> 'expense'
       • مصاريف الصندوق = −Σ amount حيث type = 'expense' (الخصم سالب؛ الاسترداد موجب)
       • فواتير [تدريب] مستثناة دائماً
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTCash) return;
  /* (٨ ج) المقبوض الفعليّ من فاتورة. قاعدتك فيها فواتير قديمة «نقدي · مدفوعة · المتبقي 0» لكن paid_amount = 0
     (العمود جاء بعدها بقيمةٍ افتراضيّة 0) فكانت تُحسب 0 في الصندوق وهي مقبوضةٌ كاملة — فصار صندوق الفرع أقلّ من الحقيقة.
     🔴 (مراجعة ACCT-1) لكن هذا الاستدلال لا يصحّ إلّا على **بيعٍ نقديٍّ موجب الإجمالي**:
       • المرتجع (إجمالي سالب): paid_amount = −المردود نقداً، وصفرٌ صريح = «خُصم من دين الزبون» (لا نقد خرج) ⇒ نأخذ المسجَّل كما هو.
       • الآجل: صفرٌ صريح = لم يُقبض شيء بعد ⇒ 0 (والتحصيل اللاحق يرفع paid_amount فيُحسب).
       القاعدة:  إجمالي ≤ 0 ⇒ المسجَّل (أو الإجمالي إن غاب) · paid موجب ⇒ paid · آجل ⇒ paid (أو الإجمالي−المتبقي إن غاب)
                 · نقدي بلا paid ⇒ الإجمالي − المتبقي إن عُرف، وإلا «مدفوعة» ⇒ الإجمالي، وإلا الإجمالي. */
  function invCash(i) {
    if (!i) return 0;
    var total = Number(i.total); if (isNaN(total)) total = 0;
    var paid = (i.paid_amount != null && i.paid_amount !== '') ? Number(i.paid_amount) : null;
    if (paid !== null && isNaN(paid)) paid = null;
    var rem = (i.remaining_amount != null && i.remaining_amount !== '') ? Number(i.remaining_amount) : null;
    if (rem !== null && isNaN(rem)) rem = null;
    if (total <= -0.004) {
      /* مرتجع: paid_amount = −المردود نقداً. صفرٌ بلا أثر ⇒ مرتجعٌ قديم رُدّ نقدُه كاملاً (يُنقص). صفرٌ مع «أُلغي من الدين: $X» في الملاحظة
         (كاتب المرتجع الحالي يدوّنها) ⇒ جزءٌ X منه خُصم من دين الزبون فلم يخرج نقد: النقد الخارج = |الإجمالي| − X. */
      if (paid !== null && Math.abs(paid) > 0.004) return paid;
      var dm = /أُلغي من الدين:\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/.exec(String(i.notes || ''));
      if (dm) return Math.min(0, total + Number(dm[1]));
      return total;
    }
    if (total <= 0.004) return paid !== null ? paid : total;
    if (paid !== null && Math.abs(paid) > 0.004) return paid;
    var credit = String(i.sale_type || '').indexOf('آجل') >= 0;
    if (credit) return paid !== null ? paid : (rem !== null ? total - rem : 0);
    if (rem !== null) return total - rem;
    var st = String(i.payment_status || '');
    if (paid !== null && !/^(paid|مدفوع)/i.test(st)) return paid;
    return total;
  }
  function expected(invoices, transfers) {
    invoices  = Array.isArray(invoices)  ? invoices  : [];
    transfers = Array.isArray(transfers) ? transfers : [];
    var real = invoices.filter(function (i) {
      return !String((i && i.customer_name) || '').startsWith('[تدريب]');
    });
    /* 🔴 (2026-09-26 · مراجعة مالية) يُطرح المقبوض **خارج درج الفرع**.
       الجذر: أوردر مدفوع جزئياً عبر شام كاش/حوالة تُعبَّأ دفعته في paid_amount،
       وكانت تُحسب نقداً في الدرج رغم أنها لم تدخله إطلاقاً ⇒ عجز وهمي عند التقفيل
       يُحاسَب عليه الكاشير. (فاتورة $430 مدفوع منها $200 شام كاش ⇒ فرق $200.)
       المبلغ يبقى في **المبيعات والمحاسبة** — يُستبعد من **الصندوق** فقط.
       دفاعي: إن لم تُشغَّل ملف SQL الأساس (SQL/أرشيف_SQL.html) فالعمود غائب ⇒ صفر ⇒ السلوك كما كان. */
    var cashReceived = real.reduce(function (s, i) {
      var v = invCash(i);
      var ext = Number(i && i.paid_external) || 0;
      if (ext > 0) v -= ext;
      return s + v;
    }, 0);
    // (2026-08-26 · إصلاح) تحصيل أوردر الشحن (type='collection') نقد **يدخل** درج الفرع
    //   — قرار المالك: «يزيد». كان يُحسب ضمن «المُرحّل» فيَنقص الصندوق بدل أن يزيد (عطل عكس الإشارة).
    var collected = transfers.filter(function (t) { return t && t.type === 'collection'; })
      .reduce(function (s, t) { return s + Math.abs(Number(t.amount) || 0); }, 0);
    var transferred = transfers.filter(function (t) { return t && t.type !== 'expense' && t.type !== 'collection'; })
      .reduce(function (s, t) { return s + (Number(t.amount) || 0); }, 0);
    /* (٨ ج) مصروف الصندوق سالبُ الإشارة دائماً (−مبلغ) — فالمجموع بإشارته: خصمٌ يُنقص الصندوق، واستردادٌ موجب
       (تخفيض دفعة فاتورة شراء كانت من درج الفرع) يُعيد إليه. كان Math.abs يعدّ الاسترداد خصماً ثانياً. */
    var cashExpenses = transfers.filter(function (t) { return t && t.type === 'expense'; })
      .reduce(function (s, t) { return s - (Number(t.amount) || 0); }, 0);
    var external = real.reduce(function (s, i) {
      return s + (Number(i && i.paid_external) || 0);
    }, 0);
    return {
      cashReceived: cashReceived,
      external: external,          /* مقبوض للشركة خارج الدرج — للعرض والتفسير */
      collected: collected,
      transferred: transferred,
      cashExpenses: cashExpenses,
      expected: Math.max(0, cashReceived + collected - transferred - cashExpenses)
    };
  }
  window.GMTCash = { expected: expected, invCash: invCash };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   GMTCashTx — كتابة حركات الصندوق في branch_transfers بما يتحمّله جدولُك
   ───────────────────────────────────────────────────────────────────────────
   جذرٌ وُجد بقراءة القاعدة الحيّة: الجدول أُنشئ أصلاً لنقل البضاعة وفيه أعمدةٌ إلزاميّة (transfer_number · from_branch ·
   from_branch_name · to_branch · to_branch_name) لا تكتبها حركاتُ الصندوق ⇒ كل إدراجٍ يُرفض (23502) ⇒ لا ترحيل ولا
   تحصيل أوردر ولا خصم مصروف دخل القاعدة قط. وinvoice_id كان bigint بينما معرّفات الفواتير uuid (22P02).
   الحلّ هنا بلا لمس القاعدة: نُكمل الأعمدة الإلزاميّة بقيمٍ صادقة (مصدر = الفرع · وجهة = الإدارة · رقمٌ فريد)،
   ونُسقط ما لا يوجد من أعمدةٍ (PGRST204) ونحوّل invoice_id إلى الملاحظة إن رُفض نوعُه. (ملف SQL 36 يُصلح الجدول نفسه.)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.GMTCashTx) return;
  function uniq() { return 'CASH-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  function fill(row) {
    var r = Object.assign({}, row || {});
    var bk = r.branch_key || '';
    if (r.transfer_number == null) r.transfer_number = uniq();
    if (r.from_branch == null) r.from_branch = bk || 'central';
    if (r.from_branch_name == null) r.from_branch_name = r.branch_name || bk || 'الإدارة';
    if (r.to_branch == null) r.to_branch = 'central';
    if (r.to_branch_name == null) r.to_branch_name = 'الإدارة';
    return r;
  }
  /* send(body) → Promise<{ok, status, text, data}> ؛ يعيد المحاولة بتعديلٍ واحد لكلّ علّة معروفة */
  async function post(send, row, opts) {
    opts = opts || {};
    var body = opts.raw ? Object.assign({}, row) : fill(row);
    var res, moved = {};
    for (var n = 0; n < 8; n++) {
      res = await send(body);
      if (res && res.ok) return Object.assign({ moved: moved }, res);
      var t = String((res && (res.text || res.error)) || '');
      var m = /Could not find the '([^']+)' column|column "?([a-z_]+)"? (?:of relation "[a-z_]+" )?does not exist/i.exec(t);
      var col = m && (m[1] || m[2]);
      if (col && col in body) {
        /* (مراجعة I-13) أعمدة الربط بالأوردر/الفاتورة لا تُسقَط بصمت: أثرها يُحفظ في الملاحظة (للتدقيق ولمنع التحصيل المزدوج) */
        if (/^(order_id|order_serial|invoice_id)$/.test(col) && body[col] != null) {
          moved[col] = body[col];
          body.note = ((body.note || '') + ' · [' + col + '=' + body[col] + ']').replace(/^ · /, '');
        }
        delete body[col]; continue;
      }
      if (/22P02|invalid input syntax for type (bigint|uuid)/i.test(t) && body.invoice_id != null) {
        moved.invoice_id = body.invoice_id;
        body.note = ((body.note || '') + ' · [invoice_id=' + body.invoice_id + ']').replace(/^ · /, '');
        delete body.invoice_id; continue;
      }
      var nn = /null value in column "([a-z_]+)"/i.exec(t);
      if (nn && body[nn[1]] == null) { body[nn[1]] = nn[1] === 'transfer_number' ? uniq() : (nn[1].indexOf('name') >= 0 ? 'الإدارة' : 'central'); continue; }
      break;
    }
    return res;
  }
  window.GMTCashTx = { fill: fill, post: post, uniq: uniq };
})();
