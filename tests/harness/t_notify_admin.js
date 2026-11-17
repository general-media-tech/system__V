// (TASK-B0424 · المرحلة ٤) لوحة إدارة الإشعارات: للإدارة فقط · الإحصائيات · تعديل قاعدة نوع (تشغيل/مستوى/مستلمون/مجموعة/نافذة) · أعضاء المجموعات
const H = require('./h.js');
let fails = 0, pass = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (c) pass++; else fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const S = { rules: [{ kind: 'sale', label: 'مبيعات جديدة', enabled: true, priority: 1, to_admin: true, to_branch: false, groups: [], popup: false, mandatory: false },
  { kind: 'version', label: 'تحديث النظام', enabled: true, priority: 1, to_admin: true, to_branch: true, groups: [], popup: false, mandatory: true }],
  groups: [{ key: 'accounting', name: 'المحاسبة', members: [] }], patches: [] };
async function routes(ctx) {
  const send = (r, o) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
  await ctx.route('**/rest/v1/rpc/gmt_notify_stats**', r => send(r, { days: 7, events: 12, sent: 10, pending: 1, skipped: 1, failed: 0, pushes: 9, avg_delay_s: 31, inbox: 20, unread: 4, read: 16, acted: 2, devices_push: 3, devices_inbox: 2, by_kind: { sale: 8, version: 4 }, by_recipient: { admin: { all: 12, unread: 3 } } }));
  await ctx.route('**/rest/v1/gmt_notify_rules**', r => {
    const m = r.request().method(); if (m === 'GET') return send(r, S.rules);
    const k = decodeURIComponent((r.request().url().match(/kind=eq\.([^&]+)/) || [])[1] || ''); const b = JSON.parse(r.request().postData() || '{}'); S.patches.push([k, b]);
    const x = S.rules.find(y => y.kind === k); Object.assign(x, b); return send(r, [x]);
  });
  await ctx.route('**/rest/v1/gmt_notify_groups**', r => {
    if (r.request().method() === 'GET') return send(r, S.groups);
    const b = JSON.parse(r.request().postData() || '{}'); Object.assign(S.groups[0], b); return send(r, [S.groups[0]]);
  });
}
(async () => {
  await H.seed();
  // ① موظّف: مقفلة
  let o = await H.open('إدارة_الإشعارات.html', { init: H.STAFF_INIT + ';window.__noAdmin=1', wait: 2500 });
  await o.pg.evaluate(() => { if (window.GMTRole) GMTRole.requireAdmin = async () => false; });
  await o.pg.reload(); await sleep(400); await o.pg.evaluate(() => { if (window.GMTRole) GMTRole.requireAdmin = async () => false; }); await sleep(2500);
  const lk = await o.pg.evaluate(() => ({ app: !document.getElementById('app').hidden, lock: document.getElementById('lock').innerText }));
  ok(!lk.app, 'الموظّف لا يرى اللوحة (للإدارة فقط)');
  await o.browser.close();
  // ② الأدمن
  o = await H.open('إدارة_الإشعارات.html', { init: H.ADMIN_INIT, wait: 2000 });
  await routes(o.ctx); await o.pg.reload(); await sleep(3000);
  const k = await o.pg.evaluate(() => ({ app: !document.getElementById('app').hidden, kpis: document.getElementById('kpis').innerText, kind: document.getElementById('by-kind').innerText, rc: document.getElementById('by-rcpt').innerText }));
  ok(k.app && /12/.test(k.kpis) && /31 ث/.test(k.kpis), 'الإحصائيات: الأحداث ومتوسط زمن الإرسال: ' + k.kpis.replace(/\s+/g, ' ').slice(0, 80));
  ok(/مبيعات جديدة/.test(k.kind) && /الإدارة/.test(k.rc), 'حسب النوع (بالاسم العربي) وحسب المستلم');
  await o.pg.click('.tab[data-t="rules"]'); await sleep(300);
  const man = await o.pg.evaluate(() => { const r = document.querySelector('.rule[data-k="version"]'); return { dis: r.querySelector('[data-f="enabled"]').disabled, tag: /إلزامي/.test(r.innerText) }; });
  ok(man.dis && man.tag, 'النوع الإلزامي لا يُطفأ ويظهر «إلزامي»');
  await o.pg.evaluate(() => { const r = document.querySelector('.rule[data-k="sale"]'); r.querySelector('[data-f="priority"]').value = '2'; r.querySelector('[data-f="to_branch"]').checked = true; r.querySelector('[data-f="popup"]').checked = true; r.querySelector('[data-g="accounting"]').checked = true; });
  await o.pg.click('.rule[data-k="sale"] [data-save]'); await sleep(800);
  const p = S.patches.find(x => x[0] === 'sale');
  ok(p && p[1].priority === 2 && p[1].to_branch === true && p[1].popup === true && p[1].groups.join() === 'accounting' && p[1].updated_by, 'حفظ القاعدة: المستوى · موظفو الفرع · نافذة إجراء · مجموعة المحاسبة · من عدّل: ' + JSON.stringify(p && p[1]).slice(0, 140));
  ok(/حُفظ/.test(await o.pg.evaluate(() => document.querySelector('.rule[data-k="sale"] [data-ok]').textContent)), 'تأكيد «✓ حُفظ»');
  await o.pg.click('.tab[data-t="groups"]'); await sleep(400);
  const g = await o.pg.evaluate(() => ({ n: document.querySelectorAll('.grp .mem input').length, used: document.querySelector('.grp').innerText }));
  ok(g.n >= 2 && /مبيعات جديدة/.test(g.used), 'المجموعات: الحسابات للاختيار + «تستلم: مبيعات جديدة»');
  await o.pg.evaluate(() => { document.querySelector('.grp .mem input[value="admin"]').checked = true; });
  await o.pg.click('.grp [data-gsave]'); await sleep(700);
  ok(S.groups[0].members.indexOf('admin') !== -1, 'حفظ أعضاء المجموعة');
  const realErr = o.errs.filter(e => !/status of (400|401|404|406|409)|Failed to load resource|vibrate|Estimating/.test(e));
  ok(!realErr.length, 'لا أخطاء JS: ' + realErr.slice(0, 2).join(' | '));
  await o.browser.close();
  console.log(fails ? 'FAIL ' + fails + ' / ' + (pass + fails) : 'ALL PASS (' + pass + ')'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
