// (TASK-0356 · المالك seq 549) «الباركودات تنطبع حسب ترتيب الكراتين — كلّ كرتونة باركوداتها مجموعةٌ لحالها»
//  فاتورة شراء بنودها مرتّبة بالباكينج ليست (ctn) ⇒ «طباعة باركود» ⇒ مجموعات «📦 كرتونة N/M» بالترتيب · بند كمّيته 0 لا يُطبع
//  · وضعان: متتالية بفاصل / كلّ مجموعة بورقة جديدة · فاتورة بلا كراتين ⇒ الورقة كما كانت (بلا رؤوس)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'ستاند 8819', barcode: 'LC1', price: 10, china: 50 }, { name: 'حقيبة كتف', barcode: 'LC2', price: 5, china: 25 }, { name: 'رأس T602', barcode: 'LC3', price: 30, china: 0 }]);
  await H.call('/rest/v1/import_log', [{ id: 991, inv_number: 'IMP-2026-0091', inv_type: 'china', status: 'transit', items_snapshot: [
    { id: B.id, name: B.name, barcode: 'LC2', qty: 25, unit_price: 2, ctn: 1, ctn_of: 3, notes: '📦 كرتونة 1/3' },
    { id: A.id, name: A.name, barcode: 'LC1', qty: 20, unit_price: 2, ctn: 2, ctn_of: 3, notes: '📦 كرتونة 2/3 · 🔀 موزّع على 2 كراتين' },
    { id: A.id, name: A.name, barcode: 'LC1', qty: 30, unit_price: 2, ctn: 3, ctn_of: 3, notes: '📦 كرتونة 3/3 · 🔀 موزّع على 2 كراتين' },
    { id: C.id, name: C.name, barcode: 'LC3', qty: 0, unit_price: 7, notes: 'خارج الباكينج ليست (كمية 0)' }] },
    { id: 992, inv_number: 'IMP-2026-0092', inv_type: 'china', status: 'transit', items_snapshot: [{ id: B.id, name: B.name, barcode: 'LC2', qty: 3, unit_price: 2 }] }]);
  const { browser, ctx, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.evaluate(() => { window.__html = []; window.open = () => ({ document: { write: h => window.__html.push(h), close() {} } }); });
  await pg.evaluate(() => openInvFromList('991')); await sleep(600);
  await pg.evaluate(() => printBarcodes()); await sleep(300);
  const html = (await pg.evaluate(() => window.__html))[0] || '';
  const v = await ctx.newPage(); await v.setContent(html, { waitUntil: 'load' }); await v.waitForTimeout(800);
  const r1 = await v.evaluate(() => ({ heads: [...document.querySelectorAll('.gh')].map(x => x.textContent), labels: document.querySelectorAll('.lb').length, svg: document.querySelectorAll('.bc svg rect, .bc svg path').length > 0, cnt: document.getElementById('cnt').textContent, pages: document.querySelectorAll('.page').length, grpShown: !document.getElementById('grp').hidden,
    order: [...document.querySelectorAll('.gh, .lb')].map(x => x.classList.contains('gh') ? 'H' : x.querySelector('.nm').textContent).filter((x, i, a) => x === 'H' || a[i - 1] !== x) }));
  ok(r1.heads.length === 3 && /كرتونة 1\/3 — 25 ملصق/.test(r1.heads[0]) && /كرتونة 2\/3 — 20 ملصق/.test(r1.heads[1]) && /كرتونة 3\/3 — 30 ملصق/.test(r1.heads[2]), 'رؤوس الكراتين بالترتيب وعدد ملصقات كلّ كرتونة: ' + r1.heads.join(' | '));
  ok(r1.labels === 75 && !/T602/.test(r1.order.join()), '75 ملصقاً (25 + 20 + 30) · البند ذو الكمّية 0 لم يُطبع');
  ok(JSON.stringify(r1.order) === JSON.stringify(['H', 'حقيبة كتف', 'H', 'ستاند 8819', 'H', 'ستاند 8819']), 'كلّ كرتونة ملصقاتها تحت رأسها: ' + r1.order.join(' › '));
  ok(r1.grpShown && r1.pages === 2 && r1.svg && /3 مجموعة/.test(r1.cnt), 'وضع «متتالية بفاصل»: ورقتان A4 · الأشرطة مرسومة: ' + r1.cnt);
  await v.selectOption('#grp', 'page'); await v.waitForTimeout(400);
  const r2 = await v.evaluate(() => ({ pages: [...document.querySelectorAll('.page')].map(p => p.querySelector('.gh') ? p.querySelector('.gh').textContent.slice(0, 14) : '-') }));
  ok(r2.pages.length === 3 && r2.pages.every(x => /كرتونة/.test(x)), '«كلّ مجموعة بورقة جديدة»: 3 أوراق تبدأ كلٌّ منها برأس كرتونتها: ' + r2.pages.join(' | '));
  await v.close();
  await pg.evaluate(() => { window.__html = []; openInvFromList('992'); }); await sleep(600);
  await pg.evaluate(() => printBarcodes()); await sleep(300);
  const h2 = (await pg.evaluate(() => window.__html))[0] || '';
  const v2 = await ctx.newPage(); await v2.setContent(h2, { waitUntil: 'load' }); await v2.waitForTimeout(600);
  const r3 = await v2.evaluate(() => ({ heads: document.querySelectorAll('.gh').length, labels: document.querySelectorAll('.lb').length, grpHidden: document.getElementById('grp').hidden }));
  ok(r3.heads === 0 && r3.labels === 3 && r3.grpHidden, 'فاتورة بلا كراتين ⇒ الورقة كما كانت (3 ملصقات · بلا رؤوس)');
  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
