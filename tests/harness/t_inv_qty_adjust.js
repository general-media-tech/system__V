// (TASK-0299 · المالك seq 320) «زر التعديل في نظام الجرد لازم يحتوي على زر اسمه تعديل الكميات … تعديل سريع لكمّيات الأفرع أو نقاط البيع
// مع إنشاء فاتورة تسوية عند نقطة البيع: تمّت إضافة أو خصم، وبتظهر في سجلّ نقطة البيع»
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
(async () => {
  const { prods } = await H.seed();
  const P = prods[0];      // haleb 6 · daraa 2
  const { browser, pg, errs } = await H.open('inventory.html', { w: 1366, h: 900, wait: 5000, mobile: false });
  /* ① الزرّ في صفحة التعديل */
  const btn = await pg.evaluate(async (pid) => { invOpenFullEdit(pid); await new Promise(r => setTimeout(r, 900)); const b = document.querySelector('#gmt-pe [data-pe-qty]'); const t = b && b.textContent.trim(); const x = document.querySelector('#gmt-pe [data-pe-x]'); if (x) x.click(); return t; }, P.id);
  ok(/تعديل الكميات/.test(btn || ''), 'زرّ «📦 تعديل الكميات» في صفحة التعديل: ' + btn);
  /* ② حلب 6 ⇐ 9 (+3) · درعا 2 ⇐ 0 (−2) */
  const r = await pg.evaluate(async (pid) => {
    const seen = {};
    GMTAsk.form = async (msg, o) => { seen.fields = o.fields.map(f => f.k + '=' + f.value); return { result: Object.assign({}, ...o.fields.map(f => ({ [f.k]: f.value })), { haleb: '9', daraa: '٠', __why: 'جرد يدوي' }) }; };
    GMTAsk.confirm = async (m) => { seen.confirm = m; return true; };
    GMTAsk.alert = async (m) => { seen.alert = m; };
    if (window.GMTAuth) GMTAuth.ask = async () => true;
    const res = await invQtyAdjust(pid);
    const p = allProducts.find(x => String(x.id) === String(pid));
    return { res, seen, local: { haleb: p.haleb, daraa: p.daraa } };
  }, P.id);
  ok(r.seen.fields && r.seen.fields.some(f => f === 'haleb=6') && r.seen.fields.some(f => f === 'daraa=2'), 'النافذة تبدأ بالكمّيات الحاليّة لكلّ فرع: ' + (r.seen.fields || []).slice(0, 4).join(' · '));
  ok(/حلب: 6 ⇐ 9 \(\+3\)/.test(r.seen.confirm || '') && /درعا: 2 ⇐ 0 \(−2\)/.test(r.seen.confirm || ''), 'التأكيد يعرض الإضافة والخصم لكلّ فرع');
  ok(r.res && r.res.done === 2 && r.res.bad === 0, 'صدرت فاتورتا تسوية (فرعان تغيّرا): ' + JSON.stringify(r.res));
  const row = (await H.call('/rest/v1/products?id=eq.' + P.id + '&select=haleb,daraa,homs', undefined, 'GET'))[0];
  ok(row.haleb === 9 && row.daraa === 0, 'الكمّيات في القاعدة: حلب 9 · درعا 0 — ' + JSON.stringify(row));
  ok(r.local.haleb === 9 && r.local.daraa === 0, 'والجرد المعروض تحدّث');
  const tr = await H.call('/rest/v1/branch_stock_transfers?select=transfer_number,from_branch,to_branch,status,is_locked,title,note,created_by&order=id.asc', undefined, 'GET');
  const up = tr.find(t => t.to_branch === 'haleb'), dn = tr.find(t => t.from_branch === 'daraa');
  ok(up && dn && up.status === 'received' && dn.status === 'received' && up.is_locked && dn.is_locked, 'فاتورتان مستلَمتان مقفلتان: إلى حلب (إضافة) · من درعا (خصم)');
  ok(up && /فاتورة تسوية من الجرد — جرد يدوي/.test(up.note || ''), 'الفاتورة مكتوبٌ عليها «فاتورة تسوية من الجرد» والسبب: ' + (up && up.note || '').slice(0, 90));
  const its = await H.call('/rest/v1/stock_transfer_items?select=product_id,qty,notes,received_at', undefined, 'GET');
  ok(its.length === 2 && its.every(i => i.received_at) && its.some(i => i.qty === 3 && /قبل 6 ⇐ بعد 9/.test(i.notes)) && its.some(i => i.qty === 2 && /قبل 2 ⇐ بعد 0/.test(i.notes)), 'بنود الفاتورتين: +3 و−2 بقبل/بعد');
  ok(/صدرت فاتورة تسوية/.test(r.seen.alert || ''), 'رسالة النتيجة بأرقام الفواتير: ' + (r.seen.alert || '').replace(/\n/g, ' ').slice(0, 100));
  /* ③ بلا تغيير ⇒ لا فاتورة */
  const r3 = await pg.evaluate(async (pid) => { GMTAsk.form = async (m, o) => ({ result: Object.assign({}, ...o.fields.map(f => ({ [f.k]: f.value }))) }); return invQtyAdjust(pid); }, P.id);
  const tr2 = await H.call('/rest/v1/branch_stock_transfers?select=id', undefined, 'GET');
  ok(r3 === undefined && tr2.length === tr.length, 'بلا تغيير ⇒ لا فاتورة');
  ok(!errs.filter(e => !/favicon|Failed to load resource/.test(e)).length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 3)));
  await browser.close();
  /* ④ تظهر في سجلّ نقطة البيع (درعا) */
  const s = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, h: 844, wait: 5000 });
  const log = await s.pg.evaluate(async () => {
    const r = await fetch(CONFIG.SUPABASE_URL + '/rest/v1/branch_stock_transfers?or=(from_branch.eq.daraa,to_branch.eq.daraa)&select=transfer_number,title,status', { headers: sbHeaders() });
    return r.ok ? await r.json() : [];
  });
  ok(log.length >= 1 && log.some(t => t.status === 'received' && /تسوية من الجرد/.test(t.title)), 'سجلّ نقطة بيع درعا يقرأ فاتورة التسوية: ' + JSON.stringify(log.map(t => t.transfer_number + ' ' + t.title)));
  await s.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
