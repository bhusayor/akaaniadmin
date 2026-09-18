#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   AKAANI ADMIN — BLOG DRAFTING PROXY

   Holds the OpenAI API key so the browser never does.

     POST /generate-blog   a description    -> a markdown blog draft
     GET  /health          mode and model

   Ingredient nutrition estimates used to live here too. They are gone: the
   admin no longer calls a model from the browser for nutrition, and meal
   drafting goes to platform-api's POST /v1/meal-studio/chat instead.

   Node built-ins only — no npm, no build step, matching the rest of the
   repo.

     export OPENAI_API_KEY=sk-...
     npm run estimate-server

   Without a key it starts in mock mode and says so, so the flow can be
   exercised end to end before any credentials exist.

     MOCK=1 node server/estimate-server.js     # force mock
     PORT=8787 node server/estimate-server.js  # change the port
   ═══════════════════════════════════════════════════════ */

import http from 'node:http';
import https from 'node:https';
import { mockDraft } from '../src/lib/blogGenerate.js';

const PORT    = Number(process.env.PORT || 8787);
const API_KEY = process.env.OPENAI_API_KEY || '';
const MOCK    = process.env.MOCK === '1' || !API_KEY;

/* The one string to change if your account exposes a different model.
   Verify against the model list on your own OpenAI account — this
   default is chosen for being cheap and widely available, not because
   it is necessarily the best fit. */
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/* ══════════════════════════════════════
   OPENAI CALL
══════════════════════════════════════ */

const BLOG_TAGS = ['Nutrition', 'Recipes', 'West African Food', 'Health',
  'Meal Planning', 'Product Updates', 'Ingredients', 'Community'];

const BLOG_SYSTEM = [
  'You write for the Akaani blog — a West African meal-planning platform.',
  'Given a description, draft one post in Markdown.',
  '',
  'Rules:',
  '- Plain, direct prose. No filler, no "in today\'s fast-paced world".',
  '- Use ## and ### headings, lists and the occasional blockquote.',
  '- Ground it in West African food where the topic allows.',
  '- Do not invent statistics, studies or quotes. If a number matters and',
  '  you are unsure of it, describe the direction instead of citing a figure.',
  '- Never give clinical or medical advice.',
  '- tags must come from this list only: ' + BLOG_TAGS.join(', ')
].join('\n');

const BLOG_SCHEMA = {
  name: 'blog_draft',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'excerpt', 'body', 'tags', 'seoTitle', 'seoDescription'],
    properties: {
      title: { type: 'string' },
      excerpt: { type: 'string' },
      body: { type: 'string', description: 'Markdown' },
      tags: { type: 'array', items: { type: 'string' } },
      seoTitle: { type: 'string' },
      seoDescription: { type: 'string' }
    }
  }
};

function callOpenAI(system, user, schema, temperature, cb) {
  const payload = JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    response_format: { type: 'json_schema', json_schema: schema },
    temperature
  });

  const req = https.request({
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Authorization': 'Bearer ' + API_KEY
    }
  }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => {
      let json;
      try { json = JSON.parse(body); }
      catch (e) { cb(new Error('OpenAI returned a non-JSON body (HTTP ' + res.statusCode + ')')); return; }

      if (res.statusCode !== 200) {
        cb(new Error((json.error && json.error.message) || 'OpenAI HTTP ' + res.statusCode));
        return;
      }
      const content = json.choices && json.choices[0] && json.choices[0].message &&
                      json.choices[0].message.content;
      if (!content) { cb(new Error('OpenAI returned no content')); return; }

      let parsed;
      try { parsed = JSON.parse(content); }
      catch (e) { cb(new Error('Model output was not valid JSON')); return; }
      cb(null, parsed);
    });
  });

  req.on('error', (err) => cb(new Error('Could not reach OpenAI: ' + err.message)));
  req.write(payload);
  req.end();
}

/* ══════════════════════════════════════
   SERVER
══════════════════════════════════════ */

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    // The dashboard is opened from file://, whose origin is "null".
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }

  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true, mode: MOCK ? 'mock' : 'openai', model: MOCK ? 'mock' : MODEL });
    return;
  }

  if (!(req.method === 'POST' && req.url === '/generate-blog')) {
    send(res, 404, { error: 'POST /generate-blog, or GET /health' });
    return;
  }

  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 10000) { req.destroy(); }   // nothing legitimate is this large
  });

  req.on('end', () => {
    let parsedBody;
    try { parsedBody = JSON.parse(body); }
    catch (e) { send(res, 400, { error: 'Body must be JSON' }); return; }

    const prompt = String(parsedBody.prompt || '').trim().slice(0, 2000);
    if (prompt.length < 10) {
      send(res, 400, { error: 'A "prompt" of at least 10 characters is required' });
      return;
    }
    if (MOCK) {
      send(res, 200, { draft: mockDraft(prompt), model: 'mock' });
      return;
    }
    callOpenAI(BLOG_SYSTEM, prompt, BLOG_SCHEMA, 0.7, (err, draft) => {
      if (err) { send(res, 502, { error: err.message }); return; }
      send(res, 200, { draft, model: MODEL });
    });
  });
});

server.listen(PORT, () => {
  console.log('Akaani blog drafting proxy');
  console.log('  POST http://localhost:' + PORT + '/generate-blog');
  if (MOCK) {
    console.log('  mode: MOCK — no OPENAI_API_KEY set, returning deterministic fake values.');
    console.log('        set OPENAI_API_KEY and restart to call OpenAI for real.');
  } else {
    console.log('  mode: OpenAI (' + MODEL + ')');
  }
});
