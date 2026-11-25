// seq B1094 · «سعر التكلفة الحقيقي» عمود لحاله + «الحدّ الأدنى للمبيع» + الجمارك/الحجم من الفواتير السابقة + مقارنة الموردين بالسعر الأصلي
const H = require('./h.js');
const PI = require('../../gmt-poitem.js');
const PK = require('../../gmt-packing.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  /* ① صافي: known + suppliers */
  const PUR = [
    { id: 1, inv_number: 'A-1', supplier: 'مورد الصين', inv_date: '2026-06-01', status: 'arrived', items_snapshot: [{ id: 'p1', qty: 10, unit_price: 12, orig_unit_price: 10, alloc: { codes: ['8539.52'], kg: 5, cbm: 0.05 } }] },
    { id: 2, inv_number: 'A-2', supplier: 'مورّد  الصين', inv_date: '2026-08-01', status: 'arrived', items_snapshot: [{ id: 'p1', qty: 20, unit_price: 13, orig_unit_price: 11, alloc: { codes: ['8539.52'], kg: 10, cbm: 0.1 } }] },
    { id: 3, inv_number: 'B-1', supplier: 'Shenzhen Co', inv_date: '2026-09-01', status: 'arrived', items_snapshot: [{ id: 'p1', qty: 5, unit_price: 15, orig_unit_price: 9.5, alloc: { codes: ['9405.40'], kg: 2.5 } }] },
    { id: 4, inv_number: 'C-NOW', supplier: 'مورد الصين', inv_date: '2026-11-20', status: 'transit', items_snapshot: [{ id: 'p1', qty: 8, unit_price: 11 }] }];
  const A = PI.analyze({ id: 'p1', price: 30 }, { qty: 8, unit_price: 11 }, PUR, { invId: 4 });
  ok(A.known.n === 3 && A.known.hs[0].code === '8539.52' && A.known.hs[0].n === 2 && A.known.hs[1].code === '9405.40', 'البند الجمركي من الفواتير السابقة: الأكثر تكراراً أوّلاً (8539.52 ×2)');
  ok(A.known.kg === 0.5 && A.known.cbm === 0.005, 'وزن/حجم القطعة = الوسيط (0.5 كغ · 0.005 م³)');
  ok(A.suppliers.length === 2 && A.suppliers[0].name === 'Shenzhen Co' && A.suppliers[0].best === 9.5 && A.suppliers[0].isBest, 'مقارنة الموردين بالسعر الأصلي (9.5) مو الواصل (15) — Shenzhen الأرخص');
  ok(A.suppliers[1].n === 3 && A.suppliers[1].best === 10, 'نفس المورّد بكتابات مختلفة (مورد/مورّد + مسافات) ⇐ مجموعة وحدة');
  ok(A.alerts.some(a => a.k === 'cheaper' && /Shenzhen/.test(a.t)), 'تنبيه: مورّد تاني أعطاك أرخص (9.5 ⇐ 11)');
  ok(PI.analyze({ id: 'p1' }, { qty: 1, unit_price: 9 }, PUR, { invId: 3 }).alerts.every(a => a.k !== 'cheaper'), 'إذا هالشراء هو الأرخص ⇐ بلا تنبيه');
  /* ② التوزيع بيسجّل الحجم كمان */
  const P = { cartons: [{ no: 1, kg: 10, cbm: 0.2, hs: '8539', dutyVal: 5, lines: [0] }], lines: [{ ctn: 1, pieces: 4 }] };
  const AL = PK.allocate(P, [[0]], [{ id: 'x', qty: 4, orig_unit_price: 10 }], { customs: 5, ship: 10 }, {});
  ok(AL.items[0].cbm === 0.2 && PK.stamp({ qty: 4, orig_unit_price: 10 }, AL.items[0], 's', AL.basis, 15).alloc.cbm === 0.2, 'التوزيع يحفظ الحجم (cbm) بالبند ⇐ «حجم القطعة» للمرّات الجاية');
  /* ③ الواجهة */
  await H.seed();
  const [X] = await H.call('/rest/v1/products', [{ name: 'لمبة التكلفة', barcode: 'RC-1', price: 50, cost_price: 20, haleb: 2 }]);
  await H.call('/rest/v1/import_log', [
    { id: 981, inv_number: 'IMP-RC-OLD', inv_type: 'china', supplier: 'Shenzhen Co', inv_date: '2026-08-01', status: 'arrived', total_amount: 90, items_snapshot: [{ id: X.id, name: X.name, qty: 10, unit_price: 12, orig_unit_price: 9, alloc: { codes: ['8539.52'], kg: 4 } }], created_at: '2026-08-01T00:00:00Z' },
    { id: 982, inv_number: 'IMP-RC-NOW', inv_type: 'china', supplier: 'مورد الصين', inv_date: '2026-11-20', status: 'transit', total_amount: 100, cost_shipping: 20, items_snapshot: [{ id: X.id, name: X.name, qty: 10, unit_price: 10, min_price: 18 }], created_at: '2026-11-20T00:00:00Z' }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.evaluate(() => openInvFromList('982')); await pg.waitForSelector('#inv-items-tbl th.col-real', { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 400));
  const T = await pg.evaluate(() => {
    const ths = [...document.querySelectorAll('#inv-items-tbl thead th')].map(t => t.innerText.replace(/\s+/g, ' ').trim());
    const tr = document.querySelector('#inv-items-tbl tbody tr'), td = tr ? [...tr.querySelectorAll('td')] : [];
    const real = tr && tr.querySelector('td.col-real');
    return { ths, buy: td[4] ? td[4].querySelector('div').textContent : '', real: real ? real.querySelector('[data-real-u]').textContent : '', sumReal: (document.getElementById('inv-sum-real') || {}).textContent, min: (tr && tr.querySelector('td.col-min div') || {}).textContent, btn: (document.getElementById('orig-price-btn') || { style: {} }).style.display };
  });
  ok(T.ths.some(t => /^الحدّ الأدنى للمبيع/.test(t)) && !T.ths.some(t => /^الحد الأدنى \(/.test(t)), 'الاسم: «الحدّ الأدنى للمبيع» (اليدوي) — ' + T.ths.join(' | '));
  const iBuy = T.ths.findIndex(t => /^سعر الشراء/.test(t)), iReal = T.ths.findIndex(t => /^سعر التكلفة الحقيقي/.test(t));
  ok(iReal === iBuy + 1, 'عمود «سعر التكلفة الحقيقي» جنب سعر الشراء');
  ok(T.buy === '10.00' && T.real === '12.00' && T.sumReal === '120.00', 'سعر الشراء يضلّ الأصلي (10) · الحقيقي بعد التكاليف (12) · المجموع 120 — ' + JSON.stringify(T));
  ok(T.min === '18.00' && T.btn === 'none', 'الحدّ الأدنى للمبيع بقيمته (18) · زرّ «عرض السعر الأصلي» انخفى (صار عمود)');
  /* التعديل والحفظ ما بيتأثّروا بالعمود الجديد (القراءة بالأعمدة الصح) */
  await pg.evaluate(() => toggleInvEdit()); await new Promise(r => setTimeout(r, 300));
  await pg.evaluate(() => { const ed = document.querySelector('#inv-items-tbl tbody tr td.col-min [contenteditable="true"]'); ed.textContent = '19'; });
  const rd = await pg.evaluate(() => _invReadRows()[0]);
  ok(rd && rd.unit === 10 && rd.min === 19 && rd.whole !== 19, 'قراءة التعديل: الشراء 10 · الحدّ الأدنى 19 (العمود الجديد خارج القراءة) — ' + JSON.stringify(rd));
  await pg.evaluate(() => toggleInvEdit()); await new Promise(r => setTimeout(r, 300));
  /* ℹ️: الجمارك من فواتير سابقة + مقارنة الموردين */
  await pg.evaluate(() => document.querySelector('[data-pi-open]').click()); await pg.waitForSelector('[data-poitem]', { timeout: 10000 }).catch(() => {});
  const t = await pg.evaluate(() => (document.querySelector('[data-poitem]') || {}).innerText || '');
  ok(/الجمارك والحجم من فواتيره السابقة/.test(t) && /8539\.52/.test(t) && /0\.4 كغ/.test(t), '«📥 الجمارك والحجم من فواتيره السابقة»: 8539.52 · 0.4 كغ/قطعة');
  ok(/مقارنة الموردين/.test(t) && /Shenzhen Co/.test(t) && /9\.00/.test(t) && /أعطاك أرخص/.test(t), '«🏆 مقارنة الموردين» بالسعر الأصلي (9 مو 12) + تنبيه الأرخص');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/realcost.png' });
  await pg.evaluate(() => document.querySelector('[data-poitem]').remove());
  await pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/realcost_tbl.png' });
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
