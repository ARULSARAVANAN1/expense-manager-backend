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

Categories are inferred from the query's meaning, not just explicit category
words. For example, `"500 for dinner"` should select an owned expense category
such as `Food` or `Food & Dining`. The model is instructed to prefer the best
matching supplied category and return its exact name; the backend resolves
that name case-insensitively to an owned category ID and returns its stored name.
If no available category fits, a predicted label is returned with
`categoryId: null` for review. Ambiguous or uninformative text such as
`"spent 500"` should leave the category unset. Predictions remain reviewable;
parsing never creates categories or transactions.

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

## AI monthly financial summary

`POST /api/summaries/monthly` requires a bearer token. Send
`{ "month": "2026-11" }` to summarize a calendar month, or `{}` (or no body)
for the current month in the authenticated user's timezone. Month must be
`YYYY-MM` with a year from 0001 to 9999; unknown fields are rejected.

The response uses `{ success: true, data }`, where `data` contains:

- `month`, `timezone`, and `currency` (`INR`).
- `totals`: `income`, `expense`, `netSavings` (income minus expenses),
  `savingsRate` (percentage, rounded to two decimals; `null` without income),
  `incomeCount`, and `expenseCount`.
- `topIncomeCategories` and `topExpenseCategories`: up to five each, ordered
  by amount descending, with `categoryName`, `amount`, and `transactionCount`.
- `summary`, `highlights`, and `savingSuggestions`: AI-generated text, with
  up to five highlights and five suggestions. Render these as plain text.
- `card`: a time-aware `greeting`, an `introduction` naming the selected month,
  and exactly three `insights` for active months. Each insight contains `type`,
  `title`, and `message`, ordered as `trend`, `saving`, and `progress`.
  The frontend can map these types to trend, lightbulb, and progress icons.
  Progress text can be neutral or cautionary when savings have not improved.
  No-activity cards have an empty insight list.
- `comparison`: previous calendar month, `hasPreviousRecords`, `previousTotals`,
  `expenseChangePercent`, `netSavingsChange` (INR), and comparisons for the
  current top expense categories (`categoryName`, `amount`, `previousAmount`,
  `changePercent`). Percentages are rounded to two decimals and are `null`
  when the previous amount is zero or no previous records exist. Previous
  totals and net savings change are `null` without previous records.
- `source`: `"ai"` when generated by Groq, or `"none"` when the month has
  no records. No-activity responses contain zero totals, a no-activity message,
  empty category/insight lists, and do not call the provider.

Totals use **all** owned income/expense records in the month, not a paginated
list, with exact integer-paise arithmetic and legacy-amount compatibility.
Month boundaries use the stored calendar transaction dates, consistent with
transaction filters; timezone determines the default month and greeting. This
does not calculate account balances. Comparisons use all recorded entries
in each calendar month (`comparison.basis = "full_calendar_months"`), not
equal elapsed days. `comparison.isCurrentMonth` flags an incomplete current
month, which AI is instructed to qualify against the full previous month. Current
months include whatever records have already been entered, including future
dates within that month.

The endpoint reuses `AI_PROVIDER`, `GROQ_API_KEY`, `AI_MODEL`, and
`AI_TIMEOUT_MS` described above. `AI_SUMMARY_REQUESTS_PER_HOUR` optionally
sets a separate per-user limit from 1 to 1000 (default 20). All summary
requests, including no-activity months, count toward this process-local
limit; configure shared rate limiting for multiple instances.

Only monthly totals, counts, timezone/month, top category names/amounts, and
server-calculated previous-month comparisons
are sent to Groq. Transaction descriptions, notes, account names, database
IDs, and profile details are not sent. Avoid sensitive information in category
names. AI text is advisory and may be inaccurate; the server-calculated totals
are authoritative. Provider errors are explicit, not disguised as successful
summaries (`429` for limits, `502` for invalid/rejected output, `503` for
configuration, timeout, or availability errors). No transactions are created
or changed.

To render a dashboard card, use `data.card.greeting` as the heading,
`data.card.introduction` as the subtitle, and render each entry of
`data.card.insights` as a title/message row. Existing totals and text fields
remain available. Savings suggestions do not invent monetary savings estimates;
category data alone cannot establish that reducing spending will save a
specific amount.

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
updates, categories, accounts, expenses, income, budgets, AI expense
draft-parsing, and monthly AI financial summaries. Recurring expenses, split
tracking, and other analytics/reports are
not implemented in this phase. Password-change rate limiting should be configured
at the deployment edge before exposing the service publicly. No Google or AI
credentials are required or fabricated by the application.

## Validation

Run `npm run build` for TypeScript validation and `npm test` for the AI API
tests. Tests mock MongoDB queries and Groq; no database, AI key, or external
provider calls are needed.
