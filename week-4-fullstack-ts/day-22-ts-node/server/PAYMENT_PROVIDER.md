# Uganda rent collection: Flutterwave v3

REMOTE creates hosted Flutterwave Standard checkouts in whole UGX with
`payment_options: "mobilemoneyuganda"` for Uganda MTN and Airtel. Monthly invoices
are created by REMOTE; tenants authorize each payment. This is not a recurring
wallet debit mandate. The adapter does not charge a wallet or create a merchant
account on startup.

## Landlord settlement must be approved first

The platform operator must activate a Flutterwave merchant account for the
appropriate Uganda collection methods, complete the provider's business/KYC
requirements, and obtain permission to use collection subaccounts. Each landlord
must then be onboarded and their identity and settlement destination checked.
Use the provider dashboard or an authorized operator process for this work.
Uganda bank subaccount creation also requires the appropriate bank branch
metadata; obtain current bank/branch codes from Flutterwave. Do not collect bank
credentials or secret keys in REMOTE's browser settings.

Only after that approval should the **platform operator** configure the mapping
below. Organization owners cannot approve themselves by entering arbitrary
subaccount IDs. An API existence check confirms the account is accessible to the
configured merchant; it does not prove that the account belongs to the landlord
or that KYC is complete.

```dotenv
FLW_SECRET_KEY=<server-only Flutterwave secret key>
FLW_WEBHOOK_SECRET=<long random secret also configured in Flutterwave webhooks>
FLW_WEBHOOK_SIGNATURE_MODE=legacy
FLW_ORGANIZATION_SUBACCOUNTS={"123":"RS_provider_assigned_subaccount_id"}
```

`123` is an example organization ID; replace the ID and RS value. These are
server environment settings, never `VITE_` variables. Keep test and live keys,
subaccounts and webhook secrets separate. Missing mappings disable checkout;
there is no fallback to the platform's own settlement account.

Every checkout sends exactly one approved landlord subaccount, with split ratio
`1`, flat platform commission `0`. Provider fees and settlement schedules still
apply. The caller verifies the mapped account with `getSubaccount` before
checkout and stores its ID alongside the payment request for reconciliation.
The API summary exposes the name, bank, country when supplied, and last four
account digits; full account details remain on the server/provider.

## Webhooks and confirmation

Configure the publicly reachable HTTPS endpoint `/webhooks/flutterwave` in the
provider dashboard and enable retries. Register it before application login and
organization middleware. Preserve the exact raw request body before JSON
parsing. With the **v3 legacy** mode, the adapter compares the `verif-hash` header
against the configured secret using a constant-time comparison.

Only if the account's webhook configuration explicitly uses Flutterwave's
newer HMAC protocol, set `FLW_WEBHOOK_SIGNATURE_MODE=hmac`. That mode validates
`flutterwave-signature` as base64 HMAC-SHA256 over raw body bytes. The selected
mode accepts only its own protocol; it never falls back to the other header.
Selecting HMAC authentication does not change the v3 transaction API or webhook
event schema.

A redirect or webhook is a prompt to call `verifyTransaction`, not evidence of
payment. Before adding rent to the ledger, the caller must match the persisted
transaction reference, exact whole UGX amount, currency, provider transaction ID
and successful status, and check any returned settlement IDs. Apply settlement
once, inside an idempotent database transaction. Provider responses may omit
split details, so the approved checkout mapping and original request must also
be retained. Never accept a subaccount supplied by an untrusted webhook or
browser as authorization to settle elsewhere.

## Validation and activation

This implementation provides checkout creation, masked subaccount lookup,
strict transaction normalization, 15-second API timeouts and explicit webhook
authentication. API errors are sanitized. No live charge or settlement has been
performed by this implementation work. Without merchant credentials it remains
disabled. Before live use, exercise the supported sandbox flow, duplicate and
invalid webhook handling, exact amount/reference checks, both Uganda networks,
and the provider's actual landlord settlement/reconciliation process. Confirm
that merchant dashboard payment-method settings honor the checkout's requested
Uganda mobile-money option.

## Primary provider references

- [Flutterwave Standard](https://developer.flutterwave.com/docs/flutterwave-standard-1): v3 hosted checkout and return parameters.
- [Split payments](https://developer.flutterwave.com/docs/split-payments): collection subaccounts, Uganda branch metadata, commission overrides and settlement responsibilities.
- [List collection subaccounts](https://developer.flutterwave.com/reference/fetch-all-subaccounts): the adapter matches the checkout `RS_...` identifier using `/v3/subaccounts`; this differs from a numeric database ID and from payout/wallet subaccounts.
- [Verify a transaction](https://developer.flutterwave.com/reference/verify-transaction): the authoritative v3 verification endpoint.
- [v3 webhooks](https://developer.flutterwave.com/docs/webhooks): `verif-hash`, verification and idempotency guidance.
- [v4 webhook authentication](https://developer.flutterwave.com/v4.0/docs/webhooks): raw-body HMAC-SHA256 and `flutterwave-signature`.
- [Mobile-money payment support](https://www.flutterwave.com/za/support/payment-methods/pay-with-mobile-money): Uganda MTN and Airtel availability, subject to merchant activation.
