const H = require('./h.js');
(async () => {
  const { browser, pg, errs } = await H.open('site.html', { init: `try{localStorage.setItem('gmt_notif_prompted','1')}catch(e){}`, w: 390, h: 844, wait: 4000, mobile: true });
  const info = async () => pg.evaluate(() => { const e = document.getElementById('branches'); const r = e.getBoundingClientRect(); return { cls: e.className, op: getComputedStyle(e).opacity, h: Math.round(r.height), top: Math.round(r.top + scrollY), docH: document.body.scrollHeight, vh: innerHeight, nl: getComputedStyle(document.getElementById('nl-sec')).display }; });
  console.log('before', JSON.stringify(await info()));
  await pg.evaluate(() => document.getElementById('branches').scrollIntoView());
  await pg.waitForTimeout(1200);
  console.log('after scrollIntoView', JSON.stringify(await info()));
  await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pg.waitForTimeout(1200);
  console.log('after bottom', JSON.stringify(await info()));
  await pg.screenshot({ path: __dirname + '/site3_mob_bottom.png' });
  console.log(errs.filter(e => !/404|400|Failed|favicon/.test(e)));
  await browser.close();
})();
