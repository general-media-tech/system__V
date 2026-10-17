const H = require('./h.js');
const OUT = '/tmp/gmt-out/';
(async () => {
  await H.seed();
  for (const [p, w, h] of [['checks.html', 390, 800], ['orders.html', 320, 700], ['admin_pos.html', 1366, 820], ['pos.html', 390, 800], ['home.html', 390, 800]]) {
    const { browser, pg, errs } = await H.open(p, { init: H.ADMIN_INIT, w, h, wait: 3500, mobile: w < 700 });
    const r = await pg.evaluate(() => {
      const b = document.getElementById('gmt-home-btn'); const bar = document.getElementById('gmt-refresh-bar');
      const bb = b && b.getBoundingClientRect();
      return { has: !!b, inView: bb ? (bb.left >= 0 && bb.right <= innerWidth) : null, barOverflow: bar ? bar.scrollWidth > bar.clientWidth + 1 : null, hscroll: document.documentElement.scrollWidth > innerWidth + 2, btns: bar ? [...bar.children].map(c => c.id).join(',') : null };
    });
    console.log(p.padEnd(18), w, JSON.stringify(r), errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 2));
    if (p === 'checks.html') { await pg.screenshot({ path: OUT + 'chk_after.png' }); await pg.click('#gmt-home-btn'); await pg.waitForTimeout(1500); console.log('  بعد الضغط ⇒', pg.url().replace(H.BASE, '')); }
    await browser.close();
  }
})();
