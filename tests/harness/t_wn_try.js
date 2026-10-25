// (كل ما بعد 58 يُعلَّم مُجرَّباً — منذ TASK-0170 كل بندٍ له نقطة تلقائياً · والموظّف «داخل التطبيق» gmt_tab_seen كي لا يُحوَّل لنقطة بيعه — TASK-0030) كي يبقى بند 58 الذي يختبره هذا الملفّ في البطاقة — البطاقة تعرض عدداً محدوداً)
// «شو الجديد» التفاعلي: بطاقة الرئيسية · نقاط الروابط · «جرّبها» يوصل للميزة · الضغط يطفئ العلامة · زرّ الهاتف ظاهر
const { open, seed } = require('./h.js');
const INIT = (seenV, staff) => `try{ localStorage.setItem('gmt_whatsnew_seen','${seenV}'); if (!localStorage.getItem('gmt_wn_tried')) { var _t = {}; for (var _v = 59; _v < 400; _v++) _t[_v] = 1; localStorage.setItem('gmt_wn_tried', JSON.stringify(_t)); } localStorage.setItem('gmt_intro_seen_build','x');
 localStorage.setItem('gmt_session', JSON.stringify(${staff ? "{id:2,username:'samer',display_name:'سامر',branch_key:'daraa',branch_name:'درعا'}" : "{id:1,username:'t',display_name:'فاحص',branch_key:'haleb',branch_name:'حلب'}"}));
 localStorage.setItem('gmt_branch','${staff ? 'daraa' : 'haleb'}');
 ${staff ? "sessionStorage.removeItem('gmt_admin_mode'); sessionStorage.setItem('gmt_tab_seen','1');" : "sessionStorage.setItem('gmt_admin_mode','1'); localStorage.setItem('gmt_operator_name','فاحص النظام');"} }catch(e){}
 window.print=()=>{}; window.open=()=>null;`;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
(async () => {
  await seed();
  for (const [w, staff] of [[390, false], [1366, false], [390, true]]) {
    console.log(`— home ${w} ${staff ? 'staff' : 'admin'}`);
    const { browser, pg, errs } = await open('home.html', { init: INIT(999, staff), w, mobile: w < 700, wait: 6000 });
    const r = await pg.evaluate(() => {
      const c = document.getElementById('wn-home'); const fab = document.getElementById('gmt-wn-fab');
      const vis = el => { if (!el) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).display !== 'none'; };
      const dots = [...document.querySelectorAll('a .gwn-dot,[data-tool] > .gwn-dot')].map(d => d.parentElement.getAttribute('data-tool') || d.parentElement.getAttribute('href'));
      return { card: vis(c), cardTxt: c ? c.innerText.slice(0, 300) : '', tries: c ? c.querySelectorAll('[data-wn-try]').length : 0, fab: vis(fab), badge: fab && fab.querySelector('[data-n]').textContent, dots: [...new Set(dots)], untried: GMTWhatsNew.untried(), y: c ? Math.round(c.getBoundingClientRect().y) : -1 };
    });
    ok(r.card, 'البطاقة ظاهرة أعلى الرئيسية (y=' + r.y + ')');
    ok(r.y >= 0 && r.y < 400, 'البطاقة في أعلى الشاشة الأولى');
    ok(r.tries >= 2, 'فيها أزرار «جرّبها» (' + r.tries + ')');
    ok(r.fab, 'زرّ شو الجديد ظاهر بالشريط');
    ok(r.badge === String(r.untried.length), 'العدّاد على الزرّ = ما لم تجرّبه (' + r.badge + ')');
    ok(r.dots.includes('orders.html') || r.dots.some(x => /orders/.test(x)), 'نقطة حمراء على رابط الأوردرات · ' + r.dots.join(','));
    await pg.screenshot({ path: `wnt_home_${w}${staff ? '_s' : ''}.png`, fullPage: false });
    if (w === 390 && !staff) {
      // «جرّبها» للتحقق من الشحنة ⇒ الأوردرات + الهدف مؤطّر + شريط الإرشاد
      await pg.click('#wn-home [data-wn-try="58"]');
      await pg.waitForURL(/orders\.html\?wn=58/, { timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(6000);
      const o = await pg.evaluate(() => {
        const t = document.querySelector('[onclick="openMuftiSite()"]');
        return { url: location.href.split('/').pop(), coach: !!document.getElementById('gwn-coach'), outlined: t && t.classList.contains('gwn-target'), dot: !!(t && t.querySelector(':scope > .gwn-dot.gwn-pulse')), coachTxt: (document.getElementById('gwn-coach') || {}).innerText };
      });
      ok(/orders\.html\?wn=58/.test(decodeURIComponent(o.url)), 'وصل للأوردرات ' + o.url);
      ok(o.coach, 'شريط الإرشاد ظاهر: ' + (o.coachTxt || '').slice(0, 80));
      ok(o.outlined && o.dot, 'الزرّ مؤطّر وعليه نقطة نابضة');
      await pg.screenshot({ path: 'wnt_orders_arrive.png' });
      await pg.evaluate(() => { const t = document.querySelector('[onclick="openMuftiSite()"]'); t.click(); });
      await pg.waitForTimeout(800);
      const a = await pg.evaluate(() => ({ un: GMTWhatsNew.untried(), dot: !!document.querySelector('[onclick="openMuftiSite()"] > .gwn-dot') }));
      ok(!a.un.includes(58) && !a.dot, 'ضغط الميزة نفسها أطفأ علامتها (الباقي: ' + a.un.join(',') + ')');
      await pg.goto(pg.url().replace(/orders\.html.*/, 'home.html'));
      await pg.waitForTimeout(5000);
      const h = await pg.evaluate(() => ({ t58: !!document.querySelector('#wn-home [data-wn-try="58"]'), dots: [...document.querySelectorAll('a .gwn-dot')].map(d => d.parentElement.getAttribute('data-tool')) }));
      ok(!h.dots.includes('orders.html'), 'نقطة الأوردرات اختفت من الرئيسية');
      // «✓ جرّبتها» من النافذة
      await pg.evaluate(() => GMTWhatsNew.open());
      await pg.waitForTimeout(500);
      const btn = await pg.$('#gmt-wn-ov [data-wn-done="57"]');
      ok(!!btn, 'النافذة فيها «✓ جرّبتها» للبند 57');
      if (btn) { await btn.click(); await pg.waitForTimeout(600); }
      const z = await pg.evaluate(() => ({ un: GMTWhatsNew.untried(), calm: !!document.querySelector('#wn-home.gwn-calm') }));
      ok(!z.un.includes(57) && !z.un.includes(58), 'البندان المُجرَّبان (57 · 58) لم يعودا «لم تجرّبه» · الباقي: ' + z.un.join(','));
      await pg.evaluate(() => { const o = document.getElementById('gmt-wn-ov'); if (o) o.remove(); });
      await pg.screenshot({ path: 'wnt_home_after.png' });
    }
    const real = errs.filter(e => !/favicon|404|400|Failed to load resource/.test(e));
    ok(real.length === 0, 'لا أخطاء JS ' + real.slice(0, 2).join(' | '));
    await browser.close();
  }
  console.log(`PASS=${pass} FAIL=${fail}`);
})();
