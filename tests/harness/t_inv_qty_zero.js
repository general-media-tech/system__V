// (TASK-0351 · المالك seq 525) «الهيد TJ1002 … عدده صفر في هي الفاتورة لما أعدّله ما بينحفظ الرقم الجديد»
//  الجذر: قراءة الكمية `parseInt(نص)||القديمة` ⇒ الصفر «فارغ» فتعود الكمية القديمة. الآن: الصفر رقمٌ صالح · الخانة الفارغة تُبقي القديم.
//  ① «حفظ التعديلات» بكمية 0 ⇒ 0 في القاعدة · ② «حفظ سحابي» بكمية 0 ⇒ 0 · ③ خانة فارغة ⇒ تبقى الكمية · ④ الصفر يُعرض 0 لا خانة فارغة · ⑤ أرقام عربية «٣»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const qtys = async id => ((await H.call('/rest/v1/import_log?id=eq.' + id + '&select=items_snapshot', undefined, 'GET'))[0].items_snapshot || []).map(x => x.qty);
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'هيد TJ1002 تجربة', barcode: 'QZ1', price: 100, china: 0 }, { name: 'سوفت تجربة', barcode: 'QZ2', price: 70, china: 0 }, { name: 'عاكس تجربة', barcode: 'QZ3', price: 8, china: 0 }]);
  const snap = [{ id: A.id, name: A.name, qty: 8, unit_price: 18.1, orig_unit_price: 18.1, sale_price: 100, whole_price: 80, min_price: 67 },
    { id: B.id, name: B.name, qty: 10, unit_price: 14, orig_unit_price: 14, sale_price: 70, whole_price: 55, min_price: 50 },
    { id: C.id, name: C.name, qty: 30, unit_price: 1, orig_unit_price: 1, sale_price: 8, whole_price: 5, min_price: 4 }];
  await H.call('/rest/v1/import_log', [{ id: 871, inv_number: 'IMP-2026-0071', inv_type: 'china', status: 'arrived', transferred: true, items_snapshot: snap },
    { id: 872, inv_number: 'IMP-2026-0072', inv_type: 'china', status: 'arrived', transferred: true, items_snapshot: snap }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  const edit = async (id, vals, fn) => {
    await pg.evaluate(i => openInvFromList(i), String(id)); await sleep(500);
    await pg.evaluate(() => toggleInvEdit()); await sleep(250);
    await pg.evaluate(([v, f]) => { const rows = document.querySelectorAll('#inv-items-tbl tbody tr');
      v.forEach((t, k) => { if (t != null) rows[k].querySelectorAll('td')[3].querySelector('[contenteditable="true"]').textContent = t; }); window[f](); }, [vals, fn]);
    await sleep(4000);
  };
  await edit(871, ['0', '', '٣'], 'saveInvEdits');
  let q = await qtys(871);
  ok(q[0] === 0, '① «حفظ التعديلات»: كمية الهيد 0 حُفظت في القاعدة (كانت ترجع 8): ' + q.join(','));
  ok(q[1] === 10, '③ خانة كمية فارغة ⇒ تبقى الكمية 10: ' + q[1]);
  ok(q[2] === 3, '⑤ رقمٌ عربيّ «٣» يُقرأ 3: ' + q[2]);
  await edit(872, ['0', null, null], 'saveInvCloud');
  q = await qtys(872);
  ok(q[0] === 0 && q[1] === 10 && q[2] === 30, '② «حفظ سحابي»: الصفر حُفظ والباقي كما هو: ' + q.join(','));
  await pg.evaluate(() => openInvFromList('871')); await sleep(600);
  const shown = await pg.evaluate(() => document.querySelectorAll('#inv-items-tbl tbody tr')[0].querySelectorAll('td')[3].innerText.trim());
  ok(shown === '0', '④ إعادة الفتح تعرض 0 لا خانة فارغة: «' + shown + '»');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
