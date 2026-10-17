const H = require('./h.js');
const OUT = __dirname + '/';
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
const visInfo = (pg, sel) => pg.evaluate((sel) => {
  const e = document.querySelector(sel); if (!e) return { exists: false };
  const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
  let hid = null; for (let p = e; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') { hid = (p.id || p.className || p.tagName) + ':' + s.display; break; } }
  const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y);
  return { exists: true, rect: [Math.round(r.width), Math.round(r.height)], hidden: hid, onTop: !!(top && (e === top || e.contains(top) || top.contains(e))), inView: r.top >= 0 && r.bottom <= innerHeight + 2 && r.left >= 0 && r.right <= innerWidth + 2 };
}, sel);
(async () => {
  await H.seed();
  await H.call('/rest/v1/products', [{ name: 'عدسة تجربة', barcode: 'GRP001', price: 100, haleb: 3, group_name: 'عدسات' }]);
  for (const [w, h, mob] of [[390, 844, true], [1366, 900, false]]) {
    const { browser, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT, w, h, wait: 7000, mobile: mob });
    console.log('=====', w);
    // أماكن الدخول لإنشاء مجموعة
    const entries = await pg.evaluate(() => [...document.querySelectorAll('button,a')].filter(b => /مجموعة جديدة|إنشاء مجموعة|المجموعات|إدارة المجموعات/.test((b.textContent || '') + (b.title || '') + (b.getAttribute('onclick') || ''))).map(b => ({ t: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30), oc: (b.getAttribute('onclick') || '').slice(0, 50), id: b.id })));
    console.log(JSON.stringify(entries));
    for (const en of entries) {
      const sel = en.id ? '#' + en.id : `[onclick="${en.oc.replace(/"/g, '\\"')}"]`;
      const v = await visInfo(pg, sel).catch(() => ({}));
      console.log('  ', en.t.padEnd(18), en.oc.padEnd(30), JSON.stringify(v));
    }
    await pg.screenshot({ path: OUT + `grp_${w}_0.png` });
    await browser.close();
  }
})();
