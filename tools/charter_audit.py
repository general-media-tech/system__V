#!/usr/bin/env python3
"""تدقيق الأدوات على «دستور الأداة الجديدة» (الملحق «ح» · seq B1117/B1127) — كاشف آلي تقريبي لكلّ وحدة gmt-*.js جديدة.
الاستعمال: python3 tools/charter_audit.py [--md docs/تدقيق_الأدوات_الجديدة.md]
كلّ عمود = بند من الدستور يُكشف بالنصّ (تقريبي — ✗ يعني «ما لقيته»، لازم يتحقّق بالعين قبل الإصلاح)."""
import os, re, sys, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = ['gmt-suppliers.js', 'gmt-popay.js', 'gmt-porecords.js', 'gmt-poreports.js', 'gmt-poship.js', 'gmt-podocs.js', 'gmt-books.js',
         'gmt-poitem.js', 'gmt-scanrecv.js', 'gmt-carrierstmt.js', 'gmt-custledger.js', 'gmt-quotes.js', 'gmt-serial.js', 'gmt-wclaims.js',
         'gmt-poskit.js', 'gmt-packages.js', 'gmt-oplog.js', 'gmt-reconcile.js']
CHECKS = [
    ('١ رجوع', lambda s: 'data-gmt-modal' in s),
    ('٤ بحث', lambda s: bool(re.search(r'type="search"|placeholder="[^"]*(بحث|ابحث|🔎)', s))),
    ('٣ الأحدث فوق', lambda s: bool(re.search(r'\.reverse\(\)|order=[a-z_]*\.desc|-\s*new Date\(a|b\.[a-z_]*(date|_at)[^;]{0,40}-\s*a\.|localeCompare\(a', s))),
    ('١١ طباعة', lambda s: bool(re.search(r'\.print\(\)|🖨', s))),
    ('١١ إكسل/CSV', lambda s: bool(re.search(r'text/csv|\.csv|xlsx|XLSX', s))),
    ('٥ إلغاء بسبب', lambda s: bool(re.search(r'void|voided|إلغاء', s))),
    ('٦ سجلّ/تدقيق', lambda s: bool(re.search(r'gmt_audit|GMTAudit|audit|سجلّ التعديلات', s))),
    ('٧ محاسبة', lambda s: bool(re.search(r'GMTLedger|gmt_expenses|GMTCash', s))),
    ('٢ أرقام فوق', lambda s: bool(re.search(r'font-size:\s*(1[89]|2\d)px|text-(xl|2xl|3xl)', s))),
]
def pages_of(mod):
    out = []
    for f in os.listdir(ROOT):
        if f.endswith('.html'):
            try:
                if mod + '?v=' in open(os.path.join(ROOT, f), encoding='utf-8').read(): out.append(f)
            except Exception: pass
    return out
def main():
    wn = open(os.path.join(ROOT, 'gmt-whatsnew.js'), encoding='utf-8').read()
    rows = []
    for t in TOOLS:
        p = os.path.join(ROOT, t)
        if not os.path.exists(p): continue
        s = open(p, encoding='utf-8').read()
        r = [t, str(len(pages_of(t)))] + ['✓' if fn(s) else '✗' for _, fn in CHECKS]
        rows.append(r)
    hdr = ['الأداة', '٨ صفحات'] + [c for c, _ in CHECKS]
    md = '| ' + ' | '.join(hdr) + ' |\n|' + '---|' * len(hdr) + '\n' + '\n'.join('| ' + ' | '.join(r) + ' |' for r in rows) + '\n'
    if '--md' in sys.argv:
        out = sys.argv[sys.argv.index('--md') + 1]
        head = open(out, encoding='utf-8').read().split('<!-- AUTO -->')[0] if os.path.exists(out) else ''
        open(out, 'w', encoding='utf-8').write(head + '<!-- AUTO -->\n' + md)
    print(md)
if __name__ == '__main__': main()
