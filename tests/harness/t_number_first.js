// (23 ت1 · TASK-0136) المالك (seq 37): «سوّي قراءة الرقم خاصّة حتى قبل المسح وقبل التحديد لأنّه ممكن القصّ التلقائي يقصّ الرقم وما ينتبه
// عليه مدخل الأوردرات». ① الباركود يعطي موضعه في الصورة الأصليّة (حتى مدوَّرة) · ② قصٌّ يقطع الرقم المطبوع (بلا QR) ⇒ الرقم يُقرأ من
// الأصل (وحدةٌ مستقلّة تبدأ مبكراً بالتوازي مع الفرع) وموضعه يُبلَّغ · ③ الماسح: اكتشافٌ تلقائيّ يقطع موضع الرقم ⇒ يُوسَّع وحده ·
// حدودٌ بيدك تقطعه ⇒ تنبيه + «شمل الرقم» + «قصّ» يطلب ضغطةً ثانية · ④ نافذة الشحن: الرقم من الأصل والحدود تشمله.
const H = require('./h.js'), fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const src = fs.readFileSync(__dirname + '/t_mufti_read.js', 'utf8');
const SYNTH = src.slice(src.indexOf('const SYNTH = `') + 15, src.indexOf('};`;') + 2);
const ROT = `window.__rot = function (cv, deg) { const o = document.createElement('canvas'), q = deg % 180 !== 0;
  o.width = q ? cv.height : cv.width; o.height = q ? cv.width : cv.height; const c = o.getContext('2d');
  c.translate(o.width / 2, o.height / 2); c.rotate(deg * Math.PI / 180); c.drawImage(cv, -cv.width / 2, -cv.height / 2); return o; };`;
const inside = (b, r) => b && b[0] <= r[0] + 0.01 && b[1] <= r[1] + 0.01 && b[2] >= r[2] - 0.01 && b[3] >= r[3] - 0.01;
(async () => {
  const { browser, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, wait: 4000, mobile: false, init: H.ADMIN_INIT + SYNTH + ROT });
  await pg.addScriptTag({ content: fs.readFileSync(__dirname + '/docscan_gen.js', 'utf8') });
  await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });

  // ① موضع الـQR في الأصل: الإيصال كما هو ومدوَّراً ٩٠°
  const qr = await pg.evaluate(async () => {
    const out = [];
    for (const deg of [0, 90]) {
      const cv = __rot(__rcpt({ qr: '0461300', src: 'حلب-الفرقان' }), deg), blob = await new Promise(z => cv.toBlob(z, 'image/jpeg', 0.92));
      const r = await GMTReceipt.readTracking(blob, { ocr: false, quick: true });
      out.push({ deg, n: r.number, box: r.box && r.box.map(v => +v.toFixed(3)) });
    }
    return out;
  });
  /* رمز الـQR نفسه (بلا الهامش الأبيض حوله): ٢١ وحدة من ٢٩ في مربّع ٢٢٠ بكسل عند (٤٠، ٣٠) من إيصالٍ ١٥٠٠×٧٦٠ */
  const sym = [(40 + 30) / 1500, (30 + 30) / 760, (40 + 190) / 1500, (30 + 190) / 760];
  const truth = { 0: sym, 90: [1 - sym[3], sym[0], 1 - sym[1], sym[2]] };                    // ٩٠° مع عقارب الساعة: (x,y) ⇒ (1−y, x)
  qr.forEach(q => ok(q.n === '0461300' && inside(q.box, truth[q.deg]) && (q.box[2] - q.box[0]) < 0.4, `① ${q.deg}°: موضع الـQR في الأصل ${JSON.stringify(q.box)} يحوي موضعه الحقيقي ${JSON.stringify(truth[q.deg])}`));

  // ② بلا QR · الرقم مطبوع أعلى اليمين · حدود القصّ تقطع أعلى الإيصال (حيث الرقم) ⇒ يُقرأ من الأصل
  const rd = await pg.evaluate(async () => {
    const quad = [[.1, .2], [.9, .2], [.9, .8], [.1, .8]], c = __mkCase({ bg: 'dark', W: 1600, H: 1200, quad }, __rcpt({ printed: '0577214', src: 'حلب-السريان' }));
    const blob = await new Promise(z => c.cv.toBlob(z, 'image/jpeg', 0.92)), img = new Image(); img.src = URL.createObjectURL(blob); await img.decode();
    const cut = [[.1, .32], [.9, .32], [.9, .8], [.1, .8]];                                   // تقطع أعلى ٢٠٪ من الإيصال: الرقم خارجها
    const boxes = [], t0 = performance.now(); let tBox = null;
    const r = await GMTReceipt.readMufti(blob, { geom: async () => ({ corners: cut, ok: true, img }), onNumBox: b => { boxes.push(b); if (tBox == null) tBox = Math.round(performance.now() - t0); } });
    return { tr: r.tracking, ms: Math.round(performance.now() - t0), tBox, boxes: boxes.map(b => b.map(v => +v.toFixed(3))), br: r.branch && r.branch.key };
  });
  const pTruth = [0.1 + 0.8 * 0.767, 0.2 + 0.6 * 0.05, 0.1 + 0.8 * 0.93, 0.2 + 0.6 * 0.12];   // الرقم المطبوع في الصورة
  ok(rd.tr && (rd.tr.number === '0577214' || (rd.tr.candidates || []).includes('0577214')), `② القصّ قطع الرقم ⇒ قُرئ من الأصل: ${JSON.stringify(rd.tr)} · ${rd.ms}ms`);
  ok(rd.boxes.some(b => b[0] < pTruth[2] && b[2] > pTruth[0] && b[1] < pTruth[3] && b[3] > pTruth[1]), `② موضع الرقم المطبوع أُبلغ (${rd.tBox}ms): ${JSON.stringify(rd.boxes)} ≈ ${JSON.stringify(pTruth.map(v => +v.toFixed(3)))}`);

  // ③ الماسح: موضعٌ يجب أن يبقى داخل الحدود
  const sc = await pg.evaluate(async () => {
    const quad = [[.2, .25], [.8, .25], [.8, .75], [.2, .75]], c = __mkCase({ bg: 'dark', W: 1600, H: 1200, quad }, __thermal(false));
    const blob = await new Promise(z => c.cv.toBlob(z, 'image/jpeg', 0.92));
    window.__keep = [[0.62, 0.12, 0.74, 0.22]];                                                // فوق حدّ الورقة المكتشف (كأنّ القصّ قطعه)
    window.__out = undefined; GMTDocScan.open(new File([blob], 'k.jpg'), { keepIn: () => window.__keep }).then(v => window.__out = v);
    await new Promise(z => setTimeout(z, 1500));
    const hs = () => [...document.querySelectorAll('#gds .gds-h')].map(h => [parseFloat(h.style.left), parseFloat(h.style.top)]);
    const cv = document.querySelector('#gds canvas.gds-img'), W = cv.offsetWidth, Hh = cv.offsetHeight;
    const P = hs().map(p => [p[0] / W, p[1] / Hh]);
    const inP = (Q, q) => { let c2 = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const a = Q[i], b = Q[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c2 = !c2; } return c2; };
    const k = window.__keep[0], corners = [[k[0], k[1]], [k[2], k[1]], [k[2], k[3]], [k[0], k[3]]];
    return { msg: document.querySelector('#gds .gds-msg').textContent, allIn: corners.every(q => inP(P, q)), topY: Math.min(...P.map(p => p[1])) };
  });
  ok(/وُسّعت الحدود لتشمل رقم التتبّع/.test(sc.msg) && sc.allIn, `③ اكتشافٌ تلقائيّ قطع موضع الرقم ⇒ وُسّع وحده: «${sc.msg.slice(0, 50)}» · أعلى الحدود ${sc.topY.toFixed(3)}`);
  // يدوياً: سحب الركن الأيمن العلوي إلى الأسفل يقطعه
  const h1 = await pg.evaluate(() => { const hs = [...document.querySelectorAll('#gds .gds-h')].filter(h => !h.classList.contains('x')); const b = hs[1].getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await pg.mouse.move(h1[0], h1[1]); await pg.mouse.down(); await pg.mouse.move(h1[0], h1[1] + 160, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(500);
  let m = await pg.evaluate(() => ({ msg: document.querySelector('#gds .gds-msg').textContent, btn: [...document.querySelectorAll('#gds .gds-tools button')].some(b => /شمل الرقم/.test(b.textContent) && b.style.display !== 'none') }));
  ok(/تقطع رقم التتبّع/.test(m.msg) && m.btn, `③ حدودٌ بيدك تقطعه ⇒ تنبيهٌ وزرّ «شمل الرقم»: «${m.msg.slice(0, 40)}»`);
  await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /قصّ وتحسين/.test(b.textContent)).click()); await pg.waitForTimeout(300);
  m = await pg.evaluate(() => ({ msg: document.querySelector('#gds .gds-msg').textContent, result: [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)) }));
  ok(!m.result && /مرّةً ثانية/.test(m.msg), `③ «قصّ» أوّل مرّة لا يقصّ — يطلب ضغطةً ثانية: «${m.msg.slice(0, 45)}»`);
  await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-tools button')].find(b => /شمل الرقم/.test(b.textContent)).click()); await pg.waitForTimeout(300);
  m = await pg.evaluate(() => document.querySelector('#gds .gds-msg').textContent);
  ok(/شُمل رقم التتبّع/.test(m), `③ «شمل الرقم» يوسّع الحدود: «${m.slice(0, 40)}»`);
  await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /قصّ وتحسين/.test(b.textContent)).click());
  await pg.waitForFunction(() => [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)), null, { timeout: 15000 });
  ok(true, '③ بعدها «قصّ» يقصّ مباشرةً');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  /* بلا keepIn (صفحة الماسح · شركاتٌ أخرى): لا تنبيه ولا ضغطة ثانية */
  const plain = await pg.evaluate(async () => {
    const c = __mkCase({ bg: 'dark', W: 1600, H: 1200, quad: [[.2, .25], [.8, .25], [.8, .75], [.2, .75]] }, __thermal(false)), blob = await new Promise(z => c.cv.toBlob(z, 'image/jpeg', 0.92));
    window.__out = undefined; GMTDocScan.open(new File([blob], 'k.jpg'), {}).then(v => window.__out = v);
    await new Promise(z => setTimeout(z, 1200));
    [...document.querySelectorAll('#gds .gds-bar button')].find(b => /قصّ وتحسين/.test(b.textContent)).click();
    for (let i = 0; i < 100 && ![...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)); i++) await new Promise(z => setTimeout(z, 100));
    return [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent));
  });
  ok(plain, '③ بلا موضع رقم: «قصّ» يقصّ من أوّل ضغطة');
  await pg.keyboard.press('Escape');
  ok(!errs.filter(e => !/Failed to load resource|Estimating resolution/.test(e)).length, 'لا أخطاء JS ' + errs.join(' | '));   // «Estimating resolution» رسالة Tesseract نفسها
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
