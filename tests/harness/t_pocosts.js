// seq B1099/B1100 ⇐ صحّحها المالك C1121 (TASK-0378): الصينية = بالصين قبل الشحن (فاتورة + نقل داخلي + تحويل) · عند الوصول (شحن لسوريا + جمارك + داخل سوريا)
const H = require('./h.js');
global.window = globalThis; const PP = require('../../gmt-popay.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const CN = { id: 1, inv_type: 'china', total_amount: 1000, cash_payment: 1200, cost_shipping: 200, cost_customs: 50, cost_transport: 10, cost_local: 0, costs_paid: false };
  const s = PP.summary(CN, []);
  ok(s.value === 1010 && s.remaining === 0 && s.costs === 250 && s.covered === 190 && s.costsDue === 60 && s.totalRemaining === 60 && s.costParts.map(x => x[0]).join() === 'شحن لسوريا,جمارك' && s.status === 'paid',
     'الصين: المطلوب بالصين 1010 (فاتورة + نقل) مدفوع · عند الوصول 250 منها 190 اندفعت مع المورّد ⇒ باقي 60 · ككلّ 60: ' + JSON.stringify({ v: s.value, c: s.costs, cv: s.covered, d: s.costsDue, t: s.totalRemaining, st: s.status }));
  const P = PP.summary(Object.assign({}, CN, { cash_payment: 500, cost_transfer: 5 }), []);
  ok(P.value === 1015 && P.remaining === 515 && P.costsDue === 250 && P.totalRemaining === 765 && P.status === 'partial', 'دفعة جزئية 500: باقي بالصين 515 (1000+10 نقل+5 تحويل) · عند الوصول 250 · ككلّ 765: ' + JSON.stringify({ v: P.value, r: P.remaining, d: P.costsDue, t: P.totalRemaining }));
  global.window.GMTLedger || require('../../gmt-ledger.js');
  const L = global.window.GMTLedger;
  ok(L.supplierDue(CN) === 1010 && L.costsTotal(CN) === 250 && L.coveredByInvoice(CN) === 190 && L.desired(Object.assign({}, CN, { costs_paid: true })).c === 60, 'الدفتر بنفس القاعدة: المورّد 1010 · الوصول 250 · مغطّى 190 · قيد التكاليف 60');
  const DE = Object.assign({}, CN, { inv_type: 'germany', cash_payment: 1000 });
  ok(PP.summary(DE, []).costs === 260 && PP.summary(Object.assign({}, DE, { costs_paid: true }), []).costsDue === 0, 'أوروبا: الشحن من التكاليف (260) · بعد «اندفعت» ⇐ صفر');
  await H.seed();
  await H.call('/rest/v1/import_log', [{ id: 997, inv_number: 'CN-COST-1', inv_type: 'china', supplier: 'مورد', inv_date: '2026-11-01', status: 'transit', total_amount: 1000, cash_payment: 1200, cost_shipping: 200, cost_customs: 50, cost_transport: 10, cost_local: 0, costs_paid: false, items_snapshot: [{ id: 1, name: 'x', qty: 1, unit_price: 1000 }], created_at: '2026-11-01T00:00:00Z' }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  ok(await pg.evaluate(() => /تكاليف لسّا عليها 60\.00\$/.test((document.querySelector('[data-popay-costs="997"]') || {}).textContent || '')), 'على البطاقة: «🧾 تكاليف لسّا عليها 60$»');
  await pg.evaluate(() => openPoPay('997')); await sleep(1200);
  let t = await pg.evaluate(() => (document.querySelector('[data-popay-costbox]') || {}).textContent || '');
  ok(/لسّا عليها دفع/.test(t) && /60\.00\$/.test(t) && /190\.00\$ منها اندفعت مع دفعة المورّد/.test(t) && /عند الوصول/.test(t), 'بالدفعات: «عند الوصول» ⏳ لسّا عليها 60$ + «190$ منها اندفعت مع دفعة المورّد»: ' + t.slice(0, 160));
  const tt = await pg.evaluate(() => (document.querySelector('#gmt-popay') || {}).textContent || '');
  ok(/المطلوب بالصين/.test(tt) && /باقي عليك بالصين/.test(tt) && /باقي عند الوصول/.test(tt) && /باقي ككلّ\s*60\.00\$/.test(tt), 'خانات: المطلوب بالصين · باقي عليك بالصين · باقي عند الوصول · باقي ككلّ 60$');
  await pg.evaluate(() => { window.GMTAsk = Object.assign(window.GMTAsk || {}, { prompt: () => Promise.resolve('أبو خالد') }); });
  await pg.click('[data-popay-costs-paid]'); await sleep(2000);
  const d = await H.call('/__dump', undefined, 'GET');
  const inv = d.import_log.find(x => x.id === 997), led = (d.gmt_expenses || []).filter(x => /\[PO:997:c:/.test(x.note || ''));
  ok(inv.costs_paid === true, 'انعلّمت «اندفعت» (costs_paid)');
  ok(led.length === 1 && Math.abs(Number(led[0].amount) - 60) < 0.01 && /أبو خالد/.test(led[0].note), 'قيد الدفتر للتكاليف 60$ باسم الدافع (بلا الشحن — ما بينعدّ مرّتين): ' + JSON.stringify(led.map(x => [x.amount, x.note])));
  t = await pg.evaluate(() => (document.querySelector('[data-popay-costbox]') || {}).textContent || '');
  ok(/اندفعت/.test(t) && !/لسّا عليها دفع/.test(t), 'الصندوق صار «✅ اندفعت»');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await pg.screenshot({ path: '/tmp/pocosts.png' });
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
