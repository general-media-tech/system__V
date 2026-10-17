const H = require('./h.js');
const OUT = __dirname + '/';
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [{ name: 'عدسة تجربة', barcode: 'GRP001', price: 100, haleb: 3, group_name: 'عدسات' }]);
  const { browser, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT, w: 390, h: 844, wait: 7000, mobile: true });
  await pg.screenshot({ path: OUT + 'grp_m_home.png' });
  const nav = await pg.evaluate(() => [...document.querySelectorAll('nav button, .bottom-nav button, [class*=bnav] button, [class*=tabbar] button')].map(b => (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20)));
  console.log('bottom nav:', JSON.stringify(nav));
  const more = pg.locator('button:has-text("المزيد")').first();
  console.log('more visible', await more.isVisible());
  await more.click(); await pg.waitForTimeout(700);
  await pg.screenshot({ path: OUT + 'grp_m_more.png' });
  const items = await pg.evaluate(() => [...document.querySelectorAll('#more-sheet .more-action-btn')].map(b => (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) + ' → ' + (b.getAttribute('onclick') || '').slice(0, 40)));
  console.log(JSON.stringify(items, null, 1));
  await browser.close();
})();
