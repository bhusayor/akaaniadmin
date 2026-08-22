#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   AKAANI ADMIN — AI PROXY

   Holds the OpenAI API key so the browser never does.

     POST /estimate        ingredient name  -> five per-100g macros
     POST /generate-blog   a description    -> a markdown blog draft
     GET  /health          mode and model

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
import { mockEstimate, sanitizeMacros } from '../src/lib/nutritionEstimate.js';
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
   PROMPT

   Deliberately narrow: one food, per 100g, five numbers, and an explicit
   licence to answer null. A model pushed to always produce a number will
   always produce one, including for things it has never heard of.
══════════════════════════════════════ */

const SYSTEM = [
  'You are a food composition assistant for a West African meal-planning platform.',
  'Given one ingredient name, return its nutrition per 100 grams of the edible portion.',
  '',
  'Rules:',
  '- All values are per 100g, never per serving.',
  '- calories are kcal; protein_g, carbs_g, fat_g and fibre_g are grams.',
  '- If you are not reasonably confident about a value, return null for it.',
  '  A null is far more useful here than a guess: nulls are shown as gaps,',
  '  but numbers are stored and used to plan real meals.',
  '- If the name is not a food at all, return null for every field.',
  '- Prefer the raw/unprepared form unless the name states a preparation',
  '  (boiled, fried, roasted, dried, smoked).'
].join('\n');

const SCHEMA = {
  name: 'nutrition_per_100g',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g', 'note'],
    properties: {
      calories:  { type: ['number', 'null'] },
      protein_g: { type: ['number', 'null'] },
      carbs_g:   { type: ['number', 'null'] },
      fat_g:     { type: ['number', 'null'] },
      fibre_g:   { type: ['number', 'null'] },
      note:      { type: 'string', description: 'One short sentence on what was assumed.' }
    }
  }
};

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

/** The two-message form the estimate and blog routes use. */
function callOpenAI(system, user, schema, temperature, cb) {
  callOpenAIMessages([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], schema, temperature, cb);
}

/**
 * The multi-turn form. Meal Studio is a conversation, so it needs to send
 * the history rather than a single prompt.
 */
function callOpenAIMessages(messages, schema, temperature, cb) {
  const payload = JSON.stringify({
    model: MODEL,
    messages: messages,
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

/* ══════════════════════════════════════
   MEAL STUDIO

   Structured output, so the model returns an object rather than prose the
   server has to parse back out. `meal` is a *patch*: only the fields this
   turn changed, which is what lets the client keep everything else.
══════════════════════════════════════ */

const MEAL_PATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assistantMessage: {
      type: 'string',
      description: 'One or two sentences saying what changed. Never claim the meal was saved or published.',
    },
    changed: {
      type: 'boolean',
      description: 'False when the message asked for nothing that alters the recipe.',
    },
    meal: {
      type: ['object', 'null'],
      description: 'Only the fields this turn changed. Omit everything else so it keeps its value.',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        luTips: { type: 'string' },
        notificationMessage: { type: 'string' },
        portion: { type: 'string' },
        category: { type: 'string' },
        emoji: { type: 'string' },
        types: { type: 'array', items: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] } },
        tags: { type: 'array', items: { type: 'string' } },
        countries: { type: 'array', items: { type: 'string' } },
        healthConditions: { type: 'array', items: { type: 'string' } },
        servings: { type: ['number', 'null'] },
        prep: { type: ['number', 'null'] },
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              quantity: { type: 'string' },
              unit: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['name', 'quantity', 'unit', 'description'],
          },
        },
        instructions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              text: { type: 'string' },
              timeEstimate: { type: 'string' },
            },
            required: ['text', 'timeEstimate'],
          },
        },
      },
      required: [],
    },
  },
  required: ['assistantMessage', 'changed', 'meal'],
};

const STUDIO_SYSTEM = [
  'You are Meal Studio, a collaborative recipe editor inside the Akaani admin.',
  'You draft and refine West African meals, Nigerian and Ghanaian in particular, in a warm, plain, practical voice.',
  '',
  'Rules you must follow:',
  '- Return only the fields this turn changes. A field you omit keeps its current value.',
  '- Never reset a section the user did not ask you to change.',
  '- Set changed=false and meal=null when the message asks for nothing that alters the recipe.',
  '- Never say the meal has been saved, created or published. You cannot save; a person does that.',
  '- Do NOT provide calories or macronutrients. The admin computes those from FAO/INFOODS WAFCT',
  '  and USDA reference data once ingredients are set. Write the ingredients precisely instead:',
  '  a real quantity and a real unit for each, because that is what the calculation needs.',
  '- Prefer ingredients as they are actually named in West African cooking.',
  '- Make reasonable assumptions rather than asking questions, and say what you assumed.',
].join('\n');

function mealStudioTurn({ message, history, currentMeal }, cb) {
  if (MOCK) {
    cb(null, {
      assistantMessage: 'Mock mode — no model was called. Set OPENAI_API_KEY and restart to draft for real.',
      changed: false,
      meal: null,
      mode: 'mock',
    });
    return;
  }

  const messages = [
    { role: 'system', content: STUDIO_SYSTEM },
    ...history.filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 4000) })),
    {
      role: 'user',
      content: currentMeal
        ? `Current draft:\n${JSON.stringify(currentMeal)}\n\nInstruction: ${message}`
        : message,
    },
  ];

  callOpenAIMessages(messages, {
    name: 'meal_studio_turn', strict: true, schema: MEAL_PATCH_SCHEMA,
  }, 0.7, (err, parsed) => {
    if (err) { cb(err); return; }

    /* Model output is untrusted. The client sanitises it again against the
       field list, but nothing structurally broken gets that far. */
    if (!parsed || typeof parsed.assistantMessage !== 'string' || !parsed.assistantMessage.trim()) {
      cb(new Error('The model returned no reply.'));
      return;
    }
    const changed = !!parsed.changed && !!parsed.meal && typeof parsed.meal === 'object';
    cb(null, {
      assistantMessage: parsed.assistantMessage.trim(),
      changed,
      meal: changed ? parsed.meal : null,
      mode: 'openai',
      model: MODEL,
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }

  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true, mode: MOCK ? 'mock' : 'openai', model: MOCK ? 'mock' : MODEL });
    return;
  }

  const isEstimate = req.method === 'POST' && req.url === '/estimate';
  const isBlog = req.method === 'POST' && req.url === '/generate-blog';
  const isStudio = req.method === 'POST' && req.url === '/meal-studio/chat';
  if (!isEstimate && !isBlog && !isStudio) {
    send(res, 404, { error: 'POST /estimate, POST /generate-blog, POST /meal-studio/chat, or GET /health' });
    return;
  }

  /* A studio turn carries the running draft, so it is legitimately larger
     than an estimate request — but still bounded. */
  const LIMIT = isStudio ? 120000 : 10000;

  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > LIMIT) { req.destroy(); }
  });

  req.on('end', () => {
    let parsedBody;
    try { parsedBody = JSON.parse(body); }
    catch (e) { send(res, 400, { error: 'Body must be JSON' }); return; }

    if (isStudio) {
      const message = String(parsedBody.message || '').trim().slice(0, 4000);
      if (!message) { send(res, 400, { error: 'A "message" is required' }); return; }

      /* Bounded on the server too — a client is not trusted to have
         trimmed its own history. */
      const history = Array.isArray(parsedBody.history) ? parsedBody.history.slice(-12) : [];
      const currentMeal = parsedBody.currentMeal && typeof parsedBody.currentMeal === 'object'
        ? parsedBody.currentMeal : null;

      mealStudioTurn({ message, history, currentMeal }, (err, out) => {
        if (err) { send(res, 502, { error: err.message }); return; }
        send(res, 200, out);
      });
      return;
    }

    if (isBlog) {
      const prompt = String(parsedBody.prompt || '').trim().slice(0, 2000);
      if (prompt.length < 10) {
        send(res, 400, { error: 'A "prompt" of at least 10 characters is required' });
        return;
      }
      if (MOCK) {
        send(res, 200, { draft: mockDraft(prompt), model: 'mock' });
        return;
      }
      // Warmer than the nutrition call: this is prose, not measurement.
      callOpenAI(BLOG_SYSTEM, prompt, BLOG_SCHEMA, 0.7, (err, draft) => {
        if (err) { send(res, 502, { error: err.message }); return; }
        send(res, 200, { draft, model: MODEL });
      });
      return;
    }

    let name = parsedBody.name;

    if (!name || !String(name).trim()) {
      send(res, 400, { error: 'A non-empty "name" is required' });
      return;
    }
    name = String(name).trim().slice(0, 200);

    if (MOCK) {
      send(res, 200, {
        macros: mockEstimate(name),
        model: 'mock',
        note: 'Mock mode — no model was called. Set OPENAI_API_KEY and restart for real estimates.'
      });
      return;
    }

    callOpenAI(SYSTEM, 'Ingredient: ' + name, SCHEMA, 0, (err, parsed) => {
      if (err) { send(res, 502, { error: err.message }); return; }
      send(res, 200, {
        // Sanitised again server-side; the page sanitises too. Model output
        // is untrusted at every hop.
        macros: sanitizeMacros(parsed),
        model: MODEL,
        note: parsed.note || ''
      });
    });
  });
});

server.listen(PORT, () => {
  console.log('Akaani AI proxy');
  console.log('  POST http://localhost:' + PORT + '/estimate');
  console.log('  POST http://localhost:' + PORT + '/generate-blog');
  if (MOCK) {
    console.log('  mode: MOCK — no OPENAI_API_KEY set, returning deterministic fake values.');
    console.log('        set OPENAI_API_KEY and restart to call OpenAI for real.');
  } else {
    console.log('  mode: OpenAI (' + MODEL + ')');
  }
});
