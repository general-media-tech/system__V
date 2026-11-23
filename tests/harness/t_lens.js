// (TASK-A0576 · المالك seq 974) «عدسة GMT» — صوّر المنتج/العلبة ⇒ أقرب منتجاتنا في الجرد (لا غوغل) ⇒ يُفتح سطره في الجرد
//  (A0580) المطابقة المحلّية أوّلاً؛ «🤖 اسأل العقل» اختياريّ — ثمّ ① العقل يقرأ ما على العلبة ⇒ الترتيب بالأسماء البديلة والموديل ⇒ العقل يقارن الصور ويختار ⇒ «🎯» على الصحيح
//  ② «هذا هو» ⇒ سطره في جرد نقطة البيع والمؤشّر في خانة العدد   ③ الأدمن: ما على العلبة يُضاف لأسمائه البديلة (بلا تكرار)
//  ④ بالكتابة وحدها (بلا صورة): «BWX169» ⇒ بطارية أفاتا أوّلاً
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const IMG = '/img/p/catalog/f88a9047-1532-41f7-96ee-29dacae1ff3d/07c75432802b.jpg';
(async () => {
  await H.seed();
  const [A, B, C] = await H.call('/rest/v1/products', [
    { name: 'DJI Avata 2 — Fly More Combo', barcode: 'LN1', price: 1400, daraa: 2, alt_names: 'Avata 2 Combo، افاتا تو', image_url: H.BASE + IMG },
    { name: 'Avata Battery BWX169-2420-14.76 بطارية', barcode: 'LN2', price: 78, daraa: 4, alt_names: 'بطارية أفاتا، DJI Avata battery', image_url: H.BASE + IMG },
    { name: 'DJI Mini 4K — كومبو قياسي', barcode: 'LN3', price: 520, daraa: 1, image_url: H.BASE + IMG }]);
  const { browser, pg, errs, ctx } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const calls = [];
  await ctx.route('**/functions/v1/gmt-vision', async r => {
    const b = JSON.parse(r.request().postData() || '{}'); calls.push(b);
    const ans = /name_on_box/.test(b.question)
      ? JSON.stringify({ brand: 'DJI', product_type: 'درون', name_on_box: 'DJI Avata 2 Fly More Combo', model: 'Avata 2', compat: '', texts: ['DJI', 'AVATA 2', 'Fly More Combo'], arabic_name: 'أفاتا 2 كومبو', query: 'DJI Avata 2 Fly More Combo' })
      : JSON.stringify({ pick: 1, confidence: 91, why: 'العلبة نفسها — Avata 2 Fly More' });
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ answer: ans }) });
  });
  await pg.evaluate(() => { GMTRole.grant('المالك'); try { localStorage.removeItem('gmt_stockcount_' + branch.key); } catch (_) {} openStockCount(); }); await sleep(1200);
  await pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  // ①
  await pg.evaluate(() => scOpenLens()); await pg.waitForFunction(() => { const r = document.getElementById('gmt-lens'); return r && r.hasAttribute('data-ready'); }, null, { timeout: 90000 });
  await pg.setInputFiles('#gmt-lens [data-file]', require('path').join(__dirname, '../..', IMG));
  await pg.waitForSelector('#gmt-lens .it', { timeout: 60000 });
  ok(calls.length === 0, '⓪ (seq 979) المطابقة محلّية أوّلاً — لا نداء للعقل قبل «🤖 اسأل العقل»');
  await pg.click('#gmt-lens [data-ai]'); await pg.waitForFunction(() => /اختار العقل|اختر المنتج|لم يجب/.test(document.querySelector('#gmt-lens [data-st]').innerText), null, { timeout: 20000 }); await sleep(300);
  const s1 = await pg.evaluate(() => ({ read: (document.querySelector('#gmt-lens [data-read]') || {}).innerText || '', items: [...document.querySelectorAll('#gmt-lens .it')].map(x => ({ best: x.classList.contains('best'), t: x.querySelector('.nm').innerText })), st: document.querySelector('#gmt-lens [data-st]').innerText, learn: !!document.querySelector('#gmt-lens [data-learn]') }));
  ok(/Avata 2 Fly More Combo/.test(s1.read), '① العقل قرأ ما على العلبة: ' + s1.read.replace(/\s+/g, ' ').slice(0, 80));
  ok(s1.items.length >= 2 && /Avata 2/.test(s1.items[0].t) && s1.items[0].best, '① الأقرب أوّلاً و«🎯» عليه (اختيار العقل بالصور): ' + s1.items.map(x => (x.best ? '🎯' : '') + x.t.slice(0, 30)).join(' | '));
  ok(calls.length === 2 && calls[1].image && /STORE|يمين/.test(calls[1].question), '① استدعاءان للعقل: قراءة + مقارنة الصور (' + calls.length + ')');
  ok(s1.learn, '③ للأدمن: خيار «أضف ما على العلبة إلى أسمائه البديلة»');
  // ②③
  await pg.click('#gmt-lens [data-pick="0"]'); await sleep(900);
  const s2 = await pg.evaluate(id => ({ act: document.activeElement && document.activeElement.getAttribute('data-sc-id'), gone: !document.getElementById('gmt-lens') }), A.id);
  ok(s2.gone && s2.act === String(A.id), '② «هذا هو» ⇒ سطره في الجرد والمؤشّر في خانة العدد');
  const D = await H.call('/__dump', undefined, 'GET'); const a2 = D.products.find(p => p.id === A.id).alt_names;
  ok(/DJI Avata 2 Fly More Combo/.test(a2) && /أفاتا 2 كومبو/.test(a2) && /Avata 2 Combo/.test(a2) && (a2.match(/Avata 2 Combo/g) || []).length === 1, '③ أُضيف ما على العلبة لأسمائه البديلة (والقديم باقٍ بلا تكرار): ' + a2);
  // ④
  await pg.evaluate(() => scOpenLens()); await sleep(300);
  await pg.fill('#gmt-lens [data-q]', 'BWX169'); await pg.click('#gmt-lens [data-find]'); await sleep(800);
  const s4 = await pg.evaluate(() => [...document.querySelectorAll('#gmt-lens .it .nm')].map(x => x.innerText));
  ok(s4.length && /BWX169/.test(s4[0]), '④ بالكتابة وحدها: «BWX169» ⇒ بطارية أفاتا أوّلاً: ' + (s4[0] || ''));
  const real = errs.filter(x => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
