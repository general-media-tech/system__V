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
  var tessP = null;
  function loadTess() {
    if (global.Tesseract) return Promise.resolve();
    if (!tessP) { tessP = loadScript('lib/ocr/tesseract.min.js?v=20261016'); tessP.catch(function () { tessP = null; }); }
    return tessP;
  }
  function getOCR() {
    if (ocrWorkerP) return ocrWorkerP;
    ocrWorkerP = (async function () {
      await loadTess();
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
  /* (19 ت1) أرقام هواتف مكاتب المفتي (من دليل المكاتب) — بلا الصفر الأوّل لأنّ OCR قد يُلصق بها خانةً أو يُسقطه */
  function muftiPhones() {
    var d = (global.GMTOffices && global.GMTOffices.data && global.GMTOffices.data['المفتي']) || {}, out = [];
    Object.keys(d).forEach(function (c) { (d[c] || []).forEach(function (o) { var p = latin(o.phone || '').replace(/\D/g, ''); if (p.length >= 9) out.push(p.replace(/^0/, '')); }); });
    return out;
  }
  function rankCandidates(words, imgH, imgW) {
    var seen = {}, out = [], phones = muftiPhones();
    words.forEach(function (wd) {
      var d = digitsOfWord(wd.text); if (!d || d.length < 5 || d.length > 12) return;
      if (/^(09\d{8}|9\d{8}|9639\d{8}|00963\d+)$/.test(d)) return;          // هاتفٌ سوريّ (أو بلا صفره) — ليس رقم تتبّع
      if (phones.some(function (p) { return d.indexOf(p) !== -1; })) return;    // هاتف مكتبٍ للمفتي ملتصقٌ بخانة
      if (/^(19|20)\d{2}(0[1-9]|1[0-2])\d{2}$/.test(d)) return;               // تاريخٌ مُلصَق
      if (/^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(19|20)\d{2}$/.test(d)) return;  // تاريخٌ يومٌ-شهرٌ-سنة مُلصَق (10-10-2026)
      if (/\d{1,2}\s*[-\/.]\s*(\d{1,2}\s*[-\/.]\s*)?(19|20)\d{2}/.test(latin(wd.text))) return;   // تاريخٌ بفواصل
      var y = wd.bbox ? (wd.bbox.y0 + wd.bbox.y1) / 2 / imgH : 0.5, hgt = wd.bbox ? (wd.bbox.y1 - wd.bbox.y0) : 0;
      var x = (wd.bbox && imgW) ? (wd.bbox.x0 + wd.bbox.x1) / 2 / imgW : 0.5;
      var tr = !!(wd.bbox && imgW) && x > 0.45 && y < 0.4;                      // أعلى اليمين — موضع رقم المفتي المطبوع
      var score = (y < 0.45 ? 3 : y < 0.6 ? 1 : 0)                              // أعلى الإيصال ⇐ أرجح
                + (tr ? 1.5 : 0)
                + (d.length >= 6 && d.length <= 9 ? 2 : 0)                      // طول رقم المفتي المعتاد
                + Math.min(2, hgt / (imgH * 0.02))                              // الخطّ الكبير ⇐ أرجح
                + (wd.confidence || 0) / 50;
      if (seen[d]) { seen[d].score += 0.5; seen[d].tr = seen[d].tr || tr; return; }
      seen[d] = { number: d, score: score, tr: tr }; out.push(seen[d]);
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
      var cands = rankCandidates(words, cv.height, cv.width);
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
      if (!best && !opts.quick) { stage('enhanced'); best = await enhancedPass(ZX, L, opts, push, count); }   // quick: بلا التحسين الثقيل
      if (!best && opts.ocr !== false) {
        stage('ocr');
        try { best = await ocrPass(L, opts, count); }
        catch (e) { console.warn('[GMT] تعذّر التعرّف على النصّ:', e && e.message); }
      }
    } finally { try { URL.revokeObjectURL(L.url); } catch (_) {} }
    return best ? { number: best.number, how: best.how, raw: best.raw, method: best.method, candidates: best.candidates, all: all, tries: count.n }
                : { number: null, all: all, tries: count.n };
  }

  /* ═══ (19 ت1 · برومبت «الماسح الضوئي الذكي» — ثالثاً ورابعاً) قراءة إيصال «المفتي» كاملاً ═══
     ١) نوع الإيصال: اسم الشركة (المفتي/AlMufti) أو رقم هاتف أحد مكاتبها من الدليل ⇐ مؤكَّد. بنيةُ إيصال شحنٍ بلا علامةٍ للمفتي
        ⇐ «غير مؤكَّد» (لا يُنسَب الإيصال لشركةٍ خاطئة: النتائج تُعرض للمراجعة ولا يُملأ شيءٌ تلقائياً).
     ٢) رقم التتبّع من مصدرين: الباركود/QR (ZXing — ما فيه رقمٌ فعلاً فقط) والرقم المطبوع أعلى اليمين (تعرّفٌ محلّي على الأرقام).
        تطابقا ⇐ تحقّقٌ ناجح · اختلفا ⇐ لا يُعتمد أيٌّ منهما · مصدرٌ واحد ⇐ يُعرض مع مصدره · لا شيء ⇐ «تعذر قراءة رقم التتبع».
        الرقم نصٌّ دوماً (الأصفار في أوّله تبقى) والأرقام العربية/الهندية تُحوَّل لاتينيّة.
     ٣) الفرع المصدر: تعرّفٌ محلّي على النصّ العربي (lib/ocr/ara) ⇐ ما بعد كلمة «المصدر» حتى «الوجهة» (الوجهة لا تُقرأ أبداً)
        ⇐ مقارنةٌ تقريبيّة مع فروع المفتي في دليل المكاتب (أخطاء التنقيط الشائعة: جلي = حلب · اللسريان = السريان).
        يُعتمد تلقائياً فقط حين تكون المطابقة واضحة ومتقدّمة على التالية بفارق؛ وإلّا تُعرض الفروع المحتملة والنصّ المقروء. */
  var araP = null;
  function getARA() {
    if (araP) return araP;
    araP = (async function () {
      await loadTess();
      var base = new URL('lib/ocr/', document.baseURI).href;
      return global.Tesseract.createWorker('ara', 1, {
        workerPath: base + 'worker.min.js', corePath: base + 'tesseract-core-lstm.wasm.js', langPath: base,
        gzip: true, cacheMethod: 'none'
      });
    })();
    araP.catch(function () { araP = null; });
    return araP;
  }
  /* هيكل الكلمة العربية بلا نقاط (أخطاء OCR الأكثر شيوعاً هي في النقاط): ب ت ث ن ي ⇒ ٮ · ج خ ⇒ ح · ق ⇒ ف · ز ⇒ ر … */
  var SK = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ب': 'ٮ', 'ت': 'ٮ', 'ث': 'ٮ', 'ن': 'ٮ', 'ي': 'ٮ', 'ى': 'ٮ', 'ئ': 'ٮ',
             'ج': 'ح', 'خ': 'ح', 'ذ': 'د', 'ز': 'ر', 'ش': 'س', 'ض': 'ص', 'ظ': 'ط', 'غ': 'ع', 'ق': 'ف', 'ة': 'ه', 'ؤ': 'و' };
  function skel(t) {
    return latin(t).replace(/[ً-ٰٟـ​-‏؜‪-‮]/g, '')
      .replace(/[أإآٱبتثنيىئجخذزشضظغقةؤ]/g, function (c) { return SK[c]; });
  }
  function lev(a, b) {
    var m = a.length, n = b.length, i, j, prev = [], cur = [];
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function sim(a, b) { if (!a || !b) return 0; return 1 - lev(a, b) / Math.max(a.length, b.length); }
  /* «ال» في أوّل كل كلمة لا تُميّز فرعاً عن فرع (الباب/السريان) ⇒ تُحذف من الطرفين قبل المقارنة */
  function noAl(t) { return String(t).split(' ').map(function (w) { return w.replace(/^ال/, ''); }).join(' '); }
  function bareW(w) { return String(w).replace(/[:：.,،؛;!؟?'"()\[\]{}…«»“”]+/g, ''); }

  /* بنية إيصال الشحن (للاتّجاه والنوع): كم كلمةً معروفةً من الإيصال ظهرت في النصّ المقروء */
  var RC_KEYS = ['المرسل', 'المصدر', 'الوجهة', 'الموبايل', 'الشحن', 'تتبع', 'الباركود', 'جاهزة', 'للارسال', 'الرئيسي',
                 'توقيع', 'التوصيل', 'البضاعة', 'الطرود', 'الاجمالي', 'المدفوع', 'التحصيل', 'المحتوى'].map(skel);
  function structScore(text) { var s = skel(text); return RC_KEYS.filter(function (k) { return s.indexOf(k) !== -1; }).length; }
  function receiptType(text) {
    var s = skel(text), digits = latin(text).replace(/\D+/g, '|'), st = structScore(text), why = [];
    if (/مفٮٮ/.test(s)) why.push('اسم الشركة');
    if (/mufti/i.test(text)) why.push('شعار AlMufti');
    var ph = muftiPhones().filter(function (p) { return digits.indexOf(p) !== -1; });
    if (ph.length) why.push('هاتف مكتبٍ للمفتي');
    if (why.length) return { kind: 'mufti', why: why.join(' + '), struct: st };
    if (st >= 3) return { kind: 'unsure', why: 'إيصال شحنٍ لكن بلا علامةٍ واضحة للمفتي (اسم/شعار/هاتف)', struct: st };
    return { kind: 'unknown', why: 'لم يُقرأ نصّ الإيصال بوضوح', struct: st };
  }

  /* ما بعد «المصدر» حتى «الوجهة» (أو نهاية السطر/٥ كلمات) — الوجهة لا تُؤخذ أبداً */
  var K_SRC = skel('المصدر'), K_DST = skel('الوجهة'), K_STOP = ['المرسل', 'الموبايل', 'الهاتف'].map(skel);
  function isKey(w, k, th) {
    var s = skel(bareW(w)); if (s.length < 3) return false;
    return sim(s, k) >= th || sim(s.replace(/^ا?ل/, ''), k.replace(/^ال/, '')) >= th;
  }
  function wordsOf(line) { return String(line).split(/[\s|<>]+/).filter(Boolean); }
  function takeValue(ws, from) {
    var out = [];
    for (var m = from; m < ws.length && out.length < 5; m++) {
      if (isKey(ws[m], K_DST, 0.6) || K_STOP.some(function (k) { return isKey(ws[m], k, 0.8); })) break;
      if (bareW(ws[m])) out.push(bareW(ws[m]));
    }
    return out;
  }
  function sourceSegment(text) {
    var lines = String(text || '').split(/\n+/);
    for (var i = 0; i < lines.length; i++) {
      var ws = wordsOf(lines[i]);
      for (var j = 0; j < ws.length; j++) {
        if (!isKey(ws[j], K_SRC, 0.67)) continue;
        var val = takeValue(ws, j + 1);
        if (!val.length && i + 1 < lines.length) val = takeValue(wordsOf(lines[i + 1]), 0);
        return { seg: val.join(' '), line: lines[i].trim() };
      }
    }
    return null;
  }

  function muftiOfficeList() {
    /* (19 ت1 · TASK-0051) بنك الفروع: المعطَّل لا يُقرأ، وما أضافه المالك يُقرأ، ومع كل فرعٍ أسماؤه البديلة */
    if (global.GMTMuftiBank) return GMTMuftiBank.list().map(function (o) { return { key: o.key, city: o.city, name: o.name, addr: o.addr || '', aliases: o.aliases || [] }; });
    var d = (global.GMTOffices && global.GMTOffices.data && global.GMTOffices.data['المفتي']) || {}, out = [];
    Object.keys(d).forEach(function (c) { (d[c] || []).forEach(function (o) { out.push({ key: c + '|' + o.name, city: c, name: o.name, addr: o.addr || '' }); }); });
    return out;
  }
  /* أفضل تشابه بين اسمٍ (كلمة أو أكثر) وأيّ مقطعٍ متتالٍ من كلمات النصّ */
  function bestNgram(toks, target) {
    var t = noAl(skel(target).replace(/[0-9]+/g, '').replace(/\s+/g, ' ').trim()), tw = t.split(' ').length, best = 0;
    if (!t) return 0;
    for (var n = Math.max(1, tw - 1); n <= tw + 1; n++) {
      for (var i = 0; i + n <= toks.length; i++) best = Math.max(best, sim(noAl(toks.slice(i, i + n).join(' ')), t));
    }
    return best;
  }
  var GEN_LEAD = /^(خلف|امام|أمام|جانب|بجانب|قرب|مقابل|بالقرب من|شرقي|غربي|شمالي|جنوبي)\s+/;
  function officeVariants(o) {
    var out = [o.name].concat(o.aliases || []), n = String(o.name || '').trim(), k = 0;
    while (GEN_LEAD.test(n) && k++ < 3) { n = n.replace(GEN_LEAD, '').trim(); if (n.split(/\s+/).join('').length >= 4) out.push(n); }
    return out;
  }
  function matchBranch(seg) {
    var toks = String(seg || '').split(/[\s\-–—_\/.,،:]+/).map(bareW)
      .filter(function (w) { return /[؀-ۿ]/.test(w); }).map(function (w) { return skel(w.replace(/[0-9٠-٩]+/g, '')); })
      .filter(function (w) { return w.length >= 2; });
    if (!toks.length) return { key: null, confident: false, candidates: [], text: seg || '' };
    var list = muftiOfficeList().map(function (o) {
      /* (20 ت1 · TASK-0116 · إيصال المالك «درعا-دوار الحمامة») الدليل يسمّي المكتب «خلف دوار الحمامة» والإيصال «دوار الحمامة»:
         كلمةٌ عامّة واحدة («خلف/جانب/مقابل…») كانت تُنزل التشابه إلى 0.81 تحت العتبة. نقارن أيضاً بالاسم بلا كلماته العامّة في أوّله. */
      var offS = officeVariants(o).reduce(function (m, n) { return Math.max(m, bestNgram(toks, n)); }, 0), cityS = bestNgram(toks, o.city);
      var aw = String(o.addr).split(/\s+/).filter(function (w) { return w.length >= 3; }).map(skel);
      var addrS = aw.length ? aw.filter(function (w) { return toks.some(function (t) { return sim(noAl(t), noAl(w)) >= 0.85; }); }).length / aw.length : 0;
      return { key: o.key, city: o.city, offS: offS, cityS: cityS, score: offS * 0.7 + cityS * 0.3 + addrS * 0.05 };
    }).sort(function (a, b) { return (b.score - a.score) || ((a.city === 'حلب' ? 0 : 1) - (b.city === 'حلب' ? 0 : 1)); });
    var top = list[0], second = list[1];
    var confident = !!top && top.score >= 0.82 && top.offS >= 0.8 && (!second || top.score - second.score >= 0.12);
    var cands = list.filter(function (x) { return x.score >= 0.5; }).slice(0, 4).map(function (x) { return x.key; });
    /* المدينة وحدها مقروءة (والمكتب لا) ⇒ المرشّحون هم فروع تلك المدينة، لا فروعٌ من مدنٍ أخرى تشبه حروفُها */
    if (!confident && top && top.offS < 0.8) {
      var city = list.filter(function (x) { return x.cityS >= 0.85; }).map(function (x) { return x.city; })[0];
      if (city) cands = list.filter(function (x) { return x.city === city; }).slice(0, 6).map(function (x) { return x.key; });
    }
    return { key: confident ? top.key : null, confident: confident, candidates: cands, text: seg, best: top ? { key: top.key, score: +top.score.toFixed(2) } : null };
  }

  /* صورةٌ للتعرّف العربي: أقصى القنوات (أقلام التعليم الملوّنة تصير فاتحة والحبر يبقى غامقاً) + تكبيرٌ حتى ٢× */
  function araCanvas(im, rot) {
    var cv0 = crop(im, [0, 0, 1, 1], rot, 2400);
    var k = Math.min(2, 2400 / Math.max(cv0.width, cv0.height)), cv = document.createElement('canvas');
    cv.width = Math.round(cv0.width * k); cv.height = Math.round(cv0.height * k);
    var c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(cv0, 0, 0, cv.width, cv.height);
    var id = c.getImageData(0, 0, cv.width, cv.height), d = id.data;
    for (var i = 0; i < d.length; i += 4) { var v = Math.max(d[i], d[i + 1], d[i + 2]); d[i] = d[i + 1] = d[i + 2] = v; }
    c.putImageData(id, 0, 0);
    return cv;
  }

  /* يقرأ إيصال المفتي. file = الصورة الممسوحة (أو الأصل) · opts.original = الأصل (احتياطٌ للباركود) · opts.onStage(k) */
  async function readMufti(file, opts) {
    opts = opts || {};
    var t0 = Date.now(), stage = function (k) { try { if (opts.onStage) opts.onStage(k); } catch (_) {} };
    var L = await loadImage(file), out = { type: null, barcode: null, printed: null, tracking: null, branch: null, text: '', rot: 0 };
    try {
      /* النصّ (عاملان في الخلفية) والباركود (الخيط الرئيسي) يعملان معاً */
      var textP = (async function () {
        stage('ara');
        var ara = await getARA(), w = L.im.naturalWidth, h = L.im.naturalHeight;
        var rots = w >= h ? [0, 180, 90, 270] : [270, 90, 0, 180], best = null;
        /* (20 ت1 · TASK-0116 · إيصالات المالك الخمسة) ثلاثة أسباب كانت تُسقط الفرع:
           ① صورةٌ لم تمرّ بالماسح (أُلغي أو «كما هي») تُقرأ بلا تحسين — والتحسين نفسه هو ما يجعل «المصدر» مقروءاً.
              ⇒ غير الممسوحة تُحسَّن بطبقة الماسح (لون) قبل القراءة.
           ② كان يُختار الاتّجاه بعدد كلمات الإيصال وحده ويتوقّف عند ٣ — فيُقبل اتّجاهٌ قُرئ هيكله ولم يُقرأ سطر «المصدر».
              ⇒ الأفضل = فرعٌ واثق ثمّ «المصدر» موجود ثمّ عدد الكلمات؛ والتوقّف عند فرعٍ واثق فقط.
           ③ لا فرع بعد الاتّجاهات ⇒ محاولةٌ أخيرة بالأبيض والأسود في أفضل اتّجاه (أنجح على الحبر الحراري الباهت). */
        var DS = global.GMTDocScan, srcIm = L.im;
        function asImg(cv) { try { cv.naturalWidth = cv.width; cv.naturalHeight = cv.height; } catch (_) {} return cv; }
        function processed(mode) {
          if (!DS || !DS.process || !DS.detectNorm) return null;
          try { var d = DS.detectNorm(L.im, 0); return asImg(DS.process(L.im, d.corners, 0, mode)); } catch (_) { return null; }
        }
        if (!opts.original) { var en = processed('color'); if (en) srcIm = en; }
        function attempt(im, rot, tag) {
          return ara.recognize(araCanvas(im, rot)).then(function (res) {
            var txt = (res && res.data && res.data.text) || '', sc = structScore(txt), sg = sourceSegment(txt), m = sg ? matchBranch(sg.seg) : null;
            var a = { rot: rot, txt: txt, sc: sc, src: sg, m: m, rank: (m && m.confident ? 1000 : 0) + (sg ? 100 : 0) + sc, tag: tag };
            if (opts.trace) opts.trace.push({ rot: rot, struct: sc, src: !!sg, conf: !!(m && m.confident), mode: tag });
            return a;
          });
        }
        for (var r = 0; r < rots.length; r++) {
          var a = await attempt(srcIm, rots[r], srcIm === L.im ? 'as-is' : 'color');
          if (!best || a.rank > best.rank) best = a;
          if (a.m && a.m.confident) break;                          // اتّجاهٌ سليم والفرع واضح
          if (r >= 1 && best.sc >= 3 && best.src) break;            // «المصدر» مقروء في اتّجاهٍ سليم — لا داعي للبقيّة
        }
        if (!(best.m && best.m.confident) && best.sc >= 2) {
          var bw = processed('bw');
          if (bw) { var a2 = await attempt(bw, best.rot, 'bw'); if (a2.rank > best.rank) best = a2; }
        }
        out.text = best.txt; out.rot = best.rot; out._best = best;
        if (best.sc < 2) return null;                               // لا اتّجاه مقروء ⇒ لا رقم مطبوع موثوق الموضع
        stage('digits');
        var eng = await getOCR(), cv = enhance(crop(L.im, [0, 0, 1, 1], best.rot, 2400), 'contrast');
        var er = await eng.recognize(cv, {}, { blocks: true }), words = [];
        ((er.data && er.data.blocks) || []).forEach(function (b) { (b.paragraphs || []).forEach(function (pg) { (pg.lines || []).forEach(function (ln) {
          (ln.words || []).forEach(function (wd) { words.push({ text: wd.text, bbox: wd.bbox, confidence: wd.confidence }); }); }); }); });
        out.engText = (er.data && er.data.text) || '';
        return rankCandidates(words, cv.height, cv.width);
      })();
      textP.catch(function () {});
      stage('barcode');
      var bc = await readTracking(file, { ocr: false });
      /* الأصل احتياطاً — بلا طبقة التحسين الثقيلة (جُرّبت على الممسوحة الأوضح): كانت تضاعف الزمن بلا فائدة (٤٨ث ⇒ النصف) */
      if (!bc.number && opts.original && opts.original !== file) bc = await readTracking(opts.original, { ocr: false, quick: true });
      if (bc.number) out.barcode = { number: bc.number, raw: bc.raw, how: bc.how };
      var cands = null;
      try { cands = await textP; } catch (e) { out.textError = (e && e.message) || String(e); }
      cands = cands || [];
      var tr = cands.filter(function (c) { return c.tr; });
      out.printed = tr.length ? { number: tr[0].number, candidates: tr.slice(0, 4).map(function (c) { return c.number; }) } : null;
      out.allDigits = cands.slice(0, 6).map(function (c) { return c.number; });

      /* قواعد التحقّق (برومبت المالك ثالثاً-أ) */
      var b = out.barcode && out.barcode.number, p = out.printed && out.printed.number;
      if (b && cands.some(function (c) { return c.number === b; })) out.tracking = { status: 'match', number: b };
      else if (b && p) out.tracking = { status: 'differ', barcode: b, printed: p };
      else if (b) out.tracking = { status: 'barcode', number: b };
      else if (p) out.tracking = { status: 'printed', number: p, candidates: out.printed.candidates };
      else out.tracking = { status: 'none' };

      out.type = receiptType(out.text + '\n' + (out.engText || ''));
      var src = (out._best && out._best.src) || sourceSegment(out.text);
      out.branch = src ? ((out._best && out._best.src === src && out._best.m) || matchBranch(src.seg)) : { key: null, confident: false, candidates: [], text: '' };
      delete out._best;
      if (src) out.branch.line = src.line;
      if (out.type.kind !== 'mufti') { out.branch.confident = false; out.branch.key = null; }
    } finally { try { URL.revokeObjectURL(L.url); } catch (_) {} }
    out.ms = Date.now() - t0;
    return out;
  }

  global.GMTReceipt = { readTracking: readTracking, readMufti: readMufti, _skel: skel, _sourceSegment: sourceSegment, _matchBranch: matchBranch, _receiptType: receiptType, extractNumber: extractNumber, _latin: latin, _rank: rankCandidates, _digitsOfWord: digitsOfWord, _crop: crop, _enhance: enhance };
})(window);
