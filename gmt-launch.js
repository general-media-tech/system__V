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

  var VER = '20261110e';
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
      /* (seq 560–561) «السائق يلوّح»: فقاعة كلامٍ صغيرة فوق مقصورة الشاحنة «جاهز؟ 👋» بيدٍ تلوّح — لا كلمة عن اللمس */
      '#gmt-launch.wait{cursor:pointer}' +
      '#gmt-launch .gl-bub{position:absolute;right:6%;bottom:calc(100% + 10px);direction:rtl;white-space:nowrap;display:flex;align-items:center;gap:6px;' +
        'flex-direction:column;align-items:center;gap:6px;background:#fff;color:#111;font-weight:900;font-size:clamp(15px,3.8vw,18px);line-height:1;font-family:inherit;padding:9px 13px;border-radius:16px;border:2px solid #111;box-shadow:0 6px 16px rgba(0,0,0,.12);' +
        'transform-origin:85% 120%;transform:scale(.4);opacity:0;transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .2s ease;pointer-events:none}' +
      '#gmt-launch .gl-bub::after{content:"";position:absolute;right:22px;top:100%;border:8px solid transparent;border-top-color:#111;border-bottom:0}' +
      '#gmt-launch .gl-bub::before{content:"";position:absolute;right:24px;top:calc(100% - 3px);border:6px solid transparent;border-top-color:#fff;border-bottom:0;z-index:1}' +
      '#gmt-launch .gl-bub.on{transform:scale(1);opacity:1;animation:glBob 2.4s ease-in-out .5s infinite}' +
      '#gmt-launch .gl-bub.go{animation:none;transform:scale(.3);opacity:0;transition:transform .2s ease,opacity .2s ease}' +
      '#gmt-launch .gl-wave{display:inline-block;transform-origin:70% 85%;animation:glWave 1.6s ease-in-out infinite}' +
      '@keyframes glWave{0%,60%,100%{transform:rotate(0)}10%,30%{transform:rotate(16deg)}20%,40%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}' +
      '@keyframes glBob{50%{transform:translateY(-3px)}}' +
      '#gmt-launch .gl-b1{display:flex;align-items:center;gap:6px}' +
      '#gmt-launch .gl-b2{font-size:clamp(12px,3.1vw,14px);font-weight:800;color:#D5001C;animation:glBlink 1.6s ease-in-out infinite}' +
      '@keyframes glBlink{50%{opacity:.6}}' +
      '#gmt-launch.tapm .gl-road{margin-top:calc(6vh + 34px)}' +
      '@media (prefers-reduced-motion:reduce){#gmt-launch .gl-bub.on,#gmt-launch .gl-wave{animation:none}}';
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
    var tapMode = !!opts.tap, snd = tapMode ? null : engine(), fg = null, hint = null;
    texts.forEach(function (e, i) { setTimeout(function () { e.classList.add('on'); }, 200 + i * 350); });
    var covered = false, coverFns = [];
    var ctl = {
      el: ov,
      onCover: function (f) { if (covered) f(); else coverFns.push(f); },
      fadeAudio: function () { if (snd) snd.fade(); },
      /* الصفحة الجديدة جاهزة ⇒ يرقّ الضباب كاشفاً إيّاها، ثمّ يُزال كلّ شيء */
      clear: function () {
        ov.classList.add('clear'); rd.destroy();
        return (fg ? fg.anim(1, 0, FOG_OUT_MS) : Promise.resolve()).then(function () { ctl.remove(); });
      },
      remove: function () { if (snd) snd.stop(); unTap(); try { rd.destroy(); } catch (_) {} if (fg) fg.destroy(); ov.remove(); block(false); if (active === ctl) active = null; }
    };
    active = ctl;
    function fireCover() {
      if (covered) return; covered = true;
      emit('gmt:launch-cover', {});
      coverFns.splice(0).forEach(function (f) { try { f(); } catch (_) {} });
    }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    /* (seq 559) وضع اللمس: الشاحنة واقفةٌ مطفأة في مكانها من أوّل لحظة · السطر الهادئ تحت الشارع · اللمسة ⇒ المحرّك (الصوت) ⇒ تنطلق */
    var tapFns = [];
    function unTap() { tapFns.splice(0).forEach(function (f) { f(); }); }
    function waitTap() {
      return new Promise(function (go) {
        var fired = false;
        function start(e) {
          if (fired) return; fired = true;
          if (e && e.preventDefault) e.preventDefault();
          snd = engine();                       // داخل اللمسة نفسها ⇒ يُسمح بالصوت
          try { if (global.GMTSound && GMTSound.unlock) GMTSound.unlock(); } catch (_) {}
          ov.classList.remove('wait'); if (hint) hint.classList.add('go');
          /* السائق يزمّر «بيب بيب» وهو ينطلق */
          setTimeout(function () { try { if (global.GMTSound && GMTSound.play) GMTSound.play('horn'); } catch (_) {} }, 120);
          if (rd.quiet) rd.quiet(false);
          unTap(); emit('gmt:launch-tap', {}); go();
        }
        ['pointerup', 'click'].forEach(function (t) { ov.addEventListener(t, start, true); tapFns.push(function () { ov.removeEventListener(t, start, true); }); });
      });
    }
    var cap = 0;
    function run(from) {
      /* سقفٌ عامّ: مهما حدث في الرسم (تبويبٌ خلفيّ يجمّد الإطارات) تحدث التغطية */
      cap = setTimeout(fireCover, ENTER_MS + IDLE_MS + FOG_AT + FOG_IN_MS + 1800);
      /* ① تدخل الشارع وتبطئ حتى تقف قرب الوسط ⇐ ② تقف لحظةً تعمل ⇐ ③ تنطلق بقوّة ودخانٌ كثيف ⇐ ④ الدخان يملأ الشاشة */
      (from ? Promise.resolve() : rd.to(.45, ENTER_MS, 'out')).then(function () { return wait(IDLE_MS); }).then(function () {
        if (rd.heavy) rd.heavy(true);              // تدوير المحرّك: الدخان يندفع قبل أن تتحرّك بلحظة
        return wait(160).then(function () { rd.to(1, LAUNCH_MS, 'in'); return wait(FOG_AT); });
      }).then(function () {
        texts.forEach(function (e) { e.classList.remove('on'); });
        try { fg = R.fog(ov); } catch (_) { fg = null; return; }   // بلا ضباب ⇒ تغطيةٌ فورية (السقف العامّ يضمنها)
        return fg.anim(0, 1, FOG_IN_MS);
      }).then(function () { clearTimeout(cap); fireCover(); });
    }
    if (tapMode) {
      ov.classList.add('wait', 'tapm'); ov.removeAttribute('aria-hidden'); ov.setAttribute('role', 'button'); ov.setAttribute('aria-label', 'جاهز؟ المس الشاشة لتنطلق الشاحنة');
      if (rd.quiet) rd.quiet(true);
      rd.to(.45, 1);                                       // واقفةٌ في مكانها (لا دخول)
      /* (seq 561) «السائق يلوّح»: فقاعةٌ فوق المقصورة تتحرّك مع الشاحنة */
      hint = doc.createElement('div'); hint.className = 'gl-bub';
      /* (seq 563) «ما بيطلب إنك تكبسه — بقول بس جاهز» ⇐ سطرٌ ثانٍ صريح: «اضغط على الشاشة لننطلق» */
      hint.innerHTML = '<div class="gl-b1"><span>جاهز؟</span><span class="gl-wave" aria-hidden="true">👋</span></div><div class="gl-b2">اضغط على الشاشة لننطلق</div>';
      (host.querySelector('.gr-van') || ov).appendChild(hint);
      setTimeout(function () { hint.classList.add('on'); }, 600);
      waitTap().then(function () { run(true); });
    } else setTimeout(function () { run(false); }, 100);
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

  /* ── ⓪ (المالك seq 558 · 559) «إمّا الصوت يشتغل بدون لمسة، أو الزبون مجبر يلمس الشاشة لحتى يفتح الانترو ويشتغل الصوت»
     ثمّ «شاشة اللمس صارت سيئة — مبيّنة إعلان» ⇐ لا شاشةٌ منفصلة: المتصفّحات تمنع أيّ صوتٍ قبل أوّل لمسة (قيدٌ لا نملك
     تجاوزه)، فنجرّب تشغيل صوت الشاحنة فوراً:
       'auto' ⇐ سمح المتصفّح: الانترو كما هو بصوته.
       'tap'  ⇐ منعه: الانترو نفسه يبدأ والشاحنة **واقفة مطفأة** على الشارع مع «أهلاً بكم»، وتحت الشارع سطرٌ هادئ
                «المس الشاشة لتشغيل الشاحنة» — اللمسة تُدير المحرّك (صوته) فتعمل لحظةً ثمّ تنطلق بدخانها.
       'skip' ⇐ الأصوات مكتومة أو «تقليل الحركة»: الانترو مباشرة. */
  /* (seq 563) «الانترو ما بيرجع يفتح بالمرّة الثانية — بيدخل فوراً على الصفحة»: بعد أوّل لمسة يسمح المتصفّح بالصوت فكان الانترو
     يجري وحده سريعاً · الآن: كلّ فتحٍ لرابط التتبّع ⇐ الشاحنة واقفة تنتظر لمسة الزبون (والفقاعة تقول «اضغط») · مكتوم/تقليل الحركة ⇐ مباشرة.
     (للاختبارات الآلية فقط: localStorage gmt_intro_notap=1 ⇐ بلا انتظار) */
  function gate() {
    if (!doc.body || reduced() || !soundOn()) return Promise.resolve('skip');
    try { if (localStorage.getItem('gmt_intro_notap') === '1') return Promise.resolve('auto'); } catch (_) {}
    return Promise.resolve('tap');
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
