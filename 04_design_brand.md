# Design Phase 2 — Brand cleanup

**Goal.** Remove legal risk (proprietary font), correct product naming everywhere it is wrong, and delete an aspirational design doc that contradicts the shipped system.

**Read first:** `client/src/colors_and_type.css`, `client/src/app/globals.css`, `client/src/assets/wordmark.svg`, `client/DESIGN.md`, `CLAUDE.md` §14 and §24.

---

## 2A — Remove proprietary fonts (1 day)

**Problem.** `client/src/colors_and_type.css` and/or `globals.css` reference BMW TypeNext Pro (loaded as `BMWTypeNext_Pro_Regular.ttf` or similar). BMW TypeNext is BMW's proprietary corporate typeface. Shipping it in a product not authored by BMW is a license violation. `DESIGN.md` additionally references Nike Futura ND with the same problem.

**Action:**

1. Audit `client/public/fonts/` (or wherever local fonts live). List every `.ttf`, `.otf`, `.woff`, `.woff2`. For each, confirm we have a license. If not, delete the file.
2. In `colors_and_type.css` and `globals.css`, remove every `@font-face` declaration referencing an unlicensed family. Remove `@theme inline` references too.
3. Canonical font stack (per README §14):
   - `--font-sans: 'IBM Plex Sans', system-ui, sans-serif;` — all UI
   - `--font-serif: 'IBM Plex Serif', Georgia, serif;` — `/briefing` only
   - `--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;` — timestamps, IDs, labels
4. Load IBM Plex via Google Fonts using Next.js `next/font/google` in `app/layout.js`. Avoid CSS `@import` for performance.
5. Replace every component-level inline `fontFamily: 'var(--font-jetbrains), ...'` with `fontFamily: 'var(--font-mono)'`. Drop the long fallback chains; the variable handles fallback.

**Acceptance:**
- `grep -r "BMWTypeNext\|Futura\|Helvetica Now\|Nike" client/src/` returns no matches.
- The app renders with IBM Plex Sans on a machine that has no system fonts beyond the OS defaults.
- No `@font-face` block in CSS references a font file that doesn't ship in `client/public/fonts/` with a license note in the same folder (`LICENSES.md`).

---

## 2B — Fix product naming everywhere (2 days)

**Decision (final):** the user-visible product name is **Sentinel**. The AI agent is **Argus**. The git folder remains `RidgewaySite/`. Audit action strings stay (`briefing.approved`, `mcp.tool_call` etc.) — they are stable DB identifiers.

**Surfaces to update:**

1. `client/src/assets/wordmark.svg` — rewrite the `<text>` content from `RIDGEWAY NIGHT WATCH` (or `RIDGEWAY SITE`) to `SENTINEL`. Keep the existing visual mark/geometry if any.
2. `client/src/components/layout/TopBar.jsx` — replace the hardcoded `"RIDGEWAY SITE"` string with `"SENTINEL"`. Reference the SVG wordmark instead of inline text if the layout permits.
3. `client/src/app/page.js` (landing) — every "Ridgeway" → "Sentinel". The hero, the role cards, the how-it-works copy, the footer.
4. All auth pages (`login`, `register`, `forgot-password`, `reset-password`, `invite/accept`) — placeholders like `operator@ridgeway.site` → `operator@example.com`. Page titles and headers → "Sentinel".
5. `client/src/app/layout.js` — page `<title>` and meta description.
6. `client/public/favicon.ico` and any logo PNGs — regenerate to match the Sentinel wordmark (drop any "R" mark).
7. Email templates in `server/src/utils/mail.js` — sender name, subject prefixes, body copy. `EMAIL_FROM_NAME` env default → `Sentinel`.
8. `server/src/scripts/seedTestData.js` — replace `admin@ridgeway.io`, `orgadmin@ridgeway.io`, `operator@ridgeway.io` with `admin@example.com` etc. Document the seed credentials in `README.md` once.
9. **MCP server name.** `server/src/mcp/server.js`: `name: 'ridgeway-mcp'` → `name: 'sentinel-mcp'`. External clients may have configured this name; document the change in a CHANGELOG entry.
10. **Webhook headers.** Current code emits `X-Ridgeway-Signature` and `X-Ridgeway-Event` (see `worker.js`). README spec says `X-Sentinel-*`. Migrate, with a one-release dual-emit: send both `X-Ridgeway-Signature` and `X-Sentinel-Signature` for 30 days. Document deprecation in `docs/webhooks.md`.

**Surfaces to leave unchanged:**

- Git repo folder `RidgewaySite/`.
- Cookie names `ridgeway_auth`, `ridgeway_role`, `ridgeway_setup`. Renaming would force every active session to log out and cause confusion. Document this oddity in `CLAUDE.md` §6 instead.
- Audit log action strings.
- MongoDB collection names (`organisations`, `incidents`, etc. — no `ridgeway_` prefix exists).
- LocalStorage keys (`ridgeway_token`, etc.) — same reasoning as cookies. These can be migrated in a later batch with a one-time login.

**Acceptance:**
- `grep -ri "ridgeway" client/src/ server/src/` returns only: cookie names, audit strings, repo references, deliberate compat shims (each on a line tagged with a `// ridgeway-compat` comment), and the dual-emit webhook headers.
- Landing page screenshot: every visible "Ridgeway" is gone.
- An email arriving in an inbox shows "Sentinel" as the sender.

---

## 2C — Delete DESIGN.md and other dead docs (half day)

**Problem.** `client/DESIGN.md` describes a Nike-themed retail aesthetic (96px Futura headlines, full-bleed photography, etc.) that has zero presence in the shipped codebase. Either it is from a previous pivot or someone fed an AI the wrong brief. Either way, an aspirational design doc that contradicts the actual product is worse than no doc.

**Action:**

1. Delete `client/DESIGN.md`.
2. Delete `client/src/prev/preview/` (legacy preview HTML files: `brand_logo.html`, the old briefing demo, etc.). They reference the old name and the old fonts.
3. Delete `client/src/ui-kit/` if it contains unused mockup HTML (`incident/README.md`, `briefing/index.html`, etc.). If any are actively referenced by component code, leave those specific files but trim the rest.
4. Audit `CLAUDE.md` for references to vocabulary or product names that no longer hold post-Phase 2 (rebrand). Update.
5. Audit `HANDOFF.md` — if it's a stale wave-by-wave build plan, archive it under `docs/archive/` rather than delete (it may have historical value).
6. **Canonical design doc.** The Night Watch spec lives in `client/src/colors_and_type.css` as comments + tokens. Add `client/src/colors_and_type.md` as a human-readable companion that explains token intent. Keep it short — one page, link from `CLAUDE.md` §14.

**Acceptance:**
- `client/DESIGN.md`, `client/src/prev/`, unused `client/src/ui-kit/` content removed.
- `colors_and_type.md` exists and is the single human-readable design reference.
- `CLAUDE.md` §14 links to it.

---

## Constraints (do not break)

- Wordmark visual style stays consistent with Night Watch (mono font, lowercase tracking, no marketing flourishes).
- The git folder stays `RidgewaySite/`. Do not rename it.
- Cookie names and audit action strings unchanged. Renaming forces session resets and breaks downstream filters.
- The migration is one-way. Once `X-Sentinel-Signature` is the canonical header (30 days post-deploy), customers must update their HMAC verification. Document this clearly.

---

## Ship order

2A first (legal risk — don't sit on this). 2B and 2C in parallel.
