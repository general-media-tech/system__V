// (TASK-B0408 · seq 720) نافذة «الأقسام»: مجموعات بحسب الرئيسي · بطاقات موحّدة بلا تداخل
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const mk = (n, extra) => Object.assign({ id: n, name: n, order: 0 }, extra);
const cats = [mk('إضاءة', { order: 0 }), mk('رؤوس إضاءة كهرباء وبطارية احترافية طويلة الاسم جداً', { parent_id: 'إضاءة', order: 1 }), mk('ألواح', { parent_id: 'إضاءة', order: 2 }), mk('تيوب', { parent_id: 'إضاءة', order: 3 }),
  mk('صوتيات', { order: 1 }), mk('مايكات', { parent_id: 'صوتيات', order: 1 }), mk('حوامل', { order: 2 })];
const st = { categories: cats, banners: [], offers: [], branches: [], products: [{ id: 'p', name: 'منتج', price: 5, category_id: 'ألواح', images: [] }] };
(async () => {
  await H.seed(); await H.call('/rest/v1/gmt_store', [{ id: 1, updated_at: '2026-11-14T10:00:00Z', ...st }]);
  for (const [w, mobile, label] of [[390, true, 'هاتف'], [1366, false, 'كمبيوتر']]) {
    const o = await H.open('logo.jpg', { init: `try{localStorage.clear();localStorage.setItem('gmt_intro_seen_build','x')}catch(e){}`, w, h: 860, mobile, wait: 0 });
    await o.ctx.route(/home\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(st) }));
    await o.pg.goto(H.BASE + 'store.html', { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(5000);
    await o.pg.evaluate(() => openCategoriesModal()); await o.pg.waitForTimeout(700);
    const r = await o.pg.evaluate(() => { const g = [...document.querySelectorAll('.cm-grp')].map(x => ({ id: x.dataset.cmGroup, n: x.querySelectorAll('.cm-card').length }));
      const cards = [...document.querySelectorAll('.cm-card')].map(c => c.getBoundingClientRect()); let overlap = 0; for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) { const a = cards[i], b = cards[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap++; }
      const hs = new Set(cards.map(c => Math.round(c.height))), ws = new Set(cards.map(c => Math.round(c.width)));
      const sheet = document.querySelector('#categories-modal .modal-sheet').getBoundingClientRect(); const out = cards.filter(c => c.left < sheet.left - 1 || c.right > sheet.right + 1).length;
      return { g, overlap, hs: [...hs], ws: [...ws], out }; });
    ok(JSON.stringify(r.g.map(x => x.id)) === JSON.stringify(['إضاءة', 'صوتيات', 'حوامل']) && r.g[0].n === 3 && r.g[1].n === 1 && r.g[2].n === 1, label + ': مجموعات بحسب الرئيسي وتحتها فرعياتها: ' + JSON.stringify(r.g));
    ok(r.overlap === 0 && r.hs.length === 1 && r.ws.length <= 2 && r.out === 0, label + ': بلا تداخل · ارتفاع موحَّد ' + r.hs + ' · خارج الإطار ' + r.out);
    if (!mobile) await o.pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/cats_desktop.png' }); else await o.pg.screenshot({ path: '/tmp/claude-0/-home-user/c15c36cd-5ab9-561f-b25b-b44644a4d063/scratchpad/cats_mobile.png' });
    await o.pg.click('[data-cm-cat="ألواح"]'); await o.pg.waitForTimeout(700);
    ok(await o.pg.evaluate(() => !document.getElementById('categories-modal').classList.contains('active')), label + ': الضغط على بطاقة يغلق النافذة');
    const real = o.errs.filter(e => !/status of (400|401|404|406)|Failed to load resource|favicon|AudioContext/.test(e));
    ok(!real.length, label + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await o.browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
