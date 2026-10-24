import json, re, uuid, sys, itertools
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qsl, unquote
DB = {}; SEQ = itertools.count(1)
MISSING = {'gmt_reservations', 'nonexistent_tbl'}
OPTS = {'unique_invoices': True, 'drop_reply': [], 'fail_post': [], 'block_delete': [], 'unique_order_invoice': True, 'old_rpc_false': False, 'reject_cols': [], 'rls_block': [], 'no_pos_fn': False, 'sov': '2003', 'pos_protected': True, 'pos_locked': False}
def tbl(t): return DB.setdefault(t, [])
def cmp_val(v, raw):
    if raw == 'null': return v is None
    if raw == 'true': return v is True
    if raw == 'false': return v is False
    return str(v) == raw
def match(row, k, expr):
    if k in ('select','limit','order','offset'): return True
    if k == 'or':
        inner = expr[1:-1]
        return any(match(row, *c.split('.',1)) for c in inner.split(','))
    op, _, val = expr.partition('.')
    v = row.get(k)
    if op == 'eq':
        if isinstance(v, bool): return str(v).lower() == val
        return v is not None and str(v) == val
    if op == 'neq': return str(v) != val
    if op == 'is':
        if val == 'null': return v is None
        if val == 'true': return v is True
        if val == 'false': return v is False
    if op == 'in':
        vals = val.strip('()').split(',')
        return v is not None and str(v) in vals
    if op == 'like':                            # كـPostgREST: «*» و«%» كلاهما محرف بدل (كان «%» حرفياً فيفشل بحث «الرقم الأكبر»)
        pat = '^' + re.escape(val).replace('\\*','.*').replace('%','.*') + '$'
        return v is not None and re.match(pat, str(v)) is not None
    if op in ('gt','lt','gte','lte'):
        if v is None: return False
        try: a=float(v); b=float(val)
        except Exception: a=str(v); b=str(val)
        return {'gt':a>b,'lt':a<b,'gte':a>=b,'lte':a<=b}[op]
    if op in ('ilike',):
        pat = '^' + re.escape(val).replace('\\*','.*').replace('%','.*') + '$'
        return v is not None and re.match(pat, str(v), re.I) is not None
    if op == 'not':
        return not match(row, k, val)
    return True
class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Expose-Headers','Content-Range')
        self.send_header('Access-Control-Allow-Headers','*')
        self.send_header('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS')
    def reply(self, code, obj=None, hdr=None):
        body = b'' if obj is None else json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.cors()
        if code != 204: self.send_header('Content-Type','application/json')
        for k, v in (hdr or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def mut_reply(self, rows):
        pref = self.headers.get('Prefer') or ''
        hdr = {'Content-Range': ('*/%d' % len(rows)) if 'count=exact' in pref else '*/*'} if 'count=exact' in pref else {}
        if 'return=minimal' in pref: return self.reply(204, None, hdr)
        return self.reply(200, rows, hdr)
    def do_OPTIONS(self): self.send_response(204); self.cors(); self.end_headers()
    def parse(self):
        u = urlsplit(self.path); path = u.path
        q = parse_qsl(u.query, keep_blank_values=True)
        n = int(self.headers.get('Content-Length') or 0)
        body = json.loads(self.rfile.read(n) or b'null') if n else None
        return path, q, body
    def filt(self, t, q):
        return [r for r in tbl(t) if all(match(r,k,v) for k,v in q)]
    def proj(self, rows, q):
        sel = dict(q).get('select')
        lim = dict(q).get('limit')
        off = dict(q).get('offset')
        order = dict(q).get('order')
        if order:                                     # كـPostgREST: «col.desc,col2.asc» (+ nullsfirst/nullslast) — كان يُتجاهل
            def keyf(c):
                def k(r):
                    v = r.get(c)
                    try: v = (0, float(v)) if v is not None and not isinstance(v, bool) and str(v).strip() != '' and float(v) == float(v) else (1, str(v))
                    except Exception: v = (1, str(v))
                    return v
                return k
            rows = list(rows)
            for part in reversed([x for x in order.split(',') if x]):
                bits = part.split('.'); col = bits[0]; desc = 'desc' in bits[1:]
                nf = 'nullsfirst' in bits[1:] or (desc and 'nullslast' not in bits[1:])
                nn = [r for r in rows if r.get(col) is not None]; nulls = [r for r in rows if r.get(col) is None]
                nn.sort(key=keyf(col), reverse=desc)
                rows = (nulls + nn) if nf else (nn + nulls)
        if off: rows = rows[int(off):]
        if lim: rows = rows[:int(lim)]
        if not sel or sel == '*': return rows
        cols = [c for c in sel.split(',') if c]
        return [{c: r.get(c) for c in cols} for r in rows]
    def pw_rpc(self, fn, b):
        # (20 ت1 · TASK-0112) كالدوال الحقيقية: الكلمة في «جدولٍ مغلق» (_secrets — لا يُقرأ عبر REST) والقديمة تُرحَّل عند أوّل نجاح
        import hashlib, base64
        sec = DB.setdefault('_secrets', {})
        H = lambda pw: 'bf$' + hashlib.sha256(('salt|' + pw).encode()).hexdigest()
        uid = str(b.get('p_user')); users = [r for r in tbl('gmt_users') if str(r.get('id')) == uid]
        def check(pw):
            if not pw: return False
            if uid in sec: return sec[uid] == H(pw)
            if not users: return False
            u = users[0]; lh = u.get('password_hash') or ''
            ok = lh not in ('', '*') and (lh == base64.b64encode(pw.encode()).decode() or lh == pw)
            if ok: sec[uid] = H(pw); u['password_hash'] = '*'; u['password'] = None
            return ok
        def put(pw):
            sec[uid] = H(pw)
            for u in users: u['password_hash'] = '*'; u['password'] = None
        if fn == 'gmt_pw_check': return check(b.get('p_pw') or '')
        if fn == 'gmt_pw_change':
            if not check(b.get('p_old') or ''): return False
            put(b.get('p_new') or ''); return True
        if fn == 'gmt_pw_set':
            if not users: return False
            put(b.get('p_new') or ''); return True
    def rest(self, method):
        # (24 ت1 · seq 48) كـPostgREST الحيّ: جسمٌ بلا 'Content-Type: application/json' ⇒ 400 PGRST102.
        # كان المحاكي يقبل أيّ نوع فنجح «تأكيد الاستلام» في الاختبار وهو مرفوضٌ دائماً على القاعدة الحقيقية.
        if method in ('POST', 'PATCH') and self.path.startswith('/rest/v1/') and int(self.headers.get('Content-Length') or 0) > 0:
            ct = (self.headers.get('Content-Type') or '').split(';')[0].strip().lower()
            if ct not in ('application/json', 'application/vnd.pgrst.object+json', 'text/csv', 'application/x-www-form-urlencoded'):
                self.rfile.read(int(self.headers.get('Content-Length') or 0))
                return self.reply(400, {'code': 'PGRST102', 'details': None, 'hint': None, 'message': 'Content-Type not acceptable: ' + (ct or '(none)')})
        path, q, body = self.parse()
        if path == '/__reset': DB.clear(); return self.reply(200, {})
        if path == '/__opts': OPTS.update(body or {}); return self.reply(200, OPTS)
        if path == '/__dump': return self.reply(200, DB)
        m = re.match(r'^/rest/v1/rpc/(\w+)$', path)
        if m:
            fn = m.group(1)
            if fn in ('add_branch_stock','deduct_branch_stock'):
                pid, br, qty = body['p_product_id'], body['p_branch_key'], float(body['p_qty'])
                rows = [r for r in tbl('products') if str(r['id']) == str(pid)]
                if not rows: return self.reply(400, {'code':'P0001','message':'المنتج %s غير موجود' % pid})
                r = rows[0]; cur = float(r.get(br) or 0)
                delta = qty if fn=='add_branch_stock' else -abs(qty)
                if OPTS['old_rpc_false'] and fn=='deduct_branch_stock' and cur + delta < 0: return self.reply(200, False)
                r[br] = max(0, cur + delta)
                return self.reply(200, r[br])
            if fn == 'next_stock_transfer_number':      # كالقاعدة: TRF-00011 (أكبر رقمٍ بخمس خانات + 1)
                nums = [int(m2.group(1)) for r in tbl('branch_stock_transfers') for m2 in [re.match(r'^TRF-(\d{5})$', str(r.get('transfer_number') or ''))] if m2]
                return self.reply(200, 'TRF-%05d' % ((max(nums) if nums else 0) + 1))
            if fn in ('gmt_pw_check','gmt_pw_change','gmt_pw_set') and not OPTS.get('no_pw_fn'):
                return self.reply(200, self.pw_rpc(fn, body or {}))
            if fn in ('gmt_create_pos','gmt_retire_pos','gmt_pos_status','gmt_pos_change_secret') and not OPTS.get('no_pos_fn'):
                return self.reply(200, self.pos_rpc(fn, body or {}))
            return self.reply(404, {'code':'PGRST202','message':'Could not find the function'})
        m = re.match(r'^/rest/v1/(\w+)$', path)
        if not m: return self.reply(404, {'message':'not found'})
        t = m.group(1)
        if t.startswith('_'): return self.reply(401, {'code':'42501','message':'permission denied'})
        if t in MISSING: return self.reply(404, {'code':'42P01','message':'relation "%s" does not exist' % t})
        if method == 'GET':
            return self.reply(200, self.proj(self.filt(t, q), q))
        if method in ('POST','PATCH'):
            rr = body if isinstance(body, list) else [body or {}]
            for c in OPTS['reject_cols']:
                if any(c in (x or {}) for x in rr):
                    return self.reply(400, {'code':'PGRST204','message':"Could not find the '%s' column of '%s' in the schema cache" % (c, t)})
        if method == 'POST':
            rows = body if isinstance(body, list) else [body]
            if t in OPTS['fail_post']:                 # (TASK-0010) فشلٌ مُحاكى مرّةً لكل ظهورٍ للجدول في القائمة
                OPTS['fail_post'].remove(t); return self.reply(500, {'message': 'simulated failure on ' + t})
            if t == 'invoices' and OPTS.get('unique_invoices'):   # كالقاعدة الحقيقية: inv_number فريد · client_ref فريد إن وُجد
                for r in rows:
                    for col, idx in (('inv_number', 'invoices_inv_number_key'), ('client_ref', 'invoices_client_ref_key')):
                        v = (r or {}).get(col)
                        if v is not None and any(x.get(col) == v for x in tbl(t)):
                            return self.reply(409, {'code': '23505', 'message': 'duplicate key value violates unique constraint "%s"' % idx})
            out = []
            oc = dict(q).get('on_conflict'); merge = 'merge-duplicates' in (self.headers.get('Prefer') or '')
            for r in rows:
                r = dict(r)
                if oc and merge:   # كما يفعل PostgREST: upsert حقيقي على عمود التعارض
                    ex = [x for x in tbl(t) if x.get(oc) == r.get(oc)]
                    if ex: ex[0].update(r); out.append(ex[0]); continue
                if 'id' not in r: r['id'] = str(uuid.uuid4()) if t == 'products' else next(SEQ)
                r.setdefault('created_at','2026-10-07T00:00:00Z')
                tbl(t).append(r); out.append(r)
            if t in OPTS['drop_reply']:                # (TASK-0010) أُدرج فعلاً ثمّ ضاع الردّ (انقطاع) — لا يُرسَل شيء
                OPTS['drop_reply'].remove(t); self.close_connection = True; return
            return self.reply(201, out)
        if method == 'PATCH':
            rows = self.filt(t, q)
            if t == 'gmt_orders' and OPTS['unique_order_invoice'] and body and body.get('invoice_id') is not None:
                for r in rows:
                    if any(o is not r and o.get('invoice_id') == body['invoice_id'] for o in tbl(t)):
                        return self.reply(409, {'code':'23505','message':'duplicate key value violates unique constraint "gmt_orders_one_order_per_invoice"'})
            if t in OPTS['rls_block']: rows = []
            for r in rows: r.update(body or {})
            return self.mut_reply(rows)
        if method == 'DELETE':
            rows = self.filt(t, q)
            if t in OPTS['rls_block'] or t in OPTS['block_delete']: rows = []
            DB[t] = [r for r in tbl(t) if r not in rows]
            return self.mut_reply(rows)
    def pos_rpc(self, fn, b):
        import re as _re, time as _t
        if fn == 'gmt_pos_status': return {'protected': bool(OPTS.get('pos_protected', True))}
        if not OPTS.get('pos_protected', True): return {'ok': False, 'error': 'not_protected'}
        if OPTS.get('pos_locked'): return {'ok': False, 'error': 'locked'}
        if fn == 'gmt_pos_change_secret':
            if str(b.get('p_old') or '') != OPTS.get('sov', '2003'): return {'ok': False, 'error': 'bad_secret'}
            nw = str(b.get('p_new') or '')
            if len(nw) < 10 or nw == '2003' or nw == b.get('p_old'): return {'ok': False, 'error': 'weak_secret'}
            OPTS['sov'] = nw; return {'ok': True}
        sec = str(b.get('p_secret') or '')
        if sec != OPTS.get('sov', '2003'):
            tbl('gmt_audit').append({'id': next(SEQ), 'action': 'pos_secret_fail', 'entity_id': b.get('p_key'), 'actor': b.get('p_actor')})
            return {'ok': False, 'error': 'bad_secret'}
        key = str(b.get('p_key') or '').strip().lower(); cols = tbl('inv_columns')
        reg = next((c for c in cols if c.get('key_name') == key), None)
        if fn == 'gmt_create_pos':
            name = str(b.get('p_name') or '').strip()
            if not _re.match(r'^[a-z][a-z0-9_]{2,23}$', key) or _re.match(r'^(pg_|gmt_)', key) or key in ('xmin','xmax','cmin','cmax','ctid','tableoid'): return {'ok': False, 'error': 'bad_key'}
            if _re.search(r'(haleb|aleppo|hlb|halb|germany|deutschland|china|zhongguo)', key) or _re.search(r'(^|_)(de|cn)(_|$)', key): return {'ok': False, 'error': 'reserved_key'}
            if not (2 <= len(name) <= 40): return {'ok': False, 'error': 'bad_name'}
            if reg and reg.get('is_branch'): return {'ok': False, 'error': 'exists'}
            if key in ('price','name','barcode','id','category','brand') : return {'ok': False, 'error': 'key_taken'}
            if reg and not reg.get('_marked'): return {'ok': False, 'error': 'key_taken'}
            if any(c.get('is_branch') and (c.get('display_name') or '').strip().lower() == name.lower() and c.get('key_name') != key for c in cols): return {'ok': False, 'error': 'dup_name'}
            if sum(1 for c in cols if c.get('is_branch')) >= 30: return {'ok': False, 'error': 'too_many', 'max': 30}
            react = bool(reg)
            if reg: reg.update({'display_name': name, 'is_branch': True, 'include_in_total': True, 'show_table': True, 'show_form': True})
            else:
                cols.append({'id': key + '_' + str(int(_t.time()*1000)), 'display_name': name, 'key_name': key, 'col_type': 'number', 'show_table': True, 'show_form': True, 'include_in_total': True, 'is_required': False, 'is_branch': True, 'icon': b.get('p_icon') or '🏪', 'options': [], 'sort_order': len(cols) + 1, '_marked': True})
                for p in tbl('products'): p.setdefault(key, 0)
            tbl('gmt_audit').append({'id': next(SEQ), 'action': 'pos_create', 'entity_id': key, 'entity_name': name, 'actor': b.get('p_actor')})
            return {'ok': True, 'key': key, 'name': name, 'created_column': not react, 'reactivated': react}
        # retire
        if key in ('haleb','germany','china'): return {'ok': False, 'error': 'protected'}
        if not reg or not reg.get('is_branch'): return {'ok': False, 'error': 'not_active'}
        tot = sum(float(p.get(key) or 0) for p in tbl('products')); n = sum(1 for p in tbl('products') if float(p.get(key) or 0) != 0)
        if n: return {'ok': False, 'error': 'has_stock', 'qty': tot, 'products': n}
        o = sum(1 for t in tbl('branch_stock_transfers') if (t.get('from_branch') == key or t.get('to_branch') == key) and t.get('status') in ('pending','receiving','needs_settlement') and not t.get('settled'))
        if o: return {'ok': False, 'error': 'open_transfers', 'count': o}
        uc = sum(1 for c in tbl('invoice_commissions') if c.get('branch_key') == key and not c.get('paid'))
        if uc: return {'ok': False, 'error': 'unpaid_commissions', 'count': uc}
        u = sum(1 for x in tbl('gmt_users') if x.get('branch_key') == key and x.get('is_active', True))
        if u: return {'ok': False, 'error': 'has_users', 'count': u}
        reg.update({'is_branch': False, 'include_in_total': False, 'show_table': False, 'show_form': False, '_marked': True})
        tbl('gmt_audit').append({'id': next(SEQ), 'action': 'pos_retire', 'entity_id': key, 'entity_name': reg.get('display_name'), 'actor': b.get('p_actor')})
        return {'ok': True, 'key': key, 'name': reg.get('display_name'), 'invoices': sum(1 for i in tbl('invoices') if i.get('branch_key') == key)}
    def do_GET(self): self.rest('GET')
    def do_POST(self): self.rest('POST')
    def do_PATCH(self): self.rest('PATCH')
    def do_DELETE(self): self.rest('DELETE')
ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv)>1 else 8098), H).serve_forever()
