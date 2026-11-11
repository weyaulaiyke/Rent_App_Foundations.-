# PostgreSQL integration checks

These tests require a dedicated, disposable local PostgreSQL database. They refuse to run without `TEST_DATABASE_URL`, refuse remote hosts, and require a database name of `remote_phase2_test` or `remote_phase2_test_<suffix>`. The suite resets that database's `public` schema and applies the repository's migrations; never point it at development or production data.

From the server directory, generate the Prisma client, then run:

```sh
TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:55433/remote_phase2_test?schema=public' npm test
```

The command uses `--test-concurrency=1` because the integration files each reset the same schema. To run only database tests, use:

```sh
TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:55433/remote_phase2_test?schema=public' node --import tsx --test --test-concurrency=1 tests/billing.test.ts tests/organization-isolation.test.ts
```

The organization suite uses a real local Express listener, signed test cookies and PostgreSQL. It checks the migration's ownership audit and rollback, preservation of existing IDs/data, organization selection, cross-organization IDs and relationships, per-organization roles, shared manager access, staff restrictions, new-account workspaces, and concurrent last-owner protection.

The billing suite checks migration preservation of unallocated historical payments, concurrent monthly invoice generation, immutable invoice snapshots, partial payments and excess credit, allocation and void races, per-landlord checkout settlement, authoritative provider verification, duplicate callbacks, public status privacy, scoped PDFs and email delivery, durable worker claims and bounded retries, Brevo idempotency, and Kampala billing/reminder dates. External payment and email endpoints are mocked; any unexpected external fetch fails. No real email, charge or provider request is sent.

The provider suite also runs without a database and checks checkout payloads, exact provider references/amounts and explicit webhook signature modes:

```sh
node --import tsx --test tests/payment-provider.test.ts
```
