// (seq B1032 «بكبس عليه وبشوف تفاصيله من وين اجى وكم كمياته … لازم اعرف لحتى اعرف شو الموضوع») لوحة «تدقيق الفواتير والجرد»:
//   كلّ قطعة (زيادة غير مبرَّرة · بلا فاتورة) تنفتح: الكمية بكلّ فرع · فواتيرها برقمها وكمّيتها وحالتها · «📜 السجلّ الكامل» يفتح حركة المنتج
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const P = await H.call('/rest/v1/products', [{ name: 'زيادة تجربة', barcode: 'AU01', haleb: 7, daraa: 2 }, { name: 'بلا فاتورة تجربة', barcode: 'AU02', haleb: 3 }]);
  await H.call('/rest/v1/import_log', { inv_number: 'CN-2026-0777', inv_type: 'china', status: 'arrived', transferred: true, arrived_at: new Date().toISOString(),
    items_snapshot: [{ id: P[0].id, name: 'زيادة تجربة', qty: 5, barcode: 'AU01' }], transfer_moved: { [P[0].id]: 5 } });
  const { browser, pg, errs } = await H.open('inventory.html?audit=1', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 8000 });
  await pg.waitForSelector('#intg-body details[data-intg-prod]', { timeout: 15000 }).catch(() => {});
  const r = await pg.evaluate(ids => {
    const d1 = document.querySelector('#intg-body details[data-intg-prod="' + ids[0] + '"]'), d2 = document.querySelector('#intg-body details[data-intg-prod="' + ids[1] + '"]');
    if (d1) d1.open = true; if (d2) d2.open = true;
    return { d1: d1 ? d1.innerText : '', d2: d2 ? d2.innerText : '' };
  }, [P[0].id, P[1].id]);
  ok(/زيادة تجربة/.test(r.d1) && /\+4/.test(r.d1) && /حلب: 7/.test(r.d1) && /درعا: 2/.test(r.d1), '① الزيادة: الكمية بكلّ فرع (حلب 7 · درعا 2) و+4: ' + r.d1.replace(/\s+/g, ' ').slice(0, 160));
  ok(/CN-2026-0777 × 5 · واصلة · مختومة/.test(r.d1), '① فواتيرها: الرقم × الكمية · الحالة · مختومة');
  ok(/بلا فاتورة تجربة/.test(r.d2) && /حلب: 3/.test(r.d2) && /لا فاتورة شراء لهذه القطعة/.test(r.d2), '② بلا فاتورة: الكمية + «لا فاتورة شراء»');
  await pg.evaluate(id => document.querySelector('#intg-body details[data-intg-prod="' + id + '"] [data-intg-mov]').click(), P[0].id);
  await pg.waitForTimeout(1500);
  const mv = await pg.evaluate(() => { const m = document.getElementById('movement-modal'); if (!m || getComputedStyle(m).display === 'none') return false; const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return !!top && m.contains(top); });
  ok(mv, '③ «📜 السجلّ الكامل» يفتح حركة المنتج **فوق** اللوحة (مرئيّة لا خلفها)');
  ok(!errs.filter(e => !/favicon|404|400/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
