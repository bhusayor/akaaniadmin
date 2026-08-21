import { useMemo, useState } from 'react';
import useTopbar from '../hooks/useTopbar.js';
import Modal, { ModalActions } from '../components/Modal.jsx';
import { Field, Input, Select, StatusPill, Spinner, ModalButton, cx } from '../components/ui.jsx';
import {
  IconUsers, IconGear, IconGlobe, IconBell, IconSparkles, IconDownload,
  IconCheck, IconInfo, IconLink, IconTrash, IconFile, IconPlus,
} from '../components/icons.jsx';
import { useToast } from '../components/Toast.jsx';
import { useSettings } from '../state/SettingsProvider.jsx';
import {
  SectionHead, SettingsCard, FormRow, Hint, Toggle, ToggleRow,
  SaveRow, DangerZone, DangerAction, PasswordStrength,
} from '../features/settings/parts.jsx';
import {
  AI_PROVIDERS, MEASUREMENT_SYSTEMS, TIMEZONES, LANGUAGES, DATE_FORMATS,
  WEEK_STARTS, NOTIFICATION_FREQUENCIES, ROLES, PERMISSIONS,
  endpointFor, validateAi, canEditRole, validateRoleChange, validateRemoval,
  validateInvite, validatePasswordChange, passwordStrength, permissionFor,
  initials, fullName,
} from '../lib/settings.js';
import { CURRENCIES } from '../lib/recipeGroups.js';
import { downloadCSV } from '../lib/csv.js';

/* Grouped exactly as the settings nav reads. */
const NAV = [
  ['Account', [
    ['profile', 'Profile', IconUsers],
    ['password', 'Password', IconGear],
  ]],
  ['Platform', [
    ['platform', 'General', IconGear],
    ['localization', 'Localization', IconGlobe],
    ['ai', 'AI & Integrations', IconSparkles],
  ]],
  ['Notifications', [
    ['notifications', 'Notifications', IconBell],
  ]],
  ['Team', [
    ['team', 'Members', IconUsers],
    ['roles', 'Roles & Permissions', IconFile],
  ]],
  ['Data', [
    ['data', 'Data & Export', IconDownload],
  ]],
];

export default function Settings() {
  useTopbar('Settings');
  const toast = useToast();
  const { settings, update, reset, units } = useSettings();
  const [tab, setTab] = useState('profile');
  const [health, setHealth] = useState({ state: 'idle' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [invite, setInvite] = useState({ email: '', role: 'Manager' });
  const [confirmAction, setConfirmAction] = useState(null);

  const { profile, platform, localization, notifications, ai, team, permissions } = settings;
  const currentEmail = profile.email;
  const aiProblems = validateAi(ai);
  const strength = passwordStrength(pw.next);

  const unreadNotifs = useMemo(
    () => ['emailNewSignup', 'pushSystemAlerts', 'smsSecurity'].filter((k) => notifications[k]).length,
    [notifications],
  );

  const set = (section, patch) => update(section, patch);

  /* ── team ── */
  const changeRole = (member, nextRole) => {
    const problem = validateRoleChange(team, member.id, nextRole, currentEmail);
    if (problem) { toast(problem); return; }
    update('team', team.map((m) => (m.id === member.id ? { ...m, role: nextRole } : m)));
    toast(`${member.name} is now ${nextRole}`);
  };

  const removeMember = (member) => {
    const problem = validateRemoval(team, member.id, currentEmail);
    if (problem) { toast(problem); return; }
    update('team', team.filter((m) => m.id !== member.id));
    toast(`${member.name} removed from the team`);
    setConfirmAction(null);
  };

  const sendInvite = () => {
    const problem = validateInvite(invite.email, team);
    if (problem) { toast(problem); return; }
    const name = invite.email.split('@')[0].replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    update('team', [...team, {
      id: Math.max(0, ...team.map((m) => m.id)) + 1,
      name, email: invite.email.trim(), role: invite.role,
      status: 'pending', joined: new Date().toISOString().slice(0, 10),
    }]);
    setInvite({ email: '', role: 'Manager' });
    toast(`Invite sent to ${invite.email.trim()}`);
  };

  /* ── permissions ── */
  const togglePermission = (role, key) => {
    update('permissions', {
      ...permissions,
      [role]: { ...permissions[role], [key]: !permissions[role]?.[key] },
    });
  };

  /* ── password ── */
  const changePassword = () => {
    const problems = validatePasswordChange(pw);
    if (problems.length) { toast(problems[0]); return; }
    setPw({ current: '', next: '', confirm: '' });
    toast('Password updated');
  };

  const testConnection = () => {
    if (ai.provider === 'mock') {
      setHealth({ state: 'ok', detail: 'Mock mode — nothing to reach, generation runs locally.' });
      return;
    }
    setHealth({ state: 'testing' });
    const url = endpointFor(ai.baseUrl, '/health');
    fetch(url)
      .then((r) => r.json())
      .then((d) => setHealth({ state: 'ok', detail: `Reachable — running in ${d.mode} mode${d.model ? ` on ${d.model}` : ''}.` }))
      .catch(() => setHealth({ state: 'error', detail: `Could not reach ${url}. Start it with: npm run estimate-server` }));
  };

  const exportAll = () => {
    downloadCSV('akaani-settings.csv', [
      ['section', 'key', 'value'],
      ...Object.entries(settings)
        .filter(([, v]) => !Array.isArray(v))
        .flatMap(([sec, values]) => Object.entries(values).map(([k, v]) => [sec, k, JSON.stringify(v)])),
    ]);
    toast('Settings exported');
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* ── SETTINGS NAV ── */}
      <nav className="scroll-thin w-[220px] shrink-0 overflow-y-auto border-r border-line bg-surface px-3 py-5 max-lg:hidden">
        {NAV.map(([group, items]) => (
          <div key={group}>
            <div className="mb-1 mt-3 px-2.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-3 first:mt-0">
              {group}
            </div>
            {items.map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key)}
                className={cx(
                  'relative mb-px flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[13.5px] transition',
                  tab === key
                    ? 'bg-mint-light font-semibold text-forest before:absolute before:left-0 before:top-1/2 before:h-4.5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-sm before:bg-forest'
                    : 'text-ink-2 hover:bg-canvas hover:text-ink',
                )}>
                <Icon size={15} />
                {label}
                {key === 'notifications' && unreadNotifs > 0 && (
                  <span className="ml-auto rounded-full bg-chili-light px-1.5 py-px text-[10px] font-bold text-chili">
                    {unreadNotifs}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* mobile tab strip */}
      <div className="hidden max-lg:block">
        <div className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-4 py-2">
          {NAV.flatMap(([, items]) => items).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={cx('whitespace-nowrap rounded-lg px-3 py-2 text-[13px] transition',
                tab === key ? 'bg-mint-light font-semibold text-forest' : 'text-ink-2')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto px-8 py-7 max-md:px-4 max-md:py-5">
        <div className="mx-auto max-w-[820px] animate-fade-up">

          {tab === 'profile' && (
            <>
              <SectionHead title="Profile"
                description="Manage your personal account information and public profile." />
              <SettingsCard title="Personal Information"
                description="Your name and contact details shown across the platform">
                <div className="mb-5 flex flex-wrap items-center gap-4">
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-line bg-mint-light text-[22px] font-bold text-forest">
                    {profile.avatar
                      ? <img src={profile.avatar} alt="" className="size-full object-cover" />
                      : initials(profile)}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-ink">Profile photo</div>
                    <div className="mb-2.5 mt-0.5 text-[12px] text-ink-3">JPG, PNG or GIF. Max 2MB.</div>
                    <div className="flex gap-2">
                      <label className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-[12px] font-medium text-ink-2 transition hover:border-forest hover:bg-mint-light hover:text-forest">
                        Upload photo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { toast('That image is over 2MB'); return; }
                          const reader = new FileReader();
                          reader.onload = (ev) => set('profile', { avatar: ev.target.result });
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                      {profile.avatar && (
                        <button onClick={() => set('profile', { avatar: null })}
                          className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-[12px] font-medium text-chili transition hover:border-chili hover:bg-chili-light">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <FormRow>
                  <Field label="First name">
                    <Input value={profile.firstName} onChange={(e) => set('profile', { firstName: e.target.value })} />
                  </Field>
                  <Field label="Last name">
                    <Input value={profile.lastName} onChange={(e) => set('profile', { lastName: e.target.value })} />
                  </Field>
                </FormRow>
                <FormRow cols={1}>
                  <Field label="Email address">
                    <Input type="email" value={profile.email} onChange={(e) => set('profile', { email: e.target.value })} />
                    <Hint>This is used to log in and receive notifications.</Hint>
                  </Field>
                </FormRow>
                <FormRow>
                  <Field label="Phone number">
                    <Input value={profile.phone} onChange={(e) => set('profile', { phone: e.target.value })} />
                  </Field>
                  <Field label="Job title">
                    <Input value={profile.jobTitle} onChange={(e) => set('profile', { jobTitle: e.target.value })} />
                  </Field>
                </FormRow>

                {/* Role is granted, not self-assigned — it lives in Members. */}
                <FormRow cols={1}>
                  <Field label="Role">
                    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                      <span className="text-[13px] font-medium text-ink">
                        {team.find((m) => m.email === currentEmail)?.role ?? 'Admin'}
                      </span>
                      <button onClick={() => setTab('team')}
                        className="ml-auto cursor-pointer text-[11.5px] font-medium text-mint hover:text-forest">
                        Manage team →
                      </button>
                    </div>
                    <Hint>A role is granted by an Admin, so it cannot be changed from your own profile.</Hint>
                  </Field>
                </FormRow>

                <SaveRow onCancel={() => reset('profile')} onSave={() => toast('Profile saved')} />
              </SettingsCard>

              <DangerZone>
                <DangerAction first label="Deactivate account"
                  sub="Temporarily disable your account. You can reactivate at any time."
                  cta="Deactivate" onClick={() => setConfirmAction({ type: 'deactivate' })} />
                <DangerAction label="Delete account"
                  sub="Permanently delete your account and all associated data."
                  cta="Delete Account" onClick={() => setConfirmAction({ type: 'delete-account' })} />
              </DangerZone>
            </>
          )}

          {tab === 'password' && (
            <>
              <SectionHead title="Password & Security"
                description="Update your password and manage two-factor authentication." />
              <SettingsCard title="Change Password"
                description="Use a strong password of at least 8 characters">
                <FormRow cols={1}>
                  <Field label="Current password">
                    <Input type="password" value={pw.current} placeholder="Enter current password"
                      onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                  </Field>
                </FormRow>
                <FormRow>
                  <Field label="New password">
                    <Input type="password" value={pw.next} placeholder="New password"
                      onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                    <PasswordStrength score={strength.score} label={strength.label} />
                  </Field>
                  <Field label="Confirm new password">
                    <Input type="password" value={pw.confirm} placeholder="Confirm new password"
                      onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
                    {pw.confirm && pw.confirm !== pw.next && (
                      <Hint><span className="text-chili">Passwords do not match.</span></Hint>
                    )}
                  </Field>
                </FormRow>
                <SaveRow onCancel={() => setPw({ current: '', next: '', confirm: '' })}
                  onSave={changePassword} saveLabel="Update Password" />
              </SettingsCard>

              <SettingsCard title="Two-Factor Authentication"
                description="Add an extra layer of security to your account">
                <ToggleRow label="Authenticator app (TOTP)"
                  sub="Use Google Authenticator, Authy, or similar apps"
                  checked={settings.security.totp} onChange={(v) => set('security', { totp: v })} />
                <ToggleRow label="SMS verification"
                  sub="Receive a one-time code via text message"
                  checked={settings.security.sms} onChange={(v) => set('security', { sms: v })} />
                <ToggleRow label="Backup codes" sub="Generate one-time backup codes for emergencies">
                  <button onClick={() => toast('Backup codes need a backend — not wired up')}
                    className="ml-4 shrink-0 cursor-pointer rounded-lg border border-line px-3.5 py-2 text-[12px] font-medium text-ink-2 transition hover:border-forest hover:text-forest">
                    Generate codes
                  </button>
                </ToggleRow>
              </SettingsCard>
            </>
          )}

          {tab === 'platform' && (
            <>
              <SectionHead title="Platform Settings"
                description="Configure your Akaani platform name, branding, and general behaviour." />
              <SettingsCard title="App Identity"
                description="How your platform appears to users and in communications">
                <FormRow>
                  <Field label="Platform name">
                    <Input value={platform.name} onChange={(e) => set('platform', { name: e.target.value })} />
                  </Field>
                  <Field label="Support email">
                    <Input type="email" value={platform.supportEmail}
                      onChange={(e) => set('platform', { supportEmail: e.target.value })} />
                  </Field>
                </FormRow>
                <FormRow cols={1}>
                  <Field label="Platform tagline">
                    <Input value={platform.tagline} onChange={(e) => set('platform', { tagline: e.target.value })} />
                    <Hint>Shown on the landing page and in user onboarding flows.</Hint>
                  </Field>
                </FormRow>
                <FormRow cols={1}>
                  <Field label="Support URL">
                    <Input value={platform.supportUrl} placeholder="https://"
                      onChange={(e) => set('platform', { supportUrl: e.target.value })} />
                  </Field>
                </FormRow>
                <SaveRow onCancel={() => reset('platform')} onSave={() => toast('Platform settings saved')} />
              </SettingsCard>

              <SettingsCard title="Default Behaviours"
                description="Platform-wide defaults for new users and sessions">
                <ToggleRow label="Maintenance mode" sub="Temporarily show a maintenance page to all users"
                  checked={platform.maintenance} onChange={(v) => set('platform', { maintenance: v })} />
                <ToggleRow label="Allow new registrations" sub="Enable or disable new user sign-ups on the platform"
                  checked={platform.allowSignups} onChange={(v) => set('platform', { allowSignups: v })} />
                <ToggleRow label="Require email verification" sub="New users must verify email before accessing the app"
                  checked={platform.requireEmailVerification}
                  onChange={(v) => set('platform', { requireEmailVerification: v })} />
                <ToggleRow label="Lu AI insights" sub="Surface Lu's recommendations on the dashboard"
                  checked={platform.luInsights} onChange={(v) => set('platform', { luInsights: v })} />
              </SettingsCard>
            </>
          )}

          {tab === 'localization' && (
            <>
              <SectionHead title="Localization"
                description="Set the default timezone, currency, language and regional preferences." />
              <SettingsCard title="Regional Settings"
                description="These defaults apply to all new users unless they override them">
                <FormRow>
                  <Field label="Default timezone">
                    <Select value={localization.timezone} onChange={(e) => set('localization', { timezone: e.target.value })}>
                      {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="Default language">
                    <Select value={localization.language} onChange={(e) => set('localization', { language: e.target.value })}>
                      {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                    </Select>
                  </Field>
                </FormRow>
                <FormRow>
                  <Field label="Primary currency">
                    <Select value={localization.currency} onChange={(e) => set('localization', { currency: e.target.value })}>
                      {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label.split('— ')[1]}</option>)}
                    </Select>
                    <Hint>Used as the default for new recipe groups.</Hint>
                  </Field>
                  <Field label="Date format">
                    <Select value={localization.dateFormat} onChange={(e) => set('localization', { dateFormat: e.target.value })}>
                      {DATE_FORMATS.map((d) => <option key={d}>{d}</option>)}
                    </Select>
                  </Field>
                </FormRow>
                <FormRow>
                  <Field label="Week starts on">
                    <Select value={localization.weekStart} onChange={(e) => set('localization', { weekStart: e.target.value })}>
                      {WEEK_STARTS.map((w) => <option key={w}>{w}</option>)}
                    </Select>
                  </Field>
                  <Field label="Measurement system">
                    <Select value={localization.measurement} onChange={(e) => set('localization', { measurement: e.target.value })}>
                      {MEASUREMENT_SYSTEMS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Select>
                  </Field>
                </FormRow>

                <div className="mb-4 rounded-xl bg-surface-2 px-4 py-3">
                  <div className="text-[12px] font-medium text-ink-2">Units offered on ingredients</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {units.map((u) => (
                      <span key={u.value} className="rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-2">
                        {u.label}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-ink-3">
                    Nutrition stays <strong className="font-medium text-ink-2">per 100g</strong> whichever
                    system is chosen — a fixed convention, not a preference. Changing the basis would
                    silently reinterpret every figure already stored.
                  </p>
                </div>

                <SaveRow onCancel={() => reset('localization')} onSave={() => toast('Localization saved')} />
              </SettingsCard>
            </>
          )}

          {tab === 'ai' && (
            <>
              <SectionHead title="AI & Integrations"
                description="Nutrition estimates and blog drafting both run through the local proxy, which holds the API key so the browser never does." />
              <SettingsCard title="Provider" description="Where generated content comes from">
                <FormRow cols={1}>
                  <Field label="Provider">
                    <Select value={ai.provider} onChange={(e) => set('ai', { provider: e.target.value })}>
                      {AI_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </Select>
                  </Field>
                </FormRow>

                {ai.provider === 'openai' ? (
                  <>
                    <FormRow>
                      <Field label="Proxy URL">
                        <Input value={ai.baseUrl} placeholder="http://localhost:8787"
                          onChange={(e) => set('ai', { baseUrl: e.target.value })} />
                        <Hint>Never the OpenAI URL directly.</Hint>
                      </Field>
                      <Field label="Model">
                        <Input value={ai.model} placeholder="gpt-4o-mini"
                          onChange={(e) => set('ai', { model: e.target.value })} />
                      </Field>
                    </FormRow>
                    {aiProblems.length > 0 && (
                      <div className="mb-4 rounded-xl border border-chili/30 bg-chili-light px-4 py-3 text-[12.5px] text-chili-deep">
                        <ul className="list-inside list-disc">{aiProblems.map((p) => <li key={p}>{p}</li>)}</ul>
                      </div>
                    )}
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <button onClick={testConnection} disabled={health.state === 'testing'}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-medium text-ink-2 transition hover:border-forest hover:text-forest disabled:opacity-50">
                        {health.state === 'testing' ? <><Spinner /> Testing…</> : <><IconLink size={13} /> Test connection</>}
                      </button>
                      {health.state === 'ok' && (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-mint-deep">
                          <IconCheck size={13} stroke={2.5} /> {health.detail}
                        </span>
                      )}
                      {health.state === 'error' && <span className="text-[12.5px] text-chili-deep">{health.detail}</span>}
                    </div>
                  </>
                ) : (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
                    <span className="mt-0.5 shrink-0 text-ink-3"><IconInfo /></span>
                    Mock mode returns deterministic placeholder content. Nothing is sent anywhere and no
                    key is needed. Estimates are stamped <strong className="font-medium">AI estimate (mock)</strong>
                    {' '}so they can never be mistaken for measured data.
                  </div>
                )}

                <div className="rounded-xl bg-amber-light px-4 py-3 text-[12px] leading-relaxed text-amber-deep">
                  <strong className="font-semibold">The key lives on the proxy, not here.</strong> Set
                  <code className="mx-1 rounded bg-white/60 px-1.5 py-0.5 font-mono">OPENAI_API_KEY</code>
                  in the environment running <code className="font-mono">npm run estimate-server</code>.
                  A key entered in a browser field would be readable by anyone who opens this page.
                </div>
              </SettingsCard>

              <SettingsCard title="Features" description="Which parts of the app may call a model">
                <ToggleRow label="Nutrition estimates"
                  sub="Offer an AI estimate when no WAFCT match scores 70 or above"
                  checked={ai.nutritionEnabled} onChange={(v) => set('ai', { nutritionEnabled: v })} />
                <ToggleRow label="Blog drafting"
                  sub="Allow posts to be drafted from a description. Drafts never publish themselves."
                  checked={ai.blogEnabled} onChange={(v) => set('ai', { blogEnabled: v })} />
              </SettingsCard>
            </>
          )}

          {tab === 'notifications' && (
            <>
              <SectionHead title="Notifications"
                description="Control which notifications you receive and how they're delivered." />

              <SettingsCard title="Email Notifications" description={`Sent to ${profile.email}`}>
                <ToggleRow label="New customer sign-up" sub="When a new user registers on the platform"
                  checked={notifications.emailNewSignup} onChange={(v) => set('notifications', { emailNewSignup: v })} />
                <ToggleRow label="Weekly summary report" sub="Platform stats, revenue, and growth digest"
                  checked={notifications.emailWeeklySummary} onChange={(v) => set('notifications', { emailWeeklySummary: v })} />
                <ToggleRow label="Meal plan activity" sub="When users create or update meal plans"
                  checked={notifications.emailMealPlanActivity} onChange={(v) => set('notifications', { emailMealPlanActivity: v })} />
                <ToggleRow label="Payment & billing alerts" sub="Successful payments, failed transactions, refunds"
                  checked={notifications.emailBilling} onChange={(v) => set('notifications', { emailBilling: v })} />
              </SettingsCard>

              <SettingsCard title="Push Notifications" description="In-app and browser push alerts">
                <ToggleRow label="Real-time customer alerts" sub="Instant notification when key customer events occur"
                  checked={notifications.pushCustomerAlerts} onChange={(v) => set('notifications', { pushCustomerAlerts: v })} />
                <ToggleRow label="System alerts" sub="Downtime, maintenance, and critical platform updates"
                  checked={notifications.pushSystemAlerts} onChange={(v) => set('notifications', { pushSystemAlerts: v })} />
                <ToggleRow label="Lu AI insights" sub="Notifications from the Lu AI recommendation engine"
                  checked={notifications.pushLuInsights} onChange={(v) => set('notifications', { pushLuInsights: v })} />
              </SettingsCard>

              <SettingsCard title="SMS Notifications" description={`Text messages to ${profile.phone}`}>
                <ToggleRow label="Critical security alerts" sub="Login from new device, password changed, 2FA events"
                  checked={notifications.smsSecurity} onChange={(v) => set('notifications', { smsSecurity: v })} />
                <ToggleRow label="Large payment alerts" sub="Transactions above ₦50,000"
                  checked={notifications.smsLargePayments} onChange={(v) => set('notifications', { smsLargePayments: v })} />
                <div className="mt-4">
                  <FormRow cols={2}>
                    <Field label="Notification frequency">
                      <Select value={notifications.frequency} onChange={(e) => set('notifications', { frequency: e.target.value })}>
                        {NOTIFICATION_FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </Select>
                      <Hint>Applies to non-critical notifications only.</Hint>
                    </Field>
                  </FormRow>
                </div>
                <SaveRow onSave={() => toast('Notification preferences saved')} saveLabel="Save Preferences" />
              </SettingsCard>
            </>
          )}

          {tab === 'team' && (
            <>
              <SectionHead title="Team Members"
                description="Invite and manage people who have access to the Akaani admin platform." />

              <SettingsCard title="Invite a team member"
                description="They'll receive an email invitation to join the platform">
                <div className="flex items-end gap-2.5 max-sm:flex-col max-sm:items-stretch">
                  <Field label="Email address" className="flex-1">
                    <Input value={invite.email} placeholder="colleague@useakaani.com"
                      onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && sendInvite()} />
                  </Field>
                  <Field label="Role" className="w-[150px] max-sm:w-full">
                    <Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                      {ROLES.map((r) => <option key={r.value}>{r.value}</option>)}
                    </Select>
                  </Field>
                  <button onClick={sendInvite}
                    className="inline-flex h-[42px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-forest px-4 text-[13px] font-semibold text-white transition hover:opacity-85">
                    <IconPlus /> Send Invite
                  </button>
                </div>
              </SettingsCard>

              <SettingsCard title="Current Members"
                description={`${team.length} members with platform access · ${team.filter((m) => m.role === 'Admin').length} admin`}
                className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse max-md:min-w-[680px]">
                    <thead>
                      <tr>
                        {['Member', 'Role', 'Joined', 'Status', ''].map((h) => (
                          <th key={h} className="border-b border-line-light bg-surface-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((m) => {
                        const editable = canEditRole(m, currentEmail);
                        const isMe = m.email === currentEmail;
                        return (
                          <tr key={m.id} className="transition hover:bg-[#FAFBFD]">
                            <td className="border-b border-line-light px-3 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-mint-light text-[12px] font-semibold text-mint-deep">
                                  {m.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[13px] font-medium text-ink">{m.name}</span>
                                    {isMe && <span className="rounded-full bg-line-light px-1.5 py-px text-[10px] font-semibold text-ink-3">You</span>}
                                  </div>
                                  <div className="text-[11px] text-ink-3">{m.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="border-b border-line-light px-3 py-3">
                              <div className="w-[130px]">
                                {editable.allowed ? (
                                  <Select value={m.role} className="py-1.5 text-[12px]"
                                    onChange={(e) => changeRole(m, e.target.value)}>
                                    {ROLES.map((r) => <option key={r.value}>{r.value}</option>)}
                                  </Select>
                                ) : (
                                  <span title={editable.reason}
                                    className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[12px] text-ink-2">
                                    {m.role}<span className="ml-auto text-ink-3"><IconInfo size={12} /></span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap border-b border-line-light px-3 py-3 text-[12.5px] text-ink-2">
                              {new Date(`${m.joined}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="border-b border-line-light px-3 py-3"><StatusPill status={m.status} /></td>
                            <td className="border-b border-line-light px-3 py-3 text-right">
                              <button
                                title={isMe ? 'You cannot remove yourself' : `Remove ${m.name}`}
                                disabled={isMe}
                                onClick={() => setConfirmAction({ type: 'remove', member: m })}
                                className="grid size-7 cursor-pointer place-items-center rounded-md text-ink-3 transition hover:bg-chili-light hover:text-chili disabled:cursor-not-allowed disabled:opacity-30">
                                <IconTrash />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SettingsCard>
            </>
          )}

          {tab === 'roles' && (
            <>
              <SectionHead title="Roles & Permissions"
                description="Define what each role can see and do within the platform." />

              <SettingsCard title="Role Matrix" description="Permissions applied to all members with each role"
                className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse">
                    <thead>
                      <tr>
                        <th className="border-b border-line-light bg-surface-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
                          Permission
                        </th>
                        {ROLES.map((r) => (
                          <th key={r.value} className="border-b border-line-light bg-surface-2 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3">
                            {r.value}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSIONS.map((p) => (
                        <tr key={p.key} className="transition hover:bg-[#FAFBFD]">
                          <td className="border-b border-line-light px-3 py-2.5 text-[13px] text-ink-2">{p.label}</td>
                          {ROLES.map((r) => {
                            const locked = r.value === 'Admin';
                            const on = permissionFor(r.value, p.key, permissions);
                            return (
                              <td key={r.value} className="border-b border-line-light px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  disabled={locked}
                                  onChange={() => togglePermission(r.value, p.key)}
                                  title={locked ? 'Admins always have every permission' : undefined}
                                  className="size-4 cursor-pointer accent-forest disabled:cursor-not-allowed disabled:opacity-40"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-line-light p-5">
                  <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-4 py-3 text-[12px] leading-relaxed text-ink-2">
                    <span className="mt-0.5 shrink-0 text-ink-3"><IconInfo /></span>
                    <span>
                      <strong className="font-medium">Admin is locked on every row.</strong> A partial
                      Admin is how an account ends up with nobody who can fix it. For the same reason
                      nobody can change their own role, and the last Admin cannot be demoted or removed.
                    </span>
                  </div>
                  <SaveRow onCancel={() => reset('permissions')} onSave={() => toast('Permissions saved')}
                    saveLabel="Save Permissions" />
                </div>
              </SettingsCard>

              <SettingsCard title="What each role means" description="Shown to admins when assigning a role">
                <div className="flex flex-col gap-3">
                  {ROLES.map((r) => (
                    <div key={r.value} className="flex gap-3 rounded-xl border border-line-light bg-surface-2 px-4 py-3">
                      <span className={cx('h-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', r.tone)}>
                        {r.value}
                      </span>
                      <p className="text-[12.5px] leading-relaxed text-ink-2">{r.description}</p>
                    </div>
                  ))}
                </div>
              </SettingsCard>
            </>
          )}

          {tab === 'data' && (
            <>
              <SectionHead title="Data & Export"
                description="Every list page exports its own filtered view as CSV. This is where the settings themselves live." />
              <SettingsCard title="Export" description="Download a copy of your configuration">
                <ToggleRow label="Export settings" sub="All values on this page, as CSV.">
                  <button onClick={exportAll}
                    className="ml-4 inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-[12px] font-medium text-ink-2 transition hover:border-forest hover:text-forest">
                    <IconDownload /> Export
                  </button>
                </ToggleRow>
                <ToggleRow label="Auto-publish new content"
                  sub="Off by default. Blogs, facts and recipe groups all start as drafts so nothing ships unreviewed."
                  checked={settings.content.autoPublish}
                  onChange={(v) => set('content', { autoPublish: v })} />
              </SettingsCard>

              <DangerZone>
                <DangerAction first label="Reset settings"
                  sub="Returns every value on this page to its shipped default. Content is not touched."
                  cta="Reset all settings" onClick={() => setConfirmAction({ type: 'reset' })} />
              </DangerZone>
            </>
          )}
        </div>
      </div>

      {/* ── CONFIRM ── */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={{
          deactivate: 'Deactivate account?',
          'delete-account': 'Delete account?',
          reset: 'Reset all settings?',
          remove: 'Remove team member?',
        }[confirmAction?.type] ?? ''}
        subtitle={{
          deactivate: 'Your account will be disabled until you reactivate it. Nothing is deleted.',
          'delete-account': 'This permanently deletes your account and all associated data. It cannot be undone.',
          reset: 'Every value on this page returns to its shipped default. Your content is not touched.',
          remove: confirmAction?.member
            ? `${confirmAction.member.name} will lose access to the admin platform immediately.`
            : '',
        }[confirmAction?.type] ?? ''}
      >
        <ModalActions>
          <ModalButton variant="ghost" onClick={() => setConfirmAction(null)}>Cancel</ModalButton>
          <ModalButton variant="danger" onClick={() => {
            const { type, member } = confirmAction;
            if (type === 'remove') { removeMember(member); return; }
            if (type === 'reset') { reset(); toast('Settings reset to defaults'); }
            else toast(type === 'deactivate' ? 'Deactivation needs a backend — not wired up'
              : 'Account deletion needs a backend — not wired up');
            setConfirmAction(null);
          }}>
            {confirmAction?.type === 'remove' ? 'Remove' : 'Confirm'}
          </ModalButton>
        </ModalActions>
      </Modal>
    </div>
  );
}
