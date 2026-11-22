// (TASK-A0548 · المالك seq 936 «حط شروط صارمة لموضوع فواتير الشراء: تعديلاتها والسجل تبعها» · «خود سجل تعديل هالفاتورة»)
//  ① تعديل كمية بند بلا سبب ⇒ القاعدة ترفض ⇒ الصفحة تسأل عن السبب مرّة وتعيد الطلب ⇒ يُحفظ ويُسجَّل (من · الصفحة · السبب)
//  ② تعديلٌ غير حسّاس (موعد الوصول) ⇒ بلا سؤال · يُسجَّل
//  ③ إلغاء سؤال السبب ⇒ لا يتغيّر شيء
//  ④ حذف فاتورة مُرحَّلة ⇒ مرفوض بلا سؤال · رقم فاتورة مكرَّر ⇒ مرفوض
//  ⑤ زرّ «🕘 سجل التعديلات» يعرض: من · السبب · الكمية من ⇐ إلى (بالأحمر) · والسجلّ القديم بلا «من»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'بطارية اختبار', barcode: 'PR0001', price: 30, germany: 0 },
    { name: 'درون اختبار', barcode: 'PR0002', price: 300, germany: 0 }]);
  const snap = [{ id: A.id, name: A.name, qty: 10, unit_price: 31 }, { id: B.id, name: B.name, qty: 2, unit_price: 135 }];
  await H.call('/rest/v1/import_log', [
    { id: 951, inv_number: 'IMP-2026-0951', inv_type: 'germany', supplier: 'EU', status: 'transit', transferred: false, total_amount: 580, items_snapshot: snap },
    { id: 952, inv_number: 'IMP-2026-0952', inv_type: 'china', supplier: 'CN', status: 'arrived', transferred: true, total_amount: 50, items_snapshot: [{ id: A.id, name: A.name, qty: 5, unit_price: 10 }] }]);
  // سجلٌّ قديم (قبل القاعدة): نسخةٌ بلا «من/لماذا»
  await H.call('/rest/v1/import_log_history', [{ hid: 1, row_id: 951, op: 'BASELINE', old_row: { id: 951, inv_number: 'IMP-2026-0951', total_amount: 580, items_snapshot: snap }, changed_at: '2026-11-07T20:43:43Z' }]);
  await H.call('/__opts', { pur_guard: true });
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  const dump = async () => H.call('/__dump', undefined, 'GET');
  await pg.evaluate(() => { window.__asked = []; window.__answer = 'تصحيح الكمية حسب صورة الفاتورة'; window.GMTAsk = Object.assign(window.GMTAsk || {}, { prompt: async m => { window.__asked.push(m); return window.__answer; } }); });

  // ①
  const r1 = await pg.evaluate(async () => {
    const it = JSON.parse(JSON.stringify(ships.find(x => String(x.id) === '951').items_snapshot)); it[0].qty = 8;
    try { await sb('PATCH', '/rest/v1/import_log?id=eq.951', { items_snapshot: it, total_amount: 518 }, { Prefer: 'return=minimal' }); return { ok: true, asked: window.__asked.slice() }; }
    catch (e) { return { ok: false, err: e.message, asked: window.__asked.slice() }; }
  });
  let d = await dump();
  const inv = d.import_log.find(x => x.id === 951);
  const h1 = (d.import_log_history || []).filter(x => x.row_id === 951 && x.op === 'UPDATE');
  ok(r1.ok && r1.asked.length === 1 && /سبب/.test(r1.asked[0]), '① سُئل عن السبب مرّةً واحدة ثمّ حُفظ ' + JSON.stringify(r1).slice(0, 160));
  ok(inv.items_snapshot[0].qty === 8 && +inv.total_amount === 518, '① الكمية صارت 8 والمجموع 518');
  ok(h1.length === 1 && h1[0].reason === 'تصحيح الكمية حسب صورة الفاتورة' && /^الأدمن/.test(h1[0].actor), '① السجلّ: من=' + (h1[0] && h1[0].actor) + ' · السبب محفوظ');
  ok(h1[0] && h1[0].page === 'purchase.html' && h1[0].old_row.items_snapshot[0].qty === 10, '① السجلّ يحفظ الصفحة والنسخة قبل التعديل (10)');

  // ②
  const r2 = await pg.evaluate(async () => { window.__asked = []; await sb('PATCH', '/rest/v1/import_log?id=eq.951', { eta_date: '2026-12-20' }, { Prefer: 'return=minimal' }); return window.__asked.length; });
  d = await dump();
  ok(r2 === 0 && d.import_log.find(x => x.id === 951).eta_date === '2026-12-20', '② تعديل موعد الوصول بلا سؤال');
  ok(d.import_log_history.filter(x => x.row_id === 951 && x.op === 'UPDATE').length === 2, '② وسُجِّل أيضاً');

  // ③ (بعد دقيقتين يُنسى السبب السابق — نصفّره يدوياً)
  const r3 = await pg.evaluate(async () => {
    window.__gmtPurReason = null; window.__asked = []; window.__answer = null;
    const it = JSON.parse(JSON.stringify(ships.find(x => String(x.id) === '951').items_snapshot)); it[1].unit_price = 1;
    try { await sb('PATCH', '/rest/v1/import_log?id=eq.951', { items_snapshot: it }, { Prefer: 'return=minimal' }); return { ok: true }; }
    catch (e) { return { ok: false, err: e.message, asked: window.__asked.length }; }
  });
  d = await dump();
  ok(!r3.ok && r3.asked === 1 && !/GMT_/.test(r3.err) && +d.import_log.find(x => x.id === 951).items_snapshot[1].unit_price === 135, '③ إلغاء السبب ⇒ رُفض ولم يتغيّر السعر ' + JSON.stringify(r3).slice(0, 140));

  // ④
  const r4 = await pg.evaluate(async () => {
    window.__asked = []; window.__answer = 'حذف';
    let del = '', dup = '';
    try { await sb('DELETE', '/rest/v1/import_log?id=eq.952', null, { Prefer: 'return=minimal' }); } catch (e) { del = e.message; }
    try { await sb('POST', '/rest/v1/import_log', { inv_number: 'IMP-2026-0951', inv_type: 'germany', status: 'transit', items_snapshot: [] }); } catch (e) { dup = e.message; }
    return { del, dup, asked: window.__asked.length };
  });
  d = await dump();
  ok(/مُرحَّلة/.test(r4.del) && d.import_log.some(x => x.id === 952) && r4.asked === 0, '④ حذف فاتورة مُرحَّلة مرفوض بلا سؤال');
  ok(/مستخدَم/.test(r4.dup) && d.import_log.filter(x => x.inv_number === 'IMP-2026-0951').length === 1, '④ رقم مكرَّر مرفوض');

  // ⑤
  await pg.evaluate(() => { if (typeof render === 'function') render(); });
  await sleep(300);
  const hasBtn = await pg.evaluate(() => !!document.querySelector('[data-pur-hist="951"]'));
  ok(hasBtn, '⑤ زرّ «سجل التعديلات» على بطاقة الفاتورة');
  await pg.evaluate(() => showPurHistory('951')); await sleep(800);
  const m = await pg.evaluate(() => { const el = document.getElementById('purHistModal'); return el ? { t: el.innerText, red: [...el.querySelectorAll('li')].filter(li => /185, 28, 28|b91c1c/.test(li.getAttribute('style') || '')).map(li => li.innerText) } : null; });
  ok(m && /تصحيح الكمية حسب صورة الفاتورة/.test(m.t), '⑤ النافذة تعرض السبب');
  ok(m && m.red.some(x => /بطارية اختبار/.test(x) && /10 ⇐ 8/.test(x)) && m.red.some(x => /المجموع/.test(x)), '⑤ الكمية 10 ⇐ 8 والمجموع بالأحمر ' + JSON.stringify(m && m.red));
  ok(m && /موعد الوصول/.test(m.t) && /بداية السجل/.test(m.t), '⑤ التعديل غير الحسّاس + بداية السجل القديمة ظاهران');
  await pg.click('#purHistModal [data-ph-close]'); await sleep(200);
  ok(!(await pg.$('#purHistModal')), '⑤ النافذة تُغلق');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
