/* ═══════════════════════════════════════════════════════════════════════════
   gmt-phomemo.js — طباعة الباركود مباشرةً على طابعة الملصقات الحراريّة Phomemo M110 / M110 Pro (بلوتوث) (TASK-A0586 · المالك seq A1023)
   «تطبيق عندنا يكون موصول على الطابعة ويعطيها أمر طباعة فوراً … اطبع لي خمس باركودات لهذا المنتج … والباركود في منتصف الورقة —
    ما يكون حدود خارجة أو فيه قصّ»
   ─────────────────────────────────────────────────────────────────────────────
   بلا تطبيق Phomemo: المتصفّح (Chrome على أندرويد/الكمبيوتر — Web Bluetooth) يتّصل بالطابعة ويرسل الملصق صورةً نقطيّة.
   البروتوكول (من مشاريع مفتوحة متطابقة: vivier/phomemo-tools · mkuhlmann/pyphomemo · transcriptionstream/phomymo):
     خدمة BLE 0xFF00 · كتابة 0xFF02 · إشعار 0xFF03
     لكلّ ملصق: 1B 4E 0D <سرعة 1–5> · 1B 4E 04 <كثافة 1–15> · 1F 11 0A (ورق بفواصل) ·
                1D 76 30 00 <عرض بالبايت LE16> <ارتفاع LE16> + الصورة (1 = أسود · البتّ الأعلى = اليسار) · 1F F0 05 00 1F F0 03 00
     الإرسال على دفعات ١٢٨ بايت (٢٠م.ث بينها) · ٣٠٠م.ث قبل النهاية و٥٠٠م.ث بعدها — دمج كلّ شيء بلا مهل يجعل M110 يرفض المهمّة
   الملصق: ٨ نقاط/مم (203dpi) — 40×30مم = 320×240 نقطة. الباركود في **الوسط** بهامش ≥٢مم من كلّ جهة · بلا إطار ولا خطّ قصّ.
   GMTPhomemo.open(items [, opts])  — items: [{ name, barcode, qty }] (مثل GMTLabels.openSheet)
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTPhomemo) return;
  var doc = global.document, DPM = 8;   // نقاط لكلّ مم
  var SVC = 0xff00, WR = 0xff02, NT = 0xff03, ALT_SVC = [0xffe0, 0xae30, '49535343-fe7d-4ae5-8fa9-9fafd205e455'];
  var SIZES = [[40, 30], [50, 30], [40, 20], [30, 20], [50, 25], [30, 15], [48, 30]];
  var LS = 'gmt_phomemo_v1';
  var S = { dev: null, ch: null, busy: false };
  function cfg() { try { return Object.assign({ w: 40, h: 30, dens: 12, name: true, code: true }, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (_) { return { w: 40, h: 30, dens: 12, name: true, code: true }; } }
  function saveCfg(c) { try { localStorage.setItem(LS, JSON.stringify(c)); } catch (_) {} }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ── الملصق: الاسم (اختياري) · الباركود في الوسط · الرقم تحته — بلا إطار ── */
  function render(item, c) {
    c = c || cfg();
    var W = Math.round(c.w * DPM / 8) * 8, H = Math.round(c.h * DPM), M = 2 * DPM;   // العرض مضاعفُ ٨ (بايتات كاملة) · هامش ٢مم
    var cv = doc.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#000';
    var code = String(item.barcode || '').trim(), name = String(item.name || '').trim();
    var nameH = c.name && name ? Math.round(H * 0.2) : 0, codeH = c.code ? Math.round(H * 0.16) : 0;
    var bcH = H - 2 * M - nameH - codeH; if (bcH < H * 0.35) { nameH = 0; bcH = H - 2 * M - codeH; }
    /* الباركود بعرض وحدةٍ صحيح (حادّ على الحراريّ) وفي الوسط أفقياً */
    var tmp = doc.createElement('canvas');
    try { global.JsBarcode(tmp, code, { format: 'CODE128', displayValue: false, margin: 0, height: 10, width: 1 }); } catch (e) { return { ok: false, error: 'باركود غير صالح: ' + code }; }
    var mods = tmp.width, avail = W - 2 * M, unit = Math.max(1, Math.floor(avail / (mods + 20))), bw = mods * unit;   /* (TASK-A0589 · seq A1142) + ١٠ وحدات هامشاً أبيض على كلّ جانب (المنطقة الهادئة) — بلا هامش لا تقرؤه كاميرا الهاتف */
    var bc = doc.createElement('canvas');
    global.JsBarcode(bc, code, { format: 'CODE128', displayValue: false, margin: 0, height: bcH, width: unit, background: '#ffffff', lineColor: '#000000' });
    var bx = Math.round((W - Math.min(bw, avail)) / 2), by = M + nameH;
    g.imageSmoothingEnabled = false; g.drawImage(bc, bx, by, Math.min(bw, avail), bcH);
    var fit = function (txt, px, maxW) { var s = px; g.font = '800 ' + s + 'px Cairo, Tahoma, Arial, sans-serif'; while (s > 10 && g.measureText(txt).width > maxW) { s -= 1; g.font = '800 ' + s + 'px Cairo, Tahoma, Arial, sans-serif'; } return s; };
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    if (nameH) { var nm = name; fit(nm, Math.round(nameH * 0.7), W - 2 * M); while (nm.length > 4 && g.measureText(nm).width > W - 2 * M) nm = nm.slice(0, -2); g.fillText(nm, W / 2, M + nameH / 2); }
    if (codeH) { g.direction = 'ltr'; fit(code, Math.round(codeH * 0.75), W - 2 * M); g.fillText(code, W / 2, by + bcH + codeH / 2 + 1); }
    return { ok: true, canvas: cv };
  }
  /* ── صورة نقطيّة 1-بت: البتّ الأعلى = أقصى اليسار · 1 = أسود ── */
  function raster(cv) {
    var W = cv.width, H = cv.height, bpr = W >> 3, d = cv.getContext('2d').getImageData(0, 0, W, H).data, out = new Uint8Array(bpr * H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = (y * W + x) * 4, lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (d[i + 3] > 0 && lum < 140) out[y * bpr + (x >> 3)] |= 0x80 >> (x & 7);
    }
    return { bpr: bpr, h: H, data: out };
  }
  function jobOf(cv, c) {   /* أجزاء مهمّة ملصقٍ واحد بالترتيب — كلّ جزء يُرسل منفصلاً بمهلته */
    var r = raster(cv), dens = Math.max(1, Math.min(15, c.dens | 0));
    return [
      { b: [0x1b, 0x4e, 0x0d, 0x05], wait: 30 },                 // السرعة
      { b: [0x1b, 0x4e, 0x04, dens], wait: 30 },                 // الكثافة
      { b: [0x1f, 0x11, 0x0a], wait: 30 },                       // ورق ملصقات بفواصل
      { b: [0x1d, 0x76, 0x30, 0x00, r.bpr & 255, r.bpr >> 8, r.h & 255, r.h >> 8], wait: 0 },
      { b: r.data, chunk: true, wait: 300 },
      { b: [0x1f, 0xf0, 0x05, 0x00, 0x1f, 0xf0, 0x03, 0x00], wait: 500 }];
  }
  /* ── الاتّصال ── */
  async function connect() {
    if (!(global.navigator && navigator.bluetooth)) throw new Error('هذا المتصفّح لا يدعم البلوتوث للويب — استعمل Chrome على أندرويد أو الكمبيوتر (لا يعمل على آيفون)');
    if (S.dev && S.dev.gatt && S.dev.gatt.connected && S.ch) return S.ch;
    if (!S.dev) {
      var opt = { filters: [{ namePrefix: 'M110' }, { namePrefix: 'M1' }, { namePrefix: 'Q' }, { namePrefix: 'Phomemo' }, { namePrefix: 'M' }], optionalServices: [SVC].concat(ALT_SVC) };
      try { S.dev = await navigator.bluetooth.requestDevice(opt); }
      catch (e) { if (e && e.name === 'NotFoundError') throw new Error('لم تُختر طابعة — شغّل الطابعة وقرّبها ثمّ اضغط «اتّصال» واختر M110'); throw e; }
      S.dev.addEventListener('gattserverdisconnected', function () { S.ch = null; });
    }
    var gatt = await S.dev.gatt.connect(); await sleep(100);
    var svc = null; try { svc = await gatt.getPrimaryService(SVC); } catch (_) { for (var i = 0; i < ALT_SVC.length && !svc; i++) { try { svc = await gatt.getPrimaryService(ALT_SVC[i]); } catch (_) {} } }
    if (!svc) throw new Error('الطابعة لا تعرض خدمة الطباعة المعروفة (0xFF00)');
    var ch = null; try { ch = await svc.getCharacteristic(WR); } catch (_) { var all = await svc.getCharacteristics(); ch = all.find(function (x) { return x.properties.write || x.properties.writeWithoutResponse; }); }
    if (!ch) throw new Error('لا قناة كتابة في الطابعة');
    try { var nt = await svc.getCharacteristic(NT); await nt.startNotifications(); } catch (_) {}
    S.ch = ch; return ch;
  }
  async function write(ch, bytes) {
    var u = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    if (ch.properties && ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) { try { return await ch.writeValueWithoutResponse(u); } catch (_) {} }
    return ch.writeValue ? ch.writeValue(u) : ch.writeValueWithResponse(u);
  }
  async function sendJob(ch, parts, onChunk) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.chunk) { for (var o = 0; o < p.b.length; o += 128) { await write(ch, p.b.subarray(o, o + 128)); await sleep(20); if (onChunk) onChunk(o / p.b.length); } }
      else await write(ch, p.b);
      if (p.wait) await sleep(p.wait);
    }
  }
  /* يطبع قائمة: كلّ عنصرٍ بعدد نسخه — ملصقٌ ملصق (مهمّة لكلّ ملصق كما تتطلّب M110) */
  async function printItems(items, c, onProgress) {
    c = c || cfg(); var list = [];
    (items || []).forEach(function (it) { var n = Math.max(0, Math.round(Number(it.qty) || 0)); for (var k = 0; k < n; k++) list.push(it); });
    if (!list.length) throw new Error('لا ملصقات للطباعة');
    var bad = list.filter(function (it) { return !String(it.barcode || '').trim(); });
    if (bad.length) throw new Error(bad.length + ' ملصقاً بلا باركود — عرّف باركود المنتج أوّلاً');
    var ch = await connect(), cache = {};
    for (var i = 0; i < list.length; i++) {
      var it = list[i], key = it.barcode + '|' + it.name;
      var cv = cache[key] || (cache[key] = render(it, c)); if (!cv.ok) throw new Error(cv.error);
      if (!S.ch || !(S.dev && S.dev.gatt.connected)) ch = await connect();   // الطابعة قد تقطع لحظةً بعد كلّ ملصق
      await sendJob(ch, jobOf(cv.canvas, c));
      if (onProgress) onProgress(i + 1, list.length);
    }
    return list.length;
  }
  /* ── النافذة ── */
  function open(items, opts) {
    opts = opts || {};
    var old = doc.getElementById('gmt-pm'); if (old) old.remove();
    var c = cfg(), list = (items || []).map(function (x) { return { name: x.name || '', barcode: String(x.barcode || '').trim(), qty: Math.max(0, Math.round(Number(x.qty != null ? x.qty : 1))) }; }).filter(function (x) { return x.barcode; });
    var root = doc.createElement('div'); root.id = 'gmt-pm'; root.setAttribute('dir', 'rtl');
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,18,25,.6);display:flex;align-items:flex-end;justify-content:center;font-family:Cairo,Tahoma,sans-serif;box-sizing:border-box;overflow:hidden;padding:0;margin:0';   /* (TASK-A0590 · المالك seq A1131/A1137) لا إطارات خارجة على الهاتف */
    var single = list.length === 1;
    /* (TASK-A0590 · المالك seq A1131/A1137) «على الهاتف الواجهة لا تعمل … في إطارات خارجة»: الصندوق عمودٌ محدود بالشاشة (dvh) ⇒ الجسم يتمرّر وشريط «اطبع» ثابت أسفله مع safe-area،
       كلّ عنصرٍ min-width:0 ويلتفّ، والمعاينة تتقلّص لعرض الشاشة (max-width:100%;height:auto) */
    root.innerHTML = '<style>#gmt-pm,#gmt-pm *{box-sizing:border-box}#gmt-pm label{min-width:0;max-width:100%}#gmt-pm select{max-width:100%}#gmt-pm canvas{max-width:100%;height:auto}</style>' +
      '<div data-box style="background:#fff;width:100%;max-width:520px;max-height:92vh;max-height:92dvh;display:flex;flex-direction:column;overflow:hidden;border-radius:18px 18px 0 0;min-width:0">' +
      '<div data-body style="flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:14px 14px 6px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain">' +
      '<div style="display:flex;align-items:center;gap:8px;min-width:0"><b style="flex:1;min-width:0;font-size:15px;overflow-wrap:anywhere">🖨️ طابعة الملصقات (بلوتوث) — Phomemo M110</b><button data-x style="border:0;background:none;font-size:20px;cursor:pointer">✕</button></div>' +
      '<div style="font-size:11.5px;color:#64748b;margin:4px 0 8px">الباركود في وسط الملصق بلا إطار ولا خطوط قصّ — شغّل الطابعة وقرّبها، ثمّ «اطبع».</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px;font-weight:700">' +
        '<label>المقاس <select data-size style="font:inherit;padding:4px">' + SIZES.map(function (s) { return '<option value="' + s[0] + 'x' + s[1] + '"' + (s[0] === c.w && s[1] === c.h ? ' selected' : '') + '>' + s[0] + '×' + s[1] + ' مم</option>'; }).join('') + '</select></label>' +
        '<label>الكثافة <input data-dens type="range" min="4" max="15" value="' + c.dens + '" style="width:90px;max-width:100%;vertical-align:middle"></label>' +
        '<label><input data-name type="checkbox"' + (c.name ? ' checked' : '') + '> الاسم</label><label><input data-code type="checkbox"' + (c.code ? ' checked' : '') + '> الرقم</label>' +
        (single ? '<label>العدد <input data-qty type="number" min="1" max="200" value="' + Math.max(1, list[0].qty || 1) + '" style="width:64px;font:inherit;padding:4px"></label>' : '<span>' + list.reduce(function (s, x) { return s + x.qty; }, 0) + ' ملصقاً من ' + list.length + ' منتجاً</span>') +
      '</div>' +
      '<div style="background:#f1f5f9;border-radius:12px;padding:10px;margin:10px 0;text-align:center;overflow:hidden"><canvas data-prev style="max-width:100%;background:#fff;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.15);image-rendering:pixelated"></canvas><div data-pn style="font-size:11px;color:#64748b;margin-top:4px"></div></div>' +
      '<div data-st style="font-size:12.5px;font-weight:800;color:#0f766e;min-height:18px;margin-bottom:6px;overflow-wrap:anywhere"></div>' +
      '</div>' +
      '<div style="flex:0 0 auto;display:flex;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid #e5e7eb;background:#fff"><button data-go style="flex:1;background:#D5001C;color:#fff;border:0;border-radius:12px;padding:12px;font:inherit;font-weight:900;font-size:15px;cursor:pointer">🖨️ اطبع</button></div></div>';
    doc.body.appendChild(root);
    var $ = function (s) { return root.querySelector(s); }, st = function (t, bad) { $('[data-st]').textContent = t || ''; $('[data-st]').style.color = bad ? '#b91c1c' : '#0f766e'; };
    function readCfg() { var s = $('[data-size]').value.split('x'); c = { w: +s[0], h: +s[1], dens: +$('[data-dens]').value, name: $('[data-name]').checked, code: $('[data-code]').checked }; saveCfg(c); return c; }
    function prev() {
      readCfg(); if (!list.length) { st('لا منتج بباركود', true); return; }
      var r = render(list[0], c); if (!r.ok) { st(r.error, true); return; }
      var p = $('[data-prev]'); p.width = r.canvas.width; p.height = r.canvas.height; p.getContext('2d').drawImage(r.canvas, 0, 0);
      p.style.width = Math.min(300, r.canvas.width * 0.9) + 'px'; p.style.maxWidth = '100%'; p.style.height = 'auto';
      $('[data-pn]').textContent = c.w + '×' + c.h + ' مم · ' + r.canvas.width + '×' + r.canvas.height + ' نقطة' + (list.length > 1 ? ' · معاينة الأوّل' : '');
    }
    ['[data-size]', '[data-dens]', '[data-name]', '[data-code]'].forEach(function (s) { $(s).onchange = prev; });
    $('[data-x]').onclick = function () { root.remove(); };
    root.addEventListener('click', function (e) { if (e.target === root) root.remove(); });
    $('[data-go]').onclick = async function () {
      if (S.busy) return; S.busy = true; var b = this; b.disabled = true;
      try {
        readCfg(); if (single && $('[data-qty]')) list[0].qty = Math.max(1, Math.min(200, +$('[data-qty]').value || 1));
        st('📶 الاتّصال بالطابعة…');
        var n = await printItems(list, c, function (i, t) { st('🖨️ ' + i + ' / ' + t); });
        st('✅ طُبع ' + n + ' ملصقاً');
        try { if (global.GMTSound && GMTSound.cue) GMTSound.cue('ok'); } catch (_) {}
      } catch (e) { st('❌ ' + (e && e.message || e), true); }
      S.busy = false; b.disabled = false;
    };
    var ready = function () { if (global.JsBarcode) prev(); else setTimeout(ready, 150); };
    if (!global.JsBarcode && opts.base !== false) { var s = doc.createElement('script'); s.src = (opts.base || '') + 'lib/JsBarcode.all.min.js?v=20261003'; doc.head.appendChild(s); }
    ready();
    return root;
  }
  global.GMTPhomemo = { open: open, render: render, raster: raster, jobOf: jobOf, printItems: printItems, connect: connect, _S: S };
})(window);
