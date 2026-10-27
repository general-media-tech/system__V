// (TASK-0206 · المالك seq 135) «العقل لما يعبي مواصفات لا يكتبلي تقريبي — هي الكلمة محظورة وبتفقد الثقة»
// ① الطلب للعقل لا يطلب «قيمة نموذجية (تقريبي)» بل اليقينيّ فقط ② ما يعود بـ«تقريبي» أو «غير متوفر» يُحذف ③ المحفوظ سابقاً لا يُعرض
// في الجرد والمتجر ولا ينتقل للمتجر ④ مراجعة «جهّز تلقائياً» لا تعرضه ولا تحفظه
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, wait: 4000, init: H.ADMIN_INIT + `try { localStorage.setItem('gmt_brain_endpoint', 'https://ysawzwtmodkqqbqoiojj.supabase.co/functions/v1/gmt-brain'); } catch (_) {}` });
  const d = await pg.evaluate(() => GMTBrain._dropUnsure([{ k: 'الوزن', v: '160 غ' }, { k: 'الأبعاد', v: '7×5 سم (تقريبي)' }, { k: 'البطارية', v: 'غير متوفر (تقريبي)' }, { k: 'الحربة', v: 'EF' }, { k: 'الجهد', v: 'غير محدد' }, { k: 'المنشأ', v: 'Typical: China' }, { k: 'اللون', v: 'أسود' }]).map(s => s.k));
  ok(JSON.stringify(d) === JSON.stringify(['الوزن', 'الحربة', 'اللون']), 'يُحذف: «(تقريبي)» · «غير متوفر/محدد» · typical — ويبقى اليقينيّ: ' + JSON.stringify(d));
  const e2e = await pg.evaluate(async () => {
    const seen = []; const of = window.fetch;
    window.fetch = async (u, o) => {
      if (/gmt-brain/.test(String(u))) {
        const b = JSON.parse(o.body || '{}'); seen.push(b);
        const body = b.mode === 'product'
          ? { product: { name_en: 'Godox SL60W', brand: 'Godox', specs: [{ k: 'القدرة', v: '60 واط' }, { k: 'الوزن', v: '1.2 كغ (تقريبي)' }, { k: 'السطوع', v: 'غير متوفر' }], confidence: 'low' } }
          : { answer: JSON.stringify({ specs: [{ k: 'CRI', v: '95+' }, { k: 'الأبعاد', v: '30×20 سم (تقريبي)' }], aliases_ar: [], aliases_en: [] }) };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return of(u, o);
    };
    const p = await GMTBrain.importProduct({ url: '', hint: 'اضاءة Godox SL60W', pname: 'اضاءة Godox SL60W', group: 'اضاءة' });
    window.fetch = of;
    return { specs: p.specs.map(s => s.k + '=' + s.v), dropped: p._meta && p._meta.dropped_unsure, hint: (seen[0] || {}).hint || '', sys: (seen.find(b => b.system) || {}).system || '' };
  });
  ok(!/قيمته النموذجية|«\(تقريبي\)»/.test(e2e.hint) && /اليقينيّ فقط/.test(e2e.hint), 'طلب المنتج: «اليقينيّ فقط» بلا «قيمة نموذجية (تقريبي)»: …' + e2e.hint.slice(-70));
  ok(/لا تكتبه أبداً/.test(e2e.sys) && /ممنوعة/.test(e2e.sys) && !/وبعدها «\(تقريبي\)»/.test(e2e.sys), 'طلب الإكمال: «ما لا تعرفه يقيناً لا تكتبه أبداً … كلمة تقريبي ممنوعة»');
  ok(JSON.stringify(e2e.specs) === JSON.stringify(['القدرة=60 واط', 'CRI=95+']) && e2e.dropped === 3, 'ما كتبه النموذج بـ«تقريبي» أو «غير متوفر» لا يصل: ' + JSON.stringify(e2e));
  // ③ المحفوظ سابقاً: لا يُعرض ولا ينتقل للمتجر
  const sh = await pg.evaluate(() => { const sp = { 'الحربة': 'EF', 'الوزن': '160 غ (تقريبي)', 'الجهد': 'غير متوفر (تقريبي)', __brand: 'Canon' };
    return { rows: GMTSpecs.rows(sp).map(r => r.label), store: GMTSpecs.forStore(sp).map(r => r.label), html: GMTSpecs.tableHTML([{ label: 'الوزن', value: '160 غ (تقريبي)' }, { label: 'اللون', value: 'أسود' }]) }; });
  ok(JSON.stringify(sh.rows) === JSON.stringify(['الحربة']) && JSON.stringify(sh.store) === JSON.stringify(['الماركة', 'الحربة']) && !/تقريبي/.test(sh.html) && /أسود/.test(sh.html), 'الجرد والمتجر لا يعرضان التقديريّ ولا ينقلانه: ' + JSON.stringify({ r: sh.rows, s: sh.store }));
  // ④ مراجعة «جهّز تلقائياً»: بندٌ محفوظ بـ«تقريبي» لا يظهر
  const q = await pg.evaluate(async () => {
    const p = allProducts[0]; p.specs = { 'الحربة': 'EF', 'الوزن': '160 غ (تقريبي)' };
    GMTBrain.importProduct = async () => { const r = { name_en: 'X', specs: [{ k: 'اللون', v: 'أسود' }], compat: [], images: [] }; Object.defineProperty(r, '_meta', { value: { from_memory: true }, enumerable: false }); return r; };
    GMTEnrichQueue.open({ key: 'g:na', title: 'تجربة', products: [p], operator: 'فاحص', save: async () => ({ data: [{ id: p.id }] }), upload: async () => '' });
    for (let i = 0; i < 60; i++) { const s = GMTEnrichQueue.state(); if (s && s.items[0].st === 'ready') break; await new Promise(r => setTimeout(r, 200)); }
    const s = GMTEnrichQueue.state(); s.cur = s.items[0].id; const b = document.querySelector('#gmt-enrich-q [data-q-pick]'); if (b) b.click();
    await new Promise(r => setTimeout(r, 400));
    return [...document.querySelectorAll('#gmt-enrich-q [data-spec-row]')].map(r => r.querySelector('[data-k]').value + '=' + r.querySelector('[data-v]').value);
  });
  ok(q.length && !q.some(x => /تقريبي/.test(x)) && q.some(x => /الحربة=EF/.test(x)) && q.some(x => /اللون=أسود/.test(x)), 'مراجعة «جهّز تلقائياً» بلا «تقريبي»: ' + JSON.stringify(q));
  const real = errs.filter(e => !/status of (400|404|406)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
