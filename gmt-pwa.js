/* ═══════════════════════════════════════════════════════════════════════════
   gmt-pwa.js — تسجيل عامل الخدمة + إشعار التحديث  ·  2026-08-26
   ─────────────────────────────────────────────────────────────────────────
   شرط المالك الإلزامي: «تحديث فوري مربوط بالإصدار + زر تحديث الآن» —
   تفادياً لتكرار شكوى «الإصلاحات لا تعمل» (نمط P12: المتصفّح يخدم نسخة قديمة).

   كيف يعمل: عند نشر نسخة جديدة (بتغيير VERSION في sw.js) يكتشف المتصفّح
   عاملاً منتظراً ⇒ يظهر شريط «تتوفّر نسخة جديدة» مع زر يطبّقها فوراً.
   لا تحديث صامت: المستخدم يقرّر، فلا يفقد عملاً غير محفوظ.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;            // لا يعمل محلياً بلا خادم

  function banner(onUpdate) {
    if (document.getElementById('gmt-pwa-bar')) return;
    var b = document.createElement('div');
    b.id = 'gmt-pwa-bar';
    /* (٨ ث — تدقيق المطابقة) كان شريطاً عائماً أسفل الشاشة يغطّي أزرار الصفحة (زرّ الدفع في نقطة البيع مثلاً).
       قاعدتك: لا شيء عائم — صار سطراً ثابتاً أعلى الصفحة، في مكانه، كشريط الفحص الذاتي. */
    b.style.cssText = 'position:relative;z-index:5;background:#0f172a;' +
      'color:#fff;padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;' +
      'font-family:Cairo,Tahoma,sans-serif;font-size:13px;font-weight:700;direction:rtl';
    b.innerHTML =
      '<span>تتوفّر نسخة جديدة من النظام</span>' +
      '<button id="gmt-pwa-go" style="background:#D5001C;border:0;color:#fff;border-radius:9px;' +
      'padding:7px 16px;font-weight:900;font-size:12.5px;cursor:pointer;font-family:inherit">تحديث الآن</button>' +
      '<button id="gmt-pwa-no" style="background:transparent;border:0;color:#fff;opacity:.6;' +
      'font-size:12px;cursor:pointer;font-family:inherit">لاحقاً</button>';
    document.body.insertBefore(b, document.body.firstChild);
    b.querySelector('#gmt-pwa-go').onclick = onUpdate;
    b.querySelector('#gmt-pwa-no').onclick = function () { b.remove(); };
  }

  /* ══════════════════════════════════════════════════════════════════════════
     🔴 (٧ ي · كشفه فحص «الدخول أوّلاً») الصفحة كانت **تُعيد تحميل نفسها وحدها**:
       · أوّل زيارةٍ على جهازٍ جديد: عامل الخدمة يُثبَّت ويستلم الصفحة (clients.claim)
         ⇒ حدث controllerchange ⇒ location.reload() — بعد ثانيةٍ أو اثنتين من الفتح.
         فاسمُ المستخدم وكلمةُ السرّ التي بدأ يكتبها تُمحى، أو يُقطع الانترو.
       · وعند كل نشر: sw.js يستدعي skipWaiting عند التثبيت، فلا يمرّ بشريط «تحديث الآن»
         أبداً، ويُعاد تحميل أيّ صفحةٍ مفتوحة — كاشيرٌ في منتصف فاتورة مثلاً.
     الآن: لا إعادة تحميلٍ إلا بضغطتك. أوّل تثبيتٍ لا يُغيّر شيئاً في الصفحة، والنسخة الجديدة
     تُعلَن بالشريط وتُطبَّق حين تضغط «تحديث الآن» (أو تلقائياً عند التنقّل التالي). */
  var hadCtl = !!navigator.serviceWorker.controller, userAsked = false;
  function applyNow(worker) {
    userAsked = true;
    try { if (worker) worker.postMessage('skipWaiting'); } catch (_) {}
    /* إن كان العامل قد استلم الصفحة قبل ضغطتك فلن يأتي controllerchange جديد —
       فلا ننتظره إلى الأبد: نُعيد التحميل بعد لحظة إن لم يُعِده الحدث */
    setTimeout(function () { if (!reloaded) { reloaded = true; location.reload(); } }, worker ? 1500 : 0);
  }

  navigator.serviceWorker.register('sw.js').then(function (reg) {
    // عامل منتظر بالفعل ⇒ نسخة جديدة جاهزة
    if (reg.waiting) banner(function () { applyNow(reg.waiting); });

    reg.addEventListener('updatefound', function () {
      var nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', function () {
        // مثبَّت + يوجد عامل مسيطر ⇒ هذا تحديث لا تثبيت أول
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          banner(function () { applyNow(nw); });
        }
      });
    });

    // افحص التحديث عند كل عودة للصفحة
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) reg.update().catch(function () {});
    });
    /* (TASK-0257 · المالك seq 175 · 181 «نسخة اللابتوب»): صفحةٌ تبقى مفتوحةً ظاهرةً على اللابتوب لا يمرّ بها visibilitychange
       فلا تعرف بالنشر الجديد أبداً (كانت على نسخةٍ أقدم من الهاتف). الآن: فحصٌ كل ١٠ دقائق وعند العودة إلى النافذة ⇒ شريط «تحديث الآن». */
    setInterval(function () { if (!document.hidden) reg.update().catch(function () {}); }, 10 * 60 * 1000);
    window.addEventListener('focus', function () { reg.update().catch(function () {}); });
  }).catch(function (e) {
    console.warn('[GMT] تعذّر تسجيل عامل الخدمة:', e && e.message);
  });

  // بعد تفعيل العامل الجديد: أعد التحميل مرّة واحدة — **بطلبك فقط**
  var reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloaded) return;
    if (userAsked) { reloaded = true; location.reload(); return; }
    if (!hadCtl) { hadCtl = true; return; }                       // أوّل تثبيت: الصفحة نفسها، لا جديد فيها
    banner(function () { reloaded = true; location.reload(); });   // نسخةٌ جديدة صارت نشطة — أنت تقرّر متى
  });
})();
