/* ═══════════════════════════════════════════════════════
   AKAANI ADMIN — AI NUTRITION ESTIMATOR

   The fallback for ingredients WAFCT does not cover. WAFCT is measured
   laboratory data; this is a language model's guess. The two are kept
   visibly distinct everywhere — different badge, different source string —
   because a meal planner that cannot tell measured from estimated is
   worse than one with gaps in it.

   Providers:
     'mock'   — offline, no key, deterministic. The default, so the whole
                flow can be exercised before any credentials exist.
     'openai' — POSTs to the local proxy in server/estimate-server.js,
                which holds the key server-side. The browser never sees it.

   Runs in the browser (<script>) and in Node (tests).
   ═══════════════════════════════════════════════════════ */

;(function (global) {
  'use strict';

  var CONFIG = {
    provider: 'mock',                              // 'mock' | 'openai'
    endpoint: 'http://localhost:8787/estimate',    // the local proxy
    timeoutMs: 20000
  };

  function configure(opts) {
    if (!opts) return CONFIG;
    Object.keys(opts).forEach(function (k) {
      if (opts[k] !== undefined) CONFIG[k] = opts[k];
    });
    return CONFIG;
  }

  var MACRO_KEYS = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fibre_g'];

  /* ══════════════════════════════════════
     SANITY GATE

     Everything crossing this boundary is model output, so it is treated
     as untrusted. A value that is not a sane per-100g number becomes
     null rather than being stored — a gap is recoverable, a plausible
     wrong number is not.

     Ceilings are physical: 100g of pure fat is ~900 kcal, and no single
     macro can exceed 100g per 100g of food.
  ══════════════════════════════════════ */

  var CEILINGS = { calories: 900, protein_g: 100, carbs_g: 100, fat_g: 100, fibre_g: 100 };

  function clampMacro(key, value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    if (typeof n !== 'number' || isNaN(n) || !isFinite(n)) return null;
    if (n < 0) return null;
    if (n > CEILINGS[key]) return null;          // implausible -> a gap, not a guess
    return Math.round(n * 10) / 10;
  }

  function sanitizeMacros(raw) {
    var out = {};
    MACRO_KEYS.forEach(function (k) {
      out[k] = clampMacro(k, raw ? raw[k] : null);
    });
    return out;
  }

  /* ══════════════════════════════════════
     MOCK PROVIDER

     Deterministic, so the same ingredient always yields the same numbers
     and tests can assert on them. Values are plausible but invented, and
     the source string says "mock" so nothing that lands in the library
     can be mistaken for real data.
  ══════════════════════════════════════ */

  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function mockEstimate(name) {
    var h = hash(String(name).toLowerCase());
    var protein = (h % 250) / 10;
    var carbs   = ((h >> 3) % 600) / 10;
    var fat     = ((h >> 6) % 300) / 10;
    var fibre   = ((h >> 9) % 90) / 10;
    return {
      calories:  Math.round(protein * 4 + carbs * 4 + fat * 9),
      protein_g: Math.round(protein * 10) / 10,
      carbs_g:   Math.round(carbs * 10) / 10,
      fat_g:     Math.round(fat * 10) / 10,
      fibre_g:   Math.round(fibre * 10) / 10
    };
  }

  /* ══════════════════════════════════════
     OPENAI PROVIDER (via the local proxy)

     The page never holds the API key. server/estimate-server.js owns it
     and is the only thing that talks to OpenAI.
  ══════════════════════════════════════ */

  function postJSON(url, body, timeoutMs, cb) {
    if (typeof fetch !== 'function') {
      cb(new Error('fetch is unavailable in this environment'));
      return;
    }
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      cb(new Error('Estimate timed out after ' + Math.round(timeoutMs / 1000) + 's'));
    }, timeoutMs);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var json = null;
          try { json = JSON.parse(text); } catch (e) { /* non-JSON body */ }
          if (!res.ok) {
            var msg = (json && (json.error || json.message)) || ('Proxy returned ' + res.status);
            throw new Error(msg);
          }
          return json;
        });
      })
      .then(function (json) {
        if (done) return;
        done = true; clearTimeout(timer);
        cb(null, json);
      })
      .catch(function (err) {
        if (done) return;
        done = true; clearTimeout(timer);
        // A dead proxy is the common case before setup — say so plainly.
        cb(new Error(/failed to fetch|networkerror|load failed/i.test(err.message)
          ? 'Could not reach the estimate server at ' + CONFIG.endpoint +
            ' — start it with: node server/estimate-server.js'
          : err.message));
      });
  }

  /* ══════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════ */

  /**
   * Estimates per-100g nutrition for one ingredient name.
   * @param {string} name
   * @param {function(Error, object)} cb  result: { name, macros, model, source, confidence, note }
   */
  function estimate(name, cb) {
    if (typeof cb !== 'function') throw new Error('estimate() needs a callback');
    if (!name || !String(name).trim()) {
      cb(new Error('An ingredient name is required'));
      return;
    }
    name = String(name).trim();

    if (CONFIG.provider === 'mock') {
      // Async on purpose: the real provider is, and callers should not
      // accidentally depend on synchronous behaviour that disappears later.
      setTimeout(function () {
        cb(null, buildResult(name, mockEstimate(name), 'mock',
          'Mock estimate — no model was called. Wire up server/estimate-server.js for real values.'));
      }, 250);
      return;
    }

    if (CONFIG.provider === 'openai') {
      postJSON(CONFIG.endpoint, { name: name }, CONFIG.timeoutMs, function (err, json) {
        if (err) { cb(err); return; }
        if (!json || !json.macros) { cb(new Error('Estimate server returned no macros')); return; }
        cb(null, buildResult(name, json.macros, json.model || 'openai', json.note || ''));
      });
      return;
    }

    cb(new Error('Unknown provider: ' + CONFIG.provider));
  }

  function buildResult(name, rawMacros, model, note) {
    var macros = sanitizeMacros(rawMacros);
    var known = MACRO_KEYS.filter(function (k) { return macros[k] !== null; }).length;
    return {
      name: name,
      macros: macros,
      model: model,
      source: 'AI estimate (' + model + ')',
      confidence: 'estimated',
      complete: known === MACRO_KEYS.length,
      note: note || ''
    };
  }

  /**
   * Estimates a list of names one at a time, reporting progress.
   * Sequential on purpose — it keeps ordering stable and avoids firing a
   * burst of billable requests at a rate limit.
   */
  function estimateMany(names, onProgress, onDone) {
    var results = [];
    var i = 0;
    function next() {
      if (i >= names.length) { onDone(results); return; }
      var name = names[i];
      estimate(name, function (err, res) {
        results.push({ name: name, error: err ? err.message : null, result: err ? null : res });
        i++;
        if (onProgress) onProgress(i, names.length, name);
        next();
      });
    }
    if (!names.length) { onDone(results); return; }
    next();
  }

  var api = {
    configure: configure,
    estimate: estimate,
    estimateMany: estimateMany,
    sanitizeMacros: sanitizeMacros,
    clampMacro: clampMacro,
    mockEstimate: mockEstimate,
    MACRO_KEYS: MACRO_KEYS,
    CEILINGS: CEILINGS,
    get config() { return CONFIG; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.NutritionEstimate = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
