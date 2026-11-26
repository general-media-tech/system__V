/* ═════════════════════════════════════════════════════════════════════
   gmt-back.js — زرّ الرجوع بالهاتف بيسكّر النافذة المفتوحة بدل ما يطلّعك من الصفحة (seq B1115 · B1117)
   «لمّا داخل على الموردون ما في زرّ رجوع، والرجوع عم يصير تعسّفي وخطر».
   B1117 (دستور الأداة الجديدة — الملحق «ح» ١): صار محمّل بكلّ صفحة فيها gmt-core.js، وأيّ نافذة جديدة لازم تحمل data-gmt-modal.
   الرجوع ⇐ el._gmtBack() (خطوة جوّا النافذة، تُرجع true لتضلّ مفتوحة) ⇐ el._gmtClose() ⇐ [data-gmt-close] أو زرّ ✕ معروف
           ⇐ Escape (لاللي بتسكّر بـEsc) ⇐ وإذا لسّا موجودة: remove().
   نوافذ ثابتة بالصفحة (بتنظهر/بتنخفى بالـclass أو style — متل نقطة البيع): data-gmt-modal="static" + el._gmtClose — ما بتنمسح أبداً.
   تسكيرها بـ✕ ⇐ الخطوة بتنشال بهدوء — والمستمع بمرحلة الالتقاط وبيوقف غيره، فما بيسكّر طبقة الرئيسيّة اللي تحتها.
   ═════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTBack || !g.document) return;
  var doc = g.document, stack = [], silent = 0;
  var CLOSE = '[data-gmt-close],[data-sp-x],[data-pr-x],[data-ship-x],[data-pd-x],[data-bk-x],[data-popay-x],[data-pi-x],[data-x],[data-pe-x],[data-wc-x],[data-close]';
  function isModal(n) { return n && n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-gmt-modal'); }
  function isStatic(el) { return el.getAttribute && el.getAttribute('data-gmt-modal') === 'static'; }
  function shown(el) { try { return el.isConnected && getComputedStyle(el).display !== 'none'; } catch (_) { return false; } }
  function alive(el) { return doc.body.contains(el) && (!isStatic(el) || shown(el)); }
  function push(el) { if (stack.indexOf(el) >= 0) return; el.__gmtBackClosing = false; stack.push(el); try { history.pushState({ gmtModal: stack.length }, ''); } catch (_) {} }
  /* نافذة انسكّرت من جوّا (✕) ⇒ نشيل خطوتها من التاريخ بلا ما نسكّر شي تاني */
  function gone(el) { var i = stack.indexOf(el); if (i < 0) return; stack.splice(i, 1); silent++; try { history.back(); } catch (_) { silent--; } }
  function closeEl(el) {
    el.__gmtBackClosing = true;
    try { if (typeof el._gmtClose === 'function') { el._gmtClose(); if (!alive(el)) return; } } catch (_) {}
    var x = el.querySelector(CLOSE); if (x) { try { x.click(); } catch (_) {} if (!alive(el)) return; }
    try { doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); } catch (_) {}
    if (doc.body.contains(el) && !isStatic(el)) el.remove();
  }
  /* بمرحلة الالتقاط ⇒ قبل مستمعي الصفحة (طبقات الرئيسيّة · gmt-layers) — وإذا الحدث إلنا بنوقفه عنهم */
  g.addEventListener('popstate', function (e) {
    if (silent > 0) { silent--; e.stopImmediatePropagation(); return; }
    while (stack.length && !alive(stack[stack.length - 1])) stack.pop();
    var el = stack[stack.length - 1]; if (!el) return;
    e.stopImmediatePropagation();
    /* ملفّ داخلي (مثلاً ملفّ المورّد) ⇐ رجوع لخطوة جوّا النافذة وبتضلّ مفتوحة */
    if (typeof el._gmtBack === 'function' && el._gmtBack() === true) { try { history.pushState({ gmtModal: stack.length }, ''); } catch (_) {} return; }
    stack.pop();
    closeEl(el);
  }, true);
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
  /* النوافذ الثابتة: نراقب إظهارها/إخفاءها (class · style · hidden) */
  function scanStatic(el) {
    var v = shown(el), was = stack.indexOf(el) >= 0;
    if (v && !was) push(el);
    else if (!v && was && !el.__gmtBackClosing) gone(el);
  }
  function watchStatic() {
    if (!doc.body) return setTimeout(watchStatic, 50);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { var t = m.target; if (t && t.nodeType === 1 && isStatic(t)) scanStatic(t); });
    }).observe(doc.body, { attributes: true, subtree: true, attributeFilter: ['class', 'style', 'hidden'] });
  }
  watchStatic();
  g.GMTBack = { _stack: stack, CLOSE: CLOSE, isStatic: isStatic };
})(typeof window !== 'undefined' ? window : globalThis);
