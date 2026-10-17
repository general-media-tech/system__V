const H = require('./h.js');
(async () => {
  await H.seed();
  const orders = [{ name: 'زبون الشحن', phone: '0999000000', product: 'كاميرا تجربة 2', qty: 1, price: 102, status: 'prepared', branch: 'حلب', address: 'حلب' }];
  const o = await H.call('/rest/v1/gmt_orders', orders);
  const { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 390, h: 800, wait: 5000 });
  await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js' }).catch(() => {});
  await pg.addScriptTag({ url: H.BASE + 'lib/JsBarcode.all.min.js' }).catch(() => {});
  // يبني «إيصالاً» صناعياً: ورقة بيضاء كبيرة + نصّ + رمز صغير بالزاوية، ثم يديرها ٩٠° كما في صورة الهاتف
  const build = async (kind, payload, rotDeg, size) => pg.evaluate(async ({ kind, payload, rotDeg, size }) => {
    const W = 1200, Hh = 1700; const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#222'; c.font = 'bold 40px sans-serif';
    for (let i = 0; i < 18; i++) c.fillText('شركة المفتي للنقل — سطر نص تجريبي ' + i + ' 0933' + (100000 + i * 777), 80, 400 + i * 55);
    const sv = new ZXing.BrowserQRCodeSvgWriter();
    if (kind === 'qr') {
      const svg = sv.write(payload, size, size); const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      c.fillStyle = '#fff'; c.fillRect(70, 70, size + 20, size + 20); c.drawImage(im, 80, 80, size, size);
    } else {
      const t = document.createElement('canvas'); JsBarcode(t, payload, { format: 'CODE128', width: 3, height: 140, displayValue: false, margin: 12 });
      c.drawImage(t, 100, 120);
    }
    // تدوير
    const r = document.createElement('canvas'); const turned = rotDeg % 180 !== 0; r.width = turned ? Hh : W; r.height = turned ? W : Hh;
    const rc = r.getContext('2d'); rc.translate(r.width / 2, r.height / 2); rc.rotate(rotDeg * Math.PI / 180); rc.drawImage(cv, -W / 2, -Hh / 2);
    // ضغط تقريبي كصورة جوال
    const blob = await new Promise(ok => r.toBlob(ok, 'image/jpeg', 0.7));
    const f = new File([blob], 'rcpt.jpg', { type: 'image/jpeg' }); window.__f = f; return { w: r.width, h: r.height, kb: Math.round(blob.size / 1024) };
  }, { kind, payload, rotDeg, size });
  const read = async () => pg.evaluate(async () => { const t0 = performance.now(); const r = await GMTReceipt.readTracking(window.__f); return { number: r.number, how: r.how, raw: r.raw, tries: r.tries, ms: Math.round(performance.now() - t0) }; });

  const cases = [['qr', '196682', 0, 220], ['qr', '196682', 90, 160], ['qr', 'https://tracking.example.com/t?awb=7345512&lang=ar', 90, 200], ['code128', '196682', 0], ['code128', '196682', 90], ['qr', 'هذا نص بلا أرقام', 0, 220]];
  for (const [k, p, rot, sz] of cases) {
    const info = await build(k, p, rot, sz || 0); const r = await read();
    console.log(`${k} "${p.slice(0, 34)}" rot=${rot} ${info.w}x${info.h} ${info.kb}KB =>`, JSON.stringify(r));
  }
  // مسار الواجهة: افتح نافذة الشحن، اختر المفتي، ارفع الصورة ⇒ يملأ الحقل
  await build('qr', '196682', 90, 180);
  const id = o[0].id;
  await pg.evaluate((id) => openShipModal(id), id);
  await pg.selectOption('#ship-company', 'المفتي');
  await pg.evaluate(() => { const dt = new DataTransfer(); dt.items.add(window.__f); const inp = document.getElementById('ship-img-input'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForFunction(() => document.getElementById('ship-tracking').value !== '' || /لم أستطع|تعذّر/.test(document.getElementById('ship-track-auto').textContent), null, { timeout: 15000 }).catch(() => {});
  console.log('UI:', JSON.stringify(await pg.evaluate(() => ({ track: document.getElementById('ship-tracking').value, status: document.getElementById('ship-track-auto').textContent }))));
  // شركة غير المفتي ⇒ لا قراءة
  await pg.evaluate((id) => openShipModal(id), id);
  await pg.selectOption('#ship-company', 'مسارات');
  await pg.evaluate(() => { const dt = new DataTransfer(); dt.items.add(window.__f); const inp = document.getElementById('ship-img-input'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(1500);
  console.log('غير المفتي:', JSON.stringify(await pg.evaluate(() => ({ track: document.getElementById('ship-tracking').value, status: document.getElementById('ship-track-auto').textContent }))));
  // رقم كتبه الموظف لا يُمسح
  await pg.evaluate((id) => openShipModal(id), id);
  await pg.selectOption('#ship-company', 'المفتي'); await pg.fill('#ship-tracking', '555');
  await pg.evaluate(() => { const dt = new DataTransfer(); dt.items.add(window.__f); const inp = document.getElementById('ship-img-input'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(2500);
  console.log('رقم يدوي محفوظ:', JSON.stringify(await pg.evaluate(() => ({ track: document.getElementById('ship-tracking').value }))));
  console.log('errors:', errs.slice(0, 4));
  await browser.close();
})();
