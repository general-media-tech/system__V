// (طابور سونيت · الطباعة) ARC-MD-04#45 · ARC-MD-11#248 — QR محلّي بلا إنترنت في بطاقات السعر/الملصق المخصّص بالجرد
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const o = await H.open('inventory.html', { w: 1366, h: 900, mobile: false, wait: 3500 });
  const ext = []; o.pg.on('request', r => { if (/qrserver/.test(r.url())) ext.push(r.url()); });
  const r = await o.pg.evaluate(async () => {
    const d = await localQRDataUrl('123456789', 80);
    const c = document.createElement('canvas'); c.width = c.height = 80; document.body.appendChild(c);
    await renderQRToCanvas(c, '123456789'); await new Promise(r => setTimeout(r, 300));
    const px = c.getContext('2d').getImageData(0, 0, 80, 80).data; let dark = 0, light = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i] < 60 && px[i + 3] > 200) dark++; else if (px[i] > 200) light++; }
    const f = await fetchQRDataUrl('x', 80);
    return { png: /^data:image\/png/.test(d || ''), dark, light, f: /^data:image\/png/.test(f || ''), empty: await localQRDataUrl('', 80) };
  });
  ok(r.png, 'localQRDataUrl ⇒ صورة PNG محلّية');
  ok(r.dark > 300 && r.light > 300, 'رسم QR على اللوحة (مربّعات داكنة وفاتحة): ' + r.dark + '/' + r.light);
  ok(r.f && r.empty === null, 'fetchQRDataUrl محلّية وقيمةٌ فارغة ⇒ null');
  ok(ext.length === 0, 'لا طلب لخدمة خارجية: ' + ext.length);
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|vibrate|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
