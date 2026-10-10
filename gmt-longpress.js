/* ═══════════════════════════════════════════════════════════════════════════
   gmt-longpress.js — الضغطةُ الطويلة تفتح التفاصيل
   أُنشئ: 2026-10-04

   ══ طلبُك ══
   «ضغطة طويلة عليه تفتح تفاصيله… أزرار الإجراءات معروضة فقط للنسخة الأدمن،
    أمّا لنسخة المستخدم العادي فهي لونها كاشف وغير مفعّلة».

   ══ لماذا وحدةٌ مستقلّة ══
   لأنّ الحاجةَ واحدةٌ في أكثر من شاشة: صفُّ منتجٍ في الجرد · بطاقةُ منتجٍ في
   نقطة البيع · صفُّ أوردرٍ · صفُّ كفالة. ولو كتبتُها في كلّ صفحةٍ لصار عندي
   أربعُ ضغطاتٍ طويلةٍ تتصرّف بأربع طرقٍ مختلفة — وهو عينُ ما تشكو منه.
   فصارت قاعدةً واحدة: أيُّ عنصرٍ يحمل `data-longpress` يُنفّذها.

   ══ القرارات التي تجعلها تعمل فعلاً ══
   • **٥٠٠ms** — أقصرُ منها يُطلقها السحبُ العاديّ، وأطولُ يبدو معطّلاً.
   • **تُلغى بالحركة**: إن تحرّك الإصبعُ أكثرَ من ١٠px فهو يُمرّر الصفحةَ لا
     يضغط. بلا هذا تفتح التفاصيلُ في وجه من يُمرّر — وهو أسوأُ من غيابها.
   • **اهتزازةٌ قصيرة** عند الإطلاق إن كان الجهاز يدعمها: تقول «أمسكتُ».
   • **تُلغي قائمةَ المتصفّح** السياقيّة في تلك اللحظة فقط، لا دائماً.
   • **على الفأرة**: ضغطةٌ يمنى (contextmenu) تفعل الشيءَ نفسَه — فسطحُ
     المكتب ليس له «ضغطةٌ طويلة» بالمعنى نفسه.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTLongPress) return;

  var MS = 500, MOVE_TOL = 10;
  var timer = null, startX = 0, startY = 0, target = null, fired = false;

  function handlerFor(el) {
    var fn = el.getAttribute('data-longpress');
    if (!fn) return null;
    return function () {
      try {
        /* نُنفّذها في سياق الصفحة كي ترى الدوالَّ المعرّفة في أعلى السكربت
           (الارتباطاتُ بـlet لا تُرى عبر window — درسٌ سابق). */
        (0, eval)(fn);
      } catch (e) {
        try { console.warn('longpress:', e && e.message); } catch (_) {}
      }
    };
  }

  function clear() {
    if (timer) { clearTimeout(timer); timer = null; }
    target = null;
  }

  function onStart(ev) {
    var el = ev.target && ev.target.closest && ev.target.closest('[data-longpress]');
    if (!el) return;
    /* لا نخطف ضغطةً على زرٍّ أو حقلٍ داخل الصفّ — تلك لها فعلُها. */
    if (ev.target.closest('button, a, input, select, textarea, [role="button"]')) return;
    var t = (ev.touches && ev.touches[0]) || ev;
    startX = t.clientX; startY = t.clientY;
    target = el; fired = false;
    timer = setTimeout(function () {
      timer = null;
      if (!target) return;
      fired = true;
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
      try { if (global.GMTSound) GMTSound.play('pop'); } catch (_) {}
      var h = handlerFor(target);
      if (h) h();
      target = null;
    }, MS);
  }

  function onMove(ev) {
    if (!timer) return;
    var t = (ev.touches && ev.touches[0]) || ev;
    if (Math.abs(t.clientX - startX) > MOVE_TOL || Math.abs(t.clientY - startY) > MOVE_TOL) clear();
  }

  function onEnd() { clear(); }

  /* بعد إطلاقها نمنع النقرةَ التالية مباشرةً — وإلّا فُتحت التفاصيلُ مرّتين */
  function onClick(ev) {
    if (!fired) return;
    fired = false;
    var el = ev.target && ev.target.closest && ev.target.closest('[data-longpress]');
    if (el) { ev.preventDefault(); ev.stopPropagation(); }
  }

  function onContext(ev) {
    var el = ev.target && ev.target.closest && ev.target.closest('[data-longpress]');
    if (!el) return;
    if (ev.target.closest('button, a, input, select, textarea')) return;
    ev.preventDefault();
    var h = handlerFor(el);
    if (h) h();
  }

  var opts = { passive: true, capture: true };
  document.addEventListener('touchstart', onStart, opts);
  document.addEventListener('touchmove',  onMove,  opts);
  document.addEventListener('touchend',   onEnd,   opts);
  document.addEventListener('touchcancel', onEnd,  opts);
  document.addEventListener('mousedown',  onStart, opts);
  document.addEventListener('mousemove',  onMove,  opts);
  document.addEventListener('mouseup',    onEnd,   opts);
  document.addEventListener('click',      onClick, true);
  document.addEventListener('contextmenu', onContext, false);

  global.GMTLongPress = {
    ms: function (v) { if (v) MS = v; return MS; },
    /* للفحص: يُطلقها على عنصرٍ بلا انتظار */
    fire: function (el) { var h = handlerFor(el); if (h) h(); return !!h; }
  };
})(window);
