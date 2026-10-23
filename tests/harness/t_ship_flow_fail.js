// (23 ت1 · TASK-0128) المالك: «افترض كل السيناريوهات وكل حالات الفشل… وجرّبها» — نافذة الشحن أثناء قراءة الإيصال:
// إلغاء الماسح والقراءة جارية · صورةٌ ثانية قبل انتهاء قراءة الأولى · تغيير الشركة أثناء القراءة · إغلاق النافذة وفتحها لأوردرٍ آخر ·
// ملفٌّ تالف أو ليس صورة · صورةٌ ضخمة · مكتبة التعرّف أو الباركود غير متاحة (بلا إنترنت) · تدوير الصورة في الماسح · «اعتماد» والقراءة لم تنتهِ.
const H = require('./h.js'), fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const src = fs.readFileSync(__dirname + '/t_mufti_read.js', 'utf8');
const SYNTH = src.slice(src.indexOf('const SYNTH = `') + 15, src.indexOf('};`;') + 2);
const D = '/tmp/gmt-out/', F = { a: D + 'flow-a.jpg', b: D + 'flow-b.jpg', bad: D + 'flow-bad.jpg', pdf: D + 'flow.pdf', big: D + 'flow-big.jpg' };
const sleep = ms => new Promise(z => setTimeout(z, ms));
const btn = (pg, re) => pg.evaluate(re => { const b = [...document.querySelectorAll('#gds .gds-bar button')].find(x => new RegExp(re).test(x.textContent)); if (b) b.click(); return !!b; }, re);
const state = pg => pg.evaluate(() => ({ track: document.getElementById('ship-tracking').value, from: document.getElementById('ship-from').value, fsrc: document.getElementById('ship-from').getAttribute('data-src'),
  status: document.getElementById('ship-track-auto').innerText.replace(/\s+/g, ' '), hidden: document.getElementById('ship-track-auto').classList.contains('hidden'), reading: _shipReading, read: !!_shipRead, scan: !!document.getElementById('gds') }));
async function idle(pg, ms) { await pg.waitForFunction(() => !_shipReading && !document.getElementById('gds'), null, { timeout: ms || 60000 }).catch(() => {}); }
(async () => {
  await H.seed();
  const [o1, o2] = await H.call('/rest/v1/gmt_orders', [
    { name: 'زبون فشل ١', phone: '0933000421', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' },
    { name: 'زبون فشل ٢', phone: '0933000422', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' }]);
  const { browser, pg, errs, ctx } = await H.open('orders.html', { w: 390, h: 844, wait: 4500, init: H.ADMIN_INIT + SYNTH });
  await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });
  for (const [f, spec, big] of [[F.a, { qr: '0451500', src: 'حلب-الفرقان' }], [F.b, { qr: '0451600', src: 'حلب-السريان' }], [F.big, { qr: '0451700', src: 'حلب-الفرقان' }, 1]]) {
    const b64 = await pg.evaluate(([spec, big]) => { const r = __rcpt(spec), c = document.createElement('canvas'); c.width = big ? 8000 : 1900; c.height = big ? 6000 : 1200; const x = c.getContext('2d');
      x.fillStyle = '#2b2f36'; x.fillRect(0, 0, c.width, c.height); x.translate(c.width / 2, c.height / 2); x.rotate(0.05); const k = big ? 4.2 : 1; x.scale(k, k); x.drawImage(r, -750, -380); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; }, [spec, big]);
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  }
  fs.writeFileSync(F.bad, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4000, 7)]));     // رأس JPEG ثمّ بيانات تالفة
  fs.writeFileSync(F.pdf, '%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF');
  await pg.evaluate(() => { const R = GMTReceipt.readMufti; window.__reads = []; GMTReceipt.readMufti = function (f, o) { const e = { at: performance.now(), early: !!(o && (o.geom || 'corners' in o)), lite: !!(o && o.lite), cancel: o && o.cancel }; __reads.push(e); return R.apply(this, arguments).then(x => { e.done = performance.now(); return x; }); }; });
  const open = async id => { await pg.evaluate(id => openShipModal(id), id); await pg.waitForTimeout(300); await pg.evaluate(() => { __reads.length = 0; }); };

  // ١) إلغاء الماسح والقراءة المبكرة جارية ⇒ تُكمَل على الصورة كما هي ولا تُعاد القراءة كاملة
  await open(o1.id);
  await pg.setInputFiles('#ship-img-input', F.a); await pg.waitForSelector('#gds', { timeout: 8000 }); await sleep(400);
  await btn(pg, 'إلغاء'); await idle(pg);
  let s = await state(pg), rd = await pg.evaluate(() => __reads.map(r => ({ early: r.early, lite: r.lite })));
  ok(s.track === '0451500' && s.from === 'حلب|الفرقان' && s.fsrc === 'receipt', '١) أُلغي الماسح أثناء القراءة ⇒ الرقم والفرع من الصورة كما هي: ' + s.track + ' · ' + s.from);
  ok(rd.length >= 1 && rd[0].early && rd.slice(1).every(r => r.lite), '١) لا قراءة كاملة ثانية للصورة نفسها: ' + JSON.stringify(rd));

  // ٢) صورةٌ ثانية قبل انتهاء قراءة الأولى ⇒ نتيجة الثانية وحدها، والأولى تتوقّف
  await open(o1.id);
  await pg.setInputFiles('#ship-img-input', F.a); await pg.waitForSelector('#gds', { timeout: 8000 }); await sleep(300);
  await btn(pg, 'إلغاء'); await sleep(150);
  await pg.evaluate(() => { document.getElementById('ship-img-input').value = ''; });
  await pg.setInputFiles('#ship-img-input', F.b); await pg.waitForSelector('#gds', { timeout: 8000 });
  const firstStopped = await pg.evaluate(() => __reads.filter(r => r.cancel).map(r => !!r.cancel()));
  await sleep(300); await btn(pg, 'قصّ وتحسين'); await pg.waitForFunction(() => [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)), null, { timeout: 15000 }).catch(() => {});
  await btn(pg, 'اعتماد'); await idle(pg);
  s = await state(pg);
  ok(s.track === '0451600' && s.from === 'حلب|السريان', '٢) صورةٌ ثانية أثناء قراءة الأولى ⇒ نتيجة الثانية: ' + s.track + ' · ' + s.from);
  ok(firstStopped.length >= 1 && firstStopped[0] === true, '٢) قراءة الصورة الأولى أُوقفت عند اختيار الثانية: ' + JSON.stringify(firstStopped));

  // ٣) تغيير الشركة أثناء القراءة ⇒ لا يُملأ شيءٌ لشركةٍ أخرى · والعودة للمفتي تقرأ من جديد
  await open(o1.id);
  await pg.setInputFiles('#ship-img-input', F.a); await pg.waitForSelector('#gds', { timeout: 8000 }); await sleep(250);
  await btn(pg, 'إلغاء'); await sleep(100);
  await pg.evaluate(() => { const sel = document.getElementById('ship-company'); sel.value = [...sel.options].map(o => o.value).find(v => v && v !== 'المفتي'); sel.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(9000);
  s = await state(pg);
  ok(!s.track && (s.hidden || !s.status), '٣) غيّرتَ الشركة أثناء القراءة ⇒ لا رقم ولا رسالة قراءة: «' + s.track + '» «' + s.status.slice(0, 60) + '»');
  await pg.evaluate(() => { const sel = document.getElementById('ship-company'); sel.value = 'المفتي'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
  await idle(pg); s = await state(pg);
  ok(s.track === '0451500' && s.from === 'حلب|الفرقان', '٣) العودة إلى «المفتي» ⇒ يُقرأ الإيصال: ' + s.track + ' · ' + s.from);

  // ٤) إغلاق النافذة والقراءة جارية ثمّ فتحها لأوردرٍ آخر ⇒ لا يتسرّب شيء
  await open(o1.id);
  await pg.setInputFiles('#ship-img-input', F.a); await pg.waitForSelector('#gds', { timeout: 8000 }); await sleep(250);
  await btn(pg, 'إلغاء'); await sleep(100);
  await pg.evaluate(() => [...document.querySelectorAll('#shipModal button')].find(b => b.textContent.trim() === 'إلغاء').click());
  await open(o2.id); await sleep(9000);
  s = await state(pg);
  ok(!s.track && s.fsrc !== 'receipt' && (s.hidden || !s.status), '٤) أُغلقت النافذة أثناء القراءة وفُتحت لأوردرٍ آخر ⇒ لا رقم ولا فرع منها: «' + s.track + '» ' + s.fsrc);

  // ٥) ملفٌّ تالف · ملفٌّ ليس صورة ⇒ رسالةٌ واضحة ولا يُعلَّق شيء ولا يُحفظ الملف إيصالاً
  for (const [f, name] of [[F.bad, 'تالف'], [F.pdf, 'PDF']]) {
    await open(o1.id); const t0 = Date.now();
    await pg.setInputFiles('#ship-img-input', f); await sleep(2500); await idle(pg, 20000);
    s = await state(pg); const kept = await pg.evaluate(() => !!(_shipRcptFile || (_shipScan && _shipScan.scanned) || (document.getElementById('ship-img-input').files || [])[0]));
    const toast = await pg.evaluate(() => [...document.querySelectorAll('#toast, .toast, [id^=toast]')].map(x => x.innerText).join(' ').replace(/\s+/g, ' '));
    ok(!s.scan && !s.reading && !kept, `٥) ملفٌّ ${name} ⇒ لا ماسح معلّق ولا قراءة ولا يُحفظ إيصالاً (${Date.now() - t0}ms): ${(toast || s.status).slice(0, 80)}`);
  }

  // ٦) صورةٌ ضخمة (٨٠٠٠×٦٠٠٠) ⇒ الماسح يظهر بسرعة والقراءة تنجح
  await open(o1.id); let t0 = Date.now();
  await pg.setInputFiles('#ship-img-input', F.big); await pg.waitForSelector('#gds canvas', { timeout: 20000 }).catch(() => {});
  const shownMs = Date.now() - t0; await sleep(500); await btn(pg, 'إلغاء'); await idle(pg, 90000);
  s = await state(pg);
  ok(shownMs < 6000 && s.track === '0451700' && s.from === 'حلب|الفرقان', `٦) صورةٌ ضخمة ⇒ الماسح ظهر بعد ${shownMs}ms والقراءة: ${s.track} · ${s.from} (${Date.now() - t0}ms)`);

  // ١٠) تدوير الصورة في الماسح بعد بدء القراءة ثمّ «اعتماد» ⇒ قراءةٌ كاملة للنسخة المدوَّرة (لا المخفّفة) والنتيجة صحيحة
  await open(o1.id);
  await pg.setInputFiles('#ship-img-input', F.b); await pg.waitForSelector('#gds', { timeout: 8000 }); await sleep(400);
  await btn(pg, 'تدوير'); await sleep(300); await btn(pg, 'قصّ وتحسين');
  await pg.waitForFunction(() => [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)), null, { timeout: 15000 }).catch(() => {});
  await btn(pg, 'اعتماد'); await idle(pg, 90000);
  s = await state(pg); rd = await pg.evaluate(() => ({ reads: __reads.map(r => ({ early: r.early, lite: r.lite })), rot: _shipScan && _shipScan.rotation }));
  ok(s.track === '0451600' && s.from === 'حلب|السريان' && rd.rot && !rd.reads.some(r => r.lite), '١٠) دوّرتَ الصورة في الماسح ⇒ النسخة المدوَّرة تُقرأ كاملةً والنتيجة صحيحة: ' + s.track + ' · ' + s.from + ' ' + JSON.stringify(rd));

  // ٨) «اعتماد الشحن» والقراءة لم تنتهِ ⇒ سؤال «لحظة» (لا حفظٌ صامت بلا رقم)
  await open(o1.id);
  await pg.setInputFiles('#ship-img-input', F.a); await pg.waitForSelector('#gds', { timeout: 8000 }); await sleep(200); await btn(pg, 'إلغاء'); await sleep(100);
  const asked = await pg.evaluate(async () => { if (!_shipReading) return 'not-reading'; const p = confirmShipping(); await new Promise(z => setTimeout(z, 600)); const t = document.body.innerText.includes('لم تنتهِ بعد'); const b = [...document.querySelectorAll('button')].find(x => /سأنتظر/.test(x.textContent)); if (b) b.click(); await p; return t; });
  ok(asked === true, '٨) «اعتماد» أثناء القراءة ⇒ سؤال «القراءة لم تنتهِ بعد»: ' + asked);
  await idle(pg);

  // ٧) مكتبة التعرّف العربي غير متاحة (بلا إنترنت · صفحةٌ جديدة لم تُحمّلها) ⇒ الرقم من الباركود يُملأ ولا تعليق
  // ٩) مكتبة الباركود غير متاحة ⇒ الفرع يُقرأ من النصّ ولا تسقط القراءة كلّها
  for (const [blk, name, file, want] of [['**/lib/ocr/**', '٧) مكتبة التعرّف غير متاحة', F.b, s => /0451600/.test(s.status) && /تعذّر تحميل قارئ النصّ/.test(s.status) && /أعد المحاولة/.test(s.status)],
                                          ['**/lib/zxing*', '٩) مكتبة الباركود غير متاحة', F.b, s => s.from === 'حلب|السريان' && s.fsrc === 'receipt']]) {
    const P = await H.open('orders.html', { w: 390, h: 844, wait: 4500, init: H.ADMIN_INIT });
    await P.pg.route(blk, r => r.abort());   // («أصول ناقصة» في السجلّ: مراقب الصفحة يبلّغ عن المكتبة المحجوبة — متوقّع هنا)
    await P.pg.evaluate(id => openShipModal(id), o1.id); await P.pg.waitForTimeout(300);
    const t1 = Date.now();
    await P.pg.setInputFiles('#ship-img-input', file); await P.pg.waitForSelector('#gds', { timeout: 8000 }); await sleep(300); await btn(P.pg, 'إلغاء'); await idle(P.pg, 60000);
    const s2 = await state(P.pg);
    ok(want(s2) && !s2.reading, `${name} ⇒ ${s2.track || '—'} · ${s2.from || '—'} (${s2.fsrc}) بلا تعليق (${Date.now() - t1}ms) «${s2.status.slice(0, 70)}»`);
    const e2 = P.errs.filter(e => !/status of (400|503)|ERR_FAILED|net::|Failed to load resource|Estimating resolution|diacritics|boxClip|pixScan|أصول ناقصة/.test(e)); ok(!e2.length, name + ': لا أخطاء JS ' + e2.slice(0, 2).join(' / '));
    await P.browser.close();
  }

  const real = errs.filter(e => !/status of (400|503)/.test(e) && !/Estimating resolution|Detected \d+ diacritics|boxClipToRectangle|pixScanForForeground|ERR_FAILED|net::|Failed to load resource/.test(e));
  ok(!real.length, 'لا أخطاء JS ' + real.slice(0, 3).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
