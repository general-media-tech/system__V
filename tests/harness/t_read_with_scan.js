// (22 ت1 · TASK-0126) المالك: «شغّل القراءة مع المسح لتوفير الوقت» — القراءة تبدأ لحظة يكتشف الماسح الحدود (والماسح مفتوح)،
// فيُملأ الرقم والفرع خلفه، وعند «اعتماد» لا قراءة ثانية إن كفت الأولى. وما نقصها يُقرأ من النسخة الممسوحة ويُدمج.
// (23 ت1 · TASK-0130) المالك: «القراءة تبلش قبل المسح… كل وحدة منفصلة وبيشتغلو سوا» — القراءة تبدأ مع اختيار الصورة قبل ظهور الماسح
// (الباركود في عامله فوراً)، والفرع يأخذ حدود الورقة من الماسح لحظة اكتشافها (opts.geom).
const H = require('./h.js'), fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const src = fs.readFileSync(__dirname + '/t_mufti_read.js', 'utf8');
const SYNTH = src.slice(src.indexOf('const SYNTH = `') + 15, src.indexOf('};`;') + 2);
const FILE = '/tmp/gmt-out/read-with-scan.jpg', FILE2 = '/tmp/gmt-out/read-with-scan-noqr.jpg';
(async () => {
  await H.seed();
  const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون مسح وقراءة', phone: '0933000412', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' }]);
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, wait: 4500, init: H.ADMIN_INIT + SYNTH });
  await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });
  // صورة «هاتف»: الإيصال على خلفيةٍ داكنة بميلٍ خفيف
  for (const [f, spec] of [[FILE, { qr: '0451400', src: 'حلب-الفرقان' }], [FILE2, { printed: '0451401', src: 'حلب-الفرقان' }]]) {
    const b64 = await pg.evaluate(spec => { const r = __rcpt(spec), c = document.createElement('canvas'); c.width = 1900; c.height = 1200; const x = c.getContext('2d');
      x.fillStyle = '#2b2f36'; x.fillRect(0, 0, c.width, c.height); x.translate(950, 600); x.rotate(0.05); x.drawImage(r, -750, -380); return c.toDataURL('image/jpeg', 0.92).split(',')[1]; }, spec);
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  }
  await pg.evaluate(() => { const R = GMTReceipt.readMufti; window.__reads = []; GMTReceipt.readMufti = function (f, o) {
    const e = { at: performance.now(), early: !!(o && (o.geom || 'corners' in o)), geom: !!(o && o.geom), scannerShown: !!document.getElementById('gds'), gotCorners: null }; __reads.push(e);
    if (o && o.geom) { const g0 = o.geom; o = Object.assign({}, o, { geom: () => g0().then(g => { e.gotCorners = !!(g && g.corners && g.img); return g; }) }); }
    return R.call(this, f, o); }; });

  await pg.evaluate(id => openShipModal(id), o1.id); await pg.waitForTimeout(500);
  await pg.setInputFiles('#ship-img-input', FILE);
  await pg.waitForSelector('#gds', { timeout: 8000 });
  // ننتظر والماسح مفتوح — لا ضغط
  let mid = null;
  for (let i = 0; i < 60; i++) { await pg.waitForTimeout(250); mid = await pg.evaluate(() => ({ open: !!document.getElementById('gds'), track: document.getElementById('ship-tracking').value, from: document.getElementById('ship-from').value, src: document.getElementById('ship-from').getAttribute('data-src'), reads: __reads.slice() })); if (mid.track && mid.src === 'receipt') break; }
  ok(mid.open && mid.reads.length === 1 && mid.reads[0].geom && !mid.reads[0].scannerShown && mid.reads[0].gotCorners, 'القراءة بدأت مع اختيار الصورة قبل ظهور الماسح، وأخذت حدود الورقة من الماسح: ' + JSON.stringify(mid.reads.map(r => ({ geom: r.geom, beforeScanner: !r.scannerShown, corners: r.gotCorners }))));
  ok(mid.open && mid.track === '0451400' && mid.from === 'حلب|الفرقان' && mid.src === 'receipt', 'الرقم والفرع مُلئا خلف الماسح قبل «اعتماد»: ' + mid.track + ' · ' + mid.from);
  // الآن: قصّ ⇒ اعتماد ⇒ النتيجة فوراً بلا قراءة ثانية
  await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /قصّ وتحسين/.test(b.textContent)).click());
  await pg.waitForFunction(() => [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)), null, { timeout: 15000 });
  const t0 = await pg.evaluate(() => { [...document.querySelectorAll('#gds .gds-bar button')].find(b => /اعتماد/.test(b.textContent)).click(); return performance.now(); });
  await pg.waitForFunction(() => !_shipReading && _shipRead, null, { timeout: 30000 }).catch(() => {});
  const fin = await pg.evaluate(t0 => ({ ms: Math.round(performance.now() - t0), reads: __reads.length, status: document.getElementById('ship-track-auto').innerText.replace(/\s+/g, ' '), track: document.getElementById('ship-tracking').value, from: document.getElementById('ship-from').value, rt: _shipRead && _shipRead.tracking }), t0);
  ok(fin.reads === 1 && fin.ms < 1500, 'بعد «اعتماد» النتيجة جاهزة بلا قراءةٍ ثانية: ' + fin.ms + 'ms · قراءات ' + fin.reads);
  ok(fin.track === '0451400' && fin.from === 'حلب|الفرقان' && /0451400/.test(fin.status), 'النتيجة النهائية: ' + fin.status.slice(0, 80));

  // بلا QR (رقمٌ مطبوع فقط): المبكرة لا تجد الرقم بالباركود ⇒ إكمالٌ من الممسوحة ودمج — والفرع من المبكرة يبقى
  await pg.evaluate(() => { __reads.length = 0; });
  await pg.evaluate(id => openShipModal(id), o1.id); await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('ship-tracking').value = ''; _shipRcptAuto = false; });
  await pg.setInputFiles('#ship-img-input', FILE2);
  await pg.waitForSelector('#gds', { timeout: 8000 });
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /قصّ وتحسين/.test(b.textContent)).click());
  await pg.waitForFunction(() => [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)), null, { timeout: 15000 });
  await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /اعتماد/.test(b.textContent)).click());
  await pg.waitForFunction(() => !_shipReading && _shipRead, null, { timeout: 60000 }).catch(() => {});
  const nq = await pg.evaluate(() => ({ reads: __reads.map(r => r.early), rt: _shipRead && _shipRead.tracking, from: document.getElementById('ship-from').value, branch: _shipRead && _shipRead.branch && _shipRead.branch.key }));
  ok(nq.reads[0] === true && nq.branch === 'حلب|الفرقان' && nq.from === 'حلب|الفرقان', 'بلا QR: الفرع من القراءة المبكرة (' + nq.branch + ') · القراءات: ' + JSON.stringify(nq.reads));
  ok(nq.rt && nq.rt.status === 'printed' && (nq.rt.candidates || [nq.rt.number]).includes('0451401'), 'بلا QR: الرقم المطبوع مقروء ومعروضٌ للتأكيد: ' + JSON.stringify(nq.rt));

  // شركةٌ أخرى ⇒ لا قراءة مبكرة
  await pg.evaluate(() => { __reads.length = 0; });
  await pg.evaluate(id => openShipModal(id), o1.id); await pg.waitForTimeout(400);
  await pg.selectOption('#ship-company', { index: 2 }).catch(() => {});
  await pg.setInputFiles('#ship-img-input', FILE);
  await pg.waitForSelector('#gds', { timeout: 8000 }); await pg.waitForTimeout(1500);
  const other = await pg.evaluate(() => ({ comp: document.getElementById('ship-company').value, reads: __reads.length }));
  ok(other.comp !== 'المفتي' && other.reads === 0, 'شركةٌ أخرى (' + other.comp + ') ⇒ لا قراءة مع المسح');
  await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /إلغاء/.test(b.textContent)).click());

  // إيقاف قراءةٍ جارية (أُغلق الماسح قبل انتهائها): تعود سريعاً بما وجدته
  const cx = await pg.evaluate(async () => {
    const blob = await new Promise(r => __rcpt({ printed: '0451402', src: 'حلب-السريان' }).toBlob(r, 'image/jpeg', 0.92));
    const full = performance.now(); await GMTReceipt.readMufti(blob); const fullMs = performance.now() - full;
    let stop = false; const t0 = performance.now(); setTimeout(() => { stop = true; }, 150);
    const x = await GMTReceipt.readMufti(blob, { cancel: () => stop });
    return { fullMs: Math.round(fullMs), ms: Math.round(performance.now() - t0), cancelled: !!x.cancelled, t: x.tracking && x.tracking.status };
  });
  ok(cx.ms < cx.fullMs, 'إيقاف قراءةٍ جارية يعيدها أسرع من إكمالها (' + cx.ms + 'ms مقابل ' + cx.fullMs + 'ms) · ناقصة: ' + cx.cancelled);
  const real = errs.filter(e => !/status of (400|503)/.test(e) && !/Estimating resolution|Detected \d+ diacritics|boxClipToRectangle|pixScanForForeground/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
