// (25 ت1 · TASK-0167) المالك seq 80 + جواب seq 86: «ممكن ينطبع PDF وممكن يتشارك فوراً — مشاركة PDF للأوردرات للطباعة الجماعية».
// نافذة «طباعة الأوردرات غير المشحونة» ⇒ زرّ «📤 مشاركة PDF»: ملفّ PDF واحد للمحدَّد · أربعة أوردرات بكل A4 (الأوّل أعلى اليمين) ·
// يُسلَّم لمُنتقي المشاركة (GMTShare.deliver) · إلغاء تحديد أوردر يُخرجه من الملفّ · زرّ الطباعة باقٍ كما هو.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  for (const [w, h] of [[390, 844], [1366, 800]]) {
    await H.seed();
    const rows = [];
    for (let i = 1; i <= 5; i++) rows.push({ name: 'زبون PDF ' + i, phone: '093300090' + i, product: 'كاميرا ' + i, qty: 1, price: 10 * i, status: i === 5 ? 'prepared' : 'pending', branch: 'حلب', address: 'دمشق ' + i, shipping_company: 'المفتي' });
    rows.push({ name: 'مشحون لا يدخل', phone: '0933000910', product: 'عدسة', qty: 1, price: 70, status: 'shipped', branch: 'حلب', address: 'حمص' });
    await H.call('/rest/v1/gmt_orders', rows);
    const { browser, pg, errs } = await H.open('orders.html', { w, h, mobile: w < 500, wait: 4500 });
    await pg.evaluate(async () => {
      await loadOrders();
      window.__got = null; window.__ink = null;
      GMTShare.deliver = async (blob, name, o) => { const t = await blob.text(); window.__got = { name, size: blob.size, type: blob.type, head: t.slice(0, 5), pages: (t.match(/\/Type \/Page /g) || []).length, title: (o && o.text) || '' }; return 'shared'; };
      const P = GMTRender.pdfFromPages;
      GMTRender.pdfFromPages = async (cvs, o) => {
        /* حبرُ كل ربع: [أعلى يمين · أعلى يسار · أسفل يمين · أسفل يسار] */
        window.__ink = cvs.map(cv => { const W = cv.width, Hh = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, Hh).data;
          const q = (x0, y0) => { let n = 0, t = 0; for (let y = y0 + 40; y < y0 + Hh / 2 - 40; y += 6) for (let x = x0 + 40; x < x0 + W / 2 - 40; x += 6) { const i = (y * W + x) * 4; t++; if (d[i] + d[i + 1] + d[i + 2] < 400) n++; } return n / t; };
          return [q(W / 2, 0), q(0, 0), q(W / 2, Hh / 2), q(0, Hh / 2)].map(v => +v.toFixed(3)); });
        return P(cvs, o);
      };
    });
    // ١) النافذة فيها الزرّان · الخمسة غير المشحونة فقط
    await pg.evaluate(() => openBulkPrint()); await pg.waitForTimeout(400);
    const ui = await pg.evaluate(() => ({ n: document.querySelectorAll('.bp-chk').length, pdf: !!document.querySelector('[data-bulk-pdf]'), print: [...document.querySelectorAll('#bulkPrint button')].some(b => /اطبع المحدَّد/.test(b.textContent)) }));
    ok(ui.n === 5 && ui.pdf && ui.print, w + ': النافذة: ٥ أوردرات غير مشحونة · «🖨️ اطبع المحدَّد» و«📤 مشاركة PDF»: ' + JSON.stringify(ui));
    if (w === 390) await pg.screenshot({ path: '/tmp/gmt-out/bulk_pdf_' + w + '.png' });
    // ٢) الخمسة ⇒ PDF من ورقتين (٤ + ١) يُسلَّم للمشاركة
    const t0 = Date.now();
    await pg.click('[data-bulk-pdf]');
    await pg.waitForFunction(() => !!window.__got, null, { timeout: 90000 }).catch(() => {});
    const got = await pg.evaluate(() => ({ got: window.__got, ink: window.__ink, last: window.__lastBulkPdf, modal: !!document.getElementById('bulkPrint') }));
    ok(got.got && got.got.head === '%PDF-' && got.got.type === 'application/pdf' && got.got.pages === 2 && /\.pdf$/.test(got.got.name) && /5 أوردر/.test(got.got.title),
      w + ': ملفّ PDF واحد بورقتين يُسلَّم للمشاركة (' + Math.round((Date.now() - t0) / 1000) + 'ث): ' + JSON.stringify(got.got));
    ok(got.ink && got.ink.length === 2 && got.ink[0].every(v => v > 0.01) && got.ink[1][0] > 0.01 && got.ink[1].slice(1).every(v => v < 0.002),
      w + ': الورقة الأولى أربعة أوردرات والثانية واحد أعلى اليمين: ' + JSON.stringify(got.ink));
    ok(!got.modal, w + ': النافذة تُغلق بعد التجهيز');
    // ٣) إلغاء تحديد اثنين ⇒ ثلاثة في ورقةٍ واحدة
    await pg.evaluate(() => { window.__got = null; openBulkPrint(); const c = [...document.querySelectorAll('.bp-chk')]; c[0].checked = false; c[1].checked = false; });
    await pg.click('[data-bulk-pdf]');
    await pg.waitForFunction(() => !!window.__got, null, { timeout: 90000 }).catch(() => {});
    const g2 = await pg.evaluate(() => ({ got: window.__got, ink: window.__ink }));
    ok(g2.got && g2.got.pages === 1 && /3 أوردر/.test(g2.got.title) && g2.ink[0].slice(0, 3).every(v => v > 0.01) && g2.ink[0][3] < 0.002,
      w + ': إلغاء تحديد اثنين ⇒ ثلاثة بورقةٍ واحدة: ' + JSON.stringify({ p: g2.got && g2.got.pages, ink: g2.ink && g2.ink[0] }));
    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource/.test(e));
    ok(!real.length, w + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
