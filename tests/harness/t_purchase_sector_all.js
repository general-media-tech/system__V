// (TASK-A0577 · المالك seq 975 «ما لازم يوجد +8 أو +5 — لازم ينكتبوا كلّ القطاعات، ومن الأهمّ إلى الأقلّ أهمية حسب السعر»)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  // ٦ مجموعات · الأكثر كمّيةً ليس الأغلى: «كفرات» 100 قطعة × 0.5 = 50$ · «درونات» 1 × 900 = 900$
  const G = [['كفرات', 100, 0.5], ['درونات', 1, 900], ['عدسات', 2, 300], ['حقائب', 20, 5], ['فلاتر', 10, 3], ['ستاندات', 4, 20]];
  const P = await H.call('/rest/v1/products', G.map((g, i) => ({ name: 'قطاع ' + g[0], barcode: 'SA' + i, price: 1, group_name: g[0], china: 0 })));
  const [IV] = await H.call('/rest/v1/import_log', [{ inv_number: 'IMP-2026-0098', inv_type: 'china', supplier: 'Test', status: 'transit', sector: 'كفرات · حقائب · فلاتر · ستاندات +2',
    items_count: 6, total_qty: 137, items_snapshot: G.map((g, i) => ({ id: P[i].id, name: P[i].name, qty: g[1], unit_price: g[2], barcode: 'SA' + i })) }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.evaluate(id => { openInvFromList(id); }, IV.id); await pg.waitForTimeout(600);
  const sec = await pg.evaluate(() => (document.querySelector('#invPage [data-field="sector"]') || {}).textContent || '');
  ok(!/\+\d/.test(sec) && G.every(g => sec.includes(g[0])), 'كلّ القطاعات الستّة مكتوبة بلا «+N»: ' + sec);
  ok(sec === 'درونات · عدسات · حقائب · ستاندات · كفرات · فلاتر', 'مرتّبة بالقيمة (900 · 600 · 100 · 80 · 50 · 30): ' + sec);
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
