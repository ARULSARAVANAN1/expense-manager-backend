const success = {
    type: "object",
    properties: {
        success: { type: "boolean", example: true },
        data: {},
    },
};

const error = {
    type: "object",
    properties: {
        success: { type: "boolean", example: false },
        message: { type: "string" },
        code: { type: "string" },
        errors: {},
    },
};

const secured = [{ bearerAuth: [] }];

const transactionQueryParameters = [
    { name: "search", in: "query", schema: { type: "string", maxLength: 200 } },
    { name: "categoryId", in: "query", schema: { type: "string" } },
    { name: "accountId", in: "query", schema: { type: "string" } },
    { name: "from", in: "query", schema: { type: "string", format: "date" } },
    { name: "to", in: "query", schema: { type: "string", format: "date" } },
    { name: "sort", in: "query", schema: { type: "string", enum: ["newest", "oldest", "highest", "lowest"], default: "newest" } },
    { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
    { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
];

export const openApiSpec = {
    openapi: "3.0.3",
    info: {
        title: "Expense Manager API",
        version: "1.0.0",
        description:
            "User-scoped expense manager API. Financial amounts are INR rupees with at most two decimal places.",
    },
    servers: [{ url: "http://localhost:3000", description: "Local development" }],
    tags: [
        { name: "Health" },
        { name: "Authentication" },
        { name: "Profile" },
        { name: "Categories" },
        { name: "Accounts" },
        { name: "Expenses" },
        { name: "AI Parsing" },
        { name: "AI Summaries" },
        { name: "Income" },
        { name: "Budgets" },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
        },
        schemas: {
            Error: error,
            Success: success,
            User: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string", format: "email" },
                    preferredCurrency: { type: "string", example: "INR" },
                    timezone: { type: "string", example: "Asia/Kolkata" },
                    hasPassword: { type: "boolean" },
                },
            },
            TransactionInput: {
                type: "object",
                required: ["description", "amount", "categoryId", "date"],
                properties: {
                    description: { type: "string", minLength: 1, maxLength: 200 },
                    amount: { type: "number", exclusiveMinimum: 0, multipleOf: 0.01 },
                    categoryId: { type: "string" },
                    accountId: { type: "string", nullable: true },
                    date: { type: "string", format: "date" },
                    notes: { type: "string", maxLength: 2000, nullable: true },
                },
            },
            Transaction: {
                allOf: [
                    { $ref: "#/components/schemas/TransactionInput" },
                    {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            categoryName: { type: "string" },
                            accountName: { type: "string" },
                            createdAt: { type: "string", format: "date-time" },
                            updatedAt: { type: "string", format: "date-time" },
                        },
                    },
                ],
            },
            ExpenseParseRequest: {
                type: "object",
                required: ["text"],
                additionalProperties: false,
                properties: {
                    text: { type: "string", minLength: 1, maxLength: 1000 },
                },
            },
                MonthlySummaryRequest: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        month: {
                            type: "string",
                            pattern: "^(?!0000)\\d{4}-(0[1-9]|1[0-2])$",
                            example: "2026-11",
                            description: "Defaults to the current month in the user's timezone.",
                        },
                    },
                },
                MonthlySummaryCategory: {
                    type: "object",
                    required: ["categoryName", "amount", "transactionCount"],
                    properties: {
                        categoryName: { type: "string" },
                        amount: { type: "number", description: "INR rupees" },
                        transactionCount: { type: "integer", minimum: 1 },
                    },
                },
                MonthlySummaryResult: {
                    type: "object",
                    required: [
                        "month", "timezone", "currency", "totals",
                        "topIncomeCategories", "topExpenseCategories",
                        "summary", "highlights", "savingSuggestions", "source", "card", "comparison",
                    ],
                    properties: {
                        month: { type: "string", example: "2026-11" },
                        timezone: { type: "string", example: "Asia/Kolkata" },
                        currency: { type: "string", enum: ["INR"] },
                        totals: {
                            type: "object",
                            required: ["income", "expense", "netSavings", "savingsRate", "incomeCount", "expenseCount"],
                            properties: {
                                income: { type: "number" },
                                expense: { type: "number" },
                                netSavings: { type: "number", description: "Income minus expenses; may be negative." },
                                savingsRate: { type: "number", nullable: true, description: "Net savings / income as a percentage, rounded to two decimals. Null without income." },
                                incomeCount: { type: "integer", minimum: 0 },
                                expenseCount: { type: "integer", minimum: 0 },
                            },
                        },
                        topIncomeCategories: {
                            type: "array", maxItems: 5,
                            items: { $ref: "#/components/schemas/MonthlySummaryCategory" },
                        },
                        topExpenseCategories: {
                            type: "array", maxItems: 5,
                            items: { $ref: "#/components/schemas/MonthlySummaryCategory" },
                        },
                        summary: { type: "string", maxLength: 2000 },
                        highlights: {
                            type: "array", maxItems: 5,
                            items: { type: "string", minLength: 1, maxLength: 500 },
                        },
                        savingSuggestions: {
                            type: "array", maxItems: 5,
                            items: { type: "string", minLength: 1, maxLength: 500 },
                        },
                        source: { type: "string", enum: ["ai", "none"] },
                        card: {
                            type: "object",
                            required: ["greeting", "introduction", "insights"],
                            properties: {
                                greeting: { type: "string", example: "Good afternoon!" },
                                introduction: { type: "string" },
                                insights: {
                                    type: "array", maxItems: 3,
                                    description: "Exactly three items in trend, saving, progress order for AI responses; empty for no activity. Render as plain text; map type to frontend icons/colors.",
                                    items: {
                                        type: "object",
                                        required: ["type", "title", "message"],
                                        additionalProperties: false,
                                        properties: {
                                            type: { type: "string", enum: ["trend", "saving", "progress"] },
                                            title: { type: "string", minLength: 1, maxLength: 100 },
                                            message: { type: "string", minLength: 1, maxLength: 500 },
                                        },
                                    },
                                },
                            },
                        },
                        comparison: {
                            type: "object",
                            required: ["previousMonth", "hasPreviousRecords", "basis", "isCurrentMonth", "previousTotals", "expenseChangePercent", "netSavingsChange", "expenseCategories"],
                            properties: {
                                previousMonth: { type: "string" },
                                hasPreviousRecords: { type: "boolean" },
                                basis: { type: "string", enum: ["full_calendar_months"] },
                                isCurrentMonth: { type: "boolean", description: "Current-month data may be incomplete; this is not an equal-elapsed-days comparison." },
                                previousTotals: {
                                    type: "object", nullable: true,
                                    required: ["income", "expense", "netSavings"],
                                    properties: {
                                        income: { type: "number" },
                                        expense: { type: "number" },
                                        netSavings: { type: "number" },
                                    },
                                },
                                expenseChangePercent: { type: "number", nullable: true, description: "Null without previous records or positive previous expenses." },
                                netSavingsChange: { type: "number", nullable: true, description: "INR difference; null without previous records." },
                                expenseCategories: {
                                    type: "array", maxItems: 5,
                                    items: {
                                        type: "object",
                                        required: ["categoryName", "amount", "previousAmount", "changePercent"],
                                        properties: {
                                            categoryName: { type: "string" },
                                            amount: { type: "number" },
                                            previousAmount: { type: "number", nullable: true },
                                            changePercent: { type: "number", nullable: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            ExpenseParseResult: {
                type: "object",
                properties: {
                    draft: {
                        type: "object",
                        required: [
                            "description",
                            "amount",
                            "date",
                            "categoryId",
                            "accountId",
                            "categoryName",
                            "accountName",
                            "notes",
                        ],
                        properties: {
                            description: { type: "string", nullable: true },
                            amount: { type: "number", nullable: true },
                            date: { type: "string", format: "date", nullable: true },
                            categoryId: { type: "string", nullable: true },
                            accountId: { type: "string", nullable: true },
                            categoryName: { type: "string", nullable: true },
                            accountName: { type: "string", nullable: true },
                            notes: { type: "string", nullable: true },
                        },
                    },
                    needsClarification: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["field", "message"],
                            properties: {
                                field: {
                                    type: "string",
                                    enum: [
                                        "description",
                                        "amount",
                                        "date",
                                    ],
                                },
                                message: { type: "string" },
                            },
                        },
                    },
                    source: { type: "string", enum: ["ai"] },
                    referenceDate: { type: "string", format: "date" },
                },
            },
        },
    },
    paths: {
        "/api/health": {
            get: {
                tags: ["Health"],
                summary: "Check API health",
                responses: { "200": { description: "API is running" } },
            },
        },
        "/api/auth/register": {
            post: {
                tags: ["Authentication"],
                summary: "Register an account",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["name", "email", "password"],
                                properties: {
                                    name: { type: "string", minLength: 2 },
                                    email: { type: "string", format: "email" },
                                    password: { type: "string", minLength: 6 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "201": { description: "Created; returns token and user" },
                    "400": {
                        description: "Invalid input",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Error" },
                            },
                        },
                    },
                    "409": { description: "Email already registered" },
                },
            },
        },
        "/api/auth/login": {
            post: {
                tags: ["Authentication"],
                summary: "Log in",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["email", "password"],
                                properties: {
                                    email: { type: "string", format: "email" },
                                    password: { type: "string" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Returns token and user" },
                    "401": { description: "Invalid email or password" },
                },
            },
        },
        "/api/auth/google": {
            post: {
                tags: ["Authentication"],
                summary: "Sign in with a Google ID token",
                description:
                    "Send the credential returned by Google Identity Services. The backend verifies its signature, issuer, expiration, verified email, and audience against GOOGLE_CLIENT_ID, then returns an application JWT.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["credential"],
                                additionalProperties: false,
                                properties: {
                                    credential: {
                                        type: "string",
                                        minLength: 1,
                                        maxLength: 8192,
                                        description: "Google ID token credential",
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Google sign-in succeeded; returns application token and user" },
                    "401": { description: "Credential is invalid, expired, or its email is unverified" },
                    "409": { description: "Email has an existing account that is not linked to Google" },
                    "503": { description: "Google sign-in is not configured on the server" },
                },
            },
        },
        "/api/auth/me": {
            get: {
                tags: ["Authentication"],
                summary: "Get the current user",
                security: secured,
                responses: {
                    "200": { description: "Current user" },
                    "401": { description: "Missing or invalid token" },
                },
            },
        },
        "/api/auth/logout": {
            post: {
                tags: ["Authentication"],
                summary: "Invalidate the current user's sessions",
                security: secured,
                responses: { "200": { description: "Logged out" }, "401": { description: "Missing or invalid token" } },
            },
        },
        "/api/users/me": {
            patch: {
                tags: ["Profile"],
                summary: "Update name and/or preferred currency",
                security: secured,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                minProperties: 1,
                                additionalProperties: false,
                                properties: {
                                    name: { type: "string", minLength: 1, maxLength: 100 },
                                    preferredCurrency: {
                                        type: "string",
                                        enum: ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"],
                                    },
                                },
                            },
                        },
                    },
                },
                responses: { "200": { description: "Updated user" }, "401": { description: "Missing or invalid token" } },
            },
        },
        "/api/users/me/change-password": {
            post: {
                tags: ["Profile"],
                summary: "Change password and revoke current sessions",
                security: secured,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["currentPassword", "newPassword"],
                                properties: {
                                    currentPassword: { type: "string" },
                                    newPassword: { type: "string", minLength: 8, maxLength: 128 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Password changed; reauthentication required" },
                    "401": { description: "Current password is incorrect" },
                    "409": { description: "Password is not configured" },
                },
            },
        },
        "/api/categories": {
            get: {
                tags: ["Categories"],
                summary: "List the current user's categories",
                security: secured,
                parameters: [{
                    name: "type",
                    in: "query",
                    schema: { type: "string", enum: ["expense", "income"] },
                }],
                responses: { "200": { description: "Category array" }, "401": { description: "Missing or invalid token" } },
            },
            post: {
                tags: ["Categories"],
                summary: "Create a category",
                security: secured,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["name", "type"],
                                properties: {
                                    name: { type: "string", maxLength: 100 },
                                    type: { type: "string", enum: ["expense", "income", "EXPENSE", "INCOME"] },
                                    icon: { type: "string", maxLength: 32, default: "tag" },
                                    color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", default: "#808080" },
                                },
                            },
                        },
                    },
                },
                responses: { "201": { description: "Created category" }, "409": { description: "Duplicate category name" } },
            },
        },
        "/api/categories/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            patch: {
                tags: ["Categories"],
                summary: "Update a category",
                security: secured,
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", minProperties: 1, properties: {
                        name: { type: "string", maxLength: 100 },
                        type: { type: "string", enum: ["expense", "income", "EXPENSE", "INCOME"] },
                        icon: { type: "string", maxLength: 32 },
                        color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
                    } } } },
                },
                responses: { "200": { description: "Updated category" }, "404": { description: "Not found or not owned" }, "409": { description: "Category is referenced" } },
            },
            delete: {
                tags: ["Categories"],
                summary: "Delete an unreferenced category",
                security: secured,
                responses: { "200": { description: "Deleted category ID" }, "404": { description: "Not found or not owned" }, "409": { description: "Category is referenced" } },
            },
        },
        "/api/accounts": {
            get: {
                tags: ["Accounts"],
                summary: "List the current user's accounts",
                security: secured,
                responses: { "200": { description: "Account array" } },
            },
            post: {
                tags: ["Accounts"],
                summary: "Create an account",
                security: secured,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { type: "object", required: ["name"], properties: {
                                name: { type: "string", maxLength: 100 },
                                type: { type: "string", enum: ["BANK", "CASH", "CREDIT_CARD", "WALLET"] },
                            } },
                        },
                    },
                },
                responses: { "201": { description: "Created account" }, "409": { description: "Duplicate account name" } },
            },
        },
        "/api/accounts/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            patch: {
                tags: ["Accounts"],
                summary: "Rename or update account type",
                security: secured,
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["name"], properties: {
                        name: { type: "string", maxLength: 100 },
                        type: { type: "string", enum: ["BANK", "CASH", "CREDIT_CARD", "WALLET"] },
                    } } } },
                },
                responses: { "200": { description: "Updated account" }, "404": { description: "Not found or not owned" } },
            },
            delete: {
                tags: ["Accounts"],
                summary: "Delete an unreferenced account",
                security: secured,
                responses: { "200": { description: "Deleted account ID" }, "404": { description: "Not found or not owned" }, "409": { description: "Account is referenced" } },
            },
        },
        "/api/expenses": {
            get: {
                tags: ["Expenses"],
                summary: "List expenses",
                security: secured,
                parameters: [
                    ...transactionQueryParameters,
                ],
                responses: { "200": { description: "Paginated expense list" } },
            },
            post: {
                tags: ["Expenses"],
                summary: "Create an expense",
                security: secured,
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionInput" } } },
                },
                responses: { "201": { description: "Created expense" }, "422": { description: "Invalid amount, date, or references" } },
            },
        },
        "/api/summaries/monthly": {
            post: {
                tags: ["AI Summaries"],
                summary: "Summarize monthly income and expenses",
                description:
                    "Uses all authenticated-user transactions in the selected calendar month. Server-calculated INR totals are authoritative; Groq supplies summary text, highlights, and saving suggestions from aggregates only. Does not modify records. Empty months return source 'none' without calling AI. The current month defaults using the user's timezone; transaction boundaries follow stored calendar dates.",
                security: secured,
                requestBody: {
                    required: false,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/MonthlySummaryRequest" },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Monthly totals, top categories, and insights (or explicit no-activity result)",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["success", "data"],
                                    properties: {
                                        success: { type: "boolean", example: true },
                                        data: { $ref: "#/components/schemas/MonthlySummaryResult" },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Missing or invalid session" },
                    "422": { description: "Invalid month or unknown request fields" },
                    "429": { description: "Per-user summary limit or provider quota reached" },
                    "502": { description: "Invalid AI response or rejected provider request" },
                    "503": { description: "AI is not configured, timed out, or unavailable" },
                },
            },
        },
        "/api/expenses/parse": {
            post: {
                tags: ["AI Parsing"],
                summary: "Parse one expense into a reviewable draft",
                description:
                    "Sends expense text to the configured Groq model. Infers categories from meaning (for example, dinner implies Food or Food & Dining) and prefers the best matching supplied expense category. The backend resolves predicted names only to the user's owned records; unmatched labels remain reviewable with null IDs. Ambiguous categories are left unset. It does not create or modify financial records. Uses the user's timezone. Unsupported currency or conversion requests are rejected.",
                security: secured,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ExpenseParseRequest" },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Reviewable draft with clarification prompts",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean", example: true },
                                        data: { $ref: "#/components/schemas/ExpenseParseResult" },
                                    },
                                },
                            },
                        },
                    },
                    "401": { description: "Missing or invalid session" },
                    "422": { description: "Invalid expense query, unsupported currency, or multiple expenses" },
                    "429": { description: "Per-user parser limit or provider quota reached" },
                    "502": { description: "Invalid AI response or rejected provider request" },
                    "503": { description: "Parser is not configured, timed out, unavailable, model not found, or API key rejected" },
                },
            },
        },
        "/api/expenses/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            get: securedGet("Expenses", "Get an expense"),
            patch: transactionPatch("Expenses", "Update an expense"),
            delete: securedDelete("Expenses", "Delete an expense"),
        },
        "/api/incomes": {
            get: {
                tags: ["Income"],
                summary: "List income records",
                security: secured,
                parameters: transactionQueryParameters,
                responses: { "200": { description: "Paginated income list" } },
            },
            post: {
                tags: ["Income"],
                summary: "Create an income record",
                security: secured,
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/TransactionInput" } } },
                },
                responses: { "201": { description: "Created income record" }, "422": { description: "Invalid amount, date, or references" } },
            },
        },
        "/api/incomes/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            get: securedGet("Income", "Get an income record"),
            patch: transactionPatch("Income", "Update an income record"),
            delete: securedDelete("Income", "Delete an income record"),
        },
        "/api/budgets": {
            get: {
                tags: ["Budgets"],
                summary: "List budgets with spending totals",
                security: secured,
                parameters: [
                    { name: "month", in: "query", schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" } },
                    { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
                    { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
                ],
                responses: { "200": { description: "Paginated budgets; each has amount, spent, remaining, and percent" } },
            },
            post: {
                tags: ["Budgets"],
                summary: "Create a monthly category budget",
                security: secured,
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", required: ["categoryId", "month", "amount"], properties: {
                        categoryId: { type: "string" },
                        month: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
                        amount: { type: "number", exclusiveMinimum: 0, multipleOf: 0.01 },
                    } } } },
                },
                responses: { "201": { description: "Created budget" }, "409": { description: "Budget already exists for category and month" }, "422": { description: "Category must be an owned expense category" } },
            },
        },
        "/api/budgets/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            patch: {
                tags: ["Budgets"],
                summary: "Update a budget",
                security: secured,
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", minProperties: 1, properties: {
                        categoryId: { type: "string" },
                        month: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
                        amount: { type: "number", exclusiveMinimum: 0, multipleOf: 0.01 },
                    } } } },
                },
                responses: { "200": { description: "Updated budget" }, "404": { description: "Budget not found" } },
            },
            delete: securedDelete("Budgets", "Delete a budget"),
        },
    },
};

function securedGet(tag: string, summary: string) {
    return {
        tags: [tag],
        summary,
        security: secured,
        responses: { "200": { description: "Transaction details" }, "404": { description: "Not found or not owned" } },
    };
}

function transactionPatch(tag: string, summary: string) {
    return {
        tags: [tag],
        summary,
        security: secured,
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        minProperties: 1,
                        properties: {
                            description: { type: "string", minLength: 1, maxLength: 200 },
                            amount: { type: "number", exclusiveMinimum: 0, multipleOf: 0.01 },
                            categoryId: { type: "string" },
                            accountId: { type: "string", nullable: true },
                            date: { type: "string", format: "date" },
                            notes: { type: "string", maxLength: 2000, nullable: true },
                        },
                    },
                },
            },
        },
        responses: {
            "200": { description: "Updated transaction" },
            "404": { description: "Not found or not owned" },
            "422": { description: "Invalid amount, date, or references" },
        },
    };
}

function securedDelete(tag: string, summary: string) {
    return {
        tags: [tag],
        summary,
        security: secured,
        responses: {
            "200": { description: "Deleted resource ID" },
            "404": { description: "Not found or not owned" },
            "409": { description: "Resource is referenced" },
        },
    };
}
