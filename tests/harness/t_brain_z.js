const H = require('./h.js');
(async () => {
  await H.seed();
  const { browser, pg, errs } = await H.open('home.html', { init: H.ADMIN_INIT, w: 390, h: 800, wait: 3500 });
  await pg.evaluate(() => { try { localStorage.removeItem('gmt_brain_endpoint'); } catch (e) {} });
  await pg.evaluate(() => window.GMTBrain.open());
  await pg.waitForSelector('#gmt-brain-panel');
  // اسأل سؤالاً لا يُجاب محلياً ⇒ not-configured ⇒ زر «أدخل رابط الوسيط»
  await pg.fill('#gmt-brain-panel input', 'اشرح لي طريقة عمل العمولة بالتفصيل الكامل مع الأمثلة');
  await pg.click('#gb-send');
  await pg.waitForSelector('#gb-cfg', { timeout: 8000 }).catch(() => {});
  const has = await pg.$('#gb-cfg');
  console.log('زر «أدخل رابط الوسيط» ظهر؟', !!has);
  if (has) {
    await pg.click('#gb-cfg');
    await pg.waitForTimeout(600);
    const r = await pg.evaluate(() => {
      const ov = [...document.querySelectorAll('body *')].filter(e => e.id !== 'gmt-brain-panel' && getComputedStyle(e).position === 'fixed' && /رابط وسيط/.test(e.textContent || '') && e.textContent.length < 800);
      const inp = document.querySelector('[class*=gmt-ask] input, .gmt-ask-input, input[type=text]:not(#gmt-brain-panel input)') || [...document.querySelectorAll('input')].filter(i => i.closest('#gmt-brain-panel') == null).pop();
      const askOv = ov[0];
      const z = e => e ? getComputedStyle(e).zIndex : null;
      let top = null, vis = null;
      if (askOv) {
        const b = askOv.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2;
        const el = document.elementFromPoint(x, y); top = el ? (el.closest('#gmt-brain-panel') ? 'نافذة العقل (فوق)' : 'نافذة الإدخال (فوق)') : null;
      }
      return { askOverlayFound: !!askOv, askZ: z(askOv), brainZ: z(document.getElementById('gmt-brain-panel')), whoIsOnTop: top };
    });
    console.log(JSON.stringify(r));
    await pg.screenshot({ path: '/tmp/gmt-out/brain_z_before.png' });
  }
  console.log('errors:', errs.slice(0, 3));
  await browser.close();
})();
