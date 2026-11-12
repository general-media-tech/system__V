// (المالك seq 281) منتج بخيارات: عند الفتح يُعرض كل التوافق (مجموع الخيارات) · عند التحديد يتغيّر التوافق والسعر · مع خيارين يبقى توافق الخيار المحدَّد
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-31T10:00:00Z', categories: [{ id: 'c1', name: 'قسم', order: 1 }], products: [
    { id: 'f1', name: 'فلتر CPL', price: 5, images: [], category_id: 'c1', compat: 'Canon EF 50mm f/1.8 STM · Canon EF 24-105mm f/4L',
      options: [{ type: 'القطر', affectsPrice: true, required: true, values: [
        { name: '49mm', price: 5, compat: 'Canon EF 50mm f/1.8 STM', specs: [{ label: 'القطر', value: '49 مم' }] },
        { name: '77mm', price: 9, compat: 'Canon EF 24-105mm f/4L', specs: [{ label: 'القطر', value: '77 مم' }] }] }] },
    { id: 'cv', name: 'كفر', price: 12, images: [], category_id: 'c1', compat: 'Canon EOS R50 · Canon EOS R8',
      options: [{ type: 'الكاميرا', affectsPrice: false, required: true, values: [{ name: 'Canon EOS R50', compat: 'Canon EOS R50', specs: [{ label: 'المادة', value: 'سيليكون' }] }, { name: 'Canon EOS R8', compat: 'Canon EOS R8', specs: [{ label: 'المادة', value: 'سيليكون' }] }] },
                { type: 'اللون', affectsPrice: false, default: 'أحمر', values: [{ name: 'أحمر' }, { name: 'أصفر' }] }] }] }]);
  const { browser, pg, errs } = await H.open('store.html#product=f1', { w: 390, h: 844, wait: 6000 });
  await sleep(500);
  const sp = () => pg.evaluate(() => (document.getElementById('product-modal-specs') || {}).innerText || '');
  let t = await sp();
  ok(/50mm f\/1\.8 STM/.test(t) && /24-105mm/.test(t), 'عند الفتح: التوافق كلّه (مجموع الأقطار)');
  await pg.evaluate(() => [...document.querySelectorAll('#product-modal-variants button')].find(b => b.textContent.trim().startsWith('77mm')).click()); await sleep(300);
  t = await sp(); const pr = await pg.evaluate(() => document.getElementById('product-modal-price').textContent);
  ok(/24-105mm/.test(t) && !/50mm f\/1\.8 STM/.test(t) && /8\.99/.test(pr), 'اختيار 77mm ⇒ توافقه وحده وسعره 8.99 (قاعدة ناقص سنت · TASK-0340): ' + pr);
  await pg.evaluate(() => { location.hash = 'product=cv'; openProductModal('cv'); }); await sleep(600);
  t = await sp();
  ok(/R50/.test(t) && /R8/.test(t), 'الكفر عند الفتح: كل الكاميرات (اللون الافتراضي لا يخفيها)');
  await pg.evaluate(() => [...document.querySelectorAll('#product-modal-variants button')].find(b => b.textContent.trim() === 'Canon EOS R50').click()); await sleep(300);
  await pg.evaluate(() => [...document.querySelectorAll('#product-modal-variants button')].find(b => b.textContent.trim() === 'أصفر').click()); await sleep(300);
  t = await sp();
  ok(/R50/.test(t) && !/R8/.test(t), 'اختيار R50 ثمّ اللون الأصفر ⇒ يبقى توافق R50 وحده');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
