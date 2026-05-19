# Design Phase 4 — Accessibility

**Goal.** Bring the product to WCAG 2.1 AA across operator-facing pages. The current state ships color-only severity encoding, missing form labels, focus rings overridden in places, and no semantic landmarks. None of these need a redesign — they need correct implementation.

**Read first:** `client/src/colors_and_type.css`, all `client/src/app/**/page.{js,jsx}` files, `client/src/components/events/EventCard.jsx`.

---

## 4A — Severity icons everywhere (1 day)

**Problem.** README §14 says: "Severity badges carry both color AND icon for accessibility." Reality: `EventCard.jsx` and most badges render text labels with color only. WCAG 1.4.1 (Use of Color) fails.

**Action.** With `client/src/lib/severity.js` as the single source (from Design Phase 3D), enforce a hard rule: any rendering of severity in the UI must include both the token color and the icon. No exceptions.

1. Update every severity rendering site (`SeverityBadge`, `EventCard`, `IncidentCard`, briefing section badges, the `/overview` counters, the `/incidents` table cells).
2. Icon sized to match text: `size={14}` for `--text-sm`, `size={16}` for `--text-base`.
3. Icon receives `aria-hidden="true"` and the label receives the actual severity word (`<span>Serious</span>`, not just the icon).
4. Add unit visual tests (Playwright or similar) that screenshot each severity rendering and diff against a baseline. Prevents regression.

**Acceptance:**
- A user with red/green color blindness can distinguish all four severity levels by icon alone.
- Grayscale screenshot of `/incidents` still communicates severity hierarchy.

---

## 4B — Form labels and ARIA (2 days)

**Problem.** Spot-checking `settings/webhooks/page.jsx`, `settings/api-keys`, `setup/page.jsx`: many inputs have visible labels but no programmatic association (`<label for="...">` or `aria-labelledby`). Screen readers announce "edit text, blank" instead of the field's purpose. Many icon buttons (copy, reveal, retry) lack `aria-label`.

**Action.**

1. Audit every `<input>`, `<textarea>`, `<select>` in `client/src/app/`. Each must have a `<label htmlFor="id">` or `aria-label`.
2. Audit every icon-only `<button>`. Each must have `aria-label`.
3. Decorative SVGs/icons (e.g., the green status dot in the TopBar) get `aria-hidden="true"`.
4. Form error messages get `role="alert"` and `aria-live="polite"`, associated to the field via `aria-describedby`.
5. Form submission buttons that show loading state must update accessible name: `aria-busy="true"` plus text change ("Saving…").

**Acceptance:**
- Run an axe-core scan on the seven highest-traffic pages (`/login`, `/register`, `/overview`, `/incidents`, `/incident/[id]`, `/briefing`, `/settings/webhooks`). Zero serious or critical issues.
- VoiceOver/NVDA reads each form field's purpose without the user inferring from visual layout.

---

## 4C — Keyboard navigation (parallel to Phase 1C, 1 day extra)

**Problem.** The product is operator-facing. Operators check things fast. Mouse-only navigation slows them down.

**Action.** Phase 1C already specifies J/K/Enter/Esc for `/incidents`. Extend to other surfaces:

- **`/overview`**: number keys 1-4 jump to severity-filtered `/incidents` list. `B` opens `/briefing`. `M` opens `/investigate` (map).
- **`/incident/[id]`**: `E` to escalate, `R` to mark reviewed, `C` to close. Each prompts a confirmation modal (no irreversible action without confirm).
- **`/investigate`**: Space pauses/resumes the agent feed scroll. Esc closes any open detail panel.
- **`/briefing`**: `A` opens approve modal. `E` enters edit mode for the currently focused section.
- **Global**: `?` opens a keyboard shortcut overlay. `Cmd+K` / `Ctrl+K` opens command palette (defer to Phase 5 if not built yet).

**Implementation:**

1. New hook `client/src/hooks/useShortcuts.js` — registers a Map of key → handler scoped to the current route.
2. Shortcut overlay component, lives at `_app` level so `?` works everywhere.
3. Shortcuts disabled when focus is in an input/textarea/contenteditable.
4. Each shortcut documented inline in the overlay.

**Acceptance:**
- A user can complete an entire morning review (open overview, drill into a serious incident, mark it reviewed, open briefing, approve) without touching the mouse.
- `?` shows the cheat sheet.

---

## 4D — Focus visible everywhere (half day)

**Problem.** `globals.css` has a `:focus-visible` rule, but several components override it via inline styles or hover-only effects. Tabbing through `/investigate` loses the focus indicator on the agent feed.

**Action.**

1. Add a global rule with high specificity:
   ```css
   *:focus-visible {
     outline: 2px solid var(--border-focus);
     outline-offset: 2px;
     border-radius: 2px;
   }
   button:focus-visible,
   a:focus-visible,
   [role="button"]:focus-visible {
     outline-offset: 3px;
   }
   ```
2. Audit components that set `outline: none` and remove it unless they explicitly replace with another visible indicator.
3. Custom-styled inputs (the OTP boxes in `verify-email`, the API key field in `setup`) must visibly show focus.
4. Skip-to-content link at the top of the page: `<a href="#main">Skip to content</a>` visually hidden until focused.

**Acceptance:**
- Tab through every page. Every interactive element shows a 2px cyan ring.
- Skip link appears on first Tab press from page top.

---

## 4E — Semantic landmarks and headings (1 day)

**Problem.** Pages use `<div>` for everything. Screen reader users have no way to jump between landmarks.

**Action.**

1. Every page has exactly one `<h1>` matching the page's purpose (page title, not site name).
2. Heading hierarchy descends without skipping (no `<h1>` then `<h3>`).
3. Each page region wrapped in a semantic landmark:
   - `<header>` for the TopBar — already correct.
   - `<nav>` for the TopBar links.
   - `<main id="main">` for the primary content of each page.
   - `<aside>` for sidebars (settings nav, incident detail right rail).
   - `<footer>` only if the page has one — landing page yes, app pages no.
4. The fixed 3-column `/investigate` layout: middle column is `<main>`. Left and right are `<aside>` with `aria-label="Agent activity"` and `aria-label="Events list"` respectively.

**Acceptance:**
- Screen reader landmark navigation reaches each meaningful region in one keystroke.
- Heading hierarchy is valid on every page (axe-core check).

---

## 4F — Color contrast (parallel, half day)

**Problem.** A few token combinations are close to failing AA. Spot-checks:

- `--fg-3: #6b7686` on `--bg-surface-1 #11151c` → 4.42:1. Passes AA for text ≥18pt but fails for body. This token is widely used for "secondary" labels.
- `--fg-4: #434d5c` on the same background → 2.6:1. Fails entirely. Used for "disabled, placeholders." Acceptable for non-text states but not for any text the user might need to read.

**Action.**

1. Run a contrast checker against every token pair currently in use. Generate `client/src/lib/contrast-audit.md` documenting each pair and its ratio.
2. Adjust `--fg-3` upward to `#8190a0` (passes AA on `--bg-surface-1` at 5.5:1). Verify it doesn't degrade visual hierarchy.
3. `--fg-4` is acceptable for placeholders only. Audit every placeholder usage to confirm. For disabled buttons that show text, switch to `--fg-3` plus `opacity: 0.5`.
4. Severity badge text on its colored background: re-verify after Phase 3 color changes. Aim for AA at minimum.

**Acceptance:**
- All token pairs in active use pass AA for normal text (4.5:1) or 3:1 for large text/non-text.
- Contrast audit doc committed and referenced from `colors_and_type.css`.

---

## Constraints

- Use semantic HTML, not ARIA, where possible. `<button>` not `<div role="button">`.
- Do not introduce a separate "accessible" theme. Accessibility is the default theme.
- Keyboard shortcuts must not conflict with browser shortcuts (no `Cmd+W`, no `Cmd+T`).
- All changes are additive. No accessibility fix should change layout or visual design beyond contrast adjustments.

---

## Ship order

4A and 4D first (lowest risk, highest WCAG impact). 4B (forms) and 4E (landmarks) parallel. 4F (contrast) parallel. 4C (keyboard) ships with Phase 1C since they overlap.

After all five land, run a full axe-core CI scan and gate deploys on zero serious/critical findings.
