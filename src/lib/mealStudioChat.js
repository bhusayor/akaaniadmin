/* ═══════════════════════════════════════════════════════
   MEAL STUDIO CHAT

   The client half of the conversation. It never talks to OpenAI — the key
   lives on the proxy, and the browser only ever sees this app's endpoint.

   Mock is the default so the whole flow is exercisable with no key and no
   network. The mock is deterministic and reads the user's instruction, so
   a refinement turn actually changes the field it names rather than
   returning canned text.
   ═══════════════════════════════════════════════════════ */

import { sanitiseMeal, mergeDraft, SCHEMA_VERSION } from './mealStudio.js';

let config = { provider: 'mock', endpoint: '/meal-studio/chat' };

export function configure(next) {
  config = { ...config, ...next };
}

export const currentConfig = () => ({ ...config });

/* ── Mock ──────────────────────────────────────────────
   Enough behaviour to drive the UI honestly: it drafts on the first turn
   and edits named fields afterwards, so "make it 4 servings" moves
   servings and leaves everything else alone.
   ────────────────────────────────────────────────────── */

const TITLE_WORDS = /\b(?:with|using|and|for|a|an|the|make|create|draft|me|please)\b/gi;

function conceptName(prompt) {
  const cleaned = prompt.replace(TITLE_WORDS, ' ').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').filter(Boolean).slice(0, 4);
  if (!words.length) return 'New Meal';
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

export function mockTurn(message, currentMeal) {
  const said = String(message ?? '').toLowerCase();
  const has = (...words) => words.some((w) => said.includes(w));
  const draft = currentMeal ?? null;
  const isFirst = !draft?.name;

  if (isFirst) {
    const name = conceptName(message);
    const vegan = has('vegan', 'plant-based', 'plant based');
    return {
      assistantMessage: `Drafted ${name} as a starting point${vegan ? ', kept fully plant-based' : ''}. Tell me what to change — servings, ingredients, tone, or anything missing.`,
      meal: {
        name,
        description: `${name} — a West African inspired dish built around the request "${String(message).trim()}".`,
        types: has('breakfast') ? ['breakfast'] : has('dinner') ? ['dinner'] : has('snack') ? ['snack'] : ['lunch'],
        countries: ['Nigeria'],
        tags: vegan ? ['Vegetarian'] : ['High Protein'],
        servings: 2,
        prep: 30,
        portion: '1 plate',
        emoji: '🍽️',
        luTips: 'Season in layers and taste before the last five minutes.',
        ingredients: [
          { name: 'black-eyed peas', quantity: '2', unit: 'cups', description: 'peeled' },
          { name: 'onion', quantity: '1', unit: 'medium', description: 'chopped' },
          { name: 'red bell pepper', quantity: '1', unit: 'medium', description: 'blended' },
          { name: 'palm oil', quantity: '2', unit: 'tbsp', description: '' },
        ],
        instructions: [
          { text: 'Soak and peel the beans, then blend with the pepper and onion.', timeEstimate: '30 min' },
          { text: 'Whisk the batter until it lightens and holds air.', timeEstimate: '5 min' },
          { text: 'Fry in spoonfuls until golden and drain.', timeEstimate: '10 min' },
        ],
      },
    };
  }

  /* Refinement — touch only what was asked for. */
  const patch = {};
  const notes = [];

  const servings = /(\d+)\s*serving/.exec(said) || (has('serves') && /serves\s*(\d+)/.exec(said));
  if (servings) { patch.servings = Number(servings[1]); notes.push(`servings to ${patch.servings}`); }

  const mins = /(\d+)\s*(?:min|minute)/.exec(said);
  if (mins && has('cook', 'prep', 'time')) { patch.prep = Number(mins[1]); notes.push(`cook time to ${patch.prep} min`); }

  if (has('vegan', 'plant-based', 'plant based')) {
    patch.tags = [...new Set([...(draft.tags ?? []), 'Vegetarian'])];
    patch.ingredients = (draft.ingredients ?? []).filter(
      (i) => !/beef|chicken|fish|egg|milk|butter|meat|prawn|shrimp/i.test(i.name),
    );
    notes.push('removed animal ingredients and tagged it vegetarian');
  }

  if (has('step', 'instruction', 'method')) {
    patch.instructions = [
      ...(draft.instructions ?? []),
      { text: 'Rest briefly, then serve while hot.', timeEstimate: '2 min' },
    ];
    notes.push('added a closing step');
  }

  if (has('tag')) {
    patch.tags = [...new Set([...(draft.tags ?? []), 'Family Meals'])];
    notes.push('added a tag');
  }

  if (!Object.keys(patch).length) {
    return {
      assistantMessage: 'Nothing in that changed the recipe. Try naming a field — servings, cook time, tags, or an ingredient to swap.',
      meal: null,
    };
  }

  return {
    assistantMessage: `Updated ${notes.join(', ')}. Everything else is as it was.`,
    meal: patch,
  };
}

/* ── OpenAI, through this app's own server ───────────── */

async function viaServer(payload) {
  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Meal Studio server returned ${res.status}. ${body.slice(0, 160)}`);
  }
  return res.json();
}

/**
 * One conversational turn.
 *
 * @returns {Promise<{assistantMessage: string, meal: object|null, changed: boolean}>}
 *          `meal` is a patch, not a replacement — see mergeDraft.
 */
export async function sendTurn({ message, currentMeal, history = [] }) {
  const text = String(message ?? '').trim();
  if (!text) throw new Error('Say something first.');

  if (config.provider === 'mock') {
    /* A beat, so the UI's sending state is real rather than theoretical. */
    await new Promise((r) => setTimeout(r, 260));
    const turn = mockTurn(text, currentMeal);
    return { ...turn, meal: turn.meal ? sanitiseMeal(turn.meal) : null, changed: !!turn.meal };
  }

  const data = await viaServer({
    message: text,
    currentMeal,
    /* Bounded, so a long session cannot grow the request without limit. */
    history: history.slice(-12).map(({ role, content }) => ({ role, content })),
    mealSchemaVersion: SCHEMA_VERSION,
  });

  const meal = data?.meal ? sanitiseMeal(data.meal) : null;
  return {
    assistantMessage: String(data?.assistantMessage ?? '').trim() || 'Updated the draft.',
    meal,
    changed: !!meal && Object.keys(meal).length > 0,
  };
}

/** Applies a turn to a draft. Exported so the reducer stays testable. */
export const applyTurn = (draft, turn) => (turn.meal ? mergeDraft(draft, turn.meal) : draft);
