// TASK-B0556 · A1004 P5 «البيان الجمركي كيان منفصل (المصرّح به ≠ الكلفة) · طرق توزيع (قيمة · كمية · وزن · حجم)» · A988 §6 (بند جمركي يحتاج مراجعة · وزن مختلف)
const H = require('./h.js');
const PK = require('../../gmt-packing.js'); const PI = require('../../gmt-poitem.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const P = { lines: [{ desc: 'LED', pieces: 1, ctn: 1 }, { desc: 'MIC', pieces: 3, ctn: 2 }], cartons: [{ no: 1, kg: 2, cbm: 0.1, hs: '940540', dutyVal: 30, lines: [0] }, { no: 2, kg: 6, cbm: 0.2, hs: '', dutyVal: 70, lines: [1] }] };
  const items = [{ id: 'a', qty: 1, unit_price: 100 }, { id: 'b', qty: 3, unit_price: 10 }], map = { 0: [0], 1: [1] };
  const Q = PK.allocate(P, map, items, { customs: 40, ship: 0 }, { shipBy: 'qty' });
  ok(Q.items[0].customs === 10 && Q.items[1].customs === 30 && Q.basis === 'all-by-qty', 'التوزيع «بعدد القطع»: 40$ جمارك على 1 و3 قطع ⇒ 10 · 30');
  const D = PK.declOf(P, map, items, 'broker.xlsx');
  ok(D.totals.cartons === 2 && D.totals.duty === 100 && D.totals.kg === 8 && D.totals.noHs === 1 && D.cartons[1].items[0] === 'b', 'ملخّص البيان: كرتونتين · رسوم 100 · 8 كغ · كرتونة بلا بند · والبنود مربوطة');
  const chk = PI.declCheck({ customs_decl: D, cost_customs: 90 });
  ok(chk.some(x => /100 ≠/.test(x) && /90/.test(x)) && chk.some(x => /بلا بند جمركي/.test(x)), 'المقارنة: الرسوم المصرّح بها 100 ≠ الجمارك على الفاتورة 90 · كرتونة بلا بند');
  const A = PI.analyze({ id: 'a', price: 5 }, { qty: 2, unit_price: 10, alloc: { codes: ['851810'], kg: 4 } },
    [{ id: 1, inv_number: 'OLD', inv_date: '2026-09-01', status: 'arrived', items_snapshot: [{ id: 'a', qty: 2, unit_price: 10, alloc: { codes: ['940540'], kg: 2 } }] }], { invId: 2 });
  ok(A.alerts.some(a => a.k === 'hs' && /940540/.test(a.t)) && A.alerts.some(a => a.k === 'kg'), 'تنبيهات البند: البند الجمركي مختلف عن آخر مرّة (940540 ⇐ 851810) · وزن القطعة مختلف (1 ⇐ 2 كغ)');
  await H.seed();
  const [X] = await H.call('/rest/v1/products', [{ name: 'منتج جمركي', barcode: 'CU-1', price: 50, cost_price: 20, haleb: 1 }]);
  await H.call('/rest/v1/import_log', [{ id: 981, inv_number: 'IMP-CUS', inv_type: 'china', supplier: 'م', inv_date: '2026-11-01', status: 'transit', total_amount: 30, cost_customs: 90, customs_decl: Object.assign({}, D, { cartons: D.cartons.map(c => Object.assign({}, c, { items: c.items.map(() => X.id) })) }),
    items_snapshot: [{ id: X.id, name: X.name, qty: 3, unit_price: 10, alloc: { codes: ['851810'], kg: 6, customs: 30, ship: 0, ctn: [2] } }], created_at: '2026-11-01T00:00:00Z' }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.waitForSelector('[data-decl-open="981"]', { timeout: 10000 }).catch(() => {});
  ok(await pg.evaluate(() => !!document.querySelector('[data-decl-open="981"]')), 'زرّ «🛃» على بطاقة الفاتورة يلي إلها بيان');
  await pg.evaluate(() => openDecl('981')); await pg.waitForSelector('[data-decl]', { timeout: 8000 }).catch(() => {});
  const t = await pg.evaluate(() => (document.querySelector('[data-decl]') || {}).innerText || '');
  ok(/البيان الجمركي/.test(t) && /940540/.test(t) && /≠/.test(t) && /منتج جمركي/.test(t), 'نافذة البيان: الكراتين بالبند الجمركي · التحذير «≠» · اسم البند المربوط');
  await pg.evaluate(() => document.getElementById('gmt-decl').remove());
  await pg.evaluate(() => openInvFromList('981')); await pg.waitForSelector('[data-pi-open]', { timeout: 10000 }).catch(() => {});
  await pg.evaluate(() => document.querySelector('[data-pi-open]').click()); await pg.waitForSelector('[data-poitem]', { timeout: 10000 }).catch(() => {});
  const t2 = await pg.evaluate(() => (document.querySelector('[data-poitem]') || {}).innerText || '');
  ok(/الجمارك والشحن/.test(t2), 'نافذة البند فيها «🛃 الجمارك والشحن» (البند · الكرتونة · الوزن · حصّته)');
  ok(await pg.evaluate(() => [...document.querySelectorAll('#pack-shipby option')].some(o => o.value === 'qty')), 'خيار «بعدد القطع» بنافذة الباكينج');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
