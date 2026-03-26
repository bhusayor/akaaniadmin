/* ═══════════════════════════════════════════════════════
   AKAANI ADMIN — SHARED JAVASCRIPT
   Sidebar mobile toggle · Notification drawer · Router · Toast
   ═══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════
   SIDEBAR MOBILE TOGGLE
══════════════════════════════════════ */
function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!sb) return;
  sb.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('active');
  // prevent body scroll when open
  document.body.style.overflow = sb.classList.contains('mobile-open') ? 'hidden' : '';
}

function closeSidebar() {
  const sb = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!sb) return;
  sb.classList.remove('mobile-open');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════
   PAGE NAVIGATION
══════════════════════════════════════ */
const PAGES = {
  dashboard:  'pages/dashboard.html',
  customers:  'pages/customers.html',
  meals:      'pages/meals.html',
  settings:   'pages/settings.html',
};

function navigate(page) {
  closeSidebar();
  if (PAGES[page]) {
    window.location.href = PAGES[page];
  }
}

/* Mark active nav item based on current page */
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    const pg = item.dataset.page;
    const isActive = path.includes(pg) || (path.endsWith('index.html') && pg === 'dashboard') || (path === '/' && pg === 'dashboard');
    item.classList.toggle('active', isActive);
  });
}

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function showToast(msg, success = true) {
  let t = document.getElementById('globalToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'globalToast';
    t.className = 'toast';
    t.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg><span id="globalToastMsg"></span>`;
    document.body.appendChild(t);
  }
  document.getElementById('globalToastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ══════════════════════════════════════
   NOTIFICATION DRAWER
══════════════════════════════════════ */
const NOTIFS = [
  { id:1,  group:'Today',     category:'customers', unread:true,  icon:'👤', iconBg:'#E6F1FB', msg:'<strong>Amara Okafor</strong> just signed up from Nigeria.',                         time:'2 min ago',         tag:'New user', tagBg:'#E6F1FB', tagColor:'#185FA5' },
  { id:2,  group:'Today',     category:'lu',        unread:true,  icon:'🌿', iconBg:'#E1F5EE', msg:'<strong>Lu</strong> — Breakfast meals are underrepresented this week.',              time:'18 min ago',        tag:'Lu AI',    tagBg:'#E1F5EE', tagColor:'#0F6E56' },
  { id:3,  group:'Today',     category:'platform',  unread:true,  icon:'💳', iconBg:'#FDF6EE', msg:'Payment of <strong>₦12,500</strong> received via Paystack.',                         time:'1 hr ago',          tag:'Payment',  tagBg:'#FDF6EE', tagColor:'#854F0B' },
  { id:4,  group:'Today',     category:'customers', unread:true,  icon:'👤', iconBg:'#E6F1FB', msg:'<strong>Kofi Mensah</strong> updated their meal preferences.',                       time:'2 hr ago',          tag:'Activity', tagBg:'#EEEDFE', tagColor:'#534AB7' },
  { id:5,  group:'Today',     category:'platform',  unread:true,  icon:'⚠️', iconBg:'#FDF6EE', msg:'API response time spiked to <strong>1.8s</strong> — now resolved.',                 time:'3 hr ago',          tag:'System',   tagBg:'#FDF6EE', tagColor:'#854F0B' },
  { id:6,  group:'Today',     category:'customers', unread:false, icon:'👥', iconBg:'#E6F1FB', msg:'<strong>6 new users</strong> joined the platform today.',                            time:'5 hr ago',          tag:'Summary',  tagBg:'#E1F5EE', tagColor:'#0F6E56' },
  { id:7,  group:'Yesterday', category:'lu',        unread:true,  icon:'🌿', iconBg:'#E1F5EE', msg:'<strong>Lu</strong> recommends adding more Lunch options for Ghana users.',          time:'Yesterday, 4:30 PM',tag:'Lu AI',    tagBg:'#E1F5EE', tagColor:'#0F6E56' },
  { id:8,  group:'Yesterday', category:'platform',  unread:false, icon:'📊', iconBg:'#EEEDFE', msg:'Weekly report ready — <strong>47 new users</strong>, ↑18% growth.',                  time:'Yesterday, 9:00 AM',tag:'Report',   tagBg:'#EEEDFE', tagColor:'#534AB7' },
  { id:9,  group:'Yesterday', category:'customers', unread:false, icon:'👤', iconBg:'#FEECEC', msg:'<strong>Njeri Wanjiku</strong> cancelled their subscription.',                        time:'Yesterday, 8:14 AM',tag:'Churn',    tagBg:'#FEECEC', tagColor:'#A32D2D' },
  { id:10, group:'Earlier',   category:'platform',  unread:false, icon:'🔐', iconBg:'#E1F5EE', msg:'Two-factor authentication was enabled on your account.',                             time:'20 Mar, 3:00 PM',   tag:'Security', tagBg:'#E1F5EE', tagColor:'#0F6E56' },
  { id:11, group:'Earlier',   category:'lu',        unread:false, icon:'🌿', iconBg:'#E1F5EE', msg:'<strong>Lu</strong> flagged 4 meals with incomplete macro data.',                    time:'19 Mar, 11:20 AM',  tag:'Lu AI',    tagBg:'#E1F5EE', tagColor:'#0F6E56' },
  { id:12, group:'Earlier',   category:'platform',  unread:false, icon:'💳', iconBg:'#FDF6EE', msg:'Monthly billing: <strong>₦373,450</strong> total processed.',                        time:'18 Mar, 9:00 AM',   tag:'Billing',  tagBg:'#FDF6EE', tagColor:'#854F0B' },
];

let notifFilter = 'all';
let drawerOpen  = false;

function getFilteredNotifs() {
  if (notifFilter === 'all')    return NOTIFS;
  if (notifFilter === 'unread') return NOTIFS.filter(n => n.unread);
  return NOTIFS.filter(n => n.category === notifFilter);
}

function renderNotifs() {
  const list = document.getElementById('notifList');
  if (!list) return;
  const data = getFilteredNotifs();

  if (!data.length) {
    list.innerHTML = `<div class="notif-empty"><div class="notif-empty-icon">🔔</div><div class="notif-empty-text">All caught up</div><div class="notif-empty-sub">No notifications here.</div></div>`;
    return;
  }

  const groups = {};
  data.forEach(n => { if (!groups[n.group]) groups[n.group] = []; groups[n.group].push(n); });

  let html = '';
  Object.entries(groups).forEach(([gName, items], gi) => {
    html += `<div class="notif-date-group">${gName}</div>`;
    items.forEach((n, i) => {
      html += `
        <div class="notif-item ${n.unread ? 'unread' : ''}" id="notif-${n.id}" onclick="readNotif(${n.id})" style="animation-delay:${(gi * items.length + i) * 0.04}s;">
          ${n.unread ? '<div class="notif-unread-pip"></div>' : ''}
          <div class="notif-icon-wrap" style="background:${n.iconBg};">${n.icon}</div>
          <div class="notif-body">
            <div class="notif-msg"><span class="notif-category-tag" style="background:${n.tagBg};color:${n.tagColor};">${n.tag}</span>${n.msg}</div>
            <div class="notif-time"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${n.time}</div>
          </div>
          <button class="notif-action-btn" title="Dismiss" onclick="event.stopPropagation();dismissNotif(${n.id})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`;
    });
  });
  list.innerHTML = html;
  updateUnreadBadge();
}

function updateUnreadBadge() {
  const count  = NOTIFS.filter(n => n.unread).length;
  const badge  = document.getElementById('unreadBadge');
  const dot    = document.getElementById('notifDot');
  if (badge) { badge.textContent = count; badge.classList.toggle('hidden', count === 0); }
  if (dot)   dot.style.display = count > 0 ? 'block' : 'none';
}

function readNotif(id) {
  const n = NOTIFS.find(x => x.id === id); if (!n) return;
  n.unread = false;
  const el = document.getElementById('notif-' + id);
  if (el) { el.classList.remove('unread'); const pip = el.querySelector('.notif-unread-pip'); if (pip) pip.remove(); }
  updateUnreadBadge();
}

function dismissNotif(id) {
  const idx = NOTIFS.findIndex(x => x.id === id);
  if (idx !== -1) NOTIFS.splice(idx, 1);
  renderNotifs();
}

function markAllRead() {
  NOTIFS.forEach(n => n.unread = false);
  renderNotifs();
}

function filterNotifs(filter, btn) {
  notifFilter = filter;
  document.querySelectorAll('.notif-filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderNotifs();
}

function toggleNotifDrawer() { drawerOpen ? closeNotifDrawer() : openNotifDrawer(); }

function openNotifDrawer() {
  drawerOpen = true;
  document.getElementById('notifDrawer')?.classList.add('open');
  document.getElementById('notifBackdrop')?.classList.add('open');
  renderNotifs();
}

function closeNotifDrawer() {
  drawerOpen = false;
  document.getElementById('notifDrawer')?.classList.remove('open');
  document.getElementById('notifBackdrop')?.classList.remove('open');
}

/* ══════════════════════════════════════
   CHART TAB SWITCHING (dashboard)
══════════════════════════════════════ */
function initChartTabs() {
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      this.closest('.chart-tabs').querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
    });
  });
  document.querySelectorAll('.currency-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      this.closest('.currency-tabs').querySelectorAll('.currency-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

/* ══════════════════════════════════════
   INIT (runs on every page)
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  updateUnreadBadge();
  initChartTabs();

  // Sidebar overlay click to close
  document.querySelector('.sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Escape key handlers
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeNotifDrawer();
      closeSidebar();
      document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
    }
  });
});
