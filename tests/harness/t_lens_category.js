// (TASK-A0580 · المالك seq A1019–A1020) «إذا ما عرف المنتج شو هو على الأقلّ يعرف تصنيفه وقسمه ويعرض الأكثر تشابهاً»
//  ثلاثة كفرات بالصورة نفسها (لا يمكن الجزم أيّها) ⇒ تعرض القسم «كفرات سيليكون» مباشرةً وداخله الأكثر شبهاً · زرّ الرجوع لأقرب ٥
const H = require('./h.js'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const IMG = u => H.BASE + u, COVER = '/img/p/products/10810fea-3aaf-439a-80c8-d9c76466ae81/1779541053588.jpg';
  await H.call('/rest/v1/products', [
    { name: 'كفر سيليكون EOS R50', barcode: 'CT1', price: 12, daraa: 2, group_name: 'كفرات سيليكون', image_url: IMG(COVER) },
    { name: 'كفر سيليكون EOS R10', barcode: 'CT2', price: 12, daraa: 2, group_name: 'كفرات سيليكون', image_url: IMG(COVER) },
    { name: 'كفر سيليكون EOS 250D', barcode: 'CT3', price: 12, daraa: 2, group_name: 'كفرات سيليكون', image_url: IMG(COVER) },
    { name: 'قشاط يد كمرا', barcode: 'CT4', price: 5, daraa: 2, group_name: 'لوازم أخرى', image_url: IMG('/img/p/products/1779352715903.jpg') },
    { name: 'بطارية DJI Mini 2', barcode: 'CT5', price: 40, daraa: 2, group_name: 'ملحقات الدرون', image_url: IMG('/img/p/products/eb21375f-7deb-4eb5-be5b-76b3cd86b991/1786748057421.jpg') }]);
  const o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  await o.ctx.route('**/functions/v1/gmt-vision', r => r.fulfill({ status: 500, body: '{}' }));
  await o.pg.evaluate(() => openStockCount()); await o.pg.waitForTimeout(1200);
  await o.pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  await o.pg.evaluate(() => scOpenLens());
  await o.pg.waitForFunction(() => { const r = document.getElementById('gmt-lens'); return r && r.getAttribute('data-ready') === '1'; }, null, { timeout: 90000 });
  await o.pg.evaluate(() => { window.GMTLensLocal.ocr = async () => []; window.GMTLensLocal.ocrPasses = async () => []; });
  await o.pg.setInputFiles('#gmt-lens [data-file]', path.join(__dirname, 'fixtures/lens_shot_cover.jpg'));
  await o.pg.waitForFunction(() => /اختر المنتج|لا تطابق|لم أعرفه/.test(document.querySelector('#gmt-lens [data-st]').innerText), null, { timeout: 120000 });
  const s = await o.pg.evaluate(() => ({ st: document.querySelector('#gmt-lens [data-st]').innerText, items: [...document.querySelectorAll('#gmt-lens [data-res] .it .nm')].map(x => x.innerText), back: !!document.querySelector('#gmt-lens [data-unscope]') }));
  ok(/لم أعرفه بالضبط/.test(s.st) && /كفرات سيليكون/.test(s.st), 'لم يجزم ⇒ يعرض القسم: ' + s.st);
  ok(s.items.length === 3 && s.items.every(t => /كفر سيليكون/.test(t)), 'داخل القسم: الكفرات الثلاثة (الأكثر شبهاً) — لا قشاط ولا بطارية: ' + s.items.join(' | '));
  ok(s.back, 'زرّ «رجوع لأقرب ٥» متاح');
  const real = o.errs.filter(x => !/status of (400|401|404|406|409|500|503)|Failed to load resource|getUserMedia|NotFoundError|Requested device not found|diacritics|Estimating/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
