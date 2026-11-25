// TASK-B0559 · A1004 P6 م٢ · seq B1095 — شحنات المشتريات N↔N
const H = require('./h.js');
const PS = require('../../gmt-poship.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  ok(PS.nextRef([{ ref: 'SHP-2026-007' }, { ref: 'SHP-2025-020' }], 2026) === 'SHP-2026-008' && PS.nextRef([], 2026) === 'SHP-2026-001', 'الرقم التالي بالسنة (SHP-2026-008)');
  const s1 = { status: 'transit', eta: '2026-11-20' }, s2 = { status: 'arrived', eta: '2026-11-01' }, s3 = { status: 'booked', eta: '2026-12-05' };
  ok(PS.stateOf(s1, '2026-11-25').k === 'overdue' && PS.stateOf(s1, '2026-11-25').days === -5, 'بالطريق وفات موعدها ⇐ ⏰ متأخّرة 5 أيام');
  ok(PS.stateOf(s2, '2026-11-25').k === 'arrived' && PS.stateOf(s3, '2026-11-25').days === 10, 'الواصلة ما بتصير متأخّرة · المحجوزة بعد 10 أيام');
  const L = [{ id: 'a', ref: 'S1', status: 'transit', invoice_ids: [1, 2] }, { id: 'b', ref: 'S2', status: 'booked', invoice_ids: [2] }, { id: 'c', ref: 'S3', status: 'cancelled', invoice_ids: [3] }];
  ok(PS.forInvoice(L, 2).length === 2 && PS.forInvoice(L, 3).length === 0, 'N↔N: فاتورة بشحنتين · الملغاة ما بتنحسب');
  const I = [{ id: 1, inv_type: 'china', status: 'transit' }, { id: 3, inv_type: 'china', status: 'transit' }, { id: 4, inv_type: 'instant', status: 'arrived' }, { id: 5, inv_type: 'germany', status: 'arrived' }];
  ok(PS.unshipped(I, L).map(x => x.id).join() === '3', 'بلا شحنة: الفاتورة 3 (شحنتها ملغاة) — مو الفورية ولا الواصلة');
  /* الواجهة */
  await H.seed();
  const [P1] = await H.call('/rest/v1/products', [{ name: 'منتج الشحنة', barcode: 'SH-1', price: 10, cost_price: 5 }]);
  await H.call('/rest/v1/import_log', [
    { id: 991, inv_number: 'IMP-SH-1', inv_type: 'china', supplier: 'مورد', inv_date: '2026-11-01', status: 'transit', shipping_company: 'Maersk', total_amount: 100, items_snapshot: [{ id: P1.id, name: P1.name, barcode: 'SH-1', qty: 2, unit_price: 50 }], created_at: '2026-11-01T00:00:00Z' },
    { id: 992, inv_number: 'IMP-SH-2', inv_type: 'china', supplier: 'مورد 2', inv_date: '2026-11-02', status: 'transit', total_amount: 50, items_snapshot: [{ id: P1.id, name: P1.name, barcode: 'SH-1', qty: 1, unit_price: 50 }], created_at: '2026-11-02T00:00:00Z' }]);
  const { browser, pg, errs } = await H.open('purchase.html?ships=1', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.waitForSelector('[data-poship]', { timeout: 12000 }).catch(() => {});
  let t = await pg.evaluate(() => document.querySelector('[data-poship]').innerText);
  ok(/2 فاتورة استيراد بالطريق بلا شحنة/.test(t), '?ships=1 يفتح الشحنات + «📭 2 فاتورة بلا شحنة»');
  await pg.click('[data-poship] button[data-ship-new]'); await sleep(200);
  ok(await pg.evaluate(() => [...document.querySelectorAll('#poship-carriers option')].some(o => o.value === 'Maersk')), 'شركة الشحن مقترحة من الفواتير (Maersk)');
  await pg.evaluate(() => { const f = document.querySelector('[data-ship-form]'); f.querySelector('[data-sf="carrier"]').value = 'Maersk'; f.querySelector('[data-sf="tracking"]').value = 'MSKU123'; f.querySelector('[data-sf="eta"]').value = '2026-01-10'; f.querySelectorAll('[data-sf-inv]').forEach(c => c.checked = true); });
  await pg.click('[data-ship-save]'); await sleep(900);
  let d = await H.call('/__dump', undefined, 'GET'); let S = (d.gmt_po_shipments || [])[0];
  ok(S && /^SHP-\d{4}-001$/.test(S.ref) && S.invoice_ids.length === 2 && S.status === 'booked' && S.tracking === 'MSKU123', 'انحفظت شحنة وحدة لفاتورتين: ' + JSON.stringify(S && [S.ref, S.invoice_ids, S.status]));
  t = await pg.evaluate(() => document.querySelector('[data-poship]').innerText);
  ok(/متأخّرة/.test(t) && !/بلا شحنة/.test(t), 'الموعد فات ⇐ ⏰ متأخّرة · ما عاد في فواتير بلا شحنة');
  /* إلغاء بلا سبب ما بيصير */
  await pg.evaluate(() => { window.GMTAsk = Object.assign(window.GMTAsk || {}, { prompt: () => Promise.resolve('') }); });
  await pg.click('[data-ship-st="cancelled"]'); await sleep(500);
  d = await H.call('/__dump', undefined, 'GET'); ok(d.gmt_po_shipments[0].status === 'booked', 'الإلغاء بلا سبب ⇐ ما بيصير');
  await pg.click('[data-ship-st="arrived"]'); await sleep(800);
  d = await H.call('/__dump', undefined, 'GET'); S = d.gmt_po_shipments[0];
  ok(S.status === 'arrived' && S.arrived_at, 'علّمها «وصلت» ⇐ الحالة + وقت الوصول');
  await pg.click('[data-ship-f="arrived"]'); await sleep(200);
  ok(await pg.evaluate(() => document.querySelectorAll('[data-ship-recv]').length === 2), 'بعد الوصول: زرّ «📦 استلم» لكلّ فاتورة (الاستلام بالمسح كما هو)');
  await pg.click('[data-ship-recv]'); await sleep(1200);
  ok(await pg.evaluate(() => !document.querySelector('[data-poship]') && !!document.querySelector('#arr-body')), '«📦 استلم» يفتح نافذة الاستلام للفاتورة');
  await pg.evaluate(() => { const o = document.getElementById('gmt-arrival-ov'); if (o) o.remove(); });
  await pg.evaluate(() => render()); await sleep(300);
  ok(await pg.evaluate(() => document.querySelectorAll('[data-poship-chip]').length === 2 && [...document.querySelectorAll('[data-poship-chip]')].every(c => /وصلت/.test(c.textContent))), 'شارة الشحنة على بطاقة كلّ فاتورة — وحدة بس وبحالتها الأخيرة (بلا تكرار)');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await pg.evaluate(() => openPoShip()); await sleep(600); await pg.click('[data-ship-f="all"]'); await sleep(200);
  await pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/poship.png' });
  await pg.setViewportSize({ width: 390, height: 844 }); await sleep(300);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 392), 'عالهاتف: بلا تمرير أفقي');
  await pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/poship_m.png' });
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
