// Local test harness ONLY — not used in production.
// A tiny stand-in for the parts of Supabase's REST (PostgREST) and Auth (GoTrue) APIs
// that this app uses, backed by a plain Postgres. It lets us run the real app end-to-end
// against the real SQL (functions, triggers, RLS) without Docker.
//
//   DATABASE_URL=postgres://postgres@/booking_e2e?host=/var/run/postgresql node scripts/local-api/server.mjs
//
import http from "node:http";
import crypto from "node:crypto";
import pg from "pg";

const PORT = Number(process.env.PORT || 54321);
const JWT_SECRET = process.env.JWT_SECRET || "local-test-secret";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------- JWT
const b64u = (b) => Buffer.from(b).toString("base64url");
function signJwt(payload) {
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [h, p, s] = String(token || "").split(".");
  if (!h || !p || !s) return null;
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
  if (sig !== s) return null;
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

// ---------------------------------------------------------------- helpers
const IDENT = /^[a-z_][a-z0-9_]*$/;
const q = (id) => {
  if (!IDENT.test(id)) throw httpError(400, `bad identifier ${id}`);
  return `"${id}"`;
};
function httpError(status, message, code = "PGRST000") {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  return raw ? JSON.parse(raw) : null;
}
function userFromReq(req) {
  const auth = req.headers.authorization || "";
  const payload = verifyJwt(auth.replace(/^Bearer\s+/i, ""));
  return payload && payload.role === "authenticated" ? payload : null;
}
async function withRole(user, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${user ? "authenticated" : "anon"}`);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [user?.sub ?? ""]);
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------- foreign keys
let fkCache = null;
async function foreignKeys() {
  if (fkCache) return fkCache;
  const { rows } = await pool.query(`
    select c.conrelid::regclass::text as src, c.confrelid::regclass::text as dst,
           array(select a.attname::text from unnest(c.conkey) with ordinality k(n, o) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n order by k.o) as src_cols,
           array(select a.attname::text from unnest(c.confkey) with ordinality k(n, o) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n order by k.o) as dst_cols
    from pg_constraint c where c.contype = 'f' and c.connamespace = 'public'::regnamespace`);
  fkCache = rows.map((r) => ({ ...r, src: r.src.replace(/^public\./, ""), dst: r.dst.replace(/^public\./, "") }));
  return fkCache;
}

// ---------------------------------------------------------------- select parsing
function splitTop(s) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
function parseSelect(s) {
  return splitTop(s || "*").map((item) => {
    const m = item.match(/^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*)(!inner)?\((.*)\)$/s);
    if (m) return { kind: "embed", alias: m[1] || m[2], table: m[2], inner: Boolean(m[3]), children: parseSelect(m[4]) };
    if (item === "*") return { kind: "star" };
    if (item === "count") return { kind: "count" };
    return { kind: "col", name: item };
  });
}

// ---------------------------------------------------------------- filters
function parseValueList(v) {
  return v.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
}
function condition(alias, col, opExpr, params) {
  const dot = opExpr.indexOf(".");
  let op = opExpr.slice(0, dot);
  let val = opExpr.slice(dot + 1);
  let negate = false;
  if (op === "not") {
    negate = true;
    const d2 = val.indexOf(".");
    op = val.slice(0, d2);
    val = val.slice(d2 + 1);
  }
  const c = `${alias}.${q(col)}`;
  const p = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  let sql;
  switch (op) {
    case "eq": sql = `${c} = ${p(val)}`; break;
    case "neq": sql = `${c} <> ${p(val)}`; break;
    case "gt": sql = `${c} > ${p(val)}`; break;
    case "gte": sql = `${c} >= ${p(val)}`; break;
    case "lt": sql = `${c} < ${p(val)}`; break;
    case "lte": sql = `${c} <= ${p(val)}`; break;
    case "like": sql = `${c}::text like ${p(val.replace(/\*/g, "%"))}`; break;
    case "ilike": sql = `${c}::text ilike ${p(val.replace(/\*/g, "%"))}`; break;
    case "in": sql = `${c}::text = any(${p(parseValueList(val))}::text[])`; break;
    case "is": sql = `${c} is ${val === "null" ? "null" : val === "true" ? "true" : "false"}`; break;
    default: throw httpError(400, `unsupported operator ${op}`);
  }
  return negate ? `not (${sql})` : sql;
}
function orCondition(alias, expr, params) {
  const parts = splitTop(expr.replace(/^\(|\)$/g, ""));
  return "(" + parts.map((part) => {
    const d = part.indexOf(".");
    return condition(alias, part.slice(0, d), part.slice(d + 1), params);
  }).join(" or ") + ")";
}
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
function collectFilters(searchParams) {
  const own = [], byEmbed = {};
  for (const [key, value] of searchParams) {
    const [first, ...rest] = key.split(".");
    if (rest.length && (rest.at(-1) === "or" || !RESERVED.has(rest.at(-1)))) {
      // e.g. customers.or=(...), customers.name=eq.x
      (byEmbed[first] ??= []).push({ key: rest.join("."), value });
    } else if (!RESERVED.has(key)) own.push({ key, value });
  }
  return { own, byEmbed };
}
function whereFor(alias, filters, params) {
  return filters.map(({ key, value }) => (key === "or" ? orCondition(alias, value, params) : condition(alias, key, value, params)));
}

// ---------------------------------------------------------------- query building
let aliasN = 0;
async function buildSelect(table, alias, items, embedFilters, params) {
  const fks = await foreignKeys();
  const cols = [];
  const innerConds = [];
  for (const it of items) {
    if (it.kind === "star") cols.push(`${alias}.*`);
    else if (it.kind === "col") cols.push(`${alias}.${q(it.name)}`);
    else if (it.kind === "embed") {
      const a2 = `t${++aliasN}`;
      const toOne = fks.find((f) => f.src === table && f.dst === it.table);
      const toMany = fks.find((f) => f.src === it.table && f.dst === table);
      const fk = toOne || toMany;
      if (!fk) throw httpError(400, `no relationship ${table} -> ${it.table}`);
      const join = toOne
        ? fk.src_cols.map((c, i) => `${a2}.${q(fk.dst_cols[i])} = ${alias}.${q(c)}`).join(" and ")
        : fk.src_cols.map((c, i) => `${a2}.${q(c)} = ${alias}.${q(fk.dst_cols[i])}`).join(" and ");
      const conds = whereFor(a2, embedFilters[it.alias] ?? embedFilters[it.table] ?? [], params);
      const where = [join, ...conds].join(" and ");
      if (it.children.length === 1 && it.children[0].kind === "count") {
        cols.push(`(select json_build_array(json_build_object('count', count(*))) from public.${q(it.table)} ${a2} where ${where}) as ${q(it.alias)}`);
      } else {
        const inner = await buildSelect(it.table, a2, it.children, {}, params);
        cols.push(
          toOne
            ? `(select row_to_json(x) from (select ${inner.cols} from public.${q(it.table)} ${a2} where ${where} limit 1) x) as ${q(it.alias)}`
            : `(select coalesce(json_agg(x), '[]'::json) from (select ${inner.cols} from public.${q(it.table)} ${a2} where ${where}) x) as ${q(it.alias)}`,
        );
      }
      if (it.inner) innerConds.push(`exists (select 1 from public.${q(it.table)} ${a2} where ${where})`);
    }
  }
  return { cols: cols.join(", ") || `${alias}.*`, innerConds };
}
function orderBy(alias, spec) {
  if (!spec) return "";
  return " order by " + spec.split(",").map((part) => {
    const [col, ...mods] = part.split(".");
    const dir = mods.includes("desc") ? "desc" : "asc";
    const nulls = mods.includes("nullsfirst") ? " nulls first" : mods.includes("nullslast") ? " nulls last" : "";
    return `${alias}.${q(col)} ${dir}${nulls}`;
  }).join(", ");
}

// ---------------------------------------------------------------- handlers
async function handleRest(req, res, url, user) {
  const path = url.pathname.replace(/^\/rest\/v1\//, "");
  const prefer = String(req.headers.prefer || "");
  const wantsObject = String(req.headers.accept || "").includes("vnd.pgrst.object");

  if (path.startsWith("rpc/")) {
    const fn = path.slice(4);
    const args = (await readBody(req)) || {};
    const names = Object.keys(args);
    const params = names.map((n) => args[n]);
    const call = `public.${q(fn)}(${names.map((n, i) => `${q(n)} => $${i + 1}`).join(", ")})`;
    const meta = await pool.query(
      `select p.proretset, t.typtype from pg_proc p join pg_type t on t.oid = p.prorettype where p.proname = $1 and p.pronamespace = 'public'::regnamespace limit 1`,
      [fn],
    );
    if (!meta.rows.length) throw httpError(404, `function ${fn} not found`, "PGRST202");
    const { proretset, typtype } = meta.rows[0];
    const rows = await withRole(user, (c) => c.query(proretset || typtype === "c" ? `select * from ${call}` : `select ${call} as v`, params));
    const data = proretset ? rows.rows : typtype === "c" ? rows.rows[0] ?? null : rows.rows[0]?.v ?? null;
    return send(res, 200, data);
  }

  const table = path;
  q(table);
  const params = [];
  const { own, byEmbed } = collectFilters(url.searchParams);

  if (req.method === "GET" || req.method === "HEAD") {
    aliasN = 0;
    const sel = await buildSelect(table, "t0", parseSelect(url.searchParams.get("select")), byEmbed, params);
    const where = [...whereFor("t0", own, params), ...sel.innerConds];
    const whereSql = where.length ? ` where ${where.join(" and ")}` : "";
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");
    const sql = `select ${sel.cols} from public.${q(table)} t0${whereSql}${orderBy("t0", url.searchParams.get("order"))}${limit ? ` limit ${Number(limit)}` : ""}${offset ? ` offset ${Number(offset)}` : ""}`;
    const countSql = prefer.includes("count=exact") ? `select count(*)::int as n from public.${q(table)} t0${whereSql}` : null;
    const { rows, count } = await withRole(user, async (c) => ({
      rows: (await c.query(sql, params)).rows,
      count: countSql ? (await c.query(countSql, params)).rows[0].n : null,
    }));
    const from = Number(offset || 0);
    const headers = { "Content-Range": `${rows.length ? `${from}-${from + rows.length - 1}` : "*"}/${count ?? "*"}` };
    if (req.method === "HEAD") return send(res, 200, undefined, headers);
    if (wantsObject) {
      if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `${rows.length} rows`, hint: null });
      return send(res, 200, rows[0], headers);
    }
    return send(res, 200, rows, headers);
  }

  const returning = prefer.includes("return=representation") ? " returning *" : "";
  if (req.method === "POST") {
    const body = await readBody(req);
    const list = Array.isArray(body) ? body : [body];
    const cols = [...new Set(list.flatMap((r) => Object.keys(r)))];
    const values = list.map((r) => "(" + cols.map((c) => {
      params.push(r[c] === undefined ? null : r[c]);
      return `$${params.length}`;
    }).join(", ") + ")").join(", ");
    let sql = `insert into public.${q(table)} (${cols.map(q).join(", ")}) values ${values}`;
    const onConflict = url.searchParams.get("on_conflict");
    if (prefer.includes("resolution=merge-duplicates") && onConflict) {
      const keys = onConflict.split(",");
      sql += ` on conflict (${keys.map(q).join(", ")}) do update set ${cols.filter((c) => !keys.includes(c)).map((c) => `${q(c)} = excluded.${q(c)}`).join(", ")}`;
    }
    const r = await withRole(user, (c) => c.query(sql + returning, params));
    return send(res, 201, returning ? r.rows : undefined);
  }
  if (req.method === "PATCH") {
    const body = await readBody(req);
    const sets = Object.keys(body).map((k) => {
      params.push(body[k]);
      return `${q(k)} = $${params.length}`;
    });
    const where = whereFor("t0", own, params);
    const r = await withRole(user, (c) => c.query(`update public.${q(table)} t0 set ${sets.join(", ")}${where.length ? ` where ${where.join(" and ")}` : ""}${returning}`, params));
    return send(res, returning ? 200 : 204, returning ? r.rows : undefined);
  }
  if (req.method === "DELETE") {
    const where = whereFor("t0", own, params);
    await withRole(user, (c) => c.query(`delete from public.${q(table)} t0${where.length ? ` where ${where.join(" and ")}` : ""}`, params));
    return send(res, 204);
  }
  throw httpError(405, "method not allowed");
}

async function handleAuth(req, res, url) {
  const path = url.pathname.replace(/^\/auth\/v1\//, "");
  if (path === "token" && url.searchParams.get("grant_type") === "password") {
    const { email, password } = (await readBody(req)) || {};
    const { rows } = await pool.query(
      "select id, email, created_at from auth.users where lower(email) = lower($1) and encrypted_password = crypt($2, encrypted_password)",
      [email, password],
    );
    if (!rows.length) return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials", code: "invalid_credentials", msg: "Invalid login credentials" });
    return send(res, 200, session(rows[0]));
  }
  if (path === "token" && url.searchParams.get("grant_type") === "refresh_token") {
    const { refresh_token } = (await readBody(req)) || {};
    const p = verifyJwt(refresh_token);
    if (!p) return send(res, 400, { error: "invalid_grant", msg: "Invalid Refresh Token" });
    const { rows } = await pool.query("select id, email, created_at from auth.users where id = $1", [p.sub]);
    return send(res, 200, session(rows[0]));
  }
  if (path === "user") {
    const user = userFromReq(req);
    if (!user) return send(res, 401, { code: 401, msg: "invalid JWT", error_code: "bad_jwt" });
    const { rows } = await pool.query("select id, email, created_at from auth.users where id = $1", [user.sub]);
    if (!rows.length) return send(res, 401, { code: 401, msg: "user not found" });
    return send(res, 200, userJson(rows[0]));
  }
  if (path === "logout") return send(res, 204);
  return send(res, 404, { msg: "not found" });
}
const userJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: u.created_at });
function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const access = signJwt({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 });
  const refresh = signJwt({ sub: u.id, typ: "refresh", iat: now, exp: now + 86400 * 30 });
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user: userJson(u) };
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (process.env.LOG) console.log(new Date().toISOString().slice(11, 23), req.method, url.pathname, url.searchParams.get("status") ?? "");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,HEAD,OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range");
    if (req.method === "OPTIONS") return send(res, 204);
    try {
      if (url.pathname.startsWith("/auth/v1/")) return await handleAuth(req, res, url);
      if (url.pathname.startsWith("/rest/v1/")) return await handleRest(req, res, url, userFromReq(req));
      return send(res, 404, { message: "not found" });
    } catch (e) {
      const status = e.status || (e.code === "42501" ? 403 : 400);
      if (process.env.DEBUG) console.error(req.method, url.pathname + url.search, e.message);
      return send(res, status, { code: e.code || "PGRST000", message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
    }
  })
  .listen(PORT, () => console.log(`local api on http://127.0.0.1:${PORT}`));
