# Backend setup (Supabase + Google login)

The app works fully standalone with no backend at all (Quick Play,
Collection, Packs, Deck Builder all run on `localStorage`). Everything in
this doc is opt-in, additive infrastructure for accounts and an
eventual admin panel / multiplayer — if no backend is configured, the
app just doesn't show the account UI and behaves exactly as before.

## 0. (Optional) Deploy somewhere public first

If you can't run `npm run dev` from wherever you're working (e.g. a
work machine), deploy the app to a free static host first — then
everything below works from any browser, no terminal needed.

**Vercel** (Cloudflare Pages' newer dashboard tends to route new
projects through a "deploy a template into a new repo" flow that's easy
to hit by accident instead of connecting your existing repo — Vercel's
"Import Git Repository" flow avoids that trap), all in-browser:
1. **vercel.com** → **Sign Up** → "Continue with GitHub" → authorize.
2. Dashboard → **Add New...** → **Project**.
3. Under "Import Git Repository," find `themasterstick/cardgame` →
   **Import**. (Not listed? Click "Adjust GitHub App Permissions" and
   grant Vercel access to it.)
4. It should auto-fill Framework Preset **Vite**, Build Command
   `npm run build`, Output Directory `dist`. Nothing to change about
   branch — `claude/card-game-framework-kmz2ol` is currently the *only*
   branch on the remote, so it's already the repo's default and that's
   what gets deployed.
5. Expand **Environment Variables**, add both:
   - `VITE_SUPABASE_URL` = `https://lxrarvyqzhhmpimnxyml.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (the anon key — see `.env.local`, or ask
     for it again; it's meant to be public, safe to paste here)
6. **Deploy** → you get a URL like `https://cardgame-xyz.vercel.app`,
   live in a minute or two.

Use that URL in place of `localhost:5173` everywhere below — you'll
register it in Google's and Supabase's dashboards alongside (not
instead of) localhost, so both keep working.

## 1. Apply the database schema

I can't run this from this environment (network policy blocks both
direct Postgres connections and HTTPS to `supabase.co`), so it needs to
happen from your side, once:

1. Open your project's [SQL Editor](https://supabase.com/dashboard/project/_/sql/new).
2. Paste the contents of `supabase/migrations/0001_init.sql` and run it.
3. Then paste and run `supabase/migrations/0002_wallet_initialized.sql` too
   (adds one column the collection-sync logic needs — see §5).
4. Then paste and run `supabase/migrations/0003_card_taxonomy.sql` too
   (adds the `element`/`faction`/`race` columns and the `hero` archetype
   / `uncommon` rarity to the `cards` table's check constraints — needed
   before the Admin Panel in §6 can save a card).

That creates the `profiles`, `cards`, `collection_entries`, `wallets`,
and `decks` tables (all with Row Level Security policies — see the file
for the exact rules) and a public `card-art` Storage bucket. Run all
three migrations in order — each one only adds to what the last one
built.

Alternative, if you'd rather use the CLI from a machine with normal
network access: `supabase login`, then
`supabase link --project-ref lxrarvyqzhhmpimnxyml`, then `supabase db push`.

## 2. Set up Google as a login provider

Two dashboards, in order — Google's OAuth client has to exist before
Supabase can be told to use it. Pure web UI, no terminal, works from
any browser including a work machine:

**Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):
1. Create (or select) a project.
2. APIs & Services → OAuth consent screen: choose External, fill in the
   required fields (app name, your email in both email fields), save
   through the remaining steps without adding anything.
3. APIs & Services → Credentials → Create Credentials → OAuth client ID
   → Application type **Web application**.
4. **Authorized JavaScript origins:** add `http://localhost:5173`, and
   your deployed URL if you set one up (§0).
5. **Authorized redirect URIs:** add exactly
   `https://lxrarvyqzhhmpimnxyml.supabase.co/auth/v1/callback` — this is
   Supabase's fixed callback URL for your project, not something you
   choose.
6. Create, then copy the **Client ID** and **Client Secret** it gives you.

**Supabase Dashboard:**
1. Authentication → Providers → Google → enable it, paste in the Client
   ID and Client Secret from above, save.
2. Authentication → URL Configuration → Redirect URLs: add
   `http://localhost:5173` and your deployed URL if you have one.

## 3. Try it

Open the app (locally via `npm run dev`, or your deployed URL from
§0), go to the main menu — you should see a "Sign in with Google"
control. Clicking it does a full OAuth round-trip through Google and
back. On success you'll see your email there instead.

(I tested that the app degrades correctly without any of this — no
backend configured, or the sign-in click itself, both leave the app in
a working state, no crashes. I can't test the actual Google round-trip
myself since it needs to reach `accounts.google.com` and
`supabase.co`, both blocked from this sandbox — that part only proves
out from a machine/deployment with normal internet access.)

## 4. Flag your account as admin

Sign in once first (so your `profiles` row exists — it's created
automatically on first login), then run in the SQL Editor:

```sql
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'your-email@gmail.com');
```

Replace the email with whichever Google account you signed in with.
Refresh the app — the account bar should show an "Admin" badge next to
your email.

## 5. Cards and coins now follow your account

Signed out, cards/coins are a per-browser `localStorage` "guest" save —
same as before any of this backend work existed. Signed in, they live
in Supabase's `wallets`/`collection_entries` tables instead, keyed to
your account, so they follow you between devices and browsers.

The switch happens automatically: the first time an account is ever
seen (its wallet row has never been synced from a client before),
whatever's in that browser's localStorage at that moment gets imported
into the account once. Every sign-in after that, the account's saved
data is what loads — local browser data is only ever consulted on that
one first import, never again. Signing out reverts the app to showing
the local guest save.

**Important:** once an account has completed that first import
(`wallets.initialized = true`), clearing your browser's local storage
and signing back in does **not** reset anything — the account's data in
Supabase is what loads every time from then on, local storage or not.
To actually reset a synced account's cards/coins, do it server-side
instead, in the SQL Editor:

```sql
update public.wallets set coins = 300 where user_id =
  (select id from auth.users where email = 'your-email@gmail.com');
delete from public.collection_entries where user_id =
  (select id from auth.users where email = 'your-email@gmail.com');
```

Adjust the `coins` value or drop that line if you just want to wipe the
collection and keep the gold.

The account bar shows a small "☁ Synced" indicator once you're signed
in, next to your email, as a signal that cards/coins are now
account-backed rather than browser-local.

**Decks built in the Deck Builder are not part of this yet** — they
still live in localStorage regardless of sign-in state. Say if you want
that moved over too.

## 6. Using the Admin Panel

Once your account has `is_admin = true` (§4) and you refresh, a new
"Admin Panel" option appears on the main menu.

Everything the panel does reads/writes the shared `cards` table (RLS
restricts writes to admins; anyone can read, since the card catalog has
to be visible to every player) and the `wallets` table for your own
coin balance.

- **Edit your gold:** a number field at the top of the panel, saves via
  the same wallet-sync path as pack-opening does.
- **Browse/edit existing cards:** a searchable grid of every card
  currently in `CARD_DEFINITIONS` (built-in + anything already saved to
  the `cards` table). Clicking one opens it in the same form used to
  create new cards, pre-filled.
- **Create a new card:** pick an archetype (Hero/Creature/Building/
  Spell/Ability/Equipment) and fill the fields exposed by the current
  Admin form. **The form does not yet expose every Phase-K field in
  CARDS.md**: in particular it is still simplified around trigger arrays
  and newer bespoke payloads. Treat `CARDS.md` as the schema authority;
  use JSON/TypeScript for a card the Admin form cannot represent without
  loss.
- **Upload art:** the current browser uploader resizes to 512×776 using
  cover-fit cropping. That was safe when the upload was only artwork, but
  Phase K now treats non-Hero art as the **entire printed card face**. Use
  a source already matching the target aspect ratio so name/rules/stats
  are never cropped. Planned improvement: reject/contain mismatched full
  card faces instead of silently cover-cropping them.
- **Save:** upserts the card into the `cards` table by `id`. Existing
  built-in cards can be overwritten this way (editing "Fighter" from
  the panel replaces the built-in Fighter for every player) — that's
  intentional, it's how you'd rebalance a shipped card.

New/edited cards apply everywhere immediately for everyone: the app
fetches the full `cards` table once on load and merges it into the
shared card registry, so no rebuild or redeploy is needed to see admin
changes go live — just a page refresh for players who already had the
app open.

**Important with baked card faces:** changing cost, stats, rarity, name or
rules in the database changes the live mechanics immediately, but it does
not rewrite text baked into the uploaded card image. Until the admin tool
can detect this, an edited mechanic should be accompanied by a matching
updated full-card image or the card face can visibly disagree with the
engine.

## What's not built yet

- Deck sync to the account (see §5).
- Full Phase-K schema coverage in the Admin authoring form.
- Safe aspect-ratio handling for baked full-card-face uploads (no silent crop).
- A warning/validation check when database mechanics no longer match text baked into an existing card image.

I can't verify any of the Supabase-backed behavior myself (same network
block as always), so if collection/coin sync — or the Admin Panel
itself — doesn't behave as described, let me know what you actually saw
and I'll dig in.
