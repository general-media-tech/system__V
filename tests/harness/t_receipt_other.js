// (25 ت1 · TASK-0159) المالك seq 69–70: «إيصالات القدموس — تدرّب تتعرّف عليهن وتاخد المصدر ورقم التتبّع، وعندك بنك الأفرع لتسهيل قراءة
// الفرع المصدر وتحديد رقمه» + «مسارات — رقم التتبّع مكتوب في الأعلى خارج الجدول تحت كلمة فاتورة». وseq 71: «القارئ للمفتي لازم يبلش
// مجرد ما انرفع الإيصال مو بعد القصّ والتصفية، وإذا ما عرف يرجع يحاول بعدهم».
// إيصالاتٌ مُصطنعة بتخطيط إيصالات المالك (other_gen.js · أسماءٌ وهواتف وهمية) — الصور الحقيقية خارج المستودع (فيها زبائن).
// ١) القارئ وحده  ٢) قارئ المفتي يكتشف إيصالهما فيتوقّف ويُسلَّم  ٣) نافذة الشحن: الرقم · الشركة · الفرع المصدر وهاتفه · الحفظ (390 و1366)
const H = require('./h.js'), fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const OUT = '/tmp/gmt-out'; try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const QAD = { number: '2641B100234', city: 'حلب', office: 'فرقان' }, MAS = { number: '4100123', src: 'حلب - سليمانية' };
async function makeImg(pg, kind, o, ph) {
  return pg.evaluate(([kind, o, ph]) => {
    let cv = kind === 'q' ? __qrcpt(o) : __masrcpt(o);
    if (ph.rot) { const r = document.createElement('canvas'), sw = ph.rot % 180 !== 0; r.width = sw ? cv.height : cv.width; r.height = sw ? cv.width : cv.height;
      const x = r.getContext('2d'); x.translate(r.width / 2, r.height / 2); x.rotate(ph.rot * Math.PI / 180); x.drawImage(cv, -cv.width / 2, -cv.height / 2); cv = r; }
    // «صورة هاتف»: الإيصال على خلفيةٍ داكنة بميلٍ خفيف
    const c = document.createElement('canvas'); c.width = cv.width + 360; c.height = cv.height + 300; const x = c.getContext('2d');
    x.fillStyle = '#2b2f36'; x.fillRect(0, 0, c.width, c.height); x.translate(c.width / 2, c.height / 2); x.rotate(ph.tilt || 0.03); x.drawImage(cv, -cv.width / 2, -cv.height / 2);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, [kind, o, ph]);
}
(async () => {
  await H.seed();
  const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون إيصال القدموس', phone: '0933000611', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق' }]);
  const [o2] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون إيصال مسارات', phone: '0933000612', product: 'عدسة', qty: 1, price: 50, status: 'pending', branch: 'حلب', address: 'دمشق' }]);
  for (const W of [390, 1366]) {
    const { browser, pg, errs } = await H.open('orders.html', { w: W, h: W < 500 ? 844 : 900, wait: 4500, mobile: W < 500, init: H.ADMIN_INIT });
    await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });
    await pg.addScriptTag({ content: fs.readFileSync(__dirname + '/other_gen.js', 'utf8') });
    const files = {};
    /* (TASK-0165) الباركود يُقرأ بالتوازي مع النصّ، ومتى قُرئ الرقم المطبوع لا يُنتظر إلّا محاولاته السريعة: في صور إيصالات المالك الحقيقيّة لم
       تجد المحاولة البطيئة «المحسَّنة» قطّ رمزاً فات السريعة (q7 · q9 تُقرأ سريعاً بـ٢٫٥ث، والبقيّة لا رمز مقروءاً فيها) ⇒ صورةٌ مستقيمة
       (ميل ٠٫٥°) تمثّل الإيصال ذا الباركود المقروء، و«qt» بميل ١٫٧° (لا يُقرأ رمزها إلّا بالبطيئة) تثبت أنّ القارئ لا ينتظرها */
    for (const [k, kind, o, ph] of [['q', 'q', QAD, { tilt: 0.008 }], ['m', 'm', MAS, { rot: 90 }], ['qn', 'q', Object.assign({}, QAD, { barcode: false, number: '2640C200345' }), {}],
                                    ['qx', 'q', Object.assign({}, QAD, { number: '2642C300456', office: '' }), { tilt: 0.008 }], ['qt', 'q', QAD, { tilt: 0.03 }]]) {
      files[k] = OUT + '/other-' + k + '.jpg'; fs.writeFileSync(files[k], Buffer.from(await makeImg(pg, kind, o, ph), 'base64'));
    }
    if (W === 390) {
      // ١) القارئ وحده — الصورة كما هي
      const rd = await pg.evaluate(async (fl) => {
        const out = {};
        for (const [k, co] of [['q', 'القدموس'], ['m', 'مسارات'], ['qn', 'القدموس'], ['qt', 'القدموس']]) {
          const b = await (await fetch('data:image/jpeg;base64,' + fl[k])).blob(), f = new File([b], k + '.jpg', { type: 'image/jpeg' });
          const t0 = performance.now(), x = await GMTReceipt.readOther(f, { company: co });
          out[k] = { co: x.company, kind: x.type.kind, t: x.tracking, key: x.branch.key, conf: x.branch.confident, phone: x.branch.phone, ms: Math.round(performance.now() - t0) };
        }
        return out;
      }, Object.fromEntries(Object.entries(files).map(([k, f]) => [k, fs.readFileSync(f).toString('base64')])));
      ok(rd.q.kind === 'qadmous' && ['match', 'printed'].includes(rd.q.t.status) && rd.q.t.number === '2641B100234', 'القدموس: الرقم المطبوع صحيح (ويطابق الباركود إن قُرئ سريعاً) (' + JSON.stringify(rd.q.t) + ') · ' + rd.q.ms + 'ms');
      ok(rd.qt.t.number === '2641B100234' && ['printed', 'match'].includes(rd.qt.t.status) && rd.qt.ms < 6000, 'القدموس بباركودٍ لا تقرؤه إلّا المحاولة البطيئة ⇒ الرقم المطبوع بلا انتظارها (' + rd.qt.t.status + ' · ' + rd.qt.ms + 'ms)');
      ok(rd.q.conf && rd.q.key === 'حلب|الفرقان' && rd.q.phone === '0944676555', 'القدموس: «المصدر: حلب» + «فرقان» تحتها ⇒ حلب|الفرقان ☎ ' + rd.q.phone + ' (من بنك الأفرع)');
      ok(rd.m.kind === 'masarat' && rd.m.t.status === 'match' && rd.m.t.number === '4100123', 'مسارات (مصوّر بالعرض): رقم «فاتورة» يطابق رمز QR (' + JSON.stringify(rd.m.t) + ') · ' + rd.m.ms + 'ms');
      ok(rd.m.conf && rd.m.key === 'حلب|السليمانية' && rd.m.phone === '0989555807', 'مسارات: «المصدر : حلب - سليمانية» ⇒ حلب|السليمانية ☎ ' + rd.m.phone);
      ok(rd.qn.t.status === 'printed' && rd.qn.t.number === '2640C200345' && rd.qn.key === 'حلب|الفرقان', 'القدموس بلا باركود: الرقم المطبوع وحده (يُعرض للتأكيد لا يُملأ) · ' + JSON.stringify(rd.qn.t));
      // مطابقة البنك: «باب الفرج» (أُضيف للبنك) ليست «الباب» · ومكتب القدموس بكلمةٍ من سطر المكتب
      const mt = await pg.evaluate(() => [GMTReceipt._matchOther('مسارات', { city: 'حلب', office: 'باب الفرج', text: '' }), GMTReceipt._matchOther('القدموس', { city: 'حلب', office: 'جميلية جرمانا', text: '' }), GMTReceipt._qadNumber('2642 c300456'), GMTReceipt._masFromQR('#M7#4200456_2026/09/01_1#'), GMTReceipt._otherOf('', ['2641B100234']), GMTReceipt._otherOf('', ['196682'])]);
      // (TASK-0163 · seq 75 «فرع باب الفرج ضيفه للبنك») — صار في البنك: يُعرف هو لا «الباب»
      ok(mt[0].confident && mt[0].key === 'حلب|باب الفرج', '«باب الفرج» ⇐ حلب|باب الفرج (لا «الباب»): ' + mt[0].key);
      ok(mt[1].confident && mt[1].key === 'حلب|الجميلية', 'القدموس «جميلية جرمانا» (المصدر ثمّ الوجهة) ⇒ حلب|الجميلية');
      ok(mt[2] === '2642C300456' && mt[3] === '4200456', 'رقم القدموس المقسوم يُجمع · رقم مسارات من رمز QR');
      ok(mt[4] === 'القدموس' && mt[5] === null, 'رمز القدموس (١١ محرفاً) يُعرف · رقم المفتي (٦ أرقام) لا يُنسب لغيره');
      // ٢) قارئ المفتي (الافتراضي في نافذة الشحن) على إيصال القدموس: يتوقّف عند الدليل ويُسلَّم
      const ho = await pg.evaluate(async (b64) => {
        const b = await (await fetch('data:image/jpeg;base64,' + b64)).blob(), f = new File([b], 'q.jpg', { type: 'image/jpeg' });
        const t0 = performance.now(), m = await GMTReceipt.readMufti(f, { asIsFirst: true, stopOnOther: true }), ms = Math.round(performance.now() - t0);
        const full0 = performance.now(); await GMTReceipt.readMufti(f, {}); const fullMs = Math.round(performance.now() - full0);
        return { other: m.other, ms, fullMs, tr: m.tracking };
      }, fs.readFileSync(files.q).toString('base64'));
      ok(ho.other && ho.other.company === 'القدموس' && ho.ms < ho.fullMs, 'قارئ المفتي يكتشف إيصال القدموس (' + (ho.other && ho.other.by) + ') ويتوقّف: ' + ho.ms + 'ms مقابل ' + ho.fullMs + 'ms لو أكمل');
    }
    // ٣) نافذة الشحن — الشركة الافتراضية «المفتي» ⇒ إيصال القدموس ⇒ سؤال (TASK-0174 · seq 91 «دائماً يقول لي إنت محدّد … نكمل ولا نغيّر»)
    //    ⇒ «غيّر» ⇒ تصير شركة الإيصال ويُقرأ رقمه وفرعه
    for (const [o, f, co, num, key, tel] of [[o1, files.q, 'القدموس', '2641B100234', 'حلب|الفرقان', '0944676555'], [o2, files.m, 'مسارات', '4100123', 'حلب|السليمانية', '0989555807']]) {
      await pg.evaluate(id => openShipModal(id), o.id); await pg.waitForTimeout(500);
      const c0 = await pg.evaluate(() => document.getElementById('ship-company').value);
      await pg.setInputFiles('#ship-img-input', f);
      await pg.waitForSelector('#gds', { timeout: 8000 });
      await pg.waitForTimeout(1200);
      await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /قصّ وتحسين/.test(b.textContent)).click());
      await pg.waitForFunction(() => [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)), null, { timeout: 15000 });
      await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /اعتماد/.test(b.textContent)).click());
      /* سؤال الشركة بالذات (نافذة «تبليغ الزبون» من حفظ الأوردر السابق قد تبقى مفتوحة) */
      const askOv = () => [...document.querySelectorAll('.gmtask-ov')].find(x => /إنت محدّد شركة/.test(x.innerText));
      await pg.waitForFunction(src => !!(new Function('return (' + src + ')()'))(), askOv.toString(), { timeout: 90000 }).catch(() => {});
      const asked = await pg.evaluate(src => { const o = (new Function('return (' + src + ')()'))(); if (!o) return ''; const t = o.innerText.replace(/\s+/g, ' ');
        const b = [...o.querySelectorAll('button')].find(x => /غيّر إلى/.test(x.textContent)); if (b) b.click(); return t; }, askOv.toString());
      await pg.waitForFunction(() => !_shipReading && _shipRead, null, { timeout: 90000 }).catch(() => {});
      const r = await pg.evaluate(() => ({ co: document.getElementById('ship-company').value, track: document.getElementById('ship-tracking').value, from: document.getElementById('ship-from').value,
        src: document.getElementById('ship-from').getAttribute('data-src'), wrap: !document.getElementById('ship-from-wrap').classList.contains('hidden'),
        lab: (document.querySelector('#ship-from-wrap label') || {}).textContent || '', note: document.getElementById('ship-from-src').innerText.replace(/\s+/g, ' '),
        status: document.getElementById('ship-track-auto').innerText.replace(/\s+/g, ' '), search: (() => { const q = document.querySelector('[data-bank-q="ship-from"]'); return q ? q.style.display : 'none'; })(),
        opts: [...document.getElementById('ship-from').options].map(x => x.value).filter(Boolean).length }));
      ok(c0 === 'المفتي' && /إنت محدّد شركة «المفتي»/.test(asked) && asked.includes('«' + co + '»') && r.co === co, W + ': الشركة الافتراضية «المفتي» + إيصال «' + co + '» ⇒ سؤال ثمّ «غيّر» ⇒ «' + r.co + '» · ' + asked.slice(0, 80));
      /* (TASK-0165) رقمٌ مطبوع بلا باركودٍ مقروءٍ سريعاً ⇒ يُعرض للضغط (كإيصالات القدموس الحقيقيّة q1–q8) — الضغطة كما يفعلها الموظّف */
      if (!r.track) r.track = await pg.evaluate(n => { const b = [...document.querySelectorAll('#ship-track-auto button')].find(x => x.textContent.trim() === n); if (b) b.click(); return document.getElementById('ship-tracking').value; }, num);
      ok(r.track === num, W + ': رقم التتبّع مُلئ (تلقائياً بتطابق الباركود، أو بضغطةٍ على المطبوع المقروء) ' + r.track);
      ok(r.wrap && /الفرع المصدر/.test(r.lab) && r.from === key && r.src === 'receipt' && r.note.includes(tel), W + ': الفرع المصدر «' + r.from + '» من الإيصال وهاتفه من البنك: ' + r.note.slice(0, 90));
      ok(r.search === 'none' && r.opts > 3, W + ': القائمة فروع «' + co + '» (' + r.opts + ') وبحث بنك المفتي مخفيّ');
      await pg.evaluate(() => document.getElementById('ship-from-wrap').scrollIntoView({ block: 'center' }));
      await pg.screenshot({ path: OUT + '/receipt_other_' + (co === 'القدموس' ? 'q' : 'm') + '_' + W + '.png' });
      // الحفظ: اعتماد الشحن ⇒ الشركة · الرقم · الفرع المصدر على الأوردر
      await pg.evaluate(() => { window.open = () => null; });
      await pg.evaluate(() => { confirmShipping(); }); await pg.waitForTimeout(2500);
      const [row] = await H.call('/rest/v1/gmt_orders?id=eq.' + o.id + '&select=status,shipping_company,tracking_number,ship_from_office', undefined, 'GET');
      ok(row && row.status === 'shipped' && row.shipping_company === co && row.tracking_number === num && row.ship_from_office === key, W + ': حُفظ على الأوردر: ' + JSON.stringify(row && { s: row.status, co: row.shipping_company, t: row.tracking_number, from: row.ship_from_office }));
      const card = await pg.evaluate(id => { const el = document.getElementById('card-' + id); return el ? (el.querySelector('[data-sender-info]') || {}).innerText || '' : '(no card)'; }, o.id);
      // (TASK-0163) مثل المفتي: «المُرسِل» وحالة الحوالة
      ok(/المُرسِل/.test(card) && card.includes(key.split('|')[1]) && /لم تُراسَل/.test(card), W + ': البطاقة تعرض الفرع المُرسِل وحالة الحوالة: ' + card.replace(/\s+/g, ' ').slice(0, 60));
      await H.call('/rest/v1/gmt_orders?id=eq.' + o.id, { status: 'pending', shipping_company: null, tracking_number: null, ship_from_office: null, receipt_img: null, receipt_at: null, receipt_meta: null }, 'PATCH');
      await pg.evaluate(() => typeof loadOrders === 'function' && loadOrders()); await pg.waitForTimeout(1200);
    }
    // ٤) (seq 73: «90% من الشحن من الفرقان بالنسبة للقدموس ومسارات … الافتراضي في حالة تعذّر القراءة … بالإعدادات فينا نغيّره»)
    for (const [co, tel] of [['القدموس', '0944676555'], ['مسارات', '0989555818']]) {
      await pg.evaluate(id => openShipModal(id), o2.id); await pg.waitForTimeout(500);
      await pg.evaluate(co => { const s = document.getElementById('ship-company'); s.value = co; s.dispatchEvent(new Event('change', { bubbles: true })); }, co);
      await pg.waitForTimeout(300);
      const df = await pg.evaluate(() => ({ v: document.getElementById('ship-from').value, src: document.getElementById('ship-from').getAttribute('data-src'), note: document.getElementById('ship-from-src').innerText }));
      ok(df.v === 'حلب|الفرقان' && df.src === 'default' && df.note.includes(tel), W + ': «' + co + '» بلا قراءة ⇒ الافتراضي من الإعدادات حلب|الفرقان ☎ ' + tel + ': ' + df.note.replace(/\s+/g, ' ').slice(0, 70));
      await pg.evaluate(() => closeModal('shipModal'));
    }
    // إيصال القدموس لا يُقرأ «المصدر» فيه (خانة المكتب فارغة) ⇒ يبقى الافتراضي مع تنبيه «تعذّر التأكّد»
    await pg.evaluate(id => openShipModal(id), o1.id); await pg.waitForTimeout(500);
    await pg.evaluate(() => { const s = document.getElementById('ship-company'); s.value = 'القدموس'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await pg.setInputFiles('#ship-img-input', files.qx); await pg.waitForSelector('#gds', { timeout: 8000 }); await pg.waitForTimeout(800);
    await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /إلغاء/.test(b.textContent)).click());
    await pg.waitForFunction(() => !_shipReading && _shipRead, null, { timeout: 90000 }).catch(() => {});
    await pg.evaluate(n => { if (!document.getElementById('ship-tracking').value) { const b = [...document.querySelectorAll('#ship-track-auto button')].find(x => x.textContent.trim() === n); if (b) b.click(); } }, '2642C300456');
    const ux = await pg.evaluate(() => ({ v: document.getElementById('ship-from').value, src: document.getElementById('ship-from').getAttribute('data-src'), note: document.getElementById('ship-from-src').innerText.replace(/\s+/g, ' '), track: document.getElementById('ship-tracking').value }));
    ok(ux.v === 'حلب|الفرقان' && ux.src === 'default' && /تعذر التأكد/.test(ux.note) && ux.track === '2642C300456', W + ': «المصدر» غير مقروء ⇒ يبقى الافتراضي حلب|الفرقان مع تنبيه (والرقم ' + ux.track + '): ' + ux.note.slice(0, 80));
    await pg.evaluate(() => closeModal('shipModal'));
    if (W > 500) {
      // ⚙️ إعدادات الأوردرات: افتراضيّ القدموس ومسارات يُغيَّر ويُحفظ في القاعدة
      await pg.evaluate(() => openOrdersSettings()); await pg.waitForSelector('#orders-settings', { timeout: 5000 });
      const st0 = await pg.evaluate(() => [...document.querySelectorAll('#orders-settings select')].map(x => [x.getAttribute('data-co') || 'المفتي', x.value]));
      ok(JSON.stringify(st0) === JSON.stringify([['المفتي', 'حلب|السريان'], ['القدموس', 'حلب|الفرقان'], ['مسارات', 'حلب|الفرقان']]), 'الإعدادات: الفرع الافتراضي لكل شركة: ' + JSON.stringify(st0));
      // (نوافذ «تبليغ الزبون» من الشحن السابق قد تبقى فوقها ⇒ القيمة تُضبط مباشرةً لا بنقرةٍ على عنصرٍ مغطّى)
      await pg.evaluate(() => { const x = document.getElementById('os-ship-from-1'); x.value = 'حلب|السليمانية'; x.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('os-save').click(); });
      await pg.waitForTimeout(800);
      const rows = await H.call('/rest/v1/gmt_settings?key=like.orders_default_ship_from*&select=key,value', undefined, 'GET');
      const mm = (rows || []).find(x => x.key === 'orders_default_ship_from_masarat'), shown = await pg.evaluate(() => !!document.getElementById('orders-settings'));
      ok(mm && mm.value === 'حلب|السليمانية' && !shown, 'الإعدادات: تغيير افتراضيّ مسارات إلى حلب|السليمانية حُفظ في القاعدة: ' + JSON.stringify(rows));
      await pg.evaluate(id => openShipModal(id), o2.id); await pg.waitForTimeout(500);
      await pg.evaluate(() => { const s = document.getElementById('ship-company'); s.value = 'مسارات'; s.dispatchEvent(new Event('change', { bubbles: true })); });
      ok(await pg.evaluate(() => document.getElementById('ship-from').value) === 'حلب|السليمانية', 'الافتراضي الجديد يُستعمل في نافذة الشحن');
      await pg.evaluate(() => closeModal('shipModal'));
    }
    const real = errs.filter(e => !/status of (400|503)/.test(e) && !/Estimating resolution|Detected \d+ diacritics|boxClipToRectangle|pixScanForForeground|Image too small to scale|Line cannot be recognized/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
