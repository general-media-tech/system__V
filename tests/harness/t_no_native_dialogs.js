// (ARC-CODE-1#102) منع prompt() وconfirm() المتصفّح نهائياً: لا استدعاء متبقٍّ في صفحات الواجهة — البديل GMTAsk.confirm / GMTAsk.prompt
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fails++; };
const files = fs.readdirSync(root).filter(f => /\.(html|js)$/.test(f) && f !== 'gmt-ask.js');
for (const d of ['js', 'js/contracts']) { const p = path.join(root, d); if (fs.existsSync(p)) fs.readdirSync(p).filter(f => f.endsWith('.js')).forEach(f => files.push(path.join(d, f))); }
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1').replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
const re = /(^|[^A-Za-z0-9_.$`])(?:window\.)?(prompt|confirm)\s*\(/g;
const bad = [];
for (const f of files) {
  const s = strip(fs.readFileSync(path.join(root, f), 'utf8')); let m;
  while ((m = re.exec(s))) {
    const line = s.slice(0, m.index).split('\n').length, txt = s.split('\n')[line - 1];
    if (/function\s+(prompt|confirm)\b/.test(txt)) continue;
    if (/GMTAsk/.test(txt)) continue;      // احتياطٌ فقط حين لا يُحمَّل GMTAsk (النمط المعتمد: GMTAsk ? GMTAsk.confirm : …)
    bad.push(f + ':' + line + '  ' + txt.trim().slice(0, 90));
  }
}
ok(files.length > 50, 'فُحص ' + files.length + ' ملفاً');
ok(!bad.length, 'لا prompt()/confirm() أصلية متبقّية' + (bad.length ? '\n    ' + bad.join('\n    ') : ''));
console.log(fails ? 'FAIL ' + fails : 'ALL PASS'); process.exit(fails ? 1 : 0);
