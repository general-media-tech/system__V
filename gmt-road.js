/* ═══════════════════════════════════════════════════════════════════════════
   gmt-road.js — الشاحنة على الطريق من A إلى B + الضباب · 19 ت1 · TASK-0106/0107
   ───────────────────────────────────────────────────────────────────────────
   خطّة العمل §١ و§٢ (طلبك 19 ت1، ثمّ «أكمل كل ما يتعلّق بالتتبّع»):
     · «نفس الشاحنة نفسها تماماً، فقط حجمها أصغر، تنتقل من A إلى B» — نحو ربع
       عرض الشاشة على الكمبيوتر وثلثها على الهاتف، على طريقٍ رفيع بعرض الشاشة،
       والجزء المقطوع خلفها يمتلئ كشريط تقدّم. اهتزازٌ خفيف ودخانٌ خفيف من العادم.
     · ثمّ «ضبابٌ متجانس بطبقاتٍ ناعمة» يملأ الشاشة (~١ث) — لا كتلٌ تجتاح عشوائياً —
       وتحته تُفتح الصفحة، ثمّ يرقّ ببطء (~١٫٢ث).
   جزءٌ من الصفحة (HTML + Canvas) لا فيديو. القطع المفرّغة نفسها: img/delivery/van-*.webp

   (TASK-0228 · المالك seq 158 · 557) «الانترو الأوّل ما في له مسار نقطة A وB · في له شارع · وبالطالع دخّان كثير وتنطلق أسرع»
     ⇐ وضع street: شارعُ إسفلت بخطٍّ متقطّع (لا نقطتا A/B ولا شريط تقدّم) · الشاحنة تدخل وتقف لحظةً تعمل ثمّ تنطلق
       بتسارعٍ قويّ ويخرج منها دخانٌ كثيف يكبر ويملأ الشاشة (heavy) · المسار A⇐B يبقى لشاحنة البحث داخل الصفحة.

   GMTRoad.create(host, {big, street})  ⇐ {el, to(p, ms, ease) → Promise, creep(p), heavy(on), stop(), destroy()}
   GMTRoad.fog(host)            ⇐ {el, set(d 0..1), anim(from, to, ms) → Promise, destroy()}
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.GMTRoad) return;

  var BASE = (function () {
    try { var s = doc.currentScript && doc.currentScript.src; if (s) return s.replace(/[?#].*$/, '').replace(/[^/]*$/, ''); } catch (_) {}
    return '';
  })();
  var DIR = BASE + 'img/delivery/';

  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function css() {
    if (doc.getElementById('gmt-road-css')) return;
    var st = doc.createElement('style'); st.id = 'gmt-road-css';
    st.textContent =
      '.gr{position:relative;width:100%;height:var(--gr-h,120px);direction:ltr;user-select:none;-webkit-user-select:none}' +
      '.gr-shake{position:absolute;inset:0}' +
      '.gr.moving .gr-shake{animation:grShake .16s linear infinite alternate}' +
      '@keyframes grShake{from{transform:translateY(0)}to{transform:translateY(.6px)}}' +
      '.gr-track{position:absolute;left:var(--gr-pad);right:var(--gr-pad);bottom:16px;height:4px;border-radius:4px;background:#e5e7eb;overflow:hidden}' +
      '.gr-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#f87171,#D5001C);border-radius:4px}' +
      '.gr-dot{position:absolute;bottom:4px;width:22px;height:22px;margin-left:-11px;border-radius:50%;display:grid;place-items:center;font:900 11px/1 system-ui,sans-serif;color:#fff;background:#9ca3af;box-shadow:0 0 0 3px #fff}' +
      '.gr-dot.a{left:var(--gr-pad);background:#111827}.gr-dot.b{right:var(--gr-pad);margin-left:0;margin-right:-11px}.gr.done .gr-dot.b{background:#D5001C}' +
      '.gr-van{position:absolute;left:0;bottom:22px;width:var(--gr-van);aspect-ratio:890/360;will-change:transform}' +
      '@supports not (aspect-ratio:1/1){.gr-van{height:calc(var(--gr-van) * .4045)}}' +
      '.gr-van img{position:absolute;display:block;pointer-events:none;-webkit-user-drag:none}' +
      '.gr-van .b{inset:0;width:100%;height:100%}' +
      '.gr-van .w{transform-origin:50% 50%}.gr.moving .gr-van .w{animation:grSpin .42s linear infinite}' +
      '.gr-van .wr{left:8.652%;top:63.889%;width:13.933%}.gr-van .wf{left:71.236%;top:64.167%;width:14.494%}' +
      '@keyframes grSpin{to{transform:rotate(360deg)}}' +
      '.gr-puffs{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}' +
      '.gr-fog{position:fixed;inset:0;width:100%;height:100%;pointer-events:auto;touch-action:none}' +
      /* الشارع (TASK-0228): إسفلت · رصيفٌ فاتح · خطٌّ أبيض متقطّع في الوسط */
      '.gr-asph{position:absolute;left:0;right:0;bottom:0;height:var(--gr-asph,54px);background:linear-gradient(#45484e,#2e3035);border-top:4px solid #c9ccd1;box-shadow:0 -6px 0 #e5e7eb}' +
      '.gr-lane{position:absolute;left:0;right:0;top:50%;height:4px;margin-top:-2px;background:repeating-linear-gradient(90deg,#f8f8f8 0 34px,transparent 34px 70px);opacity:.9}' +
      '.gr-street .gr-van{bottom:calc(var(--gr-asph,54px) * .42)}' +
      '.gr-puffs.fs{position:fixed;inset:0;z-index:2}' +
      '@media (prefers-reduced-motion:reduce){.gr.moving .gr-shake,.gr.moving .gr-van .w{animation:none}}';
    (doc.head || doc.documentElement).appendChild(st);
  }
  function easeIO(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }   // تسارعٌ ناعم ثمّ تبطئ عند B
  var EASE = { io: easeIO, out: function (p) { return 1 - Math.pow(1 - p, 3); }, in: function (p) { return p * p; } };   // انطلاقٌ قويّ: تسارعٌ من أوّل لحظة

  /* ── الطريق والشاحنة ───────────────────────────────────────────────────── */
  function create(host, opts) {
    opts = opts || {};
    css();
    var portrait = global.innerHeight > global.innerWidth * 1.05;
    var street = !!opts.street;
    var el = doc.createElement('div'); el.className = 'gr' + (street ? ' gr-street' : ''); el.setAttribute('aria-hidden', 'true');
    /* الحجم: ثلث العرض على الهاتف وربعه على الكمبيوتر (في الانتقال) · وفي بطاقة التحقّق أصغر قليلاً */
    var vanW = opts.big ? (portrait ? 'min(34vw,240px)' : 'min(25vw,340px)') : 'min(32%,150px)';
    el.style.setProperty('--gr-van', vanW);
    el.style.setProperty('--gr-pad', opts.big ? '6%' : '14px');
    el.style.setProperty('--gr-h', opts.big ? 'calc(' + vanW + ' * .4045 + 44px)' : 'calc(min(32vw,150px) * .4045 + 44px)');
    if (street) el.style.setProperty('--gr-h', 'calc(' + vanW + ' * .4045 + 54px * .42 + 14px)');
    el.innerHTML = '<div class="gr-shake">' +
      (street ? '<div class="gr-asph"><i class="gr-lane"></i></div>'
              : '<div class="gr-track"><i class="gr-fill"></i></div><span class="gr-dot a">A</span><span class="gr-dot b">B</span>') +
      '<div class="gr-van"><img class="b" src="' + DIR + 'van-body.webp" alt="" decoding="async" onerror="this.src=\'' + DIR + 'van-body.png\';this.onerror=null">' +
      '<img class="w wr" src="' + DIR + 'van-wheel-r.webp" alt="" onerror="this.remove()"><img class="w wf" src="' + DIR + 'van-wheel-f.webp" alt="" onerror="this.remove()"></div></div>' +
      /* الدخان فوق الشاحنة · في الشارع لوحةٌ بملء الشاشة ليكبر الدخان خارج حدود الطريق */
      '<canvas class="gr-puffs' + (street ? ' fs' : '') + '"></canvas>';
    host.appendChild(el);
    var van = el.querySelector('.gr-van'), fill = el.querySelector('.gr-fill'), track = el.querySelector('.gr-track');
    var cv = el.querySelector('.gr-puffs'), cx = cv.getContext && cv.getContext('2d');
    var p = 0, raf = 0, dead = false, puffs = [], lastPuff = 0, moving = false, rm = reduced(), thick = false, off = false, lastX = null, lastTs = 0, seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

    function geo() {
      var W = el.clientWidth, vw = van.offsetWidth;
      /* الشارع: من خارج الشاشة يساراً إلى ما بعد حافّتها اليمنى · المسار: من A إلى B */
      if (street) return { W: W, vw: vw, x0: -vw * 1.05, x1: W + vw * .25 };
      var tl = track.offsetLeft, tw = track.offsetWidth;
      return { W: W, vw: vw, x0: tl - vw * .15, x1: tl + tw - vw * .85, tl: tl, tw: tw };
    }
    function paint() {
      var g = geo(), x = g.x0 + (g.x1 - g.x0) * p;
      van.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
      /* المقطوع = حتى مؤخّرة الشاحنة */
      if (fill) fill.style.width = Math.max(0, Math.min(100, (x + g.vw * .1 - g.tl) / g.tw * 100)).toFixed(2) + '%';
      return { x: x, g: g };
    }
    function smoke(ts, pos) {
      if (!cx || rm) return;
      var dpr = Math.min(2, global.devicePixelRatio || 1);
      var W = street ? global.innerWidth : el.clientWidth, H = street ? global.innerHeight : el.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
      var vh = van.offsetHeight, vw = pos.g.vw;
      /* العادم: مؤخّرة الشاحنة يساراً قرب الأرض — بإحداثيّات اللوحة */
      var ex, ey;
      if (street) { var rc = van.getBoundingClientRect(); ex = rc.left + vw * .03; ey = rc.bottom - vh * .22; }
      else { ex = pos.x + vw * .02; ey = H - 22 - vh * .2; }
      var v = (lastX == null || !lastTs) ? 0 : Math.abs(pos.x - lastX) / Math.max(1, ts - lastTs);   // بكسل/مللي ثانية
      lastX = pos.x; lastTs = ts;
      /* الدخان: خفيفٌ وهي تمشي أو تقف تعمل · كثيفٌ جداً عند الانطلاق (heavy) يكبر حتى يملأ الشاشة */
      var every = thick ? 22 : (moving ? 90 : 170);
      if ((moving || thick || (street && !off)) && ts - lastPuff > every) {   // off: واقفةٌ مطفأة (لا عادم)
        lastPuff = ts;
        var n = thick ? 4 : 1;
        for (var i = 0; i < n; i++) {
          puffs.push({ x: ex - rnd() * vw * .14, y: ey + (rnd() - .5) * vh * .4, r: vh * (thick ? .2 + rnd() * .22 : .1), t: ts,
            life: thick ? 2000 + rnd() * 900 : 1100, grow: thick ? 8 + rnd() * 11 : 2.4, a: thick ? .55 + rnd() * .2 : (moving ? .32 : .2),
            dx: -(thick ? 80 + rnd() * 160 + v * 160 : 18), dy: thick ? (rnd() - .65) * 260 : -10, dark: thick });
        }
      }
      puffs = puffs.filter(function (f) { return ts - f.t < f.life; });
      puffs.forEach(function (f) {
        var k = (ts - f.t) / f.life, r = f.r * (1 + f.grow * k), a = f.a * (1 - k * k);
        var x = f.x + f.dx * k, y = f.y + f.dy * k;
        var gr = cx.createRadialGradient(x, y, 0, x, y, r);
        /* الكثيف: رماديٌّ داكن في القلب يفتح نحو لون الضباب (فيتّصل بالضباب الذي يملأ الشاشة بعده) */
        var c0 = f.dark ? '128,130,135' : '160,162,166', c1 = f.dark ? '196,198,203' : '190,192,196';
        /* تدرّجٌ ناعم بلا حافّة (أربع محطّات) ⇒ سحابةٌ متّصلة لا حلقاتٌ متراكبة */
        gr.addColorStop(0, 'rgba(' + c0 + ',' + a.toFixed(3) + ')'); gr.addColorStop(.35, 'rgba(' + c1 + ',' + (a * .7).toFixed(3) + ')');
        gr.addColorStop(.7, 'rgba(225,227,231,' + (a * .25).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(236,238,241,0)');
        cx.fillStyle = gr; cx.beginPath(); cx.arc(x, y, r, 0, 6.283); cx.fill();
      });
    }
    function loop(ts) { if (dead) return; var pos = paint(); smoke(ts || 0, pos); raf = requestAnimationFrame(loop); }
    paint(); raf = requestAnimationFrame(loop);
    function onResize() { if (!dead) paint(); }
    global.addEventListener('resize', onResize);
    var anim = null;
    function setMoving(on) { moving = on; el.classList.toggle('moving', on); }

    return {
      el: el,
      get p() { return p; },
      /* يقود الشاحنة إلى p خلال ms بتسارعٍ ثمّ تبطئ — ويَعِد بالوصول (وله سقفٌ زمنيّ لو تجمّد الرسم في الخلفية) */
      to: function (target, ms, ease) {
        if (anim) anim.cancel();
        var from = p, t0 = 0, done = false, ez = EASE[ease] || easeIO; target = Math.max(0, Math.min(1, target)); ms = rm ? 1 : (ms || 1200);
        setMoving(true);
        return new Promise(function (res) {
          function fin() { if (done) return; done = true; p = target; paint(); if (!thick) setMoving(false); if (target >= 1) el.classList.add('done'); anim = null; res(); }
          var cap = setTimeout(fin, ms + 600);
          anim = { cancel: function () { clearTimeout(cap); done = true; setMoving(false); res(); } };
          (function step(ts) {
            if (done) return;
            if (!t0) t0 = ts;
            var k = Math.min(1, (ts - t0) / ms); p = from + (target - from) * ez(k);
            if (k >= 1) { clearTimeout(cap); fin(); } else requestAnimationFrame(step);
          })(0);
        });
      },
      /* تقدّمٌ بطيءٌ لا يكتمل وحده (ما دام التحميل جارياً) — يقترب من p دون أن يبلغه */
      creep: function (cap, rate) {
        if (anim) anim.cancel();
        cap = Math.min(.92, cap || .85); setMoving(true);
        var stop = false, k = rate || .012;
        anim = { cancel: function () { stop = true; setMoving(false); } };
        (function step() { if (stop || dead) return; p += (cap - p) * k; requestAnimationFrame(step); })();
      },
      /* دخان الانطلاق الكثيف (يبقى حتى يُطفأ أو يُزال المشهد) */
      heavy: function (on) { thick = !!on; if (on) setMoving(true); },
      /* (seq 559) واقفةٌ مطفأة بانتظار لمسة الزبون — لا عادم */
      quiet: function (on) { off = !!on; },
      stop: function () { if (anim) anim.cancel(); setMoving(false); },
      destroy: function () { dead = true; if (anim) anim.cancel(); cancelAnimationFrame(raf); global.removeEventListener('resize', onResize); el.remove(); }
    };
  }

  /* ── الضباب: طبقاتٌ ناعمة متجانسة (لا كتل) — كثافةٌ d من ٠ إلى ١، و١ = تغطيةٌ كاملة ── */
  function fog(host) {
    css();
    var cv = doc.createElement('canvas'); cv.className = 'gr-fog'; cv.setAttribute('aria-hidden', 'true');
    (host || doc.body).appendChild(cv);
    var cx = cv.getContext && cv.getContext('2d'), d = 0, blobs = [], seed = 7, W = 0, H = 0, t0 = performance.now();
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function size() {
      var dpr = Math.min(1.5, global.devicePixelRatio || 1);
      W = global.innerWidth; H = global.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      if (cx) cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* شبكةٌ منتظمة مع إزاحةٍ صغيرة ⇒ تغطيةٌ متجانسة (الكتل العشوائية كانت تترك ثقوباً ثمّ تجتاح) */
      blobs = []; seed = 7;
      var n = 5, m = 4, R = Math.max(W, H) * .42;
      for (var i = 0; i <= n; i++) for (var j = 0; j <= m; j++)
        blobs.push({ x: (i / n) * W + (rnd() - .5) * W * .12, y: (j / m) * H + (rnd() - .5) * H * .12, r: R * (.8 + rnd() * .4), ph: rnd() * 6.283, sp: .25 + rnd() * .35 });
    }
    function draw() {
      if (!cx) { cv.style.background = 'rgba(236,238,241,' + d + ')'; return; }
      var t = (performance.now() - t0) / 1000;
      cx.clearRect(0, 0, W, H);
      /* قاعدةٌ ناعمة تضمن أنّ d=1 تغطيةٌ كاملة بلا ثقب */
      cx.fillStyle = 'rgba(236,238,241,' + Math.max(0, (d - .35) / .65).toFixed(3) + ')';
      cx.fillRect(0, 0, W, H);
      blobs.forEach(function (b) {
        var x = b.x + Math.sin(t * b.sp + b.ph) * 26, y = b.y + Math.cos(t * b.sp * .8 + b.ph) * 18;
        var g = cx.createRadialGradient(x, y, 0, x, y, b.r);
        var a = Math.min(1, d * 1.15);
        g.addColorStop(0, 'rgba(244,245,247,' + (.9 * a).toFixed(3) + ')');
        g.addColorStop(.55, 'rgba(232,234,238,' + (.55 * a).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(232,234,238,0)');
        cx.fillStyle = g; cx.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2);
      });
    }
    size(); draw();
    function onResize() { size(); draw(); }
    global.addEventListener('resize', onResize);
    var live = true;
    (function tick() { if (!live) return; draw(); requestAnimationFrame(tick); })();
    return {
      el: cv,
      set: function (v) { d = Math.max(0, Math.min(1, v)); cv.style.pointerEvents = d > .5 ? 'auto' : 'none'; },
      /* من كثافةٍ إلى أخرى خلال ms — بسقفٍ زمنيّ (الرسم قد يتجمّد في تبويبٍ خلفيّ) */
      anim: function (from, to, ms) {
        var self = this, t1 = 0, done = false;
        return new Promise(function (res) {
          function fin() { if (done) return; done = true; self.set(to); res(); }
          var cap = setTimeout(fin, ms + 500);
          (function step(ts) {
            if (done) return;
            if (!t1) t1 = ts;
            var k = Math.min(1, (ts - t1) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            self.set(from + (to - from) * e);
            if (k >= 1) { clearTimeout(cap); fin(); } else requestAnimationFrame(step);
          })(0);
        });
      },
      destroy: function () { live = false; global.removeEventListener('resize', onResize); cv.remove(); }
    };
  }

  global.GMTRoad = { create: create, fog: fog, reduced: reduced, dir: DIR };
})(window);
