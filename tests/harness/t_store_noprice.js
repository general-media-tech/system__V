// (المالك seq 262) «ضع الآن بدون سعر» ⇒ المنتج بلا سعر يُعرض «السعر عند الطلب» ولا يدخل السلّة بصفر
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-31T10:00:00Z', categories: [{ id: 'c1', name: 'قسم', order: 1 }],
    products: [{ id: 's0', name: 'منتج بلا سعر', price: 0, images: [], category_id: 'c1' }, { id: 's1', name: 'منتج مسعّر', price: 30, images: [], category_id: 'c1' }] }]);
  for (const W of [390, 1366]) {
    const mob = W < 500;
    const { browser, pg, errs } = await H.open('store.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 6000 });
    const t = await pg.evaluate(() => document.body.innerText);
    ok(/السعر عند الطلب/.test(t) && !/\$0\.00/.test(t) && /30\.00/.test(t), W + ': البطاقة «السعر عند الطلب» بدل 0.00، والمسعّر بسعره');
    await pg.evaluate(() => { openProductModal('s0'); }); await sleep(500);
    const mp = await pg.evaluate(() => document.getElementById('product-modal-price').textContent);
    ok(/السعر عند الطلب/.test(mp), W + ': نافذة المنتج «السعر عند الطلب»: ' + mp);
    await pg.evaluate(() => productModalAddToCart()); await sleep(400);
    const c0 = await pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_cart') || '[]').length);
    ok(c0 === 0, W + ': لا يدخل السلّة بصفر');
    await pg.evaluate(() => { openProductModal('s1'); }); await sleep(400);
    await pg.evaluate(() => productModalAddToCart()); await sleep(400);
    const c1 = await pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_cart') || '[]'));
    ok(c1.length === 1 && Number(c1[0].price) === 30, W + ': المسعّر يدخل السلّة بسعره');
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
