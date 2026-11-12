// (المالك seq 618/620 · التدقيق العدائي) حدود نقطة البيع: سعر سالب/صفر · منتج بلا كلفة · كميات شاذّة · سلّة فارغة · عبثٌ مباشر بالسلّة
// الهدف: إثبات أين يفشل الحارس — كلّ ✘ هنا = ثغرة يجب سدّها.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const closeDialogs = async pg => { for (let i = 0; i < 4 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); } };
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'منتج بكلفة', barcode: 'ADV1', price: 100, wholesale_price: 80, net_cost: 70, cost_price: 70, daraa: 5 },
    { name: 'منتج بلا كلفة صافية', barcode: 'ADV2', price: 100, wholesale_price: 80, cost_price: 60, daraa: 5 },
    { name: 'منتج بلا كلفة ولا جملة', barcode: 'ADV3', price: 100, daraa: 5 }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const price = id => pg.evaluate(id => cart[id] ? cart[id].price : null, id);
  const qty = id => pg.evaluate(id => cart[id] ? cart[id].qty : null, id);
  await pg.evaluate(ids => { newInvoice(); ids.forEach(i => addToCartFromDetail(i)); }, [A.id, B.id, C.id]);

  // ① السعر — موظّف (درعا)
  for (const [P, nm] of [[A, 'بكلفة صافية 70'], [B, 'بلا كلفة صافية (شراء 60 · جملة 80)'], [C, 'بلا كلفة ولا جملة']]) {
    for (const v of [-5, 0, 0.01]) {
      await pg.evaluate(([id, v]) => updPriceCart(id, v), [P.id, v]);
      const p1 = await price(P.id);
      ok(p1 === 100, `موظّف · ${nm}: السعر ${v} من حقل السلّة مرفوض (بقي ${p1})`);
      await pg.evaluate(id => { cart[id].price = 100; }, P.id);
      await pg.evaluate(([id, v]) => changePreviewPrice(id, v), [P.id, v]);
      const p2 = await price(P.id);
      ok(p2 === 100, `موظّف · ${nm}: السعر ${v} من معاينة الفاتورة مرفوض (بقي ${p2})`);
      await pg.evaluate(id => { cart[id].price = 100; }, P.id);
    }
  }
  await pg.evaluate(id => updPriceCart(id, 59), B.id);
  ok(await price(B.id) === 100, 'موظّف · بلا كلفة صافية: 59 (تحت سعر الشراء 60) مرفوض (بقي ' + await price(B.id) + ')');
  await pg.evaluate(id => { cart[id].price = 100; }, B.id);
  await pg.evaluate(id => updPriceCart(id, 95), A.id);
  ok(await price(A.id) === 95, 'سعرٌ مسموح (95 فوق الجملة) يُقبل');
  await pg.evaluate(id => { cart[id].price = 100; }, A.id);

  // ② الكمّية
  for (const v of [0, -3, 2.7, 1e9, 'abc', '']) {
    await pg.evaluate(([id, v]) => updQtyCart(id, v), [A.id, v]);
    const q = await qty(A.id);
    ok(Number.isInteger(q) && q >= 1 && q <= 5, `الكمّية «${v}» ⇒ ${q} (صحيحة بين 1 والمخزون 5)`);
  }
  await pg.evaluate(id => updQtyCart(id, 1), A.id);

  // ③ عبثٌ مباشر بالسلّة (F12) ثمّ الحفظ: يجب ألا تُحفظ فاتورة بسعر/كمّية سالبة أو بإجمالي ≤ 0
  const before = ((await dump()).invoices || []).length;
  await pg.evaluate(([a, b, c]) => { delete cart[b]; delete cart[c]; cart[a].price = -50; cart[a].qty = 1; saleType = 'نقدي'; document.getElementById('custName').value = 'عبث سعر سالب'; }, [A.id, B.id, C.id]);
  await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(1500); await closeDialogs(pg);
  let d = await dump(); let bad = (d.invoices || []).filter(i => i.customer_name === 'عبث سعر سالب');
  ok(bad.length === 0, 'سلّة بسعرٍ سالب (عبث) ⇒ لا تُحفظ فاتورة (' + bad.length + (bad[0] ? ' · الإجمالي ' + bad[0].total : '') + ')');
  await pg.evaluate(a => { newInvoice(); addToCartFromDetail(a); cart[a].qty = -2; saleType = 'نقدي'; document.getElementById('custName').value = 'عبث كمّية سالبة'; }, A.id);
  await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(1500); await closeDialogs(pg);
  d = await dump(); bad = (d.invoices || []).filter(i => i.customer_name === 'عبث كمّية سالبة');
  const stA = Number(((d.products || []).find(p => String(p.id) === String(A.id)) || {}).daraa);
  ok(bad.length === 0 && stA <= 5, 'سلّة بكمّيةٍ سالبة (عبث) ⇒ لا فاتورة ولا زيادة مخزون (' + bad.length + ' · المخزون ' + stA + ')');
  await pg.evaluate(a => { newInvoice(); addToCartFromDetail(a); cart[a].qty = 99; saleType = 'نقدي'; document.getElementById('custName').value = 'عبث فوق المخزون'; }, A.id);
  await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(1500); await closeDialogs(pg);
  d = await dump(); bad = (d.invoices || []).filter(i => i.customer_name === 'عبث فوق المخزون');
  const stA2 = Number(((d.products || []).find(p => String(p.id) === String(A.id)) || {}).daraa);
  ok(bad.length === 0 && stA2 >= 0, 'سلّة بكمّيةٍ فوق المخزون (99 من ' + stA + ') ⇒ لا فاتورة والمخزون لا ينزل تحت الصفر (' + bad.length + ' · المخزون ' + stA2 + ')');

  // ④ سلّة فارغة
  await pg.evaluate(() => { newInvoice(); document.getElementById('custName').value = 'سلّة فارغة'; });
  await pg.evaluate(() => saveAndFinish()); await pg.waitForTimeout(800); await closeDialogs(pg);
  d = await dump();
  ok(!(d.invoices || []).some(i => i.customer_name === 'سلّة فارغة'), 'سلّة فارغة ⇒ لا فاتورة');

  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
