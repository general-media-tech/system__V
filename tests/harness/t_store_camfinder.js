// (TASK-A0518 · المالك seq 744–745) «🎯 إكسسوارات كاميرتك»: الشركة ⇐ الكاميرا ⇐ النوع ⇐ المتوافق فقط.
const H = require('./h.js');
let pass = 0, fails = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
const VISITOR = `try{ localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
const C = (id, name, parent) => Object.assign({ id, name, order: 1 }, parent ? { parent_id: parent } : {});
const cats = [C('a', 'كاميرات كانون'), C('a1', 'كاميرات', 'a'), C('a2', 'عدسات كانون', 'a'), C('b', 'إكسسوارات الكاميرا'), C('b1', 'بطاريات وشواحن', 'b'), C('b2', 'ذواكر ووصلات', 'b'), C('b3', 'حقائب', 'b'), C('b4', 'هودات وأغطية وكفرات', 'b'), C('b5', 'لوازم أخرى', 'b'), C('z', 'أخرى')];
const Pr = (id, name, price, cat, x) => Object.assign({ id, name, price, category_id: cat, category_ids: [cat], images: [], stock: 3 }, x || {});
const prods = [Pr('r8', 'Canon EOS R8 body only', 1100, 'a1'), Pr('e17', 'CANON LP-E17 orginal', 40, 'b1'), Pr('e6', 'Canon LP-E6NH بطارية أصلية', 60, 'b1'), Pr('lc17', 'Canon LC-E17 شاحن', 30, 'b1'),
  Pr('rf50', 'Lens rf 50 mm 1.8', 185, 'a2'), Pr('ef50', 'Canon EF 50mm f/1.8 STM', 120, 'a2'), Pr('adp', 'ادابتر Canon ef _r', 45, 'b5'), Pr('cov', 'كفر سيليكون EOS R8', 15, 'b4', { compat: 'Canon EOS R8' }),
  Pr('cov6', 'كفر سيليكون EOS R6', 15, 'b4', { compat: 'Canon EOS R6' }), Pr('sd', 'Memory card SD 64GB', 12, 'b2'), Pr('msd', 'MicroSD 16GB', 8, 'b2'), Pr('bag', 'شنتا كانون اساسي', 25, 'b3'), Pr('mug', 'كوب حراري', 9, 'z')];
const store = { categories: cats, banners: [], offers: [], branches: [], products: prods };
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-16T10:00:00Z', ...store }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 }); const pg = o.pg;
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 404, body: '' }));
  await pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(6000);
  const r = await pg.evaluate(() => {
    const F = GMTCamFinder, cams = F.cameras(), c = cams.find(x => x.key === 'r8'), ids = k => F.match(c, k).map(p => p.id).sort().join(',');
    return { has: !!c, mount: c && c.mount, bat: ids('battery'), chg: ids('charger'), lens: ids('lens'), adp: ids('adapter'), cov: ids('cover'), gen: ids('general'), all: ids('all'),
      r6: !!cams.find(x => x.key === 'r6'), noneEmpty: cams.every(x => F.match(x, 'all').length > 0) };
  });
  ok(r.has && r.mount === 'RF', 'EOS R8 في القائمة بتركيب RF');
  ok(r.bat === 'e17', 'R8 ⇐ بطارية LP-E17 فقط (لا LP-E6): ' + r.bat);
  ok(r.chg === 'lc17', 'R8 ⇐ شاحن LC-E17: ' + r.chg);
  ok(r.lens === 'rf50', 'R8 ⇐ عدسات RF فقط (لا EF): ' + r.lens);
  ok(r.adp === 'adp', 'R8 ⇐ محوّل EF⇐R: ' + r.adp);
  ok(r.cov === 'cov', 'R8 ⇐ كفره هو (لا كفر R6): ' + r.cov);
  ok(r.gen === 'bag,sd', '«يناسب كلّ الكاميرات»: ذاكرة SD وحقيبة (لا MicroSD): ' + r.gen);
  ok(!/mug|cov6|e6/.test(r.all), 'لا شيء غريب في «الكلّ»: ' + r.all);
  ok(r.noneEmpty, 'لا كاميرا في القائمة بنتيجة فارغة');
  /* الواجهة: الرابط المباشر يفتح على الكاميرا والنوع · الاختيار يُحفظ */
  await pg.evaluate(() => { location.hash = '#cam=r8&k=battery'; }); await pg.waitForTimeout(1200);
  const u = await pg.evaluate(() => ({ open: document.getElementById('gcf').classList.contains('on'), on: [...document.querySelectorAll('#gcf .chip.on')].map(b => b.textContent).join('|'), cards: document.querySelectorAll('#gcf [data-gcf-grid] > *').length, saved: localStorage.getItem('gmt_my_cam') }));
  ok(u.open && /EOS R8/.test(u.on) && /بطاريات/.test(u.on) && u.cards === 1, 'store.html#cam=r8&k=battery يفتح على R8 والبطاريات (بطاقة واحدة): ' + JSON.stringify(u));
  await pg.evaluate(() => { document.querySelector('#gcf [data-gcf-change]').click(); }); await pg.waitForTimeout(300);
  const many = await pg.evaluate(() => document.querySelectorAll('#gcf [data-cam]').length);
  ok(many > 1, '«غيّر الكاميرا» يعرض القائمة كاملة: ' + many);
  ok(await pg.evaluate(() => !!document.getElementById('camfinder-btn')), 'زرّ «🎯 إكسسوارات كاميرتك» في شريط البحث');
  const errs = (o.errs || []).filter(x => !/vibrate|favicon|net::ERR|Failed to load resource/i.test(x));
  ok(!errs.length, 'بلا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await o.browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
