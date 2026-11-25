/* ═════════════════════════════════════════════════════════════════════
   gmt-back.js — زرّ الرجوع بالهاتف بيسكّر النافذة المفتوحة بدل ما يطلّعك من الصفحة (seq B1115)
   «لمّا داخل على الموردون ما في زرّ رجوع، والرجوع عم يصير تعسّفي وخطر» — كان زرّ الرجوع يقلب الصفحة كلّها (أو الطبقة للرئيسيّة).
   النوافذ اللي بتحمل data-gmt-modal: فتحها ⇐ خطوة بالتاريخ · الرجوع ⇐ el._gmtBack() إذا موجود (مثلاً ملفّ المورّد ⇐ القائمة)
   وإلّا زرّ الإغلاق تبعها · تسكيرها بـ✕ ⇐ الخطوة بتنشال بهدوء.
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTBack || !g.document) return;
  var doc = g.document, stack = [], silent = 0;
  var CLOSE = '[data-sp-x],[data-pr-x],[data-ship-x],[data-pd-x],[data-bk-x],[data-popay-x],[data-pi-x],[data-x]';
  function isModal(n) { return n && n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-gmt-modal'); }
  function push(el) { if (stack.indexOf(el) >= 0) return; stack.push(el); try { history.pushState({ gmtModal: stack.length }, ''); } catch (_) {} }
  /* نافذة انسكّرت من جوّا (✕) ⇒ نشيل خطوتها من التاريخ بلا ما نسكّر شي تاني */
  function gone(el) { var i = stack.indexOf(el); if (i < 0) return; stack.splice(i, 1); silent++; try { history.back(); } catch (_) { silent--; } }
  g.addEventListener('popstate', function () {
    if (silent > 0) { silent--; return; }
    var el = stack[stack.length - 1]; if (!el) return;
    if (!doc.body.contains(el)) { stack.pop(); return; }
    /* ملفّ داخلي (مثلاً ملفّ المورّد) ⇐ رجوع لخطوة جوّا النافذة وبتضلّ مفتوحة */
    if (typeof el._gmtBack === 'function' && el._gmtBack() === true) { try { history.pushState({ gmtModal: stack.length }, ''); } catch (_) {} return; }
    stack.pop();
    var x = el.querySelector(CLOSE); if (x) { el.__gmtBackClosing = true; x.click(); }
    if (doc.body.contains(el)) el.remove();
  });
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      [].forEach.call(m.addedNodes || [], function (n) { if (isModal(n)) push(n); });
      [].forEach.call(m.removedNodes || [], function (n) { if (isModal(n) && !n.__gmtBackClosing) gone(n); });
    });
  }).observe(doc.documentElement, { childList: true, subtree: false });
  function watchBody() { if (!doc.body) return setTimeout(watchBody, 50); new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      [].forEach.call(m.addedNodes || [], function (n) { if (isModal(n)) push(n); });
      [].forEach.call(m.removedNodes || [], function (n) { if (isModal(n) && !n.__gmtBackClosing) gone(n); });
    }); }).observe(doc.body, { childList: true }); }
  watchBody();
  g.GMTBack = { _stack: stack };
})(typeof window !== 'undefined' ? window : globalThis);
