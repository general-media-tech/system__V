// (TASK-0230 · المالك seq 160) «ما بين شركه شحن اترك لي خيار اسمه شوفير … بدل كلمه رقم تتبع اذا اخترنا الشركه شوفير ينكتب رقم اتصال الشوفير
// ونحن بنعطيك صوره السياره او السرفيس بدل صوره ايصال تستخرج منها رقم النمره او رقم الفانوس … تكتبهم ايضا في الملاحظات»
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dump = () => H.call('/__dump', undefined, 'GET');
(async () => {
  await H.seed();
  const [o] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون شوفير', phone: '0933700001', status: 'pending', qty: 1, branch: 'حلب', product: 'كاميرا', price: 100, address: 'حمص — دوار الساعة', notes: 'اتصل قبل الوصول', serial_code: 'ORD-D1' }]);
  const { browser, pg, errs } = await H.open('orders.html', { w: 390, h: 844, mobile: true, wait: 5000, init: H.ADMIN_INIT });
  // ① الخيار في القوائم
  const opts = await pg.evaluate(() => ({ ship: [...document.querySelectorAll('#ship-company option')].map(x => x.value), filt: [...document.querySelectorAll('#filter-company option')].map(x => x.value), add: [...document.querySelectorAll('#in-company option')].map(x => x.value) }));
  ok(opts.ship.includes('شوفير') && opts.filt.includes('شوفير') && opts.add.includes('شوفير'), '«🚐 شوفير» بين شركات الشحن (نافذة الشحن · الإضافة · الفلتر)');
  // ② نافذة الشحن ⇒ اختيار شوفير
  await pg.evaluate(id => { openShipModal(id); const s = document.getElementById('ship-company'); s.value = 'شوفير'; s.dispatchEvent(new Event('change', { bubbles: true })); }, o.id);
  const ui = await pg.evaluate(() => ({ ph: document.getElementById('ship-tracking').placeholder, box: !document.getElementById('ship-driver').classList.contains('hidden'), read: shipCanRead(), hint: document.getElementById('ship-img-preview').innerText }));
  ok(/رقم اتصال الشوفير/.test(ui.ph) && ui.box && ui.read === false && /السيارة أو السرفيس/.test(ui.hint), 'شوفير ⇒ «📞 رقم اتصال الشوفير» بدل رقم التتبّع · خانة النمرة/الفانوس · لا قارئ إيصال: ' + JSON.stringify(ui));
  // ③ صورة السيارة ⇒ مرشّحو النمرة (القارئ مُستبدَل بنتيجةٍ محدّدة — التعرّف نفسه في ④)
  await pg.evaluate(() => { window.__scan = 0; if (window.GMTDocScan) GMTDocScan.open = async () => { window.__scan++; return null; }; GMTReceipt.readPlate = async () => ({ candidates: [{ number: '523817', conf: 88 }, { number: '0912', conf: 40 }], city: 'دمشق' }); });
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await (await pg.$('#ship-img-input')).setInputFiles({ name: 'car.png', mimeType: 'image/png', buffer: PNG }); await sleep(600);
  const ch = await pg.evaluate(() => ({ c: [...document.querySelectorAll('#ship-plate-cands [data-plate]')].map(b => b.textContent), scan: window.__scan, st: document.getElementById('ship-plate-st').textContent, img: !!document.querySelector('#ship-img-preview img') }));
  ok(ch.c.join() === '523817,0912' && ch.scan === 0 && ch.img && /دمشق/.test(ch.st), 'صورة السيارة ⇒ بلا ماسح الورق · مرشّحو النمرة/الفانوس للضغط + المحافظة: ' + JSON.stringify(ch));
  await pg.evaluate(() => document.querySelector('#ship-plate-cands [data-plate="523817"]').click());
  ok(await pg.evaluate(() => document.getElementById('ship-plate').value) === '523817 دمشق', 'الضغط على المرشّح ⇒ في خانة النمرة');
  // بلا رقم الشوفير ⇒ لا اعتماد
  await pg.evaluate(() => confirmShipping()); await sleep(500);
  let d = await dump();
  ok(d.gmt_orders.find(x => x.id === o.id).status === 'pending', 'بلا رقم اتصال الشوفير ⇒ لا يُعتمد الشحن');
  await pg.evaluate(() => { document.getElementById('ship-tracking').value = '0944 555 666'; confirmShipping(); }); await sleep(1500);
  d = await dump(); const s1 = d.gmt_orders.find(x => x.id === o.id);
  ok(s1.status === 'shipped' && s1.shipping_company === 'شوفير' && s1.tracking_number === '0944 555 666' && /^اتصل قبل الوصول\n🚐 شوفير: 0944 555 666 · النمرة\/الفانوس: 523817 دمشق$/.test(s1.notes || ''),
    'الاعتماد ⇒ شوفير · رقمه · وفي الملاحظات: الشوفير والنمرة/الفانوس (ملاحظة الأوردر تبقى): ' + JSON.stringify(s1.notes));
  const card = await pg.evaluate(id => { switchTab('shipped'); return (document.querySelector('#section-shipped #card-' + id) || {}).innerText || ''; }, o.id);
  ok(/📞 الشوفير 0944 555 666/.test(card) && !/🔖 0944/.test(card), 'البطاقة: «📞 الشوفير» لا «🔖»');
  const msg = await pg.evaluate(id => { const x = orders.find(q => q.id == id); return { s: buildNoticeText(x, 'shipped'), a: buildNoticeText(x, 'arrived'), link: trackLinkFor(x) }; }, o.id);
  ok(/📞 رقم الشوفير: \*0944 555 666\*/.test(msg.s) && /مع شوفير/.test(msg.s) && !/من مكتب شوفير/.test(msg.a) && !/0944/.test(msg.link), 'رسالة الزبون: «📞 رقم الشوفير» · لا «مكتب شوفير» · رابط التتبّع برقم الطلب لا برقم الشوفير');
  // ④ القارئ الحقيقي (تعرّفٌ محلّي) على صورةٍ فيها رقم
  const r2 = await pg.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 900; cv.height = 300; const x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 300); x.fillStyle = '#000'; x.font = 'bold 140px Arial'; x.fillText('523817', 120, 200);
    const b = await new Promise(r => cv.toBlob(r, 'image/png'));
    const s = document.createElement('script'); s.src = 'gmt-receipt.js?x=' + Date.now(); delete window.GMTReceipt;
    await new Promise(ok => { s.onload = ok; document.head.appendChild(s); });
    try { const r = await Promise.race([GMTReceipt.readPlate(new File([b], 'p.png', { type: 'image/png' })), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 60000))]); return r.candidates.map(c => c.number); } catch (e) { return 'ERR ' + e.message; }
  });
  ok(Array.isArray(r2) && r2[0] === '523817', 'القارئ المحلّي يقرأ رقم النمرة من الصورة: ' + JSON.stringify(r2));
  const realErr = errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|Estimating resolution/.test(e));
  ok(!realErr.length, 'لا أخطاء JS ' + realErr.slice(0, 2).join(' / '));
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
