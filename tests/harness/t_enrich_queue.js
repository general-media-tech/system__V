// (25 ت1 · TASK-0164) المالك seq 75: «ضع أداة تعمل تلقائياً لكل المنتجات الموجودة — مجموعة مجموعة أو تصنيف تصنيف داخل الجرد …
// يزبّطهم كلهم واحد تلو الآخر، بحيث يشتغل في الخلفية: لما أنا عم راجع أوّل منتج — ممكن أعدّله أو أكتب أو أمسح أو أشوف شيء أو أضيف صور —
// يكون هو عم يشتغل على الثاني والثالث والرابع». + «البحث عن صور للمنتج من داخل النظام … لتغيير الصورة في الجرد أو لإضافة صور أخرى للمتجر».
// العقل هنا بديلٌ محلّي بتأخير (لا شبكة): نختبر الطابور والمراجعة والحفظ والصور والاستئناف، لا جودة البحث.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const row = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const BRAIN = `window.__calls = []; window.__brainStub = function () {
  GMTBrain.importProduct = async function (o) {
    window.__calls.push(o.hint || ''); await new Promise(r => setTimeout(r, 700));
    const n = (o.hint || '').split(' — ')[0], q = GMTEnrichQueue.state(), first = !!(q && q.items[0].p.name === n);   // صورٌ مرشّحة للأوّل فقط (كأنّ البحث وجدها)
    const res = { name: n, name_en: 'EN ' + n, brand: 'Godox', model: 'M-' + n.slice(-1), description_ar: 'وصف ' + n + (/ملاحظة أدق/.test(o.hint) ? ' (بعد الملاحظة)' : ''),
      specs: [{ k: 'الأبعاد', v: '15×17 سم' }, { k: 'اللون', v: 'أسود' }], compat: ['Canon 600EX'], images: first ? ['https://img.example/a.png'] : [], confidence: 'low', notes: '' };
    Object.defineProperty(res, '_meta', { value: { from_memory: !first }, enumerable: false });
    return res;
  };
};`;
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const lightIds = prods.filter((p, i) => i % 2 === 0).map(p => String(p.id));      // مجموعة «إضاءة»: 0 · 2 · 4 · 6 · 8 · 10
    for (const id of lightIds) await H.call('/rest/v1/products?id=eq.' + id, { store_url: 'store.html#product=p_1', alt_names: 'فلاش قديم' }, 'PATCH');   // كلّها مربوطة بمنتج المتجر نفسه (يكفي للاختبار)
    const nameOf = id => (prods.find(p => String(p.id) === String(id)) || {}).name;
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'إضاءة', order: 1 }],
      products: [{ id: 'p_1', name: 'منتج متجر مربوط', price: 50, images: ['https://x.example/old.jpg'], category_id: 'c1' }] }]);
    const mob = W < 500, size = { w: W, h: mob ? 844 : 900, mobile: mob };
    const o = await H.open('inventory.html', Object.assign({ wait: 5000, init: H.ADMIN_INIT + BRAIN }, size));
    const { pg, ctx, errs } = o;
    await ctx.route('https://img.example/**', r => r.fulfill({ status: 200, body: PNG, headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' } }));
    await pg.evaluate(() => { localStorage.removeItem('gmt_enrich_queue_v1'); window.__brainStub(); });
    const st = () => pg.evaluate(() => { const s = GMTEnrichQueue.state(); return s ? { cur: String(s.cur), items: s.items.map(x => ({ id: String(x.id), st: x.st })), calls: window.__calls.slice() } : null; });
    const until = async (fn, ms = 20000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await pg.waitForTimeout(250); } };
    const over = () => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [].some.call(document.querySelectorAll('#gmt-enrich-q *, #gmt-enrich-pick *'), el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }));

    // ١) الزرّ في شريط المجموعات ⇒ قائمةٌ قابلة للبحث فيها المجموعات بأعدادها
    const chip = await pg.evaluate(() => { const c = document.querySelector('[data-enrich-q]'); return !!(c && c.offsetParent); });
    ok(chip, W + ': زرّ «🧠 جهّز تلقائياً» ظاهر في شريط المجموعات');
    await pg.evaluate(() => { gmtEnrichPick(); });
    await pg.waitForSelector('#gmt-enrich-pick [data-pk]');
    const pk = await pg.evaluate(() => { const L = () => [].map.call(document.querySelectorAll('#gmt-enrich-pick [data-pk]'), b => b.innerText.replace(/\s+/g, ' '));
      const all = L(); const q = document.querySelector('#gmt-enrich-pick [data-pq]'); q.value = 'كامير'; q.dispatchEvent(new Event('input')); const f = L(); q.value = ''; q.dispatchEvent(new Event('input')); return { all, f }; });
    ok(pk.all.some(t => /إضاءة/.test(t) && /6 منتج/.test(t) && /غير مجهَّز 6/.test(t)) && pk.all.some(t => /كاميرات/.test(t)) && pk.all.some(t => /تصوير/.test(t)),
      W + ': القائمة فيها المجموعات والتصنيفات بأعدادها: ' + pk.all.join(' | ').slice(0, 120));
    ok(pk.f.length && pk.f.every(t => /كامير/.test(t)), W + ': البحث في القائمة يصفّي: ' + pk.f.join(' | '));
    ok(!(await over()), W + ': لا تمرير أفقي في قائمة الاختيار');
    if (mob) await pg.screenshot({ path: '/tmp/gmt-out/enrich_pick_' + W + '.png' });
    await pg.click('#gmt-enrich-pick [data-pk="g:إضاءة"]');

    // ٢) الطابور يبدأ وحده؛ وأنت على المنتج الأوّل يكمل العقل الثاني والثالث في الخلفية (لا يسحبك)
    await until(async () => { const s = await st(); return s && s.items[0].st === 'ready'; });
    let s = await st();
    const light = s.items.map(x => ({ id: x.id, name: nameOf(x.id) })), p0 = light[0];       // ترتيب الطابور = ترتيب الجرد
    ok(s && s.items.length === 6 && light.every(x => lightIds.includes(x.id)) && s.cur === String(p0.id), W + ': الطابور فيه 6 منتجات «إضاءة» والأوّل جاهز أمامك: ' + JSON.stringify(s && s.items.map(x => x.st)));
    await pg.fill('#gmt-enrich-q [data-f="name_en"]', 'Godox SB-1517 Mini Softbox');
    await until(async () => { const s = await st(); return s.items.filter(x => x.st === 'ready').length >= 3; });
    s = await st();
    const typed = await pg.inputValue('#gmt-enrich-q [data-f="name_en"]');
    ok(s.items.filter(x => x.st === 'ready').length >= 3 && s.cur === String(p0.id) && typed === 'Godox SB-1517 Mini Softbox',
      W + ': أثناء مراجعتك للأوّل جهّز العقل غيره (' + s.items.map(x => x.st).join('،') + ') وبقيتَ على منتجك وما كتبتَه لم يُمحَ');
    ok(s.calls.every((h, i) => h.indexOf(light[i].name) === 0), W + ': بالترتيب واحداً تلو الآخر: ' + s.calls.length + ' نداء');
    const card = await pg.evaluate(() => document.querySelector('#gmt-enrich-q [data-q-card]').innerText);
    ok(/الماركة/.test(card) && /جدول المواصفات/.test(card) && /متوافق مع/.test(card) && /الصور/.test(card), W + ': بطاقة المراجعة فيها الماركة والجدول والتوافق والصور');
    if (mob) await pg.screenshot({ path: '/tmp/gmt-out/enrich_card_' + W + '.png' });
    ok(!(await over()), W + ': لا تمرير أفقي في أداة التجهيز');

    // ٣) الصور: «رئيسية للجرد» ترفع وتحفظ image_url · «+ صور المتجر» تضيفها لمنتج المتجر المربوط
    await pg.click('#gmt-enrich-q [data-img-main="https://img.example/a.png"]');
    await until(async () => /صارت الصورة|❌/.test(await pg.innerText('#gmt-enrich-q [data-img-msg]')));
    let r0 = await row(p0.id);
    ok(/storage\/v1\/object\/public\/.+enrich\//.test(r0.image_url || ''), W + ': الصورة صارت الرئيسية في الجرد: ' + (r0.image_url || await pg.innerText('#gmt-enrich-q [data-img-msg]')));
    await pg.click('#gmt-enrich-q [data-img-store="https://img.example/a.png"]');
    await until(async () => /المتجر|❌/.test(await pg.innerText('#gmt-enrich-q [data-img-msg]')));
    let sp = (await store()).products.find(x => x.id === 'p_1') || {};
    ok(JSON.stringify(sp.images) === JSON.stringify(['https://x.example/old.jpg', 'https://img.example/a.png']), W + ': أُضيفت لصور منتج المتجر وبقيت القديمة: ' + JSON.stringify(sp.images));

    // ٤) التعديل ثمّ «💾 حفظ والتالي»: يُحفظ ما عدّلتَه (مسحتَ صفّاً · أضفتَ صفّاً · كتبتَ الوصف) ثمّ ينقلك للجاهز التالي
    await pg.evaluate(() => { const b = document.querySelector('#gmt-enrich-q [data-q-card]');
      b.querySelectorAll('[data-spec-row]')[1].querySelector('[data-row-del]').click(); b.querySelector('[data-row-add]').click();
      const rs = b.querySelectorAll('[data-spec-row]'), last = rs[rs.length - 1]; last.querySelector('[data-k]').value = 'الوزن'; last.querySelector('[data-v]').value = '40 غ'; });
    await pg.fill('#gmt-enrich-q [data-f="desc"]', 'دفيوزر صغير لفلاش الكاميرا.');
    await pg.click('#gmt-enrich-q [data-act="save"]');
    await until(async () => (await st()).items[0].st === 'saved');
    r0 = await row(p0.id); s = await st();
    const sp0 = r0.specs || {};
    ok(sp0['الأبعاد'] === '15×17 سم' && !('اللون' in sp0) && sp0['الوزن'] === '40 غ' && sp0.__desc === 'دفيوزر صغير لفلاش الكاميرا.' && sp0.__brand === 'Godox',
      W + ': الجدول المحفوظ كما عدّلتَه: ' + JSON.stringify(sp0).slice(0, 120));
    ok(r0.brand === 'Godox' && /فلاش قديم/.test(r0.alt_names || '') && /Godox SB-1517 Mini Softbox/.test(r0.alt_names || '') && /Canon 600EX/.test(r0.compat || '') && r0.specs_checked_at && r0.specs_checked_by === 'فاحص النظام' && r0.specs_source === 'alibaba',
      W + ': الماركة والأسماء البديلة (القديمة باقية) والتوافق ومن راجع ومتى: ' + JSON.stringify({ b: r0.brand, a: r0.alt_names, c: r0.compat, at: r0.specs_checked_at, by: r0.specs_checked_by, src: r0.specs_source || null }));
    ok(/Godox SB-1517/.test(r0.search_terms || ''), W + ': كلمات البحث تحمل الاسم الإنجليزي (يجده بحث الجرد)');
    ok(s.cur === String(light[1].id), W + ': بعد الحفظ انتقلت للجاهز التالي');
    const inMem = await pg.evaluate(id => { const p = allProducts.find(x => String(x.id) === String(id)); return p && p.specs && p.specs.__desc; }, p0.id);
    ok(inMem === 'دفيوزر صغير لفلاش الكاميرا.', W + ': الجرد المعروض تحدّث بلا إعادة تحميل');

    // ٥) «⏭️ تخطّي» لا يكتب شيئاً
    await pg.click('#gmt-enrich-q [data-act="skip"]');
    s = await st();
    const r1 = await row(light[1].id);
    ok(s.items[1].st === 'skip' && !r1.specs_checked_at && !r1.specs, W + ': التخطّي لا يكتب شيئاً');

    // ٦) الحفظ المرفوض (صلاحيات) يُقال ولا يُعلَّم «حُفظ»
    await until(async () => (await st()).cur === String(light[2].id) && (await st()).items[2].st === 'ready');
    await H.call('/__opts', { rls_block: ['products'] });
    await pg.click('#gmt-enrich-q [data-act="save"]');
    await until(async () => /لم يُحفظ/.test(await pg.innerText('#gmt-enrich-q [data-save-msg]')), 5000);
    const m6 = await pg.innerText('#gmt-enrich-q [data-save-msg]');
    s = await st();
    ok(/لم يُحفظ/.test(m6) && s.items[2].st === 'ready', W + ': الحفظ المرفوض ⇒ «' + m6.slice(0, 50) + '» والمنتج باقٍ للمراجعة');
    await H.call('/__opts', { rls_block: [] });

    // ٧) «🔁 أعد البحث» بملاحظة ⇒ يعود لأوّل الانتظار ويُعاد بالملاحظة
    await pg.evaluate(() => { const b = document.querySelector('#gmt-enrich-q [data-q-card]'); b.querySelector('details').open = true; b.querySelector('[data-again-hint]').value = 'ملاحظة أدق'; b.querySelector('[data-act="again"]').click(); });
    await until(async () => (await st()).calls.some(h => /ملاحظة أدق/.test(h)));
    s = await st();
    const ci = s.calls.findIndex(h => /ملاحظة أدق/.test(h));
    ok(ci >= 0 && s.calls[ci].indexOf(light[2].name) === 0, W + ': أُعيد البحث للمنتج نفسه بالملاحظة: ' + (s.calls[ci] || ''));
    await until(async () => (await st()).items.find(x => x.id === String(light[2].id)).st === 'ready');
    await pg.evaluate(id => { GMTEnrichQueue.state().cur = id; document.querySelector('#gmt-enrich-q [data-q-pick="' + id + '"]').click(); }, String(light[2].id));
    const d7 = await pg.inputValue('#gmt-enrich-q [data-f="desc"]');
    ok(/بعد الملاحظة/.test(d7), W + ': النتيجة الجديدة أمامك: ' + d7);

    // ٨) الإغلاق ثمّ الفتح من جديد ⇒ يكمل من حيث توقّف: ما جُهّز لا يُعاد · المحفوظ لا يظهر في «غير المجهَّزة فقط»
    await until(async () => (await st()).items.every(x => x.st !== 'wait' && x.st !== 'run'), 25000);
    s = await st();
    const callsBefore = s.calls.length, readyBefore = s.items.filter(x => x.st === 'ready').map(x => x.id);
    await pg.click('#gmt-enrich-q [data-q-close]');
    ok(!(await pg.$('#gmt-enrich-q')), W + ': «إغلاق» يغلق الأداة');
    await pg.evaluate(() => { gmtEnrichPick(); });
    await pg.waitForSelector('#gmt-enrich-pick [data-pk]');
    const left = await pg.evaluate(() => document.querySelector('#gmt-enrich-pick [data-pk="g:إضاءة"]').innerText.replace(/\s+/g, ' '));
    ok(/غير مجهَّز 5/.test(left), W + ': القائمة تعدّ المحفوظ مجهَّزاً: ' + left);
    await pg.click('#gmt-enrich-pick [data-pk="g:إضاءة"]');
    await pg.waitForTimeout(2500);
    s = await st();
    const back = s.items.filter(x => x.st === 'ready').map(x => x.id);
    ok(s.items.length === 5 && !s.items.some(x => x.id === String(p0.id)) && readyBefore.every(id => back.includes(id)) && s.calls.length === callsBefore,
      W + ': استؤنف بلا إعادة: ' + s.items.map(x => x.st).join('،') + ' · نداءات ' + callsBefore + '⇒' + s.calls.length);
    await pg.click('#gmt-enrich-q [data-q-close]');

    // ٩) الإغلاق أثناء عمل العقل ثمّ الفتح فوراً ⇒ لا خطأ ولا خلط بين الجلستين
    await pg.evaluate(() => localStorage.removeItem('gmt_enrich_queue_v1'));
    await pg.evaluate(() => { gmtEnrichPick(); });
    await pg.waitForSelector('#gmt-enrich-pick [data-pk]');
    await pg.evaluate(() => { document.querySelector('#gmt-enrich-pick [data-pleft]').checked = false; document.querySelector('#gmt-enrich-pick [data-pk="g:كاميرات"]').click(); });
    await pg.waitForTimeout(300);
    await pg.evaluate(() => GMTEnrichQueue.close(true));
    await pg.evaluate(() => { gmtEnrichPick(); });
    await pg.waitForSelector('#gmt-enrich-pick [data-pk]');
    await pg.evaluate(() => { document.querySelector('#gmt-enrich-pick [data-pleft]').checked = false; document.querySelector('#gmt-enrich-pick [data-pk="g:كاميرات"]').click(); });
    await until(async () => { const s = await st(); return s && s.items.filter(x => x.st === 'ready').length >= 2; });
    s = await st();
    ok(s.items.length === 6 && s.items.filter(x => x.st === 'run').length <= 1 && s.items.filter(x => x.st === 'ready').length >= 2, W + ': الإغلاق أثناء العمل ثمّ الفتح يعمل سليماً: ' + s.items.map(x => x.st).join('،'));
    await pg.evaluate(() => GMTEnrichQueue.close(true));

    const real = errs.filter(e => !/status of (400|401|404|406|503)/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
