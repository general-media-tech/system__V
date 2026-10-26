// (26 ت1 · TASK-0187) المالك seq 120: «خلّي العقل يبحث عن التوافقيات على الإنترنت — الهودات والأغطية بقياس القطر، البطاريات والأشياء الأخرى —
// ما يعتمد فقط على دليل التوافقيات اللي عنده وإنّما يطوّره ويضيف عليه» · جواب seq 121: ما يجده من الإنترنت يُضاف «تلقائياً فوراً» والبحث يستعمله، وأنا أحذف الغلط.
// ① بحث Google من العقل (grounded + مصادر) ⇒ أسطر الإنترنت في gmt_compat_kb فوراً بمصدرها (بلا «قطر الفلتر» ولا عدسةٍ قطرها غيره) ⇒ البحث يجد المنتج بها
// ② ما في الدليل يُعطى للعقل («من دليلنا») ويُضاف لتوافق المنتج · لا تكرار في الدليل
// ③ بحث العقل مرفوض (429) وبلا محرّك ⇒ من الذاكرة: لا يدخل الدليل · ولا يُعاد طلب البحث المرفوض للمنتج التالي
// ④ نتائج محرّك (Brave عبر gmt-search) ⇒ كل سطرٍ بمصدره المرقّم، وسطرٌ بلا رقم لا يدخل الدليل
// ⑤ المفاتيح: الأجيال لا تتبادل (ES-68 ≠ ES-68 II) · الصنف شرط (الكاميرا لا تأخذ توافق بطاريتها · الفلتر لا يأخذ توافق الغطاء)
// ⑥ صفحة الدليل: قسم «ما أضافه العقل من الإنترنت» بالحذف (GMTAsk) · ⑦ بطاقة المراجعة «🌐 من الإنترنت» بمصادرها · ⑧ نقطة البيع تقرأ الدليل
// ⓪ قبل إنشاء الجدول (صفّ gmt_settings «compat_kb_ready» يُكتب في الهجرة نفسها): لا نداء للجدول إطلاقاً — مراقب الشبكة يسجّل كل 404 خطأً حرجاً
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const BRAIN_URL = 'https://ysawzwtmodkqqbqoiojj.supabase.co/functions/v1/gmt-brain';
const INIT = H.ADMIN_INIT + ` try { localStorage.setItem('gmt_brain_endpoint', '${BRAIN_URL}'); localStorage.removeItem('gmt_enrich_queue_v1'); localStorage.removeItem('gmt_compat_kb_v1'); localStorage.removeItem('gmt_compat_kb_ready'); } catch (_) {}`;
const kb = () => H.call('/rest/v1/gmt_compat_kb?select=*', undefined, 'GET');
const S = { mode: 'grounded', reqs: [] };
const CAP = '{"compat":["قطر الفلتر 77مم","Canon EF 24-105mm f/4L IS USM (77مم)","Canon EF 16-35mm f/2.8L II USM (82مم)","Canon EF 70-200mm f/2.8L IS II USM (77مم)"],"note":"الغطاء بالقطر"}';
async function routes(ctx) {
  await ctx.route(BRAIN_URL, async r => {
    const b = JSON.parse(r.request().postData() || '{}'), sys = b.system || '';
    const compat = /توافق إكسسوارات/.test(sys), q = String(b.question || '');
    S.reqs.push({ mode: b.mode || (compat ? 'compat' : 'complete'), web: !!b.web, q, results: /نتائج بحث الإنترنت/.test(sys), sys });
    let body;
    if (b.mode === 'product') body = { product: { name_en: 'Accessory', brand: 'Canon', specs: [{ k: 'اللون', v: 'أسود' }], compat: [] }, from_memory: true };
    else if (!compat) body = { answer: '{"specs":[],"aliases_ar":[],"aliases_en":[]}' };
    else if (S.mode === 'grounded' && b.web) {
      const ans = /ES-68/.test(q) ? '{"compat":["Canon EF 50mm f/1.8 STM"],"note":""}' : CAP;
      body = { answer: ans, provider: 'gemini', web: true, grounded: true, sources: [{ uri: 'https://www.usa.canon.example/accessories/' + (/ES-68/.test(q) ? 'es-68' : 'e-77'), title: 'usa.canon.example' }], queries: ['q'] };
    } else if (S.mode === 'results' && /نتائج بحث الإنترنت/.test(sys)) body = { answer: '{"compat":["Canon EOS 5D Mark IV [1]","Canon EOS R5 [2]","Canon EOS 90D"],"note":"أجيال LP-E6 تتبادل"}' };
    else if (b.web) body = { answer: '{"compat":["Canon EOS R6 (ذاكرة)"],"note":""}', web: true, grounded: false, sources: [], search_failed: 'gemini: HTTP 429 quota' };
    else body = { answer: '{"compat":["Canon EOS R6 (ذاكرة)"],"note":""}' };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.route('**/functions/v1/gmt-search', async r => {
    const b = JSON.parse(r.request().postData() || '{}');
    S.reqs.push({ mode: 'search:' + (b.mode || b.kind), q: b.q || '' });
    const brave = S.mode === 'results';
    if (b.mode === 'status') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ providers: { brave: { key: brave, used: 0, cap: 30 }, google: { key: false }, gemini: { key: true, used: 0, cap: 400 } } }) });
    if (!brave) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"لا مفتاح","code":"no_keys"}' });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ provider: 'brave', kind: 'web', web: [
      { title: 'LP-E6NH — Canon', url: 'https://www.canon.example/lp-e6nh', snippet: 'Compatible with EOS 5D Mark IV, EOS R5 …' },
      { title: 'EOS R5 battery', url: 'https://shop.example/r5-battery', snippet: 'LP-E6NH for EOS R5' }] }) });
  });
}
(async () => {
  const { prods } = await H.seed();
  const mk = async (name, extra) => (await H.call('/rest/v1/products', Object.assign({ name, barcode: 'KB' + Math.random().toString(36).slice(2, 8), price: 10, haleb: 3, group_name: 'اكسسوارات', category: 'تصوير' }, extra || {})))[0];
  const cap = await mk('77mm lens cap for CANON غطا'), cap2 = await mk('غطاء عدسة JJC 77mm'), filt = await mk('فلتر UV 77mm'), cap82 = await mk('82mm lens cap for CANON غطا');
  const es68 = await mk('ES-68 lens hood هود'), es68ii = await mk('ES-68 II lens hood هود'), bat = await mk('بطارية LP-E6NH'), cam = await mk('Canon EOS 5D Mark IV كاميرا'), cage = await mk('SmallRig cage for Sony A7 IV');

  // ⓪ الجدول لم يُنشأ بعد
  const z = await H.open('دليل_التوافقيات_والمواصفات.html', { w: 390, h: 844, mobile: true, wait: 3000, init: INIT });
  const kbReq = []; z.ctx.on('request', q => { if (/gmt_compat_kb/.test(q.url())) kbReq.push(q.method()); });
  const zr = await z.pg.evaluate(async () => {
    const add = await GMTCompatKB.add({ key: 'D77:cap', item: 'غطاء عدسة 77مم', kind: 'cap' }, ['Canon EF 24-105mm f/4L IS USM (77مم)']);
    await GMTCompatKB.load(true);
    return { add, txt: document.querySelector('#kb-web [data-kb-state]').textContent };
  });
  ok(zr.add === 0 && !kbReq.length && /ينتظر إنشاء جدوله/.test(zr.txt), 'قبل إنشاء الجدول: لا نداء له (لا 404 ولا إنذار) · لا إضافة · والقسم ⑪ يقول إنه ينتظر: ' + zr.txt.slice(0, 60));
  await z.browser.close();
  await H.call('/rest/v1/gmt_settings', { key: 'compat_kb_ready', value: '1' });   // كما تكتبه الهجرة

  const o = await H.open('inventory.html', { w: 1366, h: 900, mobile: false, wait: 4500, init: INIT });
  const { pg, ctx } = o; await routes(ctx);
  const imp = (p, extra) => pg.evaluate(async ([p, extra]) => {
    const r = await GMTBrain.importProduct(Object.assign({ hint: p.name + ' — Canon', pid: p.id, pname: p.name, group: 'اكسسوارات' }, extra || {}));
    return { compat: r.compat, meta: r._meta };
  }, [p, extra]);
  const find = (q, p) => pg.evaluate(([q, p]) => GMTSuggest.hitsProduct(q, p), [q, { id: p.id, name: p.name, group_name: p.group_name }]);

  // ⑤ المفاتيح
  const keys = await pg.evaluate(ps => ps.map(p => { const k = GMTCompatKB.keyOf(p); return k ? k.key + '/' + k.kind : null; }), [cap, filt, es68, es68ii, bat, { name: '58mm rubber lens hood هود' }, cage]);
  ok(JSON.stringify(keys) === JSON.stringify(['D77:cap/cap', 'D77:filter/filter', 'ES68/hood', 'ES68II/hood', 'LPE6NH/battery', 'D58:hood/hood', 'P:' + cage.id + '/other']),
    'المفاتيح: الغطاء والفلتر والهود اللولبي بالقطر · الهود البايونيت والبطارية بالكود · الأجيال لا تتبادل · الباقي بالمنتج نفسه: ' + keys.join(' · '));

  // ① بحث Google من العقل
  S.mode = 'grounded'; S.reqs = [];
  const r1 = await imp(cap);
  const k1 = await kb();
  ok(r1.meta.compat_web === true && r1.meta.kb_added === 2 && r1.meta.compat_via === 'google', 'من الإنترنت (بحث Google مع مصادر) ⇒ أُضيف للدليل فوراً: ' + JSON.stringify({ web: r1.meta.compat_web, kb: r1.meta.kb_added, via: r1.meta.compat_via }));
  ok(k1.length === 2 && k1.every(x => x.item_key === 'D77:cap' && x.kind === 'cap' && /canon\.example/.test(x.source_url) && x.origin === 'web' && x.product_name === cap.name) &&
    !k1.some(x => /قطر الفلتر|82مم/.test(x.fits)), 'الدليل: سطران بمصدرهما والمنتج الذي وجدهما — بلا «قطر الفلتر» ولا عدسة 82مم: ' + k1.map(x => x.fits).join(' | '));
  ok(S.reqs.filter(x => x.mode === 'compat').length === 1 && S.reqs.some(x => x.mode === 'compat' && x.web), 'طلب توافقٍ واحد ببحث الإنترنت (web:true) — لا طلب ذاكرةٍ بعده');
  ok(await find('غطاء 70-200', cap) && await find('غطاء عدسة 24-105', cap), 'البحث يجد الغطاء بما في الدليل ولو لم يُحفظ في المنتج («غطاء 70-200» · «غطاء عدسة 24-105»)');
  ok(!(await find('فلتر 70-200', filt)) && !(await find('غطاء 70-200', cap82)), 'الصنف والقطر شرط: فلتر 77مم وغطاء 82مم لا يأخذان توافق غطاء 77مم');
  const r1b = await imp(es68);
  ok(r1b.meta.kb_added === 1 && await find('هود عدسة 50 STM 1.8', es68) && !(await find('هود عدسة 50 STM 1.8', es68ii)), 'الهود بكوده: ES-68 ⇐ «هود عدسة 50 STM 1.8» · وES-68 II لا (جيلٌ آخر)');

  // ② ما في الدليل يُعطى للعقل ويُضاف للمنتج · بلا تكرار
  S.reqs = [];
  const r2 = await imp(cap2);
  const q2 = (S.reqs.find(x => x.mode === 'compat') || {}).q || '';
  ok(/من دليلنا: .*24-105.*70-200|من دليلنا: .*70-200.*24-105/.test(q2), 'غطاءٌ آخر 77مم: سُئل العقل ومعه «من دليلنا» ما وُجد سابقاً');
  ok(r2.meta.kb_added === 0 && (await kb()).length === 3 && r2.compat.some(x => /24-105/.test(x)), 'لا تكرار في الدليل (المفتاح نفسه D77:cap) · وتوافق المنتج فيه ما في الدليل');

  // ③ بحث العقل مرفوض وبلا محرّك ⇒ ذاكرة لا تدخل الدليل · ولا يُعاد البحث المرفوض
  S.mode = 'failed'; S.reqs = [];
  await pg.evaluate(() => { localStorage.removeItem('gmt_compat_kb_v1'); });
  const n0 = (await kb()).length;
  const r3 = await imp({ id: cage.id, name: cage.name });
  ok(r3.meta.compat_web === false && r3.meta.kb_added === 0 && (await kb()).length === n0 && r3.compat.some(x => /ذاكرة/.test(x)), 'بحث الإنترنت مرفوض (429) ولا محرّك ⇒ من الذاكرة: يُقترح في المنتج ولا يدخل الدليل');
  const r3b = await imp(bat);
  ok(S.reqs.filter(x => x.mode === 'compat' && x.web).length === 1 && r3b.meta.compat_web === false, 'المنتج التالي لا يعيد طلب البحث المرفوض (طلب web واحد لمنتجين)');

  // ④ نتائج محرّك (Brave) — صفحةٌ جديدة: حالة البحث تُقرأ من جديد
  S.mode = 'results'; S.reqs = [];
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3500);
  const r4 = await imp(bat);
  const k4 = (await kb()).filter(x => x.item_key === 'LPE6NH');
  const rq = S.reqs.find(x => x.results) || {};
  ok(S.reqs.some(x => x.mode === 'search:web' && /LP-E6NH battery compatible cameras/.test(x.q)) && /\[1\] LP-E6NH — Canon — https:\/\/www\.canon\.example\/lp-e6nh/.test(rq.sys || ''),
    'بحث العقل مرفوض ⇒ بحث Brave بكود البطارية والنتائج المرقّمة للعقل: ' + ((S.reqs.find(x => x.mode === 'search:web') || {}).q || ''));
  ok(k4.length === 2 && k4.find(x => x.fits === 'Canon EOS 5D Mark IV').source_url === 'https://www.canon.example/lp-e6nh' && k4.find(x => x.fits === 'Canon EOS R5').source_url === 'https://shop.example/r5-battery' && !k4.some(x => /90D/.test(x.fits)),
    'كل سطرٍ بمصدره المرقّم · و«90D» بلا رقمٍ لا يدخل الدليل: ' + k4.map(x => x.fits + ' ⇐ ' + x.source_url).join(' | '));
  ok(r4.meta.compat_via === 'brave' && r4.compat.includes('Canon EOS 90D') && !r4.compat.some(x => /\[\d\]/.test(x)), 'المنتج يأخذ كل الأسطر بلا أرقام المصادر · المصدر: brave');
  await pg.evaluate(() => GMTCompatKB.load(true));
  ok(await find('بطارية R5', bat) && await pg.evaluate(c => GMTCompatKB.fitsFor(c) === '', cam), 'البحث: «بطارية R5» تجد LP-E6NH · والكاميرا 5D لا تأخذ توافق البطارية (الصنف شرط)');
  const real = o.errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real.length, 'الجرد: لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();

  // ⑦ بطاقة المراجعة
  const STUB = `window.__brainStub = function () { GMTBrain.importProduct = async function (o) { await new Promise(r => setTimeout(r, 40));
    const n = (o.hint || '').split(' — ')[0]; const res = { name: n, name_en: 'EN ' + n, brand: 'Canon', model: '', description_ar: 'وصف', specs: [{ k: 'اللون', v: 'أسود' }], compat: ['Canon EF 24-105mm f/4L IS USM (77مم)'], aliases_ar: [], aliases_en: [], images: [] };
    Object.defineProperty(res, '_meta', { value: { from_memory: true, compat_added: 1, compat_web: true, kb_added: 1, compat_sources: [{ url: 'https://www.usa.canon.example/e-77', title: 'usa.canon.example' }] }, enumerable: false }); return res; }; };`;
  for (const W of [390, 1366]) {
    const e = await H.open('inventory.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 4500, init: INIT + STUB });
    await e.pg.evaluate(() => { window.__brainStub(); gmtEnrichPick(); }); await e.pg.waitForSelector('#gmt-enrich-pick [data-pk]');
    await e.pg.evaluate(() => { const b = [...document.querySelectorAll('#gmt-enrich-pick [data-pk]')].find(x => /اكسسوارات/.test(x.getAttribute('data-pk'))); if (b) b.click(); });
    let card = '';
    for (let i = 0; i < 60 && !card; i++) { await e.pg.waitForTimeout(250); card = await e.pg.evaluate(() => { const c = document.querySelector('#gmt-enrich-q [data-q-card]'); return c && c.querySelector('[data-compat-src]') ? c.innerText : ''; }); }
    ok(/من الإنترنت · أُضيف 1 لدليل التوافقيات/.test(card) && /مصادر التوافق: usa\.canon\.example/.test(card), W + ': البطاقة: «🌐 من الإنترنت · أُضيف 1 لدليل التوافقيات» ومصادره');
    const hs = await e.pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(!hs, W + ': لا تمرير أفقي');
    await e.browser.close();
  }

  // ⑥ صفحة الدليل: القسم والحذف
  for (const W of [390, 1366]) {
    const g = await H.open('دليل_التوافقيات_والمواصفات.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 3500, init: INIT });
    const txt = await g.pg.evaluate(() => document.getElementById('kb-web').innerText);
    const n = (await kb()).length;
    ok(new RegExp(n + ' سطر توافق لـ 3 قطعة').test(txt) && /غطاء عدسة 77مم/.test(txt) && /ES-68/.test(txt) && /LP-E6NH/.test(txt) && /usa\.canon\.example/.test(txt), W + ': قسم «⑪ ما أضافه العقل من الإنترنت» بالقطع ومصادرها: ' + txt.replace(/\s+/g, ' ').slice(0, 110));
    if (W === 390) await g.pg.screenshot({ path: '/tmp/gmt-out/compat_web_guide_390.png', fullPage: false });
    const hs = await g.pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(!hs, W + ': الدليل بلا تمرير أفقي');
    if (W === 1366) {
      const id = (await kb()).find(x => /90D|16-35/.test(x.fits) || x.fits === 'Canon EOS R5').id;
      await g.pg.click('[data-kb-del="' + id + '"]');
      await g.pg.waitForTimeout(400);
      await g.pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'احذف'); b.click(); });
      await g.pg.waitForTimeout(800);
      const after = await kb();
      ok(after.length === n - 1 && !after.some(x => x.id === id) && !(await g.pg.evaluate(id => !!document.querySelector('[data-kb-row="' + id + '"]'), id)), 'الحذف (✕ ثمّ «احذف» في نافذة النظام) يحذف السطر من الدليل والصفحة');
    }
    const real2 = g.errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real2.length, W + ': الدليل: لا أخطاء JS ' + real2.slice(0, 2).join(' / '));
    await g.browser.close();
  }

  // ⑧ نقطة البيع تقرأ الدليل (CONFIG لا GMT_DB)
  const p = await H.open('pos.html', { w: 390, h: 844, mobile: true, wait: 5000, init: INIT });
  await p.pg.evaluate(async () => { if (!branch) branch = { key: 'haleb', name: 'حلب' }; await GMTCompatKB.load(true); return typeof loadProducts === 'function' ? loadProducts() : null; });
  await p.pg.waitForTimeout(1500);
  const grid = await p.pg.evaluate(() => { const i = document.getElementById('searchInput'); i.value = 'غطاء 70-200'; renderProds(); return (document.getElementById('prodsGrid') || {}).innerText || ''; });
  ok(/77mm lens cap for CANON/.test(grid) && !/82mm/.test(grid), 'بحث البيع «غطاء 70-200» يجد غطاء 77مم من الدليل (لا 82مم): ' + grid.replace(/\s+/g, ' ').slice(0, 80));
  const real3 = p.errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
  ok(!real3.length, 'نقطة البيع: لا أخطاء JS ' + real3.slice(0, 2).join(' / '));
  await p.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
