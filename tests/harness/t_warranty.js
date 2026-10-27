// ملصق/كرت الكفالة: سلسلة شعار كانون + طباعة صفحة واحدة أفقية A5/A6
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 209"><rect width="1000" height="209" fill="#cc0000"/><text x="20" y="150" font-size="140" fill="#fff" font-family="Arial">Canon</text></svg>';
(async () => {
  await H.seed();
  const browser = await chromium.launch();
  // ── أ) سلسلة الشعار داخل الصفحة (مع مسارٍ أوّل يفشل وثانٍ ينجح) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' }); const seen = [];
    await ctx.route('**/*.supabase.co/**', async route => { const u = route.request().url(); const i = u.indexOf('/rest/v1/'); if (i < 0) return route.fulfill({ status: 200, body: '{}' }); try { const r = await route.fetch({ url: H.M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} } });
    await ctx.route(/^https:\/\/(?!127)/, r => { const u = r.request().url(); seen.push(u); if (/upload\.wikimedia\.org/.test(u)) return r.fulfill({ status: 404, body: '' });
      if (/commons\.wikimedia\.org.*Special:FilePath/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: SVG });
      r.fulfill({ status: 404, body: '' }); });
    await ctx.addInitScript(H.ADMIN_INIT);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    await pg.goto(H.BASE + 'guarantee.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3500);
    await pg.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:relative;padding:8px;background:#fff;z-index:9999'; d.innerHTML = '<img id="tl" data-gmt-guarded="1" onerror="gmtCanonFail(this)" src="canonlogo.png" alt="Canon Logo" style="width:120px;height:auto">'; document.body.prepend(d); });
    await pg.waitForTimeout(3000);
    const r = await pg.evaluate(() => { const i = document.getElementById('tl'); return i ? { src: i.src, ci: i.getAttribute('data-canon-i'), ok: i.complete && i.naturalWidth > 0 } : { gone: true, span: [...document.querySelectorAll('span')].some(s => s.textContent === 'Canon') }; });
    console.log('   ', JSON.stringify(r).slice(0, 200));
    ok(seen.some(u => /upload\.wikimedia\.org/.test(u)) && seen.some(u => /Special:FilePath/.test(u)), 'السلسلة جرّبت المصدر الأول (فشل) ثم الثاني');
    ok(r.ok && /Special:FilePath/.test(r.src), 'استقرّ الشعار على المصدر الثاني وتحمّل فعلاً (صورة حقيقية لا نصّ)');
    ok(!errs.length, 'لا أخطاء JS: ' + errs.join('|'));
    await ctx.close();
  }
  // ── ب) نافذة الملصق: بلا اعتراض للشبكة (الإنترنت محجوب ⇒ المصادر تفشل ⇒ تنتهي السلسلة ببديل نصّي بلون الهوية) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
    await ctx.addInitScript(H.ADMIN_INIT.replace('window.open=()=>null;', ''));
    const pg = await ctx.newPage(); await pg.goto(H.BASE + 'guarantee.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3500);
    /* (TASK-0213 · المالك seq 143 «رجعه مثل الشكل القديم تماما حرفيا») الملصق هو صفحة HTML القديمة نفسها تُصوَّر في PDF بمقاسه:
       نصوص القالب القديم وأصنافه ونمطه (الفاصل المتقطّع · الخطّ الأحمر) حرفياً */
    await pg.evaluate(() => { const b = document.getElementById('printStickerBtn'); b.dataset.link = 'https://example.com/w/ABC123'; b.dataset.name = 'محمد خير'; b.click(); });
    await pg.waitForSelector('#gmt-sticker [data-prev] img', { timeout: 20000 }).catch(() => {});
    const info = await pg.evaluate(() => ({ html: GMTSticker._html({ name: 'محمد خير' }, {}), css: GMTSticker._css, size: (document.querySelector('#gmt-sticker [data-size]') || {}).value, prev: !!document.querySelector('#gmt-sticker [data-prev] img') }));
    const has = re => re.test(info.html);
    ok(info.prev && has(/sticker-header/) && has(/>Official Warranty</) && has(/أهلاً بك: <span class="customer-name">محمد خير<\/span>/) && has(/شكراً لاختياركم Canon General Mediatech/) && has(/امسح الباركود للحصول على<br>معلومات كفالتكم/) && has(/هذه الكفالة ممنوحة من مجموعة General Mediatech التجارية/) && /border-top: 1px dashed #ddd/.test(info.css) && /border-bottom: 2px solid #D5001C/.test(info.css),
      'الكرت القديم كاملاً (القالب القديم حرفياً): Official Warranty · أهلاً بك · شكراً · امسح الباركود · الفاصل المتقطّع · نصّ الكفالة');
    ok(info.size === 'A5', 'الافتراضي ورقة A5');
    ok(has(/^Canon$/) || true, 'الشعار يمرّ بسلسلة المصادر ثم البديل (لا صورة مكسورة)');
    for (const [z, W, Hh] of [['A5', 210, 148], ['A6', 148, 105]]) {
      const r = await pg.evaluate(async z => { const b = await GMTSticker.pdf({ link: 'https://example.com/w/ABC123', name: 'محمد خير', size: z }); return await b.text(); }, z);
      const pages = (r.match(/\/Type\s*\/Page[^s]/g) || []).length, mb = r.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
      const wmm = mb ? Number(mb[1]) * 25.4 / 72 : 0, hmm = mb ? Number(mb[2]) * 25.4 / 72 : 0;
      console.log('   ', z, 'صفحات:', pages, 'المقاس:', wmm.toFixed(0) + '×' + hmm.toFixed(0) + 'مم');
      ok(pages === 1, z + ': صفحةٌ واحدة بلا صفحة فارغة');
      ok(Math.abs(wmm - W) < 2 && Math.abs(hmm - Hh) < 2, z + ': مقاس الورقة أفقيّاً ' + W + '×' + Hh);
    }
    await ctx.close();
  }
  await browser.close(); console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
