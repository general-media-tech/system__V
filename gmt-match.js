/* gmt-match.js — مطابقة منتجات المتجر بالجرد «بحثاً عميقاً» لا بالاسم الحرفي (المالك seq 209)
   «أداة البحث اللي بتقارن منتجات المتجر مع منتجات الجرد ليس فقط على الاسم الحرفي لأنّه أحياناً بيكون الاسم على الجرد غير الاسم
   تماماً على المتجر — وإنّما تبحث عميق: يشتغل العقل أو الذكاء سواء يراجع الصور أو النصوص أو البحث».
   ثلاث طبقات، الأرخص أوّلاً:
     ① النصّ: رموز الموديل (77D · RF 24-105 · LP-E6NH) بوزنٍ ثلاثي · الأسماء البديلة والإنجليزي والماركة والموديل من المواصفات ·
        تطبيع العربي (gmt-suggest: «كانون» = canon · «٢٤-٧٠» = 24 70 · r6ii = r6 2) — درجةٌ ٠–١
     ② الصورة: بصمة إدراكية (dHash ٦٤ بت) لصورة المصدر والمرشّحين الأقرب — الصورة نفسها بعد قصٍّ أو ضغطٍ تبقى قريبة
     ③ العقل: يُعطى المصدر وأقرب المرشّحين (اسماً وماركةً وموديلاً وسعراً) فيختار المطابق أو «لا شيء» ويقول لماذا */
(function (global) {
  'use strict';
  var S = global.GMTSuggest;
  function norm(s) {
    s = String(s == null ? '' : s);
    if (S && S.key) return S.key(s);
    return s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\w؀-ۿ]+/g, ' ').trim();
  }
  var STOP = { canon: 1, lens: 1, camera: 1, for: 1, with: 1, the: 1, and: 1, 'عدسه': 1, 'كاميرا': 1, 'كمرا': 1, 'كانون': 1, 'مع': 1, 'ل': 1, 'من': 1, mm: 1 };
  function isCode(t) { return /[a-z]/.test(t) && /\d/.test(t) || /^\d{2,4}$/.test(t); }
  /* علامات الجيل والنسخة: تفرّق منتجين بالرمز نفسه (24-105 STM ≠ 24-105 L USM · R6 ≠ R6 II) */
  var VAR = { stm: 1, usm: 1, l: 1, is: 1, ii: 1, iii: 1, iv: 1, '2': 1, '3': 1, mark: 1, mk: 1, nh: 1, n: 1, pro: 1, dn: 1, dg: 1, art: 1, macro: 1 };
  /* كل نصوص المنتج التي يُعرف بها (الاسم · المختصر · البديلة · كلمات البحث · الماركة والموديل والإنجليزي من المواصفات) */
  function textOf(p) {
    if (!p) return '';
    var sp = p.specs && typeof p.specs === 'object' && !Array.isArray(p.specs) ? p.specs : {};
    return [p.name, p.short_name, p.short, p.name_en, p.alt_names, p.search_terms, p.brand, p.model, sp.__brand, sp.__model, p.sku].filter(Boolean).join(' ');
  }
  function bag(p) {
    var raw = norm(textOf(p)).replace(/([a-z])(\d)/g, '$1$2').split(/\s+/).filter(Boolean), m = {};
    raw.forEach(function (t) {
      t = t.replace(/^-+|-+$/g, ''); if (!t || STOP[t] || t.length < 2 && !/\d/.test(t)) return;
      m[t] = isCode(t) ? 3 : VAR[t] ? 2 : 1;
      /* «24-105» ⇒ «24» «105» أيضاً · «rf24-105» ⇒ «rf» */
      t.split(/[-\/]/).forEach(function (u) { if (u && u !== t && !STOP[u] && (u.length >= 2 || /\d/.test(u))) m[u] = Math.max(m[u] || 0, isCode(u) ? 2 : 1); });
    });
    return m;
  }
  function textScore(a, b) {
    var A = a._mb || (a._mb = bag(a)), B = b._mb || (b._mb = bag(b)), sa = 0, sb = 0, both = 0, codeHit = 0, codeA = 0;
    Object.keys(A).forEach(function (k) { sa += A[k]; if (A[k] >= 3) codeA++; if (B[k]) { both += Math.min(A[k], B[k]); if (A[k] >= 3 && B[k] >= 2) codeHit++; } });
    Object.keys(B).forEach(function (k) { sb += B[k]; });
    if (!sa || !sb) return 0;
    var s = 2 * both / (sa + sb);
    if (codeA && !codeHit) s *= 0.55;
    var miss = 0; Object.keys(A).forEach(function (k) { if (A[k] === 2 && VAR[k] && !B[k]) miss++; }); Object.keys(B).forEach(function (k) { if (B[k] === 2 && VAR[k] && !A[k]) miss++; });
    if (miss) s *= Math.pow(0.85, Math.min(miss, 3));      // جيلٌ/نسخةٌ مختلفة ⇒ أبعد                     // للمصدر رمز موديل ولا يحمله المرشّح ⇒ غالباً منتجٌ آخر (هود EW-73D ≠ EW-83M)
    var bc1 = String(a.barcode || '').trim(), bc2 = String(b.barcode || '').trim();
    if (bc1 && bc1 === bc2) s = Math.max(s, 0.99);
    return Math.min(1, s);
  }
  function rank(src, list) {
    return list.map(function (x) { return { item: x, text: textScore(src, x), img: null, score: 0 }; })
      .map(function (r) { r.score = r.text; return r; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  /* ── ② بصمة الصورة (dHash) ── */
  var HC = {};
  function imgHash(url) {
    if (!url || !/^(https?:|data:|blob:)/i.test(url)) return Promise.resolve(null);
    if (HC[url]) return HC[url];
    HC[url] = new Promise(function (res) {
      var im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
      try { im.dataset.gimgAllow = '1'; } catch (_) {}      // حارس الصور (gmt-image-guard) كان يضع نائباً ١×١ ⇒ كل البصمات واحدة
      var t = setTimeout(function () { res(null); }, 8000);
      im.onload = function () {
        clearTimeout(t);
        try {
          var c = document.createElement('canvas'); c.width = 9; c.height = 8;
          var x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, 9, 8); x.drawImage(im, 0, 0, 9, 8);
          var d = x.getImageData(0, 0, 9, 8).data, g = [], bits = [];
          for (var i = 0; i < 72; i++) g.push(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114);
          for (var y = 0; y < 8; y++) for (var k = 0; k < 8; k++) bits.push(g[y * 9 + k] > g[y * 9 + k + 1] ? 1 : 0);
          res(bits);
        } catch (_) { res(null); }                         // صورة بلا CORS ⇒ لا بصمة (لا خطأ)
      };
      im.onerror = function () { clearTimeout(t); res(null); };
      im.src = url;
    });
    return HC[url];
  }
  function imgSim(h1, h2) { if (!h1 || !h2) return null; var d = 0; for (var i = 0; i < 64; i++) if (h1[i] !== h2[i]) d++; return 1 - d / 64; }
  /* أقرب n بالنصّ (+ كل من يشارك المصدر رمزاً) ⇒ تُقارن صورها ⇒ الدرجة = نصّ ٦٥٪ + صورة ٣٥٪ (أو النصّ وحده بلا صورة) */
  async function refine(src, ranked, imgOf, n) {
    var hs = await imgHash(imgOf(src, true)); if (!hs) return ranked;
    var top = ranked.slice(0, n || 30);
    await Promise.all(top.map(async function (r) { var h = await imgHash(imgOf(r.item, false)); r.img = imgSim(hs, h); }));
    ranked.forEach(function (r) {
      /* الصورة شبه نفسها (≥٩٧٪) ترفع ولو اختلف الاسم كلّياً — هذا بالضبط «الاسم على الجرد غير الاسم على المتجر» */
      r.score = r.img == null ? r.text : (r.img >= 0.97 ? Math.max(0.7, 0.4 * r.text + 0.6 * r.img) : 0.65 * r.text + 0.35 * r.img * (r.text > 0.15 ? 1 : 0.4));
    });
    return ranked.sort(function (a, b) { return b.score - a.score; });
  }

  /* ── ③ العقل ── */
  var SYS = 'أنت تطابق منتجاً من متجرٍ إلكتروني بمنتجٍ في جرد المحلّ (كاميرات وعدسات وإكسسوارات تصوير). الأسماء تختلف كتابةً ولغةً ' +
    '(عربي/إنجليزي · اختصارات · ترتيب) — المطابق هو **المنتج نفسه** (الموديل نفسه والجيل نفسه: R6 ≠ R6 Mark II · EW-73D ≠ EW-73B · 24-105 f/4L ≠ 24-105 STM). ' +
    'إن لم يكن بين المرشّحين المنتج نفسه فالجواب null. أعد JSON فقط: {"pick": رقم المرشّح أو null, "confidence": 0-100, "why": "سبب قصير بالعربية"}';
  function line(p, i) {
    var sp = p.specs && typeof p.specs === 'object' && !Array.isArray(p.specs) ? p.specs : {};
    return (i != null ? '[' + i + '] ' : '') + [p.name || p.short_name, p.alt_names, p.brand || sp.__brand, sp.__model || p.model, p.price ? '$' + p.price : ''].filter(Boolean).join(' · ').slice(0, 220);
  }
  async function ai(src, ranked, n) {
    var B = global.GMTBrain; if (!B || !B.askJSON) throw new Error('عقل النظام لم يُحمَّل');
    var top = ranked.slice(0, n || 12);
    var q = 'المصدر: ' + line(src) + '\nالمرشّحون:\n' + top.map(function (r, i) { return line(r.item, i + 1); }).join('\n');
    var j = await B.askJSON(q, SYS);
    if (!j) throw new Error('لم يردّ العقل');
    var k = j.pick == null ? null : parseInt(j.pick, 10);
    return { item: k && top[k - 1] ? top[k - 1].item : null, confidence: Math.max(0, Math.min(100, parseInt(j.confidence, 10) || 0)), why: String(j.why || '').slice(0, 200) };
  }

  global.GMTMatch = { textScore: textScore, rank: rank, refine: refine, ai: ai, imgHash: imgHash, imgSim: imgSim, _bag: bag };
})(typeof window !== 'undefined' ? window : this);
