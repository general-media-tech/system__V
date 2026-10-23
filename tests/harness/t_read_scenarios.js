// (23 ت1 · TASK-0127/0129) المالك: «افترض كل السيناريوهات… ارفع إيصالات وهمية وجرّبها» — أهمّ ما كشفه مسح ١٦٠ إيصالاً وهمياً،
// ثابتاً هنا: صورة هاتف ⇒ الماسح ⇒ القراءة المبكرة بزواياه ⇒ الثانية (المخفّفة) إن نقص شيء ⇒ الدمج — كنافذة الشحن تماماً.
// القاعدة الأولى: **لا فرع خاطئ ولا رقم خاطئ أبداً** — ما لم يُتأكّد منه يُعرض للاختيار.
const H = require('./h.js'), fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const CASES = [
  // [الوصف, الإيصال, الصورة, المتوقَّع]
  ['تشويشٌ ليليّ على إيصالٍ حراريّ («سرمدا» كانت «شرمنا»)', { qrRight: '354312', src: 'سرمدا', thermal: true }, { bg: 'cloth', noise: 40 }, { track: '354312', branch: 'سرمدا|سرمدا' }],
  ['إيصال شركةٍ أخرى بسطر «المصدر: سرمدا» (كان يُنسب للمفتي)', { qrRight: '409702', printed: '409702', src: 'سرمدا', company: 'شركة القدموس للنقل', footer: 'الإدارة العامة: دمشق - المزة - هاتف 0112233445 - 0944556677' }, { bg: 'keyboard', rot: 180 }, { track: '409702', branch: null }],
  ['«حلب-السكن الجامعي وحدة 18» مقلوب', { qrRight: '382007', src: 'حلب-السكن الجامعي وحدة 18', thermal: true }, { bg: 'dark', rot: 90, jpeg: 0.35 }, { track: '382007', branch: 'حلب|السكن الجامعي وحدة 18' }],
  ['«بانياس-بانياس البلد» مع تشويش', { qrRight: '696533', printed: '696533', src: 'بانياس-بانياس البلد' }, { flat: true, rot: 270, noise: 40 }, { track: '696533', branch: 'بانياس|بانياس البلد' }],
  ['خطّ قلمٍ على «البلد» ⇒ لا يُعتمد «بانياس» وحده', { qrRight: '864640', src: 'بانياس-بانياس البلد', thermal: true }, { bg: 'keyboard', pen: true }, { track: '864640', branch: null, cands: ['بانياس|بانياس', 'بانياس|بانياس البلد'] }],
  ['رمزٌ يسارَ الإيصال برابط واتساب ⇒ ليس رقم تتبّع', { qrRight: '512340', qrLeft: 'https://wa.me/963965112158', src: 'حلب-الفرقان' }, { bg: 'white' }, { track: '512340', branch: 'حلب|الفرقان' }],
  ['رقمٌ مطبوع فقط بمنظورٍ حادّ (خانةٌ كانت تُقرأ خطأً)', { printed: '975422', src: 'إدلب-دوار المحراب', thermal: true }, { bg: 'tiles', rot: 90, persp: true }, { track: '975422', branch: 'إدلب|دوار المحراب' }],
  ['رقمٌ مطبوع فقط بدقّةٍ منخفضة (٤٥٪)', { printed: '844886', src: 'دمشق-الزبلطاني', thermal: true }, { bg: 'dark', rot: 90, scale: 0.45 }, { track: '844886', branch: 'دمشق|الزبلطاني' }],
  ['بلا باركود ولا رقم وظلٌّ متدرّج ⇒ لا رقم وهميّ', { src: 'جبلة-جبلة', thermal: true }, { bg: 'white', shade: true }, { track: null, branch: 'جبلة|جبلة' }],
  ['صورةٌ ليليّة: إضاءةٌ خافتة وتشويشٌ شديد (كانت ٥٣ث)', { qrRight: 'https://almufti.example/track?awb=168386', src: 'دمشق-جرمانا', thermal: true }, { bg: 'tiles', noise: 70, lowlight: true }, { track: '168386', branch: 'دمشق|جرمانا', maxMs: 30000 }],
  ['بلا سطر «المصدر» ⇒ لا فرع · والرقم من الرابط', { qrRight: 'https://almufti.example/track?awb=233653', noSrcLine: true }, { flat: true, rot: 270 }, { track: '233653', branch: null }],
];
(async () => {
  const { browser, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, wait: 4500, mobile: false, init: H.ADMIN_INIT });
  await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });
  await pg.addScriptTag({ content: fs.readFileSync(__dirname + '/docscan_gen.js', 'utf8') });
  await pg.addScriptTag({ content: fs.readFileSync(__dirname + '/mufti_gen.js', 'utf8') });
  for (const [name, rc, ph, exp] of CASES) {
    const r = await pg.evaluate(async ([rc, ph]) => {
      let cv = __rotCv(__mrcpt(rc), ph.rot || 0), img = cv;
      if (!ph.flat) {
        const land = cv.width > cv.height, W = land ? 1400 : 1000, Hh = land ? 1000 : 1400;
        let q = land ? [[.08, .12], [.93, .09], [.95, .90], [.06, .88]] : [[.10, .07], [.91, .09], [.89, .93], [.08, .91]];
        if (ph.persp) q = land ? [[.20, .14], [.80, .16], [.96, .88], [.04, .85]] : [[.22, .08], [.78, .10], [.95, .92], [.05, .90]];
        img = __mkCase({ bg: ph.bg, quad: q, W, H: Hh, shade: ph.shade ? 1 : 0, lowlight: ph.lowlight ? 1 : 0 }, cv).cv;
        if (ph.pen) { const x = img.getContext('2d'); x.strokeStyle = 'rgba(20,40,160,.85)'; x.lineWidth = 6; x.beginPath(); x.moveTo(img.width * .3, img.height * .45); x.bezierCurveTo(img.width * .5, img.height * .35, img.width * .6, img.height * .65, img.width * .8, img.height * .5); x.stroke(); }
      }
      img = __degrade(img, { scale: ph.scale, noise: ph.noise });
      const blob = await new Promise(z => img.toBlob(z, 'image/jpeg', ph.jpeg || 0.88)), orig = new File([blob], 'o.jpg', { type: 'image/jpeg' });
      const im = await new Promise(z => { const x = new Image(); x.onload = () => z(x); x.src = URL.createObjectURL(blob); });
      const t0 = performance.now(), corners = ph.flat ? null : GMTDocScan.detectNorm(im, 0).corners;
      const early = await GMTReceipt.readMufti(orig, { corners });
      let res = early;
      if (!early.tracking || early.tracking.status === 'none' || !(early.branch && early.branch.confident)) {
        let file = orig;
        if (!ph.flat) { const sc = GMTDocScan.process(im, corners, 0, 'color'); const b2 = await new Promise(z => sc.toBlob(z, 'image/jpeg', 0.9)); file = new File([b2], 's.jpg', { type: 'image/jpeg' }); }
        const r2 = await GMTReceipt.readMufti(file, { original: file !== orig ? orig : null, lite: early.cancelled ? null : { text: !(early.branch && early.branch.confident), rot: early.rot } });
        res = shipMergeReads(early, r2);
      }
      const t = res.tracking || {};
      return { ms: Math.round(performance.now() - t0), track: t.number || t.printed || t.barcode || null, st: t.status, branch: res.branch && res.branch.confident ? res.branch.key : null, cands: (res.branch && res.branch.candidates) || [], type: res.type && res.type.kind };
    }, [rc, ph]);
    const good = r.track === exp.track && r.branch === exp.branch && (!exp.cands || exp.cands.every(k => r.cands.includes(k))) && (!exp.maxMs || r.ms <= exp.maxMs);
    ok(good, `${name}: الرقم ${r.track || '—'} (${r.st}) · الفرع ${r.branch || '—'}${r.branch ? '' : ' [' + r.cands.slice(0, 3).join('،') + ']'} · ${r.ms}ms`);
  }
  const real = errs.filter(e => !/status of (400|503)/.test(e) && !/Estimating resolution|Detected \d+ diacritics|boxClipToRectangle|pixScanForForeground|Image too small to scale|Line cannot be recognized/.test(e));   // سجلّ Tesseract الداخلي ليس خطأ صفحة
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
