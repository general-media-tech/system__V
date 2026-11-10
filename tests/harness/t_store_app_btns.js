// (TASK-0346 · المالك seq 522) «من اللابتوب داخل التطبيق مو موجود زر للرفريش بالمتجر ولا زر عودة للرئيسية»
// زبون في المتصفّح ⇒ لا زرّان · موظّف ⇒ الزرّان و«الرئيسية» ⇐ home.html · داخل التطبيق المثبَّت (بلا جلسة) ⇒ الزرّان و«الرئيسية» ⇐ أعلى المتجر · «تحديث» يعيد تحميل المتجر.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const GUEST = `try{ localStorage.removeItem('gmt_session'); localStorage.setItem('gmt_notif_prompted','1'); }catch(e){}`;
const APP = GUEST + `;(function(){ var mm = window.matchMedia; window.matchMedia = function(q){ if (/display-mode:\\s*standalone/.test(q)) return { matches: true, media: q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }; return mm.call(window, q); }; })();`;
const vis = pg => pg.evaluate(() => ['store-app-refresh', 'store-app-home'].map(id => { const e = document.getElementById(id); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }));
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, categories: [{ id: 'c1', name: 'كاميرات' }], products: Array.from({ length: 12 }, (_, i) => ({ id: 's' + i, name: 'منتج ' + i, price: 10 + i, category_ids: ['c1'], images: [] })), banners: [] }]);
  for (const [w, mob] of [[1366, false], [390, true]]) {
    console.log('— ' + w);
    let { browser, pg } = await H.open('store.html', { init: GUEST, w, h: 860, mobile: mob, wait: 5000 });
    ok(JSON.stringify(await vis(pg)) === '[false,false]', w + ': زبون في المتصفّح ⇒ لا زرّ تحديث ولا رئيسية');
    await browser.close();
    ({ browser, pg } = await H.open('store.html', { init: H.STAFF_INIT, w, h: 860, mobile: mob, wait: 5000 }));
    ok(JSON.stringify(await vis(pg)) === '[true,true]', w + ': موظّف ⇒ الزرّان ظاهران في رأس المتجر');
    await Promise.all([pg.waitForURL(/home\.html/, { timeout: 8000 }).catch(() => {}), pg.click('#store-app-home')]);
    ok(/home\.html/.test(pg.url()), w + ': «الرئيسية» للموظّف ⇒ رئيسية النظام: ' + pg.url().replace(/^.*\//, ''));
    await browser.close();
    ({ browser, pg } = await H.open('store.html', { init: APP, w, h: 860, mobile: mob, wait: 5000 }));
    ok(JSON.stringify(await vis(pg)) === '[true,true]', w + ': داخل التطبيق المثبَّت (بلا شريط متصفّح) ⇒ الزرّان ظاهران');
    await pg.evaluate(() => window.scrollTo(0, 1500)); await pg.waitForTimeout(300);
    await pg.click('#store-app-home'); await pg.waitForTimeout(1200);
    ok(/store\.html/.test(pg.url()) && await pg.evaluate(() => scrollY) < 50, w + ': «الرئيسية» داخل تطبيق المتجر ⇒ أعلى المتجر');
    await Promise.all([pg.waitForURL(/[?&]r=/, { timeout: 8000 }).catch(() => {}), pg.click('#store-app-refresh')]);
    await pg.waitForTimeout(2500);
    ok(/store\.html\?r=/.test(pg.url()) && await pg.evaluate(() => !!document.querySelector('[data-container="products-area"] section')), w + ': «تحديث» يعيد تحميل المتجر من جديد: ' + pg.url().replace(/^.*\//, ''));
    await browser.close();
  }
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
