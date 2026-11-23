// (TASK-A0580 · المالك seq A1006–A1007) على هاتف المالك: علبة «YM-600-SS» ⇒ «لا منتج قريب» — مع أنّ العقل عرفه.
// الجذر: «العين» (مطابقة الصور) لم تعمل على الهاتف (WebGL) فتوقّف كلّ شيء — حتى قراءة الكتابة الواضحة على العلبة.
//  ① العين معطّلة عمداً (النموذج لا يُحمَّل) ⇒ الكتابة تُقرأ محلّياً ⇒ «Ym-600ss» أوّلاً (بلا ذكاء اصطناعي)
//  ② الكود ملصوقاً: «YM-600-SS» = «Ym-600ss»   ③ لا نداء للعقل
const H = require('./h.js'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const IMG = u => H.BASE + u;
  const P = await H.call('/rest/v1/products', [
    { name: 'Ym-600ss رأس موجه ابيض شمسي', barcode: 'YM1', price: 120, daraa: 3, group_name: 'هيد لايت', alt_names: 'YM-600-SS LED Photographic Fill Light، YM-600-SS، YM600SS LED، YM-600SS Bi-Color', image_url: IMG('/img/p/lens_03eacbee-c447-4a0e-949b-4ee60fa4319b_1793289844725.jpg') },
    { name: 'ym600 ss compo plus', barcode: 'YM2', price: 150, daraa: 2, group_name: 'هيد لايت', alt_names: 'YUANMAN YM-600-SS LED Photographic Fill Light، YM-600-SS Combo Plus', image_url: IMG('/img/p/products/1781034851677.jpg') },
    { name: 'Led 600 RGB', barcode: 'YM3', price: 47.4, daraa: 2, group_name: 'بانيل ليد', alt_names: 'LED 600 RGB، ليد 600، LED-600 RGB', image_url: IMG('/img/p/products/1779352715903.jpg') },
    { name: 'BD400-SS رأس اضائة ابيض شمسي', barcode: 'YM4', price: 70, daraa: 2, group_name: 'هيد لايت', alt_names: 'BD400-SS، BEDIRO BD400', image_url: IMG('/img/p/products/10718594-6d70-4f51-8da0-b086aaf7c98d/1791734736756.jpg') },
    { name: 'BAFANG BF-100W إضاءة COB ثنائية اللون 100 واط', barcode: 'YM5', price: 0, daraa: 2, group_name: 'هيد لايت', alt_names: 'BF-100W، Bafang 100W', image_url: IMG('/img/p/catalog/8765a1e0-8659-4717-adaf-ae22b79f3254/07ad6bb06f02.jpg') },
    { name: 'YM-S100هيد', barcode: '68087145138007', price: 124, daraa: 8, group_name: 'هيد لايت', alt_names: 'YM-S100 COB Video Light، YM-S100، YM S100 video light', image_url: IMG('/img/p/products/1781034851677.jpg') },
    { name: 'Ym 800 رأس موجه اشكال', barcode: '5267955914776', price: 45, daraa: 0, group_name: 'هيد لايت', alt_names: 'YM-800 LED Photographic Spotlight، YM-800، YM800 spotlight، YM-80 LED Spotlight', image_url: IMG('/img/p/lens_03eacbee-c447-4a0e-949b-4ee60fa4319b_1793289844725.jpg') },
    { name: 'Rl 24', barcode: '6269975465416', price: 30, daraa: 2, haleb: 6, china: 20, group_name: 'بانيل ليد', alt_names: 'RL-24 LED Photographic Fill Light، RL-24، إضاءة RL24، RL24 fill light', image_url: IMG('/img/p/products/357854ba-6444-470f-a394-d7ab36c0e4ce/1793708062632.png') },
    { name: 'RL-24T مع ستاند 1.6م', barcode: 'RLT', price: 40, daraa: 0, china: 5, group_name: 'بانيل ليد', alt_names: 'RL-24T set with 1.6m stand، RL-24T، طقم RL-24 مع ستاند', image_url: IMG('/img/p/lens_c00f60ac-9b40-4cb2-8c0f-592c7ac621dd_1793476150182.jpg') },
    { name: 'Zgrl28', barcode: '5332510072031', price: 80, daraa: 1, china: 10, group_name: 'بانيل ليد', alt_names: 'ZGRL 28 LED Photographic Fill Light، ZGRL 28، RL-28 24-inch Panel Light', image_url: IMG('/img/p/products/eedee2a3-70ca-4fbe-84a1-d49122ff7fa0/1776542592064.jpg') },
    { name: 'Led pocket 88', barcode: 'YM6', price: 10, daraa: 2, group_name: 'إضاءة صغيرة', image_url: IMG('/img/p/products/1779352715903.jpg') }]);
  await H.call('/rest/v1/inv_columns', [{ key_name: 'china', display_name: 'الصين', is_branch: true, include_in_total: true, sort_order: 8 }, { key_name: 'germany', display_name: 'ألمانيا', is_branch: true, include_in_total: true, sort_order: 9 }]);   // كالقاعدة الحيّة
  const isYM = t => /^(Ym-600ss|ym600 ss)/i.test(t || '');
  const shot = async (o, file) => {
    await o.pg.evaluate(() => scOpenLens());
    await o.pg.waitForFunction(() => { const r = document.getElementById('gmt-lens'); return r && r.hasAttribute('data-ready'); }, null, { timeout: 90000 });
    await o.pg.setInputFiles('#gmt-lens [data-file]', path.join(__dirname, 'fixtures', file));
    await o.pg.waitForFunction(() => /اختر المنتج|لا تطابق/.test((document.querySelector('#gmt-lens [data-st]') || {}).innerText || ''), null, { timeout: 120000 }).catch(() => {});
    return o.pg.evaluate(() => ({ read: document.querySelector('#gmt-lens [data-read]').innerText, items: [...document.querySelectorAll('#gmt-lens [data-res] .it .nm')].map(x => x.innerText.replace(/^🎯 /, '')), st: document.querySelector('#gmt-lens [data-st]').innerText, ready: document.getElementById('gmt-lens').getAttribute('data-ready') }));
  };
  // ① العين معطّلة (كما على هاتف المالك)
  let o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  const ai = []; await o.ctx.route('**/functions/v1/gmt-vision', r => { ai.push(1); r.fulfill({ status: 500, body: '{}' }); });
  await o.ctx.route('**/lib/lens-model/**', r => r.abort());
  await o.pg.evaluate(() => { try { localStorage.removeItem('gmt_lens_backend'); } catch (_) {} openStockCount(); }); await o.pg.waitForTimeout(1200);
  await o.pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  for (const f of ['lens_shot_ym600.jpg', 'lens_shot_ym600_b.jpg']) {
    const s = await shot(o, f);
    ok(s.ready === '0', '(' + f + ') العين معطّلة فعلاً');
    ok(/600/.test(s.read) && /(YM|SS)/i.test(s.read), '① قرأ الكتابة محلّياً (الكلمات التي تخصّ منتجاتنا فقط): ' + s.read.replace(/\s+/g, ' ').slice(0, 90));
    ok(isYM(s.items[0]), '①② YM-600-SS أوّلاً من الكتابة وحدها (لا Led 600 RGB): ' + s.items.slice(0, 4).join(' | '));
    ok(!/لا منتج قريب/.test(s.st), 'لا «لا منتج قريب»: ' + s.st);
    await o.pg.evaluate(() => GMTLens.close());
  }
  { const s = await shot(o, 'lens_shot_ym800.jpg');
    ok(/Ym 800/.test(s.items[0] || ''), '⑥ (seq A1013) علبة YM-800 ⇒ «Ym 800» أوّلاً لا «YM-S100» (التي في باركودها 800): ' + s.items.slice(0, 3).join(' | '));
    await o.pg.evaluate(() => GMTLens.close()); }
  { const s = await shot(o, 'lens_shot_rl24.jpg');
    ok(/RL-?24|RL24/i.test(s.read), '⑦ (seq A1014) القراءة الثانية المكبّرة تقرأ «RL-24» على العلبة: ' + s.read.replace(/\s+/g, ' ').slice(0, 90));
    ok(/^Rl 24$/.test(s.items[0] || ''), '⑦ «Rl 24» أوّلاً: ' + s.items.slice(0, 3).join(' | '));
    ok(!s.items.some(x => /RL-24T/.test(x)), '⑧ ما على الطريق فقط (RL-24T — كمّيته بالصين ولا شيء بالفروع) لا يُقترح');
    await o.pg.evaluate(() => GMTLens.close()); }
  ok(ai.length === 0, '③ بلا نداء للعقل');
  let real = o.errs.filter(x => !/status of (400|401|404|406|409|500|503)|Failed to load resource|getUserMedia|NotFoundError|Requested device not found|ERR_FAILED|net::|diacritics|Estimating resolution/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await o.browser.close();
  // ④ العين تعمل ⇒ صورة + كتابة معاً · ⑤ سجلّ البحث يُكتب ويُكمَل بما اختير
  o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  await o.pg.evaluate(() => { try { localStorage.removeItem('gmt_lens_samples_local'); } catch (_) {} openStockCount(); }); await o.pg.waitForTimeout(1200);
  await o.pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  const s2 = await shot(o, 'lens_shot_ym600_b.jpg'); if (!s2.items.length) console.log('    DEBUG', JSON.stringify(s2).slice(0, 300), o.errs.slice(-5));
  ok(s2.ready === '1' && isYM(s2.items[0]), '④ العين + الكتابة ⇒ YM-600-SS أوّلاً: ' + s2.items.slice(0, 4).join(' | '));
  await o.pg.waitForTimeout(1500);
  let D = await H.call('/__dump', undefined, 'GET');
  const lg = (D.gmt_lens_log || []).slice(-1)[0] || {};
  ok(lg.id && Array.isArray(lg.top) && lg.top.length >= 3 && (/YM/i.test(lg.ocr || '') && /600/.test(lg.ocr || '')) && /^data:image/.test(lg.thumb || ''), '⑤ سجلّ البحث: ما قُرئ + أفضل الاقتراحات + صورة مصغّرة (' + (lg.top || []).length + ')');
  await o.pg.click('#gmt-lens [data-pick="0"]'); await o.pg.waitForTimeout(1500);
  D = await H.call('/__dump', undefined, 'GET');
  const lg2 = (D.gmt_lens_log || []).find(x => x.id === lg.id) || {};
  ok(lg2.picked_id && lg2.picked_rank === 1 && isYM(lg2.picked_name), '⑤ وما اختاره الموظّف يُكمَل في الصفّ نفسه (الترتيب ' + lg2.picked_rank + ')');
  real = o.errs.filter(x => !/status of (400|401|404|406|409|500|503)|Failed to load resource|getUserMedia|NotFoundError|Requested device not found|ERR_FAILED|net::|diacritics|Estimating resolution/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 3)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
