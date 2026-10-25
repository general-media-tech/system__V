// (25 ت1 · TASK-0178) المالك: «انظر هذا الإيصال … لم يستطع تحديده تلقائياً أداة التحديد» (إيصال مسارات أبيض باليد فوق جينز أزرق فاتح
// ومقعدٍ داكن: اختير حدّ الجينز مع المقعد لأنّه أقوى، فضمّ الرباعيُّ الجينزَ) + seq 100 «هون كتير — طوّل» («جارٍ القصّ…» طويلاً).
// ١) صورة مصطنعة بالتركيب نفسه ⇒ الحدود حول الورقة لا حول الجينز (صور المالك الحقيقيّة خارج المستودع العامّ — قيست في الجلسة).
// ٢) «قصّ وتحسين» في عاملٍ ثانٍ: لا ينتظر قراءة الرمز الجارية (حتى ١٥ث بلا رمز) — يكتمل قبلها وبزمنٍ قريب من زمنه وحده.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, mobile: true, wait: 3500 });
  const r = await pg.evaluate(async () => {
    const W = 720, Hh = 1280, c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d');
    // كما في صورة المالك: مقعدٌ داكن، وفوقه جينز أزرق فاتح على شكل شريطٍ حول الإيصال من أعلاه ويمينه بحدودٍ موازيةٍ لحوافّه (حدّ الجينز
    // مع المقعد أقوى من حدّ الورقة مع الجينز) · ضوءٌ مزرقّ على الصورة كلّها
    const P = { cx: 300, cy: 660, w: 400, h: 900, a: 7 * Math.PI / 180 };
    const rq = (dx0, dy0, dx1, dy1) => { x.save(); x.translate(P.cx, P.cy); x.rotate(P.a); x.fillRect(-P.w / 2 + dx0, -P.h / 2 + dy0, P.w - dx0 + dx1, P.h - dy0 + dy1); x.restore(); };
    x.fillStyle = '#1b2130'; x.fillRect(0, 0, W, Hh);
    /* الجينز: حدّه مع المقعد متموّجٌ كالقماش (ثنيات) لا مستطيلٌ ثانٍ — ويمتدّ تحت الإيصال حتى أسفل الصورة */
    x.fillStyle = '#8ea6c4'; x.beginPath(); x.moveTo(0, Hh);
    for (let k = 0; k <= 40; k++) { const t = k / 40, px = t * W * 0.62, py = 80 + 120 * t + 22 * Math.sin(t * 13); x.lineTo(px, py); }
    for (let k = 0; k <= 40; k++) { const t = k / 40, px = W * 0.62 + 120 * t + 26 * Math.sin(t * 11 + 1), py = 200 + t * (Hh - 200); x.lineTo(px, py); }
    x.lineTo(0, Hh); x.closePath(); x.fill();
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 20000; i++) { const v = rnd(), px = rnd() * W, py = rnd() * Hh; const d = x.getImageData(px | 0, py | 0, 1, 1).data; if (d[0] < 60) continue; x.fillStyle = v < 0.5 ? 'rgba(110,130,165,.4)' : 'rgba(175,195,220,.4)'; x.fillRect(px, py, 2, 2); }
    // الإيصال: أبيض مزرقّ مائل ٧° · جدولٌ ونصّ
    x.save(); x.translate(P.cx, P.cy); x.rotate(P.a);
    x.fillStyle = '#dfe9f6'; x.fillRect(-P.w / 2, -P.h / 2, P.w, P.h);
    x.strokeStyle = '#3b4a5a'; x.lineWidth = 2; x.strokeRect(-P.w / 2 + 30, -P.h / 2 + 260, P.w - 60, 420);
    for (let k = 1; k < 6; k++) { x.beginPath(); x.moveTo(-P.w / 2 + 30, -P.h / 2 + 260 + k * 70); x.lineTo(P.w / 2 - 30, -P.h / 2 + 260 + k * 70); x.stroke(); }
    x.fillStyle = '#2a3442'; x.font = 'bold 34px Arial'; for (let k = 0; k < 4; k++) x.fillText('مسارات اكسبرس 4100123', -P.w / 2 + 40, -P.h / 2 + 80 + k * 45);
    x.font = '22px Arial'; for (let k = 0; k < 6; k++) x.fillText('المرسل اليه — دمشق 0933000000', -P.w / 2 + 45, -P.h / 2 + 300 + k * 70);
    x.restore();
    // إبهامٌ فوق الحافّة اليسرى
    x.fillStyle = '#c9a99a'; x.beginPath(); x.ellipse(110, 760, 70, 230, 0.12, 0, Math.PI * 2); x.fill();
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const px = u * P.w / 2, py = v * P.h / 2; return [(P.cx + px * Math.cos(P.a) - py * Math.sin(P.a)) / W, (P.cy + px * Math.sin(P.a) + py * Math.cos(P.a)) / Hh]; });
    const det = GMTDocScan.detectNorm(c, 0);
    // التداخل (IoU) بين الرباعيّ المكتشف وحدود الورقة — بشبكة عيّنات
    const inQ = (q, px, py) => { let sg = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], cr = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]); if (!cr) continue; if (!sg) sg = Math.sign(cr); else if (Math.sign(cr) !== sg) return false; } return true; };
    let I = 0, U = 0, outPaper = 0, nD = 0;
    for (let py = 0.005; py < 1; py += 0.01) for (let px = 0.005; px < 1; px += 0.01) { const a = inQ(det.corners, px, py), b = inQ(corners, px, py); if (a && b) I++; if (a || b) U++; if (a) { nD++; if (!b) outPaper++; } }
    return { ok: det.ok, how: det.how, iou: +(I / U).toFixed(2), extra: +(outPaper / Math.max(1, nD)).toFixed(2), q: det.corners.map(p => p.map(v => +v.toFixed(2))), png: c.toDataURL('image/jpeg', 0.85) };
  });
  require('fs').writeFileSync('/tmp/gmt-out/t_docscan_cases_jeans.jpg', Buffer.from(r.png.split(',')[1], 'base64'));
  ok(r.ok && r.iou >= 0.8 && r.extra <= 0.15, 'ورقةٌ بيضاء باليد فوق جينزٍ أزرق ومقعدٍ داكن ⇒ الحدود حول الورقة (تداخل ' + r.iou + ' · خارج الورقة ' + r.extra + ' · ' + r.how + '): ' + JSON.stringify(r.q));

  // ٢) القصّ لا ينتظر قراءة الرمز: عاملٌ ثانٍ (يُعدّ إنشاء العمّال) — والزمن للعلم (هذا الجهاز سريع فلا يُظهر الانتظار كالهاتف)
  await pg.evaluate(() => { window.__workers = []; const Wk = window.Worker; window.Worker = function (u, o) { __workers.push(String(u)); return new Wk(u, o); }; window.Worker.prototype = Wk.prototype; });
  const t = await pg.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 3200; const x = c.getContext('2d');
    x.fillStyle = '#6b7280'; x.fillRect(0, 0, 2400, 3200); x.fillStyle = '#f8fafc'; x.fillRect(200, 300, 2000, 2600);
    x.fillStyle = '#111'; x.font = '60px Arial'; for (let k = 0; k < 30; k++) x.fillText('سطر نصّ بلا رمزٍ مقروء ' + k, 300, 420 + k * 80);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)), cs = [[0.08, 0.09], [0.92, 0.09], [0.92, 0.91], [0.08, 0.91]];
    const f1 = new File([b], 'a.jpg', { type: 'image/jpeg' }), f2 = new File([b], 'b.jpg', { type: 'image/jpeg' });
    let t0 = performance.now(); const alone = await GMTReceipt.processIn(f1, cs, 0, 'color', [2400, 3200]); const tAlone = performance.now() - t0;
    const r0 = performance.now(); let readEnd = 0; const rd = GMTReceipt.readTracking(f2, { ocr: false, budgetMs: 8000 }).then(() => { readEnd = performance.now(); });
    await new Promise(r => setTimeout(r, 400));
    t0 = performance.now(); const cv = await GMTReceipt.processIn(f2, cs, 0, 'color', [2400, 3200]); const tBusy = performance.now() - t0, procEnd = performance.now();
    await rd;
    return { alone: !!alone, cv: !!cv, tAlone: Math.round(tAlone), tBusy: Math.round(tBusy), readMs: Math.round(readEnd - r0), beforeRead: procEnd < readEnd, workers: __workers.filter(u => /gmt-receipt\.js/.test(u)).length };
  });
  ok(t.alone && t.cv && t.workers === 2, '«قصّ وتحسين» في عاملٍ ثانٍ غير عامل قراءة الرمز (عمّال القارئ: ' + t.workers + ')');
  ok(t.beforeRead, '«قصّ وتحسين» أثناء قراءة الرمز يكتمل قبلها (' + t.tBusy + 'مث · وحده ' + t.tAlone + 'مث · القراءة ' + t.readMs + 'مث)');
  const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|Estimating resolution/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
