// (TASK-B0511 · المالك seq 828) «لما احط بيانات عميل باي مكان وفي شي اختلف يسالني فورا. وعندي تلت خيارات او شي انزاد ينحفظ —
// كتير زبائن ما الهن عنوان او مكتب، لما عم ارجع حط ما عم ينحفظ». حارس gmt-custsync.js في الأوردرات (إنشاء وتعديل) ونقطة البيع.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const getCust = async ph => { const r = await fetch(H.M + '/rest/v1/gmt_customers?phone=eq.' + ph + '&select=*'); return (await r.json())[0] || null; };
(async () => {
  await H.seed();   // «زبون سابق» 0999111222 بلا عنوان
  const o = await H.open('orders.html', { w: 390, wait: 5000 });
  const pg = o.pg;
  // ١) عنوانٌ ناقص ⇒ يُحفظ بلا سؤال
  let r = await pg.evaluate(() => GMTCust.reconcile({ phone: '0999111222', name: 'زبون سابق', address: 'حمص · مكتب القدموس' }));
  ok(r.ok && !r.cancel && r.saved.includes('address'), 'العنوان الناقص حُفظ بلا سؤال: ' + JSON.stringify(r.saved));
  let c = await getCust('0999111222');
  ok(c && c.address === 'حمص · مكتب القدموس', 'العنوان في سجلّ الزبون: ' + (c && c.address));
  // ٢) اسمٌ مختلف ⇒ سؤال بثلاثة أجوبة · «الجديد — واحفظه بدل القديم»
  let p = pg.evaluate(() => GMTCust.reconcile({ phone: '0999111222', name: 'زبون سابق المعدّل', address: 'حمص · مكتب القدموس' }));
  await pg.waitForTimeout(700);
  const btns = await pg.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && /لهذه المرّة فقط|واحفظه بدل القديم|^القديم$/.test(b.textContent.trim())).map(b => b.textContent.trim()));
  ok(btns.length === 3, 'ظهر السؤال بثلاثة أجوبة: ' + btns.join(' | '));
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(b => /واحفظه بدل القديم/.test(b.textContent)).click());
  r = await p;
  c = await getCust('0999111222');
  ok(r.saved.includes('name') && c.name === 'زبون سابق المعدّل', '«واحفظه» غيّر الاسم المحفوظ: ' + c.name);
  // ٣) «القديم» ⇒ يُعيد المحفوظ للنموذج ولا يغيّر السجلّ
  p = pg.evaluate(() => GMTCust.reconcile({ phone: '0999111222', name: 'اسم ثالث' }));
  await pg.waitForTimeout(700);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(b => b.offsetParent && b.textContent.trim() === 'القديم').click());
  r = await p; c = await getCust('0999111222');
  ok(r.use.name === 'زبون سابق المعدّل' && c.name === 'زبون سابق المعدّل', '«القديم» أعاد المحفوظ ولم يغيّر السجلّ');
  // ٤) «لهذه المرّة فقط» ⇒ لا يتغيّر السجلّ
  p = pg.evaluate(() => GMTCust.reconcile({ phone: '0999111222', address: 'دمشق · مكتب الهرم' }));
  await pg.waitForTimeout(700);
  await pg.evaluate(() => [...document.querySelectorAll('button')].find(b => b.offsetParent && /لهذه المرّة فقط/.test(b.textContent)).click());
  r = await p; c = await getCust('0999111222');
  ok(r.once.address && c.address === 'حمص · مكتب القدموس', '«لهذه المرّة فقط» لم يغيّر العنوان المحفوظ');
  // ٥) حفظٌ خلفيّ (fill) لا يكتب فوق المحفوظ · وزبونٌ جديد يُنشأ
  await pg.evaluate(() => GMTCust.fill({ phone: '0999111222', name: 'كتابة صامتة', address: 'مكان آخر' }));
  c = await getCust('0999111222');
  ok(c.name === 'زبون سابق المعدّل' && c.address === 'حمص · مكتب القدموس', 'الحفظ الخلفيّ لا يكتب فوق المحفوظ');
  r = await pg.evaluate(() => GMTCust.reconcile({ phone: '٠٩٨٨٧٧٦٦٥٥', name: 'زبون جديد', address: 'حلب' }));
  c = await getCust('0988776655');
  ok(r.created && c && c.address === 'حلب', 'زبونٌ جديد (أرقام عربية) أُنشئ بعنوانه');
  // ٦) تعديل أوردر يضيف العنوان لسجلّ الزبون (كان لا يلمسه)
  await fetch(H.M + '/rest/v1/gmt_customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'بلا عنوان', phone: '0933000111' }) });
  r = await pg.evaluate(() => GMTCust.reconcile({ phone: '0933000111', name: 'بلا عنوان', address: 'اللاذقية · مكتب المفتي' }, { source: 'orders-edit' }));
  c = await getCust('0933000111');
  ok(c.address === 'اللاذقية · مكتب المفتي', 'تعديل لاحق يحفظ العنوان الناقص');
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../orders.html'), 'utf8');
  ok(/formEdit[\s\S]{0,2500}GMTCust\.reconcile/.test(src), 'نموذج تعديل الأوردر يمرّ من GMTCust');
  const real = o.errs.filter(e => !/status of (4\d\d|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' | '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
