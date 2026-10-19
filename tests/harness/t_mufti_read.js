// قراءة إيصال المفتي (برومبت «الماسح الضوئي الذكي» ثالثاً ورابعاً · 19 ت1): نوع الإيصال · رقم التتبّع من مصدرين (تطابق/اختلاف/
// مصدرٌ واحد/لا شيء) · الأصفار الأولى تبقى · الفرع المصدر من «المصدر» لا من «الوجهة» · الثقة ⇐ يُعتمد، وإلّا رسالة المالك بنصّها
// · اختيارك اليدوي (رقماً أو فرعاً) لا يُستبدل · بقية الشركات: مسحٌ فقط. + الإيصالان الحقيقيان إن وُجدا على الجهاز (لا يُرفعان للمستودع).
const H = require('./h.js');
const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const REAL = '/tmp/claude-0/-home-user-system--V/dfe65fb9-bcc1-5e5a-be94-906828e1c021/scratchpad/devreq/';
const MSG = 'تعذر التأكد من فرع الشحن المصدر. يرجى اختيار الفرع يدوياً أو إعادة تصوير الإيصال';

/* إيصالٌ مصطنع بتخطيط المفتي: QR أعلى اليسار · الرقم المطبوع أعلى اليمين · المرسل/المصدر يميناً والمرسل إليه/الوجهة يساراً */
const SYNTH = `window.__rcpt = function (o) {
  const W = 1500, Hh = 760, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#111'; c.direction = 'rtl'; c.textAlign = 'right';
  if (o.qr) { const m = new ZXing.QRCodeWriter().encode(o.qr, ZXing.BarcodeFormat.QR_CODE, 220, 220, new Map());
    for (let y = 0; y < m.getHeight(); y++) for (let x = 0; x < m.getWidth(); x++) if (m.get(x, y)) c.fillRect(40 + x, 30 + y, 1, 1); }
  c.font = 'bold 54px DejaVu Sans'; if (o.printed) { c.textAlign = 'left'; c.fillText(o.printed, 1150, 90); c.textAlign = 'right'; }
  c.font = 'bold 26px DejaVu Sans'; c.fillText('تتبع الشحنة امسح الباركود', 1440, 140);
  c.font = 'bold 40px DejaVu Sans'; c.fillText(o.company || 'شركة المفتي للشحن', 960, 230);
  c.font = 'bold 34px DejaVu Sans';
  c.fillText('المرسل: مجموعة ميديا تك التجارية', 1440, 330); c.fillText('المرسل إليه: أحمد خالد', 640, 330);
  if (o.src !== null) c.fillText(o.src ? 'المصدر: ' + o.src : '', 1440, 400);
  c.fillText('الوجهة: ' + (o.dst || 'دمشق-فكتوريا'), 640, 400);
  c.fillText('الموبايل: 0939773715', 1440, 470); c.fillText('الموبايل: 0933250051', 640, 470);
  c.fillText('جاهزة للارسال      المحتوى: كاميرا', 1440, 560);
  c.font = 'bold 26px DejaVu Sans'; c.fillText(o.footer || 'المقر الرئيسي: سوريا- دمشق - البرامكة - دمشق: 0965112158 - حمص: 0965112157', 1440, 650);
  c.fillText('اسم و توقيع المرسل', 1440, 710);
  return cv;
};`;

async function readCase(pg, spec, before) {
  return pg.evaluate(async ({ spec, before }) => {
    const cv = __rcpt(spec);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
    document.getElementById('ship-tracking').value = before.typed || '';
    _shipRcptAuto = false; _shipScan = null;
    syncShipFromBox(null, true);
    if (before.manual) { const s = document.getElementById('ship-from'); shipFromFill(s, before.manual); s.setAttribute('data-src', 'manual'); }
    _shipRcptFile = new File([blob], 'r.jpg', { type: 'image/jpeg' });
    const t0 = performance.now(); await shipReadTracking();
    const st = document.getElementById('ship-track-auto'), sel = document.getElementById('ship-from');
    return { ms: Math.round(performance.now() - t0), track: document.getElementById('ship-tracking').value, status: st.innerText.replace(/\s+/g, ' '),
      btns: [...st.querySelectorAll('button')].map(b => b.textContent.trim()), r: _shipRead && { tracking: _shipRead.tracking, type: _shipRead.type && _shipRead.type.kind, branch: _shipRead.branch && { key: _shipRead.branch.key, c: _shipRead.branch.candidates, t: _shipRead.branch.text } },
      from: sel.value, src: sel.getAttribute('data-src'), fromBox: document.getElementById('ship-from-src').innerText.replace(/\s+/g, ' ') };
  }, { spec, before: before || {} });
}

(async () => {
  await H.seed();
  // وحدات: التطابق التقريبي على نصوصٍ قرأها OCR فعلاً من الإيصالين الحقيقيين
  {
    const { browser, pg } = await H.open('orders.html', { w: 1366, h: 800, wait: 3000 });
    const u = await pg.evaluate(() => {
      const m = s => GMTReceipt._matchBranch(s);
      const seg = t => (GMTReceipt._sourceSegment(t) || {}).seg;
      return {
        m01: seg('السرميد مج الزيه.... المرسل إليه: شاهين درو\nامصدر: جلي السريان .77 سكي < << << الوجهة: دمشق فكتوريا | ا'),
        m02: seg('المرسل: مجموعة ميديا تك التجارية المرسل إلد»: بلال حاج بكور ا\nالمصدر: حلب-الفرقان الوجهة: ادلب- ٠٠ار المحراب |'),
        a: m('جلي اللسريان'), b: m('حلب-الفرقان'), c: m('حلب'), d: m('دمشق - فكتوريا'), e: m('xyz'),
        t1: GMTReceipt._receiptType('شركة المقتي للشحن').kind, t2: GMTReceipt._receiptType('هاتف 0965112158').kind,
        t3: GMTReceipt._receiptType('المرسل المصدر الوجهة الموبايل جاهزة للارسال شركة القدموس').kind
      };
    });
    ok(u.m01 && /السريان/.test(u.m01) && !/دمشق|فكتوريا/.test(u.m01), '«امصدر: جلي السريان … الوجهة: دمشق» ⇒ يُؤخذ ما قبل الوجهة فقط: ' + u.m01);
    ok(u.m02 === 'حلب-الفرقان', '«المصدر: حلب-الفرقان الوجهة: ادلب» ⇒ ' + u.m02);
    ok(u.a.confident && u.a.key === 'حلب|السريان', 'أخطاء التنقيط: «جلي اللسريان» ⇒ حلب|السريان (موثوق)');
    ok(u.b.confident && u.b.key === 'حلب|الفرقان', '«حلب-الفرقان» ⇒ حلب|الفرقان (موثوق)');
    ok(!u.c.confident && u.c.candidates.length >= 5 && u.c.candidates.every(k => /^حلب\|/.test(k)), 'المدينة وحدها ⇒ غير مؤكّد، والمرشّحون فروع حلب فقط');
    ok(u.d.confident && u.d.key === 'دمشق|فكتوريا', 'فرعٌ خارج حلب يُعتمد حين يكون واضحاً (دمشق|فكتوريا)');
    ok(!u.e.confident && !u.e.key, 'نصٌّ لا يشبه فرعاً ⇒ لا فرع');
    ok(u.t1 === 'mufti' && u.t2 === 'mufti' && u.t3 === 'unsure', 'نوع الإيصال: الاسم أو هاتف مكتب المفتي ⇒ مؤكَّد · بنية إيصالٍ بلا علامة ⇒ غير مؤكَّد');
    await browser.close();
  }

  const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون قراءة', phone: '0933000401', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' }]);
  for (const [w, h] of [[390, 844], [1366, 800]]) {
    console.log(`— ${w}×${h}`);
    const { browser, pg, errs } = await H.open('orders.html', { w, h, wait: 4500, init: H.ADMIN_INIT + SYNTH });
    await pg.addScriptTag({ url: H.BASE + 'lib/zxing.min.js?v=20261003' });
    await pg.evaluate(id => openShipModal(id), o1.id); await pg.waitForTimeout(500);

    let r = await readCase(pg, { qr: '0123456', printed: '0123456', src: 'حلب-الفرقان' });
    ok(r.r && r.r.tracking.status === 'match' && r.track === '0123456', 'المطبوع = الباركود ⇒ يُعتمد ويُسجَّل التحقّق، والصفر الأوّل باقٍ: ' + r.track + ' (' + r.ms + 'ms)');
    ok(/تطابق الرقم المطبوع مع الباركود/.test(r.status), 'رسالة «تطابق … تحقّقٌ ناجح»');
    ok(r.from === 'حلب|الفرقان' && r.src === 'receipt' && /من إيصال الشحن/.test(r.fromBox), 'الفرع المصدر من الإيصال (الفرقان لا السريان الافتراضي) ومصدره ظاهر: ' + r.from);

    if (w === 1366) {
      r = await readCase(pg, { qr: '0123456', printed: '0123999', src: 'حلب-الفرقان' });
      ok(r.r && r.r.tracking.status === 'differ' && r.track === '', 'المطبوع ≠ الباركود ⇒ لا يُعتمد أيٌّ منهما: ' + JSON.stringify(r.r && r.r.tracking));
      ok(r.btns.some(b => /المطبوع: 0123999/.test(b)) && r.btns.some(b => /الباركود: 0123456/.test(b)), 'تُعرض القيمتان ليحسم المستخدم: ' + r.btns.join(' · '));
      await pg.evaluate(() => [...document.querySelectorAll('#ship-track-auto button')].find(b => /الباركود/.test(b.textContent)).click());
      ok(await pg.evaluate(() => document.getElementById('ship-tracking').value) === '0123456', 'اختيار «الباركود» يملأ الرقم');

      r = await readCase(pg, { printed: '765432', src: 'حلب-السريان' });
      ok(r.r && r.r.tracking.status === 'printed' && r.track === '' && r.btns.includes('765432'), 'مصدرٌ واحد (المطبوع) ⇒ يُعرض مع مصدره ولا يُملأ وحده: ' + JSON.stringify(r.r && r.r.tracking));
      ok(/الرقم المطبوع/.test(r.status), 'المصدر مذكور: «من الرقم المطبوع»');

      r = await readCase(pg, { qr: '889900', src: 'حلب-السريان' });
      ok(r.r && r.r.tracking.status === 'barcode' && r.track === '889900' && /الباركود/.test(r.status), 'الباركود وحده ⇒ يُعرض مع مصدره: ' + r.status.slice(0, 70));

      r = await readCase(pg, { src: 'حلب-السريان' });
      ok(r.r && r.r.tracking.status === 'none' && /تعذر قراءة رقم التتبع/.test(r.status), 'لا مصدر ⇒ «تعذر قراءة رقم التتبع» + إدخال يدوي');

      r = await readCase(pg, { qr: '0123456', printed: '0123456', src: null });
      ok(r.from === 'حلب|السريان' && r.src === 'default' && r.fromBox.indexOf(MSG) !== -1, 'لا «المصدر» في الإيصال ⇒ رسالة المالك بنصّها والافتراضي يبقى: ' + r.fromBox.slice(0, 90));

      r = await readCase(pg, { qr: '0123456', printed: '0123456', src: 'حلب-الفرقان' }, { manual: 'حلب|الباب', typed: '777' });
      ok(r.from === 'حلب|الباب' && r.src === 'manual' && /الفرقان/.test(r.fromBox), 'فرعٌ اخترتَه يدوياً لا يُستبدل — ويُقال إنّ الإيصال يشير لغيره: ' + r.fromBox.slice(0, 80));
      ok(r.track === '777' && /يختلف عن الإيصال/.test(r.status), 'رقمٌ كتبتَه لا يُستبدل — يُقارن فقط');

      r = await readCase(pg, { qr: '0123456', printed: '0123456', src: 'حلب-الفرقان', company: 'شركة القدموس للنقل', footer: 'المقر الرئيسي: حمص - هاتف 0311234567' });
      ok(r.r && r.r.type !== 'mufti' && r.track === '' && /لم أتأكّد أنّ هذه الصورة إيصال/.test(r.status), 'إيصالٌ بلا علامة المفتي ⇒ لا يُنسب إليه ولا يُملأ شيء: ' + (r.r && r.r.type));
      ok(r.src !== 'receipt', 'وفرعه لا يُعتمد تلقائياً');

      await pg.selectOption('#ship-company', { index: 2 }).catch(() => {});
      const other = await pg.evaluate(() => ({ comp: document.getElementById('ship-company').value, hidden: document.getElementById('ship-track-auto').classList.contains('hidden') }));
      ok(other.comp !== 'المفتي' && other.hidden, 'شركةٌ أخرى ⇒ مسحٌ فقط (لا قراءة): ' + other.comp);
      await pg.selectOption('#ship-company', 'المفتي');

      // الإيصالان الحقيقيان (من جهاز التطوير فقط)
      for (const [f, key, num] of [['m02', 'حلب|الفرقان', '196682'], ['m01', 'حلب|السريان', null]]) {
        if (!fs.existsSync(REAL + f + '.jpg')) { console.log('  (' + f + ' غير موجود — تخطٍّ)'); continue; }
        const b64 = fs.readFileSync(REAL + f + '.jpg').toString('base64');
        const x = await pg.evaluate(async (b64) => {
          const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          const orig = new File([u], 'o.jpg', { type: 'image/jpeg' });
          const img = new Image(); await new Promise(r => { img.onload = r; img.src = URL.createObjectURL(orig); });
          const cv = GMTDocScan.process(img, GMTDocScan.detectNorm(img, 0).corners, 0, 'color');
          const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
          document.getElementById('ship-tracking').value = ''; _shipRcptAuto = false; syncShipFromBox(null, true);
          _shipScan = { original: orig, scanned: new File([blob], 's.jpg', { type: 'image/jpeg' }), mode: 'color' }; _shipRcptFile = _shipScan.scanned;
          const t0 = performance.now(); await shipReadTracking();
          return { ms: Math.round(performance.now() - t0), track: document.getElementById('ship-tracking').value, t: _shipRead.tracking, type: _shipRead.type.kind, from: document.getElementById('ship-from').value, src: document.getElementById('ship-from').getAttribute('data-src') };
        }, b64);
        ok(x.type === 'mufti' && x.from === key && x.src === 'receipt', f + ': إيصال المفتي ⇒ الفرع المصدر «' + x.from + '» من الإيصال (' + x.ms + 'ms)');
        if (num) ok(x.t.status === 'match' && x.track === num, f + ': رقم التتبّع ' + x.track + ' — ' + x.t.status);
        else ok(x.t.status !== 'match' || x.track, f + ': (الرقم المطبوع مقصوصٌ في الصورة) حالة الرقم: ' + JSON.stringify(x.t));
      }
    }
    const fit = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(fit <= 1, 'لا طفح أفقي');
    const own = errs.filter(e => !/status of (400|503)/.test(e) && !/Estimating resolution|Detected \d+ diacritics|boxClipToRectangle|pixScanForForeground/.test(e));   // سجلّ Tesseract الداخلي ليس خطأ صفحة
    ok(!own.length, 'لا أخطاء JS ' + own.join(' | '));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
