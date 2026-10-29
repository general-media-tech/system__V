// (المالك seq 221) «بدي ميزة كثير ضرورية في فكّ ارتباط — مثلاً ربطت أنا منتج بس بدي أفكّ ارتباطه»
// ① صفحة تعديل المنتج (الجرد): «🔓 فكّ الارتباط» ⇒ منتج المتجر بلا inv_id ولا الباركود المنقول · منتج الجرد بلا store_url · الباقي كما هو
// ② الجسر: «🔓 فكّ» على المرتبط ⇒ الشيء نفسه
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const inv = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  const { prods } = await H.seed();
  const A = prods[0], B = prods[1];
  await H.call('/rest/v1/products?id=eq.' + A.id, { name: 'Led 660 pro', barcode: 'BCA660', price: 70, store_url: 'https://x/store.html#product=s_a' }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + B.id, { name: 'MM4028 RGB', barcode: 'BCB4028', price: 90, store_url: null }, 'PATCH');
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-28T10:00:00Z', categories: [{ id: 'c1', name: 'إضاءة', order: 1 }],
    products: [{ id: 's_a', name: 'لوح اضائة 660 pro', price: 65, inv_id: A.id, barcode: 'BCA660', images: ['https://img.example/a.png'], category_id: 'c1', description: 'وصف المتجر' },
      { id: 's_b', name: 'MM4028-RGBW', price: 90, barcode: 'BCB4028', images: [], category_id: 'c1' }] }]);
  for (const W of [390]) {
    const { browser, pg, errs } = await H.open('inventory.html', { w: W, h: 844, mobile: true, wait: 5000 });
    await pg.evaluate(id => invOpenFullEdit(id), A.id);
    await pg.waitForSelector('#gmt-pe [data-pe-unlink]', { timeout: 10000 }).catch(() => {});
    const t = await pg.evaluate(() => (document.querySelector('#gmt-pe .pe-linked') || {}).innerText || '');
    ok(/مربوط بـ «لوح اضائة 660 pro»/.test(t), 'صفحة المنتج: «🔗 مربوط بـ …» مع زرّ «🔓 فكّ الارتباط»: ' + t.replace(/\s+/g, ' '));
    await pg.evaluate(() => { GMTAsk.confirm = async () => true; document.querySelector('#gmt-pe [data-pe-unlink]').click(); });
    await pg.waitForSelector('#gmt-pe [data-pe-link]', { timeout: 10000 }).catch(() => {});
    const a = await inv(A.id), s = await store(), sa = s.products.find(x => x.id === 's_a');
    ok(!a.store_url && sa.inv_id == null && !sa.barcode && sa.name === 'لوح اضائة 660 pro' && sa.price === 65 && sa.description === 'وصف المتجر' && a.name === 'Led 660 pro' && a.barcode === 'BCA660',
      '«🔓 فكّ الارتباط» ⇒ الجرد بلا رابط · المتجر بلا inv_id ولا الباركود المنقول · الاسم والسعر والوصف كما هي: ' + JSON.stringify({ su: a.store_url, inv_id: sa.inv_id, bc: sa.barcode }));
    const after = await pg.evaluate(() => ({ unl: !!document.querySelector('#gmt-pe [data-pe-link]'), msg: (document.querySelector('#gmt-pe [data-pe-msg]') || document.querySelector('#gmt-pe')).innerText.match(/فُكّ الارتباط[^\n]*/) }));
    ok(after.unl, 'بعد الفكّ: الصفحة تعرض «غير مربوط» مع «🔗 ربط · ➕ إنشاء»');
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, 'لا أخطاء JS (الجرد): ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  // ② الجسر
  await H.call('/rest/v1/products?id=eq.' + B.id, { store_url: 'https://x/store.html#product=s_b' }, 'PATCH');
  const o = await H.open('bridge.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  const btn = await o.pg.evaluate(() => [...document.querySelectorAll('button')].filter(b => /unlinkPair/.test(b.getAttribute('onclick') || '')).length);
  ok(btn >= 1, 'الجسر: زرّ «🔓 فكّ» على المرتبط: ' + btn);
  await o.pg.evaluate(id => { GMTAsk.confirm = async () => true; return unlinkPair(id); }, B.id); await sleep(800);
  const b2 = await inv(B.id), s2 = await store(), sb = s2.products.find(x => x.id === 's_b');
  ok(!b2.store_url && !sb.barcode && sb.name === 'MM4028-RGBW', 'الجسر: «🔓 فكّ» ⇒ الجرد بلا رابط والمتجر بلا الباركود المنقول: ' + JSON.stringify({ su: b2.store_url, bc: sb.barcode }));
  const real = o.errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS (الجسر): ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
