// (22 ت1 · TASK-0119) المالك: «هذه النافذة معلّقة وما بتتحرّك لحتى أعطيه إرسال» — صورة الإيصال الممسوحة كانت بلا حدّ ارتفاع
// (الصنف max-h-48 غير موجود في lib/tailwind.css المبنيّ مسبقاً) والنافذة مثبّتة في الوسط بلا تمرير ⇒ زرّ الإرسال خارج الشاشة.
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const [o1] = await H.call('/rest/v1/gmt_orders', [{ name: 'زبون نافذة', phone: '0933000410', product: 'كاميرا', qty: 1, price: 100, status: 'pending', branch: 'حلب', address: 'دمشق', shipping_company: 'المفتي' }]);
  for (const [w, h] of [[390, 844], [360, 640], [1366, 768]]) {
    const { browser, pg, errs } = await H.open('orders.html', { w, h, wait: 4000 });
    await pg.evaluate(id => openShipModal(id), o1.id); await pg.waitForTimeout(400);
    // صورة إيصالٍ طويلة (مدوّرة كما في لقطة المالك) عبر مسار الماسح نفسه — الماسح مُستبدَل بنتيجةٍ جاهزة
    await pg.evaluate(async () => {
      const cv = document.createElement('canvas'); cv.width = 1100; cv.height = 2000; const c = cv.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, 1100, 2000); c.fillStyle = '#333'; for (let y = 60; y < 2000; y += 90) c.fillRect(80, y, 900, 18);
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
      window.GMTReceipt = Object.assign({}, window.GMTReceipt, { readMufti: () => new Promise(() => {}) });   // القراءة «جارية» طوال الاختبار
      GMTDocScan.open = async () => ({ scanned: blob, mode: 'color' });
      await shipScanFile(new File([blob], 'r.jpg', { type: 'image/jpeg' }));
      await new Promise(r => setTimeout(r, 400));
    });
    const m = await pg.evaluate(() => {
      const img = document.querySelector('#ship-img-preview img'), modal = document.getElementById('shipModal');
      const btn = [...modal.querySelectorAll('button')].find(b => /confirmShipping/.test(b.getAttribute('onclick') || ''));
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const title = document.getElementById('ship-title'); title.scrollIntoView({ block: 'center' }); const t = title.getBoundingClientRect();
      return { imgH: Math.round(img.getBoundingClientRect().height), reading: _shipReading, btnIn: r.top >= 0 && r.bottom <= innerHeight, hitOk: !!hit && (hit === btn || btn.contains(hit)), titleIn: t.top >= 0 && t.bottom <= innerHeight };
    });
    ok(m.imgH > 0 && m.imgH <= 200, `${w}×${h}: صورة الإيصال محدودة الارتفاع (${m.imgH}px ≤ 200)`);
    ok(m.reading && m.btnIn && m.hitOk, `${w}×${h}: زرّ «اعتماد الشحن» يُوصَل إليه ويُضغط والقراءة ما زالت جارية`);
    ok(m.titleIn, `${w}×${h}: أعلى النافذة (العنوان) يُوصَل إليه أيضاً`);
    const real = errs.filter(e => !/status of (400|503)/.test(e)); ok(!real.length, `${w}×${h}: لا أخطاء JS ` + real.slice(0, 2).join(' / '));
    await browser.close();
  }
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})();
