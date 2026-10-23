/* ═══════════════════════════════════════════════════════════════════════════
   gmt-docscan.js — الماسح الضوئي الداخلي لإشعارات الشحن  ·  19 ت1 2026
   ─────────────────────────────────────────────────────────────────────────
   طلبك (برومبت «الماسح الضوئي الذكي لإشعارات الشحن»): صورة الإيصال من المعرض
   أو الكاميرا ⇐ تُكتشف حدود الورقة وزواياها الأربع ⇐ تُقصّ ويُصحَّح منظورها
   فتصير مستطيلة كأنّها من ماسحٍ حقيقي ⇐ تُزال الظلال ويُحسَّن التباين والأبيض
   ⇐ نسخة ملوّنة واضحة أو «أبيض وأسود» عالية التباين.
   ومعاينة قبل الاعتماد: تحريك الزوايا يدوياً · تدوير · إعادة الاكتشاف · الصفحة
   كاملة · مقارنة بالأصل · إعادة التصوير · اعتماد.

   محلّيٌّ بالكامل (Canvas وJS) — لا CamScanner ولا خدمة ولا مكتبة خارجية.
   مبادئ لا تُكسر:
     • **الأصل يبقى دائماً** ويُعاد مع النسخة الممسوحة.
     • لا يُقصّ شيءٌ من الورقة: الزوايا تُوسَّع قليلاً للخارج قبل القصّ، وإن فشل
       الاكتشاف تُؤخذ الصورة كاملة لتحدّد أنت الزوايا.
     • التحسين يقسم على إضاءة الخلفية (لا يرسم ولا يُكمل شيئاً): الحبر يبقى حبراً،
       والأرقام والباركود كما هي.

   (23 ت1 · TASK-0131 · «ماسحٌ بمستوى CamScanner») المحيط بعدد نقاطٍ متغيّر: الاكتشاف يتتبّع حافّة الورقة الفعليّة بين أركانها
   (٤ نقاط للمستقيمة · أكثر للمنحنية/المطعوجة) وتُقوَّم برقعة «كونز» · محرّرٌ كامل: سحب · «+» لإضافة نقطة · حذف · رسم الحدود
   من الصفر · تراجع/إعادة · تكبير وتحريك · مكبّرةٌ تحت الإصبع · حالةٌ واضحة (اكتُشفت/راجعها/تعذّر) · خمسة أنماط والأصل محفوظ.

   GMTDocScan.open(file, { title, onRetake, onDetected(det, rot), processor, onProcessed, init }) ⇒ Promise<null | { retake:true } |
        { original: File, scanned: Blob, mode: 'orig'|'color'|'magic'|'gray'|'bw', corners, poly|null, ci|null, rotation, status: 'ok'|'review'|'fail'|'manual' }>
        init = نتيجةٌ سابقة ⇒ يُفتح بحدودها ونمطها (إعادة تعديل صفحة)
   opts.exclude = [{ poly, rot }] ⇒ أوراقٌ مُسحت من الصورة نفسها يتجاوزها الاكتشاف (TASK-0134)
   GMTDocScan.detectNorm(img, rot, exclude) ⇒ { corners, poly, ci, ok, how } · process(img, corners, rot, mode, { poly, ci }) — للاختبار
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  if (global.GMTDocScan) return;
  /* (TASK-0130) يُحمَّل أيضاً في عامل القراءة (Web Worker — بلا document): المعالجة نفسها (التقويم والتحسين) هناك على OffscreenCanvas
     فلا تحجز الواجهة؛ الواجهة (open) في الصفحة وحدها */
  var IN_WORKER = !doc;

  var WORK_MAX = 2400;      // أطول ضلعٍ للمعالجة (يكفي للنصّ الصغير والباركود)
  var DET_MAX = 512;        // للاكتشاف فقط (TASK-0123: ٥١٢ — ثابت النتائج بين ٤٤٨ و٥٦٠ وأسرع من ٦٤٠)

  /* ── أدوات ─────────────────────────────────────────────────────────────── */
  function loadImg(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { ok(im); setTimeout(function () { URL.revokeObjectURL(url); }, 4000); };
      im.onerror = function () { URL.revokeObjectURL(url); var er = new Error('تعذّر فتح الصورة'); er.code = 'bad-image'; bad(er); };   // (TASK-0128) ملفٌّ تالف أو ليس صورة
      im.src = url;
    });
  }
  function canvasOf(w, h) { if (IN_WORKER) return new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); var c = doc.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  /* الصورة مصغّرةً إلى أطول ضلعٍ max، مع التدوير (٠/٩٠/١٨٠/٢٧٠) */
  function drawScaled(img, max, rot) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var k = Math.min(1, max / Math.max(w, h)), sw = w * k, sh = h * k;
    var r = ((rot || 0) % 360 + 360) % 360, sideways = r === 90 || r === 270;
    var c = canvasOf(sideways ? sh : sw, sideways ? sw : sh), x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2); x.rotate(r * Math.PI / 180);
    x.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    return c;
  }

  /* ── ① اكتشاف الورقة ───────────────────────────────────────────────────────
     «ورقيّة» كل بكسل = إضاءة − تشبّع (الورقة فاتحة وقليلة اللون) ⇒ عتبة أوتسو ⇒
     تنظيف ⇒ أكبر مكوّنٍ متّصل ⇒ غلافه المحدّب ⇒ أبعد نقطتين (قُطر) زاويتان متقابلتان،
     وأبعد نقطةٍ عن القُطر في كل جهة هما الأخريان — يصحّ لأيّ ميلان. */
  function otsu(hist, n) {
    var sum = 0, i; for (i = 0; i < 256; i++) sum += i * hist[i];
    var sB = 0, wB = 0, best = 0, th = 128;
    for (i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      var wF = n - wB; if (!wF) break;
      sB += i * hist[i];
      var mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; th = i; }
    }
    return th;
  }
  function hull(pts) {
    pts.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [], i;
    for (i = 0; i < pts.length; i++) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) lo.pop(); lo.push(pts[i]); }
    for (i = pts.length - 1; i >= 0; i--) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], pts[i]) <= 0) up.pop(); up.push(pts[i]); }
    up.pop(); lo.pop(); return lo.concat(up);
  }
  function quadFromHull(h) {
    if (h.length < 4) return null;
    var a = 0, c = 0, best = -1, i, j;
    for (i = 0; i < h.length; i++) for (j = i + 1; j < h.length; j++) {
      var d = (h[i][0] - h[j][0]) * (h[i][0] - h[j][0]) + (h[i][1] - h[j][1]) * (h[i][1] - h[j][1]);
      if (d > best) { best = d; a = i; c = j; }
    }
    var A = h[a], C = h[c], b = null, dd = null, bs = 0, ds = 0;
    for (i = 0; i < h.length; i++) {
      var s = (C[0] - A[0]) * (h[i][1] - A[1]) - (C[1] - A[1]) * (h[i][0] - A[0]);
      if (s > bs) { bs = s; b = h[i]; }
      if (-s > ds) { ds = -s; dd = h[i]; }
    }
    if (!b || !dd) return null;
    return order([A, b, C, dd]);
  }
  /* ترتيب: أعلى-يسار · أعلى-يمين · أسفل-يمين · أسفل-يسار */
  function order(q) {
    var cx = 0, cy = 0; q.forEach(function (p) { cx += p[0] / 4; cy += p[1] / 4; });
    q = q.slice().sort(function (p, r) { return Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(r[1] - cy, r[0] - cx); });
    // بعد الترتيب بالزاوية (من -π): نبدأ بأقربها إلى أعلى-يسار
    var k = 0, m = Infinity;
    q.forEach(function (p, i) { var s = p[0] + p[1]; if (s < m) { m = s; k = i; } });
    return [q[k], q[(k + 1) % 4], q[(k + 2) % 4], q[(k + 3) % 4]];
  }
  function polyArea(q) { var s = 0; for (var i = 0; i < q.length; i++) { var p = q[i], r = q[(i + 1) % q.length]; s += p[0] * r[1] - r[0] * p[1]; } return Math.abs(s) / 2; }

  function detect(id) {
    var W = id.width, H = id.height, d = id.data, n = W * H, P = new Uint8Array(n), hist = new Uint32Array(256), i;
    for (i = 0; i < n; i++) {
      var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = 0.299 * r + 0.587 * g + 0.114 * b;
      var v = L - 0.6 * (mx - mn); v = v < 0 ? 0 : v > 255 ? 255 : v;
      P[i] = v; hist[v | 0]++;
    }
    var th = otsu(hist, n), M = new Uint8Array(n);
    for (i = 0; i < n; i++) M[i] = P[i] > th ? 1 : 0;
    /* تنظيف: أغلبية ٣×٣ مرّتين (يزيل النمش ويسدّ الثقوب الصغيرة كالنصّ) */
    for (var pass = 0; pass < 2; pass++) {
      var N = M.slice();                 // أطراف الصورة تبقى كما هي (كانت تُصفَّر فلا تُرى ورقةٌ تلامس الطرف)
      for (var y = 1; y < H - 1; y++) for (var x = 1; x < W - 1; x++) {
        var k = y * W + x, s = M[k - W - 1] + M[k - W] + M[k - W + 1] + M[k - 1] + M[k] + M[k + 1] + M[k + W - 1] + M[k + W] + M[k + W + 1];
        N[k] = s >= 5 ? 1 : 0;
      }
      M = N;
    }
    /* أكبر مكوّن متّصل */
    var lab = new Int32Array(n), cur = 0, bestL = 0, bestN = 0, stack = new Int32Array(n);
    for (i = 0; i < n; i++) {
      if (!M[i] || lab[i]) continue;
      cur++; var sp = 0, cnt = 0; stack[sp++] = i; lab[i] = cur;
      while (sp) {
        var p = stack[--sp]; cnt++;
        var px = p % W, py = (p / W) | 0;
        if (px > 0 && M[p - 1] && !lab[p - 1]) { lab[p - 1] = cur; stack[sp++] = p - 1; }
        if (px < W - 1 && M[p + 1] && !lab[p + 1]) { lab[p + 1] = cur; stack[sp++] = p + 1; }
        if (py > 0 && M[p - W] && !lab[p - W]) { lab[p - W] = cur; stack[sp++] = p - W; }
        if (py < H - 1 && M[p + W] && !lab[p + W]) { lab[p + W] = cur; stack[sp++] = p + W; }
      }
      if (cnt > bestN) { bestN = cnt; bestL = cur; }
    }
    var full = [[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]];
    if (!bestL || bestN < n * 0.12) return { corners: full, ok: false, why: 'لم تتميّز الورقة عن الخلفية' };
    /* 🛡️ ورقةٌ تلامس ٣ أطرافٍ أو أكثر من الصورة ⇒ تملأ الصورة (وما يبدو «حدّاً» داخلها ظلّ) ⇒ الصورة كاملة.
       (إيصال m01: أسفله مظلّل فقُصّ نصفه في التجربة الأولى — والقصّ ممنوع.) */
    var touch = 0, run;
    run = 0; for (var tx = 0; tx < W; tx++) if (lab[tx] === bestL) run++; if (run > W * 0.25) touch++;
    run = 0; for (tx = 0; tx < W; tx++) if (lab[(H - 1) * W + tx] === bestL) run++; if (run > W * 0.25) touch++;
    run = 0; for (var ty = 0; ty < H; ty++) if (lab[ty * W] === bestL) run++; if (run > H * 0.25) touch++;
    run = 0; for (ty = 0; ty < H; ty++) if (lab[ty * W + W - 1] === bestL) run++; if (run > H * 0.25) touch++;
    var diag = { touch: touch, sides: [] };
    if (touch >= 3) return { corners: full, ok: true, why: 'الورقة تملأ الصورة', fill: true, diag: diag };
    /* نقاط الحدّ فقط (كل بكسل من المكوّن بجاره خارجه) */
    var pts = [];
    for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
      var q = yy * W + xx; if (lab[q] !== bestL) continue;
      if (xx === 0 || yy === 0 || xx === W - 1 || yy === H - 1 || lab[q - 1] !== bestL || lab[q + 1] !== bestL || lab[q - W] !== bestL || lab[q + W] !== bestL) pts.push([xx, yy]);
    }
    var h = hull(pts), quad = quadFromHull(h);
    if (!quad) return { corners: full, ok: false, why: 'تعذّر تحديد الزوايا' };
    detect._last = { quad: quad, W: W, H: H };      // للتشخيص في الاختبارات
    var area = polyArea(quad);
    if (area < n * 0.12) return { corners: full, ok: false, why: 'الورقة صغيرة جداً في الصورة' };
    if (polyArea(h) > area * 1.25) return { corners: full, ok: false, why: 'حدود الورقة غير واضحة' };
    /* 🛡️ حارس القصّ: إن كان **خارج** الزوايا محتوىً (نصّ · أرقام · باركود = تدرّجاتٌ كثيفة) بكثافةٍ تقارب ما في داخلها
       فالزوايا تقصّ من الورقة ⇒ نرفضها ونأخذ الصورة كاملة لتحدّدها بيدك. القماش أو الطاولة خلف الورقة أهدأ من الحبر بكثير.
       (إيصال m01: أسفله مظلّل فقُصّ في التجربة الأولى؛ وحارس «الحافّة» خدعته أسطر النصّ — فالفيصل المحتوى نفسه.) */
    var G = new Float32Array(n), gs = [];
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      k = y * W + x;
      var gx = P[k + 1 - W] + 2 * P[k + 1] + P[k + 1 + W] - P[k - 1 - W] - 2 * P[k - 1] - P[k - 1 + W];
      var gy = P[k + W - 1] + 2 * P[k + W] + P[k + W + 1] - P[k - W - 1] - 2 * P[k - W] - P[k - W + 1];
      G[k] = Math.abs(gx) + Math.abs(gy); if ((k & 7) === 0) gs.push(G[k]);
    }
    gs.sort(function (a, b) { return a - b; });
    var g90 = gs[Math.floor(gs.length * 0.9)] || 1, strong = g90 * 0.8, mg = Math.max(4, Math.round(Math.min(W, H) * 0.03));
    function sideDist(px, py) {            // أقصر بُعدٍ عن أضلاع الرباعيّ (موجبٌ داخله)
      var md = Infinity;
      for (var e3 = 0; e3 < 4; e3++) {
        var A3 = quad[e3], B3 = quad[(e3 + 1) % 4], L3 = Math.hypot(B3[0] - A3[0], B3[1] - A3[1]) || 1;
        var dd3 = ((B3[0] - A3[0]) * (py - A3[1]) - (B3[1] - A3[1]) * (px - A3[0])) / L3;
        if (dd3 < md) md = dd3;
      }
      return md;
    }
    var inN = 0, inS = 0, outN = 0, outS = 0;
    for (y = mg; y < H - mg; y += 2) for (x = mg; x < W - mg; x += 2) {
      var sdv = sideDist(x, y); if (Math.abs(sdv) < mg) continue;        // شريط الحدّ نفسه لا يُحسب
      var st2 = G[y * W + x] > strong ? 1 : 0;
      if (sdv > 0) { inN++; inS += st2; } else { outN++; outS += st2; }
    }
    var dIn = inN ? inS / inN : 0, dOut = outN ? outS / outN : 0;
    diag.din = +dIn.toFixed(3); diag.dout = +dOut.toFixed(3); diag.outArea = +(outN / Math.max(1, inN + outN)).toFixed(3);
    if (outN > (inN + outN) * 0.04 && dOut > dIn * 0.5) return { corners: full, ok: false, why: 'يبدو أنّ جزءاً من الورقة خارج الزوايا', diag: diag };
    return { corners: quad, ok: true, why: '', diag: diag };
  }

  /* ── ①ب اكتشاف الورقة بحوافّها المستقيمة (22 ت1 · TASK-0123 · المالك: «الاكتشاف التلقائي لحدود الورقة مو شغّال عالسوا») ──
     الطريقة ① تبحث عن «أفتح منطقةٍ وأقلّها لوناً»، فتفشل حين تشبه الخلفيّةُ الورقة: يدٌ أو قماشٌ فاتح بجانبها، طاولةٌ بيضاء،
     رزمة أوراقٍ بجانب الإيصال — ورقٌ حراريٌّ مزرقّ قد تكون الخلفيّة أفتح منه. وحين تنجح تأتي حدودها تقريبيّةً فتُبقي شرائط خلفية.
     هنا كما في تطبيقات المسح: حواف (سوبل + كبت اللاأعظمي) ⇒ تحويل هاف (صوت كل حافّة بقدر اختلاف جانبيها: حدّ الورقة ثقيل،
     والسطر المطبوع والنصّ — ورقٌ على جانبيه — خفيف) ⇒ أزواج خطوطٍ متقابلة ⇒ رباعيّات ⇒ لكل ضلع: سندُ الحافّة على طوله +
     الفرق بين جانبيه (سطوعاً ولوناً، أيّهما أفتح) ⇒ الرباعيّ بقدر أضعف أضلاعه. ثمّ «لصق» كل ضلعٍ على الحدّ القريب بدقّة.
     على مجموعة تقييم (صور المالك + ١٤ صورةً مركّبة من إيصالٍ حراريٍّ حقيقي على خلفيات مختلفة): ١٨ من ٢٠ بخطأ ≤٣٪ من القطر
     مقابل ٦ من ٢٠ للطريقة ①، وصورتا المالك اللتان فشلتا (الإيصال المطويّ في اليد · المسح على الهاتف بشرائط خلفية) صحيحتان. */
  function lineQuad(id) {
    var W = id.width, H = id.height, d = id.data, n = W * H, i, x, y, k;
    var L = new Float32Array(n), P = new Float32Array(n), U = new Float32Array(n), V = new Float32Array(n);
    for (i = 0; i < n; i++) {
      var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = 0.299 * r + 0.587 * g + 0.114 * b;
      L[i] = l; var v = l - 0.6 * (mx - mn); P[i] = v < 0 ? 0 : v; U[i] = b - (r + g) / 2; V[i] = r - g;
    }
    function blur(a, rad) {     // صندوقيّ منفصل بأطرافٍ ممدودة
      var t = new Float32Array(n), u = new Float32Array(n), xx, yy, s, kk = 1 / (2 * rad + 1), row, last, lastR = (H - 1) * W;
      for (yy = 0; yy < H; yy++) { row = yy * W; last = row + W - 1; s = a[row] * (rad + 1);
        for (xx = 1; xx <= rad; xx++) s += a[row + (xx < W ? xx : W - 1)];
        for (xx = 0; xx < W; xx++) { t[row + xx] = s * kk; var ad = row + xx + rad + 1, rm = row + xx - rad; s += a[ad > last ? last : ad] - a[rm < row ? row : rm]; } }
      for (xx = 0; xx < W; xx++) { s = t[xx] * (rad + 1);
        for (yy = 1; yy <= rad; yy++) s += t[(yy < H ? yy : H - 1) * W + xx];
        for (yy = 0; yy < H; yy++) { u[yy * W + xx] = s * kk; var ai = (yy + rad + 1) * W + xx, ri = (yy - rad) * W + xx; s += t[ai > lastR + xx ? lastR + xx : ai] - t[ri < xx ? xx : ri]; } }
      return u;
    }
    var Ps = blur(P, 3), Lb = blur(blur(L, 2), 2), Ub = blur(U, 3), Vb = blur(V, 3), Lm = blur(L, 5);
    /* (TASK-0125) «حبر»: بكسلٌ أغمق من جواره القريب بوضوح (٢٥+) وسط محيطٍ فاتح — خطوط النصّ والجداول المطبوعة. الخلفيات
       الداكنة (لوحة مفاتيح) والمتدرّجة (خشب) لا تعطي حبراً؛ ورقٌ خلف طيّةٍ أو ظلٍّ أو حول يدٍ يعطيه. */
    var INK = new Uint8Array(n);
    for (i = 0; i < n; i++) if (Lm[i] >= 110 && Lm[i] - L[i] >= 25) INK[i] = 1;
    function at(arr, px, py) { px = px | 0; py = py | 0; if (px < 0 || py < 0 || px >= W || py >= H) return -1; return arr[py * W + px]; }
    /* الفرق بين نقطتين (سطوعٌ ولون) — بلا افتراض أيّهما أفتح */
    function fdiff(x1, y1, x2, y2) {
      x1 = x1 | 0; y1 = y1 | 0; x2 = x2 | 0; y2 = y2 | 0;
      if (x1 < 0 || y1 < 0 || x1 >= W || y1 >= H || x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) return -1;
      var a1 = y1 * W + x1, a2 = y2 * W + x2, dl = Lb[a1] - Lb[a2], du = Ub[a1] - Ub[a2], dv = Vb[a1] - Vb[a2];
      return Math.sqrt(dl * dl + 2 * du * du + 2 * dv * dv);
    }
    /* سوبل على السطوع واللون معاً وعلى نسخةٍ أنعم ⇒ كبت اللاأعظمي (الزاوية لبكسلات الحافّة وحدها).
       (حدّ ورقةٍ مزرقّة على قماشٍ رماديّ محبّب فرقُه لونٌ أكثر منه سطوعاً، وحبّات القماش «حوافّ» سطوعٍ تطغى عليه.) */
    var M = new Float32Array(n), GX = new Float32Array(n), GY = new Float32Array(n), A = new Float32Array(n), mh = new Uint32Array(512);
    function sob(a, k2, o) { o[0] = a[k2 + 1 - W] + 2 * a[k2 + 1] + a[k2 + 1 + W] - a[k2 - 1 - W] - 2 * a[k2 - 1] - a[k2 - 1 + W]; o[1] = a[k2 + W - 1] + 2 * a[k2 + W] + a[k2 + W + 1] - a[k2 - W - 1] - 2 * a[k2 - W] - a[k2 - W + 1]; }
    var gl = [0, 0], gu = [0, 0], gv = [0, 0];
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      k = y * W + x; sob(Lb, k, gl); sob(Ub, k, gu); sob(Vb, k, gv);
      var ml = gl[0] * gl[0] + gl[1] * gl[1], mu = 2 * (gu[0] * gu[0] + gu[1] * gu[1]), mv = 2 * (gv[0] * gv[0] + gv[1] * gv[1]);
      var mm = Math.sqrt(ml + mu + mv), gd = ml >= mu && ml >= mv ? gl : (mu >= mv ? gu : gv);      // الاتّجاه من القناة الأقوى
      M[k] = mm; GX[k] = gd[0]; GY[k] = gd[1]; mh[mm > 511 ? 511 : mm | 0]++;
    }
    function pct(f) { var c = 0; for (var h = 0; h < 512; h++) { c += mh[h]; if (c >= n * f) return h || 1; } return 1; }
    var tLow = Math.max(6, pct(0.95) * 0.22), E = new Uint8Array(n), ex = [];
    for (y = 2; y < H - 2; y++) for (x = 2; x < W - 2; x++) {
      k = y * W + x; var m = M[k]; if (m < tLow) continue;
      var ax = GX[k] < 0 ? -GX[k] : GX[k], ay = GY[k] < 0 ? -GY[k] : GY[k], m1, m2;
      if (ax > ay * 2.414) { m1 = M[k - 1]; m2 = M[k + 1]; }
      else if (ay > ax * 2.414) { m1 = M[k - W]; m2 = M[k + W]; }
      else if (GX[k] * GY[k] > 0) { m1 = M[k - W - 1]; m2 = M[k + W + 1]; }
      else { m1 = M[k - W + 1]; m2 = M[k + W - 1]; }
      if (m >= m1 && m >= m2) { E[k] = 1; ex.push(k); A[k] = Math.atan2(GY[k], GX[k]); }
    }
    /* هاف: كل بكسل حافّة يصوّت حول اتّجاه تدرّجه (±٥°) بوزن الفرق بين جانبيه */
    var OFF = Math.max(4, Math.round(Math.min(W, H) * 0.022)), D = Math.ceil(Math.hypot(W, H)), NR = 2 * D + 1, acc = new Float32Array(180 * NR), CS = [], SN = [], t;
    for (t = 0; t < 180; t++) { CS[t] = Math.cos(t * Math.PI / 180); SN[t] = Math.sin(t * Math.PI / 180); }
    for (var e = 0; e < ex.length; e++) {
      k = ex[e]; x = k % W; y = (k / W) | 0;
      var ca = Math.cos(A[k]), sa = Math.sin(A[k]), fd = fdiff(x + ca * OFF, y + sa * OFF, x - ca * OFF, y - sa * OFF);
      var wv = fd < 0 ? 0.3 : Math.max(0.05, Math.min(1, fd / 30)), deg = ((A[k] * 180 / Math.PI) % 180 + 180) % 180, t0 = Math.round(deg);
      for (var dt = -5; dt <= 5; dt++) { var tt = (t0 + dt + 180) % 180; acc[tt * NR + Math.round(x * CS[tt] + y * SN[tt]) + D] += wv; }
    }
    var minV = Math.min(W, H) * 0.05, cand = [];
    for (t = 0; t < 180; t++) for (var rr = 0; rr < NR; rr++) {
      var val = acc[t * NR + rr]; if (val < minV) continue;
      var isMax = true;
      for (var a2 = -3; a2 <= 3 && isMax; a2++) for (var b2 = -6; b2 <= 6; b2++) {
        if (!a2 && !b2) continue;
        var ta = t + a2, ra = rr + b2;
        if (ta < 0 || ta >= 180) { ta = (ta + 180) % 180; ra = NR - 1 - rr + b2; }
        if (ra < 0 || ra >= NR) continue;
        var w2 = acc[ta * NR + ra]; if (w2 > val || (w2 === val && ta * NR + ra < t * NR + rr)) { isMax = false; break; }
      }
      if (isMax) cand.push({ t: t, r: rr - D, v: val, cs: CS[t], sn: SN[t] });
    }
    cand.sort(function (p, q) { return q.v - p.v; });
    cand = cand.slice(0, 140);
    /* (TASK-0125) تدقيق كل خطٍّ مرشّح بنقاط حافّته (مربّعات صغرى كلّية): هاف يعطي أقرب درجةٍ صحيحة، وعلى حافّةٍ طويلة مائلة نصفُ
       درجةٍ يُبعد طرفيها ٤–٥ بكسل فلا «تلمس» الحافّةُ إلّا جزءاً من الخط ⇒ تخسر أمام خطوط الجدول داخل الورقة (المائلة والمنظور:
       ٥٥–٦٦٪ قصّ في مسح السيناريوهات). */
    function fitLine(l) {
      for (var it = 0; it < 2; it++) {
        var px0 = l.r * l.cs, py0 = l.r * l.sn, dx = -l.sn, dy = l.cs, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0;
        for (var s5 = -D; s5 <= D; s5 += 1.5) {
          var X = px0 + dx * s5, Y = py0 + dy * s5; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          for (var q5 = -3; q5 <= 3; q5++) {
            var qx = Math.round(X + l.cs * q5), qy = Math.round(Y + l.sn * q5); if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
            var kk = qy * W + qx; if (!E[kk]) continue;
            var dp = Math.cos(A[kk]) * l.cs + Math.sin(A[kk]) * l.sn; if (dp < 0.9 && dp > -0.9) continue;
            sx += qx; sy += qy; sxx += qx * qx; syy += qy * qy; sxy += qx * qy; m++; break;
          }
        }
        if (m < 12) return;
        var mx = sx / m, my = sy / m, cxx = sxx / m - mx * mx, cyy = syy / m - my * my, cxy = sxy / m - mx * my;
        var th = 0.5 * Math.atan2(2 * cxy, cxx - cyy), nxx = -Math.sin(th), nyy = Math.cos(th);   // th = اتّجاه الخط ⇒ العمود عليه
        if (nxx * l.cs + nyy * l.sn < 0) { nxx = -nxx; nyy = -nyy; }
        l.cs = nxx; l.sn = nyy; l.r = mx * nxx + my * nyy;
        var tdeg = Math.atan2(nyy, nxx) * 180 / Math.PI; l.t = ((tdeg % 180) + 180) % 180;
      }
    }
    cand.forEach(fitLine);
    function edgeAt(px, py, cs, sn) {     // حافّةٌ ضمن ±٢ على العمود، اتّجاهها عموديٌّ على الخط ⇒ +1 (تدرّجٌ مع العمود) أو -1 (عكسه) أو 0
      for (var q = -2; q <= 2; q++) {
        var qx = Math.round(px + cs * q), qy = Math.round(py + sn * q); if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
        var kk = qy * W + qx; if (!E[kk]) continue;
        var dp = Math.cos(A[kk]) * cs + Math.sin(A[kk]) * sn; if (dp > 0.85 || dp < -0.85) return 1;
      }
      return 0;
    }
    /* المرشّحون بأطول امتدادٍ متّصل «حدّيّ» (حافّة + فرقٌ واضح بين الجانبين) لا بعدد الأصوات: خطوط الخشب والنصّ كثيرة الأصوات */
    cand.forEach(function (l) {
      var px0 = l.r * l.cs, py0 = l.r * l.sn, dx = -l.sn, dy = l.cs, run = 0, best = 0, gap = 0;
      for (var s3 = -D; s3 <= D; s3 += 2) {
        var X = px0 + dx * s3, Y = py0 + dy * s3; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        var good = edgeAt(X, Y, l.cs, l.sn);
        if (good) { var f3 = fdiff(X + l.cs * OFF, Y + l.sn * OFF, X - l.cs * OFF, Y - l.sn * OFF); if (f3 >= 0 && f3 < 15) good = 0; }
        if (good) { run += 2 + gap; gap = 0; if (run > best) best = run; } else { gap += 2; if (gap > 10) { run = 0; gap = 0; } }
      }
      l.run = best;
    });
    var lines = [];
    cand.filter(function (l) { return l.run >= Math.min(W, H) * 0.1; }).sort(function (p, q) { return q.run - p.run; }).forEach(function (l) {
      if (lines.length >= 30) return;
      var dup = lines.some(function (o) {                        // بعد التدقيق قد يلتقي مرشّحان على الخط نفسه
        var same = Math.abs(o.cs - l.cs) < 0.03 && Math.abs(o.sn - l.sn) < 0.03 && Math.abs(o.r - l.r) < 5;
        var flip = Math.abs(o.cs + l.cs) < 0.03 && Math.abs(o.sn + l.sn) < 0.03 && Math.abs(o.r + l.r) < 5;
        return same || flip;
      });
      if (!dup) lines.push(l);
    });
    [[0, 0], [0, W - 1], [90, 0], [90, H - 1]].forEach(function (q) { lines.push({ t: q[0], r: q[1], cs: CS[q[0]], sn: SN[q[0]], border: 1 }); });   // إطار الصورة (ورقةٌ تتجاوزه)
    lines.forEach(function (l, li) { l.id = li; });

    /* عتبة «الورقيّة» (أوتسو) — لأضلاع إطار الصورة فقط */
    var hist = new Uint32Array(256), tot = 0; for (i = 0; i < n; i += 2) { hist[Ps[i] > 255 ? 255 : Ps[i] | 0]++; tot++; }
    var pth = otsu(hist, tot);
    function inter(l1, l2) { var det = l1.cs * l2.sn - l1.sn * l2.cs; if (Math.abs(det) < 1e-6) return null; return [(l1.r * l2.sn - l2.r * l1.sn) / det, (l1.cs * l2.r - l2.cs * l1.r) / det]; }
    /* ضلعٌ من P1 إلى P2 على الخط l، والداخل باتّجاه sgn: سندُ الحافّة (٠–١) والفرق بين الجانبين (٠–١) */
    function sideScore(l, P1, P2, sgn) {
      var len = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]), steps = Math.max(8, Math.round(len / 2)), sup = 0, con = 0, cnt = 0, nx = l.cs * sgn, ny = l.sn * sgn;
      for (var s = 0; s <= steps; s++) {
        var f = 0.04 + 0.92 * s / steps, px = P1[0] + (P2[0] - P1[0]) * f, py = P1[1] + (P2[1] - P1[1]) * f;
        if (px < -1 || py < -1 || px > W || py > H) continue;
        cnt++;
        if (l.border) { if (at(Ps, px + nx * OFF, py + ny * OFF) > pth) sup++; con += 0.5; continue; }   // الإطار: لا تباين يُقاس ⇒ محايد
        sup += edgeAt(px, py, l.cs, l.sn);
        var fd2 = fdiff(px + nx * OFF, py + ny * OFF, px - nx * OFF, py - ny * OFF);
        if (fd2 >= 0) con += Math.min(1, fd2 / 30);
      }
      return cnt ? { sup: sup / cnt, con: con / cnt, frac: cnt / (steps + 1), border: !!l.border } : null;
    }
    function ang(l1, l2) { var a = Math.abs(l1.t - l2.t) % 180; return a > 90 ? 180 - a : a; }
    function dist(l1, l2) { var cx = W / 2, cy = H / 2, si = cx * l1.cs + cy * l1.sn - l1.r, px = cx - si * l1.cs, py = cy - si * l1.sn; return Math.abs(px * l2.cs + py * l2.sn - l2.r); }
    function convex(q) { var sg = 0; for (var z = 0; z < 4; z++) { var a = q[z], b = q[(z + 1) % 4], c = q[(z + 2) % 4], cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (!cr) return false; if (!sg) sg = cr > 0 ? 1 : -1; else if ((cr > 0 ? 1 : -1) !== sg) return false; } return true; }
    var pairs = [], mnD = Math.min(W, H) * 0.12;
    for (i = 0; i < lines.length; i++) for (var j = i + 1; j < lines.length; j++) if (ang(lines[i], lines[j]) <= 35 && dist(lines[i], lines[j]) >= mnD) pairs.push([lines[i], lines[j]]);
    /* (TASK-0125) ركنٌ خارج الصورة حتى ٣٥٪: إيصالٌ مائل قرب طرف الصورة يخرج رأسُ ركنه منها كثيراً (كان ٨٪ فيُرفض الرباعيّ الصحيح
       ويُختار رباعيٌّ داخليّ يقصّ الورقة). ما يضبط ذلك: نصفُ كل ضلعٍ على الأقلّ ظاهرٌ في الصورة (frac). */
    var tops = [], cache = {}, mx2 = W * 0.35, my2 = H * 0.35;
    for (var pa = 0; pa < pairs.length; pa++) for (var pb = pa + 1; pb < pairs.length; pb++) {
      var Pa = pairs[pa], Pb = pairs[pb];
      if (ang(Pa[0], Pb[0]) < 40 || ang(Pa[1], Pb[1]) < 40) continue;
      var Q = [inter(Pa[0], Pb[0]), inter(Pa[0], Pb[1]), inter(Pa[1], Pb[1]), inter(Pa[1], Pb[0])], bad = !Q[0] || !Q[1] || !Q[2] || !Q[3];
      for (var z = 0; z < 4 && !bad; z++) if (Q[z][0] < -mx2 || Q[z][0] > W + mx2 || Q[z][1] < -my2 || Q[z][1] > H + my2) bad = true;
      if (bad || !convex(Q)) continue;
      var ar = polyArea(Q); if (ar < n * 0.06) continue;   // (TASK-0125) إيصالٌ مصوَّرٌ من بعيد: ٦٪ من الصورة (كان ١٠٪ ⇒ «الصورة كاملة»)
      var cxq = (Q[0][0] + Q[1][0] + Q[2][0] + Q[3][0]) / 4, cyq = (Q[0][1] + Q[1][1] + Q[2][1] + Q[3][1]) / 4;
      var sides = [[Pa[0], Q[0], Q[1], Pb[0], Pb[1]], [Pb[1], Q[1], Q[2], Pa[0], Pa[1]], [Pa[1], Q[2], Q[3], Pb[1], Pb[0]], [Pb[0], Q[3], Q[0], Pa[1], Pa[0]]], sc = [], ok = true, nb = 0;
      for (z = 0; z < 4; z++) {
        var ln = sides[z][0], sg2 = (cxq * ln.cs + cyq * ln.sn - ln.r) > 0 ? 1 : -1, i1 = sides[z][3].id, i2 = sides[z][4].id;
        var key = ln.id + ':' + (i1 < i2 ? i1 + ',' + i2 : i2 + ',' + i1) + ':' + sg2, ss = cache[key];   // الضلع نفسه يتكرّر في رباعيّاتٍ كثيرة
        if (ss === undefined) ss = cache[key] = sideScore(ln, sides[z][1], sides[z][2], sg2);
        if (!ss || ss.frac < 0.5) { ok = false; break; }
        if (ln.border) nb++;
        else if (ss.sup < 0.3 || ss.con < 0.35) { ok = false; break; }
        sc.push(ss);
      }
      if (!ok) continue;
      var ms = 0, mc = 0, mins = 1, minc = 1;
      sc.forEach(function (q) { ms += q.sup / 4; mc += q.con / 4; if (q.sup < mins) mins = q.sup; if (q.con < minc) minc = q.con; });
      /* الصغير (٦–١٠٪ · إيصالٌ مصوَّرٌ من بعيد ⇒ منظورٌ خفيف): أربعة حدودٍ حقيقيّةٍ واضحة وأضلاعٌ متقابلة شبه متوازية (لا حدّ يدٍ مائل) */
      if (ar < n * 0.1 && (nb || minc < 0.6 || mins < 0.5 || ang(Pa[0], Pa[1]) > 12 || ang(Pb[0], Pb[1]) > 12)) continue;
      /* الرباعيّ بقدر أضعف أضلاعه: سطرٌ مطبوع داخل الورقة يأتي بتباينٍ أضعف من حدّها الحقيقي */
      tops.push({ q: Q, score: ms * 0.25 + mins * 0.15 + mc * 0.15 + minc * 0.3 + (ar / n) * 0.15 - nb * 0.04, minc: minc, nb: nb, sc: sc, area: ar });
    }
    tops.sort(function (p, q) { return q.score - p.score; });
    /* الصغير (٦–١٠٪) وحوله حبرٌ قريبٌ يقارب ما فيه ⇒ جدولٌ أو إطارٌ داخل الإيصال لا الإيصال نفسه ⇒ يُستبعد */
    var rg0 = Math.max(4, Math.round(Math.min(W, H) * 0.05)), mg0 = Math.max(3, Math.round(Math.min(W, H) * 0.025));
    tops = tops.filter(function (t) {
      if (t.area >= n * 0.1) return true;
      var Qo = order(t.q), x0 = W, x1 = 0, y0 = H, y1 = 0, iN = 0, iS = 0, rN = 0, rS = 0;
      Qo.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      for (var yy = Math.max(1, (y0 - rg0) | 0); yy < Math.min(H - 1, y1 + rg0); yy += 2) for (var xx = Math.max(1, (x0 - rg0) | 0); xx < Math.min(W - 1, x1 + rg0); xx += 2) {
        var d0 = sdq(Qo, xx, yy);
        if (d0 > mg0) { iN++; iS += INK[yy * W + xx]; } else if (d0 < -mg0 && d0 > -rg0) { rN++; rS += INK[yy * W + xx]; }
      }
      return !(iN && rN && rS / rN > (iS / iN) * 0.3 + 0.002);
    });
    /* 🛡️ حارس القصّ (كالطريقة ①) للخطوط الأضعف: محتوى كثيف خارج الرباعيّ يقارب ما داخله ⇒ الأضلاع تقصّ الورقة.
       (لا يُطبَّق على الخطوط القويّة: خلفيّةٌ مخطّطة — خشبٌ أو بلاط — تبدو له «محتوى» فيُرفض الصحيح.) */
    var strong = pct(0.9) * 0.8, mg = Math.max(4, Math.round(Math.min(W, H) * 0.03));
    function guard(Q) {
      Q = order(Q);
      var inN = 0, inS = 0, outN = 0, outS = 0;
      for (var yy = mg; yy < H - mg; yy += 2) for (var xx = mg; xx < W - mg; xx += 2) {
        var md = Infinity;
        for (var e3 = 0; e3 < 4; e3++) { var A3 = Q[e3], B3 = Q[(e3 + 1) % 4], L3 = Math.hypot(B3[0] - A3[0], B3[1] - A3[1]) || 1; md = Math.min(md, ((B3[0] - A3[0]) * (yy - A3[1]) - (B3[1] - A3[1]) * (xx - A3[0])) / L3); }
        if (Math.abs(md) < mg) continue;
        var st2 = M[yy * W + xx] > strong ? 1 : 0;
        if (md > 0) { inN++; inS += st2; } else { outN++; outS += st2; }
      }
      return !(outN > (inN + outN) * 0.04 && outS / Math.max(1, outN) > (inS / Math.max(1, inN)) * 0.5);
    }

    /* طيّة الإيصال (نصفٌ مضاء ونصفٌ في الظلّ) تبدو حدّاً مستقيماً متبايناً ⇒ رباعيٌّ لنصف الورقة. لا قصّ: رباعيٌّ صالح أكبر
       (×١٫٢٥ فأكثر) يحوي الأفضل ودرجته قريبة ⇒ يُؤخذ (إيصال المالك المطويّ في اليد). */
    var b0 = tops[0] || null, best = b0;
    function contains(big, small) {
      var Qo = order(big.q), tol = -Math.min(W, H) * 0.04;      // «تحويه تقريباً»: حدود الطريقة ① تقريبيّة
      return small.q.every(function (pp) { var md = Infinity;
        pp = [Math.max(0, Math.min(W - 1, pp[0])), Math.max(0, Math.min(H - 1, pp[1]))];       // ركنٌ خارج الصورة (ورقةٌ تتجاوزها) يُقاس على إطارها
        for (var e4 = 0; e4 < 4; e4++) { var A4 = Qo[e4], B4 = Qo[(e4 + 1) % 4], L4 = Math.hypot(B4[0] - A4[0], B4[1] - A4[1]) || 1; md = Math.min(md, ((B4[0] - A4[0]) * (pp[1] - A4[1]) - (B4[1] - A4[1]) * (pp[0] - A4[0])) / L4); }
        return md >= tol; });
    }
    /* كثافة الحبر داخل رباعيّ big وخارج small (بعيداً عن أضلاع small بهامش) — small=null ⇒ داخل big كلّه */
    function sdq(Q, px, py) { var md = Infinity; for (var e5 = 0; e5 < 4; e5++) { var A5 = Q[e5], B5 = Q[(e5 + 1) % 4], L5 = Math.hypot(B5[0] - A5[0], B5[1] - A5[1]) || 1; md = Math.min(md, ((B5[0] - A5[0]) * (py - A5[1]) - (B5[1] - A5[1]) * (px - A5[0])) / L5); } return md; }
    var mgI = Math.max(3, Math.round(Math.min(W, H) * 0.025));
    function inkIn(bigQ, smallQ, ink) {
      var Bq = order(bigQ), Sq = smallQ ? order(smallQ) : null, N2 = 0, S2 = 0, I = ink || INK;
      for (var yy = 1; yy < H - 1; yy += 2) for (var xx = 1; xx < W - 1; xx += 2) {
        if (sdq(Bq, xx, yy) < mgI || (Sq && sdq(Sq, xx, yy) > -mgI)) continue;
        N2++; S2 += I[yy * W + xx];
      }
      return N2 > 30 ? S2 / N2 : 0;
    }
    var inkChecks = 0;
    for (i = 1; b0 && i < tops.length && i < 300; i++) {
      var t2 = tops[i], big = t2.area >= b0.area * 1.8, mcnb = 1;
      t2.sc.forEach(function (q) { if (!q.border && q.con < mcnb) mcnb = q.con; });
      if (t2.nb > 2 || t2.area < b0.area * 1.25 || t2.area <= best.area || !contains(t2, best)) continue;
      var near = t2.nb <= 1 && t2.score >= b0.score - (big ? 0.15 : 0.08) && mcnb >= (big ? 0.45 : 0.6);
      /* (TASK-0125) أو: ما يزيده الأكبر فيه حبرُ الإيصال نفسه (≥٣٥٪ من كثافته داخل الأفضل) ⇒ الأفضل قطع الورقة عند طيّةٍ أو ظلٍّ
         حادّ أو حول يد، أو الورقة تتجاوز إطار الصورة والإطار ضلعها الرابع — مهما كانت درجته (بحدٍّ أدنى صالح) */
      var inky = false;
      /* ضلعان على الإطار مسموحان هنا: منظورٌ حادّ يُخرج الطرف العريض من الورقة من جهتين (الحبر هو الدليل) — بحدٍّ أقصى ٨ فحوص (ثقيلة) */
      if (!near && mcnb >= 0.5 && t2.score >= 0.45 && t2.area >= best.area * 1.25 && inkChecks < 8) { inkChecks++; var inkB = inkIn(best.q, null); inky = inkB > 0.004 && inkIn(t2.q, best.q) >= inkB * 0.35; }
      if (near || inky) { best = t2; best.inky = inky; }
    }
    /* لصق كل ضلعٍ على الحدّ الحقيقي القريب (±٦٪): نحرّك طرفيه على العموديّ (خشنٌ ثمّ دقيق) ونختار الأقوى سنداً وتبايناً */
    function refine(Q) {
      Q = order(Q);
      var R = Math.max(6, Math.round(Math.min(W, H) * 0.06)), cx = (Q[0][0] + Q[1][0] + Q[2][0] + Q[3][0]) / 4, cy = (Q[0][1] + Q[1][1] + Q[2][1] + Q[3][1]) / 4, newL = [], snapped = 0;
      for (var z = 0; z < 4; z++) {
        var P1 = Q[z], P2 = Q[(z + 1) % 4], ux = P2[0] - P1[0], uy = P2[1] - P1[1], ln = Math.hypot(ux, uy) || 1, nx = -uy / ln, ny = ux / ln, bst = null;
        if ((cx - P1[0]) * nx + (cy - P1[1]) * ny < 0) { nx = -nx; ny = -ny; }          // n نحو الداخل
        /* ضلعٌ على إطار الصورة (الورقة تتجاوزه) يبقى كما هو — لا يُلصق على شيءٍ داخل الورقة */
        var onB = function (p) { return p[0] <= 1.5 ? 'l' : p[0] >= W - 2.5 ? 'r' : p[1] <= 1.5 ? 't' : p[1] >= H - 2.5 ? 'b' : ''; }, b1 = onB(P1);
        if (b1 && b1 === onB(P2)) { newL.push({ cs: -uy / ln, sn: ux / ln, r: P1[0] * (-uy / ln) + P1[1] * (ux / ln) }); snapped++; continue; }
        var tryAt = function (da, db) {
          var A1 = [P1[0] + nx * da, P1[1] + ny * da], B1 = [P2[0] + nx * db, P2[1] + ny * db];
          var vx = B1[0] - A1[0], vy = B1[1] - A1[1], vl = Math.hypot(vx, vy) || 1, l = { cs: -vy / vl, sn: vx / vl };
          l.r = A1[0] * l.cs + A1[1] * l.sn;
          var ss = sideScore(l, A1, B1, (cx * l.cs + cy * l.sn - l.r) > 0 ? 1 : -1); if (!ss || ss.frac < 0.5) return;
          var sc2 = ss.sup * 0.5 + ss.con * 0.5 - Math.max(0, da + db) * 0.0008;      // تعادل ⇒ الأبعد للخارج (لا قصّ)
          if (!bst || sc2 > bst.sc) bst = { sc: sc2, l: l, ss: ss, da: da, db: db };
        };
        for (var da0 = -R; da0 <= R; da0 += 3) for (var db0 = -R; db0 <= R; db0 += 3) tryAt(da0, db0);
        if (bst) { var bda = bst.da, bdb = bst.db; for (var fa = -2; fa <= 2; fa++) for (var fb = -2; fb <= 2; fb++) if (fa || fb) tryAt(bda + fa, bdb + fb); }
        if (bst && bst.ss.sup >= 0.35 && bst.ss.con >= 0.5) { newL.push(bst.l); snapped++; }
        else { var nx2 = -uy / ln, ny2 = ux / ln; newL.push({ cs: nx2, sn: ny2, r: P1[0] * nx2 + P1[1] * ny2 }); }
      }
      var out = Q.map(function (p) { return p.slice(); });
      for (z = 0; z < 4; z++) { var c = inter(newL[(z + 3) % 4], newL[z]); if (c) out[z] = c; }
      return { q: out, snapped: snapped };
    }
    /* كثافة المحتوى (تدرّجاتٌ قويّة = حبر) في ما يزيده رباعيٌّ كبير على صغير — بعيداً عن أضلاع الصغير */
    function extraInk(bigQ, smallQ) {
      var Bq = order(bigQ), Sq = order(smallQ), N2 = 0, S2 = 0;
      function sd(Q, px, py) { var md = Infinity; for (var e5 = 0; e5 < 4; e5++) { var A5 = Q[e5], B5 = Q[(e5 + 1) % 4], L5 = Math.hypot(B5[0] - A5[0], B5[1] - A5[1]) || 1; md = Math.min(md, ((B5[0] - A5[0]) * (py - A5[1]) - (B5[1] - A5[1]) * (px - A5[0])) / L5); } return md; }
      for (var yy = 1; yy < H - 1; yy += 2) for (var xx = 1; xx < W - 1; xx += 2) {
        if (sd(Bq, xx, yy) < mg || sd(Sq, xx, yy) > -mg) continue;
        N2++; if (M[yy * W + xx] > strong) S2++;
      }
      return N2 ? S2 / N2 : 0;
    }

    /* (TASK-0125) «ورقةٌ تتجاوز الإطار»: إيصالٌ مصوَّرٌ عن قرب أعرض من الصورة (أو مائلٌ يخرج طرفه) ⇒ ضلعان حقيقيّان قويّان
       والإطار ضلعاها الآخران. لا يُستعمل إلّا بدل «الصورة كاملة»، وبشرط ألّا يكون خارجه حبر (لا قصّ: حبرٌ خارجه ≥١٥٪ من داخله
       ⇒ الأضلاع داخل الورقة ⇒ يُرفض). */
    function inkOut(Q, ink) {
      var Qo = order(Q), N2 = 0, S2 = 0, I = ink || INK;
      for (var yy = 1; yy < H - 1; yy += 2) for (var xx = 1; xx < W - 1; xx += 2) { if (sdq(Qo, xx, yy) > -mgI) continue; N2++; S2 += I[yy * W + xx]; }
      return N2 > 30 ? S2 / N2 : 0;
    }
    /* كثافة الحبر في شريطٍ خارج الضلع z مباشرةً (بعرض ٦٪ من الصورة، على امتداد الضلع) */
    function inkBeyond(Qo, z, ink) {
      var A1 = Qo[z], B1 = Qo[(z + 1) % 4], cx = (Qo[0][0] + Qo[2][0]) / 2, cy = (Qo[0][1] + Qo[2][1]) / 2, ux = B1[0] - A1[0], uy = B1[1] - A1[1], ln = Math.hypot(ux, uy) || 1, nx = -uy / ln, ny = ux / ln, N2 = 0, S2 = 0, bw = Math.max(6, Math.round(Math.min(W, H) * 0.06));
      if ((cx - A1[0]) * nx + (cy - A1[1]) * ny > 0) { nx = -nx; ny = -ny; }           // n نحو الخارج
      for (var f = 0.08; f <= 0.92; f += 0.02) for (var dd = mgI; dd <= mgI + bw; dd += 2) {
        var px = (A1[0] + ux * f + nx * dd) | 0, py = (A1[1] + uy * f + ny * dd) | 0;
        if (px < 1 || py < 1 || px >= W - 1 || py >= H - 1) continue;
        N2++; S2 += ink[py * W + px];
      }
      return N2 > 20 ? S2 / N2 : 0;
    }
    var INK2 = null;   // حبرٌ بعتبةٍ نسبيّة — حتى في ظلٍّ عميق
    function inkRel() {
      if (!INK2) { INK2 = new Uint8Array(n); for (var k3 = 0; k3 < n; k3++) if (Lm[k3] >= 25 && Lm[k3] - L[k3] >= Math.max(12, Lm[k3] * 0.15)) INK2[k3] = 1; }
      return INK2;
    }
    /* لون الورقة داخل رباعيّ: وسيط السطوع واللون لنقاطٍ بلا حبر */
    function paperColor(Qo) {
      var ls = [], us = [], vs = [];
      for (var a = 1; a < 16; a++) for (var b = 1; b < 16; b++) {
        var u = a / 16, v = b / 16, top = [Qo[0][0] + (Qo[1][0] - Qo[0][0]) * u, Qo[0][1] + (Qo[1][1] - Qo[0][1]) * u], bot = [Qo[3][0] + (Qo[2][0] - Qo[3][0]) * u, Qo[3][1] + (Qo[2][1] - Qo[3][1]) * u];
        var px = (top[0] + (bot[0] - top[0]) * v) | 0, py = (top[1] + (bot[1] - top[1]) * v) | 0;
        if (px < 0 || py < 0 || px >= W || py >= H || INK[py * W + px]) continue;
        var k2 = py * W + px; ls.push(Lb[k2]); us.push(Ub[k2]); vs.push(Vb[k2]);
      }
      var med = function (a) { a.sort(function (p, q) { return p - q; }); return a.length ? a[a.length >> 1] : 0; };
      return [med(ls), med(us), med(vs)];
    }
    /* ضلع الإطار: هل الشريط المحاذي له ورقٌ فعلاً (يشبه لون الورقة) — لا خلفيّةٌ قريبة اللون؟ نسبة النقاط المشابهة */
    function paperAtBorder(Qo, z, col) {
      var A1 = Qo[z], B1 = Qo[(z + 1) % 4], cx = (Qo[0][0] + Qo[2][0]) / 2, cy = (Qo[0][1] + Qo[2][1]) / 2, ux = B1[0] - A1[0], uy = B1[1] - A1[1], ln = Math.hypot(ux, uy) || 1, nx = -uy / ln, ny = ux / ln, hit = 0, cnt = 0;
      if ((cx - A1[0]) * nx + (cy - A1[1]) * ny < 0) { nx = -nx; ny = -ny; }
      for (var f = 0.05; f <= 0.95; f += 0.03) {
        var px = (A1[0] + ux * f + nx * 3) | 0, py = (A1[1] + uy * f + ny * 3) | 0;
        if (px < 0 || py < 0 || px >= W || py >= H || INK[py * W + px]) continue;
        var k2 = py * W + px, dl = Lb[k2] - col[0], du = Ub[k2] - col[1], dv = Vb[k2] - col[2];
        /* (TASK-0129) ظلٌّ متدرّج يُغمق طرف الورقة حتى ٥٠٪ ⇒ اللون نفسه بسطوعٍ أقلّ: السطوع بوزنٍ أخفّ (ربع) والصبغة كما هي */
        cnt++; if (Math.sqrt(dl * dl + 2 * du * du + 2 * dv * dv) < 20 || Math.sqrt(dl * dl * 0.09 + 2 * du * du + 2 * dv * dv) < 14) hit++;
      }
      return cnt ? hit / cnt : 0;
    }
    /* (TASK-0130) يُحسب عند الحاجة فقط (لا رباعيّ آخر صالح) — كان يُحسب دائماً: ~١ث من ~٢ث للاكتشاف على هاتفٍ متوسّط */
    function findPartial() {
    var partial = null, pChecks = 0;
    for (i = 0; i < tops.length && i < 300 && !partial && pChecks < 10; i++) {
      var tp = tops[i]; if (tp.nb < 1 || tp.nb > 2 || tp.score < 0.3 || tp.area < n * 0.25) continue;   // ورقةٌ مقرّبة كبيرة — لا شريطٌ رفيع
      var strongS = tp.sc.every(function (q) { return q.border || (q.con >= 0.7 && q.sup >= 0.5); });
      if (!strongS) continue;
      pChecks++;
      var iin = inkIn(tp.q, null), iout = inkOut(tp.q);
      /* (TASK-0129) ورقٌ حراريّ رماديّ أغمق من قماشٍ حوله (أو في ظلّ): حبرُه لا يُعدّ «حبراً» بالعتبة المطلقة ⇒ بالعتبة النسبيّة هنا وحدها */
      if (!(iin > 0.01)) { var ink2 = inkRel(); iin = inkIn(tp.q, null, ink2); iout = inkOut(tp.q, ink2); }
      if (!(iin > 0.01 && iout < iin * 0.15 && guard(tp.q))) continue;   // وحارس القصّ أيضاً (رموزٌ وشعارٌ خارجه = ورقة)
      /* (TASK-0129) وخلف كل ضلعٍ حقيقيّ مباشرةً لا حبر: نصّ الإيصال المستمرّ بعد الضلع ⇒ الضلع خطّ ظلٍّ أو طيّة داخل الورقة لا حدّها
         (الحبر خارج الرباعيّ كلّه يذوب في مساحة الخلفيّة الكبيرة فلا يكشفه) */
      var Qb = order(tp.q), ir = inkRel(), iin2 = inkIn(tp.q, null, ir), beyond = false;     // نسبيّاً: نصّ الإيصال في الظلّ حبرٌ أيضاً
      for (var zb = 0; zb < 4 && !beyond; zb++) { if (tp.sc[zb] && tp.sc[zb].border) continue; if (inkBeyond(Qb, zb, ir) > iin2 * 0.3) beyond = true; }
      if (beyond) continue;
      var Qo3 = order(tp.q), col = paperColor(Qo3), okB = true;
      for (var z3 = 0; z3 < 4 && okB; z3++) {
        var A6 = Qo3[z3], B6 = Qo3[(z3 + 1) % 4], onEdge = (A6[0] <= 2 && B6[0] <= 2) || (A6[0] >= W - 3 && B6[0] >= W - 3) || (A6[1] <= 2 && B6[1] <= 2) || (A6[1] >= H - 3 && B6[1] >= H - 3);
        if (onEdge && paperAtBorder(Qo3, z3, col) < 0.7) okB = false;
      }
      if (okB) partial = tp;
    }
    return partial;
    }
    /* (TASK-0129) حارسٌ أخير: ضلعٌ (ليس على الإطار) خلفه الورقةُ نفسها بحبرها ⇒ الرباعيّ يقصّ الورقة (ظلّ الهاتف الحادّ على نصف ورقةٍ
       أكبر من الصورة · طيّة) ⇒ أكبرُ رباعيٍّ يحويه وأضلاعه كلّها كذلك سليمة. «الورقة نفسها» = حبرٌ (نسبيّ: يبقى في الظلّ) بكثافة نصف
       ما داخله + صبغة الشريط صبغة الورقة (الظلّ يُغمق ولا يغيّر الصبغة؛ خطوط الخشب «حبرٌ» نسبيّ لكن صبغتها غيرها — بلا هذا الشرط
       أفسد ٣ صورٍ على خشب). لا بديل ⇒ يبقى كما هو (لا أسوأ). */
    function onFrame(Qo, z) { var A6 = Qo[z], B6 = Qo[(z + 1) % 4]; return (A6[0] <= 2 && B6[0] <= 2) || (A6[0] >= W - 3 && B6[0] >= W - 3) || (A6[1] <= 2 && B6[1] <= 2) || (A6[1] >= H - 3 && B6[1] >= H - 3); }
    function paperBeyond(Qo, z, col) {
      var A1 = Qo[z], B1 = Qo[(z + 1) % 4], cx = (Qo[0][0] + Qo[2][0]) / 2, cy = (Qo[0][1] + Qo[2][1]) / 2, ux = B1[0] - A1[0], uy = B1[1] - A1[1], ln = Math.hypot(ux, uy) || 1, nx = -uy / ln, ny = ux / ln, N2 = 0, S2 = 0, bw = Math.max(6, Math.round(Math.min(W, H) * 0.06));
      if ((cx - A1[0]) * nx + (cy - A1[1]) * ny > 0) { nx = -nx; ny = -ny; }
      for (var f = 0.08; f <= 0.92; f += 0.04) for (var dd = mgI; dd <= mgI + bw; dd += 3) {
        var px = (A1[0] + ux * f + nx * dd) | 0, py = (A1[1] + uy * f + ny * dd) | 0;
        if (px < 1 || py < 1 || px >= W - 1 || py >= H - 1) continue;
        var k2 = py * W + px; if (INK2[k2]) continue;
        var du = Ub[k2] - col[1], dv = Vb[k2] - col[2]; N2++; if (Math.sqrt(2 * du * du + 2 * dv * dv) < 12) S2++;
      }
      return N2 > 10 ? S2 / N2 : 0;
    }
    function cutsInk(Q, k) {
      var Qo = order(Q), ir = inkRel(), ii = inkIn(Q, null, ir);
      if (!(ii > 0.01)) return false;
      var col = null;
      for (var z7 = 0; z7 < 4; z7++) {
        if (onFrame(Qo, z7) || inkBeyond(Qo, z7, ir) <= ii * k) continue;
        col = col || paperColor(Qo);
        if (paperBeyond(Qo, z7, col) > 0.6) return true;
      }
      return false;
    }
    function expand(Q) {
      if (!cutsInk(Q, 0.5)) return null;
      /* البديل: أكبر (بعد طرح ما يزيده الأوّل من خلفيّة) ويغطّي حبرَ الأوّل كلّه تقريباً (لا «يحويه» هندسيّاً: الأوّل قد يمتدّ فوق
         الورقة إلى إطار الصورة) وأضلاعه سليمة */
      var ir = inkRel(), ii = inkIn(Q, null, ir), a0 = polyArea(Q), checks = 0;
      for (var i8 = 0; i8 < tops.length && i8 < 300 && checks < 12; i8++) {
        var t8 = tops[i8]; if (t8.nb > 2 || t8.score < 0.3 || t8.area < a0) continue;
        checks++;
        if (inkIn(Q, t8.q, ir) < ii * 0.15 && inkIn(t8.q, Q, ir) > ii * 0.3 && !cutsInk(t8.q, 0.3) && guard(t8.q)) return t8.q;
      }
      return null;
    }
    /* (TASK-0130) فصل الورقة عن الخلفيّة: نسبة «الورقيّ» داخل الرباعيّ (بعيداً عن أضلاعه) ونسبته خارجه */
    function paperSep(Q) {
      var Qo = order(Q), iN = 0, iP = 0, oN = 0, oP = 0;
      for (var yy = 1; yy < H - 1; yy += 2) for (var xx = 1; xx < W - 1; xx += 2) {
        var d0 = sdq(Qo, xx, yy), pp = Ps[yy * W + xx] > pth ? 1 : 0;
        if (d0 > mgI) { iN++; iP += pp; } else if (d0 < -mgI) { oN++; oP += pp; }
      }
      return { pin: iN ? iP / iN : 0, pout: oN ? oP / oN : 1, oN: oN };
    }
    /* (TASK-0134 · «عدّة أوراق في صورة واحدة») رباعيٌّ يضمّ ورقتين متجاورتين حوافّهما على استقامةٍ واحدة: شريطٌ بلا ورق (<٢٠٪) يقطعه
       من حافّةٍ إلى حافّة، عرضه ≥٣٪، وعلى جانبيه ورقٌ (≥٦٠٪) وكلّ جانبٍ ≥٢٠٪ ⇒ { drop: الجانب الأصغر من منتصف الشريط إلى ما بعد
       طرفه } فيُخفى ويُعاد الاكتشاف على الورقة الأكبر وحدها (الأخرى: «➕ ورقة أخرى من الصورة نفسها» في صفحة الماسح) */
    function gap(Q) {
      Q = order(Q);
      var at = function (u, v) { var a = Q[0], b = Q[1], c = Q[2], d = Q[3]; return [(1 - v) * ((1 - u) * a[0] + u * b[0]) + v * ((1 - u) * d[0] + u * c[0]), (1 - v) * ((1 - u) * a[1] + u * b[1]) + v * ((1 - u) * d[1] + u * c[1])]; };
      var N = 100, M = 32;
      /* لون الخلفيّة: حلقةٌ خارج الرباعيّ مباشرةً. الشريط يُعدّ فاصلاً بين ورقتين فقط إن كان بلونها (≥٧٠٪ من عيّناته) — شريطٌ ملوّن
         داخل الإيصال (ترويسة جدول · ظلّ · لونٌ مطبوع) ليس ورقاً أبيض لكنّه ليس الخلفيّة أيضاً (أوّل نسخةٍ بلا هذا قسمت إيصالاتٍ سليمة) */
      var bl = [], bu = [], bv = [];
      for (var e = 0; e < 4; e++) for (var q2 = 0.05; q2 < 0.96; q2 += 0.03) {
        var pb = e === 0 ? at(q2, -0.035) : e === 1 ? at(q2, 1.035) : e === 2 ? at(-0.035, q2) : at(1.035, q2), bx = pb[0] | 0, by = pb[1] | 0;
        if (bx < 0 || by < 0 || bx >= W || by >= H) continue; var bk = by * W + bx; bl.push(Lb[bk]); bu.push(Ub[bk]); bv.push(Vb[bk]);
      }
      if (bl.length < 12) return null;
      var mean = function (a) { var t = 0; a.forEach(function (v) { t += v; }); return t / a.length; }, mL = mean(bl), mU = mean(bu), mV = mean(bv);
      var sdL = Math.sqrt(mean(bl.map(function (v) { return (v - mL) * (v - mL); }))), tolL = Math.max(25, 2 * sdL);
      if (sdL > 30) return null;                                            // خلفيّةٌ متفاوتة (ظلٌّ على نصفها) ⇒ لا يُحكم بلونها
      var bgLike = function (kk) { return Math.abs(Lb[kk] - mL) < tolL && Math.abs(Ub[kk] - mU) < 20 && Math.abs(Vb[kk] - mV) < 20; };
      for (var axis = 0; axis < 2; axis++) {
        var pr = [], i, j, k, best = null;
        for (i = 0; i < N; i++) {
          var t = (i + 0.5) / N, sP = 0, n = 0;
          for (j = 0; j < M; j++) { var r = 0.06 + 0.88 * (j + 0.5) / M, pq = axis ? at(r, t) : at(t, r), X = pq[0] | 0, Y = pq[1] | 0; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; n++; if (Ps[Y * W + X] > pth) sP++; }
          pr.push(n ? sP / n : 1);
        }
        for (i = 0; i < N;) { if (pr[i] < 0.2) { j = i; while (j < N && pr[j] < 0.2) j++; if (!best || j - i > best[1] - best[0]) best = [i, j]; i = j; } else i++; }
        if (!best || best[1] - best[0] < 3 || best[0] < 20 || best[1] > N - 20) continue;
        var sL = 0, sR = 0; for (k = 0; k < best[0]; k++) sL += pr[k]; for (k = best[1]; k < N; k++) sR += pr[k];
        if (sL / best[0] < 0.6 || sR / (N - best[1]) < 0.6) continue;
        var gN = 0, gB = 0;
        for (i = best[0]; i < best[1]; i++) for (j = 0; j < M; j++) {
          var r2 = 0.06 + 0.88 * (j + 0.5) / M, pg = axis ? at(r2, (i + 0.5) / N) : at((i + 0.5) / N, r2), gx = pg[0] | 0, gy = pg[1] | 0;
          if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue; gN++; if (bgLike(gy * W + gx)) gB++;
        }
        if (!gN || gB / gN < 0.7) continue;
        var m = (best[0] + best[1]) / 2 / N, left = best[0] < N - best[1], lo = left ? -0.03 : m, hi = left ? m : 1.03;
        return { axis: axis, drop: axis ? [at(-0.03, lo), at(1.03, lo), at(1.03, hi), at(-0.03, hi)] : [at(lo, -0.03), at(hi, -0.03), at(hi, 1.03), at(lo, 1.03)] };
      }
      return null;
    }
    /* نسبة «الورقيّ» فيما يزيده رباعيٌّ كبير على صغير (بعيداً عن أضلاع الصغير) */
    function paperIn(bigQ, smallQ) {
      var Bq = order(bigQ), Sq = order(smallQ), N2 = 0, S2 = 0;
      for (var yy = 1; yy < H - 1; yy += 2) for (var xx = 1; xx < W - 1; xx += 2) {
        if (sdq(Bq, xx, yy) < mgI || sdq(Sq, xx, yy) > -mgI) continue;
        N2++; if (Ps[yy * W + xx] > pth) S2++;
      }
      return N2 > 30 ? S2 / N2 : 1;
    }
    /* (TASK-0131) حدود الورقة الفعليّة بين أركانها الأربعة: على كل ضلعٍ نقاطٌ كل ~٨ بكسل، ولكلٍّ يُبحث على العموديّ (±٤٫٥٪) عن أقوى
       انتقالٍ «ورقٌ في الداخل ⇐ لا ورق في الخارج» بحافّةٍ متّجهةٍ مع العموديّ. لا دليل ⇒ يُستوفى من الجيران. الضلع شبه مستقيم ⇒ بلا نقاط؛
       وإلّا تُبسَّط (دوغلاس-بوكر) فتبقى النقاط التي تمثّل انحناءه فقط. ضلعٌ على إطار الصورة يبقى مستقيماً. */
    function trace(Q) {
      Q = order(Q);
      var cx = (Q[0][0] + Q[1][0] + Q[2][0] + Q[3][0]) / 4, cy = (Q[0][1] + Q[1][1] + Q[2][1] + Q[3][1]) / 4;
      var R = Math.max(4, Math.round(Math.min(W, H) * 0.045)), off = Math.max(2, Math.round(Math.min(W, H) * 0.012));
      var eps = Math.max(2, Math.min(W, H) * 0.008), poly = [], ci = [];
      function onFrameSeg(A, B) { return (A[0] <= 2 && B[0] <= 2) || (A[0] >= W - 3 && B[0] >= W - 3) || (A[1] <= 2 && B[1] <= 2) || (A[1] >= H - 3 && B[1] >= H - 3); }
      function dp(pts, a, b, keep) {             // دوغلاس-بوكر على [a..b]
        var A = pts[a], B = pts[b], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, mi = -1, md = 0;
        for (var i = a + 1; i < b; i++) { var d = Math.abs(dx * (pts[i][1] - A[1]) - dy * (pts[i][0] - A[0])) / L; if (d > md) { md = d; mi = i; } }
        if (md > eps && mi > 0) { keep[mi] = 1; dp(pts, a, mi, keep); dp(pts, mi, b, keep); }
      }
      for (var z = 0; z < 4; z++) {
        var A = Q[z], B = Q[(z + 1) % 4], ux = B[0] - A[0], uy = B[1] - A[1], L = Math.hypot(ux, uy) || 1, nx = -uy / L, ny = ux / L;
        if ((cx - A[0]) * nx + (cy - A[1]) * ny > 0) { nx = -nx; ny = -ny; }     // n نحو الخارج
        ci.push(poly.length); poly.push(A.slice());
        if (onFrameSeg(A, B) || L < 24) continue;
        var ns = Math.max(5, Math.round(L / 8)), ds = [], pts = [];
        for (var k = 1; k < ns; k++) {
          var f = k / ns, px = A[0] + ux * f, py = A[1] + uy * f, best = 0, bd = NaN;
          if (f < 0.07 || f > 0.93) { ds.push(NaN); continue; }        // قرب الركن: حافّة الضلع المجاور تختلط به ⇒ يُستوفى
          for (var d = -R; d <= R; d++) {
            var X = Math.round(px + nx * d), Y = Math.round(py + ny * d); if (X < 1 || Y < 1 || X >= W - 1 || Y >= H - 1) continue;
            var kk = Y * W + X, g = Math.abs(GX[kk] * nx + GY[kk] * ny) / (Math.hypot(GX[kk], GY[kk]) || 1); if (g < 0.7) continue;
            var ix = Math.round(px + nx * (d - off)), iy = Math.round(py + ny * (d - off)), ox = Math.round(px + nx * (d + off)), oy = Math.round(py + ny * (d + off));
            if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
            var pin = Ps[iy * W + ix], pout = (ox < 0 || oy < 0 || ox >= W || oy >= H) ? 0 : Ps[oy * W + ox];
            if (!(pin > pth && pout < pth)) continue;                  // ورقٌ في الداخل ولا ورق في الخارج
            var sc = M[kk] * (pin - pout) - Math.abs(d) * 0.02;        // تعادل ⇒ الأقرب للضلع
            if (sc > best) { best = sc; bd = d; }
          }
          ds.push(Math.abs(bd) >= R - 1 ? NaN : bd);                     // عند حدّ البحث تماماً ⇒ ليس حافّة الورقة (خطٌّ داخليّ أو خلفيّة)
        }
        /* (صور المالك: إيصالٌ تملؤه إضاءةٌ برتقاليّة · ورقةٌ ثانية بجانبه) حافّةٌ وُجدت على أقلّ من ٦٠٪ من الضلع، أو تقفز بين عيّنتين
           متجاورتين أكثر من نصف مدى البحث ⇒ ما تتبّعه خطوطٌ داخليّة لا حافّة الورقة ⇒ الضلع يبقى مستقيماً (كان يتبعها فتتشوّه النسخة).
           الورقة المنحنية فعلاً: حافّتها على الضلع كلّه تقريباً وبانحناءٍ سلس. */
        var nIn = 0, nOk = 0, jmp = 0, prev = NaN, gap = 0, run = 0;
        for (var j2 = 0; j2 < ds.length; j2++) {
          var f2 = (j2 + 1) / ns; if (f2 < 0.07 || f2 > 0.93) continue; nIn++;
          if (!isNaN(ds[j2])) { nOk++; run = 0; if (!isNaN(prev)) jmp = Math.max(jmp, Math.abs(ds[j2] - prev)); } else gap = Math.max(gap, ++run);
          prev = ds[j2];
        }
        /* وفجوةٌ متّصلة بلا حافّة أطول من خُمس الضلع (يدٌ تغطّي طرفه: يُستوفى خطّاً منكسراً) ⇒ مستقيم أيضاً */
        if (nOk < nIn * 0.6 || gap > nIn * 0.2 || jmp > Math.max(3, R * 0.3)) continue;
        /* لا دليل ⇒ استيفاءٌ من الجيران (والطرفان على الضلع نفسه) · ثمّ وسيطٌ ثلاثيّ يمحو نتوءاً منفرداً */
        var vals = [0].concat(ds, [0]);
        for (var a = 1; a < vals.length - 1; a++) if (isNaN(vals[a])) { var l = a - 1, r = a + 1; while (r < vals.length - 1 && isNaN(vals[r])) r++; for (var t = a; t < r; t++) vals[t] = vals[l] + (vals[r] - vals[l]) * (t - l) / (r - l); a = r - 1; }
        var sm = vals.slice(); for (a = 1; a < vals.length - 1; a++) { var m3 = [vals[a - 1], vals[a], vals[a + 1]].sort(function (p, q) { return p - q; }); sm[a] = m3[1]; }
        if (Math.max.apply(null, sm.map(Math.abs)) < eps) continue;       // مستقيمٌ عمليّاً
        for (a = 0; a < sm.length; a++) { var ff = a / ns; pts.push([A[0] + ux * ff + nx * sm[a], A[1] + uy * ff + ny * sm[a]]); }
        var keep = {}; dp(pts, 0, pts.length - 1, keep);
        /* نقطتان أقرب من ٦٪ من طول الضلع ⇒ واحدة (لا عنقود نقاطٍ عند ركن) */
        var last = A, minD = L * 0.06;
        for (a = 1; a < pts.length - 1; a++) if (keep[a] && Math.hypot(pts[a][0] - last[0], pts[a][1] - last[1]) >= minD && Math.hypot(pts[a][0] - B[0], pts[a][1] - B[1]) >= minD) { poly.push(pts[a]); last = pts[a]; }
      }
      return { poly: poly, ci: ci };
    }
    return { best: best, partial: findPartial, trace: trace, gap: gap, guard: best ? guard(best.q) : false, extraInk: extraInk, refine: refine, inkIn: inkIn, expand: expand, paperSep: paperSep, paperIn: paperIn, contains: function (big, small) { return contains({ q: big }, { q: small }); } };
  }

  /* توسيع الزوايا للخارج قليلاً كي لا يُقصّ طرف الورقة أبداً */
  function growPts(pts, f, W, H) {
    var cx = 0, cy = 0; pts.forEach(function (p) { cx += p[0] / pts.length; cy += p[1] / pts.length; });
    return pts.map(function (p) { return [Math.max(0, Math.min(W - 1, cx + (p[0] - cx) * (1 + f))), Math.max(0, Math.min(H - 1, cy + (p[1] - cy) * (1 + f)))]; });
  }
  function grow(q, f, W, H) {
    var cx = 0, cy = 0; q.forEach(function (p) { cx += p[0] / 4; cy += p[1] / 4; });
    return q.map(function (p) {
      var x = cx + (p[0] - cx) * (1 + f), y = cy + (p[1] - cy) * (1 + f);
      return [Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y))];
    });
  }

  /* ── ② تصحيح المنظور (هوموغرافيا) ─────────────────────────────────────── */
  function solve8(A, b) {
    var n = 8, i, j, k;
    for (i = 0; i < n; i++) {
      var mx = i; for (j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[mx][i])) mx = j;
      var t = A[i]; A[i] = A[mx]; A[mx] = t; t = b[i]; b[i] = b[mx]; b[mx] = t;
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (j = i + 1; j < n; j++) { var f = A[j][i] / A[i][i]; for (k = i; k < n; k++) A[j][k] -= f * A[i][k]; b[j] -= f * b[i]; }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) { var s = b[i]; for (j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
    return x;
  }
  /* من مستطيل الوجهة (w×h) إلى رباعيّ المصدر */
  function homography(w, h, q) {
    var src = [[0, 0], [w, 0], [w, h], [0, h]], A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], X = q[i][0], Y = q[i][1];
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); b.push(X);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); b.push(Y);
    }
    var s = solve8(A, b); if (!s) return null;
    return [s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], 1];
  }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function warp(srcCanvas, q, maxSide) {
    var w = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
    var k = Math.min(1, (maxSide || 2000) / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
    var Hm = homography(w, h, q); if (!Hm) throw new Error('تعذّر تصحيح المنظور');
    return sampleWarp(srcCanvas, 0, 0, Hm, 0, 0, w, h);
  }
  /* يملأ مستطيل الإخراج [bx, by, w×h] من النسخة المقوَّمة بالتحويل Hm (إخراج ⇒ إحداثيّات «العمل»)، والمصدر قماشٌ مبدؤه (ox, oy) منها */
  function sampleWarp(srcCanvas, ox, oy, Hm, bx, by, w, h) {
    var S = srcCanvas.getContext('2d').getImageData(0, 0, srcCanvas.width, srcCanvas.height), sd = S.data, SW = S.width, SH = S.height;
    var out = canvasOf(w, h), O = out.getContext('2d').createImageData(w, h), od = O.data;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var X9 = x + bx, Y9 = y + by, z = Hm[6] * X9 + Hm[7] * Y9 + 1, sx = (Hm[0] * X9 + Hm[1] * Y9 + Hm[2]) / z - ox, sy = (Hm[3] * X9 + Hm[4] * Y9 + Hm[5]) / z - oy;
        var o = (y * w + x) * 4;
        if (sx < 0 || sy < 0 || sx > SW - 1 || sy > SH - 1) { od[o] = od[o + 1] = od[o + 2] = 255; od[o + 3] = 255; continue; }
        var x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, x1 = Math.min(SW - 1, x0 + 1), y1 = Math.min(SH - 1, y0 + 1);
        var i00 = (y0 * SW + x0) * 4, i10 = (y0 * SW + x1) * 4, i01 = (y1 * SW + x0) * 4, i11 = (y1 * SW + x1) * 4;
        for (var c = 0; c < 3; c++) {
          od[o + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
        }
        od[o + 3] = 255;
      }
    }
    out.getContext('2d').putImageData(O, 0, 0);
    return out;
  }

  /* ── ③ التحسين: إضاءةٌ متجانسة (قسمة على الخلفية) · تباين · وضوح · أبيض وأسود ── */
  function boxBlur(a, w, h, r) {
    var t = new Float32Array(w * h), o = new Float32Array(w * h), x, y, s;
    for (y = 0; y < h; y++) { s = 0; for (x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (x = 0; x < w; x++) { t[y * w + x] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
    for (x = 0; x < w; x++) { s = 0; for (y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (y = 0; y < h; y++) { o[y * w + x] = s / (2 * r + 1); s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
    return o;
  }
  function enhance(cv, mode) {
    var w = cv.width, h = cv.height, ctx = cv.getContext('2d'), I = ctx.getImageData(0, 0, w, h), d = I.data;
    /* خلفيّة الإضاءة لكل قناة: تصغير ٨× ⇒ «إغلاق» يمحو الحبر (أقصى محلّي) ⇒ تنعيم */
    var sw = Math.max(8, Math.round(w / 8)), sh = Math.max(8, Math.round(h / 8));
    var small = canvasOf(sw, sh), sx = small.getContext('2d'); sx.drawImage(cv, 0, 0, sw, sh);
    var sd = sx.getImageData(0, 0, sw, sh).data, bg = [];
    /* خلفيّة إضاءةٍ واحدة (من الإضاءة لا من كل قناة) ⇒ معاملٌ واحد لكل بكسل ⇒ الألوان تبقى ألوانها
       (التجربة الأولى بقسمة كل قناة على خلفيّتها قلبت قلم المالك الأخضر زهرياً). */
    for (var c = 0; c < 1; c++) {
      var a = new Float32Array(sw * sh), m = new Float32Array(sw * sh), i, x, y;
      for (i = 0; i < sw * sh; i++) a[i] = 0.299 * sd[i * 4] + 0.587 * sd[i * 4 + 1] + 0.114 * sd[i * 4 + 2];
      var R = 3;                                               // أقصى محلّي (الحبر أغمق من الورق)
      for (y = 0; y < sh; y++) for (x = 0; x < sw; x++) {
        var mx = 0;
        for (var yy = Math.max(0, y - R); yy <= Math.min(sh - 1, y + R); yy++) for (var xx = Math.max(0, x - R); xx <= Math.min(sw - 1, x + R); xx++) { var v = a[yy * sw + xx]; if (v > mx) mx = v; }
        m[y * sw + x] = mx;
      }
      bg.push(boxBlur(boxBlur(m, sw, sh, 3), sw, sh, 3));
    }
    /* (TASK-0130) الخلفيّة بالاستيفاء الخطّيّ نفسه لكن بجداول مسبقة (لا حساب نِسَبٍ وقصٍّ لكل بكسل) · ومسارٌ واحدٌ للكسب والتباين معاً
       (المئين ٢٪ من عيّنة) · والوضوح على البيانات نفسها بلا قراءةٍ ثانية — النتيجة هي نفسها تقريباً و~٣× أسرع (كان ٢ث من «قصّ» على هاتفٍ متوسّط) */
    var B0 = bg[0], X0 = new Int32Array(w), TX = new Float32Array(w), x9, y9;
    for (x9 = 0; x9 < w; x9++) { var fx9 = Math.min(sw - 1.001, Math.max(0, x9 / w * sw - .5)); X0[x9] = fx9 | 0; TX[x9] = fx9 - X0[x9]; }
    function bgRow(Y, out) {
      var fy = Math.min(sh - 1.001, Math.max(0, Y / h * sh - .5)), y0 = fy | 0, ty = fy - y0, r0 = y0 * sw, r1 = r0 + sw;
      for (var X = 0; X < w; X++) { var x0 = X0[X], tx = TX[X], a0 = B0[r0 + x0], a1 = B0[r1 + x0]; out[X] = (a0 + (B0[r0 + x0 + 1] - a0) * tx) * (1 - ty) + (a1 + (B0[r1 + x0 + 1] - a1) * tx) * ty; }
    }
    var row = new Float32Array(w);
    /* توازن الأبيض: لون الورق = متوسّط ألوان البكسلات القريبة من خلفيّتها (الورق نفسه لا الحبر) — وعيّنة السطوع بعد الكسب للمئين */
    var wr = 0, wg = 0, wb = 0, wn = 0, p, Y, X, hist = new Uint32Array(256), hn = 0;
    for (Y = 0; Y < h; Y += 3) {
      bgRow(Y, row);
      for (X = (Y * 7) % 3; X < w; X += 3) {
        p = (Y * w + X) * 4; var bgv = row[X], l0 = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
        if (l0 > bgv * 0.9) { wr += d[p]; wg += d[p + 1]; wb += d[p + 2]; wn++; }
      }
    }
    var gr = 1, gg = 1, gb = 1;
    if (wn > 50) { var ml = (wr + wg + wb) / (3 * wn); gr = Math.min(1.35, Math.max(0.75, ml / (wr / wn))); gg = Math.min(1.35, Math.max(0.75, ml / (wg / wn))); gb = Math.min(1.35, Math.max(0.75, ml / (wb / wn))); }
    for (Y = 1; Y < h; Y += 3) {
      bgRow(Y, row);
      for (X = 1; X < w; X += 3) {
        p = (Y * w + X) * 4; var gn = 245 / Math.max(24, row[X]), r1 = d[p] * gn * gr, g1 = d[p + 1] * gn * gg, b1 = d[p + 2] * gn * gb;
        var l1 = 0.299 * (r1 > 255 ? 255 : r1) + 0.587 * (g1 > 255 ? 255 : g1) + 0.114 * (b1 > 255 ? 255 : b1); hist[l1 | 0]++; hn++;
      }
    }
    /* شدّ التباين: ٢٪ الأغمق ⇒ حبرٌ أسود، والورق أبيض — بلا قصّ للرماديّ الخفيف */
    var n = w * h, acc = 0, lo = 0;
    for (var t = 0; t < 256; t++) { acc += hist[t]; if (acc > hn * 0.02) { lo = t; break; } }
    lo = Math.min(lo, 120); var hi = 242, sc = 255 / Math.max(40, hi - lo), bw = mode === 'bw', L = bw ? new Uint8Array(n) : null, hist2 = bw ? new Uint32Array(256) : null;
    for (Y = 0; Y < h; Y++) {
      bgRow(Y, row);
      for (X = 0; X < w; X++) {
        p = (Y * w + X) * 4;
        var gain = 245 / Math.max(24, row[X]), r2 = d[p] * gain * gr, g2 = d[p + 1] * gain * gg, b2 = d[p + 2] * gain * gb;
        r2 = r2 > 255 ? 255 : r2; g2 = g2 > 255 ? 255 : g2; b2 = b2 > 255 ? 255 : b2;
        if (bw) { var lb = (0.299 * r2 + 0.587 * g2 + 0.114 * b2) | 0; L[Y * w + X] = lb; hist2[lb]++; continue; }
        var u = (r2 - lo) * sc; d[p] = u < 0 ? 0 : u > 255 ? 255 : u;
        u = (g2 - lo) * sc; d[p + 1] = u < 0 ? 0 : u > 255 ? 255 : u;
        u = (b2 - lo) * sc; d[p + 2] = u < 0 ? 0 : u > 255 ? 255 : u;
      }
    }
    if (bw) {
      /* الإضاءة صارت متجانسة (الورق ≈ ٢٤٥) ⇒ الحبر ما دون ~٧٠٪ من بياض الورق؛ أوتسو وحده كان ينجرّ نحو
         الطاولة الداكنة والقلم الملوّن فيُسوّد بقعاً كاملة (m01). العتبة بين ١٤٠ و١٧٥ تُبقي النصّ الباهت. */
      var th = Math.min(175, Math.max(140, otsu(hist2, n) + 10));
      for (p = 0; p < n; p++) { var bwv = L[p] < th ? 0 : 255; d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = bwv; }
    } else if (n < 6e6) {
      /* وضوحٌ خفيف (unsharp) للنسخة الملوّنة فقط */
      var bl = new Float32Array(n);
      for (p = 0; p < n; p++) bl[p] = 0.299 * d[p * 4] + 0.587 * d[p * 4 + 1] + 0.114 * d[p * 4 + 2];
      var B2 = boxBlur(bl, w, h, 1);
      for (p = 0; p < n; p++) { var dl = (bl[p] - B2[p]) * 0.6, q4 = p * 4, z2;
        z2 = d[q4] + dl; d[q4] = z2 < 0 ? 0 : z2 > 255 ? 255 : z2; z2 = d[q4 + 1] + dl; d[q4 + 1] = z2 < 0 ? 0 : z2 > 255 ? 255 : z2; z2 = d[q4 + 2] + dl; d[q4 + 2] = z2 < 0 ? 0 : z2 > 255 ? 255 : z2; }
    }
    ctx.putImageData(I, 0, 0);
    return cv;
  }

  /* (TASK-0131) محيطٌ متعدّد النقاط (poly: نقاطٌ مرتّبة · ci: مواضع الأركان الأربعة فيه: أعلى-يسار · أعلى-يمين · أسفل-يمين · أسفل-يسار).
     التقويم: التحويل المنظوريّ من الأركان يزيل منظور التصوير، ثمّ رقعة «كونز» بين الحواف الأربع كما تظهر بعده تمطّ كل سطرٍ إلى مكانه:
     الحافّة المنحنية تصير مستقيمة والمحتوى بين الحواف يتبعها (لا مستطيلٌ تقريبيّ يقصّ طرف الورقة المنتفخ أو يُدخل خلفيّتها). */
  function inv3(m) {
    var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C; if (Math.abs(det) < 1e-12) return null;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }
  function sidePath(poly, ci, z) { var a = ci[z], b = ci[(z + 1) % 4], out = [], i = a; for (var g = 0; g <= poly.length; g++) { out.push(poly[i]); if (i === b) break; i = (i + 1) % poly.length; } return out; }
  function pathLen(p) { var L = 0; for (var i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
  /* نقطةٌ على المسار عند نسبة طولٍ s ∈ [٠،١] */
  function atLen(p, s) {
    var L = pathLen(p), want = s * L, acc = 0;
    for (var i = 1; i < p.length; i++) { var l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (acc + l >= want || i === p.length - 1) { var t = l ? Math.min(1, Math.max(0, (want - acc) / l)) : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t]; } acc += l; }
    return p[p.length - 1];
  }
  function warpPoly(src, poly, ci, maxSide) {
    var Q = [0, 1, 2, 3].map(function (z) { return poly[ci[z]]; });
    var top = sidePath(poly, ci, 0), right = sidePath(poly, ci, 1), bottom = sidePath(poly, ci, 2).slice().reverse(), left = sidePath(poly, ci, 3).slice().reverse();
    var w = Math.max(pathLen(top), pathLen(bottom)), h = Math.max(pathLen(left), pathLen(right)), k = Math.min(1, (maxSide || 2000) / Math.max(w, h));
    w = Math.max(8, Math.round(w * k)); h = Math.max(8, Math.round(h * k));
    var H1 = homography(1, 1, Q), Hi = H1 && inv3(H1); if (!Hi) throw new Error('تعذّر تصحيح المنظور');
    var toR = function (p) { var z = Hi[6] * p[0] + Hi[7] * p[1] + Hi[8]; return [(Hi[0] * p[0] + Hi[1] * p[1] + Hi[2]) / z, (Hi[3] * p[0] + Hi[4] * p[1] + Hi[5]) / z]; };
    var T = top.map(toR), Bt = bottom.map(toR), Lf = left.map(toR), Rt = right.map(toR);
    var cT = new Float64Array(2 * w), cB = new Float64Array(2 * w), cL = new Float64Array(2 * h), cR = new Float64Array(2 * h), x, y, q;
    for (x = 0; x < w; x++) { var sx = (x + 0.5) / w; q = atLen(T, sx); cT[2 * x] = q[0]; cT[2 * x + 1] = q[1]; q = atLen(Bt, sx); cB[2 * x] = q[0]; cB[2 * x + 1] = q[1]; }
    for (y = 0; y < h; y++) { var ty = (y + 0.5) / h; q = atLen(Lf, ty); cL[2 * y] = q[0]; cL[2 * y + 1] = q[1]; q = atLen(Rt, ty); cR[2 * y] = q[0]; cR[2 * y + 1] = q[1]; }
    var S = src.getContext('2d').getImageData(0, 0, src.width, src.height), sd = S.data, SW = S.width, SH = S.height;
    var out = canvasOf(w, h), O = out.getContext('2d').createImageData(w, h), od = O.data;
    for (y = 0; y < h; y++) {
      var t = (y + 0.5) / h, lx = cL[2 * y], ly = cL[2 * y + 1], rx = cR[2 * y], ry = cR[2 * y + 1];
      for (x = 0; x < w; x++) {
        var s2 = (x + 0.5) / w;
        var u = (1 - t) * cT[2 * x] + t * cB[2 * x] + (1 - s2) * lx + s2 * rx - s2, v = (1 - t) * cT[2 * x + 1] + t * cB[2 * x + 1] + (1 - s2) * ly + s2 * ry - t;
        var zz = H1[6] * u + H1[7] * v + 1, px = (H1[0] * u + H1[1] * v + H1[2]) / zz, py = (H1[3] * u + H1[4] * v + H1[5]) / zz, o = (y * w + x) * 4;
        if (px < 0 || py < 0 || px > SW - 1 || py > SH - 1) { od[o] = od[o + 1] = od[o + 2] = 255; od[o + 3] = 255; continue; }
        var x0 = px | 0, y0 = py | 0, fx = px - x0, fy = py - y0, x1 = Math.min(SW - 1, x0 + 1), y1 = Math.min(SH - 1, y0 + 1);
        var i00 = (y0 * SW + x0) * 4, i10 = (y0 * SW + x1) * 4, i01 = (y1 * SW + x0) * 4, i11 = (y1 * SW + x1) * 4;
        for (var c = 0; c < 3; c++) od[o + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
        od[o + 3] = 255;
      }
    }
    out.getContext('2d').putImageData(O, 0, 0);
    return out;
  }
  /* التقويم وحده (بلا تحسين): منظوريٌّ من أربع زوايا، أو «كونز» لمحيطٍ متعدّد النقاط */
  function warpOnly(img, corners, rot, shape) {
    var work = drawScaled(img, WORK_MAX, rot), sc = function (p) { return [p[0] * work.width, p[1] * work.height]; };
    return shape && shape.poly && shape.poly.length > 4 && shape.ci ? warpPoly(work, shape.poly.map(sc), shape.ci, 2000) : warp(work, corners.map(sc), 2000);
  }
  /* (TASK-0131) أنماط النسخة النهائيّة — كلّها من النسخة المقوَّمة نفسها، والأصل محفوظ (لا يُفقد شيءٌ بتبديل النمط):
     orig الأصل مقوَّماً بلا تحسين · color تلقائي (إزالة الظلّ + تباين + وضوح) · magic ألوانٌ زاهية وخلفيّةٌ بيضاء · gray رماديّ · bw أبيض وأسود */
  var MODES = ['orig', 'color', 'magic', 'gray', 'bw'];
  function applyMode(base, mode) {
    var c = canvasOf(base.width, base.height); c.getContext('2d').drawImage(base, 0, 0);
    if (mode === 'orig') return c;
    if (mode === 'bw') return enhance(c, 'bw');
    enhance(c, 'color');
    if (mode !== 'gray' && mode !== 'magic') return c;
    var x = c.getContext('2d'), I = x.getImageData(0, 0, c.width, c.height), d = I.data;
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2], l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (mode === 'gray') { d[i] = d[i + 1] = d[i + 2] = l; continue; }
      /* «ألوان»: تشبّعٌ ×١٫٤ للحبر الملوّن والأختام · ورقٌ قريبٌ من الأبيض ⇐ أبيض */
      if (l > 215 && Math.max(r, g, b) - Math.min(r, g, b) < 40) { d[i] = d[i + 1] = d[i + 2] = 255; continue; }
      var k = 1.4; r = l + (r - l) * k; g = l + (g - l) * k; b = l + (b - l) * k;
      d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    x.putImageData(I, 0, 0);
    return c;
  }
  function process(img, corners, rot, mode, shape) {
    var out = warpOnly(img, corners, rot, shape);
    return mode === 'color' || mode === 'bw' ? enhance(out, mode) : applyMode(out, mode || 'color');
  }
  /* (TASK-0130) هندسة النسخة المقوَّمة كما يصنعها process (بلا تدوير): أبعادها w×h والتحويل إليها — دون صنعها */
  function rectGeom(img, corners) {
    var IW = img.naturalWidth || img.width, IH = img.naturalHeight || img.height, k0 = Math.min(1, WORK_MAX / Math.max(IW, IH));
    var WW = Math.max(1, Math.round(IW * k0)), WH = Math.max(1, Math.round(IH * k0));
    var q = corners.map(function (p) { return [p[0] * WW, p[1] * WH]; });
    var w = Math.max(dist(q[0], q[1]), dist(q[3], q[2])), h = Math.max(dist(q[0], q[3]), dist(q[1], q[2])), k = Math.min(1, 2000 / Math.max(w, h));
    return { k0: k0, WW: WW, WH: WH, q: q, w: Math.round(w * k), h: Math.round(h * k) };
  }
  /* (TASK-0130) جزءٌ واحد من النسخة المقوَّمة المحسَّنة (box = [x0, y0, x1, y1] نِسَبٌ منها · بلا تدوير): يُرسم من الأصل ما يقع تحته
     فقط ويُقوَّم ويُحسَّن وحده. خانة «المصدر» (≈خُمس الإيصال) تُقرأ لحظة اكتشاف الحدود — كانت تنتظر النسخة الكاملة (~٢ث على هاتفٍ متوسّط) */
  function processBox(img, corners, box, mode) {
    var G = rectGeom(img, corners), Hm = homography(G.w, G.h, G.q); if (!Hm) throw new Error('تعذّر تصحيح المنظور');
    var bx0 = Math.max(0, Math.round(box[0] * G.w)), by0 = Math.max(0, Math.round(box[1] * G.h));
    var bw = Math.max(8, Math.min(G.w, Math.round(box[2] * G.w)) - bx0), bh = Math.max(8, Math.min(G.h, Math.round(box[3] * G.h)) - by0);
    var xs = [], ys = [];
    [[bx0, by0], [bx0 + bw, by0], [bx0 + bw, by0 + bh], [bx0, by0 + bh]].forEach(function (p) {
      var z = Hm[6] * p[0] + Hm[7] * p[1] + 1; xs.push((Hm[0] * p[0] + Hm[1] * p[1] + Hm[2]) / z); ys.push((Hm[3] * p[0] + Hm[4] * p[1] + Hm[5]) / z);
    });
    var sx0 = Math.max(0, Math.floor(Math.min.apply(null, xs)) - 2), sy0 = Math.max(0, Math.floor(Math.min.apply(null, ys)) - 2);
    var sx1 = Math.min(G.WW, Math.ceil(Math.max.apply(null, xs)) + 3), sy1 = Math.min(G.WH, Math.ceil(Math.max.apply(null, ys)) + 3);
    var src = canvasOf(Math.max(2, sx1 - sx0), Math.max(2, sy1 - sy0));
    if (sx1 - sx0 >= 2 && sy1 - sy0 >= 2) src.getContext('2d').drawImage(img, sx0 / G.k0, sy0 / G.k0, (sx1 - sx0) / G.k0, (sy1 - sy0) / G.k0, 0, 0, sx1 - sx0, sy1 - sy0);
    return enhance(sampleWarp(src, sx0, sy0, Hm, bx0, by0, bw, bh), mode);
  }
  /* الترتيب (TASK-0123): ① خطوطٌ قويّة على الأضلاع الأربعة (درجة ≥٠٫٧ وأضعف تباين ≥٠٫٧) ⇒ تُعتمد (ما لم تجد الطريقة ①
     منطقةً أكبر بكثير تحويها) ⇒ ② وإلّا الطريقة ① (المنطقة الفاتحة) إن نجحت ⇒ ③ وإلّا خطوطٌ أضعف (≥٠٫٦) إن مرّت بحارس القصّ ⇒ ④ ورقةٌ تملأ الصورة ⇒ الصورة كاملة ⇒ ⑤ الصورة كاملة
     لتحدّدها بيدك. وفي ①②③ يُلصق كل ضلعٍ على الحدّ الحقيقي القريب، والتوسيع للخارج ٠٫٥٪ فقط (كان ١٫٥٪ على حدودٍ تقريبيّة
     فيُبقي شرائط خلفيّة — لقطة المالك) و١٫٥٪ إن بقي ضلعٌ بلا لصق. */
  /* (TASK-0134) عدّة أوراق في صورةٍ واحدة: ما مُسح منها (exclude = [{ poly, rot }] نِسَبٌ في الاتّجاه نفسه) يُطلى بلون الخلفيّة
     (متوسّط أركان الصورة الأربعة) موسَّعاً قليلاً ⇒ الاكتشاف يجد الورقة التالية لا نفسها مرّةً ثانية */
  function hideDone(c, rot, exclude) {
    var ex = (exclude || []).filter(function (e) { return e && e.poly && e.poly.length >= 3 && (e.rot || 0) === (rot || 0); });
    if (!ex.length) return;
    var x = c.getContext('2d'), W = c.width, H = c.height, k = Math.max(4, Math.round(Math.min(W, H) * 0.03)), sum = [0, 0, 0], n = 0;
    x.setTransform(1, 0, 0, 1, 0, 0);                                     // drawScaled تركت إزاحة التدوير على السياق
    [[0, 0], [W - k, 0], [0, H - k], [W - k, H - k]].forEach(function (o) { var d = x.getImageData(o[0], o[1], k, k).data; for (var i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; n++; } });
    x.fillStyle = 'rgb(' + Math.round(sum[0] / n) + ',' + Math.round(sum[1] / n) + ',' + Math.round(sum[2] / n) + ')';
    ex.forEach(function (e) {
      var P = growPts(e.poly.map(function (p) { return [p[0] * W, p[1] * H]; }), e.grow == null ? 0.04 : e.grow, W * 3, H * 3);
      x.beginPath(); P.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.closePath(); x.fill();
    });
  }
  function detectNorm(img, rot, exclude, depth) {
    var c = drawScaled(img, DET_MAX, rot), W = c.width, H = c.height;
    hideDone(c, rot, exclude);
    var id = c.getContext('2d').getImageData(0, 0, W, H);
    var lq = lineQuad(id), b = lq.best, q = null, how = '', old = null, rf, sep;
    if (b && b.score >= 0.7 && b.minc >= 0.7) {
      rf = lq.refine(b.q); how = 'lines';
      /* لا قصّ: الطريقة ① وجدت منطقةً أكبر بكثير (×١٫٣٥) تحوي الخطوط، وفي الزيادة حبر (نصّ · رموز: كثافة ≥٤٪) ⇒ الخطوط قطعت
         جزءاً من الورقة (حدٌّ بين ترويسةٍ بيضاء وجدولٍ ملوّن في إيصالٍ مطبوع بالألوان، ويدٌ تغطّي الحدّ الحقيقي) ⇒ المنطقة الأكبر.
         زيادةٌ بلا حبر (رزمة أوراقٍ بيضاء بجانب الإيصال: ١–٢٪) ⇒ تبقى الخطوط. في التجربة: القصّ ٨–٢٢٪ · الرزمة ≤٢٫٣٪. */
      old = detect(id);
      if (old.ok && !old.fill && polyArea(old.corners) >= polyArea(b.q) * 1.35 && lq.contains(old.corners, b.q) && lq.extraInk(old.corners, b.q) >= 0.04) { rf = lq.refine(old.corners); how = 'region'; }
    }
    /* (TASK-0130 · صور المالك الحقيقيّة) إيصالٌ ممسوكٌ باليد فوق خلفيّةٍ داكنة وحدُّه عند إطار الصورة أو بجانبه إيصالٌ آخر: الخطوط وجدت
       حدوده بدقّة (درجةٌ متوسّطة لأنّ ضلعاً على الإطار) لكنّها رُفضت، فالمنطقة ضمّت الإيصال المجاور (لا قصّ) أو لم يُكتشف شيء.
       الدليل: داخل الرباعيّ ورقٌ كلّه تقريباً (≥٧٨٪) وخارجه لا ورق تقريباً (≤٧٪) ⇒ هو الورقة كلّها — ما لم تكن المنطقة أدقّ:
       تُقدَّم الخطوط فقط إن فشلت المنطقة، أو كان ما تزيده المنطقةُ عليها ليس ورقاً (<٥٠٪: خلفيّةٌ وإيصالٌ مجاور) وما تزيده هي ورقاً.
       خطوطٌ أوسع من الورقة (عروق خشبٍ موازية لحدّها) ⇒ ما تزيده ليس ورقاً ⇒ المنطقة كما كانت */
    else if (b && b.score >= 0.45 && (sep = lq.paperSep(b.q)).pin >= 0.78 && sep.pout <= 0.07 &&
             (!(old = detect(id)).ok || old.fill || (lq.paperIn(old.corners, b.q) < 0.5 && lq.paperIn(b.q, old.corners) >= 0.5))) { rf = lq.refine(b.q); how = 'lines'; }
    /* (TASK-0125) اختير الأكبر لأنّ حبر الإيصال يمتدّ إليه ⇒ يُقدَّم على المنطقة التقريبيّة إن كانت داخله وأصغر منه بوضوح (≤٨٥٪)
       وفي الفرق حبرٌ بكثافة حبرها تقريباً (≥٧٠٪ · خطوط البلاط أقلّ) ⇒ المنطقة قصّت الإيصال. منطقةٌ تخرج عنه ⇒ الخطوط خاطئة (يدٌ فوق الورقة) ⇒ المنطقة. */
    else if (b && b.inky && b.score >= 0.45 && (!(old = detect(id)).ok || old.fill ||
             (lq.contains(b.q, old.corners) && polyArea(old.corners) <= polyArea(b.q) * 0.85 && lq.inkIn(b.q, old.corners) >= lq.inkIn(old.corners, null) * 0.7))) { rf = lq.refine(b.q); how = 'lines'; }
    else if ((old = old || detect(id)).ok && !old.fill) { rf = lq.refine(old.corners); how = 'region'; }
    else if (b && (b.score >= 0.6 || (b.inky && b.score >= 0.45)) && lq.guard) { rf = lq.refine(b.q); how = 'lines'; }   // inky: اختير لأنّ حبر الإيصال يمتدّ إليه
    var pt = !rf && lq.partial();
    if (pt) { rf = lq.refine(pt.q); how = 'partial'; }   // (TASK-0125) بدل «الصورة كاملة»: ورقةٌ تتجاوز الإطار
    if (rf) { var ex = lq.expand(rf.q); if (ex) { rf = lq.refine(ex); how += '+expand'; } }
    /* (TASK-0134) ورقتان في رباعيٍّ واحد ⇒ تُخفى الصغرى ويُعاد الاكتشاف (حتى ثلاث أوراق) */
    if (rf && (depth || 0) < 2) {
      var gp = lq.gap(rf.q);
      if (gp) { var dr = detectNorm(img, rot, (exclude || []).concat([{ poly: gp.drop.map(function (p) { return [p[0] / W, p[1] / H]; }), rot: rot || 0, grow: 0 }]), (depth || 0) + 1); if (dr.ok) { dr.how += '+split'; return dr; } }
    }
    var tr = null;
    if (rf) {
      var gf = rf.snapped === 4 ? 0.005 : 0.015;
      q = grow(order(rf.q), gf, W, H);
      try { tr = lq.trace(rf.q); } catch (_) { tr = null; }
      if (tr && tr.poly.length > 4) { var gq = growPts(tr.poly, gf, W, H); tr = { poly: gq, ci: tr.ci }; tr.ci.forEach(function (ix, j) { tr.poly[ix] = q[j].slice(); }); if (!simple(tr.poly)) tr = null; } else tr = null;
    }
    else if (old && old.fill) { q = old.corners; how = 'fill'; }
    var norm = function (qq) { return qq.map(function (p) { return [Math.max(0, Math.min(1, p[0] / W)), Math.max(0, Math.min(1, p[1] / H))]; }); };
    if (q) return { corners: norm(q), poly: tr ? norm(tr.poly) : null, ci: tr ? tr.ci : null, ok: true, why: old && old.fill ? old.why : '', how: how + (tr ? '+curve' + tr.poly.length : ''), diag: old && old.diag };
    var r = old || detect(id);
    return { corners: norm([[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]]), ok: false, why: r.why || 'لم تتميّز الورقة عن الخلفية', how: 'none', diag: r.diag };
  }

  /* ── (TASK-0131) هندسة المحيط متعدّد النقاط ─────────────────────────────── */
  function signedArea(P) { var s = 0; for (var i = 0; i < P.length; i++) { var a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function segX(a, b, c, d) {
    function o(p, q, r) { var v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return v > 1e-12 ? 1 : v < -1e-12 ? -1 : 0; }
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  }
  /* محيطٌ لا يقطع نفسه */
  function simple(P) {
    var n = P.length;
    for (var i = 0; i < n; i++) for (var j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return false; }
    return true;
  }
  /* اتّجاهٌ واحد دائماً (أعلى-يسار ⇐ أعلى-يمين ⇐ أسفل-يمين ⇐ أسفل-يسار في إحداثيّات الشاشة) */
  function normPoly(P) { return signedArea(P) < 0 ? P.slice().reverse() : P.slice(); }
  /* أركان المستند الأربعة من نقاط المحيط: أكبر رباعيٍّ رؤوسه منها (بترتيبها)، والأوّل أقربها إلى أعلى-يسار */
  function cornersOf(P) {
    var n = P.length, bi = [0, 1, 2, 3], best = -1, i, j, k, l;
    if (n > 4 && n <= 64) {
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) for (k = j + 1; k < n; k++) for (l = k + 1; l < n; l++) {
        var a = P[i], b = P[j], c = P[k], d = P[l], ar = Math.abs((a[0] * b[1] - b[0] * a[1]) + (b[0] * c[1] - c[0] * b[1]) + (c[0] * d[1] - d[0] * c[1]) + (d[0] * a[1] - a[0] * d[1]));
        if (ar > best) { best = ar; bi = [i, j, k, l]; }
      }
    } else if (n > 64) {                                            // كثيرة جداً ⇒ الأقرب إلى أركان الإطار المحيط
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; P.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
      bi = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(function (c) { var m = 0, md = 1e9; P.forEach(function (p, q) { var dd = Math.hypot(p[0] - c[0], p[1] - c[1]); if (dd < md) { md = dd; m = q; } }); return m; });
      if (new Set(bi).size < 4) bi = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4)];
      bi.sort(function (p, q) { return p - q; });
    }
    var t = 0, mm = Infinity; bi.forEach(function (ix, q) { var s = P[ix][0] + P[ix][1]; if (s < mm) { mm = s; t = q; } });
    return [bi[t], bi[(t + 1) % 4], bi[(t + 2) % 4], bi[(t + 3) % 4]];
  }
  /* حالة الاكتشاف كما تُعرض: اكتُشفت (أخضر) · راجعها (كهرماني) · تعذّر (أحمر). كان الإطار أحمرَ دائماً مهما كانت النتيجة — اللون لم يكن يعني شيئاً */
  function statusOf(det) {
    if (!det || !det.ok) return { k: 'fail', col: '#ef4444', txt: '❌ تعذّر اكتشاف الورقة — ارسم حدودها بنفسك (✏️ رسم الحدود) أو اسحب النقاط إلى أطرافها' };
    var h = String(det.how || '');
    if (/^fill/.test(h)) return { k: 'review', col: '#f59e0b', txt: '⚠️ راجع الحدود: الورقة تملأ الصورة تقريباً' };
    if (/^partial/.test(h)) return { k: 'review', col: '#f59e0b', txt: '⚠️ راجع الحدود: جزءٌ من الورقة خارج الصورة' };
    return { k: 'ok', col: '#22c55e', txt: '✅ اكتُشفت الورقة' + (det.poly ? ' · حوافّ منحنية (' + det.poly.length + ' نقطة)' : '') };
  }

  /* ── ④ الواجهة ───────────────────────────────────────────────────────────── */
  var PADS = 24;                                                         // هامش الصورة داخل مساحتها: يتّسع لمقبضٍ على حافّتها
  function css() {
    if (doc.getElementById('gds-css')) return;
    var st = doc.createElement('style'); st.id = 'gds-css';
    st.textContent =
      '#gds{position:fixed;inset:0;z-index:2147482500;background:#0b0d10;color:#fff;display:flex;flex-direction:column;direction:rtl;font-family:inherit}' +
      '#gds .gds-top{display:flex;align-items:center;gap:8px;padding:8px 12px 4px;font-weight:900;font-size:15px}' +
      '#gds .gds-top small{font-weight:700;color:#9aa3ae;font-size:12px}' +
      '#gds .gds-tools{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;padding:2px 8px 6px}' +
      '#gds .gds-tools button{padding:7px 9px;font-size:12px;border-radius:10px}' +
      /* (TASK-0135 · المالك: «أحد أطراف الخطوط خارج الإطار فما فيني أمسك المقبض») الصورة تُقاس على المساحة الفعليّة بين الأزرار (كانت
         من ارتفاع الشاشة كلّه فيختفي طرفها السفلي تحتها) · هامشٌ حولها يتّسع للمقبض كاملاً · المقابض خارج القصّ (لا تُقصّ مع الصورة) */
      '#gds .gds-stage{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;padding:' + PADS + 'px;touch-action:none;overflow:hidden}' +
      '#gds .gds-wrap{position:relative;touch-action:none}' +
      '#gds .gds-clip{position:relative;overflow:hidden;border-radius:6px}' +
      '#gds canvas.gds-img{display:block;max-width:none;background:#222;transform-origin:0 0}' +
      '#gds .gds-clip>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}' +   /* لا تلمس أيقونات الأزرار (gmt-icons) — كانت تتضخّم ملء الشاشة */
      '#gds .gds-h{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(255,255,255,.18);border:3px solid var(--gds-c,#22c55e);touch-action:none;cursor:grab;box-sizing:border-box}' +
      '#gds .gds-h.x{width:22px;height:22px;margin:-11px 0 0 -11px;border-width:3px}' +
      '#gds .gds-h::before,#gds .gds-g::before{content:"";position:absolute;inset:-10px;border-radius:50%}' +   /* مساحة لمسٍ ≥٤٤ بكسل */
      '#gds .gds-h.sel{background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.35)}' +
      '#gds .gds-g{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:rgba(0,0,0,.45);border:2px dashed rgba(255,255,255,.75);color:#fff;font:900 13px/16px sans-serif;text-align:center;touch-action:none;cursor:copy;box-sizing:border-box}' +
      '#gds .gds-loupe{position:absolute;width:120px;height:120px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.6);pointer-events:none;display:none;overflow:hidden;background:#000}' +
      '#gds .gds-msg{min-height:20px;text-align:center;font-size:12.5px;font-weight:800;color:#fbbf24;padding:0 12px}' +
      '#gds .gds-bar{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:8px 10px calc(10px + env(safe-area-inset-bottom))}' +
      '#gds button{font:inherit;font-weight:900;font-size:13px;border-radius:12px;padding:10px 12px;border:1px solid #2a2f37;background:#1a1e24;color:#fff;cursor:pointer}' +
      '#gds button.p{background:#D5001C;border-color:#D5001C}#gds button.on{background:#fff;color:#111}' +
      '#gds button:disabled{opacity:.45}';
    (doc.head || doc.documentElement).appendChild(st);
  }

  function open(file, opts) {
    opts = opts || {};
    css();
    return loadImg(file).then(function (img) {
      return new Promise(function (resolve) {
        /* (TASK-0123) الاكتشاف بالخطوط أثقل (≈١ث على هاتفٍ متوسّط): النافذة تظهر فوراً بالصورة، والحدود «تُلصق» بعد لحظة.
           لمستَ نقطةً قبلها ⇒ اختيارك يبقى · ضغطتَ «قصّ» قبلها ⇒ يُكمَل الاكتشاف أوّلاً. */
        var rot = 0, det = { corners: [[0, 0], [1, 0], [1, 1], [0, 1]], ok: true, why: '', how: '' }, mode = 'color', view = 'edit', result = null, busy = false;
        var pending = 0, touched = false, reported = false;
        /* (TASK-0131) المحيط: نقاطٌ بعددٍ متغيّر P (نِسَبٌ من الصورة المعروضة، مرتّبة) وأركانه الأربعة CI (مواضعها في P).
           أربع نقاط = الورقة المستقيمة كما كانت · أكثر ⇒ حوافٌّ منحنية تُقوَّم برقعة «كونز». corners (للمستدعين) = الأركان الأربعة. */
        var P = [[0, 0], [1, 0], [1, 1], [0, 1]], CI = [0, 1, 2, 3], undo = [], redo = [], sel = -1, drawing = null;
        function snap() { return { P: P.map(function (p) { return p.slice(); }), CI: CI.slice() }; }
        function push() { undo.push(snap()); if (undo.length > 80) undo.shift(); redo = []; }
        function restore(s) { P = s.P.map(function (p) { return p.slice(); }); CI = s.CI.slice(); sel = -1; }
        function corners() { return CI.map(function (i) { return P[i].slice(); }); }
        function shape() { return P.length > 4 ? { poly: P.map(function (p) { return p.slice(); }), ci: CI.slice() } : null; }
        function setFromDet(d) {
          if (d.poly && d.ci) { P = d.poly.map(function (p) { return p.slice(); }); CI = d.ci.slice(); }
          else { P = d.corners.map(function (p) { return p.slice(); }); CI = [0, 1, 2, 3]; }
        }
        /* (TASK-0130) النسخة الممسوحة تُجهَّز في الخلفية لحظة الاكتشاف (وبعد كل تعديل) وأنت تراجع ⇒ «قصّ وتحسين» و«اعتماد» فوريّان
           إن لم يتغيّر المحيط، والقراءة المبكرة تأخذها (opts.onProcessed) بدل معالجة الصورة مرّةً ثانية */
        var pre = null, preT = 0, base = null;
        function keyOf(m) { return JSON.stringify([P, CI, rot, m || mode]); }
        function precompute(delay) {
          if (preT) clearTimeout(preT);
          preT = setTimeout(function () {
            preT = 0; if (view !== 'edit' || busy || pending || drawing) return;
            var k = keyOf(); if (pre && pre.key === k) return;
            var cs = corners(), sh = shape(), r0 = rot, m0 = mode;
            var done = function (Pp, cv) {
              Pp.cv = cv; Pp.cv.toBlob(function (bl) { Pp.blob = bl; }, 'image/jpeg', 0.9);
              if (opts.onProcessed && r0 === 0 && m0 === 'color') { try { opts.onProcessed(cv, cs); } catch (_) {} }
              return cv;
            };
            /* (TASK-0130) معالجٌ في خيطٍ آخر (opts.processor ⇒ وعدٌ بقماش أو null): المعالجة لا تحجز الواجهة ولا قراءة الفرع */
            if (opts.processor && (m0 === 'color' || m0 === 'bw')) {
              var Pw = { key: k, cv: null, blob: null, wait: null }; pre = Pw;
              var local = function () { return process(img, cs, r0, m0, sh); };
              Pw.wait = Promise.resolve().then(function () { return opts.processor(cs, r0, m0, img, sh); }).then(function (cv) { return cv || local(); }, local)
                .then(function (cv) { return done(Pw, cv); }).catch(function () { if (pre === Pw) pre = null; return null; });
              return;
            }
            try { var P0 = { key: k, cv: null, blob: null }; done(P0, process(img, cs, r0, m0, sh)); pre = P0; } catch (_) {}
          }, delay || 30);
        }
        function detectNow() { if (!pending) return; if (pending > 0) clearTimeout(pending); pending = 0; det = detectNorm(img, rot, opts.exclude); if (!touched) setFromDet(det); }
        function detectSoon() {
          if (pending > 0) clearTimeout(pending); touched = false; say('🔍 جارٍ اكتشاف حدود الورقة…');
          pending = setTimeout(function () {
            pending = -1; var before = snap(); detectNow(); if (!touched) { undo.push(before); redo = []; }
            if (view === 'edit') { paint(); showStatus(); }
            /* (TASK-0126) أوّل اكتشاف ⇒ يُبلَّغ المستدعي (نافذة الشحن تبدأ قراءة الرقم والفرع وأنت ما زلت في الماسح) */
            if (opts.onDetected && !reported) { reported = true; try { opts.onDetected({ corners: det.corners.map(function (p) { return p.slice(); }), poly: det.poly || null, ok: det.ok, how: det.how, img: img }, rot); } catch (_) {} }
            precompute(30);
          }, 60);
        }
        var root = doc.createElement('div'); root.id = 'gds'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
        root.innerHTML =
          '<div class="gds-top">📄 ' + (opts.title || 'مسح المستند') + ' <small id="gds-sub"></small></div>' +
          '<div class="gds-tools"></div>' +
          '<div class="gds-stage"><div class="gds-wrap"><div class="gds-clip"><canvas class="gds-img"></canvas><svg aria-hidden="true"><polygon fill="rgba(34,197,94,.12)" stroke="#22c55e" stroke-width="2" vector-effect="non-scaling-stroke"/><polyline fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="6 4"/></svg></div><div class="gds-loupe"><canvas width="120" height="120"></canvas></div></div></div>' +
          '<div class="gds-msg" role="status" aria-live="polite"></div>' +
          '<div class="gds-bar"></div>';
        doc.body.appendChild(root);
        var stage = root.querySelector('.gds-stage'), wrap = root.querySelector('.gds-wrap'), cv = root.querySelector('canvas.gds-img'), svg = root.querySelector('.gds-clip>svg');
        var polyEl = svg.querySelector('polygon'), lineEl = svg.querySelector('polyline'), loupe = root.querySelector('.gds-loupe'), lcv = loupe.querySelector('canvas');
        var msg = root.querySelector('.gds-msg'), bar = root.querySelector('.gds-bar'), tools = root.querySelector('.gds-tools'), sub = root.querySelector('#gds-sub');
        var handles = [], ghosts = [], st = statusOf(null), shown = null;
        function say(t, col) { msg.textContent = t || ''; msg.style.color = col || ''; }   // الحالة بلونها (أخضر/كهرماني/أحمر) · غيرها كهرماني
        function btn(label, fn, cls, where) { var b = doc.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.addEventListener('click', fn); (where || bar).appendChild(b); return b; }
        function finish(v) { root.remove(); doc.removeEventListener('keydown', onKey, true); global.removeEventListener('resize', onResize); resolve(v); }
        function onKey(e) {
          if (e.key === 'Escape') { e.preventDefault(); if (drawing) cancelDraw(); else finish(null); return; }
          if (view !== 'edit') return;
          if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
          else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); doRedo(); }
          else if ((e.key === 'Delete' || e.key === 'Backspace') && sel >= 0 && !/input|textarea/i.test((e.target && e.target.tagName) || '')) { e.preventDefault(); delPoint(); }
        }
        /* الكاميرا تُفتح من داخل ضغطة الزرّ نفسها (المتصفّحات تمنع فتحها خارج لمسة المستخدم) */
        function retake() { try { if (opts.onRetake) opts.onRetake(); } catch (_) {} finish({ retake: true }); }
        doc.addEventListener('keydown', onKey, true);

        /* ── التكبير والتحريك: الصورة وحدها تُكبَّر (CSS transform)، والنقاط فوقها بحجمها الثابت ── */
        var z = 1, tx = 0, ty = 0;
        /* الصورة بأكبر حجمٍ يتّسع في المساحة بين الأزرار (بعد بنائها) — لا من ارتفاع الشاشة */
        function fitCanvas() {
          var sw = stage.clientWidth - 2 * PADS, sh = stage.clientHeight - 2 * PADS;
          if (sw < 40 || sh < 40 || !cv.width) return;
          var k = Math.min(sw / cv.width, sh / cv.height);
          cv.style.width = Math.max(1, Math.floor(cv.width * k)) + 'px'; cv.style.height = Math.max(1, Math.floor(cv.height * k)) + 'px';
        }
        function cw() { return cv.offsetWidth || 1; }
        function ch() { return cv.offsetHeight || 1; }
        function clampPan() { var W = cw(), H = ch(); tx = Math.min(0, Math.max(W - W * z, tx)); ty = Math.min(0, Math.max(H - H * z, ty)); }
        function applyZoom() { clampPan(); cv.style.transform = z === 1 ? '' : 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')'; paint(); }
        function zoomAt(nz, px, py) { nz = Math.max(1, Math.min(6, nz)); var k = nz / z; tx = px - (px - tx) * k; ty = py - (py - ty) * k; z = nz; applyZoom(); }
        function toScr(p) { return [tx + p[0] * cw() * z, ty + p[1] * ch() * z]; }
        function fromEv(e) { var r = wrap.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left - tx) / (cw() * z))), Math.max(0, Math.min(1, (e.clientY - r.top - ty) / (ch() * z)))]; }
        function local(e) { var r = wrap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

        /* ── المكبّرة: أثناء سحب نقطة تظهر منطقتها مكبَّرة فوق الإصبع (الحافّة تحت الإصبع لا تُرى) ── */
        function showLoupe(p) {
          var s = toScr(p), W = cw(), lc = lcv.getContext('2d'), sx = p[0] * cv.width, sy = p[1] * cv.height, R = cv.width / W * 22 / Math.max(1, z * 0.6);
          lc.fillStyle = '#000'; lc.fillRect(0, 0, 120, 120);
          lc.drawImage(cv, sx - R, sy - R, 2 * R, 2 * R, 0, 0, 120, 120);
          lc.strokeStyle = st.col; lc.lineWidth = 1.5; lc.beginPath(); lc.moveTo(60, 48); lc.lineTo(60, 72); lc.moveTo(48, 60); lc.lineTo(72, 60); lc.stroke();
          var lx = s[0] - 60, ly = s[1] - 150; if (ly < 4) ly = s[1] + 40; lx = Math.max(4, Math.min(wrap.clientWidth - 124, lx));
          loupe.style.left = lx + 'px'; loupe.style.top = ly + 'px'; loupe.style.display = 'block';
        }
        function hideLoupe() { loupe.style.display = 'none'; }

        function paint() {
          if (view !== 'edit') return;
          var pts = P.map(toScr), col = drawing ? '#fbbf24' : st.col;
          root.style.setProperty('--gds-c', col);
          if (drawing) {
            polyEl.setAttribute('points', ''); lineEl.setAttribute('points', pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '));
          } else {
            lineEl.setAttribute('points', '');
            polyEl.setAttribute('points', pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '));
            polyEl.setAttribute('stroke', col); polyEl.setAttribute('fill', col === '#ef4444' ? 'rgba(239,68,68,.10)' : col === '#f59e0b' ? 'rgba(245,158,11,.10)' : 'rgba(34,197,94,.12)');
          }
          /* نقاطٌ بعدد المحيط: الأركان الأربعة كبيرة، الإضافيّة أصغر، والمحدّدة بيضاء */
          while (handles.length < P.length) handles.push(mkHandle());
          while (handles.length > P.length) handles.pop().remove();
          var inView = function (q) { return z === 1 || (q[0] >= -2 && q[1] >= -2 && q[0] <= cw() + 2 && q[1] <= ch() + 2); };   // مكبَّرة: ما خرج عن المعروض يُخفى
          handles.forEach(function (h, i) { h.style.display = i === sel || inView(pts[i]) ? '' : 'none'; /* المسحوبة تبقى ظاهرة */ h.style.left = pts[i][0] + 'px'; h.style.top = pts[i][1] + 'px'; h.className = 'gds-h' + (CI.indexOf(i) < 0 || drawing ? ' x' : '') + (i === sel ? ' sel' : ''); h.setAttribute('data-i', i); });
          /* «+» في منتصف كل ضلع: اضغطه لإضافة نقطةٍ هناك (أو اسحبه مباشرةً) — يختفي على ضلعٍ قصيرٍ جداً على الشاشة */
          var want = drawing ? 0 : P.length;
          while (ghosts.length < want) ghosts.push(mkGhost());
          while (ghosts.length > want) ghosts.pop().remove();
          ghosts.forEach(function (g, i) {
            var a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
            g.style.display = L < 70 || !inView([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) ? 'none' : ''; g.style.left = (a[0] + b[0]) / 2 + 'px'; g.style.top = (a[1] + b[1]) / 2 + 'px'; g.setAttribute('data-i', i);
          });
          updTools();
        }
        function mkHandle() {
          var h = doc.createElement('div'); h.className = 'gds-h'; wrap.appendChild(h);
          h.addEventListener('pointerdown', function (e) {
            e.preventDefault(); e.stopPropagation();
            var i = +h.getAttribute('data-i');
            if (drawing && i === 0 && P.length >= 3) { closeDraw(); return; }         // الضغط على النقطة الأولى يُغلق المحيط
            dragPoint(i, e, h);
          });
          return h;
        }
        function mkGhost() {
          var g = doc.createElement('div'); g.className = 'gds-g'; g.textContent = '+'; wrap.appendChild(g);
          g.addEventListener('pointerdown', function (e) {
            e.preventDefault(); e.stopPropagation();
            var i = +g.getAttribute('data-i'), a = P[i], b = P[(i + 1) % P.length];
            push(); P.splice(i + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); CI = CI.map(function (c) { return c > i ? c + 1 : c; });
            touched = true; sel = i + 1; paint(); dragPoint(i + 1, e, handles[i + 1], true);
          });
          return g;
        }
        /* سحب نقطة: لا يُقبل موضعٌ يجعل المحيط يقطع نفسه (تبقى في آخر موضعٍ صالح) */
        function dragPoint(i, e, el, pushed) {
          var start = snap(), moved = false; sel = i; touched = true;
          try { el.setPointerCapture(e.pointerId); } catch (_) {}
          function mv(ev) {
            var p = fromEv(ev), old = P[i]; P[i] = p;
            if (!drawing && P.length > 3 && !simple(P)) P[i] = old; else moved = true;
            paint(); showLoupe(P[i]);
          }
          function up() {
            el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); hideLoupe();
            if (moved && !pushed) { undo.push(start); if (undo.length > 80) undo.shift(); redo = []; }
            if (!drawing && (moved || pushed)) { reCorner(); manual(); precompute(400); }
            paint();
          }
          el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
          showLoupe(P[i]); paint();
        }
        /* ركنٌ حُذف أو محيطٌ رُسم ⇒ الأركان الأربعة من جديد (أكبر رباعيٍّ من نقاطه) */
        function reCorner() { if (P.length >= 4 && signedArea(P) < 0) { P = normPoly(P); CI = cornersOf(P); } }
        /* أوّل تعديلٍ يدويّ ⇒ الحالة «حدودٌ حدّدتها بنفسك» (لا يبقى إطارٌ أحمر/كهرماني على حدودٍ صحّحتها) */
        function manual() { if (drawing || st.k === 'ok' || st.k === 'manual') return; st = { k: 'manual', col: '#22c55e', txt: '✋ حدودٌ حدّدتها بنفسك — اضغط «✔ قصّ وتحسين»' }; say(st.txt, st.col); }
        function delPoint() {
          if (drawing) { if (P.length) { push(); P.pop(); sel = -1; paint(); } return; }
          if (sel < 0 || P.length <= 4) { say(P.length <= 4 ? 'المحيط أربع نقاطٍ على الأقلّ — اسحب الركن بدل حذفه.' : 'اضغط نقطةً أوّلاً لتحديدها ثمّ «حذف».'); return; }
          push(); var wasCorner = CI.indexOf(sel) >= 0; P.splice(sel, 1);
          if (wasCorner || !simple(P)) CI = cornersOf(normPoly(P)), P = normPoly(P); else CI = CI.map(function (c) { return c > sel ? c - 1 : c; });
          sel = -1; touched = true; say(''); manual(); paint(); precompute(300);
        }
        function addPoint() {
          /* نقطةٌ في منتصف أطول ضلع (أو اضغط «+» على الضلع الذي تريده) */
          var bi = 0, bl = -1; for (var i = 0; i < P.length; i++) { var a = P[i], b = P[(i + 1) % P.length], L = Math.hypot((b[0] - a[0]) * cw(), (b[1] - a[1]) * ch()); if (L > bl) { bl = L; bi = i; } }
          push(); var a2 = P[bi], b2 = P[(bi + 1) % P.length]; P.splice(bi + 1, 0, [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2]); CI = CI.map(function (c) { return c > bi ? c + 1 : c; });
          sel = bi + 1; touched = true; manual(); paint(); precompute(300); say('أُضيفت نقطة (بيضاء) — اسحبها إلى حافّة الورقة.');
        }
        function doUndo() {
          if (drawing && undo.length <= drawing.u) { cancelDraw(); return; }                 // تراجعٌ قبل أوّل نقطةٍ مرسومة ⇒ خروجٌ من الرسم
          if (!undo.length) return; redo.push(snap()); restore(undo.pop()); touched = true; paint(); precompute(300);
        }
        function doRedo() { if (!redo.length) return; undo.push(snap()); restore(redo.pop()); touched = true; paint(); precompute(300); }
        /* ── الرسم اليدوي: اضغط حول الورقة نقطةً بعد نقطة، ثمّ النقطة الأولى أو «إغلاق المحيط» ── */
        function startDraw() {
          if (pending > 0) clearTimeout(pending); pending = 0;
          drawing = snap(); drawing.u = undo.length; redo = []; P = []; CI = [0, 1, 2, 3]; sel = -1; touched = true; showEdit(true);
          say('✏️ اضغط على حدود الورقة نقطةً بعد نقطة (حتى عند كل انحناء)، ثمّ اضغط النقطة الأولى أو «إغلاق المحيط». ↶ يلغي آخر نقطة.');
        }
        function closeDraw() {
          if (P.length < 4) { say('أضف ٤ نقاطٍ على الأقلّ.'); return; }
          var np = normPoly(P);
          if (!simple(np)) { say('❌ المحيط يقطع نفسه — حرّك النقاط أو ↶ ثمّ أعد.'); return; }
          /* تراجعٌ بعد الإغلاق ⇒ الحدود التي كانت قبل الرسم (لا نقاط الرسم واحدةً واحدة) */
          undo.length = drawing.u; undo.push({ P: drawing.P, CI: drawing.CI }); redo = [];
          P = np; CI = cornersOf(P); drawing = null; st = { k: 'manual', col: '#22c55e', txt: '✅ حدودٌ رسمتها بنفسك (' + P.length + ' نقطة) — اضغط «✔ قصّ وتحسين»' };
          showEdit(); precompute(30);
        }
        function cancelDraw() { if (!drawing) return; undo.length = drawing.u; restore(drawing); drawing = null; showEdit(); }
        function showStatus() { if (drawing) return; if (st.k !== 'manual' || !touched) st = statusOf(det); say(st.txt, st.col); paint(); }

        /* ── إيماءات الخشبة: سحبٌ بإصبعين = تكبير · إصبعٌ على صورةٍ مكبَّرة = تحريك · نقرة في وضع الرسم = نقطة ── */
        var ptrs = {}, gest = null;
        stage.addEventListener('pointerdown', function (e) {
          if (view !== 'edit' || e.target.closest('.gds-h,.gds-g,button')) return;
          ptrs[e.pointerId] = local(e); try { stage.setPointerCapture(e.pointerId); } catch (_) {}
          var ids = Object.keys(ptrs);
          if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; gest = { pinch: true, d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: z, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; }
          else gest = { pinch: false, s: local(e), tx0: tx, ty0: ty, moved: false, p: fromEv(e) };
        });
        stage.addEventListener('pointermove', function (e) {
          if (!ptrs[e.pointerId] || !gest) return;
          ptrs[e.pointerId] = local(e);
          var ids = Object.keys(ptrs);
          if (gest.pinch && ids.length >= 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt(gest.z0 * d / gest.d0, gest.mid[0], gest.mid[1]); return; }
          var c = local(e), dx = c[0] - gest.s[0], dy = c[1] - gest.s[1];
          if (Math.hypot(dx, dy) > 8) gest.moved = true;
          if (gest.moved && z > 1) { tx = gest.tx0 + dx; ty = gest.ty0 + dy; applyZoom(); }
        });
        function endPtr(e) {
          if (!ptrs[e.pointerId]) return;
          delete ptrs[e.pointerId];
          if (gest && !gest.pinch && !gest.moved && drawing) {           // نقرةٌ في وضع الرسم ⇒ نقطة (أو إغلاق قرب الأولى)
            var p = gest.p;
            if (P.length >= 3) { var f = toScr(P[0]), q = toScr(p); if (Math.hypot(f[0] - q[0], f[1] - q[1]) < 26) { closeDraw(); gest = null; return; } }
            undo.push(snap()); redo = []; P.push(p); sel = P.length - 1; paint();
          } else if (gest && !gest.pinch && !gest.moved) { sel = -1; paint(); }
          if (!Object.keys(ptrs).length) gest = null;
        }
        stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
        stage.addEventListener('wheel', function (e) { if (view !== 'edit') return; e.preventDefault(); var c = local(e); zoomAt(z * Math.exp(-e.deltaY * 0.0015), c[0], c[1]); }, { passive: false });

        var tb = {};
        function updTools() {
          if (!tb.undo) return;
          tb.undo.disabled = !undo.length; tb.redo.disabled = !redo.length;
          tb.del.disabled = drawing ? !P.length : !(sel >= 0 && P.length > 4);
          if (tb.close) tb.close.style.display = drawing ? '' : 'none';
          tb.zout.disabled = z <= 1;
        }
        function showEdit(keep) {
          view = 'edit'; sub.textContent = drawing ? 'ارسم حدود الورقة' : 'اسحب النقاط إلى حدود الورقة · «+» يضيف نقطة';
          if (!shown || shown.rot !== rot) shown = { rot: rot, c: drawScaled(img, 1400, rot) };
          var c = shown.c; if (!keep || cv.width !== c.width) { cv.width = c.width; cv.height = c.height; } cv.getContext('2d').drawImage(c, 0, 0);
          svg.style.display = '';
          tools.innerHTML = ''; tools.style.display = '';
          tb.undo = btn('↶ تراجع', function () { doUndo(); }, '', tools);
          tb.redo = btn('↷ إعادة', function () { doRedo(); }, '', tools);
          tb.add = btn('➕ نقطة', function () { addPoint(); }, '', tools); if (drawing) tb.add.style.display = 'none';
          tb.del = btn(drawing ? '⌫ آخر نقطة' : '➖ حذف النقطة', function () { delPoint(); }, '', tools);
          tb.draw = btn(drawing ? '✕ إلغاء الرسم' : '✏️ رسم الحدود', function () { if (drawing) cancelDraw(); else startDraw(); }, drawing ? 'on' : '', tools);
          tb.close = btn('⭕ إغلاق المحيط', function () { closeDraw(); }, 'p', tools);
          tb.zin = btn('🔍+', function () { zoomAt(z * 1.6, cw() / 2, ch() / 2); }, '', tools);
          tb.zout = btn('🔍−', function () { if (z <= 1.6) { z = 1; tx = ty = 0; applyZoom(); } else zoomAt(z / 1.6, cw() / 2, ch() / 2); }, '', tools);
          bar.innerHTML = '';
          if (!drawing) {
            btn('↻ تدوير', function () { rot = (rot + 90) % 360; z = 1; tx = ty = 0; cv.style.transform = ''; P = [[0, 0], [1, 0], [1, 1], [0, 1]]; CI = [0, 1, 2, 3]; undo = []; redo = []; showEdit(); detectSoon(); });
            btn('🔄 اكتشاف تلقائي', function () { detectSoon(); });
            btn('⬜ الصفحة كاملة', function () { if (pending > 0) clearTimeout(pending); pending = 0; push(); touched = true; P = [[0, 0], [1, 0], [1, 1], [0, 1]]; CI = [0, 1, 2, 3]; sel = -1; manual(); paint(); precompute(300); });
            btn('📷 إعادة التصوير', retake);
            btn('✕ إلغاء', function () { finish(null); });
            btn('✔ قصّ وتحسين', function () { run(); }, 'p');
          }
          requestAnimationFrame(function () { fitCanvas(); applyZoom(); });
          if (!pending && !drawing) showStatus();
        }
        function run() {
          if (busy) return; detectNow();
          if (drawing) { closeDraw(); if (drawing) return; }
          if (P.length < 4 || !simple(P)) { say('❌ المحيط غير صالح (يقطع نفسه) — صحّحه أو ↶.'); return; }
          if (preT) { clearTimeout(preT); preT = 0; }
          if (pre && pre.key === keyOf() && pre.cv) { result = pre.cv; showResult(); return; }          // جاهزةٌ من الخلفيّة
          if (pre && pre.key === keyOf() && pre.wait) {                                          // تُجهَّز الآن في الخيط الآخر ⇒ تُنتظر
            var Pq = pre; busy = true; say('جارٍ القصّ وتصحيح المنظور وتحسين الوضوح…');
            Pq.wait.then(function (c) {
              busy = false; if (view !== 'edit') return;
              if (c && pre === Pq) { result = c; showResult(); } else run();
            });
            return;
          }
          busy = true; say('جارٍ القصّ وتصحيح المنظور وتحسين الوضوح…');
          setTimeout(function () {
            try {
              var cs = corners(), sh = shape();
              base = { key: JSON.stringify([P, CI, rot]), cv: warpOnly(img, cs, rot, sh) };
              result = applyMode(base.cv, mode); busy = false;
              /* (TASK-0130) «قصّ» قبل أن تُجهَّز النسخة في الخلفية ⇒ هذه هي، والقراءة تأخذها (لا تعالج الصورة مرّةً ثانية) */
              if (opts.onProcessed && rot === 0 && mode === 'color') { try { opts.onProcessed(result, cs); } catch (_) {} }
              showResult();
            }
            catch (e) { busy = false; say('❌ تعذّرت المعالجة: ' + (e && e.message || e) + ' — جرّب «الصفحة كاملة» أو أعد التصوير.'); }
          }, 30);
        }
        /* نمطٌ آخر: من النسخة المقوَّمة نفسها (تُقوَّم مرّةً واحدة) — والأصل محفوظ، فالرجوع لأيّ نمط بلا خسارة */
        function setMode(m) {
          if (busy || m === mode) return; mode = m;
          busy = true; say('جارٍ تطبيق النمط…');
          setTimeout(function () {
            try {
              var k = JSON.stringify([P, CI, rot]);
              if (!base || base.key !== k) base = { key: k, cv: warpOnly(img, corners(), rot, shape()) };
              result = applyMode(base.cv, mode); busy = false; showResult();
            } catch (e) { busy = false; say('❌ ' + (e && e.message || e)); }
          }, 20);
        }
        var MODE_TXT = { orig: '🖼 الأصل', color: '✨ تلقائي', magic: '🌈 ألوان', gray: '◐ رمادي', bw: '⚫ أبيض وأسود' };
        function showResult(orig) {
          view = 'result'; sub.textContent = orig ? 'الصورة الأصلية' : MODE_TXT[mode].slice(2);
          handles.forEach(function (h) { h.remove(); }); handles = []; ghosts.forEach(function (g) { g.remove(); }); ghosts = [];
          svg.style.display = 'none'; hideLoupe(); z = 1; tx = ty = 0; cv.style.transform = '';
          var src = orig ? (shown && shown.rot === rot ? shown.c : drawScaled(img, 1400, rot)) : result;
          cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0);
          say(''); tools.innerHTML = ''; requestAnimationFrame(fitCanvas);
          if (!orig) MODES.forEach(function (m) { btn(MODE_TXT[m], function () { setMode(m); }, m === mode ? 'on' : '', tools); });
          bar.innerHTML = '';
          btn(orig ? '📄 النسخة الممسوحة' : '👁 قارن بالأصل', function () { showResult(!orig); }, orig ? 'on' : '');
          btn('↩ تعديل الحدود', function () { showEdit(); });
          btn('📷 إعادة التصوير', retake);
          btn('✅ اعتماد', function () {
            if (busy) return;
            var out = { original: file, scanned: null, mode: mode, corners: corners(), poly: shape() ? P.map(function (p) { return p.slice(); }) : null, ci: shape() ? CI.slice() : null, rotation: rot, width: result.width, height: result.height, status: st.k };
            if (pre && result === pre.cv && pre.blob) { out.scanned = pre.blob; finish(out); return; }
            busy = true;
            result.toBlob(function (b) {
              busy = false;
              if (!b) { say('❌ تعذّر حفظ الصورة — أعد المحاولة.'); return; }
              out.scanned = b; finish(out);
            }, 'image/jpeg', 0.9);
          }, 'p');
        }
        function onResize() { fitCanvas(); if (view === 'edit') applyZoom(); }
        global.addEventListener('resize', onResize);
        /* (TASK-0131) إعادة تعديل صفحةٍ ممسوحة: opts.init = نتيجةٌ سابقة (corners · poly/ci · rotation · mode) ⇒ تُفتح بحدودها هي، بلا اكتشافٍ جديد */
        var I0 = opts.init;
        if (I0 && I0.corners && I0.corners.length === 4) {
          rot = I0.rotation || 0; mode = MODES.indexOf(I0.mode) >= 0 ? I0.mode : mode;
          if (I0.poly && I0.ci && I0.poly.length > 4) { P = I0.poly.map(function (p) { return p.slice(); }); CI = I0.ci.slice(); } else { P = I0.corners.map(function (p) { return p.slice(); }); CI = [0, 1, 2, 3]; }
          det = { corners: I0.corners, poly: I0.poly || null, ci: I0.ci || null, ok: true, how: 'init' }; touched = true;
          st = { k: 'manual', col: '#22c55e', txt: '✋ حدودك السابقة — عدّلها ثمّ «✔ قصّ وتحسين» · «🔄 اكتشاف تلقائي» يعيد الاكتشاف' };
          showEdit(); precompute(30);
        } else { showEdit(); detectSoon(); }
      });
    });
  }
  global.GMTDocScan = { open: open, detect: detect, lineQuad: lineQuad, process: process, _warpPoly: warpPoly, warpOnly: warpOnly, applyMode: applyMode, _poly: { cornersOf: cornersOf, simple: simple, normPoly: normPoly }, statusOf: statusOf, processBox: processBox, rectGeom: rectGeom, detectNorm: detectNorm, _warp: warp, _enhance: enhance, _order: order };
})(typeof window !== 'undefined' ? window : self);
