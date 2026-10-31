// (TASK-0292 · المالك seq 261) فلتر الشجرة في الجرد: الرئيسي ثمّ الفرعي (ومعه التصنيفات الإضافية)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [
    { name: 'هيد A', barcode: 'T1', haleb: 1, cat_main: 'الإضاءة', cat_sub: 'هيد لايت' },
    { name: 'بانيل B', barcode: 'T2', haleb: 1, cat_main: 'الإضاءة', cat_sub: 'بانيل ليد' },
    { name: 'حقيبة درون C', barcode: 'T3', haleb: 1, cat_main: 'الدرونات', cat_sub: 'ملحقات الدرون', extra_cats: [{ main: 'إكسسوارات الكاميرا', sub: 'حقائب الكاميرا' }] },
    { name: 'حقيبة كاميرا D', barcode: 'T4', haleb: 1, cat_main: 'إكسسوارات الكاميرا', cat_sub: 'حقائب الكاميرا' }]);
  for (const W of [390, 1366]) {
    const { browser, pg, errs } = await H.open('inventory.html', { w: W, h: 900, mobile: W < 500, wait: 6000 });
    const names = () => pg.evaluate(() => (typeof filteredProducts !== 'undefined' ? filteredProducts : []).map(p => p.name).sort().join('|'));
    await pg.evaluate(() => applyFilters()); await sleep(200);
    const opts = await pg.evaluate(() => [...document.querySelectorAll('#tree-main option')].map(o => o.value).filter(Boolean).join('|'));
    ok(/الإضاءة/.test(opts) && /الدرونات/.test(opts), W + ': قائمة الرئيسي من المنتجات: ' + opts);
    await pg.evaluate(() => invTreeSet('main', 'الإضاءة')); await sleep(200);
    ok((await names()) === 'بانيل B|هيد A', W + ': «الإضاءة» ⇒ A و B: ' + await names());
    ok(await pg.evaluate(() => document.getElementById('tree-sub').style.display !== 'none'), W + ': وظهرت قائمة الفرعي');
    await pg.evaluate(() => invTreeSet('sub', 'هيد لايت')); await sleep(200);
    ok((await names()) === 'هيد A', W + ': «هيد لايت» ⇒ A وحده');
    await pg.evaluate(() => invTreeSet('main', 'إكسسوارات الكاميرا')); await pg.evaluate(() => invTreeSet('sub', 'حقائب الكاميرا')); await sleep(200);
    ok((await names()) === 'حقيبة درون C|حقيبة كاميرا D', W + ': «حقائب الكاميرا» ⇒ D ومعها C بتصنيفها الإضافي: ' + await names());
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
