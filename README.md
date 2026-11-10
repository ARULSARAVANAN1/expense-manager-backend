# Expense Manager API

Express 5 + TypeScript + MongoDB/Mongoose backend. The API is mounted at
`/api`; database and JWT configuration are supplied with `MONGODB_URI` and
`JWT_SECRET`.

After starting the server with `npm run dev`, open
`http://localhost:3000/api/docs` for Swagger UI. The raw OpenAPI document is
available at `http://localhost:3000/api/openapi.json`. In Swagger UI, use
**Authorize** to enter a bearer token before calling protected routes.

## Authentication and profile

- `POST /api/auth/register` and `POST /api/auth/login` keep the existing
  `{ success, data: { token, user } }` response.
- `GET /api/auth/me` returns the authenticated user in `data`.
- `POST /api/auth/logout` invalidates all tokens for that user.
- `PATCH /api/users/me` accepts a non-empty subset of `name` and
  `preferredCurrency`. Currency is a preference only; financial amounts remain
  INR.
- `POST /api/users/me/change-password` accepts `currentPassword` and
  `newPassword` (8–128 characters). A successful change revokes existing
  tokens; the client must authenticate again.

`POST /api/auth/google` accepts `{ "credential": "<Google ID token>" }` and
returns the same token/user response as password login. It verifies the token
with Google's official verifier, requires a verified email, and checks its
audience against the server's `GOOGLE_CLIENT_ID`. Configure that environment
variable with the OAuth 2.0 Web client ID used by Google Identity Services in
the frontend. The frontend sends its Google credential to this backend
endpoint; only the backend's application JWT should be used for subsequent API
requests.

Google identities are linked by Google's stable subject ID. A Google sign-in
whose email already belongs to an unlinked password account returns `409
GOOGLE_ACCOUNT_LINK_REQUIRED`; accounts are not automatically linked by email.

## AI quick expense parsing

`POST /api/expenses/parse` accepts `{ "text": "Spent 250 on lunch yesterday using UPI" }`
and returns a reviewable draft. This endpoint never creates a transaction.
Missing or uncertain description, amount, and date values are returned as
`null` with entries in `needsClarification`. The AI-predicted `categoryName` and
`accountName` labels are returned even when they do not match an existing
option; `categoryId` and `accountId` are populated only when the prediction
matches an owned record. The model is not given database IDs. Invalid or empty
expense queries return one HTTP 422 error; inputs requesting a non-INR
currency, conversion, or multiple expenses are rejected.

Configure these backend environment variables to enable parsing:

- `AI_PROVIDER=groq`
- `GROQ_API_KEY` — secret from the official Groq console; never expose it in a
  `VITE_*` variable.
- `AI_MODEL` — optional; defaults to `openai/gpt-oss-120b`. Set this to an
  active model available to your Groq account if that model is unavailable.
- `AI_TIMEOUT_MS` — optional timeout from 1000 to 30000 ms (default 10000).
- `AI_PARSE_REQUESTS_PER_HOUR` — optional per-user limit from 1 to 1000
  (default 20). This counter is process-local; use deployment-level shared
  rate limiting when running multiple instances.

The expense text and limited category/account names are sent to Groq for
processing. Avoid including unnecessary sensitive details. Provider failures,
timeouts, and quota errors are returned explicitly; no local parser is used as
a fallback.

User responses include `id`, `name`, `email`, `preferredCurrency`, `timezone`,
and `hasPassword`. New accounts default to INR and `Asia/Kolkata`; existing
accounts without stored preferences are represented with those defaults.

## User-owned financial resources

All routes below require a bearer token. Ownership is always derived from that
token; request bodies containing owner IDs are rejected.

| Resource | Routes |
|---|---|
| Categories | `GET/POST /api/categories`, `PATCH/DELETE /api/categories/:id` |
| Accounts | `GET/POST /api/accounts`, `PATCH/DELETE /api/accounts/:id` |
| Expenses | `GET/POST /api/expenses`, `GET/PATCH/DELETE /api/expenses/:id` |
| Income | `GET/POST /api/incomes`, `GET/PATCH/DELETE /api/incomes/:id` |
| Budgets | `GET/POST /api/budgets`, `PATCH/DELETE /api/budgets/:id` |

Category types are `expense` and `income` in API responses and accept either
case on creation. Accounts accept the existing `BANK`, `CASH`, `CREDIT_CARD`,
or `WALLET` type; type may be omitted when creating an account.

Transactions use `{ description, amount, categoryId, date, accountId?, notes? }`.
`accountId` may be omitted or set to `null`; when supplied, it must belong to
the authenticated user. Responses return `accountId` and `accountName` as
`null` when no account is selected.
Dates are calendar dates (`YYYY-MM-DD`), bounds are inclusive, and transaction
lists support `search`, `categoryId`, `accountId`, `from`, `to`, `sort`,
`page`, and `pageSize`. Search covers descriptions, notes, and owned account
names. Lists use the standard `items/page/pageSize/total/totalPages` envelope;
category and account collections return arrays. Budgets include spent,
remaining, and percent values, with spending calculated across all matching
expense records rather than the current page.

New financial amounts are validated to two decimal places and stored alongside
integer paise for exact arithmetic. Existing transaction records without the
paise field remain readable using their legacy rupee amount. Category and
account names are unique case-insensitively per owner. Referenced categories
and accounts cannot be deleted; category type changes are rejected while
transactions or budgets refer to them.

Errors use `{ success: false, message, code, errors? }`. Invalid request
payloads are rejected rather than silently accepting unknown fields.

## Current scope

This implementation covers email/password and Google sign-in, profile/password
updates, categories, accounts, expenses, income, budgets, and AI expense
draft-parsing. Recurring expenses, split tracking, and analytics/reports are
not implemented in this phase. Password-change rate limiting should be configured
at the deployment edge before exposing the service publicly. No Google or AI
credentials are required or fabricated by the application.
