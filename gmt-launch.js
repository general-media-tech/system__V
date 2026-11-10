/* ═══════════════════════════════════════════════════════════════════════════
   gmt-launch.js — انطلاق الشاحنة والانتقال بين الصفحات
   ─────────────────────────────────────────────────────────────────────────
   18 ت1: كان فيديو (launch-*.mp4) طبقةً فوق الصفحة.
   19 ت1 · TASK-0106 (خطّة العمل §١، رُفع تأجيلها بطلب «أكمل كل ما يتعلّق بالتتبّع»):
     «الشاحنة كبيرة وتقف مكانها، والدخان يجتاح الشاشة بكتلٍ عشوائية» ⇐ الآن:
     ① شاحنتك نفسها **أصغر** (ثلث العرض على الهاتف، ربعه على الكمبيوتر) تمشي على
        طريقٍ رفيع من A (يسار) إلى B (يمين)، والمقطوع خلفها يمتلئ كشريط تقدّم،
        باهتزازٍ خفيف ودخانٍ خفيف من العادم، تتسارع بنعومة ثمّ تبطئ عند B.
     ② عند B يرتفع ضبابٌ **متجانس** بطبقاتٍ ناعمة يملأ الشاشة خلال ~١ث.
     ③ تحت الضباب تُفتح الصفحة الثانية، ثمّ يرقّ ببطء (~١٫٢ث) كاشفاً إيّاها.
     جزءٌ من الصفحة (HTML + Canvas — gmt-road.js) لا فيديو: أخفّ ويتكيّف مع الهاتف والكمبيوتر.
     الصوت: صوت شاحنتك (van-sound.mp3) يخفت عند الانتقال، ويتبع مفتاح الأصوات.

   10 ت2 · TASK-0228 (المالك seq 158 · 557): «الانترو الأوّل ما في له مسار نقطة A وB · في له شارع · وبالطالع دخّان كثير
     وتنطلق أسرع» ⇐ المشهد صار شارعاً: تدخل الشاحنة من اليسار وتقف لحظةً تعمل (دخانٌ خفيف والنصّ يظهر) ثمّ تنطلق
     بتسارعٍ قويّ يميناً ويخرج منها دخانٌ كثيف يكبر ويملأ الشاشة، وتحته تُفتح الصفحة. المدّة ≈ ٣ث بدل ≈ ٤ث.
     المسار A⇐B يبقى لشاحنة البحث داخل صفحة التتبّع وحدها.

   الحماية (كما كانت): النقر ولوحة المفاتيح ممنوعان أثناءه · لا يعلق أبداً (سقوفٌ
   زمنية لكل مرحلة، وغطاء الوصول CSS يختفي وحده بعد ٩ث حتى لو تعطّل كلّ JS) ·
   «تقليل الحركة» ⇒ انتقالٌ بسيط · من كل روابط التتبّع ومن الروابط الخارجية.

   الواجهة (لم تتغيّر):
     GMTLaunch.go(url)            انتقالٌ بين صفحتين
     GMTLaunch.cover(fn, opts)    في الصفحة نفسها: fn تُنفَّذ تحت الضباب ثمّ يرقّ
     GMTLaunch.bind(root, test)   يربط روابط (a[href]) بالانتقال
     GMTLaunch.arriving()         هل وصلنا هذه الصفحة عبر انتقال؟
     GMTLaunch.hold(promise)      الصفحة الجديدة تؤخّر الكشف حتى تجهز بياناتها
     GMTLaunch.gate(opts)         (seq 558) قبل الانترو: الصوت يعمل وحده إن سمح المتصفّح، وإلّا شاشة «المس الشاشة»
                                  واللمسة نفسها تُشغّل صوت الشاحنة ثمّ يبدأ الانترو — يَعِد حين يجوز البدء
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.GMTLaunch) return;

  var VER = '20261110b';
  var KEY = 'gmt_launch_arrive';
  var FRESH_MS = 15000;
  var ENTER_MS = 900;          // تدخل الشارع وتبطئ
  var IDLE_MS = 650;           // تقف لحظةً تعمل
  var LAUNCH_MS = 750;         // تنطلق بتسارعٍ قويّ
  var FOG_AT = 600;            // الدخان الكثيف يملأ الشاشة بعد بدء الانطلاق بقليل
  var FOG_IN_MS = 800;         // الضباب يملأ الشاشة
  var FOG_OUT_MS = 1200;       // ثمّ يرقّ كاشفاً الصفحة
  var ARRIVE_CAP = 8000;

  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function road() { return global.GMTRoad || null; }
  function soundOn() {
    try { if (global.GMTSound && typeof GMTSound.isOn === 'function') return !!GMTSound.isOn(); } catch (_) {}
    try { var v = localStorage.getItem('gmt_sound'); if (v === 'off') return false; if (v === 'on') return true; } catch (_) {}
    return !reduced();
  }
  function emit(name, detail) { try { doc.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {} }
  function fileOf(u) { try { return decodeURIComponent(new URL(u, location.href).pathname.split('/').pop() || ''); } catch (_) { return ''; } }
  function loaded() {
    if (doc.readyState === 'complete') return Promise.resolve();
    return new Promise(function (r) { global.addEventListener('load', function () { r(); }, { once: true }); });
  }

  /* ── الأنماط ───────────────────────────────────────────────────────────── */
  /* لون الضباب نفسه في غطاء الوصول الأوّل (CSS) وفي الرسم — فلا «قفزة» حين يتسلّم الرسمُ من الغطاء */
  var FOG_CSS = 'radial-gradient(60% 50% at 30% 35%,#f4f5f7 0,rgba(244,245,247,0) 70%),radial-gradient(55% 45% at 75% 65%,#f4f5f7 0,rgba(244,245,247,0) 70%),#eceef1';
  function css() {
    if (doc.getElementById('gmt-launch-css')) return;
    var st = doc.createElement('style'); st.id = 'gmt-launch-css';
    st.textContent =
      '#gmt-launch{position:fixed;inset:0;z-index:2147483000;background:#fff;opacity:0;transition:opacity .25s ease,background-color .3s ease;pointer-events:auto;touch-action:none;overflow:hidden;display:flex;flex-direction:column;justify-content:center}' +
      '#gmt-launch.on{opacity:1}' +
      '#gmt-launch .gl-road{width:100%;margin-top:6vh}' +
      '#gmt-launch .gl-t{text-align:center;color:#111;font-weight:900;opacity:0;transition:opacity .6s ease;padding:0 16px;font-family:inherit}' +
      '#gmt-launch .gl-t1{font-size:clamp(22px,4.6vw,34px)}' +
      '#gmt-launch .gl-t2{font-size:clamp(14px,2.8vw,18px);font-weight:700;margin-top:6px}' +
      '#gmt-launch .gl-t.on{opacity:1}' +
      '#gmt-launch.clear{background-color:transparent}#gmt-launch.clear>:not(.gr-fog){visibility:hidden}' +
      /* (seq 558) شاشة «المس الشاشة» قبل الانترو */
      '#gmt-launch-gate{position:fixed;inset:0;z-index:2147483002;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;cursor:pointer;opacity:0;transition:opacity .25s ease;touch-action:manipulation;-webkit-tap-highlight-color:transparent;font-family:inherit;padding:16px;text-align:center}' +
      '#gmt-launch-gate.on{opacity:1}#gmt-launch-gate.out{opacity:0;pointer-events:none}' +
      '#gmt-launch-gate .gg-t1{font-size:clamp(24px,5.4vw,36px);font-weight:900;color:#111}' +
      '#gmt-launch-gate .gg-btn{position:relative;width:104px;height:104px;border-radius:50%;background:#D5001C;display:grid;place-items:center;box-shadow:0 12px 30px rgba(213,0,28,.35)}' +
      '#gmt-launch-gate .gg-btn svg{width:46px;height:46px;position:relative}' +
      '#gmt-launch-gate .gg-ring{position:absolute;inset:0;border-radius:50%;border:3px solid #D5001C;animation:ggPulse 1.4s ease-out infinite}' +
      '@keyframes ggPulse{from{transform:scale(1);opacity:.8}to{transform:scale(1.7);opacity:0}}' +
      '#gmt-launch-gate .gg-t2{font-size:clamp(16px,3.6vw,20px);font-weight:800;color:#111}' +
      '#gmt-launch-gate .gg-t3{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#6b7280}#gmt-launch-gate .gg-t3 svg{width:16px;height:16px}' +
      '@media (prefers-reduced-motion:reduce){#gmt-launch-gate .gg-ring{animation:none}}';
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ── منع النقر ولوحة المفاتيح أثناء الانتقال ─────────────────────────── */
  var blocked = 0;
  function eat(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
  function block(on) {
    if (on) { if (blocked++ === 0) { ['keydown', 'keypress', 'keyup'].forEach(function (t) { doc.addEventListener(t, eat, true); }); } }
    else if (blocked > 0 && --blocked === 0) { ['keydown', 'keypress', 'keyup'].forEach(function (t) { doc.removeEventListener(t, eat, true); }); }
  }

  /* ── الصوت: صوت شاحنتك الحقيقي، يخفت عند الانتقال ─────────────────────── */
  function vanAudio() { var a = new Audio((global.GMTRoad && GMTRoad.dir || 'img/delivery/') + 'van-sound.mp3'); a.loop = true; a.volume = .9; return a; }
  var primed = null;           // صوتٌ بدأ بلمسة الزبون على شاشة «المس الشاشة» — يتسلّمه المشهد
  function engine() {
    if (!soundOn()) return { fade: function () {}, stop: function () {} };
    var a = null, gest = null, p;
    if (primed) { a = primed; primed = null; }
    else { try { a = vanAudio(); } catch (_) { a = null; } }
    function un() { if (gest) ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'].forEach(function (t) { doc.removeEventListener(t, gest, true); }); gest = null; }
    if (a) {
      try { p = a.paused ? a.play() : null; } catch (_) {}
      /* المتصفّح يمنع الصوت قبل أوّل لمسة ⇒ يبدأ مع أوّل لمسة ما دام المشهد قائماً */
      /* (TASK-0311 · seq 397) touchstart ليس «تفاعلاً» عند المتصفّح ⇒ play() يُرفض بلا معالجة («play() failed…» في سجلّ الأخطاء).
         نلتقط الرفض ونبقى ننتظر لمسةً تُحتسب (touchend · click) ولا نزيل المستمع إلا بعد نجاح التشغيل. */
      if (p && p.catch) p.catch(function () { gest = function () { var q; try { q = a.play(); } catch (_) {} if (q && q.then) q.then(un, function () {}); else un(); }; ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'].forEach(function (t) { doc.addEventListener(t, gest, true); }); });
    }
    return {
      fade: function () { un(); if (!a) return; var k = 0, it = setInterval(function () { k++; try { a.volume = Math.max(0, .9 - k * .1); } catch (_) {} if (k >= 9) { clearInterval(it); try { a.pause(); } catch (_) {} } }, 60); },
      stop: function () { un(); if (a) try { a.pause(); } catch (_) {} }
    };
  }

  /* ── المشهد: الطريق ⇐ الضباب يملأ الشاشة ⇐ onCover ─────────────────── */
  var active = null;
  function scene(opts) {
    opts = opts || {};
    css();
    var R = road();
    var ov = doc.createElement('div'); ov.id = 'gmt-launch'; ov.setAttribute('aria-hidden', 'true');
    var texts = (opts.texts || []).slice(0, 2).map(function (t, i) {
      var e = doc.createElement('div'); e.className = 'gl-t gl-t' + (i + 1); e.textContent = t; ov.appendChild(e); return e;
    });
    var host = doc.createElement('div'); host.className = 'gl-road'; ov.appendChild(host);
    doc.body.appendChild(ov);
    block(true);
    requestAnimationFrame(function () { ov.classList.add('on'); });
    var rd;
    try { rd = R.create(host, { big: true, street: true }); }
    catch (e) { ov.remove(); block(false); throw e; }          // تعذّر المشهد ⇒ لا تبقى طبقةٌ تحجب الصفحة أبداً
    var snd = engine(), fg = null;
    texts.forEach(function (e, i) { setTimeout(function () { e.classList.add('on'); }, 200 + i * 350); });
    var covered = false, coverFns = [];
    var ctl = {
      el: ov,
      onCover: function (f) { if (covered) f(); else coverFns.push(f); },
      fadeAudio: function () { snd.fade(); },
      /* الصفحة الجديدة جاهزة ⇒ يرقّ الضباب كاشفاً إيّاها، ثمّ يُزال كلّ شيء */
      clear: function () {
        ov.classList.add('clear'); rd.destroy();
        return (fg ? fg.anim(1, 0, FOG_OUT_MS) : Promise.resolve()).then(function () { ctl.remove(); });
      },
      remove: function () { snd.stop(); try { rd.destroy(); } catch (_) {} if (fg) fg.destroy(); ov.remove(); block(false); if (active === ctl) active = null; }
    };
    active = ctl;
    function fireCover() {
      if (covered) return; covered = true;
      emit('gmt:launch-cover', {});
      coverFns.splice(0).forEach(function (f) { try { f(); } catch (_) {} });
    }
    /* سقفٌ عامّ: مهما حدث في الرسم (تبويبٌ خلفيّ يجمّد الإطارات) تحدث التغطية */
    var cap = setTimeout(fireCover, ENTER_MS + IDLE_MS + FOG_AT + FOG_IN_MS + 1800);
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    setTimeout(function () {
      /* ① تدخل الشارع وتبطئ حتى تقف قرب الوسط ⇐ ② تقف لحظةً تعمل ⇐ ③ تنطلق بقوّة ودخانٌ كثيف ⇐ ④ الدخان يملأ الشاشة */
      rd.to(.45, ENTER_MS, 'out').then(function () { return wait(IDLE_MS); }).then(function () {
        if (rd.heavy) rd.heavy(true);              // تدوير المحرّك: الدخان يندفع قبل أن تتحرّك بلحظة
        return wait(160).then(function () { rd.to(1, LAUNCH_MS, 'in'); return wait(FOG_AT); });
      }).then(function () {
        texts.forEach(function (e) { e.classList.remove('on'); });
        try { fg = R.fog(ov); } catch (_) { fg = null; return; }   // بلا ضباب ⇒ تغطيةٌ فورية (السقف العامّ يضمنها)
        return fg.anim(0, 1, FOG_IN_MS);
      }).then(function () { clearTimeout(cap); fireCover(); });
    }, 100);
    return ctl;
  }

  /* ── ① انتقالٌ بين صفحتين ──────────────────────────────────────────────── */
  var going = false;
  function go(url) {
    if (going) return; going = true;
    var to = fileOf(url);
    function plain() { global.location.assign(url); }
    if (reduced() || !road() || !doc.body) { plain(); return; }
    var ctl;
    try { ctl = scene({}); } catch (_) { plain(); return; }
    ctl.onCover(function () {
      ctl.fadeAudio();
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), to: to, v: 2 })); } catch (_) {}
      global.location.assign(url);
    });
  }

  /* ── ⓪ (المالك seq 558) «إمّا الصوت يشتغل بدون لمسة، أو الزبون مجبر يلمس الشاشة لحتى يفتح الانترو ويشتغل الصوت» ──
     المتصفّحات تمنع أيّ صوتٍ قبل أوّل لمسة (قيدٌ في المتصفّح لا نملك تجاوزه). لذلك:
     ① نجرّب تشغيل صوت الشاحنة فوراً — إن سمح المتصفّح يبدأ الانترو مباشرةً بصوته (لا شاشة).
     ② وإن منعه: شاشة بيضاء «المس الشاشة لتتبّع شحنتك» — اللمسة نفسها تُشغّل الصوت ثمّ يبدأ الانترو.
     الأصوات مكتومة (مفتاح الأصوات) أو «تقليل الحركة» ⇒ لا شاشة ولا انتظار. */
  function gate(opts) {
    opts = opts || {};
    if (!doc.body || reduced() || !soundOn()) return Promise.resolve('skip');
    var a; try { a = vanAudio(); } catch (_) { return Promise.resolve('noaudio'); }
    return new Promise(function (resolve) {
      var ov = null, done = false;
      function finish(how) {
        if (done) return; done = true; primed = a;
        if (ov) { ov.classList.add('out'); var o = ov; setTimeout(function () { o.remove(); }, 260); ['pointerup', 'click', 'keydown'].forEach(function (t) { o.removeEventListener(t, tap, true); }); }
        emit('gmt:launch-gate', { how: how });
        resolve(how);
      }
      function tap(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        try { var q = a.play(); if (q && q.catch) q.catch(function () {}); } catch (_) {}   // داخل اللمسة نفسها ⇒ يُسمح بالصوت
        try { if (global.GMTSound && GMTSound.unlock) GMTSound.unlock(); } catch (_) {}
        finish('tap');
      }
      function show() {
        if (done || ov) return;
        css();
        ov = doc.createElement('div'); ov.id = 'gmt-launch-gate'; ov.setAttribute('role', 'button'); ov.setAttribute('tabindex', '0');
        ov.setAttribute('aria-label', opts.label || 'المس الشاشة لتتبّع شحنتك');
        ov.innerHTML = '<div class="gg-t1">' + (opts.title || 'تتبّع شحنتك') + '</div>' +
          '<div class="gg-btn"><i class="gg-ring"></i><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M22 14a8 8 0 0 1-8 8"/><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1"/>' +
          '<path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg></div>' +
          '<div class="gg-t2">' + (opts.hint || 'المس الشاشة للمتابعة') + '</div>' +
          '<div class="gg-t3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg> مع الصوت</div>';
        ['pointerup', 'click', 'keydown'].forEach(function (t) { ov.addEventListener(t, tap, true); });
        doc.body.appendChild(ov);
        requestAnimationFrame(function () { ov.classList.add('on'); });
      }
      var p; try { p = a.play(); } catch (_) { p = null; }
      if (p && p.then) {
        p.then(function () { finish('auto'); }, show);
        setTimeout(function () { if (!done) show(); }, 700);   // الصوت ما زال يتحمّل على شبكةٍ بطيئة ⇒ الشاشة تظهر، وتختفي وحدها إن سمح المتصفّح
      } else show();
    });
  }

  /* ── ② في الصفحة نفسها: fn تحت الضباب ثمّ يرقّ (ترحيب صفحة التتبّع حين تُفتح مباشرة) ── */
  function cover(fn, opts) {
    opts = opts || {};
    if (reduced() || !road()) return Promise.reject(new Error('no-scene'));
    var ctl;
    try { ctl = scene(opts); } catch (e) { return Promise.reject(e); }
    return new Promise(function (resolve) {
      ctl.onCover(function () {
        ctl.fadeAudio();
        Promise.resolve().then(fn).catch(function () {}).then(function () {
          return Promise.race([Promise.all([loaded(), opts.ready || null]), new Promise(function (r) { setTimeout(r, ARRIVE_CAP); })]);
        }).then(function () { return ctl.clear(); }).then(function () { emit('gmt:launch-done', { same: true }); resolve(true); },
          function () { ctl.remove(); resolve(true); });
      });
    });
  }

  /* ── ③ الوصول: الصفحة الجديدة تبدأ تحت الضباب، وتنكشف بعد اكتمال تحميلها ── */
  var arr = null, holds = [];
  try {
    var raw = sessionStorage.getItem(KEY);
    if (raw) {
      sessionStorage.removeItem(KEY);
      var o = JSON.parse(raw);
      var here = fileOf(location.href);
      if (o && (Date.now() - o.at) < FRESH_MS && (!o.to || o.to === here)) arr = o;
    }
  } catch (_) { arr = null; }
  if (arr) {
    var ast = doc.createElement('style'); ast.id = 'gmt-launch-arr-css';
    /* غطاءٌ من أوّل رسم بلون الضباب نفسه — وحارسُ CSS: يختفي وحده بعد ٩ث حتى لو لم يعمل أيّ JS بعده */
    ast.textContent = 'html.gmt-arriving::after{content:"";position:fixed;inset:0;z-index:2147483000;background:' + FOG_CSS +
      ';pointer-events:auto;animation:gmtArrSafe .5s ease 9s forwards}@keyframes gmtArrSafe{to{opacity:0;visibility:hidden}}';
    (doc.head || doc.documentElement).appendChild(ast);
    doc.documentElement.classList.add('gmt-arriving');
    block(true);
    var reveal = function () {
      var finish = function () { doc.documentElement.classList.remove('gmt-arriving'); };
      Promise.race([
        loaded().then(function () { return Promise.all(holds); }),
        new Promise(function (r) { setTimeout(r, ARRIVE_CAP); })
      ]).then(function () {
        var R = road();
        if (!doc.body || !R || reduced()) { finish(); block(false); emit('gmt:launch-done', { arrived: true }); return; }
        var f; try { f = R.fog(doc.body); } catch (_) { finish(); block(false); return; }
        f.el.style.zIndex = '2147483001'; f.set(1);
        finish();                                   // الرسمُ يتسلّم من الغطاء بلونه نفسه
        return f.anim(1, 0, FOG_OUT_MS).then(function () { f.destroy(); block(false); emit('gmt:launch-done', { arrived: true }); });
      }).catch(function () { finish(); block(false); });
    };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { setTimeout(reveal, 0); });
    else setTimeout(reveal, 0);
  }

  /* الرجوع بزرّ المتصفّح إلى صفحةٍ محفوظة (bfcache) كانت مغطّاة: تُكشف فوراً */
  global.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    going = false;
    if (active) active.remove();
    var ov = doc.getElementById('gmt-launch'); if (ov) ov.remove();
    while (blocked > 0) block(false);
  });

  /* ── ربط الروابط ───────────────────────────────────────────────────────── */
  function bind(root, test) {
    (root || doc).addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) return;
      try { if (new URL(a.href).origin !== location.origin) return; } catch (_) { return; }
      if (test && !test(a)) return;
      e.preventDefault();
      go(a.href);
    });
  }
  /* لا ملفّات ثقيلة بعد اليوم (لا فيديو) — يبقى للتوافق مع من يستدعيه */
  function preload() {}

  global.GMTLaunch = {
    go: go, cover: cover, bind: bind, preload: preload, gate: gate,
    arriving: function () { return !!arr; },
    hold: function (p) { if (p && p.then) holds.push(Promise.resolve(p).catch(function () {})); },
    version: VER
  };
})(window);
