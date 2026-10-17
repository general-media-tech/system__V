const H = require('./h.js');
const OUT = '/tmp/gmt-out/';
(async () => {
  await H.seed();
  for (const [label, init] of [['admin', H.ADMIN_INIT], ['staff', H.STAFF_INIT]]) {
    const { browser, pg, errs } = await H.open('home.html', { init, w: 1366, h: 900, wait: 3500, mobile: false });
    const r = await pg.evaluate(() => {
      const links = [...document.querySelectorAll('a[href*="admin_pos.html"]')].map(a => a.getAttribute('href'));
      const T = window.GMTTools; const reg = T ? T.all.filter(x => /admin_pos\.html/.test(x.f)).map(x => x.f + '|' + x.t) : [];
      return { cards: [...new Set(links)], reg: reg.length };
    });
    console.log(label, 'روابط admin_pos في الرئيسية:', JSON.stringify(r.cards), '| في السجلّ:', r.reg, errs.slice(0, 2));
    if (label === 'admin') await pg.screenshot({ path: OUT + 'home_tools_admin.png', fullPage: false });
    await browser.close();
  }
  for (const tab of ['transfers', 'stocktransfers', 'expenses', 'adminInvoice', 'accounting']) {
    const { browser, pg } = await H.open('admin_pos.html?tab=' + tab, { init: H.ADMIN_INIT, w: 1366, h: 820, wait: 3000, mobile: false });
    const act = await pg.evaluate(() => (document.querySelector('.main-tab.active') || {}).textContent || '').then(t => t.replace(/\s+/g, ' ').trim());
    console.log('?tab=' + tab, '⇒ التبويب النشط:', act);
    await browser.close();
  }
})();
