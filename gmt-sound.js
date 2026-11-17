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
  /* (OWN-09#40/#41/#50 · OWN-12#7) حالةٌ مشتركة: مستوى الصوت · تنويع النغمة · هرمية الجهارة · وضع القياس */
  var LS_VOL = 'gmt_pro_vol', LS_PROFILE = 'gmt_snd_profile', LS_CATS = 'gmt_snd_cats', LS_FXP = 'gmt_fx_prefs', LS_KEYS = 'gmt_snd_keys_on';
  var vol = 1, curDetune = 0, curMul = 1, measuring = false, mEnd = 0;
  try { var v0 = parseFloat(localStorage.getItem(LS_VOL)); if (v0 >= 0 && v0 <= 1) vol = v0; } catch (_) {}

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
      master.gain.value = 0.26 * vol;  // هادئٌ بقصد — نظامُ عملٍ لا لعبة (× مستوى المستخدم)
      /* (OWN-09#41) Limiter لمنع القصّ عند تزامن عدّة أصوات */
      var lim = null;
      try {
        if (ctx.createDynamicsCompressor) {
          lim = ctx.createDynamicsCompressor();
          lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .003; lim.release.value = .1;
        }
      } catch (_) { lim = null; }
      if (lim) { master.connect(lim); lim.connect(ctx.destination); } else master.connect(ctx.destination);
    } catch (_) { ctx = null; }
    return ctx;
  }

  /* ── لبناتٌ صغيرة ──────────────────────────────────────────────────── */
  function tone(opt) {
    if (measuring) { mEnd = Math.max(mEnd, (opt.at || 0) + (opt.dur || .3)); return; }
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (opt.at || 0);
    var o = c.createOscillator();
    if (curDetune && o.detune) { try { o.detune.value = curDetune; } catch (_) {} }   /* (OWN-09#40) تنويعٌ طفيف للمتكرّر */
    var g = c.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(opt.f, t0);
    if (opt.f2) o.frequency.exponentialRampToValueAtTime(opt.f2, t0 + (opt.dur || .3));
    var peak = (opt.gain == null ? .5 : opt.gain) * curMul;   /* (OWN-09#41) هرمية الجهارة */
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
    if (measuring) { mEnd = Math.max(mEnd, (opt.at || 0) + (opt.dur || .25)); return; }
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
    g.gain.exponentialRampToValueAtTime((opt.gain == null ? .25 : opt.gain) * curMul, t0 + (opt.attack || .03));
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

    /* ── (TASK-0032 · المالك seq 307 «منظومة الأصوات … اشتغل عليها» · الخطة البند ٣)
       «أصواتٌ لما لا صوت له اليوم — تحديث النظام · مزامنة/حفظ · وصول إشعار · اكتمال تنزيل · خطأ شبكة» — من السلّم نفسه ── */
    update: function () {          /* نسخةٌ جديدة من النظام: ثلاث نغماتٍ صاعدة سريعة ولمعة */
      tone({ f: Cs5, type: 'sine', dur: .16, gain: .22, at: 0 });
      tone({ f: E5,  type: 'sine', dur: .16, gain: .22, at: .09 });
      tone({ f: A5,  type: 'sine', dur: .45, gain: .24, at: .18, lp: 6000 });
      noise({ from: 4000, to: 9000, dur: .35, gain: .03, at: .2, band: true, q: .9 });
    },
    sync: function () {            /* أُرسل ما كان محفوظاً في الجهاز (مزامنة): نفَسٌ صاعد ثمّ نغمةٌ مستقرّة */
      noise({ from: 600, to: 2600, dur: .22, gain: .06, band: true, q: .8 });
      tone({ f: A5, type: 'sine', dur: .30, gain: .18, at: .16, lp: 5200 });
    },
    download: function () {        /* اكتمل تنزيل ملف: هبوطٌ قصير ثمّ «استقرار» في المكان */
      tone({ f: E6, f2: A5, type: 'sine', dur: .16, gain: .18, attack: .004, lp: 6500 });
      tone({ f: 140, f2: 90, type: 'sine', dur: .12, gain: .22, at: .14, attack: .003 });
      tone({ f: E5, type: 'triangle', dur: .30, gain: .14, at: .17, lp: 4200 });
    },
    offline: function () {         /* انقطع الإنترنت: نغمتان منخفضتان مكتومتان (لا ذعر — النظام يعمل بلا إنترنت) */
      tone({ f: 294, type: 'triangle', dur: .22, gain: .20, lp: 900 });
      tone({ f: 220, type: 'triangle', dur: .38, gain: .18, at: .16, lp: 800 });
    },
    online: function () {          /* عاد الإنترنت: عكسُ الانقطاع */
      tone({ f: 220, type: 'sine', dur: .16, gain: .18, lp: 1600 });
      tone({ f: 330, type: 'sine', dur: .30, gain: .18, at: .12, lp: 2200 });
    },
  };

  /* ═══ (OWN-09#25–#35 · OWN-12#33) أصواتٌ جديدة بنمط PREFIX_ACTION + بياناتٌ وصفيّة لكل صوت ═══
     META[key] = { cat, sev, pri, quiet } — الفئة · النوع (ui/info/success/warn/error/critical) · الأولوية · «مطفأ افتراضياً».
     وكلّ صوتٍ جديد يُسجَّل بدالّة reg() ⇒ يدخل SOUNDS وLABELS وDESC وMETA معاً من سطرٍ واحد. */
  var CATS = [['UI', '🖱️ الواجهة'], ['POS', '🧾 الكاشير'], ['ORDER', '📦 الطلبات'], ['INV', '🏷️ المخزون'], ['WARRANTY', '🛡️ الضمان'],
              ['CUST', '👥 العملاء والمالية'], ['SEC', '🔐 الأمان'], ['SYNC', '🔄 المزامنة'], ['SYS', '⚙️ النظام']];
  var PRI = { ui: 1, info: 2, success: 2, warn: 3, error: 3, critical: 4 };
  var META = {}, DESC = {}, LABELS_NEW = [];
  var F = { C4: 261.63, E4: 329.63, Fs4: 369.99, C5: 523.25, Fs5: 739.99, Gs5: 830.61, B5: 987.77, A6: 1760 };

  /* سلّمٌ صاعد/هابط من نغماتٍ متتابعة */
  function arp(fr, o) {
    o = o || {};
    fr.forEach(function (f, i) {
      tone({ f: f, type: o.type || 'sine', dur: o.dur || .2, gain: o.gain == null ? .15 : o.gain, at: (o.at || 0) + i * (o.step || .1), lp: o.lp, attack: o.attack });
    });
  }
  function reg(key, cat, sev, label, desc, fn, quiet) {
    SOUNDS[key] = fn;
    META[key] = { cat: cat, sev: sev, pri: PRI[sev] || 1, quiet: !!quiet };
    DESC[key] = desc; LABELS_NEW.push([key, label]);
  }

  /* بياناتٌ وصفيّة للأصوات القائمة (الأسماء القديمة لا تتغيّر) */
  [['brand', 'SYS', 'info'], ['pop', 'UI', 'ui'], ['nav', 'UI', 'ui'], ['tick', 'UI', 'ui'], ['cash', 'POS', 'success'], ['success', 'UI', 'success'],
   ['error', 'UI', 'error'], ['warn', 'UI', 'warn'], ['store', 'SYS', 'info'], ['warranty', 'WARRANTY', 'info'], ['truck', 'ORDER', 'info'], ['horn', 'ORDER', 'info'],
   ['login', 'SEC', 'success'], ['logout', 'SEC', 'info'], ['order', 'ORDER', 'success'], ['customer', 'CUST', 'success'], ['scan', 'POS', 'ui'],
   ['del', 'UI', 'warn'], ['back', 'UI', 'ui'], ['moneyOut', 'CUST', 'info'], ['notify', 'SYS', 'info'], ['open', 'UI', 'ui'], ['close', 'UI', 'ui'],
   ['copy', 'UI', 'ui'], ['click', 'UI', 'ui'], ['update', 'SYS', 'info'], ['sync', 'SYNC', 'success'], ['download', 'SYS', 'success'],
   ['offline', 'SYNC', 'warn'], ['online', 'SYNC', 'success']
  ].forEach(function (r) { META[r[0]] = { cat: r[1], sev: r[2], pri: PRI[r[2]], quiet: false }; });
  var DUR_FIXED = { truck: 1.7 };
  DESC.brand = 'ثلاث نغماتٍ صاعدة بـ«لا الكبير» — علامة النظام الصوتية'; DESC.pop = 'فقاعة قصيرة مع انبثاق الشعار والنوافذ'; DESC.nav = 'نفَسٌ قصير عند الانتقال بين الشاشات';
  DESC.tick = 'نقرةٌ خافتة جداً تتكرّر مع الأعداد المتحرّكة'; DESC.cash = 'جرسان معدنيّان — فاتورة أُنشئت أو مبلغ حُصّل'; DESC.success = 'نغمتان صاعدتان — عمليّة نجحت';
  DESC.error = 'نغمتان هابطتان ناعمتان — فشل عملية'; DESC.warn = 'نبضتان متماثلتان — تنبيه'; DESC.store = 'ثلاث نغماتٍ عُليا — ترحيب بفتح المتجر';
  DESC.warranty = 'نغمتان معاً — استقرارٌ وأمان'; DESC.truck = 'دواليب وزمور وزحطة — شاشة تتبّع الشحنة'; DESC.horn = 'زمور «بيب بيب» وحده';
  DESC.login = 'نغمتان صاعدتان — دخول'; DESC.logout = 'نغمتان هابطتان — خروج'; DESC.order = 'ختمٌ ثم جرس — أوردر أُنشئ'; DESC.customer = 'فقاعتان لطيفتان — عميل جديد';
  DESC.scan = 'صفيرٌ قصير كأجهزة الكاشير'; DESC.del = 'هبوطٌ منخفض — حذف'; DESC.back = 'نغمتان هابطتان قصيرتان — رجوع'; DESC.moneyOut = 'عملةٌ تهبط — مال يخرج';
  DESC.notify = 'نغمتان عُلويتان — إشعار جديد'; DESC.open = 'صعودٌ قصير — فتح نافذة'; DESC.close = 'هبوطٌ قصير — إغلاق نافذة'; DESC.copy = 'نقرةٌ مزدوجة رفيعة — نسخ';
  DESC.click = 'نقرةٌ خافتة لأزرار الواجهة'; DESC.update = 'ثلاث نغماتٍ صاعدة ولمعة — نسخةٌ جديدة'; DESC.sync = 'نفَسٌ صاعد ثم نغمةٌ مستقرّة — تمّت المزامنة';
  DESC.download = 'هبوطٌ قصير ثم استقرار — اكتمل تنزيل'; DESC.offline = 'نغمتان منخفضتان مكتومتان — انقطع الإنترنت'; DESC.online = 'عكس الانقطاع — عاد الإنترنت';

  /* (OWN-09#25) أسماءٌ بنمط PREFIX_ACTION تشير إلى الأصوات القائمة — الأسماء القديمة تعمل كما هي */
  var ALIAS = {
    UI_CLICK: 'click', UI_BACK: 'back', UI_COPY: 'copy', UI_OPEN: 'open', UI_CLOSE: 'close', UI_DELETE: 'del', NAV_PAGE: 'nav',
    POS_SALE_SUCCESS: 'cash', POS_SCAN_SUCCESS: 'scan', ORDER_CREATED: 'order', CUSTOMER_CREATED: 'customer',
    AUTH_LOGIN: 'login', AUTH_LOGOUT: 'logout', SYS_UPDATE: 'update', SYS_NOTIFY: 'notify', SYS_DOWNLOAD: 'download',
    SYNC_DONE: 'sync', NET_OFFLINE: 'offline', NET_ONLINE: 'online', FIN_EXPENSE: 'moneyOut',
    ERROR_GENERIC: 'error', WARN_GENERIC: 'warn', SUCCESS_GENERIC: 'success'
  };

  /* ── (أ) الواجهة العامة — OWN-09#26: قصيرةٌ جداً (<120ms) وخافتة (gain ≤ .08) ── */
  reg('UI_HOVER', 'UI', 'ui', 'مرور فوق عنصر (مطفأ)', 'نقرةٌ شبه صامتة — لا تعمل إلا إن فعّلتها', function () { tone({ f: 1900, dur: .025, gain: .03, attack: .003 }); }, true);
  reg('UI_FOCUS', 'UI', 'ui', 'تركيز على حقل (مطفأ)', 'نقرةٌ ناعمة عند دخول حقل — لا تعمل إلا إن فعّلتها', function () { tone({ f: 1500, dur: .04, gain: .04, attack: .003 }); }, true);
  reg('UI_TOGGLE_ON', 'UI', 'ui', 'مفتاح: تشغيل', 'نغمتان صاعدتان سريعتان', function () { arp([E5, A5], { step: .05, dur: .08, gain: .07 }); });
  reg('UI_TOGGLE_OFF', 'UI', 'ui', 'مفتاح: إطفاء', 'نغمتان هابطتان سريعتان', function () { arp([A5, E5], { step: .05, dur: .08, gain: .06 }); });
  reg('UI_CHECK', 'UI', 'ui', 'مربّع اختيار', 'نقرةٌ مزدوجة خفيفة', function () { tone({ f: 1320, type: 'triangle', dur: .06, gain: .07, attack: .003, lp: 4000 }); tone({ f: 1760, type: 'triangle', dur: .05, gain: .05, at: .035, attack: .003, lp: 4000 }); });
  reg('UI_RADIO', 'UI', 'ui', 'زرّ اختيار (راديو)', 'قفزةٌ صاعدة قصيرة', function () { tone({ f: 760, f2: 980, dur: .07, gain: .07, attack: .003 }); });
  reg('UI_TAB', 'UI', 'ui', 'تبديل تبويب', 'نقرةٌ صاعدة مثلّثة', function () { tone({ f: 1000, f2: 1250, type: 'triangle', dur: .06, gain: .07, attack: .003, lp: 3200 }); });
  reg('UI_SELECT_OPEN', 'UI', 'ui', 'قائمة منسدلة', 'صعودٌ قصير ناعم', function () { tone({ f: 600, f2: 880, dur: .09, gain: .06, attack: .004, lp: 3000 }); });
  reg('UI_DRAWER', 'UI', 'ui', 'قائمة جانبية', 'نفَسٌ قصير مع نغمة صاعدة', function () { noise({ from: 700, to: 2200, dur: .12, gain: .05, band: true, q: .8 }); tone({ f: 420, f2: 600, dur: .1, gain: .05, attack: .004 }); });
  reg('UI_ACCORDION', 'UI', 'ui', 'أكورديون', 'صعودٌ قصير ناعم', function () { tone({ f: 560, f2: 760, dur: .08, gain: .06, attack: .004, lp: 3000 }); });
  reg('UI_DRAG', 'UI', 'ui', 'بدء سحب', 'نغمةٌ مثلّثة صاعدة', function () { tone({ f: 500, f2: 640, type: 'triangle', dur: .08, gain: .06, attack: .004, lp: 2400 }); });
  reg('UI_DROP', 'UI', 'ui', 'إفلات', 'هبوطٌ قصير مع نقرة', function () { tone({ f: 300, f2: 200, dur: .09, gain: .08, attack: .003 }); tone({ f: 1100, dur: .04, gain: .04, at: .02, attack: .003 }); });
  reg('UI_PULL_REFRESH', 'UI', 'ui', 'سحب للتحديث', 'نفَسٌ صاعد قصير', function () { noise({ from: 500, to: 2400, dur: .12, gain: .05, band: true, q: .9 }); });
  reg('UI_LIST_END', 'UI', 'ui', 'نهاية القائمة', 'نغمةٌ منخفضة هابطة', function () { tone({ f: 260, f2: 200, type: 'triangle', dur: .1, gain: .07, attack: .004, lp: 1200 }); });
  reg('UI_PAGE', 'UI', 'ui', 'ترقيم الصفحات', 'قلبُ ورقة خفيف', function () { noise({ from: 2200, to: 900, dur: .09, gain: .05, band: true, q: 1 }); tone({ f: 880, dur: .04, gain: .04, attack: .003 }); });
  reg('UI_PIN', 'UI', 'ui', 'تثبيت', 'نقرةٌ هابطة ثم ثابتة', function () { tone({ f: 1400, f2: 1000, dur: .06, gain: .07, attack: .003 }); tone({ f: 700, dur: .05, gain: .06, at: .05, attack: .003 }); });
  reg('UI_STAR', 'UI', 'ui', 'نجمة / تفضيل', 'ثلاث نغماتٍ لامعة صاعدة', function () { arp([A5, Cs6, E6], { step: .04, dur: .08, gain: .06 }); });
  reg('UI_PASTE', 'UI', 'ui', 'لصق', 'هبوطٌ ناعم قصير', function () { tone({ f: 700, f2: 520, dur: .08, gain: .07, attack: .004, lp: 3000 }); });
  reg('UI_CUT', 'UI', 'ui', 'قصّ', 'قصّةٌ حادّة قصيرة', function () { noise({ from: 4500, to: 2500, dur: .06, gain: .06, band: true, q: 2 }); });
  reg('UI_SELECT_ALL', 'UI', 'ui', 'تحديد الكل', 'نغمتان معاً', function () { tone({ f: 900, dur: .08, gain: .06, attack: .003 }); tone({ f: 1200, dur: .08, gain: .05, attack: .003 }); });
  reg('UI_REFRESH', 'UI', 'ui', 'تحديث', 'صعودان متتاليان', function () { tone({ f: 600, f2: 900, dur: .08, gain: .06, attack: .003 }); tone({ f: 900, f2: 1100, dur: .06, gain: .05, at: .07, attack: .003 }); });
  reg('UI_EXPORT', 'UI', 'ui', 'تصدير', 'صعودٌ مع نفَس', function () { tone({ f: 500, f2: 900, dur: .1, gain: .07, attack: .004 }); noise({ from: 1000, to: 3000, dur: .1, gain: .03, band: true, q: 1 }); });
  reg('UI_IMPORT', 'UI', 'ui', 'استيراد', 'هبوطٌ مع نفَس', function () { tone({ f: 900, f2: 500, dur: .1, gain: .07, attack: .004 }); noise({ from: 3000, to: 1000, dur: .1, gain: .03, band: true, q: 1 }); });
  reg('UI_SHARE', 'UI', 'ui', 'مشاركة', 'ثلاث نغماتٍ صاعدة سريعة', function () { arp([E5, A5, E6], { step: .045, dur: .07, gain: .06 }); });

  /* ── (ب) الإدخال والنماذج — OWN-09#27 ── */
  reg('FORM_INVALID', 'UI', 'warn', 'خطأ تحقّق في حقل', 'نبضتان خشنتان منخفضتان', function () { tone({ f: 196, type: 'sawtooth', dur: .1, gain: .1, attack: .005, lp: 800 }); tone({ f: 196, type: 'sawtooth', dur: .1, gain: .09, at: .12, attack: .005, lp: 800 }); });
  reg('FORM_SUBMIT_OK', 'UI', 'success', 'إرسال نموذج ناجح', 'أربيجيو كبير صاعد', function () { arp([E5, F.Gs5, F.B5], { step: .06, dur: .14, gain: .16 }); });
  reg('FORM_SUBMIT_FAIL', 'UI', 'error', 'إرسال نموذج مرفوض', 'انزلاقٌ هابط خشن غير مؤذٍ', function () { tone({ f: 262, f2: 170, type: 'sawtooth', dur: .22, gain: .14, lp: 1000 }); });
  reg('FORM_KEY', 'UI', 'ui', 'ضغطة حرف (مطفأ)', 'نقرةٌ شبه صامتة — لا تعمل إلا إن فعّلتها', function () { tone({ f: 2600, dur: .012, gain: .03, attack: .002 }); }, true);
  reg('FORM_BACKSPACE', 'UI', 'ui', 'مسح حرف (مطفأ)', 'نقرةٌ هابطة صغيرة — لا تعمل إلا إن فعّلتها', function () { tone({ f: 900, f2: 600, dur: .035, gain: .05, attack: .002 }); }, true);
  reg('FORM_ENTER', 'UI', 'ui', 'ضغط Enter', 'نقرتان مثلّثتان صاعدتان', function () { tone({ f: 700, type: 'triangle', dur: .05, gain: .07, attack: .003 }); tone({ f: 1050, type: 'triangle', dur: .05, gain: .06, at: .045, attack: .003 }); });
  reg('FORM_CLEAR', 'UI', 'ui', 'مسح حقل', 'نفَسٌ هابط قصير', function () { noise({ from: 3000, to: 500, dur: .1, gain: .06, band: true, q: 1 }); });
  reg('SEARCH_RESULTS', 'UI', 'info', 'بحث بنتائج', 'نغمتان لامعتان صاعدتان', function () { arp([Cs6, E6], { step: .05, dur: .09, gain: .08 }); });
  reg('SEARCH_EMPTY', 'UI', 'info', 'بحث بلا نتائج', 'نغمةٌ مثلّثة هابطة', function () { tone({ f: 420, f2: 300, type: 'triangle', dur: .14, gain: .1, lp: 1400 }); });
  reg('LIST_FILTER', 'UI', 'ui', 'تطبيق فلتر', 'نقرتان مثلّثتان', function () { tone({ f: 800, type: 'triangle', dur: .05, gain: .07, attack: .003 }); tone({ f: 1200, type: 'triangle', dur: .05, gain: .06, at: .05, attack: .003 }); });
  reg('LIST_SORT', 'UI', 'ui', 'ترتيب القائمة', 'ثلاث درجاتٍ صاعدة سريعة', function () { arp([600, 720, 860], { step: .035, dur: .05, gain: .06 }); });

  /* ── (و) الضمان — OWN-09#31 ── */
  reg('WARRANTY_SERIAL_OK', 'WARRANTY', 'success', 'سيريال سليم', 'ثلاث نقرات لامعة صاعدة', function () { arp([1050, 1400, 1750], { step: .06, dur: .07, gain: .1 }); });
  reg('WARRANTY_EXPIRED', 'WARRANTY', 'warn', 'ضمان منتهٍ', 'تنبيهٌ هابط (تريتون)', function () { arp([F.C5, F.Fs4], { step: .16, dur: .3, type: 'triangle', gain: .2, lp: 1500 }); });
  reg('WARRANTY_EXTEND', 'WARRANTY', 'success', 'تمديد ضمان', 'أربع نغماتٍ صاعدة على جسمٍ منخفض', function () { arp([A4, Cs5, E5, A5], { step: .09, dur: .25, gain: .17 }); tone({ f: A3, dur: .4, gain: .1, at: .1 }); });
  reg('WARRANTY_CLAIM_OPEN', 'WARRANTY', 'info', 'فتح مطالبة', 'نغمتان صاعدتان مثلّثتان', function () { arp([A4, E5], { step: .14, dur: .32, type: 'triangle', gain: .18, lp: 3000 }); });
  reg('WARRANTY_CLAIM_CLOSE', 'WARRANTY', 'success', 'إغلاق مطالبة', 'هبوطٌ مستقرّ على جسمٍ منخفض', function () { arp([E5, A4], { step: .14, dur: .45, gain: .17 }); tone({ f: A3, dur: .5, gain: .1, at: .14 }); });

  /* ── (ز) العملاء والمالية — OWN-09#32 ── */
  reg('CUST_EDIT', 'CUST', 'ui', 'تعديل عميل', 'نقرتان صاعدتان قصيرتان', function () { tone({ f: 880, dur: .07, gain: .12 }); tone({ f: 1100, dur: .08, gain: .1, at: .07 }); });
  reg('CUST_MERGE', 'CUST', 'success', 'دمج عملاء', 'نغمتان تتلاقيان عند نغمةٍ واحدة', function () { tone({ f: 700, f2: 900, dur: .25, gain: .14 }); tone({ f: 1100, f2: 900, dur: .25, gain: .12 }); });
  reg('DEBT_ADD', 'CUST', 'info', 'دينٌ جديد', 'نغمتان هابطتان منخفضتان', function () { tone({ f: 330, type: 'triangle', dur: .28, gain: .18, lp: 900 }); tone({ f: 247, type: 'triangle', dur: .34, gain: .16, at: .17, lp: 800 }); });
  reg('DEBT_PAID', 'CUST', 'success', 'تسديد دين', 'جرسٌ معدني صاعد', function () { arp([E5, A5, Cs6], { step: .07, dur: .3, type: 'triangle', gain: .18, lp: 7000 }); noise({ from: 5200, to: 2400, dur: .15, gain: .04, band: true, q: 2.2, at: .02 }); });
  reg('LOYALTY_POINTS', 'CUST', 'success', 'نقاط ولاء', 'أربع شرارات لامعة صاعدة', function () { arp([A5, Cs6, E6, F.A6], { step: .06, dur: .2, gain: .11, lp: 7000 }); });
  reg('INVOICE_OVERDUE', 'CUST', 'warn', 'فاتورة متأخّرة', 'ثلاث نبضاتٍ مثلّثة', function () { [0, .2, .4].forEach(function (at) { tone({ f: 466, type: 'triangle', dur: .14, gain: .18, at: at, lp: 1500 }); }); });
  reg('REPORT_READY', 'CUST', 'info', 'تقرير جاهز', 'ثلاث نغماتٍ ناعمة مع حفيف ورق', function () { arp([A4, Cs5, E5], { step: .08, dur: .22, gain: .13 }); noise({ from: 2500, to: 800, dur: .12, gain: .04, band: true, q: 1, at: .02 }); });
  reg('SHIFT_OPEN', 'CUST', 'success', 'فتح وردية', 'نغمتان صاعدتان طويلتان', function () { arp([E5, A5], { step: .12, dur: .5, type: 'triangle', gain: .18, lp: 5000 }); });
  reg('SHIFT_CLOSE', 'CUST', 'info', 'إغلاق وردية', 'ثلاث نغماتٍ هابطة طويلة', function () { arp([A5, E5, A4], { step: .13, dur: .5, type: 'triangle', gain: .16, lp: 4000 }); });
  reg('CASH_MATCH', 'CUST', 'success', 'تطابق الصندوق', 'وترٌ كبير مستقرّ', function () { [A5, Cs6, E6].forEach(function (f, i) { tone({ f: f, dur: .6, gain: .12 - i * .01, lp: 7000 }); }); });
  reg('CASH_MISMATCH', 'CUST', 'warn', 'عجز / زيادة في الصندوق', 'تحذيرٌ واضح بفاصل تريتون متكرّر', function () { arp([F.C5, F.Fs5, F.C5, F.Fs5], { step: .13, dur: .18, type: 'triangle', gain: .2, lp: 3000 }); });

  /* ── (ح) الأمان — OWN-09#33: منخفضةٌ خشنة، والأخير الأقوى ── */
  reg('SEC_BAD_PASSWORD', 'SEC', 'error', 'كلمة مرور خاطئة', 'انزلاقٌ خشن منخفض', function () { tone({ f: 220, f2: 150, type: 'sawtooth', dur: .28, gain: .14, lp: 700 }); });
  reg('SEC_2FA_OK', 'SEC', 'success', 'رمز التحقّق صحيح', 'نغمتان صاعدتان نقيّتان', function () { arp([E5, A5], { step: .08, dur: .2, gain: .18 }); });
  reg('SEC_2FA_FAIL', 'SEC', 'error', 'رمز التحقّق خاطئ', 'نبضتان خشنتان هابطتان', function () { tone({ f: 196, type: 'sawtooth', dur: .12, gain: .13, lp: 700 }); tone({ f: 165, type: 'sawtooth', dur: .16, gain: .13, at: .15, lp: 700 }); });
  reg('SEC_LOCKED', 'SEC', 'error', 'حساب مقفل', 'نغمةٌ خشنة منخفضة طويلة', function () { tone({ f: 110, type: 'sawtooth', dur: .5, gain: .18, lp: 500 }); tone({ f: 98, type: 'sawtooth', dur: .4, gain: .14, at: .2, lp: 450 }); });
  reg('SEC_ELEVATE', 'SEC', 'info', 'رفع صلاحية', 'ثلاث نغماتٍ صاعدة على جسمٍ منخفض', function () { arp([A4, E5, A5], { step: .08, dur: .3, gain: .17 }); tone({ f: A3, dur: .4, gain: .12 }); });
  reg('SEC_CONFIRM_DANGER', 'SEC', 'warn', 'تأكيد عملية خطِرة', 'خطوةٌ صاعدة خشنة (تريتون) تستوقف', function () { tone({ f: 233, type: 'sawtooth', dur: .2, gain: .12, lp: 700 }); tone({ f: 330, type: 'sawtooth', dur: .28, gain: .12, at: .16, lp: 700 }); });
  reg('SEC_DOUBLE_CONFIRM', 'SEC', 'warn', 'تأكيد مزدوج', 'خطوتان خشنتان متتاليتان', function () { [0, .45].forEach(function (at) { tone({ f: 233, type: 'sawtooth', dur: .2, gain: .14, at: at, lp: 700 }); tone({ f: 330, type: 'sawtooth', dur: .28, gain: .14, at: at + .16, lp: 700 }); }); });
  reg('SEC_SUSPICIOUS', 'SEC', 'critical', 'نشاط مشبوه', 'ثلاث نبضاتٍ خشنة بفاصل تريتون — الأقوى والأطول', function () { [0, .34, .68].forEach(function (at) { tone({ f: 196, type: 'sawtooth', dur: .28, gain: .2, at: at, lp: 900 }); tone({ f: 277, type: 'sawtooth', dur: .28, gain: .14, at: at, lp: 900 }); }); });

  /* ── (ط) المزامنة — OWN-09#34 ── */
  reg('SYNC_PENDING', 'SYNC', 'info', 'عمليات معلّقة', 'نبضتان منخفضتان — حُفظ محلّياً بانتظار الاتصال', function () { tone({ f: 392, type: 'triangle', dur: .12, gain: .14, lp: 1500 }); tone({ f: 392, type: 'triangle', dur: .12, gain: .1, at: .14, lp: 1500 }); });
  reg('SYNC_CONFLICT', 'SYNC', 'warn', 'تعارض مزامنة', 'نغمتان متنافرتان معاً (تريتون)', function () { tone({ f: F.C5, type: 'triangle', dur: .3, gain: .14 }); tone({ f: F.Fs5, type: 'triangle', dur: .3, gain: .12 }); });
  reg('SYNC_RETRY', 'SYNC', 'info', 'إعادة محاولة', 'نفَسٌ صاعد سريع مع نغمة', function () { noise({ from: 700, to: 2600, dur: .12, gain: .05, band: true, q: .9 }); tone({ f: 700, dur: .1, gain: .09, at: .08 }); });
  reg('SYNC_FAIL', 'SYNC', 'error', 'فشل المزامنة', 'انزلاقٌ خشن هابط', function () { tone({ f: 330, f2: 196, type: 'sawtooth', dur: .3, gain: .14, lp: 900 }); });

  /* ── (ي) النظام — OWN-09#35 ── */
  reg('SYS_BACKUP_DONE', 'SYS', 'success', 'نسخة احتياطية جاهزة', 'ارتطامٌ منخفض ثم نغمتان صاعدتان', function () { tone({ f: 140, f2: 80, dur: .14, gain: .2, attack: .003 }); arp([A4, E5], { step: .12, dur: .3, gain: .15, at: .12 }); });
  reg('SYS_UPDATE_INSTALLED', 'SYS', 'success', 'تمّ تثبيت التحديث', 'خمس نغماتٍ صاعدة ولمعة', function () { arp([A4, Cs5, E5, A5, Cs6], { step: .07, dur: .3, gain: .15 }); noise({ from: 4000, to: 9000, dur: .3, gain: .03, band: true, q: .9, at: .2 }); });
  reg('SYS_STORAGE_FULL', 'SYS', 'warn', 'التخزين ممتلئ', 'ثلاث نبضاتٍ هابطة', function () { arp([F.C4 * 1, 247, 233], { step: .15, dur: .15, type: 'triangle', gain: .2, lp: 1200 }); });
  reg('SYS_SESSION_EXPIRED', 'SYS', 'warn', 'انتهت الجلسة', 'أربع نغماتٍ هابطة', function () { arp([E5, Cs5, A4, F.E4], { step: .13, dur: .3, gain: .16, lp: 3000 }); });
  reg('SYS_THEME', 'SYS', 'ui', 'تغيير الثيم', 'صعودٌ قصير مع حفيف', function () { tone({ f: 600, f2: 900, dur: .08, gain: .07, attack: .004 }); noise({ from: 1500, to: 3500, dur: .08, gain: .03, band: true, q: 1 }); });
  reg('SYS_LANG', 'SYS', 'ui', 'تغيير اللغة', 'نقرتان قصيرتان', function () { tone({ f: 800, dur: .05, gain: .07, attack: .003 }); tone({ f: 1000, dur: .05, gain: .07, at: .06, attack: .003 }); });

  /* ── (ك) المخزون — OWN-12#13: عائلة خشبيّة منخفضة (مثلّث/جيب بنغمات 200–660Hz) تميّز الجرد عن النقر والمال ──
     الأسماء بنمط الخطّة (invAdd…) ولها أسماءٌ مستعارة PREFIX_ACTION (INV_ADD…) وأحداثٌ في GMT_EVENT_MAP (inv.add…). */
  reg('invAdd', 'INV', 'success', 'إضافة منتج', 'ثلاث نغماتٍ خشبيّة صاعدة', function () { arp([247, 330, 494], { step: .07, dur: .18, type: 'triangle', gain: .15, lp: 1800 }); });
  reg('invEdit', 'INV', 'info', 'تعديل منتج', 'نغمتان خشبيّتان متقاربتان', function () { arp([330, 392], { step: .07, dur: .14, type: 'triangle', gain: .13, lp: 1800 }); });
  reg('invDel', 'INV', 'warn', 'حذف منتج', 'هبوطٌ خشبيّ منخفض مع ارتطامٍ خفيف', function () { tone({ f: 300, f2: 180, type: 'triangle', dur: .18, gain: .16, lp: 900 }); tone({ f: 110, f2: 70, dur: .12, gain: .14, at: .04 }); });
  reg('invPhoto', 'INV', 'success', 'رفع صورة منتج', 'نقرتا غالقٍ ثمّ نغمةٌ عالية قصيرة', function () { noise({ from: 3000, to: 6000, dur: .04, gain: .08, band: true, q: 1 }); noise({ from: 3000, to: 6000, dur: .04, gain: .08, at: .06, band: true, q: 1 }); tone({ f: 880, dur: .08, gain: .08, at: .11 }); });
  reg('invQty', 'INV', 'success', 'إضافة كمّية', 'أربع نقراتٍ خشبيّة صاعدة سريعة', function () { arp([262, 330, 392, 523], { step: .05, dur: .1, type: 'triangle', gain: .13, lp: 2000 }); });
  reg('invTransfer', 'INV', 'info', 'تحويل بين فروع', 'حفيفُ انتقال ثمّ نغمتان (صعودٌ فاستقرار)', function () { noise({ from: 500, to: 2500, dur: .18, gain: .05, band: true, q: .8 }); tone({ f: 294, f2: 440, type: 'triangle', dur: .2, gain: .13, lp: 2200 }); tone({ f: 440, type: 'triangle', dur: .12, gain: .11, at: .2, lp: 2200 }); });
  reg('countStart', 'INV', 'info', 'بدء جرد', 'نغمتان خشبيّتان — بدء العدّ', function () { arp([330, 392], { step: .12, dur: .1, type: 'triangle', gain: .12, lp: 1800 }); });
  reg('countMatch', 'INV', 'success', 'الجرد مطابق', 'ثلاث نغماتٍ صاعدة ثمّ نغمةٌ صافية', function () { arp([330, 415, 494], { step: .07, dur: .14, type: 'triangle', gain: .14, lp: 2000 }); tone({ f: 660, dur: .28, gain: .1, at: .22 }); });
  reg('countMismatch', 'INV', 'warn', 'الجرد غير مطابق', 'نغمتان خشبيّتان متنافرتان (تريتون)', function () { tone({ f: 262, type: 'triangle', dur: .16, gain: .14, lp: 1400 }); tone({ f: 370, type: 'triangle', dur: .2, gain: .14, at: .13, lp: 1400 }); });
  reg('labelPrint', 'INV', 'success', 'طباعة ملصقات', 'ثلاث نقراتٍ كطابعةٍ ثمّ نغمة', function () { [0, .05, .1].forEach(function (at) { noise({ from: 2000, to: 5000, dur: .03, gain: .06, at: at, band: true, q: 1 }); }); tone({ f: 660, dur: .12, gain: .09, at: .17 }); });
  reg('catNew', 'INV', 'success', 'إنشاء تصنيف', 'نغمتان جرسيّتان ولمعة', function () { arp([392, 523], { step: .08, dur: .2, gain: .13 }); tone({ f: 1047, dur: .25, gain: .06, at: .12 }); });
  ALIAS.INV_ADD = 'invAdd'; ALIAS.INV_EDIT = 'invEdit'; ALIAS.INV_DELETE = 'invDel'; ALIAS.INV_PHOTO = 'invPhoto'; ALIAS.INV_QTY = 'invQty'; ALIAS.INV_TRANSFER = 'invTransfer';
  ALIAS.INV_COUNT_START = 'countStart'; ALIAS.INV_COUNT_MATCH = 'countMatch'; ALIAS.INV_COUNT_MISMATCH = 'countMismatch'; ALIAS.INV_LABELS_PRINT = 'labelPrint'; ALIAS.INV_CAT_NEW = 'catNew';

  /* (OWN-09#40/#23) الأصوات المتكرّرة تُنوَّع نغمتها ±10–40 سنتاً · (OWN-09#47) زمن تهدئةٍ لكل مفتاح · (OWN-09#41) هرمية الجهارة */
  var JITTER = { click: 1, tick: 1, scan: 1, pop: 1, copy: 1, UI_CHECK: 1, UI_RADIO: 1, UI_TAB: 1, UI_HOVER: 1, UI_FOCUS: 1, FORM_KEY: 1, FORM_BACKSPACE: 1, FORM_ENTER: 1, invAdd: 1 };
  var CD = { click: 60, tick: 30, scan: 60, success: 250, warn: 400, error: 400, notify: 1500, update: 5000, offline: 3000, online: 3000 };
  var LOUD = { ui: .6, info: .8, success: .9, warn: 1, error: 1.1, critical: 1.2 };    /* النقرة أخفض من الخطأ */
  var HAP = { tap: [10], success: [20, 40, 20], warn: [40, 60, 40], error: [80, 50, 80], critical: [120, 60, 120, 60, 200] };
  var FX_BY_SEV = { success: 'flash-green', warn: 'flash-amber', error: 'shake flash-red', critical: 'shake flash-red pulse-border', info: 'pop', ui: 'pop' };

  /* (TASK-0032) أسماءٌ عربية لمعرض التجربة — بالترتيب الذي تُعرض به */
  var LABELS = [
    ['brand', 'العلامة الصوتية — فتح النظام'], ['pop', 'فقاعة — انبثاق الشعار والنوافذ'], ['nav', 'انتقال بين الشاشات'],
    ['click', 'نقرة زرّ'], ['back', 'رجوع'], ['open', 'فتح لوحة'], ['close', 'إغلاق لوحة'],
    ['login', 'تسجيل الدخول'], ['logout', 'تسجيل الخروج'], ['success', 'نجاح / حفظ'], ['warn', 'تنبيه'], ['error', 'خطأ'],
    ['cash', 'فاتورة / تحصيل'], ['moneyOut', 'مصروف / سحب'], ['order', 'أوردر جديد'], ['customer', 'عميل جديد'],
    ['del', 'حذف'], ['copy', 'نسخ'], ['scan', 'قراءة باركود'], ['tick', 'عدّاد الأرقام'],
    ['notify', 'وصول إشعار'], ['update', 'نسخة جديدة من النظام'], ['sync', 'مزامنة ما حُفظ بلا إنترنت'],
    ['download', 'اكتمال تنزيل'], ['offline', 'انقطاع الإنترنت'], ['online', 'عودة الإنترنت'],
    ['store', 'فتح المتجر'], ['warranty', 'فتح الكفالة'], ['truck', 'الشاحنة — التتبّع'], ['horn', 'زمّور الشاحنة']
  ];
  LABELS_NEW.forEach(function (x) { LABELS.push(x); });

  /* ── الإعدادات المحفوظة (OWN-12#7 · OWN-09#50) — كلّها في localStorage داخل try/catch ── */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function lsJson(k, d) { try { var o = JSON.parse(lsGet(k, '')); return (o && typeof o === 'object') ? o : d; } catch (_) { return d; } }
  var PROFILES = ['full', 'quiet', 'security', 'silent'];
  function getProfile() { var p = lsGet(LS_PROFILE, 'full'); return PROFILES.indexOf(p) >= 0 ? p : 'full'; }
  function fxPrefs() { return lsJson(LS_FXP, {}); }
  function hapticOn() { return fxPrefs().hap !== false; }
  function fxOn() { return fxPrefs().fx !== false && !prefersQuiet(); }
  function keysOn() { var a = lsJson(LS_KEYS, []); return Array.isArray(a) ? a : []; }

  /* هل يُسمَح بصوتٍ ما حسب البروفايل والفئة؟ (قيد مفاتيح «مطفأة افتراضياً» أيضاً) */
  function allowed(name) {
    var m = META[name] || { cat: 'SYS', sev: 'info' }, p = getProfile();
    if (p === 'silent') return false;
    if (p === 'security' && !(m.cat === 'SEC' || m.sev === 'critical')) return false;
    if (p === 'quiet' && m.sev === 'ui') return false;
    if (lsJson(LS_CATS, {})[m.cat] === false) return false;
    if (m.quiet && keysOn().indexOf(name) < 0) return false;
    return true;
  }

  /* ── (OWN-09#44) التأثيرات البصرية: <style> يُدرَج مرّةً واحدة، وكلّها داخل no-preference ── */
  function injectFxCss() {
    if (document.getElementById('gmt-fx-css')) return;
    var st = document.createElement('style'); st.id = 'gmt-fx-css';
    st.textContent = '@media (prefers-reduced-motion:no-preference){' +
      '@keyframes gfx-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}' +
      '@keyframes gfx-red{0%{box-shadow:0 0 0 0 rgba(213,0,28,.55)}100%{box-shadow:0 0 0 14px rgba(213,0,28,0)}}' +
      '@keyframes gfx-green{0%{box-shadow:0 0 0 0 rgba(22,163,74,.55)}100%{box-shadow:0 0 0 16px rgba(22,163,74,0)}}' +
      '@keyframes gfx-amber{0%{box-shadow:0 0 0 0 rgba(245,158,11,.6)}100%{box-shadow:0 0 0 14px rgba(245,158,11,0)}}' +
      '@keyframes gfx-pb{0%,100%{outline:2px solid transparent;outline-offset:2px}50%{outline:2px solid #D5001C;outline-offset:3px}}' +
      '@keyframes gfx-pop{0%{transform:scale(1)}40%{transform:scale(1.12)}100%{transform:scale(1)}}' +
      '@keyframes gfx-tick{0%{transform:translateY(0);opacity:1}40%{transform:translateY(-3px);opacity:.7}100%{transform:translateY(0);opacity:1}}' +
      '@keyframes gfx-bell{0%,100%{transform:rotate(0)}15%{transform:rotate(14deg)}30%{transform:rotate(-12deg)}45%{transform:rotate(8deg)}60%{transform:rotate(-6deg)}75%{transform:rotate(3deg)}}' +
      '@keyframes gfx-conf{to{transform:translate(var(--dx),var(--dy)) rotate(360deg);opacity:0}}' +
      '.gfx-shake{animation:gfx-shake .4s}.gfx-flash-red{animation:gfx-red .6s}.gfx-flash-green{animation:gfx-green .6s}.gfx-flash-amber{animation:gfx-amber .6s}' +
      '.gfx-pulse-border{animation:gfx-pb .6s 2}.gfx-pop{animation:gfx-pop .3s}.gfx-count-tick{animation:gfx-tick .25s}.gfx-bell-ring{transform-origin:top center;animation:gfx-bell .8s}' +
      '.gfx-conf{position:fixed;width:7px;height:7px;border-radius:2px;pointer-events:none;z-index:2147483600;animation:gfx-conf .9s ease-out forwards}' +
      '.gfx-edge{position:fixed;inset:0;pointer-events:none;z-index:2147483500;border-radius:0}}';
    (document.head || document.documentElement).appendChild(st);
  }
  function confetti(el) {
    var r = (el && el.getBoundingClientRect) ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2, cols = ['#D5001C', '#f59e0b', '#16a34a', '#2563eb', '#a855f7'];
    for (var i = 0; i < 20; i++) {
      var d = document.createElement('div'), a = Math.random() * Math.PI * 2, rad = 40 + Math.random() * 70;
      d.className = 'gfx-conf'; d.setAttribute('data-nosound', '');
      d.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;background:' + cols[i % cols.length] + ';--dx:' + Math.round(Math.cos(a) * rad) + 'px;--dy:' + Math.round(Math.sin(a) * rad) + 'px';
      document.body.appendChild(d);
      setTimeout((function (n) { return function () { try { n.remove(); } catch (_) {} }; })(d), 900);
    }
  }
  /* fx('shake flash-red', el) — يضيف صنفاً على العنصر ويزيله عند animationend (ولا شيء مع «تقليل الحركة») */
  function fx(name, el) {
    try {
      if (!name || !fxOn()) return false;
      injectFxCss();
      String(name).split(/\s+/).forEach(function (n) {
        if (!n) return;
        if (n === 'confetti-lite') { confetti(el); return; }
        var target = el;
        if (!target) {
          /* بلا عنصر: وميضٌ على حافّة الشاشة (لا نهزّ الصفحة كلّها) */
          if (!/^flash-/.test(n)) return;
          target = document.createElement('div'); target.className = 'gfx-edge'; target.setAttribute('data-nosound', '');
          document.body.appendChild(target);
          setTimeout(function () { try { target.remove(); } catch (_) {} }, 700);
        }
        var cls = 'gfx-' + n;
        target.classList.remove(cls); void target.offsetWidth; target.classList.add(cls);
        var done = function () { target.classList.remove(cls); target.removeEventListener('animationend', done); };
        target.addEventListener('animationend', done); setTimeout(done, 1300);
      });
      return true;
    } catch (_) { return false; }
  }
  /* (OWN-09#45) اهتزازٌ بنمطٍ حسب النوع مع كشف الدعم — يُرجع false إن لم يُدعَم (فيحلّ مكانه الوميض البصريّ في fire) */
  function buzz(kind) {
    try {
      if (!hapticOn() || !HAP[kind]) return false;
      if (global.navigator && 'vibrate' in global.navigator) { global.navigator.vibrate(HAP[kind]); return true; }
    } catch (_) {}
    return false;
  }

  /* ── التشغيل ───────────────────────────────────────────────────────── */
  var lastAt = {}, clickT = 0;
  function perform(name, fn, opt) {
    var m = META[name] || { sev: 'ui' };
    curMul = LOUD[m.sev] || 1;
    curDetune = JITTER[name] ? (Math.random() < .5 ? -1 : 1) * (10 + Math.random() * 30) : 0;
    try {
      /* (OWN-09#49) الاهتزاز ثم التأثير البصري ثم الصوت — في الإطار نفسه بلا setTimeout */
      if (opt.buzz !== false && (m.sev === 'success' || m.sev === 'warn' || m.sev === 'error' || m.sev === 'critical')) buzz(m.sev);
      if (opt.fx) fx(opt.fx === true ? (FX_BY_SEV[m.sev] || '') : opt.fx, opt.el);     /* (لا اهتزاز في الجهاز ⇒ التأثير البصريّ هو البديل) */
      fn();
    } finally { curDetune = 0; curMul = 1; }
  }
  function play(name, opt) {
    try {
      opt = opt || {};
      if (!SOUNDS[name] && ALIAS[name]) name = ALIAS[name];       /* (OWN-09#25) PREFIX_ACTION ⇒ الاسم القائم */
      if (!isOn()) return;
      var fn = SOUNDS[name];
      if (!fn) return;
      if (!opt.force && !allowed(name)) return;
      /* (OWN-12#29) الصوت المحدّد يتغلّب على النقرة العامّة المؤجَّلة في الحدث نفسه */
      if (name !== 'click' && clickT) { clearTimeout(clickT); clickT = 0; }
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
      /* (OWN-09#47) زمن تهدئةٍ لكل مفتاح — الأصوات الوصفيّة القصيرة 60ms، والباقي 150ms ما لم يُحدَّد */
      var nowT = Date.now(), cd = CD[name] != null ? CD[name] : ((META[name] && META[name].sev === 'ui') ? 60 : 150);
      if (!opt.force && lastAt[name] && nowT - lastAt[name] < cd) return;
      lastAt[name] = nowT;
      var c = ensure(); if (!c) return;
      if (c.state === 'suspended') { c.resume().catch(function () {}); }
      perform(name, fn, opt);
    } catch (_) { /* لا صوتَ يكسر صفحة */ }
  }

  /* (OWN-09#56) إن منع المتصفّح التشغيل بعد التفاعل الأوّل ⇒ شريطٌ صغير «فعّل الصوت» (مرّةً في الجلسة) */
  function unlockBanner() {
    try {
      if (document.getElementById('gmt-snd-unlock') || !isOn()) return;
      if (sessionStorage.getItem('gmt_snd_unlock_shown')) return;
      sessionStorage.setItem('gmt_snd_unlock_shown', '1');
      var b = document.createElement('button');
      b.id = 'gmt-snd-unlock'; b.type = 'button'; b.setAttribute('data-nosound', '');
      b.textContent = '🔈 فعّل الصوت';
      b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:2147482000;border:0;border-radius:999px;background:#0f172a;color:#fff;padding:9px 18px;font:700 13px Cairo,Tahoma,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer';
      b.onclick = function () {
        try { var c = ensure(); if (c) c.resume().then(function () { unlocked = true; play('pop', { force: true }); }).catch(function () {}); } catch (_) {}
        b.remove();
      };
      document.body.appendChild(b);
      setTimeout(function () { try { b.remove(); } catch (_) {} }, 12000);
    } catch (_) {}
  }
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      var c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(function () {});
      if (c) setTimeout(function () { try { if (c.state === 'suspended') { unlocked = false; unlockBanner(); } } catch (_) {} }, 300);
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
    b.title = (on ? 'الأصوات تعمل — اضغط للكتم' : 'الأصوات مكتومة — اضغط للتشغيل') + ' · اضغط مطوّلاً لمعرض الأصوات';
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
    b.onclick = function () { if (b.__lp) { b.__lp = 0; return; } setOn(!isOn()); };
    /* (TASK-0032) ضغطةٌ مطوّلة (أو زرّ الفأرة الأيمن) ⇒ معرض الأصوات */
    var lpT = null;
    b.addEventListener('pointerdown', function () { lpT = setTimeout(function () { b.__lp = 1; gallery(); }, 600); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { clearTimeout(lpT); }); });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); gallery(); });
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
    if (/عجز|زيادة في الصندوق/.test(t)) return 'CASH_MISMATCH';                         /* (OWN-09#32) قبل «خطأ» كي لا يبتلعه ⚠ */
    if (/^\s*(⚠|❌|⛔|🔴|✗|✖)/.test(t) || ERR_T.test(ty) || /تعذّر|تعذر|فشل|خطأ|غير صحيح|لم يُحفظ|لم تُحفظ|مرفوض/.test(t)) return 'error';
    if (WARN_T.test(ty)) return 'warn';
    if (/تسجيل الخروج|تمّ الخروج|تم الخروج/.test(t)) return 'logout';
    if (/تسجيل الدخول|أهلاً بعودتك/.test(t)) return 'login';
    /* (OWN-09#32 · #35) أنماطٌ مالية ونظامية قبل نمط cash */
    if (/دمج.*(عميل|زبون|عملاء|زبائن)/.test(t)) return 'CUST_MERGE';
    if (/تسديد|سُدّد الدين|سُدِّد/.test(t)) return 'DEBT_PAID';
    if (/تطابق الصندوق/.test(t)) return 'CASH_MATCH';
    if (/فتح الوردية|فُتحت الوردية/.test(t)) return 'SHIFT_OPEN';
    if (/إغلاق الوردية|أُغلقت الوردية/.test(t)) return 'SHIFT_CLOSE';
    if (/نسخة احتياطية|نسخةً احتياطية/.test(t)) return 'SYS_BACKUP_DONE';
    if (/تغيير (الثيم|الوضع)|الوضع (الداكن|الفاتح)/.test(t)) return 'SYS_THEME';
    if (/تغيير اللغة/.test(t)) return 'SYS_LANG';
    if (/مصروف|صرف|سحب|ترحيل|خُصم من الصندوق|نُقل.*من صندوق/.test(t)) return 'moneyOut';
    if (/نُسخ|تم النسخ/.test(t)) return 'copy';
    if (/تحصيل|دُفع|مدفوع|قُبض|سداد|الصندوق|عمولة|فاتورة.*(أُنشئت|حُفظت|اعتُمدت|تم)/.test(t)) return 'cash';
    if (/(عميل|زبون).*(أُضيف|إضافة|جديد|حُفظ|سُجّل)|(أُضيف|إضافة|سُجّل).*(عميل|زبون)/.test(t)) return 'customer';
    if (/(أوردر|طلب).*(أُنشئ|إنشاء|أُضيف|اعتماد)/.test(t)) return 'order';
    if (/حُذف|تم الحذف|محذوف|أُلغي|تم الإلغاء/.test(t)) return 'del';
    if (/نُزّل|تم التنزيل|تمّ التنزيل|اكتمل التنزيل|حُمّل الملف/.test(t)) return 'download';     /* (TASK-0032) */
    if (/مزامنة|تمّت المزامنة|تمت المزامنة|أُرسل ما حُفظ/.test(t)) return 'sync';
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
      /* (OWN-09#33) الرفض: قفلُ الحساب ⇒ SEC_LOCKED · كلمة مرورٍ/بياناتٌ خاطئة ⇒ SEC_BAD_PASSWORD · غير ذلك ⇒ error */
      try { Promise.resolve(p).then(function () { cue('login'); }, function (er) {
        var msg = String((er && (er.message || er)) || '');
        cue(/مقفل|قُفل|locked|too many|محاولات/i.test(msg) ? 'SEC_LOCKED' : (/كلمة|password|credential|invalid|غير صحيح|خاطئ|wrong/i.test(msg) ? 'SEC_BAD_PASSWORD' : 'error'));
      }); } catch (_) {}
      return p;
    };
    A.login.__gmtSnd = 1;
  }
  function hookAll() {
    ['showToast', 'toast'].forEach(wrapGlobalFn);
    wrapAccountLogin();
  }
  var CLICKABLE = 'button, [role="button"], a.btn, .btn, summary, .chip, .tab, .u-btn, [data-sound], [role="tab"], input[type="checkbox"], input[type="radio"]';
  document.addEventListener('click', function (e) {
    try {
      if (!isOn() || !unlocked) return;
      var el = e.target && e.target.closest && e.target.closest(CLICKABLE);
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[data-nosound]') || el.id === 'gmt-sound-btn') return;
      var ds = el.getAttribute('data-sound');
      if (ds === 'none') return;                                          /* (OWN-09#26) data-sound="none" ⇒ صمت */
      var dfx = el.getAttribute('data-fx'); if (dfx) fx(dfx, el);           /* data-fx ⇒ تأثيرٌ بصريّ مع الضغط */
      var n = Date.now(); if (n - lastClick < 70) return; lastClick = n;
      if (lastCueName === 'FORM_ENTER' && n - lastCue < 150 && e.detail === 0) return;      /* Enter يولّد نقرةً على زرّ الإرسال — لا صوتان */
      var cls = (typeof el.className === 'string' ? el.className : '') + ' ' + (el.getAttribute('data-act') || '') + ' ' + (el.getAttribute('data-danger') || '');
      var txt = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.title || '')).slice(0, 60);
      var name;
      if (ds && (SOUNDS[ds] || ALIAS[ds])) name = ds;
      else if (el.matches('input[type="checkbox"]')) name = 'UI_CHECK';
      else if (el.matches('input[type="radio"]')) name = 'UI_RADIO';
      else if (el.matches('[role="tab"], .tab')) name = 'UI_TAB';
      else if (el.matches('summary')) name = 'UI_ACCORDION';
      else name = /danger|trash|delete|remove|\bdel\b/i.test(cls) ? 'del' : (/(^|\s)(رجوع|عودة|السابق|back)(\s|$)/i.test(txt) || /\bback\b|data-back/.test(cls + ' ' + (el.id || '')) ? 'back' : 'click');
      lastCueName = name;
      if (name === 'click') {
        /* (OWN-12#29) النقرة العامّة تتأخّر ~40ms وتُلغى إن طُلب صوتٌ محدّد في الحدث نفسه (حفظ ⇒ success لا click+success) */
        if (clickT) clearTimeout(clickT);
        clickT = setTimeout(function () { clickT = 0; play('click'); }, 40);
      } else play(name);
    } catch (_) {}
  }, true);

  /* ═══ (TASK-0032 · المالك seq 307) أحداثُ النظام التي كانت صامتة — تُسمع من مكانٍ واحد بلا لمس الصفحات ═══
     • نسخة جديدة: gmt-pwa.js يبثّ «gmt-update-available» حين يظهر شريط «تتوفّر نسخة جديدة».
     • مزامنة: gmt-sync.js يبثّ «gmt-sync-done» حين يُرسَل ما حُفظ في الجهاز بلا إنترنت.
     • إشعار: gmt-notify.js يبثّ «gmt-notify-count» بالعدد ⇒ صوتٌ فقط حين يزيد عمّا رآه هذا الجهاز آخر مرّة.
     • تنزيل: الضغط على رابط تنزيل (a[download]) أو رسالةٌ تقول «نُزّل».
     • الشبكة: انقطاع الإنترنت وعودته (المتصفّح نفسه يخبر). */
  var NOTIFY_LS = 'gmt_notify_last_n';
  try {
    global.addEventListener('gmt-update-available', function () { cue('update'); });
    global.addEventListener('gmt-sync-done', function () { cue('sync'); });
    global.addEventListener('offline', function () { cue('offline'); });
    global.addEventListener('online', function () { cue('online'); });
    global.addEventListener('gmt-notify-count', function (e) {
      var n = Number(e && e.detail && e.detail.n) || 0, last = null;
      try { last = localStorage.getItem(NOTIFY_LS); localStorage.setItem(NOTIFY_LS, String(n)); } catch (_) {}
      if (last !== null && n > Number(last)) cue('notify');       /* أوّل مرّة على الجهاز: نحفظ فقط بلا صوت */
    });
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[download]');
      if (a) setTimeout(function () { cue('download'); }, 350);
    }, true);
  } catch (_) {}

  /* ═══ (OWN-09#34) أحداث المزامنة الجديدة — gmt-sync.js يبثّها بجانب gmt-sync-done ═══ */
  try {
    global.addEventListener('gmt-sync-pending', function () { cue('SYNC_PENDING'); });
    global.addEventListener('gmt-sync-retry', function () { cue('SYNC_RETRY'); });
    global.addEventListener('gmt-sync-fail', function () { cue('SYNC_FAIL'); });
    global.addEventListener('gmt-sync-conflict', function () { cue('SYNC_CONFLICT'); });
  } catch (_) {}

  /* ═══ (OWN-09#54 · OWN-12#38) أخطاء الصفحة غير الملتقَطة ⇒ صوت خطأ بحدّ مرّة كل ثانيتين ═══
     addEventListener لا window.onerror كي لا نكسر معالجات الصفحات، وأخطاء تحميل الموارد (صورة مكسورة) تُتجاهل. */
  var lastJsErr = 0;
  function jsErr(e) {
    try {
      if (e && e.target && e.target !== global && e.target !== document) return;
      var n = Date.now(); if (n - lastJsErr < 2000) return; lastJsErr = n;
      cue('error');
    } catch (_) {}
  }
  try { global.addEventListener('error', jsErr); global.addEventListener('unhandledrejection', jsErr); } catch (_) {}

  /* ═══ (OWN-09#26 · #27) مستمعات النماذج والحافظة والسحب — بتفويضٍ على document ═══ */
  function silent(t) { return !!(t && t.closest && t.closest('[data-nosound],[data-sound="none"]')); }
  try {
    document.addEventListener('invalid', function (e) {
      if (silent(e.target)) return;
      cue('FORM_INVALID'); fx('pulse-border', e.target);
    }, true);
    document.addEventListener('submit', function (e) {
      if (!isOn() || !unlocked || silent(e.target)) return;
      cue('FORM_SUBMIT_OK');
    }, true);
    document.addEventListener('keydown', function (e) {
      if (!isOn() || !unlocked) return;
      var t = e.target, tag = t && t.tagName;
      if (!(tag === 'INPUT' || tag === 'TEXTAREA') || silent(t) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' && tag === 'INPUT') cue('FORM_ENTER');
      else if (e.key === 'Backspace') { if (keysOn().indexOf('FORM_BACKSPACE') >= 0) play('FORM_BACKSPACE'); }
      else if (e.key && e.key.length === 1) { if (keysOn().indexOf('FORM_KEY') >= 0) play('FORM_KEY'); }       /* مطفأةٌ افتراضياً */
    }, true);
    document.addEventListener('input', function (e) {
      var t = e.target; if (!t || typeof t.value !== 'string') return;
      var had = !!t.__gmtHad; t.__gmtHad = t.value !== '';
      if (had && t.value === '' && !silent(t) && (t.type === 'search' || t.type === 'text' || t.tagName === 'TEXTAREA')) cue('FORM_CLEAR');
    }, true);
    document.addEventListener('paste', function (e) { if (!silent(e.target)) cue('UI_PASTE'); }, true);
    document.addEventListener('cut', function (e) { if (!silent(e.target)) cue('UI_CUT'); }, true);
    document.addEventListener('dragstart', function (e) { if (!silent(e.target)) cue('UI_DRAG'); }, true);
    document.addEventListener('drop', function (e) { if (!silent(e.target)) cue('UI_DROP'); }, true);
    document.addEventListener('focusin', function (e) {
      var t = e.target; if (!t || !t.matches || !t.matches('input,textarea,select') || silent(t)) return;
      if (keysOn().indexOf('UI_FOCUS') >= 0) play('UI_FOCUS');                       /* مطفأ افتراضياً */
    }, true);
  } catch (_) {}

  /* ═══ (OWN-09#51 · OWN-12#34) جدول الربط المركزي GMT_EVENT_MAP — يُعدَّل بلا لمس المحرّك ═══
     أيّ صفحة تعرّف window.GMT_EVENT_MAP قبل هذا الملف (أو تضيف إليه لاحقاً) فتتغلّب قيمُها على الافتراضيّ.
     كلّ بند: { key: مفتاح الصوت (أو اسمه المستعار) · fx: تأثيرٌ بصريّ اختياريّ }. */
  var EV_DEFAULT = {
    'order.created': { key: 'ORDER_CREATED', fx: 'pop' },
    'customer.created': { key: 'CUSTOMER_CREATED', fx: 'pop' },
    'sale.success': { key: 'POS_SALE_SUCCESS', fx: 'flash-green' },
    'scan.success': { key: 'POS_SCAN_SUCCESS' },
    'form.invalid': { key: 'FORM_INVALID', fx: 'pulse-border' },
    'form.submit.ok': { key: 'FORM_SUBMIT_OK', fx: 'flash-green' },
    'form.submit.fail': { key: 'FORM_SUBMIT_FAIL', fx: 'shake flash-red' },
    'error': { key: 'ERROR_GENERIC', fx: 'shake flash-red' },
    'warn': { key: 'WARN_GENERIC', fx: 'flash-amber' },
    'success': { key: 'SUCCESS_GENERIC', fx: 'flash-green' },
    'search.results': { key: 'SEARCH_RESULTS' }, 'search.empty': { key: 'SEARCH_EMPTY' },
    'list.filter': { key: 'LIST_FILTER' }, 'list.sort': { key: 'LIST_SORT' },
    'warranty.serial.ok': { key: 'WARRANTY_SERIAL_OK', fx: 'flash-green' }, 'warranty.expired': { key: 'WARRANTY_EXPIRED', fx: 'flash-amber' },
    'warranty.extend': { key: 'WARRANTY_EXTEND' }, 'warranty.claim.open': { key: 'WARRANTY_CLAIM_OPEN' }, 'warranty.claim.close': { key: 'WARRANTY_CLAIM_CLOSE' },
    'customer.edit': { key: 'CUST_EDIT' }, 'customer.merge': { key: 'CUST_MERGE' },
    'debt.add': { key: 'DEBT_ADD' }, 'debt.paid': { key: 'DEBT_PAID', fx: 'flash-green' }, 'loyalty.points': { key: 'LOYALTY_POINTS', fx: 'confetti-lite' },
    'invoice.overdue': { key: 'INVOICE_OVERDUE', fx: 'flash-amber' }, 'report.ready': { key: 'REPORT_READY' },
    'shift.open': { key: 'SHIFT_OPEN' }, 'shift.close': { key: 'SHIFT_CLOSE' },
    'cash.match': { key: 'CASH_MATCH', fx: 'flash-green' }, 'cash.mismatch': { key: 'CASH_MISMATCH', fx: 'flash-amber' },
    'security.badPassword': { key: 'SEC_BAD_PASSWORD', fx: 'shake' }, 'security.2fa.ok': { key: 'SEC_2FA_OK' }, 'security.2fa.fail': { key: 'SEC_2FA_FAIL', fx: 'shake' },
    'security.locked': { key: 'SEC_LOCKED', fx: 'shake flash-red' }, 'security.elevate': { key: 'SEC_ELEVATE' },
    'security.confirmDanger': { key: 'SEC_CONFIRM_DANGER' }, 'security.doubleConfirm': { key: 'SEC_DOUBLE_CONFIRM' },
    'security.suspicious': { key: 'SEC_SUSPICIOUS', fx: 'shake flash-red pulse-border' },
    'sync.pending': { key: 'SYNC_PENDING' }, 'sync.retry': { key: 'SYNC_RETRY' }, 'sync.fail': { key: 'SYNC_FAIL' }, 'sync.conflict': { key: 'SYNC_CONFLICT' },
    'sys.backup': { key: 'SYS_BACKUP_DONE' }, 'sys.updateInstalled': { key: 'SYS_UPDATE_INSTALLED' }, 'sys.storageFull': { key: 'SYS_STORAGE_FULL', fx: 'flash-amber' },
    'sys.sessionExpired': { key: 'SYS_SESSION_EXPIRED' }, 'sys.theme': { key: 'SYS_THEME' }, 'sys.lang': { key: 'SYS_LANG' }
  };
  /* (OWN-12#13) أحداث المخزون */
  Object.assign(EV_DEFAULT, {
    'inv.add': { key: 'invAdd', fx: 'flash-green' }, 'inv.edit': { key: 'invEdit' }, 'inv.delete': { key: 'invDel' }, 'inv.photo': { key: 'invPhoto', fx: 'flash-green' },
    'inv.qty': { key: 'invQty', fx: 'flash-green' }, 'inv.transfer': { key: 'invTransfer' }, 'inv.count.start': { key: 'countStart' },
    'inv.count.match': { key: 'countMatch', fx: 'flash-green' }, 'inv.count.mismatch': { key: 'countMismatch', fx: 'flash-amber' },
    'inv.labels.print': { key: 'labelPrint' }, 'inv.category.new': { key: 'catNew', fx: 'flash-green' }
  });
  try { global.GMT_EVENT_MAP = Object.assign({}, EV_DEFAULT, global.GMT_EVENT_MAP || {}); } catch (_) {}

  /* ═══ (OWN-09#50 · OWN-12#33) الواجهة العامّة GMTAudio ═══ */
  function setVolume(v) {
    v = Math.max(0, Math.min(1, Number(v)));
    if (isNaN(v)) return vol;
    vol = v; lsSet(LS_VOL, String(v));
    try { if (master) master.gain.value = 0.26 * vol; } catch (_) {}
    return vol;
  }
  function setProfile(p) { if (PROFILES.indexOf(p) < 0) return getProfile(); lsSet(LS_PROFILE, p); return p; }
  function toggleCategory(cat, on) {
    var m = lsJson(LS_CATS, {}), cur = m[cat] !== false, nxt = (on === undefined) ? !cur : !!on;
    if (nxt) delete m[cat]; else m[cat] = false;
    lsSet(LS_CATS, JSON.stringify(m)); return nxt;
  }
  function enableKey(key, on) {                                /* تفعيل/إطفاء صوتٍ «مطفأ افتراضياً» (FORM_KEY · UI_HOVER …) */
    var a = keysOn().filter(function (k) { return k !== key; });
    if (on !== false) a.push(key);
    lsSet(LS_KEYS, JSON.stringify(a)); return on !== false;
  }
  function setHaptics(on) { var p = fxPrefs(); p.hap = !!on; lsSet(LS_FXP, JSON.stringify(p)); return !!on; }
  function setFx(on) { var p = fxPrefs(); p.fx = !!on; lsSet(LS_FXP, JSON.stringify(p)); return !!on; }
  /* fire = الصوت + الاهتزاز + التأثير البصريّ معاً (OWN-09#49) — el = العنصر الذي يُحرَّك */
  function fire(key, o) {
    o = o || {}; var el = o.target || o.el || null;
    play(key, { fx: o.fx || true, el: el, force: !!o.force });
  }
  /* emit('order.created', {el}) — يقرأ GMT_EVENT_MAP؛ وإن لم يجد الحدث فيعامل الاسم كمفتاح صوتٍ مباشرةً */
  function emit(event, o) {
    try {
      o = o || {}; if (o.nodeType === 1) o = { el: o };
      var map = global.GMT_EVENT_MAP || {}, d = map[event];
      var key = d ? d.key : event, el = o.el || o.target || null;
      if (!SOUNDS[key] && !ALIAS[key]) return false;
      play(key, { fx: (d && d.fx) || true, el: el, force: !!o.force });
      lastCueName = (!SOUNDS[key] && ALIAS[key]) ? ALIAS[key] : key;
      return true;
    } catch (_) { return false; }
  }
  /* مدّة الصوت بالثواني — تقيسها بتشغيلٍ جافّ (tone/noise لا تُنشئان عقداً أثناء القياس) */
  var durCache = {};
  function duration(key) {
    if (!SOUNDS[key] && ALIAS[key]) key = ALIAS[key];
    if (DUR_FIXED[key]) return DUR_FIXED[key];
    if (durCache[key] != null) return durCache[key];
    var d = 0;
    try { measuring = true; mEnd = 0; SOUNDS[key](); d = mEnd; } catch (_) {} finally { measuring = false; }
    return (durCache[key] = Math.round(d * 100) / 100);
  }
  /* (OWN-09#55) أغلفةٌ اختيارية لـfetch: لا تعمل إلا إذا استُدعيت صراحةً —
     طلب كتابةٍ ناجح ⇒ success خافت · فشل شبكة/5xx ⇒ error. تُهمَل إن سُمع cue خلال 300ms (كي لا تتكرّر مع toast). */
  var fetchWrapped = false;
  function wrapFetch(o) {
    try {
      if (fetchWrapped || typeof global.fetch !== 'function') return false;
      fetchWrapped = true;
      var only = !o || o.onlyMutations !== false, f0 = global.fetch;
      global.fetch = function (input, init) {
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        var mut = method !== 'GET' && method !== 'HEAD';
        var p = f0.apply(this, arguments);
        if (only && !mut) return p;
        try {
          p.then(function (r) {
            setTimeout(function () { if (Date.now() - lastCue < 300) return; try { var nm = r && r.status >= 500 ? 'error' : (mut && r && r.ok ? 'success' : ''); if (nm) cue(nm); } catch (_) {} }, 320);
          }, function () { setTimeout(function () { if (Date.now() - lastCue >= 300) cue('error'); }, 320); });
        } catch (_) {}
        return p;
      };
      return true;
    } catch (_) { return false; }
  }

  /* ═══ (TASK-0032) معرضُ الأصوات — «ومعرضٌ تجرّبها منه» ═══
     يُفتح من أداة «🔊 معرض الأصوات» (home.html?sounds=1) أو بضغطةٍ مطوّلة على زرّ الصوت في الشريط.
     نافذةٌ وسط الشاشة (لا زرّ عائم): كلّ صوتٍ باسمه العربي وزرّ تشغيل، ومفتاح التشغيل/الكتم في أعلاها. */
  function gallery() {
    try {
      if (document.getElementById('gmt-snd-gal')) return;
      var ov = document.createElement('div');
      ov.id = 'gmt-snd-gal';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'معرض الأصوات');
      /* (OWN-09#60) ألوانٌ بمتغيّرات CSS مع الوضع الداكن · safe-area لشاشات النوتش */
      var css = '#gmt-snd-gal{--g-bg:#f8fafc;--g-card:#fff;--g-bd:#e2e8f0;--g-tx:#0f172a;--g-mut:#64748b;--g-on:#fef3c7;position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:calc(14px + env(safe-area-inset-top,0px)) calc(14px + env(safe-area-inset-right,0px)) calc(14px + env(safe-area-inset-bottom,0px)) calc(14px + env(safe-area-inset-left,0px));direction:rtl;font-family:Cairo,Tahoma,sans-serif}' +
        '@media (prefers-color-scheme:dark){#gmt-snd-gal{--g-bg:#0f172a;--g-card:#1e293b;--g-bd:#334155;--g-tx:#f1f5f9;--g-mut:#94a3b8;--g-on:#422006}}' +
        '#gmt-snd-gal .g-win{background:var(--g-bg);color:var(--g-tx);border-radius:18px;width:min(480px,100%);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.3)}' +
        '#gmt-snd-gal .g-btn{border:1px solid var(--g-bd);background:var(--g-card);color:var(--g-tx);border-radius:10px;padding:6px 12px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer}' +
        '#gmt-snd-gal .g-chip{border:1px solid var(--g-bd);background:var(--g-card);color:var(--g-tx);border-radius:999px;padding:4px 11px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}' +
        '#gmt-snd-gal .g-chip.on{background:#D5001C;color:#fff;border-color:#D5001C}' +
        '#gmt-snd-gal .g-card{background:var(--g-card);border:1px solid var(--g-bd);border-radius:12px;padding:9px 11px;display:grid;gap:5px}' +
        '#gmt-snd-gal .g-card.hl{background:var(--g-on);border-color:#f59e0b}' +
        '#gmt-snd-gal .g-play{display:flex;align-items:center;gap:10px;width:100%;text-align:start;background:transparent;border:0;padding:0;font:inherit;font-size:13.5px;font-weight:700;color:var(--g-tx);cursor:pointer}' +
        '#gmt-snd-gal .g-ico{flex:none;width:30px;height:30px;border-radius:50%;background:#D5001C;color:#fff;display:grid;place-items:center;font-size:12px}' +
        '#gmt-snd-gal .g-badge{flex:none;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;color:#fff}' +
        '#gmt-snd-gal .g-meta{font-size:11.5px;color:var(--g-mut);display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
        '#gmt-snd-gal code{direction:ltr;unicode-bidi:embed;background:var(--g-bg);border:1px solid var(--g-bd);border-radius:6px;padding:0 5px;font-size:11px}' +
        '#gmt-snd-gal h4{margin:10px 0 2px;font-size:13px;color:var(--g-mut)}';
      var BADGE = { ui: ['#64748b', 'واجهة'], info: ['#475569', 'معلومة'], success: ['#16a34a', 'نجاح'], warn: ['#d97706', 'تحذير'], error: ['#dc2626', 'خطأ'], critical: ['#7f1d1d', 'حرج'] };
      var labelOf = {}; LABELS.forEach(function (x) { labelOf[x[0]] = x[1]; });
      /* (OWN-09#58) الأصوات مجمّعةً تحت فئاتها بإيموجي؛ ما بلا فئة تحت «أخرى» */
      var groups = CATS.map(function (c) { return { id: c[0], l: c[1], items: [] }; }), other = { id: 'OTHER', l: '🎵 أخرى', items: [] };
      LABELS.filter(function (x) { return SOUNDS[x[0]]; }).forEach(function (x) {
        var cat = (META[x[0]] || {}).cat, g = groups.filter(function (z) { return z.id === cat; })[0] || other;
        g.items.push(x);
      });
      groups.push(other);
      groups = groups.filter(function (g) { return g.items.length; });
      var chips = '<button type="button" class="g-chip on" data-snd-cat="" data-nosound>الكل</button>' + groups.map(function (g) {
        return '<button type="button" class="g-chip" data-snd-cat="' + g.id + '" data-nosound>' + g.l + '</button>';
      }).join('');
      var rows = groups.map(function (g) {
        return '<h4 data-cat-h="' + g.id + '">' + g.l + '</h4>' + g.items.map(function (x) {
          var m = META[x[0]] || { sev: 'ui' }, bd = BADGE[m.sev] || BADGE.ui, d = duration(x[0]);
          return '<div class="g-card" data-cat="' + g.id + '" data-key="' + x[0] + '">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
              '<button type="button" class="g-play" data-snd="' + x[0] + '" data-nosound>' +
                '<span class="g-ico" aria-hidden="true">▶</span><span style="flex:1">' + x[1] + '</span></button>' +
              '<span class="g-badge" style="background:' + bd[0] + '">' + bd[1] + '</span></div>' +
            '<div class="g-meta"><span>' + (DESC[x[0]] || ('يُشغَّل عند: ' + x[1])) + '</span></div>' +
            '<div class="g-meta"><code>' + x[0] + '</code><span>' + d + ' ث</span>' +
              '<button type="button" class="g-btn" data-snd-fx="' + x[0] + '" data-nosound style="margin-inline-start:auto;padding:3px 9px;font-size:11.5px">✨ جرّب التأثير الكامل</button></div></div>';
        }).join('');
      }).join('');
      ov.innerHTML = '<style>' + css + '</style><div class="g-win">' +
        '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--g-bd)">' +
          '<b style="flex:1;font-size:16px">🔊 معرض الأصوات</b>' +
          '<button type="button" class="g-btn" data-snd-toggle data-nosound></button>' +
          '<button type="button" data-snd-x data-nosound aria-label="إغلاق" style="border:0;background:transparent;font-size:20px;cursor:pointer;color:var(--g-mut)">✕</button></div>' +
        '<div style="padding:8px 16px 4px;font-size:12px;color:var(--g-mut)">اضغط أيّ صوت لتسمعه. الأصوات كلّها مصنوعة داخل النظام (بلا ملفّات · تعمل بلا إنترنت).</div>' +
        '<div style="padding:4px 16px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--g-mut)"><span>🔉 المستوى</span>' +
          '<input type="range" min="0" max="1" step="0.05" data-snd-vol data-nosound style="flex:1" aria-label="مستوى الصوت"></div>' +
        '<div style="padding:4px 16px;display:flex;gap:6px;overflow-x:auto">' + chips + '</div>' +
        '<div style="padding:4px 16px;display:flex;gap:8px"><button type="button" class="g-btn" data-snd-all data-nosound>▶▶ تشغيل الكل</button>' +
          '<button type="button" class="g-btn" data-snd-export data-nosound>⬇ تصدير جدول الربط (JSON)</button></div>' +
        '<div data-snd-list style="overflow:auto;padding:4px 16px calc(16px + env(safe-area-inset-bottom,0px));display:grid;gap:8px">' + rows + '</div></div>';
      var vslider = ov.querySelector('[data-snd-vol]'); vslider.value = vol;
      var allRun = 0;
      function paint() {
        var t = ov.querySelector('[data-snd-toggle]'); if (!t) return;
        var on = isOn(); t.textContent = on ? 'الأصوات تعمل — كتم' : 'الأصوات مكتومة — تشغيل';
        t.style.color = on ? '' : '#D5001C';
      }
      function filterCat(cat) {
        [].forEach.call(ov.querySelectorAll('[data-snd-cat]'), function (c) { c.classList.toggle('on', c.getAttribute('data-snd-cat') === cat); });
        [].forEach.call(ov.querySelectorAll('.g-card'), function (c) { c.style.display = (!cat || c.getAttribute('data-cat') === cat) ? '' : 'none'; });
        [].forEach.call(ov.querySelectorAll('[data-cat-h]'), function (h) { h.style.display = (!cat || h.getAttribute('data-cat-h') === cat) ? '' : 'none'; });
      }
      /* «تشغيل الكل بالترتيب»: تمريرٌ وإبرازٌ للبطاقة طوال مدّة صوتها */
      function playAll() {
        var cards = [].filter.call(ov.querySelectorAll('.g-card'), function (c) { return c.style.display !== 'none'; }), i = 0, my = ++allRun;
        var btn = ov.querySelector('[data-snd-all]'); btn.textContent = '■ إيقاف';
        (function next() {
          if (my !== allRun || i >= cards.length || !document.body.contains(ov)) { btn.textContent = '▶▶ تشغيل الكل'; return; }
          var c = cards[i++], k = c.getAttribute('data-key');
          try { c.scrollIntoView({ block: 'center' }); } catch (_) {}
          c.classList.add('hl'); play(k, { force: true });
          setTimeout(function () { c.classList.remove('hl'); next(); }, Math.max(350, duration(k) * 1000 + 250));
        })();
      }
      ov.addEventListener('input', function (e) { if (e.target.closest('[data-snd-vol]')) setVolume(e.target.value); });
      ov.addEventListener('click', function (e) {
        var b = e.target.closest('[data-snd]');
        if (b) { unlock(); if (!isOn()) { paint(); return; } play(b.getAttribute('data-snd'), { force: true }); return; }
        var fb = e.target.closest('[data-snd-fx]');
        if (fb) { unlock(); if (!isOn()) { paint(); return; } fire(fb.getAttribute('data-snd-fx'), { target: fb.closest('.g-card'), force: true }); return; }
        var ch = e.target.closest('[data-snd-cat]'); if (ch) { filterCat(ch.getAttribute('data-snd-cat')); return; }
        if (e.target.closest('[data-snd-all]')) { unlock(); if (allRun && ov.querySelector('[data-snd-all]').textContent.indexOf('إيقاف') >= 0) { allRun++; ov.querySelector('[data-snd-all]').textContent = '▶▶ تشغيل الكل'; } else if (isOn()) playAll(); return; }
        if (e.target.closest('[data-snd-export]')) { exportMap(); return; }
        if (e.target.closest('[data-snd-toggle]')) { unlock(); setOn(!isOn()); paint(); return; }
        if (e.target === ov || e.target.closest('[data-snd-x]')) { allRun++; ov.remove(); }
      });
      document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { allRun++; ov.remove(); document.removeEventListener('keydown', esc); } });
      document.body.appendChild(ov); paint();
    } catch (_) {}
  }
  /* (OWN-09#62) تصدير جدول الربط (JSON): الأحداث ⇐ المفاتيح + كلّ الأصوات بفئاتها وأنواعها ومددها + الأسماء المستعارة */
  function mapJson() {
    var sounds = Object.keys(SOUNDS).map(function (k) { var m = META[k] || {}; return { key: k, cat: m.cat || null, sev: m.sev || null, dur: duration(k), quiet: !!m.quiet }; });
    return JSON.stringify({ events: global.GMT_EVENT_MAP || {}, alias: ALIAS, sounds: sounds }, null, 2);
  }
  function exportMap() {
    try {
      var blob = new Blob([mapJson()], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'gmt-event-map.json'; a.setAttribute('data-nosound', '');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (_) {} }, 3000);
    } catch (_) {}
  }

  /* GMTAudio = الاسم الجديد للواجهة نفسها (GMTSound يبقى اسماً مستعاراً) */
  global.GMTSound = {
    play: play, unlock: unlock, cue: cue, classify: classifyToast,
    on: function () { setOn(true); }, off: function () { setOn(false); },
    toggle: function () { setOn(!isOn()); },
    isOn: isOn, list: Object.keys(SOUNDS), labels: LABELS,
    mount: mountToggle, gallery: gallery,
    ready: function () { return !!unlocked && isOn(); },   /* (TASK-A0523) هل يُسمَع الصوت الآن (بعد أوّل لمسة)؟ — عدّادات التوظيف تعيد العدّ بصوت إن لم يكن */
    last: function () { return lastCueName; },   /* (TASK-0032) آخر حدثٍ صوتيّ — للاختبار */
    /* (OWN-09#50 · OWN-12#33) الواجهة العامّة */
    emit: emit, fire: fire, setVolume: setVolume, getVolume: function () { return vol; },
    mute: function () { setOn(false); }, unmute: function () { setOn(true); },
    setProfile: setProfile, getProfile: getProfile, toggleCategory: toggleCategory, enableKey: enableKey,
    setHaptics: setHaptics, setFx: setFx, fx: fx, buzz: buzz, wrapFetch: wrapFetch,
    alias: ALIAS, meta: META, cats: CATS, desc: DESC, duration: duration, eventMap: function () { return global.GMT_EVENT_MAP; }, exportMap: mapJson
  };
  global.GMTAudio = global.GMTSound;

  /* ═══ (OWN-09#53) مراقِب DOM: فتح/إغلاق المودالات تلقائياً + حاويات data-snd-watch ═══
     • أيّ عنصرٍ مودال (.modal-overlay · [role=dialog] · <dialog> · [id$=Modal] · [id$=-modal]) يتبدّل ظهوره ⇒ صوت «open»/«close».
     • حاوية بسمة data-snd-watch="order.created" تُضاف إليها عناصرُ أبناء (فاتورة جديدة · سطر طلب) ⇒ emit(الحدث) مرّةً لكلّ دفعة.
     • data-nosound على العنصر أو أحد آبائه ⇒ صمت. بلا أيّ صوتٍ عند أوّل رسم للصفحة (يُسجَّل الوضع الأوّل صامتاً). */
  var MODAL_SEL = '.modal-overlay,[role="dialog"],dialog,[id$="Modal"],[id$="-modal"]';
  function modalOpen(el) {
    try {
      if (el.tagName === 'DIALOG') return !!el.open;
      if (el.classList.contains('hidden')) return false;
      if (el.classList.contains('modal-overlay')) return el.classList.contains('active');
      var cs = getComputedStyle(el);
      return !(cs.display === 'none' || cs.visibility === 'hidden');
    } catch (_) { return false; }
  }
  function watchDom() {
    var MO = global.MutationObserver; if (!MO || !document.body || global.__gmtSndMO) return;
    global.__gmtSndMO = true;
    var seen = new WeakMap(), batchT = null, batchEv = {};
    function quiet(el) { try { return !!(el.closest && el.closest('[data-nosound]')); } catch (_) { return false; } }
    function check(el, first) {
      if (!el || el.nodeType !== 1 || !el.matches || !el.matches(MODAL_SEL)) return;
      var now = modalOpen(el), prev = seen.get(el); seen.set(el, now);
      if (prev === undefined && !first) { if (now && !quiet(el)) emit('open'); return; }
      if (prev !== undefined && prev !== now && !quiet(el)) emit(now ? 'open' : 'close');
    }
    try { document.querySelectorAll(MODAL_SEL).forEach(function (el) { seen.set(el, modalOpen(el)); }); } catch (_) {}
    new MO(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.type === 'attributes') { check(r.target, false); continue; }
        var ad = r.addedNodes;
        for (var j = 0; j < ad.length; j++) {
          var n = ad[j]; if (!n || n.nodeType !== 1) continue;
          check(n, false);
          var w = r.target && r.target.closest && r.target.closest('[data-snd-watch]');
          if (w && !quiet(w)) batchEv[w.getAttribute('data-snd-watch')] = w;
        }
      }
      if (Object.keys(batchEv).length && !batchT) batchT = setTimeout(function () {
        var b = batchEv; batchEv = {}; batchT = null;
        Object.keys(b).forEach(function (ev) { emit(ev, { el: b[ev] }); });
      }, 60);
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'open', 'hidden', 'style'] });
  }
  global.GMTSound.watch = watchDom;

  function boot() {
    mountToggle();
    /* إن لم يوجد شريطُ خيارات بعد، نحاول مرّةً أخرى بعد أن تُركّبه الصفحة */
    setTimeout(mountToggle, 1200);
    setTimeout(mountToggle, 3000);
    /* لفّ دوالّ الرسائل بعد أن تعرّفها الصفحة (بعضها يُعرَّف متأخّراً) */
    hookAll(); setTimeout(hookAll, 800); setTimeout(hookAll, 2500); setTimeout(hookAll, 6000);
    try { if (/[?&]sounds=1\b/.test(location.search)) setTimeout(gallery, 400); } catch (_) {}   /* (TASK-0032) أداة «معرض الأصوات» */
    try { watchDom(); } catch (_) {}   /* (OWN-09#53) */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
