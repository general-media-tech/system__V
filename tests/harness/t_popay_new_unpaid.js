// TASK-B0545 م٢ · A1004 P1 «الفاتورة الجديدة غير مدفوعة حتى دفعة»: خانة المدفوع بتعرض الإجمالي افتراضياً ⇒ كانت كلّ جديدة «مدفوعة بالكامل»
// جديدة + الخانة ما انلمست ⇒ cash_payment = 0 · كتبت مبلغ ⇒ متل ما كتبته · الفاتورة الموجودة ما بتتأثّر
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A] = await H.call('/rest/v1/products', [{ name: 'منتج الدفع', barcode: 'NU1', price: 100, china: 0 }]);
  const snap = [{ id: A.id, name: A.name, qty: 2, unit_price: 50, orig_unit_price: 50, sale_price: 100 }];
  await H.call('/rest/v1/import_log', [{ id: 881, inv_number: 'IMP-NU-1', inv_type: 'china', status: 'transit', supplier: 'م', cash_payment: 40, total_amount: 100, items_snapshot: snap }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  const rows = () => H.call('/__dump', undefined, 'GET').then(d => d.import_log);
  const asNew = async (touch, num) => {
    await pg.evaluate(() => openInvFromList('881')); await sleep(700);
    await pg.evaluate(([touch, num]) => { window._invOpen = { draft: true, kind: 'import' }; const f = document.querySelector('#invPage .inv-field[data-field="inv_number"]') || document.querySelector('#invPage [data-field="invNum"]'); if (f) f.textContent = num;
      const c = document.querySelector('#invPage .inv-field[data-field="cash"]'); if (c && touch) { c.textContent = '25'; c.dispatchEvent(new Event('input', { bubbles: true })); } return !!c; }, [touch, num]);
    await pg.evaluate(() => { window.GMTAsk && (GMTAsk.confirm = async () => true); return saveInvCloud(); }).catch(() => {});
    await sleep(3500);
  };
  const before = (await rows()).length;
  await asNew(false, 'IMP-NU-NEW1');
  let R = await rows(); let fresh = R.filter(x => x.id !== 881);
  ok(R.length === before + 1 && fresh.length === 1 && Number(fresh[0].cash_payment) === 0, 'فاتورة جديدة والخانة ما انلمست ⇒ «غير مدفوعة» (cash_payment 0): ' + JSON.stringify(fresh.map(x => x.cash_payment)));
  await asNew(true, 'IMP-NU-NEW2');
  R = await rows(); fresh = R.filter(x => x.id !== 881).sort((a, b) => b.id - a.id);
  ok(fresh.length === 2 && Number(fresh[0].cash_payment) === 25, 'كتبت مبلغ بالخانة ⇒ بينحفظ متل ما كتبته (25): ' + JSON.stringify(fresh.map(x => x.cash_payment)));
  ok(Number(R.find(x => x.id === 881).cash_payment) === 40, 'الفاتورة الموجودة ما تأثّرت (40)');
  ok(!errs.filter(e => !/favicon|404|400|406|409|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|409|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
