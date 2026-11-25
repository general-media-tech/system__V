// seq B1115 — «نافذة الموردين ما فيها زرّ رجوع، والرجوع عم يصير تعسّفي وخطر» ⇒ زرّ رجوع الهاتف بيسكّر النافذة/بيرجع خطوة، مش الصفحة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  await H.call('/rest/v1/import_log', [{ id: 951, inv_number: 'CN-BK', inv_type: 'china', supplier: 'مورد الرجوع', inv_date: '2026-11-01', status: 'arrived', total_amount: 100, items_snapshot: [], created_at: '2026-11-01T00:00:00Z' }]);
  const { browser, pg, errs } = await H.open('home.html', { init: H.ADMIN_INIT, w: 390, h: 844, wait: 3000 });
  await pg.goto(pg.url().replace(/home\.html.*$/, 'purchase.html')); await sleep(6000);
  const url0 = pg.url();
  await pg.evaluate(() => openSuppliers()); await sleep(1200);
  ok(await pg.evaluate(() => /→ رجوع/.test(document.getElementById('gmt-suppliers').textContent)), 'قائمة الموردين فيها «→ رجوع»');
  await pg.evaluate(() => document.querySelector('[data-sp-key]').click()); await sleep(400);
  ok(await pg.evaluate(() => !!document.querySelector('[data-sp-st]')), 'فتحنا ملفّ المورّد');
  await pg.goBack(); await sleep(500);
  ok(pg.url() === url0 && await pg.evaluate(() => !!document.getElementById('gmt-suppliers') && !document.querySelector('[data-sp-st]') && !!document.querySelector('[data-sp-key]')), 'رجوع الهاتف بملفّ المورّد ⇐ القائمة (وما طلعنا من الصفحة)');
  await pg.goBack(); await sleep(500);
  ok(pg.url() === url0 && await pg.evaluate(() => !document.getElementById('gmt-suppliers')), 'رجوع تاني ⇐ النافذة انسكّرت وضلّينا بالمشتريات');
  /* فتح وتسكير بـ✕ ⇐ ما بيعلق التاريخ (الرجوع بعدها بيطلع طبيعي من الصفحة) */
  await pg.evaluate(() => openSuppliers()); await sleep(1000);
  await pg.evaluate(() => document.querySelector('[data-sp-x]').click()); await sleep(400);
  ok(await pg.evaluate(() => !document.getElementById('gmt-suppliers') && GMTBack._stack.length === 0), 'التسكير بـ«→ رجوع» ⇐ بلا خطوات معلّقة بالتاريخ');
  await pg.evaluate(() => openPoReports()); await sleep(800);
  await pg.goBack(); await sleep(500);
  ok(pg.url() === url0 && await pg.evaluate(() => !document.querySelector('[data-poreports]')), 'نفس الشي لنوافذ تانية (📈 التقارير)');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
