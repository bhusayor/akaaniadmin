import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import NotificationDrawer from './NotificationDrawer.jsx';
import { NOTIFICATIONS } from '../data/notifications.js';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [topbar, setTopbarState] = useState({ title: 'Akaani', searchPlaceholder: null });
  const [search, setSearch] = useState('');
  const location = useLocation();

  /* Stable, so a page's useTopbar effect does not loop. */
  const setTopbar = useCallback((next) => setTopbarState(next), []);

  /* A search typed on one page should not silently filter the next. */
  useEffect(() => { setSearch(''); }, [location.pathname]);

  const unread = notifications.filter((n) => n.unread).length;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="scroll-thin flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar
          title={topbar.title}
          searchPlaceholder={topbar.searchPlaceholder}
          search={search}
          onSearch={setSearch}
          unread={unread}
          onMenu={() => setSidebarOpen(true)}
          onBell={() => setDrawerOpen((v) => !v)}
        />
        <Outlet context={{ setTopbar, search, setSearch }} />
      </div>

      <NotificationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        notifications={notifications}
        setNotifications={setNotifications}
      />
    </div>
  );
}
