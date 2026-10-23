// (23 ت1 · TASK-0135) المالك (seq 37): «إذا بدّي عدّل يدوياً أحياناً بيكون أحد أطراف الخطوط غير قابل للتعديل أو خارج الإطار فما فيني أمسك
// المقابض». السبب: ارتفاع الصورة كان من ارتفاع الشاشة كلّه فيختفي طرفها السفلي تحت الأزرار، والمقبض على حافّة الصورة يُقصّ نصفه
// (كان مقبضٌ واحد من أربعة قابلاً للإمساك على حدود «الصفحة كاملة»). هنا: على ستّ شاشات × ثلاث نسب صورة، كل ركنٍ على حافّة الصورة
// ظاهرٌ كاملاً وهو العنصر الأعلى عند مركزه، ويُسحب فعلاً بالإصبع/الفأرة إلى الداخل · والصورة كلّها داخل مساحتها.
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; } else { fails++; console.log('  ✘', m); } };
(async () => {
  for (const [w, h] of [[390, 844], [360, 640], [412, 915], [768, 1024], [1366, 768], [844, 390]]) {
    const mobile = w < 700, { browser, pg, errs } = await H.open('scanner.html', { w, h, wait: 1500, mobile });
    for (const [name, W, Hh] of [['طوليّة', 1200, 1600], ['عرضيّة', 1600, 1000], ['طويلة', 900, 2000]]) {
      await pg.evaluate(([W, Hh]) => { const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d'); x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, W, Hh); return new Promise(r => c.toBlob(b => { window.__out = undefined; GMTDocScan.open(new File([b], 'a.jpg', { type: 'image/jpeg' }), {}).then(v => window.__out = v); r(); }, 'image/jpeg')); }, [W, Hh]);
      await pg.waitForFunction(() => { const m = document.querySelector('#gds .gds-msg'); return m && m.textContent && !/جارٍ اكتشاف/.test(m.textContent); }, null, { timeout: 10000 });
      await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-bar button')].find(b => /الصفحة كاملة/.test(b.textContent)).click());
      await pg.waitForTimeout(200);
      const lay = await pg.evaluate(() => {
        const st = document.querySelector('#gds .gds-stage').getBoundingClientRect(), cv = document.querySelector('#gds canvas.gds-img').getBoundingClientRect();
        return { inside: cv.top >= st.top - 1 && cv.bottom <= st.bottom + 1 && cv.left >= st.left - 1 && cv.right <= st.right + 1,
          hs: [...document.querySelectorAll('#gds .gds-h')].map(hd => { const b = hd.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, t = document.elementFromPoint(cx, cy);
            return { top: t === hd, full: b.left >= st.left && b.right <= st.right && b.top >= st.top && b.bottom <= st.bottom, cx, cy }; }) };
      });
      ok(lay.inside, `${w}×${h} ${name}: الصورة كلّها داخل مساحتها`);
      ok(lay.hs.length === 4 && lay.hs.every(x => x.top && x.full), `${w}×${h} ${name}: المقابض الأربعة ظاهرةٌ كاملةً وفي المتناول ${JSON.stringify(lay.hs.map(x => [x.top, x.full]))}`);
      /* اسحب كل ركنٍ ٣٠ بكسل نحو المركز ⇒ تحرّك */
      const before = await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-h')].map(hd => hd.style.left + ',' + hd.style.top));
      for (let i = 0; i < 4; i++) {
        const hb = lay.hs[i], dx = i === 0 || i === 3 ? 30 : -30, dy = i < 2 ? 30 : -30;
        await pg.mouse.move(hb.cx, hb.cy); await pg.mouse.down(); await pg.mouse.move(hb.cx + dx, hb.cy + dy, { steps: 4 }); await pg.mouse.up(); await pg.waitForTimeout(40);
      }
      const after = await pg.evaluate(() => [...document.querySelectorAll('#gds .gds-h')].map(hd => hd.style.left + ',' + hd.style.top));
      ok(after.every((v, i) => v !== before[i]), `${w}×${h} ${name}: كل ركنٍ على حافّة الصورة يُسحب`);
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
    }
    ok(!errs.filter(e => !/Failed to load resource/.test(e)).length, `${w}×${h}: لا أخطاء ${errs.join(' | ')}`);
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
