// (TASK-0231 · المالك seq 160) «النظام بلش يعلق … خاصه نظام الاوردرات … كثير تعليق ودروبات»
// البطاقات تُرسم دفعاتٍ عند التمرير (لا كلّها دفعةً واحدة) · البحث بعد توقّف الكتابة — ولا يضيع أوردر
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await H.seed();
  const rows = []; for (let i = 0; i < 150; i++) rows.push({ name: 'زبون ' + i, phone: '0933' + String(100000 + i), product: 'كاميرا ' + i, qty: 1, price: 100 + i, status: 'shipped', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي', tracking_number: String(300000 + i), shipped_at: new Date(Date.now() - i * 3600e3).toISOString(), created_at: new Date(Date.now() - i * 3600e3).toISOString() });
  await H.call('/rest/v1/gmt_orders', rows);
  const init = H.ADMIN_INIT + `;window.__lt=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push(Math.round(e.duration))}).observe({type:'longtask',buffered:true})}catch(e){}`;
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, wait: 6000, init });
  await pg.evaluate(() => switchTab('shipped')); await sleep(500);
  const n0 = await pg.evaluate(() => document.querySelectorAll('#list-shipped [id^="card-"]').length);
  const more0 = await pg.evaluate(() => (document.querySelector('#list-shipped [data-cards-more]') || {}).textContent || '');
  ok(n0 === 40 && /110 أوردر آخر/.test(more0), 'تبويب «في الطريق»: أوّل ٤٠ بطاقة فوراً · «… 110 أوردر آخر»: ' + n0 + ' · ' + more0);
  // التمرير حتى النهاية ⇒ كل الأوردرات
  for (let i = 0; i < 30; i++) { await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await sleep(250); if (!(await pg.$('#list-shipped [data-cards-more]'))) break; }
  const n1 = await pg.evaluate(() => document.querySelectorAll('#list-shipped [id^="card-"]').length);
  ok(n1 === 150 && !(await pg.$('#list-shipped [data-cards-more]')), 'بالتمرير تُضاف البقية وحدها حتى آخر أوردر: ' + n1);
  const ids = await pg.evaluate(() => [...document.querySelectorAll('#list-shipped [id^="card-"]')].map(c => c.id));
  ok(new Set(ids).size === ids.length, 'بلا تكرار بطاقة');
  // البحث عن أوردرٍ في آخر القائمة (لم يكن مرسوماً) ⇒ يظهر · والكتابة لا تجمّد الصفحة
  await pg.evaluate(() => { window.scrollTo(0, 0); window.__lt = []; });
  await pg.click('#searchInput'); await pg.keyboard.type('زبون 149', { delay: 60 }); await sleep(700);
  const s = await pg.evaluate(() => ({ cards: [...document.querySelectorAll('#list-shipped [id^="card-"]')].map(c => c.innerText.split('\n')[0]).filter(Boolean), lt: window.__lt.slice() }));
  ok(s.cards.length === 1 && /زبون 149/.test(s.cards[0]), 'البحث يجد أوردراً من آخر القائمة: ' + JSON.stringify(s.cards));
  ok(!s.lt.some(d => d > 250), 'الكتابة في البحث لا تجمّد الصفحة (لا مهمّة > ٢٥٠ms): ' + JSON.stringify(s.lt));
  await pg.fill('#searchInput', ''); await pg.evaluate(() => renderSoon()); await sleep(500);
  await pg.evaluate(() => switchTab('all')); await sleep(400);
  const all = await pg.evaluate(() => document.querySelectorAll('[id^="card-"]').length);
  ok(all <= 12 * 5 && all > 0, '«الكل»: دفعةٌ صغيرة لكل قسم (≤ ١٢): ' + all);
  const real = errs.filter(e => !/status of (400|401|404|406)|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
