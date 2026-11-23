// (TASK-A0583 · المالك seq A1012) «زرّ تعديل الفاتورة من الخارج منفصل عن الواقع — من بقايا تحديث قديم» · «الأزرار فوق الفاتورة بدها ترتيب»
//  ① زرّ ✏️ على البطاقة ⇒ الفاتورة نفسها في وضع التعديل (لا نموذج التسجيل القديم)
//  ② المورّد وتاريخ الوصول المعدَّلان في الفاتورة يُحفظان في القاعدة (كانا يُحفظان من النموذج القديم فقط)
//  ③ الشريط: أدوات التعديل تظهر في التعديل فقط · «حفظ الفاتورة» للمسودّة فقط · التصدير في «مستندات ▾» · JSON في «نسخ احتياطي»
//  ④ «🚚 الشحن والمرفقات» يفتح ما لا يُعدَّل في الفاتورة (شركة الشحن · التتبّع · الملفّات)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [A] = await H.call('/rest/v1/products', [{ name: 'بطارية اختبار تعديل', barcode: 'ED0001', price: 20, cost_price: 8, china: 0 }]);
  const [T] = await H.call('/rest/v1/import_log', [{ inv_number: 'IMP-2026-0961', inv_type: 'china', supplier: 'Shenzhen Old', status: 'transit', total_amount: 80, items_count: 1, total_qty: 10, currency: 'USD', dest_branch: 'daraa', eta_date: '2026-12-01',
    items_snapshot: [{ id: A.id, name: A.name, qty: 10, unit_price: 8, orig_unit_price: 8, barcode: 'ED0001' }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  pg.on('dialog', d => d.accept('تعديل المورّد'));
  // ① من البطاقة
  const editBtn = await pg.$(`button[onclick="openInvForEdit('${T.id}')"]`);
  ok(!!editBtn && !(await pg.$(`button[onclick="openEdit('${T.id}')"]`)), '① زرّ التعديل على البطاقة يفتح المحرّر الحديث (لا openEdit القديم)');
  await pg.evaluate(id => document.querySelector(`button[onclick="openInvForEdit('${id}')"]`).click(), T.id); await pg.waitForTimeout(800);
  const s1 = await pg.evaluate(() => ({ open: document.getElementById('invModal').classList.contains('inv-open'), edit: invEditMode, oldForm: !document.getElementById('addModal').classList.contains('hidden'),
    tools: getComputedStyle(document.getElementById('inv-edit-tools')).display, cloud: getComputedStyle(document.getElementById('inv-cloud-btn')).display, save: getComputedStyle(document.getElementById('inv-save-btn')).display, ship: getComputedStyle(document.getElementById('inv-ship-btn')).display }));
  ok(s1.open && s1.edit && !s1.oldForm, '① الفاتورة مفتوحة في وضع التعديل مباشرة: ' + JSON.stringify({ open: s1.open, edit: s1.edit, oldForm: s1.oldForm }));
  ok(s1.tools === 'flex' && s1.save === 'flex' && s1.cloud === 'none' && s1.ship === 'flex', '③ في التعديل: أدوات التعديل + «حفظ التعديلات» + «الشحن والمرفقات» · لا «حفظ الفاتورة» (محفوظة أصلاً): ' + JSON.stringify(s1));
  // ② المورّد والتاريخ
  await pg.evaluate(() => { const s = document.querySelector('#invPage [data-field="supplier"]'); s.textContent = 'Shenzhen New Co'; const e = document.querySelector('#invPage [data-field="eta"]'); if (e) e.textContent = '15/12/2026'; });
  await pg.evaluate(() => saveInvEdits()); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const m = document.getElementById('conflictModal'); if (m && m.classList.contains('open')) applyAllFromInv(); }); await pg.waitForTimeout(800);
  const D = await H.call('/__dump', undefined, 'GET'); const r = D.import_log.find(x => x.id === T.id);
  ok(r.supplier === 'Shenzhen New Co', '② اسم المورّد المعدَّل في الفاتورة حُفظ في القاعدة: ' + r.supplier);
  ok(r.eta_date === '2026-12-15' || !(await pg.$('#invPage [data-field="eta"]')), '② موعد الوصول المعدَّل حُفظ: ' + r.eta_date);
  ok(r.total_amount === 80 && (r.items_snapshot || []).length === 1, '② البنود والمجموع كما هي');
  // ③ بعد الحفظ: عرض فقط تلقائياً
  const s3 = await pg.evaluate(() => ({ tools: getComputedStyle(document.getElementById('inv-edit-tools')).display, save: getComputedStyle(document.getElementById('inv-save-btn')).display,
    docs: !!document.querySelector('#inv-toolbar [data-inv-grp="docs"] [onclick="exportInvExcel()"]') && !!document.querySelector('#inv-toolbar [data-inv-grp="docs"] [onclick="exportInvHTML()"]') && !!document.querySelector('#inv-toolbar [data-inv-grp="docs"] [onclick="printPriceList()"]'),
    backup: !!document.querySelector('#inv-toolbar [data-inv-grp="backup"] [onclick="exportInvJSON()"]') && !!document.querySelector('#inv-toolbar [data-inv-grp="backup"] [onclick="exportAllInvoicesJSON()"]'),
    topBtns: [...document.querySelectorAll('#inv-toolbar > button, #inv-toolbar > div > button')].filter(b => b.offsetParent).map(b => b.textContent.trim().replace(/\s+/g, ' ')).join(' | ') }));
  ok(s3.tools === 'none' && s3.save === 'none', '③ خارج التعديل: لا أدوات تعديل ولا حفظ');
  ok(s3.docs && s3.backup, '③ Excel/HTML/نشرة الأسعار في «مستندات ▾» · JSON في «نسخ احتياطي»');
  ok(!/JSON|تصدير الكل/.test(s3.topBtns), '③ الأزرار الظاهرة مرتّبة: ' + s3.topBtns);
  // ④ الشحن والمرفقات
  await pg.evaluate(() => toggleInvEdit()); await pg.waitForTimeout(200);
  await pg.evaluate(() => document.getElementById('inv-ship-btn').click()); await pg.waitForTimeout(700);
  const s4 = await pg.evaluate(() => ({ inv: document.getElementById('invModal').classList.contains('inv-open'), form: !document.getElementById('addModal').classList.contains('hidden') }));
  ok(!s4.inv && s4.form, '④ «الشحن والمرفقات» يفتح نموذج الشحن والملفّات: ' + JSON.stringify(s4));
  const real = errs.filter(x => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
