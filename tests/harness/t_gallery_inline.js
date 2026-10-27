// (TASK-0208 · المالك seq 139) «لازم ادخل على الصوره حتى يفتح لي اياها ولازم يعطيني ازرار انتقال او في السحب» ·
// «صور ما عم تنعرض … كم نقطه في وسط الشاشه صور المتجر» · الترتيب: في الجرد صورة الجرد أوّلاً ثمّ صور المتجر
// ① التقليب داخل صورة التفاصيل (‹ › · سحب · «٢ من ٣») ② كلّ صورةٍ تُحمَّل فعلاً (لا النائب الرماديّ) — داخل التفاصيل وفي العارض ③ النقر يفتح العارض على الصورة نفسها
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const loaded = sel => `(() => { const im = document.querySelector('${sel}'); if (!im) return 'none'; const s = im.currentSrc || im.src || ''; return (/^data:image\\/svg/.test(s) || !im.complete || !im.naturalWidth) ? 'placeholder' : 'ok'; })()`;
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const A = prods[0];
    await H.call('/rest/v1/products?id=eq.' + A.id, { store_url: 'https://x/store.html#product=s_a', image_url: 'https://img.example/inv-a.png' }, 'PATCH');
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'كاميرات', order: 1 }],
      products: [{ id: 's_a', name: 'متجر أ', price: 10, images: ['https://img.example/s1.png', 'https://img.example/s2.png', 'https://img.example/inv-a.png'], category_id: 'c1' }] }]);
    const { browser, ctx, pg, errs } = await H.open('inventory.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 5000, init: H.ADMIN_INIT });
    await ctx.route('https://img.example/**', r => r.fulfill({ status: 200, body: PNG, headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' } }));
    await pg.evaluate(id => openDetailModal(id), A.id);
    await pg.waitForSelector('#detail-modal-body .gmt-gal-in .gi-n', { timeout: 8000 }).catch(() => {});
    const W0 = '#detail-modal-body [data-gal-wrap]';
    const st = () => pg.evaluate(w => { const el = document.querySelector(w); const im = el && el.querySelector('img'); return { n: (el.querySelector('.gi-n') || {}).textContent, src: im && (im.getAttribute('data-orig-src') || im.src), btn: el.querySelectorAll('.gi-nav').length, dots: el.querySelectorAll('.gi-dots i').length }; }, W0);
    let s = await st();
    ok(s.n === '1 من 3' && s.btn === 2 && s.dots === 3 && /inv-a\.png/.test(s.src), W + ': داخل التفاصيل: ‹ › ونقاط و«1 من 3» · صورة الجرد أوّلاً (وصورة الجرد في المتجر لا تتكرّر): ' + JSON.stringify(s));
    await pg.waitForTimeout(600);
    ok(await pg.evaluate(loaded(W0 + ' img')) === 'ok', W + ': الصورة الأولى مُحمَّلة');
    await pg.click(W0 + ' .gi-next'); await pg.waitForTimeout(700);
    s = await st();
    const l2 = await pg.evaluate(loaded(W0 + ' img'));
    ok(s.n === '2 من 3' && /s1\.png/.test(s.src) && l2 === 'ok', W + ': «التالية» ⇒ صورة المتجر الأولى مُحمَّلة (لا نقاط): ' + JSON.stringify(s) + ' ' + l2);
    await pg.click(W0 + ' .gi-next'); await pg.waitForTimeout(700);
    s = await st(); const l3 = await pg.evaluate(loaded(W0 + ' img'));
    ok(s.n === '3 من 3' && /s2\.png/.test(s.src) && l3 === 'ok', W + ': والثالثة مُحمَّلة: ' + JSON.stringify(s) + ' ' + l3);
    await pg.click(W0 + ' .gi-prev'); await pg.waitForTimeout(300);
    ok((await st()).n === '2 من 3', W + ': «السابقة» ترجع');
    if (W < 500) {
      // سحبٌ بالإصبع: يسار ⇒ التالية
      await pg.evaluate(w => {
        const el = document.querySelector(w), r = el.getBoundingClientRect(), y = r.top + r.height / 2;
        const t = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(r.left + r.width * 0.75)], changedTouches: [t(r.left + r.width * 0.75)], bubbles: true }));
        el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(r.left + r.width * 0.2)], bubbles: true }));
      }, W0); await pg.waitForTimeout(300);
      ok((await st()).n === '3 من 3', W + ': السحب يساراً ⇒ التالية');
      await pg.waitForTimeout(450);
    }
    // النقر يفتح العارض على الصورة الحاليّة · وكلّ صورةٍ فيه مُحمَّلة
    const cur = (await st()).n;
    await pg.evaluate(w => document.querySelector(w + ' img').click(), W0); await pg.waitForTimeout(500);
    const g = await pg.evaluate(() => { const r = document.getElementById('gmt-gal'); return r && r.querySelector('.gg-n').textContent; });
    ok(g === cur, W + ': النقر ⇒ العارض على الصورة نفسها: ' + g + ' (كانت ' + cur + ')');
    const seen = [];
    for (let k = 0; k < 3; k++) { await pg.waitForTimeout(600); seen.push(await pg.evaluate(loaded('#gmt-gal .gg-stage img'))); await pg.keyboard.press('ArrowLeft'); }
    ok(seen.every(x => x === 'ok'), W + ': العارض: الصور الثلاث مُحمَّلة كلّها (كانت تبقى نقاطاً بعد الأولى): ' + JSON.stringify(seen));
    await pg.keyboard.press('Escape');
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!hs, W + ': لا طفح أفقي');
    if (W < 500) await pg.screenshot({ path: '/tmp/gmt-out/gallery_inline_390.png' });
    const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
