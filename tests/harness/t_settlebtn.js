const H = require('./h.js');
const OUT = __dirname + '/';
const ok = (c, m) => console.log((c ? '✔ ' : '✘ ') + m);
(async () => {
  await H.seed();
  const tr = await H.call('/rest/v1/branch_stock_transfers', [{ transfer_number: 'TRF-00004', from_branch: 'haleb', to_branch: 'daraa', from_branch_name: 'حلب', to_branch_name: 'درعا', status: 'needs_settlement', settled: false, created_at: '2026-10-01T00:00:00Z' }]);
  await H.call('/rest/v1/stock_transfer_items', [{ transfer_id: tr[0].id, product_name: 'كاميرا تجربة 0', qty: 0, requested_qty: 4, deduction_failed: true }]);
  for (const [w, h, mob] of [[390, 844, true], [1366, 900, false]]) {
    const { browser, pg, errs } = await H.open('inventory.html', { init: H.ADMIN_INIT, w, h, wait: 7000, mobile: mob });
    await pg.evaluate(() => { if (typeof switchAppMode === 'function') switchAppMode('transfer'); });
    await pg.waitForTimeout(1500);
    const btn = pg.locator('button[onclick="stOpenSettlements()"]').first();
    console.log(w, 'button count', await pg.locator('button[onclick="stOpenSettlements()"]').count(), 'visible', await btn.isVisible());
    await pg.screenshot({ path: OUT + `sb_${w}_0.png` });
    try { await btn.click({ timeout: 4000 }); } catch (e) { console.log('click failed:', e.message.split('\n')[0]); }
    await pg.waitForTimeout(1800);
    const st = await pg.evaluate(() => {
      const o = document.getElementById('st-settle-ov'); if (!o) return { exists: false };
      const r = o.getBoundingClientRect(); const cs = getComputedStyle(o);
      let hid = null; for (let p = o.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') { hid = (p.id || p.className || p.tagName) + ':' + s.display; break; } }
      const x = innerWidth / 2, y = innerHeight / 2; const top = document.elementFromPoint(x, y);
      return { exists: true, display: cs.display, rect: [Math.round(r.width), Math.round(r.height)], hiddenAncestor: hid, topIsInside: !!(top && o.contains(top)), topTag: top && (top.id || top.className || top.tagName), bodyTxt: (document.getElementById('st-settle-body') || {}).innerText && document.getElementById('st-settle-body').innerText.slice(0, 80) };
    });
    console.log(w, JSON.stringify(st));
    ok(st.exists && st.topIsInside && !st.hiddenAncestor && st.rect[0] > 0, w + ': لوحة التسوية تظهر فعلاً أمام المستخدم');
    await pg.screenshot({ path: OUT + `sb_${w}_1.png` });
    console.log('errs', errs.filter(e => !/404|400|Failed|favicon/.test(e)).slice(0, 3));
    await browser.close();
  }
})();
