// الجرد: عمود «الماركة» آخر عمود في تصدير Excel + المستورد يقرأه بالرأس (OWN-05#17)
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
(async () => {
  await H.seed();
  const o = await H.open('inventory.html', { w: 1280, h: 900, wait: 5000, mobile: false });
  // ١) المستورد: مطابقة تلقائية للماركة + كتابتها
  const r = await o.pg.evaluate(async () => {
    excelRawData = [['', 'منتج تجريبي ماركة', '5', 'Godox'], ['', 'منتج بلا ماركة', '7', '']];
    showExcelPreview(['id (لا تعدّل)', 'اسم المنتج', 'السعر', 'الماركة'], excelRawData);
    const sel = document.getElementById('map-brand');
    const auto = sel ? sel.value : null;
    const posted = [];
    const f = window.sbFetch; window.sbFetch = async (m, u, b) => { posted.push({ m, u, b }); return []; };
    const wasDemo = isDemo; isDemo = false;
    try { await importExcelData(); } catch (e) { posted.push({ err: String(e) }); }
    window.sbFetch = f; isDemo = wasDemo;
    const b = (posted.find(x => /products/.test(x.u || '')) || {}).b || [];
    return { auto, brands: b.map(x => x.brand), err: (posted.find(x => x.err) || {}).err };
  });
  ok(r.auto === '3', 'المطابقة التلقائية اختارت عمود الماركة (الفهرس ' + r.auto + ')');
  ok(!r.err && r.brands[0] === 'Godox' && r.brands[1] === null, 'الاستيراد يكتب الماركة: ' + JSON.stringify(r.brands) + (r.err || ''));
  // ٢) بدون مطابقة: لا يُرسَل المفتاح brand
  const r2 = await o.pg.evaluate(async () => {
    excelRawData = [['', 'منتج ج', '5']];
    showExcelPreview(['id (لا تعدّل)', 'اسم المنتج', 'السعر'], excelRawData);
    const posted = []; const f = window.sbFetch; window.sbFetch = async (m, u, b) => { posted.push({ u, b }); return []; };
    const wasDemo = isDemo; isDemo = false;
    try { await importExcelData(); } catch (e) {}
    window.sbFetch = f; isDemo = wasDemo;
    const b = (posted.find(x => /products/.test(x.u || '')) || {}).b || [];
    return b.length ? ('brand' in b[0]) : null;
  });
  ok(r2 === false, 'بلا عمود ماركة في الملف: لا يُرسل brand');
  // ٣) التصدير: آخر رأس = الماركة
  const src = require('fs').readFileSync(__dirname + '/../../inventory.html', 'utf8');
  ok(/headers\.push\('الإجمالي'\);\s*headers\.push\('الماركة'\)/.test(src) && /rowValues\.push\(getTotal\(p\)\);\s*rowValues\.push\(p\.brand \|\| ''\)/.test(src), 'التصدير يضيف الماركة بعد الإجمالي (آخر عمود)');
  console.log('errors:', o.errs.filter(e => !/400|404|Failed|ERR_INTERNET|net::|vibrate/.test(e)).slice(0, 4));
  await o.browser.close(); console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
