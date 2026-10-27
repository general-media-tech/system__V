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
   (TASK-0213 · المالك seq 143 «رجعه مثل الشكل القديم تماما حرفيا») الشكل هو صفحة الملصق القديمة نفسها (HTML/CSS كما كانت)
   تُصوَّر بـhtml2canvas وتوضع في الصفحة بمقاس الملصق — كان TASK-0195 قد رسمه بتصميمٍ آخر على اللوح، وهذا ما لم يُطلب.

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
      try { im.dataset.gimgAllow = '1'; } catch (_) {}   /* (TASK-0213) حارس الصور كان يعطي نائباً ١×١ فيُعدّ «شعاراً» ⇒ مربّعٌ فارغ مكان Canon */
      var t = setTimeout(function () { ok(null); }, 6000);
      im.onload = function () { clearTimeout(t); ok(im.naturalWidth >= 8 ? im : null); };
      im.onerror = function () { clearTimeout(t); ok(null); };
      im.src = src;
    });
  }
  /* صورةٌ محمَّلة ⇒ dataURL (كي تُرسم في الملصق بلا قيود مصدرٍ آخر) · تعذّر ⇒ null */
  function dataOf(im) {
    if (!im) return null;
    try { var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL('image/png'); } catch (_) { return null; }
  }
  /* شعار Canon: الملفّ المحلّي إن رُفع ثمّ مصادر gmt-core (ويكيميديا) — وإلّا كلمة Canon الحمراء كما في القديم ·
     شعار الشركة في التذييل: genrallogo.png (وإلّا logo.png) كما في القديم */
  var _logos = null;
  function logos() {
    if (_logos) return _logos;
    var canonSrc = ['canonlogo.png'].concat(global.GMTCanonSources || []);
    var canon = canonSrc.reduce(function (p, s, i) { return p.then(function (im) { return im || loadImg(s, i > 0); }); }, Promise.resolve(null));
    var gmt = loadImg('genrallogo.png?v=20261027i').then(function (im) { return im || loadImg('logo.png'); });
    return (_logos = Promise.all([canon, gmt]).then(function (a) { return { canon: dataOf(a[0]), gmt: dataOf(a[1]) }; }));
  }
  function h2c() { return lib('lib/html2canvas.min.js', function () { return typeof global.html2canvas === 'function'; }); }

  /* ══ (TASK-0213 · المالك seq 143 «انا ما طلبت منك تغير شكل ملصق الكفاله ابدا رجعه مثل الشكل القديم تماما حرفيا»)
     الشكل هو الملصق القديم **حرفياً**: صفحة HTML نفسها التي كانت تُطبع (الصفوف والأنماط والنصوص كما كانت في guarantee.html قبل
     TASK-0195، بمظهر الطباعة: إطارٌ أسود ١px بلا ظلّ). ما بقي من TASK-0195 هو الإصلاح وحده: يُصوَّر ذلك الملصق كما هو ويوضع في
     ملفّ PDF صفحته بمقاس الملصق (كانت طباعة الهاتف تضعه صغيراً وسط A4) + مشاركة/طباعة/تنزيل + QR على الجهاز بدل خدمةٍ خارجية. ══ */
  var OLD_CSS =
    "body { font-family: 'Cairo', sans-serif; background: white; margin: 0; padding: 0; }" +
    ".sticker-wrapper { background: white; width: 600px; max-width: 600px; border: 1px solid #000; border-radius: 12px; padding: 20px; box-shadow: none; box-sizing: border-box; }" +
    ".sticker-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #D5001C; padding-bottom: 10px; margin-bottom: 15px; }" +
    ".sticker-header img { max-width: 130px; height: auto; }" +
    ".sticker-body { display: flex; justify-content: space-between; align-items: center; gap: 20px; }" +
    ".text-section { flex: 1; }" +
    ".welcome-text { font-size: 18px; color: #333; margin: 0 0 5px 0; }" +
    ".customer-name { color: #D5001C; font-weight: bold; }" +
    ".thanks-text { font-size: 14px; color: #666; margin: 0 0 15px 0; }" +
    ".main-scan-text { font-size: 20px; font-weight: bold; color: #000; margin: 0; line-height: 1.4; }" +
    ".qr-section { flex-shrink: 0; background: #fff; padding: 5px; border: 1px solid #eee; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }" +
    ".qr-section img { width: 120px; height: 120px; display: block; }" +
    ".sticker-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ddd; }" +
    ".footer-text { font-size: 11px; color: #555; line-height: 1.5; }" +
    ".footer-logo { max-width: 90px; height: auto; }";
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function oldHTML(o, as) {
    return '<div class="sticker-wrapper">' +
      '<div class="sticker-header">' +
        (as.canon ? '<img src="' + as.canon + '" alt="Canon Logo">' : '<b style="color:#D5001C;font-size:20px">Canon</b>') +
        '<div style="font-weight: bold; color: #333; font-size: 16px;">Official Warranty</div>' +
      '</div>' +
      '<div class="sticker-body">' +
        '<div class="text-section">' +
          '<p class="welcome-text">أهلاً بك: <span class="customer-name">' + esc(o.name) + '</span></p>' +
          '<p class="thanks-text">شكراً لاختياركم Canon General Mediatech</p>' +
          '<h2 class="main-scan-text">امسح الباركود للحصول على<br>معلومات كفالتكم</h2>' +
        '</div>' +
        '<div class="qr-section">' + (as.qr ? '<img src="' + as.qr + '" alt="Warranty QR Code">' : '<div style="width:120px;height:120px"></div>') + '</div>' +
      '</div>' +
      '<div class="sticker-footer">' +
        '<div class="footer-text"><strong>هذه الكفالة ممنوحة من مجموعة General Mediatech التجارية</strong><br>الكفالة الالكترونية تعتبر وثيقة ضمان رسمية محفوظة على سيرفرات الشركة</div>' +
        (as.gmt ? '<img src="' + as.gmt + '" class="footer-logo" alt="General Media Tech">' : '') +
      '</div>' +
    '</div>';
  }
  /* الملصق القديم في إطارٍ خفيّ ⇒ صورة (html2canvas) ⇒ تُوضع في صفحةٍ بمقاس الملصق: هامش ٢ مم (كـ@page القديم) · الملصقات وسطاً ·
     A6/A5 أعلى الورقة كما كانت تُطبع */
  function draw(o, as) {
    var S = sizeOf(o.size), W = Math.round(S.w * PX), H = Math.round(S.h * PX), m = 2 * PX;
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;left:-10000px;top:0;width:660px;height:900px;border:0;visibility:hidden';
    document.body.appendChild(f);
    var d = f.contentDocument;
    d.open(); d.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
      '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">' +
      '<style>' + OLD_CSS + '</style></head><body>' + oldHTML(o, as) + '</body></html>'); d.close();
    var el = d.querySelector('.sticker-wrapper');
    var ready = Promise.all([].map.call(d.images, function (im) { return im.complete ? 0 : new Promise(function (ok) { im.onload = im.onerror = ok; }); }));
    var fnt = (d.fonts && d.fonts.ready) ? Promise.race([d.fonts.ready, new Promise(function (ok) { setTimeout(ok, 2500); })]) : Promise.resolve();
    return Promise.all([ready, fnt, h2c()]).then(function (r) {
      if (!r[2]) throw new Error('مكتبة الرسم لم تُحمَّل');
      var bw = el.offsetWidth || 600, bh = el.offsetHeight || 320, k = Math.min((W - 2 * m) / bw, (H - 2 * m) / bh);
      return global.html2canvas(el, { scale: Math.max(1, k), backgroundColor: '#ffffff', logging: false, useCORS: true }).then(function (shot) {
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
        var dw = bw * k, dh = bh * k, dx = (W - dw) / 2, dy = /^A[56]$/.test(S.k) ? m : (H - dh) / 2;
        x.drawImage(shot, dx, dy, dw, dh);
        return c;
      });
    }).then(function (c) { f.remove(); return c; }, function (e) { f.remove(); throw e; });
  }

  function assetsFor(o) {
    return Promise.all([logos(), qr(o.link)]).then(function (a) { return { canon: a[0].canon, gmt: a[0].gmt, qr: a[1] }; });
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

  global.GMTSticker = { open: open, pdf: pdf, qr: qr, sizes: SIZES.slice(), _draw: draw, _canvas: canvasFor, _html: oldHTML, _css: OLD_CSS };
})(typeof window !== 'undefined' ? window : this);
