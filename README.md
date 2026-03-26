# Akaani Admin Dashboard

A fully responsive admin dashboard for the **Akaani** AI-powered food and meal planning platform. Built with vanilla HTML, CSS, and JavaScript — no frameworks, no build step, opens directly in a browser.

---

## Pages

| Page | File | Description |
|------|------|-------------|
| Splash / Entry | `index.html` | Animated splash screen, auto-redirects to dashboard |
| Dashboard | `pages/dashboard.html` | Stats, revenue chart, users by country, recent customers & meals, notification drawer |
| Customers | `pages/customers.html` | Customer table with search, filter, sort, export, all row actions (view, edit, toggle status, message, delete) |
| Meals | `pages/meals.html` | Meals grouped by tag, list & grid view, bulk edit mode, export |
| Settings | `pages/settings.html` | Profile, password & 2FA, platform config, localization, notifications, team members, roles & permissions |

---

## Project Structure

```
akaani-admin/
├── index.html              ← Splash entry point
├── css/
│   └── shared.css          ← Design tokens, layout, sidebar, topbar, all shared components
├── js/
│   └── shared.js           ← Sidebar toggle, notification drawer, nav routing, toast
├── pages/
│   ├── dashboard.html
│   ├── customers.html
│   ├── meals.html
│   └── settings.html
└── README.md
```

---

## How to Open

### Option A — Direct browser open
Just double-click `index.html` or any file in `/pages/` — it works without a server.

### Option B — VS Code Live Server (recommended)
1. Open the `akaani-admin/` folder in VS Code
2. Install the **Live Server** extension (ritwickdey.LiveServer)
3. Right-click `index.html` → **Open with Live Server**
4. Navigate between pages using the sidebar

---

## Design System

| Token | Value |
|-------|-------|
| Primary (sidebar) | `#003232` — Deep Forest Green |
| Accent | `#5DCAA5` — Teal |
| Background | `#F5F6FA` |
| Surface | `#ffffff` |
| Danger | `#E24B4A` |
| Success | `#1D9E75` |
| Font | Outfit (Google Fonts) |

---

## Mobile Responsive

All pages are fully responsive:
- **≤ 768px** — Sidebar becomes an off-canvas drawer (hamburger menu), search bar hidden, content padding reduced, multi-column grids stack
- **≤ 480px** — Single column layouts, pagination simplified, modals slide up from bottom

---

## Push to GitHub

```bash
cd akaani-admin

git init
git add .
git commit -m "feat: initial Akaani admin dashboard"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/akaani-admin.git
git branch -M main
git push -u origin main
```

---

## Features

- ✅ Dashboard with Lu AI insight banner, stat cards with sparklines, revenue chart, notification drawer
- ✅ Customers — search, filter, sort, paginate, export CSV, view profile, edit, toggle status, message, delete
- ✅ Meals — grouped by tag, list & grid view toggle, bulk edit (add/remove tags simultaneously), export
- ✅ Settings — 6-section settings nav (profile, password/2FA, platform, localization, notifications, team & roles)
- ✅ Notification drawer — filter by category, mark read, dismiss, mark all read
- ✅ Fully mobile responsive — all 4 pages
- ✅ No build step, no npm, no framework — pure HTML/CSS/JS

---

Built for **Akaani** · Designed by Peter Omidiji
