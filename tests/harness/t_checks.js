const H = require('./h.js');
const OUT = '/tmp/gmt-out/';
(async () => {
  await H.seed();
  for (const p of ['checks.html', 'central_inspector.html', 'system_tools.html', 'guard_bots.html']) {
    const { browser, pg, errs } = await H.open(p, { init: H.ADMIN_INIT, w: 390, h: 800, wait: 4000 });
    const r = await pg.evaluate(() => {
      const btns = [...document.querySelectorAll('button, a')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
      const exit = btns.filter(t => /خروج|رجوع|الرئيسية|إغلاق|عودة|←|→/.test(t));
      return { title: document.title, nBtns: btns.length, exit: [...new Set(exit)].slice(0, 6), sample: [...new Set(btns)].slice(0, 14) };
    });
    console.log('==', p, JSON.stringify(r).slice(0, 700), errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 2));
    await pg.screenshot({ path: OUT + 'chk_' + p.replace('.html', '') + '.png' });
    await browser.close();
  }
})();
