// (المالك seq 209) «أداة البحث اللي بتقارن منتجات المتجر مع منتجات الجرد ليس فقط على الاسم الحرفي — أحياناً الاسم على الجرد غير الاسم
// تماماً على المتجر — تبحث عميق: يشتغل العقل يراجع الصور أو النصوص».
// ① نافذة الربط مرتّبة بالأقرب (الموديل · الأسماء · الصورة) مع درجة · ② الاسم مختلفٌ كلّياً والصورة نفسها ⇒ في الأعلى
// ③ البحث بكلمةٍ بالعمق («r6 مارك 2» يجد «EOS R6 Mark II») · ④ «🧠 اسأل العقل» يختار المطابق ويقول لماذا · ⑤ العقل يقول «لا أحد» ⇒ لا اختيار.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const BRAIN_URL = 'https://ysawzwtmodkqqbqoiojj.supabase.co/functions/v1/gmt-brain';
const IMG = 'https://ysawzwtmodkqqbqoiojj.supabase.co/storage/v1/object/public/products-images/t/';
const png = (r, g, b, pat) => { const z = require('zlib'), w = 16, h = 16, rows = [];
  let seed = { diag: 7, anti: 1234, check: 98765, stripes: 4242 }[pat]; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const M = Array.from({ length: 256 }, rnd), P = (x, y) => M[y * 16 + x] > 0.5;      // صورٌ «حقيقيّة» مختلفة البنية (والزوج نفسه للكفر)
  for (let y = 0; y < h; y++) { const row = [0]; for (let x = 0; x < w; x++) { const on = P(x, y); row.push(on ? r : 255, on ? g : 255, on ? b : 255); } rows.push(Buffer.from(row)); }
  const ch = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(require('zlib').crc32 ? z.crc32(Buffer.concat([Buffer.from(t), d])) >>> 0 : 0); return Buffer.concat([len, Buffer.from(t), d, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', z.deflateSync(Buffer.concat(rows))), ch('IEND', Buffer.alloc(0))]); };
(async () => {
  for (const W of [390, 1366]) {
    const { prods } = await H.seed();
    const [A, B, C] = prods.map(p => String(p.id));
    await H.call('/rest/v1/products?id=eq.' + A, { name: 'كاميرا كانون R6 مارك 2', image_url: IMG + 'cam.png' }, 'PATCH');
    await H.call('/rest/v1/products?id=eq.' + B, { name: 'كفر سيليكون احمر', image_url: IMG + 'cover.png' }, 'PATCH');
    await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-10-17T21:08:21.137229+00:00', categories: [{ id: 'c1', name: 'كاميرات', order: 1 }], products: [
      { id: 's_r6', name: 'Canon EOS R6 Body', price: 1500, images: [IMG + 'other1.png'], category_id: 'c1' },
      { id: 's_r6ii', name: 'Canon EOS R6 Mark II Body', price: 2100, images: [IMG + 'other2.png'], category_id: 'c1' },
      { id: 's_case', name: 'Protective rubber skin for DSLR', price: 12, images: [IMG + 'cover-store.png'], category_id: 'c1' },
      { id: 's_x', name: 'Godox SL60W', price: 120, images: [], category_id: 'c1' }] }]);
    const mob = W < 500;
    const { browser, pg, ctx, errs } = await H.open('bridge.html', { w: W, h: mob ? 844 : 900, mobile: mob, wait: 5000 });
    await ctx.route(/products-images\/t\//, r => { const n = r.request().url().split('/').pop();
      const body = /cover/.test(n) ? png(220, 20, 20, 'diag') : n === 'cam.png' ? png(20, 20, 20, 'anti') : n === 'other1.png' ? png(30, 200, 30, 'check') : png(20, 20, 200, 'stripes');
      r.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body }); });
    let brainQ = '', brainAns = '{"pick":2,"confidence":92,"why":"R6 مارك 2 = EOS R6 Mark II"}';
    await ctx.route(BRAIN_URL, r => { const b = JSON.parse(r.request().postData() || '{}'); brainQ = b.question || '';
      const k = (brainQ.split('\n').find(l => /Mark II/.test(l)) || '').match(/^\[(\d+)\]/); if (/"pick":2/.test(brainAns) && k) brainAns = brainAns.replace('"pick":2', '"pick":' + k[1]);
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ answer: brainAns }) }); });
    await pg.evaluate(u => { try { localStorage.setItem('gmt_brain_endpoint', u); } catch (_) {} if (window.GMTEndpoint && GMTEndpoint.set) try { GMTEndpoint.set('brain', u); } catch (_) {} }, BRAIN_URL);
    // ① + ③
    await pg.evaluate(id => openLinkModal(id), A);
    await pg.waitForTimeout(1500);
    const L1 = await pg.evaluate(() => [...document.querySelectorAll('#ml-list .match-item')].map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 60)));
    ok(/R6 Mark II/.test(L1[0] || '') && /\d+%/.test(L1[0]) && /R6 Body/.test(L1[1] || ''), W + ': الأقرب أوّلاً بدرجة — «R6 مارك 2» ⇐ R6 Mark II ثمّ R6: ' + L1.slice(0, 2).join(' || '));
    const L3 = await pg.evaluate(() => { document.getElementById('ml-search').value = 'r6 مارك 2'; mlRender(); return [...document.querySelectorAll('#ml-list .match-item')].map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 40)); });
    ok(L3.length && /R6 Mark II/.test(L3[0]), W + ': البحث بالعمق «r6 مارك 2» يجد «Canon EOS R6 Mark II» (الحرفي لا يجده): ' + L3.join(' | '));
    if (W === 390) await pg.screenshot({ path: '/tmp/gmt-out/bridge_deep_' + W + '.png' });
    // ④
    await pg.evaluate(() => { document.getElementById('ml-search').value = ''; mlRender(); });
    await pg.click('#ml-ai-btn');
    await pg.waitForFunction(() => /العقل:/.test((document.getElementById('ml-ai-res') || {}).textContent || ''), null, { timeout: 8000 });
    const a = await pg.evaluate(() => ({ t: document.getElementById('ml-ai-res').textContent, sel: mlMatchId }));
    ok(a.sel === 's_r6ii' && /92%/.test(a.t) && /R6 مارك 2 = EOS R6 Mark II/.test(a.t) && /المصدر: كاميرا كانون R6 مارك 2/.test(brainQ) && /\[1\]/.test(brainQ), W + ': «اسأل العقل» اختار R6 Mark II وقال لماذا: ' + a.t.slice(0, 90));
    // ⑤
    brainAns = '{"pick":null,"confidence":80,"why":"لا R6 هنا"}';
    await pg.evaluate(() => { mlMatchId = null; });
    await pg.click('#ml-ai-btn');
    await pg.waitForFunction(() => /لا أحد/.test((document.getElementById('ml-ai-res') || {}).textContent || ''), null, { timeout: 8000 });
    ok(await pg.evaluate(() => mlMatchId == null), W + ': العقل «لا أحد» ⇒ لا اختيار');
    await pg.evaluate(() => closeModal('modal-link'));
    // ② الاسم مختلفٌ كلّياً والصورة نفسها
    await pg.evaluate(id => openLinkModal(id), B);
    await pg.waitForFunction(() => Object.values(_mlScore).some(r => r.img != null), null, { timeout: 10000 }).catch(() => {});
    if (process.env.DBG) console.log(await pg.evaluate(() => JSON.stringify(Object.values(_mlScore).map(r => [r.item.id, +r.text.toFixed(2), r.img, +r.score.toFixed(2)]))));
    const L2 = await pg.evaluate(() => [...document.querySelectorAll('#ml-list .match-item')].map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 50)));
    ok(/rubber skin/.test(L2[0] || ''), W + ': «كفر سيليكون احمر» ⇐ «Protective rubber skin» أوّلاً بالصورة (الاسم مختلفٌ كلّياً): ' + L2.slice(0, 2).join(' || '));
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
