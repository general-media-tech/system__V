/* (TASK-B0420 · docs/دراسة_الإشعارات_الفورية.md المهمّة ٢) منطق الصياغة والتجميع — JS نقيّ بلا Deno ولا Node APIs
   يُستعمل في Edge Functions (push-subscribe · push-dispatch) ويُختبَر في tests/harness/t_push_logic.js. لا أسرار هنا. */
export const ALLOWED_HOSTS = ['fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com'];

export function validEndpoint(url) {
  try {
    if (typeof url !== 'string' || url.length > 1000) return false;
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.indexOf(h) !== -1 || h.endsWith('.notify.windows.com') || h.endsWith('.push.apple.com');
  } catch (_) { return false; }
}

/* الحقول المسموحة فقط في data لكلّ نوع — حماية ثانية بعد الـTrigger (لا اسم زبون ولا رقمه ولا أسعار جملة ولا مبالغ) */
export const SAFE_FIELDS = {
  order: ['num', 'qty'], offer: ['name', 'price', 'bundle', 'until'], price: ['pid', 'name', 'barcode', 'old', 'new', 'until'],
  transfer: ['num', 'from'], version: ['v'], transfer_aging: ['n', 'oldest'], expense: ['branch']
};
export function scrub(kind, data) {
  const ok = SAFE_FIELDS[kind] || [], out = {};
  Object.keys(data || {}).forEach((k) => { if (ok.indexOf(k) !== -1) out[k] = data[k]; });
  return out;
}

/* التجميع: مفتاح kind|branch_key|topic (السعر: الفرع دائماً null) */
export function groupEvents(rows) {
  const g = {};
  (rows || []).forEach((r) => {
    const bk = r.kind === 'price' ? '' : (r.branch_key || '');
    const key = r.kind + '|' + bk + '|' + (r.topic || 'pos');
    (g[key] = g[key] || { kind: r.kind, branch_key: bk || null, topic: r.topic || 'pos', rows: [] }).rows.push(r);
  });
  return Object.keys(g).map((k) => g[k]);
}

const dd = (iso) => { try { const d = new Date(iso); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0'); } catch (_) { return ''; } };
const money = (n) => { const v = Number(n); return isFinite(v) ? (Math.round(v * 100) / 100).toString() : ''; };
const TTL = { order: 86400, transfer: 172800, offer: 86400, price: 43200, version: 21600, transfer_aging: 43200, expense: 43200 };
const URG = { order: 'high', transfer: 'high', offer: 'normal', price: 'normal', version: 'low', transfer_aging: 'normal', expense: 'normal' };

/* topic ≤ 32 حرفاً base64url-آمنة */
export function topicOf(kind, branch) { return (kind + '-' + (branch || 'all')).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32); }

export function buildMessage(kind, items, opts) {
  opts = opts || {}; const n = (items || []).length, d = (items && items[0] && (items[0].data || items[0])) || {};
  let t = '', b = '', u = './home.html';
  if (kind === 'order') {
    t = '🛒 أوردر جديد من المتجر';
    b = n > 1 ? n + ' أوردرات جديدة بانتظار التجهيز' : 'طلب رقم ' + (d.num || '') + (d.qty ? ' · ' + d.qty + ' قطعة' : '') + ' — اضغط لفتحه';
    u = n === 1 && opts.ref_id ? 'orders.html?order=' + opts.ref_id : 'orders.html';
    if (opts.pos) u = 'pos.html?go=orders';
  } else if (kind === 'offer') {
    const bundle = !!d.bundle;
    t = n > 1 ? '🎁 عروض وباقات جديدة' : (bundle ? '📦 باقة جديدة' : '🎁 عرض جديد');
    b = n > 1 ? n + ' عروض وباقات جديدة في نقطة البيع' : '«' + (d.name || '') + '»' + (d.price ? ' بـ ' + money(d.price) + '$' : '') + (d.until ? ' · حتى ' + dd(d.until) : '');
    u = 'pos.html?go=offers';
  } else if (kind === 'price') {
    t = n > 1 ? '💲 تغيّرت الأسعار' : '💲 تغيّر سعر «' + (d.name || '') + '»';
    b = n > 1 ? 'تغيّرت أسعار ' + n + ' منتجاً — حُدّثت في نقطة البيع'
      : (d.until ? 'تخفيض مؤقّت حتى ' + dd(d.until) + ': ' + money(d.new) + '$' : money(d.old) + '$ ← ' + money(d.new) + '$');
    u = n === 1 && d.barcode ? 'pos.html?go=prices&q=' + encodeURIComponent(d.barcode) : 'pos.html?go=prices';
  } else if (kind === 'transfer') {
    t = '📦 فاتورة نقل واردة';
    b = n > 1 ? n + ' فواتير نقل بانتظار استلامك' : (d.num || '') + (d.from ? ' من ' + d.from : '') + ' — بانتظار استلامك';
    u = 'pos.html?go=incoming';
  } else if (kind === 'version') {
    t = '🔄 تحديث جديد للنظام'; b = 'افتح التطبيق ليُطبَّق آخر تحديث'; u = 'home.html';
  } else if (kind === 'transfer_aging') {
    t = '⏰ فواتير نقل لم تُستلم'; b = (d.n || n) + ' فاتورة معلّقة منذ أكثر من يوم' + (d.oldest ? ' — أقدمها ' + d.oldest : ''); u = 'pos.html?go=incoming';
  } else if (kind === 'expense') {
    t = '💸 مصروف بانتظار موافقتك'; b = d.branch ? 'من فرع ' + d.branch : 'بانتظار موافقتك'; u = 'admin_pos.html';
  }
  return { t, b, u, k: kind, tag: kind + (opts.branch ? '-' + opts.branch : ''), urgency: URG[kind] || 'normal', ttl: TTL[kind] || 43200, topic: topicOf(kind, opts.branch) };
}

/* الساعة في دمشق عبر Intl (لا إزاحة ثابتة) */
function damascusParts(date) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Damascus', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = f.formatToParts(date), h = Number(p.find((x) => x.type === 'hour').value) % 24, m = Number(p.find((x) => x.type === 'minute').value);
  return { h, m };
}
export function isQuiet(date, prefs) {
  const { h } = damascusParts(date || new Date());
  return h >= 23 || h < 8;
}
/* 08:30 دمشق التالية */
export function nextMorning(date) {
  const d = new Date(date || Date.now()), { h, m } = damascusParts(d);
  let mins = (8 * 60 + 30) - (h * 60 + m); if (mins <= 0) mins += 24 * 60;
  return new Date(d.getTime() + mins * 60000);
}
export const wants = (sub, kind) => !(sub && sub.prefs && sub.prefs[kind] === false);
export const isHigh = (kind) => kind === 'order' || kind === 'transfer';
