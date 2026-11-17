// (VER-1#REQ-0055 · REQ-0059) نطاق الكفالة من منتج الجرد: نقطة البيع تمرّر معرّف القطعة وصنفها ومجموعتها ⇒
// صفحة الكفالة تحكم قاطعاً (المجموعة «عدسات» تحت صنفٍ عامّ = مكفولة · «حقائب» = خارج النطاق إلّا بإذن الإدارة) ويُحفظ product_id.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  await H.call('/rest/v1/invoices', { inv_number: 'INV-77', branch_key: 'haleb', total: 500, customer_name: 'زبون كفالة' });
  const items = [{ name: 'RF 50mm STM', pid: 501, cat: 'تصوير', grp: 'عدسات' }, { name: 'حقيبة ظهر احترافية', pid: 502, cat: 'تصوير', grp: 'حقائب' }];
  const q = new URLSearchParams({ prefill: '1', name: 'زبون كفالة', phone: '0999000111', inv: 'INV-77', date: '2026-11-01', product: items[0].name, serial: 'SN-1',
    pid: '501', cat: 'تصوير', grp: 'عدسات', items: encodeURIComponent(JSON.stringify(items)) });
  const { browser, pg, errs } = await H.open('guarantee.html?' + q.toString(), { w: 1366, h: 900, mobile: false, wait: 4000 });

  /* ① المنطق المشترك */
  const c = await pg.evaluate(() => ({
    lens: GMTWarrantyScope.check({ name: 'x', category_name: 'تصوير', group_name: 'عدسات' }),
    bag: GMTWarrantyScope.check({ name: 'Canon bag', category_name: 'تصوير', group_name: 'حقائب Canon' }),
    camCat: GMTWarrantyScope.check({ name: 'x', category_name: 'كاميرات وعدسات', group_name: 'بطاريات' }),
    nameOnly: GMTWarrantyScope.check({ name: 'Canon EOS R6' }),
  }));
  ok(c.lens.ok && c.lens.basis === 'group', 'عدسة مجموعتها «عدسات» تحت صنف عامّ ⇒ مكفولة (basis=group): ' + c.lens.why);
  ok(!c.bag.ok && c.bag.basis === 'category', 'حقيبة (ولو فيها اسم ماركة) ⇒ خارج النطاق قاطعاً: ' + c.bag.why);
  ok(c.camCat.ok && c.camCat.basis === 'category', 'الصنف الذي يضمّ الكاميرات والعدسات ⇒ مكفول: ' + c.camCat.why);
  ok(c.nameOnly.ok && c.nameOnly.basis === 'name', 'بلا صنف ولا مجموعة ⇒ الاسم (أضعف أساس) كما كان');

  /* ② التعبئة من الفاتورة: لا تحذير للعدسة · تحذيرٌ قاطع للحقيبة */
  const w1 = await pg.evaluate(() => { const b = document.getElementById('scopeWarn'); document.getElementById('productName').dispatchEvent(new Event('input')); return getComputedStyle(b).display; });
  ok(w1 === 'none', 'العدسة من الفاتورة ⇒ لا تحذير');
  await pg.evaluate(() => { [...document.querySelectorAll('[data-pi]')][1].click(); });
  await pg.waitForTimeout(200);
  const w2 = await pg.evaluate(() => { const b = document.getElementById('scopeWarn'); return { d: getComputedStyle(b).display, t: b.textContent }; });
  ok(w2.d !== 'none' && /خارج نطاق الكفالة/.test(w2.t) && /حقائب/.test(w2.t), 'اختيار الحقيبة من قطع الفاتورة ⇒ تحذيرٌ قاطع: ' + w2.t.slice(0, 80));

  /* ③ الإصدار: الحقيبة تُمنع بلا إذن الإدارة · العدسة تُصدَر ومعها product_id */
  const submit = () => pg.evaluate(async () => {
    window.__asks = []; GMTAsk.confirm = async (m) => { window.__asks.push(String(m)); return false; };
    document.getElementById('expiryDate').value = '2027-11-01';
    document.getElementById('warrantyForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 1500));
    return window.__asks;
  });
  let asks = await submit();
  let d = await H.call('/__dump', undefined, 'GET');
  ok(!(d.warranties || []).length && asks.some(a => /حقائب/.test(a)), 'الحقيبة: سؤال إذن الإدارة بسبب المجموعة، والرفض ⇒ لا كفالة: ' + (asks[0] || '').slice(0, 70));
  await pg.evaluate(() => { [...document.querySelectorAll('[data-pi]')][0].click(); });
  asks = await submit();
  d = await H.call('/__dump', undefined, 'GET');
  const w = (d.warranties || [])[0];
  ok(!asks.length && w && w.product_name === 'RF 50mm STM', 'العدسة: تُصدَر بلا سؤال (الحكم من المجموعة لا من الاسم)');
  ok(w && String(w.product_id) === '501', 'الكفالة المحفوظة مربوطة بمنتج الجرد product_id=501: ' + (w && w.product_id));
  const real = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|favicon|vibrate/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
