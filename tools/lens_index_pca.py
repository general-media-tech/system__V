#!/usr/bin/env python3
"""tools/lens_index_pca.py — يضغط بصمات العدسة الخام (.lens_raw) إلى ١٢٨ بُعداً ويكتب lens-index.json (TASK-A0580).
الضغط = تحليل المكوّنات الرئيسيّة على صورنا نحن ⇒ الأبعاد التي تفرّق بين منتجاتنا تبقى، والضجيج يُحذف.
المتوسّط يُخزَّن int16 والمكوّنات int8 لكلّ صفّ مقياسه — يفكّها gmt-lens-local.js loadIndex()."""
import base64, datetime, json, os, sys
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, '.lens_raw')
D = 128
ids = json.load(open(os.path.join(RAW, 'ids.json')))
X = np.fromfile(os.path.join(RAW, 'raw.f32'), dtype=np.float32).reshape(len(ids), -1)
X = X / np.maximum(np.linalg.norm(X, axis=1, keepdims=True), 1e-9)
mean = X.mean(0)
U, S, Vt = np.linalg.svd(X - mean, full_matrices=False)
comp = Vt[:D]                                   # D × 1280
# تبييض جزئيّ: يُقسم كلّ بُعد على جذر تباينه ⇒ لا يطغى أوّل بُعدين على المقارنة
w = 1.0 / np.sqrt(S[:D] / S[0])
comp_w = comp * w[:, None]
mmax = float(np.abs(mean).max())
mean_q = np.round(mean / mmax * 32767).astype(np.int16)
cmax = np.abs(comp_w).max(1)
comp_q = np.round(comp_w / cmax[:, None] * 127).astype(np.int8)
# البصمات بالضبط كما سيحسبها الجهاز (من القيم المكمّمة نفسها)
mean_d = mean_q.astype(np.float32) / (32767 / mmax)
comp_d = comp_q.astype(np.float32) / 127 * cmax[:, None]
P = (X - mean_d) @ comp_d.T
P = P / np.maximum(np.linalg.norm(P, axis=1, keepdims=True), 1e-9)
clip = float((np.abs(P) > 0.25).mean())
Q = np.clip(np.round(P * 127 * 4 + 128), 0, 255).astype(np.uint8)
items = {}
for i, pid in enumerate(ids):
    items.setdefault(pid, []).append('2:' + base64.b64encode(Q[i].tobytes()).decode())
out = {'v': 2, 'built': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'), 'count': len(ids), 'dims': D,
       'pca': {'mean': base64.b64encode(mean_q.tobytes()).decode(), 'meanMax': mmax,
               'comp': [base64.b64encode(r.tobytes()).decode() for r in comp_q], 'compMax': [float(x) for x in cmax]},
       'items': items}
p = os.path.join(ROOT, 'lens-index.json')
json.dump(out, open(p, 'w'), separators=(',', ':'))
print(f'lens-index.json: {len(items)} منتج · {len(ids)} صورة · {os.path.getsize(p)//1024} KB · قصّ {clip:.2%}')
