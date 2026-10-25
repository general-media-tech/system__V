// (25 ت1 · TASK-0183) المالك seq 115: «هاي الأداة بعد ما أعمل حفظ للجميع ما في زرّ حفظ … أغلقت الأداة وما حفظ شيء» ·
// seq 113: «الهودات والأغطية لازم يكون معها التوافق من دليل التوافقيات».
// ① «💾 احفظ كل الجاهز (N)» في رأس الأداة: المفتوح بما عدّلتَه، والبقيّة بما جهّزه العقل — وما لا يطابق اسم المنتج يبقى لمراجعتك.
// ② «إغلاق» وفيها جاهزٌ لم يُحفظ ⇒ سؤال: احفظها كلها وأغلق · أغلق بلا حفظ · رجوع.
// ③ الإكسسوار (هود · غطاء · بطارية…) ⇒ طلب توافقٍ ثالث بقواعد الدليل · عدسةٌ قطرها المكتوب غير قطر الغطاء تُحذف · والبطاقة تقول «راجع».
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const row = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
const BRAIN_URL = 'https://ysawzwtmodkqqbqoiojj.supabase.co/functions/v1/gmt-brain';
const STUB = `window.__brainStub = function () {
  window.__origImport = window.__origImport || GMTBrain.importProduct;
  GMTBrain.importProduct = async function (o) {
    await new Promise(r => setTimeout(r, 60));
    const n = (o.hint || '').split(' — ')[0], bad = /EF-M/.test(n);
    const res = { name: n, name_en: bad ? 'Auto Focus Adapter EF-EOS R' : 'EN ' + n, brand: 'Godox', model: bad ? 'EF-EOS R' : 'M-' + n.slice(-1), description_ar: bad ? 'محوّل' : 'وصف ' + n,
      specs: [{ k: 'اللون', v: 'أسود' }], compat: ['Canon 600EX'], aliases_ar: [], aliases_en: [], images: [] };
    Object.defineProperty(res, '_meta', { value: { from_memory: true }, enumerable: false });
    return res;
  };
};`;
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const light = prods.filter((p, i) => i % 2 === 0).map(p => String(p.id));            // مجموعة «إضاءة» (٦)
    await H.call('/rest/v1/products?id=eq.' + light[5], { name: 'اداپتر Adapter rings EF-M' }, 'PATCH');   // نتيجته لا تطابق اسمه
    const mob = W < 500;
    const { browser, pg, ctx, errs } = await H.open('inventory.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000, init: H.ADMIN_INIT + STUB });
    await pg.evaluate(() => { localStorage.removeItem('gmt_enrich_queue_v1'); window.__brainStub(); });
    const until = async (fn, ms = 30000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await pg.waitForTimeout(250); } };
    const start = async () => { await pg.evaluate(() => { gmtEnrichPick(); }); await pg.waitForSelector('#gmt-enrich-pick [data-pk]'); await pg.click('#gmt-enrich-pick [data-pk="g:إضاءة"]');
      await until(() => pg.evaluate(() => { const s = GMTEnrichQueue.state(); return s && s.items.every(x => x.st === 'ready'); })); };
    await start();

    // ① الزرّ وعدده
    const btn = await pg.evaluate(() => { const b = document.querySelector('#gmt-enrich-q [data-q-saveall]'); return b && b.offsetParent ? b.textContent : ''; });
    ok(/احفظ كل الجاهز \(6\)/.test(btn), W + ': رأس الأداة فيه «💾 احفظ كل الجاهز (6)»: ' + btn);
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/enrich_saveall_' + W + '.png' });
    // تعديلٌ في البطاقة المفتوحة يُحفظ كما عدّلتَه
    const curId = await pg.evaluate(() => { const s = GMTEnrichQueue.state(); const box = document.querySelector('#gmt-enrich-q [data-q-card]'); const f = box.querySelector('[data-f="name_en"]'); f.value = 'EDITED NAME'; return String(s.cur); });
    await pg.click('#gmt-enrich-q [data-q-saveall]');
    await until(() => pg.evaluate(() => { const s = GMTEnrichQueue.state(); return s && !s.savingAll && s.items.filter(x => x.st === 'saved').length >= 5; }));
    const sts = await pg.evaluate(() => GMTEnrichQueue.state().items.map(x => ({ id: String(x.id), st: x.st })));
    const saved = sts.filter(x => x.st === 'saved').map(x => x.id), left = sts.filter(x => x.st === 'ready').map(x => x.id);
    ok(saved.length === 5 && left.length === 1 && left[0] === light[5], W + ': حُفظ ٥ دفعةً واحدة · وما لا يطابق اسمه (EF-M) بقي لمراجعتك: ' + JSON.stringify(sts.map(x => x.st)));
    const rows = await Promise.all(saved.map(row));
    ok(rows.every(r => r.specs_checked_at && r.specs && r.specs['اللون'] === 'أسود'), W + ': في القاعدة فعلاً (المواصفات وتاريخ المراجعة) للخمسة');
    const rc = await row(curId);
    ok(curId === light[5] || /EDITED NAME/.test((rc.alt_names || '') + ' ' + (rc.search_terms || '')), W + ': المفتوح حُفظ بما عدّلتَه فيه (الاسم الإنجليزي «EDITED NAME»)');
    const toast = await pg.evaluate(() => [...document.querySelectorAll('[class*=toast], #toast, .gmt-toast')].map(x => x.innerText).join(' '));
    ok(/حُفظ 5/.test(toast) && /لا تطابق اسم المنتج/.test(toast), W + ': الرسالة تقول ما حُفظ وما تُرك: ' + toast.replace(/\s+/g, ' ').slice(0, 90));

    // ② «إغلاق» وفيها جاهزٌ لم يُحفظ ⇒ سؤال
    await pg.click('#gmt-enrich-q [data-q-close]');
    const d = await until(() => pg.evaluate(() => { const o = [...document.querySelectorAll('.gmtask-ov')].find(x => /قبل الإغلاق/.test(x.innerText)); return o ? { t: o.innerText.replace(/\s+/g, ' '), b: [...o.querySelectorAll('button')].map(b => b.textContent.trim()) } : null; }), 6000);
    ok(d && /1 منتج جاهز لم يُحفظ/.test(d.t) && d.b.includes('احفظها كلها وأغلق') && d.b.some(b => /أغلق بلا حفظ/.test(b)) && d.b.includes('رجوع'), W + ': «إغلاق» ⇒ سؤال قبل الإغلاق: ' + (d ? d.b.join(' · ') : 'لا سؤال'));
    await pg.evaluate(() => { const o = [...document.querySelectorAll('.gmtask-ov')].find(x => /قبل الإغلاق/.test(x.innerText)); [...o.querySelectorAll('button')].find(b => b.textContent.trim() === 'رجوع').click(); });
    await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => !!document.getElementById('gmt-enrich-q')), W + ': «رجوع» ⇒ الأداة باقية');
    await pg.click('#gmt-enrich-q [data-q-close]');
    await until(() => pg.evaluate(() => [...document.querySelectorAll('.gmtask-ov')].some(x => /قبل الإغلاق/.test(x.innerText))), 6000);
    await pg.evaluate(() => { const o = [...document.querySelectorAll('.gmtask-ov')].find(x => /قبل الإغلاق/.test(x.innerText)); [...o.querySelectorAll('button')].find(b => /أغلق بلا حفظ/.test(b.textContent)).click(); });
    await pg.waitForTimeout(400);
    ok(await pg.evaluate(() => !document.getElementById('gmt-enrich-q')), W + ': «أغلق بلا حفظ» ⇒ أُغلقت (وما جهز باقٍ على الجهاز)');
    // «احفظها كلها وأغلق» على طابورٍ جديد
    await pg.evaluate(() => { localStorage.removeItem('gmt_enrich_queue_v1'); });
    for (const id of light) await H.call('/rest/v1/products?id=eq.' + id, { specs_checked_at: null, specs: null }, 'PATCH');
    await H.call('/rest/v1/products?id=eq.' + light[5], { name: 'فلاش رقم ٦' }, 'PATCH');
    await pg.evaluate(() => loadProducts && loadProducts());
    await pg.waitForTimeout(800);
    await start();
    await pg.click('#gmt-enrich-q [data-q-close]');
    await until(() => pg.evaluate(() => [...document.querySelectorAll('.gmtask-ov')].some(x => /قبل الإغلاق/.test(x.innerText))), 6000);
    await pg.evaluate(() => { const o = [...document.querySelectorAll('.gmtask-ov')].find(x => /قبل الإغلاق/.test(x.innerText)); [...o.querySelectorAll('button')].find(b => b.textContent.trim() === 'احفظها كلها وأغلق').click(); });
    await until(() => pg.evaluate(() => !document.getElementById('gmt-enrich-q')), 15000);
    const rows2 = await Promise.all(light.map(row));
    ok(rows2.every(r => r.specs_checked_at), W + ': «احفظها كلها وأغلق» ⇒ الستّة في القاعدة ثمّ أُغلقت: ' + rows2.filter(r => r.specs_checked_at).length + '/6');

    // ③ التوافق للإكسسوار — الطلب الثالث عبر الوسيط (بديلٌ على الشبكة)
    const seen = [];
    await ctx.route(BRAIN_URL, async r => {
      const b = JSON.parse(r.request().postData() || '{}'); seen.push(b.mode || (b.system && /توافق إكسسوارات/.test(b.system) ? 'compat' : 'complete'));
      let body;
      if (b.mode === 'product') body = { product: { name: 'غطاء عدسة 77مم', name_en: '77mm lens cap', brand: 'Canon', specs: [{ k: 'المادة', v: 'بلاستيك' }], compat: ['عدسات Canon مقاس 77 ملم'] }, from_memory: true };
      else if (/توافق إكسسوارات/.test(b.system || '')) body = { answer: '{"compat":["قطر الفلتر 77مم","Canon EF 24-105mm f/4L IS USM (77مم)","Canon EF 70-200mm f/4L IS II USM (72مم)","Canon EF 17-40mm f/4L USM (77مم)"],"note":"الغطاء بالقطر"}' };
      else body = { answer: '{"specs":[],"aliases_ar":[],"aliases_en":[]}' };
      await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    });
    const cp = await pg.evaluate(async (u) => {
      try { localStorage.setItem('gmt_brain_endpoint', u); } catch (_) {}
      if (window.GMTEndpoint && GMTEndpoint.set) try { GMTEndpoint.set('brain', u); } catch (_) {}
      const acc = ['ES-68 lens hood هود', '77mm lens cap for CANON غطا', 'بطارية LP-E6NH', 'اضاءة غودوكس SL60W', 'كاميرا كانون 2000D'].map(n => GMTBrain._isAccessory({ name: n }));
      const p = await window.__origImport({ hint: '77mm lens cap for CANON غطا' });
      return { acc, compat: p.compat, sys: GMTBrain._compatSys };
    }, BRAIN_URL);
    ok(JSON.stringify(cp.acc) === '[true,true,true,false,false]', W + ': الإكسسوار يُعرف (هود · غطاء · بطارية) لا الإضاءة ولا الكاميرا: ' + JSON.stringify(cp.acc));
    ok(seen.includes('compat'), W + ': للإكسسوار طلب توافقٍ ثالث للعقل: ' + seen.join(','));
    ok(/كود الهود لا يُستنتج من قطر الفلتر/.test(cp.sys) && /ES-68 ⇐ EF 50mm f\/1\.8 STM/.test(cp.sys) && /LP-E6/.test(cp.sys) && /المحوّل من حربةٍ بُعدها أكبر/.test(cp.sys), W + ': برومبت التوافق بقواعد دليل التوافقيات (الهود · الغطاء · البطاريات · المحوّل)');
    ok(Array.isArray(cp.compat) && cp.compat[0] === 'عدسات Canon مقاس 77 ملم' && cp.compat.includes('Canon EF 24-105mm f/4L IS USM (77مم)') && cp.compat.includes('قطر الفلتر 77مم'),
      W + ': التوافق الجديد أُضيف للمكتوب: ' + (cp.compat || []).join(' | ').slice(0, 120));
    ok(!cp.compat.some(x => /72مم/.test(x)), W + ': عدسةٌ قطرها 72مم لا تدخل توافق غطاء 77مم');

    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
