import { NavLink, useNavigate } from 'react-router-dom';
import {
  IconGrid, IconUsers, IconMenu, IconLeaf, IconList,
  IconTag, IconFile, IconGear, IconLogout, IconPin, IconChart, IconWallet,
} from './icons.jsx';
import { cx } from './ui.jsx';
import { PLATFORM_TOTAL, formatCount } from '../lib/platform.js';
import { useAuth, initialsOf, displayName } from '../state/AuthProvider.jsx';

const SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: IconGrid },
      { to: '/customers', label: 'Customers', icon: IconUsers, badge: formatCount(PLATFORM_TOTAL) },
      { to: '/finances', label: 'Finances', icon: IconWallet },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/meals', label: 'Meals', icon: IconMenu },
      { to: '/recipe-groups', label: 'Recipe Groups', icon: IconList },
      { to: '/ingredients', label: 'Ingredients', icon: IconLeaf },
      { to: '/blogs', label: 'Blogs', icon: IconChart },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/meal-tags', label: 'Meal Tags', icon: IconTag },
      { to: '/lu-facts', label: 'LU Facts', icon: IconFile },
      { to: '/settings', label: 'Settings', icon: IconGear },
    ],
  },
];

const ITEM =
  'relative mb-px flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] ' +
  'text-white/55 transition hover:bg-white/6 hover:text-white/85';

const ACTIVE =
  'bg-forest-2 font-medium text-white ' +
  'before:absolute before:left-0 before:top-1/2 before:h-4.5 before:w-[3px] ' +
  'before:-translate-y-1/2 before:rounded-r-sm before:bg-accent';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-49 bg-black/50 md:hidden" onClick={onClose} />}
      <nav
        className={cx(
          'relative z-50 flex w-[220px] min-w-[220px] shrink-0 flex-col overflow-hidden bg-forest',
          'transition-transform duration-300 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:h-screen',
          open ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
        )}
      >
        {/* Ambient glow, as in the original */}
        <div
          className="pointer-events-none absolute -bottom-15 -right-15 size-50 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(93,202,165,0.12) 0%, transparent 70%)' }}
        />

        <div className="flex shrink-0 items-center gap-2.5 border-b border-white/7 px-5 pt-6 pb-5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent">
            <IconPin />
          </div>
          <span className="text-[19px] font-bold tracking-[-0.02em] text-white">akaani</span>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto">
          {SECTIONS.map((section) => (
            <div key={section.label} className="px-3 pt-5 pb-2">
              <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/25">
                {section.label}
              </div>
              {section.items.map(({ to, label, icon: Icon, badge }) =>
                to ? (
                  <NavLink
                    key={label}
                    to={to}
                    onClick={onClose}
                    className={({ isActive }) => cx(ITEM, isActive && ACTIVE)}
                  >
                    {({ isActive }) => (
                      <>
                        <span className={cx('grid size-4.5 shrink-0 place-items-center', isActive ? 'opacity-100' : 'opacity-70')}>
                          <Icon />
                        </span>
                        {label}
                        {badge && (
                          <span className="ml-auto rounded-full bg-accent/15 px-1.5 py-px text-[10px] font-semibold text-accent">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ) : (
                  /* Not built yet — inert, as it was in the vanilla build. */
                  <span key={label} className={cx(ITEM, 'cursor-default opacity-60')} aria-disabled="true">
                    <span className="grid size-4.5 shrink-0 place-items-center opacity-70"><Icon /></span>
                    {label}
                  </span>
                ),
              )}
            </div>
          ))}
        </div>

        <div className="mt-auto shrink-0 border-t border-white/7 px-3 py-3.5">
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <div className="grid size-7.5 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-forest">
              {initialsOf(user)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium text-white">{displayName(user)}</div>
              {user?.email && displayName(user) !== user.email && (
                <div className="truncate text-[11px] text-white/35">{user.email}</div>
              )}
            </div>
            <button
              type="button"
              onClick={signOut}
              title="Log out"
              aria-label="Log out"
              className="grid size-6.5 shrink-0 cursor-pointer place-items-center rounded-md bg-white/6 text-white/35 transition hover:bg-white/12 hover:text-white/70"
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
