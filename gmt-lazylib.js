/* ═══════════════════════════════════════════════════════════════════════════
   gmt-lazylib.js — المكتبات الثقيلة تُحمَّل عند الحاجة لا عند الإقلاع
   أُنشئ: 2026-10-03

   🔴 بلاغ المالك (١٦٩): «في تعليق عام كبير بالنظام».

   لم أخمّن السبب — قِسته. `فحص_التعليق_العام.js` على معالجٍ مخنوق ×٢٠
   (قياسُ موبايل فرعٍ لا حاسوب تطوير) أعطى:

       الجرد      : أوّل رسم ٥١٤٤ms · حجبٌ كلّي ٧٩٤٥ms · أسوأ مهمّة ٢٢٩٨ms
       المشتريات  : أوّل رسم ٤٣٩٢ms · حجبٌ كلّي ٦٩٧٣ms · أسوأ مهمّة ٣٣٥٤ms

   و«أسوأ مهمّة» تعني حرفياً: ٢٫٣ ثانية لا تستجيب الشاشة للمسّ. هذا هو
   التعليق الذي يشكو منه المالك، وهذا مصدره:

       exceljs.min.js      ٩٤٧ كيلوبايت
       xlsx.full.min.js    ٨٨١ كيلوبايت   ← ومكتبتا Excel **معاً** على نفس الصفحة
       pdf.min.js          ٢٨١ كيلوبايت
       html2canvas.min.js  ١٩٨ كيلوبايت
       ──────────────────────────────
       ٢٫٣ ميغابايت تُنزَّل وتُحلَّل وتُترجَم في **كل** فتحة صفحة

   ولا سطرَ منها يلزم لعرض قائمة المنتجات: الأولى للتصدير، والثانية للاستيراد،
   والثالثة لقراءة PDF، والرابعة لتحويل ورقةٍ إلى صورة. أي: الموظّف يدفع ثمن
   أدواتٍ لم يضغط عليها.

   الحلّ: تُسجَّل هنا ولا تُحمَّل، وتُحمَّل عند أوّل استعمالٍ فعلي:

       await GMTLazyLib.need('xlsx');      // ثمّ استعمل XLSX بأمان
       await GMTLazyLib.need('exceljs');   // ثمّ ExcelJS
       await GMTLazyLib.need('pdfjs');     // ثمّ pdfjsLib
       await GMTLazyLib.need('html2canvas');

   ⚠️ القاعدة التي تمنع العطل الصامت: من ينسى `await` سيجد `XLSX غير معرَّف`.
   ولذلك لا نكتفي بالوعد — يوجد ملفّ فحصٍ (`فحص_المكتبات_المؤجلة.js`) يُثبت
   أمرين: (١) المكتبات غائبةٌ فعلاً عند الإقلاع، (٢) كل موضع استعمالٍ في
   الكود محروسٌ بـ`need`. وأُثبتت الأداة بكسرٍ مقصود قبل أن تُعتمد.

   ⚠️ ولا نُخفي الفشل: إن تعذّر التحميل (بلا إنترنت أوّل مرّة) تظهر رسالةٌ
   تقول أيّ أداةٍ لم تُحمَّل ولماذا، بدل زرٍّ لا يفعل شيئاً.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTLazyLib) return;

  var V = '?v=20261003';

  /* السجلّ: الاسم ⇒ { src, probe } — و`probe` كيف نعرف أنّها حُمِّلت فعلاً */
  var REG = {
    xlsx:        { src: 'lib/xlsx.full.min.js',   probe: function () { return !!global.XLSX; },        label: 'قارئ/كاتب Excel' },
    exceljs:     { src: 'lib/exceljs.min.js',     probe: function () { return !!global.ExcelJS; },     label: 'مُصدِّر Excel المنسَّق' },
    pdfjs:       { src: 'lib/pdf.min.js',         probe: function () { return !!global.pdfjsLib; },    label: 'قارئ PDF' },
    html2canvas: { src: 'lib/html2canvas.min.js', probe: function () { return !!global.html2canvas; }, label: 'محوّل الورقة إلى صورة' }
  };

  var inflight = {};   /* الاسم ⇒ Promise — ضغطتان متتاليتان لا تُنزّلان مرّتين */

  function inject(src) {
    return new Promise(function (resolve, reject) {
      /* إن كان وسمُ السكربت موجوداً أصلاً في الصفحة (صفحةٌ لم تُهاجَر بعد)
         فلا نُضيف ثانياً — ننتظره هو. */
      var existing = document.querySelector('script[data-lazylib="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('فشل تحميل ' + src)); });
        return;
      }
      var s = document.createElement('script');
      s.src = src + V;
      s.async = false;                 /* ترتيبٌ محفوظ إن طُلبت أكثر من واحدة */
      s.dataset.lazylib = src;
      s.addEventListener('load', function () { s.dataset.loaded = '1'; resolve(); });
      s.addEventListener('error', function () { reject(new Error('فشل تحميل ' + src)); });
      document.head.appendChild(s);
    });
  }

  function say(msg, kind) {
    try {
      if (typeof global.showToast === 'function') { global.showToast(msg, kind === 'err' ? 'err' : 'ok'); return; }
      if (typeof global.toast === 'function') { global.toast(msg); return; }
    } catch (_) {}
    if (kind === 'err') console.error('[GMT] ' + msg); else console.log('[GMT] ' + msg);
  }

  global.GMTLazyLib = {
    /* أسماء المكتبات المُدارة — يقرؤها ملفّ الفحص */
    names: Object.keys(REG),

    /* هل هذه المكتبة محمَّلةٌ الآن؟ */
    ready: function (name) {
      var e = REG[name];
      return !!(e && e.probe());
    },

    /* يُحمِّل المكتبة إن لم تكن محمَّلة. يُرجع Promise. */
    need: function (name) {
      var e = REG[name];
      if (!e) return Promise.reject(new Error('مكتبةٌ غير مسجَّلة: ' + name));
      if (e.probe()) return Promise.resolve();
      if (inflight[name]) return inflight[name];

      var slow = setTimeout(function () { say('⏳ جارٍ تحضير ' + e.label + '…'); }, 400);

      inflight[name] = inject(e.src)
        .then(function () {
          clearTimeout(slow);
          if (!e.probe()) {
            /* حُمِّل الملفّ ولم يظهر المتغيّر العام ⇒ ملفٌّ تالف أو اسمٌ تغيّر.
               نقولها صراحةً بدل أن يفشل الاستعمال بعدها بسطر. */
            throw new Error(e.label + ': حُمِّل الملفّ ولم تظهر الأداة (' + e.src + ')');
          }
        })
        .catch(function (err) {
          clearTimeout(slow);
          delete inflight[name];     /* محاولةٌ ثانية مسموحة */
          var why = (global.GMTWhy && global.GMTWhy.say)
            ? global.GMTWhy.say(err, { what: e.label })
            : null;
          say('⚠️ ' + (why && why.text ? why.text : (e.label + ' لم تُحمَّل: ' + err.message) +
              ' — إن كنت بلا إنترنت، اتّصل مرّةً واحدة ثمّ أعد المحاولة.'), 'err');
          throw err;
        });

      return inflight[name];
    },

    /* عدّة مكتباتٍ معاً: await GMTLazyLib.needAll(['xlsx','exceljs']) */
    needAll: function (list) {
      return Promise.all((list || []).map(function (n) { return global.GMTLazyLib.need(n); }));
    }
  };
})(window);
