/* ═══════════════════════════════════════════════════════════════════════════
   gmt-updater.js — 🔄 التحديث القسري التلقائي · v1.0 · 2026-07-28
   يحل مشكلة "المتصفح يعرض نسخة قديمة" جذرياً وتلقائياً بلا تدخّل المستخدم:
   1. يُلغي تسجيل أي Service Worker قديم فوراً.
   2. يمسح كل الكاشات القديمة.
   3. يفرض إعادة تحميل مرة واحدة عند تغيّر النسخة.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // رقم النسخة — يتغيّر مع كل نشر (تاريخ + وقت)
  var BUILD = '20260728-2200';
  var KEY = 'gmt_build_version';

  /* 🔴 (٨ ت — تدقيق المطابقة · «التطبيق لا يفتح بلا إنترنت») كان هذا الملفّ — مع **كل** فتح صفحة — يُلغي تسجيل
     كل عامل خدمة ويحذف كل كاش لا يحمل رقمه القديم، ومنها كاش التطبيق نفسه (gmt-pages · gmt-v…) الذي يسجّله
     gmt-pwa.js. فالصفحة تُخزَّن ثمّ تُمحى في الفتحة التالية ⇒ «لا يوجد اتصال» بلا إنترنت (ثبت بالتشغيل).
     الآن: تنظيفٌ **لمرّةٍ واحدة** لبقايا ما قبل التطبيق فقط — لا يمسّ عامل الخدمة الحاليّ (sw.js) ولا كاشاته،
     وهو نفسه يحذف إصداراته القديمة عند كل نشر. */
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved !== BUILD) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) {
          var w = reg.active || reg.waiting || reg.installing;
          var url = (w && w.scriptURL) || '';
          if (!/\/sw\.js(\?|$)/.test(url)) reg.unregister();      // عاملٌ قديمٌ غريب فقط
        });
      }).catch(function () {});
    }
    if ('caches' in window) {
      caches.keys().then(function (names) {
        names.forEach(function (n) { if (n.indexOf('gmt-') !== 0) caches.delete(n); });   // كاشات التطبيق تبقى
      }).catch(function () {});
    }
    try { localStorage.setItem(KEY, BUILD); } catch (e) {}
  }

  window.GMT_BUILD = BUILD;
})();
