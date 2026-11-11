# Phase 2 validation

Checked against source based on `310a8c03fe5e9f24512d72469faea5f4e460f683`, on local branch `codex/phase2-foundation`.

## Automated checks

- Server `npm test`: **38 tests passed**, zero failures or skips. Integration suites used a disposable PostgreSQL 16 database on localhost; provider unit tests used mocked HTTP.
- Server `npm run build`: Prisma 5.22 client generation and TypeScript compilation passed.
- Client `npm run build`: TypeScript checking and Vite production build passed.
- Client `npm run test:browser`: mocked local Chromium regression checks passed for invoices, allocations, payments, documents, contacts/settings, workspace boundaries, staff access and public payment confirmation. External origins were blocked.
- Desktop/mobile billing layouts were visually inspected. The existing green/gold branding, bold R and appearance settings are retained.

## Important cases exercised

Migration tests preserve old IDs and values, stop on inconsistent ownership, create owner memberships and leave legacy payments unallocated. API tests reject forged workspace IDs, foreign related records, staff finance requests and removal of the final owner.

Ledger tests cover simultaneous monthly generation, issue-time snapshots, partial/excess payments, allocation limits, payment void races and immutable issued records. Payment tests cover different approved accounts for different landlords, missing settlement configuration, forged/duplicate callbacks, exact reference/amount/currency checks, signature modes, simultaneous webhook/browser confirmation and genuine late payments becoming credit.

Document checks cover scoped PDFs, receipt issuance, sender failure, durable claims, idempotency responses, bounded retries, missing contacts, reminder opt-ins, paid/stale reminder suppression and Kampala month/date boundaries. Public browser checks ignore redirect success flags and verify status through the API, including recovery of a failed request when the provider later confirms payment.

The concurrency tests found a Prisma 5 behavior that has been corrected: raw PostgreSQL row-lock conflicts can arrive as `P2010` with SQLSTATE `40001`, rather than `P2034`. Transactions now retry only recognized serialization/deadlock conflicts. Duplicate callbacks still create one payment and one receipt job.

Additional regressions reject cross-site form document sends using an authenticated cookie, without creating deliveries or issuing receipts. The stateful first receipt download requires an explicit workspace. Browser dashboard checks exclude voided payments and archived lease renters and use Kampala months even when the browser is in another timezone.

## Checks still requiring configured services

The feature is prepared on a review branch. No production database was migrated and no Render deployment was performed during validation. No real payment, settlement or email was sent.

Before activating live collections, confirm merchant eligibility, MTN and Airtel sandbox behavior, webhook delivery and the actual settlement destination for every landlord. Provider Uganda documentation contains inconsistent `payment_type` examples; the implementation accepts only documented mobile-money values with exact UGX/reference/amount checks, but real merchant sandbox acceptance remains necessary. See `PAYMENT_PROVIDER.md`.

Email delivery needs a verified Brevo sender. Scheduled automation needs the built job command configured in a scheduler. New-account email verification remains a separate pending integration. See `PHASE2_SETUP.md` for configuration, migration precautions and the billing model's current limits.
