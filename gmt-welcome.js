/* ═══════════════════════════════════════════════════════════════════════════
   gmt-welcome.js — انترو افتتاح النظام (الشاحنة الهادئة)  ·  18 ت1 2026
   ─────────────────────────────────────────────────────────────────────────
   طلبك (برومبت «تطوير انترو افتتاح النظام»):
     • يظهر عند فتح النظام أو بدء الجلسة — مرّةً واحدة لكل جلسة، لا عند كل تنقّل.
     • فيديو الشاحنة ملفٌّ مستقلّ طبقةً فوق الصفحة (img/delivery/intro-loop.mp4):
       سيرٌ هادئ في مكانه بحلقةٍ بلا قطع، ودخانٌ خفيفٌ جدّاً — لا دخان يملأ الشاشة.
     • الصوت ملفٌّ مستقلّ (intro-sound.mp3): محرّكٌ منخفض من صوت شاحنتك + «بيب
       بيب» واحدة قصيرة، يُشغَّل مرّةً في الجلسة فقط، ويتبع مفتاح الأصوات في
       النظام (gmt_sound). إن منعه المتصفّح يعمل الانترو صامتاً بلا أخطاء.
     • «أهلاً بك، [الاسم]» — الاسم من الجلسة الحقيقية فقط؛ لا اسم ⇒ «أهلاً بك».
     • شريط التحميل مربوطٌ بمراحل حقيقية تمرّرها الصفحة (التحقق من الجلسة ·
       الصلاحيات · بيانات الرئيسية · تجهيز الواجهة). لا يصل ١٠٠٪ إلا حين تنتهي
       كلّها فعلاً، ولا يتحرّك من تلقاء نفسه. فشلُ مرحلة ⇒ رسالةٌ واضحة مع
       «إعادة المحاولة» و«متابعة» — لا يبقى المستخدم عالقاً.
     • حين يجهز النظام يختفي تدريجياً دون انتظار نهاية الفيديو (مع حدٍّ أدنى
       قصير كي لا يومض)، ولا يُكشف النظام قبل أن يجهز.

   الواجهة:
     GMTWelcome.pending()        هل يُعرض في هذه الجلسة؟
     GMTWelcome.run({ name, steps:[{label, run, weight}] }) ⇒ Promise (عند الإغلاق)
     GMTWelcome.skip()           يُسجَّل «رُئي» دون عرض (حين يعمل الانترو الطويل)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.GMTWelcome) return;

  var BASE = (function () {
    try { var s = doc.currentScript && doc.currentScript.src; if (s) return s.replace(/[?#].*$/, '').replace(/[^/]*$/, ''); } catch (_) {}
    return '';
  })();
  var DIR = BASE + 'img/delivery/';
  var VER = '20261018e';
  var SS = 'gmt_welcome_shown';
  var MIN_MS = 1700;          // أقلّ مدّة عرض (قراءة الترحيب) — لا ننتظر نهاية الفيديو
  var SLOW_MS = 20000;        // بعده: «يستغرق أطول من المعتاد» + متابعة
  var STEP_CAP = 30000;       // مرحلةٌ معلّقة أكثر من هذا تُعدّ فاشلة

  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function soundOn() {
    try { if (global.GMTSound && typeof GMTSound.isOn === 'function') return !!GMTSound.isOn(); } catch (_) {}
    try { var v = localStorage.getItem('gmt_sound'); if (v === 'off') return false; if (v === 'on') return true; } catch (_) {}
    return !reduced();
  }
  function seen() { try { return sessionStorage.getItem(SS) === '1'; } catch (_) { return true; } }
  function markSeen() { try { sessionStorage.setItem(SS, '1'); } catch (_) {} }
  function unhide() { try { doc.documentElement.classList.remove('gw-pre'); } catch (_) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function css() {
    if (doc.getElementById('gmt-welcome-css')) return;
    var st = doc.createElement('style'); st.id = 'gmt-welcome-css';
    st.textContent =
      '#gmt-welcome{position:fixed;inset:0;z-index:2147482000;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'padding:24px 16px;box-sizing:border-box;text-align:center;opacity:0;transition:opacity .35s ease;direction:rtl;color:#111;font-family:inherit}' +
      '#gmt-welcome.on{opacity:1}#gmt-welcome.out{opacity:0;transition:opacity .5s ease}' +
      '#gmt-welcome .gw-van{width:min(560px,92vw);aspect-ratio:900/380;position:relative}' +
      '#gmt-welcome .gw-van video,#gmt-welcome .gw-van img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff}' +
      '#gmt-welcome h2{margin:18px 0 6px;font-size:clamp(22px,5vw,30px);font-weight:900;line-height:1.3;overflow-wrap:anywhere}' +
      '#gmt-welcome .gw-sub{margin:0;font-size:15px;font-weight:700;color:#3d4450}' +
      '#gmt-welcome .gw-bar{width:min(420px,84vw);height:8px;border-radius:99px;background:#eceef2;margin:18px auto 8px;overflow:hidden;position:relative}' +
      '#gmt-welcome .gw-bar i{position:absolute;inset:0 auto 0 0;width:0;border-radius:inherit;background:linear-gradient(90deg,#D5001C,#ff3b4e);transition:width .35s ease}' +
      '#gmt-welcome .gw-bar i::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:gwSh 1.2s linear infinite;background-size:50% 100%;background-repeat:no-repeat}' +
      '#gmt-welcome .gw-bar.ind i{width:35%!important;animation:gwInd 1.3s ease-in-out infinite}' +
      '#gmt-welcome .gw-step{min-height:18px;font-size:12.5px;font-weight:700;color:#5b6472}' +
      '#gmt-welcome .gw-err{display:none;margin-top:12px;max-width:440px}' +
      '#gmt-welcome.err .gw-err{display:block}#gmt-welcome.err .gw-bar i{background:#b45309}' +
      '#gmt-welcome .gw-err p{margin:0 0 10px;font-size:14px;font-weight:700;color:#991b1b}' +
      '#gmt-welcome .gw-err button{font:inherit;font-weight:800;font-size:14px;border-radius:12px;padding:10px 16px;margin:4px;border:1px solid #d6d9e0;background:#fff;color:#111;cursor:pointer}' +
      '#gmt-welcome .gw-err button.p{background:#111;color:#fff;border-color:#111}' +
      '@keyframes gwSh{from{background-position:-50% 0}to{background-position:150% 0}}' +
      '@keyframes gwInd{0%{left:-35%}100%{left:100%}}' +
      '@media (prefers-reduced-motion: reduce){#gmt-welcome .gw-bar i::after{animation:none}}';
    (doc.head || doc.documentElement).appendChild(st);
  }

  var running = null, horned = false;

  function run(opts) {
    opts = opts || {};
    if (running) return running;
    markSeen();
    css();
    var steps = (opts.steps || []).filter(function (s) { return s && typeof s.run === 'function'; });
    var name = String(opts.name || '').trim();
    var host = doc.createElement('div'); host.id = 'gmt-welcome'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite');
    var useVideo = !reduced();
    host.innerHTML =
      '<div class="gw-van">' +
        (useVideo
          ? '<video muted playsinline webkit-playsinline loop autoplay preload="auto" disablepictureinpicture poster="' + DIR + 'intro-poster.webp?v=' + VER + '" aria-hidden="true"></video>'
          : '<img src="' + DIR + 'intro-poster.webp?v=' + VER + '" alt="" aria-hidden="true">') +
      '</div>' +
      '<h2>' + (name ? 'أهلاً بك، ' + esc(name) : 'أهلاً بك') + '</h2>' +
      '<p class="gw-sub">جارٍ تجهيز النظام، يرجى الانتظار...</p>' +
      '<div class="gw-bar' + (steps.length ? '' : ' ind') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100"' + (steps.length ? ' aria-valuenow="0"' : '') + '><i></i></div>' +
      '<div class="gw-step"></div>' +
      '<div class="gw-err"><p></p><button type="button" class="p" data-gw="retry">إعادة المحاولة</button><button type="button" data-gw="go">متابعة إلى النظام</button></div>';
    (doc.body || doc.documentElement).appendChild(host);
    unhide();
    var vid = host.querySelector('video');
    if (vid) {
      vid.muted = true; vid.defaultMuted = true;
      vid.src = DIR + 'intro-loop.mp4?v=' + VER;
      try { var pp = vid.play(); if (pp && pp.catch) pp.catch(function () {}); } catch (_) {}
      vid.addEventListener('error', function () { vid.removeAttribute('src'); }, { once: true });
    }
    requestAnimationFrame(function () { host.classList.add('on'); });

    /* صوت الافتتاح: مرّةً واحدة في الجلسة (والوحدة لا تُشغّله مرّتين حتى لو أُعيد رسم الصفحة) */
    var audio = null;
    if (!horned && soundOn()) {
      horned = true;
      try {
        audio = new Audio(DIR + 'intro-sound.mp3?v=' + VER);
        audio.volume = 0.9;
        var ap = audio.play(); if (ap && ap.catch) ap.catch(function () { audio = null; });
      } catch (_) { audio = null; }
    }

    var bar = host.querySelector('.gw-bar'), fill = bar.querySelector('i'), stepEl = host.querySelector('.gw-step');
    var errBox = host.querySelector('.gw-err'), errP = errBox.querySelector('p');
    var total = steps.reduce(function (a, s) { return a + (s.weight || 1); }, 0) || 1;
    var done = 0, t0 = Date.now(), closed = false, slowT = null;
    var state = steps.map(function () { return 'wait'; });
    var prom = steps.map(function () { return null; });

    function paint() {
      var pct = Math.round(done / total * 100);
      if (steps.length) { fill.style.width = pct + '%'; bar.setAttribute('aria-valuenow', String(pct)); }
      var cur = -1; for (var i = 0; i < steps.length; i++) if (state[i] === 'run') { cur = i; break; }
      stepEl.textContent = cur >= 0 ? steps[cur].label + '…' : '';
    }

    return (running = new Promise(function (resolve) {
      function close() {
        if (closed) return; closed = true;
        clearTimeout(slowT);
        host.classList.add('out');
        if (audio) {
          var a = audio, k = 0;
          var it = setInterval(function () { k++; try { a.volume = Math.max(0, .9 * (1 - k / 8)); } catch (_) {} if (k >= 8) { clearInterval(it); try { a.pause(); } catch (_) {} } }, 60);
        }
        setTimeout(function () { try { if (vid) vid.pause(); } catch (_) {} host.remove(); running = null; resolve(true); }, 520);
      }
      function fail(i, e) {
        host.classList.add('err');
        errP.textContent = 'تعذّر: ' + steps[i].label + (e && e.message ? ' — ' + e.message : '') + '. يمكنك إعادة المحاولة أو المتابعة إلى النظام.';
        stepEl.textContent = '';
      }
      function slow() {
        if (closed || host.classList.contains('err')) return;
        host.classList.add('err');
        errP.textContent = 'التجهيز يستغرق وقتاً أطول من المعتاد (الاتصال بطيء؟). يمكنك المتابعة الآن وسيكمل التحميل في الخلفية.';
      }
      function runStep(i) {
        state[i] = 'run'; paint();
        var p;
        try { p = Promise.resolve(steps[i].run()); } catch (e) { p = Promise.reject(e); }
        var cap = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('لم يستجب')); }, STEP_CAP); });
        return Promise.race([p, cap]).then(function () {
          state[i] = 'ok'; done += (steps[i].weight || 1); paint();
        }, function (e) { state[i] = 'fail'; paint(); fail(i, e); throw e; });
      }
      function all() {
        host.classList.remove('err');
        clearTimeout(slowT); slowT = setTimeout(slow, SLOW_MS);
        /* المراحل تعمل معاً (كما تعمل الصفحة فعلاً)، والشريط يتقدّم بما ينتهي منها.
           إعادة المحاولة تُعيد الفاشلة وحدها، وتنتظر الجارية دون تكرارها. */
        for (var i = 0; i < steps.length; i++) if (state[i] === 'wait' || state[i] === 'fail') prom[i] = runStep(i);
        return Promise.all(prom).then(function () {
          clearTimeout(slowT);
          var wait = Math.max(0, MIN_MS - (Date.now() - t0));
          setTimeout(close, wait);
        }, function () { clearTimeout(slowT); });
      }
      host.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-gw]') : null; if (!b) return;
        if (b.getAttribute('data-gw') === 'retry') all(); else close();
      });
      paint();
      all();
    }));
  }

  global.GMTWelcome = {
    pending: function () { return !seen(); },
    run: run,
    skip: function () { markSeen(); unhide(); },
    running: function () { return !!running; },
    version: VER
  };
})(window);
