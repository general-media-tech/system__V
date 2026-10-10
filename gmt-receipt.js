/* ═════════════════════════════════════════════════════════════════
   gmt-receipt.js — قراءة رقم التتبّع من صورة إيصال شركة الشحن (المفتي فقط)
   أُنشئ: 2026-10-11  ·  من وثيقة الملاحظات (١٠ ت١ ٢٠٢٦)

   طلبُك: «لشركة المفتي فقط… لما أرفع صورة الإيصال تبحث تلقائياً عن رقم التتبّع
   (أعلى الإيصال، جنب كلمة تتبّع الشحنة، فوق الباركود)، وإن ما عرفتَه أدخله
   يدوياً. وتقدر تاخده من الباركود اللي على يسار الإيصال من فوق. فقط المفتي».

   ما يفعله:
     ١) يقرأ كل الرموز في الصورة (QR وباركود خطّي) بمكتبة ZXing الموجودة أصلاً
        في lib/ — بلا خدمة خارجيّة ولا إنترنت.
     ٢) الصورةُ صورةُ هاتفٍ لورقةٍ مائلة، والرمزُ صغيرٌ في زاويتها: فلا تكفي
        محاولةٌ واحدة على الصورة كلّها. نجرّب الصورة كاملةً ثمّ أرباعها وأشرطتها،
        بتدويرٍ وتكبير، ونتوقّف عند أوّل رقمٍ صالح.
     ٣) من نصّ الرمز نستخرج «الرقم»: رقمٌ صِرف ⇐ هو. رابطٌ ⇐ وسيطٌ رقميّ فيه
        (id · no · track · awb…). نصٌّ مختلط ⇐ أقصر سلسلة أرقام بين ٥ و١٤ خانة.
     ٤) لا يكتب في القاعدة ولا يحفظ شيئاً: يُعيد الرقم للواجهة لتملأ به الحقل،
        ويبقى الحقل قابلاً للتعديل. وإن فشلت القراءة تقول ذلك صراحةً.

   ⚠️ هذا الملفّ لا يعرف محتوى رمز المفتي الفعليّ (لم تصلني صورةٌ بدقّةٍ تكفي
      لفكّه). لذلك الاستخراج متساهلٌ، والرقم المُلتقَط يُعرَض للمراجعة لا يُعتمَد
      بصمت. جرّب بإيصالٍ حقيقيّ وأخبرني بالنتيجة لأضبط القاعدة على نصّه بالضبط.
   ═════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTReceipt) return;

  var ZX_SRC = 'lib/zxing.min.js?v=20261003';
  var zxP = null;

  function loadZX() {
    if (global.ZXing) return Promise.resolve(global.ZXing);
    if (zxP) return zxP;
    zxP = new Promise(function (ok, bad) {
      var s = document.createElement('script');
      s.src = ZX_SRC;
      s.onload = function () { global.ZXing ? ok(global.ZXing) : bad(new Error('ZXing لم تُعرَّف')); };
      s.onerror = function () { zxP = null; bad(new Error('تعذّر تحميل مكتبة القراءة')); };
      document.head.appendChild(s);
    });
    return zxP;
  }

  function loadImage(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () { ok({ im: im, url: url }); };
      im.onerror = function () { URL.revokeObjectURL(url); bad(new Error('تعذّر فتح الصورة')); };
      im.src = url;
    });
  }

  /* الأرقام العربيّة والفارسيّة ⇒ لاتينيّة */
  function latin(s) {
    return String(s == null ? '' : s)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
  }

  var PARAMS = /^(id|no|num|number|track|tracking|trackingno|trackingnumber|awb|bill|shipment|shipmentid|code|ref|barcode|waybill|sn)$/i;

  /* يستخرج «رقم التتبّع» من نصّ رمزٍ مقروء. null إن لم يجد ما يصلح. */
  function extractNumber(text) {
    var t = latin(text).trim();
    if (!t) return null;
    if (/^\d{4,14}$/.test(t)) return { number: t, how: 'رقم صِرف' };
    var u = null;
    try { if (/^https?:\/\//i.test(t)) u = new URL(t); } catch (_) {}
    if (u) {
      var found = null;
      u.searchParams.forEach(function (v, k) { if (!found && PARAMS.test(k) && /^\d{4,14}$/.test(latin(v))) found = latin(v); });
      if (found) return { number: found, how: 'من رابط' };
      var seg = u.pathname.split('/').filter(Boolean).reverse().map(latin).filter(function (x) { return /^\d{4,14}$/.test(x); })[0];
      if (seg) return { number: seg, how: 'من رابط' };
    }
    var m = t.match(/\d{5,14}/g);
    if (m && m.length) {
      m.sort(function (a, b) { return a.length - b.length; });
      return { number: m[0], how: 'من نصّ الرمز' };
    }
    return null;
  }

  /* مناطق التجربة: [x, y, w, h] كنسب من الصورة */
  var REGIONS = [
    [0, 0, 1, 1],
    [0, 0, .62, .5], [.38, 0, .62, .5], [0, .5, .62, .5], [.38, .5, .62, .5],
    [0, 0, 1, .4], [0, .6, 1, .4], [0, 0, .5, 1], [.5, 0, .5, 1],
    [0, .25, 1, .5]
  ];

  function crop(im, r, rot, maxSide) {
    var sw = im.naturalWidth, sh = im.naturalHeight;
    var sx = Math.round(sw * r[0]), sy = Math.round(sh * r[1]);
    var cw = Math.max(8, Math.round(sw * r[2])), ch = Math.max(8, Math.round(sh * r[3]));
    var long = Math.max(cw, ch);
    var k = long < 700 ? Math.min(3, 900 / long) : Math.min(1, maxSide / long);   // صغيرةٌ ⇒ كبّرها · ضخمةٌ ⇒ صغّرها
    var w = Math.max(8, Math.round(cw * k)), h = Math.max(8, Math.round(ch * k));
    var cv = document.createElement('canvas');
    var turned = rot % 180 !== 0;
    cv.width = turned ? h : w; cv.height = turned ? w : h;
    var c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
    c.translate(cv.width / 2, cv.height / 2);
    c.rotate(rot * Math.PI / 180);
    c.imageSmoothingEnabled = true;
    c.drawImage(im, sx, sy, cw, ch, -w / 2, -h / 2, w, h);
    return cv;
  }

  function hints(ZX) {
    var m = new Map();
    m.set(ZX.DecodeHintType.TRY_HARDER, true);
    m.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
      ZX.BarcodeFormat.QR_CODE, ZX.BarcodeFormat.CODE_128, ZX.BarcodeFormat.CODE_39,
      ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.ITF,
      ZX.BarcodeFormat.CODABAR, ZX.BarcodeFormat.DATA_MATRIX, ZX.BarcodeFormat.UPC_A
    ]);
    return m;
  }

  /* يقرأ رقم التتبّع من ملفّ صورة. يُرجع { number, raw, all, tries } أو { number: null, all, tries }. */
  async function readTracking(file, opts) {
    opts = opts || {};
    var ZX = await loadZX();
    var L = await loadImage(file);
    var all = [], tries = 0, best = null;
    try {
      /* القارئ منخفض المستوى (قماش ⇐ BinaryBitmap) — جرّبتُ decodeFromImageUrl في نسخة ZXing المرفقة
         فلم يفكّ حتى رمزاً نظيفاً صنعتُه بنفسي، بينما هذا المسار يفكّه. لا نعتمد على ما لم نجرّبه. */
      var reader = new ZX.MultiFormatReader();
      reader.setHints(hints(ZX));
      var seen = {};
      var tryCanvas = function (cv) {
        var txt = null;
        [ZX.HybridBinarizer, ZX.GlobalHistogramBinarizer].forEach(function (B) {
          if (txt) return;
          try {
            var bm = new ZX.BinaryBitmap(new B(new ZX.HTMLCanvasElementLuminanceSource(cv)));
            var res = reader.decode(bm);
            txt = res && res.getText ? res.getText() : null;
          } catch (_) { txt = null; }
        });
        return txt;
      };
      for (var i = 0; i < REGIONS.length && !best; i++) {
        var rots = (i === 0) ? [0, 90, 270] : [0, 90];
        for (var j = 0; j < rots.length && !best; j++) {
          var cv = crop(L.im, REGIONS[i], rots[j], opts.maxSide || 1800);
          tries++;
          var txt = tryCanvas(cv);
          /* لا تُجمِّد الواجهة: تنفّسٌ بين المحاولات */
          await new Promise(function (r) { setTimeout(r, 0); });
          if (!txt || seen[txt]) continue;
          seen[txt] = 1; all.push(txt);
          var ex = extractNumber(txt);
          if (ex) best = { number: ex.number, how: ex.how, raw: txt };
        }
      }
    } finally { try { URL.revokeObjectURL(L.url); } catch (_) {} }
    return best ? { number: best.number, how: best.how, raw: best.raw, all: all, tries: tries }
                : { number: null, all: all, tries: tries };
  }

  global.GMTReceipt = { readTracking: readTracking, extractNumber: extractNumber, _latin: latin };
})(window);
