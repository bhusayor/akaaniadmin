/* Customer fixtures — the generator carried over from the vanilla
   pages/customers.html, seeded so the list is stable between renders. */

const AVATAR_COLOURS = [
  { bg: '#E1F5EE', fg: '#0F6E56' }, { bg: '#FDF6EE', fg: '#7A4F2A' },
  { bg: '#FEECEC', fg: '#A32D2D' }, { bg: '#E6F1FB', fg: '#185FA5' },
  { bg: '#EEEDFE', fg: '#534AB7' }, { bg: '#EAF3DE', fg: '#3B6D11' },
  { bg: '#FFF0F6', fg: '#9C1C5E' }, { bg: '#F0F4FF', fg: '#1E3A8A' },
];

const COUNTRIES = ['Nigeria', 'Nigeria', 'Nigeria', 'Ghana', 'Ghana', 'Kenya', 'South Africa', 'Nigeria', 'Ghana', 'Kenya'];
const FIRST = ['Oyedele', 'Faith', 'Eli', 'Lizzie', 'Mary', 'David', 'Boluwatife', 'Stella', 'Tamlo', 'Ade', 'Chidi', 'Ngozi', 'Emeka', 'Amaka', 'Seun', 'Bayo', 'Tobi', 'Kemi', 'Wale', 'Fola', 'Yemi', 'Remi', 'Tunde', 'Nkechi', 'Obinna', 'Chiamaka', 'Ifeanyi', 'Chinwe', 'Uche', 'Adaeze', 'Rasheed', 'Fatima', 'Ibrahim', 'Musa', 'Aisha', 'Hauwa'];
const LAST = ['Kehinde', 'Special', 'Onas', 'Beth', 'Mallam', 'Abimbola', 'Hassan', 'Amadimati', 'Tammy', 'Babs', 'Okafor', 'Eze', 'Nwosu', 'Adeyemi', 'Afolabi', 'Ogundele', 'Bakare', 'Salami', 'Lawal', 'Bello', 'Aliyu', 'Dankwa', 'Mensah', 'Asante', 'Boateng', 'Owusu', 'Darko', 'Asamoah', 'Frimpong', 'Opoku'];
const SEED_STATUS = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'inactive', 'active', 'active'];

/* Deterministic pseudo-random, so a re-render never reshuffles the table. */
function seeded(n) {
  const x = Math.sin(n * 9973) * 10000;
  return x - Math.floor(x);
}

function seededDate(i) {
  const start = new Date(2023, 0, 1).getTime();
  const end = new Date(2026, 2, 20).getTime();
  return new Date(start + seeded(i) * (end - start)).toISOString().split('T')[0];
}

const ROSTER = Array.from({ length: 207 }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = LAST[i % LAST.length];
  /* Accounts are either live or lapsed — there is no pending state. */
  const status = i < 10 ? SEED_STATUS[i] : i % 10 < 9 ? 'active' : 'inactive';
  return {
    id: i + 1,
    name: `${first} ${last}`,
    /* Local file, not a CDN call — see public/avatars/. Cycles through the
       pool, so the same customer always gets the same face. The initials
       remain on the record as the fallback when an image fails to load. */
    avatar: `avatars/a${String((i % 16) + 1).padStart(2, '0')}.jpg`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i > 0 ? i : ''}@gmail.com`,
    phone: `0${700 + Math.floor(seeded(i + 1) * 209)}${String(1000000 + Math.floor(seeded(i + 2) * 8999999))}`,
    country: COUNTRIES[i % COUNTRIES.length],
    status,
    joined: seededDate(i + 3),
    initials: `${first[0]}${last[0]}`,
    ...AVATAR_COLOURS[i % AVATAR_COLOURS.length],
  };
});

/* The snapshot date of the roster — nothing in it is newer than this. */
const HORIZON = ROSTER.reduce((max, c) => (c.joined > max ? c.joined : max), '');

/**
 * Lapsed accounts carry the date they went quiet, so "became inactive this
 * month" is a counted figure rather than a guess.
 *
 * The date always falls between the account's own join and the roster
 * horizon — an account cannot lapse before it exists — and is weighted
 * towards the recent end, because a growing platform loses most of the
 * accounts it loses from the cohort it most recently gained.
 */
export const CUSTOMERS = ROSTER.map((c, i) => {
  if (c.status !== 'inactive') return c;
  const from = Date.parse(c.joined);
  const span = Date.parse(HORIZON) - from;
  const skew = seeded(i + 11) ** 0.35;
  return { ...c, lapsedOn: new Date(from + skew * span).toISOString().split('T')[0] };
});
