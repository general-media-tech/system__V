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

    /* الشاحنةُ — لتتبّع الشحنة.
       (١١ ت١ — ملاحظات) بلاغُك: «صوت سيارة الشحن كثير سيّئ، حطّوا صوت زمور بيب بيب وهيك صوت زحطة دواليب».
       كان طنيناً منخفضاً فقط (محرّكٌ يقترب ويبتعد) بلا زمورٍ ولا فرامل. الآن ثلاثُ لحظات:
         ① المحرّك يقترب (قصير) · ② زمورٌ مزدوج النغمة «بيب… بيب» كزمور الشاحنات · ③ احتكاك دواليب (ضجيجٌ مُرشَّح يهبط). */
    truck: function () {
      /* (11 ت١ · طلبك مرّتين) «صوت سيارة الشحن لازم يكون صوت دواليب وزمور، ويبدأ مع فتح صفحة التتبّع مباشرةً والسيارة عم تمشي».
         الترتيب القديم كان محرّكاً أولاً (٠٫٦ث) ثم الزمور (٠٫٥) ثم الزحطة (١٫٢٥) فيبدو متأخراً عن حركة الشاحنة.
         الآن يبدأ **من الصفر** بدواليب تدحرج على الطريق (ضجيجٌ ضيّق النطاق + همهمة منخفضة)، والزمور المزدوج في ٠٫٣٥ و٠٫٨٠،
         وزحطةُ الدواليب تختم عند ١٫١٠. المدّة الكلّية ≈ ١٫٧ث. */
      var c = ensure(); if (!c) return;
      var t0 = c.currentTime;
      /* ① دواليب على الطريق — من اللحظة الأولى */
      noise({ from: 420, to: 700, dur: 1.45, gain: .11, at: 0, attack: .05, band: true, q: .9 });
      noise({ from: 1500, to: 900, dur: 1.2, gain: .04, at: 0, attack: .08, band: true, q: 1.1 });
      /* همهمةُ المحرّك تحت الدواليب */
      var o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(52, t0); o.frequency.linearRampToValueAtTime(84, t0 + 1.2);
      var f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(220, t0); f.frequency.linearRampToValueAtTime(520, t0 + 1.2);
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(.10, t0 + .12);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.35);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 1.4);
      /* ② زمورٌ مزدوج النغمة «بيب… بيب» */
      [.35, .80].forEach(function (at) {
        tone({ f: 415, type: 'square', dur: .27, gain: .15, at: at, attack: .01, lp: 2000 });
        tone({ f: 525, type: 'square', dur: .27, gain: .13, at: at, attack: .01, lp: 2000 });
      });
      /* ③ زحطة دواليب تختم المشهد */
      noise({ from: 2800, to: 1100, dur: .5, gain: .13, at: 1.10, attack: .05, band: true, q: 1.4 });
      noise({ from: 5200, to: 2200, dur: .4, gain: .05, at: 1.12, attack: .04, band: true, q: 2.2 });
    },

    /* (19 ت1 · TASK-0107) «بيب بيب» وحده — مرّةً واحدة حين تجد شاشةُ التتبّع شحنةَ الزبون (زمور الشاحنة نفسه بلا الدواليب) */
    horn: function () {
      [0, .45].forEach(function (at) {
        tone({ f: 415, type: 'square', dur: .27, gain: .15, at: at, attack: .01, lp: 2000 });
        tone({ f: 525, type: 'square', dur: .27, gain: .13, at: at, attack: .01, lp: 2000 });
      });
    },

    /* (١١ ت١ — ملاحظات · «صوتٌ في كل مكان») أصواتٌ جديدة للأحداث التي كانت صامتة */
    login: function () {           /* دخول: نغمتان صاعدتان */
      tone({ f: E5, type: 'sine', dur: .20, gain: .26, at: 0 });
      tone({ f: A5, type: 'sine', dur: .42, gain: .24, at: .10, lp: 5200 });
    },
    logout: function () {          /* خروج: نغمتان هابطتان */
      tone({ f: A5, type: 'sine', dur: .20, gain: .22, at: 0 });
      tone({ f: E5, type: 'sine', dur: .40, gain: .20, at: .10 });
    },
    order: function () {           /* أوردرٌ أُنشئ: ختمٌ + جرس */
      tone({ f: 120, f2: 70, type: 'sine', dur: .14, gain: .34, attack: .003 });
      tone({ f: A5, type: 'triangle', dur: .38, gain: .20, at: .10, lp: 6000 });
      tone({ f: Cs6, type: 'triangle', dur: .45, gain: .14, at: .17, lp: 6000 });
    },
    customer: function () {        /* عميلٌ جديد: فقاعتان لطيفتان */
      tone({ f: 420, f2: 900, type: 'sine', dur: .10, gain: .26, attack: .004 });
      tone({ f: 640, f2: 1200, type: 'sine', dur: .12, gain: .22, at: .09, attack: .004 });
    },
    scan: function () {            /* قراءة باركود: صفيرٌ قصير كأجهزة الكاشير */
      tone({ f: 2200, type: 'square', dur: .07, gain: .10, attack: .002, lp: 4200 });
      tone({ f: 2900, type: 'square', dur: .06, gain: .08, at: .08, attack: .002, lp: 4800 });
    },
    del: function () {             /* حذف: هبوطٌ منخفض */
      tone({ f: 300, f2: 140, type: 'triangle', dur: .20, gain: .22, attack: .004, lp: 1800 });
    },
    back: function () {            /* رجوع: نغمتان هابطتان قصيرتان ناعمتان */
      tone({ f: 660, f2: 470, type: 'sine', dur: .13, gain: .17, attack: .004, lp: 3000 });
      tone({ f: 470, f2: 360, type: 'sine', dur: .14, gain: .13, at: .08, attack: .004, lp: 2600 });
    },
    moneyOut: function () {        /* مال يخرج (مصروف · سحب · ترحيل): عملةٌ تهبط */
      tone({ f: A5, f2: E5, type: 'triangle', dur: .22, gain: .20, lp: 6500 });
      tone({ f: E5, f2: 330, type: 'triangle', dur: .30, gain: .15, at: .10, lp: 5200 });
      noise({ from: 3600, to: 1800, dur: .16, gain: .04, band: true, q: 2, at: .02 });
    },
    notify: function () {          /* إشعارٌ جديد: نغمتان عُلويتان لطيفتان */
      tone({ f: Cs6, type: 'sine', dur: .16, gain: .20 });
      tone({ f: E6, type: 'sine', dur: .30, gain: .17, at: .13, lp: 7000 });
    },
    open: function () {            /* فتحُ نافذة/لوحة: صعودٌ قصير */
      tone({ f: 520, f2: 780, type: 'sine', dur: .11, gain: .12, attack: .004, lp: 3600 });
    },
    close: function () {           /* إغلاقُ نافذة/لوحة: هبوطٌ قصير */
      tone({ f: 700, f2: 450, type: 'sine', dur: .11, gain: .11, attack: .004, lp: 3200 });
    },
    copy: function () {            /* نسخ: نقرةٌ مزدوجة رفيعة */
      tone({ f: 1800, type: 'sine', dur: .04, gain: .10, attack: .002, lp: 4200 });
      tone({ f: 2400, type: 'sine', dur: .05, gain: .09, at: .05, attack: .002, lp: 4800 });
    },
    click: function () {           /* نقرةٌ خافتة جداً لأزرار الواجهة */
      tone({ f: 1250, type: 'sine', dur: .028, gain: .06, attack: .002, lp: 2600 });
    },
  };

  /* ── التشغيل ───────────────────────────────────────────────────────── */
  function play(name, opt) {
    try {
      if (!isOn()) return;
      var fn = SOUNDS[name];
      if (!fn) return;
      if (!unlocked) {
        /* (11 ت١) بعض المتصفّحات تسمح بالتشغيل بلا لمسة (زائرٌ سبق أن تفاعل مع الموقع · رابطٌ فُتح من تطبيق) فيكون السياق «running» فوراً.
           كنّا ننتظر اللمسة الأولى دائماً ⇒ صوتُ دخول التتبّع يتأخّر عن حركة الشاحنة حتى حين يُسمح بتشغيله. الآن: نجرّب أولاً، وإلا نؤجّل لأوّل لمسة. */
        var c0 = ensure();
        if (c0 && c0.state === 'running') { unlocked = true; }
        else {
          if (!(opt && opt.queue === false)) pending = name;
          try { if (c0 && c0.state === 'suspended') c0.resume().then(function () { if (c0.state === 'running' && !unlocked) { unlocked = true; if (pending) { var q = pending; pending = null; play(q); } } }).catch(function () {}); } catch (_) {}
          return;
        }
      }
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

  /* ═══════════════════════════════════════════════════════════
     (١١ ت١ ٢٠٢٦ — ملاحظات) الطبقة التلقائية — «كل مكان يحتاج صوت»
     بلاغُك (٩ ت١ ٥:٤٩): «صوت الكليكات · الدخول والخروج · الخطأ · الحفظ · الأموال عند التحصيل أو إنشاء فاتورة ·
     عند إضافة عميل جديد · إنشاء الطلب · الشحن — كل مكان يحتاج صوت».
     الواقع قبل اليوم: ٢٠ نداءً يدوياً فقط ⇒ بقيت عشراتُ الأحداث صامتة (حفظ · خطأ · دخول · خروج…).
     والحلّ لا يكون بإضافة سطرٍ في ١٥٠٠ موضع، بل بنقطتَي التقاءٍ يمرّ منهما كل شيء:
       ① كل رسالةٍ تظهر للموظف تمرّ بدالّة toast الخاصّة بصفحتها (showToast…) ⇒ نلفّها مرّةً واحدة، ونصنّف الرسالة:
          خطأ · تنبيه · دخول · خروج · مال · عميل جديد · أوردر جديد · حذف · نجاح.
       ② كل ضغطةٍ على زرّ ⇒ نقرةٌ خافتة (وللأزرار الخطِرة صوتُ الحذف).
     ولا تُكسر صفحةٌ: كلّه داخل try، ولا يعمل قبل أوّل لمسة، ويحترم مفتاح الكتم.
     ═══════════════════════════════════════════════════════════ */
  var lastCue = 0, lastCueName = '', lastClick = 0;
  function cue(name) {
    var n = Date.now();
    /* لا نكدّس أصواتاً متتالية — إلّا أن الخطأ يقطع ما قبله */
    if (n - lastCue < 260 && !(name === 'error' && lastCueName !== 'error')) return;
    lastCue = n; lastCueName = name; play(name);
  }
  var ERR_T = /err|bad|fail|danger|invalid/i, WARN_T = /warn/i;
  function classifyToast(msg, type) {
    var t = String(msg == null ? '' : msg).replace(/<[^>]*>/g, ' '), ty = String(type == null ? '' : type);
    if (/^\s*(⚠|❌|⛔|🔴|✗|✖)/.test(t) || ERR_T.test(ty) || /تعذّر|تعذر|فشل|خطأ|غير صحيح|لم يُحفظ|لم تُحفظ|مرفوض/.test(t)) return 'error';
    if (WARN_T.test(ty)) return 'warn';
    if (/تسجيل الخروج|تمّ الخروج|تم الخروج/.test(t)) return 'logout';
    if (/تسجيل الدخول|أهلاً بعودتك/.test(t)) return 'login';
    if (/مصروف|صرف|سحب|ترحيل|خُصم من الصندوق|نُقل.*من صندوق/.test(t)) return 'moneyOut';
    if (/نُسخ|تم النسخ/.test(t)) return 'copy';
    if (/تحصيل|دُفع|مدفوع|قُبض|سداد|الصندوق|عمولة|فاتورة.*(أُنشئت|حُفظت|اعتُمدت|تم)/.test(t)) return 'cash';
    if (/(عميل|زبون).*(أُضيف|إضافة|جديد|حُفظ|سُجّل)|(أُضيف|إضافة|سُجّل).*(عميل|زبون)/.test(t)) return 'customer';
    if (/(أوردر|طلب).*(أُنشئ|إنشاء|أُضيف|اعتماد)/.test(t)) return 'order';
    if (/حُذف|تم الحذف|محذوف|أُلغي|تم الإلغاء/.test(t)) return 'del';
    if (/^\s*✅|حُفظ|تم الحفظ|تمّ|تم |نجح|نُسخ/.test(t)) return 'success';
    return null;
  }
  function wrapGlobalFn(name) {
    var f = global[name];
    if (typeof f !== 'function' || f.__gmtSnd) return;
    var w = function (m, t) { try { var c = classifyToast(m, t); if (c) cue(c); } catch (_) {} return f.apply(this, arguments); };
    w.__gmtSnd = 1;
    try { global[name] = w; } catch (_) {}
  }
  function wrapAccountLogin() {
    var A = global.GMTAccount;
    if (!A || typeof A.login !== 'function' || A.login.__gmtSnd) return;
    var f = A.login;
    A.login = function () {
      var p = f.apply(this, arguments);
      try { Promise.resolve(p).then(function () { cue('login'); }, function () { cue('error'); }); } catch (_) {}
      return p;
    };
    A.login.__gmtSnd = 1;
  }
  function hookAll() {
    ['showToast', 'toast'].forEach(wrapGlobalFn);
    wrapAccountLogin();
  }
  var CLICKABLE = 'button, [role="button"], a.btn, .btn, summary, .chip, .tab, .u-btn';
  document.addEventListener('click', function (e) {
    try {
      if (!isOn() || !unlocked) return;
      var el = e.target && e.target.closest && e.target.closest(CLICKABLE);
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[data-nosound]') || el.id === 'gmt-sound-btn') return;
      var n = Date.now(); if (n - lastClick < 70) return; lastClick = n;
      var cls = (typeof el.className === 'string' ? el.className : '') + ' ' + (el.getAttribute('data-act') || '') + ' ' + (el.getAttribute('data-danger') || '');
      var txt = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.title || '')).slice(0, 60);
      play(/danger|trash|delete|remove|\bdel\b/i.test(cls) ? 'del' : (/(^|\s)(رجوع|عودة|السابق|back)(\s|$)/i.test(txt) || /\bback\b|data-back/.test(cls + ' ' + (el.id || '')) ? 'back' : 'click'));
    } catch (_) {}
  }, true);

  global.GMTSound = {
    play: play, unlock: unlock, cue: cue, classify: classifyToast,
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
    /* لفّ دوالّ الرسائل بعد أن تعرّفها الصفحة (بعضها يُعرَّف متأخّراً) */
    hookAll(); setTimeout(hookAll, 800); setTimeout(hookAll, 2500); setTimeout(hookAll, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
