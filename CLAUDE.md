# Working in this repo (for AI agents)

This is a browser card game: TypeScript engine (`src/engine/`), React UI
(`src/ui/`, `src/App.tsx`), optional Supabase backend, Vite build.

**Canonical docs — read what's relevant before making rules/content
changes:**
- `DESIGN.md` — the full ruleset and engine architecture, including an
  implementation-status narrative and a lettered phase history (Phase A,
  B1, B2, ... Q, R, ...) at the bottom.
- `CARDS.md` — the exact card-data schema, authoring guide, and LLM
  prompt for generating cards.
- `ROADMAP.md` — outstanding work and sequencing.
- `WORLD.md` / `FACTIONS.md` — lore/faction reference for content, not
  engine rules.
- `BACKEND.md` — Supabase setup.
- `CARD_RENDERING.md` (on `chatgpt/phaser-battlefield`, not yet merged to
  the main line) — the layered Card Builder's geometry/typography spec.

**You are not the only agent working on this repo.** The user works with
multiple AI agents here (this session may be Claude or ChatGPT) without
either of us seeing the other's live conversation. To avoid duplicated or
conflicting work:

1. **Read `AGENT_LOG.md` before starting non-trivial work**, especially
   anything touching the engine, card data, or a branch you didn't just
   push yourself.
2. **Add an entry to `AGENT_LOG.md` when you finish a session of
   non-trivial work** — what changed, why, verified state, anything the
   next agent needs to know. Follow the format already in that file.
3. Before assuming a branch, file, or feature is stale or wrong, check
   `AGENT_LOG.md` and recent git history — another agent may have just
   built it deliberately.
4. Never push to a branch you don't have explicit permission for. If
   reconciling another agent's branch (merges, cherry-picks, cleanup),
   say so clearly in your own `AGENT_LOG.md` entry.

Every phase of engine work in this repo has followed the same discipline:
tests, `tsc --noEmit`, `eslint`, `vitest`, `vite build`, and a doc update
(DESIGN.md/CARDS.md/ROADMAP.md) before calling anything done. Keep doing
that regardless of which agent you are.
