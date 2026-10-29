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
  var HC = {}, LSK = 'gmt_imghash_v1', LS = null;
  /* البصمات تُحفظ في المتصفّح (٦٤ بت = ١٦ حرفاً) ⇒ «التحليل الكامل» الثاني لا يعيد تنزيل الصور */
  function lsGet() { if (LS) return LS; try { LS = JSON.parse(localStorage.getItem(LSK) || '{}') || {}; } catch (_) { LS = {}; } return LS; }
  var lsT = 0;
  function lsPut(url, bits) {
    var m = lsGet(), h = ''; for (var i = 0; i < 64; i += 4) h += (bits[i] * 8 + bits[i + 1] * 4 + bits[i + 2] * 2 + bits[i + 3]).toString(16);
    m[url] = h; clearTimeout(lsT);
    lsT = setTimeout(function () { try { var k = Object.keys(m); if (k.length > 4000) k.slice(0, k.length - 4000).forEach(function (x) { delete m[x]; }); localStorage.setItem(LSK, JSON.stringify(m)); } catch (_) {} }, 400);
  }
  function lsBits(h) { var b = []; for (var i = 0; i < 16; i++) { var v = parseInt(h[i], 16); b.push(v >> 3 & 1, v >> 2 & 1, v >> 1 & 1, v & 1); } return b; }
  function imgHash(url) {
    if (!url || !/^(https?:|data:|blob:)/i.test(url)) return Promise.resolve(null);
    if (HC[url]) return HC[url];
    if (!/^(data:|blob:)/i.test(url)) { var hit = lsGet()[url]; if (hit && hit.length === 16) return (HC[url] = Promise.resolve(lsBits(hit))); }
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
          if (!/^(data:|blob:)/i.test(url)) lsPut(url, bits);
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

  /* ══ (المالك seq 216 «الأداة غبية: تربط هوداً بعدسة · لا تعرف أقسام الإكسسوار والبانيل ليد») نوع المنتج ══
     من الاسم أوّلاً ثمّ من المجموعة/القسم — والمطابقة لا تجمع نوعين مختلفين أبداً. الترتيب مقصود (الأدقّ أوّلاً):
     «كفر سيليكون 90d» كفرٌ لا كاميرا · «Canon EF 70-200 هود» هودٌ لا عدسة · «Canon 250D with lens 18-55» كاميرا لا عدسة */
  var TYPES = [
    ['gift', 'هدية/تذكار', /كوب حراري|كوب على شكل|\bmug\b|ميدالي|keychain/],
    ['screen', 'حماية شاشة', /لزق|حمايه شاشه|واقي شاشه|screen ?protector|glass protector/],
    ['strap', 'قشاط/حزام', /قشاط|strap|حزام/],
    ['cover', 'كفر', /كفر|cover|سيليكون|silicone|جلده/],
    ['hood', 'هود', /هود|\bhood|\b(et|ew|es|hb|lh)[- ]?\d/],
    ['cap', 'غطاء', /غطا|\bcaps?\b|اغطيه/],
    ['filter', 'فلتر', /فلتر|filter|\bnd\d|\bcpl\b|\buv\b/],
    ['battery', 'بطارية', /بطاري|battery|battry|\blp[- ]?e\d|\bnp[- ]?f ?\d|\bbwx|\bnb[- ]?\d/],
    ['charger', 'شاحن', /شاحن|charger|\blc[- ]?e ?\d/],
    ['adapter', 'محوّل', /ادابتر|اداپتر|adapter|adaptor|محول/],
    ['trigger', 'تريغر', /تريغر|تريجر|trigger|\bx2\b|xpro/],
    ['flash', 'فلاش', /فلاش|\bflash|speedlite|\bv1\b|v860|v100|430ex|tt685/],
    ['gimbal', 'مانع اهتزاز', /اوزمو|osmo|رونين|ronin|مانع اهتزاز|gimbal|stabili|merak|\brs ?\d/],
    ['action', 'كاميرا أكشن', /اكشن|action|pocket ?\d|pocet/],
    ['mic', 'مايك', /مايك|ميكروفون|مايكروفون|\bmic\b|microphone|lavalier|\bk1[58]\b|\bsx ?\d{2}|interview|\brode\b|røde|بودكاست/],
    ['drone', 'درون', /درون|drone|avata|mavic|\bneo\b|\bflip\b|\bmini ?[234]\b|\bair ?[23]\b|\bfvp\b|\bfpv\b/],
    ['bag', 'حقيبة', /حقيب|شنتا|\bbag\b|backpack/],
    ['tripod', 'ترايبود/ستاند', /ترايبود|tripod|ستاند|\bstand\b|np[- ]?\d{4}/],
    ['studio', 'سوفت بوكس/عاكس', /سوفت|softbox|عاكس|عكس اضا|reflector|قمع|ستوديو|استوديو|كروما|chroma|اوكتا|octa|بالون|مظل|umbrella|خلفيه|backdrop|غريد|grid/],
    ['tube', 'تيوب لايت', /تيوب|\btube|stick light|انبوب|نيون/],
    ['ring', 'رينغ لايت', /رينغ|ring ?light|حامل تصوير منتجات/],
    ['handlight', 'كف إضاءة', /كف |كف$|كف\b|pocket light|mobile led|\bvl\d|\bs0\d|\bw150|\bd1[02]s|\bm160/],
    ['panel', 'بانيل ليد', /بانيل|panel|لوح|لوحيه|\bled[- ]?\d{3}|\bpl ?\d|\bpf ?\d|\bpm ?\d|\brl ?\d|\bm[67]{3}\b|a118|f99|r900|mm[- ]?\d{3}/],
    ['head', 'رأس إضاءة', /هيد|\bhead|راس|رأس|\bcob\b|\bym[- ]?s?\d|zu ?60|\btj ?\d|\bt\d{3}|ml\d{3}|bd-600/],
    ['holder', 'هولدر هاتف', /هولدر|holder|ماغ ?سيف|mag ?safe|suction|شفط|مقبض كاميرا هاتف/],
    ['camera', 'كاميرا', /كاميرا|كمرا|camera|\beos\b|\b\d{1,4} ?d\b|\br ?\d{1,2}\b ?(mark|body|kit)?|\brp\b|\bm50\b|بودي|\bbody\b/],
    ['lens', 'عدسة', /عدس|\blens|\blins|\b\d{2,3}[-_ ]\d{2,3}\b|\b\d{2,3} ?mm\b|\bf ?\/? ?\d(\.\d)?\b|\bstm\b|\busm\b|\bart\b|sigma|yongnuo|يونغو/],
    ['memory', 'ذاكرة', /ذاكره|\bsd\b|ميموري|memory|كرت/]
  ];
  function tnorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[_]/g, ' '); }
  /* أوصافٌ لا تحدّد النوع: «رأس إضاءة مع بطارية مدمجة» رأسٌ لا بطارية */
  var DESC = /(مع|و|يعمل|تعمل) ?(ال)?(ب)?(ال)?بطاري\S*( مدمجه)?|بالبطاري\S*|مع ريمونت|بالكهرباء|battery ?powered|\(batterypowered\)/g;
  function typeIn(t) { t = tnorm(t).replace(DESC, ' '); for (var i = 0; i < TYPES.length; i++) if (TYPES[i][2].test(t)) return TYPES[i][0]; return ''; }
  /* النوع: من الاسم · وإلّا من المجموعة (الجرد) أو القسم (المتجر) — «M777» وحده في «بانيل ليد» ⇐ بانيل */
  function typeOf(name, group) { return typeIn(name) || typeIn(group) || ''; }
  function typeLabel(k) { var t = TYPES.filter(function (x) { return x[0] === k; })[0]; return t ? t[1] : ''; }
  /* أنواعٌ متجاورة (المنتج نفسه قد يُصنَّف هنا أو هناك): تُقبل بخصمٍ بسيط — وما عداها لا يُجمع أبداً */
  var NEAR = { panel: { handlight: 1, ring: 1 }, handlight: { panel: 1, head: 1, tube: 1, ring: 1 }, head: { handlight: 1 }, tube: { handlight: 1 }, ring: { panel: 1, handlight: 1 },
    gimbal: { action: 1 }, action: { gimbal: 1, camera: 1 }, camera: { action: 1 }, trigger: { flash: 1 }, flash: { trigger: 1 }, holder: { tripod: 1 }, tripod: { holder: 1 } };
  function typeRel(a, b) { return !a || !b ? 'unknown' : a === b ? 'same' : NEAR[a] && NEAR[a][b] ? 'near' : 'diff'; }

  /* ── رمز الموديل «الملتصق» (المالك seq 216): «L12ترايبود» = «L 12» · «Q12S» = «Q12 s» · «MM4028-RGBW» ≈ «MM4028 RGB» ·
     «RS4MINI» = «rs4 mini» · «لوح 660 pro» = «Led 660 pro» — الرقم مع حرفه الأيسر وذيله الأيمن، والوحدات (300w · 24mm · 4k · 360°) ليست موديلاً ── */
  var UNIT = /^(w|mm|cm|m|k|p|inch|mah|v|g|kg|fps|hz|gb|tb|x|ml|l|wh|lm|lux|cri|in)$/;
  var GENL = { led: 1, light: 1, canon: 1, godox: 1, dji: 1, eos: 1, osmo: 1, mobil: 1, mobile: 1, sigma: 1, yongnuo: 1, ulanzi: 1, neepho: 1, mamen: 1, nicefoto: 1, rgb: 1, rgbw: 1, f: 1, ef: 1, rf: 1, efs: 1, mini: 1, pro: 1, new: 1 };
  var SUFX = { pro: 1, s: 1, d: 1, se: 1, max: 1, mini: 1, plus: 1, ii: 1, iii: 1, iv: 1, a: 1, b: 1, c: 1, p: 1, rgb: 1, rgbw: 1, bi: 1, ultra: 1, combo: 1, compo: 1, nh: 1, n: 1 };
  function modelKeys(p) {
    var s = String((p && typeof p === 'object' ? (p.name || p.short_name) : p) || '').toLowerCase().replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
      .replace(/mark ?(iii|3)\b|mk ?iii/g, ' iii ').replace(/mark ?(ii|2)\b|mk ?ii/g, ' ii ').replace(/([a-z]{1,3})[-－]([a-z]{1,2}\d)/g, '$1$2');   // LP-E17 = LPE17
    var segs = s.replace(/[؀-ۿ]+/g, ' | ').replace(/[,;:()（）\[\]{}|]+/g, ' | ').split('|'), out = [];
    segs.forEach(function (seg) {
      var at = seg.replace(/(\d)\.(\d)/g, '$1§$2').match(/[a-z]+|\d+(§\d+)?/g) || [];
      for (var i = 0; i < at.length; i++) {
        var a = at[i]; if (!/^\d+$/.test(a)) continue;                       // عشريّ (2.8 · 1.4) ليس موديلاً
        var R = at[i + 1] || '', L = at[i - 1] || '';
        if (R && UNIT.test(R)) continue;                                    // 300w · 24mm · 4k
        if (a === '360') continue;                                          // دوران 360 درجة
        if (/^\d+$/.test(L) && L.length >= 2 && a.length >= 2) continue;   // نطاق عدسة 24-105 (للنصّ لا للموديل)
        var l = /^[a-z]+$/.test(L) ? L : '', R2 = at[i + 2] || '', fx = function (x) { return x === 'p' ? 'pro' : x === 'combo' ? 'compo' : x === 'rgbw' ? 'rgb' : x; };
        var r = /^[a-z]+$/.test(R) && SUFX[R] ? fx(R) + (SUFX[R2] && /^[a-z]+$/.test(R2) ? ' ' + fx(R2) : '') : '';   // «6d ii» ≠ «6d»
        if ((!l || GENL[l]) && !r && a.length < 3) continue;                // «2» وحده لا يكفي · «660» و«6d» و«osmo 7»؟ (osmo عامّ) لا
        out.push({ l: l, n: a, r: r });
      }
    });
    return out;
  }
  /* ٠–١: ٠٫٩ الموديل نفسه بحرفه وذيله · ٠٫٧ الحرف عامٌّ أو غائبٌ في أحدهما (660 pro = led 660 pro) · ٠٫٥٥ الذيل في أحدهما فقط (Q12 ≈ Q12S — جيلٌ آخر غالباً)
     −١ = لكلٍّ منهما موديلٌ ولا يلتقيان (Osmo 7 ≠ Osmo Pocket 3) */
  function codeScore(a, b) {
    var A = a._mk || (a._mk = modelKeys(a)), B = b._mk || (b._mk = modelKeys(b)), best = 0;
    A.forEach(function (x) { B.forEach(function (y) {
      if (x.n !== y.n) return;
      var lOk = x.l === y.l ? 2 : (!x.l || !y.l || GENL[x.l] || GENL[y.l]) ? 1 : 0; if (!lOk) return;
      if ((!x.l || GENL[x.l]) && (!y.l || GENL[y.l]) && x.n.length < 3 && !(x.r && x.r === y.r)) return;
      var rOk = x.r === y.r, rPart = !x.r || !y.r || x.r.indexOf(y.r + ' ') === 0 || y.r.indexOf(x.r + ' ') === 0;
      var v = lOk === 2 ? (rOk ? 0.9 : rPart ? 0.55 : 0.3) : (rOk ? 0.7 : rPart ? 0.4 : 0);   // R6 II ≠ 6D
      if (v > best) best = v;
    }); });
    return !best && A.length && B.length ? -1 : best;
  }
  /* الماركة من الاسم (بالعربي أو الإنجليزي) — ماركتان مختلفتان ⇒ منتجان مختلفان غالباً (Godox M2 ≠ Hollyland Lark M2) */
  var BRANDS = [['canon', /canon|كانون/], ['godox', /godox|جودوكس|غودوكس/], ['dji', /\bdji\b|osmo|ronin|mavic|avata/], ['sigma', /sigma|سيجما|سيغما/],
    ['yongnuo', /yongnuo|yongo|yonugnuo|يونغو|يونغنو/], ['ulanzi', /ulanzi|يولنزي|اولانزي/], ['hollyland', /hollyland|\blark\b/], ['rode', /\brode\b|røde|رود/],
    ['boya', /\bboya\b|بويا/], ['saramonic', /saramonic/], ['mamen', /mamen/], ['telesin', /telesin|تلسن/], ['neepho', /neepho|\bnp[- ]?\d{4}/], ['nicefoto', /nice ?foto|نايس فوتو/],
    ['tolifo', /tolifo/], ['zhiyun', /zhiyun/], ['insta360', /insta ?360/], ['sony', /\bsony\b|سوني/], ['nikon', /nikon|نيكون/], ['tarion', /tarion/],
    ['koson', /koson/], ['ripoint', /ripoint/], ['tamron', /tamron/], ['viltrox', /viltrox/], ['sandisk', /sandisk/]];
  function brandOf(p) { var t = tnorm(p && typeof p === 'object' ? [p.name, p.short_name, p.brand].filter(Boolean).join(' ') : p); for (var i = 0; i < BRANDS.length; i++) if (BRANDS[i][1].test(t)) return BRANDS[i][0]; return ''; }
  /* «تحليلٌ كامل» لزوجٍ واحد (متجر ⇐ جرد) — ctx: { ts, ti: النوعان · grp: true/false/null المجموعة تقابل القسم · img: تشابه الصورة أو null }
     يُرجع { score, why: [أسباب قصيرة] } أو null إن كانا نوعين مختلفين (هودٌ وعدسة لا يجتمعان) */
  function pairScore(src, item, ctx) {
    ctx = ctx || {};
    var rel = typeRel(ctx.ts, ctx.ti); if (rel === 'diff') return null;
    var why = [], t = textScore(src, item), lensy = /^(lens|cap|filter)$/.test(ctx.ts || ctx.ti || '')   /* أرقامها أقطارٌ وأطوالٌ بؤرية لا موديلات */;
    var c = lensy ? 0 : codeScore(src, item), s = Math.max(t, c);
    if (c < 0) s *= 0.6;
    else if (!lensy && !c && (src._mk.length ? 1 : 0) + (item._mk.length ? 1 : 0) === 1) s *= 0.85;   // لأحدهما رقم موديل لا يحمله الآخر (Neo ≠ Neo 2)
    var b1 = brandOf(src), b2 = brandOf(item), bDiff = b1 && b2 && b1 !== b2;
    if (b1 && b2 && !bDiff) why.push('نفس الماركة');
    if (c >= 0.7) why.push('الموديل نفسه'); else if (c >= 0.5) why.push('موديلٌ قريب'); else if (t >= 0.5) why.push('الاسم');
    if (rel === 'same') { why.push('نفس النوع'); s = s * 1.05 + 0.03; } else if (rel === 'near') { why.push('نوعٌ قريب'); s *= 0.88; }
    if (ctx.grp === true) { why.push('نفس المجموعة'); s += 0.08; } else if (ctx.grp === false) s *= 0.85;
    var p1 = Number(src.price) || 0, p2 = Number(item.price) || 0;
    if (p1 > 0 && p2 > 0) { var q = Math.max(p1, p2) / Math.min(p1, p2); if (q > 3) { s *= 0.7; why.push('السعر بعيد'); } else if (q <= 1.35) { s += 0.04; why.push('السعر قريب'); } }
    if (ctx.img != null) {
      if (ctx.img >= 0.97) { s = Math.max(s, 0.72); why.push('الصورة نفسها'); }
      else if (ctx.img >= 0.88) { s += 0.12; why.push('صورة ' + Math.round(ctx.img * 100) + '%'); }
      else if (ctx.img >= 0.8) s += 0.04;
    }
    if (bDiff) { s *= 0.35; why.unshift('ماركة مختلفة'); }               // في الآخر: لا تعوّضها المجموعة ولا السعر
    if (c < 0) why.unshift('موديلٌ مختلف');
    return { score: Math.min(1, s), text: t, code: c, why: why };
  }
  global.GMTMatch = { typeOf: typeOf, typeIn: typeIn, typeLabel: typeLabel, typeRel: typeRel, modelKeys: modelKeys, brandOf: brandOf, codeScore: codeScore, pairScore: pairScore,
    textScore: textScore, rank: rank, refine: refine, ai: ai, imgHash: imgHash, imgSim: imgSim, _bag: bag };
})(typeof window !== 'undefined' ? window : this);
