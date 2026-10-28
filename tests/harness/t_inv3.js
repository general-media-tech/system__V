const H = require('./h.js');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); return !!c; };
(async () => {
  await H.seed();
  const prods = await H.call('/rest/v1/products', [{ name: 'منتج بصورة', barcode: 'IMG1', price: 50, wholesale_price: 30, haleb: 3, daraa: 1, group_name: 'g', category: 'c',
    image_url: 'http://127.0.0.1:8765/logo.png', store_url: 'https://example.com/p/1' }]);
  const { browser, ctx, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT + "if(!sessionStorage.getItem('__once')){localStorage.removeItem('gmt_inv_view');sessionStorage.setItem('__once','1');}", w: 1366, h: 900, mobile: false, wait: 4500 });
  // 1) view persistence
  const v0 = await pg.evaluate(() => currentView);
  await pg.evaluate(() => { const b = document.querySelector('#view-toggle button[data-view="list"]'); setView('list', b); });
  await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => localStorage.getItem('gmt_inv_view')) === 'list', 'view saved on change (was ' + v0 + ')');
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(4000);
  const v1 = await pg.evaluate(() => ({ cv: currentView, act: [...document.querySelectorAll('#view-toggle button.active')].map(b => b.getAttribute('onclick') || b.title), inv: document.body.classList.contains('inv-list') }));
  console.log(JSON.stringify(v1));
  ok(v1.cv === 'list' && v1.inv, 'after reload view stays list');
  await pg.evaluate(() => { setView('cards', document.querySelectorAll('#view-toggle button')[2]); });
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(4000);
  const v2 = await pg.evaluate(() => ({ cv: currentView, tw: document.getElementById('table-wrap').style.display, cvw: document.getElementById('cards-view').style.display }));
  console.log(JSON.stringify(v2));
  ok(v2.cv === 'cards' && v2.cvw === 'block' && v2.tw === 'none', 'cards view restored with right display');
  // 2) manage hub
  const id = await pg.evaluate(() => String(allProducts.find(p => p.barcode === 'IMG1').id));
  await pg.evaluate((id) => openDetailModal(id), id); await pg.waitForTimeout(500);
  const hasBtn = await pg.evaluate(() => !!document.querySelector('#detail-modal-body button[onclick^="gmtManageProduct"]'));
  ok(hasBtn, 'detail modal has manage button');
  await pg.evaluate((id) => gmtManageProduct(id), id); await pg.waitForTimeout(300);
  const tiles = await pg.evaluate(() => [...document.querySelectorAll('#gmt-manage-ov [data-k]')].map(b => b.dataset.k));
  console.log('tiles', tiles.join(','));
  ok(['edit', 'store', 'view', 'ali', 'mov', 'tr'].every(k => tiles.includes(k)), 'hub tiles present');
  const vis = await pg.evaluate(() => { const o = document.getElementById('gmt-manage-ov'); const r = o.firstElementChild.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + 30); return { top: o.contains(e), w: r.width, h: r.height }; });
  ok(vis.top && vis.w > 300, 'hub visible on top');
  await pg.screenshot({ path: '/tmp/gmt-out/inv3_hub_1366.png' });
  await pg.click('#gmt-manage-ov [data-k="edit"]'); await pg.waitForTimeout(500);
  // (TASK-0233 · seq 161) «تعديل المنتج» ⇒ صفحة التعديل الواحدة (لا النافذة القصيرة)
  await pg.waitForSelector('#gmt-pe [data-f="name"]', { timeout: 8000 }).catch(() => {});
  ok(await pg.evaluate(() => !!document.getElementById('gmt-pe')), 'edit tile opens the single product edit page');
  await pg.evaluate(() => { const x = document.querySelector('#gmt-pe [data-pe-x]'); if (x) x.click(); });
  // 3) alibaba dialog uses own image + name
  await pg.evaluate(() => { closeModal('product-modal'); });
  await pg.evaluate(() => localStorage.setItem('gmt_brain_url', 'https://brain.example.test/fn')).catch(() => {});
  let sent = null;
  await ctx.route('https://brain.example.test/**', async r => { try { sent = JSON.parse(r.request().postData() || '{}'); } catch (_) { sent = { bad: 1 }; }
    await r.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ product: { name_ar: 'منتج', specs: [{ k: 'اللون', v: 'أسود' }], confidence: 'high' } }) }); });
  await ctx.route('http://127.0.0.1:8765/logo.png', r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') }));
  await pg.evaluate(() => { try { GMTEndpoint.set('brain', 'https://brain.example.test/fn'); } catch (e) { window.__e = String(e); } });
  const cfg = await pg.evaluate(() => ({ ep: (GMTEndpoint.get && GMTEndpoint.get('brain')) || null, e: window.__e || null }));
  console.log('endpoint', JSON.stringify(cfg));
  await pg.evaluate((id) => { window.__sp = gmtSpecsFromAlibaba(id); }, id); await pg.waitForTimeout(500);
  const dlg = await pg.evaluate(() => { const w = [...document.querySelectorAll('div')].find(d => d.innerHTML.includes('مواصفات منتج من علي بابا') && d.style.position === 'fixed'); return w ? { hasImg: !!w.querySelector('img'), txt: w.innerText.slice(0, 260), hint: w.querySelector('#pi-hint').value } : null; });
  console.log(JSON.stringify(dlg));
  ok(dlg && dlg.hasImg && /منتج بصورة/.test(dlg.txt) && dlg.hint === 'منتج بصورة', 'dialog shows product image+name, hint prefilled');
  await pg.screenshot({ path: '/tmp/gmt-out/inv3_ali_1366.png' });
  await pg.click('#pi-go'); await pg.waitForTimeout(2500);
  console.log('sent keys', sent && Object.keys(sent).join(','), 'imglen', sent && sent.image && sent.image.length, 'hint', sent && sent.hint);
  ok(sent && sent.mode === 'product' && sent.image && sent.image.length > 50 && sent.hint === 'منتج بصورة', 'request carries the stored image (base64) and the product name without any upload');
  console.log('errs', errs.filter(e => !/404|400|Failed|qrserver|ERR_/.test(e)).slice(0, 5));
  await browser.close();
})();
