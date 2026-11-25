// TASK-B0570 · الخطّة 3.1 · المالك seq 982 — «🧩 كمّل طقمك» بنقطة البيع (نفس منطق المتجر)
const H = require('./h.js'), fs = require('fs'), path = require('path');
global.window = globalThis; require('../../gmt-compat-kb.js'); require('../../gmt-kit.js'); const K = require('../../gmt-poskit.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const REC = JSON.parse(fs.readFileSync(path.join(__dirname, 'poskit_sample.json'), 'utf8'));
  const [L, S] = REC.products;
  const main = [{ id: 'mL', name: 'Godox LC500R', barcode: L.barcode, price: 90, haleb: 2 }, { id: 'mS', name: 'Stand 205 cm', barcode: S.barcode, price: 12, haleb: 4 }];
  const s = K.suggest([main[0]], REC, main, 'haleb');
  ok(s.length === 1 && s[0].prod.id === 'mS' && s[0].stock === 4, 'الإضاءة بالسلّة ⇐ بيقترح الستاند (منتج الجرد بالباركود) مع مخزون الفرع 4');
  ok(K.suggest(main, REC, main, 'haleb').every(x => x.prod.id !== 'mS'), 'اللي بالسلّة أصلاً ما بيتقترح');
  ok(K.suggest([main[0]], REC, [main[0], Object.assign({}, main[1], { haleb: 0 })], 'haleb')[0].stock === 0, 'مخزون صفر بالفرع ⇐ «بفرع تاني» (بلا زرّ إضافة)');
  /* الواجهة */
  await H.seed();
  await H.call('/rest/v1/products', [{ name: 'Godox LC500R', barcode: L.barcode, price: 90, haleb: 0, daraa: 2 }, { name: 'Stand 205 cm', barcode: S.barcode, price: 12, haleb: 0, daraa: 4 }]);
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 1366, h: 900, mobile: false, wait: 7000 });
  await pg.evaluate(rec => { localStorage.setItem('gmt_poskit_store_v1', JSON.stringify({ at: Date.now(), rec })); GMTPosKit._set(rec); }, REC);
  const ids = await pg.evaluate(() => (allProducts || []).filter(p => /LC500R|Stand 205/.test(p.name)).map(p => [p.name, p.id]));
  const lid = (ids.find(x => /LC500R/.test(x[0])) || [])[1];
  if (lid) { await pg.evaluate(id => { toggleProd(id); renderCart(); }, lid); await sleep(500); }
  const box = await pg.evaluate(() => (document.querySelector('[data-poskit]') || {}).textContent || '');
  ok(!!lid && /كمّل طقمك/.test(box) && /Stand 205/.test(box) && /عندك/.test(box), 'تحت السلّة: «🧩 كمّل طقمك» فيه الستاند + «✅ عندك» : ' + box.slice(0, 120));
  await pg.evaluate(() => { const b = document.querySelector('[data-poskit-add]'); b && b.click(); }); await sleep(500);
  ok(await pg.evaluate(() => Object.values(cart).some(x => /Stand 205/.test(x.prod.name)) && !document.querySelector('[data-poskit]')), '«＋ أضف» ⇐ الستاند بالسلّة · والاقتراح اختفى (صار بالسلّة)');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
