// (TASK-0151 · المالك seq 54) «منتجات بحاجة مراجعة» في «إدارة المنتجات»: الناقص بأسبابه · منتجات فواتير الشراء أوّلاً · مراجعة واحداً تلو الآخر
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { prods } = await H.seed();
  const [A, B, C] = prods;
  // A مكتمل · B من فاتورة شراء وناقص · C ناقص
  await H.call('/rest/v1/products?id=eq.' + A.id, { store_url: 'https://x/store.html#product=s1', image_url: 'https://img.example/a.png', category: 'تصوير', group_name: 'كاميرات', brand: 'Canon', alt_names: 'كاميرا', specs: { 'الحسّاس': 'APS-C', __desc: 'وصف' } }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + B.id, { store_url: null, image_url: null, brand: null, alt_names: null, specs: null }, 'PATCH');
  await H.call('/rest/v1/import_log', [{ inv_number: 'IMP-77', created_at: new Date().toISOString(), status: 'transit', items_snapshot: [{ id: B.id, name: B.name, barcode: B.barcode, qty: 2 }] }]);
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, mobile: false, wait: 6000, init: H.ADMIN_INIT });
  await pg.evaluate(() => switchAppMode('products')); await sleep(1500);
  const btn = await pg.evaluate(() => { const b = document.getElementById('review-btn'); return { shown: b && b.style.display !== 'none', n: (document.getElementById('review-n') || {}).textContent }; });
  ok(btn.shown && /\(\d+\)/.test(btn.n), '«إدارة المنتجات»: زرّ «🧐 بحاجة مراجعة (N)»: ' + JSON.stringify(btn));
  await pg.evaluate(() => switchAppMode('inventory'));
  ok(await pg.evaluate(() => document.getElementById('review-btn').style.display === 'none'), 'في «الجرد» الزرّ مخفيّ');
  await pg.evaluate(() => switchAppMode('products'));
  await pg.evaluate(() => openReviewList()); await sleep(800);
  const L = await pg.evaluate(() => [...document.querySelectorAll('#gmt-review [data-rv-id]')].map(r => ({ id: r.getAttribute('data-rv-id'), t: r.innerText })));
  ok(L.length >= 2 && L[0].id === String(B.id) && /🆕 IMP-77/.test(L[0].t) && /غير مربوط بالمتجر/.test(L[0].t) && /بلا مواصفات/.test(L[0].t), 'منتج فاتورة الشراء أوّلاً «🆕 IMP-77» بأسبابه: ' + (L[0] && L[0].t.replace(/\s+/g, ' ').slice(0, 120)));
  ok(!L.some(x => x.id === String(A.id)), 'المنتج المكتمل ليس في القائمة');
  await pg.evaluate(() => document.querySelector('#gmt-review [data-rvf="buy"]').click()); await sleep(200);
  ok(await pg.evaluate(() => document.querySelectorAll('#gmt-review [data-rv-id]').length) === 1, 'فلتر «🆕 فواتير الشراء» ⇒ واحد');
  await pg.evaluate(() => document.querySelector('#gmt-review [data-rvf=""]').click());
  // واحداً تلو الآخر: الحفظ ⇒ التالي
  await pg.evaluate(() => document.querySelector('#gmt-review [data-rv-go]').click());
  await pg.waitForSelector('#gmt-pe [data-pe-save]', { timeout: 10000 }).catch(() => {});
  const first = await pg.evaluate(() => document.querySelector('#gmt-pe [data-f="name"]').value);
  await pg.evaluate(() => { const a = document.querySelector('#gmt-pe [data-f="alt_names"]'); a.value = 'اسم آخر'; document.querySelector('#gmt-pe [data-pe-save]').click(); });
  await sleep(2500);
  const second = await pg.evaluate(() => (document.querySelector('#gmt-pe [data-f="name"]') || {}).value);
  ok(first === B.name && second && second !== first, '«▶ راجِعها واحداً تلو الآخر»: الحفظ يفتح التالي: ' + JSON.stringify({ first, second }));
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
