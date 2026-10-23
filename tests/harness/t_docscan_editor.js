// (23 ت1 · TASK-0131) المالك (seq 33): «ماسحٌ بمستوى CamScanner… معيار النجاح: حتى لو فشل الاكتشاف تماماً أستطيع رسم الحدود بنفسي».
// المحرّر متعدّد النقاط بالتفاعل الحقيقي (فأرة + لمس، صورٌ مُصطنعة فقط): ① صورةٌ بلا مستند ⇒ «تعذّر» أحمر ⇒ رسم الحدود من الصفر (٦ نقاط)
// ⇒ قصّ ⇒ خمسة أنماط ⇒ تراجع/إعادة ⇒ اعتماد بالمحيط والأصل · ② ورقةٌ منحنية ⇒ أكثر من ٤ نقاط ⇒ «+» يضيف · Delete يحذف · المحيط
// لا يقطع نفسه · تكبير بالعجلة وسحبٌ دقيق · Escape · ③ هاتف: رسمٌ باللمس.
const H = require('./h.js'); const fs = require('fs');
const DEV = process.env.DEV || null;   // نسخةٌ تجريبيّة من الماسح بدل ما في الصفحة (اختياري)
let fails = 0, passes = 0;
const ok = (c, m, extra) => { if (c) { passes++; console.log('  ✔', m, extra !== undefined ? JSON.stringify(extra) : ''); } else { fails++; console.log('  ✘', m, extra !== undefined ? JSON.stringify(extra) : ''); } };

async function setup(mobile) {
  const o0 = { bad: [] };
  const o = await H.open('orders.html', mobile ? { w: 390, h: 800, wait: 2500 } : { w: 1366, h: 900, wait: 2500, mobile: false });
  o.pg.on('response', r => { if (r.status() >= 400) console.log('    (طلب الصفحة', r.status(), r.url().slice(0, 110) + ')'); });
  if (DEV) { await o.pg.evaluate(() => { delete window.GMTDocScan; }); await o.pg.addScriptTag({ content: fs.readFileSync(DEV, 'utf8') }); }
  await o.pg.addScriptTag({ content: fs.readFileSync('/home/user/system__V/tests/harness/docscan_gen.js', 'utf8') });
  return o;
}
/* يفتح الماسح على صورة: spec (مُصطنعة) أو مسار ملف أو 'blank' (لا مستند) */
async function openOn(pg, src) {
  const b64 = typeof src === 'string' && src !== 'blank' ? fs.readFileSync(src).toString('base64') : null;
  await pg.evaluate(async ([spec, b64]) => {
    let blob;
    if (b64) blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
    else {
      let cv;
      if (spec === 'blank') { cv = document.createElement('canvas'); cv.width = 1200; cv.height = 1600; const x = cv.getContext('2d'); for (let y = 0; y < 1600; y += 8) for (let xx = 0; xx < 1200; xx += 8) { const v = 90 + Math.random() * 30; x.fillStyle = `rgb(${v},${v * 0.9},${v * 0.8})`; x.fillRect(xx, y, 8, 8); } }
      else cv = __mkCase(spec, __thermal(false)).cv;
      blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
    }
    window.__file = new File([blob], 'r.jpg', { type: 'image/jpeg' });
    window.__out = undefined;
    GMTDocScan.open(window.__file, {}).then(v => { window.__out = v; });
  }, [typeof src === 'string' ? (b64 ? null : src) : src, b64]);
  await pg.waitForFunction(() => { const m = document.querySelector('#gds .gds-msg'); return m && m.textContent && !/جارٍ اكتشاف/.test(m.textContent); }, null, { timeout: 15000 });
  await pg.waitForTimeout(150);
}
const st = pg => pg.evaluate(() => {
  const r = document.querySelector('#gds .gds-wrap').getBoundingClientRect(), cv = document.querySelector('#gds canvas.gds-img');
  const hs = [...document.querySelectorAll('#gds .gds-h')].map(h => { const b = h.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, corner: !h.classList.contains('x'), sel: h.classList.contains('sel') }; });
  const W = cv.offsetWidth, Hh = cv.offsetHeight, m = /translate\(([-\d.]+)px, ?([-\d.]+)px\) scale\(([\d.]+)\)/.exec(cv.style.transform || '') || [0, 0, 0, 1];
  const tx = +m[1], ty = +m[2], z = +m[3];
  const P = hs.map(h => [(h.x - r.left - tx) / (W * z), (h.y - r.top - ty) / (Hh * z)]);
  return { msg: document.querySelector('#gds .gds-msg').textContent, col: getComputedStyle(document.querySelector('#gds')).getPropertyValue('--gds-c').trim(), hs, P, simple: P.length >= 3 ? GMTDocScan._poly.simple(P) : true, rect: [r.left, r.top, W, Hh], z, tx, ty, ghosts: [...document.querySelectorAll('#gds .gds-g')].filter(g => g.style.display !== 'none').map(g => { const b = g.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }), btns: [...document.querySelectorAll('#gds button')].filter(b => b.offsetParent).map(b => b.textContent) };
});
/* الرموز التعبيريّة في الأزرار تُستبدل بأيقونات (gmt-icons) ⇒ المطابقة بالنصّ بلا رموز: تطابقٌ تامّ أوّلاً ثمّ احتواء */
const click = (pg, txt) => pg.evaluate(t => { const strip = x => x.replace(/[^\p{L}\p{N}+−\s«»]/gu, '').trim(), T = strip(t), bs = [...document.querySelectorAll('#gds button')].filter(b => b.offsetParent);
  const b = bs.find(b => strip(b.textContent) === T) || bs.find(b => strip(b.textContent).includes(T)); if (!b) throw new Error('no button ' + t); b.click(); return true; }, txt);
const scr = (s, nx, ny) => [s.rect[0] + s.tx + nx * s.rect[2] * s.z, s.rect[1] + s.ty + ny * s.rect[3] * s.z];
async function drag(pg, from, to, steps = 8) { await pg.mouse.move(from[0], from[1]); await pg.mouse.down(); await pg.mouse.move(to[0], to[1], { steps }); await pg.mouse.up(); await pg.waitForTimeout(60); }
const resultSig = pg => pg.evaluate(() => { const c = document.querySelector('#gds canvas.gds-img'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0, sat = 0; for (let i = 0; i < d.length; i += 4 * 97) { s += d[i] + d[i + 1] * 3 + d[i + 2] * 7; sat += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); } return { w: c.width, h: c.height, s, sat }; });

(async () => {
  /* ═══ ١) كمبيوتر · صورةٌ بلا مستند ⇒ تعذّر (أحمر) ⇒ رسم الحدود من الصفر بـ٦ نقاط ⇒ قصّ ⇒ أنماط ⇒ تراجع ⇒ اعتماد ═══ */
  console.log('١) لا مستند ⇒ رسمٌ يدويّ من الصفر (كمبيوتر)');
  let { browser, pg, errs } = await setup(false);
  await openOn(pg, 'blank');
  let s = await st(pg);
  ok(/تعذّر/.test(s.msg) && s.col === '#ef4444', 'الحالة: تعذّر + أحمر', [s.msg.slice(0, 40), s.col]);
  await click(pg, 'رسم الحدود'); s = await st(pg);
  ok(s.hs.length === 0 && s.btns.some(b => b.includes('إغلاق المحيط')), 'وضع الرسم: لا نقاط + زرّ الإغلاق');
  const hex = [[0.3, 0.12], [0.7, 0.1], [0.85, 0.5], [0.72, 0.9], [0.28, 0.88], [0.14, 0.5]];
  for (const p of hex) { const q = scr(s, p[0], p[1]); await pg.mouse.click(q[0], q[1]); await pg.waitForTimeout(40); }
  s = await st(pg); ok(s.hs.length === 6, 'ست نقاط مرسومة', s.hs.length);
  await pg.keyboard.press('Control+z'); s = await st(pg); ok(s.hs.length === 5, 'تراجع أثناء الرسم يحذف آخر نقطة', s.hs.length);
  { const q = scr(s, hex[5][0], hex[5][1]); await pg.mouse.click(q[0], q[1]); await pg.waitForTimeout(40); }
  s = await st(pg); { const f = s.hs[0]; await pg.mouse.click(f.x, f.y); await pg.waitForTimeout(80); }   // الضغط على الأولى يُغلق
  s = await st(pg);
  ok(/رسمتها بنفسك \(6 نقطة\)/.test(s.msg) && s.col === '#22c55e', 'أُغلق المحيط: حالة يدويّة خضراء', s.msg.slice(0, 50));
  ok(s.hs.length === 6 && s.hs.filter(h => h.corner).length === 4, '٦ نقاط منها ٤ أركان');
  const errP = Math.max(...s.P.map((p, i) => Math.min(...hex.map(h => Math.hypot(h[0] - p[0], h[1] - p[1])))));
  ok(errP < 0.01, 'النقاط في مواضع النقر (خطأ < ١٪)', +errP.toFixed(4));
  await click(pg, 'قصّ وتحسين'); await pg.waitForFunction(() => [...document.querySelectorAll('#gds button')].some(b => b.textContent.includes('اعتماد')), null, { timeout: 15000 });
  const sigs = {};
  for (const m of ['الأصل', 'تلقائي', 'ألوان', 'رمادي', 'أبيض وأسود']) { await click(pg, m); await pg.waitForTimeout(400); sigs[m] = await resultSig(pg); }
  const uniq = new Set(Object.values(sigs).map(v => v.s)).size;
  ok(uniq === 5, 'خمسة أنماط ⇒ خمس نسخٍ مختلفة', uniq);
  ok(sigs['رمادي'].sat < 50 && sigs['أبيض وأسود'].sat < 50, 'الرمادي والأبيض/أسود بلا ألوان', [sigs['رمادي'].sat, sigs['أبيض وأسود'].sat]);
  await click(pg, 'تلقائي'); await pg.waitForTimeout(300);
  ok(JSON.stringify(await resultSig(pg)) === JSON.stringify(sigs['تلقائي']), 'العودة لنمطٍ سابق تعطي النسخة نفسها (الأصل محفوظ)');
  await click(pg, 'قارن بالأصل'); await pg.waitForTimeout(150); const so = await resultSig(pg); ok(so.w > so.h * 0.5 && so.s !== sigs['تلقائي'].s, 'قارن بالأصل يعرض الصورة الأصلية');
  await click(pg, 'النسخة الممسوحة'); await pg.waitForTimeout(150);
  await click(pg, 'تعديل الحدود'); await pg.waitForTimeout(150); s = await st(pg);
  ok(s.hs.length === 6, 'تعديل الحدود يعيد المحيط نفسه', s.hs.length);
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(80); s = await st(pg); ok(s.hs.length === 4, 'تراجع بعد الإغلاق ⇒ الحدود قبل الرسم (٤)', s.hs.length);
  await pg.keyboard.press('Control+y'); await pg.waitForTimeout(80); s = await st(pg); ok(s.hs.length === 6, 'إعادة ⇒ المحيط المرسوم (٦)', s.hs.length);
  await click(pg, 'قصّ وتحسين'); await pg.waitForFunction(() => [...document.querySelectorAll('#gds button')].some(b => b.textContent.includes('اعتماد')), null, { timeout: 15000 });
  await click(pg, 'اعتماد'); await pg.waitForFunction(() => window.__out !== undefined, null, { timeout: 8000 });
  let out = await pg.evaluate(() => ({ orig: window.__out.original === window.__file, size: window.__out.scanned && window.__out.scanned.size, poly: window.__out.poly && window.__out.poly.length, ci: window.__out.ci, corners: window.__out.corners.length, status: window.__out.status, gone: !document.getElementById('gds') }));
  ok(out.orig && out.size > 5000 && out.poly === 6 && out.ci.length === 4 && out.corners === 4 && out.status === 'manual' && out.gone, 'اعتماد: الأصل + الممسوحة + المحيط (٦) + الأركان (٤)', out);

  /* ═══ ٢) كمبيوتر · ورقةٌ منحنية ⇒ اكتشافٌ بأكثر من ٤ نقاط ⇒ إضافة/حذف/تراجع ⇒ منع التقاطع ⇒ تكبير ═══ */
  console.log('٢) ورقة منحنية: نقاطٌ تتبع الحدود + تعديل');
  await openOn(pg, { bg: 'dark', curve: 0.035, quad: [[.15, .12], [.85, .12], [.85, .88], [.15, .88]] });
  s = await st(pg); const n0 = s.hs.length;
  ok(/اكتُشفت/.test(s.msg) && s.col === '#22c55e' && n0 > 4, 'اكتُشفت (أخضر) بأكثر من ٤ نقاط', [s.msg.slice(0, 50), n0]);
  ok(s.ghosts.length >= 3, '«+» على الأضلاع', s.ghosts.length);
  { const g = s.ghosts[0]; await drag(pg, [g.x, g.y], [g.x + 6, g.y - 4]); }
  s = await st(pg); ok(s.hs.length === n0 + 1 && s.simple, 'سحب «+» يضيف نقطة', s.hs.length);
  const xi = s.hs.findIndex(h => !h.corner);
  await pg.mouse.click(s.hs[xi].x, s.hs[xi].y); await pg.keyboard.press('Delete'); await pg.waitForTimeout(60);
  s = await st(pg); ok(s.hs.length === n0, 'تحديد نقطة + Delete يحذفها', s.hs.length);
  await click(pg, '↶ تراجع'); s = await st(pg); ok(s.hs.length === n0 + 1, 'تراجع يعيدها', s.hs.length);
  await click(pg, '↷ إعادة'); s = await st(pg); ok(s.hs.length === n0, 'إعادة تحذفها ثانيةً', s.hs.length);
  for (let k = 0; k < 3; k++) await click(pg, '➕ نقطة');
  s = await st(pg); ok(s.hs.length === n0 + 3 && s.simple, '«➕ نقطة» ×٣ ⇒ +٣ نقاط', s.hs.length);
  /* سحب ركن أعلى-يسار عبر الورقة إلى ما بعد الركن المقابل ⇒ يُرفض الموضع الذي يقطع المحيط */
  const tl = s.hs.find(h => h.corner); const br = scr(s, 0.97, 0.97);
  await drag(pg, [tl.x, tl.y], br, 20); s = await st(pg);
  ok(s.simple, 'المحيط لا يقطع نفسه بعد سحبٍ عبر الورقة', s.simple);
  await click(pg, '↶ تراجع');
  /* تكبير ×٢ بالعجلة ثمّ سحب ركنٍ إلى موضعٍ محدّد ⇒ إحداثيّاته صحيحة */
  { const t0 = s.hs.find(h => h.corner); await pg.mouse.move(t0.x + 30, t0.y + 30); for (let k = 0; k < 4; k++) { await pg.mouse.wheel(0, -120); await pg.waitForTimeout(30); } }   // تكبيرٌ عند ركن ⇒ يبقى ظاهراً
  s = await st(pg); ok(s.z > 1.5, 'تكبير بالعجلة', +s.z.toFixed(2));
  { const h = s.hs.find(h2 => h2.corner && h2.x > s.rect[0] && h2.y > s.rect[1] && h2.x < s.rect[0] + s.rect[2] && h2.y < s.rect[1] + s.rect[3]);
    if (h) { const i = s.hs.indexOf(h), target = [s.P[i][0] + 0.02, s.P[i][1] + 0.015], to = scr(s, target[0], target[1]); await drag(pg, [h.x, h.y], to);
      const s2 = await st(pg); ok(Math.hypot(s2.P[i][0] - target[0], s2.P[i][1] - target[1]) < 0.004, 'سحبٌ وهي مكبَّرة يضع النقطة بدقّة', [s2.P[i], target]); }
    else ok(false, 'ركنٌ ظاهر وهي مكبَّرة'); }
  await click(pg, '−'); await click(pg, '−'); await click(pg, '−'); s = await st(pg); ok(s.z === 1, 'تصغير للأصل', s.z);
  await click(pg, 'اكتشاف تلقائي'); await pg.waitForTimeout(100);   // الاكتشاف في عامله (TASK-0137) ⇒ يُنتظر انتهاؤه لا زمنٌ ثابت
  await pg.waitForFunction(() => !/جارٍ اكتشاف/.test(document.querySelector('#gds .gds-msg').textContent), null, { timeout: 10000 }); await pg.waitForTimeout(100); s = await st(pg); ok(s.hs.length === n0 && /اكتُشفت/.test(s.msg), 'اكتشاف تلقائي يعيد المحيط المكتشف', s.hs.length);
  await click(pg, 'قصّ وتحسين'); await pg.waitForFunction(() => [...document.querySelectorAll('#gds button')].some(b => b.textContent.includes('اعتماد')), null, { timeout: 15000 });
  await click(pg, 'اعتماد'); await pg.waitForFunction(() => window.__out !== undefined, null, { timeout: 8000 });
  out = await pg.evaluate(() => ({ poly: window.__out.poly && window.__out.poly.length, status: window.__out.status, w: window.__out.width, h: window.__out.height }));
  ok(out.poly === n0 && out.status === 'ok', 'اعتماد المكتشَف: المحيط كاملاً + حالة ok', out);
  /* Escape يلغي الرسم ولا يغلق الماسح · Escape ثانية يغلقه ⇒ null */
  await openOn(pg, { bg: 'wood', quad: [[.2, .1], [.8, .12], [.82, .9], [.18, .88]] });
  s = await st(pg); const n1 = s.hs.length;
  await click(pg, 'رسم الحدود'); { const q = scr(s, 0.3, 0.3); await pg.mouse.click(q[0], q[1]); }
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(80); s = await st(pg);
  ok(s.hs.length === n1 && !!(await pg.$('#gds')), 'Escape يلغي الرسم ويعيد المحيط', s.hs.length);
  await pg.keyboard.press('Escape'); await pg.waitForFunction(() => window.__out !== undefined, null, { timeout: 4000 });
  ok(await pg.evaluate(() => window.__out === null && !document.getElementById('gds')), 'Escape ثانية يغلق الماسح (null)');
  ok(!errs.filter(e => !/Failed to load resource/.test(e)).length, 'لا أخطاء في الصفحة', errs);
  await browser.close();

  /* ═══ ٣) هاتف (لمس) · إيصالٌ منحنٍ ⇒ رسمٌ باللمس ⇒ قصّ ⇒ اعتماد ═══ */
  console.log('٣) هاتف: رسمٌ باللمس');
  ({ browser, pg, errs } = await setup(true));
  await openOn(pg, { bg: 'cloth', curve: 0.03, quad: [[.25, .08], [.92, .25], [.75, .93], [.08, .76]] });
  s = await st(pg); console.log('    الحالة:', s.msg, '· نقاط', s.hs.length);
  ok(s.btns.some(b => b.includes('رسم الحدود')) && s.btns.some(b => b.includes('قصّ وتحسين')), 'الأزرار ظاهرة على الهاتف', s.btns);
  const noOverflow = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok(noOverflow, 'لا تمرير أفقي على الهاتف');
  await click(pg, 'رسم الحدود'); s = await st(pg);
  const oct = [[0.25, 0.1], [0.5, 0.08], [0.75, 0.1], [0.8, 0.5], [0.75, 0.9], [0.5, 0.92], [0.25, 0.9], [0.2, 0.5]];
  for (const p of oct) { const q = scr(s, p[0], p[1]); await pg.touchscreen.tap(q[0], q[1]); await pg.waitForTimeout(50); }
  s = await st(pg); ok(s.hs.length === 8, 'ثماني نقاط باللمس', s.hs.length);
  await click(pg, 'إغلاق المحيط'); s = await st(pg);
  ok(/رسمتها بنفسك \(8 نقطة\)/.test(s.msg), 'أُغلق المحيط بالزرّ', s.msg.slice(0, 40));
  await click(pg, 'قصّ وتحسين'); await pg.waitForFunction(() => [...document.querySelectorAll('#gds button')].some(b => b.textContent.includes('اعتماد')), null, { timeout: 20000 });
  const rs = await resultSig(pg); ok(rs.w > 100 && rs.h > 100, 'نسخة ممسوحة', [rs.w, rs.h]);
  await click(pg, 'اعتماد'); await pg.waitForFunction(() => window.__out !== undefined, null, { timeout: 8000 });
  out = await pg.evaluate(() => ({ poly: window.__out.poly && window.__out.poly.length, size: window.__out.scanned.size }));
  ok(out.poly === 8 && out.size > 5000, 'اعتماد على الهاتف', out);
  ok(!errs.filter(e => !/Failed to load resource/.test(e)).length, 'لا أخطاء في الصفحة', errs);
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${passes + fails}` : `ALL PASS (${passes})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
