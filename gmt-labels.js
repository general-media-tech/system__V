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
      for (let i = 0; i < n; i++) out.push({ name: String(it.name || ''), barcode: String(it.barcode || '').trim(), group: it.group ? String(it.group) : '' });
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
  /* (TASK-0356 · المالك seq 549) «كلّ كرتونة باركوداتها مجموعةٌ لحالها» — رأس المجموعة صفٌّ كامل */
  .gh { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 6px; background: #fff; color: #000;
        font-size: 11pt; font-weight: 900; border-top: 0.8mm solid #000; border-bottom: 0.8mm solid #000; }
  .gap { border: 0.1mm dotted #eee; }
  @media print {
    html, body { background: #fff; }
    .bar { display: none !important; }
    .page { margin: 0; }
  }
</style></head><body>
<div class="bar">
  <span id="cnt"></span>
  <select id="lay"></select>
  <select id="grp" hidden><option value="flow">المجموعات متتالية بفاصل</option><option value="page">كلّ مجموعة بورقة جديدة</option></select>
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
  var grp = document.getElementById('grp'), hasG = L.some(function (x) { return x.group; });
  if (hasG) grp.hidden = false;
  function cell(x) { return '<div class="lb"><div class="nm">' + esc(x.name) + '</div>' +
    (x.barcode ? '<div class="bc"><svg data-c="' + esc(x.barcode) + '"></svg></div>' : '<div class="nobc">بلا باركود</div>') + '</div>'; }
  function draw() {
    var lay = LAY[sel.value] || LAY[4], per = lay.cols * lay.rows, box = document.getElementById('pages'), html = '', pages = 0;
    if (!hasG) {
      for (var p = 0; p < Math.max(1, Math.ceil(L.length / per)); p++) {
        html += '<div class="page" style="grid-template-columns:repeat(' + lay.cols + ',1fr);grid-template-rows:repeat(' + lay.rows + ',1fr);">';
        for (var i = p * per; i < Math.min(L.length, (p + 1) * per); i++) html += cell(L[i]);
        html += '</div>';
      }
      pages = Math.max(1, Math.ceil(L.length / per));
    } else {
      /* صفوف: رأس كلّ مجموعة صفٌّ كامل ثمّ ملصقاتها — المجموعة تبدأ صفّاً جديداً (أو ورقةً جديدة) */
      var rows = [], groups = [], cur = null;
      L.forEach(function (x) { if (!cur || cur.g !== x.group) { cur = { g: x.group, l: [] }; groups.push(cur); } cur.l.push(x); });
      groups.forEach(function (g) {
        rows.push({ h: g.g, n: g.l.length, brk: grp.value === 'page' });
        for (var i = 0; i < g.l.length; i += lay.cols) rows.push({ c: g.l.slice(i, i + lay.cols) });
      });
      var pg = [], cu = [];
      rows.forEach(function (r) {
        if (r.h != null && r.brk && cu.length) { pg.push(cu); cu = []; }
        if (r.h != null && cu.length === lay.rows - 1) { pg.push(cu); cu = []; }   // لا رأس يتيم آخر الورقة
        cu.push(r); if (cu.length === lay.rows) { pg.push(cu); cu = []; }
      });
      if (cu.length) pg.push(cu);
      pg.forEach(function (rs) {
        html += '<div class="page" style="grid-template-columns:repeat(' + lay.cols + ',1fr);grid-template-rows:repeat(' + lay.rows + ',1fr);">';
        rs.forEach(function (r) {
          if (r.h != null) html += '<div class="gh">📦 ' + esc(r.h || 'بلا مجموعة') + ' — ' + r.n + ' ملصق</div>';
          else { r.c.forEach(function (x) { html += cell(x); }); for (var k = r.c.length; k < lay.cols; k++) html += '<div class="gap"></div>'; }
        });
        html += '</div>';
      });
      pages = pg.length;
    }
    box.innerHTML = html;
    document.getElementById('cnt').textContent = L.length + ' ملصق · ' + pages + ' ورقة A4' + (hasG ? ' · ' + (function () { var s = {}; L.forEach(function (x) { s[x.group] = 1; }); return Object.keys(s).length; })() + ' مجموعة' : '');
    if (window.JsBarcode) box.querySelectorAll('svg[data-c]').forEach(function (s) {
      try { JsBarcode(s, s.getAttribute('data-c'), { format: 'CODE128', displayValue: false, margin: 0, height: 40, width: 1.6 });
        s.setAttribute('preserveAspectRatio', 'none'); }
      catch (e) { s.parentNode.innerHTML = '<div class="nobc">باركود غير صالح</div>'; }
    });
  }
  sel.onchange = draw; grp.onchange = draw;
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
