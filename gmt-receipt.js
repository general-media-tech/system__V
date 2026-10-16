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

   🔴 (ملاحظات ١٥ ت١ ٨:٠٣) «طوّر موضوع قراءة رقم التتبّع من الصورة: إذا ما عرف يلاقيه ياخده من الباركود، أو يتعرّف عليه من
   الصورة بشكل أقوى». صارت القراءة بأربع طبقاتٍ تتوقّف عند أوّل رقمٍ صالح (الأسرع أوّلاً):
     ① ZXing على الصورة وأجزائها (كما كان)
     ② قارئ المتصفّح الأصلي BarcodeDetector (كروم أندرويد) — أقوى على الصور المائلة
     ③ ZXing بعد تحسين التباين/العتبة (أوتسو) وبميلانٍ خفيف ±٨° ±١٤° — للصور الباهتة والمائلة
     ④ التعرّف على النصّ OCR محلّياً (lib/ocr — Tesseract مستضافة ذاتياً، بلا خدمة خارجية): يقرأ الرقم المطبوع نفسه حين
        يتعذّر الباركود، ويرتّب المرشّحين (أعلى الإيصال · ٦–٩ خانات · خطٌّ كبير) ويستبعد أرقام الهاتف والتواريخ.
        يُحمَّل عند الحاجة فقط (٧ ميغابايت أوّل مرّة) لأنه آخر ملجأ.
   ما يُلتقَط من الطبقة ④ **تقديريّ**: يُرجَع مع method:'ocr' و candidates ويجب أن **يختاره المستخدم بنفسه** — لا تملأ
   الواجهةُ به حقلاً تلقائياً (إيصالٌ فيه أرقامٌ كثيرة، وخطأٌ صامتٌ في رقم التتبّع أسوأ من حقلٍ فارغ).

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
    /* الزاوية قد تكون ٩٠/٢٧٠ (تدوير الهاتف) أو ميلاً صغيراً (±٦° ±١٢°): نكبّر القماش ليسع الصورة المُدارة كاملةً */
    var rad = rot * Math.PI / 180, ca = Math.abs(Math.cos(rad)), sa = Math.abs(Math.sin(rad));
    cv.width = Math.max(8, Math.round(w * ca + h * sa)); cv.height = Math.max(8, Math.round(w * sa + h * ca));
    var c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
    c.translate(cv.width / 2, cv.height / 2);
    c.rotate(rad);
    c.imageSmoothingEnabled = true;
    c.drawImage(im, sx, sy, cw, ch, -w / 2, -h / 2, w, h);
    return cv;
  }

  /* تحسين التباين: رمادي ⇒ مدّ المدرّج بين المئين ٢ و٩٨ (+ اختياريّاً عتبة أوتسو).
     يعالج أكثر ما يُفشل القراءة في صور الهاتف: إضاءةٌ باهتة، ورقٌ رماديّ، حبرٌ حراريّ شاحب. */
  function enhance(src, mode) {
    var cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
    var c = cv.getContext('2d'); c.drawImage(src, 0, 0);
    var img = c.getImageData(0, 0, cv.width, cv.height), d = img.data, n = cv.width * cv.height, i;
    var g = new Uint8ClampedArray(n), hist = new Uint32Array(256);
    for (i = 0; i < n; i++) { var v = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000 | 0; g[i] = v; hist[v]++; }
    var lo = 0, hi = 255, acc = 0;
    for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * 0.02) { lo = i; break; } }
    acc = 0; for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= n * 0.02) { hi = i; break; } }
    if (hi - lo < 24) { lo = Math.max(0, lo - 12); hi = Math.min(255, hi + 12); }
    var span = Math.max(1, hi - lo), t = -1;
    if (mode === 'bin') {                              // أوتسو على المدرّج المشدود
      var h2 = new Float64Array(256), tot = 0, sum = 0;
      for (i = 0; i < n; i++) { var s2 = Math.max(0, Math.min(255, (g[i] - lo) * 255 / span | 0)); h2[s2]++; }
      for (i = 0; i < 256; i++) { tot += h2[i]; sum += i * h2[i]; }
      var wB = 0, sB = 0, best = -1, thr = 128;
      for (i = 0; i < 256; i++) {
        wB += h2[i]; if (!wB) continue; var wF = tot - wB; if (!wF) break;
        sB += i * h2[i]; var mB = sB / wB, mF = (sum - sB) / wF, bv = wB * wF * (mB - mF) * (mB - mF);
        if (bv > best) { best = bv; thr = i; }
      }
      t = thr;
    }
    for (i = 0; i < n; i++) {
      var q = Math.max(0, Math.min(255, (g[i] - lo) * 255 / span | 0));
      if (t >= 0) q = q > t ? 255 : 0;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = q; d[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
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

  /* ── الطبقة ٢: القارئ الأصلي للمتصفّح (BarcodeDetector — كروم أندرويد) ──
     أقوى بكثير من ZXing على صور الهاتف المائلة/الباهتة، ولا يكلّف تحميل شيء. غير متوفّر على كل الأجهزة فنتخطّاه بصمت. */
  async function nativePass(L, push) {
    if (!('BarcodeDetector' in global)) return null;
    var det;
    try {
      var sup = await global.BarcodeDetector.getSupportedFormats();
      var want = ['qr_code', 'code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'itf', 'codabar', 'data_matrix', 'upc_a', 'upc_e']
        .filter(function (f) { return sup.indexOf(f) >= 0; });
      det = new global.BarcodeDetector(want.length ? { formats: want } : undefined);
    } catch (_) { return null; }
    var regs = [[0, 0, 1, 1], [0, 0, 1, .5], [0, 0, .62, .5], [.38, 0, .62, .5], [0, .5, 1, .5]];
    for (var i = 0; i < regs.length; i++) {
      var rots = i === 0 ? [0, 90, 270] : [0, 90];
      for (var j = 0; j < rots.length; j++) {
        try {
          var cv = crop(L.im, regs[i], rots[j], 2200);
          var res = await det.detect(cv);
          for (var k = 0; k < res.length; k++) {
            var txt = res[k].rawValue; if (!txt) continue;
            push(txt);
            var ex = extractNumber(txt);
            if (ex) return { number: ex.number, how: ex.how + ' (قارئ المتصفّح)', raw: txt, method: 'native' };
          }
        } catch (_) {}
        await new Promise(function (r) { setTimeout(r, 0); });
      }
    }
    return null;
  }

  /* قصٌّ فرعيّ من قماشٍ جاهز (مُدار) مع تكبير الصغير — نفس منطق crop لكن المصدر قماش لا صورة */
  function sub(cv, r, maxSide) {
    var sw = cv.width, sh = cv.height;
    var sx = Math.round(sw * r[0]), sy = Math.round(sh * r[1]);
    var cw = Math.max(8, Math.round(sw * r[2])), ch = Math.max(8, Math.round(sh * r[3]));
    var long = Math.max(cw, ch), k = long < 700 ? Math.min(3, 900 / long) : Math.min(1, maxSide / long);
    var o = document.createElement('canvas'); o.width = Math.max(8, Math.round(cw * k)); o.height = Math.max(8, Math.round(ch * k));
    var c = o.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, o.width, o.height); c.imageSmoothingEnabled = true;
    c.drawImage(cv, sx, sy, cw, ch, 0, 0, o.width, o.height);
    return o;
  }

  /* ── الطبقة ٣: ZXing على نسخٍ محسَّنة (تباين/عتبة) وبميلان ──
     الصورة تُدار **كاملةً أوّلاً** ثم تُقصّ أجزاؤها (تدوير الجزء وحده يُبعد الباركود عن قصّته). الخطّة مرتّبةٌ بالأرجح أوّلاً،
     ولها **ميزانيّة وقت** (opts.budgetMs — الافتراضي ٢٢ ثانية) كي لا تعلق على هاتفٍ بطيء؛ بعدها يأتي OCR. */
  var ALLREG = [[0, 0, 1, 1], [0, 0, 1, .5], [0, 0, .62, .5], [.38, 0, .62, .5], [0, .25, 1, .5], [0, 0, .5, 1], [.5, 0, .5, 1], [0, .5, 1, .5]];
  /* شبكة نوافذ صغيرة متراكبة (٥٠%×٣٠% بخطوة ٢٥%×١٥%): النافذة التي تحيط بالباركود وحده بلا طاولة/ظلّ حوله تُفكّ بسهولة، بينما
     القصّات الكبيرة تُدخل خلفيّة الطاولة الداكنة فتُخرِّب عتبة التحويل الثنائي — وهذا ما أفشل قراءة الصور المائلة في تجربتي. */
  var GRID = (function () {
    var out = [], xs = [0, .25, .5], ys = [0, .15, .3, .45, .6];
    ys.forEach(function (y) { xs.forEach(function (x) { out.push([x, y, .5, .3]); }); });
    return out;
  })();
  async function enhancedPass(ZX, L, opts, push, count) {
    var reader = new ZX.MultiFormatReader(); reader.setHints(hints(ZX));
    function tryCanvas(cv) {
      var txt = null;
      [ZX.HybridBinarizer, ZX.GlobalHistogramBinarizer].forEach(function (B) {
        if (txt) return;
        try { txt = reader.decode(new ZX.BinaryBitmap(new B(new ZX.HTMLCanvasElementLuminanceSource(cv)))).getText(); } catch (_) { txt = null; }
      });
      return txt;
    }
    var t0 = Date.now(), budget = opts.budgetMs || 22000;
    var plan = [
      [0, ALLREG, ['contrast', 'bin']], [0, GRID, ['contrast']],
      [90, ALLREG, ['contrast']], [90, GRID, ['contrast']], [270, ALLREG, ['contrast']], [270, GRID, ['contrast']],
      [-6, GRID, ['contrast']], [6, GRID, ['contrast']], [-14, GRID, ['contrast']], [14, GRID, ['contrast']],
      [-22, GRID, ['contrast']], [22, GRID, ['contrast']],
      [84, GRID, ['contrast']], [96, GRID, ['contrast']], [258, GRID, ['contrast']], [276, GRID, ['contrast']]
    ];
    for (var p = 0; p < plan.length; p++) {
      var rotated = crop(L.im, [0, 0, 1, 1], plan[p][0], opts.maxSide || 2000);
      for (var r = 0; r < plan[p][1].length; r++) {
        var part = sub(rotated, plan[p][1][r], opts.maxSide || 2000);
        for (var m = 0; m < plan[p][2].length; m++) {
          if (Date.now() - t0 > budget) return null;
          count.n++;
          var txt = tryCanvas(enhance(part, plan[p][2][m]));
          await new Promise(function (res) { setTimeout(res, 0); });
          if (!txt) continue;
          push(txt);
          var ex = extractNumber(txt);
          if (ex) return { number: ex.number, how: ex.how + ' (بعد تحسين الصورة' + (plan[p][0] % 90 ? ' وتعديل الميلان' : '') + ')', raw: txt, method: 'enhanced' };
        }
      }
    }
    return null;
  }

  /* ── الطبقة ٤: التعرّف على النصّ (OCR) محلّيّاً — مكتبة Tesseract مستضافة في lib/ocr (بلا إنترنت ولا خدمة خارجيّة).
     تُحمَّل عند الحاجة فقط (≈٧ ميغابايت أوّل مرّة ثم تُخزَّن) — لأنها آخر ملجأ حين يفشل الباركود. ── */
  var ocrWorkerP = null;
  function loadScript(src) {
    return new Promise(function (ok, bad) {
      var s = document.createElement('script'); s.src = src;
      s.onload = ok; s.onerror = function () { bad(new Error('تعذّر تحميل ' + src)); };
      document.head.appendChild(s);
    });
  }
  function getOCR() {
    if (ocrWorkerP) return ocrWorkerP;
    ocrWorkerP = (async function () {
      if (!global.Tesseract) await loadScript('lib/ocr/tesseract.min.js?v=20261016');
      var base = new URL('lib/ocr/', document.baseURI).href;
      var w = await global.Tesseract.createWorker('eng', 1, {
        workerPath: base + 'worker.min.js', corePath: base + 'tesseract-core-lstm.wasm.js', langPath: base,
        gzip: true, cacheMethod: 'none'
      });
      await w.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' });   // 11 = نصٌّ متناثر
      return w;
    })();
    ocrWorkerP.catch(function () { ocrWorkerP = null; });
    return ocrWorkerP;
  }
  /* كلمةٌ من OCR ⇒ سلسلة أرقام إن كانت في معظمها أرقاماً (O→0 · I/l→1 · S→5 · B→8 ...) */
  var CONFUSE = { O: '0', o: '0', Q: '0', D: '0', I: '1', l: '1', '|': '1', i: '1', S: '5', s: '5', B: '8', Z: '2', z: '2', G: '6', g: '9' };
  function digitsOfWord(t) {
    var w = latin(t).replace(/[^0-9A-Za-z|]/g, '');
    if (w.length < 5) return null;
    var dig = (w.match(/\d/g) || []).length;
    if (dig < 4 || dig / w.length < 0.7) return null;
    return w.replace(/[A-Za-z|]/g, function (ch) { return CONFUSE[ch] || ''; });
  }
  function rankCandidates(words, imgH) {
    var seen = {}, out = [];
    words.forEach(function (wd) {
      var d = digitsOfWord(wd.text); if (!d || d.length < 5 || d.length > 12) return;
      if (/^(09\d{8}|9639\d{8}|00963\d+)$/.test(d)) return;                 // هاتفٌ سوريّ — ليس رقم تتبّع
      if (/^(19|20)\d{2}(0[1-9]|1[0-2])\d{2}$/.test(d)) return;               // تاريخٌ مُلصَق
      var y = wd.bbox ? (wd.bbox.y0 + wd.bbox.y1) / 2 / imgH : 0.5, hgt = wd.bbox ? (wd.bbox.y1 - wd.bbox.y0) : 0;
      var score = (y < 0.45 ? 3 : y < 0.6 ? 1 : 0)                              // أعلى الإيصال ⇐ أرجح
                + (d.length >= 6 && d.length <= 9 ? 2 : 0)                      // طول رقم المفتي المعتاد
                + Math.min(2, hgt / (imgH * 0.02))                              // الخطّ الكبير ⇐ أرجح
                + (wd.confidence || 0) / 50;
      if (seen[d]) { seen[d].score += 0.5; return; }
      seen[d] = { number: d, score: score }; out.push(seen[d]);
    });
    return out.sort(function (a, b) { return b.score - a.score; });
  }
  /* اتّجاه الصورة مجهول (الهاتف يدوّر الورقة) ⇒ نقرأ بالاتّجاه الطبيعي أوّلاً، فإن لم تكن الثقة العامّة عالية ولا مرشّحون
     جرّبنا ٩٠° و٢٧٠° ثم ١٨٠° وأخذنا **الأعلى ثقةً** — لا أوّل اتّجاهٍ فيه أرقام (النصّ المقلوب يُنتج أرقاماً عشوائيّة بثقةٍ منخفضة). */
  async function ocrPass(L, opts, count) {
    var worker = await getOCR(), best = null, rots = [0, 90, 270, 180];
    for (var r = 0; r < rots.length; r++) {
      var cv = enhance(crop(L.im, [0, 0, 1, 1], rots[r], 2400), 'contrast');
      count.n++;
      var res = await worker.recognize(cv, {}, { blocks: true });
      var words = [];
      ((res.data && res.data.blocks) || []).forEach(function (b) { (b.paragraphs || []).forEach(function (pg) { (pg.lines || []).forEach(function (ln) {
        (ln.words || []).forEach(function (wd) { words.push({ text: wd.text, bbox: wd.bbox, confidence: wd.confidence }); }); }); }); });
      var cands = rankCandidates(words, cv.height);
      /* ثقة الاتّجاه = متوسّط ثقة الكلمات الطويلة (≥٣ أحرف) — أدقّ من ثقة الصفحة لأنّ الفراغ لا يُخفّضها */
      var long = words.filter(function (w) { return String(w.text || '').replace(/\s/g, '').length >= 3; });
      var conf = long.length ? long.reduce(function (a, w) { return a + (w.confidence || 0); }, 0) / long.length : 0;
      if (opts.trace) opts.trace.push({ rot: rots[r], conf: Math.round(conf), words: long.length, cands: cands.slice(0, 3).map(function (c) { return c.number; }) });
      if (!best || conf > best.conf) best = { conf: conf, cands: cands };
      if (conf >= 72 && cands.length) break;                                   // اتّجاهٌ سليم (ثقةٌ عالية ومرشّحون) ⇒ لا حاجة لتجربة البقيّة
    }
    if (!best || !best.cands.length) return null;
    return { number: best.cands[0].number, how: 'تعرّف على النصّ (محلّيّ)', raw: best.cands[0].number, method: 'ocr',
             candidates: best.cands.slice(0, 4).map(function (c) { return c.number; }) };
  }

  /* يقرأ رقم التتبّع من ملفّ صورة. يُرجع { number, how, raw, all, tries, method, candidates? } أو { number: null, all, tries }.
     الترتيب (يتوقّف عند أوّل رقمٍ صالح): ① ZXing على الصورة وأجزائها ② قارئ المتصفّح الأصلي ③ ZXing بعد تحسين التباين وبميلان
     ④ التعرّف على النصّ OCR (opts.ocr === false يعطّله). opts.onStage('native'|'enhanced'|'ocr') يُخبر الواجهة بالمرحلة. */
  async function readTracking(file, opts) {
    opts = opts || {};
    var ZX = await loadZX();
    var L = await loadImage(file);
    var all = [], count = { n: 0 }, best = null, seen = {};
    function push(t) { if (t && !seen[t]) { seen[t] = 1; all.push(t); } }
    function stage(k) { try { if (opts.onStage) opts.onStage(k); } catch (_) {} }
    try {
      /* القارئ منخفض المستوى (قماش ⇒ BinaryBitmap) — جرّبتُ decodeFromImageUrl في نسخة ZXing المرفقة
         فلم يفكّ حتى رمزاً نظيفاً صنعتُه بنفسي، بينما هذا المسار يفكّه. لا نعتمد على ما لم نجرّبه. */
      var reader = new ZX.MultiFormatReader();
      reader.setHints(hints(ZX));
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
          count.n++;
          var txt = tryCanvas(cv);
          /* لا تُجمِّد الواجهة: تنفّسٌ بين المحاولات */
          await new Promise(function (r) { setTimeout(r, 0); });
          if (!txt) continue;
          push(txt);
          var ex = extractNumber(txt);
          if (ex) best = { number: ex.number, how: ex.how, raw: txt, method: 'zxing' };
        }
      }
      if (!best) { stage('native'); best = await nativePass(L, push); }
      if (!best) { stage('enhanced'); best = await enhancedPass(ZX, L, opts, push, count); }
      if (!best && opts.ocr !== false) {
        stage('ocr');
        try { best = await ocrPass(L, opts, count); }
        catch (e) { console.warn('[GMT] تعذّر التعرّف على النصّ:', e && e.message); }
      }
    } finally { try { URL.revokeObjectURL(L.url); } catch (_) {} }
    return best ? { number: best.number, how: best.how, raw: best.raw, method: best.method, candidates: best.candidates, all: all, tries: count.n }
                : { number: null, all: all, tries: count.n };
  }

  global.GMTReceipt = { readTracking: readTracking, extractNumber: extractNumber, _latin: latin, _rank: rankCandidates, _digitsOfWord: digitsOfWord, _crop: crop, _enhance: enhance };
})(window);
