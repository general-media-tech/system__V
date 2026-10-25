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
  /* (TASK-0130 · المالك seq 28: «كل وحدة منفصلة وبيشتغلو سوا») الملفّ نفسه يعمل أيضاً «عاملاً» (Web Worker) في خيطٍ مستقلّ:
     قراءة الباركود هناك لا تحجز الواجهة ولا قراءة الفرع ولا الماسح. في العامل لا document: القماش OffscreenCanvas والصورة ImageBitmap */
  var IN_WORKER = typeof document === 'undefined';
  var SELF_URL = (!IN_WORKER && document.currentScript && document.currentScript.src) || '';

  var ZX_SRC = 'lib/zxing.min.js?v=20261003';
  var zxP = null;

  function loadZX() {
    if (global.ZXing) return Promise.resolve(global.ZXing);
    if (IN_WORKER) { try { importScripts(ZX_SRC); } catch (e) { return Promise.reject(e); } return global.ZXing ? Promise.resolve(global.ZXing) : Promise.reject(new Error('ZXing لم تُعرَّف')); }
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
    if (IN_WORKER) return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file); })
      .then(function (bm) { return { im: bm, url: null }; }, function () { var er = new Error('تعذّر فتح الصورة'); er.code = 'bad-image'; throw er; });
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      /* (TASK-0130) decode(): فكّ صورة الهاتف الضخمة (١٢ ميغابكسل) في خيط المتصفّح الجانبي — كان أوّل رسمٍ يفكّها على الخيط الرئيسي */
      im.onload = function () { var go = function () { ok({ im: im, url: url }); }; if (im.decode) im.decode().then(go, go); else go(); };
      im.onerror = function () { URL.revokeObjectURL(url); var er = new Error('تعذّر فتح الصورة'); er.code = 'bad-image'; bad(er); };
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

  /* (TASK-0127) رقمٌ بشكل هاتفٍ سوريّ (٩ أرقام فأكثر يبدأ بـ0 أو 963 أو 00963) ليس رقم تتبّع — رمز QR ثانٍ في الإيصال قد يحمل
     هاتف المكتب أو رابط واتساب، فكان رقمه يُعتمد «رقم تتبّع». أرقام تتبّع المفتي في كل الإيصالات ٦ أرقام. */
  function phoneLike(n) { return /^(00963|963|0)\d{8,}$/.test(n); }
  /* يستخرج «رقم التتبّع» من نصّ رمزٍ مقروء. null إن لم يجد ما يصلح. */
  function extractNumber(text) {
    var t = latin(text).trim();
    if (!t) return null;
    if (/^(tel|sms|smsto|mailto|whatsapp|geo|wifi|mecard|begin):/i.test(t) || /(^|\/\/)(www\.)?(wa\.me|api\.whatsapp\.com|t\.me)\b/i.test(t)) return null;   // هاتف · واتساب · تيليغرام · بطاقة اتّصال
    if (/^\d{4,14}$/.test(t)) return phoneLike(t) ? null : { number: t, how: 'رقم صِرف' };
    var u = null;
    try { if (/^https?:\/\//i.test(t)) u = new URL(t); } catch (_) {}
    if (u) {
      var found = null;
      u.searchParams.forEach(function (v, k) { if (!found && PARAMS.test(k) && /^\d{4,14}$/.test(latin(v)) && !phoneLike(latin(v))) found = latin(v); });
      if (found) return { number: found, how: 'من رابط' };
      var seg = u.pathname.split('/').filter(Boolean).reverse().map(latin).filter(function (x) { return /^\d{4,14}$/.test(x) && !phoneLike(x); })[0];
      if (seg) return { number: seg, how: 'من رابط' };
    }
    var m = (t.match(/\d{5,14}/g) || []).filter(function (x) { return !phoneLike(x); });
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

  function newCanvas(w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (IN_WORKER) return new OffscreenCanvas(w, h);
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  /* مصدر السطوع لـZXing: في الصفحة من القماش مباشرةً (كما كان) · في العامل من بكسلاته (المصدر الأوّل يطلب document) — المعادلة نفسها */
  function lumSrc(ZX, cv) {
    if (!IN_WORKER) return new ZX.HTMLCanvasElementLuminanceSource(cv);
    var w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data, g = new Uint8ClampedArray(w * h);
    for (var i = 0, j = 0; j < g.length; i += 4, j++) g[j] = d[i + 3] === 0 ? 255 : (306 * d[i] + 601 * d[i + 1] + 117 * d[i + 2] + 512) >> 10;
    return new ZX.RGBLuminanceSource(g, w, h);
  }
  function crop(im, r, rot, maxSide) {
    var sw = im.naturalWidth || im.width, sh = im.naturalHeight || im.height;
    var sx = Math.round(sw * r[0]), sy = Math.round(sh * r[1]);
    var cw = Math.max(8, Math.round(sw * r[2])), ch = Math.max(8, Math.round(sh * r[3]));
    var long = Math.max(cw, ch);
    var k = long < 700 ? Math.min(3, 900 / long) : Math.min(1, maxSide / long);   // صغيرةٌ ⇒ كبّرها · ضخمةٌ ⇒ صغّرها
    var w = Math.max(8, Math.round(cw * k)), h = Math.max(8, Math.round(ch * k));
    /* الزاوية قد تكون ٩٠/٢٧٠ (تدوير الهاتف) أو ميلاً صغيراً (±٦° ±١٢°): نكبّر القماش ليسع الصورة المُدارة كاملةً */
    var rad = rot * Math.PI / 180, ca = Math.abs(Math.cos(rad)), sa = Math.abs(Math.sin(rad));
    var cv = newCanvas(Math.max(8, Math.round(w * ca + h * sa)), Math.max(8, Math.round(w * sa + h * ca)));
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
    var cv = newCanvas(src.width, src.height);
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

  /* (22 ت1 · TASK-0118) اتّجاه الإيصال من رمز QR: الرمز مطبوعٌ قائماً على الإيصال، فزاوية حافّته العليا في القصّة (وقد أُديرت rot)
     تعطي الدوران الذي يجعل الإيصال قائماً (0/90/180/270) ⇐ يُقرأ النصّ العربي مرّةً واحدة بدل تجربة الاتّجاهات الأربعة. */
  function uprightFrom(p0, p1, rot) {
    var th = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI, R = Math.round((rot - th) / 90) * 90;
    return ((R % 360) + 360) % 360;
  }
  /* (TASK-0136) نقاطٌ في قصّة crop(im, r, rot, maxSide) ⇒ نِسَبٌ من الصورة الأصليّة (عكس حساب crop نفسه) */
  function cropToNorm(im, r, rot, maxSide, pts) {
    var sw = im.naturalWidth || im.width, sh = im.naturalHeight || im.height;
    var cw = Math.max(8, Math.round(sw * r[2])), ch = Math.max(8, Math.round(sh * r[3])), long = Math.max(cw, ch);
    var k = long < 700 ? Math.min(3, 900 / long) : Math.min(1, maxSide / long), w = Math.max(8, Math.round(cw * k)), h = Math.max(8, Math.round(ch * k));
    var rad = rot * Math.PI / 180, ca = Math.cos(rad), sa = Math.sin(rad);
    var W = Math.max(8, Math.round(w * Math.abs(ca) + h * Math.abs(sa))), H = Math.max(8, Math.round(w * Math.abs(sa) + h * Math.abs(ca)));
    return pts.map(function (p) { var dx = p[0] - W / 2, dy = p[1] - H / 2, ux = dx * ca + dy * sa, uy = -dx * sa + dy * ca; return [r[0] + (ux + w / 2) / w * r[2], r[1] + (uy + h / 2) / h * r[3]]; });
  }
  /* مستطيلٌ يحيط بنقاط (نِسَب) موسَّعاً بنسبةٍ من حجمه ⇒ [x0, y0, x1, y1] */
  function boxOf(pts, pad) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), mx = (x1 - x0) * (pad || 0), my = (y1 - y0) * (pad || 0);
    return [Math.max(0, x0 - mx), Math.max(0, y0 - my), Math.min(1, x1 + mx), Math.min(1, y1 + my)];   // لكلّ محورٍ هامشه (النِّسب ليست مربّعة)
  }
  function zxUpright(ZX, res, rot) {
    try {
      if (!res || res.getBarcodeFormat() !== ZX.BarcodeFormat.QR_CODE) return null;
      var pts = res.getResultPoints();                                   // QR: [أسفل-يسار، أعلى-يسار، أعلى-يمين، …]
      if (!pts || pts.length < 3) return null;
      return uprightFrom({ x: pts[1].getX(), y: pts[1].getY() }, { x: pts[2].getX(), y: pts[2].getY() }, rot);
    } catch (_) { return null; }
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
            var cp = res[k].cornerPoints, up = (res[k].format === 'qr_code' && cp && cp.length >= 2) ? uprightFrom(cp[0], cp[1], rots[j]) : null;
            if (ex) return { number: ex.number, how: ex.how + ' (قارئ المتصفّح)', raw: txt, method: 'native', upright: up };
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
    var o = newCanvas(Math.max(8, Math.round(cw * k)), Math.max(8, Math.round(ch * k)));
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
    var last = null;
    function tryCanvas(cv) {
      var txt = null;
      [ZX.HybridBinarizer, ZX.GlobalHistogramBinarizer].forEach(function (B) {
        if (txt) return;
        try { last = reader.decode(new ZX.BinaryBitmap(new B(lumSrc(ZX, cv)))); txt = last.getText(); } catch (_) { txt = null; }
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
          if (Date.now() - t0 > budget || (opts.stop && opts.stop())) return null;
          count.n++;
          var txt = tryCanvas(enhance(part, plan[p][2][m]));
          await new Promise(function (res) { setTimeout(res, 0); });
          if (!txt) continue;
          push(txt);
          var ex = extractNumber(txt);
          if (ex) return { number: ex.number, how: ex.how + ' (بعد تحسين الصورة' + (plan[p][0] % 90 ? ' وتعديل الميلان' : '') + ')', raw: txt, method: 'enhanced', upright: zxUpright(ZX, last, plan[p][0]) };
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
  /* (22 ت1 · TASK-0122 · المالك: «عم تطوّل») نواة التعرّف بتعليمات SIMD (tesseract.js-core 7.0.0 نفسها، مطابقة لـ worker.min.js):
     أسرع ×٣ تقريباً على النموذج نفسه وبالدقّة نفسها (خانة «المصدر» على إيصالاتك: ٢٫٧ث ⇐ ٠٫٨٦ث، ٥ من ٥ في الحالين).
     كل هواتف أندرويد/آيفون الحديثة تدعمها؛ القديم يأخذ النواة العاديّة كما كان. */
  var SIMD = (function () {
    try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); }
    catch (_) { return false; }
  })();
  var CORE_FILE = SIMD ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js';
  function getOCR() {
    if (ocrWorkerP) return ocrWorkerP;
    ocrWorkerP = (async function () {
      await loadTess();
      var base = new URL('lib/ocr/', document.baseURI).href;
      var w = await global.Tesseract.createWorker('eng', 1, {
        workerPath: base + 'worker.min.js', corePath: base + CORE_FILE, langPath: base,
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
      var res = await worker.recognize(toPGM(cv), {}, { blocks: true });
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
  /* ── (TASK-0130) عامل الباركود: الصفحة تُرسل الملفّ، والعامل يفكّه ويقرأ رموزه في خيطه ويُعيد النتيجة (والسريعة فور ظهورها) ──
     لا عامل (متصفّحٌ قديم بلا OffscreenCanvas · فشل تحميله) ⇒ null ⇒ القراءة في الصفحة كما كانت تماماً. */
  var bcW = null, bcWBad = false, bcSeq = 0, bcJobs = {};
  function bcWorker() {
    if (bcW || bcWBad) return bcW;
    try {
      if (IN_WORKER || !SELF_URL || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined' ||
          !new OffscreenCanvas(1, 1).getContext('2d')) { bcWBad = true; return null; }
      bcW = new Worker(SELF_URL);
      bcW.onmessage = function (e) { var m = e.data || {}, j = bcJobs[m.id]; if (j) j(m); };
      bcW.onerror = function () {                                  // تعذّر تحميله ⇒ كل ما ينتظره يعود للصفحة، ولا عامل بعدها
        bcWBad = true; try { bcW.terminate(); } catch (_) {} bcW = null;
        Object.keys(bcJobs).forEach(function (k) { var j = bcJobs[k]; if (j) j({ kind: 'error', res: null }); });
      };
    } catch (_) { bcWBad = true; bcW = null; }
    return bcW;
  }
  /* «جلسة» لكل صورة: العامل يفكّها مرّةً واحدة ويُبقيها لمهامّها كلّها (الباركود · الخانات · النسخة الكاملة) */
  var sidMap = typeof WeakMap !== 'undefined' ? new WeakMap() : null, sidN = 0;
  function sidOf(file) { if (!sidMap || !file || typeof file !== 'object') return 0; var v = sidMap.get(file); if (!v) { v = ++sidN; sidMap.set(file, v); } return v; }
  function dsURL() { try { var t = document.querySelector('script[src*="gmt-docscan.js"]'); return t ? t.src : ''; } catch (_) { return ''; } }
  /* مهمّةٌ في العامل ⇒ وعدٌ بنتيجتها (null إن لم يوجد عامل أو فشلت — فيعمل المستدعي في الصفحة كما كان) */
  function wcall(msg, opts, transfer) {
    opts = opts || {};
    var W = bcWorker(); if (!W) return Promise.resolve(null);
    return new Promise(function (ok) {
      var id = ++bcSeq, iv = 0, done = false;
      function end(v) { if (done) return; done = true; delete bcJobs[id]; if (iv) clearInterval(iv); ok(v); }
      bcJobs[id] = function (m) {
        if (m.kind === 'fast') { try { if (opts.onFast) opts.onFast(m.res); } catch (_) {} }
        else if (m.kind === 'stage') { try { if (opts.onStage) opts.onStage(m.res); } catch (_) {} }
        else end(m.kind === 'done' ? m.res : null);
      };
      if (opts.stop) iv = setInterval(function () { if (opts.stop()) { try { W.postMessage({ cmd: 'stop', id: id }); } catch (_) {} clearInterval(iv); iv = 0; } }, 100);
      msg.id = id;
      try { W.postMessage(msg, transfer || []); } catch (_) { end(null); }
    });
  }
  function viaWorker(file, opts) {
    return wcall({ cmd: 'read', sid: sidOf(file), file: file, opts: { budgetMs: opts.budgetMs, quick: !!opts.quick, maxSide: opts.maxSide } }, opts);
  }
  /* (TASK-0130) النسخة المقوَّمة الكاملة في العامل (للماسح: «قصّ وتحسين» · وللقراءة) ⇒ قماشٌ في الصفحة أو null
     (TASK-0131) shape = { poly, ci }: محيطٌ بأكثر من أربع نقاط (حوافّ منحنية) ⇒ يُقوَّم برقعة «كونز» كما في الصفحة */
  function processIn(file, corners, rot, mode, dims, shape) {
    var ds = dsURL(); if (!ds) return Promise.resolve(null);
    return wcall({ cmd: 'process', sid: sidOf(file), file: file, corners: corners, rot: rot || 0, mode: mode || 'color', ds: ds, dims: dims || null, shape: shape || null }).then(function (bm) {
      if (!bm) return null;
      var c = newCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0); try { bm.close(); } catch (_) {}
      return c;
    }, function () { return null; });
  }
  /* (TASK-0130) خانةٌ للقراءة العربية جاهزةً من العامل (مقوَّمة · مُدارة قائمة · مكبَّرة · رماديّة · بلا خطوط الجدول) ⇒ { width, height, g, pgm } أو null */
  function boxIn(file, corners, rot, box, dn, dims, mode) {
    var ds = dsURL(); if (!ds) return Promise.resolve(null);
    return wcall({ cmd: 'box', sid: sidOf(file), file: file, corners: corners, rot: rot || 0, box: box, dn: !!dn, ds: ds, dims: dims || null, mode: mode || 'color' }).then(function (r) {
      if (!r || !r.pgm) return null;
      return { width: r.width, height: r.height, pgm: r.pgm, g: r.pgm.subarray(r.pgm.length - r.width * r.height) };
    }, function () { return null; });
  }
  if (IN_WORKER) {
    var wJobs = {}, sess = {}, sessOrder = [];
    var sessBm = function (sid, file) {
      var S = sid && sess[sid];
      if (S) return S;
      S = loadImage(file).then(function (L) { return L.im; });
      if (sid) { sess[sid] = S; sessOrder.push(sid); while (sessOrder.length > 2) delete sess[sessOrder.shift()]; }
      return S;
    };
    var needDS = function (url) { if (!global.GMTDocScan && url) importScripts(url); if (!global.GMTDocScan) throw new Error('no docscan'); return global.GMTDocScan; };
    global.onmessage = function (e) {
      var m = e.data || {};
      if (m.cmd === 'stop') { if (wJobs[m.id]) wJobs[m.id].stop = true; return; }
      if (m.cmd === 'warm') { loadZX().catch(function () {}); return; }
      var post = function (kind, res, tr) { try { global.postMessage({ id: m.id, kind: kind, res: res }, tr || []); } catch (_) {} };
      /* صورة العامل بأبعادٍ غير أبعاد صورة الصفحة (اتّجاه EXIF طُبّق في واحدةٍ دون الأخرى) ⇒ الزوايا لا تنطبق ⇒ ترفض فتعمل الصفحة */
      var sameDims = function (bm) { if (m.dims && (Math.abs(bm.width - m.dims[0]) > 2 || Math.abs(bm.height - m.dims[1]) > 2)) throw new Error('dims'); return bm; };
      if (m.cmd === 'process') {
        sessBm(m.sid, m.file).then(sameDims).then(function (bm) {
          var cv = needDS(m.ds).process(bm, m.corners, m.rot, m.mode, m.shape), out = cv.transferToImageBitmap(); post('done', out, [out]);
        }).catch(function () { post('error', null); });
        return;
      }
      if (m.cmd === 'box') {
        sessBm(m.sid, m.file).then(sameDims).then(function (bm) {
          var o = araBox(needDS(m.ds), bm, m.corners, m.rot, m.box, m.dn, null, m.mode); post('done', { width: o.width, height: o.height, pgm: o.pgm }, [o.pgm.buffer]);
        }).catch(function () { post('error', null); });
        return;
      }
      if (m.cmd !== 'read') return;
      var J = wJobs[m.id] = { stop: false };
      var o = m.opts || {};
      readTracking(m.file, { ocr: false, sid: m.sid, budgetMs: o.budgetMs, quick: o.quick, maxSide: o.maxSide,
        onFast: function (f) { post('fast', f); }, onStage: function (k) { post('stage', k); }, stop: function () { return J.stop; } })
        .then(function (r) { post('done', r); }, function () { post('error', null); })
        .then(function () { delete wJobs[m.id]; });
    };
  }

  async function readTracking(file, opts) {
    opts = opts || {};
    /* (TASK-0130) في العامل إن أمكن (opts.worker === false ⇒ في الصفحة). التعرّف على النصّ (OCR) يبقى في الصفحة: له عامله أصلاً */
    if (!IN_WORKER && opts.worker !== false) {
      var wr = await viaWorker(file, opts);
      if (wr) {
        if (!wr.number && opts.ocr !== false && !(opts.stop && opts.stop())) {
          var Lw = await loadImage(file), cw = { n: wr.tries || 0 };
          try { try { if (opts.onStage) opts.onStage('ocr'); } catch (_) {} var ob = await ocrPass(Lw, opts, cw); if (ob) { wr = { number: ob.number, how: ob.how, raw: ob.raw, method: ob.method, candidates: ob.candidates, upright: null, all: wr.all || [], tries: cw.n }; } }
          catch (e) { console.warn('[GMT] تعذّر التعرّف على النصّ:', e && e.message); }
          finally { try { URL.revokeObjectURL(Lw.url); } catch (_) {} }
        }
        return wr;
      }
    }
    var ZX = await loadZX();
    var L = (IN_WORKER && opts.sid) ? { im: await sessBm(opts.sid, file), url: null } : await loadImage(file);
    var all = [], count = { n: 0 }, best = null, seen = {};
    function push(t) { if (t && !seen[t]) { seen[t] = 1; all.push(t); } }
    function stage(k) { try { if (opts.onStage) opts.onStage(k); } catch (_) {} }
    try {
      /* القارئ منخفض المستوى (قماش ⇒ BinaryBitmap) — جرّبتُ decodeFromImageUrl في نسخة ZXing المرفقة
         فلم يفكّ حتى رمزاً نظيفاً صنعتُه بنفسي، بينما هذا المسار يفكّه. لا نعتمد على ما لم نجرّبه. */
      var reader = new ZX.MultiFormatReader();
      reader.setHints(hints(ZX));
      var last = null, upright = null;
      var tryCanvas = function (cv) {
        var txt = null;
        [ZX.HybridBinarizer, ZX.GlobalHistogramBinarizer].forEach(function (B) {
          if (txt) return;
          try {
            var bm = new ZX.BinaryBitmap(new B(lumSrc(ZX, cv)));
            var res = reader.decode(bm);
            txt = res && res.getText ? res.getText() : null;
            if (txt) last = res;
          } catch (_) { txt = null; }
        });
        return txt;
      };
      for (var i = 0; i < REGIONS.length && !best && !(opts.stop && opts.stop()); i++) {
        var rots = (i === 0) ? [0, 90, 270] : [0, 90];
        for (var j = 0; j < rots.length && !best; j++) {
          var cv = crop(L.im, REGIONS[i], rots[j], opts.maxSide || 1800);
          count.n++;
          var txt = tryCanvas(cv);
          /* لا تُجمِّد الواجهة: تنفّسٌ بين المحاولات */
          await new Promise(function (r) { setTimeout(r, 0); });
          if (!txt) continue;
          push(txt);
          if (upright === null) upright = zxUpright(ZX, last, rots[j]);       // أيّ QR يكفي للاتّجاه حتى لو لم يحمل رقماً
          var ex = extractNumber(txt);
          if (ex) {
            best = { number: ex.number, how: ex.how, raw: txt, method: 'zxing' };
            /* (TASK-0136) موضع الرمز في الصورة الأصليّة: مراكز «عيون» الـQR الثلاث موسَّعةً لحوافّه ⇒ الماسح لا يقصّه */
            try { var rp = last.getResultPoints(); if (rp && rp.length >= 3) best.box = boxOf(cropToNorm(L.im, REGIONS[i], rots[j], opts.maxSide || 1800, rp.slice(0, 3).map(function (q) { return [q.getX(), q.getY()]; })), 0.35); } catch (_) {}
          }
        }
      }
      if (best) best.upright = upright;
      try { if (opts.onFast) opts.onFast(best ? best : { number: null, upright: upright }); } catch (_) {}
      if (!best) { stage('native'); best = await nativePass(L, push); }
      if (!best && !opts.quick) { stage('enhanced'); best = await enhancedPass(ZX, L, opts, push, count); }   // quick: بلا التحسين الثقيل
      if (!best && opts.ocr !== false) {
        stage('ocr');
        try { best = await ocrPass(L, opts, count); }
        catch (e) { console.warn('[GMT] تعذّر التعرّف على النصّ:', e && e.message); }
      }
    } finally { try { URL.revokeObjectURL(L.url); } catch (_) {} }
    return best ? { number: best.number, how: best.how, raw: best.raw, method: best.method, candidates: best.candidates, upright: best.upright == null ? null : best.upright, box: best.box || null, all: all, tries: count.n }
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
        workerPath: base + 'worker.min.js', corePath: base + CORE_FILE, langPath: base,
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

  /* «شركة <اسمٌ غير المفتي>» مقروءة ⇒ إيصال شركةٍ أخرى: لا يُنسب للمفتي حتى لو شابه سطر «المصدر» أحد فروعها */
  /* تذييلٌ فيه رقم هاتفٍ مقروء (٩ أرقام فأكثر) وليس فيه أيٌّ من هواتف مكاتب المفتي ولا اسمها ⇒ إيصال شركةٍ أخرى */
  function foreignFooter(foot) {
    if (!foot || /مفٮٮ/.test(skel(foot)) || /mufti/i.test(foot)) return false;
    var runs = latin(foot).match(/\d{9,}/g);
    if (!runs) return false;
    /* (TASK-0130 · صورةٌ حقيقيّة) هاتف المكتب مقروءٌ بخانةٍ ناقصة أو خاطئة كان يكفي ليُعدّ الإيصال لشركةٍ أخرى فيُسحب فرعه ⇒
       رقمٌ على بُعد خانتين من هاتفٍ للمفتي هو هاتفه (هواتف شركةٍ أخرى تختلف في خاناتٍ كثيرة) */
    var phones = muftiPhones();
    return !runs.some(function (r) {
      var d = r.replace(/^0/, '');
      return phones.some(function (p) { return d.indexOf(p) !== -1 || lev(d, p) <= 2; });
    });
  }
  function otherCompany(text, foot) {
    if (foreignFooter(foot)) return true;
    var re = /سركه\s+(\S+)/g, m, K = skel('مفتي');
    while ((m = re.exec(skel(text)))) {
      var w = noAl(bareW(m[1]));
      if (w.length >= 4 && sim(w, K) < 0.5) return true;          // اسمٌ مقروء (لا بقايا مشوّهة) ولا يشبه «المفتي»
    }
    return false;
  }

  /* (TASK-0157 · المالك seq 60 «التعرّف على الشركة من شكل الإيصال») اسم شركة شحنٍ أخرى مقروءٌ في الإيصال ⇒ اسمها كما في قائمة الشركات.
     «شركة <اسم>» أوّلاً، ثمّ الاسم وحده كلمةً كاملة (هيكلاً بلا نقاط) أو بالحروف اللاتينية. لا شيء ⇒ null (لا تخمين). */
  var CO_NAMES = [['القدموس', /[qk]a?dmou?s/i], ['مسارات', /masarat/i], ['بابل', /\bbabel\b|\bbabil\b/i],
                  ['الرافدين', /rafidain|rafedain/i], ['هافال', /\bhaval\b/i], ['الأهلية', /ahlia|ahliya/i]]
    .map(function (c) { return { name: c[0], sk: noAl(skel(c[0])), lat: c[1] }; });
  function companyOf(text) {
    var raw = String(text || ''), s = skel(raw), i, m;
    var byWord = function (w, th) {
      w = noAl(bareW(w)); if (w.length < 4) return null;
      for (i = 0; i < CO_NAMES.length; i++) if (w === CO_NAMES[i].sk || (CO_NAMES[i].sk.length >= 5 && sim(w, CO_NAMES[i].sk) >= th)) return CO_NAMES[i].name;
      return null;
    };
    var re = /سركه\s+(\S+)/g;
    while ((m = re.exec(s))) { var n = byWord(m[1], 0.8); if (n) return n; }
    var ws = s.split(/[\s|<>]+/);
    for (var k = 0; k < ws.length; k++) { var n2 = byWord(ws[k], 0.86); if (n2) return n2; }
    for (i = 0; i < CO_NAMES.length; i++) if (CO_NAMES[i].lat.test(raw)) return CO_NAMES[i].name;
    return null;
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
    var t0 = skel(target).replace(/[0-9]+/g, '').replace(/\s+/g, ' ').trim(), t = noAl(t0), tw = t.split(' ').length, best = 0;
    if (!t) return 0;
    /* (TASK-0130 · صورتان حقيقيّتان) اسمٌ قصير جداً بلا «ال» («الباب» ⇒ ٮاٮ) يطابق تماماً بقيّة كلمةٍ أطول: «السريان» قُرئت «السرر يان»
       فطابقت «يان» (ٮاٮ) «الباب» واعتُمدت خطأً. ثلاثة أحرفٍ بلا نقاط ليست دليلاً ⇒ اسمٌ كهذا يُقارن بـ«ال» (الكلمة كما تُكتب) */
    var keepAl = t0 !== t && t.replace(/\s+/g, '').length <= 3, f = keepAl ? function (x) { return x; } : noAl, tt = keepAl ? t0 : t;
    for (var n = Math.max(1, tw - 1); n <= tw + 1; n++) {
      for (var i = 0; i + n <= toks.length; i++) {
        var g = toks.slice(i, i + n);
        best = Math.max(best, sim(f(g.join(' ')), tt));
        /* وكلمةٌ قسمها القارئ اثنتين («السرر يان») ⇒ تُقارن ملتصقةً أيضاً */
        if (n >= 2) best = Math.max(best, sim(g.map(f).join(''), tt.replace(/\s+/g, '')));
      }
    }
    return best;
  }
  var GEN_LEAD = /^(خلف|امام|أمام|جانب|بجانب|قرب|مقابل|بالقرب من|شرقي|غربي|شمالي|جنوبي)\s+/;
  function officeVariants(o) {
    var out = [o.name].concat(o.aliases || []), n = String(o.name || '').trim(), k = 0;
    while (GEN_LEAD.test(n) && k++ < 3) { n = n.replace(GEN_LEAD, '').trim(); if (n.split(/\s+/).join('').length >= 4) out.push(n); }
    /* (TASK-0127) اسمٌ من ٣ كلمات فأكثر («السكن الجامعي وحدة 18») يُقرأ أحياناً بأوّل كلمتين فقط ⇒ هما اسمٌ بديل (إن طالتا ≥٨ أحرف) */
    var ws = n.replace(/[0-9٠-٩]+/g, ' ').split(/\s+/).filter(Boolean);
    if (ws.length >= 3 && (ws[0] + ws[1]).length >= 8) out.push(ws[0] + ' ' + ws[1]);
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
    /* (TASK-0127) فرعان في المدينة نفسها واسم أحدهما داخل اسم الآخر («بانياس» و«بانياس البلد») وكلاهما مقروءٌ كاملاً ⇒ الأطول
       (النصّ «بانياس-بانياس البلد» يحوي الاثنين؛ لو كان المقصود «بانياس» لما قُرئت «البلد»). كانا يتعادلان ⇒ «غير مؤكَّد». */
    /* اسمٌ «داخل» آخر بالكلمات كاملةً (لا بالحروف: هيكل «الباب» داخل هيكل «السريان») */
    var nw = function (x) { return noAl(skel(String(x.key.split('|')[1] || '').replace(/[0-9٠-٩]+/g, ' '))).split(/\s+/).filter(Boolean); };
    var inside = function (a, b) { var A = nw(a), B = nw(b); return A.length < B.length && A.every(function (w) { return B.indexOf(w) !== -1; }); };
    if (top && second && top.city === second.city && top.offS >= 0.95 && second.offS >= 0.95) {
      var lg = inside(second, top) ? top : inside(top, second) ? second : null;
      if (lg) { var sh = lg === top ? second : top; list = [lg].concat(list.filter(function (x) { return x !== lg && x !== sh; })); top = lg; second = list[1]; }
    }
    /* والعكس: اختير القصير («بانياس») وله في المدينة نفسها فرعٌ اسمه يحويه («بانياس البلد») ⇒ لا يُعتمد تلقائياً أبداً — يُعرضان معاً.
       غياب «البلد» ليس دليلاً: خطّ قلمٍ أو إصبعٌ أو طيّةٌ عليها فتُقرأ «بانياس-بانياس» (مسح الصور الصعبة: اعتُمد «بانياس» خطأً مرّتين). */
    var nested = !!top && list.some(function (x) { return x !== top && x.city === top.city && inside(top, x); });
    var confident = !!top && !nested && top.score >= 0.82 && top.offS >= 0.8 && (!second || top.score - second.score >= 0.12);
    var cands = list.filter(function (x) { return x.score >= 0.5; }).slice(0, 4).map(function (x) { return x.key; });
    /* المدينة وحدها مقروءة (والمكتب لا) ⇒ المرشّحون هم فروع تلك المدينة، لا فروعٌ من مدنٍ أخرى تشبه حروفُها */
    if (!confident && top && top.offS < 0.8) {
      var city = list.filter(function (x) { return x.cityS >= 0.85; }).map(function (x) { return x.city; })[0];
      if (city) cands = list.filter(function (x) { return x.city === city; }).slice(0, 6).map(function (x) { return x.key; });
    }
    return { key: confident ? top.key : null, confident: confident, candidates: cands, text: seg, best: top ? { key: top.key, score: +top.score.toFixed(2) } : null };
  }

  var CELL = [0.38, 0.36, 1, 0.72], BAND = [0, 0.25, 1, 0.8];   // خانة «المصدر» · شريط الوسط (نِسَب من الإيصال القائم)
  var MARK_TOP = [0, 0, 1, 0.38], MARK_FOOT = [0, 0.74, 1, 1];   // اسم الشركة/شعارها · تذييل هواتف مكاتبها
  /* صورةٌ للتعرّف العربي: أقصى القنوات (أقلام التعليم الملوّنة تصير فاتحة والحبر يبقى غامقاً) + تكبيرٌ حتى ٢× */
  /* (TASK-0129) وسيط ٣×٣ على السطوع (أقصى القنوات): يمحو تشويش صورةٍ ليليّة («سرمدا» قُرئت «شرمنا») ويُبقي خطّ الحبر */
  function median3(cv) {
    var w = cv.width, h = cv.height, c = cv.getContext('2d'), id = c.getImageData(0, 0, w, h), d = id.data, g = new Uint8Array(w * h), o = new Uint8Array(w * h), i, x, y;
    for (i = 0; i < w * h; i++) g[i] = Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    var p = new Uint8Array(9), t;
    function op(a, b) { if (p[a] > p[b]) { t = p[a]; p[a] = p[b]; p[b] = t; } }      // شبكة فرزٍ لوسيط ٩ (Paeth) — أسرع بكثير من sort
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var q = y * w + x;
      if (y === 0 || x === 0 || y === h - 1 || x === w - 1) { o[q] = g[q]; continue; }
      p[0] = g[q - w - 1]; p[1] = g[q - w]; p[2] = g[q - w + 1]; p[3] = g[q - 1]; p[4] = g[q]; p[5] = g[q + 1]; p[6] = g[q + w - 1]; p[7] = g[q + w]; p[8] = g[q + w + 1];
      op(1, 2); op(4, 5); op(7, 8); op(0, 1); op(3, 4); op(6, 7); op(1, 2); op(4, 5); op(7, 8); op(0, 3); op(5, 8); op(4, 7); op(3, 6); op(1, 4); op(2, 5); op(4, 7); op(4, 2); op(6, 4); op(4, 2);
      o[q] = p[4];
    }
    for (i = 0; i < w * h; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = o[i]; }
    c.putImageData(id, 0, 0);
    return cv;
  }
  /* (TASK-0129) خطوط الجدول (أفقيّةٌ وعموديّة طويلة) تُربك تقسيم الصفحة في Tesseract: خانة «المصدر» واضحةٌ تماماً داخل إطارها
     ولا يقرؤها (يقرأ عمود المرسَل إليه بدلها) ⇒ تُمحى الخطوط الطويلة (≥٢٥٪ من العرض · ≥٦٠٪ من الارتفاع) قبل القراءة */
  /* (TASK-0130) صورة القراءة العربية «رماديّةٌ خام» { width, height, g } (لا قماش): تُقرأ بكسلاتها مرّةً واحدة، وتُمحى خطوطها ويُقاس
     تشويشها عليها، وتُعطى للقارئ PGM بلا نسخ (pgm يحمل الترويسة قبلها) — كانت ٤ قراءاتٍ وكتابتان لقماشٍ من ٢ ميغابكسل (~١٫٥ث على هاتفٍ متوسّط) */
  function grayOf(w, h) {
    var head = 'P5\n' + w + ' ' + h + '\n255\n', pgm = new Uint8Array(head.length + w * h);
    for (var i = 0; i < head.length; i++) pgm[i] = head.charCodeAt(i);
    return { width: w, height: h, g: pgm.subarray(head.length), pgm: pgm };
  }
  function unrule(o) {
    var w = o.width, h = o.height, d = o.g, x, y, i, run;
    /* «داكن» نسبةً لسطوع الورقة (وسيط الخانة): في إضاءةٍ خافتة الورقة نفسها أغمق من أيّ عتبةٍ ثابتة فكان النصّ كلّه يُمحى */
    var hist = new Uint32Array(256), tot = w * h, acc = 0, med = 255;
    for (i = 0; i < tot; i++) hist[d[i]]++;
    for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= tot / 2) { med = i; break; } }
    var TH = Math.min(140, med * 0.55), wipe = [], wiped = 0;
    for (y = 0; y < h; y++) { run = 0; for (x = 0; x <= w; x++) { if (x < w && d[y * w + x] < TH) run++; else { if (run >= w * 0.25) wipe.push([y * w + x - run, 1, run]); run = 0; } } }
    for (x = 0; x < w; x++) { run = 0; for (y = 0; y <= h; y++) { if (y < h && d[y * w + x] < TH) run++; else { if (run >= h * 0.6) wipe.push([(y - run) * w + x, w, run]); run = 0; } } }
    wipe.forEach(function (r) { wiped += r[2]; });
    if (!wipe.length || wiped > tot * 0.08) return o;               // خطوطٌ أكثر من ٨٪ من الخانة ⇒ ليست خطوط جدول (ظلامٌ/ظلّ) ⇒ لا تُمسّ
    wipe.forEach(function (r) { for (i = 0; i < r[2]; i++) d[r[0] + i * r[1]] = med; });
    return o;
  }
  /* مستوى التشويش: متوسّط |السطوع − وسيط جواره ٣×٣| على عيّنةٍ من النقاط — صورةٌ نظيفة ~١–٣ · ليليّة مشوّشة أعلى بكثير */
  function noiseOf(o) {
    var w = o.width, h = o.height, d = o.g, p = new Uint8Array(9), t, sum = 0, cnt = 0;
    function op(a, b) { if (p[a] > p[b]) { t = p[a]; p[a] = p[b]; p[b] = t; } }
    var step = Math.max(1, Math.floor(Math.sqrt(w * h / 20000)));
    for (var y = 1; y < h - 1; y += step) for (var x = 1; x < w - 1; x += step) {
      var k = 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) p[k++] = d[(y + dy) * w + x + dx];
      var g = p[4];
      op(1, 2); op(4, 5); op(7, 8); op(0, 1); op(3, 4); op(6, 7); op(1, 2); op(4, 5); op(7, 8); op(0, 3); op(5, 8); op(4, 7); op(3, 6); op(1, 4); op(2, 5); op(4, 7); op(4, 2); op(6, 4); op(4, 2);
      sum += Math.abs(g - p[4]); cnt++;
    }
    return cnt ? sum / cnt : 0;
  }
  var NOISY = 2.5;   // عتبة «مشوّشة» لمتوسّط |السطوع − الوسيط| على خانةٍ مكبَّرة: إيصالات المالك الحقيقية ٠٫٢–٠٫٨ · ليليّةٌ مُصطنعة ٣–٦٫٥
  /* (TASK-0130) خانةٌ في الإيصال القائم (بعد التدوير rot) ⇐ الخانة نفسها في النسخة المقوَّمة قبل التدوير */
  function rotBox(rot, b) {
    return rot === 90 ? [b[1], 1 - b[2], b[3], 1 - b[0]] : rot === 180 ? [1 - b[2], 1 - b[3], 1 - b[0], 1 - b[1]] :
           rot === 270 ? [1 - b[3], b[0], 1 - b[1], b[2]] : b;
  }
  function rotCanvas(c, rot) {
    if (!rot) return c;
    var side = rot === 90 || rot === 270, o = newCanvas(side ? c.height : c.width, side ? c.width : c.height), x = o.getContext('2d');
    x.translate(o.width / 2, o.height / 2); x.rotate(rot * Math.PI / 180); x.drawImage(c, -c.width / 2, -c.height / 2);
    return o;
  }
  var ARA_MARGIN = 0;
  /* (TASK-0130) خانةٌ من الإيصال القائم مباشرةً من الأصل وزوايا الماسح: تُقوَّم وتُحسَّن وحدها ثمّ تُدار وتُكبَّر بمقياس المسار الكامل نفسه */
  function araBox(DS, img, corners, rot, box, dn, margin, mode) {
    mode = mode === 'bw' ? 'bw' : 'color';
    var max = 2400, G = DS.rectGeom(img, corners), L0 = Math.max(G.w, G.h), sF = L0 < 700 ? Math.min(3, 900 / L0) : Math.min(1, max / L0);
    var rb = rotBox(rot, box), m = margin == null ? ARA_MARGIN : margin, pb;
    if (m > 0) {
      /* التحسين يقدّر إضاءة الخلفيّة من جوار كل نقطة: خانةٌ وحدها تخسر جوار أطرافها فتختلف عن قصّ النسخة الكاملة (وقراءتها معها).
         تُحسَّن الخانة بهامشٍ حولها ثمّ يُقصّ الهامش */
      var eb = [Math.max(0, rb[0] - m), Math.max(0, rb[1] - m), Math.min(1, rb[2] + m), Math.min(1, rb[3] + m)], pe = DS.processBox(img, corners, eb, mode);
      var sx = pe.width / (eb[2] - eb[0]), sy = pe.height / (eb[3] - eb[1]), ox = Math.round((rb[0] - eb[0]) * sx), oy = Math.round((rb[1] - eb[1]) * sy);
      pb = newCanvas(Math.max(8, Math.round((rb[2] - rb[0]) * sx)), Math.max(8, Math.round((rb[3] - rb[1]) * sy)));
      pb.getContext('2d').drawImage(pe, ox, oy, pb.width, pb.height, 0, 0, pb.width, pb.height);
    } else pb = DS.processBox(img, corners, rb, mode);
    var cv0 = rotCanvas(pb, rot);
    if (dn) cv0 = median3(cv0);
    return araFinish(cv0, sF * Math.min(2, max / (sF * Math.max(cv0.width, cv0.height))), true);
  }
  function araCanvas(im, rot, box, dn) {
    var max = 2400, cv0 = crop(im, [0, 0, 1, 1], rot, max);
    if (box) {                                                   // جزءٌ فقط من الإيصال القائم [x0, y0, x1, y1] (نِسَب) — حيث سطر «المصدر»
      var x0 = Math.round(cv0.width * box[0]), y0 = Math.round(cv0.height * box[1]);
      var bw = Math.max(8, Math.round(cv0.width * (box[2] - box[0]))), bh = Math.max(8, Math.round(cv0.height * (box[3] - box[1]))), bc = newCanvas(bw, bh);
      bc.getContext('2d').drawImage(cv0, x0, y0, bw, bh, 0, 0, bw, bh);
      cv0 = bc;
    }
    if (dn) cv0 = median3(cv0);
    return araFinish(cv0, Math.min(2, max / Math.max(cv0.width, cv0.height)), !!box);
  }
  function araFinish(cv0, k, isBox) {
    var cv = newCanvas(cv0.width * k, cv0.height * k);
    var c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(cv0, 0, 0, cv.width, cv.height);
    var d = c.getImageData(0, 0, cv.width, cv.height).data, o = grayOf(cv.width, cv.height), g = o.g;
    for (var i = 0, j = 0; j < g.length; i += 4, j++) { var a = d[i], b = d[i + 1], e = d[i + 2]; g[j] = a > b ? (a > e ? a : e) : (b > e ? b : e); }
    return isBox ? unrule(o) : o;
  }
  /* (TASK-0130) صورةٌ رماديّة خام (PGM) لقارئ النصّ بدل القماش: المكتبة كانت ترمّز القماش PNG على الخيط الرئيسي ثمّ تفكّه في عاملها
     (~نصف ثانية لكل قراءة على هاتفٍ متوسّط) — النصّ المقروء هو نفسه حرفاً بحرف */
  function toPGM(cv) {
    if (cv.pgm) return cv.pgm;
    var w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data, head = 'P5\n' + w + ' ' + h + '\n255\n', g = new Uint8Array(head.length + w * h), i, j;
    for (i = 0; i < head.length; i++) g[i] = head.charCodeAt(i);
    for (i = 0, j = head.length; i < d.length; i += 4, j++) g[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    return g;
  }

  /* يقرأ إيصال المفتي. file = الصورة الممسوحة (أو الأصل) · opts.original = الأصل (احتياطٌ للباركود) · opts.onStage(k) */
  async function readMufti(file, opts) {
    opts = opts || {};
    var t0 = Date.now(), stage = function (k) { try { if (opts.onStage) opts.onStage(k); } catch (_) {} };
    /* (TASK-0130) opts.geom() ⇒ وعدٌ بنسخة الماسح المقوَّمة { cv, corners } (أو null): القراءة تبدأ مع اختيار الصورة قبل الماسح، والفرع
       ينتظر نسخته بدل معالجة الصورة مرّةً ثانية. معها لا تُحمَّل الصورة الأصليّة في الصفحة إلّا عند الحاجة (فكٌّ ثانٍ لـ١٢ ميغابكسل) */
    var Lp = null, getL = function () { return Lp || (Lp = loadImage(file)); };
    var L = opts.geom ? null : await getL(), out = { type: null, barcode: null, printed: null, tracking: null, branch: null, text: '', rot: 0 };
    try {
      /* (22 ت1 · TASK-0118 · المالك: «عم يطوّل كثير… طلبت فقط رقم التتبع والفرع المصدر»)
         ① الباركود أوّلاً وسريعاً، ورقمه يُبلَّغ للواجهة فوراً (opts.onTracking) دون انتظار قراءة النصّ.
         ② اتّجاه الإيصال من رمز QR ⇐ قراءةٌ عربية واحدة بدل حتى خمس.
         ③ قُرئ الباركود ⇐ لا قراءة ثانية لأرقام الصفحة كلّها (كانت تقرأ الهواتف والأسماء لمقارنةٍ لم تعد مطلوبة).
         ④ لا يُقرأ اسمٌ ولا هاتف: من النصّ يُؤخذ سطر «المصدر» وحده. */
      var fastDone, fastP = new Promise(function (ok) { fastDone = ok; });
      /* (TASK-0136 · المالك seq 37: «سوّي قراءة الرقم خاصّة حتى قبل المسح وقبل التحديد لأنّه ممكن القصّ يقصّ الرقم») الرقم وحدةٌ
         مستقلّة على الصورة الأصليّة: الباركود (في عامله، كما كان) ثمّ — إن لم يوجد خلال ١٫٥ث — الرقم المطبوع من الأصل بالتوازي مع
         قراءة الفرع (كان يُقرأ بعد الفرع ومن النسخة المقصوصة وحدها: قصٌّ قطع الرقم ⇒ لا رقم). وموضعه (opts.onNumBox) ⇒ الماسح يُبقيه داخل حدوده. */
      var numBox = function (b) { if (b && opts.onNumBox) { try { opts.onNumBox(b); } catch (_) {} } };
      /* (TASK-0159) رمز القدموس/مسارات ⇒ out.other (ورقمه لا يُبلَّغ رقماً للمفتي) · opts.stopOnOther ⇒ تتوقّف القراءة ويُسلَّم لقارئهما */
      var noteCodes = function (x) {
        if (out.other || !x) return;
        var co = otherOf('', [x.raw].concat(x.all || []));
        if (co) { out.other = { company: co, rot: x.upright != null ? x.upright : null, by: 'code' }; out.codes = { raw: x.raw, all: x.all || [], upright: x.upright }; }
      };
      fastP.then(function (f) { if (f && f.box) numBox(f.box); });
      stage('barcode');
      var bcP = (async function () {
        /* (TASK-0122) ميزانيّة محاولات الباركود البطيئة ١٠ث هنا (لا ٢٢): الصورة ممسوحة ومقوَّمة أصلاً، وفي إيصالاتك لم تنجح
           المحاولات البطيئة قطّ حيث فشلت السريعة — كانت تُبقي «جارٍ القراءة» ظاهرةً بعد ظهور الفرع بعشرين ثانية. */
        /* (TASK-0127) opts.lite = { text, rot }: قراءةٌ ثانية بعد مبكرةٍ اكتملت على الصورة نفسها ⇒ الباركود السريع فقط (بلا التحسين
           ولا الأصل)، والنصّ (إن نقص الفرع) في اتّجاهها المعروف وحده — فرصةٌ ثانية رخيصة بدل إعادة كل شيء (كانت ٢٥–٣٠ث) */
        /* (TASK-0130) opts.numDone() ⇒ الرقم وُجد من مصدرٍ آخر (باركود النسخة الممسوحة) فتتوقّف محاولات الأصل البطيئة */
        /* (TASK-0130) الرقم المطبوع قُرئ ⇒ تُمهَل محاولات الباركود ٣ث فقط (في عاملها: لا تؤخّر شيئاً): إن وجدته طابقا (تحقّقٌ يُملأ تلقائياً)
           بدل «مطبوعٌ فقط» ينتظر ضغطتك — كانت تتوقّف فوراً */
        var numDone = function () { return (printedSeen && Date.now() - printedAt > 3000) || cancelled() || !!(opts.numDone && opts.numDone()); };
        var bc = await readTracking(file, { ocr: false, quick: !!opts.lite, budgetMs: 10000, onFast: function (f) { fastDone(f); }, stop: numDone });
        fastDone(null); noteCodes(bc);
        if (opts.lite) { if (bc.number && opts.onTracking && !out.other) { try { opts.onTracking({ status: 'barcode', number: bc.number }); } catch (_) {} } return bc; }
        /* الأصل احتياطاً — بلا طبقة التحسين الثقيلة (جُرّبت على الممسوحة الأوضح): كانت تضاعف الزمن بلا فائدة (٤٨ث ⇒ النصف) */
        if (!bc.number && !numDone() && opts.original && opts.original !== file) { bc = await readTracking(opts.original, { ocr: false, quick: true, stop: numDone }); noteCodes(bc); }
        if (bc.number && opts.onTracking && !out.other) { try { opts.onTracking({ status: 'barcode', number: bc.number }); } catch (_) {} }
        return bc;
      })();
      var bcDone = null, printedSeen = false, printedAt = 0;
      var unrot = function (r, p) { return r === 90 ? [p[1], 1 - p[0]] : r === 180 ? [1 - p[0], 1 - p[1]] : r === 270 ? [1 - p[1], p[0]] : p; };
      var origDigitsP = (opts.lite || opts.original) ? null : (async function () {
        var f = await Promise.race([fastP, new Promise(function (z) { setTimeout(z, 1500); })]);
        if ((f && f.number) || (bcDone && bcDone.number) || cancelled()) return null;
        /* اتّجاه الإيصال من رمز QR (ولو لم يحمل الرقم) إن وُجد · وإلّا كما التُقطت، ولا يُقبل حينها إلّا رقمٌ مقروءٌ بثقةٍ عالية (≥٧٥):
           نصٌّ مقلوب يُقرأ أرقاماً عشوائيّة بثقةٍ منخفضة (إيصالٌ بلا رقمٍ مقلوبٌ ١٨٠° أعطى «00915860» في المسح) — والمسار المتأخّر يعرف
           الاتّجاه من النصّ العربي */
        var known = !!(f && f.upright != null), eng = await getOCR(), Lo = await getL(), r = known ? f.upright : 0;
        if ((bcDone && bcDone.number) || cancelled()) return null;
        var cv = enhance(crop(Lo.im, [0, 0, 1, 1], r, 2400), 'contrast');
        var er = await eng.recognize(toPGM(cv), {}, { blocks: true }), words = [];
        ((er.data && er.data.blocks) || []).forEach(function (b) { (b.paragraphs || []).forEach(function (pg) { (pg.lines || []).forEach(function (ln) {
          (ln.words || []).forEach(function (wd) { words.push({ text: wd.text, bbox: wd.bbox, confidence: wd.confidence }); }); }); }); });
        if (!known) { words = words.filter(function (wd) { return (wd.confidence || 0) >= 75; }); if (!words.length) return null; }
        var rk0 = rankCandidates(words, cv.height, cv.width), top = rk0.filter(function (c) { return c.number.length >= 6 && c.number.length <= 9 && (c.tr || c.score >= 6); })[0];
        if (top) words.forEach(function (wd) {
          if (wd.bbox && digitsOfWord(wd.text) === top.number) numBox(boxOf([unrot(r, [wd.bbox.x0 / cv.width, wd.bbox.y0 / cv.height]), unrot(r, [wd.bbox.x1 / cv.width, wd.bbox.y1 / cv.height])], 0.15));
        });
        return { rot: r, cands: rk0 };
      })().catch(function () { return null; });
      /* (TASK-0126) opts.cancel() ⇒ تتوقّف القراءة عند الخطوة التالية وتُعيد ما وجدته (قراءةٌ مبكرة لم تنتهِ والماسح أُغلق) */
      var cancelled = function () { return !!(opts.cancel && opts.cancel()) || !!(opts.stopOnOther && out.other); };   // قُرئ الرقم المطبوع ⇒ تتوقّف محاولات الباركود البطيئة
      bcP.then(function (x) { bcDone = x; }, function () { fastDone(null); });
      var textP = (async function () {
        if (opts.lite && !opts.lite.text) return [];               // الفرع وُجد في القراءة المبكرة
        var araLoad = getARA();                                    // تحميل المكتبة بالتوازي مع الباركود
        /* (TASK-0130 · المالك seq 28: «مو نفسها بتقرا الرقم ثم الفرع») لا تنتظر قراءة الفرع الباركودَ أبداً (كانت حتى ٢٫٥ث): اتّجاه رمز
           QR يُستعمل إن كان قد وصل حين تبدأ (وغالباً يصل: الباركود في عامله يبدأ مع اختيار الصورة)، أو حين يصل بعدها (lateUp) */
        var fastVal = null; fastP.then(function (f) { fastVal = f; });
        var up = null;
        var lateUp = function () { if (up == null && fastVal && fastVal.upright != null) { up = fastVal.upright; return true; } return false; };
        if (opts.lite && opts.lite.rot != null) up = opts.lite.rot;
        var DS = global.GMTDocScan, srcIm = null, gCorners = opts.corners || null, gImg = null;
        function asImg(cv) { try { cv.naturalWidth = cv.width; cv.naturalHeight = cv.height; } catch (_) {} return cv; }
        /* (TASK-0130) الماسح أعطى الحدود وصورته (لحظة الاكتشاف) ⇒ مصدرٌ «افتراضي»: كل خانةٍ تُقوَّم وحدها عند طلبها، والنسخة الكاملة
           (للصفحة كاملةً والأرقام) تؤخذ من الماسح حين يجهّزها — أو تُصنع هنا إن لم يجهّزها */
        function virtSrc(g) {
          var G = DS.rectGeom(g.img, g.corners), V = { virt: true, width: G.w, height: G.h, naturalWidth: G.w, naturalHeight: G.h, _f: null };
          var dims = [g.img.naturalWidth || g.img.width, g.img.naturalHeight || g.img.height];
          /* الخانة تُجهَّز في العامل (لا تحجز الواجهة ولا تنتظر الماسح) — أو هنا إن لم يوجد عامل */
          V.ara = function (rot, box, dn, mode) { return boxIn(file, g.corners, rot, box, dn, dims, mode).then(function (o) { return o || araBox(DS, g.img, g.corners, rot, box, dn, null, mode); }); };
          V.full = function () {
            var mk = function () { return DS.process(g.img, g.corners, 0, 'color'); };
            return V._f || (V._f = Promise.resolve(g.full).then(function (cv) { return cv || mk(); }, mk).then(asImg));
          };
          return V;
        }
        var fullOf = async function (im) { return im && im.virt ? await im.full() : im; };
        async function processed(mode) {
          /* (TASK-0130) النسخة التي جهّزها الماسح في الخلفية للزوايا نفسها ⇒ لا معالجةٌ ثانية للصورة */
          if (mode === 'color' && opts.srcCanvas) { try { var pc = opts.srcCanvas(); if (pc) return asImg(pc); } catch (_) {} }
          if (!DS || !DS.process || !DS.detectNorm) return null;
          var im = gImg || (await getL()).im;
          /* (TASK-0126) زوايا جاهزة من الماسح (القراءة بدأت معه) ⇒ لا اكتشافٌ ثانٍ */
          try { var d = gCorners ? { corners: gCorners } : DS.detectNorm(im, 0); gCorners = d.corners; return asImg(DS.process(im, d.corners, 0, mode)); } catch (_) { return null; }
        }
        /* (TASK-0159 · المالك seq 71: «القارئ للمفتي لازم يبلش مجرد ما انرفع الإيصال مو بعد القصّ والتصفية، وإذا ما عرف يرجع يحاول بعدهم»)
           opts.asIsFirst ⇒ «المصدر» يُقرأ أوّلاً من الصورة كما رُفعت — بلا انتظار حدود الماسح ولا قصٍّ ولا تحسين: اتّجاه الـQR إن عُرف،
           وإلّا حتى ثلاثة اتّجاهات بحسب شكل الصورة. فرعٌ واضح ⇒ يُعتمد ولا قراءة بعد القصّ · غير ذلك ⇒ المسار كما كان (بعد القصّ
           والتصفية)، ويبدأ بالاتّجاه الذي قُرئت فيه بنية الإيصال هنا. (الرقم يُقرأ من الأصل فوراً أصلاً: الباركود ثمّ المطبوع) */
        var asIsBest = null;
        if (opts.asIsFirst && !opts.original && !opts.lite && !cancelled()) {
          var Lq = await getL(), araQ = await araLoad;
          if (up == null) { await Promise.race([fastP, new Promise(function (z) { setTimeout(z, 600); })]); lateUp(); }
          var qw = Lq.im.naturalWidth || Lq.im.width, qh = Lq.im.naturalHeight || Lq.im.height;
          var qRots = up != null ? [up] : (qw >= qh ? [0, 180, 90] : [270, 90, 0]);
          stage('ara');
          for (var qi = 0; qi < qRots.length && !cancelled(); qi++) {
            var qres = await araQ.recognize(toPGM(araCanvas(Lq.im, qRots[qi], null, false)));
            var qt = (qres && qres.data && qres.data.text) || '', qsc = structScore(qt), qsg = sourceSegment(qt), qm = qsg ? matchBranch(qsg.seg) : null;
            if (!out.other) { var qo = otherOf(qt); if (qo) out.other = { company: qo, rot: qRots[qi], by: 'text' }; }
            var qa = { rot: qRots[qi], txt: qt, sc: qsc, src: qsg, m: qm, rank: (qm && qm.confident ? 1000 : 0) + (qsg ? 100 : 0) + qsc, tag: 'as-is', box: null, dn: false };
            if (opts.trace) opts.trace.push({ rot: qa.rot, struct: qsc, src: !!qsg, conf: !!(qm && qm.confident), mode: 'as-is-first' });
            if (!asIsBest || qa.rank > asIsBest.rank) asIsBest = qa;
            if ((qm && qm.confident) || qsc >= 3) break;            // الفرع واضح · أو الاتّجاه عُرف (والفرع يُعاد بعد القصّ)
          }
          if (asIsBest && asIsBest.m && asIsBest.m.confident) { L = Lq; srcIm = Lq.im; }
          else if (up == null && asIsBest && asIsBest.sc >= 3) up = asIsBest.rot;
        }
        if (!opts.original && !srcIm) {
          var g = null;
          if (opts.geom) { try { g = await opts.geom(); } catch (_) { g = null; } }
          if (cancelled()) { out.cancelled = true; return null; }
          if (g && g.cv) { srcIm = asImg(g.cv); gCorners = g.corners || gCorners; }
          else if (g && g.img && g.corners && DS && DS.processBox && DS.rectGeom) { gImg = g.img; gCorners = g.corners; try { srcIm = virtSrc(g); } catch (_) { srcIm = null; } }
          if (!srcIm) srcIm = await processed('color');
        }
        if (!srcIm) { L = await getL(); srcIm = L.im; }
        var isAsIs = function () { return !!opts.original || !!(L && srcIm === L.im); };
        /* بلا الماسح (قراءةٌ مباشرة · ثانيةٌ بعد المسح بزوايا أخرى): لا شيء ينتظره النصّ، فيُمهَل الباركود السريع (في عامله) ٠٫٦ث على الأكثر
           ليُعرف الاتّجاه من الـQR — قراءةٌ عربية واحدة بدل تجربة الاتّجاهات. مع الماسح (opts.geom) لا انتظار: حدود الورقة تصل بعده أصلاً */
        if (!opts.geom && up == null) await Promise.race([fastP, new Promise(function (z) { setTimeout(z, 600); })]);
        stage('ara');
        var ara = await araLoad; lateUp();
        /* الاتّجاه الأرجح من شكل الإيصال المقوَّم (عرضيٌّ ⇒ ٠ ثمّ ١٨٠) لا من الصورة كلّها */
        var w = srcIm.naturalWidth || srcIm.width, h = srcIm.naturalHeight || srcIm.height;
        var rots = w >= h ? [0, 180, 90, 270] : [270, 90, 0, 180], best = (asIsBest && asIsBest.m && asIsBest.m.confident) ? asIsBest : null;
        if (up != null) rots = opts.lite ? [up] : [up].concat(rots.filter(function (x) { return x !== up; }));
        if (opts.trace) opts.trace.push({ upright: up });
        /* (20 ت1 · TASK-0116 · إيصالات المالك الخمسة) ثلاثة أسباب كانت تُسقط الفرع:
           ① صورةٌ لم تمرّ بالماسح (أُلغي أو «كما هي») تُقرأ بلا تحسين — والتحسين نفسه هو ما يجعل «المصدر» مقروءاً.
              ⇒ غير الممسوحة تُحسَّن بطبقة الماسح (لون) قبل القراءة.
           ② كان يُختار الاتّجاه بعدد كلمات الإيصال وحده ويتوقّف عند ٣ — فيُقبل اتّجاهٌ قُرئ هيكله ولم يُقرأ سطر «المصدر».
              ⇒ الأفضل = فرعٌ واثق ثمّ «المصدر» موجود ثمّ عدد الكلمات؛ والتوقّف عند فرعٍ واثق فقط.
           ③ لا فرع بعد الاتّجاهات ⇒ محاولةٌ أخيرة بالأبيض والأسود في أفضل اتّجاه (أنجح على الحبر الحراري الباهت). */
        /* (TASK-0129) صورةٌ ليليّة مشوّشة ⇒ كلّ قراءةٍ بعد إزالة التشويش: Tesseract على الضوضاء بطيءٌ جداً (قراءة التذييل وحدها ~٤٠ث)
           ويخطئ. يُقاس التشويش مرّةً على أوّل خانةٍ تُقرأ */
        var noisy = null;
        async function attempt(im, rot, tag, box, dn, mode) {
          if (!box) im = await fullOf(im);                         // الصفحة كاملة ⇒ النسخة الكاملة (الخانات تُقوَّم وحدها)
          var useDn = !!(dn || noisy === true), acv = im.virt ? await im.ara(rot, box, useDn, mode) : araCanvas(im, rot, box, useDn);
          if (noisy === null) { noisy = noiseOf(acv) > NOISY; out.noise = noisy; if (opts.trace) opts.trace.push({ noise: +noiseOf(acv).toFixed(2) }); }
          return ara.recognize(toPGM(acv)).then(function (res) {
            var txt = (res && res.data && res.data.text) || '', sc = structScore(txt), sg = sourceSegment(txt), m = sg ? matchBranch(sg.seg) : null;
            if (!out.other) { var oc = otherOf(txt); if (oc) out.other = { company: oc, rot: rot, by: 'text' }; }      // (TASK-0159)
            var a = { rot: rot, txt: txt, sc: sc, src: sg, m: m, rank: (m && m.confident ? 1000 : 0) + (sg ? 100 : 0) + sc, tag: tag, box: box || null, dn: useDn };
            if (opts.trace) opts.trace.push({ rot: rot, struct: sc, src: !!sg, conf: !!(m && m.confident), mode: tag + (box ? '/' + (box === CELL ? 'cell' : box === BAND ? 'band' : 'mark') : '') + (dn ? '/dn' : '') });
            return a;
          });
        }
        /* (22 ت1 · TASK-0120 · المالك: «لا تحتاج قراءة كل الإيصال… هي في ثاني سطر في الجدول… فقط المصدر»)
           ١) خانة «المصدر» وحدها: عمود المرسِل (يمين الإيصال القائم) حول السطر الثاني من الجدول — في إيصالاتك الستّة وقع السطر
              بين ٤٦٪ و٦١٪ من الارتفاع وطرفه الأيمن عند ٩٢–٩٩٪ من العرض ⇒ المربّع [٣٨–١٠٠٪ × ٣٦–٧٢٪] ≈ خُمس الإيصال.
              اتّجاه الـQR معروف ⇒ مرّةٌ واحدة؛ غير معروف ⇒ الخانة في كل اتّجاه (رخيصة) قبل أيّ صفحةٍ كاملة.
           ٢) لم تكفِ ⇒ شريط الوسط بعرض الإيصال (الاتّجاه معروف) ⇒ ٣) الصفحة كاملة كما كانت.
           والنصّ المقروء يُطابَق مع فروع المفتي المعروفة (بنك الفروع + أسماؤها البديلة) — لا يُعتمد ما لا يشبه فرعاً. */
        var tagOf = function () { return isAsIs() ? 'as-is' : 'color'; };
        var cellRots = up != null ? [up] : rots, triedCell = {}, cellBest = null;
        for (var cr = 0; cr < cellRots.length && !(best && best.m && best.m.confident) && !cancelled(); cr++) {
          if (lateUp()) { if (triedCell[up]) break; cellRots = [up]; cr = 0; }        // اتّجاه الـQR وصل متأخّراً ⇒ هو وحده
          triedCell[cellRots[cr]] = 1;
          var ac = await attempt(srcIm, cellRots[cr], tagOf(), CELL);
          if (!cellBest || ac.rank > cellBest.rank) cellBest = ac;
          if (ac.m && ac.m.confident) best = ac;
          /* (TASK-0130) الخانة قُوِّمت وحدها ولم يُقرأ الفرع، وهذا الاتّجاه مرجّح (بنية الإيصال أو «المصدر» أو الـQR) ⇒ الخانة نفسها مقصوصةً من
             النسخة الكاملة (تحسينٌ بجوارٍ أوسع): قراءتان مستقلّتان — على صورك قرأت كلٌّ منهما ما لم تقرأه الأخرى (١٣ و١٥ من ٢٧ ⇒ معاً ١٨) */
          if (!(best && best.m && best.m.confident) && srcIm.virt && (ac.src || ac.sc >= 2 || up != null) && !cancelled()) {
            var af = await attempt(await srcIm.full(), cellRots[cr], tagOf(), CELL);
            if (af.m && af.m.confident) best = af; else if (af.rank > ac.rank) ac = af;
          }
          /* (TASK-0129) «المصدر» مقروءٌ هنا (أو الاتّجاه معروف من الـQR) والفرع غير واضح ⇒ الخانة نفسها بعد إزالة التشويش (صورةٌ ليليّة) */
          if (!(best && best.m && best.m.confident) && (ac.src || up != null) && !ac.dn && !cancelled()) { var ad = await attempt(srcIm, cellRots[cr], tagOf(), CELL, true); if (ad.m && ad.m.confident) best = ad; }
          /* (TASK-0130 · صورتان حقيقيّتان: صورة شاشة · ليليّةٌ مشوّشة) الخانة بالأبيض والأسود (عتبة على إضاءةٍ متجانسة) — كان ينجح فيهما
             «الأبيض والأسود» للصفحة كاملةً فقط وبعد كل القراءات الكاملة (١٣–١٩ث) */
          if (!(best && best.m && best.m.confident) && srcIm.virt && (cellBest.sc >= 2 || ac.src || up != null) && !cancelled()) {
            var aw = await attempt(srcIm, cellRots[cr], 'bw', CELL, false, 'bw'); if (aw.m && aw.m.confident) best = aw;
          }
          if (cellBest.sc >= 2) break;                               // (TASK-0130) بنية الإيصال قُرئت ⇒ الاتّجاه عُرف: لا خانةَ في الاتّجاهات الأخرى (شريط الوسط فيه أدناه)
        }
        if (lateUp() || (up != null && rots[0] !== up && !opts.lite)) rots = [up].concat(rots.filter(function (x) { return x !== up; }));
        /* (TASK-0130 · صورةٌ حقيقيّة) لا QR، لكنّ بنية الإيصال قُرئت في الخانة باتّجاهٍ ما ⇒ هو الاتّجاه: شريط الوسط فيه أيضاً (كان للـQR وحده)
           وتبدأ به الصفحة كاملة — كانت ٨ قراءاتٍ كاملة بلا جدوى (~١٥ث) قبل أن تُقرأ الخانة نفسها بعد المسح */
        var bandRot = up != null ? up : (cellBest && cellBest.sc >= 2 ? cellBest.rot : null);
        if (up == null && bandRot != null && rots[0] !== bandRot) rots = [bandRot].concat(rots.filter(function (x) { return x !== bandRot; }));
        if (bandRot != null && !(best && best.m && best.m.confident) && !cancelled()) {
          var ab = await attempt(srcIm, bandRot, tagOf(), BAND);
          if (ab.m && ab.m.confident) best = ab;
        }
        for (var r = 0; r < rots.length && !(best && best.m && best.m.confident) && !cancelled(); r++) {
          var a = await attempt(srcIm, rots[r], tagOf());
          if (!best || a.rank > best.rank) best = a;
          if (a.m && a.m.confident) break;                          // اتّجاهٌ سليم والفرع واضح
          if (up != null && r === 0 && (a.src || a.sc >= 3)) break; // اتّجاه الـQR صحيح (و«المصدر» مقروء، أو بنية الإيصال مقروءة فيه ⇒ لا فائدة من
                                                                    // الاتّجاهات الأخرى: كانت ٣ قراءاتٍ كاملة إضافية ~٩ث لإيصالٍ «المصدر» فيه غير مقروء · TASK-0127)
          if (r >= 1 && best.sc >= 3 && best.src) break;            // «المصدر» مقروء في اتّجاهٍ سليم — لا داعي للبقيّة
        }
        if (!best) { out.cancelled = true; return null; }               // أُلغيت قبل أيّ قراءة
        if (!(best.m && best.m.confident) && best.sc >= 2 && !cancelled()) {
          var bw = await processed('bw');
          if (bw) { var a2 = await attempt(bw, best.rot, 'bw'); if (a2.rank > best.rank) best = a2; }
        }
        /* (TASK-0130 · صورةٌ حقيقيّة تحت ضوءٍ برتقاليّ وحدودها خاطئة) آخر محاولة: الأصل كما هو بلا تقويمٍ ولا تحسين — حدودٌ خاطئة تُميل
           النصّ وتمطّه، والتحسين يُفسد ورقاً ملوّن الإضاءة؛ في الاتّجاه الذي قُرئت فيه بنية الإيصال (أو اتّجاه الـQR) */
        if (!(best.m && best.m.confident) && !isAsIs() && !cancelled()) {
          var oim = gImg || (await getL()).im, orot = best.sc >= 2 || up == null ? best.rot : up;
          var a3 = await attempt(oim, orot, 'orig'); if (a3.rank > best.rank) best = a3;
        }
        out.text = best.txt; out.rot = best.rot; out._best = best;
        if (best.m && best.m.confident && opts.onBranch && (receiptType(best.txt).kind === 'mufti' || !otherCompany(best.txt))) { try { opts.onBranch({ key: best.m.key, confident: true, candidates: best.m.candidates || [], text: best.m.text || '' }); } catch (_) {} }
        if (best.sc < 2 && !(best.m && best.m.confident)) return null;   // لا اتّجاه مقروء ⇒ لا رقم مطبوع موثوق الموضع
        var rk = [];
        if (!(bcDone && bcDone.number)) {                              // ③ الباركود يكفي (ولا ننتظر محاولاته البطيئة إن لم ينتهِ)
          if (cancelled()) { out.cancelled = true; return []; }
          stage('digits');
          /* (TASK-0129) أوّلاً على النسخة المقصوصة المقوَّمة (srcIm): موضع «أعلى اليمين» نسبةً للإيصال لا للصورة، والأرقام بلا منظورٍ مائل
             (صورةٌ بمنظورٍ حادّ قُرئ رقمها المطبوع بخانةٍ خاطئة). لم يُوجد فيها ⇒ الصورة الأصلية كما كان (صورٌ منخفضة الدقّة تُقرأ منها أحياناً) */
          var eng = await getOCR();
          var digitsOn = async function (im) {
            var cv = crop(await fullOf(im), [0, 0, 1, 1], best.rot, 2400); if (noisy) cv = median3(cv); cv = enhance(cv, 'contrast');
            var er = await eng.recognize(toPGM(cv), {}, { blocks: true }), words = [];
            ((er.data && er.data.blocks) || []).forEach(function (b) { (b.paragraphs || []).forEach(function (pg) { (pg.lines || []).forEach(function (ln) {
              (ln.words || []).forEach(function (wd) { words.push({ text: wd.text, bbox: wd.bbox, confidence: wd.confidence }); }); }); }); });
            out.engText = (out.engText ? out.engText + '\n' : '') + ((er.data && er.data.text) || '');
            return rankCandidates(words, cv.height, cv.width);
          };
          var hasTr = function (l) { return l.some(function (c) { return c.tr && c.number.length >= 6; }); };
          /* (TASK-0130 · صورةٌ حقيقيّة: الرقم «210062» واضحٌ ولم يُقرأ) الصفحة كاملةً لم تجد رقماً ⇒ قصّةُ أعلى يمين الإيصال القائم حيث
             يُطبع الرقم (تتجاوز حدّه قليلاً: حدودٌ تقريبيّة تقصّه) بنمط «كتلة نصّ»: في نمط النصّ المتناثر يتفتّت الرقم «2100» + «62» */
          var digitsBox = async function () {
            var BX = [0.45, -0.07, 1.03, 0.4], c0;
            if (srcIm.virt) c0 = rotCanvas(DS.processBox(gImg, gCorners, rotBox(best.rot, BX), 'color'), best.rot);
            else { var fc = crop(srcIm, [0, 0, 1, 1], best.rot, 2400), bx0 = Math.round(fc.width * 0.45), by1 = Math.round(fc.height * 0.4); c0 = newCanvas(fc.width - bx0, by1); c0.getContext('2d').drawImage(fc, bx0, 0, fc.width - bx0, by1, 0, 0, fc.width - bx0, by1); }
            var kk = srcIm.virt ? Math.min(2, 2400 / Math.max(srcIm.width, srcIm.height)) : 1, cv = newCanvas(c0.width * kk, c0.height * kk);
            cv.getContext('2d').drawImage(c0, 0, 0, cv.width, cv.height); if (noisy) cv = median3(cv); cv = enhance(cv, 'contrast');
            await eng.setParameters({ tessedit_pageseg_mode: '6' });
            try {
              var er = await eng.recognize(toPGM(cv), {}, { blocks: true }), words = [];
              ((er.data && er.data.blocks) || []).forEach(function (b) { (b.paragraphs || []).forEach(function (pg) { (pg.lines || []).forEach(function (ln) {
                (ln.words || []).forEach(function (wd) { words.push({ text: wd.text, bbox: wd.bbox, confidence: wd.confidence }); }); }); }); });
              out.engText = (out.engText ? out.engText + '\n' : '') + ((er.data && er.data.text) || '');
              return rankCandidates(words, cv.height, cv.width).map(function (c) { c.tr = c.number.length >= 6; return c; });   // القصّة كلّها «أعلى اليمين»
            } finally { await eng.setParameters({ tessedit_pageseg_mode: '11' }); }
          };
          rk = await digitsOn(srcIm);
          /* الصفحة كاملةً أوّلاً (أدقّ خاناتٍ حين تقرأ: القصّة بنمط الكتلة أخطأت خانةً في ٢ من ٧٢ إيصالاً مُصطنعاً) — والقصّة حين لا تجد شيئاً */
          if (!hasTr(rk) && !cancelled() && !(bcDone && bcDone.number) && DS && (!srcIm.virt || (gImg && gCorners))) {
            try { var bxk = await digitsBox(); if (hasTr(bxk)) rk = bxk.concat(rk); } catch (_) {}
          }
          if (!hasTr(rk) && !isAsIs() && !cancelled() && !(bcDone && bcDone.number)) {
            var seen2 = {}; rk.forEach(function (c) { seen2[c.number] = c; });
            var addC = function (list) { list.forEach(function (c) { if (seen2[c.number]) { seen2[c.number].score = Math.max(seen2[c.number].score, c.score); seen2[c.number].tr = seen2[c.number].tr || c.tr; } else { seen2[c.number] = c; rk.push(c); } }); };
            /* (TASK-0136) قراءة الأصل بدأت مبكراً (بالتوازي مع الفرع) ⇒ نتيجتها جاهزةٌ غالباً · لم تجد ⇒ الأصل باتّجاه الإيصال المعروف الآن */
            var od = origDigitsP ? await origDigitsP : null;
            if (od && od.cands.length) addC(od.cands);
            if (!hasTr(rk) && !cancelled() && (!od || od.rot !== best.rot)) addC(await digitsOn((await getL()).im));
            rk.sort(function (a, b) { return b.score - a.score; });
          }
          if (rk.some(function (c) { return c.tr; })) { printedSeen = true; printedAt = Date.now(); }
        }
        /* قُرئت خانةٌ أو شريطٌ فقط ⇒ علامات الشركة (اسمها أعلى الإيصال · هواتف مكاتبها في التذييل) لم تُقرأ. قاعدة 18 ت1: لا يُنسب
           إيصالٌ للمفتي بلا دليل ⇒ قراءةٌ صغيرة للأعلى والتذييل **بعد** إظهار الفرع (لا تؤخّره): شركةٌ أخرى ⇒ يُسحب الفرع.
           (TASK-0127) والصفحة كاملة كذلك: تذييلها فيها مقروءٌ مشوَّشاً فلم يُكشف إيصال شركةٍ أخرى (القدموس) ونُسب للمفتي بسطر «المصدر». */
        /* (TASK-0129) بعد قراءة الأرقام: تقرأ هواتف التذييل أصلاً ⇒ هاتف مكتبٍ للمفتي فيها يكفي ولا تُقرأ العلامات (~٤ث على هاتفٍ متوسّط) */
        if (best.m && best.m.confident && receiptType(best.txt + '\n' + (out.engText || '')).kind !== 'mufti') {
          if (cancelled()) { out.cancelled = true; return rk; }       // لم يُتحقّق من الشركة ⇒ يُعلَّم ناقصاً
          stage('mark');
          var foot = (await attempt(srcIm, best.rot, 'mark', MARK_FOOT)).txt;      // التذييل أوّلاً: هواتف المكاتب أوثق من الاسم المطبوع باهتاً
          out.text = best.txt + '\n' + foot; out.footText = foot;
          if (receiptType(foot).kind !== 'mufti' && !foreignFooter(foot)) out.text += '\n' + (await attempt(srcIm, best.rot, 'mark', MARK_TOP)).txt;
        }
        return rk;
      })();
      textP.catch(function () {});
      /* (TASK-0128) مكتبة الباركود لم تُحمَّل (بلا إنترنت/ملفٌّ ناقص) ⇒ لا تُسقط القراءة كلّها: الفرع والرقم المطبوع يُقرآن من النصّ */
      var bc = await bcP.catch(function (e) { out.barcodeError = (e && e.message) || String(e); return { number: null }; });
      if (bc.number) out.barcode = { number: bc.number, raw: bc.raw, how: bc.how };
      var cands = null;
      try { cands = await textP; } catch (e) { out.textError = (e && e.message) || String(e); }
      cands = cands || [];
      var tr = cands.filter(function (c) { return c.tr && c.number.length >= 6; });   // (TASK-0127) أرقام المفتي ٦ أرقام: «35501» من ظلٍّ على إيصالٍ بلا رقمٍ مطبوع كان يُقترح
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
      /* (TASK-0128) قارئ النصّ لم يُحمَّل (بلا إنترنت أوّل مرّة) ⇒ يُقال ذلك لا «لم يُقرأ النصّ بوضوح» */
      if (out.textError && out.type.kind !== 'mufti' && !String(out.text || '').trim()) { out.type.why = 'تعذّر تحميل قارئ النصّ — تحقّق من الاتصال ثمّ «أعد المحاولة»'; out.ocrMissing = true; }
      var src = (out._best && out._best.src) || sourceSegment(out.text);
      out.branch = src ? ((out._best && out._best.src === src && out._best.m) || matchBranch(src.seg)) : { key: null, confident: false, candidates: [], text: '' };
      delete out._best;
      if (src) out.branch.line = src.line;
      /* سطر «المصدر» مطابقٌ بثقة لفرعٍ من فروع المفتي = بنية إيصال المفتي (والموظف اختار «المفتي» قبل القراءة) */
      out.foreign = out.type.kind !== 'mufti' && otherCompany(out.text, out.footText);    // دليل شركةٍ أخرى (اسمها أو تذييلٌ بهواتف غير هواتف المفتي)
      if (out.type.kind !== 'mufti' && out.branch.confident && !out.foreign) out.type = { kind: 'mufti', why: 'سطر «المصدر» بفرعٍ من فروع المفتي', struct: out.type.struct };
      if (out.type.kind !== 'mufti') { out.branch.confident = false; out.branch.key = null; }
      out.company = out.type.kind === 'mufti' ? 'المفتي' : companyOf(out.text + '\n' + (out.engText || '') + '\n' + (out.footText || ''));   // (TASK-0157)
    } finally { if (Lp) Lp.then(function (x) { try { URL.revokeObjectURL(x.url); } catch (_) {} }, function () {}); }
    out.ms = Date.now() - t0;
    return out;
  }

  /* ══ (TASK-0159 · المالك seq 69–70) إيصالات «القدموس» و«مسارات» ═══════════════════════════════════════════════════════════
     «هي إيصالات القدموس — تدرّب تتعرّف عليهن وتاخد المصدر ورقم التتبّع، وعندك بنك الأفرع لتسهيل قراءة الفرع المصدر وتحديد رقمه»
     + «هذه مسارات أيضاً — رقم التتبّع مكتوب في الأعلى خارج الجدول تحت كلمة فاتورة». معايرةٌ على صور المالك (لا تُحفظ: فيها زبائن):
       القدموس — الباركود الخطّي أسفل الإيصال يحمل رقم الإشعار كاملاً: أربعة («26»+محرفان) · حرف (B/C) · ستّة أرقام. «المصدر: حلب»
                 وتحتها في الخانة نفسها اسم المكتب («فرقان»/«جميلية») — يمينُ الصفّ الذي تحت رقم الإشعار.
       مسارات — «فاتورة» وتحتها ٧ أرقام أعلى الإيصال خارج الجدول، ورمز QR يحملها أيضاً («#…#4100123_التاريخ_…#») · «المصدر : حلب -
                 باب الفرج» (المدينة والمكتب في سطر) · يُصوَّر غالباً بالعرض.
     الترتيب: الرموز (عامل الباركود نفسه) ⇐ اتّجاه الإيصال (QR أو كلماتٌ معروفة) ⇐ الرقم المطبوع بقارئ اللاتيني ⇐ «المصدر» بقارئ العربي
     (من الصفحة، وإلّا من خانته مقصوصةً مكبَّرة) ⇐ مطابقة المكتب ببنك أفرع الشركة (gmt-shipping-offices) فيُعطى اسمه الكامل وهاتفه. */
  var OTHER_CO = {
    'القدموس': { kind: 'qadmous', marks: ['القدموس', 'للخدمات', 'البريدية', 'الحوالات', 'الدفع', 'الاشعار', 'الطباعة', 'الطرد'] },
    'مسارات': { kind: 'masarat', marks: ['مسارات', 'اكسبرس', 'الطرود', 'فاتورة', 'للاستعلام', 'البضاعة', 'العرسل', 'نسخة'] }
  };
  var SHARED_MARKS = ['المصدر', 'الوجهة', 'المرسل', 'المجموع'].map(skel);
  function marksOf(text, co) {
    var s = skel(text), n = 0;
    (OTHER_CO[co] ? OTHER_CO[co].marks : []).forEach(function (k) { if (s.indexOf(skel(k)) !== -1) n++; });
    return n;
  }
  /* دليلٌ قويّ أنّ الإيصال للقدموس أو مسارات (قارئ المفتي يتوقّف عنده — TASK-0159): رمزه (باركود القدموس ١١ محرفاً · QR مسارات)،
     أو نصٌّ ليس فيه علامة المفتي وفيه اسم الشركة مقروءاً أو كلمتان من كلماتها الخاصّة (لا الكلمات المشتركة بين الإيصالات) */
  var STRONG_CO = { 'القدموس': ['القدموس', 'للخدمات', 'البريدية', 'الاشعار', 'الطباعة'], 'مسارات': ['مسارات', 'اكسبرس', 'فاتورة', 'للاستعلام'] };
  function otherOf(text, raws) {
    var codes = raws || [];
    for (var i = 0; i < codes.length; i++) {
      var r = latin(String(codes[i] || '')).trim(); if (!r) continue;
      if (/^[0-9A-Za-z]{11}$/.test(r) && /[A-Za-z]/.test(r) && qadNumber(r)) return 'القدموس';
      if (masFromQR(r)) return 'مسارات';
    }
    if (!text || receiptType(text).kind === 'mufti') return null;
    var byName = companyOf(text); if (OTHER_CO[byName]) return byName;
    var s = skel(text), n = {};
    Object.keys(STRONG_CO).forEach(function (co) { n[co] = STRONG_CO[co].filter(function (k) { return s.indexOf(skel(k)) !== -1; }).length; });
    if (n['القدموس'] >= 2 && !n['مسارات']) return 'القدموس';
    if (n['مسارات'] >= 2 && !n['القدموس']) return 'مسارات';
    return null;
  }
  function sharedOf(text) { var s = skel(text); return SHARED_MARKS.filter(function (k) { return s.indexOf(k) !== -1; }).length; }
  /* رقم إشعار القدموس من نصّ (رمزٍ أو قراءة): 26 + محرفان · حرف · ستّة أرقام (القارئ قد يُسقط «2» الأولى أو يقرأ O/I/S/B بدل أرقام) */
  function qadNumber(text) {
    var fix = function (d) { return d.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8'); };
    var t = latin(String(text || '')).replace(/[€£(]/g, 'C');
    var toks = t.split(/[\s|,;:]+/);
    for (var i = 0; i < toks.length; i++) {
      var w = toks[i].replace(/[^0-9A-Za-z]/g, ''), m = w.match(/^2?(6[0-9A-Za-z]{2})([A-Za-z])([0-9OoIlSsB]{6})$/);
      if (m) return '2' + m[1] + m[2].toUpperCase() + fix(m[3]);
      /* «26» سقطت من القراءة (40C200345) — الحرف B/C وحده يُثبت أنّه رقم إشعار */
      m = w.match(/^([0-9][0-9A-Za-z])([BCbc])([0-9OoIlSsB]{6})$/);
      if (m) return '26' + m[1] + m[2].toUpperCase() + fix(m[3]);
    }
    /* مقسومٌ بمسافة («2642 c300456») */
    var j = t.match(/(?:^|[^0-9A-Za-z])2?(6[0-9A-Za-z]{2})\s+([A-Za-z])\s*(\d{6})(?![0-9])/);
    if (j) return '2' + j[1] + j[2].toUpperCase() + j[3];
    return null;
  }
  /* رقم فاتورة مسارات من رمز QR: «#…#<الرقم>_<التاريخ>_…#» */
  function masFromQR(raw) { var m = /#[^#]*#\s*(\d{6,8})_/.exec(latin(String(raw || ''))); return m ? m[1] : null; }
  function canvasOf(src, rot, maxSide) {
    var w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height, S = Math.min(1, (maxSide || 1600) / Math.max(w0, h0)), w = Math.round(w0 * S), h = Math.round(h0 * S);
    var sw = rot % 180 ? h : w, sh = rot % 180 ? w : h, cv = newCanvas(sw, sh), c = cv.getContext('2d');
    c.translate(sw / 2, sh / 2); c.rotate(rot * Math.PI / 180); c.drawImage(src, -w / 2, -h / 2, w, h);
    return cv;
  }
  function subCanvas(cv, r, minW) {
    var x = Math.max(0, Math.round(r[0] * cv.width)), y = Math.max(0, Math.round(r[1] * cv.height));
    var w = Math.min(cv.width - x, Math.round(r[2] * cv.width)), h = Math.min(cv.height - y, Math.round(r[3] * cv.height));
    var S = Math.max(1, Math.min(3, (minW || 1300) / Math.max(1, w))), o = newCanvas(Math.max(1, Math.round(w * S)), Math.max(1, Math.round(h * S)));
    var c = o.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(cv, x, y, w, h, 0, 0, o.width, o.height);
    return o;
  }
  function linesOf(res) {
    var out = [];
    (((res && res.data) || {}).blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (pg) { (pg.lines || []).forEach(function (ln) {
      out.push({ text: ln.text || '', bbox: ln.bbox, words: (ln.words || []).map(function (wd) { return { text: wd.text, bbox: wd.bbox, conf: wd.confidence }; }) });
    }); }); });
    return out;
  }
  /* «المصدر» من سطور مقروءة: القيمة بعد الكلمة حتى «الوجهة/التاريخ/الفرع» · وفي القدموس اسم المكتب في السطر التالي (النصف الأيمن) */
  var K_STOPS2 = ['الوجهة', 'التاريخ', 'الفرع', 'المرسل'].map(skel);
  function otherSource(lines, pageW, co, th) {
    th = th || 0.67;
    for (var i = 0; i < lines.length; i++) {
      var ws = lines[i].words, at = -1;
      for (var j = 0; j < ws.length; j++) {
        var bw = bareW(ws[j].text); if (!bw) continue;
        if (isKey(bw, K_SRC, th) || isKey(bw.replace(/^و/, ''), K_SRC, th)) { at = j; break; }
        var gl = bw.indexOf(':') > 0 ? bw.split(':')[0] : '';
        if (gl && isKey(gl, K_SRC, th)) { at = j; break; }
      }
      if (at < 0) continue;
      /* القدموس: خانة المصدر نصف الصفّ الأيمن ⇒ ما يسار حدّها (خانة الوجهة: «الوجهة: دمشق» مقروءةً مشوّهة) لا يُؤخذ */
      var mid = ws[at].bbox ? (ws[at].bbox.x0 + ws[at].bbox.x1) / 2 : pageW * 0.75, lim = Math.min(pageW * 0.5, mid - pageW * 0.3);
      var inCell = function (wd) { return co !== 'القدموس' || !wd.bbox || (wd.bbox.x0 + wd.bbox.x1) / 2 > lim; };
      var val = [];
      for (var k = at + 1; k < ws.length; k++) {
        if (!inCell(ws[k])) continue;
        var t = bareW(ws[k].text); if (!t || /^[-–—:؛.]+$/.test(t)) { if (val.length && /[-–—]/.test(ws[k].text)) val.push('-'); continue; }
        if (K_STOPS2.some(function (s2) { return isKey(t, s2, 0.7); })) break;
        val.push(t);
        if (val.length >= 6) break;
      }
      /* اسمٌ ملتصقٌ بالكلمة («المصدر:حلب») */
      var glued = String(ws[at].text || '').split(/[:：]/)[1]; if (glued && bareW(glued)) val.unshift(bareW(glued));
      var city = '', office = '';
      var joined = val.join(' ').replace(/\s*-\s*/g, ' - ').trim();
      if (/ - /.test(joined)) { city = joined.split(' - ')[0].trim(); office = joined.split(' - ').slice(1).join(' ').trim(); }
      else { var vw = joined.split(/\s+/).filter(Boolean); city = vw[0] || ''; office = vw.slice(1).join(' '); }
      if (co === 'القدموس' && lines[i + 1]) {   // المكتب تحت المدينة في الخانة نفسها (يمين الصفّ) — ويُضاف لبقايا السطر نفسه إن وُجدت
        var below = lines[i + 1].words.filter(function (wd) { return wd.bbox && (wd.bbox.x0 + wd.bbox.x1) / 2 > lim; })
          .map(function (wd) { return bareW(wd.text); }).filter(Boolean).join(' ');
        office = [office, below].filter(Boolean).join(' ');
      }
      return { city: city, office: office, text: (city + (office ? ' — ' + office : '')).trim(), line: lines[i].text };
    }
    return null;
  }
  /* بلا كلمة «المصدر» مقروءة (على خانةٍ مقصوصة فقط): أوّل مدينةٍ من بنك الشركة في السطور، وما بعدها/تحتها هو المكتب */
  function citySource(lines, co) {
    var cities = Object.keys(officesOf(co));
    for (var i = 0; i < lines.length; i++) {
      var ws = lines[i].words.map(function (wd) { return bareW(wd.text); }).filter(Boolean);
      for (var j = 0; j < ws.length; j++) {
        var w = skel(noAl(ws[j])), c = cities.filter(function (x) { return w.length >= 3 && sim(skel(noAl(x)), w) >= 0.75; })[0];
        if (!c) continue;
        var rest = ws.slice(j + 1).join(' ').replace(/^[-–—\s]+/, '').trim();
        if (!rest && lines[i + 1]) rest = lines[i + 1].words.map(function (wd) { return bareW(wd.text); }).filter(Boolean).slice(0, 3).join(' ');
        return { city: c, office: rest, text: c + (rest ? ' — ' + rest : ''), line: lines[i].text, relaxed: true };
      }
    }
    return null;
  }
  function officesOf(co) { try { return (global.GMTOffices && global.GMTOffices.data && global.GMTOffices.data[co]) || {}; } catch (_) { return {}; } }
  /* مطابقة «المصدر» ببنك أفرع الشركة: المدينة (تقريبيّة) ثمّ المكتب (هيكلٌ بلا نقاط وبلا «ال») */
  function matchOther(co, src) {
    var out = { key: null, confident: false, candidates: [], text: src ? src.text : '', city: '', office: '', phone: '' };
    if (!src) return out;
    var D = officesOf(co), cities = Object.keys(D), cs = skel(noAl(src.city || ''));
    var city = cities.filter(function (c) { return cs && (skel(noAl(c)) === cs || sim(skel(noAl(c)), cs) >= 0.75); })[0] || '';
    var pool = [];
    (city ? [city] : cities).forEach(function (c) { (D[c] || []).forEach(function (o) { pool.push({ c: c, o: o }); }); });
    var ofs = String(src.office || '').replace(/^م\s*\.?\s+/, '').trim();
    var sk = function (x) { return skel(noAl(x)).replace(/\s+/g, ''); };
    var ws = ofs.split(/\s+/).filter(function (w) { return sk(w).length >= 3; });
    if (!ws.length) { out.city = city; return out; }
    /* مسارات: «المصدر : حلب - باب الفرج» ⇐ الاسم كاملاً (لا كلمةٌ منه: «باب الفرج» ليست «الباب») ·
       القدموس: سطر المكتب يحمل مكتب الوجهة أيضاً («فرقان حضارة») ⇐ كل كلمة/كلمتين، ضمن مكاتب مدينة المصدر (أو أوّل كلمتين إن لم تُقرأ) */
    var vars = co === 'مسارات' ? [ofs].concat(ws.length > 1 ? [ws.slice(0, 2).join(' ')] : [])
             : ws.slice(0, city ? 6 : 2).concat(ws.slice(0, city ? 5 : 1).map(function (w, i) { return w + ' ' + ws[i + 1]; }).filter(function (x) { return !/undefined/.test(x); }));
    var sc = pool.map(function (x) {
      var n = sk(x.o.name || ''), v = 0;
      vars.forEach(function (q) { var qq = sk(q); if (qq.length >= 3) v = Math.max(v, qq === n ? 1 : sim(n, qq)); });
      return { x: x, v: v };
    }).sort(function (a, b) { return b.v - a.v; });
    out.candidates = sc.filter(function (z) { return z.v >= 0.5; }).slice(0, 3).map(function (z) { return z.x.c + '|' + z.x.o.name; });
    var top = sc[0];
    if (top && top.v >= 0.75 && !(sc[1] && sc[1].v >= top.v - 0.02 && sc[1].x.o.name !== top.x.o.name)) {
      out.key = top.x.c + '|' + top.x.o.name; out.confident = true; out.city = top.x.c; out.office = top.x.o.name; out.phone = top.x.o.phone || '';
    } else out.city = city;
    return out;
  }
  async function readOther(file, opts) {
    opts = opts || {};
    var t0 = Date.now(), co = OTHER_CO[opts.company] ? opts.company : null;
    var out = { company: co, type: { kind: 'unknown', why: '' }, barcode: null, printed: null, tracking: { status: 'none' }, branch: { key: null, confident: false, candidates: [], text: '' }, text: '', rot: 0 };
    var cancelled = function () { return !!(opts.cancel && opts.cancel()); };
    var tm = function (k) { if (opts.debug) (out._t = out._t || []).push(k + ':' + (Date.now() - t0)); };
    var L = await loadImage(file);
    try {
      /* ① الرموز: باركود القدموس يحمل الرقم كاملاً · QR مسارات يحمله — (TASK-0165 · المالك seq 78 «الهدف تقليل عدد الثواني») في عاملها
         **بالتوازي** مع قراءة النصّ: كانت تُنتظر أوّلاً (حتى ١٠ث حين لا رمز مقروء — أغلب إيصالات القدموس) ثمّ يبدأ النصّ. وُجد الرقم المطبوع
         ⇒ تُمهَل حتى تنتهي محاولاته السريعة (لتطابقٍ يُثبته) ثمّ تتوقّف. opts.codes: رموزٌ قرأها قارئ المفتي قبل أن يتوقّف (TASK-0159) ⇒ لا تُقرأ ثانيةً */
      var bcStop = false, bcVal = opts.codes || null, bcDone = !!opts.codes, bcSlow = false;
      var bcP = opts.codes ? Promise.resolve(opts.codes)
        : readTracking(file, { ocr: false, budgetMs: opts.budgetMs || 8000, stop: function () { return bcStop || cancelled(); },
            onStage: function (k) { if (k === 'enhanced' || k === 'ocr') bcSlow = true; } }).catch(function () { return null; });
      var raws = [], qB = null, mB = null, codeCo = null, bcSaid = false;
      var onCodes = function () {
        var bc = bcVal; raws = []; qB = null; mB = null;
        if (bc) { if (bc.raw) raws.push(bc.raw); (bc.all || []).forEach(function (r) { if (typeof r === 'string') raws.push(r); }); }
        raws.forEach(function (r) { if (!qB) qB = qadNumber(r) && /^[0-9A-Za-z]{11}$/.test(latin(r).trim()) ? qadNumber(r) : qB; if (!mB) mB = masFromQR(r); });
        if (!mB && bc && bc.number && /^\d{7}$/.test(bc.number)) mB = bc.number;
        codeCo = qB ? 'القدموس' : (mB && raws.some(function (r) { return /masarat/i.test(r); })) ? 'مسارات' : null;
        var early = (co || codeCo) === 'القدموس' ? qB : (co || codeCo) === 'مسارات' ? mB : null;
        if (early && !out.barcode) out.barcode = { number: early, raw: raws[0] || '' };
        if (early && opts.onTracking && !bcSaid) { bcSaid = true; try { opts.onTracking({ status: 'barcode', number: early }); } catch (_) {} }
      };
      bcP.then(function (x) { bcVal = x; bcDone = true; tm('codes'); onCodes(); });
      var finish = function () { bcStop = true; };
      if (cancelled()) { out.cancelled = true; finish(); return out; }
      /* ② الصفحة مقوَّمة (الماسح) إن أمكن ⇐ الاتّجاه: QR إن عُرف وإلّا الكلمات المعروفة */
      var DS = global.GMTDocScan, page = L.im;
      if (!opts.scanned && DS && DS.detectNorm && DS.process) { try { var d = DS.detectNorm(L.im, 0); if (d && d.ok) page = DS.process(L.im, d.corners, 0, 'color'); } catch (_) {} }
      tm('page'); var ara = await getARA(), best = null; tm('ara');
      /* opts.rot: الاتّجاه الذي قرأ فيه قارئ المفتي كلماتها ⇒ يُجرَّب أوّلاً · ثمّ اتّجاه الـQR إن وصل · ثمّ (TASK-0165) شكل الورقة: إيصال مسارات
         عرضيّ (صورته طوليّة ⇐ مُدار ٩٠/٢٧٠) والقدموس طوليّ — الاتّجاهان الأرجح أوّلاً بدل تجربة ٠ و٩٠ ثمّ ٢٧٠ (إيصالك المصوَّر بالعرض: ٨ قراءات) */
      var pw = page.naturalWidth || page.width, ph = page.naturalHeight || page.height, tall = ph > pw * 1.15, wide = pw > ph * 1.15;
      var axis = ((co === 'مسارات' && tall) || (co === 'القدموس' && wide)) ? [90, 270, 0, 180] : (co && (tall || wide)) ? [0, 180, 90, 270] : [0, 90, 270, 180];
      var order = [opts.rot, bcVal && bcVal.upright].concat(axis).filter(function (v, i, a) { return v != null && a.indexOf(v) === i; });
      var done2 = {}, scs = [];
      var orient = async function (src, rots) {
        for (var oi = 0; oi < rots.length && !cancelled(); oi++) {
          var key = (src === L.im ? 'raw' : 'page') + rots[oi]; if (done2[key]) continue; done2[key] = 1;
          var cvR = canvasOf(src, rots[oi], 1500);
          var rr = await ara.recognize(toPGM(cvR), {}, { blocks: true }); var _tk = 'rot' + rots[oi] + (src === L.im && page !== L.im ? 'raw' : '');
          var txt = (rr.data && rr.data.text) || '';
          var q1 = marksOf(txt, 'القدموس'), m1 = marksOf(txt, 'مسارات'), sh = sharedOf(txt), sc = Math.max(q1, m1) + sh;
          tm(_tk + '=' + sc);
          if (!best || sc > best.sc) best = { rot: rots[oi], sc: sc, q: q1, m: m1, txt: txt, res: rr, cv: cvR, src: src };
          if (sc >= 4) return true;
          /* (TASK-0165) اتّجاهٌ متقدّمٌ بوضوح: الاتّجاه الخاطئ يُقرأ ٠ تقريباً، والصحيح ٢–٤ في صور إيصالاتك ⇒ لا تُجرَّب البقيّة */
          scs.push(sc);
          if (best.sc >= 2 && scs.length >= 2 && scs.slice().sort(function (x, y) { return y - x; })[1] <= best.sc - 2) return true;
        }
        return false;
      };
      /* الاتّجاهان الأرجح على الصفحة المقصوصة ⇒ قصٌّ خاطئ (لا شيء مقروء) ⇒ الصورة كما هي بهما ⇒ ثمّ البقيّة */
      var first = order.slice(0, 2), rest = order.slice(2);
      if (!(await orient(page, first)) && !cancelled()) {
        var rawToo = page !== L.im;
        if (rawToo && best && best.sc <= 1 && await orient(L.im, first)) { /* وُجد */ }
        else if (!(await orient(best && best.src === L.im ? L.im : page, rest)) && rawToo && best && best.sc <= 1) await orient(L.im, order);
      }
      if (!best || cancelled()) { out.cancelled = cancelled(); finish(); return out; }
      out.rot = best.rot; out.text = best.txt;
      /* ③ النوع: كلماتها · أو رمزها · أو إيصال المفتي */
      var mt = receiptType(best.txt);
      var det = codeCo || (best.q >= 2 && best.q > best.m ? 'القدموس' : best.m >= 2 && best.m > best.q ? 'مسارات' : null);
      if (!det && mt.kind === 'mufti') { out.type = { kind: 'mufti', why: mt.why }; out.company = 'المفتي'; finish(); return out; }
      if (det) { out.company = det; out.type = { kind: OTHER_CO[det].kind, why: codeCo ? 'رمز الإيصال' : 'اسم الشركة وكلماتها في الإيصال' }; }
      else if (co) out.type = { kind: 'unsure', why: 'لم تُقرأ علامات «' + co + '» بوضوح' };
      var C = out.company || co;
      /* ④ الرقم المطبوع (قارئ اللاتيني على الصفحة في اتّجاهها) */
      var eng = await getOCR(), er = await eng.recognize(toPGM(best.cv), {}, { blocks: true }), elines = linesOf(er), etext = (er.data && er.data.text) || '';
      tm('eng'); var printed = null, pBox = null;
      if (C === 'القدموس') {
        elines.some(function (ln) { return ln.words.some(function (wd) { var n = qadNumber(wd.text); if (n) { printed = n; pBox = wd.bbox; return true; } return false; }); });
        if (!printed) printed = qadNumber(etext.replace(/\s+(?=\d{6}\b)/g, ''));
        if (!printed && !cancelled()) {          // صفّ الرقم مقصوصاً مكبَّراً (بين الترويسة والجدول · يسار «ضد الدفع»)
          var nc = subCanvas(best.cv, [0.2, 0.1, 0.75, 0.24], 1400), nr = await eng.recognize(toPGM(nc), {}, { blocks: true });
          linesOf(nr).some(function (ln) { return ln.words.some(function (wd) { var n = qadNumber(wd.text); if (n) { printed = n; return true; } return false; }); });
          if (!printed) printed = qadNumber(((nr.data && nr.data.text) || '').replace(/\s+(?=\d{6}\b)/g, ''));
          if (opts.debug) (out._dbg = out._dbg || {}).numCrop = (nr.data && nr.data.text || '').replace(/\s+/g, ' ').slice(0, 200);
        }
      } else if (C === 'مسارات') {
        var cands = [];
        /* «للاستعلام: 021-9919» يُقرأ 0219919 — رقم الفاتورة لا يبدأ بصفر ولا فيه شَرطة */
        elines.forEach(function (ln) { ln.words.forEach(function (wd) { var raw = latin(wd.text), t = raw.replace(/[^0-9]/g, ''); if (/^[1-9]\d{6}$/.test(t) && !/\d-\d/.test(raw) && wd.bbox) cands.push({ n: t, y: wd.bbox.y0, b: wd.bbox }); }); });
        cands.sort(function (a, b) { return a.y - b.y; });
        if (cands[0] && cands[0].y < best.cv.height * 0.45) { printed = cands[0].n; pBox = cands[0].b; }
      }
      if (printed) out.printed = { number: printed };
      if (cancelled()) { out.cancelled = true; finish(); return out; }
      /* ⑤ «المصدر»: من الصفحة · وإلّا من خانته مقصوصةً مكبَّرة */
      var W = best.cv.width, Hh = best.cv.height, src = otherSource(linesOf(best.res), W, C);
      if (opts.debug) { out._dbg = out._dbg || {}; out._dbg.lines = linesOf(best.res).map(function (l) { return l.text.trim(); }).filter(Boolean).slice(0, 14); out._dbg.eng = etext.replace(/\s+/g, ' ').slice(0, 240); out._dbg.src1 = src; out._dbg.tries = order; }
      if (!src || !src.city) {
        var bands = [];
        if (C === 'مسارات') {
          var dw = null;   // صفّ «المصدر» = صفّ التاريخ (يُقرأ جيّداً) — المصدر يمينه
          elines.some(function (ln) { return ln.words.some(function (wd) { if (/20\d\d[\/.-]\d\d?[\/.-]\d\d?/.test(latin(wd.text)) && wd.bbox) { dw = wd.bbox; return true; } return false; }); });
          if (dw) bands.push([Math.min(0.85, dw.x1 / W), Math.max(0, dw.y0 / Hh - 0.035), 1 - Math.min(0.85, dw.x1 / W), (dw.y1 - dw.y0) / Hh + 0.07]);
          bands.push([0.55, pBox ? Math.max(0, pBox.y1 / Hh - 0.02) : 0.15, 0.45, 0.3]);
        } else {
          var y0 = pBox ? (pBox.y1 / Hh) : 0.22;
          bands.push([0.5, Math.max(0, y0 - 0.01), 0.5, 0.13], [0.42, Math.max(0, y0 - 0.01), 0.58, 0.2]);
        }
        outer: for (var bi = 0; bi < bands.length && !cancelled(); bi++) {
          /* (TASK-0159) والخانة بلا خطوط الجدول (unrule): خطوطٌ داكنة حول «المصدر» تُسقط الصفّ كلّه من قراءة النصّ */
          var crop0 = subCanvas(best.cv, bands[bi], 1300), vars = [crop0, araFinish(crop0, 1, true), enhance(crop0, 'contrast'), enhance(crop0, 'bin')];
          for (var vi = 0; vi < vars.length && !cancelled(); vi++) {
            var r2 = await ara.recognize(vars[vi].pgm || toPGM(vars[vi]), {}, { blocks: true }), l2 = linesOf(r2); tm('band' + bi + '/' + vi);
            /* على خانةٍ مقصوصة: عتبة الكلمة أوطأ («المعصد») · ومكتبٌ يطابق البنك يكفي ولو لم تُقرأ المدينة */
            var s2 = otherSource(l2, vars[vi].width, C, 0.6) || citySource(l2, C);
            if (opts.debug) { (out._dbg.crop = out._dbg.crop || []).push(bi + '/' + vi + ': ' + l2.map(function (l) { return l.text.trim(); }).filter(Boolean).slice(0, 4).join(' ⏎ ')); }
            if (s2 && (s2.city || s2.office)) { if (!src || matchOther(C, s2).confident) src = s2; if (matchOther(C, s2).confident) break outer; }
          }
        }
      }
      out.branch = matchOther(C, src);
      try { if (opts.onBranch && out.branch.confident) opts.onBranch(out.branch); } catch (_) {}
      /* الرمز (يعمل بالتوازي): قُرئ المطبوع ⇒ يُنتظر حتى تنتهي محاولاته السريعة فقط (المحاولة البطيئة «المحسَّنة» لم تجد في إيصالاتك قطّ ما فات
         السريعة) وبسقف ٦ث — تطابقهما يملأ الرقم وحده · لم يُقرأ المطبوع ⇒ ينتظر ميزانيّته (هو مصدر الرقم الباقي) */
      if (!bcDone && !cancelled()) {
        if (printed) { var w0 = Date.now(); while (!bcDone && !bcSlow && Date.now() - w0 < 6000 && !cancelled()) await new Promise(function (z) { setTimeout(z, 100); }); }
        else await bcP;
      }
      finish(); if (bcDone) onCodes();
      if (!det && codeCo && !co) { out.company = codeCo; out.type = { kind: OTHER_CO[codeCo].kind, why: 'رمز الإيصال' }; }
      var bN = out.barcode && out.barcode.number;
      out.tracking = bN && printed ? (bN.toLowerCase() === printed.toLowerCase() ? { status: 'match', number: bN } : { status: 'differ', barcode: bN, printed: printed })
                   : bN ? { status: 'barcode', number: bN } : printed ? { status: 'printed', number: printed, candidates: [printed] } : { status: 'none' };
    } finally { try { URL.revokeObjectURL(L.url); } catch (_) {} }
    out.ms = Date.now() - t0;
    return out;
  }

  /* (TASK-0122) تحميل القارئ مسبقاً — يُستدعى حين تفتح نافذة الشحن للمفتي أو تختار صورة: المكتبة والنموذج يُحمَّلان
     أثناء شاشة الماسح بدل أن يبدأ تحميلهما بعد ضغطة «تمّ». لا يقرأ شيئاً ولا يُفشل شيئاً. */
  function warm() {
    /* (TASK-0130) الباركود في عامله ⇒ المكتبة تُحمَّل هناك (لا تُحلَّل ٣٠٠ كيلوبايت على الخيط الرئيسي)؛ بلا عامل ⇒ في الصفحة كما كان */
    var W = bcWorker();
    if (W) { try { W.postMessage({ cmd: 'warm' }); } catch (_) {} }
    else try { loadZX().catch(function () {}); } catch (_) {}
    try { getARA().catch(function () {}); } catch (_) {}
  }

  global.GMTReceipt = { warm: warm, processIn: processIn, _araBox: araBox, _araCanvas: araCanvas, _CELL: CELL, _foreignFooter: foreignFooter, _companyOf: companyOf, _otherOf: otherOf, readOther: readOther, _qadNumber: qadNumber, _masFromQR: masFromQR, _matchOther: matchOther, _otherSource: otherSource, _core: CORE_FILE, readTracking: readTracking, readMufti: readMufti, _skel: skel, _sourceSegment: sourceSegment, _matchBranch: matchBranch, _receiptType: receiptType, extractNumber: extractNumber, _latin: latin, _rank: rankCandidates, _digitsOfWord: digitsOfWord, _crop: crop, _enhance: enhance };
})(typeof window !== 'undefined' ? window : self);
