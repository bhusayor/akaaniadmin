#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   STAGING TEST LOGIN

   Logs the test account from .env.local into the staging platform-api
   and hands back the bearer token, so other endpoints can be tried with
   it from curl, Postman or the /api-test screen.

     STAGING_API_URL=https://akaani-api-staging.herokuapp.com
     STAGING_TEST_EMAIL=...
     STAGING_TEST_PASSWORD=...

     npm run staging:token                      # prints the token
     TOKEN=$(npm run -s staging:token)
     curl -H "Authorization: Bearer $TOKEN" "$STAGING_API_URL/v1/units"

   Without STAGING_TEST_EMAIL / STAGING_TEST_PASSWORD, or with --prompt
   (`npm run staging:login`), it asks for them in the terminal instead:
   password hidden, prompts on stderr so $(...) still captures only the
   token. server/staging-login.sh does the same in pure shell.

   The Vite dev server imports stagingLogin() for the screen's
   "Log in with test account" button, so the password stays server-side
   and never reaches the browser bundle.

   Node built-ins only, like estimate-server.js.
   ═══════════════════════════════════════════════════════ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* The user login — the one the test account works with. */
export const LOGIN_PATH = '/v1/auth/login';

/** The test-account settings out of an env object (process.env or loadEnv). */
export function testAccountFrom(env) {
  return {
    baseUrl: String(env.STAGING_API_URL || '').replace(/\/+$/, ''),
    email: env.STAGING_TEST_EMAIL || '',
    password: env.STAGING_TEST_PASSWORD || '',
  };
}

/**
 * POSTs { email, password } and returns { token, user } from the
 * platform-api envelope ({ data: { token, user } }). Throws with the
 * server's own message when it refuses.
 */
export async function stagingLogin({ baseUrl, email, password }) {
  const missing = [
    !baseUrl && 'STAGING_API_URL',
    !email && 'STAGING_TEST_EMAIL',
    !password && 'STAGING_TEST_PASSWORD',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Missing: ${missing.join(', ')} — set it in .env.local, or run this in a terminal to be prompted`);
  }

  const res = await fetch(`${baseUrl}${LOGIN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* reported below */ }

  const token = json?.data?.token;
  if (!res.ok || typeof token !== 'string') {
    const reason = json?.message || text.slice(0, 200) || res.statusText;
    throw new Error(`POST ${LOGIN_PATH} -> HTTP ${res.status}: ${reason}`);
  }
  return { token, user: json.data.user || null };
}

/* Minimal KEY=value reader for the CLI; Vite does this itself in dev. */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/* Terminal prompts on stderr. One raw-mode reader for every prompt, with
   a shared buffer, so input typed or pasted ahead (email and password in
   one go) is kept for the next prompt instead of dropped. */
let pending = '';
function ask(question, hidden = false) {
  const { stdin, stderr } = process;
  // Raw mode before the prompt appears, or keys typed in between echo.
  stdin.setRawMode(true);
  stderr.write(question);
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (fn, arg) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write('\n');
      fn(arg);
    };
    const feed = (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          // Drop the \n of a \r\n pair, keep the rest for the next prompt.
          pending = chunk.slice(chunk[i + 1] === '\n' && ch === '\r' ? i + 2 : i + 1);
          finish(resolve, value);
          return true;
        }
        if (ch === '\u0003') {
          finish(reject, new Error('Cancelled'));
          return true;
        }
        if (ch === '\u007f' || ch === '\b') {
          if (value && !hidden) stderr.write('\b \b');
          value = value.slice(0, -1);
        } else {
          value += ch;
          if (!hidden) stderr.write(ch);
        }
      }
      return false;
    };
    const onData = (chunk) => { feed(String(chunk)); };

    stdin.setEncoding('utf8');
    const buffered = pending;
    pending = '';
    if (feed(buffered)) return;
    stdin.on('data', onData);
    stdin.resume();
  });
}

async function main(env, forcePrompt) {
  const account = testAccountFrom(env);
  if (forcePrompt) {
    account.email = '';
    account.password = '';
  }
  if (!account.baseUrl) account.baseUrl = 'https://akaani-api-staging.herokuapp.com';
  if ((!account.email || !account.password) && process.stdin.isTTY) {
    if (!account.email) account.email = (await ask('Email: ')).trim();
    if (!account.password) account.password = await ask('Password: ', true);
  }
  const { token } = await stagingLogin(account);
  process.stderr.write(`ok: ${token.slice(0, 20)}... (${LOGIN_PATH})\n`);
  process.stdout.write(`${token}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  // Exported variables win over the file, matching Vite.
  const env = { ...readEnvFile(path.join(root, '.env.local')), ...process.env };
  main(env, process.argv.includes('--prompt')).then(
    () => process.exit(0),
    (err) => {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    },
  );
}
