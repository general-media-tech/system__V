const H = require('./h.js');
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('checks.html', { init: H.ADMIN_INIT, w: 390, h: 800, wait: 3500 });
  const bar = await pg.$$eval('.gmt-refresh-bar button, #gmt-refresh-bar button, .gmt-refresh-bar a', bs => bs.map(b => (b.id || '') + '|' + (b.title || b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 30)));
  console.log('bar:', JSON.stringify(bar));
  const idx = bar.findIndex(x => /أدوات|الأدوات|tools/i.test(x));
  console.log('tools idx', idx);
  const els = await pg.$$('.gmt-refresh-bar button, #gmt-refresh-bar button');
  for (let i = 0; i < els.length; i++) {
    const t = bar[i]; if (/تحديث|إشعار|الإشعارات|عقل/.test(t)) continue;
    await els[i].click(); await pg.waitForTimeout(700);
    const sheet = await pg.evaluate(() => { const o = [...document.querySelectorAll('body > *')].filter(e => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().height > 200); return o.map(e => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 200)); });
    console.log('click', t, '=>', JSON.stringify(sheet).slice(0, 500));
  }
  await browser.close();
})();
