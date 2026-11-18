// (TASK-B0523) الرئيسية تطلب من الموظّف الداخل بلا «جلسة خادم» أن يدخل مرّةً بكلمة سرّه — وتختفي حين يأخذها
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  let o = await H.open('home.html', { wait: 4000, init: H.STAFF_INIT + ';try{localStorage.removeItem("gmt_sess_tok_v1")}catch(e){}' });
  ok(await o.pg.evaluate(() => !!document.getElementById('sess-note') && /خطوة أمان/.test(document.getElementById('sess-note').innerText)), 'بلا جلسة ⇒ «خطوة أمان» في الرئيسية');
  await o.browser.close();
  o = await H.open('home.html', { wait: 4000, init: H.STAFF_INIT + ';try{var s=JSON.parse(localStorage.getItem("gmt_session")||"null");if(s&&s.id){var m={};m[s.id]="' + 'b'.repeat(64) + '";localStorage.setItem("gmt_sess_tok_v1",JSON.stringify(m));}}catch(e){}' });
  ok(await o.pg.evaluate(() => !document.getElementById('sess-note')), 'معه جلسة ⇒ لا تنبيه');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
