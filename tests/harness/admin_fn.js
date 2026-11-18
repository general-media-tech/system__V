// مُحاكاة دالّة الخادم gmt-admin للاختبارات (TASK-B0522) — المنطق نفسه منسوخاً من tools/notify/gmt-admin/index.ts فوق القاعدة الوهمية
const M = 'http://127.0.0.1:' + (process.env.MOCK_PORT || 8197);
const SB = () => M, SVC = () => 'test-secret';
const H = () => ({ 'Content-Type': 'application/json' });
const atob = (s) => Buffer.from(s, 'base64').toString('binary'), btoa = (s) => Buffer.from(s, 'binary').toString('base64');
const SALT = "gmt::2026::auth", DEFAULT_PW = "2003", ITERS = 120000, ADMIN_KEY = "admin_accounts", DEV = "admin_device_", TTL = 12 * 3600 * 1000;
const KINDS = { sovereign: "pw_sovereign", store: "pw_store", warranty: "pw_warranty", pos: "admin_password", purchase: "pw_purchase", backup: "pw_backup" };
const enc = new TextEncoder();
const hex = (u) => Array.from(u).map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
async function sha(t) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(SALT + "|" + t)))); }
async function pbkdf2(pw, salt, it) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(salt), iterations: it }, k, 256)));
}
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const norm = (x) => String(x ?? "").normalize("NFKC").replace(/[ً-ٟـ]/g, "").replace(/\s+/g, "").toLowerCase();
async function hmac(s) {
  const k = await crypto.subtle.importKey("raw", enc.encode("gmt-admin/v1|" + SVC()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(s))));
}
async function mkToken(name) { const exp = Date.now() + TTL, b = btoa(unescape(encodeURIComponent(name))) + "." + exp; return b + "." + await hmac(b); }
async function who(tok) {
  const p = String(tok || "").split("."); if (p.length !== 3) return null;
  const b = p[0] + "." + p[1]; if (!same(await hmac(b), p[2]) || +p[1] < Date.now()) return null;
  try { return decodeURIComponent(escape(atob(p[0]))); } catch { return null; }
}
async function get(key) {
  const r = await fetch(`${SB()}/rest/v1/gmt_settings?key=eq.${encodeURIComponent(key)}&select=value`, { headers: H() });
  if (!r.ok) throw new Error("read " + r.status); const rows = await r.json(); return rows && rows[0] ? rows[0].value : null;
}
async function put(key, value) {
  const r = await fetch(`${SB()}/rest/v1/gmt_settings?on_conflict=key`, { method: "POST", headers: { ...H(), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ key, value }]) });
  if (!r.ok) throw new Error("write " + r.status);
}
async function del(key) { await fetch(`${SB()}/rest/v1/gmt_settings?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", headers: { ...H(), Prefer: "return=minimal" } }); }
async function admins() { const v = await get(ADMIN_KEY); if (!v || !String(v).trim()) return []; const l = JSON.parse(v); if (!Array.isArray(l)) throw new Error("corrupt"); return l; }
async function mkAcc(name, pw, by) { const s = hex(crypto.getRandomValues(new Uint8Array(16))); return { n: String(name).trim(), k: norm(name), s, i: ITERS, h: await pbkdf2(pw, s, ITERS), at: new Date().toISOString(), by }; }
async function checkKind(kind, pw) {
  const key = KINDS[kind]; if (!key) return { ok: false, isDefault: false };
  const st = await get(key);
  if (st) { const ok = String(st).startsWith("sha256:") ? same("sha256:" + await sha(pw), String(st)) : same(pw, String(st)); return { ok, isDefault: false }; }
  return { ok: pw === DEFAULT_PW, isDefault: true };
}
const slow = () => new Promise((r) => setTimeout(r, 400));

async function inner(q, J) {
  try {
    
    const a = String(q.a || ""), pw = String(q.pw ?? "").slice(0, 200);
    if (a === "check") { const r = await checkKind(String(q.kind), pw); if (!r.ok) await slow(); return J({ ok: true, valid: r.ok, isDefault: r.isDefault }); }
    if (a === "isdefault") { const key = KINDS[String(q.kind)]; return J({ ok: true, isDefault: !!key && !(await get(key)) }); }
    if (a === "login") {
      const list = await admins();
      if (!list.length) {
        if (!q.bootstrap) return J({ ok: true, none: true });
        if (!(await checkKind("sovereign", pw)).ok) { await slow(); return J({ ok: true, valid: false, none: true }); }
        const first = await mkAcc(String(q.name || "").slice(0, 40), pw, "أوّل حساب"); await put(ADMIN_KEY, JSON.stringify([first]));
        return J({ ok: true, valid: true, created: true, name: first.n, token: await mkToken(first.n) });
      }
      const k = norm(q.name), acc = list.find((x) => x && x.k === k);
      if (!acc || !same(await pbkdf2(pw, acc.s, acc.i || ITERS), String(acc.h))) { await slow(); return J({ ok: true, valid: false, known: !!acc }); }
      return J({ ok: true, valid: true, name: acc.n, token: await mkToken(acc.n) });
    }
    if (a === "dev_restore") {
      const rec = await get(DEV + String(q.id || "").replace(/[^0-9a-f]/gi, "")); const r = rec ? JSON.parse(rec) : null;
      const list = await admins(), acc = list.find((x) => x && r && x.k === r.k && x.k === norm(q.k));
      const good = !!(r && acc && r.s === acc.s && same(String(r.h || ""), await sha("admin-device|" + String(q.t || ""))));
      if (!good) { if (r && (!acc || r.s !== acc.s)) await del(DEV + String(q.id)); return J({ ok: true, valid: false, gone: true }); }
      return J({ ok: true, valid: true, name: acc.n, token: await mkToken(acc.n) });
    }
    if (a === "dev_forget") {
      const id = String(q.id || "").replace(/[^0-9a-f]/gi, ""), rec = await get(DEV + id), r = rec ? JSON.parse(rec) : null;
      if (r && same(String(r.h || ""), await sha("admin-device|" + String(q.t || "")))) await del(DEV + id);
      return J({ ok: true });
    }
    /* ما يلي للأدمن الداخل فقط (رمز الجلسة الموقَّع) */
    const me = await who(q.token); if (!me) return J({ ok: false, error: "auth" }, 401);
    const list = await admins(); const mine = list.find((x) => x && x.k === norm(me)); if (!mine) return J({ ok: false, error: "auth" }, 401);
    if (a === "list") return J({ ok: true, list: list.map((x) => ({ name: x.n, at: x.at || "", by: x.by || "" })) });
    if (a === "setkind") { const key = KINDS[String(q.kind)]; if (!key || pw.length < 4) return J({ ok: false, error: "bad" }, 400); await put(key, "sha256:" + await sha(pw)); return J({ ok: true }); }
    if (a === "add") {
      const n = String(q.name || "").trim(); if (n.length < 2 || n.length > 40 || pw.length < 4) return J({ ok: false, error: "bad" }, 400);
      if (list.some((x) => x.k === norm(n))) return J({ ok: false, error: "exists" }); list.push(await mkAcc(n, pw, me)); await put(ADMIN_KEY, JSON.stringify(list)); return J({ ok: true });
    }
    if (a === "setpw") {
      const acc = list.find((x) => x.k === norm(q.name)); if (!acc || pw.length < 4) return J({ ok: false, error: acc ? "bad" : "missing" }, 400);
      const f = await mkAcc(acc.n, pw, acc.by); acc.s = f.s; acc.i = f.i; acc.h = f.h; acc.pw_at = new Date().toISOString(); await put(ADMIN_KEY, JSON.stringify(list)); return J({ ok: true });
    }
    if (a === "remove") {
      const k = norm(q.name); if (!list.some((x) => x.k === k)) return J({ ok: false, error: "missing" }); if (k === norm(me)) return J({ ok: false, error: "self" }); if (list.length <= 1) return J({ ok: false, error: "last" });
      const gone = list.find((x) => x.k === k); await put(ADMIN_KEY, JSON.stringify(list.filter((x) => x.k !== k))); return J({ ok: true, name: gone.n });
    }
    if (a === "dev_remember") {
      const id = hex(crypto.getRandomValues(new Uint8Array(9))), t = hex(crypto.getRandomValues(new Uint8Array(32)));
      const rec = { k: mine.k, n: mine.n, s: mine.s, h: await sha("admin-device|" + t), at: new Date().toISOString(), ua: String(q.ua || "").slice(0, 120) };
      await put(DEV + id, JSON.stringify(rec));
      if (q.old) { const o = String(q.old).replace(/[^0-9a-f]/gi, ""); if (o && o !== id) await del(DEV + o); }
      return J({ ok: true, id, t, k: mine.k, n: mine.n, at: rec.at });
    }
    return J({ ok: false, error: "unknown" }, 400);
  } catch (e) { return J({ ok: false, error: String(e).slice(0, 120) }, 500); }

}
module.exports = async function handle(q) { let status = 200, res = null; const J = (o, s = 200) => { res = o; status = s; return o; }; await inner(q || {}, J); return { status, body: res }; };
