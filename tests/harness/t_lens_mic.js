// (TASK-A0580 · المالك seq A1139) «هذا المايك نفسه موجود في النظام ولكن لم يتعرّف عليه — شو السبب؟»
// الجذر: ① كتابة العلبة («Wireless Lavalier Microphone» · «Wireless Microphone») اسمٌ بديل كامل للمنتج لكنّ كلماتها «عامّة» فأُهملت
//        ② العلبة نائمة على جنبها ⇒ كتابة عمودية لا تُقرأ ③ شكلٌ ضعيف (35٪) حصر النتائج بقسم «ستاندات وترايبود» فاختفت المايكات
// العين معطّلة هنا عمداً (كما على هواتف بلا WebGL) ⇒ الكتابة وحدها تكفي.
const H = require('./h.js'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const IMG = u => H.BASE + u, im = IMG('/img/p/products/1779352715903.jpg');
  await H.call('/rest/v1/products', [
    { name: 'مايك لاسلكي Lavalier يدعم مرسلين', barcode: 'MC1', price: 15, haleb: 1, group_name: 'مايك وتوابعه', alt_names: 'Wireless Lavalier Microphone، None4، مايك ياقي لاسلكي، Wireless Mic، Lavalier Lapel Mic، Clip-on Wireless Microphone، Support one to two، مايك لافالير', image_url: im },
    { name: 'مايك لاسلكي Lavalier بعلبة شحن (مرسلان)', barcode: 'MC2', price: 40, haleb: 1, group_name: 'مايك وتوابعه', alt_names: 'Wireless Lavalier Microphone، مايك لافلير لاسلكي، Wireless Mic، Clip-on Mic، Phone Lavalier Microphone، None 2', image_url: im },
    { name: 'M02', barcode: 'MC3', price: 40, haleb: 1, group_name: 'مايك وتوابعه', alt_names: 'Wireless Microphone System، None3، مايك لاسلكي، Wireless Mic، Clip-on Mic، Wireless Lavalier Mic، Wireless Microphone، Microphone Wireless، 无线收音麦克风', image_url: im },
    { name: 'Q9 USB مايك', barcode: 'MC4', price: 40, haleb: 1, group_name: 'مايك وتوابعه', alt_names: 'Wireless Microphone، ميكروفون لاسلكي، wireless mic، clip on microphone، lavalier wireless، Q9', image_url: im },
    { name: 'T50', barcode: 'MC5', price: 40, haleb: 1, group_name: 'مايك وتوابعه', alt_names: 'T50 Wireless Lavalier Microphone، T50، T50 wireless mic، T50 lavalier mic', image_url: im },
    { name: 'K16', barcode: 'MC6', price: 40, haleb: 1, group_name: 'مايك وتوابعه', alt_names: 'REMAX 2 IN 1 Magnetic Wireless Collar Microphone K16، K16، magnetic lavalier mic', image_url: im },
    { name: 'L12D', barcode: 'TR1', price: 16, haleb: 1, group_name: 'ستاندات وترايبود', alt_names: 'L12D tripod، ترايبود ذكي L12D', image_url: im },
    { name: 'L13Dترايبود ذكي مع ريمونت واضائة', barcode: 'TR2', price: 20, haleb: 1, group_name: 'ستاندات وترايبود', image_url: im },
    { name: 'ستاند 2.1م', barcode: 'TR3', price: 17, haleb: 1, group_name: 'ستاندات وترايبود', image_url: im },
    { name: 'Microphone Stand PROFESSIONAL ستاند مايك', barcode: 'TR4', price: 30, haleb: 1, group_name: 'مايك وتوابعه', alt_names: 'Microphone Stand Professional', image_url: im }]);
  const shot = async (o, file) => {
    await o.pg.evaluate(() => scOpenLens());
    await o.pg.waitForFunction(() => { const r = document.getElementById('gmt-lens'); return r && r.hasAttribute('data-ready'); }, null, { timeout: 90000 });
    await o.pg.setInputFiles('#gmt-lens [data-file]', path.join(__dirname, 'fixtures', file));
    await o.pg.waitForFunction(() => /اختر المنتج|لا تطابق|لم أعرفه/.test((document.querySelector('#gmt-lens [data-st]') || {}).innerText || ''), null, { timeout: 150000 }).catch(() => {});
    return o.pg.evaluate(() => ({ words: (document.getElementById('gmt-lens')._S.words || []).join(' '), read: document.querySelector('#gmt-lens [data-read]').innerText, type: (document.querySelector('#gmt-lens [data-type]') || {}).innerText || '', items: [...document.querySelectorAll('#gmt-lens [data-res] .it .nm')].map(x => x.innerText.replace(/^🎯 /, '')), st: document.querySelector('#gmt-lens [data-st]').innerText }));
  };
  const o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const ai = []; await o.ctx.route('**/functions/v1/gmt-vision', r => { ai.push(1); r.fulfill({ status: 500, body: '{}' }); });
  await o.ctx.route('**/lib/lens-model/**', r => r.abort());
  await o.pg.evaluate(() => { try { localStorage.removeItem('gmt_lens_backend'); } catch (_) {} openStockCount(); }); await o.pg.waitForTimeout(1200);
  await o.pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  const isLav = t => /Lavalier/.test(t || '');
  await o.pg.evaluate(() => scOpenLens());
  await o.pg.waitForFunction(() => { const r = document.getElementById('gmt-lens'); return r && r.hasAttribute('data-ready') && !!window.GMTLensLocal; }, null, { timeout: 90000 });
  await o.pg.evaluate(() => GMTLens.close());
  // ① الجملة على العلبة = اسمٌ بديل كامل · أو ناقصة («Lavalie» مقطوعة) — بوزنٍ أقلّ إن كانت مشتركة بين منتجاتٍ كثيرة
  const U = await o.pg.evaluate(() => {
    const L = GMTLensLocal, list = scProducts(), by = n => list.find(p => p.name === n), t = (w, n) => Math.round(L.textScore(w, by(n)) * 100) / 100;
    L.setCatalog(list);
    return { full: t(['Wireless', 'Lavalier', 'Microphone'], 'مايك لاسلكي Lavalier يدعم مرسلين'), full2: t(['Wireless', 'Lavalier', 'Microphone'], 'مايك لاسلكي Lavalier بعلبة شحن (مرسلان)'),
      part: t(['Swan', 'Wireless', 'Lavalie', 'oP', 'Supp'], 'مايك لاسلكي Lavalier يدعم مرسلين'), trip: t(['Wireless', 'Lavalier', 'Microphone'], 'L12D'),
      m02: t(['Wireless', 'Microphone', '2.4G'], 'M02'), k16: t(['Wireless', 'Microphone', '2.4G'], 'K16'),
      tt: (L.textType(['Wireless', 'Microphone', '2.4G'], list, p => p.group_name) || {}).cat || '' };
  });
  ok(U.full >= 0.6 && U.full2 >= 0.6, '① «Wireless Lavalier Microphone» ⇒ مايكا Lavalier (اسمهما البديل كاملاً): ' + U.full + ' · ' + U.full2);
  ok(U.part >= 0.5, '① قراءةٌ ناقصة «Wireless Lavalie» تكفي: ' + U.part);
  ok(U.trip === 0, '① الترايبود لا يأخذ شيئاً من الجملة: ' + U.trip);
  ok(U.m02 >= 0.5 && U.m02 > U.k16, '① «Wireless Microphone» ⇒ M02 قبل K16: ' + U.m02 + ' > ' + U.k16);
  ok(U.tt === 'مايك وتوابعه', '③ القسم من الكتابة «Wireless Microphone» ⇒ «مايك وتوابعه»: ' + U.tt);
  // ② + ③ لقطات المالك الحقيقيّة (صور شاشة — القراءة فيها ضعيفة بسبب التموّج): لا حصرٌ خاطئ بالستاندات أبداً
  for (const f of ['lens_shot_lavalier.jpg', 'lens_shot_lavalier_side.jpg', 'lens_shot_m02.jpg']) {
    const s = await shot(o, f);
    console.log('   (' + f + ') قرأ:', s.words.slice(0, 120), '⇒', s.items.slice(0, 3).join(' | '));
    ok(!/ستاندات وترايبود/.test(s.type + s.st), '③ (' + f + ') لا حصر بقسم الستاندات من شكلٍ ضعيف');
    await o.pg.evaluate(() => GMTLens.close());
  }
  // ④ معرض صور المنتج من الاقتراحات (بحثٌ مكتوب)
  await o.pg.evaluate(() => scOpenLens());
  await o.pg.waitForFunction(() => { const r = document.getElementById('gmt-lens'); return r && r.hasAttribute('data-ready'); }, null, { timeout: 90000 });
  await o.pg.evaluate(async () => { await scProducts(); });
  const g = await o.pg.evaluate(async () => {
    const r = document.getElementById('gmt-lens'), inp = [...r.querySelectorAll('input[type=text],input:not([type])')].find(x => /اكتب ما على العلبة/.test(x.placeholder || ''));
    if (!inp) return 'no-input'; inp.value = 'M02'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    const btn = [...r.querySelectorAll('button')].find(b => b.textContent.trim() === 'بحث'); if (btn) btn.click();
    await new Promise(ok => setTimeout(ok, 800));
    const x = r.querySelector('[data-gal]'); if (!x) return 'no-gal:' + r.querySelector('[data-res]').innerText.slice(0, 80);
    x.click(); const ov = document.querySelector('[data-gallery]'); const res = ov ? { img: !!ov.querySelector('img'), pick: !!ov.querySelector('[data-gpick]'), w: ov.scrollWidth <= innerWidth } : 'no-ov';
    if (ov) ov.querySelector('[data-gx]').click(); return res;
  });
  ok(g && g.img && g.pick && g.w, '④ الضغط على صورة الاقتراح يفتح صور المنتج (مع «هذا هو») بلا خروج عن الشاشة: ' + JSON.stringify(g));
  await o.pg.evaluate(() => GMTLens.close());
  ok(ai.length === 0, 'بلا نداء للعقل');
  const real = o.errs.filter(x => !/status of (400|401|404|406|409|500|503)|Failed to load resource|getUserMedia|NotFoundError|Requested device not found|ERR_FAILED|net::|diacritics|Estimating resolution/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
