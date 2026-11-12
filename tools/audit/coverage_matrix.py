#!/usr/bin/env python3
"""مصفوفة التغطية (البرومبت الرئيسي §5 · المالك seq 632/636): لكل صفحة — عناصرها التفاعلية (الأزرار/الحقول ذات المعالج)،
الدالّة التي تستدعيها، الجداول/الدوالّ الخادمية التي تقرؤها أو تكتبها، والاختبارات التي تغطّيها.
تُولَّد آلياً من الكود (لا تُكتب باليد):  python3 tools/audit/coverage_matrix.py  ⇒ docs/audit/coverage_matrix.json + docs/audit/مصفوفة_التغطية.md"""
import re, os, glob, json, urllib.parse, collections
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(ROOT)
rd = lambda f: open(f, encoding='utf-8', errors='ignore').read() if os.path.exists(f) else ''
BUILT = set('if for while switch return typeof new this event window document alert confirm prompt console setTimeout clearTimeout history location navigator parseInt parseFloat Number String Boolean JSON Math Date Array Object Promise fetch encodeURIComponent decodeURIComponent requestAnimationFrame open print void function async await var let const true false null undefined else try catch throw isNaN localStorage sessionStorage Event CustomEvent URL scrollTo focus blur'.split())
tests = {os.path.basename(t): rd(t) for t in glob.glob('tests/harness/t_*.js')}
def body_of(code, name):
    m = re.search(r'(?:async\s+)?function\s+' + re.escape(name) + r'\s*\(|(?:window\.)?\b' + re.escape(name) + r'\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)', code)
    if not m: return ''
    i = code.find('{', m.end() - 1)
    if i < 0 or i - m.end() > 300: return code[m.start():m.start() + 400]
    d, j = 0, i
    while j < len(code) and j - i < 60000:
        c = code[j]
        if c == '{': d += 1
        elif c == '}':
            d -= 1
            if d == 0: break
        j += 1
    return code[i:j + 1]
def touches(b):
    r, w, rpc, fn = set(), set(), set(), set()
    for m in re.finditer(r'/rest/v1/(?!rpc)([a-z_0-9]{3,})', b): r.add(m.group(1))
    for m in re.finditer(r'\.from\(\s*[\'"`]([a-z_0-9]{3,})', b): r.add(m.group(1))
    for m in re.finditer(r'\bsb(Post|Patch|Delete|Upsert)\w*\(\s*[\'"`]/?(?:rest/v1/)?([a-z_0-9]{3,})', b): w.add(m.group(2))
    for m in re.finditer(r'sbFetch\(\s*[\'"`](POST|PATCH|DELETE|PUT)[\'"`]\s*,\s*[\'"`]/rest/v1/([a-z_0-9]{3,})', b): w.add(m.group(2))
    for m in re.finditer(r'method:\s*[\'"`](POST|PATCH|DELETE|PUT)[\'"`]', b):
        seg = b[max(0, m.start() - 400):m.start() + 200]
        for t in re.findall(r'/rest/v1/(?!rpc)([a-z_0-9]{3,})', seg): w.add(t)
    for m in re.finditer(r'\.(insert|update|upsert|delete)\(', b):
        seg = b[max(0, m.start() - 200):m.start()]
        for t in re.findall(r'\.from\(\s*[\'"`]([a-z_0-9]{3,})', seg)[-1:]: w.add(t)
    for m in re.finditer(r'/rpc/([a-z_0-9]+)|\.rpc\(\s*[\'"`]([a-z_0-9]+)', b): rpc.add(m.group(1) or m.group(2))
    for m in re.finditer(r'/functions/v1/([a-z0-9-]{4,})', b): fn.add(m.group(1))
    return r, w, rpc, fn
out, summ = {}, []
for page in sorted(glob.glob('*.html')):
    s = rd(page)
    scripts = [urllib.parse.unquote(x).split('?')[0] for x in re.findall(r'<script[^>]+src=["\']([^"\']+)', s) if not x.startswith('http')]
    code = s + '\n' + '\n'.join(rd(x) for x in scripts)
    els = collections.OrderedDict()
    for m in re.finditer(r'<(button|a|input|select|textarea|div|span|label|img|form|li|td|tr)\b([^>]*?)\son(click|change|input|submit|keyup|keydown|blur)=(["\'])(.*?)\4([^>]*)>([^<]{0,60})', s, re.S):
        tag, pre, ev, _, h, post, txt = m.groups()
        fns = [n for n in re.findall(r'(?<![\w.$\'"])([A-Za-z_$][\w$]*)\s*\(', h) if n not in BUILT]
        if not fns: continue
        idm = re.search(r'\bid=["\']([^"\']+)', pre + post); label = re.sub(r'\s+', ' ', txt).strip()[:40] or (re.search(r'(?:title|aria-label|placeholder)=["\']([^"\']+)', pre + post) or [None, ''])[1][:40]
        key = (fns[0], ev)
        e = els.setdefault(key, {'fn': fns[0], 'event': ev, 'tag': tag, 'ids': [], 'labels': [], 'count': 0})
        e['count'] += 1
        if idm and idm.group(1) not in e['ids'] and '${' not in idm.group(1): e['ids'].append(idm.group(1))
        if label and label not in e['labels'] and len(e['labels']) < 3: e['labels'].append(label)
    rows = []
    ptests = sorted(t for t, src in tests.items() if page in urllib.parse.unquote(src))
    for n, e in enumerate(els.values(), 1):
        b = body_of(code, e['fn']); r, w, rpc, fn = touches(b)
        for callee in set(re.findall(r'(?<![\w.$])([A-Za-z_$][\w$]{3,})\s*\(', b)) - BUILT - {e['fn']}:
            cb = body_of(code, callee) if len(b) < 20000 else ''
            if cb and len(cb) < 12000:
                r2, w2, rpc2, fn2 = touches(cb); r |= r2; w |= w2; rpc |= rpc2; fn |= fn2
        ft = sorted(t for t in ptests if re.search(r'\b' + re.escape(e['fn']) + r'\b', tests[t]))
        rows.append({'id': os.path.splitext(page)[0] + '#' + str(n).zfill(3), 'fn': e['fn'], 'event': e['event'], 'tag': e['tag'], 'ids': e['ids'][:3], 'labels': e['labels'], 'uses': e['count'],
                     'defined': bool(b), 'reads': sorted(r - w), 'writes': sorted(w), 'rpc': sorted(rpc), 'edge': sorted(fn),
                     'money': bool((w | r) & {'invoices', 'invoice_items', 'invoice_commissions', 'gmt_settlements', 'gmt_expenses', 'gmt_daily_closes', 'gmt_manual_debts', 'gmt_orders', 'import_log'}),
                     'stock': bool(rpc & {'add_branch_stock', 'deduct_branch_stock'} or (w & {'products', 'stock_moves', 'branch_stock_transfers', 'stock_transfer_items', 'stock_counts', 'stock_receipts'})),
                     'tests_fn': ft, 'status': 'covered' if ft else ('page-tested' if ptests else 'untested')})
    out[page] = {'scripts': scripts, 'tests_page': ptests, 'elements': rows}
    c = collections.Counter(x['status'] for x in rows)
    summ.append((page, len(rows), c['covered'], c['page-tested'], c['untested'], sum(1 for x in rows if x['writes'] or x['rpc']), sum(1 for x in rows if x['money']), sum(1 for x in rows if x['stock']), len(ptests)))
os.makedirs('docs/audit', exist_ok=True)
json.dump(out, open('docs/audit/coverage_matrix.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
T = [sum(x[i] for x in summ) for i in range(1, 9)]
md = ['# مصفوفة التغطية — كل صفحة نظامٌ مستقلّ', '', 'مولَّدة آلياً بـ `tools/audit/coverage_matrix.py` (البرومبت الرئيسي §5 · المالك seq 632/636). التفاصيل لكل عنصر (المعرّف · الدالّة · ما يقرأ/يكتب · الاختبارات) في `coverage_matrix.json`.', '',
      '- **مغطّى** = اختبارٌ لهذه الصفحة يستدعي دالّة العنصر باسمها · **الصفحة مختبَرة** = للصفحة اختبارات لكن لا يذكر أحدها الدالّة · **بلا اختبار** = لا اختبار يفتح الصفحة.', '',
      '| الصفحة | العناصر التفاعلية | مغطّى | الصفحة مختبَرة | بلا اختبار | تكتب في القاعدة | مالية | مخزون | اختبارات الصفحة |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|']
for x in summ: md.append('| `%s` | %d | %d | %d | %d | %d | %d | %d | %d |' % x)
md.append('| **المجموع** | **%d** | **%d** | **%d** | **%d** | **%d** | **%d** | **%d** | — |' % tuple(T[:7]))
md += ['', '## عناصر مالية أو مخزنية لا يذكرها اختبارٌ باسم دالّتها', '', '| المعرّف | الدالّة | النصّ | تكتب | دوالّ خادم |', '|---|---|---|---|---|']
for page, d in out.items():
    for x in d['elements']:
        if (x['money'] or x['stock']) and (x['writes'] or x['rpc']) and not x['tests_fn']:
            md.append('| %s | `%s` | %s | %s | %s |' % (x['id'], x['fn'], (x['labels'] or [''])[0], ' · '.join(x['writes']), ' · '.join(x['rpc'])))
open('docs/audit/مصفوفة_التغطية.md', 'w', encoding='utf-8').write('\n'.join(md) + '\n')
print('pages', len(summ), 'elements', T[0], 'covered', T[1], 'page-tested', T[2], 'untested', T[3], 'writers', T[4], 'money', T[5], 'stock', T[6])
