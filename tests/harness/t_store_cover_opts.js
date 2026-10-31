// (TASK-0290 · المالك seq 242) «في المتجر يجب ان يكون هنالك توافق ويختار الشخص كاميرته · اذكر كل الالوان التي لدينا ضمن الخيارات
//  واذا ما اختار هو لون معين … تلقائياً بيكون احمر»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-31T10:00:00Z', categories: [{ id: 'c1', name: 'إكسسوارات الكاميرا', order: 1 }],
    products: [{ id: 's_cov', name: 'كفر سيليكون لكمرات كانون', price: 25, images: [], category_id: 'c1', options: [
      { type: 'الكاميرا', affectsPrice: false, required: true, values: [{ name: 'Canon EOS R8', compat: 'Canon EOS R8' }, { name: 'Canon EOS R50', compat: 'Canon EOS R50' }] },
      { type: 'اللون', affectsPrice: false, default: 'أحمر', values: [{ name: 'أحمر' }, { name: 'أصفر' }, { name: 'زهري' }] }] }] }]);
  for (const W of [390, 1366]) {
    const mob = W < 500;
    const { browser, pg, errs } = await H.open('store.html#product=s_cov', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 6000 });
    await pg.waitForSelector('#product-modal-variants button', { timeout: 10000 }).catch(() => {});
    await sleep(400);
    const v = await pg.evaluate(() => ({ sel: [...document.querySelectorAll('#product-modal-variants button.border-primary')].map(b => b.textContent.trim()), lab: document.getElementById('product-modal-variants').innerText }));
    ok(v.sel.join('|') === 'أحمر', W + ': اللون الأحمر مختار وحده والكاميرا لا: ' + JSON.stringify(v.sel));
    ok(/الكاميرا \*/.test(v.lab), W + ': الكاميرا معلَّمة مطلوبة');
    await pg.evaluate(() => productModalAddToCart()); await sleep(500);
    const c0 = await pg.evaluate(() => (JSON.parse(localStorage.getItem('gmt_cart') || '[]')).length);
    const t0 = await pg.evaluate(() => document.body.innerText);
    ok(c0 === 0 && /اختر الكاميرا أوّلاً/.test(t0), W + ': بلا كاميرا ⇒ لا يدخل السلّة ويقول «اختر الكاميرا أوّلاً»');
    await pg.evaluate(() => [...document.querySelectorAll('#product-modal-variants button')].find(b => b.textContent.trim() === 'Canon EOS R50').click()); await sleep(200);
    await pg.evaluate(() => productModalAddToCart()); await sleep(500);
    const cart = await pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_cart') || '[]'));
    ok(cart.length === 1 && JSON.stringify(cart[0].selectedVariants || []).includes('Canon EOS R50') && JSON.stringify(cart[0].selectedVariants).includes('أحمر'), W + ': بعد اختيار الكاميرا ⇒ في السلّة بالكاميرا واللون الأحمر: ' + JSON.stringify(cart[0] && cart[0].selectedVariants));
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
