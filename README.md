# Akaani Admin Dashboard

Admin dashboard for the **Akaani** AI-powered food and meal planning platform.
**React 19 + Vite + Tailwind CSS v4.**

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script | Does |
|--------|------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build into `dist/` |
| `npm run build:watch` | Rebuilds `dist/` on every save — for the Live Server flow below |
| `npm run preview` | Serve the built bundle |
| `npm test` | Vitest — 306 tests |
| `npm run estimate-server` | The blog drafting proxy (see below) |
| `npm run staging:login` | Prompt for email/password and print a platform-api token |

### Using VS Code Live Server

**Point Live Server at `dist/`, not the project root.** The root `index.html`
is the Vite entry: it loads `/src/main.jsx`, and a plain static server can
neither compile that JSX nor resolve a bare `import … from 'react'` — it also
serves `.jsx` as `application/octet-stream`, which browsers refuse to execute
as a module. The result is a blank page.

The built output has none of those problems (relative asset paths, `HashRouter`,
no bare specifiers), so:

```bash
npm run build:watch      # leave running; rebuilds dist/ as you edit
```

then right-click `dist/index.html` → **Open with Live Server**. Saving a file
rebuilds `dist/` and Live Server reloads.

`npm run dev` is still the better loop — it has hot module replacement, so state
survives an edit. Live Server does a full page reload.

If the root ever does get opened directly, the page now explains this instead of
showing nothing.

---

## Platform API

The admin signs in against **platform-api** and uses it in four places. Everything
else still runs on local fixtures.

| Where | Endpoint |
|-------|----------|
| Login screen (`#/login`); every admin route requires it | `POST /v1/auth/login` (the user login) |
| Ingredients → **Platform** tab: list, search, page, create, edit, delete | `GET/POST /v1/ingredients`, `PATCH/DELETE /v1/ingredients/:id`, plus `/v1/units`, `/v1/product_groups`, `/v1/product_categories` for the dropdowns |
| Ingredients → **Nutrition library** → ingredient form → *Search the platform nutrition database* | `GET /v1/nutrition/ingredients` |
| Meal editor → Ingredients list → *Link nutrition data*; the running total above Save | `POST /v1/nutrition/calculate` |
| Meal editor → **Meal Studio** panel: AI meal drafting | `POST /v1/meal-studio/chat` |

Setup: put `STAGING_API_URL=https://akaani-api-staging.herokuapp.com` in
`.env.local` and restart `npm run dev`. In development the browser calls
`/staging-api/*` and the Vite dev server forwards it, so CORS never applies. A
production build calls `VITE_API_URL` (or `STAGING_API_URL`) directly, so that
backend must allow the deployed origin.

Things the backend decides, not this app:

- **Creating, editing and deleting platform ingredients needs a staff or admin
  account.** A plain user gets a 401 that says only "Authorization is
  required"; the form translates it into a permission message and keeps you
  signed in. Only "Failed to verify request token" (expired or invalid) signs
  you out.
- **Platform ingredients hold no nutrition.** Macros live in the Nutrition
  library tab, which stays local until the backend has somewhere to store them.
- **The calculator converts g, kg, oz and lb only.** Rows in cups, tbsp etc.
  are listed as left out rather than silently dropped, and a nutrient no
  ingredient has data for stays blank instead of becoming 0.
- **Meal Studio is staff/admin only, and drafts nothing today.** The endpoint
  is live on staging, but the company OpenAI account has no credit, so it
  answers `502 BadGatewayError`. The panel prints the status, the server's exact
  message and the conversation id rather than hiding it. The endpoint never
  writes: a failed turn leaves the form exactly as it was, and a draft reaches
  the form only when someone clicks *Apply*.
- **Meal Studio sends `mealSchemaVersion: "meal.v1"`** (`src/lib/mealStudio.js`).
  If the server drafts against a different version it answers `409` and names
  it; that is a signal to update the mapping in that file, not to retry.
- The session token lives in `sessionStorage` and is gone when the tab closes.

`src/lib/api.js` is the only file that talks to the backend. `#/api-test` is
a raw request/response screen for trying other endpoints.

---

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Splash | `#/` | Animated entry, redirects to the dashboard |
| Dashboard | `#/dashboard` | Lu insight banner, stat cards with sparklines, revenue chart, users by country, recent activity |
| Customers | `#/customers` | 207 customers — search, filter, sort, paginate, bulk select, status toggle, delete, CSV export |
| Meals | `#/meals` | Flat card grid, 10 per page, filter by type/country/tag, Copy ID, CSV export |
| Meal details | `#/meals/:id` | Full recipe view with edit and delete |
| Meal edit | `#/meals/edit/:id` | Full-page form, collapsible sections |
| Recipe Groups | `#/recipe-groups` | Sellable recipe bundles — create, edit, delete |
| Meal Tags | `#/meal-tags` | Tag vocabulary, usage counts, bulk edit, attach meals |
| LU Facts | `#/lu-facts` | Short facts Lu shows beside an ingredient |
| Blogs | `#/blogs` | Post cards by status, filters, write or generate |
| Blog editor | `#/blogs/new`, `#/blogs/edit/:id` | Markdown editor with live preview |
| Ingredients | `#/ingredients` | Two live tables: the platform ingredient catalogue, and the WAFCT + USDA nutrition data |
| Settings | `#/settings` | Nine panels across Account, Platform, Notifications, Team and Data |

`HashRouter` is used deliberately, so a built bundle still works when opened
off disk or served from a sub-path.

---

## Project structure

```
akaani-admin/
├── index.html                  ← Vite entry
├── vite.config.js
├── src/
│   ├── main.jsx  App.jsx       ← routes; the Ingredients route is lazy-loaded
│   ├── index.css               ← Tailwind import + @theme design tokens
│   ├── components/             ← Layout, Sidebar, Topbar, NotificationDrawer,
│   │                             Modal, Toast, icons, ui primitives
│   ├── pages/                  ← one component per route
│   ├── features/ingredients/   ← catalogue table + form, nutrition data table
│   ├── hooks/useTopbar.js      ← page ↔ shared topbar
│   ├── data/                   ← customer, meal and notification fixtures
│   └── lib/                    ← framework-free logic, with the tests beside it
│       ├── recipeGroups.js     ← bundle record, money formatting, validation
│       ├── mealTags.js         ← tag record, usage counts, orphan detection
│       ├── luFacts.js          ← fact record, length budget, duplicate subjects
│       ├── settings.js         ← defaults, merge-on-load, AI validation
│       ├── markdown.js         ← markdown → token tree (no HTML, no injection)
│       ├── blogs.js            ← post record, slug, excerpt, reading time
│       ├── blogGenerate.js     ← AI drafting (mock + openai)
│       ├── taxonomy.js         ← product groups/categories/units, dataset-free
│       ├── api.js             ← the only file that calls platform-api
│       ├── mealStudio.js      ← meal form ↔ Meal Studio draft shape
│       ├── csv.js              ← parse / serialise / download
│       └── mealNutrition.js    ← calculate lines in, totals out
└── server/estimate-server.js   ← zero-dependency proxy holding the API key
```

Everything under `src/lib/` is plain JavaScript with no React import, which is
why it can be tested directly and why the same request layer serves every screen
that talks to the platform.

---

## Design tokens

The palette from the original build is carried over verbatim as Tailwind v4
`@theme` tokens in `src/index.css`, so `bg-forest`, `text-mint`, `border-line`
and friends resolve to the same colours as the old CSS variables.

| Token | Value | |
|-------|-------|---|
| `forest` | `#003232` | Sidebar / primary |
| `accent` | `#5DCAA5` | Teal |
| `mint` | `#1D9E75` | Success, WAFCT |
| `amber` / `rust` | `#C8A97E` / `#7A4F2A` | AI estimates |
| `chili` | `#E24B4A` | Danger |
| `canvas` / `surface` | `#F5F6FA` / `#FFFFFF` | Background / cards |
| Font | Outfit | Google Fonts |

Fully responsive at the same breakpoints as before: the sidebar becomes an
off-canvas drawer under 768px, grids collapse, and modals slide up from the
bottom.

---

## Recipe Groups

A recipe group is a **bundle sold on the marketing site** — a cover, a price, a
plan, the recipes inside it and the benefits it claims. Rows show the cover,
description, meal-type pills and a meta line, with edit and delete on hover.

**Add new** and **Edit** open the same right-hand drawer; **Delete** confirms
first and says plainly that the recipes inside the bundle are not deleted with
it. All three are wired to a provider, so a change made in the drawer is on the
list when it closes.

Four things beyond the production page:

- **Recipe count and price-per-recipe are derived**, not stored. The live page
  shows a stored `Recipes: 4` that can drift from the list it describes; here
  the count comes from the array, and the drawer footer shows what a buyer pays
  per recipe as you add or remove them — the clearest signal of whether a bundle
  is priced sensibly against the others.
- **Status** (`live` / `draft` / `retired`), so a bundle can be staged before it
  goes on sale. New groups default to `draft` — nothing puts itself on sale.
- **Prices always render to two decimals** with the right symbol; `$5` reads as
  a typo, `$5.00` does not. A missing price is an em dash, never `0`.
- **Validation reports every problem at once** rather than one field at a time.

### On money and blank input

`toNum` keeps a cleared price `null` instead of `0`, and validation trims before
counting — `filter(Boolean)` alone treats `'   '` as a real benefit, which would
have let a bundle save with a benefit made entirely of spaces. There is a test
for that; it caught the bug.

A price of `0` is deliberately allowed. Free bundles are a real thing, and
rejecting them would be the code second-guessing the business.

---

## Meal Tags

The tag vocabulary — name, category, description — with the counts that make it
useful.

**The tag→meal relationship lives on the meal**, not on the tag. There is no
stored `mealCount` to drift; the number in the Meals column is computed from the
meals themselves, and clicking it opens the picker for which meals carry that
tag.

Five things beyond the production page:

- **Usage counts.** A tag page exists to show which tags are earning their
  keep; the live page shows none. The stat strip also surfaces **unused** tags —
  a tag nothing uses is either brand new or dead, and both are worth knowing.
- **Orphan detection.** Tag strings that meals use but the vocabulary does not
  define are called out in a banner with a one-click adopt. These are the ones
  that quietly break filtering: the meal carries the tag, nothing else knows it
  exists. The seed data has one (`Quick Meals`) so the case is visible.
- **Category is a select, not free text.** The live form is a plain input, which
  is how `Special Occassion` got into the data. Adding a genuinely new category
  is still one click, and reuses existing casing rather than creating a
  near-duplicate.
- **Renaming a tag rewrites it on every meal that carries it.** Otherwise the
  meals keep the old string and silently fall out of the filter. Deleting
  detaches it from those meals first, and the confirm says how many meals are
  affected and that the meals themselves survive.
- **Bulk select** to recategorise or delete several tags at once.

### Attaching meals is signposted

The Meals column is a bordered control with an icon and a verb, not a badge:
`8 meals · Manage` when the tag is in use, `+ Attach meals` when it is not. The
same action also sits in the Actions column, and those icons stay visible
rather than appearing on hover — attaching meals is what this page is for, and
a hover-only affordance is how it went unnoticed the first time.

The picker itself is one checkable list with a diff summary
(`3 to add, 1 to remove`). The production modal shows the same selection twice —
as chips inside the input and again underneath — which doubles the reading
without adding anything.

### Duplicate tags are rejected case-insensitively

`Comfort Food` and `comfort food` are the same tag, and allowing both would
split a meal's tagging in half. Tested.

---

## LU Facts

The short facts Lu surfaces beside an ingredient. Each has a subject, the fact
itself, a category, a status and an optional link to an ingredient.

**The editor leads with a live preview of the Lu card**, because that is what a
reader actually sees, and because the body has a real length budget — these
render in a small in-app card, so a fact that reads fine in a textarea can clip
on a phone.

- A **length bar** runs green → amber → red against a comfortable length (160)
  and a hard limit (220). Over the limit blocks the save and says by how many
  characters; merely long is a warning, not an error.
- The list surfaces a **Running long** count, so facts that will look cramped
  are findable without opening each one.
- **Duplicate subjects are rejected case-insensitively**, and where a subject
  legitimately has more than one fact the page says so — Lu picks one at
  random, so both need to be true.
- The list shows **two lines of the actual fact**, not one clipped line. The
  point of the row is to let you read it.
- Search covers the **body and the linked ingredient**, not just the title —
  the phrase you remember is usually in the fact itself.
- Editing **stamps the updated date**, so the list sorts by genuine recency
  rather than by when a fact was first written.

Icons are emoji by default with an image upload as an override. A fact about a
single ingredient reads fine as an emoji, and it avoids the licensing that real
produce photography would need.

---

## Blogs

Posts are cards grouped by status, newest first, with a strip showing how many
are actually **published** versus sitting in draft — the first question anyone
opens this page to answer. A published card carries its live date; a draft says
`not live` next to the date it was created. Every card shows the featured image,
reading time and tags.

Two ways in, one editor:

**Write a post** opens an empty markdown editor — title, formatting toolbar,
Write/Preview toggle, and a rail for excerpt, featured image, tags, publish date
and SEO (with a search-result preview).

**Generate with AI** takes a description of what the post should cover and
returns a draft: title, excerpt, markdown body, tags and SEO fields. It opens in
the same editor as an **unsaved draft** — it can never publish itself, and the
modal says so before you accept it. The prompt is kept on the record, and the
post carries an `AI draft` badge in the admin so an editor can see where it came
from. That badge is provenance, not a warning: blogs are reviewed before they go
live, unlike nutrition figures.

Both paths produce the same shape, so a generated post and a hand-written one
are indistinguishable to the reader — image, date, reading time, tags, excerpt,
SEO.

### Reading time and excerpts are derived

`readingTime` and `wordCount` are getters on the record, computed from the body
at 200 wpm, so they cannot go stale when a post is edited. An excerpt left blank
falls back to the opening prose cut on a word boundary, so a card is never empty.

### Markdown is parsed to a tree, not to HTML

`src/lib/markdown.js` emits tokens and `Markdown.jsx` builds React elements from
them. Nothing reaches `dangerouslySetInnerHTML`, so a `<script>` in a post is
text rather than an injection — there is a test for exactly that.

### The generation endpoint

The key never reaches the browser:

```
POST /generate-blog   a description    -> a markdown blog draft
GET  /health          mode and model
```

It runs in mock mode with no key — deterministic placeholder prose with real
structure (headings, lists, a quote), enough to exercise the editor, preview and
reading time. The blog prompt runs warmer than the nutrition one (0.7 vs 0) and
forbids inventing statistics or giving clinical advice.

---

## Settings

A left nav column grouped **Account / Platform / Notifications / Team / Data**,
with each panel built from titled cards, form rows and a save row. Settings
**persist to localStorage and are read by the app** — before this they were
local state plus a toast, so every control was decorative.

| Panel | Holds |
|-------|-------|
| Profile | Avatar upload (2MB cap), split first/last name, email, phone, job title, read-only role, danger zone |
| Password | Change password with a live strength meter, TOTP / SMS / backup codes |
| General | Platform name, support email, tagline, support URL, and the default behaviours |
| Localization | Timezone, language, currency, date format, week start, measurement system |
| AI & Integrations | Provider, proxy URL, model, connection test, per-feature switches |
| Notifications | Email, push and SMS groups, plus delivery frequency |
| Members | Invite by email and role; a table with role, joined date, status and removal |
| Roles & Permissions | A 9 × 3 permission matrix |
| Data & Export | Settings export, auto-publish, reset |

### Settings that actually do something

| Setting | Effect |
|---------|--------|
| Localization → Measurement system | Drives the unit list on the ingredient form (`g/kg/ml` ↔ `oz/lbs`) |
| Localization → Primary currency | The currency a new recipe group starts in |
| AI → Provider and proxy URL | Reconfigures `blogGenerate` at runtime |

**Test connection** asks the proxy `/health` what it is actually running rather
than assuming the settings and the server agree. The API key is deliberately
*not* a field: it belongs in the environment running `npm run estimate-server`,
and a key typed into a browser field would be readable by anyone who opens the
page.

### Roles and the guards around them

Roles are **Admin / Manager / Viewer**, and a role is granted rather than
self-assigned — so Profile shows yours read-only with a link through to Members,
which is where roles change.

| Rule | Why |
|------|-----|
| Nobody can change their own role | Otherwise the read-only Profile field is a formality anyone walks around |
| The last Admin cannot be demoted or removed | Otherwise nobody is left who can manage the account |
| You cannot remove yourself | Same |
| **Admin is locked on every permission row** | A partial Admin is how an account ends up with nobody who can fix it |

Invites validate the address and refuse someone already on the team,
case-insensitively.

### Password strength needs more than length

Score 0–3: eight characters gets one point, mixed case *and* a digit gets
another, a symbol gets the third. `password` therefore reads **Weak**, not
strong — length alone never clears the bottom band.

### What is deliberately not configurable

**Nutrition stays per 100g.** It reads like a natural preference to expose, but
changing the basis would silently reinterpret every figure already stored. The
Localization panel says so where someone would look for the switch.

Loading merges stored values over the defaults section by section, so a settings
blob written before a key existed never leaves that key `undefined` — array
sections are replaced wholesale rather than spread, and corrupt storage falls
back to defaults rather than taking the app down.

Still not wired, and labelled as such rather than pretending: password change,
backup codes, account deactivation and deletion, and the invite email itself all
need a backend.

---

## Images

Photos live in `public/` and are served locally — no runtime CDN call, so the
dashboard renders offline and nothing about who is browsing leaks to a third
party.

| | Source | Notes |
|---|--------|-------|
| `public/avatars/` | randomuser.me portraits (16) | Assigned deterministically by customer index, so a customer always keeps the same face |
| `public/meals/` | Flickr via loremflickr (6) | Visually confirmed to depict the dish **and** licensed for commercial use — see `public/meals/CREDITS.md` |
| `public/recipe-groups/` | Flickr via loremflickr (5) | Same two gates; see `public/recipe-groups/CREDITS.md` |

`Avatar` and `MealThumb` (`src/components/Avatar.jsx`) degrade to coloured
initials and the meal's emoji respectively — on a missing `src` and on a load
error alike. A broken image in a customer table is a confusing empty box;
initials still identify the person.

### Choosing an image

`ImagePicker` (`src/components/ImagePicker.jsx`) is the one control behind
*Choose an image* on both the meal form and the platform ingredient form. A
picked file is read as a **data URL**; anything over 300 KB is redrawn at
1024px as JPEG first, and the control says so rather than resizing silently.

That is fine for a meal, which never leaves the browser in this admin. **It is
not a finished answer for a platform ingredient**, which is saved through
`POST /v1/ingredients`: the data URL becomes the `image` field verbatim,
because the API has no upload route — the multipart middleware in platform-api
is wired to chat audio only, and the sole Cloudinary path serves a user's own
profile photo. Other clients reading `image` will get a data URL rather than a
CDN link, and the bytes live in the document.

The fix belongs on the backend: a multipart `POST` that puts the file through
the existing uploader into Cloudinary and returns its URL. When that exists,
one call inside `ImagePicker.readFile` replaces the data URL with the returned
link, and every form that uses the control picks the change up.

**Two caveats worth knowing before this goes near production:**

The portrait pool skews white/Western. For a customer base named Oyedele
Kehinde and Kofi Mensah in Lagos and Accra that is a poor fit; the 16 chosen
are the most suitable available from that pool, but it is not a good long-term
answer. Real brand photography or a licensed stock search would be.

`image` is set on a meal only where a photo passes two gates: it genuinely
shows that dish, **and** its licence permits commercial use. Keyword stock
search could not find *Egusi Soup & Fufu* or *Boiled Egg & Yam* at all — every
attempt returned the same unrelated fallback photo. Five further photos were
fetched and wired up before their licences were read, then removed: loremflickr
burns the licence into the image, and they turned out to be CC **NonCommercial**
(four of them also **NoDerivatives**, which forbids the cropping already
applied). `public/meals/CREDITS.md` records what was kept, what was removed and
why. 6 of 21 meals have a photo; the rest keep their emoji.

Note that the surviving photos are CC BY / BY-SA, so **attribution is
required** — the author credit burned into the bottom-left of each image is
load-bearing, not noise. BY-SA is also viral for the image itself.

---

## Meals

One card per meal, sorted by name, ten to a page.

The earlier build grouped meals under their tags, which double-counted:
**21 meals produced 39 cards**, because 16 of them carry more than one tag.
*Boiled Egg & Yam* is both High Protein and Low Carb, so it rendered twice, and
editing it in one group would have left a stale copy in the other. Tags are a
filter here, never a grouping — the `Meal Tags` row reports whether a meal has
any (hover the badge to see which).

`MealCard` reads `types` as an array, so a meal that is both Lunch and Dinner
shows both pills. The photo falls back to the meal's emoji on a missing `src`
or a load error.

### Meal details

The whole card is a link to `#/meals/:id`; `Copy ID` sits inside it and calls
`preventDefault` so it copies without navigating.

The detail page carries the photo, a nutrition panel, description, notification
message, Lu tips and tags, then three tabs — Ingredients, Instructions,
Incompatible Health Conditions — each showing its own count. **Delete** confirms,
removes the meal, and returns to the list; opening a deleted id afterwards
gives a proper not-found state rather than a blank page.

### The edit form

**Edit** goes to a full page at `#/meals/edit/:id`, built from collapsible
sections: Meal Studio, Details, Incompatible medical conditions, Nutrients,
Product group, Ingredients list, Cooking steps — with the meal's nutrition
total above the save action.

Ingredients and cooking steps are **structured, not strings**:

```js
ingredients: [{ name, description, quantity, unit }]
instructions: [{ text, timeEstimate, image, videoUrl }]
```

Keeping the prep note in its own field is what stops *"1 medium-sized onion,
sliced"* being torn into two ingredients downstream. The existing string
fixtures were parsed into this shape on migration — 60 of 146 ingredients
carried a recognisable unit.

Four things the production form does not do:

- **Sections say which state they are in.** A bare "Show" on a hairline reads
  as static text; these are real buttons with a rotating chevron, a Show/Hide
  label, and a count so a collapsed section still tells you what is inside.
- **The save bar is sticky**, so a form this long never has to be scrolled to
  be committed. It also reports "Unsaved changes" and stays disabled until
  something actually changes.
- **Calories per serving is derived** from total ÷ servings and shown
  read-only, so the two cannot drift apart.
- **Validation is collected and listed** at the top of the form rather than
  failing silently.

`Generate image` is present on each step because the production form has it,
but it is a stub — it needs an image-generation endpoint this build has no
credentials for, and it says so when clicked rather than pretending.

Meals live in `MealsProvider` above the router, so an edit made on the detail
page is still there when you navigate back to the list.

Two deliberate departures from the production page:

- **Ingredients render one per row, not split on commas.** The live page splits
  each ingredient string on `,`, which tears *"1 medium-sized onion, sliced"*
  into two separate entries — and *"1 medium-sized smoked mackerel"* away from
  *"deboned and flaked"*.
- **Instructions are numbered.** The order is the information, so it should be
  visible.

#### Nutrition is calculated, never typed

There are no calorie or macro inputs on the meal form. Each ingredient row
carries the optional nutrition fields on `ingredients_list` —
`ingredient_nutrition` (an id from `GET /v1/nutrition/ingredients`),
`nutrition_quantity` and `nutrition_unit` — and every row holding all three is
sent to `POST /v1/nutrition/calculate` as the rows change. The total sits above
Save, per serving and in full.

The recipe's own `quantity`/`unit` stay free text: a cook reads *2 cups*, the
calculation needs grams, and making one field serve both would wreck one of
them.

Two rules hold the display honest:

- **A row that cannot be counted is named, never counted as zero.** No link, no
  quantity, or a unit outside g/kg/oz/lb, and the row is marked *Not counted*
  with the reason, the total is labelled **partial**, and the number of
  excluded rows is stated. A total assembled from 2 of 10 ingredients never
  presents itself as the meal's nutrition.
- **An incomplete nutrient is not a number.** When `completeness.complete` is
  false the nutrient reads *Unavailable*, named against the ingredient
  responsible — "Fibre unavailable for Pork, belly" — and saves as `null`. A
  null total means nobody published that value; 0g would claim it was measured
  as zero.

While a recalculation is in flight the previous figure is hidden rather than
shown beside a row count it no longer matches. A meal saved before anything was
linked keeps the figures it already had, instead of being blanked by an empty
calculation. Meal Studio can draft everything else about a meal, but it cannot
write calories or macros — that would be a second source competing with the
calculation.

#### On the recipe content

Ingredients, instructions, descriptions and Lu tips are fixture data written
for these dishes. **Incompatible Health Conditions is deliberately empty** for
every meal: it is clinical guidance, and inventing it for a nutrition product
would be worse than leaving the gap visible. The tab says so, and the field is
ready for your nutritionists to fill.

---

## Ingredients

Two tabs, both served by the platform API. Neither holds a record in the
browser.

### Platform

`GET /v1/ingredients` — the catalogue meals and partners use, with server-side
search and paging. Create, edit and delete go to the same routes and need a
staff or admin account. Ingredients here carry **no nutrition values**: unit,
product group and category are ids, resolved through `/v1/units`,
`/v1/product_groups` and `/v1/product_categories`.

### Nutrition data

`GET /v1/nutrition/ingredients` — the published food composition data the
platform calculates meals against: 1,028 WAFCT and 363 USDA records. Read-only,
because the API has no write route for it.

Filters map one-to-one onto the endpoint: `search` (English name, French name
and published category), `source`, `product_group`, `food_group_code`, `page`,
`limit` (25 a page). **An unset filter is omitted from the URL entirely** — never
`source=`, which is not the same thing as "all sources".

`stats.by_source` is shown above the table. The endpoint counts both sources for
the same search regardless of the source filter, so the page can say how many
matches it is *not* showing — without it, a search matching far more WAFCT rows
than USDA ones looks like the USDA data is missing.

Records render as the API returns them: `name`, `name_fr`, `source` with its
`external_id`, `source_category`, `food_group_code`, and the five per-100g
nutrients under the API's own keys. **A nutrient the source never published is an
em dash, not 0.** An asterisk marks a figure the source bracketed
(`estimated_nutrients`) — a lower-confidence number, still not a measurement.
*more* expands a row to the remaining identifiers (`food_variant_id`, `food_id`,
`food_group_id`, `energy_basis`, `product_group`).

### Cold starts

The staging dyno sleeps. Its first request comes back `503` from the Heroku
router, before the app is running, and the retry succeeds. `request()` retries
those — plus `502`, `504` and outright connection failures — twice, backing off
800ms then 2s, and the nutrition tab says "The staging server was asleep" while
it waits.

Only reads are retried automatically. A write may already have reached the app,
and replaying it could create a second record. Login is the one exception, opted
in explicitly: it creates nothing, and it is the request most likely to meet a
sleeping dyno.

#### Running the blog drafting proxy

It ships in **mock mode**, so the flow works with no key and no server — drafts
are deterministic fakes. For real ones:

```bash
export OPENAI_API_KEY=sk-...
npm run estimate-server        # http://localhost:8787
```

then set the provider to OpenAI in Settings → AI & Integrations.

**The key never reaches the browser.** `server/estimate-server.js` holds it and
is the only thing that talks to OpenAI; the blog editor posts a description to
localhost. It uses Node built-ins only. Two things to check before real use:
`OPENAI_MODEL` defaults to `gpt-4o-mini`, which may not match what your account
exposes, and the request shape in `callOpenAI()` was written from memory rather
than against OpenAI's current published docs.

## Tests

```bash
npm test
```

306 tests, all against `src/lib/` — no DOM, no component rendering, so they are
fast and stable:

- `api.test.js` — envelope, auth errors, query building, response mapping
- `mealStudio.test.js` — the meal form ↔ draft mapping, both directions
- `mealNutrition.test.js` — which rows count, exclusion reasons, unavailable
  nutrients never rendering as numbers

One rule is pinned by regression tests throughout, because it has bitten
before: a missing nutrient stays `null` and is never defaulted to 0 — not in a
table cell, not in a meal total, not in what a meal saves.

---

## A note on nutrition data

Everything under Ingredients → Nutrition data, and every figure in a meal's
total, comes from `GET /v1/nutrition/ingredients`. There is no bundled copy of a
food table in this repo any more: a local snapshot drifts from the collection
the platform actually calculates against, and the drift is invisible.
