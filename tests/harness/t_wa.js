const H = require('./h.js');
(async () => {
  await H.seed();
  const now = new Date().toISOString();
  const rows = await H.call('/rest/v1/gmt_orders', [
    { name: 'أحمد المبلَّغ', phone: '0933111222', product: 'كاميرا تجربة 1', qty: 1, price: 100, status: 'shipped', branch: 'حلب', address: 'دمشق — البرامكة', shipping_company: 'المفتي', tracking_number: '196682', notified_arrival_at: now },
    { name: 'سامر غير مبلَّغ', phone: '0933111333', product: 'كاميرا تجربة 2', qty: 1, price: 100, status: 'shipped', branch: 'حلب', address: 'حمص', shipping_company: 'مسارات' },
    { name: 'خالد المستلِم', phone: '0933111444', product: 'كاميرا تجربة 3', qty: 1, price: 100, status: 'delivered', branch: 'حلب', address: 'حلب — السليمانية', shipping_company: 'المفتي' }]);
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT + ' window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return null;};', w: 390, h: 900, wait: 5000 });
  const res = await pg.evaluate(() => {
    const out = {};
    for (const o of orders) {
      const card = [...document.querySelectorAll('[onclick]')].filter(b => (b.getAttribute('onclick') || '').includes(`(${o.id}`));
      out[o.name] = card.map(b => b.getAttribute('onclick').replace(/\(.*$/, '')).filter((v, i, a) => a.indexOf(v) === i).filter(v => /contact|share|notify/i.test(v));
    }
    return out;
  });
  console.log(JSON.stringify(res, null, 0));
  await pg.evaluate((id) => contactCustomerArrival(id), rows[0].id);
  const url = await pg.evaluate(() => window.__opened[0] || '');
  console.log('URL:', decodeURIComponent(url).slice(0, 360));
  console.log('errors:', errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 3));
  await browser.close();
})();
