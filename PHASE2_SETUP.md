# Phase 2 setup and rollout

## What this source adds

Each workspace has its own properties, renters, leases, invoices, payments and team. Every business request rechecks the user's database membership. Owners manage the workspace and team; property managers manage properties and finances; staff can read operational records and handle maintenance. The browser sends the selected workspace in `X-Organization-Id`.

Rent is billed monthly in whole UGX. An invoice captures the rent, unit and names at issue time. Manual payments and verified mobile-money payments can be allocated to invoices; extra funds remain unallocated credit. Arrears come from due invoices and their payment allocations. Issued financial records are voided with a reason rather than deleted. Mobile-money refunds require the provider's separate refund/reconciliation process.

Existing accounts receive an owned workspace. Existing properties and renters keep their IDs and move into that workspace. Old payments retain their values and are marked `LEGACY`, with no automatic allocation. No historical invoices are invented. Review opening balances, generate the months actually owed, and explicitly allocate any old credit before using arrears as a statement of account.

Automatic billing and reminders start **off**. Owners opt in under Settings after checking their billing day and renter contact details. Monthly billing creates a full month's invoice for each current, nonarchived renter's lease; there is no lease start/end date or proration model yet. Stop billing an ended lease by ending/removing it where no issued history exists, or archiving the renter; keep financial history. Per-property manager assignments, tenant accounts, automatic wallet debits and automated refunds are outside this release.

## Local development

Use Node.js 22 or newer and PostgreSQL 16. Copy the server/client `.env.example` files to `.env` and supply your own local database and JWT secret.

From the server directory:

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run dev
```

From the client directory:

```sh
npm ci
npm run dev
```

For a production build, run `npm run build` in both applications. The client build includes TypeScript checking. The server build generates its Prisma client before compiling; keep `assets/fonts` alongside `dist` for PDFs.

## Render settings

Keep the existing backend and the new `remote-property-management` static site. The frontend uses `VITE_API_URL=https://rent-app-foundations.onrender.com`; the backend uses `FRONTEND_URL=https://remote-property-management.onrender.com`. The frontend URL must match the allowed origin exactly, without a trailing slash.

| Setting | Backend web service | Frontend static site |
| --- | --- | --- |
| Root directory | `week-4-fullstack-ts/day-22-ts-node/server` | `week-4-fullstack-ts/day-21-ts-react/client` |
| Build command | `npm ci && npm run build` | `npm ci && npm run build` |
| Start/publish | `npm start` | `dist` |

On the static site add a **Rewrite**, source `/*`, destination `/index.html`, action `Rewrite`, so direct visits to `/billing`, `/login` and `/payment-return` load React.

Preserve the backend's existing `DATABASE_URL` and `JWT_SECRET`; set `NODE_ENV=production`. Keep every payment/email key on the backend. A variable prefixed with `VITE_` is public browser configuration.

Production trusts one proxy hop for Render's forwarded client address; local development trusts zero. Set `TRUST_PROXY_HOPS` only if your actual hosting proxy chain differs (integer 0–5). Public payment-status checks have a per-process IP quota plus a database-backed per-request verification cooldown. A larger deployment should enforce shared ingress quotas as well.

Private writes reject browser `Origin` values other than the exact `FRONTEND_URL`, in addition to CORS. Origin-less CLI requests remain supported. Receipt PDF downloads require an explicit `X-Organization-Id`, because issuing a historical receipt locks its financial details against later edits. The updated browser client supplies it automatically. Public payment status, confirmation and signed webhooks do not require a workspace or login.

## Apply database changes before enabling traffic

Back up the production database and check the backup can be restored. Test the migration against a separate restored copy first. Pause writes while migrating and replacing the old backend; its old write paths cannot supply the new required workspace IDs.

Run from the server directory in an environment with the intended `DATABASE_URL`:

```sh
npm ci
npm run db:deploy
npm run build
```

Then start the updated backend, deploy the updated client, and resume traffic. Use a Render pre-deploy command if available on your service, or run the migration from an authorized maintenance environment. Do not put database secrets in shell history or paste them into chat.

The organization migration audits inconsistent old renter/unit ownership and aborts with record IDs instead of assigning them silently. Resolve the reported data issue before retrying. Follow Prisma's failed-migration recovery procedure only after confirming the transaction rolled back. Never use `migrate reset` or `db push` on production. Rolling the application back after new records have been written needs a coordinated data-aware rollback; do not drop the new tables as a quick fix.

## Uganda mobile money and landlord settlement

The checkout integration uses Flutterwave Standard for MTN/Airtel Uganda. Each tenant authorizes a hosted checkout; this does not set up recurring wallet withdrawals. Provider availability and settlement timing depend on the approved merchant account.

Complete Flutterwave merchant activation and landlord onboarding before setting live keys. An operator must verify each landlord's identity and settlement destination, then map that workspace's ID to its approved collection subaccount using `FLW_ORGANIZATION_SUBACCOUNTS`. Owners cannot self-approve settlement destinations in the app. A missing mapping disables checkout; REMOTE never substitutes a central business account.

Configure the provider's HTTPS webhook as:

```text
https://rent-app-foundations.onrender.com/webhooks/flutterwave
```

Set its secret to the backend's `FLW_WEBHOOK_SECRET`. The default v3 signature mode is `legacy`; select `hmac` only when the merchant's webhook configuration explicitly uses that protocol. Test both networks, matching amount/reference/currency, duplicate callbacks, and actual landlord settlement with the provider's sandbox before enabling live collections. The browser return page always asks the backend for verified status; a redirect saying `successful` does not create a payment.

See [PAYMENT_PROVIDER.md](week-4-fullstack-ts/day-22-ts-node/server/PAYMENT_PROVIDER.md) for configuration and primary provider documentation.

## Email and scheduled work

Verify a sender email in Brevo and configure `BREVO_API_KEY` and `EMAIL_FROM` on the backend. REMOTE sends through the Brevo HTTPS API, which does not require an SMTP port. Keys and sender credentials never belong in React. Missing configuration is shown as unavailable; queued records are not proof of email delivery.

The durable outbox supports invoices, payment receipts, reports and rent reminders. Run `npm run jobs` from the **built server directory**, in a separate scheduled process using the same database, sender settings and frontend URL. A five-minute schedule is suitable (`*/5 * * * *`); this repository does not purchase or create a Render cron service. The command runs once and exits. A schedule must be configured for automatic billing, delayed retries and reminders to continue.

Owners choose the billing day (1–28) and opt into automatic billing/reminders. Reminder scheduling uses Africa/Kampala time, at or after 09:00 on the due date and weekly while overdue. The worker checks balances again before sending and deduplicates scheduled deliveries. Check delivery outcomes in Billing and investigate failed jobs before manually resending. Provider idempotency has a limited retention window; an uncertain send is not retried indefinitely.

Email verification for new accounts is a separate pending integration; this Phase 2 ledger does not imply that an email address has been verified. Existing sign-in remains compatible.

## Verification

Backend integration tests require an explicit disposable **local** database named `remote_phase2_test` or `remote_phase2_test_<suffix>`. They reset its public schema. Never use your development or production database.

```sh
# Set TEST_DATABASE_URL in your test environment first.
npm test
npm run build
```

Provider unit tests alone need no database: `npm run test:provider`. Frontend validation: `npm run build`. Tests mock external payment/email requests and never authorize a wallet charge or send an actual email.

The client's mocked browser checks can be run with a local Vite server:

```sh
npx playwright install chromium
VITE_API_URL=/api npm run dev -- --host 127.0.0.1 --port 4186
# In a second terminal, from the client directory:
npm run test:browser
```

The browser script mocks `/api` and blocks external requests. See the client tests README for optional browser paths and ports.

Before production rollout, also verify two separate workspaces, staff restrictions, partial rent payments, old credit allocation, PDF downloads and direct URL refreshes. Live payment acceptance, verified sender delivery and scheduled execution still need to be checked using your configured accounts.
