# Sentinel Rethink — Prompt Set

Eight follow-on prompts to the master rethink prompt (`SENTINEL_RETHINK_PROMPT.md`). Each is independently runnable. Hand them to Claude Code one at a time, in the order shown.

## Ordering rationale

The master prompt covers the **top-ranked thread in each area**. These eight cover the rest, in the order they were ranked.

| File | Area | Rank | Depends on |
|---|---|---|---|
| `02_arch_schema_reconciliation.md` | Architecture | #2 | Master Phase 1 (auto-start exposes the drift) |
| `03_arch_reliability.md` | Architecture | #3 | Master Phase 2A (Pub/Sub for briefing status SSE) |
| `04_design_brand.md` | Design | #2 | None — can ship first |
| `05_design_colors.md` | Design | #3 | Master Phase 3A (SaaS palette deleted first) |
| `06_design_accessibility.md` | Design | #4 | `05_design_colors.md` (severity tokens stable) |
| `07_ux_navigation.md` | UX | #2 | Master Phase 1 (overview/incidents exist), `04_design_brand.md` (Sentinel name) |
| `08_ux_lifecycle.md` | UX | #3 | `07_ux_navigation.md` (TopBar bell slot), `02_arch_schema_reconciliation.md` (canonical status enums) |
| `09_ux_mobile.md` | UX | #4 | `07_ux_navigation.md`, `08_ux_lifecycle.md` |

## Recommended overall ship sequence

1. Master prompt Phase 1 (operator morning experience)
2. `04_design_brand.md` (legal risk — don't sit on it)
3. Master prompt Phase 2 (horizontal scaling)
4. `02_arch_schema_reconciliation.md` (unblocks status consistency everywhere)
5. Master prompt Phase 3 (token consolidation)
6. `05_design_colors.md`
7. `06_design_accessibility.md`
8. `03_arch_reliability.md` (depends on Phase 2A Pub/Sub being stable)
9. `07_ux_navigation.md`
10. `08_ux_lifecycle.md`
11. `09_ux_mobile.md`

## How to use each prompt

- Open in Claude Code with the project mounted.
- Prompts are self-contained: they include the "read first" file list, the ground-truth rule (code beats docs unless explicitly told otherwise), canonical decisions, deliverables in dependency order, acceptance criteria, and constraints.
- Each phase within a prompt is independently shippable. Don't bundle phases across deploys.
- After each phase ships, regenerate the relevant section of `CLAUDE.md` and update `AUDIT.md`.
