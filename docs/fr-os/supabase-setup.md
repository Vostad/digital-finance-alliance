# Supabase project settings — what only you can do

Everything in this file is a dashboard setting or a secret. None of it can be set
from the repository, and I have not created a project, changed a setting, or
touched DNS.

## 1 · The four values I need

Supabase → Project Settings.

| Variable | Where | Notes |
|---|---|---|
| `DATABASE_URL` | Database → Connection string → **Transaction pooler** | Host ends `.pooler.supabase.com`, port **6543**. The app refuses to start on anything else. |
| `DIRECT_DATABASE_URL` | Database → Connection string → **Direct connection** | Port 5432. drizzle-kit only. |
| `SUPABASE_URL` | API → Project URL | |
| `SUPABASE_ANON_KEY` | API → Project API keys → `anon` | Public. Safe to ship. |
| `SUPABASE_SERVICE_ROLE_KEY` | API → Project API keys → `service_role` | **Secret.** Send it separately from the others, never in a shared document. |

Requirement 6 asked which connection is configured. The answer is enforced rather
than promised: `src/server/env.server.ts` parses `DATABASE_URL` at first use and
throws if the host is not the pooler or the port is not 6543.

## 2 · Lower the access-token TTL — Authentication → Sessions

**Set "Access token (JWT) expiry" to `300` seconds.**

This is the third of the three mechanisms behind requirement 3, and the only one
that is not code:

| Mechanism | Where | Effect |
|---|---|---|
| `users.status` read every request | `src/server/auth/context.ts` | Ends access in **0 seconds** |
| Ban on deactivate | `src/server/auth/supabase.server.ts` | Refresh fails, so the session cannot be extended |
| 5-minute access token | **this setting** | Bounds the stateless-JWT window if the first is ever bypassed |

The first mechanism is the real guarantee. The TTL exists because an access token
is a signed JWT: nothing can un-issue one, so the only defence against a code path
that forgets to resolve the context is for the token to be short-lived. Five
minutes is the shortest value that does not cause visible churn, and the cookie
refresh in `getAuthContext` means nobody is signed out at the five-minute mark.

## 3 · Turn off public sign-up — Authentication → Providers → Email

- **Disable "Enable email signups"** — accounts are created by invitation only.
- Confirm email: on.
- Disable every other provider unless you want it.

Without this, the anon key is a working account-creation endpoint. RLS means a new
account can read nothing, and `getAuthContext` rejects any Supabase user with no
row in `public.users` — but there is no reason to leave the door open.

## 4 · The first Super Admin

There is a chicken-and-egg problem: only a Super Admin can invite anyone, and
there is no Super Admin. Resolve it once, deliberately, and never again:

1. Authentication → Users → **Add user** → your own email, confirmed.
2. Copy the generated user UUID.
3. Run this once (Studio SQL editor — **the only permitted exception**, and it
   inserts a row, it does not change structure):

```sql
insert into public.users (id, email, full_name, role, status, timezone)
values ('<uuid-from-step-2>', '<your email>', '<your name>', 'super_admin', 'active', 'Asia/Dubai');
```

Every subsequent account goes through the invite flow.

## 5 · Vercel environment variables

Project → Settings → Environment Variables. All five, for Production and Preview.

`SUPABASE_SERVICE_ROLE_KEY` must be marked **Sensitive**. None of the five may be
given a `VITE_` prefix — that prefix is what makes Vite inline a value into the
browser bundle, and `npm run build` fails if the service role key appears there.
