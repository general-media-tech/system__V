/* ═══════════════════════════════════════════════════════════════════════════
   gmt-share.js — مشاركةُ PDF في كل مكان، لا حفظٌ وطباعةٌ فقط
   أُنشئ: 2026-10-03 · طلبك ١٢٠

   طلبُك: «زرّ **مشاركة PDF** في كل مكان لا حفظ وطباعة فقط».

   المشكلة اليوم: كلُّ مخرجٍ في النظام (فاتورة · أوردر · كفالة · عقد · تقرير)
   ينتهي بزرّ «طباعة». وعلى الموبايل — وهو جهازُ الموظّف الفعليّ — «طباعة»
   تعني حوارَ النظام ثمّ «حفظ كـPDF» إلى مجلّد التنزيلات، ثمّ يفتح الموظّف
   مديرَ الملفّات ثمّ واتساب ثمّ يبحث عن الملفّ. أربعُ خطواتٍ لإرسال ورقة.

   ما يفعله هذا الملفّ: زرٌّ واحد يبني PDF ويُسلّمه إلى **لوحة المشاركة
   الأصلية** للنظام (`navigator.share`) فتظهر واتساب وتيليغرام والبريد
   مباشرةً. خطوةٌ واحدة بدل أربع.

   وكيف يُبنى الـPDF بلا مكتبةٍ ثقيلة: لا نُحمّل مُولّد PDF (كان ذلك سيُعيد
   عطل ١٦٩ نفسه). نستعمل محرّك الطباعة الموجود في المتصفّح عبر إطارٍ مخفيّ —
   وهو نفسه الذي يُنتج الـPDF اليوم — ثمّ:
     • إن دعم الجهاز مشاركة الملفّات ⇒ نُشارك ملفّاً.
     • وإن لم يدعم ⇒ نفتح حوار الطباعة/الحفظ كما كان، **ونقول للموظّف
       صراحةً** أنّ جهازه لا يدعم المشاركة المباشرة — لا زرٌّ يبدو معطوباً.

   ⚠️ قاعدةٌ التزمتُها: هذا الملفّ **لا يحذف** أيَّ زرّ طباعةٍ قائم. يُضيف
      خياراً إلى جانبه. إلغاءُ الطباعة لم تطلبه، وبعضُ المطبوعات تُطبَع ورقياً
      فعلاً (ملصق الكفالة · الفاتورة الحرارية).

   الاستعمال:
     GMTShare.sheet(htmlString, 'فاتورة-123')        // ورقةٌ جاهزة
     GMTShare.element(el, 'تقرير-اليوم')             // عنصرٌ في الصفحة
     GMTShare.button({ get: () => html, name: 'x' }) // يبني زرّاً جاهزاً
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTShare) return;

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
  function canShareFiles() {
    try {
      if (!global.navigator || !navigator.share || !navigator.canShare) return false;
      var probe = new File([new Blob(['x'], { type: 'text/plain' })], 'p.txt', { type: 'text/plain' });
      return navigator.canShare({ files: [probe] });
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

  /* يفتح حوارَ الطباعة لورقةٍ في إطارٍ مخفيّ — المسارُ الاحتياطي */
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

  /* يبني PDF من ورقةٍ ويُشاركه. يُرجع 'shared' | 'printed' | 'failed'. */
  async function sheet(html, name) {
    var title = String(name || 'مستند').replace(/[\\/:*?"<>|]/g, '-');

    if (!canShareFiles()) {
      /* نقولها صراحةً بدل زرٍّ يبدو معطوباً */
      say('جهازك لا يدعم مشاركة الملفّات مباشرةً — سيُفتح الحفظ/الطباعة، ثمّ أرفِق الملفّ.', 'err');
      await printSheet(html, title);
      return 'printed';
    }

    /* المسار المدعوم: نحوّل الورقة إلى صورةٍ عالية الدقّة ثمّ إلى PDF بصفحةٍ
       واحدة. نستعمل ما هو محمَّلٌ أصلاً، ونُحمّل عند الحاجة فقط (درس ١٦٩). */
    try {
      if (typeof global.html2canvas === 'undefined' && global.GMTLazyLib) {
        await global.GMTLazyLib.need('html2canvas');
      }
      if (typeof global.html2canvas === 'undefined') throw new Error('محوّل الصورة غير متاح');

      var fr = document.createElement('iframe');
      fr.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;height:400px;border:0;visibility:hidden;';
      document.body.appendChild(fr);
      await new Promise(function (res) { fr.onload = res; fr.srcdoc = wrap(html, title); });
      var doc = fr.contentDocument;
      await Promise.race([
        doc.fonts ? doc.fonts.ready : Promise.resolve(),
        new Promise(function (r) { setTimeout(r, 700); })
      ]).catch(function () {});
      var h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 400);
      fr.style.height = h + 'px';
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
      var canvas = await global.html2canvas(doc.body, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
        width: 794, windowWidth: 794, height: h, windowHeight: h
      });
      try { fr.remove(); } catch (e) {}

      var jpeg = canvas.toDataURL('image/jpeg', 0.92);
      var pdfBlob = imageToPdfBlob(jpeg, canvas.width, canvas.height);
      var file = new File([pdfBlob], title + '.pdf', { type: 'application/pdf' });
      if (!navigator.canShare({ files: [file] })) throw new Error('الجهاز رفض ملفّ PDF');
      await navigator.share({ files: [file], title: title });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'failed';      /* ألغى المستخدم — لا رسالة */
      console.warn('[GMT] تعذّرت مشاركة PDF:', e && e.message);
      say('تعذّرت المشاركة المباشرة — سيُفتح الحفظ/الطباعة.', 'err');
      await printSheet(html, title);
      return 'printed';
    }
  }

  /* ── PDF بصفحةٍ واحدة من صورةٍ واحدة ──
     نكتب الـPDF بأنفسنا (بنيةٌ بسيطة: صفحةٌ واحدة + صورة JPEG مُدمَجة).
     لماذا لا مكتبة: أصغرُ مُولّد PDF يُقارب ٣٠٠ كيلوبايت — وهو بالضبط ما
     أزلتُه من الصفحات في البلاغ ١٦٩. وهذه البنية كافيةٌ لورقةٍ واحدة. */
  function imageToPdfBlob(dataUrl, pxW, pxH) {
    var b64 = dataUrl.split(',')[1];
    var bin = atob(b64);
    var img = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) img[i] = bin.charCodeAt(i);

    /* A4 بالنقاط: 595.28 × 841.89 — نُلائم العرض ونحفظ النسبة */
    var A4W = 595.28, A4H = 841.89;
    var scale = Math.min(A4W / pxW, A4H / pxH);
    var w = pxW * scale, h = pxH * scale;
    var x = (A4W - w) / 2, y = A4H - h - ((A4H - h) / 2);

    var enc = new TextEncoder();
    var parts = [], offsets = [], pos = 0;
    function push(bytes) {
      parts.push(bytes); pos += bytes.length;
    }
    function obj(n, body) {
      offsets[n] = pos;
      push(enc.encode(n + ' 0 obj\n' + body + '\nendobj\n'));
    }
    push(enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + A4W.toFixed(2) + ' ' + A4H.toFixed(2) + ']' +
           ' /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    /* الصورة */
    offsets[4] = pos;
    push(enc.encode('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + pxW + ' /Height ' + pxH +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.length + ' >>\nstream\n'));
    push(img);
    push(enc.encode('\nendstream\nendobj\n'));
    var content = 'q\n' + w.toFixed(2) + ' 0 0 ' + h.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm\n/Im0 Do\nQ\n';
    obj(5, '<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream');

    var xrefPos = pos;
    var xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (var n = 1; n <= 5; n++) xref += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
    xref += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';
    push(enc.encode(xref));

    return new Blob(parts, { type: 'application/pdf' });
  }

  /* يشارك عنصراً موجوداً في الصفحة (مع أنماطها) */
  async function element(el, name) {
    if (!el) { say('لا يوجد ما يُشارَك', 'err'); return 'failed'; }
    var styles = '';
    try {
      styles = Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
    } catch (e) {}
    var html = (styles ? '<style>' + styles + '</style>' : '') + el.outerHTML;
    return sheet(html, name);
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
      var old = b.textContent;
      b.disabled = true; b.textContent = '⏳ جارٍ التجهيز…';
      try {
        var html = (typeof opts.get === 'function') ? await opts.get() : '';
        if (!html) { say('لا يوجد ما يُشارَك', 'err'); return; }
        await sheet(html, (typeof opts.name === 'function') ? opts.name() : (opts.name || 'مستند'));
      } finally { b.disabled = false; b.textContent = old; }
    };
    return b;
  }

  global.GMTShare = {
    sheet: sheet,
    element: element,
    button: button,
    canShareFiles: canShareFiles,
    /* مكشوفةٌ للفحص */
    _pdf: imageToPdfBlob,
    _wrap: wrap
  };
})(window);
