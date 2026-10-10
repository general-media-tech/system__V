/* ═══════════════════════════════════════════════════════════════════════════
   gmt-learn.js — الدروس خطوة بخطوة  ·  ٧ تشرين الأول ٢٠٢٦ (ط)
   ─────────────────────────────────────────────────────────────────────────
   طلبك (البند ١٧١ ووثيقة التصميم ٢٢ و٢٤) حرفياً:
     «الجولة التعليمية والوضع التدريبي: انسفوها وابنِها من الصفر»
     «بدنا نعمل لها واجهة… اضبط أحلى التالي والسابق والشروح… التعليمي يشرح له خطوة بخطوة
      إنشاء الفاتورة وكل شيء وكل شيء — خطوة خطوة بدون استثناء»
     «الوضع التجريبي فيه كثير دروبات، كثير تقطيع وكثير تعليق»

   ما كان:  شاشاتٌ تعريفيّة بملء الشاشة (تُشرح «عن» الزرّ لا «على» الزرّ) + جولةٌ تمرّ على
            الأزرار واحداً واحداً بلا ترتيب عمل + كانت تغيّر موضع الزرّ نفسه فيقفز.
   ما صار:  «دروس» — كل درسٍ عمليّةٌ كاملة كما تحدث في يوم العمل (بيع نقدي · بيع بشحن ·
            مرتجع · مصروف…)، خطوةً خطوة على الأزرار الحقيقيّة:
              • يُضيء الزرّ الحقيقيّ بإطارٍ يتبعه (لا يلمس الزرّ ولا يحرّكه).
              • ينتظرك تضغطه أو تكتب — ثم ينتقل وحده. أو «التالي».
              • «السابق» يرجع خطوة · «✕» يُنهي · ولا شيء يبدأ وحده أبداً.
              • الدرس الذي يُنشئ فاتورة يقترح الوضع التدريبي (لا شيء يُحفظ) ثم يكمل بعد التحويل.
              • خفيف: لا جسيمات ولا ضبابيّات — فقط شفافيّةٌ وحركةٌ قصيرة (ويحترم «تقليل الحركة»).

   المحتوى: GMTLearn.define('<الصفحة>', [ دروس ]) — الدروس في آخر هذا الملف لكل صفحة.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTLearn) return;
  var doc = global.document;
  var RED = '#D5001C';
  var LS_DONE = 'gmt_learn_done_v1', SS_RESUME = 'gmt_learn_resume';
  var reduce = false; try { reduce = global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  var LIB = {};                                   /* page → [lessons] */

  function pageId() {
    var f = decodeURIComponent((location.pathname.split('/').pop() || 'home.html')).replace(/\.html?$/i, '');
    return f || 'home';
  }
  function lessons() { return LIB[pageId()] || []; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function doneSet() { try { return JSON.parse(localStorage.getItem(LS_DONE) || '{}') || {}; } catch (_) { return {}; } }
  function markDone(id) { var d = doneSet(); d[pageId() + ':' + id] = Date.now(); try { localStorage.setItem(LS_DONE, JSON.stringify(d)); } catch (_) {} }
  function inTraining() { return !!(global.GMTSandbox && GMTSandbox.active); }

  /* ═══ الأنماط ═══ */
  function css() {
    if (doc.getElementById('gl-css')) return;
    var s = doc.createElement('style'); s.id = 'gl-css';
    s.textContent = [
      '@keyframes gl-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
      '@keyframes gl-pulse{0%,100%{box-shadow:0 0 0 0 rgba(213,0,28,.45),0 0 0 9999px rgba(15,18,25,.42)}50%{box-shadow:0 0 0 7px rgba(213,0,28,0),0 0 0 9999px rgba(15,18,25,.42)}}',
      '.gl-ring{position:fixed;z-index:2147483300;pointer-events:none;border:2.5px solid ' + RED + ';border-radius:12px;',
      'box-shadow:0 0 0 9999px rgba(15,18,25,.42);transition:top .18s ease,left .18s ease,width .18s ease,height .18s ease;' + (reduce ? '' : 'animation:gl-pulse 1.6s ease-in-out infinite;') + '}',
      '.gl-ring.gl-none{border-color:transparent;box-shadow:0 0 0 9999px rgba(15,18,25,.42);animation:none}',
      '.gl-card{position:fixed;z-index:2147483310;direction:rtl;font-family:Cairo,system-ui,Tahoma,sans-serif;color:#0f1219;',
      'background:#fff;border:1px solid rgba(15,18,25,.08);border-radius:18px;box-shadow:0 18px 50px rgba(15,18,25,.22);',
      'width:min(380px,calc(100vw - 24px));padding:14px 16px 12px;' + (reduce ? '' : 'animation:gl-in .22s ease both;') + '}',
      '.gl-card.gl-sheet{left:10px!important;right:10px!important;width:auto;border-radius:20px}',
      '.gl-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
      '.gl-chip{font-size:11px;font-weight:900;color:' + RED + ';background:#fff1f2;border:1px solid rgba(213,0,28,.18);border-radius:99px;padding:3px 10px;white-space:nowrap}',
      '.gl-les{flex:1;min-width:0;font-size:11.5px;font-weight:800;color:#5b6472;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.gl-x{flex:0 0 auto;width:30px;height:30px;border-radius:10px;border:1px solid rgba(15,18,25,.1);background:#fff;font:inherit;font-size:14px;cursor:pointer;color:#475569}',
      '.gl-h{font-size:16.5px;font-weight:900;line-height:1.5;margin:0 0 4px}',
      '.gl-t{font-size:13.5px;line-height:1.95;color:#374151;margin:0}',
      '.gl-t b{color:#0f1219}',
      '.gl-do{display:flex;align-items:center;gap:7px;margin-top:9px;font-size:12px;font-weight:900;color:#0f1219;background:#f8fafc;border:1px dashed rgba(15,18,25,.14);border-radius:12px;padding:7px 10px}',
      '.gl-do i{font-style:normal;font-size:16px}',
      '.gl-warn{margin-top:8px;font-size:12px;font-weight:800;color:#b45309;background:#fffbeb;border-radius:10px;padding:6px 10px;line-height:1.8}',
      '.gl-bar{height:4px;border-radius:99px;background:#eef0f3;overflow:hidden;margin:11px 0 10px}',
      '.gl-bar i{display:block;height:100%;background:' + RED + ';border-radius:99px;transition:width .25s ease}',
      '.gl-nav{display:flex;gap:8px;align-items:center}',
      '.gl-btn{border:0;border-radius:12px;padding:10px 16px;font:inherit;font-weight:900;font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.gl-btn:active{transform:scale(.97)}',
      '.gl-next{flex:1;background:' + RED + ';color:#fff}',
      '.gl-prev{background:#f3f4f6;color:#111}',
      '.gl-prev[disabled]{opacity:.35;cursor:default}',
      '.gl-skip{background:none;color:#5b6472;font-size:11.5px;padding:6px 4px;text-decoration:underline}',
      /* المكتبة */
      '.gl-lib{position:fixed;inset:0;z-index:2147483200;background:rgba(15,18,25,.45);display:flex;align-items:flex-end;justify-content:center;direction:rtl;font-family:Cairo,system-ui,Tahoma,sans-serif}',
      '@media(min-width:720px){.gl-lib{align-items:center}}',
      '.gl-lib-box{background:#fff;width:min(620px,100%);max-height:88vh;overflow:auto;border-radius:22px 22px 0 0;padding:16px 16px 18px;' + (reduce ? '' : 'animation:gl-in .22s ease both;') + '}',
      '@media(min-width:720px){.gl-lib-box{border-radius:22px}}',
      '.gl-lib-h{display:flex;align-items:center;gap:10px;margin-bottom:4px}',
      '.gl-lib-h b{font-size:17px;font-weight:900;flex:1}',
      '.gl-lib-sub{font-size:12px;color:#5b6472;font-weight:700;margin-bottom:12px;line-height:1.8}',
      '.gl-train{display:flex;align-items:center;gap:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:9px 12px;font-size:12px;font-weight:800;color:#92400e;margin-bottom:12px}',
      '.gl-train.on{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}',
      '.gl-train button{margin-inline-start:auto;border:0;border-radius:10px;padding:6px 12px;font:inherit;font-weight:900;font-size:11.5px;cursor:pointer;background:#b45309;color:#fff}',
      '.gl-train.on button{background:#065f46}',
      '.gl-item{display:flex;align-items:center;gap:12px;width:100%;text-align:right;background:#fff;border:1px solid rgba(15,18,25,.09);border-radius:16px;padding:12px 14px;margin-bottom:8px;cursor:pointer;font:inherit;color:#0f1219}',
      '.gl-item:hover{border-color:rgba(213,0,28,.35)}',
      '.gl-ic{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:21px;background:#f8fafc;flex:0 0 auto}',
      '.gl-it{flex:1;min-width:0}',
      '.gl-it b{display:block;font-size:14px;font-weight:900}',
      '.gl-it small{display:block;font-size:11.5px;color:#5b6472;font-weight:700;line-height:1.7}',
      '.gl-meta{font-size:11px;font-weight:900;color:#5b6472;white-space:nowrap}',
      '.gl-meta.ok{color:#047857}',
      '.gl-foot{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;border-top:1px solid #f1f2f4;padding-top:10px}',
      '.gl-foot button{border:1px solid rgba(15,18,25,.1);background:#fff;border-radius:11px;padding:7px 12px;font:inherit;font-weight:800;font-size:12px;cursor:pointer;color:#334155}'
    ].join('');
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ═══ إيجاد الهدف ═══ */
  function visible(el) {
    if (!el || !el.isConnected) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  }
  function find(sel) {
    if (!sel) return null;
    if (typeof sel === 'function') { try { var f = sel(); return visible(f) ? f : null; } catch (_) { return null; } }
    var list = Array.isArray(sel) ? sel : [sel];
    for (var i = 0; i < list.length; i++) {
      var all; try { all = doc.querySelectorAll(list[i]); } catch (_) { continue; }
      for (var k = 0; k < all.length; k++) if (visible(all[k])) return all[k];
    }
    return null;
  }

  /* ═══ تشغيل درس ═══ */
  var S = null;   /* { les, i, el, ring, card, poll, follow, clickH, wait } */

  function stop(done) {
    if (!S) return;
    clearInterval(S.poll); clearInterval(S.follow); clearTimeout(S.wait);
    if (S.clickH) doc.removeEventListener('click', S.clickH, true);
    if (S.keyH) doc.removeEventListener('keydown', S.keyH, true);
    global.removeEventListener('scroll', S.place, true); global.removeEventListener('resize', S.place);
    if (S.ring) S.ring.remove(); if (S.card) S.card.remove();
    var les = S.les; S = null;
    try { sessionStorage.removeItem(SS_RESUME); } catch (_) {}
    if (done) { markDone(les.id); finished(les); }
  }

  function start(les, at) {
    if (S) stop(false);
    css();
    /* خطوات الجهاز الحالي فقط: { media: '(max-width:768px)' } خطوةٌ للهاتف وحده (مثل «المزيد» في الشريط السفلي) */
    var steps = les.steps.filter(function (st) { try { return !st.media || global.matchMedia(st.media).matches; } catch (_) { return true; } });
    S = { les: les, steps: steps, i: Math.min(at || 0, steps.length - 1) };
    S.ring = doc.createElement('div'); S.ring.className = 'gl-ring gl-none'; S.ring.setAttribute('data-full', '1');
    S.card = doc.createElement('div'); S.card.className = 'gl-card'; S.card.setAttribute('data-keep-fab', '1'); S.card.setAttribute('role', 'dialog');
    doc.body.appendChild(S.ring); doc.body.appendChild(S.card);
    S.place = function () { place(); };
    global.addEventListener('scroll', S.place, true); global.addEventListener('resize', S.place);
    S.keyH = function (e) {
      if (!S) return;
      if (e.key === 'Escape') { e.stopPropagation(); stop(false); }
    };
    doc.addEventListener('keydown', S.keyH, true);
    try { sessionStorage.setItem(SS_RESUME, JSON.stringify({ page: pageId(), id: les.id, i: S.i })); } catch (_) {}
    show();
  }

  function step() { return S && S.steps[S.i]; }

  function show() {
    if (!S) return;
    var st = step();
    if (!st) { stop(true); return; }
    clearInterval(S.poll); clearTimeout(S.wait);
    if (S.clickH) { doc.removeEventListener('click', S.clickH, true); S.clickH = null; }
    try { sessionStorage.setItem(SS_RESUME, JSON.stringify({ page: pageId(), id: S.les.id, i: S.i })); } catch (_) {}
    if (typeof st.prep === 'function') { try { st.prep(); } catch (_) {} }
    S.el = null; S.missing = false;
    paint(true);
    /* انتظر الهدف حتى ٦ ثوانٍ (تبديل شاشة · تحميل) — ثم اعرض «لم أجده» بخيارات */
    var t0 = Date.now();
    (function look() {
      if (!S || step() !== st) return;
      var el = st.sel ? find(st.sel) : null;
      if (el || !st.sel) { attach(el); return; }
      if (Date.now() - t0 > 6000) { S.missing = true; paint(false); return; }
      S.wait = setTimeout(look, 200);
    })();
  }

  function attach(el) {
    var st = step();
    S.el = el; S.missing = false;
    if (el) {
      var r = el.getBoundingClientRect();
      var bars = parseInt(getComputedStyle(doc.documentElement).getPropertyValue('--gmt-topbars')) || 0;
      if (r.top < bars + 8 || r.bottom > innerHeight - 8) {
        try { el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); } catch (_) {}
      }
      if (st.do === 'type' && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) { try { el.focus({ preventScroll: true }); } catch (_) {} }
    }
    paint(false);
    /* الانتقال التلقائي */
    if (st.do === 'click' && el) {
      S.clickH = function (e) {
        if (!S || step() !== st) return;
        if (S.card && S.card.contains(e.target)) return;
        var tgt = S.el;
        if (tgt && (tgt === e.target || tgt.contains(e.target))) {
          doc.removeEventListener('click', S.clickH, true); S.clickH = null;
          setTimeout(function () { if (S && step() === st) next(); }, st.delay || 450);
        }
      };
      doc.addEventListener('click', S.clickH, true);
    }
    if (typeof st.until === 'function') {
      S.poll = setInterval(function () {
        if (!S || step() !== st) return;
        var ok = false; try { ok = !!st.until(S.el); } catch (_) {}
        if (ok) { clearInterval(S.poll); setTimeout(function () { if (S && step() === st) next(); }, 350); }
      }, 300);
    }
    clearInterval(S.follow);
    S.follow = setInterval(place, 160);   /* يتبع الزرّ إن تحرّك (تحميل · نافذة) */
  }

  var DO = { click: ['👆', 'اضغط الزرّ المُضاء'], type: ['⌨️', 'اكتب في الحقل المُضاء'], pick: ['☝️', 'اختر من المُضاء'], read: ['👀', 'اقرأ ثمّ اضغط «التالي»'] };

  function paint(loading) {
    if (!S) return;
    var st = step(), n = S.steps.length, last = S.i === n - 1;
    var d = DO[st.do || 'read'] || DO.read;
    var auto = (st.do === 'click' && S.el) || typeof st.until === 'function';
    S.card.innerHTML =
      '<div class="gl-top"><span class="gl-chip">' + (S.i + 1) + ' من ' + n + '</span>' +
        '<span class="gl-les">' + esc(S.les.icon || '📘') + ' ' + esc(S.les.title) + (inTraining() ? ' · 🎓 تدريبي' : '') + '</span>' +
        '<button class="gl-x" data-a="x" title="إنهاء الدرس">✕</button></div>' +
      '<h3 class="gl-h">' + esc(st.title) + '</h3>' +
      '<p class="gl-t">' + (st.text || '') + '</p>' +
      (loading ? '<div class="gl-do"><i>⏳</i> لحظة…</div>'
        : S.missing ? '<div class="gl-warn">لم أجد هذا الجزء على الشاشة الآن' + (st.miss ? ' — ' + esc(st.miss) : '') + '. افتح المكان المطلوب ثم «حاول ثانيةً»، أو تخطَّ الخطوة.</div>'
        : (st.sel ? '<div class="gl-do"><i>' + d[0] + '</i> ' + esc(st.hint || d[1]) + (auto ? ' — أنتقل وحدي بعدها' : '') + '</div>' : '')) +
      (st.warn ? '<div class="gl-warn">⚠️ ' + st.warn + '</div>' : '') +
      '<div class="gl-bar"><i style="width:' + Math.round(((S.i + 1) / n) * 100) + '%"></i></div>' +
      '<div class="gl-nav">' +
        '<button class="gl-btn gl-prev" data-a="prev"' + (S.i ? '' : ' disabled') + '>→ السابق</button>' +
        (S.missing ? '<button class="gl-btn gl-prev" data-a="retry">↻ حاول ثانيةً</button>' : '') +
        '<button class="gl-btn gl-next" data-a="next">' + (last ? 'إنهاء الدرس ✓' : (S.missing ? 'تخطَّ ←' : 'التالي ←')) + '</button>' +
      '</div>';
    S.card.onclick = function (e) {
      var b = e.target.closest && e.target.closest('[data-a]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-a');
      if (a === 'x') stop(false); else if (a === 'prev') prev(); else if (a === 'next') next(); else if (a === 'retry') show();
    };
    place();
  }

  function place() {
    if (!S || !S.card) return;
    var el = S.el && S.el.isConnected ? S.el : null;
    var vw = innerWidth, vh = innerHeight;
    var bars = parseInt(getComputedStyle(doc.documentElement).getPropertyValue('--gmt-topbars')) || 0;
    var mobile = vw < 720;
    if (el) {
      var r = el.getBoundingClientRect(), pad = 6;
      S.ring.classList.remove('gl-none');
      S.ring.style.top = (r.top - pad) + 'px'; S.ring.style.left = (r.left - pad) + 'px';
      S.ring.style.width = (r.width + pad * 2) + 'px'; S.ring.style.height = (r.height + pad * 2) + 'px';
    } else {
      S.ring.classList.add('gl-none');
      S.ring.style.top = '50%'; S.ring.style.left = '50%'; S.ring.style.width = '0'; S.ring.style.height = '0';
    }
    var c = S.card, ch = c.offsetHeight || 220, cw = c.offsetWidth || 360;
    if (mobile) {
      c.classList.add('gl-sheet');
      /* على الهاتف: البطاقة أسفل الشاشة — إلّا إن كان الزرّ نفسه في النصف السفلي فتصعد للأعلى */
      var low = el && (el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2) > vh * 0.52;
      if (low) { c.style.top = (bars + 8) + 'px'; c.style.bottom = 'auto'; }
      else { c.style.top = 'auto'; c.style.bottom = 'calc(10px + env(safe-area-inset-bottom))'; }
      c.style.left = ''; c.style.right = '';
      return;
    }
    c.classList.remove('gl-sheet');
    var top, left;
    if (el) {
      var rr = el.getBoundingClientRect();
      if (rr.bottom + 14 + ch < vh) top = rr.bottom + 14;
      else if (rr.top - 14 - ch > bars) top = rr.top - 14 - ch;
      else top = Math.max(bars + 10, vh - ch - 16);
      left = Math.min(Math.max(10, rr.left + rr.width / 2 - cw / 2), vw - cw - 10);
    } else { top = Math.max(bars + 10, (vh - ch) / 2); left = (vw - cw) / 2; }
    c.style.top = Math.round(top) + 'px'; c.style.left = Math.round(left) + 'px'; c.style.bottom = 'auto'; c.style.right = 'auto';
  }

  function next() { if (!S) return; if (S.i >= S.steps.length - 1) { stop(true); return; } S.i++; show(); }
  function prev() { if (!S || !S.i) return; S.i--; show(); }

  function finished(les) {
    css();
    var all = lessons(), k = all.indexOf(les), nx = all[k + 1];
    var w = doc.createElement('div'); w.className = 'gl-card'; w.setAttribute('data-keep-fab', '1');
    w.innerHTML = '<div class="gl-top"><span class="gl-chip" style="color:#047857;background:#ecfdf5;border-color:#a7f3d0">✓ أنهيته</span><span class="gl-les"></span><button class="gl-x" data-a="x">✕</button></div>' +
      '<h3 class="gl-h">أحسنت — أنهيت «' + esc(les.title) + '»</h3>' +
      '<p class="gl-t">' + (les.after || 'تقدر تعيد أيّ درسٍ متى شئت من «📘 الدروس».') + '</p>' +
      '<div class="gl-nav" style="margin-top:12px">' +
        (nx ? '<button class="gl-btn gl-next" data-a="nx">الدرس التالي: ' + esc(nx.title) + ' ←</button>' : '') +
        '<button class="gl-btn gl-prev" data-a="lib">كل الدروس</button></div>';
    doc.body.appendChild(w);
    var vw = innerWidth; if (vw < 720) { w.classList.add('gl-sheet'); w.style.bottom = '12px'; } else { w.style.left = ((vw - 380) / 2) + 'px'; w.style.top = '30%'; }
    w.onclick = function (e) {
      var b = e.target.closest && e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a'); w.remove();
      if (a === 'nx') begin(nx); else if (a === 'lib') open();
    };
    setTimeout(function () { if (w.isConnected && !nx) w.remove(); }, 9000);
  }

  /* ═══ بدء درس: الدرس الذي يُنشئ بيانات يقترح الوضع التدريبي أوّلاً ═══ */
  function begin(les) {
    if (les.writes && !inTraining() && global.GMTSandbox && GMTSandbox.enter) {
      var ask = global.GMTAsk && GMTAsk.confirm;
      var go = function (yes) {
        if (yes) {
          try { sessionStorage.setItem(SS_RESUME, JSON.stringify({ page: pageId(), id: les.id, i: 0 })); } catch (_) {}
          GMTSandbox.enter();               /* يُعيد تحميل الصفحة تدريبيّاً — ونكمل بعدها من حيث بدأنا */
        } else start(les, 0);
      };
      if (ask) GMTAsk.confirm('هذا الدرس يُنشئ ' + (les.creates || 'بيانات') + '.\n\nنجرّبه في الوضع التدريبي؟ كل شيء يعمل كالحقيقة — ولا شيء يُحفظ في القاعدة ولا يُخصم من المخزون.',
                               { title: les.title, okText: '🎓 ابدأ تدريبياً', cancelText: 'على بيانات حقيقية' }).then(go);
      else go(true);
      return;
    }
    start(les, 0);
  }

  /* ═══ المكتبة ═══ */
  function open() {
    css();
    var old = doc.getElementById('gl-lib'); if (old) old.remove();
    var L = lessons(), done = doneSet(), tr = inTraining();
    var w = doc.createElement('div'); w.className = 'gl-lib'; w.id = 'gl-lib'; w.setAttribute('data-full', '1'); w.setAttribute('data-keep-fab', '1');
    var page = (L.page || doc.title || '').toString();
    w.innerHTML = '<div class="gl-lib-box" role="dialog" aria-label="الدروس">' +
      '<div class="gl-lib-h"><span style="font-size:22px">📘</span><b>الدروس — خطوة بخطوة</b><button class="gl-x" data-a="x">✕</button></div>' +
      '<div class="gl-lib-sub">كل درسٍ عمليّةٌ كاملة على الأزرار الحقيقيّة: أُضيء لك الزرّ، تضغطه أنت، وأنتقل معك. «السابق» و«التالي» متاحان دائماً، و✕ يُنهي.</div>' +
      (global.GMTSandbox ? '<div class="gl-train' + (tr ? ' on' : '') + '">' + (tr ? '🎓 أنت في الوضع التدريبي — لا شيء يُحفظ.' : '🎓 الوضع التدريبي: جرّب كل شيء بلا أثر على القاعدة.') +
        '<button data-a="train">' + (tr ? 'خروج منه' : 'ادخل') + '</button></div>' : '') +
      (L.length ? L.map(function (l, k) {
        var ok = done[pageId() + ':' + l.id];
        return '<button class="gl-item" data-k="' + k + '"><span class="gl-ic">' + esc(l.icon || '📘') + '</span>' +
          '<span class="gl-it"><b>' + esc(l.title) + '</b><small>' + esc(l.goal || '') + '</small></span>' +
          '<span class="gl-meta' + (ok ? ' ok' : '') + '">' + (ok ? '✓ أنهيته' : l.steps.filter(function (st) { try { return !st.media || global.matchMedia(st.media).matches; } catch (_) { return true; } }).length + ' خطوة') + '</span></button>';
      }).join('') : '<div class="gl-lib-sub">لا دروس لهذه الصفحة بعد — استعمل «شو هالزر؟» لشرح الأزرار.</div>') +
      '<div class="gl-foot">' +
        (global.GMTHints ? '<button data-a="hints">❔ شو هالزر؟</button>' : '') +
        (global.GMTGuide && GMTGuide.__index ? '<button data-a="btns">🔘 دليل الأزرار</button>' : '') +
        (global.GMTGuide && GMTGuide.tour ? '<button data-a="slides">🎬 الشاشات التعريفيّة</button>' : '') +
      '</div></div>';
    doc.body.appendChild(w);
    w.addEventListener('click', function (e) {
      if (e.target === w) { w.remove(); return; }
      var b = e.target.closest && e.target.closest('[data-a],[data-k]'); if (!b) return;
      if (b.hasAttribute('data-k')) { w.remove(); begin(L[+b.getAttribute('data-k')]); return; }
      var a = b.getAttribute('data-a'); w.remove();
      if (a === 'train') { if (tr) GMTSandbox.exit(); else GMTSandbox.enter(); }
      else if (a === 'hints') GMTHints.tour();
      else if (a === 'btns') GMTGuide.__index('btns');
      else if (a === 'slides') GMTGuide.tour();
    });
  }

  /* ═══ الواجهة البرمجيّة ═══ */
  global.GMTLearn = {
    define: function (page, list) { LIB[page] = list || []; },
    has: function () { return lessons().length > 0; },
    open: open,
    begin: function (id) { var l = lessons().filter(function (x) { return x.id === id; })[0]; if (l) begin(l); },
    stop: function () { stop(false); },
    list: lessons,
    active: function () { return S ? { lesson: S.les.id, step: S.i } : null; },
    steps: function () { return S ? S.steps.slice() : []; },
    _all: function () { return LIB; },
    _find: find
  };

  /* ═══ الربط بمداخل الشرح الموجودة — كلّها تفتح الدروس أوّلاً (ولا شيء يبدأ وحده) ═══ */
  function wire() {
    if (!lessons().length) return;
    if (global.GMTGuide && !GMTGuide.__index) {
      GMTGuide.__index = GMTGuide.index;
      GMTGuide.index = function (t) { if (t) return GMTGuide.__index(t); open(); };
      GMTGuide.open = function () { open(); };
      GMTGuide.walkthrough = function () { open(); };
      global.restartTour = function () { open(); };
    }
    if (typeof global.showWelcomeSlidesForce === 'function' && !global.__gmtWelcomeSlides) {
      global.__gmtWelcomeSlides = global.showWelcomeSlidesForce;
      global.showWelcomeSlidesForce = function () { open(); };
    }
    var hb = doc.getElementById('gmt-hints-fab');
    if (hb && !hb.__gl) { hb.__gl = 1; hb.onclick = function (e) { e.preventDefault(); open(); }; hb.title = 'الدروس والشرح'; }
  }

  /* ═══ متابعة درسٍ بعد التحويل للوضع التدريبي (أنت بدأته — لا شيء يبدأ وحده) ═══ */
  function resume() {
    var r = null; try { r = JSON.parse(sessionStorage.getItem(SS_RESUME) || 'null'); } catch (_) {}
    if (!r || r.page !== pageId()) return;
    var les = lessons().filter(function (x) { return x.id === r.id; })[0];
    if (!les) return;
    var first = les.steps.filter(function (st) { try { return !st.media || global.matchMedia(st.media).matches; } catch (_) { return true; } })[r.i || 0], t0 = Date.now();
    (function wait() {
      if (find(first && first.sel) || Date.now() - t0 > 15000) { start(les, r.i || 0); return; }
      setTimeout(wait, 400);
    })();
  }

  function boot() { wire(); setTimeout(wire, 1500); setTimeout(wire, 4000); resume(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  else setTimeout(boot, 300);
})(window);
