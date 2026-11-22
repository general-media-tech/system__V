// (TASK-A0579 · المالك seq 977 «العدسة … تتعرّف على المنتج وتكون موجودة في كلّ مكان») — شاشة البيع · صفحة المنتجات
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [{ name: 'Avata Battery BWX169-2420-14.76 بطارية', barcode: 'LE77', price: 78, daraa: 2, alt_names: 'بطارية أفاتا' }]);
  // ① نقطة البيع — شاشة البيع
  let o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  await o.pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  const btn = await o.pg.evaluate(() => !!document.querySelector('[onclick="posOpenLens()"]'));
  await o.pg.evaluate(() => posOpenLens()); await sleep(300);
  await o.pg.fill('#gmt-lens [data-q]', 'BWX169'); await o.pg.click('#gmt-lens [data-find]'); await sleep(700);
  await o.pg.click('#gmt-lens [data-pick="0"]'); await sleep(500);
  const s1 = await o.pg.evaluate(() => ({ q: document.getElementById('searchInput').value, cart: Object.keys(cart || {}).length }));
  ok(btn && s1.q === 'LE77' && s1.cart === 0, '① شاشة البيع: زرّ 🔍 ⇒ «هذا هو» يُظهر المنتج في البحث (لا يضيفه للسلّة): ' + JSON.stringify(s1));
  await o.browser.close();
  // ② صفحة المنتجات
  o = await H.open('المنتجات.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 6000 });
  await o.pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  await o.pg.click('#lens'); await sleep(300);
  await o.pg.fill('#gmt-lens [data-q]', 'BWX169'); await o.pg.click('#gmt-lens [data-find]'); await sleep(700);
  const n2 = await o.pg.evaluate(() => document.querySelectorAll('#gmt-lens .it').length);
  await o.pg.click('#gmt-lens [data-pick="0"]'); await sleep(600);
  const s2 = await o.pg.evaluate(() => ({ q: document.getElementById('q').value, txt: document.body.innerText.includes('BWX169') }));
  ok(n2 >= 1 && s2.q === 'LE77' && s2.txt, '② صفحة المنتجات: زرّ 🔍 ⇒ النتيجة ⇒ تفاصيل المنتج: ' + JSON.stringify(s2));
  const real = o.errs.filter(x => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
