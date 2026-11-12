// (المالك seq 618/620 · التدقيق) حارس شبكة للاختبارات: المتصفّح لا يصل لأيّ مضيفٍ خارجي أبداً.
// السبب: طلبات keepalive/beacon عند إغلاق الصفحة (سجلّ المفتّش · القياس · بلاغات المراقب) لا يعترضها ctx.route،
// فكانت اختباراتنا تكتب صفوف تشخيص في القاعدة الحقيقية (ضجيج «المراقب»). الآن كلّ اسمٍ غير محلّي ⇒ NOTFOUND.
const pw = require('/opt/node22/lib/node_modules/playwright');
const RULE = '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost';
// البيئة خلف وسيط (HTTPS_PROXY) ⇒ المتصفّح يحلّ الأسماء عند الوسيط فلا تكفي القاعدة أعلاه: وسيطٌ ميّت لكلّ ما ليس محلّياً (127.0.0.1 يتجاوز الوسيط تلقائياً).
const DEAD_PROXY = '--proxy-server=http://127.0.0.1:9';
if (!pw.chromium.__gmtGuarded) {
  const orig = pw.chromium.launch.bind(pw.chromium);
  pw.chromium.launch = function (opts) {
    opts = Object.assign({}, opts || {});
    opts.args = (opts.args || []).filter(a => !/^--(host-resolver-rules|proxy-server)/.test(a)).concat([RULE, DEAD_PROXY]);
    return orig(opts);
  };
  pw.chromium.__gmtGuarded = true;
}
module.exports = { RULE, DEAD_PROXY };
