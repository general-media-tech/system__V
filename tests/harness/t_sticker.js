// (TASK-0195 · المالك seq 133) ملصق الكفالة: PDF بمقاس الملصق نفسه (لا ملصقٌ صغير وسط A4) · مشاركة PDF · طباعة · QR محلّي يُقرأ
// + اقتراح العميل من القائمة (سجلّ الزبائن · الأوردرات · الكفالات السابقة) وتعبئة الاسم والهاتف
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const LINK = 'https://general-media-tech.github.io/system__V/guarantee.html?w=AB12CD';
(async () => {
  for (const W of [390, 1366]) {
    await H.seed();
    await H.call('/rest/v1/gmt_customers', [{ name: 'سيرينا اسماعيل', phone: '0944123456', is_blocked: false }, { name: 'سيرينا محظورة', phone: '0944000999', is_blocked: true }]);
    await H.call('/rest/v1/gmt_orders', [{ name: 'سيرينا اسماعيل', phone: '0944123456', product: 'كاميرا', qty: 1, price: 10, status: 'pending', branch: 'حلب' }, { name: 'سيرين خالد', phone: '0933777111', product: 'عدسة', qty: 1, price: 10, status: 'pending', branch: 'حلب' }]);
    const { browser, ctx, pg, errs } = await H.open('guarantee.html', { w: W, h: W < 500 ? 844 : 900, mobile: W < 500, wait: 3500, init: H.ADMIN_INIT });
    let pops = 0; ctx.on('page', () => pops++);
    // ١) الزرّ ⇒ نافذة الملصق في الصفحة (لا نافذة منبثقة) بمعاينة وأزرارها
    await pg.evaluate(l => { const b = document.getElementById('printStickerBtn'); b.dataset.link = l; b.dataset.name = 'سيرينا اسماعيل'; b.click(); }, LINK);
    await pg.waitForSelector('#gmt-sticker [data-prev] img', { timeout: 20000 }).catch(() => {});
    const m = await pg.evaluate(() => { const r = document.getElementById('gmt-sticker'); return r && { img: !!r.querySelector('[data-prev] img'), share: !!r.querySelector('[data-share]'), print: !!r.querySelector('[data-print]'), dl: !!r.querySelector('[data-dl]'), sizes: [...r.querySelectorAll('[data-size] option')].map(o => o.value), note: r.querySelector('[data-note]').textContent }; });
    ok(m && m.img && m.share && m.print && m.dl && pops === 0, W + ': نافذة الملصق في الصفحة: معاينة · «مشاركة PDF» · «طباعة» · «تنزيل» — بلا نافذة منبثقة: ' + JSON.stringify(m && { sizes: m.sizes, pops }));
    // ٢) كل مقاس ⇒ PDF صفحةٌ واحدة بمقاسه تماماً (mm ⇒ pt)
    for (const k of ['100x50', '80x50', '100x70', 'A6', 'A5']) {
      const r = await pg.evaluate(async ([k, l]) => { const b = await GMTSticker.pdf({ link: l, name: 'سيرينا اسماعيل', size: k }); const t = await b.text(); const mb = (t.match(/\/MediaBox \[([^\]]+)\]/g) || []); return { n: mb.length, mb: mb[0] || '', type: b.type, size: b.size }; }, [k, LINK]);
      const S = { '100x50': [100, 50], '80x50': [80, 50], '100x70': [100, 70], A6: [148, 105], A5: [210, 148] }[k], pt = v => v * 72 / 25.4;
      const nums = (r.mb.match(/[\d.]+/g) || []).map(Number), wpt = nums[2] - nums[0], hpt = nums[3] - nums[1];
      ok(r.n === 1 && Math.abs(wpt - pt(S[0])) < 1 && Math.abs(hpt - pt(S[1])) < 1 && r.type === 'application/pdf', W + ': ' + k + ' ⇒ PDF صفحةٌ واحدة ' + wpt.toFixed(1) + '×' + hpt.toFixed(1) + 'pt (= ' + S[0] + '×' + S[1] + ' مم) · ' + Math.round(r.size / 1024) + 'KB');
    }
    // ٣) الـQR في الملصق يُقرأ ويعطي رابط الكفالة (مبنيٌّ على الجهاز)
    const q = await pg.evaluate(async l => {
      const cv = await GMTSticker._canvas({ link: l, name: 'سيرينا اسماعيل', size: '100x50' });
      try { const src = new ZXing.HTMLCanvasElementLuminanceSource(cv), bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(src)); return new ZXing.QRCodeReader().decode(bmp).getText(); } catch (e) { return 'ERR ' + e; }
    }, LINK);
    ok(q === LINK, W + ': QR الملصق يُقرأ ⇒ رابط الكفالة: ' + q);
    const qd = await pg.evaluate(l => GMTSticker.qr(l), LINK);
    ok(/^data:image\/png/.test(qd || ''), W + ': GMTSticker.qr ⇒ صورة محلّية (data:) لا خدمة خارجية');
    // ٤) «مشاركة PDF» ⇒ ملفّ PDF باسم العميل إلى لوحة المشاركة (الافتراضي A5 كما كان · نختار ١٠٠×٥٠)
    ok(m.sizes && (await pg.$eval('#gmt-sticker [data-size]', e => e.value)) === 'A5', W + ': الافتراضي ورقة A5 (البند ١١٨)');
    await pg.selectOption('#gmt-sticker [data-size]', '100x50'); await pg.waitForTimeout(600);
    await pg.evaluate(() => { window.__dl = []; GMTShare.deliver = async (b, n) => { __dl.push({ n, t: b.type, s: b.size }); return 'shared'; }; });
    await pg.click('#gmt-sticker [data-share]'); await pg.waitForFunction(() => __dl.length > 0, null, { timeout: 15000 }).catch(() => {});
    const sh = await pg.evaluate(() => __dl[0] || null);
    ok(sh && sh.t === 'application/pdf' && /ملصق-كفالة-سيرينا اسماعيل-100x50\.pdf/.test(sh.n), W + ': «مشاركة PDF» ⇒ ' + JSON.stringify(sh));
    // ٥) تغيير المقاس يُحفظ ويُعاد رسم المعاينة · «طباعة» على الكمبيوتر ⇒ ورقةٌ بمقاس الملصق (@page) لا A4
    await pg.selectOption('#gmt-sticker [data-size]', 'A6'); await pg.waitForTimeout(800);
    const keep = await pg.evaluate(() => localStorage.getItem('gmt_warranty_sticker_size'));
    ok(keep === 'A6', W + ': المقاس يُحفظ على الجهاز: ' + keep);
    if (W > 500) {
      await pg.evaluate(() => { window.__pr = null; const f0 = HTMLIFrameElement.prototype; const od = Object.getOwnPropertyDescriptor(f0, 'contentWindow');
        Object.defineProperty(f0, 'contentWindow', { configurable: true, get() { const w = od.get.call(this); if (w && !w.__st) { w.__st = 1; const f = this; w.print = () => { __pr = f.contentDocument.querySelector('style').textContent; }; } return w; } }); });
      await pg.click('#gmt-sticker [data-print]'); await pg.waitForFunction(() => __pr, null, { timeout: 15000 }).catch(() => {});
      const pr = await pg.evaluate(() => __pr);
      ok(/@page\{size:148mm 105mm;margin:0\}/.test(pr || ''), W + ': «طباعة» ⇒ ورقةٌ بمقاس الملصق: ' + (pr || '').slice(0, 60));
    }
    await pg.keyboard.press('Escape');
    ok(!(await pg.$('#gmt-sticker')), W + ': Esc يغلق النافذة');
    // ٦) اقتراح العميل: حرفان ⇒ القائمة (بلا المحظور · بلا تكرار) ⇒ النقر يعبّئ الاسم والهاتف
    await pg.evaluate(() => { const f = document.getElementById('customerName'); f.scrollIntoView(); f.value = ''; document.getElementById('phoneNo').value = ''; });
    await pg.click('#customerName'); await pg.type('#customerName', 'سير', { delay: 30 });
    await pg.waitForSelector('#cust-sug:not([hidden]) [data-i]', { timeout: 8000 }).catch(() => {});
    const sug = await pg.evaluate(() => [...document.querySelectorAll('#cust-sug [data-i]')].map(b => b.innerText.replace(/\s+/g, ' ').trim()));
    ok(sug.length === 2 && sug.some(t => /سيرينا اسماعيل/.test(t) && /0944123456/.test(t)) && sug.some(t => /سيرين خالد/.test(t)) && !sug.some(t => /محظورة/.test(t)), W + ': الاقتراحات (بلا تكرار · بلا المحظور): ' + JSON.stringify(sug));
    await pg.evaluate(() => { const b = [...document.querySelectorAll('#cust-sug [data-i]')].find(x => /سيرين خالد/.test(x.innerText)); b && b.click(); });
    const filled = await pg.evaluate(() => ({ n: document.getElementById('customerName').value, p: document.getElementById('phoneNo').value, open: !document.getElementById('cust-sug').hidden }));
    ok(filled.n === 'سيرين خالد' && filled.p === '0933777111' && !filled.open, W + ': النقر ⇒ الاسم والهاتف يُعبّآن: ' + JSON.stringify(filled));
    const real = errs.filter(e => !/status of (400|404|406)|Failed to load resource/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
