// (TASK-0355 · المالك seq 534–538) «اعمل فاتورة تسوية ولكن لا تحذف القديم قبل ما نراجع الفرق والنقص»
// مطابقة الجرد: المسودة تُعرض (المحلّ · المستودع · الفعلي · النظام الحيّ · الفرق) · التعديل/الربط/الاستثناء والحفظ **لا يلمس المخزون**
// · «اعتماد» وحده ⇐ فاتورة تسوية (إعادة إنشاء) والكمّيات = الفعلي · المستثنى وغير المربوط لا يُلمس · المسودة تُختم «طُبّقت».
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  const [A, B, C, X] = await H.call('/rest/v1/products', [
    { name: 'مطابقة أ — LED 600', barcode: 'RC1', price: 40, wholesale_price: 25, haleb: 5, daraa: 1 },
    { name: 'مطابقة ب — YM-S60', barcode: 'RC2', price: 100, haleb: 2 },
    { name: 'مطابقة ج — بطارية', barcode: 'RC3', price: 7.5, haleb: 224 },
    { name: 'مطابقة د — فلاش يونغو', barcode: 'RC4', price: 90, haleb: 0 }]);
  await H.call('/rest/v1/stock_counts', [{ id: 77, branch_key: 'haleb', branch_name: 'حلب', counted_by: 'اختبار', created_at: '2026-11-10T09:00:00Z',
    details: { status: 'draft', sources: [{ label: 'المحلّ' }, { label: 'المستودع' }], items: [
      { id: A.id, name: A.name, counted_as: 'LED 600', shop: 1, store: 2, actual: 3, system: 5, include: true, photos: [], pages: [] },
      { id: B.id, name: B.name, counted_as: 'YM-S60', shop: 4, store: null, actual: 4, system: 2, include: true, photos: [], pages: [] },
      { id: C.id, name: C.name, counted_as: 'بطارية F550', shop: 35, store: null, actual: 35, system: 224, include: false, note: 'يُعاد عدّه', photos: [], pages: [] },
      { id: null, name: null, counted_as: 'فلاش (صورة 35)', shop: 1, store: null, actual: 1, system: null, include: false, note: 'غير موجود في الجرد', photos: [], pages: [] }] } }]);
  const { browser, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.waitForFunction(() => !!window.GMTReconcile && !!window.GMTStock, null, { timeout: 8000 });
  await pg.evaluate(() => openReconcile()); await pg.waitForSelector('#gmt-rc [data-ix]', { timeout: 8000 }); await sleep(500);
  const s1 = await pg.evaluate(() => ({ rows: document.querySelectorAll('#gmt-rc [data-ix]').length, sum: document.querySelector('#gmt-rc [data-sum]').innerText, txt: document.querySelector('#gmt-rc [data-body]').innerText }));
  ok(s1.rows === 4 && /داخل التسوية 2/.test(s1.sum) && /نقص 1 بنداً \(−2/.test(s1.sum) && /زيادة 1 بنداً \(\+2/.test(s1.sum), 'المسودة تُعرض: 4 أسطر · داخل التسوية 2 · نقص −2 · زيادة +2: ' + s1.sum.replace(/\s+/g, ' ').slice(0, 120));
  ok(/غير مربوط بالجرد/.test(s1.txt) && /يُعاد عدّه/.test(s1.txt), 'السطر غير المربوط والمستثنى ظاهران بملاحظاتهما');
  // تعديل الفعلي لـ ب ⇐ 6 · ربط الفلاش بمنتجه وتضمينه · حفظ
  await pg.evaluate(id => { const r = [...document.querySelectorAll('#gmt-rc [data-ix]')].find(x => /YM-S60/.test(x.innerText)); const i = r.querySelector('[data-act]'); i.value = '6'; i.dispatchEvent(new Event('change', { bubbles: true })); }, B.id);
  await sleep(200);
  await pg.evaluate(n => { const r = [...document.querySelectorAll('#gmt-rc [data-ix]')].find(x => /فلاش/.test(x.innerText)); const i = r.querySelector('[data-link]'); i.value = n; i.dispatchEvent(new Event('change', { bubbles: true })); }, X.name);
  await sleep(700);
  const s2 = await pg.evaluate(() => document.querySelector('#gmt-rc [data-sum]').innerText);
  ok(/داخل التسوية 3/.test(s2) && /زيادة 2 بنداً \(\+5/.test(s2), 'بعد التعديل والربط: داخل التسوية 3 · زيادة +5 (ب: 2⇐6 · الفلاش: 0⇐1): ' + s2.replace(/\s+/g, ' ').slice(0, 110));
  await pg.click('#gmt-rc [data-save]'); await sleep(800);
  let D = await dump(); let sc = D.stock_counts.find(r => r.id === 77); let P = id => D.products.find(p => p.id === id);
  ok(sc.details.items.find(i => i.counted_as === 'YM-S60').actual === 6 && sc.details.items.find(i => /فلاش/.test(i.counted_as)).id === X.id && sc.details.status === 'draft', '«حفظ المسودة» يكتب التعديلات في المسودة (الحالة ما زالت مسودة)');
  ok(P(A.id).haleb === 5 && P(B.id).haleb === 2 && P(C.id).haleb === 224 && P(X.id).haleb === 0 && !(D.branch_stock_transfers || []).length, 'لا شيء يُكتب على المخزون قبل الاعتماد — ولا فاتورة');
  // الاعتماد
  await pg.evaluate(() => { window.GMTAuth = Object.assign(window.GMTAuth || {}, { ask: async () => true }); window.GMTAsk = Object.assign(window.GMTAsk || {}, { confirm: async () => true }); });
  await pg.click('#gmt-rc [data-apply]'); await sleep(4500);
  D = await dump(); sc = D.stock_counts.find(r => r.id === 77);
  ok(P(A.id).haleb === 3 && P(B.id).haleb === 6 && P(X.id).haleb === 1, 'بعد «اعتماد»: حلب = الفعلي (أ 5⇐3 · ب 2⇐6 · الفلاش 0⇐1): ' + [P(A.id).haleb, P(B.id).haleb, P(X.id).haleb].join(','));
  ok(P(C.id).haleb === 224 && P(A.id).daraa === 1, 'المستثنى لم يُلمس (224) · ولا الفروع الأخرى (درعا 1)');
  const tr = D.branch_stock_transfers || [];
  ok(tr.length === 2 && tr.every(t => /^فاتورة إعادة إنشاء/.test(t.title) && /تسوية من الجرد/.test(t.title) && t.status === 'received'), 'فاتورتا تسوية (الزيادات · النقص) مستلَمة: ' + tr.map(t => t.transfer_number + ' ' + t.title.slice(0, 40)).join(' | '));
  ok(sc.details.status === 'applied' && (sc.details.numbers || []).length === 2, 'المسودة خُتمت «طُبّقت» بأرقام الفواتير: ' + (sc.details.numbers || []).join(' + '));
  ok(await pg.evaluate(() => document.querySelector('#gmt-rc [data-apply]').disabled), 'بعد التطبيق لا اعتماد ثانٍ للمسودة نفسها');
  const geo = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
  ok(geo.sw <= geo.vw + 1, 'لا طفح أفقي');
  const real = errs.filter(x => !/Failed to load resource|status of (400|404|406)/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
