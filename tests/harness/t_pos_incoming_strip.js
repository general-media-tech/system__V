// (TASK-B0392 · المالك seq B691 — اقتراح ٩) شريطٌ واضح في نقطة البيع لفواتير النقل/التسوية الواردة المعلّقة (كان زرّاً صغيراً فبقيت TRF-00015 أيّاماً)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const d3 = new Date(Date.now() - 3 * 864e5).toISOString();
  await H.call('/rest/v1/branch_stock_transfers', { transfer_number: 'TRF-90001', from_branch: 'rebuild', from_branch_name: 'تسوية', to_branch: 'daraa', to_branch_name: 'درعا', status: 'pending', created_at: d3 });
  const o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, h: 844, mobile: true, wait: 7000 });
  const s1 = await o.pg.evaluate(() => { const s = document.getElementById('inc-trf-strip'); return s && s.style.display !== 'none' ? s.innerText.replace(/\s+/g, ' ') : null; });
  ok(s1 && /1 فاتورة نقل\/تسوية بانتظار استلام فرعك/.test(s1) && /أقدمها منذ 3 أيام/.test(s1), '① شريطٌ واضح: فاتورة واحدة بانتظار الاستلام · أقدمها منذ 3 أيام: ' + s1);
  await o.pg.click('#inc-strip-go'); await o.pg.waitForTimeout(800);
  const ov = await o.pg.evaluate(() => { const v = document.getElementById('inc-trf-ov'); return v && v.style.display === 'flex' && /TRF-90001/.test(v.innerText); });
  ok(ov, '② «استلم الآن» يفتح نافذة الوارد وفيها الفاتورة');
  await o.pg.evaluate(() => { document.getElementById('inc-trf-ov').style.display = 'none'; });
  await o.pg.click('#inc-strip-later');
  const hid = await o.pg.evaluate(async () => { await loadIncomingTransfers(); const s = document.getElementById('inc-trf-strip'); return !s || s.style.display === 'none'; });
  ok(hid, '③ «لاحقاً» يخفيه لليوم (ولا يعود بإعادة التحميل)');
  await H.call('/rest/v1/branch_stock_transfers', { transfer_number: 'TRF-90002', from_branch: 'homs', from_branch_name: 'حمص', to_branch: 'daraa', to_branch_name: 'درعا', status: 'pending', created_at: new Date().toISOString() });
  const s2 = await o.pg.evaluate(async () => { await loadIncomingTransfers(); const s = document.getElementById('inc-trf-strip'); return s && s.style.display !== 'none' ? s.innerText.replace(/\s+/g, ' ') : null; });
  ok(s2 && /2 فواتير نقل\/تسوية/.test(s2), '④ وصول فاتورة جديدة يعيد إظهاره: ' + s2);
  const real = o.errs.filter(x => !/status of (400|401|404|406|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
