// (المالك seq 205) «في موضوع التعبئة التلقائية اعطيني اياها تعبي مره اخرى — منتجات معبّأة تلقائياً ولكن ممكن ارجع اعيد مره اخرى عليها
// لانه التعبئة الموجودة كلها سيئة».
// ① قسم «🔁 المعبّأة سابقاً — أعد تعبئتها من جديد» في نافذة الاختيار (عدده = المجهَّز سابقاً).
// ② البطاقة: الجديد من العقل يحلّ محلّ القديم (المواصفات والوصف) · القديم ظاهرٌ للاطّلاع فقط · «↩️ أرجع القديم» يعيده صفوفاً.
// ③ الحفظ: القديم الذي لم تُرجعه لا يُحفظ · والعقل إن لم يأتِ بمواصفات لا يُمسح القديم.
// ④ الإغلاق ثمّ فتح القسم نفسه: يكمل من حيث توقّف (المحفوظ يبقى «حُفظ»).
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const row = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
const STUB = `window.__brainStub = function () {
  GMTBrain.importProduct = async function (o) {
    await new Promise(r => setTimeout(r, 40));
    const n = (o.hint || '').split(' — ')[0], empty = /فارغ/.test(n);
    const res = { name: n, name_en: 'EN ' + n, brand: 'Canon', model: 'M1', description_ar: empty ? '' : 'وصفٌ جديد ' + n,
      specs: empty ? [] : [{ k: 'اللون', v: 'أحمر' }, { k: 'الوزن', v: '200 غ' }], compat: [], aliases_ar: [], aliases_en: [], images: [] };
    Object.defineProperty(res, '_meta', { value: { from_memory: true }, enumerable: false });
    return res;
  };
};`;
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const ids = prods.slice(0, 3).map(p => String(p.id));
    const old = { 'اللون': 'أسود', 'المادة': 'بلاستيك سيّئ', __desc: 'وصفٌ قديم سيّئ' };
    for (const id of ids) await H.call('/rest/v1/products?id=eq.' + id, { specs: old, specs_checked_at: '2026-10-01T00:00:00Z' }, 'PATCH');
    await H.call('/rest/v1/products?id=eq.' + ids[2], { name: 'منتج فارغ النتيجة' }, 'PATCH');
    const mob = W < 500;
    const { browser, pg, errs } = await H.open('inventory.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000, init: H.ADMIN_INIT + STUB });
    await pg.evaluate(() => { localStorage.removeItem('gmt_enrich_queue_v1'); window.__brainStub(); });
    const until = async (fn, ms = 30000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v || Date.now() - t0 > ms) return v; await pg.waitForTimeout(250); } };
    const openRedo = async () => { await pg.evaluate(() => { gmtEnrichPick(); }); await pg.waitForSelector('#gmt-enrich-pick [data-pk]'); };

    // ① القسم
    await openRedo();
    const sec = await pg.evaluate(() => { const b = document.querySelector('#gmt-enrich-pick [data-pk="x:redo"]'); return b ? b.innerText.replace(/\s+/g, ' ') : ''; });
    ok(/المعبّأة سابقاً — أعد تعبئتها من جديد/.test(sec) && /3 منتج/.test(sec), W + ': قسم «المعبّأة سابقاً» بعدده: ' + sec);
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/enrich_redo_pick_' + W + '.png' });
    await pg.click('#gmt-enrich-pick [data-pk="x:redo"]');
    await until(() => pg.evaluate(() => { const s = GMTEnrichQueue.state(); return s && s.items.every(x => x.st === 'ready'); }));
    const st0 = await pg.evaluate(() => { const s = GMTEnrichQueue.state(); return { n: s.items.length, fresh: s.fresh }; });
    ok(st0.n === 3 && st0.fresh === true, W + ': طابورٌ بالمعبّأة سابقاً (٣) في وضع «من جديد»: ' + JSON.stringify(st0));

    // ② البطاقة: الجديد يحلّ محلّ القديم
    await pg.evaluate(id => { const s = GMTEnrichQueue.state(); s.cur = id; }, ids[0]);
    await pg.evaluate(() => { const b = document.querySelector('#gmt-enrich-q [data-q-pick]'); if (b) b.click(); });
    await pg.evaluate(id => { const b = document.querySelector('#gmt-enrich-q [data-q-pick="' + id + '"]'); if (b) b.click(); }, ids[0]);
    await pg.waitForTimeout(300);
    const card = await pg.evaluate(() => { const box = document.querySelector('#gmt-enrich-q [data-q-card]');
      return { rows: [...box.querySelectorAll('[data-rows] [data-spec-row]')].map(r => r.querySelector('[data-k]').value + '=' + r.querySelector('[data-v]').value),
        desc: (box.querySelector('[data-f="desc"]') || {}).value, old: (box.querySelector('[data-old-specs]') || {}).textContent || '' }; });
    ok(card.rows.join('|') === 'اللون=أحمر|الوزن=200 غ', W + ': الجدول = الجديد وحده (اللون أحمر لا أسود): ' + card.rows.join(' | '));
    ok(/^وصفٌ جديد/.test(card.desc || ''), W + ': الوصف = الجديد لا القديم السيّئ: ' + card.desc);
    ok(/المواصفات القديمة \(2\)/.test(card.old) && /بلاستيك سيّئ/.test(card.old), W + ': القديم ظاهرٌ للاطّلاع: ' + card.old.replace(/\s+/g, ' ').slice(0, 90));
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/enrich_redo_card_' + W + '.png' });
    // ③ الحفظ بلا إرجاع ⇒ القديم لا يُحفظ
    await pg.click('#gmt-enrich-q [data-act="save"]');
    await until(() => pg.evaluate(id => GMTEnrichQueue.state().items.some(x => String(x.id) === id && x.st === 'saved'), ids[0]));
    const r0 = await row(ids[0]);
    ok(r0.specs['اللون'] === 'أحمر' && !('المادة' in r0.specs) && /^وصفٌ جديد/.test(r0.specs.__desc), W + ': المحفوظ = الجديد (القديم «المادة» لم يُحفظ): ' + JSON.stringify(r0.specs).slice(0, 120));
    // «↩️ أرجع القديم» على المنتج الثاني
    await pg.evaluate(id => { const b = document.querySelector('#gmt-enrich-q [data-q-pick="' + id + '"]'); if (b) b.click(); }, ids[1]);
    await pg.waitForTimeout(300);
    await pg.evaluate(() => { const d = document.querySelector('#gmt-enrich-q [data-old-specs]'); d.open = true; d.querySelector('[data-old-back]').click(); });
    const rows2 = await pg.evaluate(() => [...document.querySelectorAll('#gmt-enrich-q [data-rows] [data-spec-row]')].map(r => r.querySelector('[data-k]').value + '=' + r.querySelector('[data-v]').value));
    ok(rows2.join('|') === 'اللون=أحمر|الوزن=200 غ|المادة=بلاستيك سيّئ', W + ': «أرجع القديم» يضيف ما ليس في الجديد تحته: ' + rows2.join(' | '));
    await pg.click('#gmt-enrich-q [data-act="save"]');
    await until(() => pg.evaluate(id => GMTEnrichQueue.state().items.some(x => String(x.id) === id && x.st === 'saved'), ids[1]));
    const r1 = await row(ids[1]);
    ok(r1.specs['المادة'] === 'بلاستيك سيّئ' && r1.specs['اللون'] === 'أحمر', W + ': المُرجَع حُفظ مع الجديد');
    // العقل بلا مواصفات ⇒ لا يُمسح القديم
    await pg.evaluate(id => { const b = document.querySelector('#gmt-enrich-q [data-q-pick="' + id + '"]'); if (b) b.click(); }, ids[2]);
    await pg.waitForTimeout(300);
    const card3 = await pg.evaluate(() => { const box = document.querySelector('#gmt-enrich-q [data-q-card]');
      return { rows: [...box.querySelectorAll('[data-rows] [data-spec-row]')].map(r => r.querySelector('[data-k]').value), desc: (box.querySelector('[data-f="desc"]') || {}).value, old: !!box.querySelector('[data-old-specs]') }; });
    ok(card3.rows.join('|') === 'اللون|المادة' && card3.desc === 'وصفٌ قديم سيّئ' && !card3.old, W + ': العقل لم يأتِ بشيء ⇒ القديم باقٍ (لا مسح): ' + JSON.stringify(card3));

    // ④ الإغلاق ثمّ فتح القسم ⇒ يكمل
    await pg.evaluate(() => GMTEnrichQueue.close(true));
    await openRedo(); await pg.click('#gmt-enrich-pick [data-pk="x:redo"]'); await pg.waitForTimeout(800);
    const st2 = await pg.evaluate(() => GMTEnrichQueue.state().items.map(x => x.st));
    ok(st2.filter(x => x === 'saved').length === 2, W + ': يكمل من حيث توقّف (المحفوظ ٢ يبقى «حُفظ»): ' + st2.join(','));
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));   // كما في t_enrich_saveall: قاعدة الاختبار الوهمية
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
