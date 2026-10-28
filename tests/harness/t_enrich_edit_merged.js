// (TASK-0256 · المالك seq 175 · 177 · 178) «هاي الميزه نفسها في ميزه التعبئه التلقائيه للجميع … نقص هون وهنيك … الدمج» ⇐ «شاشة مراجعة واحدة»
// · «ابحث بنفسك … من جهازك … موجوده فقط في تجهيز كل ما ليس لهم مواصفات وليست موجوده لكل منتج على حده» · (TASK-0258 · seq 179) رابط صورة من غوغل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const row = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const BRAIN = `window.__brainStub = function () {
  GMTBrain.importProduct = async function (o) { const n = (o.hint || '').split(' — ')[0];
    const res = { name: n, name_en: 'EN ' + n, brand: 'Godox', model: 'M-1', description_ar: 'وصف ' + n, specs: [{ k: 'الأبعاد', v: '15×17 سم' }], compat: ['Canon 600EX'], aliases_ar: [], aliases_en: ['Godox M1'], images: ['https://img.example/a.png'] };
    Object.defineProperty(res, '_meta', { value: { from_memory: false }, enumerable: false }); return res; }; };`;
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const ids = prods.filter((p, i) => i % 2 === 0).map(p => String(p.id));
    const mob = W < 500;
    const { browser, pg, ctx, errs } = await H.open('inventory.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000, init: H.ADMIN_INIT + BRAIN });
    await ctx.route('https://img.example/**', r => r.fulfill({ status: 200, body: PNG, headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' } }));
    await ctx.route(/\/storage\/v1\/object\/products-images\//, r => r.fulfill({ status: 200, body: '{}', headers: { 'Content-Type': 'application/json' } }));
    await pg.evaluate(() => { localStorage.removeItem('gmt_enrich_queue_v1'); window.__brainStub(); });
    await pg.evaluate(() => { gmtEnrichPick(); }); await pg.waitForSelector('#gmt-enrich-pick [data-pk]');
    await pg.click('#gmt-enrich-pick [data-pk="g:إضاءة"]');
    const t0 = Date.now(); while (Date.now() - t0 < 20000) { if (await pg.evaluate(() => { const s = GMTEnrichQueue.state(); return s && s.items[0].st === 'ready'; })) break; await sleep(250); }
    // ① الزرّ في بطاقة الجاهز ⇒ صفحة المنتج نفسها مُعبّأة بما جهّزه العقل
    const has = await pg.evaluate(() => !!document.querySelector('#gmt-enrich-q [data-act="edit"]'));
    ok(has, W + ': بطاقة المنتج الجاهز فيها «✏️ راجِعه في صفحة المنتج (كل الأدوات)»');
    await pg.evaluate(() => document.querySelector('#gmt-enrich-q [data-act="edit"]').click());
    await pg.waitForSelector('#gmt-pe [data-pe-rows]', { timeout: 10000 }).catch(() => {});
    const v = await pg.evaluate(() => ({ top: (() => { const r = document.getElementById('gmt-pe').getBoundingClientRect(); const e = document.elementFromPoint(r.width / 2, 30); return !!(e && e.closest('#gmt-pe')); })(),
      rows: [...document.querySelectorAll('#gmt-pe .pe-row')].map(r => r.querySelector('[data-rk]').value + '=' + r.querySelector('[data-rv]').value),
      desc: document.querySelector('#gmt-pe [data-f="__desc"]').value, brand: document.querySelector('#gmt-pe [data-f="brand"]').value, sugg: document.querySelectorAll('#gmt-pe [data-pe-sugg] figure').length,
      auto: (document.querySelector('#gmt-pe [data-pe-auto]') || {}).textContent, tools: ['[data-pe-lensgo]', '[data-pe-gimg2]', '[data-pe-ali]', '[data-pe-file]', '[data-pe-webimg]'].map(q => !!document.querySelector('#gmt-pe ' + q)) }));
    ok(v.top && v.rows.some(x => x === 'الأبعاد=15×17 سم') && /^وصف /.test(v.desc) && v.brand === 'Godox' && v.sugg === 1 && /إعادة البحث/.test(v.auto || ''),
      W + ': صفحة المنتج فوق الأداة · مُعبّأة: الجدول والوصف والماركة والصور المرشّحة: ' + JSON.stringify({ rows: v.rows, b: v.brand, s: v.sugg }));
    ok(v.tools.every(Boolean), W + ': في صفحة المنتج: عدسة غوغل · صور غوغل · علي بابا · 📷 من جهازك · صور من الويب: ' + JSON.stringify(v.tools));
    // (TASK-0258) رابط نتيجة غوغل ⇒ الصورة نفسها
    await pg.evaluate(() => { const i = document.querySelector('#gmt-pe [data-f="image_url"]'); i.value = 'https://www.google.com/imgres?q=18-135%20nano%20usm&imgurl=https%3A%2F%2Fimg.example%2Freal.png&imgrefurl=x'; i.dispatchEvent(new Event('change')); });
    ok(await pg.evaluate(() => document.querySelector('#gmt-pe [data-f="image_url"]').value) === 'https://img.example/real.png', W + ': رابط «google.com/imgres…» يصير رابط الصورة نفسها');
    // «📷 من جهازك»
    const fh = await pg.$('#gmt-pe [data-pe-file]');
    await fh.setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG }); await sleep(800);
    // (TASK-0259) إضافة لا استبدال: تُضاف لصور الجرد والرئيسية تبقى
    const up = await pg.evaluate(() => ({ main: document.querySelector('#gmt-pe [data-f="image_url"]').value, all: [...document.querySelectorAll('#gmt-pe [data-pe-invimgs] [data-u]')].map(i => i.getAttribute('data-u')) }));
    ok(up.main === 'https://img.example/real.png' && up.all.length >= 2 && /products-images\/lens_/.test(up.all[up.all.length - 1]), W + ': «📷 من جهازك» ⇒ تُرفع وتُضاف لصور الجرد (الرئيسية تبقى): ' + JSON.stringify(up).slice(0,400));
    // الحفظ في الصفحة ⇒ «حُفظ» في الأداة والتالي
    const first = await pg.evaluate(() => String(GMTEnrichQueue.state().cur));
    await pg.click('#gmt-pe [data-pe-save]'); await pg.waitForFunction(() => /حُفظ|❌/.test((document.querySelector('#gmt-pe [data-pe-msg]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    await sleep(500);
    const q = await pg.evaluate(f => { const s = GMTEnrichQueue.state(); return { st: s.items.find(x => String(x.id) === f).st, cur: String(s.cur) }; }, first);
    const db = await row(first);
    ok(q.st === 'saved' && q.cur !== first && db.specs && db.specs['الأبعاد'] === '15×17 سم' && db.brand === 'Godox', W + ': الحفظ في صفحة المنتج ⇒ في الجرد و«حُفظ» في الأداة وانتقلت للتالي: ' + JSON.stringify(q));
    await pg.evaluate(() => { const x = document.querySelector('#gmt-pe [data-pe-x]'); if (x) x.click(); });
    // (TASK-0258) في الأداة نفسها: رابط نتيجة غوغل
    await pg.evaluate(() => { const i = document.querySelector('#gmt-enrich-q [data-img-url]'); if (i) i.value = 'https://www.google.com/imgres?imgurl=https%3A%2F%2Fimg.example%2Fq.png&q=x'; const b = document.querySelector('#gmt-enrich-q [data-img-url-main]'); if (b) b.click(); });
    await sleep(800);
    const m = await pg.evaluate(() => ({ v: (document.querySelector('#gmt-enrich-q [data-img-url]') || {}).value, msg: (document.querySelector('#gmt-enrich-q [data-img-msg]') || {}).textContent }));
    ok(m.v === 'https://img.example/q.png' && !/تعذّر تنزيل/.test(m.msg || ''), W + ': أداة التجهيز: رابط «google.com/imgres» ⇒ الصورة نفسها (لا «تعذّر تنزيل الصورة»): ' + JSON.stringify(m));
    const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await pg.evaluate(() => { try { GMTEnrichQueue.close(true); } catch (_) {} });
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
