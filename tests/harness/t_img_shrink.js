// (TASK-A0564 · المالك seq 962) صور المنتجات والبانرات قبل الرفع: أطول ضلع ≤٢٠٠٠px بالنوع نفسه
//  ① JPEG كبير 4000×3000 ⇒ 2000×1500 JPEG أصغر حجماً · ② PNG شفّاف 3000×3000 ⇒ 2000×2000 PNG والشفافيّة محفوظة
//  ③ صورةٌ صغيرة ⇒ الملفّ نفسه بلا إعادة ترميز · ④ نوعٌ غير مدعوم (GIF) ⇒ الملفّ نفسه
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg } = await H.open('inventory.html', { w: 1280, h: 900, mobile: false, wait: 4000 });
  const r = await pg.evaluate(async () => {
    const mk = (w, h, type, alpha) => new Promise(res => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      if (!alpha) { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#d5001c'); g.addColorStop(1, '#1b2a4a'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { x.fillStyle = `hsl(${i % 360},70%,50%)`; x.fillRect(Math.random() * w, Math.random() * h, 30, 30); } }
      else { x.clearRect(0, 0, w, h); x.fillStyle = '#d5001c'; x.beginPath(); x.arc(w / 2, h / 2, w / 3, 0, 7); x.fill(); }
      c.toBlob(b => res(new File([b], 'a.' + type.split('/')[1], { type })), type, 0.95); });
    const dims = f => new Promise(res => { const u = URL.createObjectURL(f), i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.src = u; });
    const alphaAt0 = f => new Promise(res => { const u = URL.createObjectURL(f), i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; c.getContext('2d').drawImage(i, 0, 0, 4, 4, 0, 0, 4, 4); res(c.getContext('2d').getImageData(0, 0, 1, 1).data[3]); }; i.src = u; });
    const j = await mk(4000, 3000, 'image/jpeg'), j2 = await GMTImgShrink(j);
    const p = await mk(3000, 3000, 'image/png', true), p2 = await GMTImgShrink(p);
    const s = await mk(800, 600, 'image/jpeg'), s2 = await GMTImgShrink(s);
    const g = new File([new Uint8Array([71, 73, 70])], 'a.gif', { type: 'image/gif' }), g2 = await GMTImgShrink(g);
    return { j: [j.size, j2.size, j2.type, await dims(j2)], p: [p2.type, await dims(p2), await alphaAt0(p2)], same: s2 === s, gif: g2 === g };
  });
  ok(r.j[2] === 'image/jpeg' && r.j[3][0] === 2000 && r.j[3][1] === 1500 && r.j[1] < r.j[0], '① JPEG 4000×3000 ⇒ ' + r.j[3].join('×') + ' · ' + Math.round(r.j[0] / 1024) + ' ⇐ ' + Math.round(r.j[1] / 1024) + ' ك.ب');
  ok(r.p[0] === 'image/png' && r.p[1][0] === 2000 && r.p[2] === 0, '② PNG ⇒ ' + r.p[1].join('×') + ' والزاوية شفّافة (alpha=' + r.p[2] + ')');
  ok(r.same, '③ الصغيرة كما هي');
  ok(r.gif, '④ GIF كما هو');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
