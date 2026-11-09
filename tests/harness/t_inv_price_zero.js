// (TASK-0344 · المالك seq 604) «كثير منتجات سعّرتها في فاتورة الشراء … ما عم ينعرض سعرها في المتجر … كل تعديل يتعدّى فوراً في كل مكان»
//  الجذر: نافذة «تعارض الأسعار» كانت تُفتح لكلّ فرق — حتى منتج سعره في الجرد 0 — ولا يصل سعرٌ للجرد قبل الاختيار فيها.
//  ① منتج سعره 0 + سعر في الفاتورة ⇒ «حفظ التعديلات» ⇒ الجرد والمتجر فوراً · بلا نافذة تعارض
//  ② منتج له سعر لم يُلمس ⇒ لا يُكتب فوقه (الفاتورة تعرض السعر الحيّ) · ③ تعديل الجملة يصل للجرد
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'إضاءة بلا سعر', barcode: 'PZ0001', price: 0, wholesale_price: 0, net_cost: 0, cost_price: 0, china: 2 },
    { name: 'إضاءة مسعّرة', barcode: 'PZ0002', price: 70, wholesale_price: 50, net_cost: 45, cost_price: 20, china: 2 }]);
  await H.call('/rest/v1/gmt_store', { id: 1, updated_at: '2026-11-01T00:00:00Z', products: [
    { id: 'p_a', name: 'إضاءة بلا سعر', price: 0, inv_id: A.id }, { id: 'p_b', name: 'إضاءة مسعّرة', price: 70, inv_id: B.id }] });
  await H.call('/rest/v1/import_log', [{ id: 861, inv_number: 'IMP-2026-0061', inv_type: 'china', status: 'transit',
    items_snapshot: [{ id: A.id, name: A.name, qty: 2, unit_price: 10, orig_unit_price: 10, sale_price: 88.99, whole_price: 67, min_price: 66 },
      { id: B.id, name: B.name, qty: 2, unit_price: 20, orig_unit_price: 20, sale_price: 69.99, whole_price: 50, min_price: 45 }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.evaluate(() => openInvFromList('861')); await sleep(400);
  await pg.evaluate(() => toggleInvEdit()); await sleep(200);
  await pg.evaluate(() => {   // ③ الجملة للبند الأوّل 68 بدل 67
    const r0 = document.querySelectorAll('#inv-items-tbl tbody tr')[0].querySelectorAll('td');
    r0[6].querySelector('[contenteditable="true"]').textContent = '68';
    saveInvEdits();
  });
  await sleep(800);
  const modal = await pg.evaluate(() => document.getElementById('conflictModal').classList.contains('open'));
  ok(!modal, '① لا نافذة «تعارض الأسعار» — الحفظ يصل فوراً');
  await sleep(4500);
  const d = await H.call('/__dump', undefined, 'GET');
  const pA = d.products.find(p => p.id === A.id), pB = d.products.find(p => p.id === B.id);
  ok(+pA.price > 0 && Math.abs(+pA.price - 88.99) < 0.02, '① الجرد: المنتج الذي كان سعره 0 أخذ سعر الفاتورة ' + pA.price);
  ok(+pA.wholesale_price === 68 && +pA.net_cost === 66, '③ الجرد: الجملة المعدّلة 68 والحدّ الأدنى 66 ' + JSON.stringify([pA.wholesale_price, pA.net_cost]));
  ok(+pB.price === 70 && +pB.wholesale_price === 50, '② المنتج المسعّر لم يُكتب فوقه (70 · 50) ' + JSON.stringify([pB.price, pB.wholesale_price]));
  const st = (await H.call('/rest/v1/gmt_store?id=eq.1&select=products', undefined, 'GET'))[0].products;
  const la = st.find(x => x.id === 'p_a'), lb = st.find(x => x.id === 'p_b');
  ok(la && +la.price > 0 && Math.abs(+la.price - +pA.price) < 0.001, '① المتجر: القائمة صار لها سعر فوراً (لا «السعر عند الطلب») ' + (la && la.price));
  ok(lb && +lb.price === 70, '② المتجر: القائمة المسعّرة بقيت 70 ' + (lb && lb.price));
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
