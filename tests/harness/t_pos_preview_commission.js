// (طابور سونيت · الطباعة) VER-3#REQ-0260 — شاشة معاينة الفاتورة قبل الطباعة تُظهر نسبة العمولة والمبلغ المتوقَّع (كان «العمولة المتوقعة» يبقى 0.00 دائماً)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const o = await H.open('pos.html', { w: 1366, h: 900, mobile: false, wait: 3500 });
  const r = await o.pg.evaluate(() => {
    cart = {};
    cart.a = { prod: { id: 'a', name: 'أ', wholesale_price: 80 }, price: 100, qty: 2 };   // (100-80)*0.5*2 = 20
    cart.b = { prod: { id: 'b', name: 'ب', wholesale_price: 0 }, price: 50, qty: 1 };     // بلا جملة ⇒ 0
    liveUpdateInvoice();
    const amt = document.getElementById('pCommission').textContent, det = document.getElementById('pCommissionDetail').textContent;
    const expect = (commissionLine(100, 80, 2)).toFixed(2);
    cart.a.price = 90; liveUpdateInvoice();
    return { amt, det, expect, after: document.getElementById('pCommission').textContent, rate: Math.round(commissionRate() * 100) };
  });
  ok(r.amt === r.expect && Number(r.amt) > 0, 'المبلغ المتوقَّع يظهر ويطابق commissionLine: ' + r.amt + ' = ' + r.expect);
  ok(r.det.includes(r.rate + '٪'), 'نسبة العمولة تظهر: ' + r.det);
  ok(r.after === '10.00', 'يتحدّث عند تغيير السعر (90 ⇒ 10.00): ' + r.after);
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|vibrate|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
