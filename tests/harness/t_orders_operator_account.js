// (المالك seq 806 · VER-2#REQ-0244) «مافي حدا بيدخل عالتطبيق بدون حساب — نقطة بيع أو أدمن» ⇒ الأوردرات تأخذ الاسم من الحساب ولا تسأل «أدخل اسمك»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('orders.html', { init: H.STAFF_INIT + ";try{localStorage.setItem('gmt_operator_name','اسم قديم يدوي')}catch(e){}", wait: 5000 });
  await sleep(1200);
  const r = await pg.evaluate(() => ({ overlay: !!document.getElementById('gmt-op-input'), name: getOperatorName() }));
  ok(!r.overlay, 'لا نافذة «أدخل اسمك» لموظف نقطة البيع المسجَّل');
  ok(r.name === 'سامر', 'الاسم من حساب نقطة البيع لا من الاسم اليدوي القديم: ' + r.name);
  const a = await pg.evaluate(() => { GMTRole.grant('المدير أحمد'); const n = getOperatorName(); GMTRole.revoke(); return n; });
  ok(a === 'المدير أحمد', 'الأدمن المسجَّل ⇒ اسم حساب الأدمن: ' + a);
  const p = await pg.evaluate(async () => { localStorage.removeItem('gmt_session'); localStorage.removeItem('gmt_operator_name'); const v = await promptOperatorName(); return { v, overlay: !!document.getElementById('gmt-op-input') }; });
  ok(p.v === '' && !p.overlay, 'بلا حساب: لا نافذة اسم (حارس الدخول هو من يطلب الحساب)');
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
