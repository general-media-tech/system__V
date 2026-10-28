// (TASK-0244 · المالك seq 164) «زامن جهات الاتصال من كل مكان … الاوردرات القديمه او في الفواتير القديمه … كل شيء ناقص رجع ضيفه»
// + (TASK-0215 · seq 144) «اذا ادخلنا شيء جديد ينحفظ في القاعده» (بوّابة الكفالة)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const custs = () => H.call('/__dump', undefined, 'GET').then(d => d.gmt_customers || []);
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_customers', [{ name: 'موجود قديم', phone: '0933950001', branch_key: 'haleb', address: 'حلب' }]);
  await H.call('/rest/v1/gmt_orders', [
    { name: 'موجود باسم آخر', phone: '+963 933 950 001', address: 'دمشق', status: 'completed', price: 10, created_at: '2026-10-01T10:00:00Z' },
    { name: 'زبون أوردر قديم', phone: '0933950002', address: 'حمص - القديم', status: 'completed', price: 10, created_at: '2026-09-01T10:00:00Z', branch: 'حلب' },
    { name: 'زبون أوردر جديد', phone: '0933950002', address: 'حمص - الجديد', status: 'completed', price: 10, created_at: '2026-10-05T10:00:00Z', branch: 'حلب' },
    { name: 'رقم أجنبي', phone: '+49 151 2345678', address: 'برلين', status: 'completed', price: 10, created_at: '2026-10-05T10:00:00Z' }]);
  await H.call('/rest/v1/invoices', [{ inv_number: 'INV-9', branch_key: 'daraa', branch_name: 'درعا', total: 50, customer_name: 'زبون فاتورة', customer_phone: '933950003', created_at: '2026-10-02T10:00:00Z', cashier_name: 'سامر' }]);
  await H.call('/rest/v1/warranties', [{ short_id: 'W77', customer_name: 'زبون كفالة', phone_no: '0933950004', product_name: 'Canon', serial_no: 'S1', status: 'active', expiry_date: '2027-01-01', purchase_date: '2026-01-01', warranty_type: 'standard' }]);
  const { browser, pg, errs } = await H.open('admin_pos.html?tab=customers', { init: H.ADMIN_INIT, w: 390, h: 900, mobile: true, wait: 6000 });
  await pg.evaluate(async () => { try { await loadInvoices(); } catch (_) {} await loadCustomers(); switchTab('customers'); window.__q = []; GMTAsk.confirm = async (m) => { window.__q.push(m); return true; }; GMTAsk.alert = async (m) => { window.__q.push(m); }; });
  await pg.evaluate(() => syncCustomersEverywhere()); await sleep(1500);
  const q = await pg.evaluate(() => window.__q);
  let c = await custs();
  const by = ph => c.filter(x => x.phone === ph);
  ok(/وُجد 3/.test(q[0] || '') && /من الأوردرات: 1/.test(q[0]) && /من الفواتير: 1/.test(q[0]) && /من الكفالات: 1/.test(q[0]) && /1 رقمٌ غير سوريّ/.test(q[0]), 'المزامنة تعدّ الناقص من كل مكان قبل الإضافة: ' + JSON.stringify(q[0]).slice(0, 160));
  ok(by('0933950002').length === 1 && by('0933950002')[0].name === 'زبون أوردر جديد' && by('0933950002')[0].address === 'حمص - الجديد', 'من الأوردرات: بالاسم الأحدث وآخر عنوان شحن (بلا تكرار)');
  ok(by('0933950003').length === 1 && by('0933950003')[0].branch_name === 'درعا' && by('0933950004').length === 1 && /الكفالات/.test(by('0933950004')[0].note || ''), 'من الفواتير (نقطة البيع) ومن الكفالات');
  ok(by('0933950001').length === 1 && by('0933950001')[0].name === 'موجود قديم' && by('0933950001')[0].address === 'حلب', 'العميل الموجود لا يتغيّر (ولو بصيغة رقمٍ أخرى)');
  ok(c.length === 4 + 1 && !c.some(x => /49/.test(x.phone || '') && x.name === 'رقم أجنبي'), 'الرقم غير السوريّ لا يُضاف: ' + c.length);
  await pg.evaluate(() => { window.__q = []; return syncCustomersEverywhere(); }); await sleep(800);
  ok(/موجودون في سجلّ العملاء/.test((await pg.evaluate(() => window.__q))[0] || ''), 'إعادة المزامنة ⇒ «كلّهم موجودون» (لا تكرار)');
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  // بوّابة الكفالة: زبونٌ جديد ⇒ سجلّ العملاء
  const G = await H.open('guarantee.html', { w: 1100, h: 900, wait: 3000, init: H.ADMIN_INIT });
  await G.pg.evaluate(() => saveWarrantyCustomer('زبون بوّابة جديد', '+963 944 950 005')); await sleep(800);
  c = await custs();
  ok(c.filter(x => x.phone === '0944950005' && x.name === 'زبون بوّابة جديد').length === 1, 'بوّابة الكفالة: الزبون الجديد يُحفظ في سجلّ العملاء');
  await G.pg.evaluate(() => saveWarrantyCustomer('اسم آخر', '0933950001')); await sleep(600);
  ok((await custs()).find(x => x.phone === '0933950001').name === 'موجود قديم', 'بوّابة الكفالة: لا تكتب فوق عميلٍ موجود');
  await G.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
