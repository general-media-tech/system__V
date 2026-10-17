const H = require('./h.js');
(async () => {
  await H.seed();
  await H.call('/__opts', { reject_cols: ['ship_from_office'] });
  const rows = await H.call('/rest/v1/gmt_orders', [{ name: 'عمود ناقص', phone: '0933111444', product: 'x', qty: 1, price: 10, status: 'pending', branch: 'حلب', address: 'دمشق' }]);
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 900, wait: 4500 });
  await pg.evaluate((id) => openShipModal(id), rows[0].id);
  await pg.selectOption('#ship-company', 'المفتي');
  await pg.selectOption('#ship-from', 'حمص|جورة الشياح');
  await pg.fill('#ship-tracking', '4242');
  await pg.evaluate(() => confirmShipping());
  await pg.waitForTimeout(1500);
  const db = await H.call('/rest/v1/gmt_orders?id=eq.' + rows[0].id, undefined, 'GET');
  const loc = await pg.evaluate(() => localStorage.getItem('gmt_ship_from'));
  const cur = await pg.evaluate((id) => shipFromOf(orders.find(o => o.id == id)), rows[0].id);
  console.log('status=', db[0].status, 'tracking=', db[0].tracking_number, 'local=', loc, 'resolved=', cur);
  console.log((db[0].status === 'shipped' && /جورة/.test(loc || '') && cur === 'حمص|جورة الشياح') ? 'PASS: الشحن لم ينكسر والفرع حُفظ محلياً' : 'FAIL');
  await browser.close();
})();
