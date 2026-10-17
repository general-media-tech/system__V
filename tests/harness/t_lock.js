const H = require('./h.js');
(async () => {
  await H.seed();
  const rows = await H.call('/rest/v1/gmt_orders', [
    { name: 'بلا فاتورة', phone: '0999000010', product: 'كاميرا تجربة 1', qty: 1, price: 100, status: 'shipped', branch: 'حلب', address: 'حلب', shipping_company: 'المفتي' },
    { name: 'مفوتَر', phone: '0999000011', product: 'كاميرا تجربة 2', qty: 1, price: 100, status: 'shipped', branch: 'حلب', address: 'حلب', shipping_company: 'المفتي', invoice_number: '1001', invoice_id: 77 }]);
  const A = rows[0].id, B = rows[1].id;
  const status = async (id) => (await H.call('/__dump', undefined, 'GET')).gmt_orders.find(o => o.id === id).status;

  // ١) الصفحة السيادية: فعّل القفل من الواجهة
  {
    const { browser, pg } = await H.open('الأمان_والمستخدمون.html', { init: H.ADMIN_INIT, w: 1100, h: 900, wait: 3000, mobile: false });
    await pg.fill('#gate-pw', '2003'); await pg.evaluate(() => unlock()); await pg.waitForTimeout(2500);
    console.log('الحالة الأولى:', await pg.textContent('#ol-state'), '|', (await pg.textContent('#ol-btn')).trim());
    await pg.click('#ol-btn'); await pg.waitForSelector('.gmtask-ov', { timeout: 4000 }); await pg.keyboard.press('Enter'); await pg.waitForTimeout(2000);
    console.log('بعد التفعيل:', await pg.textContent('#ol-state'), '|', await pg.textContent('#ol-msg'));
    const db = (await H.call('/__dump', undefined, 'GET')).gmt_settings || [];
    console.log('في القاعدة:', JSON.stringify(db.filter(r => r.key === 'orders_lock')));
    await browser.close();
  }
  // ٢) الأوردرات: القفل ⇒ المحجوب والمسموح
  const { browser, pg } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 390, h: 800, wait: 5000 });
  const tryConfirm = async (id, type) => { await pg.evaluate(([id, type]) => { requestConfirm(id, type); return executeConfirm(); }, [id, type]); await pg.waitForTimeout(1200); };
  await tryConfirm(A, 'delivered');
  const dlg = await pg.evaluate(() => (document.querySelector('.gmtask-ov') || {}).textContent || '');
  console.log('قفل ON · بلا فاتورة ⇒', await status(A), '| حوار:', dlg.replace(/\s+/g, ' ').slice(0, 120));
  await pg.evaluate(() => { const o = document.querySelector('.gmtask-ov'); if (o) o.remove(); });
  await tryConfirm(B, 'delivered'); console.log('قفل ON · مفوتَر ⇒', await status(B));
  // قفل OFF
  await H.call('/rest/v1/gmt_settings?key=eq.orders_lock', { value: '0' }, 'PATCH');
  await pg.evaluate(() => GMTEndpoint.load(true)); await tryConfirm(A, 'delivered');
  console.log('قفل OFF · بلا فاتورة ⇒', await status(A));
  await browser.close();
})();
