const H = require('./h.js');
const OUT = __dirname + '/';
(async () => {
  for (const [w,h,mob,tag] of [[1366,900,false,'desk'],[390,844,true,'mob']]) {
    const { browser, pg, errs } = await H.open('site.html', { init: `try{localStorage.setItem('gmt_notif_prompted','1')}catch(e){}`, w, h, wait: 3500, mobile: mob });
    await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await pg.waitForTimeout(800);
    const hid = await pg.evaluate(() => [...document.querySelectorAll('.rev')].filter(e => getComputedStyle(e).opacity < 0.9).map(e => e.id || e.className));
    console.log(tag, 'still hidden after scroll:', hid, 'hscroll', await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2));
    await pg.screenshot({ path: OUT + `site2_${tag}_full.png`, fullPage: true });
    console.log(tag, 'errs', errs.filter(e => !/404|400|Failed|favicon/.test(e)));
    await browser.close();
  }
})();
