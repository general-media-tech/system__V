// TASK-B0551 · A0587 · المالك A1026 «جهاز إدارة المستودعات» · seq B1082 «فكّر بالشغل»: الموظّف بيمسح أيّ قطعة ⇐ بتنفتح فاتورتها ⇐ استلام بالمسح
// + بطاقات الجرد والنقل والملصقات بتفتح شاشاتها مباشرةً (بلا مسار مخزون جديد) · بلا أسعار
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [{ name: 'منتج المستودع أ', barcode: 'W-A', price: 10, china: 2 }, { name: 'منتج المستودع ب', barcode: 'W-B', price: 10, china: 3 }]);
  await H.call('/rest/v1/import_log', [
    { id: 961, inv_number: 'IMP-WH-1', inv_type: 'china', status: 'transit', supplier: 'مورد', transferred: false, total_amount: 50, items_snapshot: [{ id: A.id, name: A.name, barcode: 'W-A', qty: 2, unit_price: 10 }, { id: B.id, name: B.name, qty: 3, unit_price: 10 }], created_at: '2026-11-20T00:00:00Z' },
    { id: 962, inv_number: 'IMP-WH-DONE', inv_type: 'china', status: 'arrived', transferred: true, total_amount: 10, items_snapshot: [{ id: A.id, name: A.name, qty: 1 }], created_at: '2026-11-19T00:00:00Z' }]);
  let { browser, ctx, pg, errs } = await H.open('مستودع.html', { init: H.STAFF_INIT, w: 390, h: 844, wait: 4000 });
  const t = await pg.evaluate(() => ({ cards: document.querySelectorAll('[data-card]').length, open: [...document.querySelectorAll('#open [data-recv]')].map(a => a.dataset.recv), txt: document.body.innerText }));
  ok(t.cards === 4, '٤ بطاقات كبيرة: استلام · جرد · نقل · ملصقات');
  ok(t.open.join() === '961', 'الفواتير المفتوحة بس (المستلمة كاملة ما بتطلع): ' + t.open.join());
  ok(/2 صنف · 5 قطعة باقية/.test(t.txt) && !/\$/.test(t.txt), 'الباقي بالقطع — وبلا أسعار');
  await pg.fill('#code', 'XYZ'); await pg.press('#code', 'Enter'); await pg.waitForTimeout(500);
  ok(/مو بأيّ فاتورة مفتوحة/.test(await pg.textContent('#msg')), 'باركود مو بأيّ فاتورة ⇐ بيقول');
  await pg.fill('#code', 'W-B'); await pg.press('#code', 'Enter'); await pg.waitForTimeout(1500);
  ok(/بدّو صلاحية «استلام البضاعة/.test(await pg.textContent('#msg')) && !/purchase/.test(pg.url()), 'موظّف بلا صلاحية: لقى الفاتورة بس بيقلّه شو الصلاحية يلي بدّو ياها (بدل صفحة مقفولة)');
  await browser.close();
  // موظّف ممنوح «استلام البضاعة» (purchase.html?tab=recv) — المدير بيعطيها
  const GRANT = H.STAFF_INIT + "try{localStorage.setItem('gmt_grants_2', JSON.stringify(['purchase.html?tab=recv']))}catch(e){}";
  ({ browser, pg, errs } = await H.open('مستودع.html', { init: GRANT, w: 390, h: 844, wait: 4000 }));
  await pg.fill('#code', 'W-B'); const nav = pg.waitForURL(/purchase\.html\?recv=961/, { timeout: 8000 }).then(() => true).catch(() => false);
  await pg.press('#code', 'Enter');
  ok(await nav, 'ممنوح الاستلام: مسح قطعة بلا باركود بالفاتورة (W-B — من الجرد) ⇐ لقى فاتورتها وفتح purchase.html?recv=961');
  await pg.waitForSelector('#gmt-arrival-ov [data-sr-box]', { timeout: 12000 }).catch(() => {});
  ok(await pg.evaluate(() => { const ov = document.getElementById('gmt-arrival-ov'); return !!ov && getComputedStyle(ov).display !== 'none' && document.getElementById('appContent').style.visibility === 'hidden'; }), 'ممنوح الاستلام: نافذة الاستلام ظاهرة — وقائمة المشتريات وأسعارها مخفيّة');
  const back = pg.waitForURL(/%D9%85%D8%B3%D8%AA%D9%88%D8%AF%D8%B9\.html|مستودع\.html/, { timeout: 8000 }).then(() => true).catch(() => false);
  await pg.click('#arr-cancel'); ok(await back, 'لمّا يسكّر النافذة ⇐ بيرجع لجهاز المستودع');
  await browser.close();
  ({ browser, pg, errs } = await H.open('purchase.html', { init: GRANT, w: 390, h: 844, wait: 5000 }));
  await pg.waitForTimeout(1500);
  ok(/مستودع|%D9%85%D8%B3%D8%AA%D9%88%D8%AF%D8%B9/.test(pg.url()), 'ممنوح الاستلام بس: فتح المشتريات مباشرةً ⇐ بيرجع لجهاز المستودع (القائمة مو إله)');
  await browser.close();
  ({ browser, pg, errs } = await H.open('purchase.html?recv=961', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 }));
  await pg.waitForSelector('#gmt-arrival-ov [data-sr-box]', { timeout: 12000 }).catch(() => {});
  ok(await pg.evaluate(() => { const b = document.querySelector('#gmt-arrival-ov [data-sr-box]'); return !!b && b.style.display !== 'none' && [...document.querySelectorAll('#arr-body [data-mv]')].every(i => i.value === '0'); }), '?recv= ⇐ نافذة «وصلت» بوضع الاستلام بالمسح مباشرةً (الكمّيات صفر)');
  await browser.close();
  ({ browser, pg, errs } = await H.open('pos.html?go=count', { init: H.STAFF_INIT, w: 390, h: 844, wait: 8000 }));
  await pg.waitForFunction(() => { const m = document.getElementById('stockcount-modal'); return m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 15000 }).catch(() => {});
  ok(await pg.evaluate(() => { const m = document.getElementById('stockcount-modal'); return !!m && getComputedStyle(m).display !== 'none'; }), 'بطاقة الجرد ⇐ pos.html?go=count بتفتح الجرد مباشرةً');
  await browser.close();
  ({ browser, pg, errs } = await H.open('pos.html?go=barcodes', { init: H.STAFF_INIT, w: 390, h: 844, wait: 8000 }));
  await pg.waitForFunction(() => { const m = document.getElementById('barcode-modal'); return m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 15000 }).catch(() => {});
  ok(await pg.evaluate(() => { const m = document.getElementById('barcode-modal'); return !!m && getComputedStyle(m).display !== 'none'; }), 'بطاقة الملصقات ⇐ pos.html?go=barcodes بتفتح طباعة الباركود');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
