# Backend setup (Supabase + Google login)

The app works fully standalone with no backend at all (Quick Play,
Collection, Packs, Deck Builder all run on `localStorage`). Everything in
this doc is opt-in, additive infrastructure for accounts and an
eventual admin panel / multiplayer — if `.env.local` isn't set up, the
app just doesn't show the account UI and behaves exactly as before.

## 1. Apply the database schema

I can't run this from this environment (network policy blocks both
direct Postgres connections and HTTPS to `supabase.co`), so it needs to
happen from your side, once:

1. Open your project's [SQL Editor](https://supabase.com/dashboard/project/_/sql/new).
2. Paste the contents of `supabase/migrations/0001_init.sql` and run it.

That creates the `profiles`, `cards`, `collection_entries`, `wallets`,
and `decks` tables (all with Row Level Security policies — see the file
for the exact rules) and a public `card-art` Storage bucket.

Alternative, if you'd rather use the CLI from your own machine (which
does have normal network access): `supabase login`, then
`supabase link --project-ref lxrarvyqzhhmpimnxyml`, then `supabase db push`.

## 2. Set up Google as a login provider

Two dashboards, in order — Google's OAuth client has to exist before
Supabase can be told to use it:

**Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):
1. Create (or select) a project.
2. APIs & Services → OAuth consent screen: set it up (External is fine
   for testing; app name, support email — the rest can stay default).
3. APIs & Services → Credentials → Create Credentials → OAuth client ID
   → Application type **Web application**.
4. **Authorized JavaScript origins:** add `http://localhost:5173` (and
   later, your production URL once you have one).
5. **Authorized redirect URIs:** add
   `https://lxrarvyqzhhmpimnxyml.supabase.co/auth/v1/callback` — this is
   Supabase's fixed callback URL for your project, not something you
   choose.
6. Save, then copy the **Client ID** and **Client Secret** it gives you.

**Supabase Dashboard:**
1. Authentication → Providers → Google → enable it, paste in the Client
   ID and Client Secret from above, save.
2. Authentication → URL Configuration → Redirect URLs: add
   `http://localhost:5173` (and your production URL later) so Supabase
   is willing to send the browser back there after login.

## 3. Try it

`npm run dev`, open the app, go to the main menu — you should see a
"Sign in with Google" control in the top right. Clicking it does a full
OAuth round-trip through Google and back. On success you'll see your
email there instead.

(I tested that the app degrades correctly without any of this — no
backend configured, or the sign-in click itself, both leave the app in
a working state, no crashes. I can't test the actual Google round-trip
myself since it needs to reach `accounts.google.com` and
`supabase.co`, both blocked from this sandbox — that part only proves
out when you try it from a machine with normal internet access.)

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

## What's not built yet

The admin card-creation panel itself (form + image upload to
`card-art` + insert into the `cards` table) isn't wired up yet — this
pass only gets accounts and admin-flagging working end to end, since I
can't verify any of it myself and wanted a working checkpoint before
building more on top of it. Once you've confirmed sign-in and the admin
badge work, say so and I'll build the actual panel next.
