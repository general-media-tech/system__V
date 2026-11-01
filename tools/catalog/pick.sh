#!/bin/bash
# pick.sh <ASIN> <tag> [n_images=8] [n_aplus=4] — صفحة المنتج + تنزيل الصور + لوحة المراجعة
C=${CAT_DIR:-/tmp/cat}
A=$1; T=$2; N=${3:-8}; P=${4:-4}
timeout 120 node $C/amz.js dp $A $C/p/$T.json > $C/p/$T.txt 2>&1
python3 - "$C/p/$T.json" "$N" "$P" > $C/p/$T.urls <<'PY'
import json,sys; d=json.load(open(sys.argv[1])); n,p=int(sys.argv[2]),int(sys.argv[3])
a=[u for u in d.get('aplus',[]) if not u.endswith('.gif')]
print('\n'.join(d['images'][:n]+a[:p]))
PY
python3 -I $C/sheet.py $C/img/$T $C/p/$T.jpg $(cat $C/p/$T.urls) > /dev/null 2>&1
python3 - "$C/p/$T.json" <<'PY'
import json,sys; d=json.load(open(sys.argv[1]))
print('TITLE:', d['title'][:200]); print('IMGS', len(d['images']), 'APLUS', len(d['aplus']))
for b in d['bullets'][:7]: print('•', b[:260])
skip={'Customer Reviews','Best Sellers Rank','ASIN','Date First Available','Discontinued By Manufacturer'}
print({k:v[:120] for k,v in d['rows'].items() if k not in skip})
PY
