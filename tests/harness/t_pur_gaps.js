// (TASK-A0549 · المالك seq 936 «فراغات فجوات في الجرد أو المشتريات … سجلها ملاحظة نتوسع فيها»)
//  ① شريط «🔎 فحص المشتريات» يعدّ الفواتير ذات البنود بسعر شراء 0 والأرقام المكرَّرة — ويختفي حين لا شيء
//  ② شارة حمراء على بطاقة كلّ فاتورةٍ منها (والفورية أيضاً) · بلا شارة للسليمة
//  ③ «فتح ←» يفتح الفاتورة نفسها (بالمعرّف لا بالرقم المكرَّر)
//  ④ الحفظ: بندٌ بسعر 0 ⇒ سؤال تأكيد · بلا بندٍ صفري ⇒ بلا سؤال
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [{ name: 'درون كومبو', barcode: 'PG0001', price: 500 }, { name: 'بطارية', barcode: 'PG0002', price: 30 }]);
  await H.call('/rest/v1/import_log', [
    { id: 961, inv_number: 'IMP-2026-0961', inv_type: 'germany', supplier: 'EU', status: 'transit', items_snapshot: [{ id: A.id, name: A.name, qty: 4, unit_price: 0 }, { id: B.id, name: B.name, qty: 10, unit_price: 31 }] },
    { id: 962, inv_number: 'IMP-2026-0962', inv_type: 'china', supplier: 'وايمن', status: 'arrived', transferred: true, items_snapshot: [{ id: B.id, name: B.name, qty: 5, unit_price: 9 }] },
    { id: 963, inv_number: 'IMP-2026-0962', inv_type: 'germany', supplier: 'أوروبا مكرّرة', status: 'transit', items_snapshot: [{ id: B.id, name: B.name, qty: 1, unit_price: 9 }] },
    { id: 964, inv_number: 'PO-2026-0964', inv_type: 'instant', supplier: 'صالة', status: 'arrived', dest_branch: 'haleb', items_snapshot: [{ id: B.id, name: B.name, qty: 2, unit_price: 0 }] },
    { id: 965, inv_number: 'IMP-2026-0965', inv_type: 'china', supplier: 'سليمة', status: 'transit', items_snapshot: [{ id: B.id, name: B.name, qty: 3, unit_price: 7 }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  // ①
  const bar = await pg.evaluate(() => { const el = document.getElementById('pur-gaps-bar'); return el ? { s: el.querySelector('summary').innerText, rows: el.querySelectorAll('[data-gap-open]').length, vis: el.style.display } : null; });
  ok(bar && /2 فاتورة فيها بنود بسعر شراء 0/.test(bar.s) && /2 فاتورة برقمٍ مكرَّر/.test(bar.s) && bar.rows === 4, '① الشريط: 2 بسعر 0 · 2 برقمٍ مكرَّر · 4 أسطر ' + JSON.stringify(bar));
  // ②
  const chips = await pg.evaluate(() => { const o = {}; document.querySelectorAll('.pur-gaps').forEach(d => { o[d.dataset.gapId] = (o[d.dataset.gapId] || '') + d.innerText; }); return o; });
  ok(/1 بند بسعر شراء 0/.test(chips['961'] || '') && /مكرَّر/.test(chips['962'] || '') && /مكرَّر/.test(chips['963'] || ''), '② شارات 961 (صفر) · 962/963 (مكرّر) ' + JSON.stringify(chips));
  await pg.evaluate(() => switchTab('instant')); await sleep(200);
  const chipI = await pg.evaluate(() => (document.querySelector('.pur-gaps[data-gap-id="964"]') || {}).innerText || '');
  ok(/1 بند بسعر شراء 0/.test(chipI), '② الفورية أيضاً: ' + chipI);
  ok(!chips['965'], '② الفاتورة السليمة بلا شارة');
  // ③
  await pg.evaluate(() => document.querySelector('#pur-gaps-bar [data-gap-open="963"]').click()); await sleep(600);
  const op = await pg.evaluate(() => window._invOpen && String(window._invOpen.id));
  ok(op === '963', '③ «فتح ←» فتح 963 بالمعرّف لا بالرقم المكرَّر (' + op + ')');
  // ④
  const c = await pg.evaluate(async () => {
    const asked = []; window.GMTAsk = Object.assign(window.GMTAsk || {}, { confirm: async m => { asked.push(m); return false; } });
    const a = await purConfirmZero([{ product: { name: 'سليم' }, qty: 2, unitPrice: 5 }]);
    const b = await purConfirmZero([{ product: { name: 'درون كومبو' }, qty: 4, unitPrice: 0 }, { product: { name: 'سليم' }, qty: 2, unitPrice: 5 }]);
    return { a, b, n: asked.length, m: asked[0] || '' };
  });
  ok(c.a === true && c.b === false && c.n === 1 && /درون كومبو ×4/.test(c.m), '④ تأكيدٌ عند بندٍ بسعر 0 فقط ' + JSON.stringify(c).slice(0, 160));
  // ① يختفي حين لا شيء
  await pg.evaluate(() => { ships = ships.filter(s => s.id === 965); render(); });
  const gone = await pg.evaluate(() => { const el = document.getElementById('pur-gaps-bar'); return !el || el.style.display === 'none'; });
  ok(gone, '① الشريط يختفي حين لا فجوات');
  // ⑤ ?open=<id> يفتح الفاتورة بمعرّفها (رابط أداة التسويات)
  const b2 = await H.open('purchase.html?open=963', { w: 1366, h: 900, mobile: false, wait: 6000 });
  const op2 = await b2.pg.evaluate(() => window._invOpen && String(window._invOpen.id));
  ok(op2 === '963', '⑤ purchase.html?open=963 فتح الفاتورة نفسها (' + op2 + ')');
  await b2.browser.close();
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
