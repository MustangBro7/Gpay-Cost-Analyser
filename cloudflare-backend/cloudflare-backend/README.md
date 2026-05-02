# Cloudflare Backend

Cloudflare-native email backend for the GPay Cost Analyser migration.

## What Is Implemented

- Hono Worker API for:
  - Clerk-protected transaction endpoints
  - Google OAuth connect + callback
  - Gmail Pub/Sub ingestion
  - scheduled Gmail watch renewal / recovery
- D1 schema and remote migration for:
  - users
  - Google OAuth tokens
  - OAuth state
  - Gmail watch state
  - processed Gmail messages
  - Pub/Sub deliveries
  - transaction head pointers
- R2-backed canonical transaction blobs with optimistic D1 head updates
- Frontend-compatible `token-status`, `daterange`, `add-transaction`, `reclassify`, and `normalize` APIs

## Wrangler Commands

```bash
npm install
npm run check
npm run dev
```

## Local Mock Mode

For local frontend/backend work without Clerk or Google auth, enable the worker's mock mode in `cloudflare-backend/cloudflare-backend/.dev.vars`:

```bash
LOCAL_DEV_MODE=true
DEV_MOCK_USER_ID=local-dev-user
DEV_MOCK_USER_EMAIL=local-dev@gpay.local
```

With `LOCAL_DEV_MODE=true`, the worker:

- skips Clerk bearer-token validation
- returns a healthy `token-status` response
- serves a mutable in-memory transaction dataset shaped like production data
- supports `daterange`, `add-transaction`, `reclassify`, and `normalize`

The dataset resets whenever `wrangler dev` restarts.

Cloudflare-side provisioning used here:

```bash
npx wrangler d1 create gpay-cost-analyser
npm run db:migrate:remote
```

R2 bucket creation command:

```bash
npx wrangler r2 bucket create gpay-cost-analyser-transactions
```

In this environment, D1 creation and remote migration succeeded. R2 bucket creation failed because R2 is not enabled on the current Cloudflare account.

## Required Secrets

Set these before a real deploy:

```bash
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put CLERK_PUBLISHABLE_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_PUBSUB_AUDIENCE
npx wrangler secret put GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GEMINI_API_KEY
```

Where to add them:

- Production / deployed Worker: `wrangler secret put <NAME>` from `cloudflare-backend/cloudflare-backend`
- Local Worker dev: create `cloudflare-backend/cloudflare-backend/.dev.vars` from `.dev.vars.example`
- Non-secret config: keep in `cloudflare-backend/cloudflare-backend/wrangler.jsonc`

## Google Cloud Requirements

- Enable Gmail API and Google OAuth
- Configure the OAuth redirect URI to match `GOOGLE_OAUTH_REDIRECT_URI`
- Create the Pub/Sub topic referenced by `GOOGLE_PUBSUB_TOPIC_NAME`
- Grant Gmail push publisher access to `gmail-api-push@system.gserviceaccount.com`
- Configure a Pub/Sub push subscription targeting:
  - `https://<your-worker-domain>/internal/pubsub/gmail`
- Configure the push subscription to send an OIDC token whose audience matches `GOOGLE_PUBSUB_AUDIENCE`

## Deploy Notes

- Replace `FRONTEND_ORIGIN` and `GOOGLE_OAUTH_REDIRECT_URI` in `wrangler.jsonc` for your deployed domains.
- `FRONTEND_ORIGIN` should remain your app origin such as `https://gpayanalyze.co.in`.
- `GOOGLE_OAUTH_REDIRECT_URI` should point at the Worker host such as `https://api.gpayanalyze.co.in/oauth2callback`.
- Keep the real D1 `database_id` in `wrangler.jsonc`.
- The Worker will not function end-to-end until the R2 bucket exists and the required secrets are set.
