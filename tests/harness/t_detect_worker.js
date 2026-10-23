// (23 ت1 · TASK-0137) المالك (seq 37): «خلّي الموضوع أسرع». الاكتشاف في عاملٍ مستقلّ (gmt-docscan.js نفسه): النتيجة مطابقةٌ حرفياً لما
// في الصفحة (صورٌ مُصطنعة متنوّعة × اتّجاهات · ورقتان مع «تجاوز ما مُسح») · الخيط الرئيسي لا يُحجز أثناءه · المحرّر يعمل به (اكتشاف ·
// تدويرٌ أثناء الاكتشاف · «قصّ» قبل انتهائه ينتظره) · بلا عامل (ملفٌّ مُضمَّن) يعمل في الصفحة كما كان.
const H = require('./h.js'), fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const { browser, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, wait: 4000, mobile: false,
    init: H.ADMIN_INIT + 'window.__DW = 0; const __W0 = window.Worker; window.Worker = function (u, o) { if (/gmt-docscan/.test(String(u))) __DW++; return new __W0(u, o); };' });
  await pg.addScriptTag({ content: fs.readFileSync(__dirname + '/docscan_gen.js', 'utf8') });
  const r = await pg.evaluate(async () => {
    const bgs = ['dark', 'wood', 'cloth', 'white', 'keyboard', 'tiles', 'busy'], same = [], diff = [];
    for (let i = 0; i < 28; i++) {
      let s = i * 104729 + 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const cx = 0.5 + (rnd() - 0.5) * 0.2, cy = 0.5 + (rnd() - 0.5) * 0.2, w = 0.3 + rnd() * 0.3, h = 0.3 + rnd() * 0.3, a = (rnd() - 0.5) * 0.6;
      const q = [[-w, -h], [w, -h], [w, h], [-w, h]].map(p => [cx + p[0] * Math.cos(a) - p[1] * Math.sin(a), cy + p[0] * Math.sin(a) + p[1] * Math.cos(a)]);
      const cv = __mkCase({ bg: bgs[i % 7], quad: q, curve: i % 4 === 0 ? 0.03 : 0, noise: i % 3 === 0 ? 20 : 0 }, __thermal(i % 2 === 0)).cv;
      const blob = await new Promise(z => cv.toBlob(z, 'image/jpeg', 0.92)), im = new Image(); im.src = URL.createObjectURL(blob); await im.decode();
      for (const rot of i % 5 === 0 ? [0, 90, 270] : [0]) {
        const A = GMTDocScan.detectNorm(im, rot), B = await GMTDocScan._detectOff(im, rot), k = x => JSON.stringify([x.how, x.ok, x.corners, x.poly || null]);
        (k(A) === k(B) ? same : diff).push(i + '/' + rot + (k(A) === k(B) ? '' : ' ' + A.how + ' ≠ ' + B.how));
      }
    }
    // ورقتان: الثانية مع «تجاوز» الأولى
    const A2 = __mkCase({ bg: 'dark', W: 1400, H: 1000, quad: [[.06, .15], [.44, .13], [.45, .85], [.05, .86]] }, __thermal(false)).cv, qB = [[.56, .12], [.94, .14], [.95, .86], [.55, .84]];
    const B2 = __mkCase({ bg: 'dark', W: 1400, H: 1000, quad: qB }, __thermal(false)).cv, x = A2.getContext('2d'); x.save(); x.beginPath(); qB.forEach((p, j) => { const X = (p[0] + (p[0] < .75 ? -.01 : .01)) * 1400, Y = (p[1] + (p[1] < .5 ? -.01 : .01)) * 1000; j ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); x.clip(); x.drawImage(B2, 0, 0); x.restore();
    const first = GMTDocScan.detectNorm(A2, 0), ex = [{ poly: first.corners, rot: 0 }];
    const a3 = GMTDocScan.detectNorm(A2, 0, ex), b3 = await GMTDocScan._detectOff(A2, 0, ex);
    const exSame = JSON.stringify(a3.corners) === JSON.stringify(b3.corners);
    // الخيط الرئيسي أثناء الاكتشاف في العامل
    const big = __mkCase({ bg: 'keyboard', W: 3000, H: 4000, quad: [[.2, .1], [.8, .12], [.82, .9], [.18, .88]] }, __thermal(false)).cv;
    await new Promise(z => setTimeout(z, 50));
    let gap = 0, last = performance.now(), on = true; const tick = () => { const n = performance.now(); gap = Math.max(gap, n - last); last = n; if (on) setTimeout(tick, 5); }; tick();
    const t0 = performance.now(); await GMTDocScan._detectOff(big, 0); const tw = performance.now() - t0; const gW = gap; gap = 0; last = performance.now();
    await new Promise(z => setTimeout(z, 30)); const t1 = performance.now(); GMTDocScan.detectNorm(big, 0); const tm = performance.now() - t1; await new Promise(z => setTimeout(z, 30)); const gM = gap; on = false;
    return { same: same.length, diff, exSame, workers: window.__DW, gW: Math.round(gW), gM: Math.round(gM), tw: Math.round(tw), tm: Math.round(tm) };
  });
  ok(!r.diff.length && r.same >= 30, `نتيجة العامل = نتيجة الصفحة حرفياً (${r.same} حالة × اتّجاهات)${r.diff.length ? ' مختلفة: ' + r.diff.join(' · ') : ''}`);
  ok(r.exSame, 'ورقتان: «تجاوز ما مُسح» في العامل كالصفحة');
  ok(r.workers === 1, `عاملٌ واحد للاكتشاف يُعاد استعماله (${r.workers})`);
  ok(r.gW < r.gM / 2 && r.gW < 120, `الخيط الرئيسي لا يُحجز: أطول توقّف ${r.gW}ms بالعامل مقابل ${r.gM}ms في الصفحة (الاكتشاف ${r.tw}/${r.tm}ms)`);

  // المحرّر: يكتشف بالعامل · تدويرٌ أثناء الاكتشاف · «قصّ» فوراً ينتظره
  const ed = await pg.evaluate(async () => {
    const cv = __mkCase({ bg: 'dark', W: 1200, H: 1600, quad: [[.15, .12], [.85, .12], [.85, .88], [.15, .88]], curve: 0.035 }, __thermal(false)).cv, blob = await new Promise(z => cv.toBlob(z, 'image/jpeg', 0.92));
    window.__out = undefined; GMTDocScan.open(new File([blob], 'a.jpg'), {}).then(v => window.__out = v);
    const msg = () => document.querySelector('#gds .gds-msg').textContent, bt = t => [...document.querySelectorAll('#gds .gds-bar button')].find(b => b.textContent.includes(t));
    await new Promise(z => setTimeout(z, 20)); bt('تدوير').click();                                   // قبل اكتمال الاكتشاف
    await new Promise(z => setTimeout(z, 20)); bt('قصّ وتحسين').click();                               // «قصّ» قبل اكتماله ⇒ ينتظره
    for (let i = 0; i < 150 && ![...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)); i++) await new Promise(z => setTimeout(z, 100));
    const gotResult = [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent));
    if (gotResult) [...document.querySelectorAll('#gds .gds-bar button')].find(b => /اعتماد/.test(b.textContent)).click();
    for (let i = 0; i < 50 && window.__out === undefined; i++) await new Promise(z => setTimeout(z, 100));
    return { gotResult, rot: window.__out && window.__out.rotation, poly: window.__out && window.__out.poly && window.__out.poly.length, w: window.__out && window.__out.width, h: window.__out && window.__out.height };
  });
  ok(ed.gotResult && ed.rot === 90 && ed.w > ed.h, `المحرّر: تدويرٌ ثمّ «قصّ» قبل اكتمال الاكتشاف ⇒ ينتظره ويقصّ بالاتّجاه الجديد ${JSON.stringify(ed)}`);
  // إغلاق الماسح قبل انتهاء الاكتشاف ⇒ لا onDetected بعد الإغلاق
  const late = await pg.evaluate(async () => {
    const cv = __mkCase({ bg: 'wood', W: 3000, H: 4000, quad: [[.2, .1], [.8, .12], [.82, .9], [.18, .88]] }, __thermal(false)).cv, blob = await new Promise(z => cv.toBlob(z, 'image/jpeg', 0.92));
    let calls = 0, closed = false; const p = GMTDocScan.open(new File([blob], 'a.jpg'), { onDetected: () => { if (closed) calls++; } });
    await new Promise(z => setTimeout(z, 70)); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); closed = true;
    const v = await p; await new Promise(z => setTimeout(z, 2500)); return { v, calls };
  });
  ok(late.v === null && late.calls === 0, `إغلاقٌ قبل انتهاء الاكتشاف ⇒ نتيجته تُهمل (onDetected بعد الإغلاق: ${late.calls})`);
  ok(!errs.filter(e => !/Failed to load resource/.test(e)).length, 'لا أخطاء JS ' + errs.join(' | '));
  await browser.close();
  // العامل لا يُنشأ (متصفّحٌ قديم · سياسة أمان) ⇒ الاكتشاف في الصفحة كما كان
  const o2 = await H.open('orders.html', { w: 1366, h: 900, wait: 3000, mobile: false,
    init: H.ADMIN_INIT + 'const __W1 = window.Worker; window.Worker = function (u, o) { if (/gmt-docscan/.test(String(u))) throw new Error("blocked"); return new __W1(u, o); };' });
  await o2.pg.addScriptTag({ content: fs.readFileSync(__dirname + '/docscan_gen.js', 'utf8') });
  const fb = await o2.pg.evaluate(async () => {
    const cv = __mkCase({ bg: 'dark', quad: [[.15, .12], [.85, .12], [.85, .88], [.15, .88]] }, __thermal(false)).cv;
    const a = GMTDocScan.detectNorm(cv, 0), b = await GMTDocScan._detectOff(cv, 0);
    return JSON.stringify(a.corners) === JSON.stringify(b.corners) && a.ok;
  });
  ok(fb, 'بلا عامل ⇒ الاكتشاف في الصفحة بالنتيجة نفسها');
  await o2.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
