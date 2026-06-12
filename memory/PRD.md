# Manifest — Product Requirements & Build Log

## Original problem statement
Build Manifest — a privacy-first SaaS web app that migrates ChatGPT data exports
(.zip or split conversations-NNN.json) into Claude-ready project files. ChatGPT
conversation content is parsed and packaged entirely in the user's browser and
NEVER transmitted to our server. Backend handles only accounts, entitlements,
Stripe payments, and anonymous numeric usage counters.

The single-file working tool (chatgpt-to-claude-migrator.html) was provided and
its parsing logic was preserved verbatim during the port.

## User decisions (Feb 2026 kickoff)
- Google OAuth: **Emergent-managed Google Auth**.
- Stripe: **platform-provided test key** (`sk_test_emergent`).
- Email verification: **deferred** — users can log in immediately; phase 2 will
  ship a reminder banner + Resend integration.
- Admin email: **vpkarthik97@gmail.com**.
- Phase 1 scope: landing, /app tool (HTML logic ported), email+password +
  Google OAuth, account/billing, Stripe one-time $9 checkout + webhook,
  privacy/terms, anonymous usage counters.
- Phase 2 (deferred): admin dashboard, Resend transactional emails (verification,
  password reset, purchase receipts).

## Architecture
- **Frontend**: React 19 (CRA + Craco), React Router v7, Tailwind, Shadcn UI,
  Phosphor Icons. JSZip via npm. Auth via JWT in `localStorage.mf_token`.
- **Backend**: FastAPI, Motor (MongoDB async), bcrypt+PyJWT, httpx for the
  Emergent OAuth `session-data` call, `emergentintegrations` for Stripe.
- **Hosting**: Emergent platform; React on :3000, FastAPI on :8001, both behind
  Kubernetes ingress that routes /api/* to backend.
- **Storage**:
  - `users` collection (user_id, email, password_hash | google, plan,
    stripe_customer_id, usage counters, created_at, is_admin)
  - `payment_transactions` collection (session_id, user_id, amount, status,
    payment_status, created_at, paid_at)
- **Auth model**:
  - Email + password (bcrypt rounds=12 + 14-day JWT HS256)
  - Emergent Google OAuth → server exchanges session_id → issues same-format JWT
- **Stripe flow**: client → POST /api/payments/checkout (body: origin_url) →
  server creates Stripe checkout (amount=9.00 USD, metadata.user_id), inserts
  payment_transactions row (status=initiated) → returns checkout URL → client
  redirects → on return (`/app?upgraded=1&session_id=...`) frontend polls
  `/api/payments/status/{sid}` which both reads Stripe AND idempotently upgrades
  the user; `POST /api/webhook/stripe` provides the same idempotent upgrade for
  asynchronous completion. `charge.refunded` downgrades to free.
- **Privacy guarantee** (verified by testing agent): the only request the
  /app tool sends after a successful pack is `POST /api/usage/bump` with two
  integers. No conversation content ever crosses the network. CSP not yet
  pinned — added to phase 2 backlog.

## Personas
1. **The migrator** — has hundreds of ChatGPT conversations, wants them in
   Claude Projects without a Chrome extension. Free tier first, may upgrade.
2. **The privacy-conscious tinkerer** — explicitly verifies the
   no-upload claim in DevTools before trusting the tool.
3. **The Claude power user** — pays $9 instantly for unlimited migration and
   custom-instruction extraction.

## Core requirements (static)
- Free: 20 conversations / 1 project per session. No custom-instruction extraction.
- Full ($9 one-time, lifetime): unlimited convos, unlimited projects, CI extraction.
- Conversation content never leaves the browser. Server only sees: account info,
  entitlements, Stripe customer ID, payment status, numeric usage counters.
- Stripe webhook with signature verification (verified — bad signature returns 400).
- Delete account (`DELETE /api/auth/account`) removes the user and their
  payment transactions.

## What's implemented (2026-02 — phase 1)
- [x] Landing page (/) — hero, 3-step procedure, feature grid, comparison table,
      $0/$9 pricing, FAQ, footer. Cargo-manifest aesthetic from design agent.
- [x] /signup, /login — email/password + "Continue with Google" via Emergent.
- [x] /auth/callback — exchanges Emergent session_id for app JWT.
- [x] /app — full migrator tool (dropzone, manifest review w/ renameable
      groups + per-convo checkboxes, output format/details options, pack &
      download .zip). Parsing logic preserved verbatim from the original HTML.
- [x] /app upgrade flow — free user over-limit opens UpgradeModal which calls
      POST /api/payments/checkout and redirects to Stripe. Success returns to
      /app?upgraded=1&session_id=... → frontend polls status → user upgraded.
- [x] /account — profile, plan pill, payment history, usage counters, delete.
- [x] /privacy, /terms — full legal text emphasizing the no-upload guarantee.
- [x] Backend endpoints (all /api): /, /auth/signup, /auth/login,
      /auth/google/callback, /auth/me, /auth/account (DELETE),
      /usage/bump, /payments/checkout, /payments/status/{sid},
      /payments/history, /webhook/stripe.
- [x] Test suite at /app/backend/tests/backend_test.py — 13/13 pass.
- [x] Privacy guarantee verified — no conversation content in any network
      request during a full pack+download flow.

## Backlog (phase 2)
- [P0] /admin dashboard — total users, free vs paid counts, revenue events,
       signups over time (charts via recharts). Restricted to is_admin=true.
- [P0] Transactional email via Resend — email verification reminder banner +
       send link, password reset, purchase confirmation/receipt.
       Env: `RESEND_API_KEY`, `FROM_EMAIL`.
- [P1] Email verification banner inside the app shell.
- [P1] CSP headers to make the no-upload promise auditable.
- [P1] Rate limiting on auth + webhook endpoints (slowapi).
- [P1] HTTP-only cookie option for JWT (currently localStorage).
- [P2] Refund auto-downgrade tested end-to-end with a real refund event.
- [P2] Stripe customer portal link in /account for invoice/receipt.
- [P2] Marketing copy A/B; analytics events for upgrade conversion.
