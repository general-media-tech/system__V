// TASK-B0567 · A989–A991 م٣ · seq B1105 — ربط بند الإكسل بالمنتج من المعاينة + النظام بيتعلّم اسم المورّد
const H = require('./h.js'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const [P1, P2] = await H.call('/rest/v1/products', [{ name: 'Light stand 2m', barcode: 'LS2', price: 9, cost_price: 4 }, { name: 'ضوء فيديو ليد 60 واط', barcode: 'LED60', price: 40, cost_price: 15 }]);
  const { browser, pg, errs } = await H.open('purchase.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  const read = async () => { await pg.evaluate(() => { try { exRows = []; } catch (_) {} }); await pg.setInputFiles('#excel-file', path.join(__dirname, 'xl_pi_supplier.xlsx')); await pg.waitForFunction(() => exRows.length > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(300); };
  const cells = () => pg.evaluate(() => [...document.querySelectorAll('[data-ex-link]')].map(td => td.textContent.replace(/\s+/g, ' ').trim()));
  await read();
  let c = await cells();
  ok(c.length === 3 && /منتج جديد/.test(c[0]) && /Light stand 2m/.test(c[1]) && /نفس الاسم/.test(c[1]) && /منتج جديد/.test(c[2]), 'خانة «ينربط بـ»: الحامل ✅ بنفس الاسم · الباقي 🆕 جديد: ' + JSON.stringify(c));
  /* ربط يدوي: «LED video light 60W» ⇐ «ضوء فيديو ليد 60 واط» */
  await pg.evaluate(() => _exEditLink(0)); await sleep(150);
  ok(await pg.evaluate(() => document.querySelectorAll('#ex-prod-dl option').length >= 2), 'قائمة بحث بالمنتجات (الاسم ⟨الباركود⟩)');
  await pg.evaluate(() => { document.querySelector('[data-ex-link="0"] [data-ex-q]').value = 'ضوء فيديو ليد 60 واط ⟨LED60⟩'; document.querySelector('[data-ex-link="0"] [data-ex-ok]').click(); }); await sleep(150);
  /* السوفت بوكس: «منتج جديد» صراحةً */
  await pg.evaluate(() => { _exEditLink(2); document.querySelector('[data-ex-link="2"] [data-ex-new]').click(); }); await sleep(150);
  c = await cells();
  ok(/اخترته إنت/.test(c[0]) && /ضوء فيديو ليد 60 واط/.test(c[0]) && /منتج جديد \(اخترته\)/.test(c[2]), 'بعد التصحيح: ✋ اخترته إنت · 🆕 جديد (اخترته): ' + JSON.stringify([c[0], c[2]]));
  await pg.evaluate(() => importExcel()); await sleep(1500);
  const cart = await pg.evaluate(() => cart.map(x => [x.product.name, String(x.product.id).startsWith('-')]));
  ok(cart.some(x => x[0] === 'ضوء فيديو ليد 60 واط' && !x[1]) && cart.some(x => x[0] === 'Softbox 90cm' && x[1]) && cart.some(x => x[0] === 'Light stand 2m'), 'الاستيراد التزم بالربط: الليد ⇐ منتجنا · السوفت بوكس جديد · الحامل بالاسم');
  const d = await H.call('/__dump', undefined, 'GET'), p2 = d.products.find(p => p.id === P2.id);
  ok(Array.isArray(p2.invoice_names) && p2.invoice_names.some(x => x.n === 'LED video light 60W' && /استيراد إكسل/.test(x.src)), '🧠 النظام تعلّم: «LED video light 60W» صار اسم مورّد لـ«ضوء فيديو ليد 60 واط»: ' + JSON.stringify(p2.invoice_names));
  /* المرّة الجاية: نفس الملف ⇐ بيعرفه لحاله */
  await read();
  c = await cells();
  ok(/ضوء فيديو ليد 60 واط/.test(c[0]) && /عرفه من فاتورة سابقة/.test(c[0]), 'المرّة التانية بلا أيّ تدخّل: «🧠 عرفه من فاتورة سابقة»: ' + c[0]);
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/exlink.png' });
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
