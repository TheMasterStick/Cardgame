# Agent Collaboration Log

Shared handoff notes between the AI agents working on this repo (currently
Claude and ChatGPT). The user works with both of us separately, so neither
of us sees the other's session live — this file is how we catch each other
up instead of making the user relay everything by hand.

## How to use this

- **Read the most recent few entries before starting non-trivial work**,
  especially anything touching the engine, card data, or another branch.
- **Add one entry when you finish a session of non-trivial work** — not
  every commit, but every time you'd otherwise have to explain to the user
  "here's what I just did and here's what's still open."
- Newest entry at the top. Don't edit or delete older entries — this is a
  running history, not a status board. If it ever gets unwieldy, trim only
  by the user's request.
- Include, per entry: date, which agent, which branch(es), a real summary
  of what changed and *why*, current verified state (tests/build/lint), and
  anything explicitly left for the other agent or the user to know about.
- This supplements DESIGN.md / CARDS.md / ROADMAP.md / CARD_RENDERING.md —
  it doesn't replace them. Durable rules, schema, and architecture
  decisions still belong in those files with a proper writeup; this file
  is for "what just happened, what's in flight, what to watch out for."
- Branches observed so far: Claude has been working on
  `claude/card-game-framework-kmz2ol` (the main engine/rules line);
  ChatGPT has been working on `chatgpt/phaser-battlefield` (the Phaser
  battlefield + Card Builder integration branch). Not a hard rule, just
  what's happened — note it here if that changes.

---

## 2026-08-24 — ChatGPT — branch: `chatgpt/phaser-battlefield`

**Context:** user standardized the newly replaced local card-art library on
PNG and asked that all current card-art paths prefer `.png`, with one explicit
exception: Stonewall Defender remains `.jpg`.

**Changes:**
- `src/card-rendering/artAsset.ts` now treats `/cards/*` as PNG-first regardless
  of an older authored `.jpg`/`.webp` extension. Supported raster fallbacks
  remain PNG/JPG/JPEG/WebP/GIF.
- `/cards/Stonewall-Defender` is the explicit JPG-first exception. This also
  means a stale Builder draft pointing Stonewall at PNG will migrate back to
  the intended JPG when both files exist.
- Updated `artAsset.test.ts` for PNG-first behavior, the Stonewall exception,
  suffix preservation, remote URL behavior, and non-card local assets.
- Because the normal app, Card Builder, and Phaser bootstrap all call the
  shared resolver before rendering, existing legacy `cards.ts` art strings
  are normalized to the current PNG paths in memory and saved Builder drafts
  are migrated on startup. No mass conversion of the actual image files is
  performed.

**Verified state:** commits `21e8bc6` and `7060a71` are pushed. Vercel was
still pending at handoff; no completed build/CI claim is made here.

**For Claude / next agent:** PNG is now the preferred canonical format for
current `/cards/` artwork, except `Stonewall-Defender.jpg`. Keep the mixed-
format fallback resolver; do not remove JPG/JPEG/WebP/GIF support merely
because the current batch is PNG-heavy.

---

## 2026-08-24 — ChatGPT — branch: `chatgpt/phaser-battlefield`

**Context:** user reported that manually edited Card Builder art paths were
lost as soon as they clicked another card. This was a Builder navigation
persistence bug, independent of the mixed PNG/JPG resolver work below.

**Changes:**
- `CardBuilderApp.tsx` now persists the current draft to localStorage before
  switching to another library card or creating a new card.
- Clicking the already-selected card is now a no-op instead of reloading the
  last saved copy over unsaved edits.
- Manual `Save Draft` now uses the canonical selected card ID as its storage
  key when editing an existing card, so temporarily changing the visible ID
  field no longer makes the draft impossible to find on the next selection.
- Artwork placeholder text now uses `/cards/My-Card.png`, matching the new
  raw-art workflow while still accepting PNG/JPG/JPEG/WebP/GIF via the shared
  resolver.

**Verified state:** commit `80f533d` is pushed. Vercel was still pending at
handoff, so no completed build/CI claim is made for this commit yet.

**For Claude / next agent:** Builder draft navigation is now auto-persistent;
do not reintroduce a workflow where users must press Save Draft between every
card. Stonewall Defender currently has both `.jpg` and `.png` files on the
integration branch; because the resolver honors an explicitly configured path
first, a saved `/cards/Stonewall-Defender.png` should remain PNG once selected.

---

## 2026-08-24 — ChatGPT — branch: `chatgpt/phaser-battlefield`

**Context:** user replaced most legacy `public/cards/*.jpg` card art with new
raw `*.png` assets, which exposed that many canonical card definitions and
saved Card Builder drafts still pointed at the old `.jpg` filenames. The
files themselves were present on GitHub; the broken images were extension
mismatches, not missing pushes.

**Changes:**
- Added `src/card-rendering/artAsset.ts`, a shared local-card-art resolver.
  It keeps the authored path first, then tries the same stem as PNG, JPG,
  JPEG, WebP, and GIF. Remote/data/blob URLs are left untouched.
- Wired the resolver into all three entrypoints: normal React app,
  `card-builder.html`, and `phaser.html`, so format resolution happens before
  their UIs start.
- Card Builder startup also migrates saved `card-builder:draft:*`
  localStorage drafts when their old extension can be resolved to an actual
  local file, preventing stale `.jpg` draft data from overriding a newly
  resolved `.png` canonical definition.
- Added `src/card-rendering/artAsset.test.ts` covering fallback order,
  suffix preservation, and remote/inline URL behavior.

**Verified state:** source changes are pushed. At handoff the latest hosting
check was still pending, so this entry does not claim a completed CI/build
result yet. User can immediately smoke-test by refreshing the dev server;
canonical `/cards/Foo.jpg` references should now find `/cards/Foo.png` when
that is the file present.

**For Claude / next agent:** do not mass-convert the new PNG assets back to
JPG. Mixed standard raster formats are intentional. When the shared Phaser
card renderer begins loading artwork textures, use the resolved `def.art`
path rather than re-deriving an extension from card type/name.

---

## 2026-08-24 — Claude — branches: `claude/card-game-framework-kmz2ol`, `chatgpt/phaser-battlefield`

**Context:** picked up mid-session after Phase P (Hero Specializations)
was already live. Did four things, in order:

1. **Phase Q — AI lethal-priority fix.** Player-reported: the AI cleared a
   Building then a Vanguard creature before finishing an open, low-HP Hero
   it could already kill outright that turn. Added `isLethalAvailable()`
   and a `preferLethal` flag on `chooseAttackTarget` (`src/engine/ai.ts`) —
   once the AI's current attackers add up to lethal, every attacker with a
   legal path goes straight for the Hero instead of trading through
   creatures/Buildings. A reachable Taunt creature is still the one thing
   that forces an attacker elsewhere. 3 new tests, docs in DESIGN.md §17
   (Phase Q row) and ROADMAP.md.

2. **Surveyed ChatGPT's work.** Found two branches pushed straight to
   origin, no PR: `feature/phaser-battlefield` (5 early prototype commits)
   and `chatgpt/phaser-battlefield` (43 commits on top of that — an
   engine-backed Phaser battlefield scene, a layered "Card Builder" tool
   for card art, `CARD_RENDERING.md`, and a CI workflow). Verified in an
   isolated worktree: `feature/phaser-battlefield` is fully subsumed by
   `chatgpt/phaser-battlefield` (zero unique commits) — treat it as
   obsolete. `chatgpt/phaser-battlefield`'s own CI was **red**: stale
   `package-lock.json` (missing `phaser`) failed `npm ci` before tests even
   ran, and two orphaned prototype scene files
   (`BattleScene.ts`/`BattleSceneHudTest.ts`, superseded by
   `EngineBattleScene.ts`, referenced from nowhere) failed `tsc --noEmit`.
   Found and independently verified 3 genuine engine-rules corrections
   buried in that branch's history — see below.

3. **User confirmed the card-creation direction (2026-08-24):** the
   layered Card Builder — not hand-baking stats into art — is now the
   primary way new cards get made, because printed stats need to change
   without repainting art. Existing Phase K baked-JPG cards stay valid as
   a legacy/fallback path, converted gradually, no forced rebuild.

4. **Reconciliation, per explicit user direction** (merge the safe parts
   now, clean up the branch, don't merge the whole UI yet):
   - **Cherry-picked 3 engine fixes** from `chatgpt/phaser-battlefield`
     onto `claude/card-game-framework-kmz2ol` as their own commits
     (`4a0d5a4`, `1874c5e`, `b3c1c06` → same SHAs, clean cherry-pick):
     Hero status damage (Poison/Bleed/Burn) now routes through Guard
     first instead of hitting HP directly (matches DESIGN.md §6, was a
     real bug); Double Strike's `attacksUsedThisTurn` counter is now
     reset every `startTurn` instead of never (creatures were silently
     losing their second swing after turn 1 of ever double-striking); an
     overdrawn/burned card now leaves the match permanently instead of
     going to discard (could previously be reshuffled back in).
     `src/engine/settledRules.test.ts` covers all three. Documented as
     "Phase R" in DESIGN.md/ROADMAP.md.
   - **Cleaned up `chatgpt/phaser-battlefield` directly** (explicit
     permission given): regenerated `package-lock.json`, deleted the two
     orphaned scene files, added multi-page `vite.config.ts` build config
     (production build was silently only emitting `index.html` — the
     Phaser Test and Card Builder pages would have 404'd once deployed).
     Pushed as `e448921`. **CI is now green** on that branch.
   - **Docs on `claude/card-game-framework-kmz2ol`:** DESIGN.md's Phase K
     row now flags the baked-art assumption as superseded-but-kept-legacy;
     new DESIGN.md §20 lays out the target architecture (engine
     authoritative; React = app shell/menus/deckbuilder/collection/admin;
     Phaser = future battlefield renderer, not yet the live match screen;
     Card Builder = card authoring/presentation; one shared card-
     presentation model as the eventual goal). CARDS.md's art section got
     the same reconciliation note. ROADMAP.md rows #14/#15.

**Verified state, both branches, at handoff:** `tsc --noEmit`, `eslint`
(0 errors), `vitest run` (223/223 tests), `vite build` all clean on
`claude/card-game-framework-kmz2ol`. Same on `chatgpt/phaser-battlefield`,
plus its GitHub Actions CI run (`ci.yml`) is green.

**For ChatGPT, next time you pick this up:**
- Your 3 rules fixes are now also on the main engine branch (as their
  original commits, same authorship) — no need to re-port them.
- Your branch's CI/lockfile/dead-file issues are fixed; you don't need to
  redo that cleanup, just build on top of the current tip
  (`e448921` at time of writing).
- The Phaser battlefield + Card Builder themselves are **not** merged
  into `claude/card-game-framework-kmz2ol` yet — that's an open decision
  (see ROADMAP.md sequence item #12), not a rejection. Merge whenever
  it's actually ready, or ask the user.
- If you touch `CardView.tsx`/the live match UI to start wiring in the
  layered rendering model, `claude/card-game-framework-kmz2ol` is a bit
  ahead of where you last branched from — pull it in first.
