// (TASK-B0415 · المالك seq 727) «زبائن المتجر الإلكتروني ما عم تتسيف عندنا بأسمائهم في الزبائن»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_customers', [{ name: null, phone: '0933000003', branch_name: 'حمص' }, { name: 'اسم قديم', phone: '0933000004', branch_name: 'حلب' }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(3500);
  const norm = await o.pg.evaluate(() => ['0933000001', '+963 933 000 001', '00963933000001', '٠٩٣٣٠٠٠٠٠١', '933000001', 'abc', '0123'].map(gmtNormSyPhone));
  ok(norm.slice(0, 5).every(x => x === '0933000001') && !norm[5] && !norm[6], 'تطبيع الرقم من كلّ الصيغ (+963 · 00963 · أرقام عربية · بلا صفر): ' + JSON.stringify(norm));
  await o.pg.evaluate(async () => {
    const U = 'https://ysawzwtmodkqqbqoiojj.supabase.co', K = 'k';
    await gmtSaveStoreCustomer(U, K, 'زبون جديد', '٠٩٣٣٠٠٠٠٠٢');
    await gmtSaveStoreCustomer(U, K, 'يملأ الاسم', '0933000003');
    await gmtSaveStoreCustomer(U, K, 'لا يكتب فوق', '0933000004');
  });
  await o.pg.waitForTimeout(800);
  const d = await dump(), by = p => (d.gmt_customers || []).find(c => c.phone === p) || {};
  ok(by('0933000002').name === 'زبون جديد' && by('0933000002').branch_name === 'المتجر الإلكتروني', 'زبون جديد برقمٍ عربيّ ⇒ يُحفظ باسمه');
  ok(by('0933000003').name === 'يملأ الاسم' && by('0933000003').branch_name === 'حمص', 'موجودٌ بلا اسم ⇒ يُملأ اسمه ولا يتغيّر فرعه');
  ok(by('0933000004').name === 'اسم قديم' && by('0933000004').branch_name === 'حلب', 'موجودٌ باسم ⇒ لا يُكتب فوقه');
  ok((d.gmt_customers || []).filter(c => c.phone === '0933000002').length === 1, 'لا تكرار للزبون');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
