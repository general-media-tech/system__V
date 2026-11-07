/* gmt-labels.js — ورقة ملصقات الباركود الجماعية (TASK-0326 · المالك seq 524)
   «صفحة طباعة باركودات جماعية · ما بدنا السعر مكتوب على الباركود · فقط الاسم والشريط · الملصق كتير رفيع وصغير ·
    طوله أكثر من عرضه بكتير ومافي هوامش أو فراغات · الملصق الحالي ممكن يصير بمساحتو باركودين أو ٣ أو حتى ٤ ·
    عم يصيروا ثلاث قطع في ورقة الـA4 وعم يظل فيها فاضي — هذا غلط»
   ⇒ ورقة A4 كاملة بلا هوامش ولا فراغات: شبكة ملصقات رفيعة (الافتراضي ٤ × ١٦ = ٦٤ ملصقاً) · الاسم سطرٌ واحد + الشريط فقط.
   الاستعمال: GMTLabels.openSheet([{ name, barcode, qty }], { title }) — يفتح نافذة الطباعة. */
(function (global) {
  'use strict';
  const LAYOUTS = {
    4: { cols: 4, rows: 16, label: '٤ بالصف · ٦٤ بالورقة (52.5×18.5mm)' },
    5: { cols: 5, rows: 20, label: '٥ بالصف · ١٠٠ بالورقة (42×14.8mm)' },
    3: { cols: 3, rows: 13, label: '٣ بالصف · ٣٩ بالورقة (70×22.8mm)' },
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function expand(items) {
    const out = [];
    (items || []).forEach(it => {
      if (!it) return;
      const n = Math.max(1, Math.min(9999, parseInt(it.qty, 10) || 1));
      for (let i = 0; i < n; i++) out.push({ name: String(it.name || ''), barcode: String(it.barcode || '').trim() });
    });
    return out;
  }

  function sheetHtml(labels, opts) {
    const data = JSON.stringify(labels).replace(/</g, '\\u003c');
    const base = (opts && opts.base) || '';
    const title = esc((opts && opts.title) || 'ملصقات الباركود');
    const lay = JSON.stringify(LAYOUTS);
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #e9ecef; font-family: 'Cairo', Tahoma, Arial, sans-serif; }
  .bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center;
         background: #111; color: #fff; padding: 8px 10px; font-size: 13px; font-weight: 700; }
  .bar select, .bar button { font: inherit; border: none; border-radius: 8px; padding: 6px 12px; }
  .bar button { background: #D5001C; color: #fff; cursor: pointer; font-weight: 900; }
  .page { width: 210mm; height: 297mm; margin: 8px auto; background: #fff; display: grid; overflow: hidden; break-after: page; page-break-after: always; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  .lb { overflow: hidden; display: flex; flex-direction: column; align-items: stretch; justify-content: center;
        padding: 0.6mm 1.2mm; border: 0.1mm dotted #d6d6d6; }
  .nm { font-size: 6.6pt; font-weight: 800; line-height: 1.15; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
  .bc { flex: 1; min-height: 0; display: flex; }
  .bc svg { width: 100%; height: 100%; display: block; }
  .nobc { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 6pt; color: #777; }
  @media print {
    html, body { background: #fff; }
    .bar { display: none !important; }
    .page { margin: 0; }
  }
</style></head><body>
<div class="bar">
  <span id="cnt"></span>
  <select id="lay"></select>
  <button onclick="window.print()">🖨️ طباعة</button>
</div>
<div id="pages"></div>
<script src="${base}lib/JsBarcode.all.min.js?v=20261003"><\/script>
<script>
(function () {
  var L = ${data}, LAY = ${lay};
  var sel = document.getElementById('lay');
  Object.keys(LAY).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = LAY[k].label; sel.appendChild(o); });
  sel.value = '4';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function draw() {
    var lay = LAY[sel.value] || LAY[4], per = lay.cols * lay.rows, box = document.getElementById('pages'), html = '';
    for (var p = 0; p < Math.max(1, Math.ceil(L.length / per)); p++) {
      html += '<div class="page" style="grid-template-columns:repeat(' + lay.cols + ',1fr);grid-template-rows:repeat(' + lay.rows + ',1fr);">';
      for (var i = p * per; i < Math.min(L.length, (p + 1) * per); i++) {
        var x = L[i];
        html += '<div class="lb"><div class="nm">' + esc(x.name) + '</div>' +
          (x.barcode ? '<div class="bc"><svg data-c="' + esc(x.barcode) + '"></svg></div>' : '<div class="nobc">بلا باركود</div>') + '</div>';
      }
      html += '</div>';
    }
    box.innerHTML = html;
    document.getElementById('cnt').textContent = L.length + ' ملصق · ' + Math.max(1, Math.ceil(L.length / per)) + ' ورقة A4';
    if (window.JsBarcode) box.querySelectorAll('svg[data-c]').forEach(function (s) {
      try { JsBarcode(s, s.getAttribute('data-c'), { format: 'CODE128', displayValue: false, margin: 0, height: 40, width: 1.6 });
        s.setAttribute('preserveAspectRatio', 'none'); }
      catch (e) { s.parentNode.innerHTML = '<div class="nobc">باركود غير صالح</div>'; }
    });
  }
  sel.onchange = draw;
  if (window.JsBarcode) draw(); else window.addEventListener('load', draw);
})();
<\/script></body></html>`;
  }

  function openSheet(items, opts) {
    const labels = expand(items);
    if (!labels.length) return false;
    const w = global.open('', '_blank');
    if (!w) return null;
    const base = (global.location && global.location.href) ? global.location.href.replace(/[^/]*([?#].*)?$/, '') : '';
    w.document.write(sheetHtml(labels, Object.assign({ base }, opts || {})));
    w.document.close();
    return true;
  }

  global.GMTLabels = { openSheet, sheetHtml, expand, LAYOUTS };
})(typeof window !== 'undefined' ? window : globalThis);
