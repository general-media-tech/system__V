/* ═══════════════════════════════════════════════════════════════════════════
   gmt-sticker.js — ملصق الكفالة: ملفّ PDF بمقاس الملصق نفسه + مشاركة + طباعة
   أُنشئ: 2026-10-27 · TASK-0195 (المالك seq 133)

   طلبُك: «شوف الخطا يلي عم بيصير عن طباعه ملصق الكفاله هذا الشيء غلط ايضا ما في زر مشاركه pdf».
   ما كان: نافذةٌ منبثقة تُطبع بـ window.print ومقاسها في @page. طباعة الهاتف (وحفظه PDF) تتجاهل @page وتطبع على A4 ⇐
           الملصق صغيرٌ جداً وسط ورقة A4 فارغة، ومقاس ١٠٠×٥٠ كان يقصّ آخر النصّ. والـQR من خدمةٍ خارجية (بلا إنترنت ⇐ مربّعٌ فارغ).
   الآن: الملصق يُرسم بنفسه على لوحٍ بمقاسه الحقيقي (١٢ بكسل لكل مم) ثمّ يصير ملفّ PDF صفحته بمقاس الملصق تماماً:
     · «📤 مشاركة PDF» ⇐ لوحة المشاركة (واتساب · الطابعة · …) أو تنزيلٌ على الكمبيوتر.
     · «🖨️ طباعة» ⇐ على الكمبيوتر: حوار الطباعة بورقةٍ بمقاس الملصق · على الهاتف: الملفّ نفسه للمشاركة (فيها «طباعة»).
     · الـQR يُبنى على الجهاز (ZXing في lib/) — بلا إنترنت.
   الشكل كما هو (الكرت القديم): «Official Warranty» يساراً وشعار Canon يميناً بخطٍّ أحمر تحتهما · QR يساراً و«أهلاً بك: الاسم»
   بالأحمر وسطر الشكر و«امسح الباركود للحصول على معلومات كفالتكم» · خطٌّ متقطّع ثمّ شعار الشركة ونصّ «هذه الكفالة ممنوحة…».

   GMTSticker.open({ link, name })      نافذة الملصق (المقاس · معاينة · مشاركة · طباعة · تنزيل)
   GMTSticker.pdf({ link, name, size }) ⇒ Promise<Blob>       (للفحص)
   GMTSticker.qr(text)                  ⇒ Promise<dataURL|null> رمز QR محلّي
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTSticker) return;

  var SIZES = [
    { k: '100x50', t: 'ملصق ١٠٠×٥٠ مم (طابعة ملصقات)', w: 100, h: 50 },
    { k: '80x50', t: 'ملصق ٨٠×٥٠ مم', w: 80, h: 50 },
    { k: '100x70', t: 'ملصق ١٠٠×٧٠ مم', w: 100, h: 70 },
    { k: 'A6', t: 'ورقة A6 (أفقية)', w: 148, h: 105 },
    { k: 'A5', t: 'ورقة A5 (أفقية)', w: 210, h: 148 }
  ];
  var LS = 'gmt_warranty_sticker_size', PX = 12, RED = '#D5001C';
  var FONT = "Cairo, 'Segoe UI', Tahoma, Arial, sans-serif";

  function sizeOf(k) { for (var i = 0; i < SIZES.length; i++) if (SIZES[i].k === k) return SIZES[i]; return SIZES[0]; }
  /* الافتراضي A5 كما كان (البند ١١٨: «… أو على الأقلّ ينطبع داخل ورقة A5») · وما تختاره يُحفظ على الجهاز */
  function savedSize() { try { var v = localStorage.getItem(LS); if (v && sizeOf(v).k === v) return v; } catch (_) {} return 'A5'; }

  /* مكتبةٌ من lib/ عند الحاجة (الصفحة قد لا تحملها) */
  var _libs = {};
  function lib(src, ready) {
    if (ready()) return Promise.resolve(true);
    if (_libs[src]) return _libs[src];
    return (_libs[src] = new Promise(function (ok) {
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = function () { ok(ready()); }; s.onerror = function () { delete _libs[src]; ok(false); };
      document.head.appendChild(s);
    }));
  }
  function zxing() { return lib('lib/zxing.min.js?v=20261003', function () { return !!(global.ZXing && global.ZXing.QRCodeWriter); }); }
  function jspdf() { return lib('lib/jspdf.umd.min.js?v=20261003', function () { return !!(global.jspdf && global.jspdf.jsPDF); }); }

  /* مصفوفة QR (ZXing) ⇒ { n, get(x,y) } */
  function qrMatrix(text) {
    var ZX = global.ZXing, hints = new Map(); hints.set(ZX.EncodeHintType.MARGIN, 0);
    var m = new ZX.QRCodeWriter().encode(String(text), ZX.BarcodeFormat.QR_CODE, 0, 0, hints);
    return { n: m.getWidth(), get: function (x, y) { return m.get(x, y); } };
  }
  function qr(text) {
    return zxing().then(function (ok) {
      if (!ok) return null;
      try {
        var M = qrMatrix(text), q = 4, n = M.n + q * 2, c = document.createElement('canvas'), s = 8;
        c.width = c.height = n * s; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000';
        for (var yy = 0; yy < M.n; yy++) for (var xx = 0; xx < M.n; xx++) if (M.get(xx, yy)) x.fillRect((xx + q) * s, (yy + q) * s, s, s);
        return c.toDataURL('image/png');
      } catch (_) { return null; }
    });
  }

  function loadImg(src, cors) {
    return new Promise(function (ok) {
      var im = new Image(); if (cors) im.crossOrigin = 'anonymous';
      var t = setTimeout(function () { ok(null); }, 6000);
      im.onload = function () { clearTimeout(t); ok(im.naturalWidth ? im : null); };
      im.onerror = function () { clearTimeout(t); ok(null); };
      im.src = src;
    });
  }
  /* هامش الشعار الأبيض/الشفّاف يُقصّ (logo.png مربّعٌ بهامشٍ واسع ⇒ كان يظهر صغيراً في التذييل) */
  function trim(im) {
    if (!im) return null;
    try {
      var c = document.createElement('canvas'), w = c.width = im.naturalWidth, h = c.height = im.naturalHeight, x = c.getContext('2d');
      x.drawImage(im, 0, 0); var d = x.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y++) for (var i = 0; i < w; i++) { var k = (y * w + i) * 4; if (d[k + 3] > 24 && (d[k] < 235 || d[k + 1] < 235 || d[k + 2] < 235)) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      if (x1 < 0) return im;
      var o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
      o.naturalWidth = o.width; o.naturalHeight = o.height; return o;
    } catch (_) { return im; }
  }
  /* شعار Canon: الملفّ المحلّي إن رُفع ثمّ مصادر gmt-core (ويكيميديا) — وإلّا كلمة Canon بلون الهوية */
  var _logos = null;
  function logos() {
    if (_logos) return _logos;
    var canonSrc = ['canonlogo.png'].concat(global.GMTCanonSources || []);
    var canon = canonSrc.reduce(function (p, s, i) { return p.then(function (im) { return im || loadImg(s, i > 0); }); }, Promise.resolve(null));
    var gmt = loadImg('genrallogo.png').then(function (im) { return im || loadImg('logo.png'); }).then(trim);
    return (_logos = Promise.all([canon, gmt]).then(function (a) { return { canon: a[0], gmt: a[1] }; }));
  }
  function fonts() {
    try { if (document.fonts && document.fonts.load) return Promise.race([Promise.all([document.fonts.load("800 40px Cairo"), document.fonts.load("600 40px Cairo")]), new Promise(function (ok) { setTimeout(ok, 2500); })]); } catch (_) {}
    return Promise.resolve();
  }

  /* أكبر خطٍّ (حتى max) يسع النصّ في العرض */
  function fit(x, txt, weight, max, maxW) {
    var f = max; x.font = weight + ' ' + f + 'px ' + FONT;
    while (f > 6 && x.measureText(txt).width > maxW) { f -= 1; x.font = weight + ' ' + f + 'px ' + FONT; }
    return f;
  }
  function rtlText(x, txt, rightX, y, color) { x.fillStyle = color; x.direction = 'rtl'; x.textAlign = 'right'; x.fillText(txt, rightX, y); }

  /* الرسم: وحدة التصميم «مم» على ملصق ١٠٠×٥٠ (u بكسل) — الأكبر يكبر بنسبته ويوزّع الارتفاع الزائد على الوسط */
  function draw(o, assets) {
    var S = sizeOf(o.size), W = Math.round(S.w * PX), H = Math.round(S.h * PX);
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'), u = Math.min(S.w / 100, S.h / 50) * PX, pad = 3 * u;
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.textBaseline = 'middle';
    /* ── الرأس: شعار Canon يميناً · «Official Warranty» يساراً · خطٌّ أحمر ── */
    var hh = 8 * u, hy = pad + hh / 2, cw = 0;
    if (assets.canon) {
      var ch = 5.6 * u; cw = ch * assets.canon.naturalWidth / assets.canon.naturalHeight;
      if (cw > W * 0.36) { cw = W * 0.36; ch = cw * assets.canon.naturalHeight / assets.canon.naturalWidth; }
      x.drawImage(assets.canon, W - pad - cw, hy - ch / 2, cw, ch);
    } else {
      x.font = '900 ' + Math.round(6 * u) + 'px Arial, sans-serif'; x.direction = 'ltr'; x.textAlign = 'right'; x.fillStyle = RED;
      x.fillText('Canon', W - pad, hy); cw = x.measureText('Canon').width;
    }
    x.direction = 'ltr'; x.textAlign = 'left'; x.fillStyle = '#333';
    fit(x, 'Official Warranty', '800', Math.round(3.6 * u), W - 2 * pad - cw - 4 * u); x.fillText('Official Warranty', pad, hy);
    x.fillStyle = RED; x.fillRect(pad, pad + hh + 0.6 * u, W - 2 * pad, Math.max(2, 0.5 * u));
    /* ── التذييل: خطٌّ متقطّع · النصّ يميناً · شعار الشركة يساراً ── */
    var fh = 9 * u, fy = H - pad - fh;
    x.strokeStyle = '#bbb'; x.lineWidth = Math.max(1, 0.25 * u); x.setLineDash([1.2 * u, 0.9 * u]);
    x.beginPath(); x.moveTo(pad, fy - 1.2 * u); x.lineTo(W - pad, fy - 1.2 * u); x.stroke(); x.setLineDash([]);
    var lw = 0;
    if (assets.gmt) { var lh = fh, lw0 = lh * assets.gmt.naturalWidth / assets.gmt.naturalHeight; lw = Math.min(lw0, W * 0.3); x.drawImage(assets.gmt, pad, fy + (fh - lw / lw0 * lh) / 2, lw, lw / lw0 * lh); }
    var tw = W - 2 * pad - lw - 3 * u, l1 = 'هذه الكفالة ممنوحة من مجموعة General Mediatech التجارية', l2 = 'الكفالة الالكترونية تعتبر وثيقة ضمان رسمية محفوظة على سيرفرات الشركة';
    fit(x, l1, '800', Math.round(2.4 * u), tw); rtlText(x, l1, W - pad, fy + fh * 0.3, '#333');
    fit(x, l2, '600', Math.round(2.1 * u), tw); rtlText(x, l2, W - pad, fy + fh * 0.72, '#555');
    /* ── الوسط: QR يساراً · الترحيب والشكر و«امسح الباركود» يميناً ── */
    var by0 = pad + hh + 2.6 * u, by1 = fy - 2.6 * u, bh = by1 - by0, q = Math.min(bh, (W - 2 * pad) * 0.34);
    var qx = pad, qy = by0 + (bh - q) / 2;
    if (assets.qr) {
      x.strokeStyle = '#e5e7eb'; x.lineWidth = Math.max(1, 0.25 * u); x.strokeRect(qx, qy, q, q);
      x.imageSmoothingEnabled = false; x.drawImage(assets.qr, qx + 0.6 * u, qy + 0.6 * u, q - 1.2 * u, q - 1.2 * u); x.imageSmoothingEnabled = true;
    }
    var rx = W - pad, tmax = W - 2 * pad - q - 3 * u;
    var hi = 'أهلاً بك: ', nm = String(o.name || '').trim() || '—';
    var f1 = Math.round(3.6 * u); x.font = '600 ' + f1 + 'px ' + FONT;
    var hw = x.measureText(hi).width, fn = fit(x, nm, '800', f1, Math.max(tmax - hw, tmax * 0.4));
    var s1 = 'امسح الباركود للحصول على', s2 = 'معلومات كفالتكم', th = 'شكراً لاختياركم Canon General Mediatech';
    var lines = [f1 * 1.5, 2.6 * u * 1.6, 4.2 * u * 1.35, 4.2 * u * 1.35], tot = lines.reduce(function (a, b) { return a + b; }, 0);
    var k = tot > bh ? bh / tot : 1, y = by0 + (bh - tot * k) / 2;
    x.font = '600 ' + Math.round(f1 * k) + 'px ' + FONT; hw = x.measureText(hi).width; rtlText(x, hi, rx, y + lines[0] * k / 2, '#333');
    x.font = '800 ' + Math.round(fn * k) + 'px ' + FONT; rtlText(x, nm, rx - hw, y + lines[0] * k / 2, RED); y += lines[0] * k;
    fit(x, th, '600', Math.round(2.6 * u * k), tmax); rtlText(x, th, rx, y + lines[1] * k / 2, '#666'); y += lines[1] * k;
    var f3 = Math.min(fit(x, s1, '800', Math.round(4.2 * u * k), tmax), fit(x, s2, '800', Math.round(4.2 * u * k), tmax));
    x.font = '800 ' + f3 + 'px ' + FONT; rtlText(x, s1, rx, y + lines[2] * k / 2, '#000'); y += lines[2] * k;
    rtlText(x, s2, rx, y + lines[3] * k / 2, '#000');
    return c;
  }

  function assetsFor(o) {
    return Promise.all([logos(), qr(o.link), fonts()]).then(function (a) {
      return (a[1] ? loadImg(a[1]) : Promise.resolve(null)).then(function (qim) { return { canon: a[0].canon, gmt: a[0].gmt, qr: qim }; });
    });
  }
  function canvasFor(o) { return assetsFor(o).then(function (as) { return draw(o, as); }); }
  function pdfOf(o, cv) {
    return jspdf().then(function (ok) {
      if (!ok) throw new Error('مكتبة PDF لم تُحمَّل');
      var S = sizeOf(o.size), J = global.jspdf.jsPDF;
      var doc = new J({ orientation: S.w >= S.h ? 'landscape' : 'portrait', unit: 'mm', format: [S.w, S.h], compress: true });
      doc.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, S.w, S.h);
      return doc.output('blob');
    });
  }
  function pdf(o) { return canvasFor(o).then(function (cv) { return pdfOf(o, cv); }); }

  function fileName(o) { return 'ملصق-كفالة-' + String(o.name || '').trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 40) + '-' + sizeOf(o.size).k + '.pdf'; }
  function mobile() { try { return matchMedia('(pointer:coarse)').matches; } catch (_) { return false; } }
  function save(blob, name) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000);
  }
  /* طباعة الكمبيوتر: إطارٌ مخفيّ فيه الملصق صورةً تملأ ورقةً بمقاسه (@page) */
  function printCanvas(o, cv) {
    var S = sizeOf(o.size), f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0;visibility:hidden';
    document.body.appendChild(f);
    var d = f.contentDocument;
    d.open(); d.write('<!doctype html><html><head><meta charset="utf-8"><title>ملصق الكفالة</title><style>@page{size:' + S.w + 'mm ' + S.h + 'mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:' + S.w + 'mm;height:' + S.h + 'mm}</style></head><body><img alt="ملصق الكفالة"></body></html>'); d.close();
    var im = d.querySelector('img');
    im.onload = function () { setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) {} try { global.focus(); } catch (_) {}   /* التركيز يعود للصفحة (Esc يغلق النافذة) */ setTimeout(function () { f.remove(); }, 60000); }, 50); };
    im.src = cv.toDataURL('image/png');
  }

  /* ── النافذة ── */
  function open(o) {
    o = Object.assign({ size: savedSize() }, o || {});
    var old = document.getElementById('gmt-sticker'); if (old) old.remove();
    var bg = document.createElement('div'); bg.id = 'gmt-sticker'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('dir', 'rtl');
    bg.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,18,25,.6);display:flex;align-items:center;justify-content:center;padding:12px;font-family:' + FONT;
    var btn = 'font:inherit;font-weight:800;font-size:14px;border-radius:12px;padding:11px 14px;border:1px solid #e5e7eb;cursor:pointer;';
    bg.innerHTML =
      '<div style="background:#fff;border-radius:16px;width:100%;max-width:560px;max-height:100%;overflow:auto;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,.35)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px"><b style="font-size:17px">🏷️ ملصق الكفالة</b>' +
          '<button type="button" data-x aria-label="إغلاق" style="' + btn + 'padding:6px 12px;background:#f3f4f6">✕</button></div>' +
        '<label style="display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:4px">المقاس</label>' +
        '<select data-size style="width:100%;' + btn + 'font-weight:700;background:#fff;margin-bottom:10px">' +
          SIZES.map(function (s) { return '<option value="' + s.k + '">' + s.t + '</option>'; }).join('') + '</select>' +
        '<div data-prev style="background:#f3f4f6;border-radius:12px;padding:10px;display:flex;align-items:center;justify-content:center;min-height:140px">' +
          '<span data-wait style="color:#6b7280;font-weight:700;font-size:13px">⏳ جارٍ تجهيز الملصق…</span></div>' +
        '<p data-note style="font-size:12px;color:#4b5563;line-height:1.7;margin:8px 0 10px"></p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          '<button type="button" data-share style="' + btn + 'background:#0f172a;color:#fff;border-color:#0f172a;grid-column:1/-1">📤 مشاركة PDF</button>' +
          '<button type="button" data-print style="' + btn + 'background:' + RED + ';color:#fff;border-color:' + RED + '">🖨️ طباعة</button>' +
          '<button type="button" data-dl style="' + btn + 'background:#fff;color:#111">⬇️ تنزيل PDF</button>' +
        '</div><p data-msg role="status" style="font-size:12.5px;font-weight:700;margin:8px 0 0;min-height:18px"></p></div>';
    document.body.appendChild(bg);
    var sel = bg.querySelector('[data-size]'), prev = bg.querySelector('[data-prev]'), note = bg.querySelector('[data-note]'), msg = bg.querySelector('[data-msg]');
    sel.value = o.size;
    var cur = null, tok = 0;
    function say(t, bad) { msg.textContent = t || ''; msg.style.color = bad ? '#b91c1c' : '#047857'; }
    function render() {
      var my = ++tok, S = sizeOf(sel.value); o.size = S.k; cur = null;
      try { localStorage.setItem(LS, S.k); } catch (_) {}
      note.textContent = 'الملفّ صفحةٌ واحدة بمقاس الملصق نفسه (' + S.w + '×' + S.h + ' مم). في الطباعة اختر الورقة نفسها في الطابعة — والطابعة العادية تكبّره ليملأ الورقة لا يصغر وسطها.';
      prev.innerHTML = '<span style="color:#6b7280;font-weight:700;font-size:13px">⏳ جارٍ تجهيز الملصق…</span>';
      return (cur = canvasFor(o).then(function (cv) {
        if (my !== tok) return cv;
        var im = new Image(); im.alt = 'معاينة ملصق الكفالة'; im.src = cv.toDataURL('image/png');
        im.style.cssText = 'max-width:100%;max-height:300px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.15);border-radius:4px';
        prev.innerHTML = ''; prev.appendChild(im); return cv;
      }));
    }
    function close() { tok++; bg.remove(); document.removeEventListener('keydown', onKey, true); }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    document.addEventListener('keydown', onKey, true);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    bg.querySelector('[data-x]').onclick = close;
    sel.onchange = function () { say(''); render(); };
    function withPdf(b, fn) {
      var t0 = Date.now(), txt = b.textContent; b.disabled = true; b.textContent = '⏳ …'; say('');
      return Promise.resolve(cur || render()).then(function (cv) { return pdfOf(o, cv).then(function (bl) { return fn(bl, cv, t0); }); })
        .catch(function (e) { say('❌ تعذّر تجهيز الملف: ' + (e && e.message || e), true); })
        .then(function () { b.disabled = false; b.textContent = txt; });
    }
    bg.querySelector('[data-share]').onclick = function () {
      withPdf(this, function (bl, cv, t0) {
        if (global.GMTShare && GMTShare.deliver) return GMTShare.deliver(bl, fileName(o), { title: 'ملصق الكفالة', t0: t0 }).then(function (r) { if (r === 'downloaded') say('⬇️ نُزّل الملفّ (الجهاز بلا مشاركة ملفّات)'); });
        save(bl, fileName(o)); say('⬇️ نُزّل الملفّ');
      });
    };
    bg.querySelector('[data-dl]').onclick = function () { withPdf(this, function (bl) { save(bl, fileName(o)); say('⬇️ نُزّل الملفّ: ' + fileName(o)); }); };
    bg.querySelector('[data-print]').onclick = function () {
      withPdf(this, function (bl, cv, t0) {
        if (mobile() && global.GMTShare && GMTShare.deliver) { say('اختر «طباعة» أو تطبيق الطابعة من لوحة المشاركة'); return GMTShare.deliver(bl, fileName(o), { title: 'ملصق الكفالة', t0: t0 }); }
        printCanvas(o, cv);
      });
    };
    render();
    return bg;
  }

  global.GMTSticker = { open: open, pdf: pdf, qr: qr, sizes: SIZES.slice(), _draw: draw, _canvas: canvasFor };
})(typeof window !== 'undefined' ? window : this);
