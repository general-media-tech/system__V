// (22 ت1 · TASK-0123) المالك: «الاكتشاف التلقائي لحدود الورقة مو شغّال عالسوا» — اكتشاف الحدود بالخطوط (gmt-docscan.js)
// إيصالٌ حراريٌّ مُصطنع (رماديٌّ مزرقّ · جدول · نصّ · رموز · طيّة في المنتصف) على خلفياتٍ كانت تُفشل الطريقة القديمة:
// قماشٌ أفتح من الورقة · طاولة بيضاء · يدٌ تغطّي حافّة · رزمة أوراق بجانبه · ظلّ · خشب · لوحة مفاتيح · منظور حادّ ·
// ورقةٌ تملأ الصورة ⇒ الصورة كاملة · إيصالٌ مطبوعٌ بالألوان ويدٌ على حافّته ⇒ لا قصّ. (صور المالك الحقيقية خارج المستودع.)
// (TASK-0125) + ورقةٌ تتجاوز الإطار · ركنٌ خارجه · ميلٌ حادّ · إيصالٌ من بعيد — من مسح ١٤٤ سيناريو مُصطنع (الأداة خارج المستودع).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const GEN = require('fs').readFileSync(__dirname + '/docscan_gen.js', 'utf8');
const CASES = [
  ['قماشٌ أفتح من الورقة', { bg: 'cloth', quad: [[.15, .15], [.85, .13], [.87, .85], [.13, .88]] }],
  ['طاولة بيضاء وظلّ تحت الورقة', { bg: 'white', shadowUnder: 1, quad: [[.16, .14], [.82, .12], [.86, .84], [.18, .88]] }],
  ['يدٌ تغطّي حافّة', { bg: 'dark', quad: [[.15, .06], [.86, .05], [.88, .90], [.12, .92]], hand: [.10, .55, .14, .22] }],
  ['رزمة أوراق بجانبه', { bg: 'keyboard', stack: [[0, .04], [.17, .05], [.17, .95], [0, .96]], quad: [[.17, .14], [.78, .11], [.86, .91], [.19, .89]] }],
  ['ظلٌّ متدرّج', { bg: 'cloth', shade: 1, quad: [[.15, .15], [.85, .13], [.87, .85], [.13, .88]] }],
  ['خشبٌ مخطّط ومائل', { bg: 'wood', quad: [[.30, .08], [.92, .30], [.70, .95], [.08, .72]] }],
  ['لوحة مفاتيح', { bg: 'keyboard', quad: [[.18, .12], [.84, .16], [.80, .86], [.14, .82]] }],
  ['منظورٌ حادّ', { bg: 'dark', quad: [[.30, .15], [.72, .17], [.92, .90], [.06, .86]] }],
  ['إضاءة خافتة وتشويش', { bg: 'dark', lowlight: 1, noise: 40, quad: [[.18, .12], [.84, .16], [.80, .86], [.14, .82]] }],
  ['بلاط', { bg: 'tiles', quad: [[.22, .16], [.86, .20], [.78, .88], [.12, .84]] }],
  ['إيصالٌ مجعّد (حوافّ مقوّسة)', { bg: 'keyboard', curve: 0.025, quad: [[.18, .12], [.84, .16], [.80, .86], [.14, .82]] }],
  ['أصابع على زاويتين', { bg: 'dark', quad: [[.15, .10], [.85, .08], [.88, .90], [.12, .92]], fingers: [[.15, .12, .5], [.86, .88, .5]] }],
  // (TASK-0125) من مسح السيناريوهات المُصطنعة: ورقةٌ تتجاوز إطار الصورة (كانت تُقصّ ٢٤٪) · ركنٌ خارجها · ميلٌ حادّ · إيصالٌ من بعيد (كان «الصورة كاملة»)
  ['ورقةٌ تتجاوز الإطار يميناً', { bg: 'cloth', quad: [[.20, .15], [1.12, .12], [1.15, .85], [.18, .88]], W: 1400, H: 1000 }],
  ['ورقةٌ تتجاوز الإطار يساراً (خشب)', { bg: 'wood', quad: [[-.15, .12], [.80, .15], [.82, .86], [-.12, .90]], W: 1400, H: 1000 }],
  ['ركنٌ خارج الصورة', { bg: 'cloth', quad: [[.25, -.08], [.98, .10], [.85, .92], [.08, .75]] }],
  ['مائلٌ ٣٠°', { bg: 'dark', quad: [[.35, .05], [.95, .40], [.65, .95], [.05, .60]] }],
  ['إيصالٌ مصوَّرٌ من بعيد (٨٪ من الصورة)', { bg: 'keyboard', quad: [[.35, .35], [.68, .36], [.67, .62], [.34, .61]] }],
];
(async () => {
  const { browser, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, wait: 3000, mobile: false, init: H.ADMIN_INIT });
  await pg.addScriptTag({ content: GEN });
  for (const [name, spec] of CASES) {
    const r = await pg.evaluate(spec => { const c = __mkCase(spec, __thermal(false)), t0 = performance.now(), d = GMTDocScan.detectNorm(c.cv, 0); return { ok: d.ok, how: d.how, ms: Math.round(performance.now() - t0), err: __err(d.corners, c.gt) }; }, spec);
    ok(r.ok && r.err.e <= 0.03 && r.err.cut <= 0.015, `${name}: الحدود بخطأ ${(r.err.e * 100).toFixed(1)}٪ من القطر · قصّ ${(r.err.cut * 100).toFixed(1)}٪ (${r.how} · ${r.ms}ms)`);
  }
  // ورقةٌ تملأ الصورة ⇒ الصورة كاملة (لا قصّ)
  const fill = await pg.evaluate(() => { const c = __mkCase({ bg: 'dark', quad: [[-.03, -.03], [1.03, -.03], [1.03, 1.03], [-.03, 1.03]], W: 1300, H: 700 }, __thermal(false)); const d = GMTDocScan.detectNorm(c.cv, 0); return __err(d.corners, [[0, 0], [1, 0], [1, 1], [0, 1]]); });
  ok(fill.cut <= 0.01, 'ورقةٌ تملأ الصورة ⇒ لا قصّ (' + (fill.cut * 100).toFixed(1) + '٪)');
  // إيصالٌ مطبوع بالألوان ويدٌ على حافّته: حدّ الترويسة البيضاء والجدول الملوّن «يشبه» حدّاً ⇒ لا يُقصّ نصف الإيصال
  for (const spec of [{ bg: 'dark', quad: [[.15, .06], [.86, .05], [.88, .90], [.12, .92]], hand: [.10, .55, .14, .22] }, { bg: 'wood', quad: [[-.06, .10], [.80, .05], [.86, .88], [.05, .96]] }]) {
    const r = await pg.evaluate(spec => { const c = __mkCase(spec, __thermal(true)), d = GMTDocScan.detectNorm(c.cv, 0); return __err(d.corners, c.gt); }, spec);
    ok(r.cut <= 0.02, 'إيصالٌ ملوّن (' + spec.bg + ') ⇒ لا قصّ: ' + (r.cut * 100).toFixed(1) + '٪');
  }
  // الواجهة: النافذة تظهر فوراً والزوايا تُلصق بعد لحظة · «قصّ» فوراً ⇒ يُكمَل الاكتشاف أوّلاً
  const ui = await pg.evaluate(async () => {
    const spec = { bg: 'cloth', quad: [[.15, .15], [.85, .13], [.87, .85], [.13, .88]] }, c = __mkCase(spec, __thermal(false));
    const blob = await new Promise(r => c.cv.toBlob(r, 'image/jpeg', 0.92)), file = new File([blob], 'r.jpg', { type: 'image/jpeg' });
    const pts = () => (document.querySelector('#gds polygon') || {}).getAttribute ? document.querySelector('#gds polygon').getAttribute('points') : '';
    const t0 = performance.now(); const p = GMTDocScan.open(file, { title: 'تجربة' });
    let shownAt = null, msg0 = '', before = '';
    for (let i = 0; i < 200 && shownAt == null; i++) { await new Promise(z => setTimeout(z, 5)); if (document.querySelector('#gds canvas')) { shownAt = performance.now() - t0; await new Promise(z => requestAnimationFrame(z)); msg0 = document.querySelector('#gds .gds-msg').textContent; before = pts(); } }
    await new Promise(z => setTimeout(z, 1500));
    const after = pts(), msg1 = document.querySelector('#gds .gds-msg').textContent;
    [...document.querySelectorAll('#gds button')].find(b => /إلغاء/.test(b.textContent)).click(); await p;
    // «قصّ» فوراً
    const p2 = GMTDocScan.open(file, {}); for (let i = 0; i < 200 && !document.querySelector('#gds canvas'); i++) await new Promise(z => setTimeout(z, 5));
    [...document.querySelectorAll('#gds button')].find(b => /قصّ وتحسين/.test(b.textContent)).click();
    for (let i = 0; i < 400 && !/اعتماد/.test(document.querySelector('#gds .gds-bar').textContent); i++) await new Promise(z => setTimeout(z, 10));
    const res = document.querySelector('#gds canvas'), ratio = res.width / res.height;
    [...document.querySelectorAll('#gds button')].find(b => /اعتماد/.test(b.textContent)).click(); const out = await p2;
    return { shownAt, msg0, before, after, msg1, ratio, corners: out && out.corners };
  });
  ok(ui.shownAt != null && /جارٍ اكتشاف/.test(ui.msg0), 'نافذة الماسح تظهر فوراً (' + Math.round(ui.shownAt) + 'ms) مع «جارٍ اكتشاف حدود الورقة…»');
  ok(ui.before !== ui.after && !/جارٍ/.test(ui.msg1), 'ثمّ تُلصق الزوايا على الورقة');
  ok(ui.corners && ui.corners[0][0] > 0.1 && ui.corners[0][1] > 0.1, '«قصّ» فوراً ⇒ الاكتشاف يُكمَل أوّلاً (لا الصورة كاملة): ' + JSON.stringify(ui.corners && ui.corners[0]));
  const real = errs.filter(e => !/status of (400|503)/.test(e)); ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
