const { chromium } = require('/opt/node22/lib/node_modules/playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 900, height: 1250 } });
  await pg.route(/^https:\/\/(?!127)/, r => r.fulfill({ status: 404, body: '' }));
  await pg.goto('http://127.0.0.1:8765/orders.html', { waitUntil: 'domcontentloaded' });
  await pg.addScriptTag({ url: 'http://127.0.0.1:8765/gmt-invoice-tpl.js' });
  const html = await pg.evaluate(() => GMTInvoiceTpl.storeHTML({ ref: 'ST-20261016-0042', name: 'بلال أحمد الخطيب', phone: '0988733536', address: 'دمشق — البرامكة · شارع سانا', payment: 'cod', delivery: 3, notes: 'اتصل قبل الوصول', items: [{ name: 'عدسة Canon RF 50mm f/1.8 STM', qty: 1, price: 185 }, { name: 'بطارية LP-E17 كوبي', qty: 2, price: 25 }] }));
  fs.writeFileSync('/tmp/store_inv.html', html);
  await pg.goto('file:///tmp/store_inv.html'); await pg.waitForTimeout(800);
  await pg.screenshot({ path: '/tmp/store_inv.png', fullPage: true });
  await b.close();
})();
