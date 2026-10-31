// (المالك seq 261/286) فلاتر البحث في المتجر: القسم · الماركة (بلا المتوفّر ولا السعر)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-31T10:00:00Z', categories: [{ id: 'c1', name: 'الإضاءة', order: 1 }, { id: 'c2', name: 'الدرون', order: 2 }], products: [
    { id: 'a', name: 'إضاءة ليد A', price: 30, stock: 5, images: [], category_id: 'c1', specs: [{ label: 'الماركة', value: 'Godox' }] },
    { id: 'b', name: 'إضاءة ليد B', price: 0, stock: 0, images: [], category_id: 'c1', specs: [{ label: 'الماركة', value: 'Ulanzi' }] },
    { id: 'c', name: 'إضاءة ليد للدرون C', price: 10, stock: 2, images: [], category_id: 'c2', specs: [{ label: 'الماركة', value: 'Godox' }] }] }]);
  for (const W of [390, 1366]) {
    const { browser, pg, errs } = await H.open('store.html', { w: W, h: 844, mobile: W < 500, wait: 6000 });
    await pg.evaluate(() => { window._srF = null; performSearch('إضاءة'); }); await sleep(300);
    const cnt = () => pg.evaluate(() => [...document.querySelectorAll('#search-results-section [data-sr-id]')].map(x => x.dataset.srId).join(','));
    ok((await cnt()) === 'a,b,c' && await pg.evaluate(() => !!document.getElementById('sr-filters')), W + ': ٣ نتائج وفوقها الفلاتر');
    ok(/السعر عند الطلب/.test(await pg.evaluate(() => document.getElementById('search-results-section').innerText)), W + ': بلا سعر ⇒ «السعر عند الطلب» لا 0.00');
    const setF = async (k, v) => { await pg.evaluate(({ k, v }) => { const el = document.querySelector('#sr-filters [data-srf="' + k + '"]'); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change')); }, { k, v }); await sleep(250); };
    await setF('cat', 'c1'); ok((await cnt()) === 'a,b', W + ': القسم «الإضاءة» ⇒ a,b');
    await setF('cat', ''); await setF('brand', 'Godox'); ok((await cnt()) === 'a,c', W + ': الماركة Godox ⇒ a,c');
    /* (المالك seq 286) «ما بدي فلتر متوفّر والسعر» */
    ok(await pg.evaluate(() => !document.querySelector('#sr-filters [data-srf="stock"],#sr-filters [data-srf="priced"],#sr-filters [data-srf="sort"]') && !/المتوفّر فقط|بسعر فقط|السعر ↑/.test(document.getElementById('sr-filters').innerText)), W + ': لا فلتر «المتوفّر» ولا فلاتر السعر');
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
