// (المالك seq 383/386) فواتير الشراء الفورية القديمة: البند غير المربوط بمنتج يظهر «بخطّ أحمر» للمراجعة والربط اليدوي
// ① قائمة المشتريات الفورية: الفاتورة تظهر مع «🔴 n غير مربوط» · ② عرض الفاتورة: صفّ البند أحمر مع «🔴 غير مربوط بمنتج — للمراجعة» والمربوط عادي
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { prods } = await H.seed();
  const A = prods[0];
  await H.call('/rest/v1/import_log', [{ id: 901, inv_number: 'PO-2026-0004', inv_type: 'instant', source_branch: 'haleb', dest_branch: 'haleb', supplier: 'شركة الرائد', supplier_inv: '1376', inv_date: '2025-10-27', status: 'arrived', total_amount: 26, items_count: 2, total_qty: 2, created_at: '2026-11-03T08:00:00Z',
    items_snapshot: [{ id: A.id, name: A.name, barcode: A.barcode, qty: 1, unit_price: 6, orig_unit_price: 6, total: 6 },
      { id: null, unlinked: true, name: 'كميرة سيارة 4k', barcode: '', qty: 1, unit_price: 20, orig_unit_price: 20, total: 20, notes: '🔴 غير مربوط' }] }]);
  /* (seq 388) فاتورة أحدث بتاريخها أُدخلت قبل القديمة ⇒ الترتيب بتاريخ الفاتورة · والرقم التالي بعد أكبر رقم لا بعد آخر إدخال */
  await H.call('/rest/v1/import_log', [{ id: 902, inv_number: 'PO-2026-0009', inv_type: 'instant', source_branch: 'haleb', dest_branch: 'haleb', supplier: 'سمارت ستور', inv_date: '2026-10-29', status: 'arrived', total_amount: 10, items_count: 1, total_qty: 1, created_at: '2026-10-29T12:00:00Z',
    items_snapshot: [{ id: A.id, name: A.name, qty: 1, unit_price: 10, total: 10 }] }]);
  for (const W of [390, 1366]) {
    const { browser, pg, errs } = await H.open('purchase.html', { w: W, h: 900, mobile: W < 700, wait: 6000 });
    await pg.evaluate(() => { try { switchTab('instant'); } catch (_) {} });
    await sleep(800);
    const card = await pg.evaluate(() => (document.getElementById('list-instant') || {}).innerText || '');
    ok(/PO-2026-0004/.test(card) && /1 بند غير مربوط بمنتج/.test(card), W + ': تبويب «فورية»: البطاقة مع «🔴 1 بند غير مربوط»: ' + card.replace(/\s+/g, ' ').slice(0, 140));
    ok(card.indexOf('PO-2026-0009') !== -1 && card.indexOf('PO-2026-0009') < card.indexOf('PO-2026-0004'), W + ': الأحدث بتاريخ الفاتورة أوّلاً (0009 · 29 ت1 2026 قبل 0004 · 27 ت1 2025)');
    const nx = await pg.evaluate(() => nextInvNum('PO'));
    ok(nx === 'PO-' + new Date().getFullYear() + '-0010', W + ': الرقم التالي بعد أكبر رقم: ' + nx);
    await pg.evaluate(() => { try { switchTab('log'); } catch (_) {} }); await sleep(800);
    const list = await pg.evaluate(() => (document.getElementById('log-ins-tbody') || {}).innerText || '');
    ok(/PO-2026-0004/.test(list) && /1 غير مربوط/.test(list), W + ': «السجل»: الفاتورة مع «🔴 1 غير مربوط»: ' + list.replace(/\s+/g, ' ').slice(0, 120));
    await pg.evaluate(() => openInvFromList('901'));
    await sleep(1200);
    const rows = await pg.evaluate(() => [...document.querySelectorAll('#invPage tr')].filter(r => /كميرة سيارة 4k|كاميرا تجربة 0/.test(r.innerText)).map(r => ({ t: r.innerText.replace(/\s+/g, ' ').slice(0, 80), red: r.getAttribute('data-unlinked') === '1', bg: getComputedStyle(r).backgroundColor })));
    const red = rows.find(r => /كميرة سيارة 4k/.test(r.t)), norm = rows.find(r => /كاميرا تجربة 0/.test(r.t));
    ok(red && red.red && /غير مربوط بمنتج/.test(red.t) && /254, 226, 226/.test(red.bg), W + ': البند غير المربوط صفّ أحمر مع «🔴 غير مربوط بمنتج — للمراجعة»: ' + JSON.stringify(red));
    ok(norm && !norm.red, W + ': البند المربوط صفّ عادي');
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
