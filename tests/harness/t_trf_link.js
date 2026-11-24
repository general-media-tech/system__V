// (seq B1059 «نعمل لها طباعه باركودات») inventory.html?trf=TRF-xxxxx ⇒ تُفتح فاتورة النقل نفسها · &labels=1 ⇒ نافذة ملصقات الباركود
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [P] = await H.call('/rest/v1/products', [{ name: 'منتج الرابط', barcode: 'TL01', haleb: 0, price: 10 }]);
  const [T] = await H.call('/rest/v1/branch_stock_transfers', { transfer_number: 'TRF-00917', from_branch: 'rebuild', from_branch_name: 'تسوية من الجرد', to_branch: 'haleb', to_branch_name: 'حلب', status: 'pending', is_locked: true, title: 'فاتورة تسوية — حلب · تجربة الرابط', created_at: new Date().toISOString() });
  await H.call('/rest/v1/stock_transfer_items', { transfer_id: T.id, product_id: P.id, product_name: 'منتج الرابط', barcode: 'TL01', qty: 3, requested_qty: 3 });
  for (const lab of [false, true]) {
    const { browser, pg, errs } = await H.open('inventory.html?trf=TRF-00917' + (lab ? '&labels=1' : ''), { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 8000 });
    let pops = 0; pg.context().on('page', () => pops++);
    await pg.waitForTimeout(lab ? 3000 : 1500);
    const r = await pg.evaluate(() => { const b = document.getElementById('st-detail-body'); return { hl: !!document.querySelector('[data-trf-labels-hl]'), txt: b ? b.innerText : '', cur: (window.stCurrentDetail || (typeof stCurrentDetail !== 'undefined' && stCurrentDetail) || {}).transfer_number }; });
    if (!lab) ok(r.cur === 'TRF-00917' && /منتج الرابط/.test(r.txt), '?trf=TRF-00917 ⇒ تُفتح فاتورة النقل ببنودها: ' + r.cur);
    else ok(r.hl && r.cur === 'TRF-00917', '&labels=1 ⇒ زرّ «ملصقات الباركود» مُبرَز (النافذة تُفتح بضغطة — المتصفّح يحجبها تلقائياً)');
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
