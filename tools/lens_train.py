#!/usr/bin/env python3
"""tools/lens_train.py — تدريب «عين» العدسة على منتجاتنا (TASK-A0580 · المالك seq A1016 «درّبها أنت … مثل عدسة جوجل»).

المدخلات (من tools/lens_index_build.js و tools/lens_train_aug.js):
  .lens_raw/raw.f32 + ids.json          صور الكتالوج (بصمة خام ١٢٨٠)
  .lens_raw/aug.f32 + aug_ids.json      لقطات موبايل صناعيّة للتدريب   («المنتج|رقم الصورة»)
  .lens_raw/heldout.f32 + heldout_ids   لقطات صناعيّة ببذرة أخرى — للتقييم فقط
التدريب: تحليل تمييزي خطّيّ منظَّم (LDA): إسقاطٌ إلى ١٢٨ بُعداً يجمع لقطات المنتج الواحد (رغم الخلفية والميلان والإضاءة)
ويُبعد المنتجات عن بعضها — مُتعلَّمٌ من منتجاتنا نحن لا من صور الإنترنت. + «نموذج أوّلي» لكلّ منتج (متوسّط لقطاته) يُضاف للفهرس.
التقييم الصادق (يُطبع): (أ) لقطة جديدة لنفس الصورة · (ب) لقطة لصورةٍ أخرى للمنتج لم يُتدرَّب عليها — قبل/بعد.
الإخراج: lens-index.json بالصيغة نفسها (mean · comp · compMax · items) ⇒ لا تغيير في كود الجهاز.
الاستعمال: python3 tools/lens_train.py [--alpha 0.3] [--write]"""
import base64, datetime, json, os, sys
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, '.lens_raw')
D = 128
ALPHA = float(sys.argv[sys.argv.index('--alpha') + 1]) if '--alpha' in sys.argv else 0.3
WRITE = '--write' in sys.argv

def load(name, idsname):
    ids = json.load(open(os.path.join(RAW, idsname)))
    X = np.fromfile(os.path.join(RAW, name), dtype=np.float32).reshape(len(ids), -1).astype(np.float64)
    X /= np.maximum(np.linalg.norm(X, axis=1, keepdims=True), 1e-9)
    return ids, X

cat_ids, C = load('raw.f32', 'ids.json')                 # كتالوج: المنتج فقط
aug_ids, A = load('aug.f32', 'aug_ids.json')              # «المنتج|رقم الصورة»
hold_ids, Hh = load('heldout.f32', 'heldout_ids.json')
a_pid = [x.split('|')[0] for x in aug_ids]; a_img = [int(x.split('|')[1]) for x in aug_ids]
h_pid = [x.split('|')[0] for x in hold_ids]; h_img = [int(x.split('|')[1]) for x in hold_ids]
# رقم صورة الكتالوج: بالترتيب داخل المنتج (كما بُني الفهرس)
c_img, cnt = [], {}
for p in cat_ids: c_img.append(cnt.get(p, 0)); cnt[p] = cnt.get(p, 0) + 1

def fit_lda(X, y, alpha):
    mu = X.mean(0); Xc = X - mu
    labs = sorted(set(y)); idx = {l: i for i, l in enumerate(labs)}; yi = np.array([idx[l] for l in y])
    M = np.zeros((len(labs), X.shape[1])); n = np.bincount(yi, minlength=len(labs)).astype(float)
    np.add.at(M, yi, Xc); M /= n[:, None]
    W = Xc - M[yi]                                   # داخل الصنف
    Sw = W.T @ W / len(X); Sb = (M * n[:, None]).T @ M / len(X)
    Sw += alpha * np.trace(Sw) / Sw.shape[0] * np.eye(Sw.shape[0])
    ev, U = np.linalg.eigh(Sw); Wh = U @ np.diag(ev ** -0.5) @ U.T   # تبييض داخل الصنف
    ev2, V = np.linalg.eigh(Wh @ Sb @ Wh)
    P = Wh @ V[:, ::-1][:, :D]                       # أفضل D اتّجاهاً مميِّزاً
    return mu, P

def fit_pca(X):
    mu = X.mean(0); U, S, Vt = np.linalg.svd(X - mu, full_matrices=False)
    return mu, (Vt[:D] / np.sqrt(S[:D] / S[0])[:, None]).T

def proj(X, mu, P):
    Y = (X - mu) @ P; return Y / np.maximum(np.linalg.norm(Y, axis=1, keepdims=True), 1e-9)

def evaluate(mu, P, db_mask, q_mask, protos=None, label=''):
    dbX = proj(C[db_mask], mu, P); dbp = [p for p, m in zip(cat_ids, db_mask) if m]
    if protos is not None: dbX = np.vstack([dbX, protos[1]]); dbp = dbp + protos[0]
    Q = proj(Hh[q_mask], mu, P); qp = [p for p, m in zip(h_pid, q_mask) if m]
    S = Q @ dbX.T; t1 = t5 = 0; uniq = {}
    for i in range(len(Q)):
        order = np.argsort(-S[i]); seen = []
        for j in order:
            if dbp[j] not in seen: seen.append(dbp[j])
            if len(seen) >= 5: break
        t1 += seen[0] == qp[i]; t5 += qp[i] in seen
    n = max(1, len(Q)); print(f'  {label:52s} أوّل: {t1/n:5.1%} · أوّل ٥: {t5/n:5.1%}  (n={n})'); return t5 / n

def protos_for(mu, P, mask):
    Y = proj(A[mask], mu, P); pids = [p for p, m in zip(a_pid, mask) if m]; out = {}
    for y, p in zip(Y, pids): out.setdefault(p, []).append(y)
    keys = list(out); M = np.array([np.mean(out[k], 0) for k in keys]); M /= np.linalg.norm(M, axis=1, keepdims=True)
    return keys, M

c_img = np.array(c_img); a_img = np.array(a_img); h_img = np.array(h_img)
print('بيانات: كتالوج', len(C), '· تدريب', len(A), '· تقييم', len(Hh), '· منتجات', len(set(cat_ids)))
# (أ) نفس الصورة بلقطةٍ جديدة — كلّ الكتالوج في الفهرس
allc = np.ones(len(C), bool); allh = np.ones(len(Hh), bool); alla = np.ones(len(A), bool)
print('(أ) لقطة موبايل جديدة لنفس صورة المنتج:')
mu0, P0 = fit_pca(C); evaluate(mu0, P0, allc, allh, label='قبل — الضغط الحاليّ (PCA)')
muL, PL = fit_lda(np.vstack([C, A]), cat_ids + a_pid, ALPHA)
evaluate(muL, PL, allc, allh, label=f'بعد — مدرَّب على منتجاتنا (LDA α={ALPHA})')
evaluate(muL, PL, allc, allh, protos_for(muL, PL, alla), label='بعد + نموذج أوّلي لكلّ منتج')
# (ب) صورة أخرى للمنتج لم يُتدرَّب عليها: التدريب والفهرس من الصورة 0 فقط · الاستعلام لقطات الصور ≥1
print('(ب) صورة أخرى للمنتج لم يُتدرَّب عليها (الأصعب):')
db0 = c_img == 0; tr0 = a_img == 0
multi = set(p for p, i in zip(cat_ids, c_img) if i >= 1); qb = np.array([(i >= 1 and p in multi) for p, i in zip(h_pid, h_img)])
mu0b, P0b = fit_pca(C[db0]); evaluate(mu0b, P0b, db0, qb, label='قبل — PCA')
muLb, PLb = fit_lda(np.vstack([C[db0], A[tr0]]), [p for p, m in zip(cat_ids, db0) if m] + [p for p, m in zip(a_pid, tr0) if m], ALPHA)
evaluate(muLb, PLb, db0, qb, label='بعد — LDA')
evaluate(muLb, PLb, db0, qb, protos_for(muLb, PLb, tr0), label='بعد + نموذج أوّلي')

if WRITE:
    mu, P = muL, PL; keys, M = protos_for(mu, P, alla)
    comp = P.T                                         # D × 1280
    mmax = float(np.abs(mu).max()); mean_q = np.round(mu / mmax * 32767).astype(np.int16)
    cmax = np.abs(comp).max(1); comp_q = np.round(comp / cmax[:, None] * 127).astype(np.int8)
    mean_d = mean_q.astype(np.float64) / (32767 / mmax); comp_d = comp_q.astype(np.float64) / 127 * cmax[:, None]
    def pj(X): Y = (X - mean_d) @ comp_d.T; return Y / np.maximum(np.linalg.norm(Y, axis=1, keepdims=True), 1e-9)
    def q8(Y): return np.clip(np.round(Y * 127 * 4 + 128), 0, 255).astype(np.uint8)
    Yc = q8(pj(C)); items = {}
    for i, pid in enumerate(cat_ids): items.setdefault(pid, []).append('3:' + base64.b64encode(Yc[i].tobytes()).decode())
    # النموذج الأوّليّ: متوسّط لقطات المنتج (في الفضاء المكمَّم نفسه)
    Ya = pj(A); acc = {}
    for y, p in zip(Ya, a_pid): acc.setdefault(p, []).append(y)
    for p, ys in acc.items():
        m = np.mean(ys, 0); m /= np.linalg.norm(m); items.setdefault(p, []).append('3:' + base64.b64encode(q8(m[None])[0].tobytes()).decode())
    out = {'v': 3, 'built': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'count': len(cat_ids), 'dims': D, 'trained': 'lda', 'alpha': ALPHA, 'aug': len(A),
           'pca': {'mean': base64.b64encode(mean_q.tobytes()).decode(), 'meanMax': mmax, 'comp': [base64.b64encode(r.tobytes()).decode() for r in comp_q], 'compMax': [float(x) for x in cmax]},
           'items': items}
    p = os.path.join(ROOT, 'lens-index.json'); json.dump(out, open(p, 'w'), separators=(',', ':'))
    print('كُتب lens-index.json:', len(items), 'منتج ·', os.path.getsize(p) // 1024, 'KB')
