// (TASK-B0397 · seq B653 «الأقسام الجدد لازم الهم صور مصغرة حطها على نمط القدام») شريط الأقسام الفرعية بصورها تحت عنوان القسم الرئيسي
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const IMG = require('fs').readdirSync(require('path').join(__dirname, '..', '..', 'img/p')).filter(f => /^lens_.*\.(jpg|png)$/.test(f)).slice(0, 12).map(f => H.BASE + 'img/p/' + f);
const cats = [{ id: 'P', name: 'إضاءة', order: 0 }, { id: 'P1', name: 'ألواح', parent_id: 'P', order: 1, image: IMG[0] }, { id: 'P2', name: 'رؤوس', parent_id: 'P', order: 2, image: IMG[1] },
  { id: 'P3', name: 'فارغ', parent_id: 'P', order: 3, image: IMG[2] }, { id: 'P4', name: 'بلا صورة', parent_id: 'P', order: 4, icon: 'ph-lightbulb' },
  { id: 'Q', name: 'صوت', order: 5 }, { id: 'Q1', name: 'مايكات', parent_id: 'Q', order: 6, image: IMG[3] }];
const prods = [];
['P1', 'P2', 'P4', 'Q1'].forEach((c, ci) => { for (let k = 0; k < 6; k++) prods.push({ id: c + '_' + k, name: 'منتج ' + c + ' ' + k, price: 10 + k, category_id: c, images: [IMG[(ci * 2 + k) % IMG.length]] }); });
const st = { categories: cats, banners: [], offers: [], branches: [], products: prods };
const VISITOR = `try{ localStorage.clear(); localStorage.setItem('gmt_intro_seen_build','x'); }catch(e){}`;
(async () => {
  await H.seed();
  await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  const o = await H.open('logo.jpg', { init: VISITOR, w: 412, h: 860, mobile: true, wait: 0 });
  await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
  await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(4500);
  const r = await o.pg.evaluate(() => {
    const s = document.querySelector('[data-sub-strip="P"]');
    return { has: !!s, ids: s ? [...s.querySelectorAll('[data-sub-go]')].map(b => b.dataset.subGo) : [], imgs: s ? [...s.querySelectorAll('img')].map(i => i.getAttribute('data-orig') || i.src) : [], icon: s ? !!s.querySelector('[data-sub-go="P4"] i.ph-lightbulb') : false,
      afterHeading: s ? s.previousElementSibling && s.previousElementSibling.tagName === 'H2' && s.previousElementSibling.textContent === 'إضاءة' : false, q: !!document.querySelector('[data-sub-strip="Q"]') };
  });
  ok(r.has && r.afterHeading, '① الشريط تحت عنوان القسم الرئيسي «إضاءة»');
  ok(JSON.stringify(r.ids) === '["P1","P2","P4"]', '② الأقسام الفرعية التي فيها منتجات فقط وبترتيبها (الفارغ لا يظهر) ' + JSON.stringify(r.ids));
  ok(r.imgs.length === 2 && r.icon, '③ الصورة المصغّرة لكلّ فرعي، وأيقونة لمن لا صورة له');
  ok(!r.q, '④ قسم بفرعي واحد ⇒ لا شريط (لا فائدة منه)');
  await o.pg.click('[data-sub-go="P4"]'); await o.pg.waitForTimeout(1200);
  const pos = await o.pg.evaluate(() => { const s = document.querySelector('section[data-category-section="P4"]'); const hh = document.querySelector('header').offsetHeight; return { top: Math.round(s.getBoundingClientRect().top), hh }; });
  ok(pos.top >= pos.hh - 2 && pos.top <= pos.hh + 30, '⑤ الضغط يقفز لقسمه أسفل الترويسة مباشرة ' + JSON.stringify(pos));
  const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 2).join(' / '));
  await o.pg.evaluate(() => window.scrollTo(0, document.querySelector('[data-sub-strip="P"]').getBoundingClientRect().top + pageYOffset - 140)); await o.pg.waitForTimeout(800);
  await o.pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/substrip.jpg', type: 'jpeg', quality: 70 });
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
