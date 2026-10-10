/* ═══════════════════════════════════════════════════════════════════════════
   gmt-sound.js — الهويّة الصوتيّة لـGMT
   أُنشئ: 2026-10-04

   ══ طلبُك ══
   «بدنا نضيف أصوات مع الانتروهات لنظامنا… عند التتبّع لما بتطلع الشاحنة عم
    تمشي على الطريق · عند فتح المتجر لما بتنبثق الكلمة أو شعار الشركة · عند
    فتح التطبيق للمستخدمين والموظّفين، صوت مثل صوت أمازون برايم أو فتح يوتيوب،
    صوت فقاعة مع انبثاق اللوجو · صوت عند فتح الكفالة · صوت عدّادات عند فتح
    الموقع وبوّابة التوظيف مع الأرقام اللي بتتحرّك · عند إنشاء فاتورة صوت
    أموال · صوت انتقال… ابحث عن أصوات فخمة ومتلائمة».

   ══ قراران أُعلنهما بوضوح ══

   ① **لم أنسخ صوتَ أمازون ولا يوتيوب.** تلك علاماتٌ صوتيّةٌ مسجّلةٌ مملوكةٌ
      لأصحابها، ووضعُها في نظامٍ تجاريٍّ باسمك يُعرّضك أنت لا أنا. فهمتُ
      المقصود — «افتتاحيّةٌ قصيرةٌ فخمةٌ تُعرَف بها العلامة» — وبنيتُ لك
      **علامتَك الصوتيّة أنت**: ثلاثُ نغماتٍ في سلّم «لا الكبير»، تصعد
      وتتفتّح، مدّتُها ١٫٦ ثانية. تُسمَع مرّةً فتُعرَف.

   ② **لا ملفَّ صوتٍ واحداً في المشروع.** كلُّ صوتٍ هنا **يُركَّب لحظةَ
      تشغيله** بـWeb Audio: موجاتٌ ومرشّحاتٌ وأظرفُ زمنيّة. ولماذا:
        • صفرُ بايت — ولا تحميلَ يبطّئ الصفحة (وعندك ٤٦ صفحة).
        • يعمل **بلا إنترنت** — ونظامُك يعمل بلا إنترنت أصلاً.
        • لا رخصةَ ولا نسبةَ لأحد: النغماتُ أرقامٌ كتبتُها.
        • تُعدَّل من سطرٍ واحد: لو أردتَ العلامةَ أعمقَ أو أسرع.

   ══ قواعدُ السلامة ══
   • المتصفّحُ يمنع الصوتَ قبل أوّل لمسةٍ من المستخدم. فلا نُشغّل شيئاً قبلها،
     ولا نطبع خطأً: نُسجّل النيّةَ ونُشغّلها عند أوّل تفاعل.
   • مفتاحُ كتمٍ واحدٌ للنظام كلّه، محفوظٌ في الجهاز.
   • من ضبط جهازَه على «تقليل الحركة» غالباً يريد هدوءاً: نبدأ عنده مكتوماً.
   • كلُّ شيءٍ داخل try — فلا صوتٌ يكسر صفحةً أبداً.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTSound) return;

  var LS = 'gmt_sound';          // 'on' | 'off'
  var ctx = null, master = null, unlocked = false, pending = null;

  function prefersQuiet() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
  }
  function isOn() {
    try {
      var v = localStorage.getItem(LS);
      if (v === 'on')  return true;
      if (v === 'off') return false;
    } catch (_) {}
    return !prefersQuiet();      // الافتراضُ: يعمل، إلّا لمن طلب الهدوء
  }
  function setOn(on) {
    try { localStorage.setItem(LS, on ? 'on' : 'off'); } catch (_) {}
    paintToggle();
    if (on) { ensure(); play('pop'); }
  }

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.26;        // هادئٌ بقصد — نظامُ عملٍ لا لعبة
      master.connect(ctx.destination);
    } catch (_) { ctx = null; }
    return ctx;
  }

  /* ── لبناتٌ صغيرة ──────────────────────────────────────────────────── */
  function tone(opt) {
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (opt.at || 0);
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(opt.f, t0);
    if (opt.f2) o.frequency.exponentialRampToValueAtTime(opt.f2, t0 + (opt.dur || .3));
    var peak = (opt.gain == null ? .5 : opt.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (opt.attack || .012));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opt.dur || .3));
    var node = g;
    if (opt.lp) {
      var f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(opt.lp, t0);
      g.connect(f); node = f;
    }
    o.connect(g); node.connect(master);
    o.start(t0); o.stop(t0 + (opt.dur || .3) + .05);
  }

  function noise(opt) {
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (opt.at || 0);
    var dur = opt.dur || .25;
    var buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter();
    f.type = opt.band ? 'bandpass' : 'lowpass';
    f.frequency.setValueAtTime(opt.from || 900, t0);
    if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur);
    f.Q.value = opt.q || 1;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opt.gain == null ? .25 : opt.gain, t0 + (opt.attack || .03));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + .02);
  }

  /* ── الهويّة الصوتيّة ──────────────────────────────────────────────────
     كلُّ الأصوات في سلّمٍ واحد (لا الكبير · A=440) كي تبدو من عائلةٍ واحدة،
     تماماً كما أنّ كلّ الشاشات من هويّةٍ بصريّةٍ واحدة. وهذا ما يصنع
     «الفخامة» عمليّاً: التناسقُ لا الضخامة. */
  var A3 = 220, A4 = 440, Cs5 = 554.37, E5 = 659.25, A5 = 880, Cs6 = 1108.73, E6 = 1318.5;

  var SOUNDS = {

    /* العلامةُ الصوتيّة — تُسمَع عند فتح النظام وفي الانترو.
       ثلاثُ نغماتٍ تصعد (لا · دو# · مي) ثمّ تتفتّح بنغمةٍ عُليا ونفَسٍ ناعم. */
    brand: function () {
      tone({ f: A4,  type: 'sine',     dur: .62, gain: .40, at: 0,    lp: 2600 });
      tone({ f: Cs5, type: 'sine',     dur: .60, gain: .34, at: .13,  lp: 2600 });
      tone({ f: E5,  type: 'sine',     dur: .95, gain: .36, at: .26,  lp: 3000 });
      tone({ f: A5,  type: 'triangle', dur: 1.15, gain: .16, at: .40, lp: 4200 });
      tone({ f: A3,  type: 'sine',     dur: 1.30, gain: .18, at: .26 });  /* جسمٌ منخفض */
      noise({ from: 400, to: 5200, dur: .9, gain: .05, at: .30, band: true, q: .7 });
    },

    /* فقاعةٌ مع انبثاق اللوجو — طلبُك حرفياً «صوت فقاعة مع انبثاق اللوجو» */
    pop: function () {
      tone({ f: 320, f2: 920, type: 'sine', dur: .11, gain: .34, attack: .004 });
      tone({ f: 1500, type: 'sine', dur: .05, gain: .10, at: .02 });
    },

    /* انتقالٌ بين الشاشات — نفَسٌ قصيرٌ لا صفير */
    nav: function () {
      noise({ from: 2600, to: 420, dur: .20, gain: .10, band: true, q: .9 });
    },

    /* عدّادٌ يتصاعد — للأرقام المتحرّكة في التوظيف والموقع.
       خافتٌ جداً لأنّه يتكرّر عشراتِ المرّات في ثانيتين. */
    tick: function () {
      tone({ f: 1760, type: 'square', dur: .022, gain: .045, attack: .002, lp: 3000 });
    },

    /* فاتورةٌ أُنشئت — «صوت أموال». جرسان معدنيّان قصيران لا رنينٌ طويل. */
    cash: function () {
      tone({ f: E6,   type: 'triangle', dur: .30, gain: .26, at: 0,   lp: 7000 });
      tone({ f: Cs6,  type: 'triangle', dur: .42, gain: .20, at: .07, lp: 7000 });
      tone({ f: A5,   type: 'sine',     dur: .55, gain: .16, at: .12 });
      noise({ from: 5200, to: 2400, dur: .18, gain: .06, band: true, q: 2.2, at: .02 });
    },

    /* نجاحُ عمليّة */
    success: function () {
      tone({ f: E5, type: 'sine', dur: .22, gain: .30, at: 0 });
      tone({ f: A5, type: 'sine', dur: .40, gain: .26, at: .11 });
    },

    /* خطأٌ — هابطٌ وناعم. لا نُفزع من يعمل ثماني ساعات. */
    error: function () {
      tone({ f: 330, type: 'sine', dur: .20, gain: .26, at: 0,   lp: 1400 });
      tone({ f: 233, type: 'sine', dur: .34, gain: .22, at: .12, lp: 1200 });
    },

    /* تنبيهٌ خفيف */
    warn: function () {
      tone({ f: 523, type: 'triangle', dur: .14, gain: .22 });
      tone({ f: 523, type: 'triangle', dur: .14, gain: .18, at: .19 });
    },

    /* فتحُ المتجر — ترحيبٌ لامع (ثلاثُ نغماتٍ عُليا متتابعة) */
    store: function () {
      tone({ f: A5,  type: 'sine', dur: .26, gain: .26, at: 0 });
      tone({ f: Cs6, type: 'sine', dur: .26, gain: .22, at: .10 });
      tone({ f: E6,  type: 'sine', dur: .55, gain: .22, at: .20, lp: 7000 });
      noise({ from: 3000, to: 8000, dur: .5, gain: .04, at: .18, band: true, q: .8 });
    },

    /* فتحُ الكفالة — نغمتان معاً: استقرارٌ وأمان، لا بهجة */
    warranty: function () {
      tone({ f: A4, type: 'sine', dur: .75, gain: .26, lp: 2200 });
      tone({ f: E5, type: 'sine', dur: .75, gain: .18, lp: 2200 });
      tone({ f: A3, type: 'sine', dur: .85, gain: .14 });
    },

    /* الشاحنةُ تمرّ — لتتبّع الشحنة. محرّكٌ منخفضٌ يقترب ثمّ يبتعد. */
    truck: function () {
      var c = ensure(); if (!c) return;
      var t0 = c.currentTime, dur = 1.5;
      var o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(62, t0);
      o.frequency.linearRampToValueAtTime(84, t0 + dur * .45);
      o.frequency.linearRampToValueAtTime(54, t0 + dur);
      var f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(260, t0);
      f.frequency.linearRampToValueAtTime(680, t0 + dur * .45);
      f.frequency.linearRampToValueAtTime(200, t0 + dur);
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(.20, t0 + .35);
      g.gain.exponentialRampToValueAtTime(.22, t0 + dur * .5);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + .05);
      noise({ from: 300, to: 900, dur: dur, gain: .05, band: true, q: .6 });
    },
  };

  /* ── التشغيل ───────────────────────────────────────────────────────── */
  function play(name, opt) {
    try {
      if (!isOn()) return;
      var fn = SOUNDS[name];
      if (!fn) return;
      if (!unlocked) { if (!(opt && opt.queue === false)) pending = name; return; }
      var c = ensure(); if (!c) return;
      if (c.state === 'suspended') { c.resume().catch(function () {}); }
      fn();
    } catch (_) { /* لا صوتَ يكسر صفحة */ }
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      var c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(function () {});
    } catch (_) {}
    if (pending) { var p = pending; pending = null; setTimeout(function () { play(p); }, 30); }
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    global.addEventListener(ev, unlock, { once: true, passive: true, capture: true });
  });

  /* ── مفتاحُ الكتم في شريط الخيارات ────────────────────────────────────
     لا زرَّ عائم — يُركَّب داخل شريط التحديث القائم، التزاماً بقاعدتك. */
  function paintToggle() {
    var b = document.getElementById('gmt-sound-btn');
    if (!b) return;
    var on = isOn();
    /* (2026-10-04 ي) أيقونةٌ خطّيّة من الطقم الموحّد بدل الرمز التعبيريّ — والرمزُ احتياطٌ فقط */
    var ico = (global.GMTIcon && GMTIcon.has('volume')) ? GMTIcon.svg(on ? 'volume' : 'mute', 16) : null;
    if (ico) b.innerHTML = ico; else b.textContent = on ? '🔊' : '🔇';
    b.title = on ? 'الأصوات تعمل — اضغط للكتم' : 'الأصوات مكتومة — اضغط للتشغيل';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function mountToggle() {
    if (document.getElementById('gmt-sound-btn')) return;
    var bar = document.querySelector('.gmt-refresh-bar');
    if (!bar) return;
    var b = document.createElement('button');
    b.id = 'gmt-sound-btn';
    b.type = 'button';
    b.className = 'u-btn u-btn--ghost u-btn--sm';
    b.style.cssText = 'min-width:34px;padding:0 8px;';
    b.onclick = function () { setOn(!isOn()); };
    bar.appendChild(b);
    paintToggle();
  }

  global.GMTSound = {
    play: play, unlock: unlock,
    on: function () { setOn(true); }, off: function () { setOn(false); },
    toggle: function () { setOn(!isOn()); },
    isOn: isOn, list: Object.keys(SOUNDS),
    mount: mountToggle,
  };

  function boot() {
    mountToggle();
    /* إن لم يوجد شريطُ خيارات بعد، نحاول مرّةً أخرى بعد أن تُركّبه الصفحة */
    setTimeout(mountToggle, 1200);
    setTimeout(mountToggle, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
