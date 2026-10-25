// (25 ت1 · TASK-0165) المالك seq 78: «الفرع الوجهة أو شركة الشحن محدّدة من إنشاء الأوردر … مثلاً محدّد المفتي، أرسلت إيصال الشحن كان لغير شركة
// ⇒ فوراً يسألني: إنت كنت محدّدها المفتي وهاي الوجهة، والإيصال للقدموس أو مسارات — فتأكّد من الإيصال».
// ١) الأوردر على «المفتي» (محفوظة عند الإنشاء) + إيصال مسارات ⇒ سؤال · «اعتمد مسارات» ⇒ الشركة مسارات ورقمها وفرعها
// ٢) الأوردر على «مسارات» + إيصال القدموس ⇒ سؤال · «أبقِ مسارات» ⇒ تبقى ولا يُملأ رقم القدموس
// ٣) أوردرٌ بلا شركة (الافتراضي المفتي) + إيصال مسارات ⇒ سؤالٌ أيضاً (TASK-0174 · seq 91 «دائماً يقول لي إنت محدّد … نكمل ولا نغيّر») ⇒ «غيّر» ⇒ مسارات
// (TASK-0174) السؤال يعرض صورة الإيصال واسم «المرسل إليه» المقروء مقابل زبون الأوردر
const H = require('./h.js'), fs = require('fs');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const OUT = '/tmp/gmt-out'; try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const QAD = { number: '2641B100234', city: 'حلب', office: 'فرقان' }, MAS = { number: '4100123', src: 'حلب - سليمانية' };
async function makeImg(pg, kind, o, ph) {
  return pg.evaluate(([kind, o, ph]) => {
    let cv = kind === 'q' ? __qrcpt(o) : __masrcpt(o);
    if (ph.rot) { const r = document.createElement('canvas'), sw = ph.rot % 180 !== 0; r.width = sw ? cv.height : cv.width; r.height = sw ? cv.width : cv.height;
      const x = r.getContext('2d'); x.translate(r.width / 2, r.height / 2); x.rotate(ph.rot * Math.PI / 180); x.drawImage(cv, -cv.width / 2, -cv.height / 2); cv = r; }
    const c = document.createElement('canvas'); c.width = cv.width + 360; c.height = cv.height + 300; const x = c.getContext('2d');
    x.fillStyle = '#2b2f36'; x.fillRect(0, 0, c.width, c.height); x.translate(c.width / 2, c.height / 2); x.rotate(ph.tilt || 0.01); x.drawImage(cv, -cv.width / 2, -cv.height / 2);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, [kind, o, ph]);
}
async function scanAndWait(pg, f) {
  await pg.setInputFiles('#ship-img-input', f);
  await pg.waitForSelector('#gds', { timeout: 8000 });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /قصّ وتحسين/.test(b.textContent)).click());
  await pg.waitForFunction(() => [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)), null, { timeout: 15000 });
  await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /اعتماد/.test(b.textContent)).click());
}
const dialog = pg => pg.waitForSelector('.gmtask-ov', { timeout: 90000 }).then(() => pg.evaluate(() => { const o = document.querySelector('.gmtask-ov'), im = o.querySelector('img[data-gmtask-img]');
  return { text: o.innerText.replace(/\s+/g, ' '), btns: [...o.querySelectorAll('button')].map(b => b.textContent.trim()), img: !!(im && im.complete && im.naturalWidth > 100) }; })).catch(() => null);
const nameOf = pg => pg.waitForFunction(() => { const o = document.querySelector('.gmtask-ov'); const t = o ? o.innerText.replace(/\s+/g, ' ') : ''; return !/جارٍ قراءته/.test(t) && t; }, null, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => '');
const press = (pg, re) => pg.evaluate(src => { const b = [...document.querySelectorAll('.gmtask-ov button')].find(x => new RegExp(src).test(x.textContent)); if (b) b.click(); return !!b; }, re.source);
(async () => {
  await H.seed();
  for (const W of [390, 1366]) {
    const [oM, oS, oN] = await H.call('/rest/v1/gmt_orders', [
      { name: 'أوردر المفتي ' + W, phone: '0933000711', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق — المزة', shipping_company: 'المفتي' },
      { name: 'أوردر مسارات ' + W, phone: '0933000712', product: 'عدسة', qty: 1, price: 50, status: 'pending', branch: 'حلب', address: 'حمص', shipping_company: 'مسارات' },
      { name: 'أوردر بلا شركة ' + W, phone: '0933000713', product: 'حامل', qty: 1, price: 30, status: 'pending', branch: 'حلب', address: 'حماة' }]);
    const { browser, pg, errs } = await H.open('orders.html', { w: W, h: W < 500 ? 844 : 900, wait: 4500, mobile: W < 500, init: H.ADMIN_INIT });
    await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });
    await pg.addScriptTag({ content: fs.readFileSync(__dirname + '/other_gen.js', 'utf8') });
    const fm = OUT + '/mm-m.jpg', fq = OUT + '/mm-q.jpg';
    fs.writeFileSync(fm, Buffer.from(await makeImg(pg, 'm', MAS, { rot: 90 }), 'base64'));
    fs.writeFileSync(fq, Buffer.from(await makeImg(pg, 'q', QAD, {}), 'base64'));
    await pg.evaluate(() => loadOrders()); await pg.waitForTimeout(800);

    // ١) «المفتي» محفوظة + إيصال مسارات ⇒ سؤال ⇒ «الإيصال صحيح»
    await pg.evaluate(id => openShipModal(id), oM.id); await pg.waitForTimeout(500);
    const t0 = Date.now();
    await scanAndWait(pg, fm);
    let d = await dialog(pg);
    ok(d && /إنت محدّد شركة «المفتي»/.test(d.text) && /مسارات/.test(d.text) && /المزة/.test(d.text) && /نكمل مع «المفتي» ولا نغيّر شركة الشحن/.test(d.text),
      W + ': «المفتي» من الإنشاء + إيصال مسارات ⇒ سؤالٌ فيه الشركة والوجهة (' + Math.round((Date.now() - t0) / 1000) + 'ث): ' + (d ? d.text.slice(0, 120) : 'لا سؤال'));
    ok(d && d.img, W + ': السؤال يعرض صورة الإيصال');
    // الاسم يُقرأ والسؤال ظاهر (لا يؤخّره) ⇒ يُنتظر حتى يُكتب فيه
    // (صفّ «المرسل إليه» في إيصال مسارات المصطنع لا يُقرأ — في إيصالات مسارات الحقيقيّة يُقرأ؛ الاسم نفسه يُفحص على إيصال القدموس في ٢)
    const nm = await nameOf(pg);
    ok(/جارٍ قراءته/.test(d ? d.text : '') && /زبون الأوردر: «أوردر المفتي/.test(nm) && /الاسم المكتوب على الإيصال \(كما قُرئ\): («[^»]+»|لم يُقرأ — انظر الصورة)/.test(nm),
      W + ': سطر الاسم المكتوب على الإيصال مقابل زبون الأوردر (يُقرأ والسؤال ظاهر): ' + ((String(nm).match(/الاسم المكتوب[^.]*/) || [''])[0]));
    ok(d && d.btns.some(b => /غيّر إلى «مسارات»/.test(b)) && d.btns.some(b => /نكمل مع «المفتي»/.test(b)), W + ': الخياران «غيّر إلى مسارات» · «نكمل مع المفتي»: ' + (d ? d.btns.join(' | ') : ''));
    if (W === 390) await pg.screenshot({ path: OUT + '/receipt_mismatch_' + W + '.png' });
    await press(pg, /غيّر إلى/);
    await pg.waitForFunction(() => document.getElementById('ship-company').value === 'مسارات' && !!document.getElementById('ship-tracking').value, null, { timeout: 15000 }).catch(() => {});
    let r = await pg.evaluate(() => ({ co: document.getElementById('ship-company').value, t: document.getElementById('ship-tracking').value, from: document.getElementById('ship-from').value }));
    ok(r.co === 'مسارات' && r.t === '4100123' && r.from === 'حلب|السليمانية', W + ': «غيّر إلى مسارات» ⇒ الشركة مسارات ورقمها وفرعها: ' + JSON.stringify(r));
    await pg.evaluate(() => closeModal('shipModal')); await pg.waitForTimeout(400);

    // ٢) «مسارات» محفوظة + إيصال القدموس ⇒ سؤال ⇒ «أبقِ مسارات»
    await pg.evaluate(id => openShipModal(id), oS.id); await pg.waitForTimeout(500);
    await scanAndWait(pg, fq);
    d = await dialog(pg);
    ok(d && /إنت محدّد شركة «مسارات»/.test(d.text) && /القدموس/.test(d.text) && d.img, W + ': «مسارات» + إيصال القدموس ⇒ سؤالٌ بالصورة: ' + (d ? d.text.slice(0, 100) : 'لا سؤال'));
    const nm2 = await nameOf(pg);
    ok(/الاسم المكتوب على الإيصال \(كما قُرئ\): «سامر خليل» — زبون الأوردر: «أوردر مسارات/.test(nm2), W + ': «المرسل إليه» مقروءٌ من الإيصال («سامر خليل») مقابل زبون الأوردر: ' + ((String(nm2).match(/الاسم المكتوب[^.]*/) || [''])[0]));
    await press(pg, /نكمل مع/);
    await pg.waitForFunction(() => !_shipReading, null, { timeout: 60000 }).catch(() => {});
    await pg.waitForTimeout(4000);
    r = await pg.evaluate(() => ({ co: document.getElementById('ship-company').value, t: document.getElementById('ship-tracking').value }));
    ok(r.co === 'مسارات' && r.t !== '2641B100234', W + ': «نكمل مع مسارات» ⇒ تبقى ولا يُملأ رقم القدموس: ' + JSON.stringify(r));
    await pg.evaluate(() => closeModal('shipModal')); await pg.waitForTimeout(400);

    // ٣) بلا شركة (الافتراضي المفتي) + إيصال مسارات ⇒ سؤالٌ أيضاً ⇒ «غيّر» ⇒ مسارات ورقمها
    await pg.evaluate(id => openShipModal(id), oN.id); await pg.waitForTimeout(500);
    await scanAndWait(pg, fm);
    d = await dialog(pg);
    ok(d && /إنت محدّد شركة «المفتي»/.test(d.text) && /مسارات/.test(d.text) && d.img, W + ': الافتراضي «المفتي» + إيصال مسارات ⇒ سؤالٌ بالصورة: ' + (d ? d.text.slice(0, 90) : 'لا سؤال'));
    await press(pg, /غيّر إلى/);
    await pg.waitForFunction(() => document.getElementById('ship-company').value === 'مسارات' && !!document.getElementById('ship-tracking').value, null, { timeout: 15000 }).catch(() => {});
    r = await pg.evaluate(() => ({ co: document.getElementById('ship-company').value, t: document.getElementById('ship-tracking').value }));
    ok(r.co === 'مسارات' && r.t === '4100123', W + ': «غيّر» ⇒ مسارات ورقمها: ' + JSON.stringify(r));
    await pg.evaluate(() => closeModal('shipModal'));

    const real = errs.filter(e => !/status of (400|401|404|406|503)|Failed to load resource|Estimating resolution/.test(e));
    ok(!real.length, W + ': لا أخطاء JS ' + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
