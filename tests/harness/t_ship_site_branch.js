// (TASK-B0520 · اقتراح المالك ١٨ ت٢) رقم التتبّع يُملأ فوراً، و«المصدر» يُجلب من موقع المفتي بالرقم في الخلفية — لا ينتظر قراءة الإيصال ولا يحجز الإدخال
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون الموقع', phone: '0933000501', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' }]);
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, wait: 4500, init: H.ADMIN_INIT });
  let asked = [];
  await pg.route('**/functions/v1/gmt-mufti', async route => {
    const b = JSON.parse(route.request().postData() || '{}'); asked.push((b.nums || []).join(','));
    await new Promise(r => setTimeout(r, 400));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, out: (b.nums || []).map(n => ({ n, ok: true, found: true, steps: [], level: 1, sender: { desc: 'مجموعة ميديا تك التجارية', info: 'حلب - الفرقان' }, receiver: null, status: 'تم ارسالها إلى مركز تسيير الشحنات' })) }) });
  });
  await pg.evaluate(id => openShipModal(id), o1.id); await pg.waitForTimeout(500);
  const r = await pg.evaluate(async () => {
    const st = document.getElementById('ship-track-auto'), inp = document.getElementById('ship-tracking'), sel = document.getElementById('ship-from');
    syncShipFromBox(null, true);
    const H2 = shipReadHooks(() => true, '', false);
    const t0 = performance.now(); H2.onTracking({ status: 'barcode', number: '243323' });
    const at0 = { track: inp.value, ms: Math.round(performance.now() - t0) };
    await new Promise(r => setTimeout(r, 1500));
    return { at0, from: sel.value, src: sel.getAttribute('data-src'), status: st.innerText.replace(/\s+/g, ' '), box: document.getElementById('ship-from-src').innerText.replace(/\s+/g, ' ') };
  });
  ok(r.at0.track === '243323' && r.at0.ms < 100, 'رقم التتبّع يُملأ فوراً بلا انتظار للفرع: ' + JSON.stringify(r.at0));
  ok(asked[0] === '243323', 'سُئل موقع المفتي بالرقم نفسه: ' + asked.join(' · '));
  ok(r.from === 'حلب|الفرقان' && r.src === 'site', 'الفرع المصدر من الموقع: ' + r.from + ' · ' + r.src);
  ok(/من موقع المفتي/.test(r.status) && /موقع المفتي/.test(r.box), 'مكتوبٌ أنّه من موقع المفتي: ' + r.box);
  /* اختيارك اليدويّ لا يُستبدل */
  const r2 = await pg.evaluate(async () => {
    const sel = document.getElementById('ship-from'), inp = document.getElementById('ship-tracking');
    shipFromFill(sel, 'حلب|السريان'); sel.setAttribute('data-src', 'manual');
    const H3 = shipReadHooks(() => true, '', true); H3.onTracking({ status: 'barcode', number: '243325' });
    await new Promise(r => setTimeout(r, 1500)); return { from: sel.value, src: sel.getAttribute('data-src') };
  });
  ok(r2.from === 'حلب|السريان' && r2.src === 'manual', 'فرعٌ اخترتَه بيدك يبقى: ' + JSON.stringify(r2));
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
