// TASK-B0550 · المالك seq B1083: «شو هالتخبيص — زرّين بحث جنب بعضهم … بدّي البحث لكلّ الأزرار: الفرعية والموجودة والداخلية
//   (تعديل فاتورة مشتريات · إنشاء عرض سعر)». الجذر: أيقونة 🧠 كانت «search» ⇒ زرّ العقل شكله عدسة بحث جنب زرّ البحث.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  let { browser, pg, errs } = await H.open('orders.html', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 5000 });
  await pg.waitForSelector('#gmt-tsearch-btn', { timeout: 8000 }).catch(() => {});
  const ic = await pg.evaluate(() => ({ b: (document.getElementById('gmt-brain-btn') || {}).innerHTML || '', s: (document.getElementById('gmt-tsearch-btn') || {}).innerHTML || '' }));
  ok(ic.b && ic.s && ic.b !== ic.s, 'زرّ العقل وزرّ البحث بأيقونتين مختلفتين (كانوا نفس العدسة)');
  await pg.click('#gmt-tsearch-btn'); await pg.fill('#gmt-tsearch [data-ts-q]', 'تعديل فاتورة مشتريات');
  await pg.waitForFunction(() => /بصفحات تانية/.test(document.querySelector('#gmt-tsearch [data-ts-res]').innerText), null, { timeout: 8000 }).catch(() => {});
  let t = await pg.evaluate(() => document.querySelector('#gmt-tsearch [data-ts-res]').innerText);
  ok(/تعديل الفاتورة|تفعيل التعديل/.test(t) && /المشتريات|purchase/.test(t), '«تعديل فاتورة مشتريات» ⇒ زرّ التعديل الداخلي بصفحة المشتريات: ' + t.split('\n').slice(0, 6).join(' | '));
  await pg.fill('#gmt-tsearch [data-ts-q]', 'انشاء عرض سعر'); await pg.waitForTimeout(300);
  t = await pg.evaluate(() => [...document.querySelectorAll('#gmt-tsearch [data-ts-i] b')].map(x => x.textContent));
  ok(t[0] === 'عرض سعر' && t.some(x => /من عرض سعر/.test(x)), '«انشاء عرض سعر» ⇒ أداة «عرض سعر» أوّلاً + «📥 من عرض سعر» بنقطة البيع: ' + t.slice(0, 4).join(' | '));
  await pg.fill('#gmt-tsearch [data-ts-q]', 'عبي الحقول تلقائيا'); await pg.waitForTimeout(300);
  t = await pg.evaluate(() => document.querySelector('#gmt-tsearch [data-ts-res]').innerText);
  ok(/بهالصفحة/.test(t), 'زرّ موجود بالصفحة الحالية (حتى لو جوّا نافذة) ⇒ «📍 بهالصفحة»');
  ok(!errs.filter(e => !/favicon|404|400|406|status of 503/.test(e)).length, 'لا أخطاء JS بالأوردرات');
  await browser.close();
  ({ browser, pg, errs } = await H.open('home.html', { init: H.ADMIN_INIT, w: 430, h: 900, wait: 5000 }));
  const hb = await pg.evaluate(() => ({ btn: !!document.getElementById('gmt-tsearch-btn'), q: !!document.querySelector('input#q') }));
  ok(hb.q && !hb.btn, 'الرئيسية: حقل «بحث في النظام» برأسها بس — بلا زرّ بحث تاني');
  await pg.evaluate(() => { const q = document.querySelector('input#q'); q.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); }); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => !!document.getElementById('gmt-tsearch')), 'حقل الرئيسية بيفتح نفس البحث الموحّد');
  await browser.close();
  ({ browser, pg, errs } = await H.open('purchase.html?gofind=' + encodeURIComponent('📒 الآجلة'), { init: H.ADMIN_INIT, w: 1366, h: 900, mobile: false, wait: 7000 }));
  await pg.waitForTimeout(2500);
  ok(await pg.evaluate(() => (document.getElementById('btn-po-aging') || {}).getAttribute('data-gofound') === '1'), '?gofind= ⇒ الزرّ «📒 الآجلة» تعلّم بالصفحة التانية');
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
