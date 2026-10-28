/* ═══════════════════════════════════════════════════════════════════════════
   gmt-signpad.js — تأكيد المستخدم وتوقيعه قبل إصدار فاتورة نقل / تسوية / جرد
   أُنشئ: 2026-10-28 · TASK-0237 (المالك seq 164)

   طلبُك: «اي فاتوره نقل او تسويه او جرد فيها تاكيد من المستخدم وتوقيع».
   نافذةٌ واحدة: ملخّص الفاتورة · الاسم الكامل · لوحة توقيع بالإصبع/الفأرة · «أؤكّد صحّة …» — الزرّ لا يعمل قبل الثلاثة.

   GMTSignPad.ask({ title, summary, name, confirmText }) ⇒ Promise<{ name, blob, dataUrl } | null>
   GMTSignPad.upload(sig, { url, headers(), bucket, prefix }) ⇒ Promise<رابط عامّ | null>
   ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.GMTSignPad) return;
  var doc = global.document;
  var Z = 2147483641;            /* فوق GMTAsk (2147483640) — قد تُفتح من داخل سلسلة أسئلة */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() {
    if (doc.getElementById('gmt-sign-css')) return;
    var s = doc.createElement('style'); s.id = 'gmt-sign-css';
    s.textContent =
      '#gmt-sign{position:fixed;inset:0;z-index:' + Z + ';background:rgba(15,18,25,.55);display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:Cairo,Tajawal,system-ui,sans-serif}' +
      '#gmt-sign .sg-box{width:100%;max-width:460px;max-height:94vh;overflow:auto;background:#fff;border-radius:18px;padding:16px;box-shadow:0 24px 60px rgba(0,0,0,.3);color:#0f1219}' +
      '#gmt-sign h3{margin:0 0 8px;font-size:16px;font-weight:900}' +
      '#gmt-sign .sg-sum{white-space:pre-line;font-size:12.5px;line-height:1.8;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:10px;color:#334155}' +
      '#gmt-sign label{display:block;font-size:12px;font-weight:800;color:#374151;margin-bottom:8px}' +
      '#gmt-sign input[type=text]{display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #d1d5db;border-radius:10px;padding:9px 10px;font:inherit;font-size:14px}' +
      '#gmt-sign .sg-pad{position:relative;border:1.5px dashed #94a3b8;border-radius:12px;background:#fff;touch-action:none}' +
      '#gmt-sign canvas{display:block;width:100%;height:170px;border-radius:12px;cursor:crosshair}' +
      '#gmt-sign .sg-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;font-weight:700;pointer-events:none}' +
      '#gmt-sign .sg-row{display:flex;gap:8px;align-items:center;margin-top:10px}' +
      '#gmt-sign button{font:inherit;font-weight:800;cursor:pointer;border-radius:11px;border:1px solid #e5e7eb;background:#fff;padding:10px 14px;font-size:13px}' +
      '#gmt-sign button.p{background:#D5001C;border-color:#D5001C;color:#fff;flex:1}#gmt-sign button:disabled{opacity:.45;cursor:not-allowed}' +
      '#gmt-sign .sg-chk{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;font-weight:700;color:#1f2937;margin-top:10px;line-height:1.7}' +
      '#gmt-sign .sg-chk input{width:18px;height:18px;margin-top:3px;flex-shrink:0}';
    (doc.head || doc.documentElement).appendChild(s);
  }
  function ask(o) {
    o = o || {}; css();
    return new Promise(function (res) {
      var old = doc.getElementById('gmt-sign'); if (old) old.remove();
      var ov = doc.createElement('div'); ov.id = 'gmt-sign'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('data-keep-fab', '1');
      ov.innerHTML = '<div class="sg-box"><h3>✍️ ' + esc(o.title || 'تأكيد وتوقيع') + '</h3>' +
        (o.summary ? '<div class="sg-sum">' + esc(o.summary) + '</div>' : '') +
        '<label>الاسم الكامل<input type="text" data-sg-name autocomplete="name" value="' + esc(o.name || '') + '"></label>' +
        '<div style="font-size:12px;font-weight:800;color:#374151;margin-bottom:6px">التوقيع</div>' +
        '<div class="sg-pad"><canvas data-sg-pad aria-label="لوحة التوقيع"></canvas><div class="sg-ph" data-sg-ph>وقّع هنا بإصبعك أو بالفأرة</div></div>' +
        '<label class="sg-chk"><input type="checkbox" data-sg-ok><span>' + esc(o.confirmText || 'أؤكّد صحّة هذه الفاتورة وبنودها وكمّيّاتها، وأتحمّل مسؤوليّتها.') + '</span></label>' +
        '<div class="sg-row"><button type="button" data-sg-clear>مسح التوقيع</button><button type="button" data-sg-x>رجوع</button><button type="button" class="p" data-sg-go disabled>✍️ أؤكّد وأوقّع</button></div></div>';
      doc.body.appendChild(ov);
      var $ = function (q) { return ov.querySelector(q); };
      var cv = $('[data-sg-pad]'), ctx = cv.getContext('2d'), drawn = 0, last = null, dpr = Math.max(1, global.devicePixelRatio || 1);
      function fit() { var r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f172a'; }
      fit();
      function pt(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      cv.addEventListener('pointerdown', function (e) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} last = pt(e); ctx.beginPath(); ctx.arc(last.x, last.y, 1.1, 0, 7); ctx.fill(); });
      cv.addEventListener('pointermove', function (e) { if (!last) return; var p = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; drawn++; $('[data-sg-ph]').style.display = 'none'; check(); });
      var up = function () { last = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
      function check() { $('[data-sg-go]').disabled = !($('[data-sg-name]').value.trim().length >= 2 && drawn >= 4 && $('[data-sg-ok]').checked); }
      $('[data-sg-name]').addEventListener('input', check); $('[data-sg-ok]').addEventListener('change', check);
      $('[data-sg-clear]').onclick = function () { ctx.clearRect(0, 0, cv.width, cv.height); drawn = 0; $('[data-sg-ph]').style.display = ''; check(); };
      function done(v) { ov.remove(); doc.removeEventListener('keydown', onKey, true); res(v); }
      function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); done(null); } }
      doc.addEventListener('keydown', onKey, true);
      $('[data-sg-x]').onclick = function () { done(null); };
      $('[data-sg-go]').onclick = function () {
        if (this.disabled) return;
        /* صورة التوقيع بخلفيّةٍ بيضاء (PNG) */
        var c2 = doc.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; var x2 = c2.getContext('2d');
        x2.fillStyle = '#fff'; x2.fillRect(0, 0, c2.width, c2.height); x2.drawImage(cv, 0, 0);
        var dataUrl = c2.toDataURL('image/png'), name = $('[data-sg-name]').value.trim();
        c2.toBlob(function (blob) { done({ name: name, blob: blob, dataUrl: dataUrl, at: new Date().toISOString() }); }, 'image/png');
      };
      setTimeout(function () { var n = $('[data-sg-name]'); if (n && !n.value) n.focus(); }, 30);
    });
  }
  /* رفع صورة التوقيع إلى مخزن التواقيع (نفس مخزن تواقيع استلام النقل) ⇒ رابطٌ عامّ */
  async function upload(sig, o) {
    o = o || {}; if (!sig || !sig.blob || !o.url) return null;
    var bucket = o.bucket || 'transfer-signatures', name = (o.prefix || 'sign') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '.png';
    try {
      var h = typeof o.headers === 'function' ? o.headers() : (o.headers || {}); h = Object.assign({}, h); delete h['Content-Type'];
      var r = await fetch(o.url + '/storage/v1/object/' + bucket + '/' + name, { method: 'POST', headers: Object.assign(h, { 'Content-Type': 'image/png', 'x-upsert': 'true' }), body: sig.blob });
      return r.ok ? o.url + '/storage/v1/object/public/' + bucket + '/' + name : null;
    } catch (_) { return null; }
  }
  global.GMTSignPad = { ask: ask, upload: upload };
})(typeof window !== 'undefined' ? window : this);
