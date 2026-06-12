# Auth-Gated Testing Playbook (Manifest)

For the testing agent: how to authenticate and verify gated flows.

## Email / password (primary)

```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

# Sign up
curl -s -X POST "$API_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"tester+free@manifest.app","password":"TesterPass!23","name":"Test Free"}'

# Log in (returns {token, user})
TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"tester+free@manifest.app","password":"TesterPass!23"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# /auth/me
curl -s "$API_URL/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

In the browser, set `localStorage.setItem('mf_token', '<TOKEN>')` and navigate to `/app`.

## Google OAuth (Emergent)

Manual flow only — Emergent's hosted login page cannot be driven by Playwright reliably.
Test identity: `vpkarthik97@gmail.com` (admin). After completing the Google login the
redirect lands at `/auth/callback#session_id=...` which exchanges the session for a JWT.

## Stripe checkout

Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC. After payment,
Stripe redirects to `/app?upgraded=1&session_id=...`. The frontend polls
`/api/payments/status/{session_id}` which calls Stripe to confirm, updates the user to
`plan=full`, and shows the success banner.
