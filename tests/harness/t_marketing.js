// (TASK-B0424 · المرحلتان ٧–٨ · seq 816) «ابقَ على اطلاع» (موافقة لكل نوع · إلغاء) + الحملات في لوحة الإدارة + عدّاد الضغطات
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STUB = `(function(){ const mkSub=()=>({endpoint:'https://fcm.googleapis.com/fcm/send/MK',toJSON(){return{endpoint:this.endpoint,keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}}}}); window.__sub=sessionStorage.getItem('__sub')?mkSub():null;
  window.Notification=function(){}; Notification.permission='default'; Notification.requestPermission=async()=>(Notification.permission='granted');
  window.PushManager=function(){};
  const reg={ pushManager:{ getSubscription:async()=>window.__sub, subscribe:async()=>{sessionStorage.setItem('__sub','1');return (window.__sub=mkSub());} } };
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve(reg),register:async()=>reg,getRegistration:async()=>reg,getRegistrations:async()=>[reg],controller:null,addEventListener(){} }});
})();`;
const S = { calls: [], topics: [], camps: [{ id: 9, title: '🎁 عرض جديد', body: 'باقة R6', topics: ['offers'], channels: ['push', 'telegram'], scheduled_at: new Date().toISOString(), status: 'scheduled', source: 'auto', stats: {}, clicks: 0 },
  { id: 8, title: 'تخفيضات', body: '', topics: [], channels: ['push'], scheduled_at: new Date().toISOString(), status: 'sent', stats: { push: { targets: 5, sent: 4, failed: 1 }, telegram: { ok: false, why: 'chat not found' } }, clicks: 3 }] };
async function route(ctx) {
  await ctx.route('**/functions/v1/marketing**', r => {
    const b = JSON.parse(r.request().postData() || '{}'); S.calls.push(b);
    const send = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
    if (b.action === 'key') return send({ ok: true, key: 'B'.repeat(87) });
    if (b.action === 'channel') return send({ ok: true, link: 'https://t.me/gmt_test' });
    if (b.action === 'sub_set') { S.topics = b.topics; return send({ ok: true, topics: b.topics }); }
    if (b.action === 'sub_get') return send({ ok: true, topics: S.topics });
    if (b.action === 'sub_off') { S.topics = []; return send({ ok: true }); }
    if (b.action === 'camp_list') return send({ ok: true, items: S.camps, subscribers: 7, byTopic: { offers: 5, canon: 2 }, channel: '', auto: true, bot: true });
    if (b.action === 'camp_save') return send({ ok: true, item: { id: 10 } });
    if (b.action === 'camp_cancel') { S.camps[0].status = 'cancelled'; return send({ ok: true }); }
    return send({ ok: true });
  });
}
(async () => {
  await H.seed();
  let o = await H.open('ابق_على_اطلاع.html', { init: STUB, wait: 1500 });
  await route(o.ctx); await o.pg.reload(); await sleep(1500);
  const tg = await o.pg.evaluate(() => ({ n: document.querySelectorAll('#opts input').length, tg: !document.getElementById('tg').hidden }));
  ok(tg.n === 7 && tg.tg, 'الصفحة: 7 أنواع للاختيار + رابط قناة تيليغرام');
  await o.pg.click('#b-save'); await sleep(400);
  ok(/اختر نوعاً/.test(await o.pg.evaluate(() => document.getElementById('msg').textContent)), 'بلا اختيار ⇒ لا اشتراك (الموافقة صريحة لكل نوع)');
  await o.pg.check('#opts input[value="offers"]'); await o.pg.check('#opts input[value="canon"]'); await o.pg.click('#b-save'); await sleep(1200);
  const set = S.calls.filter(c => c.action === 'sub_set').pop();
  ok(set && set.topics.join() === 'offers,canon' && /fcm/.test(set.sub.endpoint), 'الاشتراك بالنوعين المختارين فقط: ' + (set && set.topics));
  await o.pg.reload(); await sleep(1800);
  const kept = await o.pg.evaluate(() => [...document.querySelectorAll('#opts input:checked')].map(x => x.value).join());
  ok(kept === 'offers,canon', 'إعادة فتح الصفحة تعرض الاختيارات المحفوظة: ' + kept);
  await o.pg.click('#b-off'); await sleep(800);
  ok(S.calls.some(c => c.action === 'sub_off') && !(await o.pg.evaluate(() => document.querySelectorAll('#opts input:checked').length)), 'إلغاء الاشتراك من كل شيء بضغطة');
  const re = o.errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|Estimating/.test(e)); ok(!re.length, 'لا أخطاء JS في صفحة الاشتراك: ' + re.slice(0, 2).join(' | '));
  await o.browser.close();
  // ② الحملات في لوحة الإدارة
  o = await H.open('إدارة_الإشعارات.html', { init: H.ADMIN_INIT + ";localStorage.setItem('gmt_inbox_token','" + 'e'.repeat(64) + "')", wait: 2000 });
  await route(o.ctx);
  await o.ctx.route('**/rest/v1/rpc/gmt_notify_stats**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await o.pg.reload(); await sleep(2500);
  await o.pg.click('.tab[data-t="camps"]'); await sleep(1200);
  const l = await o.pg.evaluate(() => ({ subs: document.getElementById('mk-subs').textContent, list: document.getElementById('mk-list').innerText, auto: document.getElementById('mk-auto').checked }));
  ok(/المشتركون: 7/.test(l.subs) && /العروض 5/.test(l.subs) && l.auto, 'عدد المشتركين لكل نوع + النشر التلقائي مفعّل: ' + l.subs);
  ok(/4\/5/.test(l.list) && /chat not found/.test(l.list) && /تلقائية/.test(l.list), 'سجلّ الحملات: وصل 4/5 · سبب فشل تيليغرام · الحملة التلقائية');
  await o.pg.fill('#mk-title', '🎁 عرض نهاية الأسبوع'); await o.pg.fill('#mk-body', 'خصم على العدسات'); await o.pg.check('#mk-topics input[value="offers"]'); await o.pg.check('#mk-ch-tg');
  await o.pg.evaluate(() => { GMTAsk.confirm = async () => true; }); await o.pg.click('#mk-send'); await sleep(900);
  const sv = S.calls.filter(c => c.action === 'camp_save').pop();
  ok(sv && sv.title === '🎁 عرض نهاية الأسبوع' && sv.topics.join() === 'offers' && sv.channels.join() === 'push,telegram' && sv.status === 'scheduled' && sv.token === 'e'.repeat(64), 'إنشاء حملة: العنوان · الجمهور · القناتان · برمز جهاز الأدمن');
  await o.pg.click('[data-cancel="9"]'); await sleep(900);
  ok(S.calls.some(c => c.action === 'camp_cancel' && c.id === 9), 'إلغاء حملة مجدولة قبل موعدها');
  await o.browser.close();
  // ③ عدّاد الضغطات في المتجر
  o = await H.open('site.html', { wait: 1500 }); await route(o.ctx);
  await o.pg.goto(H.BASE + 'site.html?gmt_c=8'); await sleep(2500);
  ok(S.calls.some(c => c.action === 'click' && String(c.c) === '8'), 'فتح الموقع من إشعار حملة ⇒ تُحسب الضغطة لرقم الحملة فقط');
  await o.browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
