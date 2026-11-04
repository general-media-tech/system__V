// (TASK-0311 هـ) كاشف «زر بلا أثر»: ضغط تبويبٍ مفتوحٍ أصلاً (المشتريات «فورية») لا يُسجَّل زرّاً ميّتاً — وزرٌّ ميّت حقيقي ما زال يُسجَّل.
// قبل الإصلاح (أُعيد إنتاجه): «زر بلا أثر: ضغطت «فورية 0» ولم يحدث شيء».
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  const logs = [];
  const grab = async () => { const r = await pg.evaluate(() => { let a = []; try { a = JSON.parse(localStorage.getItem('gmt_bugs_v3') || '[]'); } catch (_) {} return a.map(x => x.type + ': ' + x.msg); }); logs.length = 0; logs.push(...r); };
  const clear = () => pg.evaluate(() => { try { localStorage.removeItem('gmt_bugs_v3'); } catch (_) {} });
  await pg.click('#tab-btn-instant'); await pg.waitForTimeout(1200);
  const active = await pg.evaluate(() => document.getElementById('tab-btn-instant').className);
  await clear();
  await pg.click('#tab-btn-instant'); await pg.waitForTimeout(2600); await grab();
  ok(/active/.test(active), 'التبويب نشط بعد الضغطة الأولى');
  ok(!logs.some(x => /بلا أثر/.test(x) && /فورية/.test(x)), 'ضغط التبويب المفتوح أصلاً ⇒ لا «زر بلا أثر»: ' + JSON.stringify(logs.filter(x => /بلا أثر/.test(x))));
  // زرّ ميّت حقيقي في الشريط نفسه
  await pg.evaluate(() => { const b = document.createElement('button'); b.id = 'deadbtn'; b.textContent = 'زر تجريبي ميّت'; b.setAttribute('onclick', 'void 0'); document.getElementById('tab-btn-log').parentNode.appendChild(b); });
  await pg.waitForTimeout(800); await clear();
  await pg.click('#deadbtn'); await pg.waitForTimeout(2600); await grab();
  ok(logs.some(x => /بلا أثر/.test(x) && /زر تجريبي ميّت/.test(x)), 'زرّ ميّت حقيقي ما زال يُسجَّل: ' + JSON.stringify(logs));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
