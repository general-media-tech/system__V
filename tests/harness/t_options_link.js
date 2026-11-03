// (المالك seq 222/223) «في منتجات في الأساس في المتجر لها خيارات» — «الأداة تشملها وأيضاً ممكن أنا من داخل المتجر أو من داخل إدارة المنتجات
// أو من داخل الجرد أعطي أكثر من خيار … كلّهم مربوطين على نفس المنتج في المتجر بس في الفاتورة … في الجرد كلّ واحد منتج لحاله»
// ① منتج جرد هو خيارٌ (بالباركود وحده) في منتج متجر: صفحة التعديل «🧩 خيار … في …» · المواصفات والاسم للقيمة وحدها · المنتج الأساسيّ لم يُمسّ
// ② «🔓 أخرجه من الخيار» ⇒ القيمة باقية بلا ربط · الجرد بلا رابط
// ③ المنتج الأساسيّ: «➕ أضف منتجاً من الجرد خياراً هنا» ⇒ مجموعة جديدة (الأساسيّ أوّلاً) · رابط المنتج الآخر
// ④ غير مربوط: «🧩 أضفه خياراً لمنتجٍ في المتجر» ⇒ قيمة في المجموعة القائمة
// ⑤ أداة «منتجات بخيارات»: قسم «منتجات في المتجر لها خيارات أصلاً» ⇐ ربط قيمة «Combo» بمنتج جرد
// ⑥ الجسر: المنتج الذي هو خيار «مرتبط» مع «🧩 خيار … في …» · و«🔓 فكّ» يفكّ الخيار
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const inv = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
const sp = async id => (await store()).products.find(x => x.id === id);
const realErrs = errs => errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
(async () => {
  const { prods } = await H.seed();
  const [A, B, C, D, E] = prods;
  await H.call('/rest/v1/products?id=eq.' + A.id, { name: 'Dji neo single', barcode: 'NEO1', price: 228, store_url: 'https://x/store.html#product=s_neo', specs: {} }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + B.id, { name: 'Dji neo combo', barcode: 'NEO2', price: 400, store_url: null, specs: { 'الوزن': '135 غ' } }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + C.id, { name: 'Led 660 pro', barcode: 'L660', price: 70, store_url: 'https://x/store.html#product=s_led' }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + D.id, { name: 'Led 660 pro RGB', barcode: 'L660R', price: 95, store_url: null, image_url: 'https://img.example/rgb.png' }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + E.id, { name: 'Dji neo fly more', barcode: 'NEO3', price: 520, store_url: null }, 'PATCH');
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-03T10:00:00Z', categories: [{ id: 'c1', name: 'درون', order: 1 }],
    products: [
      { id: 's_neo', name: 'Dji neo', price: 300, inv_id: A.id, barcode: 'NEO1', images: ['https://img.example/neo.png'], category_id: 'c1', specs: [{ label: 'الأساسي', value: 'نعم' }], description: 'وصف نيو',
        options: [{ type: 'الاصدار', affectsPrice: true, values: [{ name: '.', price: 300 }, { name: 'Combo', price: 500, barcode: 'NEO2' }] }] },
      { id: 's_led', name: 'لوح اضائة 660', price: 65, inv_id: C.id, barcode: 'L660', images: [], category_id: 'c1', options: [] }] }]);

  /* حكم العقل محفوظ سلفاً ⇒ الأداة لا تسأله (لا يستهلك الذكاء الاصطناعي في الاختبار) */
  await H.call('/rest/v1/gmt_settings?key=eq.variant_families_v1', undefined, 'DELETE');
  await H.call('/rest/v1/gmt_settings', [{ key: 'variant_families_v1', value: JSON.stringify({ at: Date.now(), types: { drone: 1 }, fams: [] }) }]);
  const { browser, pg, errs } = await H.open('inventory.html', { w: 390, h: 844, mobile: true, wait: 5000 });
  await pg.evaluate(() => { GMTAsk.confirm = async () => true; });
  // ① B مربوط بالباركود كقيمة «Combo»
  ok(await pg.evaluate(async id => { await invStoreIndex(true); return invLinked(allProducts.find(x => String(x.id) === id)); }, B.id), 'الجرد: «Dji neo combo» مربوط (خيار بالباركود)');
  await pg.evaluate(id => invOpenFullEdit(id), B.id);
  await pg.waitForSelector('#gmt-pe [data-pe-unopt]', { timeout: 10000 }).catch(() => {});
  const bar = await pg.evaluate(() => (document.querySelector('#gmt-pe .pe-linked') || {}).innerText || '');
  ok(/خيار «Combo» \(الاصدار\) في منتج المتجر «Dji neo»/.test(bar), 'صفحة التعديل: «🧩 خيار «Combo» (الاصدار) في منتج المتجر «Dji neo»»: ' + bar.replace(/\s+/g, ' '));
  await pg.evaluate(() => {
    const r = [...document.querySelectorAll('#gmt-pe .pe-row')].find(x => x.querySelector('[data-rk]').value === 'الوزن'); r.querySelector('[data-rv]').value = '135 غ (Combo)';
    document.querySelector('#gmt-pe [data-o="name"]').value = 'Fly More Combo';
    document.querySelector('#gmt-pe [data-pe-save]').click();
  });
  await sleep(1800);
  let neo = await sp('s_neo'), v = neo.options[0].values[1];
  ok(v.name === 'Fly More Combo' && JSON.stringify(v.specs || []).includes('135 غ (Combo)'), 'الحفظ ⇐ اسم القيمة ومواصفاتها: ' + JSON.stringify({ n: v.name, s: v.specs }));
  ok(neo.name === 'Dji neo' && JSON.stringify(neo.specs) === JSON.stringify([{ label: 'الأساسي', value: 'نعم' }]) && neo.price === 300, 'المنتج الأساسيّ لم يُمسّ (الاسم · الجدول · السعر)');
  // ② أخرجه من الخيار
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-unopt]').click());
  await pg.waitForSelector('#gmt-pe [data-pe-link]', { timeout: 10000 }).catch(() => {});
  neo = await sp('s_neo'); v = neo.options[0].values[1];
  const b1 = await inv(B.id);
  ok(v.name === 'Fly More Combo' && !v.barcode && v.inv_id == null && !b1.store_url, '«🔓 أخرجه من الخيار» ⇒ الخيار باقٍ بلا ربط · الجرد بلا رابط: ' + JSON.stringify(v));
  // ④ غير مربوط: «🧩 أضفه خياراً لمنتجٍ في المتجر» ⇒ القيمة القائمة «Fly More Combo»
  await pg.evaluate(() => { document.querySelector('#gmt-pe [data-pe-asopt]').click(); });
  await pg.evaluate(() => { const q = document.querySelector('#gmt-pe [data-pe-asq]'); q.value = 'neo'; q.dispatchEvent(new Event('input')); });
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-as-pick="s_neo"]').click());
  await pg.evaluate(() => { const V = document.querySelector('#gmt-pe [data-po-v]'); V.value = '1'; V.dispatchEvent(new Event('change')); document.querySelector('#gmt-pe [data-po-go]').click(); });
  await pg.waitForSelector('#gmt-pe [data-pe-unopt]', { timeout: 10000 }).catch(() => {});
  neo = await sp('s_neo'); v = neo.options[0].values[1];
  const b2 = await inv(B.id);
  ok(neo.options[0].values.length === 2 && String(v.inv_id) === String(B.id) && v.barcode === 'NEO2' && /#product=s_neo/.test(b2.store_url || ''), '«🧩 أضفه خياراً» ⇒ القيمة «Fly More Combo» نفسها (بلا تكرار) مربوطة · الجرد على المنتج: ' + JSON.stringify({ n: neo.options[0].values.map(x => x.name), su: b2.store_url }));
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-x]').click());
  // ③ المنتج الأساسيّ «لوح اضائة 660» بلا خيارات ⇒ «➕ أضف منتجاً من الجرد خياراً هنا»
  await pg.evaluate(id => invOpenFullEdit(id), C.id);
  await pg.waitForSelector('#gmt-pe [data-pe-optadd]', { timeout: 10000 }).catch(() => {});
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-optadd]').click());
  await pg.evaluate(() => { const q = document.querySelector('#gmt-pe [data-po-q]'); q.value = 'RGB'; q.dispatchEvent(new Event('input')); });
  const picked = await pg.evaluate(id => { const b = document.querySelector('#gmt-pe [data-po-pick="' + id + '"]'); if (b) b.click(); return !!b; }, D.id);
  ok(picked, 'البحث في الجرد يعرض «Led 660 pro RGB» (غير مربوط)');
  await pg.evaluate(() => { document.querySelector('#gmt-pe [data-po-main]').value = 'أبيض'; document.querySelector('#gmt-pe [data-po-name]').value = 'RGB'; document.querySelector('#gmt-pe [data-po-go]').click(); });
  await sleep(1800);
  const led = await sp('s_led'), d1 = await inv(D.id), g = led.options[0] || {};
  ok(g.type === 'النسخة' && g.affectsPrice && g.values.length === 2 && g.values[0].name === 'أبيض' && String(g.values[0].inv_id) === String(C.id) && g.values[0].price === 65 &&
    g.values[1].name === 'RGB' && String(g.values[1].inv_id) === String(D.id) && g.values[1].price === 95 && g.values[1].image === 'https://img.example/rgb.png',
    '➕ ⇐ مجموعة «النسخة»: «أبيض» (الأساسيّ $65) ثمّ «RGB» ($95 · صورته · باركوده): ' + JSON.stringify(g.values));
  ok(/#product=s_led/.test(d1.store_url || '') && String(led.inv_id) === String(C.id), 'منتج الجرد الآخر رابطه على المنتج نفسه · الأساسيّ باقٍ أساسيّاً');
  const listTxt = await pg.evaluate(() => (document.querySelector('#gmt-pe [data-pe-store]') || {}).innerText || '');
  ok(/RGB/.test(listTxt) && /Led 660 pro RGB/.test(listTxt), 'قائمة «🧩 خيارات هذا المنتج في المتجر» تعرض الربط');
  await pg.evaluate(() => document.querySelector('#gmt-pe [data-pe-x]').click());
  // ⑤ أداة منتجات بخيارات: ربط «.» بمنتج «Dji neo fly more»؟ — بل نربط القيمة «.» بمنتج E للتجربة
  await pg.evaluate(() => { _gmtStoreCat = null; return invStoreIndex(true); });
  await pg.evaluate(() => invOpenCheck('variants')); await sleep(3500);
  const sec = await pg.evaluate(() => { const c = document.getElementById('bulk-content'); return c ? c.innerText : ''; });
  ok(/منتجات في المتجر لها خيارات أصلاً/.test(sec) && /«Fly More Combo» \$500\s*Dji neo combo/.test(sec), 'الأداة: قسم «منتجات في المتجر لها خيارات أصلاً» مع ربط Combo الظاهر');
  const mapped = await pg.evaluate(async id => {
    const row = [...document.querySelectorAll('#bulk-content [data-vopt]')].find(r => /«\.»/.test(r.innerText)); if (!row) return 'no row';
    const sel = row.querySelector('[data-vsel]'); if (![...sel.options].some(o => o.value === id)) return 'no cand ' + [...sel.options].map(o => o.text).join('|');
    sel.value = id; row.querySelector('[data-va="omap"]').click(); return 'ok';
  }, E.id);
  await sleep(2500);
  neo = await sp('s_neo'); const e1 = await inv(E.id);
  ok(mapped === 'ok' && String(neo.options[0].values[0].inv_id) === String(E.id) && neo.options[0].values[0].barcode === 'NEO3' && /#product=s_neo/.test(e1.store_url || ''), '«🔗 اربط» ⇐ القيمة «.» مربوطة بمنتج الجرد · رابطه على المنتج: ' + mapped);
  ok(!realErrs(errs).length, 'لا أخطاء JS (الجرد): ' + JSON.stringify(realErrs(errs).slice(0, 2)));
  await browser.close();
  // ⑥ الجسر
  const o = await H.open('bridge.html', { w: 1366, h: 900, mobile: false, wait: 6000 });
  const t1 = await o.pg.evaluate(id => { const p = invProds.find(x => String(x.id) === id); return { l: isInvLinked(p), html: document.getElementById('list1').innerText }; }, D.id);
  ok(t1.l && /خيار «RGB» \(النسخة\) في منتج المتجر «لوح اضائة 660»/.test(t1.html), 'الجسر: «Led 660 pro RGB» مرتبط مع «🧩 خيار «RGB» … في «لوح اضائة 660»»');
  const t2 = await o.pg.evaluate(() => document.getElementById('list2').innerText);
  ok(/خياراته في الجرد/.test(t2) && /Led 660 pro RGB/.test(t2), 'الجسر (المتجر): «🧩 خياراته في الجرد» تعرض منتجات الجرد');
  await o.pg.evaluate(id => { GMTAsk.confirm = async () => true; return unlinkPair(id); }, D.id); await sleep(800);
  const led2 = await sp('s_led'), d2 = await inv(D.id);
  ok(led2.options[0].values[1].name === 'RGB' && led2.options[0].values[1].inv_id == null && !led2.options[0].values[1].barcode && !d2.store_url, 'الجسر: «🔓 فكّ» على الخيار ⇒ القيمة باقية بلا ربط · الجرد بلا رابط');
  ok(!realErrs(o.errs).length, 'لا أخطاء JS (الجسر): ' + JSON.stringify(realErrs(o.errs).slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
