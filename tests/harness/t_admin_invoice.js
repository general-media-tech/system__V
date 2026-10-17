const H = require('./h.js');
(async () => {
  const { prods } = await H.seed();
  const NO_NAME = H.ADMIN_INIT.replace("localStorage.setItem('gmt_operator_name','فاحص النظام');", '');
  const { browser, pg, errs } = await H.open('admin_pos.html?tab=adminInvoice', { init: NO_NAME, w: 1366, h: 820, wait: 4500, mobile: false });
  const p0 = (await H.call('/__dump', undefined, 'GET')).products[0];
  let asked = 0;
  await pg.evaluate(([id, name]) => {
    window.__asked = 0;
    GMTAsk.confirm = async () => true;
    const orig = GMTAsk.prompt; GMTAsk.prompt = async (m) => { window.__asked++; return 'محمد خير'; };
    document.getElementById('ai-branch').value = 'haleb'; document.getElementById('ai-customer').value = 'زبون اختبار';
    window._aiCart = [{ id, name, price: 100, qty: 1 }];
  }, [p0.id, p0.name]);
  // _aiCart معرّف بـ let؟ جرّب مباشرةً
  const ok = await pg.evaluate(async ([id, name]) => { try { _aiCart.length = 0; _aiCart.push({ id, name, price: 100, qty: 1 }); await aiCreateInvoice(); return 'done'; } catch (e) { return 'ERR ' + e.message; } }, [p0.id, p0.name]);
  await pg.waitForTimeout(2500);
  const d = await H.call('/__dump', undefined, 'GET');
  const inv = (d.invoices || []).slice(-1)[0] || {};
  console.log('نتيجة:', ok, '| سألَ عن الاسم:', await pg.evaluate(() => window.__asked), 'مرّة');
  console.log('cashier_name:', inv.cashier_name, '| branch:', inv.branch_name, '| notes:', inv.notes);
  // المرّة الثانية: لا يسأل
  await pg.evaluate(() => { window.__asked = 0; });
  const r2 = await pg.evaluate(async ([id, name]) => { try { _aiCart.length = 0; _aiCart.push({ id, name, price: 50, qty: 1 }); document.getElementById('ai-branch').value = 'haleb'; await aiCreateInvoice(); return 'done'; } catch (e) { return 'ERR ' + e.message; } }, [p0.id, p0.name]); console.log('ثانية:', r2);
  await pg.waitForTimeout(2000);
  console.log('المرّة الثانية — سأل:', await pg.evaluate(() => window.__asked), '| الفواتير:', ((await H.call('/__dump', undefined, 'GET')).invoices || []).map(i => i.cashier_name).join(' | '));
  console.log('errors:', errs.filter(e => !/404|400|Failed/.test(e)).slice(0, 3));
  await browser.close();
})();
