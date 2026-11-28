/* ═══════════════════════════════════════════════════════════════════════════
   gmt-scan.js — مسح الباركود: بالكاميرا الخلفية وبالسكانر المربوط
   ───────────────────────────────────────────────────────────────────────────
   طلب المالك (2026-09-27):
     «زرّ البحث عن منتج بالباركود مو موجود… وبدّك تحطّ في بالك إنّه ممكن البحث
      بالكاميرا الخلفية أو ممكن البحث أيضاً في جهاز سكانر يكون مربوط».

   طريقان مختلفان تماماً — ولهذا لا يكفي زرّ واحد:
     ① 📷 **الكاميرا**: زرّ يفتح عدسةً خلفية ويقرأ الرمز (ZXing).
     ② ⌨️ **السكانر المربوط**: لا يحتاج زرّاً إطلاقاً. أجهزة الباركود (USB أو
        بلوتوث) تتصرّف كلوحة مفاتيح: تكتب الرمز **بسرعة غير بشرية** ثمّ Enter.
        فنُنصِت للنمط الزمني لا للجهاز: دفعةٌ من الحروف بفواصل أقلّ من 35ms
        تنتهي بـEnter ⇒ سكانر. الإنسان لا يكتب بهذه السرعة.

   ⚠️ ولماذا الإنصات خطِر إن أُسيء؟ لأنّه يسمع كل ضغطة في الصفحة. فلو التقط
      كتابةً بشرية لسرق حرفاً من حقلٍ يُملأ يدوياً. الحواجز:
        · فاصل زمني صارم (35ms) بين الحروف
        · طول لا يقلّ عن 4 محارف
        · أرقام وحروف لاتينية فقط (الباركود لا يحوي عربية)
        · لا نلتقط داخل textarea ولا حقل كلمة سرّ
        · نُلغي الالتقاط إن تجاوز الفاصل الحدَّ — لا نُراكم عبر الزمن

   الاستعمال:
     GMTScan.camera(code => …)      // يفتح الكاميرا مرّة ويعيد الرمز
     GMTScan.listen(code => …)      // سكانر مربوط — أنصِت ما دامت الصفحة مفتوحة
     GMTScan.attach(inputEl, fn)    // زرّ 📷 بجانب حقل + إنصات — الأسهل
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    var ZX_SRC = 'lib/zxing.min.js';
    var _listening = false;

    function toast(msg, kind) {
        try {
            if (global.showToast) return global.showToast(msg, kind || 'inf');
        } catch (e) {}
        try { console.log('[scan]', msg); } catch (e) {}
    }

    function loadZXing() {
        return new Promise(function (ok, bad) {
            if (typeof global.ZXing !== 'undefined') return ok(global.ZXing);
            var s = document.createElement('script');
            s.src = ZX_SRC + '?v=20261003';
            s.onload = function () { global.ZXing ? ok(global.ZXing) : bad(new Error('ZXing لم تُعرَّف')); };
            s.onerror = function () { bad(new Error('تعذّر تحميل مكتبة المسح')); };
            document.head.appendChild(s);
        });
    }

    /* ═══ (TASK-A0589 · المالك seq A1140) باركودٌ صغير على الهاتف متعدّد العدسات ═══════════════════════════════
       «طلعت اصغر من اللازم فما عاد تتعرف عليها كاميرا الهاتف … الهاتف فيه اكثر من كاميرا ومن الكاميرات بس قربنا كثير بتصير بتغبش …
        بعد التصوير اللي بعيد يكون في اسكان … بحيث خلص ينقرا كل شيء من الهاتف».
       الأدوات هنا (كلّها على الجهاز · لا شيء يُرفع):
         · اختيار العدسة الرئيسيّة الخلفيّة + دقّة عالية + تركيز مستمرّ + زووم + زرّ تبديل العدسات وتذكّر الاختيار
         · «📸 صوّر الباركود» / «🖼️ من الصور»: صورة كاملة الدقّة ⇒ فكٌّ عميق (BarcodeDetector + ZXing على الصورة وشبكة قصاصات
           متراكبة ومكبَّرة ومحسَّنة ومدارة) ⇒ وإن لم يُقرأ شيء ⇒ قراءة الأرقام المطبوعة تحت الباركود (Tesseract أرقام فقط) ومطابقتها
           مع باركودات المنتجات الموجودة. */
    var CAM_KEY = 'gmt_scan_cam';
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }
    function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

    /* تقييم العدسة من اسمها: الخلفيّة الرئيسيّة أعلى · الأماميّة آخراً · فائقة الاتّساع/المقرِّبة/الماكرو/العمق تُؤخَّر (تغبّش عن قرب) */
    function camScore(label) {
        var l = String(label || '').toLowerCase(), s = 0;
        if (/back|rear|environment|خلف/.test(l)) s += 10;
        if (/front|user|selfie|أمام|امام/.test(l)) s -= 20;
        if (/ultra|0\.5|فائق/.test(l)) s -= 8;
        if (/tele|zoom|مقرب/.test(l)) s -= 8;
        if (/macro|depth|infrared|\bir\b|mono|ماكرو|عمق/.test(l)) s -= 9;
        if (/wide/.test(l)) s -= 3;
        return s;
    }
    function rankCams(list) {
        return list.map(function (d, i) { return { d: d, i: i, s: camScore(d.label) }; })
            .sort(function (a, b) { return (b.s - a.s) || (a.i - b.i); }).map(function (x) { return x.d; });
    }
    function hiRes(deviceId) {
        var v = { width: { ideal: 1920 }, height: { ideal: 1080 } };
        if (deviceId) v.deviceId = { exact: deviceId }; else v.facingMode = { ideal: 'environment' };
        return { video: v, audio: false };
    }
    function getStream(deviceId) {
        var md = navigator.mediaDevices;
        return md.getUserMedia(hiRes(deviceId)).catch(function () {
            return md.getUserMedia(deviceId ? { video: { deviceId: { exact: deviceId } } } : { video: { facingMode: { ideal: 'environment' } } });
        }).catch(function () { return md.getUserMedia({ video: true }); });
    }

    /* ── أدوات الصورة ── */
    function fitCanvas(src, maxSide) {
        var k = Math.min(1, maxSide / Math.max(src.width, src.height));
        if (k >= 1) return src;
        var c = mkCanvas(src.width * k, src.height * k), g = c.getContext('2d');
        g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height); return c;
    }
    function cropScale(src, x, y, w, h, k, pad) {
        var c = mkCanvas(w * k + pad * 2, h * k + pad * 2), g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high';
        g.drawImage(src, x, y, w, h, pad, pad, c.width - pad * 2, c.height - pad * 2); return c;
    }
    function rotateCanvas(src, deg) {
        var r = deg * Math.PI / 180, w = src.width, h = src.height, cw = Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r)), ch = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r));
        var c = mkCanvas(cw, ch), g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.translate(c.width / 2, c.height / 2); g.rotate(r); g.drawImage(src, -w / 2, -h / 2);
        return c;
    }
    /* تحسين: رمادي ⇒ مدّ التباين (1%–99%) ⇒ حدّة ⇒ (اختياري) عتبة محلّيّة تتحمّل الإضاءة غير المنتظمة */
    function enhanceCanvas(src, mode) {
        var w = src.width, h = src.height, n = w * h, c = mkCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(src, 0, 0);
        var im = g.getImageData(0, 0, w, h), d = im.data, gr = new Uint8ClampedArray(n), hist = new Uint32Array(256), i, v;
        for (i = 0; i < n; i++) { v = (d[4 * i] * 77 + d[4 * i + 1] * 150 + d[4 * i + 2] * 29) >> 8; gr[i] = v; hist[v]++; }
        var lo = 0, hi = 255, acc = 0, cut = n * 0.01;
        for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= cut) { lo = i; break; } }
        acc = 0; for (i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= cut) { hi = i; break; } }
        if (hi - lo < 16) { lo = Math.max(0, lo - 8); hi = Math.min(255, hi + 8); }
        var sc = 255 / Math.max(1, hi - lo);
        for (i = 0; i < n; i++) { v = (gr[i] - lo) * sc; gr[i] = v < 0 ? 0 : v > 255 ? 255 : v; }
        var out = gr, x, y;
        if (mode === 'sharp' || mode === 'thresh') {
            out = new Uint8ClampedArray(gr);
            for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) { var p = y * w + x; out[p] = 5 * gr[p] - gr[p - 1] - gr[p + 1] - gr[p - w] - gr[p + w]; }
        }
        if (mode === 'thresh') {
            var W1 = w + 1, ii = new Uint32Array(W1 * (h + 1)), rs;
            for (y = 0; y < h; y++) { rs = 0; for (x = 0; x < w; x++) { rs += out[y * w + x]; ii[(y + 1) * W1 + x + 1] = ii[y * W1 + x + 1] + rs; } }
            var r = Math.max(8, Math.round(Math.min(w, h) / 24)), th = new Uint8ClampedArray(n);
            for (y = 0; y < h; y++) {
                var y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
                for (x = 0; x < w; x++) {
                    var x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), area = (x1 - x0) * (y1 - y0);
                    var s = ii[y1 * W1 + x1] - ii[y0 * W1 + x1] - ii[y1 * W1 + x0] + ii[y0 * W1 + x0];
                    th[y * w + x] = out[y * w + x] * area < s * 0.92 ? 0 : 255;
                }
            }
            out = th;
        }
        for (i = 0; i < n; i++) { v = out[i]; d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = v; d[4 * i + 3] = 255; }
        g.putImageData(im, 0, 0); return c;
    }

    /* ── فكّ: BarcodeDetector (إن وُجد) + ZXing بثنائيّين ── */
    var _bd, _zxHints = null;
    function getBD() {
        if (_bd !== undefined) return _bd;
        _bd = null;
        try { if (global.BarcodeDetector) _bd = new global.BarcodeDetector(); } catch (e) { _bd = null; }
        return _bd;
    }
    function zxHints(ZX) {
        if (_zxHints) return _zxHints;
        var h = new Map();
        try {
            var F = ZX.BarcodeFormat;
            h.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.ITF, F.CODABAR, F.QR_CODE, F.DATA_MATRIX].filter(function (x) { return x != null; }));
            h.set(ZX.DecodeHintType.TRY_HARDER, true);
        } catch (e) {}
        return (_zxHints = h);
    }
    async function decodeCanvasOnce(canvas, ZX) {
        var bd = getBD();
        if (bd) {
            try { var r = await bd.detect(canvas); if (r && r.length) { var t = String(r[0].rawValue || '').trim(); if (t.length >= 4) return t; } } catch (e) {}
        }
        if (ZX) {
            var hints = zxHints(ZX), mf = new ZX.MultiFormatReader(); try { mf.setHints(hints); } catch (e) {}
            var kinds = ['Hybrid', 'Global'];
            for (var i = 0; i < kinds.length; i++) {
                try {
                    var src = new ZX.HTMLCanvasElementLuminanceSource(canvas);
                    var bin = kinds[i] === 'Hybrid' ? new ZX.HybridBinarizer(src) : new ZX.GlobalHistogramBinarizer(src);
                    var res = mf.decodeWithState ? mf.decodeWithState(new ZX.BinaryBitmap(bin)) : mf.decode(new ZX.BinaryBitmap(bin), hints);
                    var tx = String(res && (res.getText ? res.getText() : res.text) || '').trim();
                    if (tx.length >= 4) return tx;
                } catch (e) {}
            }
        }
        return '';
    }
    /* تحديد موضع الباركود (TASK-A0589): الخطوط ⇒ تدرّجٌ أفقيٌّ قويّ بلا تدرّج عموديّ (أو العكس إن كان الملصق عمودياً) ⇒ أكبر كتلةٍ كثيفة.
       يُرجع مستطيلاً بإحداثيّات الصورة الأصل (مع هامشٍ يشمل الأرقام تحته) أو null — يعطي «قصّاً على الباركود» ثمّ تكبيراً كبيراً لقراءة الصغير/المغبّش. */
    function locateBars(src, vertical) {
        var s = fitCanvas(src, 900), f = s.width / src.width, w = s.width, h = s.height, n = w * h;
        var g = s.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, gr = new Float32Array(n), i, x, y;
        for (i = 0; i < n; i++) gr[i] = (g[4 * i] * 77 + g[4 * i + 1] * 150 + g[4 * i + 2] * 29) / 256;
        var m = new Float32Array(n);
        for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
            var p = y * w + x, gx = Math.abs(gr[p + 1] - gr[p - 1]), gy = Math.abs(gr[p + w] - gr[p - w]), v = vertical ? gy - gx : gx - gy;
            m[p] = v > 6 ? v : 0;
        }
        var W1 = w + 1, ii = new Float64Array(W1 * (h + 1));
        for (y = 0; y < h; y++) { var rs = 0; for (x = 0; x < w; x++) { rs += m[y * w + x]; ii[(y + 1) * W1 + x + 1] = ii[y * W1 + x + 1] + rs; } }
        var r = Math.max(4, Math.round(Math.min(w, h) / 40)), best = 0, bx = 0, by = 0, dens = new Float32Array(n);
        for (y = r; y < h - r; y++) for (x = r; x < w - r; x++) {
            var d = ii[(y + r + 1) * W1 + x + r + 1] - ii[(y - r) * W1 + x + r + 1] - ii[(y + r + 1) * W1 + x - r] + ii[(y - r) * W1 + x - r];
            dens[y * w + x] = d; if (d > best) { best = d; bx = x; by = y; }
        }
        if (best < 400) return null;
        var thr = best * 0.4, x0 = bx, x1 = bx, y0 = by, y1 = by, lim = Math.max(w, h) / 3;
        for (y = r; y < h - r; y++) for (x = r; x < w - r; x++) {
            if (dens[y * w + x] >= thr && Math.abs(x - bx) < lim && Math.abs(y - by) < lim) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        var bw = x1 - x0 + 2 * r, bh = y1 - y0 + 2 * r, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        var padX = vertical ? bw * 0.5 : bw * 0.25, padY = vertical ? bh * 0.25 : bh * 0.6;
        var rx = Math.max(0, (cx - bw / 2 - padX) / f), ry = Math.max(0, (cy - bh / 2 - padY) / f);
        var rw = Math.min(src.width - rx, (bw + 2 * padX) / f), rh = Math.min(src.height - ry, (bh + 2 * padY) / f);
        return (rw >= 24 && rh >= 12) ? { x: rx, y: ry, w: rw, h: rh } : null;
    }
    /* خطّة المحاولات: من الأرخص للأغلى · كلّ خطوة تُنشئ لوحتها عند الحاجة فقط (ذاكرة الهاتف) */
    function buildPlan(src) {
        var base = fitCanvas(src, 2200), W = src.width, H = src.height, steps = [];
        function add(label, fn) { steps.push({ label: label, fn: fn }); }
        add('full', function () { return base; });
        /* قصّ على الباركود المُحدَّد ثمّ تكبيرٌ كبير (٣–٨×) — الصغير/المغبّش يصير وحداتُه عريضة */
        [false, true].forEach(function (vert) {
            var loc; try { loc = locateBars(src, vert); } catch (e) { loc = null; }
            if (!loc) return;
            var k = Math.max(1.5, Math.min(8, 1100 / loc.w)), t = vert ? '-v' : '';
            add('loc' + t, function () { return cropScale(src, loc.x, loc.y, loc.w, loc.h, k, 30); });
            add('loc-enh' + t, function () { return enhanceCanvas(cropScale(src, loc.x, loc.y, loc.w, loc.h, k, 30), 'sharp'); });
            add('loc-thr' + t, function () { return enhanceCanvas(cropScale(src, loc.x, loc.y, loc.w, loc.h, k, 30), 'thresh'); });
            add('loc-x' + Math.round(k / 2) + t, function () { return enhanceCanvas(cropScale(src, loc.x, loc.y, loc.w, loc.h, Math.max(1.2, k / 2), 30), 'sharp'); });
            [-6, 6].forEach(function (a) { add('loc-rot' + a + t, function () { return rotateCanvas(enhanceCanvas(cropScale(src, loc.x, loc.y, loc.w, loc.h, k, 30), 'sharp'), a); }); });
            if (vert) add('loc-v-r90', function () { return rotateCanvas(cropScale(src, loc.x, loc.y, loc.w, loc.h, k, 30), 90); });
        });
        /* شبكة 3×3 قصاصات نصفيّة متراكبة (خطوة ربع) — من الوسط أوّلاً لأنّ الباركود يكون غالباً في المنتصف */
        var tiles = [];
        [0, 0.25, 0.5].forEach(function (fy) { [0, 0.25, 0.5].forEach(function (fx) { tiles.push({ fx: fx, fy: fy, d: Math.abs(fx - 0.25) + Math.abs(fy - 0.25) }); }); });
        tiles.sort(function (a, b) { return a.d - b.d; });
        tiles.forEach(function (t, ti) {
            var x = t.fx * W, y = t.fy * H, w = W * 0.5, h = H * 0.5;
            var kk = function (k) { return Math.max(1, Math.min(k, 1800 / w)); };
            add('crop' + ti + '-x1.5', function () { return cropScale(src, x, y, w, h, kk(1.5), 30); });
            add('crop' + ti + '-x2-enh', function () { return enhanceCanvas(cropScale(src, x, y, w, h, kk(2), 30), 'sharp'); });
            add('crop' + ti + '-x2-thr', function () { return enhanceCanvas(cropScale(src, x, y, w, h, kk(2), 30), 'thresh'); });
            add('crop' + ti + '-r90', function () { return rotateCanvas(enhanceCanvas(cropScale(src, x, y, w, h, kk(1.5), 30), 'sharp'), 90); });
            if (ti === 0) {   /* الوسط: ميل خفيف ±6° (ملصق مائل باليد) */
                [-6, 6].forEach(function (a) { add('crop0-rot' + a, function () { return rotateCanvas(enhanceCanvas(cropScale(src, x, y, w, h, kk(2), 30), 'sharp'), a); }); });
            }
        });
        [-6, 6].forEach(function (a) { add('full-rot' + a, function () { return rotateCanvas(enhanceCanvas(base, 'sharp'), a); }); });
        return steps;
    }
    /* (TASK-A0589 · المالك seq A1142 «خود هدول جرب عليهن أداتك» — ملصقات Zu 60) قارئ Code128 بخطّ مسحٍ متوسَّط:
       ملصقاتنا مطبوعة بلا هامشٍ أبيض (margin:0) ⇒ على طاولةٍ سوداء تصير حافة الورقة «خطوطاً» قبل الباركود فيفشل ZXing، والصورة الصغيرة
       تُذيب الفراغات الرفيعة. الحلّ: متوسّط عشرات الأسطر (يمحو الضجيج) ⇒ عتبة ⇒ أطوال الخطوط ⇒ البحث عن رمز البداية **في أيّ موضع**
       (لا حاجة لهامش) ⇒ أقرب نمطٍ لكلّ رمز ⇒ رقم التحقّق يحسم (لا قراءة خاطئة). مع ميلٍ حتّى ±9° والاتّجاه المعكوس. */
    var C128 = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232'].map(function (t) { return t.split('').map(Number); });
    function c128sym(w, i) {   /* أقرب نمطٍ لستّة أطوال (مُطبَّعة على ١١ وحدة) — أو -1 */
        var sum = 0, k; for (k = 0; k < 6; k++) sum += w[i + k]; if (!sum) return -1;
        var m = sum / 11, best = -1, bd = 1e9;
        for (var s = 0; s < C128.length; s++) { var d = 0, P = C128[s]; for (k = 0; k < 6; k++) d += Math.abs(w[i + k] / m - P[k]); if (d < bd) { bd = d; best = s; } }
        return bd <= 1.6 ? best : -1;
    }
    function c128stop(w, i) { var sum = 0, k, P = [2, 3, 3, 1, 1, 1, 2]; if (i + 7 > w.length) return false; for (k = 0; k < 7; k++) sum += w[i + k]; var m = sum / 13, d = 0; for (k = 0; k < 7; k++) d += Math.abs(w[i + k] / m - P[k]); return d <= 1.8; }
    function c128runs(w) {   /* w: أطوال متناوبة تبدأ بخطّ أسود */
        for (var st = 0; st + 6 <= w.length; st += 2) {
            var a = c128sym(w, st); if (a < 103 || a > 105) continue;
            var syms = [a], i = st + 6, ok = false;
            while (i + 6 <= w.length && syms.length < 60) {
                if (syms.length >= 3 && c128stop(w, i)) { ok = true; break; }
                var v = c128sym(w, i); if (v < 0 || v > 102) break; syms.push(v); i += 6;
            }
            if (!ok || syms.length < 3) continue;
            var chk = syms[0]; for (var j = 1; j < syms.length - 1; j++) chk += j * syms[j];
            if (chk % 103 !== syms[syms.length - 1]) continue;
            var set = syms[0] === 103 ? 'A' : syms[0] === 104 ? 'B' : 'C', out = '';
            for (j = 1; j < syms.length - 1; j++) { var v2 = syms[j];
                if (v2 === 99) { set = 'C'; continue; } if (v2 === 100) { set = 'B'; continue; } if (v2 === 101) { set = 'A'; continue; } if (v2 > 101) continue;
                if (set === 'C') out += (v2 < 10 ? '0' : '') + v2; else if (set === 'B') out += String.fromCharCode(v2 + 32); else out += String.fromCharCode(v2 < 64 ? v2 + 32 : v2 - 64);
            }
            if (out.length >= 4) return out;
        }
        return '';
    }
    function scanLines(src, opts) {
        opts = opts || {};
        var base = fitCanvas(src, opts.max || 1400), angles = opts.angles || [0, -4, 4, -8, 8, -2, 2, -6, 6], t0 = Date.now(), lim = opts.ms || 2500;
        for (var ai = 0; ai < angles.length; ai++) {
            if (Date.now() - t0 > lim) break;
            var c = angles[ai] ? rotateCanvas(base, angles[ai]) : base, w = c.width, h = c.height;
            var d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
            var prof = new Float32Array(w);
            var BH = [h / 14, h / 6, h / 3, 24, 48, 96].map(function (v) { return Math.max(6, Math.round(v)); }).filter(function (v, i, a) { return v <= h && a.indexOf(v) === i; });
            for (var bi = 0; bi < BH.length; bi++) { var bandH = BH[bi], step = Math.max(3, Math.round(bandH / 3));
            for (var y0 = 0; y0 + bandH <= h; y0 += step) {
                prof.fill(0);
                for (var y = y0; y < y0 + bandH; y++) { var o = y * w * 4; for (var x = 0; x < w; x++) prof[x] += d[o + 4 * x] * 77 + d[o + 4 * x + 1] * 150 + d[o + 4 * x + 2] * 29; }
                var srt = Array.prototype.slice.call(prof).sort(function (a, b) { return a - b; }), lo = srt[Math.floor(w * 0.08)], hi = srt[Math.floor(w * 0.92)];
                if (hi - lo < bandH * 256 * 40) continue;   /* بلا تباين ⇒ لا خطوط هنا */
                /* حوافّ بدقّة جزء البكسل: المسح مكبَّراً ×4 بالاستيفاء الخطّي (الفراغ الرفيع بعرض ٢–٣ بكسل لا يذوب بالتقريب) */
                var K = 4, pw = (w - 1) * K + 1, P2 = new Float32Array(pw);
                for (x = 0; x < pw; x++) { var xf = x / K, xi = Math.floor(xf), fr = xf - xi; P2[x] = xi + 1 < w ? prof[xi] * (1 - fr) + prof[xi + 1] * fr : prof[xi]; }
                for (var tq = 0; tq < 7; tq++) {
                    var thr = lo + (hi - lo) * [0.5, 0.4, 0.6, 0.45, 0.55, 0.35, 0.65][tq], runs = [], cur = P2[0] < thr, n = 0;
                    for (x = 0; x < pw; x++) { var dark = P2[x] < thr; if (dark === cur) n++; else { runs.push([cur, n]); cur = dark; n = 1; } }
                    runs.push([cur, n]);
                    while (runs.length && !runs[0][0]) runs.shift();
                    while (runs.length && !runs[runs.length - 1][0]) runs.pop();
                    if (runs.length < 25) continue;
                    var wl = runs.map(function (r) { return r[1]; }), txt = c128runs(wl) || c128runs(wl.slice().reverse());
                    if (!txt) { /* أطراف الورقة على خلفيةٍ داكنة: جرّب بعد إسقاط أوّل خطّين/آخرهما */ txt = c128runs(wl.slice(2)) || c128runs(wl.slice(0, -2).reverse()); }
                    if (txt) return txt;
                }
            }
            }
        }
        return '';
    }
    /* فكٌّ عميق للصورة الكاملة: يتوقّف عند أوّل نتيجة · opts.timeout (مللي) · opts.onProgress(نصّ) */
    async function decodeDeep(source, opts) {
        opts = opts || {};
        var src = (source && source.getContext) ? source : await toCanvas(source);
        var ZX = null; try { ZX = await loadZXing(); } catch (e) {}
        var steps = buildPlan(src), t0 = Date.now(), lim = opts.timeout || 20000;
        for (var i = 0; i < steps.length; i++) {
            if (Date.now() - t0 > lim) break;
            if (opts.onProgress) { try { opts.onProgress('أحلّل الصورة… ' + Math.round(i * 100 / steps.length) + '٪'); } catch (e) {} }
            await tick();
            var c; try { c = steps[i].fn(); } catch (e) { continue; }
            var code = await decodeCanvasOnce(c, ZX);
            if (code) return { code: code, via: steps[i].label };
            if (i === 0) { await tick(); var sl0 = ''; try { sl0 = scanLines(src, { ms: 3000 }); } catch (e) {} if (sl0) return { code: sl0, via: 'scanline' }; }
        }
        try { var rg = locateBars(src, false); if (rg) { var sl1 = scanLines(cropScale(src, rg.x, rg.y, rg.w, rg.h, 1, 0), { ms: 3000 }); if (sl1) return { code: sl1, via: 'scanline-loc' }; } } catch (e) {}
        try { var sl = scanLines(src, { ms: 4000, max: 1800 }); if (sl) return { code: sl, via: 'scanline' }; } catch (e) {}
        return null;
    }
    async function toCanvas(x) {
        if (x && x.getContext) return x;
        var bmp = null;
        try { if (global.createImageBitmap) bmp = await createImageBitmap(x, { imageOrientation: 'from-image' }); } catch (e) { bmp = null; }
        if (!bmp) {
            bmp = await new Promise(function (ok, bad) {
                var url = URL.createObjectURL(x), im = new Image();
                im.onload = function () { URL.revokeObjectURL(url); ok(im); };
                im.onerror = function () { URL.revokeObjectURL(url); bad(new Error('صورة غير مقروءة')); };
                im.src = url;
            });
        }
        var w = bmp.naturalWidth || bmp.width, h = bmp.naturalHeight || bmp.height, k = Math.min(1, 4200 / Math.max(w, h));
        var c = mkCanvas(w * k, h * k), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
        try { if (bmp.close) bmp.close(); } catch (e) {}
        return c;
    }

    /* ── أرقام الباركود المطبوعة (Tesseract · أرقام فقط) — نفس مسارات lib/ocr التي تحمّلها عدسة gmt-lens-local.js ──
       عامل مستقلّ (لا نشارك عامل العدسة: قائمة الأرقام البيضاء ستفسد قراءة نصوص العدسة) */
    var _digitP = null;
    var _SIMD = (function () { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } })();
    function getDigitOCR() {
        if (_digitP) return _digitP;
        _digitP = (async function () {
            if (!global.Tesseract) await new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = 'lib/ocr/tesseract.min.js?v=20261016'; s.onload = ok; s.onerror = function () { bad(new Error('تعذّر تحميل قارئ الأرقام')); }; document.head.appendChild(s); });
            var base = new URL('lib/ocr/', document.baseURI).href;
            var w = await global.Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base + (_SIMD ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'), langPath: base, gzip: true, cacheMethod: 'none' });
            await w.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '11', user_defined_dpi: '300' });
            return w;
        })();
        _digitP.catch(function () { _digitP = null; });
        return _digitP;
    }
    function knownList(opts) {
        var src = opts && opts.known;
        try { if (typeof src === 'function') src = src(); } catch (e) { src = null; }
        if (!src) { try { if (typeof allProducts !== 'undefined') src = allProducts; } catch (e) {} }
        var out = [];
        (src || []).forEach(function (x) {
            if (x == null) return;
            if (typeof x === 'string' || typeof x === 'number') out.push(String(x));
            else { if (x.barcode) out.push(String(x.barcode)); if (Array.isArray(x.barcodes)) x.barcodes.forEach(function (b) { if (b) out.push(String(b)); }); }
        });
        return out.filter(function (b) { return b; });
    }
    function eanOk(s) {
        if (!/^\d+$/.test(s) || [8, 12, 13].indexOf(s.length) < 0) return false;
        var t = 0, n = s.length - 1;
        for (var i = 0; i < n; i++) t += (+s[n - 1 - i]) * (i % 2 ? 1 : 3);
        return (10 - t % 10) % 10 === +s[n];
    }
    /* مرشّحات 8–14 رقماً من نصّ OCR: كلّ سطرٍ مدموجاً (الباركود يُطبع أحياناً بفراغات) + كلّ كتلة + نوافذ 13/12/8 من الكتل الطويلة */
    function digitCands(text) {
        var set = {}, out = [];
        function put(s) { if (s.length >= 8 && s.length <= 14 && !set[s]) { set[s] = 1; out.push(s); } }
        String(text || '').split(/\n/).forEach(function (line) {
            put(line.replace(/\D/g, ''));
            (line.match(/\d+/g) || []).forEach(function (tk) {
                put(tk);
                if (tk.length > 14) [13, 12, 8].forEach(function (L) { for (var i = 0; i + L <= tk.length; i++) put(tk.substr(i, L)); });
            });
        });
        return out;
    }
    /* مطابقة: تامّة (مع إهمال الأصفار البادئة) ⇒ وإلّا خطأ رقمٍ واحد فقط إن كان المنتج الوحيد ⇒ بلا قائمة معروفة نقبل ما يجتاز فحص EAN */
    function matchDigits(cands, known) {
        var kn = (known || []).map(function (b) { return { raw: b, d: /^\d+$/.test(b) ? b.replace(/^0+/, '') : null }; }).filter(function (k) { return k.d; });
        if (!(known || []).length) { for (var i = 0; i < cands.length; i++) if (eanOk(cands[i])) return { code: cands[i], how: 'ean' }; return null; }
        for (var a = 0; a < cands.length; a++) {
            var c = cands[a].replace(/^0+/, '');
            for (var j = 0; j < kn.length; j++) if (kn[j].d === c) return { code: kn[j].raw, how: 'exact' };
        }
        var near = {};
        cands.forEach(function (cd) {
            var c = cd.replace(/^0+/, '');
            kn.forEach(function (k) {
                if (k.d.length !== c.length) return;
                var diff = 0; for (var p = 0; p < c.length && diff < 2; p++) if (c[p] !== k.d[p]) diff++;
                if (diff === 1) near[k.raw] = 1;
            });
        });
        var ks = Object.keys(near);
        return ks.length === 1 ? { code: ks[0], how: 'near' } : null;
    }
    async function readDigits(source, opts) {
        opts = opts || {};
        var src = (source && source.getContext) ? source : await toCanvas(source), known = knownList(opts);
        var w; try { w = await getDigitOCR(); } catch (e) { return null; }
        var base = fitCanvas(src, 1800);
        var loc = null; try { loc = locateBars(base, false); } catch (e) { loc = null; }
        var passes = [
            /* أوّلاً: المنطقة المحدَّدة (الباركود + أرقامه) مكبَّرة — الأرقام الصغيرة تحتاج تكبيراً */
            function () { return loc ? enhanceCanvas(cropScale(base, loc.x, loc.y, loc.w, loc.h, Math.max(1.5, Math.min(5, 1300 / loc.w)), 30), 'sharp') : enhanceCanvas(base, 'sharp'); },
            function () { return enhanceCanvas(base, 'sharp'); },
            function () { return cropScale(base, 0, base.height * 0.3, base.width, base.height * 0.7, Math.max(1, Math.min(2, 1800 / base.width)), 20); },
            function () { return rotateCanvas(enhanceCanvas(base, 'sharp'), 90); },
            function () { return rotateCanvas(enhanceCanvas(base, 'sharp'), -6); },
            function () { return rotateCanvas(enhanceCanvas(base, 'sharp'), 6); }
        ], all = [], t0 = Date.now();
        for (var i = 0; i < passes.length; i++) {
            if (Date.now() - t0 > (opts.timeout || 30000)) break;
            if (opts.onProgress) { try { opts.onProgress('أقرأ الأرقام تحت الباركود… ' + (i + 1) + '/' + passes.length); } catch (e) {} }
            await tick();
            var r = null; try { r = await w.recognize(passes[i]()); } catch (e) { continue; }
            all = all.concat(digitCands(r && r.data && r.data.text));
            var m = matchDigits(all, known); if (m) return { code: m.code, via: 'digits-' + m.how };
        }
        return null;
    }
    /* واجهة موحّدة لصورة كاملة: باركود ثمّ أرقام */
    async function still(source, opts) {
        var c = (source && source.getContext) ? source : await toCanvas(source);
        var r = await decodeDeep(c, opts);
        if (r) return r;
        return readDigits(c, opts);
    }

    /* ── ① الكاميرا ───────────────────────────────────────────────────────── */
    /* (seq B1036) opts.continuous: لا تُغلق بعد القراءة (عدّ قطعةً قطعة) — نفس الرمز لا يُعاد قبل ٢.٥ث · آخر قراءة ظاهرة · يعيد close()
       opts.title: عنوان الشريط.
       (TASK-A0589) opts.known: مصفوفة/دالّة باركودات المنتجات (أو منتجات {barcode}) لمطابقة أرقام الباركود المطبوعة — الافتراضي allProducts إن وُجدت. */
    function camera(onCode, opts) {
        opts = opts || {};
        /* getUserMedia لا تعمل إلّا في سياق آمن (https). والموقع على GitHub Pages
           https، لكنّ من يفتح الملفّ من القرص (file://) لن تعمل عنده — فنقول
           السبب بدل أن نبدو معطّلين. */
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast('الكاميرا غير متاحة هنا — افتح الصفحة عبر https', 'err');
            return;
        }
        var old = document.getElementById('gmt-scan-ui');
        if (old) old.remove();

        var ui = document.createElement('div');
        ui.id = 'gmt-scan-ui';
        ui.setAttribute('dir', 'rtl');
        ui.style.cssText = 'position:fixed;inset:0;z-index:100001;background:#000;display:flex;' +
            'flex-direction:column;font-family:Cairo,system-ui,sans-serif;max-width:100vw;overflow:hidden;box-sizing:border-box';
        /* (TASK-A0589 · المالك seq A1140) شريط الأدوات: تبديل العدسة · تصوير بدقّة كاملة · من المعرض · زووم */
        var bstyle = 'flex:1 1 0;min-width:0;min-height:42px;border:0;border-radius:10px;background:#374151;color:#fff;' +
            'font:800 12px/1.25 Cairo,system-ui,sans-serif;padding:4px 6px;cursor:pointer;box-sizing:border-box';
        ui.innerHTML =
            '<div style="padding:12px 14px;background:#111;color:#fff;display:flex;align-items:center;gap:10px">' +
              '<div style="flex:1;min-width:0;font-size:13.5px;font-weight:900">' + (opts.title || '📷 وجّه الكاميرا إلى الباركود') + '</div>' +
              '<button type="button" data-x style="border:0;background:#374151;color:#fff;border-radius:10px;' +
                      'width:34px;height:34px;font-size:16px;cursor:pointer">✕</button>' +
            '</div>' +
            '<div style="position:relative;flex:1;min-height:0;overflow:hidden;background:#000">' +
              '<video id="gmt-scan-video" playsinline muted style="width:100%;height:100%;object-fit:cover"></video>' +
              '<div style="position:absolute;inset:14% 8%;border:3px solid rgba(255,255,255,.85);border-radius:14px;' +
                          'box-shadow:0 0 0 9999px rgba(0,0,0,.35)"></div>' +
              '<img data-still alt="" style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;opacity:.92">' +
            '</div>' +
            '<div data-zrow style="display:none;align-items:center;gap:8px;padding:6px 14px;background:#111;color:#e5e7eb;font-size:12px;font-weight:800">' +
              '<span>🔍 زووم</span><input data-zoom type="range" style="flex:1;min-width:0"><span data-zv style="min-width:34px;text-align:left">1×</span></div>' +
            '<div style="display:flex;gap:8px;padding:8px 10px;background:#111">' +
              '<button type="button" data-cyc style="' + bstyle + '" title="تبديل عدسة الكاميرا">🔄 الكاميرا</button>' +
              '<button type="button" data-shot style="' + bstyle + ';background:#1d4ed8" title="تصوير بدقّة كاملة ثمّ تحليل عميق">📸 صوّر الباركود</button>' +
              '<button type="button" data-pick style="' + bstyle + '" title="قراءة الباركود من صورة محفوظة">🖼️ من الصور</button>' +
            '</div>' +
            '<input data-file type="file" accept="image/*" style="display:none">' +
            '<div data-msg style="padding:9px 14px 12px;background:#111;color:#9ca3af;font-size:11.5px;font-weight:800;text-align:center">' +
              'جارٍ تشغيل الكاميرا…</div>';
        document.body.appendChild(ui);

        var controls = null, reader = null, done = false, last = { code: '', at: 0 }, nRead = 0;
        var stream = null, track = null, devices = [], devIdx = -1, gen = 0, busy = false, ZXm = null;
        var msg = ui.querySelector('[data-msg]'), vid = ui.querySelector('video');
        function say(t, color) { msg.style.color = color || '#9ca3af'; msg.textContent = t; }
        function stopStream() {
            try { if (controls && controls.stop) controls.stop(); } catch (e) {}
            controls = null;
            try { if (reader && reader.reset) reader.reset(); } catch (e) {}
            try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
            /* ⚠️ إطفاء المسارات باليد أيضاً: بعض إصدارات ZXing تترك ضوء الكاميرا
               مشتعلاً بعد الإغلاق، فيظنّ الموظّف أنّنا نصوّره. */
            try { if (vid && vid.srcObject) vid.srcObject.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
            stream = null; track = null;
        }
        function close() {
            done = true; gen++;
            stopStream();
            if (ui && ui.parentNode) ui.parentNode.removeChild(ui);
        }
        ui.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) close(); });

        /* نجاح القراءة (حيّة أو من صورة) — المسار الواحد القديم نفسه */
        function deliver(code, how) {
            if (opts.continuous) {
                var t = Date.now(); if (how === 'camera' && code === last.code && t - last.at < 2500) return;
                last = { code: code, at: t }; nRead++;
                try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
                try { if (global.GMTSound) GMTSound.play('scan'); } catch (e) {}
                var r = onCode ? onCode(code, how) : null;
                say('✓ ' + (typeof r === 'string' && r ? r : code) + ' · ' + nRead + ' مسحة — امسح التالية أو ✕ للإغلاق', '#86efac');
                return;
            }
            close();
            try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
            try { if (global.GMTSound) GMTSound.play('scan'); } catch (e) {}      /* (١١ ت١) صفير القراءة */
            if (onCode) onCode(code, how);
        }

        /* ميزات العدسة: تركيز مستمرّ + زووم (قرّب بالزووم بدل أن تقرّب الهاتف فيغبش) */
        function applyFeatures() {
            var zr = ui.querySelector('[data-zrow]'), zs = ui.querySelector('[data-zoom]'), zv = ui.querySelector('[data-zv]');
            zr.style.display = 'none';
            if (!track || !track.getCapabilities) return;
            var caps = {}; try { caps = track.getCapabilities() || {}; } catch (e) {}
            try { if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {}); } catch (e) {}
            if (caps.zoom && caps.zoom.max > caps.zoom.min) {
                zs.min = caps.zoom.min; zs.max = caps.zoom.max; zs.step = caps.zoom.step || 0.1;
                var cur = 1; try { cur = (track.getSettings() || {}).zoom || caps.zoom.min; } catch (e) {}
                zs.value = cur; zv.textContent = (+cur).toFixed(1) + '×'; zr.style.display = 'flex';
                zs.oninput = function () {
                    zv.textContent = (+zs.value).toFixed(1) + '×';
                    try { track.applyConstraints({ advanced: [{ zoom: +zs.value }] }).catch(function () {}); } catch (e) {}
                };
            }
        }
        /* يشغّل الكاميرا (deviceId اختياري) ثمّ يبدأ الفكّ الحيّ على المجرى نفسه */
        async function startCam(deviceId) {
            var my = ++gen;
            stopStream();
            var s = await getStream(deviceId);
            if (done || my !== gen) { try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} return; }
            /* بعد منح الإذن تظهر أسماء العدسات ⇒ اختر الرئيسيّة الخلفيّة (أو المحفوظة) */
            if (!devices.length) {
                try {
                    var all = await navigator.mediaDevices.enumerateDevices();
                    devices = rankCams(all.filter(function (d) { return d.kind === 'videoinput'; }));
                } catch (e) { devices = []; }
                var cur = null; try { cur = (s.getVideoTracks()[0].getSettings() || {}).deviceId; } catch (e) {}
                var saved = lsGet(CAM_KEY), want = null;
                for (var i = 0; i < devices.length; i++) if (saved && devices[i].deviceId === saved) want = devices[i];
                if (!want && !deviceId && devices.length) want = devices[0];
                if (want && want.deviceId && want.deviceId !== cur && !deviceId) {
                    try { var s2 = await getStream(want.deviceId); try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} s = s2; } catch (e) {}
                    if (done || my !== gen) { try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} return; }
                }
                try { var ct = (s.getVideoTracks()[0].getSettings() || {}).deviceId; devIdx = Math.max(0, devices.map(function (d) { return d.deviceId; }).indexOf(ct)); } catch (e) { devIdx = 0; }
            }
            stream = s; track = s.getVideoTracks()[0] || null;
            vid.srcObject = s;
            try { await vid.play(); } catch (e) {}
            applyFeatures();
            say('ابحث عن الخطوط… باركود صغير؟ اضغط «📸 صوّر الباركود»');
            var onRes = function (result, err, ctl) {
                if (ctl && !controls && my === gen) controls = ctl;
                if (done || my !== gen || !result) return;
                var code = String(result.getText ? result.getText() : result.text || '').trim();
                if (code) deliver(code, 'camera');
            };
            reader = new ZXm.BrowserMultiFormatReader();
            var p = reader.decodeFromStream ? reader.decodeFromStream(s, vid, onRes) : reader.decodeFromVideoDevice(null, 'gmt-scan-video', onRes);
            Promise.resolve(p).then(function (c) { if (c && c.stop && my === gen && !controls) controls = c; }).catch(function () {});
            /* (TASK-A0589 · المالك seq A1142) بجانب ZXing: كلّ ~١.٢ث خطّ مسحٍ متوسَّط على إطار الفيديو — يقرأ ملصقاتنا بلا هامش أبيض
               وعلى خلفيةٍ داكنة وبميلٍ حتّى ±8° (حيث يفشل ZXing الحيّ) */
            (function slLoop() {
                if (done || my !== gen) return;
                setTimeout(function () {
                    if (done || my !== gen) return;
                    try {
                        if (vid.readyState >= 2 && vid.videoWidth) {
                            var fc = mkCanvas(vid.videoWidth, vid.videoHeight); fc.getContext('2d').drawImage(vid, 0, 0);
                            var c2 = scanLines(fc, { ms: 700, max: 1000, angles: [0, -4, 4, -8, 8] });
                            if (c2 && !done && my === gen) { deliver(c2, 'camera'); return; }
                        }
                    } catch (e) {}
                    slLoop();
                }, 1200);
            })();
        }
        function cycle() {
            if (busy) return;
            if (devices.length < 2) { say('لا توجد عدسة أخرى في هذا الجهاز', '#fca5a5'); return; }
            devIdx = (devIdx + 1) % devices.length;
            var d = devices[devIdx]; lsSet(CAM_KEY, d.deviceId);
            say('أبدّل العدسة… ' + (d.label ? '(' + d.label.slice(0, 28) + ')' : (devIdx + 1) + '/' + devices.length));
            startCam(d.deviceId).catch(function (e) { say((e && e.message) || 'تعذّر تشغيل هذه العدسة', '#fca5a5'); });
        }
        /* صورة كاملة الدقّة: ImageCapture.takePhoto إن وُجد وإلّا إطار الفيديو بدقّته الأصليّة */
        async function grabStill() {
            if (track && global.ImageCapture) {
                try { var blob = await new global.ImageCapture(track).takePhoto(); if (blob && blob.size) return await toCanvas(blob); } catch (e) {}
            }
            var w = vid.videoWidth, h = vid.videoHeight; if (!w || !h) throw new Error('الكاميرا لم تبدأ بعد');
            var c = mkCanvas(w, h); c.getContext('2d').drawImage(vid, 0, 0, w, h); return c;
        }
        /* تحليل صورةٍ ما (مصوَّرة أو من المعرض): باركود عميق ⇒ أرقام */
        async function analyze(canvas, label) {
            if (busy) return; busy = true;
            var img = ui.querySelector('[data-still]');
            try { img.src = fitCanvas(canvas, 900).toDataURL('image/jpeg', 0.6); img.style.display = 'block'; } catch (e) {}
            say('⏳ ' + label + ' — أحلّل الصورة…', '#fde68a');
            var r = null;
            try { r = await still(canvas, { known: opts.known, onProgress: function (t) { if (!done) say('⏳ ' + t, '#fde68a'); } }); }
            catch (e) { r = null; }
            busy = false;
            if (done) return;
            img.style.display = 'none';
            if (r && r.code) { deliver(r.code, label === 'من الصور' ? 'photo' : 'camera-photo'); return; }
            say('لم أجد باركوداً ولا رقماً يطابق منتجاً — قرّب أو صوّر أوضح وبإضاءة جيّدة ثمّ أعد المحاولة', '#fca5a5');
        }
        ui.querySelector('[data-cyc]').addEventListener('click', cycle);
        ui.querySelector('[data-shot]').addEventListener('click', function () {
            if (busy) return;
            grabStill().then(function (c) { return analyze(c, 'تصوير'); }).catch(function (e) { say((e && e.message) || 'تعذّر التصوير', '#fca5a5'); });
        });
        var fileIn = ui.querySelector('[data-file]');
        ui.querySelector('[data-pick]').addEventListener('click', function () { if (!busy) { fileIn.value = ''; fileIn.click(); } });
        fileIn.addEventListener('change', function () {
            var f = fileIn.files && fileIn.files[0]; if (!f) return;
            toCanvas(f).then(function (c) { return analyze(c, 'من الصور'); }).catch(function () { say('تعذّرت قراءة الصورة', '#fca5a5'); });
        });

        loadZXing().then(function (ZX) {
            ZXm = ZX;
            return startCam(null);
        }).catch(function (e) {
            if (done) return;
            /* الكاميرا الحيّة فشلت ⇒ لا نغلق فوراً: ما زال «🖼️ من الصور» ممكناً (لا سكانر عندنا) */
            say(((e && e.message) || 'تعذّر تشغيل الكاميرا') + ' — يمكنك استعمال «🖼️ من الصور»', '#fca5a5');
        });
        return close;
    }

    /* ── ①ب الصورة (TASK-A0538 · المالك seq 873) «يقرأ رقم الكاميرا عبر صورة أو عبر سكانر مباشر» ──
       صورةٌ من الكاميرا أو المعرض ⇒ تُصغَّر (≤1600px) ثمّ ZXing بالبحث المعمّق. لا شيء يُرفع — القراءة على الجهاز. */
    function photo(onCode) {
        var inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment'); inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.addEventListener('change', function () {
            var f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
            toast('⏳ أقرأ الباركود من الصورة…');
            decodeFile(f).then(function (code) {
                if (!code) { toast('لم أجد باركوداً في الصورة — صوّر ملصق S/N عن قرب وبإضاءة جيّدة', 'err'); return; }
                try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
                try { if (global.GMTSound) GMTSound.play('scan'); } catch (e) {}
                if (onCode) onCode(code, 'photo');
            }).catch(function (e) { toast('تعذّرت قراءة الصورة: ' + ((e && e.message) || e), 'err'); });
        });
        inp.click();
    }
    function decodeFile(file) {
        return loadZXing().then(function (ZX) {
            return new Promise(function (ok) {
                var url = URL.createObjectURL(file), img = new Image();
                img.onload = function () {
                    URL.revokeObjectURL(url);
                    /* القارئ الأساسي مباشرةً على لوحة بخلفيّة بيضاء (مسار Browser…decodeFromImageUrl يفشل على الصور — فُحص) ·
                       ثنائيّان (Hybrid ثمّ GlobalHistogram) · والصورة مدارةً 90° للملصقات العمودية */
                    var hints = new Map();
                    try {
                        var F = ZX.BarcodeFormat;
                        hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.ITF, F.CODABAR, F.QR_CODE, F.DATA_MATRIX].filter(function (x) { return x != null; }));
                        hints.set(ZX.DecodeHintType.TRY_HARDER, true);
                    } catch (e) {}
                    var mf = new ZX.MultiFormatReader(); try { mf.setHints(hints); } catch (e) {}
                    function canvasFor(rot) {
                        var k = Math.min(1, 1600 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
                        var w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k), pad = 40;
                        var c = document.createElement('canvas'), g = c.getContext('2d');
                        c.width = (rot ? h : w) + pad * 2; c.height = (rot ? w : h) + pad * 2;
                        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
                        g.translate(c.width / 2, c.height / 2); if (rot) g.rotate(Math.PI / 2); g.drawImage(img, -w / 2, -h / 2, w, h);
                        return c;
                    }
                    var tries = [[0, 'Hybrid'], [0, 'Global'], [1, 'Hybrid'], [1, 'Global']];
                    for (var i = 0; i < tries.length; i++) {
                        try {
                            var src = new ZX.HTMLCanvasElementLuminanceSource(canvasFor(tries[i][0]));
                            var bin = tries[i][1] === 'Hybrid' ? new ZX.HybridBinarizer(src) : new ZX.GlobalHistogramBinarizer(src);
                            var r = mf.decodeWithState ? mf.decodeWithState(new ZX.BinaryBitmap(bin)) : mf.decode(new ZX.BinaryBitmap(bin), hints);
                            var t = String(r && (r.getText ? r.getText() : r.text) || '').trim();
                            if (t) return ok(t);
                        } catch (e) {}
                    }
                    ok('');
                };
                img.onerror = function () { URL.revokeObjectURL(url); ok(''); };
                img.src = url;
            });
        });
    }

    /* ── ② السكانر المربوط ────────────────────────────────────────────────── */
    function listen(onCode, opt) {
        if (_listening) return;                 // منصتٌ واحد لكل صفحة
        _listening = true;
        opt = opt || {};
        var maxGap = opt.maxGap || 35;          // ms بين حرفين
        var minLen = opt.minLen || 4;
        var buf = '', last = 0;

        document.addEventListener('keydown', function (e) {
            var el = e.target;
            var tag = el && el.tagName;
            /* لا نلتقط في مناطق النصّ الحرّ ولا كلمات السرّ: هناك قد يكتب إنسانٌ
               بسرعة لصقٍ أو تكرار، والخطأ هناك مكلف. */
            if (tag === 'TEXTAREA' || (tag === 'INPUT' && /password/i.test(el.type || ''))) { buf = ''; return; }

            var now = Date.now();
            if (now - last > maxGap) buf = '';   // فاصل بشري ⇒ ابدأ من جديد
            last = now;

            if (e.key === 'Enter') {
                var code = buf; buf = '';
                if (code.length >= minLen) {
                    e.preventDefault();          // لا نُرسل النموذج بضغطة السكانر
                    try { if (global.GMTSound) GMTSound.play('scan'); } catch (e2) {}      /* (١١ ت١) صفير القراءة */
                    if (onCode) onCode(code, 'scanner');
                }
                return;
            }
            if (e.key && e.key.length === 1 && /[A-Za-z0-9\-_.]/.test(e.key)) buf += e.key;
            else buf = '';
        }, true);
    }

    /* ── ③ الأسهل: زرّ بجانب حقل + إنصات للسكانر ─────────────────────────── */
    function attach(input, onCode, opts) {
        if (!input) return null;
        opts = opts || {};
        var fire = function (code, how) {
            input.value = code;
            /* نُطلق الحدثين معاً: صفحاتنا تربط البحث بـinput تارةً وبـchange تارة. */
            try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
            try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
            if (onCode) onCode(code, how);
        };
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'مسح باركود بالكاميرا';
        btn.setAttribute('data-gmt-scan', '1');
        /* ══ (2026-10-04) طلبُك: «زرّ البحث عن المنتج افصله عن زرّ البحث
           بالباركود، وخلّي زرّ الباركود **واضح** والرسوم تبعيته واضحة —
           ما تحطّ لي رسوم كرتونيّة».
           كان رمزاً تعبيريّاً (📷) صغيراً **داخل حقل البحث**: لا يُرى، ولا
           يقول إنّه للباركود (الكاميرا تعني تصويراً لا مسحاً). صار زرّاً
           مستقلّاً بحدٍّ ونصّ، وأيقونتُه **باركودٌ مرسومٌ بخطوطٍ** لا صورةَ
           كاميرا — أي الشيءُ نفسُه الذي يمسحه. */
        btn.setAttribute('aria-label', 'مسح باركود');
        btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
          + ' stroke-width="2" stroke-linecap="round" aria-hidden="true">'
          + '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>'
          + '<path d="M7 8v8M10.5 8v8M14 8v8M17 8v8"/></svg>'
          + '<span class="gmt-scan-tx">باركود</span>';
        btn.style.cssText = opts.style || ('display:inline-flex;align-items:center;gap:6px;'
          + 'border:1px solid var(--u-border,#e5e7eb);background:var(--u-surface,#fff);'
          + 'color:var(--u-ink-2,#334155);cursor:pointer;font-family:inherit;font-size:12px;'
          + 'font-weight:800;line-height:1;padding:0 11px;min-height:34px;border-radius:9px;'
          + 'white-space:nowrap;');
        btn.addEventListener('click', function (e) { e.preventDefault(); camera(fire); });
        (opts.into || input.parentElement || document.body).appendChild(btn);
        /* (TASK-A0538) «📸 صورة»: قراءة الباركود من صورة (ملصق S/N على العلبة أو الكاميرا) */
        if (opts.photo) {
            var pb = document.createElement('button');
            pb.type = 'button'; pb.setAttribute('data-gmt-scan-photo', '1'); pb.title = 'قراءة الباركود من صورة';
            pb.textContent = '📸 صورة'; pb.style.cssText = btn.style.cssText;
            pb.addEventListener('click', function (e) { e.preventDefault(); photo(fire); });
            (opts.into || input.parentElement || document.body).appendChild(pb);
        }
        /* (TASK-A0538) عدّة حقول في الصفحة: السكانر يملأ الحقل الذي فيه المؤشّر (كان أوّل حقلٍ رُبط دائماً) */
        input.__gmtScanFire = fire;
        listen(function (code, how) {
            var a = document.activeElement;
            if (a && a !== input && a.__gmtScanFire) return a.__gmtScanFire(code, how);
            fire(code, how);
        });
        return btn;
    }

    global.GMTScan = { still: still, decodeDeep: decodeDeep, scanLines: scanLines, readDigits: readDigits, matchDigits: matchDigits, camera: camera, listen: listen, attach: attach, photo: photo, decodeFile: decodeFile };
}(typeof window !== 'undefined' ? window : this));
