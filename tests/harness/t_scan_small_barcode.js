// (TASK-A0589 · المالك seq A1140) باركودٌ صغير/مغبّش على هاتفٍ متعدّد العدسات:
//  ① اختيار العدسة الرئيسيّة الخلفيّة + دقّة عالية + تبديل + حفظ الاختيار + الزووم  ② «من الصور»: فكٌّ عميق لباركودٍ صغيرٍ مغبّش
//  ③ أرقام الباركود المطبوعة (OCR أرقام) حين تفشل الخطوط  ④ المسح الحيّ ما زال يعمل  ⑤ لا طفح أفقي عند 360px
// التشغيل: MOCK_PORT=8200 BASE_PORT=8301 node t_scan_small_barcode.js  (راجع README)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ean13 = b => { let t = 0; for (let i = 0; i < 12; i++) t += (+b[i]) * (i % 2 ? 3 : 1); return b + (10 - t % 10) % 10; };
const CODE = ean13('629104150021'), CODE2 = ean13('629104150038'), OTHER = ean13('629104150045');

(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('guarantee.html', { w: 360, h: 740, wait: 3500 });
  // كاميرا مزيّفة: مجرى من لوحة (captureStream) + عدستان بأسماء أندرويد · تُسجَّل القيود المطلوبة
  await pg.evaluate(async () => {
    await new Promise((ok, bad) => { if (window.JsBarcode) return ok(); const s = document.createElement('script'); s.src = 'lib/JsBarcode.all.min.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    window.__gum = []; window.__bg = '#fff';
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480; window.__feed = cv;
    const draw = () => { const g = cv.getContext('2d'); g.fillStyle = window.__bg; g.fillRect(0, 0, 640, 480); if (window.__live) { const b = document.createElement('canvas'); JsBarcode(b, window.__live, { format: 'EAN13', width: 4, height: 160, margin: 20, displayValue: true }); g.drawImage(b, (640 - b.width) / 2, 100); } if (window.__tiny) { const b = document.createElement('canvas'); JsBarcode(b, window.__tiny, { format: 'EAN13', width: 1, height: 30, margin: 4, displayValue: false }); g.filter = 'blur(0.7px)'; g.drawImage(b, 320 - b.width * 0.8, 240 - b.height * 0.8, b.width * 1.6, b.height * 1.6); g.filter = 'none'; } requestAnimationFrame(draw); };
    draw();
    const devs = [{ kind: 'videoinput', deviceId: 'ultra1', label: 'camera2 2, facing back ultra wide' }, { kind: 'videoinput', deviceId: 'front1', label: 'camera2 1, facing front' }, { kind: 'videoinput', deviceId: 'main0', label: 'camera2 0, facing back' }];
    navigator.mediaDevices.enumerateDevices = async () => devs.map(d => Object.assign({}, d));
    navigator.mediaDevices.getUserMedia = async c => {
      window.__gum.push(JSON.stringify(c));
      const s = cv.captureStream(20), t = s.getVideoTracks()[0], id = (c.video && c.video.deviceId && c.video.deviceId.exact) || 'ultra1';   // أوّل ما يُمنح الإذن: عدسةٌ عشوائيّة (فائقة الاتّساع)
      t.getSettings = () => ({ deviceId: id, width: 640, height: 480, zoom: 1 });
      t.getCapabilities = () => ({ zoom: { min: 1, max: 5, step: 0.1 }, focusMode: ['continuous', 'manual'] });
      window.__applied = window.__applied || []; t.applyConstraints = async c2 => { window.__applied.push(JSON.stringify(c2)); };
      return s;
    };
    window.__mkImage = async (code, o) => {   // صورة «صوّرتها بعيداً»: ملصق صغير جدّاً وسط مشهدٍ كبير + غبش + ميل خفيف
      const b = document.createElement('canvas'); JsBarcode(b, code, { format: 'EAN13', width: 1, height: o.h || 28, margin: 4, fontSize: 9, displayValue: !!o.digits });
      const W = 2000, Hh = 1500, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
      g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, W, Hh);
      g.save(); g.translate(1000, 780); g.rotate((o.rot || 0) * Math.PI / 180); g.filter = o.blur ? 'blur(' + o.blur + 'px)' : 'none';
      g.imageSmoothingEnabled = true; const k = o.k || 2; g.drawImage(b, -b.width * k / 2, -b.height * k / 2, b.width * k, b.height * k); g.restore();
      if (o.smearBars) { g.fillStyle = '#9a958c'; g.fillRect(1000 - b.width * k / 2 - 5, 780 - b.height * k / 2 - 2, b.width * k + 10, b.height * k * 0.62); }   // الخطوط تالفة · الأرقام سليمة
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92)); return Array.from(new Uint8Array(await blob.arrayBuffer()));
    };
  });
  const fileFor = async (code, o) => ({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(await pg.evaluate(([c, oo]) => window.__mkImage(c, oo), [code, o])) });
  const open = async (opts) => { await pg.evaluate(o => { window.__got = []; window.__close = GMTScan.camera((c, how) => { window.__got.push([c, how]); }, Object.assign({ known: [CODE_A, CODE_B] }, o || {})); }, {}); };
  await pg.evaluate(([a, b]) => { window.CODE_A = a; window.CODE_B = b; }, [CODE, CODE2]);
  const start = async (o) => { await pg.evaluate(o => { window.__got = []; window.__close = GMTScan.camera((c, how) => { window.__got.push([c, how]); return 'ok'; }, Object.assign({ known: [window.CODE_A, window.CODE_B] }, o || {})); }, o || {}); await sleep(1500); };

  // ① العدسة
  await pg.evaluate(() => { try { localStorage.removeItem('gmt_scan_cam'); } catch (e) {} });
  await start();
  const gum = await pg.evaluate(() => window.__gum.slice());
  ok(gum.some(g => /"width":\{"ideal":1920\}/.test(g)) && gum.some(g => /"exact":"main0"/.test(g)), 'دقّة 1920 مطلوبة · وانتقل من العدسة العشوائيّة (فائقة الاتّساع) إلى الرئيسيّة الخلفيّة: ' + gum.length + ' طلب');
  ok(await pg.evaluate(() => window.__applied.some(a => /continuous/.test(a))), 'تركيز مستمرّ (focusMode=continuous) طُبِّق');
  ok(await pg.evaluate(() => { const r = document.querySelector('[data-zrow]'); return r && getComputedStyle(r).display !== 'none' && document.querySelector('[data-zoom]').max === '5'; }), 'شريط الزووم ظهر لأنّ العدسة تدعم zoom');
  await pg.evaluate(() => { const z = document.querySelector('[data-zoom]'); z.value = '3'; z.dispatchEvent(new Event('input')); });
  ok(await pg.evaluate(() => window.__applied.some(a => /"zoom":3/.test(a))), 'تحريك الزووم يطبّق القيد على المسار');
  await pg.click('[data-cyc]'); await sleep(900);
  const cyc = await pg.evaluate(() => [localStorage.getItem('gmt_scan_cam'), window.__gum[window.__gum.length - 1]]);
  ok(cyc[0] && cyc[0] !== 'main0' && cyc[1].indexOf(cyc[0]) > 0, '«🔄 الكاميرا» بدّل العدسة وحفظ الاختيار: ' + cyc[0]);
  await pg.evaluate(() => window.__close());
  await pg.evaluate(() => { localStorage.setItem('gmt_scan_cam', 'front1'); });
  await start(); await sleep(500);
  ok((await pg.evaluate(() => window.__gum[window.__gum.length - 1])).indexOf('"exact":"front1"') > 0, 'الاختيار المحفوظ يُستعاد في الجلسة التالية');
  await pg.evaluate(() => window.__close()); await pg.evaluate(() => localStorage.removeItem('gmt_scan_cam'));

  // ⑤ التخطيط عند 360px
  await start();
  const lay = await pg.evaluate(() => { const u = document.getElementById('gmt-scan-ui'), r = u.getBoundingClientRect(); const bs = [...u.querySelectorAll('button')].map(b => b.getBoundingClientRect()); return { sw: document.documentElement.scrollWidth, usw: u.scrollWidth, w: innerWidth, out: bs.filter(b => b.left < -0.5 || b.right > innerWidth + 0.5).length, n: bs.length }; });
  ok(lay.sw <= lay.w && lay.usw <= lay.w && lay.out === 0 && lay.n === 4, 'لا طفح أفقي عند 360px والأزرار الأربعة داخل الشاشة: ' + JSON.stringify(lay));
  await pg.evaluate(() => window.__close());

  // ④ المسح الحيّ ما زال يعمل (باركود كبير واضح أمام الكاميرا)
  await pg.evaluate(c => { window.__live = c; }, CODE);
  await start();
  await sleep(2500);
  const live = await pg.evaluate(() => window.__got.slice());
  ok(live.length >= 1 && live[0][0] === CODE && live[0][1] === 'camera', 'المسح الحيّ يقرأ باركوداً واضحاً: ' + JSON.stringify(live[0]));
  await pg.evaluate(() => { window.__live = null; try { window.__close(); } catch (e) {} });

  // ②ب «📸 صوّر الباركود»: الفيديو الحيّ فارغ (بعيد جدّاً) لكنّ ImageCapture.takePhoto تعطي لقطةً كاملة الدقّة فيها الباركود الصغير ⇒ يُقرأ
  const still = await pg.evaluate(() => window.__mkImage(window.CODE_A, { k: 2, blur: 0.6 }));
  await pg.evaluate(arr => { window.__takes = 0; window.ImageCapture = class { constructor(t) { this.t = t; } async takePhoto() { window.__takes++; return new Blob([new Uint8Array(arr)], { type: 'image/jpeg' }); } }; }, still);
  await start(); await sleep(600);
  await pg.click('[data-shot]');
  let sh = null; for (let i = 0; i < 60 && !sh; i++) { await sleep(500); sh = await pg.evaluate(() => window.__got[0] || null); }
  ok(sh && sh[0] === CODE && sh[1] === 'camera-photo' && await pg.evaluate(() => window.__takes === 1), '«📸 صوّر الباركود» ⇒ لقطة ImageCapture كاملة ثمّ فكٌّ عميق: ' + JSON.stringify(sh));
  await pg.evaluate(() => { delete window.ImageCapture; try { window.__close(); } catch (e) {} });
  // ... وبلا ImageCapture ⇒ إطار الفيديو بدقّته الأصليّة (باركود واضح هنا ليُقرأ من الإطار)
  await pg.evaluate(c => { window.__tiny = c; }, CODE);
  await start({ continuous: true }); await sleep(600);
  await pg.evaluate(() => { window.__got = []; });
  await pg.click('[data-shot]');
  let sh2 = null; for (let i = 0; i < 60 && !sh2; i++) { await sleep(500); sh2 = await pg.evaluate(() => window.__got.find(g => g[1] === 'camera-photo') || null); }
  ok(sh2 && sh2[0] === CODE, 'بلا ImageCapture ⇒ إطار الفيديو الكامل يُحلَّل أيضاً: ' + JSON.stringify(sh2));
  await pg.evaluate(() => { window.__tiny = null; try { window.__close(); } catch (e) {} });

  // ② «من الصور»: باركود صغير جدّاً (وحدة 1px × تكبير 2 ⇒ ≈190px عرضاً في صورة 2000px) مغبّش ومائل
  for (const [name, o] of [['صغير', { k: 2 }], ['صغير مغبّش', { k: 2, blur: 0.9 }], ['صغير مائل ٤° ومغبّش', { k: 2, blur: 0.8, rot: 4 }]]) {
    await start();
    await pg.setInputFiles('#gmt-scan-ui [data-file]', await fileFor(CODE, o));
    let got = null; for (let i = 0; i < 60 && !got; i++) { await sleep(500); got = await pg.evaluate(() => window.__got[0] || null); }
    ok(got && got[0] === CODE && got[1] === 'photo', '«🖼️ من الصور» · باركود ' + name + ' ⇒ ' + JSON.stringify(got));
    await pg.evaluate(() => { try { window.__close(); } catch (e) {} });
  }

  // ③ الأرقام: الخطوط مطموسة والأرقام المطبوعة سليمة ⇒ مطابقة مع منتجٍ موجود
  await start();
  await pg.setInputFiles('#gmt-scan-ui [data-file]', await fileFor(CODE2, { k: 4, h: 40, digits: true, smearBars: true }));
  let dg = null; for (let i = 0; i < 120 && !dg; i++) { await sleep(500); dg = await pg.evaluate(() => window.__got[0] || null); }
  ok(dg && dg[0] === CODE2, 'الأرقام تحت الباركود (الخطوط تالفة) ⇒ مطابقة المنتج الموجود: ' + JSON.stringify(dg));
  await pg.evaluate(() => { try { window.__close(); } catch (e) {} });

  // مطابقة الأرقام (منطق بحت): تامّة · خطأ رقمٍ واحد وفريد · غموض ⇒ لا قبول · بلا قائمة ⇒ فحص EAN
  const m = await pg.evaluate(([a, b, other]) => {
    const near = a.slice(0, 5) + (a[5] === '9' ? '8' : String(+a[5] + 1)) + a.slice(6);
    return {
      exact: GMTScan.matchDigits(['11111111', a], [b, a]),
      zeros: GMTScan.matchDigits(['0' + a], [a]),
      near: GMTScan.matchDigits([near], [a, b]),
      two: GMTScan.matchDigits([a.slice(0, 5) + '55' + a.slice(7)], [a, b]),
      amb: GMTScan.matchDigits(['12345672'], ['12345678', '12345670', '12345671']),
      none: GMTScan.matchDigits([other], [a, b]),
      ean: GMTScan.matchDigits([a], []), bad: GMTScan.matchDigits([a.slice(0, 12) + (a[12] === '1' ? '2' : '1')], [])
    };
  }, [CODE, CODE2, OTHER]);
  ok(m.exact && m.exact.code === CODE && m.exact.how === 'exact', 'مطابقة تامّة');
  ok(m.zeros && m.zeros.code === CODE, 'إهمال الأصفار البادئة (UPC-A مقابل EAN-13)');
  ok(m.near && m.near.code === CODE && m.near.how === 'near', 'خطأ رقمٍ واحد وفريد ⇒ يُقبل');
  ok(!m.two && !m.amb && !m.none, 'خطآن · أو غموض (أكثر من منتج بفارق رقم) · أو لا شبه ⇒ يُرفض');
  ok(m.ean && m.bad === null, 'بلا قائمة منتجات ⇒ يُقبل ما يجتاز فحص EAN فقط');

  // الصورة بلا باركود ولا رقم ⇒ رسالة فشل والعدسة تبقى مفتوحة
  await start();
  await pg.setInputFiles('#gmt-scan-ui [data-file]', { name: 'e.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(await pg.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#ccc'; g.fillRect(0, 0, 600, 400); const b = await new Promise(r => c.toBlob(r, 'image/jpeg')); return Array.from(new Uint8Array(await b.arrayBuffer())); })) });
  let failMsg = ''; for (let i = 0; i < 120 && !/لم أجد/.test(failMsg); i++) { await sleep(500); failMsg = await pg.evaluate(() => (document.querySelector('#gmt-scan-ui [data-msg]') || {}).textContent || ''); }
  ok(/لم أجد/.test(failMsg) && await pg.evaluate(() => !!document.getElementById('gmt-scan-ui') && !window.__got.length), 'صورة فارغة ⇒ «لم أجد…» والنافذة مفتوحة للمحاولة: ' + failMsg.slice(0, 40));
  await pg.evaluate(() => { try { window.__close(); } catch (e) {} });

  const real = errs.filter(e => !/Failed to load resource|status of (400|401|404)/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
