// harness: يفتح صفحات المشروع الحقيقية في Chromium مقابل قاعدة وهمية محلية (لا يلمس قاعدتك)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const M = 'http://127.0.0.1:' + (process.env.MOCK_PORT || 8197);
const BASE = 'http://127.0.0.1:' + (process.env.BASE_PORT || 8765) + '/';

async function call(path, data, method = 'POST') {
  const r = await fetch(M + path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

async function seed() {
  await call('/__reset', {});
  await call('/__opts', { unique_invoices: true, drop_reply: [], fail_post: [], block_delete: [], reject_cols: [], unique_order_invoice: true, old_rpc_false: false, rls_block: [], no_pos_fn: false, sov: '2003', pos_protected: true, pos_locked: false });
  await call('/rest/v1/inv_columns', [['haleb', 'حلب'], ['daraa', 'درعا']].map(([k, n], i) => ({ key_name: k, display_name: n, col_type: 'number', include_in_total: true, is_branch: true, show_form: true, show_table: true, sort_order: i })));
  const prods = await call('/rest/v1/products', Array.from({ length: 12 }, (_, i) => ({ name: `كاميرا تجربة ${i}`, barcode: `BC${String(i).padStart(4, '0')}`, price: 100 + i, wholesale_price: 80, cost_price: 60, haleb: 6, daraa: 2, group_name: i % 2 ? 'كاميرات' : 'إضاءة', category: 'تصوير' })));
  await call('/rest/v1/gmt_customers', { name: 'زبون سابق', phone: '0999111222', branch_key: 'haleb', branch_name: 'حلب' });
  await call('/rest/v1/gmt_users', [{ username: 'samer', display_name: 'سامر', branch_key: 'daraa', is_active: true, password_hash: 'MTIzNA==' }]);
  await call('/rest/v1/gmt_settings', { key: 'orders_default_ship_from', value: 'حلب|السريان' });   // كالقاعدة الحقيقية (شُغّل 18 ت1): «الفرع الافتراضي لشركة الشحن»
  await call('/rest/v1/gmt_settings', [{ key: 'orders_default_ship_from_qadmous', value: 'حلب|الفرقان' }, { key: 'orders_default_ship_from_masarat', value: 'حلب|الفرقان' }]);   // (TASK-0159 · شُغّل 25 ت1)
  return { prods };
}

const ADMIN_INIT = `try{ localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.setItem('gmt_intro_seen_build','x');
 localStorage.setItem('gmt_session', JSON.stringify({id:1,username:'t',display_name:'فاحص',branch_key:'haleb',branch_name:'حلب'})); localStorage.setItem('gmt_branch','haleb');
 sessionStorage.setItem('gmt_admin_mode','1'); localStorage.setItem('gmt_operator_name','فاحص النظام'); }catch(e){}
 window.print=()=>{}; window.open=()=>null;`;
/* (TASK-0030) gmt_tab_seen: الموظّف «داخل التطبيق» — فتحُ التطبيق من جديد يذهب به إلى نقطة بيعه (يختبره t_users_s_accounts) */
const STAFF_INIT = `try{ localStorage.setItem('gmt_whatsnew_seen','999'); localStorage.setItem('gmt_intro_seen_build','x');
 localStorage.setItem('gmt_session', JSON.stringify({id:2,username:'samer',display_name:'سامر',branch_key:'daraa',branch_name:'درعا'})); localStorage.setItem('gmt_branch','daraa');
 sessionStorage.removeItem('gmt_admin_mode'); sessionStorage.setItem('gmt_tab_seen','1'); }catch(e){}
 window.print=()=>{}; window.open=()=>null;`;

async function open(url, { init = ADMIN_INIT, w = 390, h = 800, wait = 4000, mobile = true } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile && w < 700, hasTouch: mobile && w < 700, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = []; const reqs = [];
  pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
  await ctx.route('**/*.supabase.co/**', async route => {
    const u = route.request().url(); const i = u.indexOf('/rest/v1/');
    if (/\/functions\/v1\/gmt-tg\//.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"relay":"not_configured"}' });   // كالواقع: المرحّل غير مضبوط بعد
    if (i < 0) return route.fulfill({ status: 200, body: '{}' });
    try { const r = await route.fetch({ url: M + u.slice(i) }); await route.fulfill({ response: r }); } catch (e) { try { await route.abort(); } catch (_) {} }
  });
  await ctx.route('https://api.telegram.org/**', r => { reqs.push(r.request().url().slice(0, 80) + ' ' + (r.request().postData() || '').slice(0, 120)); r.fulfill({ status: 200, body: '{"ok":true}' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '', headers: { 'Content-Type': 'text/css' } }));
  await ctx.route(/^https:\/\/(?!127)/, r => { const u = r.request().url(); if (/supabase|telegram|fonts\./.test(u)) return r.fallback(); r.fulfill({ status: 404, body: '' }); });
  await ctx.addInitScript(init);
  await pg.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(wait);
  return { browser, ctx, pg, errs, reqs };
}
module.exports = { open, seed, call, ADMIN_INIT, STAFF_INIT, BASE, M };
