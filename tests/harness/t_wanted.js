// OWN-10#19 — «أداة ما يطلبه الزبائن لا تعمل والهوية/الإيموجي/الشكل غير مضبوطة» — إعادة إنتاج وتحقّق:
// ١) صنفٌ سُجّل (كما يسجّله تحليل الشاشة) ⇒ يظهر بعدده · ٢) الإضافة اليدوية تظهر · ٣) «تمّ توفيره» ينقله للمعالَجة ·
// ٤) هوية النظام: أيقونات gmt-icons بدل الإيموجي في الصفحة · ٥) لا تمرير أفقيّ ولا أخطاء JS (موبايل وكمبيوتر).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  for (const [w, mob] of [[390, true], [1366, false]]) {
    console.log('— ' + w);
    await H.seed();
    const at = new Date().toISOString();
    await H.call('/rest/v1/gmt_audit', [
      { at, actor: 'سامر', action: 'unmet_demand', entity: 'demand', entity_name: 'حامل ثلاثي كاربون', entity_id: 'حامل ثلاثي كاربون', field: 'none', new_value: JSON.stringify({ k: 'حامل ثلاثي كاربون', msg: 'بدي ترايبود كاربون' }) },
      { at, actor: 'سامر', action: 'unmet_demand', entity: 'demand', entity_name: 'حامل ثلاثي كاربون خفيف', entity_id: 'حامل ثلاثي كاربون خفيف', field: 'none', new_value: JSON.stringify({ k: 'حامل ثلاثي كاربون خفيف' }) },
      { at, actor: 'فاحص', action: 'unmet_demand', entity: 'demand', entity_name: 'بطارية NP-FZ100', entity_id: 'بطاريه np fz100', field: 'out', new_value: JSON.stringify({ k: 'بطاريه np fz100' }) }]);
    const { browser, pg, errs } = await H.open('طلبات_غير_متوفرة.html', { w, h: 900, mobile: mob, wait: 3500 });
    await pg.waitForSelector('.it', { timeout: 8000 }).catch(() => {});
    let rows = await pg.$$eval('.it', l => l.map(e => ({ t: e.querySelector('.tm').innerText, n: e.querySelector('.cnt').innerText })));
    ok(rows.length === 2 && rows[0].n === '2' && /حامل ثلاثي كاربون/.test(rows[0].t), 'المسجَّل يظهر مدموجاً بعدده (الأكثر أوّلاً): ' + JSON.stringify(rows));
    // ٢) يدوي
    await pg.fill('#add-t', 'عدسة 85 ملم'); await pg.click('#add-b');
    await pg.waitForFunction(() => [...document.querySelectorAll('.it .tm')].some(e => /عدسة 85/.test(e.innerText)), null, { timeout: 8000 }).catch(() => {});
    rows = await pg.$$eval('.it .tm', l => l.map(e => e.innerText));
    ok(rows.some(t => /عدسة 85/.test(t)), 'الإضافة اليدوية تظهر في القائمة');
    // ٣) معالجة
    await pg.evaluate(() => { window.GMTAsk.confirm = async () => true; });
    await pg.click('.it [data-done]');
    await pg.waitForTimeout(600);
    await pg.click('[data-c="rs"]');
    const res = await pg.$$eval('.it.res .tm', l => l.map(e => e.innerText));
    ok(res.length >= 1, '«تمّ توفيره» ينقله إلى «المعالَجة»: ' + JSON.stringify(res));
    // ٤) الهوية: لا إيموجي في عناوين الصفحة/الأزرار — أيقونات gmt-icons
    const emo = await pg.evaluate(() => { const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u; return [...document.querySelectorAll('h1,.btn,.chip,.sub')].filter(e => re.test(e.innerText)).map(e => e.innerText.slice(0, 30)); });
    ok(emo.length === 0, 'لا إيموجي في العنوان والأزرار والفلاتر: ' + JSON.stringify(emo));
    const icon = await pg.evaluate(() => !!document.querySelector('h1 svg, .top svg, [data-ic] svg, .gi svg'));
    ok(icon, 'أيقونة الهوية (SVG) في رأس الصفحة');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    ok(!hs, 'لا تمرير أفقيّ');
    if (w === 390) await pg.screenshot({ path: __dirname + '/wanted_390.png', fullPage: true });
    const bad = errs.filter(e => !/Failed to load|favicon|404|ERR_|qrserver|vibrate/.test(e));
    ok(bad.length === 0, 'لا أخطاء JS: ' + JSON.stringify(bad.slice(0, 3)));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails} (pass ${pass})` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
