// (المالك seq 221) «المنتجات التي لها أكثر من خيار (السعر · اللون · الحجم) — أشياء مثل درون نيو ونيو سنجل: تأخذ منتجين أو ثلاثة إلى كل خيار
// (السنجل غير الكومبو) — هذا لازم يشتغل عليه العقل يرجع يعمل بحث»
// «🧩 منتجات بخيارات»: العقل يجمع العائلات مرّةً واحدة (يُحفظ) ⇒ «🧩 أنشئه في المتجر منتجاً واحداً بخيارات» ⇒ خيارٌ لكل منتج جرد
// (سعره · باركوده · صورته · مواصفاته · توافقه) · منتجات الجرد مربوطة به · المنفصل في المتجر يُحذف بتأكيد
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const inv = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
const STUB = `window.__ask = []; window.__brainStub = function () { window.GMTBrain = window.GMTBrain || {}; GMTBrain.askJSON = async function (q) {
  window.__ask.push(q.split('\\n')[0]); const L = q.split('\\n').slice(1), idx = re => L.findIndex(l => re.test(l)) + 1;
  if (/درون/.test(q)) return { families: [{ base: 'DJI Neo', option: 'النسخة', members: [{ i: idx(/neo single/i), value: 'Single' }, { i: idx(/neo combo/i), value: 'Combo' }] }] };
  if (/غطاء/.test(q)) return { families: [{ base: 'غطاء عدسة كانون', option: 'القطر', members: [{ i: idx(/49mm/), value: '49mm' }, { i: idx(/58mm/), value: '58mm' }] }] };
  return { families: [] }; }; };`;
(async () => {
  const { prods } = await H.seed();
  const [N1, N2, N3, C1, C2] = prods.map(p => String(p.id));
  const P = { [N1]: { name: 'Dji neo single', group_name: 'درونات', price: 360, barcode: 'NEO1', image_url: 'https://img.example/n1.png', compat: '' },
    [N2]: { name: 'Dji neo combo', group_name: 'درونات', price: 450, barcode: 'NEO2', image_url: 'https://img.example/n2.png', store_url: 'https://x/store.html#product=s_combo' },
    [N3]: { name: 'Dji neo 2 single', group_name: 'درونات', price: 470, barcode: 'NEO21' },
    [C1]: { name: '49mm lens cap for CANON غطا', group_name: 'اغطية كمرا وعدسة', price: 5, barcode: 'CAP49', compat: 'Canon EF 50mm f/1.8 STM (49مم)', specs: { 'القطر': '49 مم' } },
    [C2]: { name: '58mm lens cap for CANON غطا', group_name: 'اغطية كمرا وعدسة', price: 5, barcode: 'CAP58', compat: 'Canon EF 85mm f/1.8 USM (58مم)', specs: { 'القطر': '58 مم' } } };
  for (const id of Object.keys(P)) await H.call('/rest/v1/products?id=eq.' + id, Object.assign({ store_url: null, images: null }, P[id]), 'PATCH');
  for (const p of prods.slice(5)) await H.call('/rest/v1/products?id=eq.' + p.id, undefined, 'DELETE');
  await H.call('/rest/v1/gmt_settings?key=eq.variant_families_v1', undefined, 'DELETE');
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-28T10:00:00Z', categories: [{ id: 'c1', name: 'قسم الدرون', order: 1 }, { id: 'c2', name: 'اكسسوارات الكاميرا', order: 2 }],
    products: [{ id: 's_single', name: 'DJI Neo Single', price: 360, inv_id: N1, barcode: 'NEO1', images: ['https://img.example/s1.png'], category_id: 'c1', description: 'درون صغيرة' },
      { id: 's_combo', name: 'DJI Neo Fly More Combo', price: 450, images: ['https://img.example/s2.png'], category_id: 'c1' }] }]);
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, mobile: false, wait: 5000, init: H.ADMIN_INIT + STUB });
  await pg.evaluate(() => { window.__brainStub(); GMTAsk.confirm = async () => true; });
  await pg.evaluate(() => invOpenCheck('variants'));
  await pg.waitForFunction(() => typeof _varFams !== 'undefined' && _varFams && !_varBusy && document.querySelector('#bulk-content [data-vfam]'), null, { timeout: 30000 }).catch(() => {});
  const fams = await pg.evaluate(() => _varFams.map(f => ({ src: f.src, base: f.base, opt: f.option, m: f.members.map(m => m.p.name + '=' + m.value) })));
  ok(fams.length === 2 && fams.every(f => f.src === 'ai') && fams.some(f => f.base === 'DJI Neo' && f.m.join('|') === 'Dji neo single=Single|Dji neo combo=Combo') && !JSON.stringify(fams).includes('neo 2'),
    'العقل جمع العائلات (Neo سنجل/كومبو · الأغطية بالقطر) ولم يضمّ Neo 2: ' + JSON.stringify(fams));
  const db = (await H.call('/rest/v1/gmt_settings?key=eq.variant_families_v1&select=value', undefined, 'GET'))[0];
  ok(db && JSON.parse(db.value).fams.length === 2, 'حكم العقل محفوظ في القاعدة (variant_families_v1) — لا يُسأل مرّتين');
  const nAsk = await pg.evaluate(() => window.__ask.length);
  // مرّة واحدة: إعادة فتح الأداة لا تسأل العقل
  await pg.evaluate(() => { _varFams = null; bulkRenderVariants(document.getElementById('bulk-content'), true); });
  await pg.waitForFunction(() => _varFams && !_varBusy, null, { timeout: 15000 }).catch(() => {});
  ok(await pg.evaluate(n => window.__ask.length === n, nAsk), 'إعادة الفتح لا تستهلك العقل ثانيةً (عدد الأسئلة ثابت: ' + nAsk + ')');
  await pg.screenshot({ path: '/tmp/gmt-out/variants_tool.png' });
  // الإنشاء: Neo ⇐ منتج المتجر المربوط (s_single) يصير الأساس بخيارين · s_combo المنفصل يُحذف
  const fi = await pg.evaluate(() => _varFams.findIndex(f => f.base === 'DJI Neo'));
  await pg.evaluate(fi => document.querySelector(`#bulk-content [data-vfam="${fi}"] [data-va="make"]`).click(), fi);
  await pg.waitForFunction(() => Object.keys(_varDone).length === 1, null, { timeout: 15000 }).catch(() => {});
  const s = await store(), b = s.products.find(x => x.id === 's_single'), opt = b && b.options && b.options[0];
  ok(b && b.name === 'DJI Neo' && opt && opt.type === 'النسخة' && opt.affectsPrice === true && opt.values.map(v => v.name + ':' + v.price + ':' + v.barcode).join('|') === 'Single:360:NEO1|Combo:450:NEO2' && b.price === 360 && b.description === 'درون صغيرة',
    'منتج المتجر المربوط صار «DJI Neo» بخيار «النسخة»: Single $360 · Combo $450 (لكلٍّ باركوده) — الوصف باقٍ: ' + JSON.stringify(opt).slice(0, 200));
  ok(!s.products.some(x => x.id === 's_combo'), 'المنتج المنفصل «DJI Neo Fly More Combo» حُذف من المتجر (بعد التأكيد)');
  const i1 = await inv(N1), i2 = await inv(N2), i3 = await inv(N3);
  ok(/#product=s_single/.test(i1.store_url || '') && /#product=s_single/.test(i2.store_url || '') && !i3.store_url, 'منتجا الجرد (سنجل وكومبو) مربوطان بالمنتج الواحد · Neo 2 لم يُمسّ');
  // الأغطية: لا مربوط ⇒ منتجٌ جديد في القسم المختار · كل خيارٍ بمواصفاته وتوافقه
  const ci = await pg.evaluate(() => _varFams.findIndex(f => f.option === 'القطر'));
  await pg.evaluate(ci => { const c = document.querySelector(`#bulk-content [data-vfam="${ci}"]`); c.querySelector('[data-vf="cat"]').value = 'c2'; c.querySelector('[data-va="make"]').click(); }, ci);
  await pg.waitForFunction(() => Object.keys(_varDone).length === 2, null, { timeout: 15000 }).catch(() => {});
  const s2 = await store(), cp = s2.products.find(x => x.name === 'غطاء عدسة كانون'), v58 = cp && cp.options[0].values.find(v => v.name === '58mm');
  ok(cp && cp.category_id === 'c2' && cp.options[0].affectsPrice === false && v58 && v58.barcode === 'CAP58' && /85mm/.test(v58.compat || '') && (v58.specs || []).some(r => r.value === '58 مم'),
    'الأغطية ⇐ منتجٌ جديد «غطاء عدسة كانون» بخيار «القطر» — 58mm بباركوده وتوافقه (85mm) ومواصفاته: ' + JSON.stringify(v58).slice(0, 200));
  const card = await pg.evaluate(() => document.querySelector('#bulk-content').innerText.match(/✅[^\n]*/g));
  ok(card && card.length === 2, 'البطاقتان صارتا «✅ صار منتجاً واحداً في المتجر» مع «🛒 افتحه في المتجر»: ' + JSON.stringify(card));
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
