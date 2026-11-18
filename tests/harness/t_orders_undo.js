// (TASK-B0516 · مرحلة ٤ · المالك seq 830 «Undo / Redo … لا تنفذ تراجعاً وهمياً») تراجع وإعادة حقيقيّان لتعديلات الأوردرات:
// القيمة تُعاد فعلاً في القاعدة · الإعادة تكتبها من جديد · الحالة/المبلغ يحتاجان تأكيداً · الكتابات المتتالية خطوة واحدة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dbOrder = async id => { const r = await fetch(H.M + '/rest/v1/gmt_orders?id=eq.' + id + '&select=*'); return (await r.json())[0]; };
(async () => {
  await H.seed();
  const [o0] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون التراجع', phone: '0933111999', address: 'حلب', product: 'عدسة', qty: 1, price: 50, status: 'pending', serial_code: 'U-1' }]);
  const id = o0.id;
  const o = await H.open('orders.html', { w: 390, wait: 5000, init: H.ADMIN_INIT + ";try{localStorage.removeItem('gmt_ord_undo_v1');localStorage.removeItem('gmt_ord_redo_v1')}catch(e){}" });
  const pg = o.pg;
  await pg.evaluate(async id => { const x = orders.find(z => String(z.id) === String(id)); await sbUpdate(id, { address: 'دمشق المزة' }); Object.assign(x, { address: 'دمشق المزة' }); await sbUpdate(id, { notes: 'ملاحظة' }); Object.assign(x, { notes: 'ملاحظة' }); }, id);
  ok((await dbOrder(id)).address === 'دمشق المزة', 'التعديل حُفظ');
  let r = await pg.evaluate(() => GMTUndo.undo());
  let d = await dbOrder(id);
  ok(d.address === 'حلب' && !d.notes, 'تراجعٌ حقيقيّ: العنوان والملاحظة رجعا في القاعدة (خطوة واحدة) — ' + r.msg);
  r = await pg.evaluate(() => GMTUndo.redo()); d = await dbOrder(id);
  ok(d.address === 'دمشق المزة' && d.notes === 'ملاحظة', 'الإعادة كتبت الجديد من جديد');
  // الحالة ⇒ تأكيد
  await pg.evaluate(async id => { const x = orders.find(z => String(z.id) === String(id)); await sbUpdate(id, { status: 'shipped' }); Object.assign(x, { status: 'shipped' }); }, id);
  await sleep(2200);
  const p = pg.evaluate(() => GMTUndo.undo()); await sleep(600);
  const ask = await pg.evaluate(() => (document.querySelector('.gmtask-ov') || {}).innerText || '');
  ok(/الحالة/.test(ask) && /التبليغ الذي وصل الزبون لا يُستعاد/.test(ask), 'تراجع الحالة يطلب تأكيداً ويقول إنّ التبليغ لا يُستعاد');
  await pg.evaluate(() => [...document.querySelectorAll('.gmtask-ov button')].find(b => b.textContent.trim() === 'تراجع').click());
  await p; d = await dbOrder(id);
  ok(d.status === 'pending', 'بعد التأكيد رجعت الحالة');
  r = await pg.evaluate(() => GMTUndo.undo()); d = await dbOrder(id);
  ok(/تراجعتَ/.test(r.msg) && d.address === 'حلب' && d.status === 'pending', 'الخطوة السابقة (العنوان) منفصلة عن الحالة وتُتراجع وحدها: ' + r.msg);
  r = await pg.evaluate(() => GMTUndo.undo());
  ok(/لا تعديل/.test(r.msg), 'لا خطوة باقية ⇒ «لا تعديل للتراجع عنه» — لا تراجع وهميّ');
  const real = o.errs.filter(e => !/status of (4\d\d|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' | '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
