/* ═══════════════════════════════════════════════════════
   SETTINGS

   The values here are read by the rest of the app, not just displayed.
   Anything that cannot actually change behaviour does not belong in
   this file.
   ═══════════════════════════════════════════════════════ */

export const STORAGE_KEY = 'akaani.settings.v2';

/* ── Roles ── */

export const ROLES = [
  { value: 'Admin', tone: 'bg-grape-light text-grape',
    description: 'Full access, including settings, billing and team management.' },
  { value: 'Manager', tone: 'bg-mint-light text-mint-deep',
    description: 'Create and edit meals, recipes, ingredients, blogs and facts. Cannot change settings or the team.' },
  { value: 'Viewer', tone: 'bg-line-light text-ink-2',
    description: 'Read-only. Can see everything, change nothing.' },
];

/* One row per thing a person can do. Admin is deliberately absent from
   the editable set — see PERMISSION_DEFAULTS. */
export const PERMISSIONS = [
  { key: 'viewDashboard', label: 'View dashboard and reports' },
  { key: 'manageMeals', label: 'Create and edit meals and recipes' },
  { key: 'manageIngredients', label: 'Manage the ingredient library' },
  { key: 'publishContent', label: 'Publish blogs and LU facts' },
  { key: 'manageTags', label: 'Manage meal tags' },
  { key: 'managePricing', label: 'Set recipe group pricing' },
  { key: 'viewCustomers', label: 'View customer records' },
  { key: 'manageTeam', label: 'Invite and manage team members' },
  { key: 'changeSettings', label: 'Change platform settings' },
];

export const PERMISSION_DEFAULTS = {
  Manager: {
    viewDashboard: true, manageMeals: true, manageIngredients: true,
    publishContent: true, manageTags: true, managePricing: true,
    viewCustomers: true, manageTeam: false, changeSettings: false,
  },
  Viewer: {
    viewDashboard: true, manageMeals: false, manageIngredients: false,
    publishContent: false, manageTags: false, managePricing: false,
    viewCustomers: true, manageTeam: false, changeSettings: false,
  },
};

/** Admin always has everything. A partial Admin is how an account locks itself out. */
export const ADMIN_HAS_ALL = true;

export function permissionFor(role, key, matrix) {
  if (role === 'Admin') return true;
  return !!matrix?.[role]?.[key];
}

/* ── Options ── */

export const AI_PROVIDERS = [
  { value: 'mock', label: 'Mock — deterministic, offline, no key' },
  { value: 'openai', label: 'OpenAI — via the local proxy' },
];

export const TIMEZONES = [
  'Africa/Lagos (GMT+1)', 'Africa/Accra (GMT+0)', 'Africa/Nairobi (GMT+3)',
  'Africa/Johannesburg (GMT+2)', 'Europe/London (GMT+0)', 'America/New_York (GMT-5)',
];

export const LANGUAGES = [
  'English (en)', 'French (fr)', 'Yoruba (yo)', 'Igbo (ig)', 'Hausa (ha)',
];

export const DATE_FORMATS = ['DD / MM / YYYY', 'MM / DD / YYYY', 'YYYY-MM-DD'];
export const WEEK_STARTS = ['Monday', 'Sunday', 'Saturday'];

export const MEASUREMENT_SYSTEMS = [
  { value: 'metric', label: 'Metric (kg, ml, cm)' },
  { value: 'imperial', label: 'Imperial (lb, fl oz, in)' },
];

export const UNITS_BY_SYSTEM = {
  metric: [
    { value: 'g', label: 'gram (g)' },
    { value: 'kg', label: 'kilogram (kg)' },
    { value: 'ml', label: 'millilitre (ml)' },
  ],
  imperial: [
    { value: 'oz', label: 'ounce (oz)' },
    { value: 'lbs', label: 'pounds (lbs)' },
  ],
};

export const NOTIFICATION_FREQUENCIES = [
  { value: 'immediate', label: 'Immediately' },
  { value: 'hourly', label: 'Digest — every hour' },
  { value: 'twice', label: 'Digest — twice daily' },
  { value: 'daily', label: 'Daily summary only' },
];

/* ── Defaults ── */

export const DEFAULTS = {
  profile: {
    firstName: 'Peter', lastName: 'Omidiji',
    email: 'peter@useakaani.com',
    phone: '+234 801 234 5678',
    jobTitle: 'Product Designer',
    avatar: null,
  },
  security: { totp: true, sms: false },
  platform: {
    name: 'Akaani',
    supportEmail: 'support@useakaani.com',
    tagline: 'AI-powered food & meal planning',
    supportUrl: 'https://support.useakaani.com',
    maintenance: false,
    allowSignups: true,
    requireEmailVerification: true,
    luInsights: true,
  },
  localization: {
    timezone: 'Africa/Lagos (GMT+1)',
    language: 'English (en)',
    currency: 'NGN',
    dateFormat: 'DD / MM / YYYY',
    weekStart: 'Monday',
    measurement: 'metric',
  },
  notifications: {
    emailNewSignup: true, emailWeeklySummary: true,
    emailMealPlanActivity: false, emailBilling: true,
    pushCustomerAlerts: true, pushSystemAlerts: true, pushLuInsights: true,
    smsSecurity: true, smsLargePayments: false,
    frequency: 'immediate',
  },
  ai: {
    provider: 'mock',
    baseUrl: 'http://localhost:8787',
    model: 'gpt-4o-mini',
    blogEnabled: true,
  },
  content: { factLimit: 220, autoPublish: false },
  team: [
    { id: 1, name: 'Peter Omidiji', email: 'peter@useakaani.com', role: 'Admin', status: 'active', joined: '2024-03-02' },
    { id: 2, name: 'Amara Okafor', email: 'amara@useakaani.com', role: 'Manager', status: 'active', joined: '2025-01-14' },
    { id: 3, name: 'Kofi Mensah', email: 'kofi@useakaani.com', role: 'Viewer', status: 'pending', joined: '2026-07-30' },
    { id: 4, name: 'Ngozi Eze', email: 'ngozi@useakaani.com', role: 'Manager', status: 'active', joined: '2026-02-09' },
  ],
  permissions: PERMISSION_DEFAULTS,
};

/* ── Persistence ── */

export function mergeSettings(stored) {
  const out = {};
  Object.keys(DEFAULTS).forEach((section) => {
    const fallback = DEFAULTS[section];
    const value = stored?.[section];
    // Arrays are replaced wholesale; spreading one into an object turns it
    // into {0: …, 1: …} and quietly destroys the list.
    out[section] = Array.isArray(fallback)
      ? (Array.isArray(value) ? value : fallback)
      : { ...fallback, ...(value ?? {}) };
  });
  return out;
}

export function loadSettings() {
  if (typeof localStorage === 'undefined') return mergeSettings(null);
  try {
    return mergeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    // Corrupt storage should not take the app down with it.
    return mergeSettings(null);
  }
}

export function saveSettings(settings) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
  catch { /* quota or private mode — settings stay in memory */ }
}

export const endpointFor = (baseUrl, path) =>
  `${String(baseUrl ?? '').replace(/\/+$/, '')}${path}`;

export const fullName = (profile) =>
  `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();

export const initials = (profile) =>
  `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || '?';

/* ── Validation ── */

export function validateAi(ai) {
  const problems = [];
  if (!AI_PROVIDERS.some((p) => p.value === ai.provider)) problems.push('Unknown AI provider');
  if (ai.provider === 'openai') {
    if (!String(ai.baseUrl ?? '').trim()) problems.push('A proxy URL is required for OpenAI');
    else if (!/^https?:\/\//.test(ai.baseUrl)) problems.push('Proxy URL must start with http:// or https://');
    if (!String(ai.model ?? '').trim()) problems.push('A model name is required for OpenAI');
  }
  return problems;
}

/**
 * Score 0–3. Length alone is not strength, so the bands need more than one
 * signal before they read as anything but weak.
 */
export function passwordStrength(value) {
  const pw = String(value ?? '');
  if (!pw) return { score: 0, label: 'Enter a password' };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return { score, label: ['Too short', 'Weak', 'Fair', 'Strong'][score] };
}

export function validatePasswordChange({ current, next, confirm }) {
  const problems = [];
  if (!current) problems.push('Enter your current password');
  if (!next) problems.push('Enter a new password');
  else if (next.length < 8) problems.push('New password must be at least 8 characters');
  if (next && confirm !== next) problems.push('The two new passwords do not match');
  if (next && current && next === current) problems.push('The new password must differ from the current one');
  return problems;
}

export function validateInvite(email, team) {
  const value = String(email ?? '').trim();
  if (!value) return 'An email address is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'That does not look like an email address';
  if (team.some((m) => m.email.toLowerCase() === value.toLowerCase())) {
    return 'That person is already on the team';
  }
  return null;
}

/* ── Role changes ── */

export function canEditRole(member, currentEmail) {
  if (member.email === currentEmail) {
    return { allowed: false, reason: 'You cannot change your own role' };
  }
  return { allowed: true, reason: null };
}

export function validateRoleChange(team, memberId, nextRole, currentEmail) {
  const member = team.find((m) => m.id === memberId);
  if (!member) return 'That team member no longer exists';

  const permitted = canEditRole(member, currentEmail);
  if (!permitted.allowed) return permitted.reason;

  if (!ROLES.some((r) => r.value === nextRole)) return `Unknown role "${nextRole}"`;

  const admins = team.filter((m) => m.role === 'Admin');
  if (member.role === 'Admin' && nextRole !== 'Admin' && admins.length === 1) {
    return 'There must be at least one Admin';
  }
  return null;
}

export function validateRemoval(team, memberId, currentEmail) {
  const member = team.find((m) => m.id === memberId);
  if (!member) return 'That team member no longer exists';
  if (member.email === currentEmail) return 'You cannot remove yourself';
  if (member.role === 'Admin' && team.filter((m) => m.role === 'Admin').length === 1) {
    return 'There must be at least one Admin';
  }
  return null;
}
