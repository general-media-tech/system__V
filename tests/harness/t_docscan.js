// اختبار الماسح الضوئي الداخلي (gmt-docscan.js · 19 ت1): اكتشاف الورقة · تصحيح المنظور · لا قصّ لأيّ زاوية/رقم ·
// ميلان شديد · إضاءة ضعيفة · ظلّ · خلفية مزدحمة · ضبابية · ورقة تملأ الإطار · الإيصالان الحقيقيان · ونافذة الشحن كاملة
const H = require('./h.js');
const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
/* إيصالا المالك الحقيقيان خارج المستودع (فيهما بيانات زبائن — المستودع عامّ) */
const REAL = '/tmp/claude-0/-home-user-system--V/dfe65fb9-bcc1-5e5a-be94-906828e1c021/scratchpad/devreq/';

/* يولّد في المتصفّح مستنداً: ورقة بيضاء فيها أسطر نصّ و«علامات زوايا» سوداء داخل كل ركن، بمنظورٍ على خلفية */
const SYNTH = `window.__synth = function (o) {
  const W = o.W || 1200, Hh = o.H || 900, c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d');
  if (o.busy) { for (let i = 0; i < 160; i++) { x.fillStyle = 'hsl(' + (i * 47 % 360) + ',55%,' + (25 + i % 30) + '%)'; x.fillRect((i * 97) % W, (i * 61) % Hh, 40 + i % 90, 30 + i % 70); } }
  else { x.fillStyle = o.bg || '#3a3f46'; x.fillRect(0, 0, W, Hh); for (let i = 0; i < 4000; i++) { x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect((i * 131) % W, (i * 71) % Hh, 2, 2); } }
  const pw = 400, ph = 560, p = document.createElement('canvas'); p.width = pw; p.height = ph; const y = p.getContext('2d');
  y.fillStyle = '#fafafa'; y.fillRect(0, 0, pw, ph); y.fillStyle = '#111';
  [[14,14],[pw-44,14],[pw-44,ph-44],[14,ph-44]].forEach(q => y.fillRect(q[0], q[1], 30, 30));          // علامات الأركان
  y.font = 'bold 22px sans-serif'; for (let r = 0; r < 14; r++) y.fillText('0965112157 حلب الفرقان ' + r, 60, 90 + r * 32);
  const Q = o.quad;   // [[x,y]x4] أعلى-يسار، أعلى-يمين، أسفل-يمين، أسفل-يسار
  // تحويلٌ تقريبي بمثلّثين (يكفي لاختبار المنظور)
  function tri(s0, s1, s2, d0, d1, d2) {
    x.save(); x.beginPath(); x.moveTo(d0[0], d0[1]); x.lineTo(d1[0], d1[1]); x.lineTo(d2[0], d2[1]); x.closePath(); x.clip();
    const den = (s0[0]*(s1[1]-s2[1]) + s1[0]*(s2[1]-s0[1]) + s2[0]*(s0[1]-s1[1]));
    const a = (d0[0]*(s1[1]-s2[1]) + d1[0]*(s2[1]-s0[1]) + d2[0]*(s0[1]-s1[1]))/den, b = (d0[0]*(s2[0]-s1[0]) + d1[0]*(s0[0]-s2[0]) + d2[0]*(s1[0]-s0[0]))/den;
    const cc = (d0[0]*(s1[0]*s2[1]-s2[0]*s1[1]) + d1[0]*(s2[0]*s0[1]-s0[0]*s2[1]) + d2[0]*(s0[0]*s1[1]-s1[0]*s0[1]))/den;
    const d = (d0[1]*(s1[1]-s2[1]) + d1[1]*(s2[1]-s0[1]) + d2[1]*(s0[1]-s1[1]))/den, e = (d0[1]*(s2[0]-s1[0]) + d1[1]*(s0[0]-s2[0]) + d2[1]*(s1[0]-s0[0]))/den;
    const f = (d0[1]*(s1[0]*s2[1]-s2[0]*s1[1]) + d1[1]*(s2[0]*s0[1]-s0[0]*s2[1]) + d2[1]*(s0[0]*s1[1]-s1[0]*s0[1]))/den;
    x.setTransform(a, d, b, e, cc, f); x.drawImage(p, 0, 0); x.restore();
  }
  const S = [[0,0],[pw,0],[pw,ph],[0,ph]];
  tri(S[0], S[1], S[2], Q[0], Q[1], Q[2]); tri(S[0], S[2], S[3], Q[0], Q[2], Q[3]);
  if (o.shadow) { const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = g; x.fillRect(0, 0, W, Hh); }
  if (o.dark) { x.fillStyle = 'rgba(0,0,0,' + o.dark + ')'; x.fillRect(0, 0, W, Hh); }
  if (o.blur) { const c2 = document.createElement('canvas'); c2.width = W; c2.height = Hh; const x2 = c2.getContext('2d'); x2.filter = 'blur(' + o.blur + 'px)'; x2.drawImage(c, 0, 0); return c2; }
  return c;
};
window.__inkCorners = function (cv) {   // هل في كل ركنٍ من النتيجة حبرٌ أسود (علامة الركن)؟
  const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data, bw = Math.round(w * .2), bh = Math.round(h * .2);
  return [[0,0],[w-bw,0],[w-bw,h-bh],[0,h-bh]].map(([x0,y0]) => { let n = 0; for (let y = y0; y < y0 + bh; y += 2) for (let x = x0; x < x0 + bw; x += 2) { const i = (y*w+x)*4; if (d[i] + d[i+1] + d[i+2] < 180) n++; } return n > 20; });
};`;

(async () => {
  await H.seed();
  console.log('— مستندات اصطناعية (منطق الماسح)');
  {
    const { browser, pg, errs } = await H.open('orders.html', { w: 1366, h: 900, wait: 3000, init: H.ADMIN_INIT + SYNTH });
    const CASES = [
      ['مائلة بشدّة', { quad: [[330, 90], [900, 180], [820, 830], [240, 700]] }],
      ['إضاءة ضعيفة', { quad: [[380, 120], [820, 140], [800, 800], [360, 780]], dark: 0.55 }],
      ['ظلّ على نصفها', { quad: [[380, 120], [820, 140], [800, 800], [360, 780]], shadow: 1 }],
      ['خلفية مزدحمة', { quad: [[380, 120], [820, 140], [800, 800], [360, 780]], busy: 1 }],
      ['ضبابية', { quad: [[380, 120], [820, 140], [800, 800], [360, 780]], blur: 2.5 }],
      ['تملأ الإطار', { quad: [[-5, -5], [1205, -5], [1205, 905], [-5, 905]] }],
    ];
    for (const [name, o] of CASES) {
      const r = await pg.evaluate(o => {
        const c = __synth(o), img = c;   // drawImage يقبل الكانفس
        img.naturalWidth = c.width; img.naturalHeight = c.height;
        const det = GMTDocScan.detectNorm(img, 0), out = GMTDocScan.process(img, det.corners, 0, 'color');
        const want = o.quad.map(p => [Math.max(0, Math.min(1, p[0] / c.width)), Math.max(0, Math.min(1, p[1] / c.height))]);
        const err = det.corners.reduce((m, p, i) => Math.max(m, Math.hypot(p[0] - want[i][0], p[1] - want[i][1])), 0);
        return { ok: det.ok, why: det.why, err: +err.toFixed(3), ink: __inkCorners(out), ow: out.width, oh: out.height };
      }, o);
      ok(r.ink.every(Boolean), `${name}: لم تُقصّ أيّ زاوية من الورقة (علامات الأركان الأربع ظاهرة) ${JSON.stringify(r.ink)}`);
      if (name !== 'تملأ الإطار') ok(r.ok && r.err < 0.05, `${name}: الزوايا اكتُشفت بدقّة (أكبر خطأ ${r.err}) ${r.why || ''}`);
      else ok(r.err < 0.03, `${name}: الصورة كاملة (لا قصّ) — ${r.why || 'ok'}`);
    }
    // أبيض وأسود + تدوير
    const bw = await pg.evaluate(() => { const c = __synth({ quad: [[380, 120], [820, 140], [800, 800], [360, 780]] }); c.naturalWidth = c.width; c.naturalHeight = c.height;
      const det = GMTDocScan.detectNorm(c, 0), out = GMTDocScan.process(c, det.corners, 0, 'bw'), d = out.getContext('2d').getImageData(0, 0, out.width, out.height).data;
      let mid = 0; for (let i = 0; i < d.length; i += 16) if (d[i] > 30 && d[i] < 225) mid++;
      const r90 = GMTDocScan.process(c, GMTDocScan.detectNorm(c, 90).corners, 90, 'color');
      return { mid, ink: __inkCorners(out), portrait: out.height > out.width, rot: r90.width > r90.height }; });
    ok(bw.mid === 0 && bw.ink.every(Boolean), 'أبيض وأسود: بكسلات سوداء/بيضاء فقط والأركان محفوظة');
    ok(bw.portrait && bw.rot, 'التدوير ٩٠° يقلب اتجاه النتيجة');
    ok(!errs.filter(e => !/status of (400|503)/.test(e)).length, 'لا أخطاء JS');
    // الإيصالان الحقيقيان
    if (fs.existsSync(REAL + 'm01.jpg')) {
      console.log('— إيصالا المالك الحقيقيان');
      for (const f of ['m01', 'm02']) {
        const b64 = fs.readFileSync(REAL + f + '.jpg').toString('base64');
        const r = await pg.evaluate(async (b64) => {
          const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          const img = new Image(); await new Promise(r => { img.onload = r; img.src = URL.createObjectURL(new Blob([u])); });
          const det = GMTDocScan.detectNorm(img, 0), out = GMTDocScan.process(img, det.corners, 0, 'color');
          const area = (q => { let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; })(det.corners);
          return { ok: det.ok, why: det.why, area: +area.toFixed(2), portrait: out.height > out.width };
        }, b64);
        if (f === 'm01') ok(r.area > 0.95, 'm01 (الورقة تملأ الصورة وأسفلها مظلّل): لا قصّ — ' + (r.why || 'كاملة') + ' · مساحة ' + r.area);
        else ok(r.ok && r.area > 0.55 && r.area < 0.9 && r.portrait, 'm02 (مدوّرة على خلفية داكنة): اكتُشفت الورقة وقُصّت — مساحة ' + r.area);
      }
    } else console.log('  (الإيصالان الحقيقيان غير موجودين على هذا الجهاز — تخطٍّ)');
    await browser.close();
  }

  // نافذة الشحن كاملة على الهاتف والكمبيوتر
  const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون المسح', phone: '0933000301', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'حمص', shipping_company: 'المفتي' }]);
  const synthFile = '/tmp/gmt-synth-receipt.png';
  for (const [w, h] of [[390, 844], [1366, 800]]) {
    console.log(`— نافذة الشحن ${w}×${h}`);
    const { browser, pg, errs } = await H.open('orders.html', { w, h, wait: 4500, init: H.ADMIN_INIT + SYNTH });
    if (!fs.existsSync(synthFile)) {
      const png = await pg.evaluate(() => __synth({ quad: [[330, 90], [900, 180], [820, 830], [240, 700]] }).toDataURL('image/png'));
      fs.writeFileSync(synthFile, Buffer.from(png.split(',')[1], 'base64'));
    }
    await pg.evaluate(id => openShipModal(id), o1.id); await pg.waitForTimeout(400);
    await pg.setInputFiles('#ship-img-input', synthFile);
    await pg.waitForSelector('#gds', { timeout: 8000 }).catch(() => {});
    const ui = await pg.evaluate(() => { const g = document.getElementById('gds'); if (!g) return null; const r = g.getBoundingClientRect(); const bs = [...g.querySelectorAll('.gds-bar button')]; return { full: r.width >= innerWidth - 1 && r.height >= innerHeight - 1, btns: bs.map(b => b.textContent.trim()), fit: bs.every(b => { const q = b.getBoundingClientRect(); return q.right <= innerWidth + 1 && q.left >= -1 && q.bottom <= innerHeight + 1; }), handles: g.querySelectorAll('.gds-h').length }; });
    ok(ui && ui.full && ui.handles === 4, 'الماسح يُفتح ملء الشاشة بأربع زوايا قابلة للسحب');
    ok(ui && ui.fit, 'كل الأزرار داخل الشاشة: ' + (ui ? ui.btns.join(' · ') : ''));
    await pg.waitForFunction(() => document.querySelectorAll('#gds .gds-bar svg').length > 0, null, { timeout: 4000 }).catch(() => {});
    const bigIcon = await pg.evaluate(() => Math.max(0, ...[...document.querySelectorAll('#gds .gds-bar svg')].map(s => s.getBoundingClientRect().width)));
    ok(bigIcon > 0 && bigIcon < 40, 'أيقونات الأزرار بحجمها الطبيعي (لا تتضخّم فوق الماسح): ' + Math.round(bigIcon) + 'px');
    // سحب زاوية يدوياً
    const before = await pg.evaluate(() => document.querySelector('#gds .gds-h').style.left);
    const hb = await pg.$('#gds .gds-h'); const bb = await hb.boundingBox();
    await pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.mouse.down(); await pg.mouse.move(bb.x + 30, bb.y + 25, { steps: 4 }); await pg.mouse.up();
    ok(await pg.evaluate(b => document.querySelector('#gds .gds-h').style.left !== b, before), 'سحب الزاوية يدوياً يحرّكها');
    await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /الصفحة كاملة/.test(b.textContent)).click());
    await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /اكتشاف تلقائي/.test(b.textContent)).click());
    await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /قصّ وتحسين/.test(b.textContent)).click());
    await pg.waitForFunction(() => [...document.querySelectorAll('#gds .gds-bar button')].some(b => /اعتماد/.test(b.textContent)), null, { timeout: 15000 }).catch(() => {});
    await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /قارن/.test(b.textContent)).click());
    ok(await pg.evaluate(() => /الأصل/.test(document.getElementById('gds-sub').textContent)), 'زرّ «قارن بالأصل» يعرض الأصل');
    await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /الممسوحة/.test(b.textContent)).click());
    await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /اعتماد/.test(b.textContent)).click());
    await pg.waitForFunction(() => !document.getElementById('gds'), null, { timeout: 8000 }).catch(() => {});
    const st = await pg.evaluate(() => ({ prev: document.getElementById('ship-img-preview').innerText, scan: !!_shipScan, origSize: _shipScan && _shipScan.original.size, scanType: _shipScan && _shipScan.scanned.type }));
    ok(st.scan && /مُسح ضوئياً — الأصل محفوظ/.test(st.prev), 'المعاينة: «مُسح ضوئياً — الأصل محفوظ»');
    ok(st.origSize === fs.statSync(synthFile).size && st.scanType === 'image/jpeg', 'الأصل محفوظ كما هو (نفس الحجم) والممسوحة JPEG');
    if (w === 390) {
      await pg.fill('#ship-tracking', '5500991');
      await pg.evaluate(() => confirmShipping()); await pg.waitForTimeout(3000);
      for (let i = 0; i < 4 && await pg.evaluate(() => !!document.querySelector('.gmtask-ov')); i++) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
      const db = (await H.call('/rest/v1/gmt_orders?id=eq.' + o1.id, undefined, 'GET'))[0];
      ok(db.status === 'shipped' && /^data:image\/jpeg/.test(db.receipt_img || ''), 'اعتماد الشحن حفظ النسخة الممسوحة على الأوردر');
    } else {
      // إلغاء الماسح ⇒ الصورة كما هي
      await pg.evaluate(id => openShipModal(id), o1.id); await pg.waitForTimeout(300);
      await pg.setInputFiles('#ship-img-input', synthFile);
      await pg.waitForSelector('#gds', { timeout: 8000 }).catch(() => {});
      await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /إلغاء/.test(b.textContent)).click());
      await pg.waitForTimeout(400);
      const c = await pg.evaluate(() => ({ scan: !!_shipScan, prev: document.getElementById('ship-img-preview').innerText }));
      ok(!c.scan && /تم اختيار الصورة/.test(c.prev), 'إلغاء الماسح ⇒ تُستعمل الصورة كما هي');
    }
    const own = errs.filter(e => !/status of (400|503)/.test(e));
    ok(!own.length, 'لا أخطاء JS ' + own.join(' | '));
    await browser.close();
  }
  console.log(fails ? `FAIL=${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
