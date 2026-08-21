/* ═══════════════════════════════════════════════════════
   SETTINGS TESTS               run with: npm test
   ═══════════════════════════════════════════════════════ */

import { it, assert } from 'vitest';
import {
  DEFAULTS, mergeSettings, endpointFor, validateAi,
  AI_PROVIDERS, MEASUREMENT_SYSTEMS, UNITS_BY_SYSTEM,
} from './settings.js';

// ─── merging ───

it('a stored value overrides the default', () => {
  assert.strictEqual(mergeSettings({ ai: { provider: 'openai' } }).ai.provider, 'openai');
});

it('keys absent from storage keep their default rather than landing undefined', () => {
  // A settings file written before a key existed must not blank it out.
  const merged = mergeSettings({ ai: { provider: 'openai' } });
  assert.strictEqual(merged.ai.model, DEFAULTS.ai.model);
  assert.strictEqual(merged.ai.baseUrl, DEFAULTS.ai.baseUrl);
});

it('an entirely missing section falls back whole', () => {
  const merged = mergeSettings({ profile: { name: 'X' } });
  assert.deepStrictEqual(merged.localization, DEFAULTS.localization);
});

it('null or junk storage yields the defaults', () => {
  assert.deepStrictEqual(mergeSettings(null), DEFAULTS);
  assert.deepStrictEqual(mergeSettings(undefined), DEFAULTS);
});

it('merging never drops a section', () => {
  assert.deepStrictEqual(Object.keys(mergeSettings({})), Object.keys(DEFAULTS));
});

// ─── endpoints ───

it('builds an endpoint without doubling the slash', () => {
  assert.strictEqual(endpointFor('http://localhost:8787', '/estimate'), 'http://localhost:8787/estimate');
  assert.strictEqual(endpointFor('http://localhost:8787/', '/estimate'), 'http://localhost:8787/estimate');
  assert.strictEqual(endpointFor('http://localhost:8787///', '/estimate'), 'http://localhost:8787/estimate');
});

it('tolerates a missing base url', () => {
  assert.strictEqual(endpointFor(undefined, '/estimate'), '/estimate');
});

// ─── AI validation ───

it('mock needs nothing configured', () => {
  assert.deepStrictEqual(validateAi({ provider: 'mock' }), []);
});

it('openai needs a proxy url and a model', () => {
  const problems = validateAi({ provider: 'openai', baseUrl: '', model: '' });
  assert.strictEqual(problems.length, 2);
});

it('rejects a proxy url without a scheme', () => {
  const problems = validateAi({ provider: 'openai', baseUrl: 'localhost:8787', model: 'gpt-4o-mini' });
  assert.ok(problems.some((p) => /http/.test(p)));
});

it('rejects an unknown provider rather than silently doing nothing', () => {
  assert.ok(validateAi({ provider: 'anthropic-typo' }).some((p) => /Unknown/.test(p)));
});

// ─── defaults that matter ───

it('ships in mock mode, so no key is needed to run the app', () => {
  assert.strictEqual(DEFAULTS.ai.provider, 'mock');
});

it('auto-publish is off, so nothing ships unreviewed', () => {
  assert.strictEqual(DEFAULTS.content.autoPublish, false);
});

it('every provider and measurement system is selectable', () => {
  assert.ok(AI_PROVIDERS.some((p) => p.value === DEFAULTS.ai.provider));
  assert.ok(MEASUREMENT_SYSTEMS.some((m) => m.value === DEFAULTS.localization.measurement));
});

it('each measurement system offers units', () => {
  MEASUREMENT_SYSTEMS.forEach((m) => {
    assert.ok(UNITS_BY_SYSTEM[m.value]?.length, `no units for ${m.value}`);
    UNITS_BY_SYSTEM[m.value].forEach((u) => {
      assert.ok(u.value && u.label, 'unit missing value or label');
      assert.ok(u.label.includes(u.value), `${u.label} should show its short form`);
    });
  });
});

// ─── roles ───

import { ROLES, canEditRole, validateRoleChange } from './settings.js';

const team = [
  { id: 1, name: 'Peter', email: 'peter@akaani.com', role: 'Admin' },
  { id: 2, name: 'Amara', email: 'amara@akaani.com', role: 'Manager' },
  { id: 3, name: 'Kofi', email: 'kofi@akaani.com', role: 'Viewer' },
];

it('nobody can change their own role', () => {
  // Which is also why the Profile panel shows the role rather than a select.
  assert.strictEqual(canEditRole(team[0], 'peter@akaani.com').allowed, false);
  assert.match(validateRoleChange(team, 1, 'Viewer', 'peter@akaani.com'), /your own role/);
});

it('someone else can be promoted or demoted', () => {
  assert.strictEqual(canEditRole(team[1], 'peter@akaani.com').allowed, true);
  assert.strictEqual(validateRoleChange(team, 2, 'Admin', 'peter@akaani.com'), null);
  assert.strictEqual(validateRoleChange(team, 3, 'Manager', 'peter@akaani.com'), null);
});

it('the last Admin cannot be demoted', () => {
  // Otherwise the account ends up with nobody who can manage it.
  const oneAdmin = [
    { id: 1, email: 'a@x.com', role: 'Admin' },
    { id: 2, email: 'b@x.com', role: 'Manager' },
  ];
  assert.match(validateRoleChange(oneAdmin, 1, 'Manager', 'b@x.com'), /at least one Admin/);
});

it('an Admin can be demoted while another Admin remains', () => {
  const twoAdmins = [
    { id: 1, email: 'a@x.com', role: 'Admin' },
    { id: 2, email: 'b@x.com', role: 'Admin' },
  ];
  assert.strictEqual(validateRoleChange(twoAdmins, 1, 'Manager', 'b@x.com'), null);
});

it('promoting to Admin is always fine', () => {
  assert.strictEqual(validateRoleChange(team, 2, 'Admin', 'peter@akaani.com'), null);
});

it('an unknown role is rejected', () => {
  assert.match(validateRoleChange(team, 2, 'Superuser', 'peter@akaani.com'), /Unknown role/);
});

it('a member who no longer exists is reported, not crashed on', () => {
  assert.match(validateRoleChange(team, 999, 'Admin', 'peter@akaani.com'), /no longer exists/);
});

it('every role carries a description of what it can do', () => {
  ROLES.forEach((r) => {
    assert.ok(r.value, 'role without a value');
    assert.ok(r.description?.length > 20, `${r.value} needs a real description`);
  });
});

it('the seeded team is valid and has an Admin', () => {
  DEFAULTS.team.forEach((m) => {
    assert.ok(m.id && m.name && m.email && m.joined, 'incomplete member');
    assert.ok(ROLES.some((r) => r.value === m.role), `${m.name} has role ${m.role}`);
  });
  assert.ok(DEFAULTS.team.some((m) => m.role === 'Admin'), 'no Admin seeded');
});

it('the team array survives a merge instead of becoming an object', () => {
  // Spreading an array into an object turns it into {0: …, 1: …}.
  const merged = mergeSettings({ profile: { name: 'X' } });
  assert.ok(Array.isArray(merged.team));
  assert.strictEqual(merged.team.length, DEFAULTS.team.length);
});

it('a stored team replaces the default wholesale', () => {
  const stored = [{ id: 9, name: 'Solo', email: 's@x.com', role: 'Admin' }];
  assert.deepStrictEqual(mergeSettings({ team: stored }).team, stored);
});


// ─── permissions matrix ───

import {
  PERMISSIONS, PERMISSION_DEFAULTS, permissionFor, validateRemoval,
  validateInvite, validatePasswordChange, passwordStrength, initials, fullName,
} from './settings.js';

it('Admin has every permission, whatever the matrix says', () => {
  // A partial Admin is how an account ends up with nobody who can fix it.
  PERMISSIONS.forEach((p) => {
    assert.strictEqual(permissionFor('Admin', p.key, {}), true);
    assert.strictEqual(permissionFor('Admin', p.key, { Admin: { [p.key]: false } }), true);
  });
});

it('Manager can build content but not manage the team or settings', () => {
  assert.strictEqual(permissionFor('Manager', 'manageMeals', PERMISSION_DEFAULTS), true);
  assert.strictEqual(permissionFor('Manager', 'manageTeam', PERMISSION_DEFAULTS), false);
  assert.strictEqual(permissionFor('Manager', 'changeSettings', PERMISSION_DEFAULTS), false);
});

it('Viewer can only look', () => {
  const allowed = PERMISSIONS.filter((p) => permissionFor('Viewer', p.key, PERMISSION_DEFAULTS));
  assert.deepStrictEqual(allowed.map((p) => p.key), ['viewDashboard', 'viewCustomers']);
});

it('an unknown permission is denied rather than assumed', () => {
  assert.strictEqual(permissionFor('Viewer', 'nonsense', PERMISSION_DEFAULTS), false);
});

it('every role except Admin has a defaults row', () => {
  ROLES.filter((r) => r.value !== 'Admin').forEach((r) => {
    assert.ok(PERMISSION_DEFAULTS[r.value], `no defaults for ${r.value}`);
  });
});

// ─── removal ───

it('you cannot remove yourself', () => {
  assert.match(validateRemoval(team, 1, 'peter@akaani.com'), /remove yourself/);
});

it('the last Admin cannot be removed', () => {
  const solo = [{ id: 1, email: 'a@x.com', role: 'Admin' }, { id: 2, email: 'b@x.com', role: 'Manager' }];
  assert.match(validateRemoval(solo, 1, 'b@x.com'), /at least one Admin/);
});

it('a non-admin can be removed', () => {
  assert.strictEqual(validateRemoval(team, 2, 'peter@akaani.com'), null);
});

// ─── invites ───

it('an invite needs a plausible email', () => {
  assert.match(validateInvite('', team), /required/);
  assert.match(validateInvite('not-an-email', team), /email address/);
  assert.strictEqual(validateInvite('new@akaani.com', team), null);
});

it('inviting someone already on the team is refused, case-insensitively', () => {
  assert.match(validateInvite('AMARA@akaani.com', team), /already on the team/);
});

// ─── password ───

it('strength needs more than length to clear the bottom band', () => {
  assert.strictEqual(passwordStrength('').score, 0);
  assert.strictEqual(passwordStrength('abc').score, 0);          // too short
  assert.strictEqual(passwordStrength('password').score, 1);     // long only
  assert.strictEqual(passwordStrength('Password1').score, 2);    // + case and digit
  assert.strictEqual(passwordStrength('Password1!').score, 3);   // + symbol
});

it('a password change is checked before it is accepted', () => {
  assert.deepStrictEqual(
    validatePasswordChange({ current: 'old', next: 'Password1!', confirm: 'Password1!' }), []);
  assert.match(validatePasswordChange({ current: '', next: 'x', confirm: 'x' })[0], /current password/);
  assert.ok(validatePasswordChange({ current: 'a', next: 'short', confirm: 'short' })
    .some((p) => /at least 8/.test(p)));
  assert.ok(validatePasswordChange({ current: 'a', next: 'Password1!', confirm: 'other' })
    .some((p) => /do not match/.test(p)));
  assert.ok(validatePasswordChange({ current: 'Password1!', next: 'Password1!', confirm: 'Password1!' })
    .some((p) => /differ/.test(p)));
});

// ─── profile helpers ───

it('derives a display name and initials from the split fields', () => {
  assert.strictEqual(fullName({ firstName: 'Peter', lastName: 'Omidiji' }), 'Peter Omidiji');
  assert.strictEqual(initials({ firstName: 'Peter', lastName: 'Omidiji' }), 'PO');
  assert.strictEqual(initials({}), '?');
});
