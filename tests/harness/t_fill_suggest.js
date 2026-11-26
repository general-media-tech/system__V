// (TASK-0380 · المالك C1124 «في شغلات سعرها موجود بغير فاتورة — ليش ما اقترحت تعبئتهم تلقائياً؟ … وبكلّ الفواتير»)
//  ① فتح فاتورة فيها بند بسعر 0 وسعره معروف من فاتورة ثانية ⇐ اقتراحٌ تلقائي (بلا ضغط «تفعيل التعديل») ويُعبَّأ السعر
//  ② «فحص المشتريات» يقول كم بند سعره معروف + زرّ «فتح وتعبئة»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/import_log', [
    { id: 981, inv_number: 'EU-OLD-1', inv_type: 'germany', supplier: 'م', inv_date: '2026-10-01', status: 'arrived', currency: 'USD', total_amount: 20, items_snapshot: [{ id: 'p-tri', name: 'منصة هبوط', qty: 2, unit_price: 10 }] },
    { id: 982, inv_number: 'EU-NEW-1', inv_type: 'germany', supplier: 'م', inv_date: '2026-11-01', status: 'transit', currency: 'USD', total_amount: 0, items_snapshot: [{ id: 'p-tri', name: 'منصة هبوط', qty: 3, unit_price: 0 }, { id: 'p-x', name: 'شي ما إله سعر', qty: 1, unit_price: 0 }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 7000 });
  const bar = await pg.evaluate(() => (document.getElementById('pur-gaps-bar') || {}).textContent || '');
  ok(/1 سعرها معروف/.test(bar) && /فتح وتعبئة/.test(bar), '② فحص المشتريات: «💡 1 سعرها معروف» + «فتح وتعبئة»');
  await pg.evaluate(() => { window.GMTAsk = Object.assign(window.GMTAsk || {}, { confirm: (m) => { window.__asked = (window.__asked || 0) + 1; window.__msg = m; return Promise.resolve(true); } }); });
  await pg.evaluate(() => openInvFromList('982')); await pg.waitForTimeout(2500);
  const st = await pg.evaluate(() => ({ n: window.__asked || 0, msg: window.__msg || '', edit: invEditMode, cell: (() => { const r = document.querySelectorAll('#inv-items-tbl tbody tr')[0]; const td = r && r.querySelectorAll('td')[4]; return td ? td.innerText.trim() : ''; })() }));
  ok(st.n === 1 && /منصة هبوط ⇐ 10/.test(st.msg) && /EU-OLD-1/.test(st.msg), '① اقتراح تلقائي مرّة واحدة عند الفتح: ' + st.msg.slice(0, 70));
  ok(st.edit && /^10\.00/.test(st.cell), '① عُبّئ السعر 10 (والتعديل انفتح للمراجعة ثمّ الحفظ): ' + JSON.stringify(st.cell));
  ok(!errs.filter(e => !/favicon|404|400|406|503/.test(e)).length, 'لا أخطاء JS');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
