#!/usr/bin/env python3
"""يضيف رسالة المالك حرفياً إلى الأرشيف docs/أرشيف_المالك/ (طلب المالك seq 644–645 · TASK-0370).

الأرشيف مستقلّ عن سجلّ المالك gmt_owner_log: كلّ رسالة تُحفظ في السجلّ **وتُضاف هنا أيضاً** — حرفياً، مع وسائطها.

الاستعمال:
  python3 tools/owner_archive_add.py --cat f --seq 646 --session session_01MWfC... \
      --tasks TASK-0370 --status "🔧 قيد العمل" --text-file msg.txt \
      [--ts 2026-11-13T09:00:00] [--kind request] \
      [--pub img/p/web/owner/x.jpg ...]      # صورة منتج بلا بيانات زبائن ⇒ تُعرض مباشرة
      [--priv /path/receipt.jpg ...]         # فيها بيانات زبائن ⇒ تُشفَّر إلى handoffs/private/owner_media/

  --cat: p = برومبتات/طريقة عمل/دستور · f = طلبات تحديث وميزات · b = أخطاء وتصليحات
  التشفير بكلمة الحزمة gmt_owner_archive_2026-11-13 (من جدول gmt_handoff_files) عبر متغيّر البيئة GMT_ARCHIVE_PW — لا تُكتب في أيّ ملفّ.
  النصّ يُنقل كما هو؛ يُخفى فقط: المفاتيح السرّية · أرقام الهواتف · أرقام التتبّع الطويلة.
"""
import argparse, datetime, glob, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCH = os.path.join(ROOT, 'docs', 'أرشيف_المالك')
PRIVDIR = os.path.join(ROOT, 'handoffs', 'private', 'owner_media')
CATS = {'p': ('١_برومبتات_وطريقة_العمل_والدستور', 'البرومبتات وطريقة العمل والدستور'),
        'f': ('٢_طلبات_التحديث_والميزات', 'طلبات التحديث والميزات الجديدة'),
        'b': ('٣_الأخطاء_والتصليحات', 'الأخطاء والتصليحات')}
SNAME = {'session_01MWfC494J8Ayokvio9Ve6C9': 'الجلسة 01MWfC (هذه المحادثة)', 'session_01XEjHNW9dqo1zWS8cEcUN7i': 'الجلسة 01XEjH (الجلسة الأخرى)'}
SECRET = [re.compile(p) for p in [r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', r'\bsk-[A-Za-z0-9_-]{20,}', r'\bAIza[0-9A-Za-z_-]{30,}',
          r'\bgh[pousr]_[A-Za-z0-9]{30,}', r'github_pat_[A-Za-z0-9_]{30,}', r'\b\d{8,10}:[A-Za-z0-9_-]{30,}\b', r'\btvly-[A-Za-z0-9_-]{16,}', r'\bsbp_[a-f0-9]{30,}',
          r'\bxox[bapr]-[A-Za-z0-9-]{10,}', r'(?<![A-Za-z0-9/])[A-Za-z0-9]{32,}(?![A-Za-z0-9/.])']]
PHONE = re.compile(r'(?:\+?963[\s-]?|\b0)9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b')
LONGNUM = re.compile(r'(?<![\d.#/-])(?:\d{10,11}|\d{14,})(?![\d.])')
HEAD = '> أرشيف حرفيّ لرسائل المالك (طلب seq 628 · TASK-0370). النصوص منقولة كما هي حرفاً بحرف؛ أُخفي في هذه النسخة العامّة **فقط** المفاتيح السرّية وأرقام الهواتف (النصّ الكامل بلا إخفاء في الحزمة المشفّرة). الوسائط التي فيها بيانات زبائن في الحزم المشفّرة؛ صور المنتجات معروضة مباشرة. الدليل والتغطية: [README.md](README.md) · الحالة: [٤_حالة_التنفيذ.md](٤_حالة_التنفيذ.md).\n\n'


def public(t):
    for r in SECRET: t = r.sub('[مفتاح مخفي — النصّ الكامل في الحزمة المشفّرة]', t)
    t = PHONE.sub('[رقم هاتف مخفي]', t)
    return LONGNUM.sub('[رقم تتبّع/هاتف مخفي]', t)


def last_id():
    n = 0
    for f in glob.glob(os.path.join(ARCH, '*.md')):
        for m in re.finditer(r'^### م-(\d{4})', open(f, encoding='utf-8').read(), re.M): n = max(n, int(m.group(1)))
    return n


def encrypt(src, name):
    pw = os.environ.get('GMT_ARCHIVE_PW')
    if not pw: sys.exit('GMT_ARCHIVE_PW غير مضبوط — كلمة الحزمة من gmt_handoff_files (gmt_owner_archive_2026-11-13.passphrase)')
    os.makedirs(PRIVDIR, exist_ok=True)
    dst = os.path.join(PRIVDIR, name + '.gpg')
    subprocess.run(['gpg', '--batch', '--yes', '--pinentry-mode', 'loopback', '--symmetric', '--cipher-algo', 'AES256',
                    '--passphrase-fd', '0', '-o', dst, src], input=pw.encode(), check=True)
    return os.path.relpath(dst, ROOT)


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--cat', required=True, choices=list(CATS)); a.add_argument('--seq', type=int); a.add_argument('--session', required=True)
    a.add_argument('--tasks', nargs='*', default=[]); a.add_argument('--status', required=True); a.add_argument('--text-file', required=True)
    a.add_argument('--ts'); a.add_argument('--kind', default='request'); a.add_argument('--pub', nargs='*', default=[]); a.add_argument('--priv', nargs='*', default=[])
    o = a.parse_args()
    ts = o.ts or datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')
    text = open(o.text_file, encoding='utf-8').read().strip('\n')
    mid = 'م-%04d' % (last_id() + 1)
    meta = ['المصدر: نصّ المحادثة (أُضيف مباشرةً)']
    if o.seq is not None: meta.append('seq %d' % o.seq)
    meta.append('النوع: ' + o.kind)
    if o.tasks: meta.append('المهام: ' + ' · '.join(o.tasks))
    meta.append('**الحالة: %s**' % o.status)
    s = '### %s · %s UTC · %s\n\n%s\n\n~~~~text\n%s\n~~~~\n' % (mid, ts.replace('T', ' ')[:16], SNAME.get(o.session, o.session), ' · '.join(meta), public(text).replace('~~~~', '~ ~ ~ ~'))
    media = ['![](../../%s) — `%s`' % (p, p) for p in o.pub]
    for i, p in enumerate(o.priv, 1):
        name = '%s_%s_%02d%s' % (mid.replace('م-', 'm'), ts[:10], i, os.path.splitext(p)[1].lower())
        media.append('🔒 `%s` — مشفّرة (كلمة حزمة الأرشيف)' % encrypt(p, name))
    if media: s += '\n**الوسائط المرفقة:**\n\n' + '\n'.join('- ' + m for m in media) + '\n'
    fn, title = CATS[o.cat]
    path = os.path.join(ARCH, '%s_%s.md' % (fn, ts[:7]))
    body = open(path, encoding='utf-8').read() if os.path.exists(path) else '# %s — %s (0 رسالة)\n\n%s' % (title, ts[:7], HEAD)
    body = body.rstrip('\n') + '\n\n' + s + '\n'
    n = len(re.findall(r'^### م-\d{4}', body, re.M))
    body = re.sub(r'^(# .*?)\(\d+ رسالة\)', lambda m: '%s(%d رسالة)' % (m.group(1), n), body, count=1, flags=re.M)
    open(path, 'w', encoding='utf-8').write(body)
    print(mid, os.path.relpath(path, ROOT))


if __name__ == '__main__':
    main()
