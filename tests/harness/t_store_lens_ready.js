// (TASK-0369 · المالك seq 643) «اسأل جوجل» كان يفتح صفحة انتظار «جارٍ تجهيز صورة المنتج…» ويطول ⇒ بطاقة جاهزة مسبقاً تُفتح بها العدسة فوراً
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const key = p => hash([p.name || '', (p.specs || []).map(x => String(x.label || '') + ':' + String(x.value == null ? '' : x.value)).join('|'), p.compat || '', (p.images || [])[0] || ''].join('§'));
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const P = { id: 'p_lens 1', name: 'لوح الاختبار RL-150', price: 76, category_id: 'c0', images: [H.BASE + 'logo.jpg'], specs: [{ label: 'القدرة', value: '150 واط' }, { label: 'الطول', value: '80 سم' }], compat: 'ستاند إضاءة' };
const Q = { id: 'p_nocard', name: 'منتج بلا بطاقة', price: 5, category_id: 'c0', images: [H.BASE + 'logo.jpg'], specs: [{ label: 'أ', value: 'ب' }] };
const store = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [], products: [P, Q] };
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-13T10:00:00Z', ...store }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 }); const pg = o.pg;
  await o.ctx.route(/\/storage\/v1\/object\/public\/products-images\/store\/home\.json/, r => r.fulfill({ status: 404, body: '' }));
  let idxReq = 0;
  await o.ctx.route(/\/img\/lens\/index\.json/, r => { idxReq++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: 1, items: { [P.id]: key(P) } }) }); });
  await pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(6000);
  await pg.evaluate(() => { window.__op = []; window.open = function (u) { window.__op.push(String(u)); return { document: { body: {} }, location: {}, close() {} }; }; });
  ok(idxReq === 0, 'الفهرس لا يُطلب قبل فتح منتج (لا حمل على الواجهة)');
  await pg.evaluate(id => openProductModal(id), P.id); await pg.waitForTimeout(1500);
  ok(idxReq === 1, 'فتح المنتج ⇒ يُحمَّل فهرس البطاقات الجاهزة مرّة واحدة');
  const t0 = Date.now(); await pg.click('#pm-ai-fab'); const op = await pg.evaluate(() => window.__op); const dt = Date.now() - t0;
  const u = decodeURIComponent(op[0] || '');
  ok(op.length === 1 && /^https:\/\/lens\.google\.com\/uploadbyurl\?hl=ar&url=/.test(op[0]) && /\/img\/lens\/p_lens_1\.jpg\?h=/.test(u) && !op.some(x => /about:blank/.test(x)), 'الضغطة تفتح عدسة جوجل فوراً على البطاقة الجاهزة — بلا صفحة «جارٍ التجهيز» (' + dt + 'ms): ' + u.slice(0, 110));
  ok(dt < 1500, 'فوري: ' + dt + 'ms');
  // تغيّرت بيانات المنتج بعد توليد بطاقته ⇒ المسار القديم (لا بطاقة قديمة بمواصفاتٍ خاطئة)
  await pg.evaluate(id => { const p = store.products.find(x => x.id === id); p.specs = [{ label: 'القدرة', value: '200 واط' }]; window.__op = []; }, P.id);
  ok(await pg.evaluate(() => gmtLensReady()) === '', 'مواصفاتٌ تغيّرت بعد توليد البطاقة ⇒ لا تُستعمل البطاقة القديمة');
  await pg.evaluate(() => { closeModal('product-modal'); }); await pg.evaluate(id => openProductModal(id), Q.id); await pg.waitForTimeout(900);
  ok(await pg.evaluate(() => gmtLensReady()) === '' && idxReq === 1, 'منتج بلا بطاقة ⇒ المسار القديم يبقى يعمل، والفهرس لا يُعاد تحميله');
  const real = o.errs.filter(x => !/status of (400|401|404|406|503)|Failed to load resource/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
