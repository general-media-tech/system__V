/* ═══════════════════════════════════════════════════════════════════════════
   gmt-share.js — مشاركةُ PDF/صورة في كل مكان، لا حفظٌ وطباعةٌ فقط
   أُنشئ: 2026-10-03 · طلبك ١٢٠ — أُعيدت كتابته 2026-10-11

   طلبُك الأوّل: «زرّ **مشاركة PDF** في كل مكان لا حفظ وطباعة فقط».
   وطلبُك الجديد: «شارك الـPDF **بدون طباعة**» + «لا خدمة خارجية لإنشاء الصور» + «العربية مشوّهة».

   ما يفعله هذا الملفّ الآن:
     ① **يبني الملفّ أوّلاً** (PDF أو صورة) عبر المُصيِّر الداخلي GMTRender (gmt-render.js):
        المتصفّح نفسه يرسم الورقة بخطّ Cairo المستضاف — لا خدمة خارجية ولا html2canvas أوّلاً.
     ② ثم يُسلّمه للوحة المشاركة الأصلية `navigator.share({files})`.
        • المتصفّحات تشترط «نقرةً حديثة» (≈٥ث) للمشاركة، والبناء قد يطول ⇒ إن انقضى الوقت أو رُفضت
          (NotAllowedError) تظهر نافذةُ «الملفّ جاهز» بأزرار [شارك] [نزّل] [انسخ الصورة]، ونقرتُك عليها تُجدّد الإذن.
        • إلغاؤك من لوحة المشاركة (AbortError) = صمتٌ تامّ، لا رسالة خطأ.
        • الجهاز بلا مشاركة ملفّات (كمبيوتر) ⇒ **تنزيلٌ مباشر** للملفّ، وللصورة نسخٌ للحافظة أيضاً
          لتلصقها في واتساب ويب. ❌ لا يُفتح حوار الطباعة أبداً من هنا.
     ③ حوار الطباعة صار **زرّ «طباعة» الصريح فقط** (`GMTShare.print`).

   الاستعمال:
     GMTShare.sheet(htmlString, 'فاتورة-123', { width: 660 })   // PDF لورقةٍ جاهزة
     GMTShare.image(htmlString, 'GMT-order.jpg', { text, width: 660, scale: 1200/660 })
     GMTShare.element(el, 'تقرير-اليوم')                          // عنصرٌ في الصفحة (PDF)
     GMTShare.deliver(blob, 'name.pdf', { text, t0 })             // تسليم ملفّ جاهز (مشاركة/نزّل/انسخ)
     GMTShare.button({ get: () => html, name: 'x' })              // زرّ جاهز
     GMTShare.print(html, 'title')                                 // طباعة صريحة فقط
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTShare) return;

  /* مسار هذا الملف: لتحميل gmt-render.js بجواره في الصفحات التي لا تحمل وسمه (الكفالة/الجرد/نقطة البيع) */
  var SELF = '', SELF_Q = '';
  try {
    var _cs = document.currentScript;
    if (_cs && _cs.src) {
      SELF = _cs.src.replace(/[?#].*$/, '').replace(/[^\/]*$/, '');
      SELF_Q = (_cs.src.match(/\?[^#]*/) || [''])[0];   /* نفس رمز الإصدار ?v= ⇒ يتجدّد مع رفع الإصدار بلا رقمٍ مكتوب هنا */
    }
  } catch (e) {}

  var STALE_MS = 4000;      /* بعد هذه المدّة من النقرة نفترض انتهاء «التنشيط العابر» فلا نجرّب share مباشرة */
  var _busy = false;

  function say(msg, kind) {
    try {
      if (typeof global.showToast === 'function') { global.showToast(msg, kind === 'err' ? 'err' : 'ok'); return; }
      if (typeof global.toast === 'function') { global.toast(msg, kind === 'err' ? 'err' : 'ok'); return; }
    } catch (e) {}
    console.log('[GMT] ' + msg);
  }

  /* هل يستطيع هذا الجهاز مشاركةَ ملفّ فعلاً؟
     ⚠️ `navigator.share` وحدَها لا تكفي: أجهزةٌ تدعم مشاركة النصّ ولا تدعم
     الملفّات. ولذلك نسأل `canShare({files})` — وهذا هو الفحص الصحيح. */
  function canShareFiles(file) {
    try {
      if (!global.navigator || !navigator.share || !navigator.canShare) return false;
      var f = file || new File([new Blob(['x'], { type: 'text/plain' })], 'p.txt', { type: 'text/plain' });
      return !!navigator.canShare({ files: [f] });
    } catch (e) { return false; }
  }

  /* يُغلّف ورقةً بصفحةٍ كاملةٍ صالحةٍ للطباعة إن كانت جزءاً فقط */
  function wrap(html, title) {
    if (/<html[\s>]/i.test(html)) return html;
    return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + String(title || 'مستند').replace(/[<>&]/g, '') + '</title>' +
      '<style>body{font-family:Cairo,Tajawal,system-ui,sans-serif;margin:0;padding:14px;' +
      'background:#fff;color:#111;direction:rtl}' +
      '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}' +
      '@page{margin:8mm}</style></head><body>' + html + '</body></html>';
  }

  /* ── الطباعة: **زرّ «طباعة» الصريح فقط** — لا تُستعمل كمسارٍ احتياطيّ للمشاركة ── */
  function printSheet(html, title) {
    return new Promise(function (resolve) {
      var fr = document.createElement('iframe');
      fr.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;height:1123px;border:0;visibility:hidden;';
      document.body.appendChild(fr);
      var done = false;
      var finish = function () {
        if (done) return; done = true;
        setTimeout(function () { try { fr.remove(); } catch (e) {} }, 1200);
        resolve(true);
      };
      fr.onload = function () {
        try {
          var w = fr.contentWindow;
          setTimeout(function () {
            try { w.focus(); w.print(); } catch (e) {}
            finish();
          }, 260);
        } catch (e) { finish(); }
      };
      setTimeout(finish, 9000);                 /* حارسٌ زمني — لا تعليق */
      fr.srcdoc = wrap(html, title);
    });
  }

  /* ── تحميل المُصيِّر الداخلي عند الحاجة (الصفحات التي لا تحمله في وسومها) ── */
  var _renderP = null;
  function ensureRender() {
    if (global.GMTRender) return Promise.resolve(global.GMTRender);
    if (_renderP) return _renderP;
    _renderP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      var tag = document.querySelector('script[src*="gmt-render.js"]');   /* الصفحة تحمل الوسم ⇒ نفس الرابط بالضبط */
      s.src = tag ? tag.src : ((SELF || '') + 'gmt-render.js' + SELF_Q);
      s.onload = function () { global.GMTRender ? res(global.GMTRender) : rej(new Error('GMTRender')); };
      s.onerror = function () { _renderP = null; rej(new Error('تعذّر تحميل مُصيِّر الصور')); };
      document.head.appendChild(s);
    });
    return _renderP;
  }

  /* ── بناء الملفّات ── */
  var RENDER_MSG = 'تعذّر تجهيز الملفّ على هذا الجهاز. حدّث الصفحة وأعد المحاولة.';
  function safeName(n) { return String(n || 'مستند').replace(/[\\/:*?"<>|]/g, '-'); }

  async function buildPdf(html, name, opt) {
    opt = opt || {};
    var R = await ensureRender();
    return R.toPdf(wrap(html, name), { title: safeName(name), width: opt.width || 794, scale: opt.scale || 2.5, fit: opt.fit || 'auto' });
  }
  async function buildImage(html, opt) {
    opt = opt || {};
    var R = await ensureRender();
    return R.toBlob(wrap(html, 'صورة'), { width: opt.width || 660, scale: opt.scale || (1200 / 660), type: opt.type || 'image/jpeg', quality: opt.quality == null ? 0.92 : opt.quality });
  }

  /* ── تنزيل مباشر (anchor) ── */
  function download(blob, fileName) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 15000);
  }

  /* ── نسخ صورة للحافظة (للصقها في واتساب ويب): Chrome يقبل image/png فقط ── */
  async function toPng(blob) {
    if (blob.type === 'image/png') return blob;
    var bmp = await createImageBitmap(blob);
    var cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    return new Promise(function (res, rej) { cv.toBlob(function (b) { b ? res(b) : rej(new Error('png')); }, 'image/png'); });
  }
  async function copyImage(blob) {
    try {
      if (!(navigator.clipboard && navigator.clipboard.write && global.ClipboardItem)) return false;
      var png = await toPng(blob);
      await navigator.clipboard.write([new global.ClipboardItem({ 'image/png': png })]);
      return true;
    } catch (e) { return false; }
  }

  /* الجهاز بلا مشاركة ملفّات: تنزيلٌ مباشر (+ نسخ الصورة). **لا حوار طباعة.** */
  /* (TASK-0243 · seq 164) نوع الملفّ يُسمّى باسمه — كانت كل الملفّات تُسمّى «PDF» (ومنها ملفّ جهات الاتصال) */
  function kindOf(fileName, isImg) { return isImg ? 'صورة' : /\.pdf$/i.test(fileName) ? 'PDF' : /\.vcf$/i.test(fileName) ? 'ملفّ جهات اتصال' : 'ملفّ'; }
  async function saveDirect(blob, fileName, isImg) {
    download(blob, fileName);
    if (isImg) {
      var copied = await copyImage(blob);
      say(copied ? '✅ نُزِّلت الصورة ونُسخت — الصقها (Ctrl+V) في المحادثة'
                 : '⬇️ نُزِّلت الصورة على جهازك — أرفقها من التنزيلات');
    } else {
      say('⬇️ نُزِّل ' + kindOf(fileName, false) + ' على جهازك — أرفقه من التنزيلات');
    }
    return 'downloaded';
  }

  /* نافذة «الملفّ جاهز»: نقرتك على أحد أزرارها تُجدّد إذن المشاركة */
  async function chooseReady(blob, file, fileName, isImg, o) {
    if (!global.GMTAsk || !global.GMTAsk.choose) return saveDirect(blob, fileName, isImg);
    for (;;) {
      var choices = [{ k: 'share', t: '📤 شارك', pri: 1 }, { k: 'save', t: '⬇️ نزّل' }];
      if (isImg) choices.push({ k: 'copy', t: '📋 انسخ الصورة' });
      var k = await global.GMTAsk.choose('الملفّ جاهز (' + kindOf(fileName, isImg) + '). اختر ما تريد فعله به:', { title: 'جاهز للمشاركة', icon: 'info', choices: choices, cancelText: 'إغلاق' });
      if (!k) return 'cancelled';
      if (k === 'save') { download(blob, fileName); say('⬇️ نُزِّل الملفّ على جهازك'); return 'downloaded'; }
      if (k === 'copy') {
        if (await copyImage(blob)) { say('✅ نُسخت الصورة — الصقها في المحادثة'); return 'copied'; }
        say('تعذّر نسخ الصورة على هذا الجهاز — استعمل «نزّل»', 'err'); continue;
      }
      try { await navigator.share({ files: [file], title: o.title, text: o.text }); return 'shared'; }
      catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        say('تعذّرت المشاركة المباشرة — استعمل «نزّل»', 'err');
      }
    }
  }

  /* ── تسليمُ ملفّ جاهز. يرجع: 'shared' | 'downloaded' | 'copied' | 'cancelled' ──
     o: { text, title, t0 (وقت النقرة الأصلية) } */
  async function deliver(blob, fileName, o) {
    o = o || {};
    var t0 = o.t0 || Date.now();
    var isImg = /^image\//.test(blob.type || '');
    var file;
    try { file = new File([blob], fileName, { type: blob.type || (isImg ? 'image/jpeg' : 'application/pdf') }); } catch (e) { return saveDirect(blob, fileName, isImg); }
    if (!canShareFiles(file)) return saveDirect(blob, fileName, isImg);
    /* المتصفّح يمنح «تنشيطاً عابراً» ≈٥ث بعد النقرة؛ البناء الطويل يستهلكه ⇒ لا نجرّب share إن انتهى */
    var stale = (Date.now() - t0 > STALE_MS) || (navigator.userActivation && navigator.userActivation.isActive === false);
    if (!stale) {
      try { await navigator.share({ files: [file], title: o.title, text: o.text }); return 'shared'; }
      catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';               /* ألغى المستخدم — صمتٌ تامّ */
        if (!(e && e.name === 'NotAllowedError')) {
          console.warn('[GMT] share فشلت:', e && e.name, e && e.message);
          say('تعذّرت المشاركة المباشرة — نزّلنا الملفّ لك', 'err');
          return saveDirect(blob, fileName, isImg);
        }
      }
    }
    return chooseReady(blob, file, fileName, isImg, o);
  }

  function lock() { if (_busy) { say('⏳ هناك مشاركة قيد التنفيذ — انتظر قليلاً', 'err'); return false; } _busy = true; return true; }

  /* يبني PDF من ورقةٍ ويُشاركه. يُرجع 'shared' | 'downloaded' | 'cancelled' | 'failed'. */
  async function sheet(html, name, opt) {
    opt = opt || {};
    var t0 = opt.t0 || Date.now();
    var title = safeName(name);
    if (!lock()) return 'failed';
    try {
      var blob = await buildPdf(html, title, opt);
      return await deliver(blob, title + '.pdf', { title: title, text: opt.text, t0: t0 });
    } catch (e) {
      console.warn('[GMT] تعذّر بناء PDF:', e && e.message, e && e.causes);
      say((e && e.code === 'RENDER_FAILED') ? e.message : RENDER_MSG, 'err');
      return 'failed';
    } finally { _busy = false; }
  }

  /* يبني صورةً من ورقةٍ ويُشاركها (مع نصّ اختياري) */
  async function image(html, name, opt) {
    opt = opt || {};
    var t0 = opt.t0 || Date.now();
    var base = safeName(name).replace(/\.(png|jpe?g)$/i, '');
    if (!lock()) return 'failed';
    try {
      var blob = await buildImage(html, opt);
      var ext = blob.type === 'image/png' ? '.png' : '.jpg';
      return await deliver(blob, base + ext, { title: base, text: opt.text, t0: t0 });
    } catch (e) {
      console.warn('[GMT] تعذّر بناء الصورة:', e && e.message, e && e.causes);
      say((e && e.code === 'RENDER_FAILED') ? e.message : RENDER_MSG, 'err');
      return 'failed';
    } finally { _busy = false; }
  }

  /* يشارك عنصراً موجوداً في الصفحة (مع أنماطها) */
  async function element(el, name, opt) {
    if (!el) { say('لا يوجد ما يُشارَك', 'err'); return 'failed'; }
    var styles = '';
    try {
      styles = Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
    } catch (e) {}
    var html = (styles ? '<style>' + styles + '</style>' : '') + el.outerHTML;
    return sheet(html, name, opt);
  }

  /* زرٌّ جاهز — يُستعمل في الصفحات التي تريد إضافته بسطرٍ واحد */
  function button(opts) {
    opts = opts || {};
    var b = document.createElement('button');
    b.type = 'button';
    b.className = opts.className || '';
    b.textContent = opts.label || '📤 مشاركة PDF';
    b.title = 'يبني PDF ويُسلّمه لواتساب أو أي تطبيقٍ مباشرةً';
    if (!opts.className) {
      b.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border:0;' +
        'border-radius:10px;background:#0f172a;color:#fff;font-weight:800;font-size:13px;' +
        'font-family:inherit;cursor:pointer;';
    }
    b.onclick = async function () {
      var old = b.textContent, t0 = Date.now();
      b.disabled = true; b.textContent = '⏳ جارٍ التجهيز…';
      try {
        var html = (typeof opts.get === 'function') ? await opts.get() : '';
        if (!html) { say('لا يوجد ما يُشارَك', 'err'); return; }
        await sheet(html, (typeof opts.name === 'function') ? opts.name() : (opts.name || 'مستند'), { t0: t0, width: opts.width });
      } finally { b.disabled = false; b.textContent = old; }
    };
    return b;
  }

  global.GMTShare = {
    sheet: sheet,
    image: image,
    element: element,
    button: button,
    deliver: deliver,
    download: download,
    copyImage: copyImage,
    print: printSheet,
    canShareFiles: canShareFiles,
    /* مكشوفةٌ للفحص */
    _wrap: wrap,
    _buildPdf: buildPdf,
    _buildImage: buildImage
  };
})(window);
