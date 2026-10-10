/* ═══════════════════════════════════════════════════════════════════════════
   gmt-nofab.js — لا أزرار عائمة  ·  2026-09-26
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك (مكرَّر ثلاث مرّات): «وأزل أي أزرار عائمة — أهمّ شيء».

   لماذا حارس دائم لا فحص لحظي؟
     الأزرار العائمة تأتي من سكربتات مشتركة تُحمَّل في كل الصفحات، وبعضها يزرع زرّه
     **بعد** ثوانٍ من التحميل (الجولة · التلميحات · العقل · تقرير الصحة). فحصٌ عند
     DOMContentLoaded لا يراها إطلاقاً — ولهذا أبلغ المالك مرّتين عن زرّ «بقي عائماً»
     رغم أنه أُزيل من المصدر. الحلّ: مراقب DOM + مسحات مجدولة.

   المبدأ: **لا تُحذف الوظيفة، يُحذف الزرّ العائم فقط.** كل ما يخفيه هذا الملف له
   مدخل بديل في الشريط العلوي أو قائمة «المزيد» في الصفحة نفسها.

   الاستعمال:  <script src="gmt-nofab.js"></script>   (بعد باقي السكربتات)
   الاستثناء: عنصر تريد إبقاءه ⇒ أضف له السمة  data-keep-fab="1"
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var doc = global.document;
  if (!doc) return;

  /* عناصرنا التي لا تُمَسّ: الإشعارات والنوافذ الحوارية وأشرطة الإجراءات */
  var KEEP_IDS = [
    'toast-wrap', 'waNotice', 'attachBar', 'officesPanel', 'receiptViewer',
    'helpMenu', 'addModal', 'pdfCatModal', 'gmt-toast', 'toastBox'
  ];

  function keep(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.hasAttribute && el.hasAttribute('data-keep-fab')) return true;
    if (KEEP_IDS.indexOf(el.id) !== -1) return true;
    try { if (el.closest('[data-keep-fab]')) return true; } catch (_) {}
    return false;
  }

  /* زرّ عائم = عنصر ثابت صغير قرب حافة الشاشة السفلى، قابل للضغط */
  function isFloatingFab(el) {
    if (keep(el)) return false;
    var cs;
    try { cs = global.getComputedStyle(el); } catch (_) { return false; }
    if (!cs || cs.position !== 'fixed') return false;
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (cs.pointerEvents === 'none') return false;          // طبقات عرض فقط
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    if (r.width > 260 || r.height > 260) return false;      // نافذة حوارية ⇒ ليست زرّاً
    var nearBottom = (global.innerHeight - r.bottom) < 140;
    if (!nearBottom) return false;
    var isBtn = el.tagName === 'BUTTON' || el.tagName === 'A' ||
                /fab|float/i.test(el.className || '') ||
                !!el.querySelector('button,a,svg');
    return isBtn;
  }

  var hidden = 0;
  function sweep() {
    try {
      var kids = doc.body && doc.body.children;
      if (!kids) return;
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el.getAttribute('data-gmt-fab-killed')) continue;
        if (isFloatingFab(el)) {
          el.style.setProperty('display', 'none', 'important');
          el.setAttribute('data-gmt-fab-killed', '1');
          hidden++;
        }
      }
    } catch (_) {}
  }

  /* (٧ ط · «تعليق وتقطيع») كان كل تغيّرٍ في أبناء الصفحة يُعيد فحص **كل** الأبناء بـgetComputedStyle
     متزامناً — فيُجبر المتصفّح على حساب الأنماط فوراً بعد كل رسمٍ كبير. الآن: الجديدُ وحده،
     ومرّةً واحدة في الإطار التالي. */
  var queued = [], raf = global.requestAnimationFrame || function (f) { return setTimeout(f, 16); }, pending = false;
  function flush() {
    pending = false;
    var list = queued; queued = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!el.isConnected || el.parentNode !== doc.body || el.getAttribute('data-gmt-fab-killed')) continue;
      try { if (isFloatingFab(el)) { el.style.setProperty('display', 'none', 'important'); el.setAttribute('data-gmt-fab-killed', '1'); hidden++; } } catch (_) {}
    }
    mountTools();
  }
  function onMut(muts) {
    for (var m = 0; m < muts.length; m++) {
      var ns = muts[m].addedNodes;
      for (var n = 0; n < ns.length; n++) if (ns[n].nodeType === 1 && !/^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(ns[n].tagName)) queued.push(ns[n]);
    }
    if (queued.length && !pending) { pending = true; raf(function () { setTimeout(flush, 0); }); }
  }
  function start() {
    sweep();
    try { new global.MutationObserver(onMut).observe(doc.body, { childList: true }); } catch (_) {}
    [200, 700, 1500, 3000, 6000, 10000].forEach(function (ms) { global.setTimeout(function () { sweep(); mountTools(); }, ms); });
  }

  /* ═══ (٧ ط · «معظم الأدوات مو شغّالة») ما يُخفيه الحارس لا يضيع: صندوق «🧰 الأدوات» في الشريط العلويّ ═══
     كان المبدأ «لكل مخفيٍّ مدخلٌ بديل» — والفحص أثبت أنّ لا: عقل النظام في الجرد والمشتريات والرئيسيّة،
     وصحّة النظام وتدقيق الفواتير والجرد في الأدمن، كانت تُخفى بلا أيّ طريقٍ إليها. الآن كل ما يُخفى يظهر
     في قائمةٍ واحدة في الشريط — نفس الزرّ الأصليّ يُضغط من هناك، فلا تتغيّر الوظيفة ولا يطفو شيء. */
  var NAMES = { 'gmt-brain-fab': '🧠 عقل النظام', 'gmt-hp-btn': '🩺 صحّة النظام', 'gmt-health-btn': '🩺 صحّة النظام',
                'intg-btn': '🔗 تدقيق الفواتير والجرد', 'gmt-cl-btn': '📋 قائمة الفحص', 'settl-btn': '🧾 التسويات',
                'gmt-draft-badge': '📝 المسوّدات' };
  function labelOf(el) {
    if (NAMES[el.id]) return NAMES[el.id];
    if (/gg4-fab/.test(el.className || '')) return '🎓 الدليل والدروس';
    var t = (el.getAttribute('title') || el.getAttribute('aria-label') || el.innerText || '').trim().replace(/\s+/g, ' ');
    return t.slice(0, 40) || 'أداة';
  }
  function tools() {
    var seen = {}, out = [];
    var els = doc.querySelectorAll('[data-gmt-fab-killed]');
    for (var i = 0; i < els.length; i++) {
      var l = labelOf(els[i]); if (seen[l]) continue; seen[l] = 1; out.push({ el: els[i], label: l });
    }
    return out;
  }
  function openTools() {
    var old = doc.getElementById('gmt-tools-sheet'); if (old) { old.remove(); return; }
    var list = tools(); if (!list.length) return;
    var w = doc.createElement('div'); w.id = 'gmt-tools-sheet'; w.setAttribute('data-keep-fab', '1');
    w.style.cssText = 'position:fixed;inset:0;z-index:2147482500;background:rgba(15,18,25,.35);display:flex;align-items:flex-start;justify-content:flex-end;padding:56px 10px 10px;direction:rtl;font-family:Cairo,system-ui,Tahoma,sans-serif';
    w.innerHTML = '<div style="background:#fff;border:1px solid rgba(15,18,25,.08);border-radius:16px;box-shadow:0 18px 50px rgba(15,18,25,.2);width:min(300px,100%);padding:8px">' +
      '<div style="font-size:12px;font-weight:900;color:#5b6472;padding:6px 10px 8px">🧰 أدوات هذه الصفحة</div>' +
      list.map(function (t, k) { return '<button data-k="' + k + '" style="display:block;width:100%;text-align:right;border:0;background:#fff;border-radius:11px;padding:10px 12px;font:inherit;font-size:13.5px;font-weight:800;color:#0f1219;cursor:pointer">' + t.label.replace(/[<>&]/g, '') + '</button>'; }).join('') +
      '</div>';
    w.addEventListener('click', function (e) {
      if (e.target === w) { w.remove(); return; }
      var b = e.target.closest && e.target.closest('[data-k]'); if (!b) return;
      var t = list[+b.getAttribute('data-k')]; w.remove();
      try { t.el.click(); } catch (_) {}
    });
    doc.body.appendChild(w);
  }
  function mountTools() {
    var bar = doc.getElementById('gmt-refresh-bar'); if (!bar) return;
    var has = tools().length > 0, b = doc.getElementById('gmt-tools-btn');
    if (!has) { if (b) b.remove(); return; }
    if (b) return;
    b = doc.createElement('button'); b.id = 'gmt-tools-btn'; b.type = 'button'; b.setAttribute('data-keep-fab', '1');
    b.title = 'أدوات هذه الصفحة'; b.setAttribute('aria-label', 'أدوات هذه الصفحة');
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18"/></svg>';
    b.onclick = openTools;
    bar.appendChild(b);
  }

  global.GMTNoFab = {
    tools: tools, openTools: openTools,
    sweep: sweep,
    count: function () { return hidden; },
    /* لإعادة إظهار زرّ بعينه عند الحاجة (تشخيص) */
    restore: function (id) {
      var el = doc.getElementById(id);
      if (el) { el.style.removeProperty('display'); el.removeAttribute('data-gmt-fab-killed'); }
    }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : this);
