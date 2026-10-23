// (23 ت1 · TASK-0131/0134) حالات المالك (seq 33 · «٩. الاختبارات المطلوبة») بصورٍ مُصطنعة وقناع الورقة الحقيقي: لكلٍّ ⇒ الحالة المعروضة
// (اكتُشفت/تعذّر) · عدد النقاط (يتغيّر بشكل الورقة) · القصّ (ورقٌ خارج المحيط ≤١٫٥٪) والزيادة · الختم والتوقيع باقيان في النسخة النهائيّة.
// مستقيمة · مائلة بشدة · حافّةٌ منبعجة (أكثر من ٤ نقاط) · ركنٌ مثنيّ · منحنية من الوسط · مجعّدة · بيضاء على بيضاء · داكنة ·
// أختام وتواقيع وQR · ورقةٌ بجانب رزمة · إيصالان منفصلان في صورة (يُكتشف واحدٌ فقط) · بلا مستند (تعذّر).
const H = require('./h.js'); const fs = require('fs');
const Q0 = [[.15, .12], [.85, .12], [.85, .88], [.15, .88]];
const CASES = [
  ['1 مستقيمة بحدود واضحة', { bg: 'keyboard', quad: [[.18, .12], [.84, .16], [.80, .86], [.14, .82]] }],
  ['2 مائلة بشدة', { bg: 'wood', quad: [[.30, .08], [.92, .30], [.70, .95], [.08, .72]] }],
  ['3أ مطعوجة: حافّةٌ منبعجة وسط الضلع', { bg: 'dark', quad: Q0, dent: [[.85, .36], [.812, .5], [.85, .64]] }],
  ['3ب ركنٌ مثنيّ (لا يُقصّ شيء)', { bg: 'dark', quad: Q0, fold: [[.70, .12], [.85, .12], [.85, .24]] }],
  ['4 منحنية من الوسط', { bg: 'dark', curve: 0.035, quad: Q0 }],
  ['5 مجعّدة قليلاً', { bg: 'cloth', curve: 0.02, noise: 18, quad: [[.14, .12], [.86, .10], [.88, .88], [.12, .90]] }],
  ['6 بيضاء على خلفيّة بيضاء', { bg: 'white', shadowUnder: 1, quad: [[.16, .14], [.82, .12], [.86, .84], [.18, .88]] }],
  ['7 فوق خلفيّة داكنة', { bg: 'dark', quad: [[.12, .1], [.88, .12], [.86, .9], [.1, .88]] }],
  ['8 أختام وتواقيع وQR', { bg: 'cloth', quad: [[.15, .15], [.85, .13], [.87, .85], [.13, .88]], stamp: 1 }],
  ['9أ ورقةٌ بجانب رزمة أوراق', { bg: 'keyboard', stack: [[0, .04], [.17, .05], [.17, .95], [0, .96]], quad: [[.17, .14], [.78, .11], [.86, .91], [.19, .89]] }],
  ['9ب إيصالان منفصلان في صورة', { bg: 'dark', W: 1400, H: 1000, quad: [[.06, .15], [.44, .13], [.45, .85], [.05, .86]], second: [[.56, .12], [.94, .14], [.95, .86], [.55, .84]] }],
  ['10 صورة بلا مستند', { blank: 1 }],
];
(async () => {
  const { browser, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, wait: 3000, mobile: false });
  await pg.addScriptTag({ content: fs.readFileSync(__dirname + '/docscan_gen.js', 'utf8') });
  let bad = 0;
  for (const [name, spec] of CASES) {
    const r = await pg.evaluate(([spec]) => {
      const mkTex = () => { const t = __thermal(false); if (spec.stamp) { const x = t.getContext('2d'); x.strokeStyle = '#c01818'; x.lineWidth = 9; x.beginPath(); x.arc(t.width * 0.72, t.height * 0.7, 90, 0, 7); x.stroke(); x.fillStyle = '#c01818'; x.font = '900 34px sans-serif'; x.textAlign = 'center'; x.fillText('مختوم', t.width * 0.72, t.height * 0.7 + 12);
          x.strokeStyle = '#1d3fa8'; x.lineWidth = 5; x.beginPath(); for (let k = 0; k < 40; k++) x.lineTo(t.width * 0.2 + k * 9, t.height * 0.8 + Math.sin(k / 3) * 26); x.stroke(); } return t; };
      let cv, maskOf;
      if (spec.blank) { cv = document.createElement('canvas'); cv.width = 1000; cv.height = 1400; const x = cv.getContext('2d'); for (let y = 0; y < 1400; y += 10) for (let xx = 0; xx < 1000; xx += 10) { const v = 70 + ((xx * 7 + y * 13) % 41); x.fillStyle = `rgb(${v},${v * 0.92},${v * 0.8})`; x.fillRect(xx, y, 10, 10); } cv.naturalWidth = 1000; cv.naturalHeight = 1400; }
      else {
        const tex = mkTex(); cv = __mkCase(spec, tex).cv;
        const white = document.createElement('canvas'); white.width = tex.width; white.height = tex.height; const wx = white.getContext('2d'); wx.fillStyle = '#fff'; wx.fillRect(0, 0, white.width, white.height);
        const ms = Object.assign({}, spec, { bg: 'none', stack: null, shadowUnder: 0, noise: 0, second: null }); maskOf = __mkCase(ms, white).cv;
        if (spec.second) { const B = __mkCase(Object.assign({}, spec, { quad: spec.second }), mkTex()).cv, x = cv.getContext('2d'); x.save(); x.beginPath(); spec.second.forEach((p, i) => { const X = (p[0] + (p[0] < .75 ? -.01 : .01)) * cv.width, Y = (p[1] + (p[1] < .5 ? -.01 : .01)) * cv.height; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.closePath(); x.clip(); x.drawImage(B, 0, 0); x.restore(); }
        if (spec.dent) [cv, maskOf].forEach((c, j) => { const x = c.getContext('2d'), W = c.width, Hh = c.height, P = spec.dent.map(p => [p[0] * W, p[1] * Hh]);
          const smp = cv.getContext('2d').getImageData(Math.round(W * 0.95), Math.round(Hh * 0.5), 1, 1).data;
          x.fillStyle = j ? '#000' : `rgb(${smp[0]},${smp[1]},${smp[2]})`; x.beginPath(); x.moveTo(P[0][0] + 30, P[0][1] - 4); x.lineTo(P[0][0], P[0][1]); x.lineTo(P[1][0], P[1][1]); x.lineTo(P[2][0], P[2][1]); x.lineTo(P[2][0] + 30, P[2][1] + 4); x.closePath(); x.fill(); });
        if (spec.fold) [cv, maskOf].forEach((c, j) => { const x = c.getContext('2d'), W = c.width, Hh = c.height, P = spec.fold.map(p => [p[0] * W, p[1] * Hh]);
          const smp = cv.getContext('2d').getImageData(Math.round(W * 0.93), Math.round(Hh * 0.05), 1, 1).data;
          x.fillStyle = j ? '#000' : `rgb(${smp[0]},${smp[1]},${smp[2]})`; x.beginPath(); x.moveTo(P[0][0], P[0][1] - 40); x.lineTo(P[1][0] + 40, P[1][1] - 40); x.lineTo(P[2][0] + 40, P[2][1]); x.lineTo(P[2][0], P[2][1]); x.lineTo(P[0][0], P[0][1]); x.closePath(); x.fill(); });
      }
      const t0 = performance.now(), det = GMTDocScan.detectNorm(cv, 0), ms = Math.round(performance.now() - t0), st = GMTDocScan.statusOf(det);
      let score = null;
      if (maskOf) {
        const W = maskOf.width, Hh = maskOf.height, md = maskOf.getContext('2d').getImageData(0, 0, W, Hh).data;
        const inside = (P, X, Y) => { let c2 = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > Y) !== (b[1] > Y) && X < (b[0] - a[0]) * (Y - a[1]) / (b[1] - a[1]) + a[0]) c2 = !c2; } return c2; };
        const sc = P => { const PP = P.map(p => [p[0] * W, p[1] * Hh]); let paper = 0, cut = 0, exc = 0; for (let y = 0; y < Hh; y += 3) for (let x = 0; x < W; x += 3) { const isP = md[(y * W + x) * 4] > 150, inP = inside(PP, x, y); if (isP) { paper++; if (!inP) cut++; } else if (inP) exc++; } return { cut: +(cut / paper * 100).toFixed(2), exc: +(exc / paper * 100).toFixed(2) }; };
        score = sc(det.poly || det.corners);
      }
      /* النسخة النهائيّة كما يعتمدها «قصّ وتحسين» (تلقائي) — الختم الأحمر والتوقيع الأزرق باقيان؟ */
      let keep = null, dims = null;
      if (det.ok) {
        const out = GMTDocScan.process(cv, det.corners, 0, 'color', det.poly ? { poly: det.poly, ci: det.ci } : null); dims = [out.width, out.height];
        if (spec.stamp) { const d = out.getContext('2d').getImageData(0, 0, out.width, out.height).data; let red = 0, blue = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] > 140 && d[i + 1] < 90 && d[i + 2] < 90) red++; if (d[i + 2] > 120 && d[i] < 90 && d[i + 1] < 120) blue++; } keep = { red, blue }; }
      }
      return { st: st.k, txt: st.txt, how: det.how, n: det.poly ? det.poly.length : 4, ms, score, keep, dims };
    }, [spec]);
    const sc = r.score ? `قصّ ${r.score.cut}% · زيادة ${r.score.exc}%` : '';
    const pass = spec.blank ? r.st === 'fail' : (r.st !== 'fail' && r.score.cut <= 1.5 && (!spec.second || r.score.exc < 10) && (!spec.stamp || (r.keep.red > 2000 && r.keep.blue > 300)) && (!spec.dent && !(spec.curve >= 0.03) || r.n > 4));
    if (!pass) bad++;
    console.log(`${pass ? '✔' : '✘'} ${name.padEnd(30)} ${r.st.padEnd(6)} ${String(r.n).padStart(2)} نقطة · ${r.how} · ${sc} ${r.keep ? '· ختم ' + r.keep.red + 'px توقيع ' + r.keep.blue + 'px' : ''} · ${r.ms}ms`);
  }
  await browser.close();
  console.log(bad ? `FAIL ${bad} / ${CASES.length}` : `ALL PASS (${CASES.length})`); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
