// (TASK-0339 · المالك seq 567/573) «الأسعار اللي بتتسعّر … تتسعّر فوراً في الجرد والمتجر وتتزامن»
//  ① تعديل سعر المبيع في فاتورة الشراء ⇒ الجرد + قائمة المتجر المربوطة (inv_id) ⇒ نفس السعر
//  ② منتج داخل عائلة (فلتر 58mm من «فلتر UV») ⇒ سعر قيمته يتغيّر وسعر القائمة = أقلّ سعر
//  ③ أسهم كإكسل: Enter ينزل لنفس العمود · ← ينتقل للخانة المجاورة
//  ④ «أجور تحويل وأخرى» تُجمع مع التكاليف وتوزَّع
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'حقيبة مزامنة', barcode: 'PS0001', price: 50, wholesale_price: 45, net_cost: 40, cost_price: 10, china: 3 },
    { name: 'فلتر UV 58mm', barcode: 'PS0002', price: 11, wholesale_price: 7, net_cost: 5, cost_price: 1, china: 5 },
    { name: 'فلتر UV 49mm', barcode: 'PS0003', price: 12, wholesale_price: 7, net_cost: 5, cost_price: 1, china: 5 }]);
  await H.call('/rest/v1/gmt_store', { id: 1, updated_at: '2026-11-01T00:00:00Z', products: [
    { id: 'p_bag', name: 'حقيبة مزامنة', price: 50, inv_id: A.id },
    { id: 'p_uv', name: 'فلتر UV', price: 11, options: [{ name: 'القطر', affectsPrice: true, values: [{ name: '58mm', inv_id: B.id, price: 11 }, { name: '49mm', inv_id: C.id, price: 12 }] }] }] });
  await H.call('/rest/v1/import_log', [{ id: 831, inv_number: 'IMP-2026-0031', inv_type: 'china', status: 'transit', cost_transport: 10, cost_transfer: 20,
    items_snapshot: [{ id: A.id, name: A.name, qty: 2, unit_price: 10, orig_unit_price: 10, sale_price: 50, whole_price: 45, min_price: 40 },
      { id: B.id, name: B.name, qty: 5, unit_price: 2, orig_unit_price: 2, sale_price: 11, whole_price: 7, min_price: 5 },
      { id: C.id, name: C.name, qty: 5, unit_price: 2, orig_unit_price: 2, sale_price: 12, whole_price: 7, min_price: 5 }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.evaluate(() => openInvFromList('831')); await sleep(400);
  // ④ التكاليف: 10 + 20 على قيمة 40 ⇒ معامل 1.75 ⇒ 10 → 17.50
  const v = await pg.evaluate(() => ({ u: document.querySelectorAll('#inv-items-tbl tbody tr')[0].querySelectorAll('td')[4].querySelector('div').textContent.trim(),
    cx: (document.querySelector('#invPage [data-field="cx"]') || {}).textContent, tc: (document.getElementById('inv-total-costs') || {}).textContent }));
  ok(v.cx === '20.00' && v.tc === '30.00' && v.u === '17.50', '④ «أجور تحويل وأخرى» تظهر وتُجمع (30) وتوزَّع على السعر (10 ⇒ 17.50) ' + JSON.stringify(v));
  await pg.evaluate(() => toggleInvEdit()); await sleep(200);
  // ③ أسهم إكسل: ركّز على مبيع البند الأوّل ثم Enter ⇒ مبيع البند الثاني · ← ⇒ الخانة على اليسار (الملاحظات)
  const nav = await pg.evaluate(() => {
    const rows = document.querySelectorAll('#inv-items-tbl tbody tr');
    const sale0 = rows[0].querySelectorAll('td')[7].querySelector('[contenteditable="true"]'); sale0.focus();
    const key = k => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const where = () => { const td = document.activeElement.closest('td'); return [[...td.parentElement.parentElement.children].indexOf(td.parentElement), td.cellIndex]; };
    const a = where(); key('Enter'); const b = where(); key('ArrowDown'); const c = where(); key('ArrowUp'); const d = where(); key('ArrowRight'); const e = where(); key('ArrowLeft'); const f = where();
    const sel = String(getSelection());
    return { a, b, c, d, e, f, sel };
  });
  ok(JSON.stringify([nav.a, nav.b, nav.c, nav.d]) === '[[0,7],[1,7],[2,7],[1,7]]', '③ Enter و↓ ينزلان و↑ يصعد في نفس العمود ' + JSON.stringify(nav));
  ok(nav.e[0] === 1 && nav.e[1] === 6 && nav.f[1] === 7, '③ → ثم ← تنتقلان بين الخانات المتجاورة (الجملة ⇐ المبيع) ' + JSON.stringify([nav.e, nav.f]));
  ok(nav.sel === '11.00', '③ الدخول إلى الخانة يحدّد رقمها كلّه (الكتابة تستبدله) «' + nav.sel + '»');
  // ① + ② تعديل المبيع وحفظ
  await pg.evaluate(() => {
    const rows = document.querySelectorAll('#inv-items-tbl tbody tr');
    rows[0].querySelectorAll('td')[7].querySelector('[contenteditable="true"]').textContent = '60';
    rows[1].querySelectorAll('td')[7].querySelector('[contenteditable="true"]').textContent = '9';
    saveInvEdits();
  });
  await sleep(800);
  await pg.evaluate(() => { if (document.getElementById('conflictModal').classList.contains('open')) applyAllFromInv(); });
  await sleep(4500);
  const d = await H.call('/__dump', undefined, 'GET');
  const pA = d.products.find(p => p.id === A.id), pB = d.products.find(p => p.id === B.id);
  ok(+pA.price === 60 && +pB.price === 9, '① الجرد: المبيع 60 و9 ' + JSON.stringify([pA.price, pB.price]));
  const st = (await H.call('/rest/v1/gmt_store?id=eq.1&select=products', undefined, 'GET'))[0].products;
  const bag = st.find(x => x.id === 'p_bag'), uv = st.find(x => x.id === 'p_uv');
  ok(bag && +bag.price === 60, '① المتجر: قائمة الحقيبة صارت 60 فوراً ' + (bag && bag.price));
  const v58 = uv.options[0].values.find(x => x.name === '58mm'), v49 = uv.options[0].values.find(x => x.name === '49mm');
  ok(+v58.price === 9 && +v49.price === 12 && +uv.price === 9, '② العائلة: قيمة 58mm = 9 · 49mm بقيت 12 · سعر القائمة = الأقلّ 9 ' + JSON.stringify([v58.price, v49.price, uv.price]));
  const r = d.import_log.find(x => x.id === 831);
  ok(+r.cost_transfer === 20 && +r.cost_transport === 10, '④ «أجور تحويل وأخرى» محفوظة مع الفاتورة ' + JSON.stringify([r.cost_transport, r.cost_transfer]));
  ok(Math.abs(pA.cost_price - 17.5) < 0.01, '④ التكلفة الواصلة للمنتج تشمل أجور التحويل (17.50) ' + pA.cost_price);
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
