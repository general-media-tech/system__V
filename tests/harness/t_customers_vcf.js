// (TASK-0211 · المالك seq 139) «ما في عندي انزلهم كملفات جهات الاتصال لحتى يتسيفوا على اي جهاز» ·
// «العملاء اللي عم تدخل من اوردرات ما عم يتسجل وجهتهم … مكان شحن الماضي»
// ① زبون الأوردر يُحفظ بوجهته (العمود address) — والقاعدة ترفض last_order/last_address كما الحقيقيّة ② الوجهة تتحدّث مع أوردرٍ جديد
// ③ تبويب العملاء يعرض «🚚 الوجهة» ويبحث بها ④ «📇 جهات الاتصال» ⇒ ملفّ vCard بالظاهرين (رقم دوليّ · العنوان · الهروب)
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const custs = () => H.call('/__dump', undefined, 'GET').then(d => d.gmt_customers || []);
(async () => {
  await H.seed();
  await H.call('/__opts', { reject_cols: ['last_order', 'last_address'] });
  const o1 = await H.open('orders.html', { w: 390, h: 844, wait: 4000, init: H.ADMIN_INIT });
  await o1.pg.evaluate(() => upsertCustomerFromOrder({ phone: '+963 933 111 222', name: 'زبون الشحن', address: 'حمص - الوعر، جانب الجامع', branch: 'حلب', id: 7 }));
  let c = (await custs()).find(x => x.phone === '0933111222');
  ok(c && c.name === 'زبون الشحن' && c.address === 'حمص - الوعر، جانب الجامع', 'زبون الأوردر حُفظ بوجهته (والقاعدة ترفض الأعمدة غير الموجودة): ' + JSON.stringify(c && [c.name, c.address]));
  await o1.pg.evaluate(() => upsertCustomerFromOrder({ phone: '0933111222', name: 'زبون الشحن', address: 'دمشق - المزة', branch: 'حلب', id: 8 }));
  c = (await custs()).filter(x => x.phone === '0933111222');
  ok(c.length === 1 && c[0].address === 'دمشق - المزة', 'أوردرٌ جديد ⇒ الوجهة صارت آخر مكان شحن (بلا تكرار الزبون): ' + JSON.stringify(c.map(x => x.address)));
  await o1.pg.evaluate(() => upsertCustomerFromOrder({ phone: '0933111222', name: 'زبون الشحن', address: '', branch: 'حلب', id: 9 }));
  ok((await custs()).find(x => x.phone === '0933111222').address === 'دمشق - المزة', 'أوردرٌ بلا عنوان لا يمحو الوجهة المحفوظة');
  await o1.browser.close();
  await H.call('/rest/v1/gmt_customers', [{ name: 'أحمد, الحلبي; ورفاقه', phone: '0944000111', branch_key: 'haleb', address: 'حلب - الفرقان', customer_type: 'wholesale' }, { name: 'بلا جوال', phone: '', branch_key: 'haleb' }]);
  for (const W of [390, 1366]) {
    const { browser, pg, errs } = await H.open('admin_pos.html?tab=customers', { init: H.ADMIN_INIT, w: W, h: 900, mobile: W < 500, wait: 6000 });
    await pg.evaluate(async () => { await loadCustomers(); switchTab('customers'); }); await pg.waitForTimeout(500);
    const txt = await pg.evaluate(() => document.getElementById('cust-list').innerText);
    ok(/الوجهة: دمشق - المزة/.test(txt) && /الوجهة: حلب - الفرقان/.test(txt), W + ': بطاقة العميل تعرض «🚚 الوجهة»: ' + (txt.match(/[^\n]*الوجهة[^\n]*/g) || []).join(' | '));
    await pg.evaluate(() => { window.__vcf = null; GMTShare.deliver = async (b, n, o) => { window.__vcf = { name: n, text: await b.text(), type: b.type, title: o && o.title }; return 'downloaded'; }; });
    await pg.click('[data-cust-vcf]'); await pg.waitForTimeout(500);
    let v = await pg.evaluate(() => window.__vcf);
    const cards = v ? (v.text.match(/BEGIN:VCARD/g) || []).length : 0;
    ok(v && /\.vcf$/.test(v.name) && v.type === 'text/vcard' && cards === 3 && /\r\n/.test(v.text) && !/بلا جوال/.test(v.text), W + ': «📇 جهات الاتصال» ⇒ ملفّ vCard بكلّ من له جوال (٣ — «بلا جوال» لا): ' + JSON.stringify(v && { n: v.name, cards }));
    ok(v && /TEL;TYPE=CELL:\+963933111222/.test(v.text) && /TEL;TYPE=CELL:\+963944000111/.test(v.text) && /FN:أحمد\\, الحلبي\\; ورفاقه/.test(v.text) && /ADR;TYPE=HOME:;;حلب - الفرقان;;;;/.test(v.text) && /NOTE:.*جملة/.test(v.text),
      W + ': الأرقام دوليّة (+963) · الفاصلة والفاصلة المنقوطة مهرَّبتان · الوجهة عنوان · النوع في الملاحظة');
    // البحث بالوجهة ثمّ التنزيل ⇒ الظاهرون فقط
    await pg.fill('#app-content input[type="search"]', 'المزة'); await pg.waitForTimeout(300);
    const cnt = await pg.evaluate(() => document.getElementById('cust-count-lbl').textContent);
    await pg.click('[data-cust-vcf]'); await pg.waitForTimeout(400);
    v = await pg.evaluate(() => window.__vcf);
    ok(/^1 /.test(cnt) && (v.text.match(/BEGIN:VCARD/g) || []).length === 1 && /933111222/.test(v.text), W + ': البحث بالوجهة يعمل · والملفّ للظاهرين فقط: ' + cnt);
    const hs = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!hs, W + ': لا طفح أفقي');
    const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
