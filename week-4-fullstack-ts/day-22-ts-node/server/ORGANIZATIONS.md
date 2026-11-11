# Organization isolation

This change adds shared workspaces and server-enforced membership roles to
the existing rent API. The separate monthly ledger migration builds on these
workspaces. Email verification is not enabled by these migrations.

## Applying the migration

Back up the database and stop application writes before running the usual
`prisma migrate deploy`. Do not use `migrate reset` or replace this migration
with `db push` on an existing database.

`20261111120000_organization_isolation` runs in one PostgreSQL transaction. It
locks the existing tables, audits lease renter/unit ownership and payment
ownership, and aborts with offending record IDs if ownership is inconsistent.
Review those records before retrying; the migration does not silently move
renters, leases, or payments between owners. A failed migration may need the
normal Prisma `migrate resolve --rolled-back` procedure after confirming its
transaction rolled back and resolving the reported data issue.

Every existing user receives one workspace and an OWNER membership. Property
and Renter records are backfilled into that user's workspace. Existing record
IDs, values, archives, and creator `userId` fields remain intact. New Property
and Renter `userId` values record the actor, while `organizationId` controls
access. A new signup creates its user, workspace, and OWNER membership together.

Generate the Prisma client after applying the schema: `prisma generate`.
Deploy the backend and client changes together so the workspace selector and
server permissions agree. The backend supports older clients by selecting the
user's oldest membership when no organization header is supplied.

## Selecting a workspace

Send `X-Organization-Id: <positive integer>` with business and membership API
requests. The server checks the authenticated user's current database
membership on every request. It returns 400 for invalid IDs and 403 for an
organization the user cannot access. A valid selection is echoed in the
`X-Organization-Id` response header. Omitting the header chooses the oldest
membership by membership ID, including a migrated personal workspace.

List/create organization requests use the authenticated user. Renaming uses
the organization ID in its URL. Those endpoints do not use the selection header.

## Roles

All three roles can read properties, units, renters, archives, and maintenance.

| Permission | OWNER | PROPERTY_MANAGER | STAFF |
| --- | --- | --- | --- |
| property:write (includes units) | Yes | Yes | No |
| renter:write | Yes | Yes | No |
| lease:write | Yes | Yes | No |
| finance:read (leases, payments, arrears) | Yes | Yes | No |
| payment:write | Yes | Yes | No |
| maintenance:write | Yes | Yes | Yes |
| organization:manage | Yes | No | No |
| members:manage | Yes | No | No |

Membership roles apply to the entire workspace. Property-specific manager
assignments are not part of this milestone. Membership changes recheck the
actor's OWNER role inside a serializable transaction, serialize changes per
organization, and prevent removal/demotion of the final owner.

## Organization APIs

- `GET /organizations`: `{data: [{id, name, role, permissions}]}` for the
  authenticated user's memberships.
- `POST /organizations` with `{name}`: creates a workspace owned by the actor;
  returns 201 and `{data: {id, name, role, permissions}}`.
- `PATCH /organizations/:id` with `{name}`: OWNER-only rename; returns the
  same organization view in `{data}`.
- `GET /organization/members`: OWNER-only `{data: [{userId, email, role,
  joinedAt}]}` for the selected workspace.
- `POST /organization/members` with `{email, role}`: adds an **existing REMOTE
  account**, returns 201 and the membership view in `{data}`. This does not
  send an invitation email or create a placeholder account.
- `PATCH /organization/members/:userId` with `{role}`: changes that member's
  role and returns the membership view in `{data}`.
- `DELETE /organization/members/:userId`: removes that membership and returns
  `{data: {message: "Member removed"}}`.

Errors are JSON `{error: string}`. The final-owner guard returns 409.
Business API paths and response envelopes are preserved. Lease PATCH also
accepts optional `unitId` alongside required `monthlyRent`; the target unit
must belong to the selected organization.

## Finance calculation

The monthly ledger migration replaces the old lifetime-payment calculation.
Arrears now come from dated invoices and explicit payment allocations in the
selected workspace. Existing payments remain unallocated credit for review;
no historical charges or allocations are inferred during migration. See the
repository's `PHASE2_SETUP.md` for billing, documents and provider rollout.

## Development

`src/server.ts` exports `app` without opening a port when imported. The normal
`node dist/server.js` entry point starts the listener. All modules share the
Prisma instance exported from `src/prisma.ts`.
