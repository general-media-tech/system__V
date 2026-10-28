// (المالك seq 207 · 208) «منتجات كثيرة بنفس الصورة ونفس التصنيف (الأغطية · الكفرات) — ما في داعي نرفع لكل واحدة صور جديدة،
// كلهم يكونوا نفس الصورة … الأساسية الأحمر والصور الأخرى تُعرض — لكلٍّ أكثر من صورة».
// ① الزرّ يظهر للإدارة حين تُعرض مجموعة · ② الصور المتطابقة المحتوى (مرفوعة لكل منتج) تُجمع ببصمتها · الأكثر تكراراً أساسيّة افتراضياً
// ③ التطبيق: الأساسية رابطٌ واحد للكل · الخاصّة بمنتجٍ واحد تبقى له بعدها · المكرّرة تُستغنى عنها · ④ منتجٌ جديد في المجموعة بلا صورة يأخذ الأساسية.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const ST = 'https://ysawzwtmodkqqbqoiojj.supabase.co/storage/v1/object/public/products-images/t/';
const row = id => H.call('/rest/v1/products?id=eq.' + id + '&select=*', undefined, 'GET').then(r => r[0]);
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const P = prods.slice(0, 5).map(p => String(p.id));
    const imgs = [ST + 'red1.png', ST + 'red2.png', ST + 'red3.png', ST + 'yellow.png', ST + 'black.png'];   // red1..3 = المحتوى نفسه
    for (let i = 0; i < 5; i++) await H.call('/rest/v1/products?id=eq.' + P[i], { group_name: 'كفرات', image_url: imgs[i], images: null }, 'PATCH');
    const mob = W < 500;
    const { browser, pg, ctx, errs } = await H.open('inventory.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000 });
    await ctx.route(/\/storage\/v1\/object\/public\/products-images\/t\//, r => {
      const n = r.request().url().split('/').pop(); const body = Buffer.from(/^red/.test(n) ? 'RED-BYTES' : n === 'yellow.png' ? 'YELLOW-BYTES' : 'BLACK-BYTES');
      r.fulfill({ status: 200, contentType: 'image/png', body });
    });
    // ① بلا مجموعة ⇒ مخفي · مع «كفرات» ⇒ ظاهر
    const vis0 = await pg.evaluate(() => { setGroup(''); renderAll(); const b = document.querySelector('#group-chips-row [data-grpimg]'); return !!(b && b.offsetParent); });
    const vis1 = await pg.evaluate(() => { setGroup('كفرات'); renderAll(); const b = document.querySelector('#group-chips-row [data-grpimg]'); return !!(b && b.offsetParent); });
    ok(!vis0 && vis1, W + ': «🖼️ صورة موحّدة» في صفّ المجموعات حين تُعرض مجموعة: ' + JSON.stringify([vis0, vis1]));
    // ②
    await pg.evaluate(() => openGroupImages());
    await pg.waitForSelector('#gmt-grpimg [data-gt]', { timeout: 15000 });
    const tiles = await pg.evaluate(() => [...document.querySelectorAll('#gmt-grpimg [data-gt]')].map(t => t.innerText.replace(/\s+/g, ' ')));
    const mainChecked = await pg.evaluate(() => { const r = document.querySelector('#gmt-grpimg [data-gt] [data-gm]'); return !!(r && r.checked); });
    ok(tiles.length === 3 && /في 3 منتج · مرفوعة 3 مرّة/.test(tiles[0]) && mainChecked, W + ': ٣ صور فعلاً (الأحمر مرفوعٌ ٣ مرّات = صورة واحدة) والأكثر تكراراً أوّلاً: ' + tiles.join(' || ').slice(0, 160));
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/group_images_' + W + '.png' });
    // ③ الأساسية = الأحمر (الافتراضي) ⇒ طبّق
    await pg.click('#gmt-grpimg [data-ga]');
    await pg.waitForSelector('.gmtask-ov', { timeout: 5000 });
    await pg.evaluate(() => { const o = document.querySelector('.gmtask-ov'); [...o.querySelectorAll('button')].find(b => /طبّق/.test(b.textContent)).click(); });
    await pg.waitForFunction(() => { const m = document.querySelector('#gmt-grpimg [data-gmsg]'); return !document.getElementById('gmt-grpimg') || (m && /صار/.test(m.textContent)); }, null, { timeout: 15000 });
    const rows = await Promise.all(P.map(row));
    ok(rows.every(r => r.image_url === imgs[0]), W + ': الأساسية رابطٌ واحد (red1) لكل الخمسة: ' + rows.map(r => r.image_url.split('/').pop()).join(','));
    ok(JSON.stringify(rows[3].images) === JSON.stringify([imgs[0], imgs[3]]) && JSON.stringify(rows[4].images) === JSON.stringify([imgs[0], imgs[4]]), W + ': صورة المنتج الخاصّة (الأصفر · الأسود) باقيةٌ له بعد الأحمر');
    ok(rows.slice(0, 3).every(r => JSON.stringify(r.images) === JSON.stringify([imgs[0]])), W + ': red2/red3 (الصورة نفسها مكرّرة) استُغني عنهما');
    // ④ منتجٌ جديد في المجموعة بلا صورة
    const sh = await pg.evaluate(() => groupSharedImages('كفرات'));
    ok(sh && sh.main === imgs[0], W + ': منتجٌ جديد في «كفرات» بلا صورة يأخذ الأساسية: ' + JSON.stringify(sh));
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
