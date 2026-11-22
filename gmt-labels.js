/* gmt-labels.js — ورقة ملصقات الباركود الجماعية (TASK-0326 · المالك seq 524)
   «صفحة طباعة باركودات جماعية · ما بدنا السعر مكتوب على الباركود · فقط الاسم والشريط · الملصق كتير رفيع وصغير ·
    طوله أكثر من عرضه بكتير ومافي هوامش أو فراغات · الملصق الحالي ممكن يصير بمساحتو باركودين أو ٣ أو حتى ٤ ·
    عم يصيروا ثلاث قطع في ورقة الـA4 وعم يظل فيها فاضي — هذا غلط»
   ⇒ ورقة A4 كاملة بلا هوامش ولا فراغات: شبكة ملصقات رفيعة (الافتراضي ٤ × ١٦ = ٦٤ ملصقاً) · الاسم سطرٌ واحد + الشريط فقط.
   الاستعمال: GMTLabels.openSheet([{ name, barcode, qty }], { title }) — يفتح نافذة الطباعة. */
(function (global) {
  'use strict';
  const LAYOUTS = {
    4: { cols: 4, rows: 16, label: '٤ بالصف · ٦٤ بالورقة (50×16.5mm)' },
    5: { cols: 5, rows: 20, label: '٥ بالصف · ١٠٠ بالورقة (40×12.8mm)' },
    3: { cols: 3, rows: 13, label: '٣ بالصف · ٣٩ بالورقة (68×20.8mm)' },
    /* (TASK-A0512 · المالك seq 757 «طباعة الباركود كتير مخلي الحجم كبير انا طلبت نصغره») مقاسان أصغر — والافتراضي صار ٦ بالصف */
    6: { cols: 6, rows: 24, label: '٦ بالصف · ١٤٤ بالورقة (33×10.3mm) — صغير' },
    7: { cols: 7, rows: 27, label: '٧ بالصف · ١٨٩ بالورقة (28×9mm) — الأصغر' },
  };
  const DEFAULT_LAYOUT = '6', ORDER = ['7', '6', '5', '4', '3'];
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
  /* (TASK-A0579 · المالك seq 977 «كبّرتهم وصاروا متلاصقين — مجال القصّ ضيّق ⇒ صغّر وعيّش بيناتهم مسافة قصّ · خطوط وهمية للقصّ واضحة وبعيدة عن الباركود»)
     فراغ قصّ 2مم بين الملصقات وخطّ قصٍّ متقطّع في منتصفه (outline بإزاحة 1مم — خطّا الجارين ينطبقان خطّاً واحداً) */
  .page { width: 210mm; height: 297mm; margin: 8px auto; background: #fff; display: grid; gap: 2mm; padding: 1.5mm; overflow: hidden; break-after: page; page-break-after: always; }
  .page:last-child { break-after: auto; page-break-after: auto; }
  /* (TASK-A0578 · المالك seq 976 «خلّي يكون الباركود بعيد عن مجال القصّ قليلاً») كانت الحاشية 1.2مم ⇒ الشريط على خطّ القصّ
     (والقارئ يحتاج فراغاً حوله). الآن حاشية أمان 3مم جانبياً و1مم أعلى/أسفل + الشريط نفسه داخل هامشٍ إضافي. */
  .lb { overflow: hidden; display: flex; flex-direction: column; align-items: stretch; justify-content: center;
        padding: 0.5mm 1.6mm; outline: 0.25mm dashed #8a8f98; outline-offset: 1mm; }
  .nm { font-size: 6.6pt; font-weight: 800; line-height: 1.15; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
  .sm .lb { padding: 0.4mm 1.4mm; } .sm .nm { font-size: 5.2pt; }
  .bc { flex: 1; min-height: 0; display: flex; justify-content: center; padding: 0.3mm 0 0.5mm; }
  .bc svg { width: 80%; height: 100%; display: block; }   /* (TASK-A0579) الشريط أصغر ووسط الملصق ⇒ بعيدٌ عن خطّ القصّ */
  .nobc { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 6pt; color: #777; }
  /* (TASK-0356 · المالك seq 549) «كلّ كرتونة باركوداتها مجموعةٌ لحالها» — رأس المجموعة صفٌّ كامل */
  /* (TASK-A0579 · seq 977 «كرتونة ١ من ٤٩ عم تاخذ صفّاً كاملاً … تاخذ مكان باركود واحد») رأس الكرتونة = خانة ملصقٍ واحدة */
  .gh { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; color: #fff; text-align: center;
        font-size: 7.5pt; font-weight: 900; line-height: 1.15; outline: 0.25mm dashed #8a8f98; outline-offset: 1mm; overflow: hidden; }
  .gh small { font-size: 5.5pt; font-weight: 700; opacity: .85; }
  .gap { }
  .gsp { grid-column: 1 / -1; }
  @media print {
    html, body { background: #fff; }
    .bar { display: none !important; }
    .page { margin: 0; }
  }
</style></head><body>
<div class="bar">
  <span id="cnt"></span>
  <select id="lay"></select>
  <select id="grp" hidden><option value="flow">الكراتين متتالية بفاصل</option><option value="page">كلّ كرتونة بورقة جديدة</option></select>
  <button onclick="window.print()">🖨️ طباعة</button>
</div>
<div id="pages"></div>
<script src="${base}lib/JsBarcode.all.min.js?v=20261003"><\/script>
<script>
(function () {
  var L = ${data}, LAY = ${lay}, DEF = '${DEFAULT_LAYOUT}', ORDER = ${JSON.stringify(ORDER)};
  var sel = document.getElementById('lay');
  ORDER.filter(function (k) { return LAY[k]; }).forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = LAY[k].label; sel.appendChild(o); });
  /* آخر مقاس اختاره المستخدم يُحفظ على جهازه — وإلّا الصغير (٦ بالصف) */
  var saved = ''; try { saved = localStorage.getItem('gmt_labels_layout') || ''; } catch (e) {}
  sel.value = LAY[saved] ? saved : DEF;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var grp = document.getElementById('grp'), hasG = L.some(function (x) { return x.group; });
  if (hasG) grp.hidden = false;
  function cell(x) { return '<div class="lb"><div class="nm">' + esc(x.name) + '</div>' +
    (x.barcode ? '<div class="bc"><svg data-c="' + esc(x.barcode) + '"></svg></div>' : '<div class="nobc">بلا باركود</div>') + '</div>'; }
  function draw() {
    var lay = LAY[sel.value] || LAY[DEF], per = lay.cols * lay.rows, box = document.getElementById('pages'), html = '', pages = 0;
    if (!hasG) {
      for (var p = 0; p < Math.max(1, Math.ceil(L.length / per)); p++) {
        html += '<div class="page' + (lay.cols >= 6 ? ' sm' : '') + '" style="grid-template-columns:repeat(' + lay.cols + ',1fr);grid-template-rows:repeat(' + lay.rows + ',1fr);">';
        for (var i = p * per; i < Math.min(L.length, (p + 1) * per); i++) html += cell(L[i]);
        html += '</div>';
      }
      pages = Math.max(1, Math.ceil(L.length / per));
    } else {
      /* (TASK-A0579) خلايا متتالية: رأس كلّ كرتونة خانةٌ واحدة («📦 3/49 · 25») ثمّ ملصقاتها مباشرةً — بلا صفٍّ كامل ولا صفٍّ فارغ ⇒ ورقٌ أقلّ.
         «كلّ كرتونة بورقة جديدة» ⇒ الرأس أوّل الورقة. */
      var groups = [], cur = null;
      L.forEach(function (x) { if (!cur || cur.g !== x.group) { cur = { g: x.group, l: [] }; groups.push(cur); } cur.l.push(x); });
      var per2 = lay.cols * lay.rows, pg = [], cu = [];
      groups.forEach(function (g, gi) {
        if (grp.value === 'page' && cu.length) { pg.push(cu); cu = []; }
        if (cu.length === per2 - 1) { pg.push(cu); cu = []; }   // لا رأس يتيم آخر الورقة
        cu.push({ h: g.g, n: g.l.length, i: gi + 1, of: groups.length });
        g.l.forEach(function (x) { cu.push({ x: x }); if (cu.length === per2) { pg.push(cu); cu = []; } });
      });
      if (cu.length) pg.push(cu);
      pg.forEach(function (cs) {
        html += '<div class="page' + (lay.cols >= 6 ? ' sm' : '') + '" style="grid-template-columns:repeat(' + lay.cols + ',1fr);grid-template-rows:repeat(' + lay.rows + ',1fr);">';
        cs.forEach(function (c) {
          if (c.h != null) html += '<div class="gh">📦 ' + esc(c.h || 'بلا مجموعة') + '<small>' + c.n + ' ملصق</small></div>';
          else html += cell(c.x);
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
  sel.onchange = function () { try { localStorage.setItem('gmt_labels_layout', sel.value); } catch (e) {} draw(); }; grp.onchange = draw;
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
