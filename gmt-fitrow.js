/* ═══════════════════════════════════════════════════════════════════════════
   gmt-fitrow.js — الصفوف التي تخرج من الشاشة تصير قابلةً للسحب  ·  2026-10-03
   ─────────────────────────────────────────────────────────────────────────
   ثلاثة بلاغاتٍ للمالك عائلتُها واحدة:
     · «أزرارٌ فوق بعضها وزرّ الفلترة سيّئ»
     · «زرّ التسوية يختفي فجأةً»
     · «واجهة الموبايل سيّئة»

   والسبب واحد: صفُّ تبويباتٍ أو فلاتر بـ`display:flex` **بلا معالجةٍ للضيق**.
   على الحاسب يتّسع فيبدو سليماً، وعلى الهاتف يفيض أفقياً فتخرج آخرُ الأزرار
   **خارج حدّ الرؤية بلا أي إشارة** — فيراها المالك «تختفي فجأةً» وهي موجودة.
   وقياسُ التخطيط أثبتها: «تم التحصيل» عند **−268px** من حافّة شاشة الهاتف.

   ⚠️ ولا تُكشَف بقراءة الكود إطلاقاً: السطر `display:flex;gap:8px` سليمٌ تماماً.
      العطل في **الناتج المرسوم** عند عرضٍ معيّن.

   العلاج — ولماذا هذا بالذات:
     · لا نُغيّر `flex-wrap` (جرّبتُه في زرّ التحديث فحرّك ترويسات المالك ونزل
       الزرّ ٥٠١px). تغييرُ التفاف صفٍّ لم نكتبه يُحرّك كل ما فيه.
     · ولا نُصغّر الخطّ ولا الحشو — فيصير غير قابلٍ للضغط بالإصبع.
     · بل نجعل الصفّ **قابلاً للسحب أفقياً** (`overflow-x:auto`) مع تدرّجٍ على
       الحافّة يقول «في المزيد». الأزرار تبقى بحجمها ومكانها، ويصل المالك
       إليها بإصبعه — وهي الحركة التي يعرفها كل مستخدم هاتف.
     · ولا يُطبَّق إلّا على صفٍّ **يفيض فعلاً** — يُقاس لا يُفترَض. فإن اتّسع
       على شاشةٍ أكبر عاد كما كان.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.GMTFitRow) return;

  var MARK = 'data-gmt-fit';

  function styles() {
    if (doc.getElementById('gmt-fitrow-css')) return;
    var st = doc.createElement('style');
    st.id = 'gmt-fitrow-css';
    st.textContent = [
      '[' + MARK + '="1"]{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;',
      'scrollbar-width:thin;scroll-behavior:smooth}',
      '[' + MARK + '="1"]::-webkit-scrollbar{height:4px}',
      '[' + MARK + '="1"]::-webkit-scrollbar-thumb{background:rgba(0,0,0,.18);border-radius:99px}',
      /* تدرّجٌ على الحافّة يقول «في المزيد» — يختفي عند الوصول للنهاية */
      '[' + MARK + '="1"].gmt-fit-more{-webkit-mask-image:linear-gradient(to left,#000 86%,transparent 100%);',
      'mask-image:linear-gradient(to left,#000 86%,transparent 100%)}',
      '[' + MARK + '="1"] > *{flex-shrink:0}'
    ].join('');
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* أوّلُ ابنين مرئيّين في سطرٍ واحد ⇒ هذا صفٌّ أفقيّ مهما كان `display` */
  function sameRow(el) {
    var ks = [], i;
    for (i = 0; i < el.children.length && ks.length < 2; i++) {
      var k = el.children[i];
      var r = k.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) ks.push(r);
    }
    if (ks.length < 2) return false;
    var overlapY = Math.min(ks[0].bottom, ks[1].bottom) - Math.max(ks[0].top, ks[1].top);
    return overlapY > Math.min(ks[0].height, ks[1].height) * 0.5;
  }

  /* صفٌّ أفقيٌّ مرشَّح: فيه عناصرُ قابلةٌ للضغط، وعرضُه الحقيقيّ أكبر من المرئيّ */
  function candidates() {
    var out = [];
    /* (٧ ط) القوائم الكبيرة (شبكة المنتجات · جدول الجرد · قوائم الأوردرات) ليست صفوف أزرار —
       نتخطّاها كلّها من المحرّك نفسه بدل المرور على عشرات آلاف العناصر داخلها */
    var NOT = ':not([data-skip-fit] *):not(#prodsGrid *):not(#cards-grid *):not(#table-body *):not(#gc-products-grid *):not([id^="list-"] *)';
    var all = doc.querySelectorAll(['div', 'nav', 'header', 'section', 'ul'].map(function (t) { return t + NOT; }).join(','));
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      /* (٧ ط · «تعليق وتقطيع») القياسات الرخيصة أوّلاً: الصفّ الذي لا يفيض يُتخطّى قبل getComputedStyle.
         كانت تُحسب أنماط كل عنصرٍ في الصفحة (~٢٠ ألفاً مع ٢٠٠٠ منتج) بعد **كل** تغيّرٍ في الصفحة
         ⇒ نصف ثانيةٍ متجمّدة بعد كل بحثٍ أو إضافةٍ للسلّة. الآن نفس النتيجة بجزءٍ من الكلفة. */
      var cw = el.clientWidth;
      if (!cw) continue;
      var over = el.scrollWidth - cw;
      if (over < 8) continue;                       // لا يفيض ⇒ لا نلمسه
      if (el.clientHeight > 220) continue;          // ليس صفّاً بل لوحة
      if (el.hasAttribute('data-skip-fit')) continue;
      /* لا نلمس طبقاتنا ولا النوافذ */
      if (el.closest('.gg4,#gmt-intro,#gmt-wn-ov,#gmt-refresh-bar,.gl-card')) continue;
      var cs;
      try { cs = getComputedStyle(el); } catch (_) { continue; }
      if (cs.flexWrap === 'wrap' || cs.flexWrap === 'wrap-reverse') continue;   // يلتفّ أصلاً
      if (cs.flexDirection === 'column' || cs.flexDirection === 'column-reverse') continue;
      if (cs.position === 'fixed' || cs.position === 'absolute') continue;      // طبقاتٌ لها منطقها
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;       // مُعالَجٌ أصلاً
      /* ⚠️ (2026-10-03) كان الشرط `button,a,[role=button],select,input` — فتخطّى
         `#tabs` في صفحة الجسر: تبويباتُه `<div onclick="…">`. وهي أزرارٌ عملياً
         في يد المالك مهما كان وسمُها. المعيار: **هل يُضغَط؟** لا **ما اسمه؟** */
      if (!el.querySelector('button,a,[role=button],select,input,[onclick],[data-tab]')) continue;
      /* ⚠️ (2026-10-03) كان الشرط `display:flex` وحده — فتخطّى `#tabs` في صفحة
         الجسر، وهو صفُّ تبويباتٍ بـ`display:block` وأبناءٍ `inline-block`.
         فالمعيارُ الصحيح **قياسٌ لا نوعُ عرض**.
         ⚠️⚠️ ثمّ جعلتُ `sameRow` شرطاً على الجميع فانكسرت صفوفٌ كانت تعمل
         (مركز التحكّم وأدمن المتجر): فيها ابنٌ واحدٌ يحوي الأزرار، فلا «ابنان
         في سطر». فصارت `sameRow` **بديلاً** لا شرطاً إضافياً: صفُّ flex يُقبَل
         بنوعه، وغيرُه يُقبَل بقياسه. (العلاج الذي يكسر ما كان يعمل ليس علاجاً.) */
      var isFlexRow = (cs.display === 'flex' || cs.display === 'inline-flex');
      if (!isFlexRow && !sameRow(el)) continue;
      out.push(el);
    }
    return out;
  }

  function markMore(el) {
    try {
      var atEnd = Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 4;
      el.classList.toggle('gmt-fit-more', !atEnd);
    } catch (_) {}
  }

  var applied = 0;
  function apply() {
    try {
      styles();
      candidates().forEach(function (el) {
        if (el.getAttribute(MARK) === '1') { markMore(el); return; }
        el.setAttribute(MARK, '1');
        applied++;
        markMore(el);
        el.addEventListener('scroll', function () { markMore(el); }, { passive: true });
      });
      /* صفٌّ اتّسع لاحقاً (دوران الشاشة) ⇒ نُحرّره */
      doc.querySelectorAll('[' + MARK + '="1"]').forEach(function (el) {
        if (el.scrollWidth - el.clientWidth < 4) {
          el.removeAttribute(MARK);
          el.classList.remove('gmt-fit-more');
        }
      });
    } catch (_) {}
  }

  global.GMTFitRow = { apply: apply, count: function () { return applied; } };

  /* ── (٧ ي-٥ · المراجعة البصريّة للتبويبات) التبويب المختار يُرى ─────────────────────────────
     صفُّ تبويباتٍ يتمرّر أفقيّاً (أدمن النقاط ١٤ تبويباً): تضغط تبويباً نصفُه خارج الحافّة فيُفتح، ويبقى اسمه
     مقصوصاً عند الحافّة — فلا تعرف أين أنت. الآن: أيّ ضغطةٍ داخل صفٍّ يتمرّر أفقيّاً تُحضر المضغوط إلى الوسط.
     (أفقيّاً فقط: لا نحرّك الصفحة عموديّاً.) */
  function hScroller(el) {
    for (var a = el && el.parentElement; a && a !== doc.body; a = a.parentElement) {
      if (a.scrollWidth - a.clientWidth > 4) {
        var o = getComputedStyle(a).overflowX;
        if (o === 'auto' || o === 'scroll') return a;
      }
    }
    return null;
  }
  function centerIn(row, item) {
    try {
      var rr = row.getBoundingClientRect(), ir = item.getBoundingClientRect();
      var delta = (ir.left + ir.width / 2) - (rr.left + rr.width / 2);
      if (Math.abs(delta) < 8) return;
      row.scrollBy({ left: delta, behavior: 'smooth' });
    } catch (_) {}
  }
  doc.addEventListener('click', function (e) {
    var item = e.target && e.target.closest && e.target.closest('button,a,[role=tab],.tab,[onclick]');
    if (!item) return;
    var row = hScroller(item);
    /* صفٌّ لا جدول: سطرٌ واحد من الأزرار (الجداول العريضة تتمرّر أيضاً — وتحريكها تحت إصبعك مزعج) */
    if (!row || row === doc.documentElement || row.clientHeight > 96 || row.querySelector('table')) return;
    setTimeout(function () { if (doc.contains(item)) centerIn(row, item); }, 30);
  }, true);

  function init() {
    apply();
    [500, 1400, 3000, 5000].forEach(function (ms) { setTimeout(apply, ms); });
    try {
      global.addEventListener('resize', function () { setTimeout(apply, 120); });
      global.addEventListener('orientationchange', function () { setTimeout(apply, 300); });
      /* (٧ ط) لا نُعيد القياس لتغيّر نصٍّ أو عدّاد — فقط حين تُضاف/تُزال عناصر — وفي وقت فراغ المتصفّح */
      var idle = global.requestIdleCallback || function (f) { return setTimeout(f, 1); };
      new MutationObserver(function (muts) {
        var real = false;
        for (var m = 0; m < muts.length && !real; m++) {
          var ns = muts[m].addedNodes;
          for (var n = 0; n < ns.length; n++) { if (ns[n].nodeType === 1) { real = true; break; } }
        }
        if (!real) return;
        clearTimeout(init._t);
        init._t = setTimeout(function () { if (!doc.hidden) idle(apply, { timeout: 1500 }); }, 400);
      }).observe(doc.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
