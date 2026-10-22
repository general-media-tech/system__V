// مولّد صورٍ مُصطنعة لاختبار اكتشاف حدود الورقة (t_docscan_edges.js) — يُحقن في الصفحة
// مجموعة تقييم اكتشاف الحدود — تُحقن في الصفحة. window.__mkCase(spec, tex) ⇒ { cv, gt:[[x,y]..] (نِسَب) }
window.__H = function (src, dst) {           // homography من 4 نقاط src ⇒ dst
  const A = [], b = [];
  for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  const n = 8; for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
  const h = b.map((v, i) => v / A[i][i]); return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
};
window.__bg = function (kind, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  if (kind === 'keyboard') { x.fillStyle = '#1b1d21'; x.fillRect(0, 0, W, H); for (let r = 0; r < 12; r++) for (let k = 0; k < 16; k++) { x.fillStyle = '#2a2d33'; x.fillRect(k * 70 + 6, r * 70 + 6, 58, 58); x.fillStyle = '#9aa'; x.font = '14px sans-serif'; x.fillText('ABCDEFGHIJKLMNOP'[k], k * 70 + 14, r * 70 + 26); } }
  else if (kind === 'wood') { for (let y = 0; y < H; y++) { const v = 90 + 25 * Math.sin(y / 9 + Math.sin(y / 53) * 3) + rnd() * 10; x.fillStyle = `rgb(${v + 50},${v + 10},${v - 30})`; x.fillRect(0, y, W, 1); } }
  else if (kind === 'cloth') { x.fillStyle = '#c4c2bd'; x.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { const g = 170 + rnd() * 50 | 0; x.fillStyle = `rgb(${g},${g - 2},${g - 6})`; x.fillRect(rnd() * W, rnd() * H, 3, 3); } }
  else if (kind === 'white') { x.fillStyle = '#e4e4e2'; x.fillRect(0, 0, W, H); }
  else if (kind === 'busy') { for (let i = 0; i < 220; i++) { x.fillStyle = `hsl(${rnd() * 360},55%,${25 + rnd() * 45}%)`; x.fillRect(rnd() * W, rnd() * H, 40 + rnd() * 160, 30 + rnd() * 120); } }
  else if (kind === 'tiles') { x.fillStyle = '#8d8a84'; x.fillRect(0, 0, W, H); x.strokeStyle = '#5d5a55'; x.lineWidth = 4; for (let i = -10; i < 30; i++) { x.beginPath(); x.moveTo(i * 120, 0); x.lineTo(i * 120 + 300, H); x.stroke(); x.beginPath(); x.moveTo(0, i * 120); x.lineTo(W, i * 120 - 200); x.stroke(); } }
  else { x.fillStyle = '#3a3f46'; x.fillRect(0, 0, W, H); }
  return c;
};
window.__mkCase = function (o, tex) {
  const W = o.W || 1000, H = o.H || 1400, bg = __bg(o.bg, W, H), x = bg.getContext('2d');
  const q = o.quad.map(p => [p[0] * W, p[1] * H]);
  if (o.stack) { x.fillStyle = '#f2f2f0'; const s = o.stack; x.beginPath(); s.forEach((p, i) => i ? x.lineTo(p[0] * W, p[1] * H) : x.moveTo(p[0] * W, p[1] * H)); x.fill(); }
  if (o.shadowUnder) { x.save(); x.filter = 'blur(12px)'; x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); q.forEach((p, i) => i ? x.lineTo(p[0] + 14, p[1] + 16) : x.moveTo(p[0] + 14, p[1] + 16)); x.fill(); x.restore(); }
  // ورقة: الإيصال بلونٍ مائل للأزرق وإضاءةٍ متدرّجة
  const tw = tex.width, th = tex.height, Hm = __H(q, [[0, 0], [tw, 0], [tw, th], [0, th]]);
  const id = x.getImageData(0, 0, W, H), d = id.data, td = tex.getContext('2d').getImageData(0, 0, tw, th).data;
  const minx = Math.max(0, Math.floor(Math.min(...q.map(p => p[0])))), maxx = Math.min(W - 1, Math.ceil(Math.max(...q.map(p => p[0]))));
  const miny = Math.max(0, Math.floor(Math.min(...q.map(p => p[1])))), maxy = Math.min(H - 1, Math.ceil(Math.max(...q.map(p => p[1]))));
  for (let y = miny; y <= maxy; y++) for (let X = minx; X <= maxx; X++) {
    const w = Hm[6] * X + Hm[7] * y + 1, u = (Hm[0] * X + Hm[1] * y + Hm[2]) / w, v = (Hm[3] * X + Hm[4] * y + Hm[5]) / w;
    if (u < 0 || v < 0 || u >= tw - 1 || v >= th - 1) continue;
    const ti = ((v | 0) * tw + (u | 0)) * 4, k = (y * W + X) * 4, lit = 0.86 + 0.12 * (u / tw) - (o.lowlight ? 0.35 : 0);
    d[k] = td[ti] * lit * 0.97; d[k + 1] = td[ti + 1] * lit * 0.98; d[k + 2] = Math.min(255, td[ti + 2] * lit * 1.03);
  }
  x.putImageData(id, 0, 0);
  if (o.hand) { x.fillStyle = '#c99a83'; x.beginPath(); x.ellipse(o.hand[0] * W, o.hand[1] * H, o.hand[2] * W, o.hand[3] * H, 0.3, 0, 7); x.fill(); }
  if (o.shade) { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  if (o.noise) { const id2 = x.getImageData(0, 0, W, H), e = id2.data; let s = 3; for (let i = 0; i < e.length; i += 4) { s = (s * 16807) % 2147483647; const n = (s / 2147483647 - 0.5) * o.noise; e[i] += n; e[i + 1] += n; e[i + 2] += n; } x.putImageData(id2, 0, 0); }
  let out = bg;
  if (o.blur) { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const x2 = c2.getContext('2d'); x2.filter = 'blur(' + o.blur + 'px)'; x2.drawImage(bg, 0, 0); out = c2; }
  out.naturalWidth = W; out.naturalHeight = H;
  return { cv: out, gt: o.quad };
};
window.__SYN = [
  ['keyboard', { bg: 'keyboard', quad: [[.18, .12], [.84, .16], [.80, .86], [.14, .82]] }],
  ['wood-tilt', { bg: 'wood', quad: [[.30, .08], [.92, .30], [.70, .95], [.08, .72]] }],
  ['cloth-lowcontrast', { bg: 'cloth', quad: [[.15, .15], [.85, .13], [.87, .85], [.13, .88]] }],
  ['white-desk-shadow', { bg: 'white', shadowUnder: 1, quad: [[.16, .14], [.82, .12], [.86, .84], [.18, .88]] }],
  ['busy', { bg: 'busy', quad: [[.20, .18], [.80, .15], [.83, .80], [.16, .84]] }],
  ['hand', { bg: 'dark', quad: [[.15, .06], [.86, .05], [.88, .90], [.12, .92]], hand: [.10, .55, .14, .22] }],
  ['stack-beside', { bg: 'keyboard', stack: [[0, .04], [.17, .05], [.17, .95], [0, .96]], quad: [[.17, .14], [.78, .11], [.86, .91], [.19, .89]] }],
  ['corner-out', { bg: 'wood', quad: [[-.06, .10], [.80, .05], [.86, .88], [.05, .96]] }],
  ['perspective', { bg: 'dark', quad: [[.30, .15], [.72, .17], [.92, .90], [.06, .86]] }],
  ['lowlight-noise', { bg: 'dark', lowlight: 1, noise: 40, quad: [[.18, .12], [.84, .16], [.80, .86], [.14, .82]] }],
  ['blur', { bg: 'keyboard', blur: 3, quad: [[.18, .12], [.84, .16], [.80, .86], [.14, .82]] }],
  ['tiles', { bg: 'tiles', quad: [[.22, .16], [.86, .20], [.78, .88], [.12, .84]] }],
  ['shade', { bg: 'cloth', shade: 1, quad: [[.15, .15], [.85, .13], [.87, .85], [.13, .88]] }],
  ['landscape-keyboard', { bg: 'keyboard', W: 1400, H: 1000, quad: [[.10, .14], [.88, .10], [.90, .86], [.12, .90]] }],
];
window.__err = function (pred, gt) {     // أكبر خطأ ركن ÷ القطر (النِسَب مقيّدة بالإطار) + هل قُصّ شيءٌ من الورقة
  const cl = p => [Math.max(0, Math.min(1, p[0])), Math.max(0, Math.min(1, p[1]))];
  const G = gt.map(cl), P = pred, diag = Math.SQRT2;
  const e = Math.max(...G.map((g, i) => Math.hypot(P[i][0] - g[0], P[i][1] - g[1]))) / diag;
  // قصّ: أبعد ركن GT خارج الرباعي المتوقّع
  function sd(px, py) { let md = Infinity; for (let i = 0; i < 4; i++) { const A = P[i], B = P[(i + 1) % 4], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; md = Math.min(md, ((B[0] - A[0]) * (py - A[1]) - (B[1] - A[1]) * (px - A[0])) / L); } return md; }
  const cut = Math.max(0, ...G.map(g => -sd(g[0], g[1]))) / diag;
  return { e: +e.toFixed(3), cut: +cut.toFixed(3) };
};

window.__thermal = function (colored) {   // نسيجُ إيصالٍ مُصطنع 1300×700
  const W = 1300, Hh = 700, c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d');
  x.fillStyle = '#e6e9f2'; x.fillRect(0, 0, W, Hh);
  x.fillStyle = '#4a5a8a'; x.font = 'bold 30px sans-serif'; x.textAlign = 'right';
  for (let i = 0; i < 3; i++) x.fillRect(60 + i * 1000, 40, 150, 150);                       // رموز QR
  x.fillStyle = '#e6e9f2'; for (let i = 0; i < 3; i++) for (let j = 0; j < 20; j++) x.fillRect(70 + i * 1000 + (j * 37) % 130, 50 + (j * 53) % 130, 12, 12);
  x.fillStyle = '#4a5a8a';
  x.fillText('المرسل: مجموعة ميديا تك التجارية', 1240, 250); x.fillText('المصدر: حلب-السريان', 1240, 300); x.fillText('الموبايل: 0939773715', 1240, 350);
  x.fillText('المرسل إليه: زبون تجربة', 600, 250); x.fillText('الوجهة: دمشق-فكتوريا', 600, 300); x.fillText('الموبايل: 0933000000', 600, 350);
  if (colored) { x.fillStyle = '#f3e3c3'; x.fillRect(40, 380, 1220, 60); x.fillStyle = '#c9dcf5'; x.fillRect(40, 470, 1220, 60); x.fillStyle = '#4a5a8a'; }
  x.strokeStyle = '#4a5a8a'; x.lineWidth = 3; x.strokeRect(40, 210, 1220, 400);
  for (let r = 1; r < 8; r++) { x.beginPath(); x.moveTo(40, 210 + r * 50); x.lineTo(1260, 210 + r * 50); x.stroke(); }
  for (let k = 1; k < 6; k++) { x.beginPath(); x.moveTo(40 + k * 203, 410); x.lineTo(40 + k * 203, 610); x.stroke(); }
  x.font = '22px sans-serif'; x.fillText('المقر الرئيسي: سوريا- دمشق - البرامكة - دمشق: 0965112158 - حمص: 0965112157 - حلب: 0965112156', 1240, 650);
  const g = x.createLinearGradient(W / 2 - 4, 0, W / 2 + 4, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.13)');   // طيّة: نصفٌ في الظلّ
  x.fillStyle = 'rgba(0,0,0,.13)'; x.fillRect(W / 2 + 4, 0, W / 2, Hh); x.fillStyle = g; x.fillRect(W / 2 - 4, 0, 8, Hh);
  return c;
};
