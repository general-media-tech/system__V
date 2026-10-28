// (المالك seq 205) «طريقة ادخال ملفات الاكسل بدون ما تضيع صورها في فواتير المشتريات».
// الصورة **داخل الخلية** كانت تضيع كلّها (لا طبقة رسم): WPS =DISPIMG("ID…") في xl/cellimages.xml · Excel 365 «وضع في الخلية» (vm ⇒ richData).
// تُقرأ الآن برقم صفّها: لكل منتجٍ صورته هو، وما لا صورة له يبقى بلا صورة (لا يسرق صورة غيره) · والمرساة العادية كما كانت.
const H = require('./h.js'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 4000 });
  const read = async f => {
    await pg.evaluate(() => { window.exRows = []; });
    await pg.setInputFiles('#excel-file', path.join(__dirname, f));
    await pg.waitForFunction(() => typeof exRows !== 'undefined' && exRows.length > 0, null, { timeout: 15000 }).catch(() => {});
    return pg.evaluate(() => Promise.all(exRows.map(r => {
      const u = r.image_url || ''; if (!u) return r.name + ':-';
      const c = document.createElement('canvas'); return new Promise(res => { const im = new Image(); im.onload = () => { c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(4, 4, 1, 1).data; res(r.name + ':' + (d[0] > 200 ? 'R' : d[1] > 200 ? 'G' : d[2] > 200 ? 'B' : '?')); }; im.onerror = () => res(r.name + ':bad'); im.src = u; });
    })));
  };
  const all = async a => Promise.all(a);
  const w = await all(await read('xl_incell_wps.xlsx'));
  ok(w.join('|') === 'عدسة أ:R|عدسة ب:-|عدسة ج:B', 'WPS (=DISPIMG داخل الخلية): كل منتجٍ صورته، والذي بلا صورة يبقى بلا صورة: ' + w.join(' | '));
  const x = await all(await read('xl_incell_365.xlsx'));
  ok(x.join('|') === 'عدسة أ:G|عدسة ب:B|عدسة ج:-', 'Excel 365 («وضع في الخلية»): ' + x.join(' | '));
  const a = await all(await read('xl_anchored.xlsx'));
  ok(a.join('|') === 'عدسة أ:-|عدسة ب:R|عدسة ج:-', 'الصورة المرساة بخلية (الطريقة القديمة) كما كانت: ' + a.join(' | '));
  // ٢) «إضافة للفاتورة»: صورة المنتج الجديد تُرفع لمخزن الصور (لا نصّ base64 في صفّ المنتج)
  await read('xl_incell_wps.xlsx');
  const ups = []; pg.on('request', r => { if (/\/storage\/v1\/object\/products-images\/imports\/xl-/.test(r.url()) && r.method() === 'POST') ups.push(r.url()); });
  await pg.evaluate(() => importExcel());
  await pg.waitForTimeout(1500);
  const cartImgs = await pg.evaluate(() => cart.slice(0, 3).map(c => c.product.name + ':' + (/^https?:\/\/.*\/products-images\/imports\/xl-/.test(c.product.image_url || '') ? 'url' : (c.product.image_url || '').slice(0, 5) || '-')));
  ok(ups.length === 2 && cartImgs.filter(x => /:url$/.test(x)).length === 2 && cartImgs.some(x => /عدسة ب:-/.test(x)), 'إضافة للفاتورة: الصورتان رُفعتا لمخزن الصور والمنتج بلا صورة بقي بلا صورة: ' + cartImgs.join(' | ') + ' · رفع ' + ups.length);
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
