// (TASK-A0583 · المالك seq A1004) فحص «زرّ بزرّ» لنظام المشتريات — كلّ زرّ ظاهر في كلّ شاشة يُضغط فعلاً على خادم الاختبار
// ويُسجَّل أثره الحقيقيّ: كتابة في القاعدة (جدول/طريقة) · نافذة/شاشة فُتحت · تنزيل ملف · نافذة طباعة/تبويب · خطأ JS · أو «بلا أثر».
// الاستعمال: (python3 tests/harness/mock.py 8197 &) ; (python3 -m http.server 8765 --bind 127.0.0.1 &) ; node tests/harness/audit_purchase_buttons.js [out.json]
// ليس اختبار نجاح/فشل — يُنتج جدولاً يُراجع في docs/دراسة_المشتريات.md
const H = require('./h.js'), fs = require('fs');
const OUT = process.argv[2] || '/tmp/purchase_buttons.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let IDS = {};
async function seed() {
  await H.seed();
  const [A, B] = await H.call('/rest/v1/products', [
    { name: 'بطارية اختبار LP-E17', barcode: 'PA0001', price: 20, cost_price: 8, china: 0, daraa: 2 },
    { name: 'شاحن اختبار LC-E17', barcode: 'PA0002', price: 15, cost_price: 6, china: 0, daraa: 1 }]);
  const snap = [{ id: A.id, name: A.name, qty: 10, unit_price: 8, orig_unit_price: 8, barcode: 'PA0001' }, { id: B.id, name: B.name, qty: 5, unit_price: 6, orig_unit_price: 6, barcode: 'PA0002' }];
  const [T, R, I] = await H.call('/rest/v1/import_log', [
    { inv_number: 'IMP-2026-0901', inv_type: 'china', supplier: 'Shenzhen Audit', status: 'transit', total_amount: 110, items_count: 2, total_qty: 15, cost_shipping: 20, cost_customs: 10, currency: 'USD', dest_branch: 'daraa', items_snapshot: snap },
    { inv_number: 'IMP-2026-0902', inv_type: 'germany', supplier: 'Berlin Audit', status: 'arrived', total_amount: 110, items_count: 2, total_qty: 15, currency: 'USD', dest_branch: 'daraa', arrived_at: '2026-11-20T10:00:00Z', items_snapshot: snap },
    { inv_number: 'PUR-2026-0903', inv_type: 'instant', supplier: 'محلّ اختبار', status: 'arrived', total_amount: 110, items_count: 2, total_qty: 15, currency: 'USD', dest_branch: 'daraa', items_snapshot: snap }]);
  IDS = { T: T.id, R: R.id, I: I.id };
}
const STATES = [
  ['main · تبويب «في الطريق»', async pg => { await pg.evaluate(() => switchTab('transit')); }],
  ['main · تبويب «وصلت»', async pg => { await pg.evaluate(() => switchTab('arrived')); }],
  ['main · تبويب «فورية»', async pg => { await pg.evaluate(() => switchTab('instant')); }],
  ['main · تبويب «السجلّ»', async pg => { await pg.evaluate(() => switchTab('log')); }],
  ['نافذة فاتورة استيراد في الطريق', async pg => { await pg.evaluate(id => openInvFromList(id), IDS.T); }],
  ['نافذة فاتورة استيراد واصلة', async pg => { await pg.evaluate(id => openInvFromList(id), IDS.R); }],
  ['نافذة فاتورة فورية', async pg => { await pg.evaluate(id => (window.openInstantInvFromList || openInvFromList)(id), IDS.I); }],
  ['نافذة «تسجيل شحنة استيراد»', async pg => { await pg.evaluate(() => openImportMode()); }],
  ['نافذة «مشتريات فورية»', async pg => { await pg.evaluate(() => openInstantMode()); }],
  ['اختيار نوع الشراء', async pg => { await pg.evaluate(() => showTypeChooser()); }],
];
const LIST = () => {
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]'); };
  const topModal = [...document.querySelectorAll('.modal.open,[class*=modal]:not(.hidden),[id$=Modal].open,[id$=-modal]:not(.hidden),dialog[open]')].filter(vis).pop();
  const root = document;
  return [...root.querySelectorAll('button,[onclick],[role=button],a[href]')].filter(el => vis(el) && !el.disabled && !el.closest('#gmt-bug-panel,#gmt-inspect-panel,.gg4,#gmt-whatsnew,#gmt-intro,[id^=gmt-tour]'))
    .map((el, i) => { el.setAttribute('data-aud', String(i)); const lb = (el.innerText || el.title || el.getAttribute('aria-label') || el.id || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      return { k: String(i), label: lb, oc: (el.getAttribute('onclick') || '').slice(0, 80), id: el.id || '', inModal: !!(topModal && topModal.contains(el)), tag: el.tagName }; })
    .filter(x => x.label || x.oc);
};
(async () => {
  await seed();
  const results = [];
  for (const [sname, enter] of STATES) {
    let o = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 5000 });
    await enter(o.pg); await sleep(700);
    let items = await o.pg.evaluate(LIST);
    const seen = new Set(); items = items.filter(x => { const k = x.label + '|' + x.oc; if (seen.has(k)) return false; seen.add(k); return true; });
    /* داخل نافذة: الأزرار التي في النافذة فقط (أزرار الخلفيّة مفحوصة في حالات الصفحة) */
    if (/نافذة|اختيار/.test(sname) && items.some(x => x.inModal)) items = items.filter(x => x.inModal);
    await o.browser.close();
    console.log(`\n== ${sname}: ${items.length} زرّاً`);
    for (const it of items) {
      await seed();
      const { browser, pg, errs, ctx } = await H.open('purchase.html', { w: 1366, h: 900, mobile: false, wait: 5000 });
      const net = [], pops = [], dls = [], dlg = [];
      pg.on('request', r => { const u = r.url(); if (/\/rest\/v1\/|\/functions\/v1\/|\/storage\/v1\//.test(u) && r.method() !== 'GET' && r.method() !== 'HEAD' && r.method() !== 'OPTIONS' && !/__probe__/.test(r.postData() || '')) net.push(r.method() + ' ' + (u.match(/\/(?:rest|functions|storage)\/v1\/([^?]+)/) || [])[1]); });
      ctx.on('page', p => pops.push(p.url() || 'about:blank'));
      pg.on('download', d => dls.push(d.suggestedFilename()));
      pg.on('dialog', d => { dlg.push(d.type() + ': ' + d.message().slice(0, 60)); d.type() === 'prompt' ? d.accept('سبب فحص آليّ') : d.accept(); });
      let rec = { state: sname, label: it.label, onclick: it.oc, id: it.id };
      try {
        await enter(pg); await sleep(600);
        await pg.evaluate(LIST);
        const before = await pg.evaluate(() => ({ html: document.body.innerHTML.length, url: location.href, mods: document.querySelectorAll('.modal.open,[class*=modal]:not(.hidden),dialog[open]').length, toasts: [...document.querySelectorAll('[class*=toast]')].map(x => x.innerText).join('|') }));
        const e0 = errs.length;
        const el = await pg.$(`[data-aud="${it.k}"]`);
        if (!el) { rec.result = 'لم يُعثر عليه بعد إعادة الفتح'; results.push(rec); await browser.close(); continue; }
        await el.click({ timeout: 3000 }).catch(e => { rec.clickErr = String(e.message).slice(0, 80); });
        await sleep(1500);
        const after = await pg.evaluate(() => ({ html: document.body.innerHTML.length, url: location.href, mods: document.querySelectorAll('.modal.open,[class*=modal]:not(.hidden),dialog[open]').length, toasts: [...document.querySelectorAll('[class*=toast],#toast,.gmt-toast')].map(x => x.innerText).join('|').slice(-160) }));
        const jsErr = errs.slice(e0).filter(x => !/status of (400|401|404|406|409|503)|Failed to load resource/.test(x));
        rec.writes = [...new Set(net)]; rec.popups = pops; rec.downloads = dls; rec.dialogs = dlg; rec.jsErr = jsErr.slice(0, 2);
        rec.domDelta = after.html - before.html; rec.modalDelta = after.mods - before.mods; rec.nav = after.url !== before.url ? after.url.replace(/^.*\//, '') : '';
        rec.toast = after.toasts !== before.toasts ? after.toasts : '';
        rec.result = jsErr.length ? '❌ خطأ JS' : net.length ? '💾 كتابة' : (pops.length || dls.length) ? '📄 ملف/نافذة' : rec.nav ? '↪️ انتقال' : (rec.modalDelta || Math.abs(rec.domDelta) > 40 || dlg.length || rec.toast) ? '✔ أثر ظاهر' : '⚪ بلا أثر ظاهر';
      } catch (e) { rec.result = '❌ استثناء: ' + String(e.message).slice(0, 80); }
      results.push(rec);
      console.log(`  ${rec.result.padEnd(14)} ${it.label.slice(0, 40)}  ${rec.writes && rec.writes.length ? '[' + rec.writes.join(',') + ']' : ''}${rec.dialogs && rec.dialogs.length ? ' {' + rec.dialogs[0] + '}' : ''}${rec.jsErr && rec.jsErr.length ? ' ⟨' + rec.jsErr[0].slice(0, 90) + '⟩' : ''}`);
      await browser.close();
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  console.log('\nكُتب: ' + OUT + ' · ' + results.length + ' زرّاً');
})().catch(e => { console.error(e); process.exit(2); });
