const H = require('./h.js');
const OUT = '/tmp/gmt-out/';
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('inventory.html', { init: H.STAFF_INIT, w: 390, h: 800, wait: 6000 });
  const r = await pg.evaluate(() => {
    const adm = [...document.querySelectorAll('[data-admin]')];
    const faded = adm.map(e => ({ t: (e.textContent || e.title || e.id || '').trim().slice(0, 14), op: getComputedStyle(e).opacity, pe: getComputedStyle(e).pointerEvents })).slice(0, 12);
    const costVisible = [...document.querySelectorAll('th, .col-h, label')].map(e => e.textContent.trim()).filter(t => /سعر الشراء|الكلفة|التكلفة|cost/i.test(t)).slice(0, 5);
    const fn = typeof window.saveProduct;
    return { nAdmin: adm.length, faded, costVisible, saveProductType: fn, rows: document.querySelectorAll('tr, .prod-card, .pl-item').length };
  });
  console.log(JSON.stringify(r).slice(0, 900));
  // محاولة حفظ تعديلٍ كموظّف
  const prodId = (await H.call('/__dump', undefined, 'GET')).products[0].id;
  await pg.evaluate((id) => { try { const p = (window.products || []).find(x => String(x.id) === String(id)); window.__tryEdit = typeof window.saveProduct; } catch (e) {} }, prodId);
  await pg.screenshot({ path: OUT + 'inv_staff.png' });
  console.log('errors:', errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 3));
  await browser.close();
})();
