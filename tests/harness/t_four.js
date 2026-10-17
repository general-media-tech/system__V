const H = require('./h.js');
(async () => {
  await H.seed();
  for (const p of ['أدمن_التوظيف.html', 'المنتجات.html', 'ردود_سريعة.html', 'سلة_المحذوفات.html']) {
    const { browser, pg, errs } = await H.open(p, { init: H.ADMIN_INIT, w: 390, h: 800, wait: 3500 });
    const r = await pg.evaluate(() => ({ bar: !!document.getElementById('gmt-refresh-bar'), home: !!document.getElementById('gmt-home-btn'), icons: document.querySelectorAll('.gmt-ei').length, sound: !!window.GMTSound, ic: !!window.GMTIcon }));
    console.log(p.padEnd(22), JSON.stringify(r), errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 2));
    await browser.close();
  }
})();
