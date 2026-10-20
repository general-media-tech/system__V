// (20 ت1 · TASK-0115) ما لم يُختبر من برومبتات 18 ت1: إيصالٌ مجعّد (الماسح) · فرعان متشابهان (بنك الفروع) · الفرع الافتراضي المعطَّل (أولوية الفرع)
const H = require('./h.js'); const fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const src = fs.readFileSync(__dirname + '/t_docscan.js', 'utf8');
const SYNTH = src.slice(src.indexOf('const SYNTH = `') + 'const SYNTH = `'.length, src.indexOf('`;', src.indexOf('const SYNTH = `')));
(async () => {
  for (const w of [390, 1366]) {
    console.log('— ' + w);
    await H.seed();
    const { browser, pg, errs } = await H.open('orders.html', { w, mobile: w < 700, wait: 4000, init: H.ADMIN_INIT + SYNTH });
    // ١) إيصالٌ مجعّد: طيّاتٌ داكنة على الورقة + حافّةٌ غير منتظمة (تعرّجات بلون الخلفية) + ميلان
    const r = await pg.evaluate(() => {
      const quad = [[360, 110], [835, 160], [790, 815], [330, 760]];
      const c = __synth({ quad }), x = c.getContext('2d');
      x.save(); x.lineWidth = 7; [[[420, 300], [760, 420]], [[400, 600], [770, 520]], [[560, 140], [520, 790]]].forEach(([a, b]) => {
        const g = x.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, 'rgba(0,0,0,.05)'); g.addColorStop(.5, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,.05)');
        x.strokeStyle = g; x.beginPath(); x.moveTo(a[0], a[1]); x.quadraticCurveTo((a[0] + b[0]) / 2 + 25, (a[1] + b[1]) / 2 - 20, b[0], b[1]); x.stroke(); });
      x.fillStyle = '#3a3f46';   // تعرّجات صغيرة على الحافّة اليمنى واليسرى (ليست عند علامات الأركان)
      for (let t = .25; t < .75; t += .06) { const L = [quad[0][0] + (quad[3][0] - quad[0][0]) * t, quad[0][1] + (quad[3][1] - quad[0][1]) * t], R = [quad[1][0] + (quad[2][0] - quad[1][0]) * t, quad[1][1] + (quad[2][1] - quad[1][1]) * t];
        x.beginPath(); x.arc(L[0] - 2, L[1], 5, 0, 6.3); x.fill(); x.beginPath(); x.arc(R[0] + 2, R[1], 5, 0, 6.3); x.fill(); }
      x.restore(); c.naturalWidth = c.width; c.naturalHeight = c.height;
      const det = GMTDocScan.detectNorm(c, 0), out = GMTDocScan.process(c, det.corners, 0, 'color');
      const want = quad.map(p => [p[0] / c.width, p[1] / c.height]);
      const err = det.corners.reduce((m, p, i) => Math.max(m, Math.hypot(p[0] - want[i][0], p[1] - want[i][1])), 0);
      return { ok: det.ok, err: +err.toFixed(3), ink: __inkCorners(out), why: det.why };
    });
    ok(r.ink.every(Boolean), 'مجعّد: لم تُقصّ أيّ زاوية (علامات الأركان الأربع ظاهرة) ' + JSON.stringify(r.ink));
    ok(r.ok && r.err < 0.06, 'مجعّد: الحواف اكتُشفت رغم الطيّات والتعرّجات (أكبر خطأ ' + r.err + ') ' + (r.why || ''));
    // ٢) فرعان باسمين متشابهين ⇒ لا تخمين: قائمة بالاثنين
    await pg.evaluate(() => { GMTMuftiBank.data.added.push({ city: 'حلب', name: 'الشهباء ١' }, { city: 'حلب', name: 'الشهباء ٢' }); });
    const m = await pg.evaluate(() => GMTReceipt._matchBranch('حلب الشهباء'));
    ok(!m.confident && !m.key && m.candidates.includes('حلب|الشهباء ١') && m.candidates.includes('حلب|الشهباء ٢'), 'فرعان متشابهان ⇒ غير مؤكّد ويُعرض الاثنان للاختيار: ' + JSON.stringify(m.candidates));
    const m2 = await pg.evaluate(() => GMTReceipt._matchBranch('حلب الفرقان'));
    ok(m2.confident && m2.key === 'حلب|الفرقان', 'فرعٌ واضح ما زال يُعتمد تلقائياً (الفرقان)');
    // ٣) الفرع الافتراضي المعطَّل في البنك ⇒ تنبيهٌ صريح ولا فرع عشوائي
    const d = await pg.evaluate(async () => {
      shipFromSetting = 'حلب|السريان'; GMTMuftiBank.data.disabled['حلب|السريان'] = true;
      const a = shipFromDefault();
      const sel = document.createElement('select'); document.body.appendChild(sel); shipFromFill(sel, a.key || '');
      delete GMTMuftiBank.data.disabled['حلب|السريان'];
      return { key: a.key, why: a.why, val: sel.value, b: shipFromDefault().key };
    });
    ok(d.key === null && /معطَّلٌ في/.test(d.why), 'الافتراضي المعطَّل ⇒ لا مفتاح + تنبيه «معطَّل في بنك الفروع»: ' + d.why);
    ok(d.val === '', 'ولا يُختار فرعٌ بديل عشوائياً (القائمة على «اختر الفرع»)');
    ok(d.b === 'حلب|السريان', 'إعادة تفعيله ⇒ يعود افتراضياً');
    const real = errs.filter(e => !/Failed to load resource/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
