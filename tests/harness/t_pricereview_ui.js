// (TASK-B0536 · seq B1040) صفحة «مراجعة الأسعار والمشتريات»: الفروق تُكشف · «⇐ وحّد» يكتب سعر الجرد في المتجر عبر GMTStoreSync ·
//   «وين راح المشترى»: المُشترى بلا أثر بعد بدء تسجيل المبيعات = فاقد بتفاصيله (الفروع · الفواتير)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const P = await H.call('/rest/v1/products', [
    { name: 'لوح 660 تجربة', barcode: 'PR1', price: 77.4, cost_price: 40, haleb: 3 },
    { name: 'بطارية F550 تجربة', barcode: 'PR2', price: 7.5, cost_price: 3, haleb: 5, daraa: 2 },
    { name: 'شاحن بلا سعر', barcode: 'PR3', price: 0, cost_price: 0, haleb: 4 }]);
  await H.call('/rest/v1/gmt_store', { id: 1, products: [{ id: 's1', inv_id: P[0].id, name: 'لوح 660 تجربة', price: 66.4, options: [] }] });
  await H.call('/rest/v1/invoices', [{ inv_number: 'S-1', branch_key: 'haleb', total: 15, created_at: '2026-04-24T10:00:00Z' }]);
  await H.call('/rest/v1/import_log', [{ inv_number: 'CN-2026-0801', inv_type: 'china', status: 'arrived', transferred: true, arrived_at: '2026-06-01T10:00:00Z', items_snapshot: [{ id: P[1].id, name: 'بطارية F550 تجربة', qty: 20 }] }]);
  const { browser, pg, errs } = await H.open('مراجعة_الأسعار_والمشتريات.html', { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 6000 });
  await pg.waitForSelector('[data-diff]', { timeout: 15000 }).catch(() => {});
  const r1 = await pg.evaluate(() => ({ sum: document.getElementById('pr-sum').innerText, diff: [...document.querySelectorAll('[data-diff]')].map(x => x.innerText.replace(/\s+/g, ' ')), txt: document.getElementById('pr-list').innerText }));
  ok(r1.diff.length === 1 && /66\.40/.test(r1.diff[0]) && /77\.40/.test(r1.diff[0]), 'سعر المتجر 66.4 ≠ الجرد 77.4 يُكشف: ' + r1.diff[0]);
  ok(/شاحن بلا سعر/.test(r1.txt), '«بلا سعر مبيع» يذكر الشاحن (له مخزون)');
  const sync = await pg.evaluate(async () => { const calls = []; GMTStoreSync.queuePrice = (id, p) => calls.push([id, p]); GMTStoreSync.flushPrices = async () => ({ changed: true }); GMTAsk.confirm = async () => true; GMTAsk.alert = async () => true;
    /* (seq B1114) خانة السعر متل الجسر: الشريحة «المتجر» بتعبّي 66.40 · بكتب 80 ⇒ ✓ ⇒ الجرد والمتجر سوا */
    const row = document.querySelector('[data-diff]'), inp = row.querySelector('[data-pin]'); const pre = inp.value;
    row.querySelector('[data-pfill][data-v="66.40"]').click(); const chip = inp.value;
    inp.value = '80'; row.querySelector('[data-pset]').click(); await new Promise(z => setTimeout(z, 800));
    return { calls, pre, chip, ok: row.classList.contains('ok-row') }; });
  ok(sync.pre === '77.40' && sync.chip === '66.40', 'خانة السعر معبّاية بسعر الجرد · الشريحة «المتجر» بتعبّي 66.40: ' + JSON.stringify([sync.pre, sync.chip]));
  ok(sync.calls.length === 1 && sync.calls[0][0] === P[0].id && sync.calls[0][1] === 80 && sync.ok, 'كتبت 80 ⇒ ✓ ⇒ انكتب بالمتجر (80) والصفّ صار ✅: ' + JSON.stringify(sync.calls));
  const d1 = await H.call('/__dump', undefined, 'GET');
  ok(Number(d1.products.find(x => x.id === P[0].id).price) === 80, '…وبالجرد كمان (السعر 80)');
  /* بلا سعر مبيع: اكتب السعر و Enter */
  await pg.evaluate(async () => { const tr = [...document.querySelectorAll('#pr-list tr')].find(t => /شاحن بلا سعر/.test(t.textContent)); const i = tr.querySelector('[data-pin]'); i.value = '15'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await new Promise(z => setTimeout(z, 800)); });
  const d2 = await H.call('/__dump', undefined, 'GET');
  ok(Number(d2.products.find(x => x.name === 'شاحن بلا سعر').price) === 15, '«بلا سعر مبيع»: كتبت 15 وEnter ⇒ صار سعره 15');
  await pg.evaluate(() => document.querySelector('[data-tab="tr"]').click()); await pg.waitForTimeout(400);
  const r2 = await pg.evaluate(() => ({ sum: document.getElementById('tr-sum').innerText, rows: [...document.querySelectorAll('[data-tr]')].map(d => { d.open = true; return d.innerText.replace(/\s+/g, ' '); }) }));
  ok(r2.rows.length === 1 && /بطارية F550 تجربة/.test(r2.rows[0]) && /ناقص 13/.test(r2.rows[0]) && /39\.00\$/.test(r2.rows[0]), '«وين راح»: اشتُري 20 · موجود 7 ⇒ فاقد 13 (×3$ = 39$): ' + (r2.rows[0] || '').slice(0, 120));
  ok(/حلب: 5/.test(r2.rows[0]) && /درعا: 2/.test(r2.rows[0]) && /CN-2026-0801/.test(r2.rows[0]), 'التفاصيل: الموجود بكلّ فرع (حلب 5 · درعا 2) وفاتورة دخوله');
  ok(!errs.filter(e => !/favicon|404|400|406|Failed to load/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
