// (22 ت1 · TASK-0118) قراءة إيصال المفتي أسرع — المالك: «عم يطوّل كثير… طلبت فقط رقم التتبع والفرع المصدر»
// ① رقم الباركود يُبلَّغ ويُملأ قبل انتهاء القراءة ② اتّجاه الإيصال من رمز QR ⇐ قراءةٌ عربية واحدة حتى لو كانت الصورة مدوّرة
// ③ الباركود مقروء ⇒ لا قراءة أرقام للصفحة كلّها ④ الفرع يُعتمد فور قراءته ⑤ لا اسم ولا هاتف في الواجهة
const H = require('./h.js'), fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const src = fs.readFileSync(__dirname + '/t_mufti_read.js', 'utf8');
const SYNTH = src.slice(src.indexOf('const SYNTH = `') + 15, src.indexOf('};`;') + 2);
const ROT = `window.__rot = function (cv, deg) { const o = document.createElement('canvas'), q = deg % 180 !== 0;
  o.width = q ? cv.height : cv.width; o.height = q ? cv.width : cv.height; const c = o.getContext('2d');
  c.translate(o.width / 2, o.height / 2); c.rotate(deg * Math.PI / 180); c.drawImage(cv, -cv.width / 2, -cv.height / 2); return o; };`;
(async () => {
  await H.seed();
  const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون سرعة', phone: '0933000402', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' }]);
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, wait: 4500, init: H.ADMIN_INIT + SYNTH + ROT });
  await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });

  // وحدة: اتّجاه الإيصال من QR لكل الدورانات
  for (const deg of [0, 90, 180, 270]) {
    const r = await pg.evaluate(async (deg) => {
      const cv = __rot(__rcpt({ qr: '0451200', src: 'حلب-الفرقان' }), deg), blob = await new Promise(z => cv.toBlob(z, 'image/jpeg', 0.92));
      const tr = [], st = [], t0 = performance.now(); let trackAt = null, branchAt = null;
      const x = await GMTReceipt.readMufti(blob, { trace: tr, onStage: k => st.push(k), onTracking: () => { trackAt = performance.now() - t0; }, onBranch: () => { branchAt = performance.now() - t0; } });
      return { ms: performance.now() - t0, trackAt, branchAt, up: (tr[0] || {}).upright, passes: tr.filter(t => t.mode && !/mark/.test(t.mode)).length, st, t: x.tracking, b: x.branch && x.branch.key, type: x.type.kind };
    }, deg);
    const want = (360 - deg) % 360;
    ok(r.up === want, `مدوّر ${deg}° ⇒ اتّجاه QR ${r.up} (المتوقّع ${want})`);
    ok(r.passes === 1 && r.b === 'حلب|الفرقان', `مدوّر ${deg}° ⇒ قراءةٌ عربية واحدة والفرع الفرقان (${r.passes} · ${r.b})`);
    ok(r.t.status === 'barcode' && r.t.number === '0451200' && r.st.indexOf('digits') === -1, `مدوّر ${deg}° ⇒ الرقم من الباركود بلا قراءة أرقام الصفحة (${r.st.join('›')})`);
    ok(r.trackAt != null && r.trackAt < r.ms - 300 && r.branchAt != null, `مدوّر ${deg}° ⇒ الرقم وصل مبكراً ${Math.round(r.trackAt)}ms من ${Math.round(r.ms)}ms`);
  }

  // (TASK-0120) الفرع من خانة «المصدر» وحدها — مع QR وبدونه (الخانة تُجرَّب في كل اتّجاه قبل أيّ صفحةٍ كاملة)
  for (const [spec, deg, why] of [[{ qr: '0451202', src: 'حلب-السريان' }, 90, 'مع QR'], [{ printed: '0451203', src: 'حلب-الفرقان' }, 0, 'بلا QR'], [{ printed: '0451204', src: 'حلب-الفرقان' }, 90, 'بلا QR ومدوّر']]) {
    const r = await pg.evaluate(async ([spec, deg]) => {
      const cv = __rot(__rcpt(spec), deg), blob = await new Promise(z => cv.toBlob(z, 'image/jpeg', 0.92));
      const tr = []; const x = await GMTReceipt.readMufti(blob, { trace: tr });
      const reads = tr.filter(t => t.mode && !/mark/.test(t.mode));
      return { modes: reads.map(t => t.mode), hit: (reads.find(t => t.conf) || {}).mode, b: x.branch && x.branch.key, type: x.type.kind };
    }, [spec, deg]);
    ok(r.b === 'حلب|' + spec.src.split('-')[1] && /\/cell$/.test(r.hit || '') && r.modes.every(m => /\/cell$/.test(m)), `${why}: الفرع من الخانة وحدها، بلا صفحةٍ كاملة (${r.modes.join(' › ')} ⇒ ${r.b})`);
  }

  // الواجهة: الرقم يظهر في الحقل أثناء القراءة، ثمّ الفرع
  await pg.evaluate(id => openShipModal(id), o1.id); await pg.waitForTimeout(500);
  const u = await pg.evaluate(async () => {
    const cv = __rot(__rcpt({ qr: '0451201', src: 'حلب-الفرقان' }), 90), blob = await new Promise(z => cv.toBlob(z, 'image/jpeg', 0.92));
    document.getElementById('ship-tracking').value = ''; _shipRcptAuto = false; _shipScan = null; syncShipFromBox(null, true);
    _shipRcptFile = new File([blob], 'r.jpg', { type: 'image/jpeg' });
    const p = shipReadTracking(); let early = null, brSt = null;
    for (let i = 0; i < 400 && (early == null || brSt == null); i++) {
      await new Promise(z => setTimeout(z, 25));
      if (early == null && _shipReading && document.getElementById('ship-tracking').value) early = document.getElementById('ship-tracking').value;
      const t = document.getElementById('ship-track-auto').innerText; if (brSt == null && _shipReading && /الفرع المصدر: /.test(t)) brSt = t.replace(/\s+/g, ' ');
    }
    await p;
    const st = document.getElementById('ship-track-auto');
    return { early, brSt, track: document.getElementById('ship-tracking').value, from: document.getElementById('ship-from').value, srcAttr: document.getElementById('ship-from').getAttribute('data-src'), status: st.innerText.replace(/\s+/g, ' ') };
  });
  ok(u.early === '0451201', 'الرقم يُملأ في الحقل والقراءة ما زالت جارية: ' + u.early);
  ok(/الفرع المصدر: حلب – الفرقان/.test(u.brSt || ''), 'الفرع يظهر في سطر الحالة فور قراءته: ' + (u.brSt || '').slice(0, 80));
  ok(u.track === '0451201' && u.from === 'حلب|الفرقان' && u.srcAttr === 'receipt', 'بعد الانتهاء: الرقم باقٍ والفرع من الإيصال: ' + u.from);
  ok(!/المرسل|الموبايل|0939773715|أحمد خالد|مجموعة/.test(u.status), 'لا اسم ولا هاتف معروض: ' + u.status.slice(0, 90));
  const real = errs.filter(e => !/status of (400|503)/.test(e) && !/Estimating resolution|Detected \d+ diacritics|boxClipToRectangle|pixScanForForeground/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
