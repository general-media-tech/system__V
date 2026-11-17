// (VER-2#REQ-0139) فاتورة الشراء المُرحَّلة لا تُحذف؛ غير المُرحَّلة تُحذف بعد التأكيد
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1100, h: 900, wait: 5000, mobile: false });
  const r = await pg.evaluate(async () => {
    let asked = 0; const oc = window.GMTAsk && GMTAsk.confirm;
    if (oc) GMTAsk.confirm = async () => { asked++; return false; };
    ships = [{ id: 901, inv_number: 'T-1', transferred: true }, { id: 902, inv_number: 'T-2', transferred: false }];
    await delShip(901); const a = asked;
    await delShip(902);
    if (oc) GMTAsk.confirm = oc;
    return { a, b: asked, n: ships.length };
  });
  ok(r.a === 0, 'المُرحَّلة: لا سؤال تأكيد ولا حذف');
  ok(r.b === 1 && r.n === 2, 'غير المُرحَّلة: يُسأل التأكيد (رُفض ⇒ لا حذف)');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
