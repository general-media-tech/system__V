// TASK-B0553 · طابور Q2 · المالك seq B1078 «العقل درّبه أنت على كلّ شي — حتى على الأسئلة والاقتراحات»
// بنك الأسئلة (gmt-brainbank.js) على الطبقة الفوريّة بلا رصيد ⇒ علامة · الحدّ: 100% (أيّ سؤال غلط ⇒ يتدرّب قبل النشر)
const H = require('./h.js');
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 5000 });
  const R = await pg.evaluate(async () => await GMTBrain.selfTest());
  console.log('🎯 ' + R.score + '% — ' + R.pass + '/' + R.total + ' · ' + Object.entries(R.byType).map(([k, v]) => k + ' ' + v.pass + '/' + v.total).join(' · '));
  R.fails.forEach(f => console.log('  ✘ [' + f.t + '] «' + f.q + '» — ' + f.why));
  await pg.evaluate(() => GMTBrain.open()); await pg.waitForSelector('#gb-chips', { timeout: 8000 }).catch(() => {});
  const chip = await pg.evaluate(() => [...document.querySelectorAll('#gb-chips button')].some(b => /علامة العقل/.test(b.textContent)));
  console.log((chip ? '  ✔ ' : '  ✘ ') + 'زرّ «🎯 علامة العقل» بلوحة العقل للأدمن');
  await browser.close();
  const okAll = R.score === 100 && chip;
  console.log(okAll ? 'ALL PASS' : 'FAIL'); process.exit(okAll ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
