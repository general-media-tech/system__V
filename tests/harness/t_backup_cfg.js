// backup.html: ref مفاتيح القواعد يطابق رابط كل قاعدة + قائمة الجداول موحّدة مع النسخ التلقائي
const H = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const refOf = k => { try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64').toString()).ref; } catch (e) { return null; } };
(async () => {
  await H.seed();
  const o = await H.open('backup.html', { w: 390, h: 900, wait: 3500 });
  const d = await o.pg.evaluate(() => Object.fromEntries(Object.entries(DBS).map(([k, v]) => [k, { url: v.url, key: v.key, tables: v.tables }])));
  for (const k of Object.keys(d)) {
    const host = d[k].url.replace('https://', '').split('.')[0];
    ok(d[k].key && refOf(d[k].key) === host, k + ': ref المفتاح = ' + host);
  }
  for (const t of ['gmt_audit', 'gmt_trash', 'gmt_daily_closes']) ok(d.main.tables.includes(t), 'backup.html يشمل ' + t);
  const src = require('fs').readFileSync(__dirname + '/../../gmt-autobackup.js', 'utf8');
  for (const t of ['gmt_audit', 'gmt_trash', 'gmt_daily_closes']) ok(src.includes("['" + t + "'"), 'النسخ التلقائي يشمل ' + t);
  const auto = [...src.matchAll(/\['([a-z_]+)', /g)].map(m => m[1]);
  ok(auto.every(t => d.main.tables.includes(t)), 'كل جداول النسخ التلقائي موجودة في backup.html');
  await o.browser.close(); console.log(fails ? 'FAILS=' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
