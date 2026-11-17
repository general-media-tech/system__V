// (ARC-HTML-2#60) أداة الإثراء: سقف 60 منتجاً في التشغيلة ودفعات من 6 منتجات لكل نداء
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const o = await H.open('inventory.html', { w: 1100, h: 800, mobile: false, wait: 4000 });
  const r = await o.pg.evaluate(async () => {
    localStorage.setItem('gmt_brain_endpoint', 'https://example.invalid/brain');
    const calls = []; const f = window.fetch;
    window.fetch = async (u, opt) => { if (String(u).indexOf('example.invalid') >= 0) { calls.push(JSON.parse(opt.body).question.length); return new Response(JSON.stringify({ answer: '{}' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); } return f.apply(this, arguments); };
    const prods = Array.from({ length: 75 }, (_, i) => ({ id: i + 1, name: 'منتج ' + i }));
    await GMTEnrich.propose(prods);
    window.fetch = f;
    GMTEnrich.openPanel(prods);
    const txt = document.getElementById('gmt-enrich-ov').textContent;
    return { calls: calls.length, txt: /60/.test(txt) && /75/.test(txt) };
  });
  ok(r.calls === 10, 'قُطع على 60 منتجاً ⇒ 10 نداءات بدفعات 6 (الفعليّ ' + r.calls + ')');
  ok(r.txt, 'اللوحة تذكر السقف 60 والعدد الأصلي 75');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
