# UX Phase 2 — Navigation and shell parity

**Goal.** One product, one shell, one nav. Today the operator app, the settings area, and the admin panel feel like three different products bolted together.

**Read first:** `client/src/components/layout/TopBar.jsx`, `client/src/components/layout/RootFrame.jsx`, `client/src/app/settings/layout.jsx`, `client/src/app/admin/layout.jsx`, `CLAUDE.md` §13.

---

## 2A — Unified TopBar (2 days)

**Problem.** Today's TopBar has: INVESTIGATE, BRIEFING, PROFILE, optional SETTINGS, optional ADMIN. After Phase 1, it must also surface OVERVIEW and INCIDENTS, plus a notification center (Phase 3), plus the user menu in a sane way. The current row of mono-uppercase links won't scale.

**Final TopBar structure:**

```
[●] [SENTINEL]  |  OVERVIEW · INCIDENTS · BRIEFING · MAP        Night of Mon 17 May    14:32:08    [🔔3] [user ▾]
```

- **Left cluster (`flex: none`):**
  - Status indicator dot (live system health — green/amber/red, ties to `argusStatus + sensorsOnline / sensorsTotal`)
  - Wordmark `SENTINEL` (SVG, links to `/overview`)
  - Vertical divider
  - Primary nav: `OVERVIEW`, `INCIDENTS`, `BRIEFING`, `MAP` (the last replaces `INVESTIGATE` in the user-visible label; route stays `/investigate`)
- **Centre (`flex: 1`):**
  - Night-of label, mono small (existing)
- **Right cluster (`flex: none`):**
  - Live clock, mono accent
  - Notification bell with unread badge (Phase 3)
  - User menu: avatar/initial + dropdown with Profile, Settings, Sign out
  - For super_admin only: a separate `ADMIN` link rendered before the user menu, visually marked (boxed, smaller, mono)

**Behavior:**
- Active route is bolded and underlined with a 2px `var(--accent)` bottom border.
- Hover state: brighten link color by one step (`--fg-3` → `--fg-2`).
- Settings, Profile, Sign out hidden behind the user menu — never as top-level links. Frees space and matches every other SaaS app the operator already knows.
- The status dot is clickable → opens a small panel showing sensor count, drone state, Argus state. Mirrors the data on `/overview` system health rail.

**Implementation:**
1. Rewrite `TopBar.jsx` against Night Watch tokens only. No hardcoded `#0f1117`, `#2a3347`, `#22c55e`. Use `--bg-surface-1`, `--border-default`, `--sev-harmless` (or new `--system-ok`).
2. Add `client/src/components/layout/UserMenu.jsx` — Radix DropdownMenu primitive, styled per Night Watch.
3. Add `client/src/components/layout/SystemStatusPill.jsx` — the dot + click panel.
4. Move `BUTTON role="search"` palette trigger (`Cmd+K`) into the TopBar (placeholder; full palette is Phase 5).

**Mobile (≤768px):**
- Wordmark + status dot stay visible.
- Primary nav collapses behind a hamburger.
- Clock and night-of label hidden.
- Notification bell and user menu remain visible.

**Acceptance:**
- TopBar renders identically across `/overview`, `/incidents`, `/incident/[id]`, `/briefing`, `/investigate`, `/settings/*`, `/admin/*`.
- Every TopBar element responds to keyboard focus visibly.
- On a 375px viewport, no element overflows; hamburger reveals primary nav.

---

## 2B — Settings shell in Night Watch (3 days)

**Problem.** `client/src/app/settings/layout.jsx` and every page under it use a different design system: white background, indigo accents, gray text, shadcn primitives styled for light mode. The operator clicks "Settings" and lands in what feels like a different SaaS app. Mental whiplash.

**Action.** Rebuild the settings shell to use Night Watch tokens. The structure stays — sidebar + content — but the visual language matches the rest of the product.

**Sidebar (`client/src/app/settings/layout.jsx`):**
- Background `--bg-surface-1`
- Border-right `--border-default`
- Section header (`SETTINGS`) in mono small, `--fg-3`
- Links: mono uppercase 11px (matches TopBar style), `--fg-3` default, `--fg-1` active with 2px left border in `--accent`
- Sections grouped: **Account** (Profile, API Keys), **Organisation** (General, Members, Webhooks, Integrations, Documents). Each group has a mono uppercase header.

**Visible roles:**
- Operator sees: Profile, Documents (read/upload only)
- Org admin sees: all
- Section/page visibility based on role; do not render links the user can't access.

**Content area:**
- Background `--bg-base`
- Padding 32px top/24px sides
- Page `<h1>` in `--font-sans`, 24px medium, `--fg-1`
- Section cards: `--bg-surface-1` background, `--border-default` 1px, 4px radius. Inner padding 24px.

**Per-page rewrites (token migration, no logic change):**

1. `settings/general/page.jsx`
2. `settings/api-keys/page.jsx`
3. `settings/members/page.jsx`
4. `settings/webhooks/page.jsx` — biggest job; many shadcn primitives in use
5. `settings/integrations/page.jsx`
6. `settings/documents/page.jsx`
7. `settings/profile/page.jsx`

**Migration approach.** Don't rewrite components. Update the styled wrappers — replace Tailwind utility classes with inline styles or new Night Watch utility classes. Radix primitives keep their behavior; restyle the wrappers.

**Shared component bank:**
- `Card`, `SectionHeader`, `Input`, `Textarea`, `Select`, `Button`, `Checkbox`, `Switch`, `Dialog`, `Toast` — all in `client/src/components/ui/`, all Night Watch only. Build out the missing ones; delete the duplicate shadcn-styled siblings.

**Acceptance:**
- Settings pages and operator pages visually feel like one product.
- `grep -r "bg-gray\|bg-white\|bg-indigo\|text-indigo\|border-gray" client/src/app/settings/` returns zero matches.
- The Webhooks page (most complex) renders deliveries, status pills, retry actions, and the test panel in Night Watch.

---

## 2C — Admin shell in Night Watch (2 days)

**Problem.** Same as 2B but worse. The admin panel is `super_admin` only — used by Anthropic-side support staff. Today it's a third visual world.

**Action.** Match the settings shell pattern.

**Differences from settings:**
- TopBar present (per 2A), with `ADMIN` link visibly active.
- Admin sidebar prepended in red-tinged neutral to signal "you are in the platform-admin context, not a customer context." Use a thin top border in `--accent-dim` plus a small `PLATFORM ADMIN` mono label at the top of the sidebar.
- Sidebar links: Orgs, Users, Audit, API Keys, Jobs.
- Each page (`admin/orgs`, `admin/users`, `admin/audit`, `admin/apikeys`, `admin/jobs`) rebuilt against Night Watch tokens.

**Special: `/admin/audit`** is the most important admin page (security tool, frequent use). Beyond the token migration, add:
- Timeline group-by (day)
- Filter chips at the top: action type, resource type, user, org, date range
- Row expansion to show `metadata` JSON pretty-printed in a code block

**Acceptance:**
- Admin pages render in Night Watch.
- `/admin/audit` lets a super_admin find any of the last 1000 events in under 10 seconds with filters.
- "Back to product" link removed — TopBar `ADMIN` toggle and `OVERVIEW` link are the navigation.

---

## 2D — Page-level breadcrumbs and titles (1 day)

**Problem.** No persistent indication of where you are in a hierarchy. `/incident/[id]` shows only "← Back" pointing to investigate, but the back-arrow text says "BACK TO DASHBOARD" while pointing to `/investigate`. Mismatched mental model.

**Action.**

1. Every non-top-level page renders a breadcrumb just below the TopBar:
   - `Incidents / Untagged vehicle near Block C`
   - `Briefing / 2026-05-17`
   - `Settings / Webhooks`
   - `Admin / Organisations / Acme Industrial`
2. Breadcrumbs are mono 11px, `--fg-3`. Last segment `--fg-1` and non-link.
3. Document `<title>` for each page set via Next.js metadata: `Sentinel · {section} · {subject}`.

**Acceptance:**
- Tab title in the browser reflects the page consistently.
- Breadcrumb appears on every page except top-level dashboards (`/overview`, `/incidents`, `/briefing`, `/investigate`).

---

## Constraints

- TopBar height stays 56px. Layouts depend on it (`paddingTop: 56px` in `RootFrame`).
- Cookie names, audit strings, repo folder names unchanged (canonical decisions from Phase 1 master prompt).
- No new external dependencies. Reuse Radix UI primitives already in package.json.
- Settings and admin pages preserve URLs. Do not change route paths.

---

## Ship order

2A first (TopBar — every other page depends on it). 2B and 2C parallel (settings and admin, by different developers if possible). 2D last (breadcrumbs depend on stable navigation).
