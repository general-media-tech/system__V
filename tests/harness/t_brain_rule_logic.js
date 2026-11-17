// (OWN-06#7) تعليمات العقل: ما دُرّب عليه/وُثّق في مركز المعرفة ليس مرجعاً إن كان غير منطقي — القاعدة تصل للوسيط في system
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
(async () => {
  await H.seed();
  const o = await H.open('home.html', { init: H.ADMIN_INIT, w: 390, h: 800, wait: 3500 });
  let sys = '';
  await o.pg.route(/functions\/v1\/gmt-brain/, async r => { try { sys += JSON.parse(r.request().postData() || '{}').system || ''; } catch (_) {} await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ answer: 'تمام' }) }); });
  await o.pg.evaluate(() => { localStorage.setItem('gmt_brain_endpoint', 'https://ysawzwtmodkqqbqoiojj.supabase.co/functions/v1/gmt-brain'); });
  console.log(String(await o.pg.evaluate(() => GMTBrain.ask('ما رأيك بجودة قهوة الصباح عند الزبائن وكيف نحسّن تجربتها بالتفصيل').catch(e => 'ERR ' + e))).slice(0, 200));
  ok(/ليس مرجعاً مطلقاً/.test(sys) && /غير منطقي/.test(sys), 'قاعدة «لا مرجع غير منطقي» ضمن system المُرسَل للوسيط (طول ' + sys.length + ')');
  await o.browser.close();
  console.log(fails ? `FAIL ${fails} / ${pass + fails}` : `ALL PASS (${pass})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
