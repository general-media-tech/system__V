// (TASK-0287 · المالك seq 229) «يحتفظ في الاسم كما كان مكتوب في الفاتوره وثابتاً بحيث لما ادخله مره ثانيه اذا انا غيرت الاسم … يكون معروف»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const LINE_R8 = 'EOS R8 5 feathery 5Pink. 5 soldiers 5 yellow 5 red';
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'كفر سيليكون EOS R8 · زهري', barcode: 'INV0001', price: 0, haleb: 0, daraa: 0, invoice_names: [{ n: LINE_R8, src: 'Shixin', color: 'Pink' }] },
    { name: 'كفر سيليكون EOS R8 · أصفر', barcode: 'INV0002', price: 0, haleb: 0, daraa: 0, invoice_names: [{ n: LINE_R8, src: 'Shixin', color: 'yellow' }] },
    { name: 'ستاند الإضاءة الجديد (غيّرنا اسمه)', barcode: 'INV0003', price: 0, haleb: 0, daraa: 0, invoice_names: [{ n: '8819 stand', src: 'Shixin', usd: 2.24 }] }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1100, h: 900, wait: 6000, mobile: false });
  await pg.evaluate((line) => {
    exRows = [{ name: '8819  STAND', qty: 5, netCost: 2.24 }, { name: line, qty: 10, netCost: 3.86 }, { name: 'Brand New Light X1', qty: 2, netCost: 9 }];
    importExcel();
  }, LINE_R8);
  await pg.waitForTimeout(1500);
  const c = await pg.evaluate(() => cart.map(x => ({ id: x.product.id, name: x.product.name, pending: !!x.product._pending, qty: x.qty })));
  const byName = n => c.find(x => x.name === n);
  ok(c.length === 3, 'ثلاثة بنود في السلّة: ' + c.length);
  ok(byName('ستاند الإضاءة الجديد (غيّرنا اسمه)') && !byName('ستاند الإضاءة الجديد (غيّرنا اسمه)').pending, '«8819  STAND» (اسم الفاتورة · حالة ومسافات مختلفة) ⇐ المنتج نفسه رغم تغيير اسمه، بلا منتجٍ جديد');
  const r8 = c.find(x => /^كفر سيليكون EOS R8/.test(x.name));
  ok(r8 && !r8.pending && r8.qty === 10 && !c.some(x => x.pending && x.name === LINE_R8), 'سطر الكفر الذي يطابق لونين ⇐ رُبط بأحدهما (' + (r8 && r8.name) + ') ولم يُنشأ منتجٌ مكرّر');
  await pg.waitForTimeout(1500);
  const warn = await pg.evaluate(() => (document.getElementById('toast-box') || {}).textContent || '');
  ok(/يطابق أكثر من منتج/.test(warn), 'وتنبيهٌ ظاهر بأنه يطابق أكثر من منتج: ' + warn.slice(0, 90));
  const nw = byName('Brand New Light X1');
  ok(nw && nw.pending, 'اسمٌ غير معروف ⇐ منتجٌ جديد معلّق كما كان');
  // الحفظ: المنتج الجديد يُحفظ ومعه اسم الفاتورة ثابتاً
  await pg.evaluate(() => { try { _saveLock = false; } catch (_) {} return saveShipment(); }).catch(() => {});
  await pg.waitForTimeout(2500);
  const dump = (await H.call('/__dump', undefined, 'GET')).products;
  const saved = dump.find(p => p.name === 'Brand New Light X1');
  ok(saved && Array.isArray(saved.invoice_names) && saved.invoice_names[0] && saved.invoice_names[0].n === 'Brand New Light X1', 'المنتج الجديد من الفاتورة يُحفظ ومعه اسمه في الفاتورة (invoice_names): ' + JSON.stringify(saved && saved.invoice_names));
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
