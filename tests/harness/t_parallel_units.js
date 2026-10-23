// (23 ت1 · TASK-0130) المالك: «رجاع خليه أسرع بكتير وأدقّ… تشغلهم كلهم بالتوازي: قراءة الرقم والفرع والمسح، كل وحدة منفصلة
// وبيشتغلو سوا… القراءة تبلش قبل المسح» — صور المالك الحقيقيّة (٢٧) كشفت أيضاً أخطاء دقّة. هذا الاختبار بصورٍ مُصطنعة فقط
// (صور الإيصالات فيها بيانات زبائن ⇒ لا تُحفظ في المستودع):
//   ① الباركود في عاملٍ مستقلّ: النتيجة نفسها، والخيط الرئيسي لا يُحجز
//   ② خانةٌ تُقوَّم وحدها (processBox) = الخانة نفسها من النسخة الكاملة
//   ③ مطابقة الفرع: كلمةٌ قسمها القارئ («السرر يان») لا تُعتمد «الباب» · هاتف مكتبٍ بخانةٍ ناقصة ليس «شركةً أخرى»
//   ④ الاكتشاف: إيصالٌ يتجاوز الإطار وبجانبه ورقةٌ أخرى ⇒ حدوده هو (كانت تُضمّ الورقة الأخرى)
//   ⑤ بلا QR ومدوَّر: الرقم المطبوع يُقرأ من قصّة أعلى اليمين
const H = require('./h.js'), fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const src = fs.readFileSync(__dirname + '/t_mufti_read.js', 'utf8');
const SYNTH = src.slice(src.indexOf('const SYNTH = `') + 15, src.indexOf('};`;') + 2);
const GEN = fs.readFileSync(__dirname + '/docscan_gen.js', 'utf8');
const ROT = `window.__rot = function (cv, deg) { const o = document.createElement('canvas'), q = deg % 180 !== 0;
  o.width = q ? cv.height : cv.width; o.height = q ? cv.width : cv.height; const c = o.getContext('2d');
  c.translate(o.width / 2, o.height / 2); c.rotate(deg * Math.PI / 180); c.drawImage(cv, -cv.width / 2, -cv.height / 2); return o; };`;
(async () => {
  // عدّاد العمّال قبل أن ينشئ أحدٌ عاملاً
  const { browser, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, wait: 4000, mobile: false,
    init: H.ADMIN_INIT + SYNTH + ROT + 'window.__W = 0; const __W0 = window.Worker; window.Worker = function (u, o) { if (/gmt-receipt/.test(String(u))) __W++; return new __W0(u, o); };' });
  await pg.addScriptTag({ content: GEN });
  await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });     // مولّد الإيصال المُصطنع يرسم الـQR بها

  // ① الباركود في العامل
  const w = await pg.evaluate(async () => {
    const cv = __rot(__rcpt({ qr: '0461300', src: 'حلب-الفرقان' }), 90), blob = await new Promise(z => cv.toBlob(z, 'image/jpeg', 0.92));
    let gap = 0, last = performance.now(), on = true; const tick = () => { const n = performance.now(); gap = Math.max(gap, n - last); last = n; if (on) setTimeout(tick, 5); }; tick();
    const a = await GMTReceipt.readTracking(blob, { ocr: false, quick: true }); const gA = gap; gap = 0; last = performance.now();
    const b = await GMTReceipt.readTracking(blob, { ocr: false, quick: true, worker: false }); const gB = gap; on = false;
    return { a: a.number, ua: a.upright, b: b.number, ub: b.upright, gA: Math.round(gA), gB: Math.round(gB), workers: window.__W };
  });
  ok(w.workers >= 1 && w.a === '0461300' && w.a === w.b && w.ua === w.ub, `① الباركود في عاملٍ مستقلّ: الرقم والاتّجاه كالصفحة (${w.a}/${w.ua}° = ${w.b}/${w.ub}°) · عمّال ${w.workers}`);
  ok(w.gA < 120, `① الخيط الرئيسي لا يُحجز أثناء قراءة العامل (أطول توقّف ${w.gA}ms · في الصفحة ${w.gB}ms)`);

  // ② الخانة وحدها = الخانة من النسخة الكاملة (هندسةً: ارتباطٌ عالٍ بين الصورتين)
  const pb = await pg.evaluate(() => {
    const c = __mkCase({ bg: 'dark', quad: [[.12, .2], [.9, .16], [.93, .78], [.1, .82]], W: 1400, H: 1000 }, __rcpt({ qr: '0461301', src: 'حلب-السريان' }));
    const det = GMTDocScan.detectNorm(c.cv, 0), full = GMTDocScan.process(c.cv, det.corners, 0, 'color'), box = [0.38, 0.36, 1, 0.72];
    const b = GMTDocScan.processBox(c.cv, det.corners, box, 'color'), x0 = Math.round(box[0] * full.width), y0 = Math.round(box[1] * full.height);
    const A = full.getContext('2d').getImageData(x0, y0, b.width, b.height).data, B = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
    let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0; for (let i = 0; i < A.length; i += 16) { const a = A[i], v = B[i]; n++; sa += a; sb += v; saa += a * a; sbb += v * v; sab += a * v; }
    const cov = sab / n - (sa / n) * (sb / n), r = cov / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2));
    const G = GMTDocScan.rectGeom(c.cv, det.corners);
    return { r: +r.toFixed(3), same: G.w === full.width && G.h === full.height, dims: b.width + 'x' + b.height };
  });
  ok(pb.same && pb.r >= 0.9, `② خانةٌ مقوَّمة وحدها = الخانة نفسها من النسخة الكاملة (ارتباط ${pb.r} · ${pb.dims})`);

  // ③ المطابقة
  const m = await pg.evaluate(() => [['حلب-السررٍ يان', 'حلب|السريان'], ['حلب_المير يان 8_8', null], ['حلب-يان', null], ['حلب-الباب', 'حلب|الباب'], ['حلب الباب', 'حلب|الباب'], ['دمشق-القدم', 'دمشق|القدم'], ['حلب-السر يان', 'حلب|السريان']]
    .map(([t, want]) => { const r = GMTReceipt._matchBranch(t); return { t, want, got: r.confident ? r.key : null }; }));
  m.forEach(x => ok(x.got === x.want, `③ «${x.t}» ⇒ ${x.got || 'غير مؤكَّد'}`));
  const ff = await pg.evaluate(() => ({ trunc: GMTReceipt._foreignFooter('ا 065112157 -حمص. 06 اسم و توقيع المرسل'), other: GMTReceipt._foreignFooter('هاتف 0933123456 شركة') }));
  ok(ff.trunc === false && ff.other === true, `③ تذييلٌ بهاتف مكتبٍ للمفتي بخانةٍ ناقصة ليس «شركةً أخرى» (${ff.trunc}) · وهاتفٌ غريب كذلك (${ff.other})`);

  // ④ الاكتشاف: إيصالٌ يتجاوز الإطار يساراً وورقةٌ أخرى تلامس ركنه
  for (const [bg, stack] of [['dark', [[0.82, 0.64], [0.99, 0.60], [0.99, 0.80], [0.86, 0.82]]], ['keyboard', [[0.84, 0.65], [1.0, 0.62], [1.0, 0.78], [0.88, 0.80]]]]) {
    const r = await pg.evaluate(([bg, stack]) => { const c = __mkCase({ bg, stack, quad: [[-0.1, 0.3], [0.93, 0.32], [0.95, 0.66], [-0.1, 0.68]] }, __thermal(false)), d = GMTDocScan.detectNorm(c.cv, 0); return { how: d.how, err: __err(d.corners, c.gt) }; }, [bg, stack]);
    ok(r.err.e <= 0.03 && r.err.cut <= 0.015, `④ (${bg}) إيصالٌ يتجاوز الإطار وورقةٌ أخرى تلامسه ⇒ حدوده هو: خطأ ${(r.err.e * 100).toFixed(1)}٪ · قصّ ${(r.err.cut * 100).toFixed(1)}٪ (${r.how})`);
  }

  // ⑤ بلا QR ومدوَّر ٢٧٠°: الرقم المطبوع من قصّة أعلى اليمين
  const pr = await pg.evaluate(async () => {
    const cv = __rot(__rcpt({ printed: '0461302', src: 'حلب-السريان' }), 270), blob = await new Promise(z => cv.toBlob(z, 'image/jpeg', 0.92));
    const x = await GMTReceipt.readMufti(blob); return { t: x.tracking, b: x.branch && x.branch.key };
  });
  ok(pr.t && pr.t.status === 'printed' && (pr.t.candidates || [pr.t.number]).includes('0461302') && pr.b === 'حلب|السريان', `⑤ بلا QR ومدوَّر: الرقم المطبوع ${JSON.stringify(pr.t)} · الفرع ${pr.b}`);

  const real = errs.filter(e => !/status of (400|503)/.test(e) && !/Estimating resolution|Detected \d+ diacritics|boxClipToRectangle|pixScanForForeground/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
