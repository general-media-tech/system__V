// (TASK-A0554 · سجلّ الأخطاء: «ضغطت «عدسات كانون» ولم يحدث شيء» — وهو يقفز لقسمه فعلاً)
//  ① زرٌّ يمرّر الصفحة فقط ⇒ ليس «بلا أثر»
//  ② زرٌّ لا يفعل شيئاً حقّاً ⇒ ما زال يُبلَّغ (الحارس لم يُعمَ)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('center.html', { w: 390, h: 800, wait: 5000 });
  await pg.evaluate(() => {
    const pad = document.createElement('div'); pad.style.height = '4000px'; document.body.appendChild(pad);
    const tgt = document.createElement('section'); tgt.id = 'tgt'; tgt.textContent = 'قسم'; document.body.appendChild(tgt);
    const b1 = document.createElement('button'); b1.textContent = 'عدسات كانون'; b1.id = 'b1'; b1.style.cssText = 'position:fixed;top:60px;left:10px;z-index:99999';
    b1.onclick = () => window.scrollTo({ top: document.getElementById('tgt').offsetTop - 60 });
    const b2 = document.createElement('button'); b2.textContent = 'زر ميّت'; b2.id = 'b2'; b2.style.cssText = 'position:fixed;top:110px;left:10px;z-index:99999';
    b2.onclick = () => {};
    document.body.appendChild(b1); document.body.appendChild(b2);
  });
  await sleep(2500);
  const n = t => pg.evaluate(t => GMTBug.list().filter(e => e.type === 'زر بلا أثر' && e.msg.includes(t)).length, t);
  await pg.click('#b1'); await sleep(2600);
  ok(await n('عدسات كانون') === 0, '① زرّ القسم (تمرير فقط) ليس «بلا أثر»');
  const nd = t => pg.evaluate(t => GMTBug.list().filter(e => e.type === 'dead_click' && String(e.msg || '').includes(t)).length, t);
  ok(await nd('عدسات كانون') === 0, '①ب المفتّش (gmt-staff) أيضاً لا يعدّ زرّ القسم ميّتاً (TASK-0377)');
  /* (TASK-0377) الرجوع للأعلى فوراً وانتظار هدوء التمرير — التمرير الناعم كان يستمرّ أثناء ضغط الزرّ الميّت فيُحسب «أثراً» */
  await pg.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await sleep(1500);
  await pg.evaluate(() => new Promise(res => { let last = performance.getEntriesByType('resource').length, quiet = 0; const t = setInterval(() => { const n = performance.getEntriesByType('resource').length; quiet = n === last ? quiet + 250 : 0; last = n; if (quiet >= 2500) { clearInterval(t); res(); } }, 250); setTimeout(() => { clearInterval(t); res(); }, 20000); }));   /* (TASK-0377) هدوء الشبكة قبل الضغط */
  await pg.click('#b2'); await sleep(2600);
  ok(await n('زر ميّت') === 1, '② الزرّ الميّت فعلاً ما زال يُبلَّغ');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
