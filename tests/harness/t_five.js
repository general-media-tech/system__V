const H = require('./h.js');
const OUT = '/tmp/gmt-out/';
(async () => {
  await H.seed();
  let i = 0;
  for (const p of ['أدمن_التوظيف.html', 'العروض_والتسعير.html', 'المنتجات.html', 'ردود_سريعة.html', 'سلة_المحذوفات.html']) {
    for (const [w, h] of [[390, 800], [1366, 820]]) {
      const { browser, pg, errs } = await H.open(p, { init: H.ADMIN_INIT, w, h, wait: 3500, mobile: w < 700 });
      const r = await pg.evaluate(() => { const bar = document.getElementById('gmt-refresh-bar'); const hd = document.querySelector('header, h1, .top, .hd'); const hb = hd && hd.getBoundingClientRect(); const bb = bar && bar.getBoundingClientRect(); return { bar: !!bar, home: !!document.getElementById('gmt-home-btn'), refresh: !!document.getElementById('gmt-refresh-btn'), overlap: hb && bb ? (hb.top < bb.bottom - 1 && hb.top >= 0 && hb.bottom > bb.top) : null, hscroll: document.documentElement.scrollWidth > innerWidth + 2 }; });
      console.log(p.padEnd(22), w, JSON.stringify(r), errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 2));
      if (w === 390 && (p.startsWith('سلة') || p.startsWith('ردود'))) await pg.screenshot({ path: OUT + 'five_' + (++i) + '.png' });
      await browser.close();
    }
  }
})();
