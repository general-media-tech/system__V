// (seq B1030) تعديل فاتورة الشراء: حذف بند لا يمسح ما كُتب (الأسعار · المورّد) ويبقى وضع التعديل ·
// تحذير «سعر شراء 0» يُحسب على ما كُتب الآن لا على النموذج القديم (لا رسالة كاذبة)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'منصة هبوط اختبار', barcode: 'EK0001', price: 40, cost_price: 0 },
    { name: 'حامل اختبار', barcode: 'EK0002', price: 30, cost_price: 0 },
    { name: 'قشاط اختبار', barcode: 'EK0003', price: 20, cost_price: 0 }]);
  const [IV] = await H.call('/rest/v1/import_log', [{ inv_number: 'IMP-2026-0097', inv_type: 'china', supplier: 'مورّد قديم', status: 'transit', total_amount: 0, items_count: 3, total_qty: 6,
    items_snapshot: [
      { id: A.id, name: A.name, qty: 2, unit_price: 0, orig_unit_price: 0, barcode: 'EK0001' },
      { id: B.id, name: B.name, qty: 2, unit_price: 0, orig_unit_price: 0, barcode: 'EK0002' },
      { id: C.id, name: C.name, qty: 2, unit_price: 0, orig_unit_price: 0, barcode: 'EK0003' }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.evaluate(id => { openInvFromList(id); }, IV.id); await pg.waitForTimeout(700);
  await pg.evaluate(() => toggleInvEdit()); await pg.waitForTimeout(300);
  const setCell = (r, c, v) => pg.evaluate(([r, c, v]) => { const td = document.querySelectorAll('#inv-items-tbl tbody tr')[r].querySelectorAll('td')[c]; const ed = td.querySelector('[contenteditable="true"]'); ed.textContent = v; ed.dispatchEvent(new Event('input', { bubbles: true })); }, [r, c, v]);
  await setCell(0, 4, '12.5'); await setCell(2, 4, '3.25');
  await pg.evaluate(() => { const s = [...document.querySelectorAll('#invPage [data-field="supplier"]')].find(e => !e.closest('#inv-items-tbl')); if (s) s.textContent = 'مورّد جديد'; });
  /* احذف البند الأوسط */
  await pg.evaluate(() => { window.GMTAsk.confirm = async () => true; deleteInvItem(1); }); await pg.waitForTimeout(800);
  const st = await pg.evaluate(() => { const rows = [...document.querySelectorAll('#inv-items-tbl tbody tr')]; const v = r => { const td = rows[r] && rows[r].querySelectorAll('td')[4]; const ed = td && td.querySelector('[contenteditable="true"]'); return ed ? ed.textContent.trim() : null; };
    const sup = [...document.querySelectorAll('#invPage [data-field="supplier"]')].find(e => !e.closest('#inv-items-tbl'));
    return { n: rows.length, p0: v(0), p1: v(1), edit: invEditMode, editable: !!document.querySelector('#inv-items-tbl [contenteditable="true"]'), sup: sup && sup.textContent.trim() }; });
  ok(st.n === 2, 'حُذف البند الأوسط (بقي ' + st.n + ')');
  ok(st.p0 && parseFloat(st.p0) === 12.5 && st.p1 && parseFloat(st.p1) === 3.25, 'الأسعار المكتوبة قبل الحذف باقية: ' + st.p0 + ' · ' + st.p1);
  ok(st.edit && st.editable, 'بقينا في وضع التعديل بعد الحذف');
  ok(st.sup === 'مورّد جديد', 'اسم المورّد المكتوب باقٍ: ' + st.sup);
  /* الحفظ: كلّ الأسعار مكتوبة ⇒ لا تحذير «سعر 0» */
  const asked = await pg.evaluate(async () => { let q = null; const o = window.purConfirmZero; window.purConfirmZero = async l => { q = l.filter(c => +c.qty > 0 && +c.unitPrice <= 0).length; return true; }; await saveInvEdits(); window.purConfirmZero = o; return q; });
  ok(asked === 0, 'الحفظ بعد كتابة الأسعار ⇒ لا بند «بسعر 0» في الفحص (كانت رسالة كاذبة) — عددها: ' + asked);
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const m = document.getElementById('conflictModal'); if (m && m.classList.contains('open')) applyAllFromInv(); }); await pg.waitForTimeout(1200);
  const d = await H.call('/__dump', undefined, 'GET'); const row = d.import_log.find(r => r.id === IV.id);
  const snap = row && (typeof row.items_snapshot === 'string' ? JSON.parse(row.items_snapshot) : row.items_snapshot) || [];
  ok(snap.length === 2 && +snap[0].unit_price === 12.5 && +snap[1].unit_price === 3.25 && row.supplier === 'مورّد جديد', 'المحفوظ في القاعدة: بندان بالأسعار المكتوبة والمورّد الجديد: ' + JSON.stringify(snap.map(x => x.unit_price)) + ' · ' + row.supplier);
  /* (seq B1030) التكامل: إضافة المنتج لفاتورة جديدة ⇒ آخر سعر شراء بالعملة نفسها يُعبّأ ويُقال من أين */
  const sug = await pg.evaluate(([a, iv]) => { ships = (ships || []).filter(x => x.id !== iv).concat([{ id: iv, inv_number: 'IMP-2026-0097', supplier: 'مورّد جديد', currency: 'USD', inv_date: '2099-01-01', items_snapshot: [{ id: a, name: 'منصة هبوط اختبار', qty: 2, unit_price: 14, orig_unit_price: 12.5 }] }]);
    const u = _lastBuy(a, 'USD'), e = _lastBuy(a, 'EUR'); cart.length = 0; addToCart(a); return { u, e, c: cart[0] && cart[0].unitPrice }; }, [A.id, IV.id]);
  ok(sug.u && sug.u.unit === 12.5 && sug.u.inv === 'IMP-2026-0097' && sug.c === 12.5, 'إضافة المنتج ⇒ آخر سعر شراء الأصليّ (12.5 قبل التكاليف) من IMP-2026-0097 يُعبّأ: ' + JSON.stringify(sug.u));
  ok(!sug.e, 'عملةٌ مختلفة (EUR) ⇒ لا يُعبّأ سعر بعملةٍ أخرى');
  /* (seq B1031) «💡 عبّئ الأسعار الناقصة»: بندٌ بسعر 0 وله سعرٌ معروف من فاتورة أخرى ⇒ يُعرض ثمّ يُكتب في الخانة */
  const fill = await pg.evaluate(async ([a, iv]) => {
    ships = ships.concat([{ id: 777777, inv_number: 'IMP-OLD-1', supplier: 'مورّد سابق', currency: 'USD', inv_date: '2026-01-01', status: 'arrived', items_snapshot: [{ id: a, unit_price: 9, orig_unit_price: 8.75 }] }]);
    openInvFromList(iv); await new Promise(r => setTimeout(r, 600)); if (!invEditMode) toggleInvEdit();
    const td = document.querySelectorAll('#inv-items-tbl tbody tr')[0].querySelectorAll('td')[4].querySelector('[contenteditable="true"]'); td.textContent = '0';
    _invToolbarSync(); const shown = document.getElementById('inv-fill-btn').style.display;
    let asked = ''; GMTAsk.confirm = async m => { asked = m; return true; };
    await purFillZeroPrices(); return { shown, asked, v: td.textContent };
  }, [A.id, IV.id]);
  ok(fill.shown === 'flex' && /IMP-OLD-1|8\.75/.test(fill.asked) && parseFloat(fill.v) === 8.75, '«💡 عبّئ الأسعار الناقصة» ظاهر ⇒ يسأل بالمصدر ⇒ يكتب 8.75 من IMP-OLD-1: ' + JSON.stringify({ s: fill.shown, v: fill.v }));
  /* صيد النمط: سعرٌ مكتوب ثمّ كتابة تكلفة شحن ⇒ السعر يبقى (كان recalcInv يعيد رسمه من النموذج) */
  const keep = await pg.evaluate(async () => {
    const td = document.querySelectorAll('#inv-items-tbl tbody tr')[0].querySelectorAll('td')[4].querySelector('[contenteditable="true"]'); td.textContent = '7.25';
    const cs = document.querySelector('#invPage [data-field="cs"]'); if (cs) { cs.textContent = '30'; cs.dispatchEvent(new Event('input', { bubbles: true })); } else recalcInv();
    await new Promise(r => setTimeout(r, 200));
    return document.querySelectorAll('#inv-items-tbl tbody tr')[0].querySelectorAll('td')[4].querySelector('[contenteditable="true"]').textContent;
  });
  ok(parseFloat(keep) === 7.25, 'سعرٌ مكتوب ثمّ تكلفة شحن ⇒ السعر المكتوب باقٍ: ' + keep);
  /* (seq B1046) أرقام الصين CN- وأوروبا EU- (كان IMP- للاثنين فتكرّر IMP-2026-0001) · البحث بالرقم القديم IMP- يجدها */
  const nm = await pg.evaluate(async () => ({ cn: await nextInvNum('CN'), hitOld: _invNumHit('CN-2026-0004', 'imp-2026-0004'), noCross: _invNumHit('EU-2026-0004', 'imp-2026-0001'), plain: _invNumHit('EU-2026-0001', 'eu-2026') }));
  ok(/^CN-\d{4}-\d{4}$/.test(nm.cn) && nm.hitOld && !nm.noCross && nm.plain, 'CN-/EU- بدل IMP- · البحث بـ IMP-2026-0004 يجد CN-2026-0004 ولا يخلط: ' + JSON.stringify(nm));
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
