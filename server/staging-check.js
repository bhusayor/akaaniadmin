#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   STAGING SEARCH CHECK

     npm run staging:check              # asks for email/password
     npm run staging:check -- egusi     # search for something else

   Logs in and runs the two searches the admin screens use, printing what
   the server actually returns: how many rows, and the first few names. It
   also lists each collection unfiltered, which is what separates "the
   search term matched nothing" from "this collection is empty on staging".

   Read-only: the only writes are the login and the Meal Studio turn, and
   that endpoint persists nothing — the draft round trips through the
   request, so a turn leaves the database exactly as it found it.
   ═══════════════════════════════════════════════════════ */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGIN_PATH, resolveToken } from './staging-token.js';

const BASE = (process.env.STAGING_API_URL || 'https://akaani-api-staging.herokuapp.com').replace(/\/+$/, '');

async function show(label, pathAndQuery, token, pick) {
  const url = `${BASE}${pathAndQuery}`;
  process.stdout.write(`\n${label}\n  GET ${pathAndQuery}\n`);
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  } catch (err) {
    process.stdout.write(`  request failed: ${err.message}\n`);
    return;
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* shown raw below */ }
  process.stdout.write(`  HTTP ${res.status}\n`);
  if (!json) {
    process.stdout.write(`  body: ${text.slice(0, 200)}\n`);
    return;
  }
  if (json.success === false) {
    process.stdout.write(`  ${json.name}: ${json.message}\n`);
    return;
  }
  const { count, total, names } = pick(json.data);
  process.stdout.write(`  rows on this page: ${count}${total === undefined ? '' : `   total matching: ${total}`}\n`);
  process.stdout.write(`  names: ${names.length ? names.slice(0, 5).join(' | ') : '(none)'}\n`);
}

/** One Meal Studio turn, printed in full: this is the call the panel makes. */
async function mealStudio(token, term) {
  const path = '/v1/meal-studio/chat';
  const body = { message: term, currentMeal: {}, mealSchemaVersion: 'meal.v1' };
  process.stdout.write(`\n5. Meal Studio draft (the right-hand panel)\n  POST ${path}\n`);
  process.stdout.write(`  body: ${JSON.stringify(body)}\n`);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
  } catch (err) {
    process.stdout.write(`  request failed: ${err.message}\n`);
    return;
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* shown raw */ }
  process.stdout.write(`  HTTP ${res.status}\n`);
  if (!json) {
    process.stdout.write(`  body: ${text.slice(0, 300)}\n`);
    return;
  }
  if (json.success === false) {
    process.stdout.write(`  ${json.name}: ${json.message}\n`);
    if (res.status === 401) {
      process.stdout.write('  → this account is not staff or admin. Meal Studio is isAdminOrStaff.\n');
    } else if (res.status === 502) {
      process.stdout.write('  → the endpoint works; the model call behind it failed (no OpenAI credit yet).\n');
    } else if (res.status === 409) {
      process.stdout.write(`  → schema mismatch. This admin sends "meal.v1"; the server wants "${json.data?.expected}".\n`);
    }
    return;
  }
  const meal = json.data?.meal || {};
  process.stdout.write(`  assistantMessage: ${String(json.data?.assistantMessage || '').slice(0, 160)}\n`);
  process.stdout.write(`  drafted name: ${meal.name || '(none)'}\n`);
  process.stdout.write(`  ingredients: ${(meal.ingredients || []).length}   steps: ${(meal.instruction_steps || meal.instructions || []).length}\n`);
}

const nutrition = (data) => ({
  count: data?.docs?.length ?? 0,
  names: (data?.docs ?? []).map((d) => `${d.name} [${d.source}]`),
});

const catalogue = (data) => ({
  count: data?.ingredients?.length ?? 0,
  total: data?.docs,
  names: (data?.ingredients ?? []).map((d) => d.name),
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const term = process.argv.slice(2).find((a) => !a.startsWith('-')) || 'rice';
  const token = await resolveToken({ ...process.env }, !process.env.STAGING_TEST_PASSWORD)
    .catch((err) => { process.stderr.write(`${err.message}\n`); process.exit(1); });

  process.stdout.write(`\n${BASE}  ·  logged in via ${LOGIN_PATH}  ·  searching for "${term}"\n`);

  await show('1. Nutrition search (ingredient form panel)', `/v1/nutrition/ingredients?search=${encodeURIComponent(term)}&page=1&limit=25`, token, nutrition);
  await show('2. Nutrition data, unfiltered', '/v1/nutrition/ingredients?page=1&limit=5', token, nutrition);
  await show('3. Ingredient catalogue search (Platform tab)', `/v1/ingredients?search=${encodeURIComponent(term)}&page=1&limit=20`, token, catalogue);
  await show('4. Ingredient catalogue, unfiltered', '/v1/ingredients?page=1&limit=5', token, catalogue);
  await mealStudio(token, term);

  process.stdout.write('\nIf 2 and 4 have rows but 1 and 3 do not, the search term is the problem.\n'
    + 'If 2 or 4 is empty, that collection has no data on staging.\n'
    + 'Section 5 says why Meal Studio is not drafting: 401 is the account, 502 is the model.\n');
}
