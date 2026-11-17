// (VER-3#REQ-0323 · VER-3#REQ-0318 · VER-4#REQ-0382) توحيد صيغ الهاتف على GMTPhone + سعر الصرف من GMT_DEFAULT_RATE
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const o = await H.open('orders.html', { wait: 3000 });
  const r = await o.pg.evaluate(() => ({
    local: ['0933000001', '+963933000001', '00963933000001', '963933000001', '٠٩٣٣٠٠٠٠٠١'].map(normalizePhone),
    sy09: ['933000001', '+963 933 000 001', 'abc'].map(GMTPhone.sy09),
    wa: ['0933000001', '+971501234567', '933000001'].map(GMTPhone.wa),
  }));
  ok(r.local.every(x => x === '0933000001'), 'normalizePhone عبر GMTPhone.local: ' + JSON.stringify(r.local));
  ok(r.sy09[0] === '0933000001' && r.sy09[1] === '0933000001' && r.sy09[2] === '', 'sy09');
  ok(JSON.stringify(r.wa) === JSON.stringify(['963933000001', '971501234567', '963933000001']), 'wa: ' + JSON.stringify(r.wa));
  const src = await o.pg.evaluate(() => fetch('orders.html').then(x => x.text()));
  ok(!/GMT_RATE\b/.test(src.replace(/GMT_DEFAULT_RATE/g, '')), 'لا بقاء لـGMT_RATE غير المعرّف في orders.html');
  ok(typeof (await o.pg.evaluate(() => window.GMT_DEFAULT_RATE)) === 'number', 'GMT_DEFAULT_RATE معرّف');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
