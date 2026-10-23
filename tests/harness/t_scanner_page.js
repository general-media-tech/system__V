// (23 ت1 · TASK-0131) صفحة «الماسح الضوئي» (scanner.html) بالتفاعل الحقيقي: عدّة صور ⇒ الماسح لكلٍّ (واحدةٌ تُلغى) ⇒ ترتيب (↑↓ وسحب)
// ⇒ تعديلٌ بالحدود السابقة ⇒ حذف وتراجع ⇒ تدوير ⇒ PDF (عالي · مضغوط · A4/بحجم الصورة · كلمة سرّ) ⇒ صور ⇒ استخراج النصّ محلّياً
// (مستندٌ مصوَّر بنصٍّ عربي وإنجليزي) بلا أيّ طلبٍ خارجي ⇒ الهاتف.
const H = require('./h.js'); const fs = require('fs');
const S = '/tmp/gmt-out/'; fs.mkdirSync(S, { recursive: true });
let fails = 0, passes = 0;
const ok = (c, m, extra) => { if (c) { passes++; console.log('  ✔', m, extra !== undefined ? JSON.stringify(extra) : ''); } else { fails++; console.log('  ✘', m, extra !== undefined ? JSON.stringify(extra) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const btn = (pg, t) => pg.evaluate(t => { const strip = x => x.replace(/[^\p{L}\p{N}+−\s«»]/gu, '').trim(), T = strip(t), bs = [...document.querySelectorAll('#gds button')].filter(b => b.offsetParent);
  const b = bs.find(b => strip(b.textContent) === T) || bs.find(b => strip(b.textContent).includes(T)); if (!b) throw new Error('no button ' + t); b.click(); }, t);
async function scanOne(pg, action = 'ok') {
  await pg.waitForSelector('#gds', { timeout: 10000 });
  await pg.waitForFunction(() => { const m = document.querySelector('#gds .gds-msg'); return m && m.textContent && !/جارٍ اكتشاف/.test(m.textContent); }, null, { timeout: 15000 });
  const info = await pg.evaluate(() => ({ title: document.querySelector('#gds .gds-top').textContent, msg: document.querySelector('#gds .gds-msg').textContent, n: document.querySelectorAll('#gds .gds-h').length }));
  if (action === 'cancel') { await btn(pg, 'إلغاء'); await pg.waitForFunction(() => !document.getElementById('gds') || !document.querySelector('#gds .gds-top').textContent.includes('(2 من'), null, { timeout: 5000 }); return info; }
  await btn(pg, 'قصّ وتحسين');
  await pg.waitForFunction(() => [...document.querySelectorAll('#gds button')].some(b => /اعتماد/.test(b.textContent)), null, { timeout: 20000 });
  await btn(pg, 'اعتماد');
  await sleep(300);
  return info;
}
const order = pg => pg.evaluate(() => [...document.querySelectorAll('#pages .pg')].map(e => +e.getAttribute('data-id')));
const pgBtn = (pg, i, label) => pg.evaluate(([i, label]) => { const b = document.querySelectorAll('#pages .pg')[i].querySelector('button[aria-label="' + label + '"]'); if (!b) throw new Error('no ' + label); b.click(); }, [i, label]);

(async () => {
  // صورٌ للاختبار (مُصطنعة): مستقيم · مائل على خشب · منحنٍ
  const gen = await H.open('orders.html', { w: 800, h: 800, wait: 1500, mobile: false });
  await gen.pg.addScriptTag({ content: fs.readFileSync('/home/user/system__V/tests/harness/docscan_gen.js', 'utf8') });
  const specs = [{ bg: 'wood', quad: [[.18, .12], [.84, .16], [.80, .86], [.14, .82]] }, { bg: 'dark', curve: 0.035, quad: [[.15, .12], [.85, .12], [.85, .88], [.15, .88]] }];
  const files = [];
  for (let i = 0; i < specs.length; i++) {
    const d = await gen.pg.evaluate(sp => __mkCase(sp, __thermal(false)).cv.toDataURL('image/jpeg', 0.9), specs[i]);
    const f = S + 'sc_' + i + '.jpg'; fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); files.push(f);
  }
  await gen.browser.close();
  files.splice(1, 0, S + 'sc_0.jpg');                                            // الثانية تُلغى في الاختبار

  console.log('١) كمبيوتر: ثلاث صور ⇒ الماسح لكلٍّ (الثانية تُلغى)');
  let { browser, pg, errs } = await H.open('scanner.html', { w: 1366, h: 900, wait: 2500, mobile: false });
  ok(await pg.evaluate(() => !!window.GMTDocScan && document.getElementById('b-pdf').disabled && !document.getElementById('empty').hidden), 'الصفحة جاهزة: الماسح محمَّل · التصدير معطّل بلا صفحات');
  await pg.setInputFiles('#in-pick', files);
  const i1 = await scanOne(pg); ok(/صفحة 1 \(1 من 3\)/.test(i1.title), 'الماسح يُفتح للأولى', i1.title.trim());
  const i2 = await scanOne(pg, 'cancel'); ok(/2 من 3/.test(i2.title), 'الثانية تُلغى', i2.title.trim());
  const i3 = await scanOne(pg); ok(/3 من 3/.test(i3.title) && i3.n > 4, 'الثالثة (منحنية) بأكثر من ٤ نقاط', [i3.title.trim(), i3.n]);
  await sleep(300);
  let o = await order(pg); ok(o.length === 2, 'صفحتان (الملغاة لم تُضف)', o);
  const tags = await pg.evaluate(() => [...document.querySelectorAll('#pages .tag')].map(t => t.textContent));
  ok(/نقطة/.test(tags[1]), 'بطاقة الصفحة المنحنية تذكر عدد النقاط', tags);
  ok(await pg.evaluate(() => !document.getElementById('b-pdf').disabled), 'التصدير مفعّل');

  console.log('٢) ترتيب · تعديل بالحدود السابقة · حذف وتراجع');
  await pgBtn(pg, 0, 'نقل للخلف'); let o2 = await order(pg); ok(o2[0] === o[1] && o2[1] === o[0], '↓ يبدّل الترتيب', o2);
  /* سحبٌ وإفلات (كمبيوتر) */
  await pg.locator('#pages .pg').nth(1).dragTo(pg.locator('#pages .pg').nth(0)); await sleep(150); let o3 = await order(pg); ok(o3[0] === o[0], 'السحب والإفلات يرتّب', o3);
  const before = await pg.evaluate(() => window.__scanner.pages[1].res.poly && window.__scanner.pages[1].res.poly.length);
  await pgBtn(pg, 1, 'تعديل الحدود والنمط');
  await pg.waitForSelector('#gds'); await sleep(250);
  const ed = await pg.evaluate(() => ({ msg: document.querySelector('#gds .gds-msg').textContent, n: document.querySelectorAll('#gds .gds-h').length }));
  ok(/حدودك السابقة/.test(ed.msg) && ed.n === before, 'التعديل يفتح بالحدود السابقة نفسها (لا اكتشاف جديد)', [ed.msg.slice(0, 30), ed.n, before]);
  await btn(pg, 'قصّ وتحسين'); await pg.waitForFunction(() => [...document.querySelectorAll('#gds button')].some(b => /اعتماد/.test(b.textContent)), null, { timeout: 15000 });
  await btn(pg, 'أبيض وأسود'); await sleep(500); await btn(pg, 'اعتماد'); await sleep(300);
  ok(await pg.evaluate(() => window.__scanner.pages[1].res.mode === 'bw'), 'تعديل النمط يُحفظ للصفحة');
  await pgBtn(pg, 0, 'حذف الصفحة'); ok((await order(pg)).length === 1, 'حذف ⇒ صفحة واحدة');
  await pg.evaluate(() => document.querySelector('#toast button').click()); await sleep(100);
  ok(JSON.stringify(await order(pg)) === JSON.stringify(o3), 'تراجع ⇒ الصفحة في موضعها', await order(pg));
  await pgBtn(pg, 0, 'تدوير ٩٠°'); await sleep(400);
  const rot = await pg.evaluate(() => { const p = window.__scanner.pages[0]; return { w: p.w, h: p.h, r: p.res.rotation }; });
  ok(rot.r === 90, 'تدوير الصفحة', rot);
  for (let k = 0; k < 3; k++) { await pgBtn(pg, 0, 'تدوير ٩٠°'); await sleep(400); }
  const rot4 = await pg.evaluate(() => { const p = window.__scanner.pages[0]; return { w: p.w, h: p.h, r: p.res.rotation }; });
  ok(rot4.r === 0 && rot4.w === rot.h && rot4.h === rot.w, 'أربع تدويرات ⇒ الاتّجاه الأصلي', rot4);

  console.log('٣) التصدير');
  for (const [q, ps, pw] of [['hi', 'a4', ''], ['lo', 'a4', ''], ['hi', 'img', ''], ['lo', 'a4', 'سرّ123']]) {
    const r = await pg.evaluate(async ([q, ps, pw]) => {
      document.getElementById('q').value = q; document.getElementById('psize').value = ps; document.getElementById('pw').value = pw;
      const f = await window.__scanner.makePdf(), t = new TextDecoder('latin1').decode(new Uint8Array(await f.arrayBuffer()));
      return { name: f.name, size: f.size, head: t.slice(0, 5), pages: (t.match(/\/Type \/Page\b/g) || []).length, enc: /\/Encrypt/.test(t), msg: document.getElementById('expmsg').textContent };
    }, [q, ps, pw]);
    ok(r.head === '%PDF-' && r.pages === 2 && r.enc === !!pw, `PDF ${q}/${ps}${pw ? '/كلمة سرّ' : ''}: صفحتان · ${(r.size / 1024).toFixed(0)}ك.ب`, r.msg);
    if (q === 'hi' && ps === 'a4') globalThis.hiSize = r.size; if (q === 'lo' && !pw) ok(r.size < globalThis.hiSize * 0.7, 'المضغوط أصغر بوضوح', [r.size, globalThis.hiSize]);
  }
  const dl = pg.waitForEvent('download', { timeout: 15000 }); await pg.click('#b-pdf'); const d = await dl;
  ok(/\.pdf$/.test(d.suggestedFilename()), 'زرّ «تصدير PDF» ينزّل الملف', d.suggestedFilename());
  const dz = pg.waitForEvent('download', { timeout: 15000 }); await pg.click('#b-zip'); const z = await dz;
  ok(/\.zip$/.test(z.suggestedFilename()), 'تنزيل الصور (ZIP)', z.suggestedFilename());

  ok(!errs.filter(e => !/Failed to load resource/.test(e)).length, 'لا أخطاء في الصفحة', errs);
  await browser.close();

  console.log('٤) استخراج النصّ محلّياً (مستندٌ مصوَّر بنصٍّ عربي وإنجليزي مائلٍ على خلفيّة داكنة)');
  ({ browser, pg, errs } = await H.open('scanner.html', { w: 1366, h: 900, wait: 2500, mobile: false }));
  const docImg = await pg.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1500; c.height = 2000; const x = c.getContext('2d');
    x.fillStyle = '#3a2f28'; x.fillRect(0, 0, c.width, c.height);
    x.save(); x.translate(750, 1000); x.rotate(-0.06); x.fillStyle = '#f4f1ea'; x.fillRect(-560, -760, 1120, 1520);
    x.fillStyle = '#111'; x.textBaseline = 'top';
    const L = [['900 64px "DejaVu Sans"', 'فاتورة مبيع', 'right'], ['52px "DejaVu Sans"', 'شركة الإعلام العامة', 'right'], ['52px "DejaVu Sans"', 'General Media Tech', 'left'],
      ['48px "DejaVu Sans"', 'Invoice 2026-1048 Total 150000', 'left'], ['48px "DejaVu Sans"', 'رقم الهاتف 0933123456', 'right'], ['48px "DejaVu Sans"', 'Canon EOS 2000D Camera', 'left']];
    L.forEach((l, i) => { x.font = l[0]; x.textAlign = l[2]; x.direction = l[2] === 'right' ? 'rtl' : 'ltr'; x.fillText(l[1], l[2] === 'right' ? 480 : -480, -640 + i * 150); });
    x.restore(); return c.toDataURL('image/jpeg', 0.92);
  });
  fs.writeFileSync(S + 'sc_doc.jpg', Buffer.from(docImg.split(',')[1], 'base64'));
  await pg.setInputFiles('#in-pick', S + 'sc_doc.jpg'); const di = await scanOne(pg); ok(/اكتُشفت/.test(di.msg), 'المستند المصوَّر: اكتُشفت حدوده', di.msg.slice(0, 40));
  const t0 = Date.now(); await pg.click('#b-ocr');
  await pg.waitForFunction(() => /✅|❌/.test(document.getElementById('ocrmsg').textContent), null, { timeout: 180000 });
  const ocr = await pg.evaluate(() => ({ msg: document.getElementById('ocrmsg').textContent, txt: document.getElementById('txt').value }));
  const want = ['فاتورة', 'General', 'Media', 'Invoice', '150000', '0933123456', 'Canon'], got = want.filter(w => ocr.txt.includes(w));
  ok(/✅/.test(ocr.msg) && got.length >= 6, 'النصّ المستخرج: ' + got.length + '/' + want.length + ' كلمات · ' + ((Date.now() - t0) / 1000).toFixed(1) + 'ث', ocr.txt.replace(/\s+/g, ' ').slice(0, 160));
  const ext = await pg.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(u => !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u) && !/^(data|blob):/.test(u)));
  ok(!ext.filter(u => !/supabase|fonts\./.test(u)).length, 'لا طلب لأيّ خدمة خارجيّة أثناء المسح والتصدير والتعرّف', ext.slice(0, 5));
  ok(!errs.filter(e => !/Failed to load resource/.test(e)).length, 'لا أخطاء في الصفحة', errs);
  await browser.close();

  console.log('٥) هاتف');
  ({ browser, pg, errs } = await H.open('scanner.html', { w: 390, h: 800, wait: 2500 }));
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'لا تمرير أفقي');
  await pg.setInputFiles('#in-cam', files[2]); const im = await scanOne(pg); ok(im.n > 4, 'الماسح على الهاتف (منحنية)', im.n);
  await sleep(300);
  ok(await pg.evaluate(() => document.querySelectorAll('#pages .pg').length === 1 && document.documentElement.scrollWidth <= innerWidth + 1), 'صفحة واحدة · بلا تمرير أفقي');
  const r = await pg.evaluate(async () => { const f = await window.__scanner.makePdf(); return f.size; }); ok(r > 10000, 'PDF على الهاتف', r);
  ok(!errs.filter(e => !/Failed to load resource/.test(e)).length, 'لا أخطاء في الصفحة', errs);
  await browser.close();
  console.log(fails ? `FAIL ${fails} / ${passes + fails}` : `ALL PASS (${passes})`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
