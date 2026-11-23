// (TASK-A0580 · المالك seq 979 · 998 · 1002) «العدسة الذكيّة 2.0» — محلّية على الجهاز بلا ذكاء اصطناعي ولا مفتاح
//  ① صورة هود على خلفية عشوائية ⇒ الهود الصحيح ضمن أوّل ٥ (والأوّل غالباً) — بلا أيّ نداء لـ gmt-vision
//  ② بلا كاميرا (المتصفّح الآليّ) ⇒ «🖼️ صورة من الجهاز» تعمل · النتائج «👁️ xx%»
//  ③ «📂 النوع المحتمل» ⇒ كلّ منتجات النوع   ④ «🔗 متوافق مع R50» ⇒ كفر R50 وشاحن LP-E17 (لا كفر R5 ولا 250D)
//  ⑤ «هذا هو» ⇒ عيّنة تعلّم في gmt_lens_samples (للموظّف: بانتظار الاعتماد + صورة مصغّرة) ⇒ المرّة القادمة «مُتعلَّم»
//  ⑥ «🤖 اسأل العقل» اختياري فقط
const H = require('./h.js'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const I = {
  hood: '/img/p/products/b575df2c-df7d-4474-abff-4cbc0a101c34/b64_3cf77e664e6e.png',
  strap: '/img/p/products/1779352715903.jpg',
  cover: '/img/p/products/10810fea-3aaf-439a-80c8-d9c76466ae81/1779541053588.jpg',
  bat: '/img/p/products/eb21375f-7deb-4eb5-be5b-76b3cd86b991/1786748057421.jpg',
  soft: '/img/products/shixin2/z95.jpg',
  chg: '/img/p/catalog/b19dd73a-cc69-4d5e-b357-b90abc0ed192/2294eb9b6903.jpg',
  tri: '/img/p/lens_8bb9b192-9576-4d10-8d52-90dab4afcd73_1793347416266.jpg',
  mic: '/img/p/products/7d12cf63-3d51-4457-97f5-d73a6ef059a6/1776542522676.jpg'
};
(async () => {
  await H.seed();
  const P = await H.call('/rest/v1/products', [
    { name: 'ET-86 lens hood هود', barcode: 'LL1', price: 9, daraa: 3, group_name: 'هودات العدسات', image_url: H.BASE + I.hood },
    { name: 'قشاط يد كمرا', barcode: 'LL2', price: 5, daraa: 3, group_name: 'لوازم أخرى', image_url: H.BASE + I.strap },
    { name: 'كفر سيليكون EOS R50', barcode: 'LL3', price: 12, daraa: 2, group_name: 'كفرات سيليكون', compat: 'Canon EOS R50', image_url: H.BASE + I.cover },
    { name: 'كفر سيليكون EOS R5', barcode: 'LL4', price: 14, daraa: 2, group_name: 'كفرات سيليكون', compat: 'Canon EOS R5', image_url: H.BASE + I.cover },
    { name: 'كفر سيليكون EOS 250D / 200D', barcode: 'LL5', price: 12, daraa: 2, group_name: 'كفرات سيليكون', image_url: H.BASE + I.cover },
    { name: 'بطارية DJI Mini 2 BWX161', barcode: 'LL6', price: 40, daraa: 2, group_name: 'ملحقات الدرون', image_url: H.BASE + I.bat },
    { name: 'سوفت بوكس 50x70', barcode: 'LL7', price: 30, daraa: 2, group_name: 'سوفت بوكس', image_url: H.BASE + I.soft },
    { name: 'شاحن ثلاثي LP-E17 USB', barcode: 'LL8', price: 15, daraa: 2, group_name: 'بطاريات وشواحن', image_url: H.BASE + I.chg },
    { name: 'Tripod 330A ترايبود', barcode: 'LL9', price: 25, daraa: 2, group_name: 'ترايبود', image_url: H.BASE + I.tri },
    { name: 'مايك لاسلكي Lavalier', barcode: 'LL10', price: 35, daraa: 2, group_name: 'مايكات', image_url: H.BASE + I.mic }]);
  const HOOD = P[0];
  const { browser, pg, errs, ctx } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const ai = []; await ctx.route('**/functions/v1/gmt-vision', r => { ai.push(1); r.fulfill({ status: 500, body: '{}' }); });
  await pg.evaluate(() => { try { localStorage.removeItem('gmt_stockcount_' + branch.key); localStorage.removeItem('gmt_lens_samples_local'); } catch (_) {} openStockCount(); }); await sleep(1200);
  await pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  await pg.evaluate(() => scOpenLens());
  // ② بلا كاميرا ⇒ زرّ الصورة من الجهاز
  await pg.waitForFunction(() => { const r = document.getElementById('gmt-lens'); return r && r.hasAttribute('data-ready'); }, null, { timeout: 90000 });
  const cam = await pg.evaluate(() => ({ camHidden: document.querySelector('#gmt-lens [data-cam]').hidden, local: !!window.GMTLensLocal, tf: !!window.tf }));
  ok(cam.local && cam.tf, '② العين المحلّية حُمّلت من موقعنا (tfjs + النموذج) — بلا خادم');
  // (المنتجات العشرة ليست في الفهرس — منتجات اختبار ⇒ تُحسب بصماتها من صورها عند اللقطة) تحسب بصمات المنتجات العشرة من صورها (ليست في الفهرس — منتجات اختبار)
  const t0 = Date.now();
  await pg.setInputFiles('#gmt-lens [data-file]', path.join(__dirname, 'fixtures/lens_shot_hood.jpg'));
  await pg.waitForSelector('#gmt-lens .it', { timeout: 60000 }).catch(async e => { console.log(await pg.evaluate(() => ({ st: document.querySelector('#gmt-lens [data-st]').innerText, res: document.querySelector('#gmt-lens [data-res]').innerText.slice(0, 200), n: scProducts().length, be: window.tf && tf.getBackend(), vis: (document.getElementById('gmt-lens')._S.vis || []).slice(0, 4).map(r => [r.item.name, r.vis]), vec: !!document.getElementById('gmt-lens')._S.vec }))); console.log(errs.slice(-6)); throw e; });
  const ms = Date.now() - t0;
  const s1 = await pg.evaluate(() => ({ items: [...document.querySelectorAll('#gmt-lens [data-res] .it')].map(x => ({ t: x.querySelector('.nm').innerText, bd: x.innerText })), st: document.querySelector('#gmt-lens [data-st]').innerText }));
  const top5 = s1.items.slice(0, 5).map(x => x.t);
  ok(top5.some(t => /ET-86/.test(t)), '① الهود الصحيح ضمن الاقتراحات (' + ms + ' م.ث): ' + top5.map(t => t.slice(0, 22)).join(' | '));
  ok(/ET-86/.test(top5[0] || ''), '① وهو الأوّل');
  ok(s1.items.length >= 3 && s1.items.length <= 5, '① عدّة اقتراحات لأختار (٣–٥): ' + s1.items.length);
  ok(/\d+%/.test(s1.items[0].bd), '② الاقتراح يبيّن نسبة شبه الصورة: ' + s1.items[0].bd.replace(/\s+/g, ' ').slice(0, 90));
  ok(ai.length === 0, '⑥ لا نداء للعقل/الذكاء الاصطناعي في المطابقة (' + ai.length + ')');
  // ③ النوع
  // ④ التوافق وحده (بلا حصر بالنوع)
  await pg.fill('#gmt-lens [data-compat]', 'R50'); await pg.click('#gmt-lens [data-compat-go]'); await sleep(500);
  const s4 = await pg.evaluate(() => [...document.querySelectorAll('#gmt-lens [data-res] .it .nm')].map(x => x.innerText));
  ok(s4.some(t => /كفر.*R50/.test(t)) && !s4.some(t => /R5$|R5 |250D/.test(t)) && s4.some(t => /LP-E17/.test(t)), '④ «متوافق مع R50» ⇒ كفر R50 + شاحن LP-E17 (بطارية R50 — من دليل التوافقيات) · لا كفر R5 ولا 250D: ' + s4.join(' | '));
  await pg.evaluate(() => { const s = document.querySelector('#gmt-lens [data-unscope]'); if (s) s.click(); }); await sleep(300);
  await pg.fill('#gmt-lens [data-compat]', ''); await pg.click('#gmt-lens [data-compat-go]'); await sleep(300);
  const scopeBtn = await pg.evaluate(() => { const s = document.querySelector('#gmt-lens [data-scope]'); return s ? s.innerText : ''; });
  ok(/اعرض كلّ هذا النوع/.test(scopeBtn), '③ «📂 النوع المحتمل» مع «اعرض كلّ هذا النوع»: ' + scopeBtn);
  // ⑤ التعلّم
  const idx = await pg.evaluate(() => [...document.querySelectorAll('#gmt-lens [data-res] .it .nm')].findIndex(x => /ET-86/.test(x.innerText)));
  await pg.click(`#gmt-lens [data-pick="${Math.max(0, idx)}"]`); await sleep(1200);
  const D = await H.call('/__dump', undefined, 'GET');
  const smp = (D.gmt_lens_samples || []).filter(s => String(s.product_id) === String(HOOD.id));
  ok(smp.length === 1 && smp[0].approved === false && /^3:/.test(smp[0].vec) && /^data:image\/jpeg/.test(smp[0].thumb || ''), '⑤ اختيار الموظّف ⇒ عيّنة تعلّم بانتظار اعتماد الأدمن (مع صورة مصغّرة)');
  const loc = await pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_lens_samples_local') || '[]').length);
  ok(loc === 1, '⑤ وتعمل على جهازه فوراً (' + loc + ')');
  // ⑤ المرّة القادمة: اللقطة نفسها ⇒ «مُتعلَّم» أعلى
  await pg.evaluate(() => scOpenLens()); await pg.waitForFunction(() => { const r = document.getElementById('gmt-lens'); return r && r.hasAttribute('data-ready'); }, null, { timeout: 30000 });
  await pg.setInputFiles('#gmt-lens [data-file]', path.join(__dirname, 'fixtures/lens_shot_hood.jpg'));
  await pg.waitForSelector('#gmt-lens .it', { timeout: 60000 });
  const s5 = await pg.evaluate(() => [...document.querySelectorAll('#gmt-lens [data-res] .it')].map(x => x.innerText));
  ok(/ET-86/.test(s5[0] || '') && /9\d%|100%/.test(s5[0]), '⑤ المرّة القادمة: يعرفه أوّلاً بثقة عالية: ' + (s5[0] || '').replace(/\s+/g, ' ').slice(0, 60));
  // ⑥ العقل اختياريّ
  const aiBtn = await pg.evaluate(() => { const b = document.querySelector('#gmt-lens [data-ai]'); return !!b && !b.closest('[hidden]'); });
  ok(aiBtn, '⑥ زرّ «🤖 اسأل العقل (اختياري)» موجود لمن يريده');
  const real = errs.filter(x => !/status of (400|401|404|406|409|500|503)|Failed to load resource|getUserMedia|NotFoundError|Requested device not found|Estimating resolution/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
