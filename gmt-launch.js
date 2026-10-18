/* ═══════════════════════════════════════════════════════════════════════════
   gmt-launch.js — انطلاق الشاحنة والانتقال بين الصفحات  ·  18 ت1 2026
   ─────────────────────────────────────────────────────────────────────────
   طلبك (برومبت «مشهد انطلاق السيارة والانتقال بين صفحات HTML»):
     ظهور السيارة ⇐ تسارع الدواليب ⇐ صوت المحرّك والدخان ⇐ الانطلاق ⇐ الدخان
     يغطّي الشاشة ⇐ «أثناء التغطية يتمّ الانتقال إلى الصفحة الجديدة» ⇐ «بعد
     تحميلها بالكامل يتلاشى الدخان تدريجياً ليكشفها».

   الفيديو ملفٌّ مستقلّ (img/delivery/launch-l.mp4 أفقي · launch-p.mp4 عمودي)
   صُيِّر محلّياً من قطع شاحنتك المفرّغة ودخانِ فيديوك وصوتِه — لا خدمة خارجية.
   وهو يُعرض طبقةً كاملة فوق الصفحة. والانتقال نفسه هنا في الكود، لا في الفيديو:

     • إشارة التغطية: عند الثانية COVER_T من الفيديو (ثبّتها المُصيِّر: كلّ
       الشاشة دخانٌ عندها) يُطلق الحدث `gmt:launch-cover` وينتقل.
     • الصفحة الجديدة تبدأ مغطّاةً بآخر إطارٍ نفسه (launch-cover-*.webp) من أوّل
       رسم، فلا يظهر نصفُ صفحة، ثمّ بعد `load` يتبدّد الدخان (خريطة تبدّد:
       الأقلّ كثافةً يذهب أوّلاً) ويُطلق `gmt:launch-done`.
     • النقر ولوحة المفاتيح ممنوعان طوال الانتقال.
     • لا يعلق المستخدم أبداً: فيديو لا يبدأ خلال START_TIMEOUT ⇒ انتقالٌ مباشر ·
       فيديو يتوقّف ⇒ سقفٌ زمنيّ · صفحةٌ لا يكتمل تحميلها ⇒ تُكشَف بعد ARRIVE_CAP ·
       وحتى لو تعطّل هذا الملفّ كلّه فغطاء الوصول CSS يختفي وحده بعد ٩ث.
     • الصوت من الفيديو نفسه (متزامن)، ويخفت عند الانتقال، ويتبع مفتاح الأصوات
       في النظام (gmt_sound). إن منع المتصفّح الصوت يعمل المشهد صامتاً، ويُفتح
       الصوت عند أوّل لمسة.

   الواجهة:
     GMTLaunch.go(url)            انتقالٌ بين صفحتين
     GMTLaunch.cover(fn, opts)    في الصفحة نفسها: fn تُنفَّذ تحت الدخان ثمّ يتبدّد
     GMTLaunch.bind(root, test)   يربط روابط (a[href]) بالانتقال
     GMTLaunch.arriving()         هل وصلنا هذه الصفحة عبر انتقال؟
     GMTLaunch.hold(promise)      الصفحة الجديدة تؤخّر الكشف حتى تجهز بياناتها
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.GMTLaunch) return;

  var BASE = (function () {
    try { var s = doc.currentScript && doc.currentScript.src; if (s) return s.replace(/[?#].*$/, '').replace(/[^/]*$/, ''); } catch (_) {}
    return '';
  })();
  var DIR = BASE + 'img/delivery/';
  var VER = '20261018e';
  var COVER_T = 3.95;          // ثانية التغطية الكاملة في الفيديو
  var KEY = 'gmt_launch_arrive';
  var FRESH_MS = 15000;
  var START_TIMEOUT = 1600;
  var STALL_CAP = (COVER_T + 3.5) * 1000;
  var ARRIVE_CAP = 8000;
  var DISSOLVE_MS = 1300;

  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function variant() { return global.innerHeight > global.innerWidth * 1.05 ? 'p' : 'l'; }
  function file(kind, v) {
    var n = kind === 'video' ? 'launch-' + v + '.mp4' : kind === 'cover' ? 'launch-cover-' + v + '.webp' : 'launch-map-' + v + '.png';
    return DIR + n + '?v=' + VER;
  }
  function soundOn() {
    try { if (global.GMTSound && typeof GMTSound.isOn === 'function') return !!GMTSound.isOn(); } catch (_) {}
    try { var v = localStorage.getItem('gmt_sound'); if (v === 'off') return false; if (v === 'on') return true; } catch (_) {}
    return !reduced();
  }
  function emit(name, detail) { try { doc.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {} }
  function fileOf(u) { try { return decodeURIComponent(new URL(u, location.href).pathname.split('/').pop() || ''); } catch (_) { return ''; } }
  function canVideo() {
    try { var v = doc.createElement('video'); return !!(v.canPlayType && v.canPlayType('video/mp4; codecs="avc1.640028"')); } catch (_) { return false; }
  }

  /* ── الأنماط ───────────────────────────────────────────────────────────── */
  function css() {
    if (doc.getElementById('gmt-launch-css')) return;
    var st = doc.createElement('style'); st.id = 'gmt-launch-css';
    st.textContent =
      '#gmt-launch{position:fixed;inset:0;z-index:2147483000;background:#fff;opacity:0;transition:opacity .25s ease;pointer-events:auto;touch-action:none;overflow:hidden}' +
      '#gmt-launch.on{opacity:1}' +
      '#gmt-launch video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 6s ease-out}' +
      '#gmt-launch.wait video{transform:scale(1.05)}' +
      '#gmt-launch .gl-t{position:absolute;left:16px;right:16px;text-align:center;color:#111;font-weight:900;opacity:0;transition:opacity .6s ease;pointer-events:none}' +
      '#gmt-launch .gl-t1{top:12%;font-size:clamp(22px,4.6vw,34px)}' +
      '#gmt-launch .gl-t2{top:calc(12% + clamp(36px,7vw,52px));font-size:clamp(14px,2.8vw,18px);font-weight:700}' +
      '#gmt-launch .gl-t.on{opacity:1}' +
      '.gmt-launch-dis{position:fixed;inset:0;z-index:2147483001;width:100%;height:100%;object-fit:cover;pointer-events:auto;touch-action:none;transform-origin:50% 50%}' +
      '.gmt-launch-fade{position:fixed;inset:0;z-index:2147483001;background:#cdcdcd center/cover no-repeat;pointer-events:auto;transition:opacity .8s ease,transform .8s ease,filter .8s ease}';
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ── منع النقر ولوحة المفاتيح أثناء الانتقال ─────────────────────────── */
  var blocked = 0;
  function eat(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
  function block(on) {
    if (on) { if (blocked++ === 0) { ['keydown', 'keypress', 'keyup'].forEach(function (t) { doc.addEventListener(t, eat, true); }); } }
    else if (blocked > 0 && --blocked === 0) { ['keydown', 'keypress', 'keyup'].forEach(function (t) { doc.removeEventListener(t, eat, true); }); }
  }

  /* ── التبدّد: آخر إطارٍ من الفيديو يذوب كاشفاً الصفحة ───────────────── */
  function loadImg(u) {
    return new Promise(function (res, rej) {
      var im = new Image(); im.decoding = 'async';
      var t = setTimeout(function () { rej(new Error('timeout')); }, 2500);
      im.onload = function () { clearTimeout(t); res(im); };
      im.onerror = function () { clearTimeout(t); rej(new Error('img')); };
      im.src = u;
    });
  }
  function ease(p) { return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
  function dissolve(v, beforeFirst) {
    return Promise.all([loadImg(file('cover', v)), loadImg(file('map', v))]).then(function (ims) {
      var img = ims[0], map = ims[1];
      var W = img.naturalWidth, H = img.naturalHeight;
      var cv = doc.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'gmt-launch-dis'; cv.setAttribute('aria-hidden', 'true');
      var cx = cv.getContext('2d');
      cx.drawImage(img, 0, 0, W, H);
      var id = cx.getImageData(0, 0, W, H), px = id.data;
      var mc = doc.createElement('canvas'); mc.width = W; mc.height = H;
      var mx = mc.getContext('2d'); mx.drawImage(map, 0, 0, W, H);
      var md = mx.getImageData(0, 0, W, H).data, n = W * H, m = new Uint8Array(n);
      for (var i = 0; i < n; i++) m[i] = md[i * 4];
      doc.body.appendChild(cv);
      if (beforeFirst) beforeFirst();
      return new Promise(function (resolve) {
        var t0 = 0;
        function frame(ts) {
          if (!t0) t0 = ts;
          var p = Math.min(1, (ts - t0) / DISSOLVE_MS), q = ease(p);
          var thr = -0.18 + 1.36 * q, soft = 0.16 * 255, fade = 1 - Math.max(0, (p - .72) / .28);
          var base = thr * 255;
          for (var k = 0, j = 3; k < n; k++, j += 4) {
            var a = (m[k] - base) / soft;
            px[j] = a <= 0 ? 0 : a >= 1 ? 255 * fade : a * 255 * fade;
          }
          cx.putImageData(id, 0, 0);
          cv.style.transform = 'scale(' + (1 + .06 * q) + ')';
          if (p > .55) cv.style.pointerEvents = 'none';
          if (p < 1) requestAnimationFrame(frame);
          else { cv.remove(); resolve(); }
        }
        requestAnimationFrame(frame);
      });
    }).catch(function () {
      /* احتياط: تلاشٍ ناعم للصورة نفسها إن تعذّر الرسم البكسلي */
      var d = doc.createElement('div'); d.className = 'gmt-launch-fade'; d.style.backgroundImage = 'url("' + file('cover', v) + '")';
      doc.body.appendChild(d);
      if (beforeFirst) beforeFirst();
      return new Promise(function (resolve) {
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          d.style.opacity = '0'; d.style.transform = 'scale(1.08)'; d.style.filter = 'blur(10px)';
          setTimeout(function () { d.remove(); resolve(); }, 850);
        }); });
      });
    });
  }

  /* ── تشغيل المشهد: يَعِد بـ«متحكّم» عند بدء الفيديو، ويرفض إن لم يبدأ ── */
  var active = null;
  function scene(v, opts) {
    opts = opts || {};
    css();
    return new Promise(function (resolve, reject) {
      var ov = doc.createElement('div'); ov.id = 'gmt-launch'; ov.setAttribute('aria-hidden', 'true');
      var vid = doc.createElement('video');
      vid.setAttribute('playsinline', ''); vid.setAttribute('webkit-playsinline', ''); vid.playsInline = true;
      vid.preload = 'auto'; vid.disablePictureInPicture = true; vid.setAttribute('disableremoteplayback', '');
      var wantSound = soundOn();
      vid.muted = !wantSound; vid.defaultMuted = !wantSound;
      vid.src = file('video', v);
      ov.appendChild(vid);
      var texts = (opts.texts || []).slice(0, 2).map(function (t, i) {
        var e = doc.createElement('div'); e.className = 'gl-t gl-t' + (i + 1); e.textContent = t; ov.appendChild(e); return e;
      });
      doc.body.appendChild(ov);
      block(true);
      requestAnimationFrame(function () { ov.classList.add('on'); });
      var started = false, settled = false, coverFns = [], covered = false, endedFns = [], ended = false;
      var ctl = {
        v: v, el: ov, video: vid,
        onCover: function (f) { if (covered) f(); else coverFns.push(f); },
        onEnded: function (f) { if (ended) f(); else endedFns.push(f); },
        fadeAudio: function () {
          var k = 0; var it = setInterval(function () { k++; try { vid.volume = Math.max(0, 1 - k / 9); } catch (_) {} if (k >= 9) { clearInterval(it); try { vid.muted = true; } catch (_) {} } }, 50);
        },
        remove: function () { try { vid.pause(); } catch (_) {} ov.remove(); block(false); unG(); if (active === ctl) active = null; }
      };
      function fireCover() {
        if (covered) return; covered = true;
        texts.forEach(function (e) { e.classList.remove('on'); });
        ov.classList.add('wait');
        emit('gmt:launch-cover', { variant: v });
        coverFns.splice(0).forEach(function (f) { try { f(); } catch (_) {} });
      }
      function fireEnded() {
        if (ended) return; ended = true; fireCover();
        endedFns.splice(0).forEach(function (f) { try { f(); } catch (_) {} });
      }
      function fail(why) {
        if (settled) return; settled = true;
        clearTimeout(to);
        try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (_) {}
        ov.remove(); block(false); unG();
        reject(new Error(why));
      }
      /* الصوت عند أوّل لمسة إن منعه المتصفّح في البداية */
      function g() { if (wantSound && vid.muted && !covered) { vid.muted = false; } unG(); }
      function unG() { ['pointerdown', 'touchstart', 'keydown'].forEach(function (t) { doc.removeEventListener(t, g, true); }); }
      var to = setTimeout(function () { if (!started) fail('start-timeout'); }, opts.startTimeout || START_TIMEOUT);
      vid.addEventListener('playing', function () {
        if (started) return; started = true; settled = true; clearTimeout(to);
        active = ctl;
        texts.forEach(function (e, i) { setTimeout(function () { if (!covered) e.classList.add('on'); }, 400 + i * 500); });
        texts.forEach(function (e) { setTimeout(function () { e.classList.remove('on'); }, 2550); });
        /* إشارة التغطية: إطارٌ بإطار حيث يتوفّر، وإلّا متابعةُ الزمن، ومعهما سقفٌ للتوقّف */
        if (vid.requestVideoFrameCallback) {
          var cb = function (now, md) { if (md && md.mediaTime >= COVER_T) fireCover(); else if (!covered) vid.requestVideoFrameCallback(cb); };
          vid.requestVideoFrameCallback(cb);
        }
        (function poll() { if (covered) return; if (vid.currentTime >= COVER_T) fireCover(); else requestAnimationFrame(poll); })();
        setTimeout(fireEnded, STALL_CAP);
        resolve(ctl);
      });
      vid.addEventListener('timeupdate', function () { if (started && vid.currentTime >= COVER_T) fireCover(); });
      vid.addEventListener('ended', fireEnded);
      vid.addEventListener('error', function () { if (!started) fail('video-error'); else fireEnded(); });
      var p;
      try { p = vid.play(); } catch (e) { fail('play-throw'); return; }
      if (p && p.catch) p.catch(function () {
        if (started || settled) return;
        if (!vid.muted) {
          vid.muted = true;
          ['pointerdown', 'touchstart', 'keydown'].forEach(function (t) { doc.addEventListener(t, g, true); });
          var p2 = vid.play(); if (p2 && p2.catch) p2.catch(function () { fail('autoplay'); });
        } else fail('autoplay');
      });
    });
  }

  /* ── ① انتقالٌ بين صفحتين ──────────────────────────────────────────────── */
  var going = false;
  function go(url, opts) {
    if (going) return; going = true;
    opts = opts || {};
    var v = variant(), to = fileOf(url);
    function plain() { global.location.assign(url); }
    if (reduced() || !canVideo()) { plain(); return; }
    /* صورة الغطاء وخريطته تُجلبان الآن كي تكونا في الذاكرة حين تُرسم الصفحة الجديدة */
    loadImg(file('cover', v)).catch(function () {}); loadImg(file('map', v)).catch(function () {});
    scene(v, opts).then(function (ctl) {
      ctl.onCover(function () {
        ctl.fadeAudio();
        try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), v: v, to: to })); } catch (_) {}
        global.location.assign(url);
      });
    }, function () { plain(); });
  }

  /* ── ② في الصفحة نفسها: fn تحت الدخان ثمّ تبدّد (يُستعمل لترحيب صفحة التتبّع) ── */
  function cover(fn, opts) {
    opts = opts || {};
    if (reduced() || !canVideo()) return Promise.reject(new Error('no-video'));
    var v = variant();
    loadImg(file('cover', v)).catch(function () {}); loadImg(file('map', v)).catch(function () {});
    return scene(v, opts).then(function (ctl) {
      return new Promise(function (resolve) {
        ctl.onCover(function () {
          ctl.fadeAudio();
          Promise.resolve().then(fn).catch(function () {}).then(function () {
            var ready = Promise.all([new Promise(function (r) { ctl.onEnded(r); }), loaded(), opts.ready || null]);
            var cap = new Promise(function (r) { setTimeout(r, ARRIVE_CAP); });
            return Promise.race([ready, cap]);
          }).then(function () {
            return dissolve(ctl.v, function () { ctl.remove(); });
          }).then(function () { emit('gmt:launch-done', { same: true }); resolve(true); });
        });
      });
    });
  }

  function loaded() {
    if (doc.readyState === 'complete') return Promise.resolve();
    return new Promise(function (r) { global.addEventListener('load', function () { r(); }, { once: true }); });
  }

  /* ── ③ الوصول: الصفحة الجديدة تبدأ مغطّاة، وتنكشف بعد اكتمال تحميلها ── */
  var arr = null, holds = [];
  try {
    var raw = sessionStorage.getItem(KEY);
    if (raw) {
      sessionStorage.removeItem(KEY);
      var o = JSON.parse(raw);
      var here = fileOf(location.href);
      if (o && (Date.now() - o.at) < FRESH_MS && (o.v === 'l' || o.v === 'p') && (!o.to || o.to === here)) arr = o;
    }
  } catch (_) { arr = null; }
  if (arr) {
    var ast = doc.createElement('style'); ast.id = 'gmt-launch-arr-css';
    /* غطاءٌ من أوّل رسم — وحارسُ CSS: يختفي وحده بعد ٩ث حتى لو لم يعمل أيّ JS بعده */
    ast.textContent = 'html.gmt-arriving::after{content:"";position:fixed;inset:0;z-index:2147483000;background:#cdcdcd url("' +
      file('cover', arr.v) + '") center/cover no-repeat;pointer-events:auto;animation:gmtArrSafe .5s ease 9s forwards}' +
      '@keyframes gmtArrSafe{to{opacity:0;visibility:hidden}}';
    (doc.head || doc.documentElement).appendChild(ast);
    doc.documentElement.classList.add('gmt-arriving');
    block(true);
    var reveal = function () {
      css();
      var finish = function () {
        doc.documentElement.classList.remove('gmt-arriving');
      };
      Promise.race([
        loaded().then(function () { return Promise.all(holds); }),
        new Promise(function (r) { setTimeout(r, ARRIVE_CAP); })
      ]).then(function () {
        if (!doc.body) { finish(); block(false); return; }
        return dissolve(arr.v, finish).then(function () { finish(); block(false); emit('gmt:launch-done', { arrived: true }); });
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
    var warmed = false;
    function intent(e) {
      if (warmed) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (a && (!test || test(a))) { warmed = true; preload(true); }
    }
    (root || doc).addEventListener('pointerover', intent, { passive: true });
    (root || doc).addEventListener('touchstart', intent, { passive: true });
    (root || doc).addEventListener('focusin', intent);
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

  /* تسخين الملفّات (اتصالٌ جيّد فقط) كي يبدأ المشهد فور النقر — bind يسخّنها عند أوّل اقترابٍ من الرابط */
  var preloaded = false;
  function preload(now) {
    if (preloaded) return;
    try {
      var c = navigator.connection; if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
      preloaded = true;
      var v = variant();
      var go2 = function () { try { fetch(file('video', v), { credentials: 'same-origin' }).catch(function () {}); } catch (_) {} loadImg(file('cover', v)).catch(function () {}); loadImg(file('map', v)).catch(function () {}); };
      if (now) go2(); else if (global.requestIdleCallback) requestIdleCallback(go2, { timeout: 4000 }); else setTimeout(go2, 2500);
    } catch (_) {}
  }

  global.GMTLaunch = {
    go: go, cover: cover, bind: bind, preload: preload,
    arriving: function () { return !!arr; },
    hold: function (p) { if (p && p.then) holds.push(Promise.resolve(p).catch(function () {})); },
    COVER_T: COVER_T, version: VER
  };
})(window);
