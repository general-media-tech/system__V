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

   GMTDocScan.open(file, { title }) ⇒ Promise<null | { retake:true } |
        { original: File, scanned: Blob, mode: 'color'|'bw', corners, rotation }>
   GMTDocScan.detect(imageData) · GMTDocScan.process(img, corners, rot, mode) — للاختبار
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  if (!doc || global.GMTDocScan) return;

  var WORK_MAX = 2400;      // أطول ضلعٍ للمعالجة (يكفي للنصّ الصغير والباركود)
  var DET_MAX = 640;        // للاكتشاف فقط

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
  function detectNorm(img, rot) {
    var c = drawScaled(img, DET_MAX, rot), id = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    var r = detect(id), q = r.ok ? grow(r.corners, 0.015, c.width, c.height) : r.corners;
    return { corners: q.map(function (p) { return [p[0] / c.width, p[1] / c.height]; }), ok: r.ok, why: r.why, diag: r.diag };
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
        var rot = 0, det = detectNorm(img, rot), corners = det.corners, mode = 'color', view = 'edit', result = null, busy = false;
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
                e.preventDefault(); el.setPointerCapture(e.pointerId);
                function mv(ev) { var r = cv.getBoundingClientRect(); corners[k] = [Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))]; paintQuad(); }
                function up() { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); }
                el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
              });
            })(i, h);
          }
          requestAnimationFrame(paintQuad);
          say(det.ok ? '' : '⚠️ ' + (det.why || 'لم تُكتشف الورقة') + ' — حدّد الزوايا بيدك.');
          bar.innerHTML = '';
          btn('↻ تدوير', function () { rot = (rot + 90) % 360; det = detectNorm(img, rot); corners = det.corners; showEdit(); });
          btn('🔄 اكتشاف تلقائي', function () { det = detectNorm(img, rot); corners = det.corners; showEdit(); });
          btn('⬜ الصفحة كاملة', function () { corners = [[0, 0], [1, 0], [1, 1], [0, 1]]; paintQuad(); say(''); });
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
          if (busy) return; busy = true; say('جارٍ القصّ وتصحيح المنظور وتحسين الوضوح…');
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
        showEdit();
      });
    });
  }

  global.GMTDocScan = { open: open, detect: detect, process: process, detectNorm: detectNorm, _warp: warp, _enhance: enhance, _order: order };
})(window);
