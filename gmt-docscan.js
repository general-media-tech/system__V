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

   GMTDocScan.open(file, { title, onRetake, onDetected(det, rot) }) ⇒ Promise<null | { retake:true } |
        { original: File, scanned: Blob, mode: 'color'|'bw', corners, rotation }>
   GMTDocScan.detect(imageData) · GMTDocScan.process(img, corners, rot, mode) — للاختبار
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.GMTDocScan) return;

  var WORK_MAX = 2400;      // أطول ضلعٍ للمعالجة (يكفي للنصّ الصغير والباركود)
  var DET_MAX = 512;        // للاكتشاف فقط (TASK-0123: ٥١٢ — ثابت النتائج بين ٤٤٨ و٥٦٠ وأسرع من ٦٤٠)

  /* ── أدوات ─────────────────────────────────────────────────────────────── */
  function loadImg(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { ok(im); setTimeout(function () { URL.revokeObjectURL(url); }, 4000); };
      im.onerror = function () { URL.revokeObjectURL(url); bad(new Error('تعذّر فتح الصورة')); };
      im.src = url;
    });
  }
  function canvasOf(w, h) { var c = doc.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
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
    var Ps = blur(P, 3), Lb = blur(blur(L, 2), 2), Ub = blur(U, 3), Vb = blur(V, 3);
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
    var lines = cand.filter(function (l) { return l.run >= Math.min(W, H) * 0.1; }).sort(function (p, q) { return q.run - p.run; }).slice(0, 30);
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
    var tops = [], cache = {}, mx2 = W * 0.08, my2 = H * 0.08;
    for (var pa = 0; pa < pairs.length; pa++) for (var pb = pa + 1; pb < pairs.length; pb++) {
      var Pa = pairs[pa], Pb = pairs[pb];
      if (ang(Pa[0], Pb[0]) < 40 || ang(Pa[1], Pb[1]) < 40) continue;
      var Q = [inter(Pa[0], Pb[0]), inter(Pa[0], Pb[1]), inter(Pa[1], Pb[1]), inter(Pa[1], Pb[0])], bad = !Q[0] || !Q[1] || !Q[2] || !Q[3];
      for (var z = 0; z < 4 && !bad; z++) if (Q[z][0] < -mx2 || Q[z][0] > W + mx2 || Q[z][1] < -my2 || Q[z][1] > H + my2) bad = true;
      if (bad || !convex(Q)) continue;
      var ar = polyArea(Q); if (ar < n * 0.1) continue;
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
      /* الرباعيّ بقدر أضعف أضلاعه: سطرٌ مطبوع داخل الورقة يأتي بتباينٍ أضعف من حدّها الحقيقي */
      tops.push({ q: Q, score: ms * 0.25 + mins * 0.15 + mc * 0.15 + minc * 0.3 + (ar / n) * 0.15 - nb * 0.04, minc: minc, nb: nb, sc: sc, area: ar });
    }
    tops.sort(function (p, q) { return q.score - p.score; });
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
    for (i = 1; b0 && i < tops.length && i < 60; i++) {
      var t2 = tops[i], big = t2.area >= b0.area * 1.8, mcnb = 1;
      t2.sc.forEach(function (q) { if (!q.border && q.con < mcnb) mcnb = q.con; });
      if (t2.score < b0.score - (big ? 0.15 : 0.08) || t2.nb > 1 || mcnb < (big ? 0.45 : 0.6) || t2.area < b0.area * 1.25 || t2.area <= best.area) continue;
      if (contains(t2, best)) best = t2;
    }
    /* لصق كل ضلعٍ على الحدّ الحقيقي القريب (±٦٪): نحرّك طرفيه على العموديّ (خشنٌ ثمّ دقيق) ونختار الأقوى سنداً وتبايناً */
    function refine(Q) {
      Q = order(Q);
      var R = Math.max(6, Math.round(Math.min(W, H) * 0.06)), cx = (Q[0][0] + Q[1][0] + Q[2][0] + Q[3][0]) / 4, cy = (Q[0][1] + Q[1][1] + Q[2][1] + Q[3][1]) / 4, newL = [], snapped = 0;
      for (var z = 0; z < 4; z++) {
        var P1 = Q[z], P2 = Q[(z + 1) % 4], ux = P2[0] - P1[0], uy = P2[1] - P1[1], ln = Math.hypot(ux, uy) || 1, nx = -uy / ln, ny = ux / ln, bst = null;
        if ((cx - P1[0]) * nx + (cy - P1[1]) * ny < 0) { nx = -nx; ny = -ny; }          // n نحو الداخل
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
    return { best: best, guard: best ? guard(best.q) : false, extraInk: extraInk, refine: refine, contains: function (big, small) { return contains({ q: big }, { q: small }); } };
  }

  /* توسيع الزوايا للخارج قليلاً كي لا يُقصّ طرف الورقة أبداً */
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
    var S = srcCanvas.getContext('2d').getImageData(0, 0, srcCanvas.width, srcCanvas.height), sd = S.data, SW = S.width, SH = S.height;
    var out = canvasOf(w, h), O = out.getContext('2d').createImageData(w, h), od = O.data;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var z = Hm[6] * x + Hm[7] * y + 1, sx = (Hm[0] * x + Hm[1] * y + Hm[2]) / z, sy = (Hm[3] * x + Hm[4] * y + Hm[5]) / z;
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
    function bgAt(ch, X, Y) {
      var fx = Math.min(sw - 1.001, Math.max(0, X / w * sw - .5)), fy = Math.min(sh - 1.001, Math.max(0, Y / h * sh - .5));
      var x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, B = bg[ch];
      return (B[y0 * sw + x0] * (1 - tx) + B[y0 * sw + x0 + 1] * tx) * (1 - ty) + (B[(y0 + 1) * sw + x0] * (1 - tx) + B[(y0 + 1) * sw + x0 + 1] * tx) * ty;
    }
    /* توازن الأبيض: لون الورق = متوسّط ألوان البكسلات القريبة من خلفيّتها (الورق نفسه لا الحبر) */
    var wr = 0, wg = 0, wb = 0, wn = 0, p;
    for (p = 0; p < w * h; p += 7) {
      var q4 = p * 4, l0 = 0.299 * d[q4] + 0.587 * d[q4 + 1] + 0.114 * d[q4 + 2];
      if (l0 > bgAt(0, p % w, (p / w) | 0) * 0.9) { wr += d[q4]; wg += d[q4 + 1]; wb += d[q4 + 2]; wn++; }
    }
    var gr = 1, gg = 1, gb = 1;
    if (wn > 50) { var ml = (wr + wg + wb) / (3 * wn); gr = Math.min(1.35, Math.max(0.75, ml / (wr / wn))); gg = Math.min(1.35, Math.max(0.75, ml / (wg / wn))); gb = Math.min(1.35, Math.max(0.75, ml / (wb / wn))); }
    var L = new Float32Array(w * h), hist = new Uint32Array(256);
    for (var Y = 0; Y < h; Y++) for (var X = 0; X < w; X++) {
      p = (Y * w + X) * 4;
      var gain = 245 / Math.max(24, bgAt(0, X, Y));
      var r2 = d[p] * gain * gr, g2 = d[p + 1] * gain * gg, b2 = d[p + 2] * gain * gb;
      d[p] = r2 > 255 ? 255 : r2; d[p + 1] = g2 > 255 ? 255 : g2; d[p + 2] = b2 > 255 ? 255 : b2;
      var l = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]; L[Y * w + X] = l; hist[l | 0]++;
    }
    /* شدّ التباين: ٢٪ الأغمق ⇒ حبرٌ أسود، والورق أبيض — بلا قصّ للرماديّ الخفيف */
    var n = w * h, acc = 0, lo = 0;
    for (var t = 0; t < 256; t++) { acc += hist[t]; if (acc > n * 0.02) { lo = t; break; } }
    lo = Math.min(lo, 120); var hi = 242, sc = 255 / Math.max(40, hi - lo);
    if (mode === 'bw') {
      /* الإضاءة صارت متجانسة (الورق ≈ ٢٤٥) ⇒ الحبر ما دون ~٧٠٪ من بياض الورق؛ أوتسو وحده كان ينجرّ نحو
         الطاولة الداكنة والقلم الملوّن فيُسوّد بقعاً كاملة (m01). العتبة بين ١٤٠ و١٧٥ تُبقي النصّ الباهت. */
      var th = Math.min(175, Math.max(140, otsu(hist, n) + 10));
      for (p = 0; p < n; p++) { var bwv = L[p] < th ? 0 : 255; d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = bwv; }
    } else {
      for (p = 0; p < n * 4; p += 4) for (var c2 = 0; c2 < 3; c2++) { var u = (d[p + c2] - lo) * sc; d[p + c2] = u < 0 ? 0 : u > 255 ? 255 : u; }
    }
    ctx.putImageData(I, 0, 0);
    /* وضوحٌ خفيف (unsharp) للنسخة الملوّنة فقط */
    if (mode !== 'bw' && w * h < 6e6) {
      var J = ctx.getImageData(0, 0, w, h), e = J.data, bl = new Float32Array(n);
      for (p = 0; p < n; p++) bl[p] = 0.299 * e[p * 4] + 0.587 * e[p * 4 + 1] + 0.114 * e[p * 4 + 2];
      var B2 = boxBlur(bl, w, h, 1);
      for (p = 0; p < n; p++) { var dl = (bl[p] - B2[p]) * 0.6; for (var c3 = 0; c3 < 3; c3++) { var z2 = e[p * 4 + c3] + dl; e[p * 4 + c3] = z2 < 0 ? 0 : z2 > 255 ? 255 : z2; } }
      ctx.putImageData(J, 0, 0);
    }
    return cv;
  }

  function process(img, corners, rot, mode) {
    var work = drawScaled(img, WORK_MAX, rot);
    var out = warp(work, corners.map(function (p) { return [p[0] * work.width, p[1] * work.height]; }), 2000);
    return enhance(out, mode);
  }
  /* الترتيب (TASK-0123): ① خطوطٌ قويّة على الأضلاع الأربعة (درجة ≥٠٫٧ وأضعف تباين ≥٠٫٧) ⇒ تُعتمد (ما لم تجد الطريقة ①
     منطقةً أكبر بكثير تحويها) ⇒ ② وإلّا الطريقة ① (المنطقة الفاتحة) إن نجحت ⇒ ③ وإلّا خطوطٌ أضعف (≥٠٫٦) إن مرّت بحارس القصّ ⇒ ④ ورقةٌ تملأ الصورة ⇒ الصورة كاملة ⇒ ⑤ الصورة كاملة
     لتحدّدها بيدك. وفي ①②③ يُلصق كل ضلعٍ على الحدّ الحقيقي القريب، والتوسيع للخارج ٠٫٥٪ فقط (كان ١٫٥٪ على حدودٍ تقريبيّة
     فيُبقي شرائط خلفيّة — لقطة المالك) و١٫٥٪ إن بقي ضلعٌ بلا لصق. */
  function detectNorm(img, rot) {
    var c = drawScaled(img, DET_MAX, rot), W = c.width, H = c.height, id = c.getContext('2d').getImageData(0, 0, W, H);
    var lq = lineQuad(id), b = lq.best, q = null, how = '', old = null, rf;
    if (b && b.score >= 0.7 && b.minc >= 0.7) {
      rf = lq.refine(b.q); how = 'lines';
      /* لا قصّ: الطريقة ① وجدت منطقةً أكبر بكثير (×١٫٣٥) تحوي الخطوط، وفي الزيادة حبر (نصّ · رموز: كثافة ≥٤٪) ⇒ الخطوط قطعت
         جزءاً من الورقة (حدٌّ بين ترويسةٍ بيضاء وجدولٍ ملوّن في إيصالٍ مطبوع بالألوان، ويدٌ تغطّي الحدّ الحقيقي) ⇒ المنطقة الأكبر.
         زيادةٌ بلا حبر (رزمة أوراقٍ بيضاء بجانب الإيصال: ١–٢٪) ⇒ تبقى الخطوط. في التجربة: القصّ ٨–٢٢٪ · الرزمة ≤٢٫٣٪. */
      old = detect(id);
      if (old.ok && !old.fill && polyArea(old.corners) >= polyArea(b.q) * 1.35 && lq.contains(old.corners, b.q) && lq.extraInk(old.corners, b.q) >= 0.04) { rf = lq.refine(old.corners); how = 'region'; }
    }
    else if ((old = old || detect(id)).ok && !old.fill) { rf = lq.refine(old.corners); how = 'region'; }
    else if (b && b.score >= 0.6 && lq.guard) { rf = lq.refine(b.q); how = 'lines'; }
    if (rf) q = grow(order(rf.q), rf.snapped === 4 ? 0.005 : 0.015, W, H);
    else if (old && old.fill) { q = old.corners; how = 'fill'; }
    var norm = function (qq) { return qq.map(function (p) { return [Math.max(0, Math.min(1, p[0] / W)), Math.max(0, Math.min(1, p[1] / H))]; }); };
    if (q) return { corners: norm(q), ok: true, why: old && old.fill ? old.why : '', how: how, diag: old && old.diag };
    var r = old || detect(id);
    return { corners: norm([[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]]), ok: false, why: r.why || 'لم تتميّز الورقة عن الخلفية', how: 'none', diag: r.diag };
  }

  /* ── ④ الواجهة ───────────────────────────────────────────────────────────── */
  function css() {
    if (doc.getElementById('gds-css')) return;
    var st = doc.createElement('style'); st.id = 'gds-css';
    st.textContent =
      '#gds{position:fixed;inset:0;z-index:2147482500;background:#0b0d10;color:#fff;display:flex;flex-direction:column;direction:rtl;font-family:inherit}' +
      '#gds .gds-top{display:flex;align-items:center;gap:8px;padding:10px 12px;font-weight:900;font-size:15px}' +
      '#gds .gds-top small{font-weight:700;color:#9aa3ae;font-size:12px}' +
      '#gds .gds-stage{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;padding:8px;touch-action:none}' +
      '#gds .gds-wrap{position:relative;max-width:100%;max-height:100%}' +
      '#gds canvas.gds-img{display:block;max-width:100%;max-height:calc(100vh - 190px);object-fit:contain;background:#222;border-radius:6px}' +
      '#gds .gds-wrap>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}' +   /* لا تلمس أيقونات الأزرار (gmt-icons) — كانت تتضخّم ملء الشاشة */
      '#gds .gds-h{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(213,0,28,.25);border:3px solid #ff3b4e;touch-action:none;cursor:grab}' +
      '#gds .gds-msg{min-height:20px;text-align:center;font-size:12.5px;font-weight:800;color:#fbbf24;padding:0 12px}' +
      '#gds .gds-bar{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:10px 10px calc(10px + env(safe-area-inset-bottom))}' +
      '#gds button{font:inherit;font-weight:900;font-size:13px;border-radius:12px;padding:10px 12px;border:1px solid #2a2f37;background:#1a1e24;color:#fff;cursor:pointer}' +
      '#gds button.p{background:#D5001C;border-color:#D5001C}#gds button.on{background:#fff;color:#111}' +
      '#gds button:disabled{opacity:.5}';
    (doc.head || doc.documentElement).appendChild(st);
  }

  function open(file, opts) {
    opts = opts || {};
    css();
    return loadImg(file).then(function (img) {
      return new Promise(function (resolve) {
        /* (TASK-0123) الاكتشاف بالخطوط أثقل (≈١ث على هاتفٍ متوسّط): النافذة تظهر فوراً بالصورة، والزوايا «تُلصق» بعد لحظة.
           لمستَ زاويةً قبلها ⇒ اختيارك يبقى · ضغطتَ «قصّ» قبلها ⇒ يُكمَل الاكتشاف أوّلاً. */
        var rot = 0, det = { corners: [[0, 0], [1, 0], [1, 1], [0, 1]], ok: true, why: '' }, corners = det.corners, mode = 'color', view = 'edit', result = null, busy = false;
        var pending = 0, touched = false, reported = false;
        function detectNow() { if (!pending) return; if (pending > 0) clearTimeout(pending); pending = 0; det = detectNorm(img, rot); if (!touched) corners = det.corners; }
        function detectSoon() {
          if (pending > 0) clearTimeout(pending); touched = false; say('🔍 جارٍ اكتشاف حدود الورقة…');
          pending = setTimeout(function () {
            pending = -1; detectNow(); if (view === 'edit') { paintQuad(); say(det.ok ? '' : '⚠️ ' + (det.why || 'لم تُكتشف الورقة') + ' — حدّد الزوايا بيدك.'); }
            /* (TASK-0126) أوّل اكتشاف ⇒ يُبلَّغ المستدعي (نافذة الشحن تبدأ قراءة الرقم والفرع وأنت ما زلت في الماسح) */
            if (opts.onDetected && !reported) { reported = true; try { opts.onDetected({ corners: det.corners, ok: det.ok, how: det.how }, rot); } catch (_) {} }
          }, 60);
        }
        var root = doc.createElement('div'); root.id = 'gds'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
        root.innerHTML =
          '<div class="gds-top">📄 ' + (opts.title || 'مسح المستند') + ' <small id="gds-sub"></small></div>' +
          '<div class="gds-stage"><div class="gds-wrap"><canvas class="gds-img"></canvas><svg aria-hidden="true"><polygon fill="rgba(213,0,28,.12)" stroke="#ff3b4e" stroke-width="2"/></svg></div></div>' +
          '<div class="gds-msg" role="status" aria-live="polite"></div>' +
          '<div class="gds-bar"></div>';
        doc.body.appendChild(root);
        var wrap = root.querySelector('.gds-wrap'), cv = root.querySelector('canvas'), svg = root.querySelector('svg'), poly = svg.querySelector('polygon');
        var msg = root.querySelector('.gds-msg'), bar = root.querySelector('.gds-bar'), sub = root.querySelector('#gds-sub');
        var handles = [];
        function say(t) { msg.textContent = t || ''; }
        function btn(label, fn, cls) { var b = doc.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.addEventListener('click', fn); bar.appendChild(b); return b; }
        function finish(v) { root.remove(); doc.removeEventListener('keydown', onKey, true); resolve(v); }
        function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); finish(null); } }
        /* الكاميرا تُفتح من داخل ضغطة الزرّ نفسها (المتصفّحات تمنع فتحها خارج لمسة المستخدم) */
        function retake() { try { if (opts.onRetake) opts.onRetake(); } catch (_) {} finish({ retake: true }); }
        doc.addEventListener('keydown', onKey, true);

        function showEdit() {
          view = 'edit'; sub.textContent = 'اسحب الزوايا الحمراء إلى أطراف الورقة';
          var c = drawScaled(img, 1400, rot); cv.width = c.width; cv.height = c.height; cv.getContext('2d').drawImage(c, 0, 0);
          svg.style.display = '';
          handles.forEach(function (h) { h.remove(); }); handles = [];
          for (var i = 0; i < 4; i++) {
            var h = doc.createElement('div'); h.className = 'gds-h'; h.setAttribute('data-i', i); wrap.appendChild(h); handles.push(h);
            (function (k, el) {
              el.addEventListener('pointerdown', function (e) {
                e.preventDefault(); el.setPointerCapture(e.pointerId); touched = true;
                function mv(ev) { var r = cv.getBoundingClientRect(); corners[k] = [Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))]; paintQuad(); }
                function up() { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); }
                el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
              });
            })(i, h);
          }
          requestAnimationFrame(paintQuad);
          if (!pending) say(det.ok ? '' : '⚠️ ' + (det.why || 'لم تُكتشف الورقة') + ' — حدّد الزوايا بيدك.');
          bar.innerHTML = '';
          btn('↻ تدوير', function () { rot = (rot + 90) % 360; corners = [[0, 0], [1, 0], [1, 1], [0, 1]]; showEdit(); detectSoon(); });
          btn('🔄 اكتشاف تلقائي', function () { detectSoon(); });
          btn('⬜ الصفحة كاملة', function () { if (pending > 0) clearTimeout(pending); pending = 0; touched = true; corners = [[0, 0], [1, 0], [1, 1], [0, 1]]; paintQuad(); say(''); });
          btn('📷 إعادة التصوير', retake);
          btn('✕ إلغاء', function () { finish(null); });
          btn('✔ قصّ وتحسين', function () { run(); }, 'p');
        }
        function paintQuad() {
          if (view !== 'edit') return;
          var r = cv.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
          var pts = corners.map(function (p) { return [r.left - wr.left + p[0] * r.width, r.top - wr.top + p[1] * r.height]; });
          poly.setAttribute('points', pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '));
          handles.forEach(function (h, i) { h.style.left = pts[i][0] + 'px'; h.style.top = pts[i][1] + 'px'; });
        }
        function run() {
          if (busy) return; detectNow(); busy = true; say('جارٍ القصّ وتصحيح المنظور وتحسين الوضوح…');
          setTimeout(function () {
            try { result = process(img, corners, rot, mode); busy = false; showResult(); }
            catch (e) { busy = false; say('❌ تعذّرت المعالجة: ' + (e && e.message || e) + ' — جرّب «الصفحة كاملة» أو أعد التصوير.'); }
          }, 30);
        }
        function showResult(orig) {
          view = 'result'; sub.textContent = orig ? 'الأصل' : (mode === 'bw' ? 'أبيض وأسود' : 'ملوّنة محسّنة');
          handles.forEach(function (h) { h.remove(); }); handles = []; svg.style.display = 'none';
          var src = orig ? drawScaled(img, 1400, rot) : result;
          cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0);
          say('');
          bar.innerHTML = '';
          btn(mode === 'bw' ? '🎨 ملوّنة' : '⚫ أبيض وأسود', function () { mode = mode === 'bw' ? 'color' : 'bw'; run(); });
          var cmp = btn(orig ? '📄 النسخة الممسوحة' : '👁 قارن بالأصل', function () { showResult(!orig); }, orig ? 'on' : '');
          btn('↩ تعديل الزوايا', function () { showEdit(); });
          btn('📷 إعادة التصوير', retake);
          btn('✅ اعتماد', function () {
            if (busy) return; busy = true;
            result.toBlob(function (b) {
              busy = false;
              if (!b) { say('❌ تعذّر حفظ الصورة — أعد المحاولة.'); return; }
              finish({ original: file, scanned: b, mode: mode, corners: corners, rotation: rot, width: result.width, height: result.height });
            }, 'image/jpeg', 0.9);
          }, 'p');
          void cmp;
        }
        global.addEventListener('resize', paintQuad);
        showEdit(); detectSoon();
      });
    });
  }

  global.GMTDocScan = { open: open, detect: detect, lineQuad: lineQuad, process: process, detectNorm: detectNorm, _warp: warp, _enhance: enhance, _order: order };
})(window);
