// (TASK-B0396 · seq B694 · اقتراحات المتجر ٣) «قارن مع» في صفحة المنتج: من نفس القسم بمواصفات مشتركة · المختلف مُظلَّل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sp = (w, cri, lm) => [{ label: 'القدرة', value: w }, { label: 'CRI', value: cri }, { label: 'التحكّم', value: 'تطبيق' }, { label: 'التركيب', value: lm }];
const prods = [
  { id: 'a', name: 'رأس 60 واط', price: 120, category_id: 'c0', specs: sp('60W', '96+', 'Bowens') },
  { id: 'b', name: 'رأس 100 واط', price: 180, category_id: 'c0', specs: sp('100W', '96+', 'Bowens') },
  { id: 'c', name: 'رأس 300 واط', price: 420, category_id: 'c0', specs: sp('300W', '97+', 'Bowens') },
  { id: 'd', name: 'حامل بلا مواصفات', price: 20, category_id: 'c0' },
  { id: 'e', name: 'عدسة قسم آخر', price: 150, category_id: 'c1', specs: sp('—', '—', 'RF') },
  { id: 'f', name: 'منتج بلا مواصفات كافية', price: 10, category_id: 'c0', specs: [{ label: 'اللون', value: 'أسود' }] },
];
const st = { categories: [{ id: 'c0', name: 'إضاءة', order: 0 }, { id: 'c1', name: 'عدسات', order: 1 }], banners: [], offers: [], branches: [], products: prods };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(4500);
  await o.pg.evaluate(() => openProductModal('a')); await o.pg.waitForTimeout(900);
  const c1 = await o.pg.evaluate(() => { const el = document.getElementById('pm-compare'); return { shown: !el.classList.contains('hidden'), ids: [...el.querySelectorAll('[data-cmp]')].map(b => b.dataset.cmp) }; });
  ok(c1.shown && JSON.stringify(c1.ids) === '["b","c"]', '① «قارن مع» يعرض منتجات القسم ذات المواصفات المشتركة فقط، الأقرب سعراً أوّلاً ' + JSON.stringify(c1));
  await o.pg.click('#pm-compare [data-cmp="b"]'); await o.pg.waitForTimeout(300);
  const t = await o.pg.evaluate(() => { const tb = document.querySelector('[data-cmp-table]'); return tb ? { rows: [...tb.querySelectorAll('tbody tr')].map(r => [...r.children].map(td => td.innerText.trim()).join('|') + (r.dataset.diff ? '*' : '')) } : null; });
  ok(t && t.rows.length === 5 && /^السعر\|\$119\.99\|\$179\.99\*$/.test(t.rows[0]) && t.rows.includes('القدرة|60W|100W*') && t.rows.includes('CRI|96+|96+'), '② الجدول: السعر + المواصفات جنباً إلى جنب والمختلف مُظلَّل ' + JSON.stringify(t));
  await o.pg.click('[data-cmp-open]'); await o.pg.waitForTimeout(900);
  const nm = await o.pg.evaluate(() => [...document.querySelectorAll('#pm-compare [data-cmp]')].map(b => b.dataset.cmp).join(','));
  ok(/a/.test(nm) && !/b/.test(nm), '③ «فتح» ينتقل لصفحة المنتج الآخر (وقائمته تضمّ الأوّل) ' + nm);
  await o.pg.evaluate(() => openProductModal('d')); await o.pg.waitForTimeout(700);
  const none = await o.pg.evaluate(() => document.getElementById('pm-compare').classList.contains('hidden'));
  ok(none, '④ منتج بلا مواصفات ⇒ لا قسم مقارنة');
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.pg.evaluate(() => openProductModal('a')); await o.pg.waitForTimeout(700); await o.pg.click('#pm-compare [data-cmp="c"]'); await o.pg.waitForTimeout(300);
  await o.pg.evaluate(() => document.getElementById('pm-compare').scrollIntoView()); await o.pg.waitForTimeout(300);
  await o.pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/compare.jpg', type: 'jpeg', quality: 70 });
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
