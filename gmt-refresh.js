/* ═══════════════════════════════════════════════════════════════════════════
   gmt-refresh.js — زرّ التحديث الثابت في كل شاشة  ·  2026-10-03
   ─────────────────────────────────────────────────────────────────────────
   قرار المالك ت٥: «زرّ ثابت في شريط الصفحة — لا فقاعة».

   وهو حلٌّ لتضاربٍ بين طلبين من المالك نفسه:
     ① «بعد ما ثبّتنا التطبيق، إذا علّق النظام صعب السيطرة عليه — لازم يكون في
        زرّ ريفريش بكل الشاشات مثل ما كان موجود في متصفّح كروم».
     ② «أزل كل الأزرار العائمة واستبدلها بأزرار ثابتة في الخيارات».

   والسبب الحقيقيّ للطلب ①: التطبيق مثبَّتٌ كـPWA ⇒ **لا شريط متصفّح ولا زرّ
   إعادة تحميل**. فإن تجمّدت شاشةٌ أو بقي مؤشّر تحميلٍ دائراً فلا مخرج إلّا
   إغلاق التطبيق كلّه.

   ولماذا لا «داخل الخيارات»؟ لأنّ المالك قال «إذا علّق النظام» — وقائمة
   الخيارات نفسها قد لا تُفتح وقتها. الزرّ الذي يُنقِذ من التعليق لا يصحّ أن
   يكون خلف نافذةٍ تحتاج النظام سليماً لتُفتح.

   كيف يُوفَّق بين الطلبين عملياً:
     · إن وُجد شريطٌ علويٌّ للصفحة ⇒ يُزرَع **داخله** (زرٌّ في الشريط، لا فقاعة).
     · إن لم يوجد ⇒ شريطٌ علويٌّ نحيف يُسجَّل في `GMTTopBars` الذي **يدفع محتوى
       الصفحة لأسفل** فلا يُغطّي شيئاً — وهذا ما يفرّقه عن الفقاعة: الفقاعة تطفو
       فوق المحتوى، وهذا يأخذ مكانه في التصميم.

   ضغطةٌ واحدة  = إعادة تحميل.
   ضغطةٌ طويلة  = إعادة تحميل قاسية (تُمسح أكواشُ الصفحات) — لحالة «علّق ولا يفكّ».
   ومعها علمٌ على `data-keep-fab` كي لا يحذفه `gmt-nofab.js`.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc) return;
  /* ═══ (2026-10-06 · دراسة الرئيسيّة ٦) «الأزرار العلويّة مثل التحديث واللي جنبها كثير سيّء تصميمها».
     أربع وحداتٍ تزرع أزرارها بأحجامٍ وألوانٍ مختلفة (٣٠ و٣٤ بكسل · كحليّ · كبسولة بنصّ). شكلٌ واحدٌ للجميع:
     مربّع ٤٠ بكسل أبيض بحافّة رفيعة وأيقونة خطّية — كأزرار نموذج الهويّة. ═══ */
  (function () {
    if (document.getElementById('gmt-topbtn-css')) return;
    var st = document.createElement('style'); st.id = 'gmt-topbtn-css';
    st.textContent =
      '#gmt-notify-btn,#gmt-sound-btn,#gmt-refresh-btn,#gmt-wn-fab,#gmt-hints-fab,#gmt-tools-btn{width:40px!important;height:40px!important;min-width:40px!important;padding:0!important;' +
      'border-radius:12px!important;background:#fff!important;border:1px solid rgba(15,18,25,.10)!important;color:#0f1219!important;' +
      'box-shadow:0 1px 2px rgba(15,18,25,.05)!important;display:inline-grid!important;place-items:center!important;gap:0!important;cursor:pointer}' +
      '#gmt-notify-btn:hover,#gmt-sound-btn:hover,#gmt-refresh-btn:hover,#gmt-wn-fab:hover,#gmt-hints-fab:hover,#gmt-tools-btn:hover{border-color:#D5001C!important;color:#D5001C!important}' +
      '#gmt-notify-btn svg,#gmt-sound-btn svg,#gmt-refresh-btn svg,#gmt-wn-fab svg,#gmt-tools-btn svg{width:18px!important;height:18px!important;color:inherit!important;stroke:currentColor}' +
      '#gmt-refresh-btn > :not(.gr-ico){display:none!important}' +
      '#gmt-refresh-btn .gr-ico{display:inline-grid!important}';
    (document.head || document.documentElement).appendChild(st);
  })();

  if (global.GMTRefresh) return;                 // لا تكرار

  var BTN_ID = 'gmt-refresh-btn';
  var BAR_ID = 'gmt-refresh-bar';

  /* صفحات الزبون لا تحتاجه — ولا نضع واجهةً داخلية على صفحةٍ عامّة.
     (قاعدة المالك: «الأزرار… ما تطلع لصفحات الزبون أبداً»)

     ونستعمل اتّفاقيّة المشروع نفسها لا قائمةَ أسماءٍ أخرى: الصفحة الداخلية
     تُعلِن `window.GMT_INTERNAL = 1` في رأسها، و**الغياب يعني عامّة** — فالنسيان
     يَمنع ولا يُسرّب. (وهو نصُّ التعليق المكتوب في رؤوس تلك الصفحات.)

     وحالةٌ خاصّة: `guarantee.html` داخليّةٌ عند الإصدار، وتصير **شهادةَ زبون**
     حين تُفتَح بـ`?w=<رقم>`. فلا زرَّ تحديثٍ في عرض الشهادة. */
  function isPublicPage() {
    if (global.GMT_PUBLIC) return true;
    if (!global.GMT_INTERNAL) return true;
    try {
      if (new URLSearchParams(location.search).get('w')) return true;   // شهادة زبون
    } catch (_) {}
    return false;
  }

  /* ⚠️ (2026-10-03) جرّبتُ أوّلاً زرعَ الزرّ **داخل ترويسة كل صفحة** وفشل قياساً:
     الترويسات الأربعون مختلفةٌ تماماً، ولأُجبرها على استيعاب الزرّ كنتُ أضبط
     عليها `display:flex` و`flex-wrap:wrap`. فنزل الزرّ سطراً جديداً أسفل
     الترويسة — قاس الفحص موضعَه فوجده عند **501px** في الأوردرات و**465px**
     في المشتريات، أي خارج الشاشة الأولى في الهاتف. وهو زرُّ طوارئٍ لا يصحّ
     أن يُطلب منه تمرير.

     والأخطر أنّ العلاج نفسه كان مخالفة: تعديلُ `flex-wrap` على ترويسةٍ لم
     أكتبها يُحرّك عناصرَها الأخرى — وقاعدة المالك: «مابصير نضيف ميزة بتأثّر
     ع غير شي وانت ما تعرف».

     فالقرار: شريطٌ واحدٌ نحيفٌ خاصٌّ به في كل الصفحات. ومكاسبُه:
       · **مكانٌ واحدٌ ثابت** في الأربعين شاشة — يحفظه بيده وقت التعليق.
       · في أعلى الشاشة دائماً، بلا تمرير.
       · يُسجَّل في `GMTTopBars` الذي **يدفع جسم الصفحة لأسفل** بمقدار ارتفاعه
         ⇒ لا يُغطّي محتوى، وهذا هو الفرق الجوهريّ عن الفقاعة.
       · وصفرُ لمسٍ لترويسات المالك.
     وهو أوّل الأشرطة في الترتيب كي لا يتزحزح مكانُه كلّما ظهر تنبيهٌ أو اختفى. */

  function styles() {
    if (doc.getElementById('gmt-refresh-css')) return;
    var s = doc.createElement('style');
    s.id = 'gmt-refresh-css';
    s.textContent = [
      /* ══ 🎨 إعادة تصميم الشريط العلوي (2026-10-03) ══
         لقطةُ الواجهات أظهرت ثلاثَ رقاقاتٍ متلاصقةً في زاوية كل شاشة،
         وكلمةُ «تحديث» **مقصوصةً** إلى «تحدي». السبب: `justify-content:
         flex-end` في صفحةٍ عربية يكدّس كل شيءٍ في الزاوية، ولا مساحةَ
         تتنفّس فيها الأزرار.

         الشريطُ الآن **كروم لا محتوى**: يتنحّى بصرياً (رمادٌ خفيف، حدٌّ
         واحد، لا ظلّ)، ويُوزَّع طرفاه — إشعاراتٌ يميناً وتحديثٌ يساراً —
         فلا تلتصق ولا تُقصّ. والأيقونةُ وحدها تكفي على الشاشات الضيّقة،
         والكلمةُ تظهر حين تتّسع. */
      '#' + BTN_ID + '{display:inline-flex;align-items:center;gap:6px;cursor:pointer;',
      'border:1px solid rgba(15,23,42,.10);background:#fff;color:#334155;border-radius:9px;',
      'padding:6px 10px;font-family:inherit;font-size:12px;font-weight:700;line-height:1;',
      'flex:0 0 auto;white-space:nowrap;-webkit-tap-highlight-color:transparent;',
      'transition:background .14s,border-color .14s}',
      '#' + BTN_ID + ':hover{background:#f8fafc;border-color:rgba(15,23,42,.18)}',
      '#' + BTN_ID + ':active{transform:scale(.96)}',
      '#' + BTN_ID + '[data-busy="1"] .gr-ico{animation:gr-spin .7s linear infinite}',
      '#' + BTN_ID + '.gr-hard{border-color:#D5001C;color:#D5001C;background:#fff5f5}',
      '@keyframes gr-spin{to{transform:rotate(360deg)}}',
      /* الكلمة تُخفى تحت 360px فقط — لا تُقصّ أبداً */
      '@media (max-width:359px){#' + BTN_ID + ' .gr-txt{display:none}}',
      '#' + BAR_ID + '{position:fixed;inset-inline:0;top:0;z-index:8800;display:flex;',
      'align-items:center;justify-content:flex-end;gap:8px;padding:6px 12px;',
      'background:rgba(255,255,255,.94);backdrop-filter:saturate(1.4) blur(8px);',
      'border-bottom:1px solid rgba(15,23,42,.07);min-height:40px;box-sizing:border-box}',
      /* كلُّ ما يُحقن في الشريط يأخذ نفس الارتفاع فلا يقفز السطر */
      '#' + BAR_ID + ' > *{flex:0 0 auto}',
      /* (٧ ي-٤ · المراجعة البصريّة) صار في الشريط أربعة أزرار (الإشعارات · التحديث · 🧰 · ما الجديد)
         و«space-between» يوزّعها على عرض الشاشة كلّه — زرٌّ وحيد في المنتصف وآخر في الثلث، كأنّها شاردة.
         الآن طرفان كما قُصد أوّلاً: الإشعارات وحدها في البداية، والأدوات متجاورةً في النهاية. */
      '#' + BAR_ID + ' #gmt-notify-btn{order:-1;margin-inline-end:auto}',
      '@media print{#' + BTN_ID + ',#' + BAR_ID + '{display:none!important}}',
      /* (٧ ط · فحص المرتجع) الشريط العلويّ (z ٨٨٠٠) كان يغطّي رأس كل نافذةٍ أدنى منه — زرّ ✕ في
         «تفاصيل الفاتورة» كان تحته. الآن النوافذ الكاملة تبدأ تحت الأشرطة: الشريط يبقى في متناولك
         (التحديث وقت التعليق) والنافذة كاملةٌ مرئيّة. ما يغطّي الشاشة كلّها عمداً (الانترو · الدروس) مستثنى. */
      '[style*="position:fixed;inset:0"]:not(#gmt-intro):not(#gmt-wn-ov):not([data-full]),',
      '[style*="position: fixed; inset: 0"]:not(#gmt-intro):not(#gmt-wn-ov):not([data-full]),',
      '.u-modal,.modal-overlay,.modal-bg,.fixed.inset-0:not([data-full]){top:var(--gmt-topbars,0px)!important}'
    ].join('');
    (doc.head || doc.documentElement).appendChild(s);
  }

  function label() {
    /* (2026-10-04 ي) أيقونةٌ خطّيّة من الطقم الموحّد، والرمزُ التعبيريّ احتياطٌ فقط */
    var ico = (global.GMTIcon && GMTIcon.has('refresh')) ? GMTIcon.svg('refresh', 15) : '🔄';
    return '<span class="gr-ico" aria-hidden="true" style="display:inline-grid;place-items:center">' + ico + '</span><span class="gr-txt">تحديث</span>';
  }

  var pressT = null, didHard = false;

  function softReload() {
    var b = doc.getElementById(BTN_ID);
    if (b) b.setAttribute('data-busy', '1');
    try { location.reload(); } catch (_) { location.href = location.href; }
  }

  /* إعادة تحميل قاسية: نُفرِغ أكواش الصفحات ثمّ نُحمّل.
     ⚠️ لا نُلغي تسجيل عامل الخدمة ولا نمسح IndexedDB — فيها صور المنتجات
     المخزَّنة لتوفير egress، ومسحُها يُعيد سحب غيغاباتٍ على المالك. */
  async function hardReload() {
    var b = doc.getElementById(BTN_ID);
    if (b) { b.setAttribute('data-busy', '1'); b.classList.add('gr-hard'); }
    try {
      if (global.caches && caches.keys) {
        var keys = await caches.keys();
        await Promise.all(keys.filter(function (k) {
          return /gmt-pages|gmt-v/.test(k);          // أكواش الصفحات فقط
        }).map(function (k) { return caches.delete(k); }));
      }
    } catch (_) {}
    try { location.reload(); } catch (_) { location.href = location.href; }
  }

  function wire(btn) {
    btn.setAttribute('data-keep-fab', '1');        // لا يحذفه gmt-nofab
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'تحديث الصفحة');
    btn.title = 'تحديث الصفحة · اضغط مطوَّلاً لإعادة تحميلٍ قاسية إن تعلّق النظام';
    btn.innerHTML = label();

    function down() {
      didHard = false;
      clearTimeout(pressT);
      pressT = setTimeout(function () { didHard = true; hardReload(); }, 1400);
    }
    function up() { clearTimeout(pressT); }

    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (didHard) { didHard = false; return; }    // الضغطة الطويلة نفّذت فعلها
      softReload();
    });
    /* لمس الهواتف: نمنع قائمة السياق عند الضغط المطوَّل */
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function place() {
    if (isPublicPage()) return;
    if (doc.getElementById(BTN_ID)) return;
    if (!doc.body) return;
    styles();

    var btn = doc.createElement('button');
    btn.id = BTN_ID;
    wire(btn);

    var bar = doc.getElementById(BAR_ID);
    if (!bar) {
      bar = doc.createElement('div');
      bar.id = BAR_ID;
      bar.setAttribute('data-keep-fab', '1');
      doc.body.appendChild(bar);
    }
    bar.appendChild(btn);
    /* مُرتِّب الأشرطة يَرُصّ ويدفع المحتوى — بلا ذلك يُغطّي ويصير فقاعة */
    pad();
  }

  /* ── (٧ ي-٤ · المراجعة البصريّة) الشريط لا يغطّي رأس الصفحة ──────────────────────────────
     ① ١٦ صفحة (سجل المبيعات · كلمات السر · دليل المستخدم · التقرير الأسبوعي …) لا تحمّل gmt-staff.js
        وفيه «مُرتِّب الأشرطة» الذي يدفع المحتوى لأسفل ⇒ الشريط كان يجلس فوق عنوان الصفحة ويخفيه.
        الآن: إن غاب المرتِّب ندفع نحن بمقدار ارتفاع الشريط.
     ② الرؤوس اللاصقة (position:sticky; top:0) كانت تنزلق **تحت** الشريط عند التمرير فيختفي العنوان
        والتبويبات. نزيحها بمقدار الأشرطة — فقط ما يلتصق بالصفحة نفسها، لا ما يلتصق داخل صندوقٍ
        يتمرّر (رؤوس الجداول): هناك الإزاحة تصنع فجوة. */
  function barH() {
    var bar = doc.getElementById(BAR_ID); if (!bar) return 0;
    var cs = getComputedStyle(bar);
    if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return 0;
    return bar.offsetHeight || 0;
  }
  function pad() {
    try {
      if (global.GMTTopBars && GMTTopBars.apply) GMTTopBars.apply();
      else if (doc.body) {
        var h = barH();
        doc.body.style.paddingTop = h ? h + 'px' : '';
        doc.documentElement.style.setProperty('--gmt-topbars', h + 'px');
      }
      stick();
    } catch (_) {}
  }
  function scrollsInside(el) {
    for (var p = el.parentElement; p && p !== doc.body && p !== doc.documentElement; p = p.parentElement) {
      var o = getComputedStyle(p);
      if (o.overflowY !== 'visible' || o.overflowX !== 'visible') return true;
    }
    return false;
  }
  function stick() {
    var tb = (getComputedStyle(doc.documentElement).getPropertyValue('--gmt-topbars') || '').trim();
    if (!tb || tb === '0px') return;
    var seen = [];
    var add = function (el) { if (el && seen.indexOf(el) < 0) seen.push(el); };
    var walk = function (rules) {
      for (var i = 0; rules && i < rules.length; i++) {
        var r = rules[i];
        if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; }
        if (!r.style || !/sticky/.test(r.style.position || '')) continue;
        try { doc.querySelectorAll(r.selectorText).forEach(add); } catch (_) {}
      }
    };
    for (var k = 0; k < doc.styleSheets.length; k++) { try { walk(doc.styleSheets[k].cssRules); } catch (_) {} }
    try { doc.querySelectorAll('[style*="sticky"],.sticky').forEach(add); } catch (_) {}
    seen.forEach(function (el) {
      if (el.closest('#' + BAR_ID + ',[data-full]')) return;
      var cs = getComputedStyle(el);
      if (!/sticky/.test(cs.position)) return;
      var base = el.getAttribute('data-gmt-stick');
      if (base == null) {
        var t = parseFloat(cs.top);
        if (isNaN(t) || t > 80 || scrollsInside(el)) return;
        base = String(t); el.setAttribute('data-gmt-stick', base);
      }
      el.style.top = 'calc(var(--gmt-topbars, 0px) + ' + base + 'px)';
    });
  }

  function init() {
    place();
    /* (2026-10-04 ي) الأيقونةُ تُحمَّل مؤجّلة؛ نُعيد رسمَ الزرّ مرّةً حين تصل */
    setTimeout(function () { var b = doc.getElementById(BTN_ID); if (b && global.GMTIcon) b.innerHTML = label(); }, 1100);
    /* الأشرطة تُبنى أحياناً بعد التحميل (نقطة البيع ترسم رأسها بالـJS) */
    [300, 900, 2000, 4000].forEach(function (ms) { setTimeout(function () { place(); pad(); }, ms); });
    try { global.addEventListener('resize', function () { clearTimeout(init._rz); init._rz = setTimeout(pad, 120); }); } catch (_) {}
    try {
      new MutationObserver(function () {
        if (!doc.getElementById(BTN_ID)) place();
      }).observe(doc.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }

  global.GMTRefresh = { place: place, soft: softReload, hard: hardReload, pad: pad };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
