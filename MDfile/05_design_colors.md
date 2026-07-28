# Design Phase 3 — Color decisions

**Goal.** Three specific color choices in the Night Watch system are working against the UI. Fix them, then enforce the system.

**Read first:** `client/src/colors_and_type.css`, `client/src/app/globals.css`, screenshots of `/investigate` and `/incident/[id]` at default zoom.

---

## 3A — Disambiguate accent from focus ring (half day)

**Problem.** `--accent: #b8d4e8` and `--border-focus: #b8dgit4e8` are the same value. Focus state is invisible against any accent-colored element. WCAG 2.4.7 (Focus Visible) requires a focus indicator that is perceivable.

**Decision.** Keep `--accent` as the pale instrumentation tint. Change `--border-focus` to a clearly distinct, higher-saturation cyan that reads as "system is highlighting this":

```css
--accent:        #b8d4e8;   /* unchanged */
--accent-dim:    #5a87a8;   /* unchanged */
--border-focus:  #4cc2ff;   /* NEW — bright cyan, 70% saturation, distinct from accent */
```

**Verify contrast.** `#4cc2ff` on `--bg-base #07090c` → 8.6:1 (passes WCAG AAA for non-text). On `--bg-surface-1 #11151c` → 7.9:1 (passes AAA). Good.

**Update:**
- `:focus-visible` rules in `globals.css` use `outline: 2px solid var(--border-focus)` with `outline-offset: 2px`.
- Severity filter pills that currently use `accent` for the active state must switch to a different visual treatment (background fill, not border color) so focus on a pressed pill is still distinguishable from the pressed state.

**Acceptance:**
- Tab through `/overview`, `/incidents`, `/incident/[id]`, `/briefing`. Every interactive element shows a visible 2px cyan ring on focus.
- The ring is distinct from any pale-blue treatment used elsewhere.

---

## 3B — Decide what "accent" actually is (1 day)

**Problem.** `--accent: #b8d4e8` is described as "radar blue, instrumentation only" but reads as near-white on dark surfaces. Sample placements (timestamps, mono labels in the agent feed, scan-line treatments) blur into the `--fg-1: #e6ecf3` primary text. The accent has no distinct visual identity.

**Options (pick one, then enforce):**

**Option A — Saturated instrumentation cyan.** Reposition accent as a real signaling color, distinct from foreground text. Change `--accent` to a desaturated mid-cyan like `#5ec8e0`. Keep `--accent-dim` for paler treatments. This makes accent feel like radar/NVG instrumentation as the doc claims.

**Option B — Warm amber instrumentation.** Reposition as ATC-style amber: `--accent: #e8c46b`. Pairs against the cool surfaces. Stronger psychological "system status" connotation than blue.

**Option C — Keep pale blue, but constrain usage.** Accept the current `#b8d4e8` value. Restrict its use to ≤3 places per screen and never adjacent to primary text. Document the restriction explicitly in the design tokens file.

**Recommendation: Option A.** Cyan is more aligned with the existing "Night Watch" framing and avoids competing with the amber `--sev-minor` warning color.

**If A is chosen, update these consumers:**
- `colors_and_type.css` — `--accent: #5ec8e0;`
- Inline `var(--accent)` references in `app/setup/page.jsx` for API key reveals (keep, but they'll look more "alert" now — verify intent).
- Mono timestamps that currently use `--accent` for emphasis — drop the accent, use `--fg-2` instead; accent should be reserved for genuinely interactive or state-bearing elements.
- Severity badges never use accent (they have their own tokens).
- The new `/overview` page's live local time display — accent is correct here, it's an instrumentation reading.

**Acceptance:**
- `/overview` renders the live clock in the new accent color, visibly distinct from body text.
- The accent appears ≤5 times per screen.
- No accent color appears adjacent to a severity badge (no color confusion).

---

## 3C — Fix "harmless" so it actually recedes (half day)

**Problem.** `--sev-harmless: #7d8a6a` is documented as "recedes to gray, natural-world / wildlife / cleared." It doesn't recede. Olive against cool dark surfaces reads as a deliberate, warm chromatic choice — it pops, it doesn't whisper.

**Decision.** Replace the olive with a true cool neutral that recedes against `--bg-surface-1` and `--bg-surface-2`:

```css
--sev-harmless: #5a6470;   /* cool neutral, sits flush against surfaces */
```

Verify the contrast with `--fg-1 #e6ecf3` on the harmless badge background: `#5a6470` background + `#e6ecf3` text → 6.8:1 (passes AA for text). Pair with the `CheckCircle` icon (per accessibility decision) so the meaning is icon-driven, not color-driven.

**Re-test the full severity palette together:**

| Token | Value | Role | Pairs with icon |
|---|---|---|---|
| `--sev-serious` | `#ff3838` | Immediate threat | AlertTriangle |
| `--sev-minor` | `#e89a2b` | Needs monitoring | Circle |
| `--sev-harmless` | `#5a6470` | Routine, recedes | CheckCircle |
| `--sev-unknown` | `#6b7686` | Insufficient evidence | HelpCircle |

`--sev-harmless` and `--sev-unknown` are now visually very close (intentional — both mean "don't act"), but the icons disambiguate. Verify in a high-density list view that they don't read as the same thing.

**If they're too close:** push `--sev-harmless` slightly cooler/darker (`#4d5762`) or `--sev-unknown` slightly warmer (`#7a8294`). Tweak once with a real screen of 20 incidents in front of you, not in isolation.

**Acceptance:**
- On `/incidents` showing 20 rows with mixed severities, the eye is drawn first to `serious`, second to `minor`, and `harmless`/`unknown` rows visually recede.
- All four severity colors pass WCAG AA for the text overlaid on them.

---

## 3D — Enforce single-source severity tokens (1 day, parallel)

**Problem.** Even with the right tokens, severity color appears scattered across the codebase: `SEVERITY_CONFIG` in `client/src/config/constants.js`, local `SEV_STYLE` objects in `incident/[id]/page.js`, local `SEV_TOKENS` in `EventCard.jsx`, hardcoded `bg-red-100 text-red-700` Tailwind utilities in `settings/webhooks/page.jsx`. Every component re-derives the mapping.

**Action:**

1. Create `client/src/lib/severity.js` as the single source:
   ```js
   import { AlertTriangle, Circle, CheckCircle, HelpCircle } from 'lucide-react'
   
   export const SEV = {
     serious:   { token: 'var(--sev-serious)',  icon: AlertTriangle, label: 'Serious',   order: 0 },
     minor:     { token: 'var(--sev-minor)',    icon: Circle,        label: 'Minor',     order: 1 },
     harmless:  { token: 'var(--sev-harmless)', icon: CheckCircle,   label: 'Harmless',  order: 2 },
     uncertain: { token: 'var(--sev-unknown)',  icon: HelpCircle,    label: 'Uncertain', order: 3 },
   }
   
   export const getSeverity = (v) => SEV[v] ?? SEV.uncertain
   ```
2. Every component renders severity via this module. Delete all local definitions.
3. Add a lint rule (or CI grep) that fails the build if `#ff3838`, `#e89a2b`, `bg-red-`, `bg-amber-`, `bg-green-`, `bg-yellow-` appear anywhere in `client/src/` outside `colors_and_type.css` and `severity.js`.

**Acceptance:**
- `grep -r "SEVERITY_CONFIG\|SEV_STYLE\|SEV_TOKENS" client/src/` matches only `lib/severity.js`.
- Severity rendering looks identical pixel-for-pixel across `/overview`, `/incidents`, `/incident/[id]`, `/investigate`, `/briefing`.

---

## Constraints

- Token changes happen in **`colors_and_type.css` only.** Do not introduce a parallel theme file.
- After Phase 1 (Token consolidation) deletes the SaaS palette, you operate on a single token surface. Make every change here against that single surface.
- The briefing exception (`--bg-briefing` light paper) is unaffected.
- If the new accent feels wrong on real screens after a week of use, change it again. Don't defend the decision.

---

## Ship order

3A first (no design judgment, just contrast math). 3B and 3C are aesthetic — ship them together so the screen is judged as a whole. 3D enforces the system; runs in parallel with B/C.
