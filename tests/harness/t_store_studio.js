// (TASK-A0522 · المالك seq 744) «🎬 جهّز استوديوك»: النوع ⇐ المستوى ⇐ طقم ممّا يحتاجه الاستوديو · بدّل · أضف للسلّة · احفظه قائمة.
const H = require('./h.js');
let pass = 0, fails = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const C = (id, name, parent) => Object.assign({ id, name, order: 1 }, parent ? { parent_id: parent } : {});
const cats = [C('m', 'المايكات والصوت'), C('m1', 'لاسلكية', 'm'), C('m2', 'كروت صوت وستاندات', 'm'), C('l', 'إضاءة الاستوديو'), C('l1', 'ألواح LED — كهرباء', 'l'), C('l2', 'ستاندات', 'l'), C('l3', 'رؤوس الإضاءة — كهرباء', 'l'), C('l4', 'سوفت بوكس ومعدّلات', 'l'), C('z', 'أخرى')];
const IMG = ['x.jpg'];
const Pr = (id, name, price, cat) => ({ id, name, price, category_id: cat, category_ids: [cat], images: IMG, stock: 3 });
const prods = [Pr('mic1', 'مايك لاسلكي A', 30, 'm1'), Pr('mic2', 'مايك لاسلكي B', 60, 'm1'), Pr('mic3', 'زوج مايك C', 120, 'm1'), Pr('ms', 'ستاند مايك NB-35', 25, 'm2'), Pr('card', 'كرت صوت Live Sound Card', 26, 'm2'),
  Pr('pan1', 'لوح LED 1', 40, 'l1'), Pr('pan2', 'لوح LED 2', 80, 'l1'), Pr('st1', 'Stand 205 cm ستاند', 10, 'l2'), Pr('st2', 'ستاند 2.1م', 17, 'l2'), Pr('q07', 'Q07', 9, 'l2'),
  Pr('hd', 'رأس اضاءة 300w', 100, 'l3'), Pr('sb', 'سوفت بوكس 65cm', 18, 'l4'), Pr('br', 'براكيت للسوفت', 30, 'l4'), Pr('mug', 'كوب', 9, 'z')];
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-16T10:00:00Z', categories: cats, banners: [], offers: [], branches: [], products: prods }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 }); const pg = o.pg;
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 404, body: '' }));
  await pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(6000);
  const r = await pg.evaluate(() => { const ids = k => k.items.map(i => i.p.id + (i.qty > 1 ? 'x' + i.qty : '')).join(','); return {
    eco: ids(GMTStudio.build('podcast', 0, {})), pro: ids(GMTStudio.build('podcast', 2, {})), swap: ids(GMTStudio.build('podcast', 0, { mic: 1 })),
    port: ids(GMTStudio.build('portrait', 0, {})), total: GMTStudio.build('podcast', 0, {}).total,
    expect: Math.round(['mic1', 'ms', 'pan1', 'st1'].reduce((t, id) => t + parseFloat(store.products.find(p => p.id === id).price), 0) * 100) / 100 }; });
  ok(r.eco === 'mic1,ms,pan1,st1', 'بودكاست اقتصادي ⇐ الأرخص لكلّ خانة · بلا كرت صوت · الستاند ستاند حقيقي لا Q07: ' + r.eco);
  ok(r.total === r.expect, 'المجموع = أسعار المتجر المعروضة نفسها: ' + r.total + ' = ' + r.expect);
  ok(/^mic3,msx2,card,hdx2,st2x2$/.test(r.pro), 'احترافي ⇐ الأغلى (رأس 300w قبل اللوح) · «زوج مايك» مرّة واحدة · لكلّ ضوء ستاند: ' + r.pro);
  ok(r.swap.indexOf('mic2') === 0, '«بدّل» ينقل المايك للمرشّح التالي: ' + r.swap);
  ok(r.port === 'hd,sb,st1', 'بورتريه ⇐ رأس + سوفت بوكس (لا براكيت) + ستاند: ' + r.port);
  /* الواجهة: الرابط · أضف للسلّة · احفظه قائمة */
  await pg.evaluate(() => { location.hash = '#studio=podcast&t=eco'; }); await pg.waitForTimeout(1200);
  const u = await pg.evaluate(() => ({ open: document.getElementById('gst').classList.contains('on'), on: [...document.querySelectorAll('#gst .ty.on, #gst .chip.on')].map(b => b.textContent.trim()).join('|'), rows: document.querySelectorAll('#gst .row').length }));
  ok(u.open && /بودكاست/.test(u.on) && /اقتصادي/.test(u.on) && u.rows === 4, 'store.html#studio=podcast&t=eco يفتح على النوع والمستوى: ' + JSON.stringify(u));
  await pg.evaluate(() => document.querySelector('#gst [data-act="cart"]').click()); await pg.waitForTimeout(400);
  const cart = await pg.evaluate(() => store.cart.map(c => c.id + ':' + c.qty).sort().join(','));
  ok(cart === 'mic1:1,ms:1,pan1:1,st1:1', '«أضف الكلّ للسلّة»: ' + cart);
  await pg.evaluate(() => document.querySelector('#gst [data-act="list"]').click()); await pg.waitForTimeout(600);
  const lst = await pg.evaluate(() => ({ title: (document.querySelector('[data-gls-title]') || {}).textContent, total: (document.querySelector('[data-gls-total]') || {}).textContent }));
  ok(/استوديو/.test(lst.title || '') && /4 منتج/.test(lst.total || ''), '«📋 احفظه قائمة» يفتح القائمة للحفظ: ' + JSON.stringify(lst));
  ok(await pg.evaluate(() => !!document.getElementById('studio-btn')), 'زرّ «🎬 جهّز استوديوك» تحت البحث');
  const errs = (o.errs || []).filter(x => !/vibrate|favicon|net::ERR|Failed to load resource/i.test(x));
  ok(!errs.length, 'بلا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
