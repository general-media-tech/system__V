// (طابور سونيت · الطباعة والفواتير) VER-3#REQ-0262 · VER-5#REQ-0562 — رأس الفاتورة:
//  ١) اسم «مجموعة ميديا تيك التجارية» سطرٌ واحد لا ينكسر (في الفاتورة وعرض السعر)
//  ٢) رقم الإدارة/خدمة العملاء لا يُخربَط: «+» قبل الأرقام (اتجاه LTR معزول داخل نصٍّ عربيّ) — لا نخترع رقماً: يُقرأ من القالب
//  ٣) تبقى الفاتورة صفحة A4 واحدة
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const pages = buf => (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
(async () => {
  await H.seed();
  const o = await H.open('store.html', { w: 412, h: 860, mobile: true, wait: 2500 });
  const docs = await o.pg.evaluate(() => {
    const ord = { ref: 'ORD-9', name: 'زبون', phone: '+963 933000111', address: 'دمشق', notes: '', payment: 'cod', delivery: 1, subtotal: 20, total: 21, items: [{ name: 'منتج', qty: 2, price: 10 }] };
    return { store: GMTInvoiceTpl.storeHTML(ord), quote: GMTInvoiceTpl.quoteHTML({ ref: 'Q-1', name: 'ز', phone: '0933', items: [{ name: 'م', qty: 1, price: 5 }] }) };
  });
  for (const [k, html] of Object.entries(docs)) {
    const pg = await o.ctx.newPage(); await pg.setContent(html, { waitUntil: 'load' }); await pg.waitForTimeout(500);
    const r = await pg.evaluate(() => {
      const n = document.querySelector('.co .n'); const rg = document.createRange(); rg.selectNodeContents(n);
      const lines = new Set([...rg.getClientRects()].map(x => Math.round(x.top))).size;
      const box = n.closest('.hbox').getBoundingClientRect();
      const nr = rg.getBoundingClientRect();
      const b = document.querySelector('.ct b');
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let tn = null, x;
      while ((x = w.nextNode())) if (/\+963/.test(x.textContent)) { tn = x; break; }
      let plusLeft = null, digitLeft = null;
      if (tn) { const i = tn.textContent.indexOf('+963'); const rr = document.createRange();
        rr.setStart(tn, i); rr.setEnd(tn, i + 1); plusLeft = rr.getBoundingClientRect().left;
        rr.setStart(tn, i + 1); rr.setEnd(tn, i + 2); digitLeft = rr.getBoundingClientRect().left; }
      return { lines, fits: nr.left >= box.left - 1 && nr.right <= box.right + 1, plusLeft, digitLeft, found: !!tn };
    });
    ok(r.lines === 1 && r.fits, `${k}: اسم الشركة سطرٌ واحد داخل الصندوق ` + JSON.stringify([r.lines, r.fits]));
    ok(r.found && r.plusLeft < r.digitLeft, `${k}: رقم الإدارة غير مخربط («+» يسبق الأرقام) ` + JSON.stringify([r.plusLeft, r.digitLeft]));
    const buf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    ok(pages(buf) === 1, `${k}: صفحة A4 واحدة (${pages(buf)})`);
    await pg.close();
  }
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
