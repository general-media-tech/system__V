// (TASK-B0394 · المالك seq B693 «كمل كلشي») ٧ تنبيه الحدّ الأدنى في نقطة البيع · ١٠ تصدير سجلّ الحركة · ١ «وصل حديثاً» في المتجر
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  const P = ((await dump()).products || []).filter(p => p.price > 0).slice(0, 2);
  await H.call('/rest/v1/products?id=eq.' + P[0].id, { daraa: 3, min_stock: 5 }, 'PATCH');
  await H.call('/rest/v1/products?id=eq.' + P[1].id, { daraa: 1, min_stock: 0 }, 'PATCH');
  await H.call('/rest/v1/branch_stock_transfers', { id: 'trf91001', transfer_number: 'TRF-91001', from_branch: 'homs', to_branch: 'daraa', status: 'received', created_at: new Date().toISOString(), received_at: new Date().toISOString() });
  await H.call('/rest/v1/stock_transfer_items', { transfer_id: 'trf91001', product_id: P[0].id, product_name: P[0].name, barcode: P[0].barcode, qty: 2, received_at: new Date().toISOString() });
  const o = await H.open('pos.html', { init: H.STAFF_INIT + ';window.__toasts=[];', w: 390, h: 844, mobile: true, wait: 7000 });
  await o.pg.evaluate(() => { const T = window.showToast; window.showToast = function (m, t) { window.__toasts.push(String(m)); return T && T.apply(this, arguments); }; });
  const t1 = await o.pg.evaluate(async ids => { newInvoice(); toggleProd(ids[0]); await new Promise(r => setTimeout(r, 1100)); toggleProd(ids[1]); await new Promise(r => setTimeout(r, 1100)); toggleProd(ids[0]); await new Promise(r => setTimeout(r, 300)); return window.__toasts.slice(); }, [P[0].id, P[1].id]);
  const low = t1.filter(x => /تحت الحدّ الأدنى/.test(x)), last = t1.filter(x => /آخر قطعة/.test(x));
  ok(low.length === 1 && /يبقى 2/.test(low[0]) && /\(5\)/.test(low[0]), '٧ بيعٌ يُنزل المخزون تحت الحدّ الأدنى ⇒ تنبيهٌ واحد (لا يتكرّر للمنتج نفسه): ' + low.join(' | '));
  ok(last.length === 1, '٧ بيع آخر قطعة ⇒ «آخر قطعة … اطلب نقلاً أو شراءً»: ' + last.join(' | '));
  // ١٠ التصدير
  await o.pg.evaluate(() => openMovesLog()); await o.pg.waitForTimeout(2500);
  const [dl] = await Promise.all([o.pg.waitForEvent('download', { timeout: 8000 }), o.pg.click('#mv-xls')]);
  const fp = await dl.path(); const txt = require('fs').readFileSync(fp, 'utf8');
  ok(/^﻿التاريخ,النوع,الرقم/.test(txt) && /TRF-91001/.test(txt) && /\.csv$/.test(dl.suggestedFilename()), '١٠ «⬇️ إكسل» ينزّل ملفّاً بالعربية (BOM) فيه الحركات: ' + dl.suggestedFilename() + ' · ' + JSON.stringify(txt.slice(0, 260)));
  await o.browser.close();
  // ١ المتجر: وصل حديثاً
  const now = Date.now();
  const prods = Array.from({ length: 6 }, (_, i) => ({ id: 'p_' + (now - i * 864e5), name: 'جديد ' + i, price: 10 + i, category_id: 'c0', images: [H.BASE + 'img/p/lens_f7ca8222-9a32-4975-babd-6317bd587ddf_1793191484385.png'] }))
    .concat([{ id: 'p_' + (now - 90 * 864e5), name: 'قديم', price: 5, category_id: 'c0', images: [H.BASE + 'img/p/lens_f7ca8222-9a32-4975-babd-6317bd587ddf_1793191484385.png'] }]);
  const st = { categories: [{ id: 'c0', name: 'قسم', order: 0 }], banners: [], offers: [], branches: [], products: prods };
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: new Date().toISOString(), ...st }]);
  const s = await H.open('logo.jpg', { init: `try{localStorage.clear();localStorage.setItem('gmt_intro_seen_build','x')}catch(e){}`, w: 412, h: 860, mobile: true, wait: 0 });
  await s.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await s.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await s.pg.waitForTimeout(4000);
  const nw = await s.pg.evaluate(() => { const secs = [...document.querySelectorAll('[data-container="products-area"] > section[data-category-section]')]; const n = document.querySelector('section[data-category-section="__new"]');
    return { first: secs[0] && secs[0].dataset.categorySection, title: n && n.querySelector('h3').textContent, names: n ? [...n.querySelectorAll('.line-clamp-2,h4')].map(x => x.textContent.trim()).filter(Boolean) : [], cards: n ? n.querySelectorAll('.quick-cart-btn').length : 0 }; });
  ok(nw.first === '__new' && /وصل حديثاً/.test(nw.title) && nw.cards === 6, '١ «🆕 وصل حديثاً» أعلى المتجر بآخر المنتجات (6) · بلا القديم (90 يوماً): ' + JSON.stringify(nw).slice(0, 160));
  await s.pg.evaluate(() => performSearch('جديد'));
  ok(await s.pg.evaluate(() => document.querySelector('section[data-category-section="__new"]').style.display === 'none'), '١ يُخفى مع البحث كبقيّة الأقسام');
  const real = s.errs.filter(x => !/status of (400|401|404|406|503)|Failed to load resource|AudioContext/.test(x));
  ok(!real.length, 'لا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await s.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
