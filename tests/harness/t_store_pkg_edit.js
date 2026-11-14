// (TASK-B0405 · المالك seq 716) «التعديل في البكج أو المجموعة في المتجر ما في زرّ تعديل لهم» — قلم على بطاقة الباقة وزرّ في نافذتها للمدير يفتحان محرّر الباقات
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const B = H.BASE;
const st = { categories: [{ id: 'c_bundles', name: 'باقات وعروض', order: 0 }, { id: 'c0', name: 'قسم', order: 1 }], banners: [], offers: [], branches: [], products: [{ id: 'x1', name: 'منتج', price: 10, category_id: 'c0' }] };
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  await H.call('/rest/v1/gmt_offers', { name: 'باقة التجربة', offer_type: 'bundle', offer_price: 50, is_active: true, targets: { site: true, store: true, cats: ['c_bundles'] }, image_url: B + 'logo.jpg', images: [B + 'logo.jpg'], products: JSON.stringify([{ id: 'a', name: 'قطعة', qty: 1, price: 60 }]) });
  // زائر: لا قلم
  const v = await H.open('logo.jpg', { init: `try{localStorage.clear();localStorage.setItem('gmt_intro_seen_build','x')}catch(e){}`, w: 412, h: 860, mobile: true, wait: 0 });
  await v.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await v.pg.goto(B + 'store.html', { waitUntil: 'domcontentloaded' }); await v.pg.waitForTimeout(6000);
  const vis = await v.pg.evaluate(() => ({ card: !!document.querySelector('[data-pkg]'), pen: !!document.querySelector('[data-pkg] [data-pkg-edit]') }));
  ok(vis.card && !vis.pen, '① الزائر: لا قلم تعديل على الباقة ' + JSON.stringify(vis));
  await v.browser.close();
  // المدير (وضع المعاينة): قلم + زرّ في النافذة يفتحان المحرّر
  const o = await H.open('logo.jpg', { init: H.ADMIN_INIT + `try{sessionStorage.setItem('gmt_admin_mode','1')}catch(e){}`, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(B + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(6000);
  await o.pg.evaluate(() => { window.GMTRole = Object.assign(window.GMTRole || {}, { requireAdmin: async () => true }); window.__opened = null; const orig = GMTPackages.open; GMTPackages.open = (opts) => { window.__opened = opts && opts.offer && opts.offer.name; }; });
  const pen = await o.pg.evaluate(() => !!document.querySelector('[data-pkg] [data-pkg-edit]'));
  ok(pen, '② المدير: قلم التعديل على بطاقة الباقة');
  await o.pg.evaluate(() => document.querySelector('[data-pkg] [data-pkg-edit]').click()); await o.pg.waitForTimeout(1200);
  const op1 = await o.pg.evaluate(() => ({ opened: window.__opened, detail: !!document.querySelector('#package-modal.active') }));
  ok(op1.opened === 'باقة التجربة' && !op1.detail, '② القلم يفتح محرّر الباقة نفسها (لا تفاصيل الباقة) ' + JSON.stringify(op1));
  await o.pg.evaluate(() => { window.__opened = null; openPackageDetail(store.packages[0].id); }); await o.pg.waitForTimeout(800);
  const btn = await o.pg.evaluate(() => { const b = document.querySelector('#package-foot [data-pkg-edit]'); return b && b.innerText.trim(); });
  ok(/تعديل الباقة/.test(btn || ''), '③ زرّ «تعديل الباقة» داخل نافذة الباقة');
  await o.pg.evaluate(() => document.querySelector('#package-foot [data-pkg-edit]').click()); await o.pg.waitForTimeout(1200);
  ok(await o.pg.evaluate(() => window.__opened) === 'باقة التجربة', '③ الزرّ يفتح المحرّر');
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
