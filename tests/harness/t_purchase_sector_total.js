// (المالك seq 812) «لما تغيّر أي شيء بالفاتورة السعر ما عم يتغيّر برّه · القطاع لازم يتصنّف حسب مجموعات المنتجات تلقائياً»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'حقيبة كتف اختبار', barcode: 'SC0001', price: 20, cost_price: 5, group_name: 'حقائب', china: 0 },
    { name: 'سوفت بوكس اختبار', barcode: 'SC0002', price: 40, cost_price: 10, group_name: 'إضاءة', china: 0 }]);
  const [IV] = await H.call('/rest/v1/import_log', [{ inv_number: 'IMP-2026-0099', inv_type: 'china', supplier: 'Shenzhen Test', status: 'transit', sector: 'قديم يدوي', total_amount: 150,
    items_count: 2, total_qty: 20, items_snapshot: [{ id: A.id, name: A.name, qty: 10, unit_price: 5, barcode: 'SC0001' }, { id: B.id, name: B.name, qty: 10, unit_price: 10, barcode: 'SC0002' }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  const card0 = await pg.evaluate(() => document.body.innerText.match(/\$ ([\d.]+)/g));
  await pg.evaluate(id => { openInvFromList(id); }, IV.id); await pg.waitForTimeout(500);
  const sec0 = await pg.evaluate(() => (document.querySelector('#invPage [data-field="sector"]') || {}).textContent || '');
  ok(/حقائب/.test(sec0) && /إضاءة/.test(sec0) && !/قديم يدوي/.test(sec0), 'القطاع في الفاتورة يُحسب تلقائياً من مجموعات المنتجات: ' + sec0);
  await pg.evaluate(() => toggleInvEdit()); await pg.waitForTimeout(300);
  const idx = await pg.evaluate(() => { const th = [...document.querySelectorAll('#inv-items-tbl thead th')].map(x => x.textContent.trim()); return th.findIndex(t => /الكمية|العدد/.test(t)); });
  await pg.evaluate(i => { const c = document.querySelectorAll('#inv-items-tbl tbody tr')[0].querySelectorAll('td')[i]; (c.querySelector('[contenteditable]') || c).textContent = '30'; saveInvEdits(); }, idx);
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { const m = document.getElementById('conflictModal'); if (m && m.classList.contains('open')) applyAllFromInv(); });
  await pg.waitForTimeout(1500);
  const d = await H.call('/__dump', undefined, 'GET'); const row = d.import_log.find(r => r.id === IV.id);
  ok(row && +row.total_amount === 250, 'الإجمالي المحفوظ = 30×5 + 10×10 = 250: ' + (row && row.total_amount));
  ok(row && /حقائب/.test(row.sector || '') && /إضاءة/.test(row.sector || ''), 'القطاع المحفوظ من مجموعات المنتجات (لا اليدوي القديم): ' + (row && row.sector));
  await pg.evaluate(() => { try { closeInvModal && closeInvModal(); } catch (_) {} });
  const card1 = await pg.evaluate(() => document.body.innerText.includes('$ 250.00'));
  ok(card1, 'بطاقة الفاتورة في القائمة صارت $ 250.00 فوراً (كانت ' + (card0 || []).join(',') + ')');
  const ro = await pg.evaluate(() => ({ ro: document.getElementById('in-sector').readOnly, ro2: document.getElementById('ins-sector').readOnly }));
  ok(ro.ro && ro.ro2, 'حقل القطاع في نموذجي الإدخال تلقائي (للقراءة فقط)');
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
