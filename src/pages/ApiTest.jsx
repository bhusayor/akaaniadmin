/* ═══════════════════════════════════════════════════════
   API TEST — TEMPORARY

   A scratch screen for checking that the real staging backend answers,
   and in what shape. Everything else in this admin runs on mock data;
   this is the one page that talks to a live server.

   Deliberately unpolished and deliberately self-contained: it sits
   outside Layout, holds its token in component state, and touches no
   provider. Delete the file and its route in App.jsx when the real
   integration lands.

   Point it at a backend with STAGING_API_URL (see .env.example). Requests
   go through the Vite dev-server proxy (vite.config.js), so the backend
   does not need to allow this origin in its CORS config.
   ═══════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Field, Input, Select, cx } from '../components/ui.jsx';

/* Both injected by `define` in vite.config.js. The browser only ever talks
   to API_BASE on its own origin; the dev server forwards it to the target. */
const STAGING_TARGET = __STAGING_API_URL__;
const API_BASE = __STAGING_PROXY_PATH__;
/* Dev-server route that logs in the .env.local test account (see
   server/staging-token.js). Only the email is known here, never the password. */
const TEST_LOGIN = __STAGING_TEST_LOGIN__;
const TEST_EMAIL = __STAGING_TEST_EMAIL__;

/* Login responses vary between backends; take the first string found. */
const TOKEN_PATHS = [
  ['data', 'token'],
  ['data', 'accessToken'],
  ['data', 'access_token'],
  ['token'],
  ['accessToken'],
  ['access_token'],
];
const findToken = (json) => {
  for (const path of TOKEN_PATHS) {
    const v = path.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), json);
    if (typeof v === 'string' && v) return v;
  }
  return null;
};

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/* The user login. Returns { data: { token, user } }; the token works for
   every isLoggedIn route. */
const LOGIN_PATH = '/v1/auth/login';

const UNITS = ['g', 'kg', 'oz', 'lb'];

/* Keys whose values must never be drawn on screen. This page prints the
   exact request body so a wrong shape is obvious at a glance — but a login
   body carries a real password, which would then sit in the panel, in any
   screenshot, and in any screen share. Sent verbatim, displayed redacted. */
const SECRET_KEY = /^(password|passwd|pwd|secret|token|api[_-]?key|authorization)$/i;

const redact = (value) => {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? '‹redacted for display›' : redact(v)]),
    );
  }
  return value;
};

/**
 * One fetch, with everything that could explain a failure kept rather
 * than thrown away: status, headers, the unparsed body, and the network
 * error itself if the request never got a response at all.
 */
async function call(url, { method = 'POST', token, body }) {
  /* fetch throws outright if a GET or HEAD carries a body, so a probe
     endpoint must not send one. */
  const sendsBody = body !== undefined && method !== 'GET' && method !== 'HEAD';

  const headers = {};
  /* Content-Type only where there is a body. On a bare GET it buys nothing
     and turns a simple request into a preflighted one, which can fail on
     its own and muddy the very thing this page is trying to diagnose. */
  if (sendsBody) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const started = performance.now();
  const report = {
    url,
    method,
    requestHeaders: { ...headers },
    requestBody: sendsBody ? redact(body) : null,
  };
  if (token) report.requestHeaders.Authorization = `Bearer ${token.slice(0, 8)}…`;

  let res;
  try {
    res = await fetch(url, { method, headers, ...(sendsBody ? { body: JSON.stringify(body) } : {}) });
  } catch (err) {
    /* fetch only rejects when no response was received: CORS rejection,
       DNS failure, refused connection, TLS error, offline. The browser
       deliberately does not tell scripts which — the Network tab and the
       console do. */
    return {
      ...report,
      ms: Math.round(performance.now() - started),
      networkError: `${err.name}: ${err.message}`,
    };
  }

  const bodyText = await res.text();
  let bodyJson = null;
  let parseError = null;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch (err) {
    parseError = err.message;
  }

  return {
    ...report,
    ms: Math.round(performance.now() - started),
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    /* CORS hides every response header that is not simple or explicitly
       listed in Access-Control-Expose-Headers, so a short list here is
       not proof the server sent nothing. */
    responseHeaders: Object.fromEntries(res.headers.entries()),
    bodyText,
    bodyJson,
    parseError,
  };
}

/* ── Result rendering ── */

function Line({ label, children, tone }) {
  return (
    <div className="flex gap-2 text-[12.5px]">
      <span className="w-32 shrink-0 text-ink-3">{label}</span>
      <span className={cx('min-w-0 break-all font-mono', tone || 'text-ink')}>{children}</span>
    </div>
  );
}

function Pre({ children }) {
  return (
    <pre className="scroll-thin max-h-[28rem] overflow-auto rounded-lg border border-line bg-canvas p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-ink">
      {children}
    </pre>
  );
}

/** The full outcome of one call — never summarised, never swallowed. */
function Result({ report }) {
  if (!report) return null;

  const failed = report.networkError || report.ok === false;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cx(
          'rounded-lg border px-3 py-2 text-[13px] font-semibold',
          failed ? 'border-chili/40 bg-chili-light text-chili-deep' : 'border-mint/40 bg-mint-light text-mint-deep',
        )}
      >
        {report.networkError
          ? 'Request failed — no response reached the browser'
          : `HTTP ${report.status} ${report.statusText}${report.ok ? '' : ' — request rejected'}`}
      </div>

      {report.networkError && (
        <div className="rounded-lg border border-amber/40 bg-amber-light p-3 text-[12.5px] leading-relaxed text-amber-deep">
          <div className="font-mono font-semibold">{report.networkError}</div>
          <p className="mt-2">
            fetch() rejects like this when no response arrives, and the browser refuses to say
            why. The usual causes are a CORS rejection (the server answered but without an
            <code className="mx-1 font-mono">Access-Control-Allow-Origin</code> header for
            <code className="mx-1 font-mono">{window.location.origin}</code>), a preflight
            <code className="mx-1 font-mono">OPTIONS</code> that was not answered, a wrong or
            unreachable host, or a TLS error. Open the browser console and the Network tab — the
            real reason is printed there and is not available to this page.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Line label="Request">{report.method} {report.url}</Line>
        <Line label="Duration">{report.ms} ms</Line>
        {report.parseError && (
          <Line label="JSON parse" tone="text-chili">{report.parseError} — raw body below</Line>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-semibold text-ink-2">Request headers</div>
        <Pre>{JSON.stringify(report.requestHeaders, null, 2)}</Pre>
      </div>

      {report.requestBody === null ? (
        <div className="text-[12.5px] text-ink-3">No request body (GET).</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-semibold text-ink-2">
            Request body
            <span className="ml-1 font-normal text-ink-3">
              (exactly what was sent — secret fields masked here only, never on the wire)
            </span>
          </div>
          <Pre>{JSON.stringify(report.requestBody, null, 2)}</Pre>
        </div>
      )}

      {report.responseHeaders && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-semibold text-ink-2">
            Response headers
            <span className="ml-1 font-normal text-ink-3">(CORS hides any not exposed by the server)</span>
          </div>
          <Pre>{JSON.stringify(report.responseHeaders, null, 2)}</Pre>
        </div>
      )}

      {report.bodyText !== undefined && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-semibold text-ink-2">
            Raw response body
            {report.bodyJson !== null && <span className="ml-1 font-normal text-ink-3">(parsed JSON, re-indented)</span>}
          </div>
          <Pre>
            {report.bodyText === ''
              ? '(empty body)'
              : report.bodyJson !== null
                ? JSON.stringify(report.bodyJson, null, 2)
                : report.bodyText}
          </Pre>
        </div>
      )}
    </div>
  );
}

/* ── Generic endpoint panel ── */

/** Any method, path, query string and JSON body, sent with the current token. */
function EndpointCard({ title, note, token, configured, initial }) {
  const [method, setMethod] = useState(initial.method);
  const [path, setPath] = useState(initial.path);
  const [query, setQuery] = useState(initial.query);
  const [body, setBody] = useState(initial.body);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bodyError, setBodyError] = useState(null);

  const takesBody = method !== 'GET' && method !== 'DELETE';
  const qs = query.trim().replace(/^\?/, '');
  const fullPath = `${path.startsWith('/') ? '' : '/'}${path}${qs ? `?${qs}` : ''}`;

  const send = async (e) => {
    e.preventDefault();
    let parsed;
    if (takesBody && body.trim()) {
      try {
        parsed = JSON.parse(body);
      } catch (err) {
        setBodyError(err.message);
        return;
      }
    }
    setBodyError(null);
    setBusy(true);
    setReport(null);
    setReport(await call(`${API_BASE}${fullPath}`, { method, token, body: parsed }));
    setBusy(false);
  };

  return (
    <Card className="p-4">
      <h2 className={cx('text-sm font-semibold text-ink', note ? 'mb-1' : 'mb-3')}>{title}</h2>
      {note && <p className="mb-3 text-[12.5px] leading-relaxed text-ink-3">{note}</p>}
      <form onSubmit={send} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Path" hint="relative to STAGING_API_URL">
            <Input value={path} onChange={(e) => setPath(e.target.value)} />
          </Field>
        </div>
        <Field label="Query string" hint="optional, e.g. q=rice&limit=20">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        {takesBody && (
          <Field label="JSON body" error={bodyError && `Not valid JSON: ${bodyError}`}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              spellCheck={false}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-[12px] text-ink outline-none transition focus:border-mint focus:ring-3 focus:ring-mint/8"
            />
          </Field>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy || !configured}>
            {busy ? 'Sending…' : `${method} ${fullPath}`}
          </Button>
          {!token && (
            <span className="text-[12.5px] text-amber-deep">
              No token — sent without an Authorization header, so a 401 is expected.
            </span>
          )}
        </div>
      </form>

      {report && (
        <div className="mt-4 border-t border-line pt-4">
          <Result report={report} />
        </div>
      )}
    </Card>
  );
}

/* ── Page ── */

export default function ApiTest() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(null); // in memory only, gone on reload
  const [loginReport, setLoginReport] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [pastedToken, setPastedToken] = useState('');


  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [unit, setUnit] = useState('g');
  const [calcReport, setCalcReport] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const configured = Boolean(STAGING_TARGET);

  const [testLoginError, setTestLoginError] = useState(null);

  const testLogin = async () => {
    setLoggingIn(true);
    setToken(null);
    setLoginReport(null);
    setTestLoginError(null);
    try {
      const res = await fetch(TEST_LOGIN, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.token) setToken(json.token);
      else setTestLoginError(json.message || `HTTP ${res.status} from the dev server`);
    } catch (err) {
      setTestLoginError(`${err.message} — is this page served by \`npm run dev\`?`);
    }
    setLoggingIn(false);
  };

  const login = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setToken(null);
    setLoginReport(null);
    const report = await call(`${API_BASE}${LOGIN_PATH}`, {
      body: { email, password },
    });
    /* If no token is found, say so loudly instead of quietly holding
       undefined and then sending "Bearer undefined" on the next call. */
    const found = findToken(report.bodyJson);
    if (found) setToken(found);
    else if (report.ok) report.tokenMissing = true;
    setLoginReport(report);
    setLoggingIn(false);
  };

  const calculate = async (e) => {
    e.preventDefault();
    setCalculating(true);
    setCalcReport(null);
    const report = await call(`${API_BASE}/v1/nutrition/calculate`, {
      token,
      body: {
        ingredients: [
          { ingredientId, quantity: Number(quantity), unit },
        ],
      },
    });
    setCalcReport(report);
    setCalculating(false);
  };

  return (
    <div className="scroll-thin h-screen overflow-y-auto bg-canvas">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 p-6">

        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-ink">API test</h1>
            <p className="text-[12.5px] text-ink-3">
              Temporary screen. Calls the real staging backend — nothing else in this admin does.
            </p>
          </div>
          <Link to="/dashboard" className="text-xs text-ink-3 underline hover:text-forest">
            ← back to dashboard
          </Link>
        </header>

        <Card className="p-4">
          <Line label="STAGING_API_URL" tone={configured ? 'text-ink' : 'text-chili'}>
            {configured ? STAGING_TARGET : 'not set'}
          </Line>
          <Line label="Browser calls">{window.location.origin}{API_BASE}/…</Line>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
            The dev server forwards those to STAGING_API_URL, so the backend's CORS settings do not
            apply here. A 502/504 or an HTML error page from the proxy means the dev server itself
            could not reach the backend — check the terminal running <code className="font-mono">npm run dev</code>.
          </p>
          {!configured && (
            <p className="mt-3 rounded-lg border border-chili/40 bg-chili-light p-3 text-[12.5px] leading-relaxed text-chili-deep">
              No backend configured. Put <code className="font-mono">STAGING_API_URL=https://…</code> in a
              <code className="mx-1 font-mono">.env.local</code> file at the repo root (or export it before
              <code className="mx-1 font-mono">npm run dev</code>) and restart the dev server — Vite only reads
              env files at startup.
            </p>
          )}
        </Card>

        {/* ── 1. Login ── */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">1 · Log in</h2>
          <form onSubmit={login} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="admin@example.com"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={loggingIn || !configured}>
                {loggingIn ? 'Posting…' : `POST ${LOGIN_PATH}`}
              </Button>
              <span
                className={cx(
                  'text-[12.5px] font-medium',
                  token ? 'text-mint-deep' : loginReport ? 'text-chili' : 'text-ink-3',
                )}
              >
                {token
                  ? `Logged in — token held in memory (${token.length} chars, starts ${token.slice(0, 8)}…)`
                  : loginReport
                    ? loginReport.tokenMissing
                      ? 'Server returned 2xx but no token field was recognised — see the raw body, or paste the token below'
                      : 'Login failed — see the report below'
                    : 'No token yet'}
              </span>
              {token && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(token)}
                  className="text-xs text-ink-3 underline hover:text-forest"
                >
                  copy token
                </button>
              )}
              {token && (
                <button
                  type="button"
                  onClick={() => setToken(null)}
                  className="text-xs text-ink-3 underline hover:text-chili"
                >
                  clear token
                </button>
              )}
            </div>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <Button type="button" variant="ghost" onClick={testLogin} disabled={loggingIn || !TEST_EMAIL}>
              Log in with test account
            </Button>
            <span className={cx('text-[12.5px]', testLoginError ? 'text-chili' : 'text-ink-3')}>
              {testLoginError
                || (TEST_EMAIL
                  ? `${TEST_EMAIL} from .env.local — the dev server logs in, the password never reaches this page`
                  : 'Set STAGING_TEST_EMAIL and STAGING_TEST_PASSWORD in .env.local, then restart npm run dev')}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
            <Field label="…or paste a bearer token" className="min-w-0 flex-1">
              <Input
                type="password"
                value={pastedToken}
                onChange={(e) => setPastedToken(e.target.value)}
                placeholder="eyJhbGciOi…"
                autoComplete="off"
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              disabled={!pastedToken.trim()}
              onClick={() => {
                setToken(pastedToken.trim().replace(/^Bearer\s+/i, ''));
                setPastedToken('');
              }}
            >
              Use token
            </Button>
          </div>

          {loginReport && (
            <div className="mt-4 border-t border-line pt-4">
              <Result report={loginReport} />
            </div>
          )}
        </Card>

        {/* ── platform-api endpoints. Defaults match its routes; every field
               stays editable so other routes can be tried from here too. ── */}
        <EndpointCard
          title="Search nutrition ingredients"
          note="Query: search (name or source category), source (usda | wafct), product_group, food_group_code, page, limit (max 100). An _id from here goes into Calculate below."
          token={token}
          configured={configured}
          initial={{ method: 'GET', path: '/v1/nutrition/ingredients', query: 'search=rice&page=1&limit=20', body: '' }}
        />
        <EndpointCard
          title="Create ingredient"
          note="The backend only allows this for accounts with a staff or admin record (isAdminOrStaff), so a plain user token gets 401 here. unit, product_group and product_category are ids — find them with the lookup panel below (GET /v1/units, /v1/product_groups, /v1/product_categories)."
          token={token}
          configured={configured}
          initial={{
            method: 'POST',
            path: '/v1/ingredients',
            query: '',
            body: JSON.stringify(
              {
                name: 'Test ingredient',
                description: 'Created from the admin API test screen',
                unit: '<unit id>',
                product_group: '<product group id>',
                product_category: '<product category id>',
              },
              null,
              2,
            ),
          }}
        />
        <EndpointCard
          title="Lookup / any other request"
          token={token}
          configured={configured}
          initial={{ method: 'GET', path: '/v1/units', query: '', body: '' }}
        />

        {/* ── Nutrition calculate ── */}
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Calculate nutrition</h2>
          <form onSubmit={calculate} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              <Field label="ingredientId" hint="an _id from search, or a numeric food_variant_id">
                <Input
                  value={ingredientId}
                  onChange={(e) => setIngredientId(e.target.value)}
                  placeholder="e.g. 65f1c0a…"
                />
              </Field>
              <Field label="quantity">
                <Input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
              <Field label="unit">
                <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={calculating || !configured}>
                {calculating ? 'Posting…' : 'POST /v1/nutrition/calculate'}
              </Button>
              {!token && (
                <span className="text-[12.5px] text-amber-deep">
                  No token — this will go out without an Authorization header, which is itself
                  worth seeing.
                </span>
              )}
            </div>
          </form>

          {calcReport && (
            <div className="mt-4 border-t border-line pt-4">
              <Result report={calcReport} />
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
