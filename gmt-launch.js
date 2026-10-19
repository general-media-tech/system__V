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

   الحماية (كما كانت): النقر ولوحة المفاتيح ممنوعان أثناءه · لا يعلق أبداً (سقوفٌ
   زمنية لكل مرحلة، وغطاء الوصول CSS يختفي وحده بعد ٩ث حتى لو تعطّل كلّ JS) ·
   «تقليل الحركة» ⇒ انتقالٌ بسيط · من كل روابط التتبّع ومن الروابط الخارجية.

   الواجهة (لم تتغيّر):
     GMTLaunch.go(url)            انتقالٌ بين صفحتين
     GMTLaunch.cover(fn, opts)    في الصفحة نفسها: fn تُنفَّذ تحت الضباب ثمّ يرقّ
     GMTLaunch.bind(root, test)   يربط روابط (a[href]) بالانتقال
     GMTLaunch.arriving()         هل وصلنا هذه الصفحة عبر انتقال؟
     GMTLaunch.hold(promise)      الصفحة الجديدة تؤخّر الكشف حتى تجهز بياناتها
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.GMTLaunch) return;

  var VER = '20261019a';
  var KEY = 'gmt_launch_arrive';
  var FRESH_MS = 15000;
  var DRIVE_MS = 2600;         // من A إلى B
  var FOG_IN_MS = 1000;        // الضباب يملأ الشاشة
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
      '#gmt-launch.clear{background-color:transparent}#gmt-launch.clear>:not(.gr-fog){visibility:hidden}';
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
  function engine() {
    if (!soundOn()) return { fade: function () {}, stop: function () {} };
    var a = null, gest = null;
    try { a = new Audio((global.GMTRoad && GMTRoad.dir || 'img/delivery/') + 'van-sound.mp3'); a.loop = true; a.volume = .9; } catch (_) { a = null; }
    function un() { if (gest) ['pointerdown', 'touchstart', 'keydown'].forEach(function (t) { doc.removeEventListener(t, gest, true); }); gest = null; }
    if (a) {
      var p; try { p = a.play(); } catch (_) {}
      /* المتصفّح يمنع الصوت قبل أوّل لمسة ⇒ يبدأ مع أوّل لمسة ما دام المشهد قائماً */
      if (p && p.catch) p.catch(function () { gest = function () { try { a.play(); } catch (_) {} un(); }; ['pointerdown', 'touchstart', 'keydown'].forEach(function (t) { doc.addEventListener(t, gest, true); }); });
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
    try { rd = R.create(host, { big: true }); }
    catch (e) { ov.remove(); block(false); throw e; }          // تعذّر المشهد ⇒ لا تبقى طبقةٌ تحجب الصفحة أبداً
    var snd = engine(), fg = null;
    texts.forEach(function (e, i) { setTimeout(function () { e.classList.add('on'); }, 250 + i * 450); });
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
    var cap = setTimeout(fireCover, DRIVE_MS + FOG_IN_MS + 1800);
    setTimeout(function () {
      rd.to(1, DRIVE_MS).then(function () {
        texts.forEach(function (e) { e.classList.remove('on'); });
        try { fg = R.fog(ov); } catch (_) { fg = null; return; }   // بلا ضباب ⇒ تغطيةٌ فورية (السقف العامّ يضمنها)
        return fg.anim(0, 1, FOG_IN_MS);
      }).then(function () { clearTimeout(cap); fireCover(); });
    }, 200);
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
    go: go, cover: cover, bind: bind, preload: preload,
    arriving: function () { return !!arr; },
    hold: function (p) { if (p && p.then) holds.push(Promise.resolve(p).catch(function () {})); },
    version: VER
  };
})(window);
