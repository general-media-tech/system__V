// (TASK-A0508 · المالك seq 752) تفاصيل المنتج في نقطة البيع على الهاتف: تنزلق حتى آخرها · خانة المخزون الصفرية لا تتمدّد.
const H = require('./h.js');
let pass = 0, fails = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fails++; console.log('  ✘', m); } };
(async () => {
  const { prods } = await H.seed();
  const { browser, pg, errs } = await H.open('pos.html', { init: H.STAFF_INIT, w: 390, h: 700, mobile: true, wait: 7000 });
  const r = await pg.evaluate(async (id) => {
    openProductDetail(id); await new Promise(r => setTimeout(r, 1200));
    const body = document.querySelector('#pd-content .pd-body');
    /* محتوى طويل كجدول المواصفات */
    const extra = document.createElement('div'); extra.id = 'pd-long'; extra.style.cssText = 'height:900px'; extra.textContent = 'مواصفات طويلة'; body.appendChild(extra);
    const end = document.createElement('div'); end.id = 'pd-end'; end.textContent = 'آخر سطر'; body.appendChild(end);
    await new Promise(r => setTimeout(r, 200));
    const sheet = document.getElementById('product-detail-sheet').getBoundingClientRect();
    const before = end.getBoundingClientRect().top;
    body.scrollTop = body.scrollHeight; await new Promise(r => setTimeout(r, 200));
    const er = end.getBoundingClientRect();
    return { scrollable: body.scrollHeight > body.clientHeight + 100, moved: body.scrollTop > 100, endVisible: er.bottom <= sheet.bottom + 1 && er.top >= sheet.top, before, sheetBottom: sheet.bottom, sheetH: sheet.height, vh: innerHeight,
      boxes: [...document.querySelectorAll('.pd-stock-box')].map(b => Math.round(b.getBoundingClientRect().height)), vals: [...document.querySelectorAll('.pd-stock-box .sb-val')].map(v => v.className + ':' + Math.round(v.getBoundingClientRect().height)) };
  }, prods[0].id);
  ok(r.scrollable && r.moved, 'جسم التفاصيل ينزلق حين يطول المحتوى (scrollTop تحرّك)');
  ok(r.endVisible, 'آخر سطر يصير ظاهراً داخل الورقة بعد النزول (كان ' + Math.round(r.before) + ' تحت حدّها ' + Math.round(r.sheetBottom) + ')');
  ok(r.sheetH <= r.vh * 0.9, 'الورقة لا تتجاوز 88% من الشاشة: ' + Math.round(r.sheetH) + ' من ' + r.vh);
  ok(r.boxes.length === 3 && r.boxes.every(h => h < 90), 'خانات المخزون بارتفاع طبيعي (لا 200px): ' + JSON.stringify(r.boxes) + ' · ' + JSON.stringify(r.vals));
  const real = errs.filter(x => !/vibrate|favicon|net::ERR|Failed to load resource/i.test(x));
  ok(!real.length, 'بلا أخطاء JS: ' + JSON.stringify(real.slice(0, 2)));
  await browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
