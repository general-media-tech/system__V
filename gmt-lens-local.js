/* ═══════════════════════════════════════════════════════════════════════════
   gmt-lens-local.js — «العدسة الذكيّة 2.0»: محرّك تعرّفٍ بصريّ محلّيّ على الجهاز (TASK-A0580 · المالك seq 979–981 · 998 · 1001)
   «فوراً تعمل الالتقاط وتبحث فوراً … ما يكون فيها ذكاء اصطناعي ولا خادم ولا API ولا مفتاح … بوت مدرّب من عندنا …
    مثل عدسة جوجل كيف فوراً بتقترح لك صور — بس بدل ما ياخذ من جوجل ياخذ من المخزون اللي عندنا»
   ─────────────────────────────────────────────────────────────────────────────
   كلّه على الجهاز — لا خادم ولا مفتاح ولا إنترنت بعد أوّل تحميل:
     ① «عين» مدرّبة محفوظة في موقعنا (lib/lens-model · MobileNetV2 ١٤ م.ب · تُحمَّل مرّة وتُخزَّن) تحوّل الصورة إلى بصمة من ١٢٨ رقماً
        — بصمات صور كلّ منتجاتنا محسوبة مسبقاً (lens-index.json · tools/lens_index_build.js) ⇒ مقارنة اللقطة بها كلّها بأقلّ من ٢٠ م.ث
        (لماذا لا «بصمة ألوان وحوافّ» يدويّة؟ جُرّبت أوّلاً على صورنا: ٧٪ فقط أصابت ⇒ لا تكفي)
     ② الباركود في اللقطة نفسها (BarcodeDetector المدمج · وإلّا ZXing المحلّيّ lib/zxing.min.js)
     ③ قراءة الكتابة (OCR) بـ Tesseract المستضاف عندنا lib/ocr — بالخلفية، تُعيد الترتيب حين تنتهي
     ④ التعلّم: «هذا هو» ⇒ بصمة اللقطة عيّنةٌ للمنتج (gmt_lens_samples) ⇒ العلبة الحقيقيّة تُعرف مباشرةً المرّة القادمة
        عيّنة الأدمن معتمدة فوراً · عيّنة الموظّف تعمل على جهازه وتنتظر اعتماد الأدمن
   GMTLensLocal.embed(src, mode) · .search(q, products, k) · .barcode(canvas) · .ocr(canvas) · .loadIndex() · .addSample(...)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTLensLocal) return;
  var doc = global.document;
  var S = 224, D = 128, VER = 3;   // (3) إسقاط LDA المدرَّب على منتجاتنا (A1016) — بصمات VER 2 (PCA) لا تُخلط به           // حجم دخل العين · أبعاد البصمة بعد الضغط · نسخة البصمة
  var MODEL_URL = 'lib/lens-model/model.json', FEAT = 'module_apply_default/MobilenetV2/Logits/AvgPool';
  var TF_SRC = 'lib/tf.min.js?v=4.22.0';

  function loadScript(src) { return new Promise(function (ok, bad) { var s = doc.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error('تعذّر تحميل ' + src)); }; doc.head.appendChild(s); }); }

  /* ── تحضير الصورة: قصّ الخلفية البيضاء (صور الكتالوج) أو وسط اللقطة (الكاميرا) ⇒ مربّع ٢٢٤ ── */
  function toCanvas(src, mode) {
    var w = src.naturalWidth || src.videoWidth || src.width, h = src.naturalHeight || src.videoHeight || src.height;
    if (!w || !h) return null;
    var s0 = Math.min(1, 320 / Math.max(w, h)), c0 = doc.createElement('canvas');
    c0.width = Math.max(1, Math.round(w * s0)); c0.height = Math.max(1, Math.round(h * s0));
    var g0 = c0.getContext('2d', { willReadFrequently: true });
    g0.fillStyle = '#fff'; g0.fillRect(0, 0, c0.width, c0.height);
    g0.drawImage(src, 0, 0, c0.width, c0.height);
    var bx = 0, by = 0, bw = c0.width, bh = c0.height;
    if (mode === 'shot' || mode === 'tight') {               // اللقطة: المنتج في وسط الإطار (الدليل المرسوم) ⇒ ٨٠٪ الوسطى (أو ٥٥٪ «قريب»)
      var m = Math.min(bw, bh) * (mode === 'tight' ? 0.55 : 0.8); bx = (bw - m) / 2; by = (bh - m) / 2; bw = bh = m;
    } else if (mode !== 'full') {                            // الكتالوج: حدود ما ليس أبيض
      var d = g0.getImageData(0, 0, c0.width, c0.height).data, x0 = c0.width, y0 = c0.height, x1 = -1, y1 = -1;
      for (var y = 0; y < c0.height; y += 2) for (var x = 0; x < c0.width; x += 2) {
        var i = (y * c0.width + x) * 4;
        if (d[i] < 238 || d[i + 1] < 238 || d[i + 2] < 238) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 > x0 + 8 && y1 > y0 + 8) { bx = Math.max(0, x0 - 4); by = Math.max(0, y0 - 4); bw = Math.min(c0.width - bx, x1 - x0 + 9); bh = Math.min(c0.height - by, y1 - y0 + 9); }
    }
    var c = doc.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);
    var sc = S / Math.max(bw, bh), dw = bw * sc, dh = bh * sc;
    g.imageSmoothingQuality = 'high';
    g.drawImage(c0, bx, by, bw, bh, (S - dw) / 2, (S - dh) / 2, dw, dh);
    return c;
  }

  /* ── العين: تُحمَّل عند أوّل فتحٍ للعدسة فقط ── */
  var modelP = null, BACKEND = '';
  function loadModel() {
    if (modelP) return modelP;
    modelP = (async function () {
      if (!global.tf) await loadScript(TF_SRC);
      var tf = global.tf, last = null;
      /* (seq A1006) بعض الهواتف ترفض WebGL (معالج رسوميات/ذاكرة) ⇒ كانت العين كلّها تتوقّف ⇒ «لا منتج قريب».
         الآن: WebGL أوّلاً، وإن فشل التحميل أو التسخين ⇒ المعالج (CPU) — أبطأ قليلاً لكنّه يعمل على كلّ جهاز. */
      var backs = ['webgl', 'cpu'];
      try { if (localStorage.getItem('gmt_lens_backend') === 'cpu') backs = ['cpu']; } catch (_) {}
      for (var i = 0; i < backs.length; i++) {
        try {
          if (!(await tf.setBackend(backs[i]))) continue;
          await tf.ready();
          var m = await tf.loadGraphModel(MODEL_URL);
          tf.tidy(function () { m.execute(tf.zeros([1, S, S, 3]), FEAT).dataSync(); });   // تسخين ⇒ أوّل لقطة فوريّة (dataSync يكشف فشل المعالج الرسوميّ الآن لا عند اللقطة)
          BACKEND = backs[i];
          if (BACKEND === 'cpu') { try { localStorage.setItem('gmt_lens_backend', 'cpu'); } catch (_) {} }
          return m;
        } catch (e) { last = e; }
      }
      throw last || new Error('لا معالج متاح للعين');
    })();
    modelP.catch(function () { modelP = null; });
    return modelP;
  }
  /* البصمة الخام (١٢٨٠) — تُستعمل أيضاً في بناء الفهرس */
  async function embedRaw(src, mode) {
    var m = await loadModel(), c = src && src.tagName === 'CANVAS' && src.width === S && mode === 'ready' ? src : toCanvas(src, mode || 'catalog');
    if (!c) return null;
    var tf = global.tf;
    try {
      var out = tf.tidy(function () { return m.execute(tf.browser.fromPixels(c).toFloat().div(255).expandDims(0), FEAT).reshape([-1]); });
      var a = await out.data(); out.dispose();
      return Float32Array.from(a);
    } catch (e) {
      /* فقد سياق الرسوميات أثناء العمل (شائع على الهاتف) ⇒ أعد التحميل على المعالج مرّةً واحدة */
      if (BACKEND === 'cpu') throw e;
      try { localStorage.setItem('gmt_lens_backend', 'cpu'); } catch (_) {}
      modelP = null; m = await loadModel(); 
      var out2 = tf.tidy(function () { return m.execute(tf.browser.fromPixels(c).toFloat().div(255).expandDims(0), FEAT).reshape([-1]); });
      var a2 = await out2.data(); out2.dispose();
      return Float32Array.from(a2);
    }
  }
  /* الضغط إلى ١٢٨ (تحليل المكوّنات الرئيسيّة المحسوب على صورنا) ثمّ تطبيع */
  var PCA = null;
  function project(raw) {
    if (!PCA) return null;
    var n0 = 0, i, j; for (i = 0; i < raw.length; i++) n0 += raw[i] * raw[i]; n0 = Math.sqrt(n0) || 1;
    var out = new Float32Array(D);
    for (j = 0; j < D; j++) {
      var s = 0, row = PCA.comp[j], sc = PCA.scale[j];
      for (i = 0; i < raw.length; i++) s += (raw[i] / n0 - PCA.mean[i]) * row[i];
      out[j] = s * sc;
    }
    var n = 0; for (j = 0; j < D; j++) n += out[j] * out[j]; n = Math.sqrt(n) || 1;
    for (j = 0; j < D; j++) out[j] /= n;
    return out;
  }
  async function embed(src, mode) { await loadIndex(); var r = await embedRaw(src, mode); return r ? project(r) : null; }
  function sim(a, b) { if (!a || !b) return 0; var d = 0; for (var i = 0; i < D; i++) d += a[i] * b[i]; return d; }
  /* (المالك seq A1010 «يعتمد على الشكل … وعلى مضمون العلبة») اللقطة بثلاثة تأطيرات: وسط الإطار · الصورة كلّها · قريب —
     المنتج قد يكون صغيراً في الزاوية أو العلبة تملأ الإطار ⇒ أفضل تطابقٍ بينها */
  async function embedMulti(src) {
    var out = [];
    for (var i = 0, M = ['shot', 'full', 'tight']; i < M.length; i++) { try { var v = await embed(src, M[i]); if (v) out.push(v); } catch (e) { if (!out.length && i === M.length - 1) throw e; } }
    return out;
  }

  /* ── تخزينٌ مضغوط: بايت لكلّ بُعد (base64) ── */
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function unb64(s) { var t = atob(s), u = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; }
  function pack(v) { var u = new Uint8Array(D); for (var i = 0; i < D; i++) u[i] = Math.max(0, Math.min(255, Math.round(v[i] * 127 * 4 + 128))); return VER + ':' + b64(u); }
  function unpack(str) {
    var m = /^(\d+):(.+)$/.exec(String(str || '')); if (!m || +m[1] !== VER) return null;
    var u = unb64(m[2]); if (u.length !== D) return null;
    var v = new Float32Array(D), n = 0, i; for (i = 0; i < D; i++) { v[i] = (u[i] - 128) / (127 * 4); n += v[i] * v[i]; }
    n = Math.sqrt(n) || 1; for (i = 0; i < D; i++) v[i] /= n; return v;
  }

  /* ── الفهرس: صور منتجاتنا (مسبق الحساب) + العيّنات المتعلَّمة ── */
  var IDX = null, IDXP = null, LOCAL_KEY = 'gmt_lens_samples_local';
  /* نقطة البيع لا تحمّل gmt-config.js: مفاتيحها في CONFIG داخل الصفحة (كما في gmt-compat-kb.js) */
  function cfgPOS() { try { if (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY) return CONFIG; } catch (_) {} return null; }
  function sbBase() { try { var u = (global.GMT_DB && GMT_DB.MAIN && GMT_DB.MAIN.url) || (cfgPOS() && cfgPOS().SUPABASE_URL) || global.SUPABASE_URL; if (u) return String(u).replace(/\/+$/, ''); } catch (_) {} return 'https://ysawzwtmodkqqbqoiojj.supabase.co'; }
  function sbKey() { try { return (global.GMT_DB && GMT_DB.MAIN && GMT_DB.MAIN.key) || (cfgPOS() && cfgPOS().SUPABASE_KEY) || global.SUPABASE_ANON_KEY || ''; } catch (_) { return ''; } }
  function loadIndex() {
    if (IDXP) return IDXP;
    IDXP = (async function () {
      var byId = {};
      var r = await fetch('lens-index.json?v=' + (global.GMT_LENS_INDEX_V || '3'));
      if (!r.ok) throw new Error('فهرس العدسة غير موجود');
      var j = await r.json();
      if (j.v !== VER || !j.pca) throw new Error('فهرس العدسة قديم');
      var mean = new Float32Array(new Int16Array(unb64(j.pca.mean).buffer)), comp = [], scale = [];
      for (var i = 0; i < mean.length; i++) mean[i] /= 32767 / j.pca.meanMax;
      for (var k = 0; k < D; k++) { var row = new Int8Array(unb64(j.pca.comp[k]).buffer); comp.push(Float32Array.from(row, function (x) { return x / 127 * j.pca.compMax[k]; })); scale.push(1); }
      PCA = { mean: mean, comp: comp, scale: scale };
      Object.keys(j.items || {}).forEach(function (id) { byId[id] = (j.items[id] || []).map(function (x) { return { v: unpack(x), kind: 'catalog' }; }).filter(function (e) { return e.v; }); });
      try {
        var key = sbKey();
        if (key) {
          var rs = await fetch(sbBase() + '/rest/v1/gmt_lens_samples?select=product_id,vec&approved=eq.true&order=id.desc&limit=5000', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
          if (rs.ok) (await rs.json()).forEach(function (s) { var v = unpack(s.vec); if (v) (byId[s.product_id] = byId[s.product_id] || []).push({ v: v, kind: 'sample' }); });
        }
      } catch (_) {}
      try { (JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') || []).forEach(function (s) { var v = unpack(s.vec); if (v) (byId[s.pid] = byId[s.pid] || []).push({ v: v, kind: 'mine' }); }); } catch (_) {}
      IDX = byId; return byId;
    })();
    IDXP.catch(function () { IDXP = null; });
    return IDXP;
  }
  /* منتجٌ أُضيف بعد بناء الفهرس ⇒ بصمته تُحسب من صورته المصغّرة على الجهاز (مرّة في الجلسة) */
  var thumbCache = {}, HOLD = 0;
  function hold(on) { HOLD = Math.max(0, HOLD + (on ? 1 : -1)); }
  function thumbOf(url) { return String(url || '').replace(/\/img\/p\/(.+)\.(?:jpe?g|png|webp)$/i, '/img/t/$1.webp'); }
  function imgVec(url) {
    if (thumbCache[url]) return thumbCache[url];
    thumbCache[url] = new Promise(function (res) {
      var im = new Image(); im.crossOrigin = 'anonymous';
      var tries = [thumbOf(url), url].filter(function (x, i, a) { return x && a.indexOf(x) === i; }), t = 0;
      im.onload = function () { embed(im, 'catalog').then(res, function () { res(null); }); };
      im.onerror = function () { t++; if (t < tries.length) im.src = tries[t]; else res(null); };
      im.src = tries[0];
    });
    return thumbCache[url];
  }
  async function fillMissing(products, limit) {
    var idx = await loadIndex(), todo = [];
    (products || []).forEach(function (p) {
      if (idx[p.id] && idx[p.id].length) return;
      var u = p.image_url || (Array.isArray(p.images) && p.images[0]); if (u) todo.push([String(p.id), u]);
    });
    todo = todo.slice(0, limit || 30);
    for (var i = 0; i < todo.length; i++) {
      while (HOLD > 0) await new Promise(function (r) { setTimeout(r, 150); });   /* اللقطة أوّلاً: حساب صور المنتجات الجديدة ينتظر */
      var v = await imgVec(todo[i][1]); if (v) (idx[todo[i][0]] = idx[todo[i][0]] || []).push({ v: v, kind: 'catalog' });
    }
    return todo.length;
  }

  /* البحث: أعلى تشابه بين اللقطة وكلّ صور المنتج وعيّناته (العيّنة الحقيقيّة تُرجَّح قليلاً) */
  function search(q, products, k) {
    var idx = IDX || {}, out = [], qs = Array.isArray(q) ? q : (q ? [q] : []);
    if (!qs.length) return out;
    (products || []).forEach(function (p) {
      var es = idx[String(p.id)]; if (!es || !es.length) return;
      var best = -1, how = '';
      for (var i = 0; i < es.length; i++) for (var j = 0; j < qs.length; j++) { var s = sim(qs[j], es[i].v) + (es[i].kind !== 'catalog' ? 0.05 : 0); if (s > best) { best = s; how = es[i].kind; } }   /* العيّنة الحقيقيّة (علبة صوّرناها) تُرجَّح */
      out.push({ item: p, vis: best, how: how });
    });
    out.sort(function (a, b) { return b.vis - a.vis; });
    return out.slice(0, k || 8);
  }

  var zxP = null;
  function loadZX() {
    if (global.ZXing) return Promise.resolve(global.ZXing);
    if (!zxP) zxP = new Promise(function (ok, bad) { var s = doc.createElement('script'); s.src = 'lib/zxing.min.js'; s.onload = function () { global.ZXing ? ok(global.ZXing) : bad(new Error('zx')); }; s.onerror = bad; doc.head.appendChild(s); });
    zxP.catch(function () { zxP = null; });
    return zxP;
  }
  async function barcode(canvas) {
    try {
      if ('BarcodeDetector' in global) {
        var bd = new global.BarcodeDetector(); var rs = await bd.detect(canvas);
        if (rs && rs.length) return String(rs[0].rawValue || '').trim();
      }
    } catch (_) {}
    try {
      var ZX = await loadZX(), hints = new Map(), F = ZX.BarcodeFormat;
      hints.set(ZX.DecodeHintType.TRY_HARDER, true);
      var lum = new ZX.HTMLCanvasElementLuminanceSource(canvas), bmp = new ZX.BinaryBitmap(new ZX.HybridBinarizer(lum));
      var res = new ZX.MultiFormatReader(); res.setHints(hints);
      return String(res.decode(bmp).getText() || '').trim();
    } catch (_) { return ''; }
  }

  /* ── قراءة الكتابة محلّياً (Tesseract · lib/ocr) ── */
  var ocrP = null;
  var SIMD = (function () { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (_) { return false; } })();
  function getOCR() {
    if (ocrP) return ocrP;
    ocrP = (async function () {
      if (!global.Tesseract) await new Promise(function (ok, bad) { var s = doc.createElement('script'); s.src = 'lib/ocr/tesseract.min.js?v=20261016'; s.onload = ok; s.onerror = bad; doc.head.appendChild(s); });
      var base = new URL('lib/ocr/', doc.baseURI).href;
      var w = await global.Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base + (SIMD ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'), langPath: base, gzip: true, cacheMethod: 'none' });
      await w.setParameters({ tessedit_pageseg_mode: '11', user_defined_dpi: '300' });   /* بلا «Estimating resolution» في الكونسول */
      return w;
    })();
    ocrP.catch(function () { ocrP = null; });
    return ocrP;
  }
  /* (seq A1014) خطّ العلبة المائل («RL-24» مصوَّراً بميل) لا يُقرأ مستقيماً ⇒ قراءاتٌ متتالية: كما هي · مائلة −6° · +6° (رماديّ بتباينٍ أعلى ×1.6)
     — كلّ قراءة تُضاف فوراً وتُعيد الترتيب (onWords) · وتتوقّف حين يقول المستدعي «وجدت» (onWords ⇒ true) */
  function variant(src, deg) {
    var w = src.width, h = src.height, k = Math.min(1.6, 1800 / Math.max(w, h)), c = doc.createElement('canvas'), q = Math.abs(deg) === 90;
    c.width = Math.round((q ? h : w) * k); c.height = Math.round((q ? w : h) * k);
    var g = c.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.filter = 'grayscale(1) contrast(1.6)'; g.translate(c.width / 2, c.height / 2); g.rotate(deg * Math.PI / 180);
    var dw = Math.round(w * k), dh = Math.round(h * k); g.drawImage(src, -dw / 2, -dh / 2, dw, dh);
    return c;
  }
  function cleanWords(text) {
    return String(text || '').split(/\s+/).map(function (t) { return t.replace(/[^A-Za-z0-9\-+./]/g, ''); })
      .filter(function (t) { return t.length >= 2 && /[A-Za-z0-9]/.test(t) && !/^[\-+./]+$/.test(t); });
  }
  /* (TASK-A0580 · المالك seq A1139 «مايك Lavalier موجود وما تعرّف عليه») العلبة نائمة على جنبها ⇒ الكتابة عمودية فلا تُقرأ ⇒ قراءتان مدوَّرتان ٩٠° و٢٧٠°
     بعد المائلتين (تتوقّف القراءات حالما يقول المستدعي «وجدت») */
  async function ocrPasses(canvas, onWords) {
    var w = await getOCR(), all = [], passes = [0, -6, 6, 90, -90];   /* (seq A1139) الأولى رماديّة بتباين أعلى أيضاً: صور الشاشات والتموّج تُقرأ أفضل */
    for (var i = 0; i < passes.length; i++) {
      var r = null; try { r = await w.recognize(passes[i] == null ? canvas : variant(canvas, passes[i])); } catch (_) { continue; }
      all = all.concat(cleanWords(r && r.data && r.data.text)).slice(0, 90);
      if (onWords) { var stop = false; try { stop = onWords(all.slice()) === true; } catch (_) {} if (stop) break; }
    }
    return all;
  }
  async function ocr(canvas) { return ocrPasses(canvas, null); }

  /* تطابق ما قُرئ على العلبة مع المنتج — بخوارزمية البحث نفسها في النظام (GMTSuggest.hitsProduct) لا بدمجٍ خاصّ بالعدسة
     (المالك seq A1009: «ليش ما تخلّي البحث بالاسم المكسّر أو اللي بينه فواصل ينعرف لحاله بخوارزمية البرنامج لدينا»):
     الكلمات المقروءة كما هي بترتيبها (كلمة · كلمتان · ثلاث متتالية) ⇒ «YM-600- SS» يجدها البحث كما يجد «YM 600 SS» إذا كتبها الموظّف. */
  function isCode(s) { var f = String(s).replace(/[^A-Za-z0-9]/g, ''); return f.length >= 4 && /\d/.test(f) && /[A-Za-z]/.test(f); }
  function phrases(words) {
    var out = [];
    for (var i = 0; i < words.length; i++) for (var n = 1; n <= 3 && i + n <= words.length; n++) {
      var ph = words.slice(i, i + n).join(' ');
      if (isCode(ph) && (n === 1 || !isCode(words.slice(i, i + n - 1).join(' ')) || n === 2)) out.push({ q: ph, code: true, n: n });
      else if (n === 1 && /^[A-Za-z]{4,}$/.test(ph)) out.push({ q: ph, code: false, n: 1 });
    }
    return out;
  }
  /* (TASK-A0580 · المالك seq A1139) الكتابة على العلبة («Wireless Lavalier Microphone» · «Support one to two» · «Wireless Microphone») مكتوبةٌ
     حرفياً اسماً بديلاً كاملاً للمنتج — لكنّ كلماتها «عامّة» فكانت تُهمَل ⇒ جملةٌ مقروءة تساوي اسماً بديلاً **كاملاً** (كلمتان فأكثر) دليلٌ قويّ،
     يُخفَّف إن كانت الجملة نفسها اسماً بديلاً لمنتجاتٍ كثيرة (عدد المنتجات من setCatalog) */
  var PH_CNT = {};
  function altEntries(p) {
    return String(p && p.alt_names || '').split(/[،,;\n]+/).map(function (e) { return ' ' + e.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '; })
      .filter(function (e) { var t = e.trim(); return t.length >= 9 && t.split(' ').length >= 2 && !/^none ?\d*$/.test(t); });
  }
  function setCatalog(list) {
    PH_CNT = {};
    (list || []).forEach(function (p) { var seen = {}; altEntries(p).forEach(function (e) { if (!seen[e]) { seen[e] = 1; PH_CNT[e] = (PH_CNT[e] || 0) + 1; } }); });
  }
  /* كلمة مقروءة ≈ كلمة الاسم: مساواة · أو بادئة (٥ أحرف فأكثر — «Lavalie» = «Lavalier» مقطوعة) · أو فرق حرف للكلمة ≥ ٦ */
  function tokNear(a, b) {
    if (a === b) return true; if (!a || !b) return false;
    if (a.length >= 5 && b.length >= 5 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return true;
    if (a.length < 6 || Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
    return d + (a.length - i) + (b.length - j) <= 1;
  }
  function phraseScore(words, p) {
    var toks = words.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' '), txt = ' ' + toks.join(' ') + ' ', best = 0;
    altEntries(p).forEach(function (e) {
      var et = e.trim().split(' '), nw = et.length, k = PH_CNT[e] || 1, kf = (k <= 2 ? 1 : k <= 4 ? 0.75 : 0.45), s = 0;
      if (txt.indexOf(e) >= 0) s = Math.min(0.75, 0.55 + 0.05 * nw) * kf;
      else {   /* قراءةٌ ناقصة: أطول تتابع كلماتٍ متقاربة من بداية الاسم البديل (كلمتان على الأقلّ و٦٠٪ منه) */
        for (var i = 0; i < toks.length; i++) { var m = 0; while (m < nw && i + m < toks.length && tokNear(toks[i + m], et[m])) m++;
          if (m >= 2 && m >= Math.ceil(nw * 0.6) && /[a-z]{3}/.test(et.slice(0, m).join(''))) s = Math.max(s, Math.min(0.6, 0.45 + 0.05 * m) * kf); }
      }
      if (s > best) best = s;
    });
    return best;
  }
  function textScore(words, p) {
    if (!words || !words.length) return 0;
    var ps = phraseScore(words, p);
    return ps ? Math.max(ps, textScore0(words, p)) : textScore0(words, p);
  }
  function textScore0(words, p) {
    var SG = global.GMTSuggest;
    if (SG && SG.hitsProduct) {
      var key = words.join('\u0001'), ph = _PH[key] || (_PH[key] = phrases(words)), code = 0, plain = 0;
      for (var i = 0; i < ph.length; i++) {
        var x = ph[i];
        /* (seq A1013–A1015) فقط الكود كاملاً في الاسم/الأسماء البديلة يُحتسب — المطابقة الجزئية العامّة («Co» · «900g» · رقمٌ داخل باركود)
           كانت تضع «🔤 الكتابة» على اقتراحاتٍ بعيدة تماماً */
        if (x.code) { var strong = false; try { strong = !!(SG.codeNear && SG.codeNear(x.q, p)); } catch (_) {}
          if (strong) code = Math.max(code, Math.min(1, 0.6 + 0.05 * x.q.replace(/[^A-Za-z0-9]/g, '').length)); }
        else if (x.q.length >= 5 && wordIn(x.q, p)) plain += 0.06;
      }
      return Math.min(1, code + Math.min(0.3, plain));
    }
    var hay = [p.name, p.alt_names, p.brand, p.model, p.barcode].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]/g, ''), sc = 0;
    words.forEach(function (w) { var lw = w.toLowerCase().replace(/[^a-z0-9]/g, ''); if (isCode(lw) && hay.indexOf(lw) >= 0) sc += 0.5; });
    return Math.min(1, sc);
  }
  var _PH = {};
  /* النوع من الكتابة (seq A1139): «Microphone · Wireless · Lavalier» كلماتٌ عامّة لا تحدّد الموديل لكنّها تحدّد **القسم** — تصويت كلّ كلمة
     مقروءة (٤ أحرف فأكثر) على أقسام المنتجات التي تحويها كاملةً، بوزن 1/عددها. يُرجع {cat, share} أو null */
  function textType(words, list, keyOf) {
    var seen = {}, w = {}, tot = 0;
    (words || []).forEach(function (x) {
      var t = String(x).toLowerCase().replace(/[^a-z]/g, ''); if (t.length < 4 || seen[t]) return; seen[t] = 1;
      var hits = (list || []).filter(function (p) { return wordIn(t, p); }); if (!hits.length || hits.length > 120) return;
      var g = {}; hits.forEach(function (p) { var k = keyOf(p); if (k) g[k] = (g[k] || 0) + 1; });
      for (var k in g) { var v = g[k] / hits.length; w[k] = (w[k] || 0) + v; tot += v; }
    });
    var best = '', bw = 0; for (var k in w) if (w[k] > bw) { bw = w[k]; best = k; }
    return best && tot >= 1 ? { cat: best, share: bw / tot, votes: bw } : null;
  }
  /* كلمة كاملة (لا جزء كلمة) في الاسم أو الأسماء البديلة */
  function wordIn(w, p) { var hay = ' ' + String([p.name, p.alt_names].filter(Boolean).join(' ')).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ') + ' '; return hay.indexOf(' ' + String(w).toLowerCase() + ' ') >= 0; }

  /* ── التعلّم من الاختيار ── */
  /* صورة مصغّرة (≈٤ ك.ب) من اللقطة — ليرى الأدمن ما تعلّمته العدسة قبل اعتماده */
  function thumbOfCanvas(c) {
    try { if (!c || !c.width) return null; var s = 112 / Math.max(c.width, c.height), t = doc.createElement('canvas'); t.width = Math.round(c.width * s); t.height = Math.round(c.height * s);
      t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); var u = t.toDataURL('image/jpeg', 0.6); return u.length <= 16000 ? u : null; } catch (_) { return null; }
  }
  async function addSample(p, v, opts) {
    opts = opts || {};
    var packed = pack(v), admin = !!opts.admin, pid = String(p.id);
    try {
      var L = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') || [];
      L.unshift({ pid: pid, vec: packed, at: Date.now() }); localStorage.setItem(LOCAL_KEY, JSON.stringify(L.slice(0, 300)));
    } catch (_) {}
    if (IDX) (IDX[pid] = IDX[pid] || []).push({ v: v, kind: 'mine' });
    var k = sbKey(); if (!k) return false;
    try {
      var r = await fetch(sbBase() + '/rest/v1/gmt_lens_samples', {
        method: 'POST', headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ product_id: pid, product_name: String(p.name || '').slice(0, 200), vec: packed, approved: admin, approved_by: admin ? (opts.by || 'admin') : null, approved_at: admin ? new Date().toISOString() : null,
          by_name: opts.by || null, source: opts.source || null, ocr: (opts.words || []).join(' ').slice(0, 400) || null, photo_url: opts.photo || null, thumb: thumbOfCanvas(opts.canvas),
          names: (opts.names || []).filter(Boolean).join('، ').slice(0, 400) || null, from_ai: !!opts.fromAI })
      });
      return r.ok;
    } catch (_) { return false; }
  }
  /* (seq A1008) سجلّ عمليات البحث — «لحتى يتدرّب منها ولحتى أراجعها وأصحّحها»: كلّ لقطة ⇒ صفّ (ما قُرئ · أفضل ٥ · ما اختير) */
  async function logSearch(row) {
    var k = sbKey(); if (!k) return null;
    try {
      if (row.canvas) { row.thumb = thumbOfCanvas(row.canvas); delete row.canvas; }
      row.backend = BACKEND || null;
      var r = await fetch(sbBase() + '/rest/v1/gmt_lens_log', { method: 'POST', headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(row) });
      if (!r.ok) return null; var j = await r.json(); return j && j[0] && j[0].id || null;
    } catch (_) { return null; }
  }
  async function logPatch(id, row) {
    var k = sbKey(); if (!k || !id) return false;
    try { var r = await fetch(sbBase() + '/rest/v1/gmt_lens_log?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(row) }); return r.ok; } catch (_) { return false; }
  }
  /* تعلّمات الموظّفين التي تنتظر اعتماد الأدمن */
  async function pending() {
    var k = sbKey(); if (!k) return [];
    var r = await fetch(sbBase() + '/rest/v1/gmt_lens_samples?select=id,product_id,product_name,by_name,source,ocr,thumb,names,from_ai,created_at&approved=eq.false&approved_by=is.null&order=id.desc&limit=60', { headers: { apikey: k, Authorization: 'Bearer ' + k } });
    return r.ok ? r.json() : [];
  }
  async function review(id, ok, by) {
    var k = sbKey(); if (!k) return false;
    var body = ok ? { approved: true, approved_by: by || 'admin', approved_at: new Date().toISOString() } : { approved: false, approved_by: 'رُفض: ' + (by || 'admin'), approved_at: new Date().toISOString(), vec: '0:rejected' };
    var r = await fetch(sbBase() + '/rest/v1/gmt_lens_samples?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
    IDXP = null; IDX = null;   /* يُعاد تحميل الفهرس بالاعتماد الجديد */
    /* (seq A1010) ما قرأه العقل على العلبة (الاسم/الموديل) يُضاف لأسماء المنتج البديلة حين يعتمد الأدمن التجربة */
    if (r.ok && ok) {
      try {
        var row = (await r.json())[0] || {}, names = String(row.names || '').split(/،\s*/).filter(function (x) { return x.trim().length > 1; });
        if (names.length && row.product_id) {
          var g = await fetch(sbBase() + '/rest/v1/products?id=eq.' + encodeURIComponent(row.product_id) + '&select=alt_names', { headers: { apikey: k, Authorization: 'Bearer ' + k } });
          var cur = g.ok ? ((await g.json())[0] || {}).alt_names : null;
          var have = String(cur || '').split(/[،,]\s*/).map(function (x) { return x.trim(); }).filter(Boolean), low = have.map(function (x) { return x.toLowerCase(); }), add = names.filter(function (n) { return low.indexOf(n.trim().toLowerCase()) < 0; });
          if (add.length) await fetch(sbBase() + '/rest/v1/products?id=eq.' + encodeURIComponent(row.product_id), { method: 'PATCH', headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ alt_names: have.concat(add).join('، ') }) });
        }
      } catch (_) {}
    }
    return r.ok;
  }

  global.GMTLensLocal = { embed: embed, embedMulti: embedMulti, embedRaw: embedRaw, toCanvas: toCanvas, loadModel: loadModel, sim: sim, search: search, pack: pack, unpack: unpack,
    backend: function () { return BACKEND; }, warmOCR: function () { return getOCR().then(function () { return true; }, function () { return false; }); }, loadIndex: loadIndex, fillMissing: fillMissing, barcode: barcode, ocr: ocr, ocrPasses: ocrPasses, textScore: textScore, setCatalog: setCatalog, textType: textType, addSample: addSample, logSearch: logSearch, logPatch: logPatch, pending: pending, review: review, imgVec: imgVec, hold: hold, VER: VER, D: D };
})(window);
