// TASK-B0541 · المالك seq B1073: عرض السعر — حفظ بالنظام + الزبون بسجلّ الزبائن · اقتراح منتجات على سطر البند · تذكير متابعة ·
// القائمة المحفوظة · تحويل لفاتورة (pos.html?quote=) بمعرّف المنتج وبسعر العرض · السطر اليدوي لا يدخل · لا تجاوز للمخزون
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const all = (await H.call('/__dump', undefined, 'GET')).products;
  const p0 = all[0], p1 = all[1];
  // ① صفحة عرض السعر
  let { browser, pg, errs } = await H.open('quote.html', { init: H.ADMIN_INIT + "try{if(window===window.top)localStorage.removeItem('gmt_quote_draft')}catch(_){}", w: 430, h: 900, wait: 3500 });
  await pg.fill('#q-name', 'زبون العرض'); await pg.fill('#q-phone', '0944555666');
  await pg.click('#q-search'); await pg.keyboard.type(p0.name.slice(0, 6)); await sleep(500);
  await pg.click('#q-res [data-add="' + p0.id + '"]');
  // سطر يدوي + اقتراح منتج وهو عم ينكتب
  await pg.click('#q-manual'); const nm = '#q-items [data-f="name"][data-i="1"]';
  await pg.type(nm, p1.name.slice(0, 7), { delay: 30 }); await sleep(400);
  const sugN = await pg.evaluate(() => document.querySelectorAll('#q-sug [data-sug]').length);
  ok(sugN > 0, 'اقتراح منتجات الجرد وأنت عم تكتب اسم البند: ' + sugN);
  await pg.dispatchEvent('#q-sug [data-sug="' + p1.id + '"]', 'mousedown'); await sleep(300);
  const items = await pg.evaluate(() => JSON.parse(localStorage.getItem('gmt_quote_draft')).items);
  ok(items[1] && items[1].pid == p1.id && items[1].name === p1.name, 'الاقتراح بيربط السطر بالمنتج (pid + الاسم + السعر)');
  await pg.click('#q-manual'); await pg.fill('#q-items [data-f="name"][data-i="2"]', 'خدمة تركيب يدوية'); await pg.fill('#q-items [data-f="price"][data-i="2"]', '15');
  await pg.fill('#q-items [data-f="qty"][data-i="0"]', '99'); await pg.fill('#q-items [data-f="price"][data-i="0"]', '123');
  const today = await pg.evaluate(() => GMTQuotes.today()); await pg.fill('#q-follow', today);
  await sleep(400); await pg.click('#q-save'); await sleep(1500);
  const ref = await pg.evaluate(() => document.getElementById('q-ref').value);
  const d = await H.call('/__dump', undefined, 'GET');
  const row = (d.gmt_quotes || []).find(r => r.ref === ref);
  ok(row && row.items.length === 3 && row.customer_name === 'زبون العرض' && row.follow_up_at === today, 'العرض انحفظ بالنظام (٣ بنود · الاسم · التذكير): ' + ref);
  ok((d.gmt_customers || []).some(c => c.phone === '0944555666' && c.name === 'زبون العرض'), 'الزبون الجديد انحفظ بسجلّ الزبائن');
  ok(/محفوظ بالنظام/.test(await pg.textContent('#q-saved')), 'رسالة «محفوظ بالنظام»');
  ok(/1 عرض بدّو متابعة/.test(await pg.textContent('#q-due')) && await pg.isVisible('#q-due'), 'شارة «عرض بدّو متابعة» بالرأس');
  await pg.click('#q-list-btn'); await sleep(800);
  ok(await pg.evaluate(r => !!document.querySelector('#q-list-b [data-qref="' + r + '"]'), ref), 'القائمة المحفوظة بتعرض العرض');
  // إرسال واتساب ⇒ «انبعت»
  await pg.click('#q-list-x');
  await pg.evaluate(() => { window.open = () => null; if (window.GMTShare) GMTShare.image = () => Promise.resolve('shared'); });
  await pg.click('#q-wa'); await sleep(1200);
  ok(((await H.call('/__dump', undefined, 'GET')).gmt_quotes || []).find(r => r.ref === ref).status === 'sent', 'الإرسال على واتساب بيحفظ العرض ويعلّمه «انبعت»');
  ok(!errs.filter(e => !/404|favicon/.test(e)).length, 'بلا أخطاء JS: ' + JSON.stringify(errs.filter(e => !/404|favicon/.test(e)).slice(0, 2)));
  await browser.close();
  // ② نقطة البيع: pos.html?quote=REF
  ({ browser, pg, errs } = await H.open('pos.html?quote=' + encodeURIComponent(ref), { init: H.STAFF_INIT, w: 390, h: 844, wait: 6000 }));
  await pg.waitForFunction(() => Object.keys(cart || {}).length > 0, null, { timeout: 20000 }).catch(() => {});
  const c = await pg.evaluate(id => { const k = branch.key; return { n: Object.keys(cart).length, ids: Object.keys(cart), q0: cart[id[0]] && cart[id[0]].qty, st0: Number((allProducts.find(p => String(p.id) === String(id[0])) || {})[k]) || 0,
    pr0: cart[id[0]] && cart[id[0]].price, name: document.getElementById('custName').value, phone: document.getElementById('custPhone').value, ref: _posQuoteRef }; }, [String(p0.id), String(p1.id)]);
  ok(c.n === 2 && c.ids.includes(String(p0.id)) && c.ids.includes(String(p1.id)), 'البنود دخلت السلّة بمعرّف المنتج — والسطر اليدوي ما دخل');
  ok(c.pr0 === 123, 'بسعر العرض المتّفق عليه (123)');
  ok(c.q0 === c.st0 && c.st0 < 99, 'الكمّية ما بتتجاوز مخزون الفرع: ' + c.q0 + '/' + c.st0);
  ok(c.name === 'زبون العرض' && c.phone === '0944555666', 'اسم الزبون ورقمه تعبّوا');
  ok(c.ref === ref, 'العرض محفوظ لحتى يتعلّم «صار فاتورة» بعد الحفظ');
  await pg.evaluate(async r => { await GMTQuotes.mark(r, { status: 'converted', invoice_number: 'T-1' }); }, ref);
  const has = await pg.evaluate(() => typeof posImportQuote === 'function' && !!document.getElementById('pos-quote-imp'));
  ok(has, 'زرّ «📥 من عرض سعر» موجود بنقطة البيع');
  await pg.evaluate(() => { GMTQuotes.list = async () => [{ ref: 'QT-X', customer_name: 'س', total: 5, items: [{ name: 'a', qty: 1 }] }]; }); await pg.evaluate(() => posImportQuote()); await sleep(400);
  ok(await pg.evaluate(() => !!document.querySelector('#pos-quote-sheet [data-qref="QT-X"]')), 'نافذة الاستيراد بتعرض العروض المفتوحة');
  await browser.close();
  console.log(fails ? 'FAIL (' + fails + ')' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
