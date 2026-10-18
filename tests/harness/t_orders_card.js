// (18 ت1 · لقطة المالك ٢) بطاقة «بانتظار التحصيل»: «تم التحصيل» و«الحوالة» كبيران بسطرٍ واحد · ⋮ فيها التحقق ومراسلة فرع الوجهة وعرض الإيصال
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const rows = await H.call('/rest/v1/gmt_orders', [
    { name: 'شاهين در ه', phone: '0933250051', product: 'Canon Package Offer R', qty: 1, price: 1004, status: 'delivered', branch: 'حلب', address: 'دمشق — فكتوريا', shipping_company: 'المفتي', tracking_number: '202470', shipped_at: '2026-10-16T08:40:58Z', receipt_img: 'data:image/png;base64,iVBORw0KGgo=' },
    { name: 'زبون مسارات', phone: '0933111333', product: 'كاميرا', qty: 1, price: 100, status: 'delivered', branch: 'حلب', address: 'حمص', shipping_company: 'مسارات', tracking_number: '555123' }]);
  for (const w of [390, 360, 1366]) {
    console.log('— ' + w);
    const { browser, pg, errs } = await H.open('orders.html', { w, mobile: w < 700, init: H.ADMIN_INIT + ' window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return {};}; window.__calls=[];' });
    await pg.evaluate(() => { try { switchTab('delivered'); } catch (_) {} });
    await pg.waitForTimeout(800);
    const r = await pg.evaluate((id) => {
      const card = document.getElementById('card-' + id); if (!card) return null;
      const btns = [...card.querySelectorAll('button')];
      const col = btns.find(b => /تم التحصيل/.test(b.textContent)), haw = btns.find(b => /الحوالة/.test(b.textContent));
      const box = b => b ? b.getBoundingClientRect() : null;
      return { col: box(col) && { w: Math.round(box(col).width), h: Math.round(box(col).height) }, haw: box(haw) && { w: Math.round(box(haw).width), h: Math.round(box(haw).height) },
               more: !!btns.find(b => /openCardMore/.test(b.getAttribute('onclick') || '')),
               office: !!btns.find(b => /contactShipOffice/.test(b.getAttribute('onclick') || '')), receipt: !!btns.find(b => /viewReceipt/.test(b.getAttribute('onclick') || '')),
               hs: document.documentElement.scrollWidth > innerWidth + 2 };
    }, rows[0].id);
    ok(r && r.col && r.col.h <= 56 && r.col.w >= 120, '«تم التحصيل» كبير بسطرٍ واحد ' + JSON.stringify(r && r.col));
    ok(r && r.haw && r.haw.h <= 56 && r.haw.w >= 120, '«الحوالة» كبير بسطرٍ واحد ' + JSON.stringify(r && r.haw));
    ok(r && r.more && !r.office && !r.receipt, 'مراسلة فرع الوجهة وعرض الإيصال انتقلا إلى ⋮');
    ok(r && !r.hs, 'لا طفح أفقي');
    await pg.evaluate((id) => openCardMore(id), rows[0].id);
    await pg.waitForTimeout(300);
    const m = await pg.evaluate(() => [...document.querySelectorAll('#card-more-ov [data-i]')].map(b => b.textContent.trim() + (b.disabled ? ' (معطّل)' : '')));
    ok(m.some(t => /التحقق من الشحنة/.test(t)) && m.some(t => /فرع الوجهة/.test(t)) && m.some(t => /إيصال/.test(t)), 'القائمة ⋮: ' + m.join(' | '));
    await pg.evaluate(() => { window.contactShipOffice = (id) => window.__calls.push('office:' + id); });
    await pg.evaluate(() => { const b = [...document.querySelectorAll('#card-more-ov [data-i]')].find(b => /فرع الوجهة/.test(b.textContent)); b.click(); });
    const calls = await pg.evaluate(() => ({ c: window.__calls, ov: !!document.getElementById('card-more-ov') }));
    ok(calls.c.includes('office:' + rows[0].id) && !calls.ov, 'خيار «مراسلة فرع الوجهة» نفّذ ما في الزرّ القديم وأُغلقت القائمة');
    const r2 = await pg.evaluate((id) => { const card = document.getElementById('card-' + id); return card ? { haw: /الحوالة/.test(card.innerText), col: /تم التحصيل/.test(card.innerText) } : null; }, rows[1].id);
    ok(r2 && r2.col && !r2.haw, 'أوردر غير المفتي: «تم التحصيل» بلا «الحوالة»');
    if (w === 390) await pg.screenshot({ path: '/tmp/claude-0/-home-user-system--V/dfe65fb9-bcc1-5e5a-be94-906828e1c021/scratchpad/harness/card_delivered_390.png', fullPage: true });
    const real = errs.filter(e => !/404|400|favicon|Failed to load/.test(e));
    ok(real.length === 0, 'لا أخطاء JS ' + real.slice(0, 2).join(' | '));
    await browser.close();
  }
  console.log(`PASS=${pass} FAIL=${fails}`);
})();
