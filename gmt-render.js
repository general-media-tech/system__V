/* ═══════════════════════════════════════════════════════════════════════════
   gmt-render.js — مُصيِّر الصور وPDF **الداخلي** (بلا خدمة خارجية، بلا مكتبة تخمّن النصّ)
   أُنشئ: 2026-10-11 · طلب المالك: «لا تستعمل خدمة خارجية لإنشاء الصور، اجعلها خدمة داخلية.
   والعربية في صورة/PDF الأوردر مشوّهة».

   لماذا كانت العربية مشوّهة؟ لأنّ html2canvas **لا يعرف الخطّ ولا التشكيل**: يقرأ نصّ الصفحة
   ويُعيد رسمه حرفاً حرفاً بنفسه، فيفقد الحرف العربيّ سياقه (شكله المتّصل واتجاهه) ويتزحزح النصّ.
   الجذر ليس في CSS الورقة بل في **طريقة الرسم**.

   الحلّ الجذري: لا نُعيد رسم شيء. المتصفّح نفسه — بمحرّك التخطيط والتشكيل الذي يعرض به الصفحة —
   يرسم الورقة، ونحن نأخذ نتيجته:
     ① إطار مخفيّ (iframe) يحمل الورقة بعرضها الحقيقي ⇒ المتصفّح يخطّطها ويشكّل العربية
     ② نُضمّن كل صورة كـ data: (الصورة الخارجية تُحجَب داخل SVG)
     ③ نُضمّن خطّ Cairo كـ data: (الخطّ بالرابط لا يُحمَّل داخل صورة SVG — جُرِّب) ونحذف @import لـGoogle
     ④ SVG/foreignObject ⇒ Image ⇒ canvas (المتصفّح يرسم HTML داخل SVG بنفس المحرّك)
     ⑤ فحوص سلامة: ليست فارغة · ليست «ملوَّثة» (tainted) ⇒ وإلا نسقط إلى html2canvas (بعد تصفير letter-spacing)
        ⇒ وإلا رسالة عربية واضحة. لا نجاح كاذب أبداً.

   الاستعمال:
     const blob = await GMTRender.toBlob(html, { width: 660, scale: 1200/660, type: 'image/jpeg', quality: .92 });
     const canvas = await GMTRender.toCanvas(html, { width: 660, scale: 2 });
     const pdf = await GMTRender.toPdf(html, { title: 'أوردر 123', fit: 'auto' });   // Blob
     GMTRender.engine   // آخر محرّك استُعمل فعلاً: 'foreignObject' | 'html2canvas'

   PDF: كاتب داخلي (A4 · هوامش ١٤ نقطة · Flate بلا فقد عبر CompressionStream مع predictor ⇒ يسقط إلى JPEG
   إن غاب · يقطع لصفحات عند أسطر فارغة · /Title). ملاحظة: الصفحة صورة (لا نصّ قابل للتحديد) كما كانت قبلاً.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';
  if (g.GMTRender) return;

  /* مسار هذا الملف (لتحميل الخطوط من lib/fonts بجواره مهما كان مسار الصفحة) */
  var SELF = '';
  try { var cs = document.currentScript; if (cs && cs.src) SELF = cs.src.replace(/[?#].*$/, '').replace(/[^\/]*$/, ''); } catch (e) {}
  function abs(rel) { try { return new URL(rel, SELF || document.baseURI).href; } catch (e) { return rel; } }

  var MSG_FAIL = 'تعذّر تجهيز الصورة على هذا الجهاز. حدّث الصفحة وأعد المحاولة، وإن تكرّر الأمر استعمل زرّ «طباعة».';
  var BLANK_PX = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  var MAX_PIXELS = 16000000;           /* سقف مساحة الكانفس — iOS يرفض ما فوق ≈١٦٫٧ مليون بكسل */

  /* ══ الخطّ: Cairo متغيّر (OFL) مستضاف في lib/fonts — نفس خطّ الموقع ══
     النطاقات = ما في ملفّ الخطّ فعلاً (قِيست من cmap) فلا يُسحَب حرفٌ إلى ملفّ لا يحوي شكله. */
  var FONT_FILES = [
    { file: 'lib/fonts/Cairo-var-arabic.woff2',
      range: 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200F,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FEFF' },
    { file: 'lib/fonts/Cairo-var-latin.woff2',
      range: 'U+0020-007E,U+00A0-00FF,U+0102,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2039-203A,U+2044,U+20AC,U+2122,U+2212,U+2215' }
  ];
  var _fontP = null, _fontAt = 0;
  var lastFontOk = false;

  function blobToDataURL(b) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; r.readAsDataURL(b); });
  }
  function timeout(ms, msg) { return new Promise(function (_, rej) { setTimeout(function () { rej(new Error(msg || 'timeout')); }, ms); }); }

  /* يرجع CSS جاهزاً (@font-face بـdata:) أو '' إن تعذّر جلب الملفّين (بلا اتصال ولا كاش) ⇒ خطّ النظام */
  function fontCss() {
    if (_fontP && (lastFontOk || Date.now() - _fontAt < 20000)) return _fontP;   /* الفشل لا يُحفَظ إلا ٢٠ث */
    _fontAt = Date.now();
    _fontP = Promise.all(FONT_FILES.map(function (f) {
      return fetch(abs(f.file), { cache: 'force-cache' }).then(function (r) {
        if (!r.ok) throw new Error('font ' + r.status);
        return r.blob();
      }).then(function (b) { return blobToDataURL(new Blob([b], { type: 'font/woff2' })); })
        .then(function (u) { return { u: u, range: f.range }; });
    })).then(function (fs) {
      lastFontOk = true;
      return fs.map(function (f) {
        return "@font-face{font-family:'Cairo';font-style:normal;font-weight:200 1000;font-display:block;" +
               "src:url(" + f.u + ") format('woff2');unicode-range:" + f.range + "}";
      }).join('\n');
    }).catch(function (e) {
      lastFontOk = false;
      try { console.warn('[GMTRender] تعذّر تحميل خطّ Cairo المستضاف — سيُستعمل خطّ النظام:', e && e.message); } catch (_) {}
      return '';
    });
    return _fontP;
  }

  /* تسخين: يُنزّل الخطّين مبكّراً (فيدخلان كاش الـservice worker) كي تعمل الصورة لاحقاً بلا إنترنت */
  function warm() {
    var go = function () { try { fontCss(); } catch (_) {} };
    if (g.requestIdleCallback) g.requestIdleCallback(go, { timeout: 6000 }); else setTimeout(go, 2500);
  }

  /* ══ تجهيز HTML ══ */
  function stripImports(css) { return css.replace(/@import\s+(?:url\((?:"[^"]*"|'[^']*'|[^)]*)\)|"[^"]*"|'[^']*')[^;]*;/gi, ''); }

  function prepHtml(html, css) {
    html = String(html == null ? '' : html);
    if (!/<html[\s>]/i.test(html)) {
      html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"></head><body style="margin:0;background:#fff">' + html + '</body></html>';
    } else if (!/^\s*<!doctype/i.test(html)) {
      html = '<!DOCTYPE html>' + html;
    }
    html = stripImports(html);                       /* لا Google @import: الخطّ يُضمَّن محلياً */
    /* أوّل ما في الرأس: لا طباعة ولا نوافذ من داخل الورقة أثناء التصيير (ورقة «طباعة» تحمل window.print) */
    var tag = '<script>try{window.print=function(){};window.open=function(){return null};}catch(e){}<\/script>' +
              '<style id="gmt-render-fonts">' + (css || '') + '</style>';
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (m) { return m + tag; });
    else html = html.replace(/<html[^>]*>/i, function (m) { return m + '<head>' + tag + '</head>'; });
    return html;
  }

  function makeFrame(W, sandbox) {
    var fr = document.createElement('iframe');
    /* السكربتات تعمل لأنّ ورقة الأوردر تضبط نفسها بسكربت (fit: تصغير/عمودان لتتّسع على A4) والصورة يجب أن تطابق الطباعة؛
       لكن بلا allow-modals/popups فلا print ولا نوافذ. */
    fr.setAttribute('sandbox', sandbox || 'allow-same-origin allow-scripts');
    fr.setAttribute('aria-hidden', 'true');
    fr.tabIndex = -1;
    fr.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + W + 'px;height:600px;border:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(fr);
    return fr;
  }

  function loadFrame(fr, html, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('انتهت مهلة فتح الورقة')); }, ms || 15000);
      fr.onload = function () { clearTimeout(t); res(fr.contentDocument); };
      fr.onerror = function () { clearTimeout(t); rej(new Error('تعذّر فتح الورقة')); };
      fr.srcdoc = html;
    });
  }

  /* ينتظر الخطوط فعلاً (لا مهلة عمياء): نطلب الوجهين العربيّ واللاتينيّ بأوزان الورقة ثم fonts.ready */
  function waitFonts(doc, hadFont) {
    if (!doc.fonts) return Promise.resolve();
    var jobs = [];
    if (hadFont) {
      [400, 600, 700, 800, 900].forEach(function (w) {
        jobs.push(doc.fonts.load(w + ' 16px Cairo', 'ا').catch(function () {}));
        jobs.push(doc.fonts.load(w + ' 16px Cairo', 'A').catch(function () {}));
      });
    }
    return Promise.race([Promise.all(jobs).then(function () { return doc.fonts.ready; }), new Promise(function (r) { setTimeout(r, 4000); })]).catch(function () {});
  }

  /* الورقة تضبط نفسها بسكربت يسمع beforeprint (fit) ⇒ نطلقه بعد جاهزية الخطوط كي تُقاس الأبعاد بالخطّ الحقيقي ثم نتركها تستقرّ */
  async function settle(doc) {
    try { doc.defaultView.dispatchEvent(new Event('beforeprint')); } catch (_) {}
    await new Promise(function (r) { setTimeout(r, 40); });
    try { doc.defaultView.dispatchEvent(new Event('beforeprint')); } catch (_) {}
    await new Promise(function (r) { setTimeout(r, 20); });
  }

  /* ارتفاع المحتوى الحقيقي. ⚠️ مع `zoom` على body يتضخّم body.scrollHeight (يُقاس بلا تكبير) بينما ارتفاع html الفعلي أقلّ
     ⇒ كانت تظهر مساحة بيضاء ضخمة أسفل الصورة. نستعمل html فقط. */
  function measureH(doc) {
    var d = doc.documentElement;
    return Math.ceil(Math.max(d.getBoundingClientRect().height, d.scrollHeight, 40));
  }
  /* سكربت الورقة يُصغّر الصفحة بـ zoom لتتّسع على ورقة طباعة واحدة (حتى ٠٫٦٢) فيصير نصّ الصورة/PDF مجهرياً — وهنا لا حاجة:
     الصورة تطول والـPDF يُقطَّع لصفحات. نُزيل الـzoom ونُبقي تصنيفات الضغط (c1..c4). ويجب أن تلي المعايرةَ والتسلسلَ مباشرةً بلا await
     (مؤقّتات fit بعد 180/600ms قد تعيد التكبير). */
  function unzoom(doc, opt) {
    if (opt && opt.keepFit) return;
    try {
      doc.body.style.zoom = '';
      if (!doc.getElementById('gmt-render-nozoom')) {     /* !important يغلب أيّ إعادة تكبير لاحقة من مؤقّتات الورقة */
        var st = doc.createElement('style'); st.id = 'gmt-render-nozoom'; st.textContent = 'body{zoom:1!important}';
        doc.head.appendChild(st);
      }
    } catch (_) {}
  }

  /* ══ تضمين الموارد: كل شيء خارجي يُحجَب داخل صورة SVG فنحوّله إلى data: ══ */
  function fetchDataURL(u, ms) {
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 9000) : null;
    return fetch(u, { mode: 'cors', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.blob(); })
      .then(blobToDataURL)
      .then(function (d) { if (t) clearTimeout(t); return d; }, function (e) { if (t) clearTimeout(t); throw e; });
  }

  async function inlineCssUrls(css, base, warns) {
    var re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g, m, jobs = [], seen = {};
    while ((m = re.exec(css))) {
      var raw = (m[1] != null ? m[1] : (m[2] != null ? m[2] : m[3])) || '';
      if (!raw || /^(data:|#)/i.test(raw) || seen[raw]) continue;
      seen[raw] = 1;
      (function (r) {
        var full; try { full = new URL(r, base).href; } catch (e) { full = r; }
        jobs.push(fetchDataURL(full).then(function (d) { seen[r] = d; }, function () { seen[r] = BLANK_PX; warns.push('css url: ' + r.slice(0, 80)); }));
      })(raw);
    }
    if (!jobs.length) return css;
    await Promise.all(jobs);
    return css.replace(re, function (all, a, b, c) {
      var raw = (a != null ? a : (b != null ? b : c)) || '';
      return seen[raw] && typeof seen[raw] === 'string' && !/^(data:|#)/i.test(raw) ? 'url("' + seen[raw] + '")' : all;
    });
  }

  async function inlineResources(doc, warns) {
    var base = doc.baseURI || document.baseURI;
    var jobs = [];
    Array.prototype.forEach.call(doc.querySelectorAll('img'), function (im) {
      var src = im.getAttribute('src') || '';
      im.removeAttribute('srcset'); im.removeAttribute('loading');
      if (!src || /^data:/i.test(src)) return;
      jobs.push((async function () {
        try {
          var full = new URL(src, base).href;
          im.setAttribute('src', await fetchDataURL(full));
        } catch (e) {
          im.setAttribute('src', BLANK_PX);            /* صورة تعذّر جلبها ⇒ بكسل شفاف (لا tainted ولا فشل كامل) */
          warns.push('img: ' + src.slice(0, 80));
        }
      })());
    });
    Array.prototype.forEach.call(doc.querySelectorAll('image,use'), function (el) {
      var h = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
      if (!h || /^(data:|#)/i.test(h)) return;
      jobs.push(fetchDataURL(new URL(h, base).href).then(function (d) { el.setAttribute('href', d); }, function () { el.removeAttribute('href'); warns.push('svg-image: ' + h.slice(0, 80)); }));
    });
    Array.prototype.forEach.call(doc.querySelectorAll('style'), function (st) {
      if (st.id === 'gmt-render-fonts') return;
      if (!/url\(/i.test(st.textContent)) return;
      jobs.push(inlineCssUrls(st.textContent, base, warns).then(function (c) { st.textContent = c; }));
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[style*="url("]'), function (el) {
      jobs.push(inlineCssUrls(el.getAttribute('style'), base, warns).then(function (c) { el.setAttribute('style', c); }));
    });
    await Promise.all(jobs);
  }

  /* قيم الحقول تعيش في الخصائص لا في الوسوم ⇒ نكتبها في الوسوم قبل التسلسل */
  function syncControls(doc) {
    Array.prototype.forEach.call(doc.querySelectorAll('input,textarea,select'), function (el) {
      try {
        if (el.tagName === 'TEXTAREA') el.textContent = el.value;
        else if (el.tagName === 'SELECT') Array.prototype.forEach.call(el.options, function (o) { if (o.selected) o.setAttribute('selected', ''); else o.removeAttribute('selected'); });
        else if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) el.setAttribute('checked', ''); else el.removeAttribute('checked'); }
        else el.setAttribute('value', el.value);
      } catch (_) {}
    });
  }

  /* ══ فحوص السلامة ══ */
  function isTainted(cv) { try { cv.getContext('2d').getImageData(0, 0, 1, 1); return false; } catch (e) { return true; } }

  /* نسبة البكسلات المختلفة عن الخلفية في نسخة مصغّرة — الورقة الحقيقية فيها نصّ وأشرطة (≥ بضعة بالمئة) */
  function inkRatio(cv, bg) {
    var w = 240, h = Math.max(8, Math.round(240 * cv.height / cv.width));
    var s = document.createElement('canvas'); s.width = w; s.height = h;
    var c = s.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, w, h); c.drawImage(cv, 0, 0, w, h);
    var d = c.getImageData(0, 0, w, h).data, n = 0, p = c.getImageData(0, 0, 1, 1).data;   /* ركن الصورة = الخلفية الفعلية */
    for (var i = 0; i < d.length; i += 4) { if (Math.abs(d[i] - p[0]) + Math.abs(d[i + 1] - p[1]) + Math.abs(d[i + 2] - p[2]) > 36) n++; }
    return n / (w * h);
  }

  function verifyCanvas(cv, bg, opt) {
    if (!cv || !cv.width || !cv.height) throw new Error('كانفس فارغ');
    if (isTainted(cv)) throw new Error('tainted');
    if (!(opt && opt.allowBlank) && inkRatio(cv, bg) < 0.004) throw new Error('blank');
    return cv;
  }

  function fitScale(W, H, scale) {
    var s = Math.max(0.5, scale || 2);
    var cap = Math.sqrt(MAX_PIXELS / Math.max(1, W * H));
    return Math.min(s, cap);
  }

  /* ══ المحرّك الأوّل: SVG foreignObject ══ */
  async function viaForeignObject(html, opt) {
    var W = opt.width || 660, bg = opt.bg || '#ffffff', warns = [];
    var css = await fontCss();
    var fr = makeFrame(W);
    try {
      var doc = await loadFrame(fr, prepHtml(html, css));
      await waitFonts(doc, !!css);
      await settle(doc);
      await inlineResources(doc, warns);
      syncControls(doc);
      Array.prototype.forEach.call(doc.querySelectorAll('script,noscript,link,iframe,object,embed,video,audio,canvas'), function (n) { n.remove(); });
      unzoom(doc, opt);
      var H = measureH(doc);
      var xml = new XMLSerializer().serializeToString(doc.documentElement)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
        '<foreignObject x="0" y="0" width="' + W + '" height="' + H + '">' + xml + '</foreignObject></svg>';
      var img = new Image(); img.decoding = 'sync';
      var loaded = new Promise(function (res, rej) { img.onload = res; img.onerror = function () { rej(new Error('svg image failed')); }; });
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await Promise.race([loaded, timeout(20000, 'svg image timeout')]);
      try { if (img.decode) await img.decode(); } catch (_) {}
      var sc = fitScale(W, H, opt.scale);
      var cv = document.createElement('canvas');
      cv.width = Math.round(W * sc); cv.height = Math.round(H * sc);
      var ctx = cv.getContext('2d');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      verifyCanvas(cv, bg, opt);
      cv._gmt = { engine: 'foreignObject', font: !!css, warns: warns, cssW: W, cssH: H };
      return cv;
    } finally { setTimeout(function () { try { fr.remove(); } catch (_) {} }, 60); }
  }

  /* ══ المحرّك الاحتياطي: html2canvas (بعد تصفير letter-spacing لأنه يكسر العربية) ══ */
  function ensureH2c() {
    if (g.html2canvas) return Promise.resolve();
    if (g.GMTLazyLib && g.GMTLazyLib.need) return g.GMTLazyLib.need('html2canvas');
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = abs('lib/html2canvas.min.js');
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error('html2canvas')); };
      document.head.appendChild(s);
    });
  }
  async function viaHtml2canvas(html, opt) {
    var W = opt.width || 660, bg = opt.bg || '#ffffff', warns = [];
    await ensureH2c();
    if (!g.html2canvas) throw new Error('html2canvas غير متاح');
    var css = await fontCss();
    var fr = makeFrame(W);
    try {
      var doc = await loadFrame(fr, prepHtml(html, css));
      try { var ls = doc.createElement('style'); ls.textContent = '*{letter-spacing:0!important;word-spacing:0!important}'; doc.head.appendChild(ls); } catch (_) {}
      await waitFonts(doc, !!css);
      await settle(doc);
      unzoom(doc, opt);
      var H = measureH(doc);
      fr.style.height = H + 'px';
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
      var sc = fitScale(W, H, opt.scale);
      var cv = await g.html2canvas(doc.body, { scale: sc, backgroundColor: bg, useCORS: true, logging: false, windowWidth: W, width: W, height: H, windowHeight: H });
      verifyCanvas(cv, bg, opt);
      cv._gmt = { engine: 'html2canvas', font: !!css, warns: warns, cssW: W, cssH: H };
      return cv;
    } finally { setTimeout(function () { try { fr.remove(); } catch (_) {} }, 60); }
  }

  /* ══ الواجهة ══ */
  var api = { engine: '', lastErrors: [], message: MSG_FAIL };

  async function toCanvas(html, opt) {
    opt = opt || {};
    var errs = [], cv;
    if (opt.engine !== 'html2canvas') {
      try { cv = await viaForeignObject(html, opt); api.engine = 'foreignObject'; api.lastErrors = []; return cv; }
      catch (e) { errs.push('foreignObject: ' + (e && e.message)); try { console.warn('[GMTRender] foreignObject فشل — سقوط إلى html2canvas:', e && e.message); } catch (_) {} }
    }
    if (opt.engine !== 'foreignObject') {
      try { cv = await viaHtml2canvas(html, opt); api.engine = 'html2canvas'; api.lastErrors = errs; return cv; }
      catch (e) { errs.push('html2canvas: ' + (e && e.message)); }
    }
    api.lastErrors = errs;
    var err = new Error(MSG_FAIL); err.code = 'RENDER_FAILED'; err.causes = errs;
    throw err;
  }

  function canvasToBlob(cv, type, quality) {
    return new Promise(function (res, rej) {
      try { cv.toBlob(function (b) { b ? res(b) : rej(new Error('blob فارغ')); }, type || 'image/jpeg', quality == null ? 0.92 : quality); }
      catch (e) { rej(e); }
    });
  }

  async function toBlob(html, opt) {
    opt = opt || {};
    var cv = await toCanvas(html, opt);
    var b = await canvasToBlob(cv, opt.type || 'image/jpeg', opt.quality);
    if (!b || !b.size) { var err = new Error(MSG_FAIL); err.code = 'RENDER_FAILED'; throw err; }
    return b;
  }

  /* ══ كاتب PDF داخلي ══ */
  var enc = new TextEncoder();
  async function deflate(u8) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      var cs = new CompressionStream('deflate');                      /* zlib == FlateDecode */
      var w = cs.writable.getWriter(); w.write(u8); w.close();
      return new Uint8Array(await new Response(cs.readable).arrayBuffer());
    } catch (e) { return null; }
  }
  function hexUtf16(s) {
    var out = 'FEFF';
    for (var i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
    return out;
  }
  /* صفّ بلا «حبر» (لا نصّ ولا أشرطة داكنة؛ الخلفيات الفاتحة وخطوط الجدول الرمادية لا تُعدّ حبراً) ⇒ فجوةٌ آمنة للقطع */
  function rowInkFree(d, W, y) {
    var o = y * W * 4;
    for (var x = 0; x < W; x++) { var i = o + x * 4; if (d[i] + d[i + 1] + d[i + 2] < 560) return false; }
    return true;
  }
  /* أفضل مكان لقطع الصفحة: أطول فجوةٍ خالية من الحبر ضمن آخر ~١٥٪ من الصفحة (حدّ الصفّ بين بندين، لا بين سطرَي اسمٍ طويل) */
  function findBreak(d, W, y0, yIdeal, sliceH) {
    var lo = Math.max(y0 + Math.floor(sliceH * 0.5), yIdeal - Math.floor(sliceH * 0.15));
    var best = -1, bestLen = 5, runEnd = -1;
    for (var y = yIdeal - 1; y >= lo; y--) {
      if (rowInkFree(d, W, y)) {
        if (runEnd < 0) runEnd = y;
        var len = runEnd - y + 1;
        var atTop = (y === lo) || !rowInkFree(d, W, y - 1);
        if (atTop && len > bestLen) { bestLen = len; best = y + Math.floor(len / 2); }
      } else runEnd = -1;
    }
    return best;
  }

  async function pdfFromCanvas(cv, o) {
    o = o || {};
    var PW = 595.28, PH = 841.89, M = o.margin == null ? 14 : o.margin;
    var W = cv.width, H = cv.height;
    var cw = PW - 2 * M, ch = PH - 2 * M;
    var k = cw / W;                                      /* نقطة لكل بكسل بعرض الصفحة كاملاً */
    var fit = o.fit || 'auto';
    var oneK = Math.min(k, ch / H);                      /* مقياس «صفحة واحدة» */
    var full = null;                                     /* بكسلات الكانفس (مرّة واحدة): للقطع الذكي وللضغط بلا فقد */
    try { full = cv.getContext('2d').getImageData(0, 0, W, H).data; } catch (_) { full = null; }
    var plan;                                            /* [{sy, sh, w, h, x}] */
    if (fit === 'one-page' || (fit === 'auto' && H * k <= ch * 1.0001) || (fit === 'auto' && oneK >= k * 0.88)) {
      var w1 = W * oneK, h1 = H * oneK;
      plan = [{ sy: 0, sh: H, w: w1, h: h1, x: (PW - w1) / 2 }];
    } else {
      var sliceH = Math.floor(ch / k), d = full;
      plan = []; var y0 = 0;
      while (y0 < H) {
        var y1 = Math.min(H, y0 + sliceH);
        if (y1 < H && d) { var br = findBreak(d, W, y0, y1, sliceH); if (br > y0) y1 = br; }
        plan.push({ sy: y0, sh: y1 - y0, w: cw, h: (y1 - y0) * k, x: M });
        y0 = y1;
      }
    }
    var pages = plan.length;
    var parts = [], pos = 0, offs = [];
    var push = function (b) { parts.push(b); pos += b.length; };
    var text = function (s) { return enc.encode(s); };
    var obj = function (no, body) { offs[no] = pos; push(text(no + ' 0 obj\n' + body + '\nendobj\n')); };
    push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    var infoNo = 3 + pages * 3;
    var kids = []; for (var p = 0; p < pages; p++) kids.push((3 + p * 3) + ' 0 R');
    obj(1, '<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>');
    obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pages + ' >>');
    var allLossless = true;
    var canFlate = typeof CompressionStream !== 'undefined' && o.lossless !== false && !!full;
    for (var pi = 0; pi < pages; pi++) {
      var pl = plan[pi], data = null, filter = '/DCTDecode', parms = '';
      if (canFlate) {
        /* RGB + predictor «Up» (PNG filter 2): الصفوف المتكرّرة (خلفية بيضاء) تُضغط جداً ⇒ ملفّ صغير وبلا فقد */
        var buf = new Uint8Array((W * 3 + 1) * pl.sh), prev = new Uint8Array(W * 3), bo = 0;
        for (var r = 0; r < pl.sh; r++) {
          var so = (pl.sy + r) * W * 4, j = 0, first = (r === 0);
          buf[bo++] = 2;
          for (var x = 0; x < W; x++, so += 4, j += 3) {
            var c0 = full[so], c1 = full[so + 1], c2 = full[so + 2];
            buf[bo++] = first ? c0 : (c0 - prev[j]) & 255;
            buf[bo++] = first ? c1 : (c1 - prev[j + 1]) & 255;
            buf[bo++] = first ? c2 : (c2 - prev[j + 2]) & 255;
            prev[j] = c0; prev[j + 1] = c1; prev[j + 2] = c2;
          }
        }
        data = await deflate(buf);
        if (data) { filter = '/FlateDecode'; parms = ' /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ' + W + ' >>'; }
      }
      if (!data) {                                       /* سقوط: JPEG عالي الجودة */
        allLossless = false;
        var sc = document.createElement('canvas'); sc.width = W; sc.height = pl.sh;
        var sx = sc.getContext('2d'); sx.fillStyle = '#fff'; sx.fillRect(0, 0, W, pl.sh); sx.drawImage(cv, 0, pl.sy, W, pl.sh, 0, 0, W, pl.sh);
        data = new Uint8Array(await (await canvasToBlob(sc, 'image/jpeg', 0.95)).arrayBuffer());
        filter = '/DCTDecode'; parms = '';
      }
      var pn = 3 + pi * 3, cn = pn + 1, im = pn + 2;
      var y = PH - M - pl.h;
      obj(pn, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW.toFixed(2) + ' ' + PH.toFixed(2) + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + cn + ' 0 R >>');
      var content = 'q\n' + pl.w.toFixed(2) + ' 0 0 ' + pl.h.toFixed(2) + ' ' + pl.x.toFixed(2) + ' ' + y.toFixed(2) + ' cm\n/Im0 Do\nQ\n';
      obj(cn, '<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream');
      offs[im] = pos;
      push(text(im + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + W + ' /Height ' + pl.sh + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ' + filter + parms + ' /Length ' + data.length + ' >>\nstream\n'));
      push(data); push(text('\nendstream\nendobj\n'));
    }
    var now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    obj(infoNo, '<< /Title <' + hexUtf16(String(o.title || 'GMT')) + '> /Creator (GMT) /Producer (GMT) /CreationDate (D:' + now + 'Z) >>');
    var xr = pos, x = 'xref\n0 ' + (infoNo + 1) + '\n0000000000 65535 f \n';
    for (var i = 1; i <= infoNo; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    x += 'trailer\n<< /Size ' + (infoNo + 1) + ' /Root 1 0 R /Info ' + infoNo + ' 0 R >>\nstartxref\n' + xr + '\n%%EOF\n';
    push(text(x));
    return { blob: new Blob(parts, { type: 'application/pdf' }), pages: pages, lossless: allLossless, widthPx: W, heightPx: H };
  }

  /* src: ورقة HTML (نصّ) أو canvas جاهز ⇒ Blob من نوع application/pdf (والتفاصيل في GMTRender.lastPdf) */
  async function toPdf(src, opt) {
    opt = opt || {};
    var cv = (typeof src === 'string') ? await toCanvas(src, { width: opt.width || 660, scale: opt.scale || 2.5, bg: opt.bg, engine: opt.engine }) : src;
    var r = await pdfFromCanvas(cv, opt);
    api.lastPdf = { pages: r.pages, lossless: r.lossless, engine: (cv._gmt && cv._gmt.engine) || '' };
    return r.blob;
  }

  api.toCanvas = toCanvas; api.toBlob = toBlob; api.toPdf = toPdf; api.pdfFromCanvas = pdfFromCanvas;
  api.canvasToBlob = canvasToBlob; api.fontCss = fontCss; api.warm = warm;
  api._prepHtml = prepHtml; api._inkRatio = inkRatio;
  api.lastPdf = null;
  g.GMTRender = api;
})(window);
