// (TASK-A0537 · المالك seq 876) «أشياء موجودة بالمشتريات ما هي موجودة بالجرد أو بالعكس … ممكن تضيع أو ما تكون موصولة»
// لوحة «🔗 تدقيق الفواتير والجرد»: الربط بالمعرّف ثمّ الباركود · البند بلا قطعة ولا باركود يظهر (كان يُعدّ فقط) · أصول المحل خارجها ·
// «🔗 اربطه» يربط البند بقطعةٍ موجودة · «↩︎ أنشئها» يربط البند بالقطعة الجديدة · فاتورة التسوية تُكتب في items_snapshot · القطع بلا فاتورة بمخزونها.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  const P = await H.call('/rest/v1/products', [
    { name: 'كاميرا مربوطة', barcode: '1111111111111', price: 500, haleb: 2 },
    { name: 'X86 Vacuum Suction ستاند شفط', barcode: '2222222222222', price: 10, haleb: 0 },
    { name: 'قطعة يدوية بلا فاتورة', barcode: '3333333333333', price: 20, haleb: 5 }]);
  const [cam, x68, manual] = P;
  await H.call('/rest/v1/import_log', [{ inv_number: 'PO-T-1', status: 'arrived', supplier: 'مورّد', items_snapshot: [
    { id: cam.id, name: 'كاميرا مربوطة', qty: 2 },
    { name: 'حمالة موبايل ك007 - اكس 68', qty: 4, notes: 'غير موجود في الجرد' },
    { name: 'ستاند عرض مضاد للسرقة', qty: 10, notes: 'أصل للمحل — سُجّل في «سجلّ الأصول»' },
    { id: 'dead-1', name: 'هيد محذوف', qty: 0 },
    { id: 'dead-2', name: 'عدسة محذوفة', barcode: '9999999999999', qty: 1 }] }]);
  const { browser, pg, errs } = await H.open('inventory.html?audit=1', { w: 390, h: 844, wait: 6000 });
  await pg.waitForFunction(() => window.GMTIntegrity && GMTIntegrity.audit, null, { timeout: 15000 });
  const r = await pg.evaluate(async () => { const r = await GMTIntegrity.audit(); return { orphans: r.orphanItems.map(e => e.item.name + ':' + e.kind), prods: r.orphanProducts.map(p => p.name + ':' + p._stock), assets: r.assetLines, stock: r.orphanStock, nobc: r.noBarcodeItems }; });
  ok(r.orphans.length === 2 && r.orphans.indexOf('حمالة موبايل ك007 - اكس 68:unlinked') >= 0 && r.orphans.indexOf('عدسة محذوفة:dead') >= 0,
    'غير المربوط يظهر بنوعه: بلا قطعة ولا باركود (اكس 68) · قطعة محذوفة — والأصل والمصفَّر خارجها: ' + JSON.stringify(r.orphans));
  ok(r.assets === 1 && r.nobc === 0, 'أصول المحل تُعدّ منفصلة (1) · لا «بلا باركود» يُكتفى بعدّه');
  const _st = r.prods.map(x => +x.split(':').pop()); ok(r.prods.indexOf('قطعة يدوية بلا فاتورة:5') >= 0 && r.prods.indexOf('X86 Vacuum Suction ستاند شفط:0') > r.prods.indexOf('قطعة يدوية بلا فاتورة:5') && _st.every((v, i) => !i || _st[i - 1] >= v) && r.stock === r.prods.filter(x => +x.split(':').pop() > 0).length && r.prods.indexOf('كاميرا مربوطة:2') < 0, 'القطع بلا فاتورة بمخزونها — ما له مخزون أوّلاً · المربوطة بالمعرّف ليست منها: ' + JSON.stringify(r.prods));
  // 🔗 اربطه
  await pg.evaluate(() => { window.__asked = []; GMTAsk.prompt = async () => 'X86'; GMTAsk.choose = async (m, o) => { window.__asked.push(o.choices.map(c => c.t)); return o.choices[0].k; }; GMTIntegrity.open(); });
  await sleep(1500);
  const btns = await pg.evaluate(() => document.querySelectorAll('[data-intg-link]').length);
  ok(btns === 2, 'لكلّ بندٍ غير مربوط زرّ «🔗 اربطه»: ' + btns);
  const idx = await pg.evaluate(() => { const a = GMTIntegrity.audit; return null; });
  await pg.evaluate(async () => { const r = await GMTIntegrity.audit(); const i = r.orphanItems.findIndex(e => /اكس 68/.test(e.item.name)); await GMTIntegrity.linkItem(i); });
  await sleep(800);
  let d = await dump(), line = d.import_log.find(x => x.inv_number === 'PO-T-1').items_snapshot[1];
  ok(line.id === x68.id && line.barcode === '2222222222222' && /رُبط بالجرد/.test(line.notes || ''), '«🔗 اربطه» ⇒ البند صار يشير للقطعة (المعرّف + الباركود + ملاحظة)');
  const r2 = await pg.evaluate(async () => (await GMTIntegrity.audit()).orphanItems.map(e => e.item.name));
  ok(r2.length === 1 && r2[0] === 'عدسة محذوفة', 'بعد الربط يختفي من القائمة');
  // ↩︎ أنشئها (قطعة محذوفة) ⇒ البند يشير للقطعة الجديدة
  await pg.evaluate(async () => { window.alert = () => {}; const r = await GMTIntegrity.audit(); await GMTIntegrity.fixItem(0); });
  await sleep(800);
  d = await dump(); line = d.import_log.find(x => x.inv_number === 'PO-T-1').items_snapshot[4];
  const np = d.products.find(p => p.name === 'عدسة محذوفة');
  ok(np && line.id === np.id, '«↩︎ أنشئها» ⇒ قطعة جديدة والبند صار يشير إليها (كان يبقى يتيماً)');
  // فاتورة التسوية ⇒ items_snapshot
  await pg.evaluate(async () => { GMTAsk.confirm = async () => true; window.alert = () => {}; await GMTIntegrity.audit(); await GMTIntegrity.fixOrphanProducts(); });
  await sleep(800);
  d = await dump(); const aud = d.import_log.find(x => /^AUDIT-/.test(x.inv_number || ''));
  ok(aud && Array.isArray(aud.items_snapshot) && aud.items_snapshot.some(i => i.name === 'قطعة يدوية بلا فاتورة' && i.qty === 5) && !('items' in aud), 'فاتورة التسوية تُكتب في items_snapshot (كانت `items` فتفشل) بكمّية المخزون');
  const real = errs.filter(e => !/Failed to load resource|status of (400|404)/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
