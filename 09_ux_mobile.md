# UX Phase 4 — Mobile and power-user

**Goal.** Operators check the product from their phones. Power users want to fly through it with the keyboard. Today the product supports neither.

**Read first:** `client/src/app/investigate/page.js` (3-column position-fixed layout), `client/src/components/layout/AppShell.jsx`, `client/src/app/incident/[id]/page.js`, `client/src/hooks/useShortcuts.js` (from Design Phase 4C, if shipped — otherwise create here).

---

## 4A — Mobile-first overview, incidents, briefing, incident-detail (5 days)

**Problem.** `/investigate` is `gridTemplateColumns: '360px 1fr 360px'` `position: fixed`. On a 375px phone the sidebars vanish or render unusably. `/incident/[id]` is a fixed two-column layout with no responsive treatment. `/briefing` renders a paper-document layout that mostly works on mobile by accident. None of this was designed for phones.

**Operator phone scenarios that must work:**
- Wake up 4am to a notification → open `/overview` → see the night summary
- See a serious incident in the inbox → tap it → review evidence chain and reasoning
- Approve a briefing on the train

**Operator phone scenarios that can stay desktop-only:**
- Live `/investigate` 3-column investigation (operator runs investigations from a desk)
- `/settings/*` configuration (admins do this at a desk)
- `/admin/*` (super_admin)

**Implementation:**

1. **`/overview` mobile.**
   - Single column, all sections stack.
   - Counter row → 2x2 grid (44px tap targets minimum).
   - Top incidents list → cards, not table rows.
   - System health rail → collapsed by default, expands on tap.
   - Sticky CTA at bottom of viewport: "Review briefing" when status === draft.

2. **`/incidents` mobile.**
   - Table → stacked cards (already specified in Phase 1C; double-check execution).
   - Filters → bottom sheet (Radix Dialog with custom slide-up), opened via a filter button in the header.
   - Date picker → fullscreen modal on mobile.
   - Infinite scroll instead of pagination "Load more" button.

3. **`/incident/[id]` mobile.**
   - Two-pane layout → tabbed: `Evidence` | `Map` | `Entities`.
   - Sticky header with severity badge + status pill + back button.
   - Sticky footer with review controls (Mark reviewed / Escalate / Close).
   - Body scrolls between header and footer.

4. **`/briefing` mobile.**
   - Stay paper-document themed (`--bg-briefing`).
   - Approve button becomes a sticky footer.
   - Date picker for archive navigation collapses to a single-line dropdown.

5. **`/investigate` mobile.**
   - Show a holding screen: "Live investigation view is optimized for desktop. Open this incident's detail page instead?" with a link to the current incident's `/incident/[id]`.
   - Do not attempt to render three columns on a phone.

**Breakpoints:**
- `<640px` mobile
- `640–1024px` tablet (use mobile layout, larger paddings)
- `>1024px` desktop (current layout)

Use CSS custom property `--breakpoint-mobile: 640px` and a single matchMedia hook `useIsMobile()` for layout decisions in JS.

**Touch targets:** every interactive element ≥44px square (or 44px tall with adequate horizontal padding). Audit existing buttons; many are 20-32px.

**Acceptance:**
- Test on a real 375px viewport. `/overview`, `/incidents`, `/incident/[id]`, `/briefing` are all usable.
- No horizontal scrolling on any of these pages at 375px.
- A user can approve a briefing on a phone in 3 taps from a notification.

---

## 4B — Keyboard shortcuts and command palette (3 days)

**Problem.** Power users want to move fast. Currently the only keyboard support is Tab navigation.

**Design Phase 4C specified some shortcuts. This phase finishes the picture.**

**Per-page shortcuts (declared in `useShortcuts` per route):**

| Page | Key | Action |
|---|---|---|
| All | `?` | Open shortcut overlay |
| All | `Cmd/Ctrl + K` | Command palette |
| All | `G then O` | Go to /overview |
| All | `G then I` | Go to /incidents |
| All | `G then B` | Go to /briefing |
| All | `G then M` | Go to /investigate (map) |
| All | `G then S` | Go to /settings |
| `/incidents` | `J / ↓` | Next row |
| `/incidents` | `K / ↑` | Previous row |
| `/incidents` | `Enter` | Open selected |
| `/incidents` | `/` | Focus filter |
| `/incidents` | `Esc` | Clear filters |
| `/incidents` | `1-4` | Filter by severity (Serious/Minor/Harmless/Uncertain) |
| `/incident/[id]` | `R` | Mark reviewed (with confirm) |
| `/incident/[id]` | `E` | Escalate (with confirm) |
| `/incident/[id]` | `C` | Close (with confirm) |
| `/incident/[id]` | `←/→` | Previous/next incident in current filter |
| `/briefing` | `A` | Approve (with confirm) |
| `/briefing` | `E` | Edit currently focused section |
| `/briefing` | `←/→` | Previous/next date |
| `/investigate` | `Space` | Pause/resume agent feed scroll |
| `/investigate` | `Esc` | Close any open detail |

**Command palette (`Cmd+K`):**

`client/src/components/shared/CommandPalette.jsx`:
- Fuzzy-search across:
  - Routes (`Go to overview`, `Go to webhooks`, etc.)
  - Recent incidents (last 20 by date)
  - Recent briefings (last 7 dates)
  - Actions (`Approve current briefing`, `Mark incident reviewed`, etc.) — context-aware
  - Settings shortcuts (`Generate API key`, `Configure webhook`, `Invite member`)
- Keyboard-only navigation (Up/Down to move, Enter to select, Esc to close)
- Built on `cmdk` library (already a popular minimal dependency, ~10kb)

**Shortcut overlay (`?`):**

Modal listing all shortcuts for the current page + global shortcuts, grouped by category. Auto-hides interactive elements when displayed.

**Implementation:**

1. `client/src/hooks/useShortcuts.js`:
   - Registers a Map of key sequence → handler scoped to the current route
   - Suspends when focus is in `<input>`, `<textarea>`, `[contenteditable]`
   - Handles multi-key sequences (`G then O`) with a 500ms timeout between keys
2. `client/src/components/layout/ShortcutsProvider.jsx`:
   - Wraps the app in `_app.js` / `layout.js`
   - Provides shortcut context
3. `client/src/components/shared/CommandPalette.jsx` — `cmdk`-based.

**Acceptance:**
- A user can complete morning review (open overview, drill into serious incident, mark reviewed, open briefing, approve) without touching the mouse.
- `?` shows the cheat sheet on every page.
- `Cmd+K` opens a fast, fuzzy command palette.

---

## 4C — Touch gestures (1 day)

**Problem.** The mobile UI is functional after 4A but feels like a shrunken desktop. Touch gestures make it feel native.

**Gestures to add:**

| Surface | Gesture | Action |
|---|---|---|
| `/incidents` row card | Swipe right | Mark reviewed |
| `/incidents` row card | Swipe left | Open detail |
| `/notifications` item | Swipe left | Dismiss |
| `/incident/[id]` tabs | Swipe horizontal | Switch tab (Evidence / Map / Entities) |
| Any modal | Swipe down on header | Close |

**Implementation:**

- Use `@use-gesture/react` (already common, lightweight)
- Provide visual affordance: subtle motion as the user starts swiping, snap-to-action when the threshold is crossed.
- All swipe actions also have a non-gesture equivalent (button, menu) so they're not the only path.

**Acceptance:**
- A user can dismiss 10 notifications with swipes in under 5 seconds.
- A user can move between incident tabs by swiping.

---

## 4D — Bandwidth and performance (parallel, 2 days)

**Problem.** Mobile users are often on cellular. The current bundle and rendering choices have not been audited.

**Action:**

1. **Bundle audit.** Run `next build --profile`. Check page bundle sizes. Anything > 200KB JS per route is suspect.
2. **Heavy dependencies to audit:**
   - `react-three-fiber` + `three` — used only on landing page? If so, lazy-load it.
   - `recharts` — used only on `/overview`? Lazy-load.
   - `framer-motion` — used everywhere; check tree-shaking.
   - `leaflet` + `react-leaflet` — used only on map pages. Lazy-load.
3. **Image optimization.** Every `<img>` becomes Next `<Image>`. Specify `sizes` and `priority` correctly.
4. **SSE on mobile.** Connection drops are frequent. Implement exponential reconnect with backoff (1s, 2s, 4s, 8s, max 30s). Show a discreet "Reconnecting…" indicator.
5. **Skeleton states.** Every async render has a skeleton matching the final layout. No layout shift on data arrival.

**Acceptance:**
- Lighthouse mobile score ≥ 85 on `/overview`.
- Initial JS payload for `/overview` < 150KB gzipped.
- SSE reconnects automatically after network blip without user action.

---

## Constraints

- Mobile is a real use case. Don't ship "responsive" tokenism; test on real phones, not just narrow browser windows.
- Power-user features are additive. Tab/Enter must still work for users who don't learn shortcuts.
- No new external dependencies beyond `cmdk` and `@use-gesture/react` (both small, focused).
- Touch gestures must not steal browser navigation gestures (no horizontal-swipe on the page root).

---

## Ship order

4A first (mobile critical paths). 4B parallel (keyboard — independent surface). 4D parallel (performance — independent). 4C last (touch gestures — depends on 4A mobile layouts being stable).

After all four land, dogfood with at least one operator using only a phone for a week. Iterate based on what they hit.
