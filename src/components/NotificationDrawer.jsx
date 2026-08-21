import { useMemo, useState } from 'react';
import { IconClose, IconClock } from './icons.jsx';
import { cx } from './ui.jsx';

const FILTERS = [
  ['all', 'All'], ['unread', 'Unread'], ['customers', 'Customers'],
  ['platform', 'Platform'], ['lu', 'Lu AI'],
];

export default function NotificationDrawer({ open, onClose, notifications, setNotifications }) {
  const [filter, setFilter] = useState('all');

  const shown = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => n.unread);
    return notifications.filter((n) => n.category === filter);
  }, [notifications, filter]);

  const groups = useMemo(() => {
    const out = {};
    shown.forEach((n) => { (out[n.group] ||= []).push(n); });
    return out;
  }, [shown]);

  const unread = notifications.filter((n) => n.unread).length;

  const markRead = (id) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  const dismiss = (id) => setNotifications((prev) => prev.filter((n) => n.id !== id));
  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));

  return (
    <>
      <div
        onClick={onClose}
        className={cx(
          'fixed inset-0 z-80 transition-colors duration-300',
          open ? 'bg-black/18' : 'pointer-events-none bg-transparent',
        )}
      />
      <aside
        className={cx(
          'fixed inset-y-0 right-0 z-90 flex h-screen w-[380px] flex-col border-l border-line bg-surface',
          'shadow-[-8px_0_40px_rgba(0,0,0,0.1)] transition-transform duration-300 max-md:w-full',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line-light px-5 pt-4.5 pb-3.5">
          <div className="flex items-center gap-2.5 text-base font-bold tracking-[-0.02em] text-ink">
            Notifications
            {unread > 0 && (
              <span className="min-w-[22px] rounded-full bg-chili px-1.5 py-0.5 text-center text-[11px] font-bold text-white">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={markAllRead} className="rounded-md px-2 py-1 text-xs font-medium text-ink-3 transition hover:bg-canvas hover:text-forest">
              Mark all read
            </button>
            <button onClick={onClose} className="grid size-7.5 place-items-center rounded-lg bg-canvas text-ink-3 transition hover:bg-line-light hover:text-ink">
              <IconClose />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line-light px-5 pt-2.5">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cx(
                '-mb-px whitespace-nowrap rounded-t-md border-b-2 px-3.5 py-1.5 text-xs transition',
                filter === key
                  ? 'border-forest font-semibold text-forest'
                  : 'border-transparent font-medium text-ink-3 hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto">
          {!shown.length ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-5 py-10 text-center">
              <div className="text-[40px] opacity-40">🔔</div>
              <div className="text-sm font-medium text-ink-2">All caught up</div>
              <div className="text-xs text-ink-3">No notifications here.</div>
            </div>
          ) : (
            Object.entries(groups).map(([groupName, items]) => (
              <div key={groupName}>
                <div className="px-5 pt-3.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                  {groupName}
                </div>
                {items.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={cx(
                      'group relative flex cursor-pointer items-start gap-3 border-b border-line-light px-5 py-3.5 transition',
                      n.unread ? 'bg-[#F0FBF7] hover:bg-[#E6F8F2]' : 'hover:bg-canvas',
                    )}
                  >
                    {n.unread && <span className="absolute left-2 top-1/2 size-[5px] -translate-y-1/2 rounded-full bg-mint" />}
                    <div className="grid size-9 shrink-0 place-items-center rounded-[10px] text-base" style={{ background: n.iconBg }}>
                      {n.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cx('mb-1 text-[13px] leading-snug text-ink', n.unread && 'font-medium')}>
                        <span
                          className="mr-1 inline-flex rounded px-1.5 py-px text-[10px] font-semibold"
                          style={{ background: n.tagBg, color: n.tagColor }}
                        >
                          {n.tag}
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: n.msg }} />
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-ink-3">
                        <IconClock />
                        {n.time}
                      </div>
                    </div>
                    <button
                      title="Dismiss"
                      onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                      className="grid size-6.5 shrink-0 place-items-center rounded-md text-ink-3 opacity-0 transition hover:bg-line-light hover:text-ink group-hover:opacity-100"
                    >
                      <IconClose size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="shrink-0 border-t border-line-light px-5 py-3.5 text-center">
          <button className="rounded-lg px-4 py-1.5 text-[13px] font-medium text-forest transition hover:bg-mint-light">
            View notification history
          </button>
        </div>
      </aside>
    </>
  );
}
