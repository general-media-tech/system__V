// (TASK-A0578 · المالك seq 976) «خلّي يكون الباركود بعيد عن مجال القصّ قليلاً» — الشريط ≥2.5مم من حافّة الملصق (خطّ القصّ) في كلّ المقاسات
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
(async () => {
  const { chromium } = require('playwright'); const browser = await chromium.launch(); const pg = await browser.newPage({ viewport: { width: 1000, height: 1300 } });
  await pg.goto(H.BASE + encodeURI('شو_الجديد.html'), { waitUntil: 'domcontentloaded' }).catch(() => {}); await pg.addScriptTag({ url: H.BASE + 'gmt-labels.js' });
  const html = await pg.evaluate(base => GMTLabels.sheetHtml(GMTLabels.expand([{ name: 'اختبار هامش القصّ', barcode: '6793525807201', qty: 20 }]), { base }), H.BASE);
  await pg.setContent(html, { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => document.querySelector('.bc svg rect'), null, { timeout: 15000 }).catch(() => {});
  const opts = await pg.evaluate(() => [...document.querySelectorAll('#lay option')].map(o => o.value));
  ok(opts.length >= 5, 'المقاسات: ' + opts.join(','));
  for (const v of opts) {
    await pg.selectOption('#lay', v); await pg.waitForTimeout(400);
    const m = await pg.evaluate(() => { const mm = 96 / 25.4, lb = document.querySelector('.lb'), sv = lb && lb.querySelector('.bc svg'); if (!sv) return null;
      const a = lb.getBoundingClientRect(), b = sv.getBoundingClientRect();
      return { l: (b.left - a.left) / mm, r: (a.right - b.right) / mm, t: (b.top - a.top) / mm, bo: (a.bottom - b.bottom) / mm, w: b.width / mm, h: b.height / mm }; });
    ok(m && Math.min(m.l, m.r) >= 2.5 && m.bo >= 0.8 && m.w >= 18 && m.h >= 4, 'مقاس ' + v + ' بالصف: الشريط يبعد ' + (m ? Math.min(m.l, m.r).toFixed(1) : '?') + 'مم جانباً و' + (m ? m.bo.toFixed(1) : '?') + 'مم أسفل عن خطّ القصّ · ' + (m ? m.w.toFixed(1) + '×' + m.h.toFixed(1) : '?') + 'مم');
  }
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
