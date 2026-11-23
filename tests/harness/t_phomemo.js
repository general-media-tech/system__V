// (TASK-A0586 · المالك seq A1023) طابعة الملصقات Phomemo M110 عبر البلوتوث — بلا جهاز: نحاكي الطابعة ونلتقط البايتات
//  ① لكلّ ملصق: السرعة 1B4E0D05 · الكثافة 1B4E04xx · ورق بفواصل 1F110A · GS v 0 (40 بايت × 240 سطر لـ40×30مم) · النهاية 1FF00500 1FF00300
//  ② الدفعات ≤ 128 بايت · ③ «اطبع ٥» ⇒ خمس مهامّ · ④ الباركود في الوسط: لا نقطة سوداء في هامش ٢مم من كلّ جهة · وسطه أفقياً
//  ⑤ من ورقة الملصقات (GMTLabels) زرّ «📶 طابعة الملصقات» بعدد كلّ منتج
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const STUB = () => {
  window.__pm = []; const ch = { properties: { writeWithoutResponse: true }, writeValueWithoutResponse: async (u) => { window.__pm.push(Array.from(u)); } };
  const svc = { getCharacteristic: async (u) => { if (u === 0xff02) return ch; if (u === 0xff03) return { startNotifications: async () => {} }; throw new Error('x'); } };
  const dev = { name: 'M110', addEventListener() {}, gatt: { connected: true, connect: async () => ({ getPrimaryService: async (u) => { if (u === 0xff00) return svc; throw new Error('no'); } }) } };
  Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async (o) => { window.__req = o; return dev; } }, configurable: true });
};
(async () => {
  const { chromium } = require('playwright'); const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(H.BASE + 'robots.txt').catch(() => {}); await pg.setContent('<html><body></body></html>');
  await pg.addScriptTag({ url: H.BASE + 'lib/JsBarcode.all.min.js' }); await pg.addScriptTag({ url: H.BASE + 'gmt-phomemo.js?t=' + Date.now() });
  await pg.evaluate(STUB);
  await pg.evaluate(() => { localStorage.clear(); GMTPhomemo.open([{ name: 'بطارية LP-E17 نورمال كوبي', barcode: '6290000123456', qty: 1 }]); });
  await pg.waitForTimeout(500);
  await pg.fill('#gmt-pm [data-qty]', '5');
  await pg.click('#gmt-pm [data-go]');
  await pg.waitForFunction(() => /طُبع|❌/.test(document.querySelector('#gmt-pm [data-st]').textContent), null, { timeout: 30000 });
  const R = await pg.evaluate(() => ({ st: document.querySelector('#gmt-pm [data-st]').textContent, w: window.__pm, req: window.__req && window.__req.optionalServices }));
  ok(/طُبع 5/.test(R.st), '③ «اطبع ٥» ⇒ ' + R.st);
  const hex = a => a.map(x => x.toString(16).padStart(2, '0')).join('');
  const heads = R.w.filter(a => a[0] === 0x1d && a[1] === 0x76);
  ok(heads.length === 5 && hex(heads[0]) === '1d763000' + '2800' + 'f000', '① رأس الصورة GS v 0 · 40 بايت × 240 سطر (40×30مم): ' + (heads[0] && hex(heads[0])));
  const first = R.w.slice(0, 3).map(hex);
  ok(first[0] === '1b4e0d05' && /^1b4e04/.test(first[1]) && first[2] === '1f110a', '① بداية المهمّة: السرعة · الكثافة · ورق بفواصل: ' + first.join(' '));
  ok(R.w.filter(a => hex(a) === '1ff005001ff00300').length === 5, '① نهاية كلّ ملصق 1F F0 05 00 1F F0 03 00 (×5)');
  const dataBytes = R.w.filter(a => !(a[0] === 0x1d && a[1] === 0x76) && a.length > 8 || (a.length <= 128 && a.length > 8)).reduce((s, a) => s + a.length, 0);
  ok(R.w.every(a => a.length <= 128), '② كلّ دفعة ≤ 128 بايت');
  ok(R.req && R.req.includes(0xff00), 'خدمة الطباعة 0xFF00 مطلوبة عند الاتّصال');
  // ④ الوسط والهوامش
  const M = await pg.evaluate(() => {
    const r = GMTPhomemo.render({ name: 'بطارية LP-E17', barcode: '6290000123456' }, { w: 40, h: 30, dens: 12, name: true, code: true });
    const ras = GMTPhomemo.raster(r.canvas); const W = r.canvas.width, Hh = r.canvas.height; let x0 = W, x1 = -1, y0 = Hh, y1 = -1;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (ras.data[y * ras.bpr + (x >> 3)] & (0x80 >> (x & 7))) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { W, H: Hh, x0, x1, y0, y1 };
  });
  ok(M.x0 >= 16 && M.y0 >= 14 && W(M) - 1 - M.x1 >= 16 && M.H - 1 - M.y1 >= 14, '④ لا نقطة سوداء في هامش ٢مم (لا حدود ولا قصّ): ' + JSON.stringify(M));
  function W(m) { return m.W; }
  ok(Math.abs((M.x0 + M.x1) / 2 - M.W / 2) <= 4, '④ الباركود في الوسط أفقياً (مركز ' + ((M.x0 + M.x1) / 2) + ' من ' + M.W / 2 + ')');
  // ⑤ من ورقة الملصقات
  await pg.addScriptTag({ url: H.BASE + 'gmt-labels.js?t=' + Date.now() });
  const html = await pg.evaluate(b => GMTLabels.sheetHtml(GMTLabels.expand([{ name: 'A', barcode: '111111', qty: 3 }, { name: 'B', barcode: '222222', qty: 2 }]), { base: b }), H.BASE);
  const p2 = await b.newPage(); await p2.goto(H.BASE + 'robots.txt').catch(() => {}); await p2.setContent(html); await p2.waitForTimeout(800);
  await p2.evaluate(STUB); await p2.click('#pm'); await p2.waitForSelector('#gmt-pm', { timeout: 8000 });
  const t5 = await p2.evaluate(() => document.querySelector('#gmt-pm').innerText);
  ok(/5 ملصقاً من 2 منتجاً/.test(t5), '⑤ من ورقة الملصقات: كلّ منتج بعدد نسخه (5 من 2): ' + (t5.match(/\d+ ملصقاً من \d+ منتجاً/) || [''])[0]);
  ok(!errs.length, 'لا أخطاء JS: ' + JSON.stringify(errs.slice(0, 2)));
  await b.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
