// (25 ت1 · TASK-0184) المالك seq 117: «المواصفات المكتوبة في المنتج ما عم تطلع في المتجر · ولازم لما يعطيني: أوّلاً المواصفات اللي حدّدناها نحن
// بالجرد والجديدة الموجودة في السيستم، ثمّ بعدها المكتوبة في المتجر — ممكن أحذفها كلها إذا شفتها علاك».
// ① البطاقة: مواصفات الجرد أوّلاً (بمفاتيحها) ثمّ الجديد من العقل (بلا تكرار) ثمّ «🛒 المكتوب في المتجر الآن» سطراً سطراً بـ✕.
// ② الحفظ: الجرد (ما لم يتغيّر يبقى ببنيته · المحذوف يُحذف) + منتج المتجر المربوط فوراً: المواصفات والتوافق والوصف (وصفنا ثمّ ما بقي من المتجر).
// ③ غير المربوط ⇒ يُحفظ في الجرد وحده ويُقال ذلك.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const row = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
const store = () => H.call('/rest/v1/gmt_store?id=eq.1&select=*', undefined, 'GET').then(r => r[0]);
const STUB = `window.__brainStub = function () {
  GMTBrain.importProduct = async function (o) {
    await new Promise(r => setTimeout(r, 50));
    const n = (o.hint || '').split(' — ')[0];
    const res = { name: n, name_en: 'EN ' + n, brand: 'Godox', model: 'M-' + n.slice(-1), description_ar: 'وصف العقل ' + n,
      specs: [{ k: 'الوزن', v: '210 غ' }, { k: 'اللون', v: 'أسود' }], compat: ['Canon 600EX'], aliases_ar: [], aliases_en: [], images: [] };
    Object.defineProperty(res, '_meta', { value: { from_memory: true }, enumerable: false });
    return res;
  };
};`;
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const light = prods.filter((p, i) => i % 2 === 0).map(p => String(p.id));
    const A = light[0], B = light[1];
    await H.call('/rest/v1/products?id=eq.' + A, { store_url: 'store.html#product=p_1', specs: { 'الوزن': '200 غ', fits: [{ brand: 'Canon', mount: 'EF' }], __desc: 'وصفنا للمنتج' } }, 'PATCH');
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'إضاءة', order: 1 }],
      products: [{ id: 'p_1', name: 'منتج متجر', price: 50, images: [], category_id: 'c1', description: 'سطر متجر أوّل\nسطر متجر علاك' }] }]);
    const mob = W < 500;
    const { browser, pg, errs } = await H.open('inventory.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000, init: H.ADMIN_INIT + STUB });
    await pg.evaluate(() => { localStorage.removeItem('gmt_enrich_queue_v1'); window.__brainStub(); });
    const until = async (fn, ms = 30000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await pg.waitForTimeout(250); } };
    await pg.evaluate(() => { gmtEnrichPick(); }); await pg.waitForSelector('#gmt-enrich-pick [data-pk]');
    /* (seq 116) «بدّي إيّاه مشان المنتجات الموجودة في الجرد وما هي موجودة في المتجر» */
    const ns = await pg.evaluate(() => { const b = document.querySelector('#gmt-enrich-pick [data-pk="s:none"]'); return b ? b.innerText.replace(/\s+/g, ' ') : ''; });
    ok(/في الجرد وليست في المتجر/.test(ns) && ns.indexOf((prods.length - 1) + ' منتج') !== -1, W + ': في القائمة «🛒 في الجرد وليست في المتجر» بعددها (' + (prods.length - 1) + '): ' + ns);
    await pg.click('#gmt-enrich-pick [data-pk="g:إضاءة"]');
    await until(() => pg.evaluate(() => { const s = GMTEnrichQueue.state(); return s && s.items.every(x => x.st === 'ready'); }));
    const pick = id => pg.evaluate(id => { const b = document.querySelector('#gmt-enrich-q [data-q-pick="' + id + '"]'); if (b) b.click(); }, id);
    await pick(A);
    await until(() => pg.evaluate(() => !!document.querySelector('#gmt-enrich-q [data-store-box] [data-store-line]')), 8000);
    const card = await pg.evaluate(() => {
      const box = document.querySelector('#gmt-enrich-q [data-q-card]');
      return { rows: [].map.call(box.querySelectorAll('[data-spec-row]'), r => ({ k: r.querySelector('[data-k]').value, v: r.querySelector('[data-v]').value, o: r.getAttribute('data-orig') || '' })),
               desc: box.querySelector('[data-f="desc"]').value, store: [].map.call(box.querySelectorAll('[data-store-line] [data-t]'), x => x.textContent) };
    });
    ok(card.rows.length === 3 && card.rows[0].o && card.rows[1].o && card.rows[0].k === 'الوزن' && card.rows[0].v === '200 غ' && card.rows[2].k === 'اللون' && !card.rows[2].o,
      W + ': مواصفات الجرد أوّلاً (الوزن 200 غ · fits) ثمّ الجديد (اللون) — ووزن العقل لا يتكرّر: ' + card.rows.map(r => r.k + '=' + r.v).join(' | '));
    ok(card.desc === 'وصفنا للمنتج', W + ': الوصف المحفوظ في الجرد أوّلاً لا وصف العقل: ' + card.desc);
    ok(card.store.length === 2 && card.store[0] === 'سطر متجر أوّل', W + ': «🛒 المكتوب في المتجر الآن» سطراً سطراً: ' + card.store.join(' | '));
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/store_specs_' + W + '.png' });
    // احذف سطر «العلاك» ثمّ احفظ
    await pg.evaluate(() => { const l = [...document.querySelectorAll('#gmt-enrich-q [data-store-line]')].find(x => /علاك/.test(x.innerText)); l.querySelector('[data-store-del]').click(); });
    await pg.evaluate(() => document.querySelector('#gmt-enrich-q [data-q-card] [data-act="save"]').click());
    await until(async () => (await row(A)).specs_checked_at, 10000);
    const ra = await row(A);
    ok(ra.specs['الوزن'] === '200 غ' && Array.isArray(ra.specs.fits) && ra.specs.fits[0].mount === 'EF' && ra.specs['اللون'] === 'أسود' && ra.specs.__desc === 'وصفنا للمنتج',
      W + ': الجرد: ما لم يتغيّر بقي كما هو (fits مصفوفة) + الجديد + الوصف: ' + JSON.stringify(ra.specs).slice(0, 120));
    const st = await until(async () => { const s = await store(); const p = s && s.products.find(x => x.id === 'p_1'); return p && Array.isArray(p.specs) && p.specs.length ? p : null; }, 8000);
    ok(st && st.specs.some(r => r.label === 'الوزن' && r.value === '200 غ') && st.specs.some(r => r.label === 'اللون' && r.value === 'أسود') && st.specs.some(r => /يركّب/.test(r.label) && /Canon EF/.test(r.value)),
      W + ': المتجر فوراً: جدول المواصفات كما في الجرد: ' + (st ? st.specs.map(r => r.label + '=' + r.value).join(' | ') : 'لم يصل'));
    ok(st && st.description === 'وصفنا للمنتج\nسطر متجر أوّل' && st.compat === 'Canon 600EX', W + ': ووصف المتجر = وصفنا ثمّ ما بقي من المكتوب فيه (المحذوف حُذف) · والتوافق: ' + JSON.stringify(st && st.description));
    const toast = await pg.evaluate(() => [...document.querySelectorAll('[class*=toast], #toast, .gmt-toast')].map(x => x.innerText).join(' '));
    ok(/في الجرد والمتجر/.test(toast), W + ': الرسالة: حُفظ في الجرد والمتجر: ' + toast.replace(/\s+/g, ' ').slice(0, 70));

    // حذف مواصفةٍ من الجرد يحذفها · وغير المربوط ⇒ الجرد وحده
    await pick(B);
    await until(() => pg.evaluate(() => /غير مربوط/.test((document.querySelector('#gmt-enrich-q [data-store-box]') || {}).innerText || '')), 8000);
    ok(await pg.evaluate(() => /غير مربوط بمنتجٍ في المتجر/.test(document.querySelector('#gmt-enrich-q [data-store-box]').innerText)), W + ': غير المربوط ⇒ «غير مربوط بمنتجٍ في المتجر — يُحفظ في الجرد وحده»');
    await pg.evaluate(() => { const r = [...document.querySelectorAll('#gmt-enrich-q [data-spec-row]')].find(x => x.querySelector('[data-k]').value === 'الوزن'); r.querySelector('[data-row-del]').click();
      document.querySelector('#gmt-enrich-q [data-q-card] [data-act="save"]').click(); });
    await until(async () => (await row(B)).specs_checked_at, 10000);
    const rb = await row(B);
    ok(rb.specs && !('الوزن' in rb.specs) && rb.specs['اللون'] === 'أسود', W + ': صفٌّ حذفتَه لا يُحفظ: ' + JSON.stringify(rb.specs).slice(0, 80));

    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
