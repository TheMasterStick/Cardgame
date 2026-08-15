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

That creates the `profiles`, `cards`, `collection_entries`, `wallets`,
and `decks` tables (all with Row Level Security policies — see the file
for the exact rules) and a public `card-art` Storage bucket.

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

The account bar shows a small "☁ Synced" indicator once you're signed
in, next to your email, as a signal that cards/coins are now
account-backed rather than browser-local.

**Decks built in the Deck Builder are not part of this yet** — they
still live in localStorage regardless of sign-in state. Say if you want
that moved over too.

## What's not built yet

- The admin card-creation panel itself (form + image upload to
  `card-art` + insert into the `cards` table).
- Deck sync to the account (see §5).

I can't verify any of the Supabase-backed behavior myself (same network
block as always), so if collection/coin sync doesn't behave as
described — e.g. a fresh sign-in doesn't pick up the local pack you
just opened — let me know what you actually saw and I'll dig in.
