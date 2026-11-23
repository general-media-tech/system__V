// (TASK-A0580 · المالك seq A1010) «ولما نشغّل العقل تستفيد وتتعلّم من تجاربه» · «لا تعتمد الصورة دوماً على النصّ — على الشكل ومضمون العلبة»
//  ① الموظّف: «🤖 اسأل العقل» ⇒ «هذا هو» ⇒ عيّنة شكل + أسماء العقل بانتظار الاعتماد (from_ai) · وسجلّ البحث used_ai
//  ② الأدمن يعتمدها ⇒ ما قرأه العقل يُضاف لأسماء المنتج البديلة (بلا تكرار) ⇒ المرّة القادمة يُعرف محلّياً
//  ③ لقطة بلا كتابة مفيدة (الشكل وحده) ⇒ العيّنة المعتمدة تجعله الأوّل
const H = require('./h.js'), path = require('path');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const FLT = x => !/status of (400|401|404|406|409|500|503)|Failed to load resource|getUserMedia|NotFoundError|Requested device not found|ERR_FAILED|net::|diacritics|Estimating resolution/.test(x);
(async () => {
  await H.seed();
  const IMG = u => H.BASE + u;
  const [YM] = await H.call('/rest/v1/products', [
    { name: 'كشاف تصوير رأس موجّه أبيض', barcode: 'AI1', price: 120, daraa: 3, group_name: 'هيد لايت', alt_names: 'رأس إضاءة', image_url: IMG('/img/p/products/1779352715903.jpg') },
    { name: 'Led 600 RGB', barcode: 'AI2', price: 47, daraa: 2, group_name: 'بانيل ليد', image_url: IMG('/img/p/products/10718594-6d70-4f51-8da0-b086aaf7c98d/1791734736756.jpg') },
    { name: 'قشاط يد كمرا', barcode: 'AI3', price: 5, daraa: 2, group_name: 'لوازم', image_url: IMG('/img/p/catalog/8765a1e0-8659-4717-adaf-ae22b79f3254/07ad6bb06f02.jpg') }]);
  let o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  await o.ctx.route('**/functions/v1/gmt-vision', r => {
    const b = JSON.parse(r.request().postData() || '{}');
    const ans = /name_on_box/.test(b.question) ? JSON.stringify({ brand: 'YUANMAN', product_type: 'إضاءة', name_on_box: 'YM-600-SS LED Photographic fill light', model: 'YM-600-SS', texts: ['YM-600-SS'], arabic_name: 'رأس إضاءة', query: 'YM-600-SS' })
      : JSON.stringify({ pick: 1, confidence: 90, why: 'العلبة نفسها' });
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ answer: ans }) });
  });
  await o.pg.evaluate(() => { try { localStorage.removeItem('gmt_lens_samples_local'); } catch (_) {} openStockCount(); }); await o.pg.waitForTimeout(1200);
  await o.pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  await o.pg.evaluate(() => scOpenLens());
  await o.pg.waitForFunction(() => { const r = document.getElementById('gmt-lens'); return r && r.getAttribute('data-ready') === '1'; }, null, { timeout: 90000 });
  await o.pg.setInputFiles('#gmt-lens [data-file]', path.join(__dirname, 'fixtures/lens_shot_ym600_b.jpg'));
  await o.pg.waitForFunction(() => /اختر المنتج|لا تطابق/.test(document.querySelector('#gmt-lens [data-st]').innerText), null, { timeout: 120000 });
  await o.pg.waitForTimeout(800);
  await o.pg.click('#gmt-lens [data-ai]');
  await o.pg.waitForFunction(() => /اختار العقل|اختر المنتج|لم يجب/.test(document.querySelector('#gmt-lens [data-st]').innerText) && !!document.querySelector('#gmt-lens [data-read] .rd'), null, { timeout: 20000 }); await o.pg.waitForTimeout(400);
  const idx = await o.pg.evaluate(() => [...document.querySelectorAll('#gmt-lens [data-res] .it .nm')].findIndex(x => /كشاف تصوير رأس/.test(x.innerText)));
  ok(idx >= 0, '① منتج العلبة بين الاقتراحات بعد العقل (' + idx + ')');
  await o.pg.click(`#gmt-lens [data-pick="${Math.max(0, idx)}"]`); await o.pg.waitForTimeout(1800);
  let D = await H.call('/__dump', undefined, 'GET');
  const sm = (D.gmt_lens_samples || []).filter(s => String(s.product_id) === String(YM.id));
  ok(sm.length === 1 && sm[0].from_ai === true && sm[0].approved === false && /YM-600-SS/.test(sm[0].names || ''), '① عيّنة شكل من تجربة العقل + أسماؤه بانتظار الاعتماد: ' + (sm[0] && sm[0].names));
  const lg = (D.gmt_lens_log || []).slice(-1)[0] || {};
  ok(lg.used_ai === true && /YM-600-SS/.test(lg.ai_read || '') && String(lg.picked_id) === String(YM.id), '① سجلّ البحث: استُعمل العقل وما قرأه وما اختير');
  ok(!o.errs.filter(FLT).length, 'لا أخطاء JS: ' + JSON.stringify(o.errs.filter(FLT).slice(0, 2)));
  await o.browser.close();
  // ② الأدمن يعتمد
  o = await H.open('pos.html', { init: H.ADMIN_INIT, w: 390, mobile: true, wait: 7000 });
  await o.pg.evaluate(() => { try { GMTRole.grant('المالك'); } catch (_) {} try { localStorage.removeItem('gmt_lens_samples_local'); } catch (_) {} openStockCount(); }); await o.pg.waitForTimeout(1200);
  await o.pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  await o.pg.evaluate(() => scOpenLens());
  await o.pg.waitForSelector('#gmt-lens [data-learnq]:not([hidden])', { timeout: 90000 });
  await o.pg.click('#gmt-lens [data-learnq]'); await o.pg.waitForTimeout(300);
  const pend = await o.pg.evaluate(() => (document.querySelector('#gmt-lens [data-lq] [data-from-ai]') ? '🤖 ' : '') + document.querySelector('#gmt-lens [data-lq]').innerText);
  ok(/🤖/.test(pend) && /YM-600-SS/.test(pend), '② الأدمن يرى تجربة العقل (🤖 + الأسماء): ' + pend.replace(/\s+/g, ' ').slice(0, 90));
  await o.pg.click('#gmt-lens [data-lok]'); await o.pg.waitForTimeout(1500);
  D = await H.call('/__dump', undefined, 'GET');
  const p2 = D.products.find(p => p.id === YM.id), s2 = (D.gmt_lens_samples || []).find(s => String(s.product_id) === String(YM.id));
  ok(s2 && s2.approved === true, '② العيّنة معتمدة');
  ok(/YM-600-SS/.test(p2.alt_names) && /رأس إضاءة/.test(p2.alt_names) && (p2.alt_names.match(/رأس إضاءة/g) || []).length === 1, '② أسماء العقل أُضيفت للأسماء البديلة بلا تكرار: ' + p2.alt_names);
  await o.browser.close();
  o = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, mobile: true, wait: 7000 });
  await o.pg.evaluate(() => { try { localStorage.removeItem('gmt_lens_samples_local'); } catch (_) {} openStockCount(); }); await o.pg.waitForTimeout(1200);
  await o.pg.waitForFunction(() => !!window.GMTLens, null, { timeout: 8000 });
  // ③ الشكل وحده: لقطة الهود/المنتج بلا كتابة ⇒ العيّنة المعتمدة (نفس اللقطة) تجعله أوّلاً
  await o.pg.evaluate(() => scOpenLens());
  await o.pg.waitForFunction(() => { const r = document.getElementById('gmt-lens'); return r && r.getAttribute('data-ready') === '1'; }, null, { timeout: 90000 });
  await o.pg.evaluate(() => { window.GMTLensLocal.ocr = async () => []; });   // لا كتابة: الشكل وحده
  await o.pg.setInputFiles('#gmt-lens [data-file]', path.join(__dirname, 'fixtures/lens_shot_ym600_b.jpg'));
  await o.pg.waitForFunction(() => /اختر المنتج|لا تطابق/.test(document.querySelector('#gmt-lens [data-st]').innerText), null, { timeout: 120000 });
  const top = await o.pg.evaluate(() => [...document.querySelectorAll('#gmt-lens [data-res] .it .nm')].map(x => x.innerText));
  if (!top.length) console.log('    DEBUG', await o.pg.evaluate(() => { const S = document.getElementById('gmt-lens')._S; return JSON.stringify({ st: document.querySelector('#gmt-lens [data-st]').innerText, vis: (S.vis || []).length, vec: !!S.vec, res: document.querySelector('#gmt-lens [data-res]').innerText.slice(0, 120) }); }));
  ok(/كشاف تصوير رأس/.test(top[0] || ''), '③ بالشكل وحده (بلا كتابة) يعرفه أوّلاً بعد التعلّم: ' + top.slice(0, 3).join(' | '));
  ok(!o.errs.filter(FLT).length, 'لا أخطاء JS: ' + JSON.stringify(o.errs.filter(FLT).slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
