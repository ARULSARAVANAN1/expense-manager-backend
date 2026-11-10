import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { once } from "node:events";
import app from "../src/app.js";
import { AccountModel } from "../src/model/Account.js";
import { CategoryModel } from "../src/model/Category.js";
import { TransactionModel } from "../src/model/Transaction.js";
import { UserModel } from "../src/model/User.js";
import { monthlySummarySchema } from "../src/schemas/monthly-summary.schema.js";
import { parseExpenseText } from "../src/services/expense-parse.service.js";
import { generateMonthlySummary } from "../src/services/monthly-summary.service.js";
import { generateToken } from "../src/utils/jwt.js";
import { openApiSpec } from "../src/docs/openapi.js";

const userId = "507f1f77bcf86cd799439011";
const categoryId = "507f1f77bcf86cd799439012";
const insights = {
    summary: "Recorded income exceeded expenses.",
    highlights: ["Most spending was on food."],
    savingSuggestions: ["Review food spending."],
    insights: [
        { type: "trend", title: "Food spending", message: "Food is the largest spending category." },
        { type: "saving", title: "Potential savings", message: "Review food spending for opportunities to reduce costs." },
        { type: "progress", title: "Recorded savings", message: "Review recorded net savings." },
    ],
};
const originalEnvironment = { ...process.env };
const realFetch = globalThis.fetch;
let records: object[];
let previousRecords: object[];
let filters: Record<string, unknown>[];
let providerRequests: object[];
let closed: boolean;

function providerResponse(value: unknown = insights) {
    return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(value) } }],
    }));
}

beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key-not-a-real-credential";
    process.env.JWT_SECRET = "test-session-secret";
    process.env.AI_PROVIDER = "groq";
    process.env.AI_SUMMARY_REQUESTS_PER_HOUR = "1000";
    process.env.AI_PARSE_REQUESTS_PER_HOUR = "1000";
    delete process.env.AI_TIMEOUT_MS;
    records = [];
    previousRecords = [];
    filters = [];
    providerRequests = [];
    closed = false;
    mock.method(UserModel, "findById", () => ({
        select: () => ({ lean: async () => ({ timezone: "Asia/Kolkata", sessionVersion: 0 }) }),
    }));
    mock.method(TransactionModel, "find", (filter: Record<string, unknown>) => {
        const selectedRecords = filters.length % 2 === 0 ? records : previousRecords;
        filters.push(filter);
        return {
            select: () => ({
                lean: () => ({
                    cursor: () => ({
                        async *[Symbol.asyncIterator]() { yield* selectedRecords; },
                        close: async () => { closed = true; },
                    }),
                }),
            }),
        };
    });
    mock.method(CategoryModel, "find", () => ({
        select: () => ({
            lean: async () => [{ _id: categoryId, name: "Food" }],
            sort: () => ({
                limit: () => ({ lean: async () => [{ _id: categoryId, name: "Food" }] }),
            }),
        }),
    }));
    mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
        providerRequests.push(JSON.parse(String(init.body)));
        return providerResponse();
    });
});

afterEach(() => {
    mock.restoreAll();
    for (const key of Object.keys(process.env)) {
        if (!(key in originalEnvironment)) delete process.env[key];
    }
    Object.assign(process.env, originalEnvironment);
});

function transaction(type: "INCOME" | "EXPENSE", amount: number, amountPaise?: number) {
    return { type, amount, amountPaise, categoryId };
}

test("validates month format, year, and unknown fields", () => {
    for (const month of ["2026-00", "2026-13", "26-11", "0000-01", "2026-1", "2026-11-01"]) {
        assert.equal(monthlySummarySchema.safeParse({ month }).success, false);
    }
    assert.equal(monthlySummarySchema.safeParse({ month: "2024-02" }).success, true);
    assert.equal(monthlySummarySchema.safeParse({}).success, true);
    assert.equal(monthlySummarySchema.safeParse({ userId }).success, false);
});

test("calculates exact totals for all records including legacy amounts", async () => {
    records = [
        transaction("INCOME", 100, 10000),
        transaction("EXPENSE", 0.1, 10),
        transaction("EXPENSE", 0.2),
        ...Array.from({ length: 110 }, () => transaction("EXPENSE", 0.01, 1)),
    ];
    const result = await generateMonthlySummary(userId, "2024-02");
    assert.deepEqual(result.totals, {
        income: 100, expense: 1.4, netSavings: 98.6, savingsRate: 98.6,
        incomeCount: 1, expenseCount: 112,
    });
    assert.equal(result.source, "ai");
    assert.deepEqual(result.highlights, insights.highlights);
    assert.equal(filters[0].userId, userId);
    assert.deepEqual(filters[0].transactionDate, {
        $gte: new Date("2024-02-01T00:00:00Z"),
        $lt: new Date("2024-03-01T00:00:00Z"),
    });
    assert.equal(closed, true);
    const sent = JSON.stringify(providerRequests);
    assert.equal(sent.includes(userId), false);
    assert.equal(sent.includes(categoryId), false);
    assert.equal(sent.includes("description"), false);
});

test("handles December rollover and expenses without income", async () => {
    records = [transaction("EXPENSE", 20, 2000)];
    const result = await generateMonthlySummary(userId, "2026-12");
    assert.equal(result.totals.netSavings, -20);
    assert.equal(result.totals.savingsRate, null);
    assert.deepEqual(filters[0].transactionDate, {
        $gte: new Date("2026-12-01T00:00:00Z"),
        $lt: new Date("2027-01-01T00:00:00Z"),
    });
});

test("returns explicit no-activity result without requiring AI configuration", async () => {
    delete process.env.GROQ_API_KEY;
    const result = await generateMonthlySummary(userId, "2026-11");
    assert.equal(result.source, "none");
    assert.equal(result.totals.income, 0);
    assert.equal(result.totals.expense, 0);
    assert.deepEqual(result.highlights, []);
    assert.deepEqual(result.savingSuggestions, []);
    assert.equal(providerRequests.length, 0);
});

test("defaults month using the user timezone", async () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-31T20:00:00Z") });
    const result = await generateMonthlySummary(userId);
    assert.equal(result.month, "2026-11");
    assert.equal(result.card.greeting, "Good morning!");
    assert.deepEqual(result.card.insights, []);
});

test("card has three typed insights and exact previous-month comparisons", async () => {
    records = [transaction("INCOME", 200, 20000), transaction("EXPENSE", 122, 12200)];
    previousRecords = [transaction("INCOME", 150, 15000), transaction("EXPENSE", 100, 10000)];
    const result = await generateMonthlySummary(userId, "2026-01");
    assert.equal(result.comparison.previousMonth, "2025-12");
    assert.equal(result.comparison.expenseChangePercent, 22);
    assert.equal(result.comparison.netSavingsChange, 28);
    assert.equal(result.comparison.expenseCategories[0].changePercent, 22);
    assert.deepEqual(result.card.insights, insights.insights);
    assert.match(result.card.introduction, /January 2026/);
    assert.deepEqual(filters[1], {
        userId,
        type: { $in: ["INCOME", "EXPENSE"] },
        transactionDate: {
            $gte: new Date("2025-12-01T00:00:00Z"),
            $lt: new Date("2026-01-01T00:00:00Z"),
        },
    });
});

test("missing or zero previous spending does not produce invented percentages", async () => {
    records = [transaction("EXPENSE", 10, 1000)];
    let result = await generateMonthlySummary(userId, "2026-11");
    assert.equal(result.comparison.previousTotals, null);
    assert.equal(result.comparison.expenseChangePercent, null);
    assert.equal(result.comparison.expenseCategories[0].changePercent, null);
    previousRecords = [transaction("INCOME", 100, 10000)];
    result = await generateMonthlySummary(userId, "2026-11");
    assert.equal(result.comparison.hasPreviousRecords, true);
    assert.equal(result.comparison.expenseChangePercent, null);
    assert.equal(result.comparison.netSavingsChange, -110);
});

test("rejects missing, extra, or incorrectly typed card insights", async () => {
    records = [transaction("INCOME", 100, 10000)];
    for (const invalid of [
        [],
        insights.insights.slice(0, 2),
        [...insights.insights, insights.insights[0]],
        insights.insights.map((item) => ({ ...item, type: "unknown" })),
    ]) {
        mock.method(globalThis, "fetch", async () => providerResponse({ ...insights, insights: invalid }));
        await assert.rejects(generateMonthlySummary(userId, "2026-11"), { code: "AI_PROVIDER_INVALID_OUTPUT" });
    }
});

test("summary OpenAPI references resolve to registered component schemas", () => {
    assert.ok(openApiSpec.components.schemas.MonthlySummaryRequest);
    assert.ok(openApiSpec.components.schemas.MonthlySummaryResult);
    assert.ok(openApiSpec.components.schemas.MonthlySummaryCategory);
});

test("top categories are bounded but totals include all categories", async () => {
    records = Array.from({ length: 8 }, (_, index) => ({
        type: "EXPENSE", amount: index + 1,
        amountPaise: (index + 1) * 100,
        categoryId: `507f1f77bcf86cd7994390${20 + index}`,
    }));
    const result = await generateMonthlySummary(userId, "2026-11");
    assert.equal(result.totals.expense, 36);
    assert.equal(result.topExpenseCategories.length, 5);
    assert.deepEqual(result.topExpenseCategories.map((item) => item.amount), [8, 7, 6, 5, 4]);
});

test("rejects unsafe sum instead of returning rounded totals and closes cursor", async () => {
    records = [
        transaction("INCOME", 1, Number.MAX_SAFE_INTEGER),
        transaction("INCOME", 1, 1),
    ];
    await assert.rejects(generateMonthlySummary(userId, "2026-11"), { code: "INVALID_STORED_AMOUNT" });
    assert.equal(closed, true);
    assert.equal(providerRequests.length, 0);
});

test("rate limit and missing configuration are explicit", async () => {
    process.env.AI_SUMMARY_REQUESTS_PER_HOUR = "1";
    await generateMonthlySummary("rate-limited-user", "2026-11");
    await assert.rejects(generateMonthlySummary("rate-limited-user", "2026-11"), { code: "AI_RATE_LIMITED" });
    process.env.AI_SUMMARY_REQUESTS_PER_HOUR = "1000";
    records = [transaction("INCOME", 1, 100)];
    delete process.env.GROQ_API_KEY;
    await assert.rejects(generateMonthlySummary(userId, "2026-11"), { code: "AI_SUMMARY_NOT_CONFIGURED" });
});

test("propagates provider status and malformed output errors", async () => {
    records = [transaction("INCOME", 1, 100)];
    for (const [status, code] of [
        [401, "AI_PROVIDER_AUTH_FAILED"], [404, "AI_MODEL_UNAVAILABLE"],
        [429, "AI_PROVIDER_RATE_LIMITED"], [500, "AI_PROVIDER_UNAVAILABLE"],
    ] as const) {
        mock.method(globalThis, "fetch", async () => new Response("", { status }));
        await assert.rejects(generateMonthlySummary(userId, "2026-11"), { code });
    }
    mock.method(globalThis, "fetch", async () => providerResponse({ summary: "Only summary" }));
    await assert.rejects(generateMonthlySummary(userId, "2026-11"), { code: "AI_PROVIDER_INVALID_OUTPUT" });
    mock.method(globalThis, "fetch", async () => new Response("not JSON"));
    await assert.rejects(generateMonthlySummary(userId, "2026-11"), { code: "AI_PROVIDER_INVALID_RESPONSE" });
    mock.method(globalThis, "fetch", async () => new Response("x".repeat(65537)));
    await assert.rejects(generateMonthlySummary(userId, "2026-11"), { code: "AI_PROVIDER_INVALID_RESPONSE" });
});

test("expense parser still resolves a valid draft using the shared provider", async () => {
    mock.method(AccountModel, "find", () => ({
        select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
    }));
    mock.method(globalThis, "fetch", async () => providerResponse({
        isExpense: true, isSingleExpense: true,
        description: "Lunch", amount: 250, date: "2026-11-10",
        categoryName: "Food", accountName: null, notes: null,
    }));
    const result = await parseExpenseText(userId, "Spent 250 on lunch on 2026-11-10");
    assert.equal(result.draft.categoryId, categoryId);
    assert.equal(result.draft.amount, 250);
    assert.equal(result.source, "ai");
    assert.deepEqual(result.needsClarification, []);
});

test("dinner category selection uses supplied owned expense names and canonicalizes the match", async () => {
    mock.method(AccountModel, "find", () => ({
        select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
    }));
    mock.method(CategoryModel, "find", (filter: Record<string, unknown>) => {
        assert.deepEqual(filter, { userId, type: "EXPENSE" });
        return {
            select: () => ({ sort: () => ({ limit: () => ({
                lean: async () => [
                    { _id: categoryId, name: "Food & Dining" },
                    { _id: "507f1f77bcf86cd799439013", name: "Transport" },
                ],
            }) }) }),
        };
    });
    mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
        const request = JSON.parse(String(init.body));
        const data = JSON.parse(request.messages[1].content);
        assert.equal(data.expenseText, "500 for dinner");
        assert.deepEqual(data.allowedExpenseCategories, ["Food & Dining", "Transport"]);
        assert.match(request.messages[0].content, /single best semantic match/);
        assert.match(request.messages[0].content, /500 for dinner/);
        assert.equal(JSON.stringify(request).includes(categoryId), false);
        return providerResponse({
            isExpense: true, isSingleExpense: true,
            description: "Dinner", amount: 500, date: null,
            categoryName: " food & dining ", accountName: null, notes: null,
        });
    });
    const result = await parseExpenseText(userId, "500 for dinner");
    assert.equal(result.draft.categoryId, categoryId);
    assert.equal(result.draft.categoryName, "Food & Dining");
    assert.equal(result.draft.amount, 500);
});

test("unmatched and ambiguous category predictions do not acquire an owned category ID", async () => {
    mock.method(AccountModel, "find", () => ({
        select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
    }));
    for (const [text, categoryName] of [
        ["500 for medicine", "Healthcare"],
        ["spent 500", null],
    ] as const) {
        mock.method(globalThis, "fetch", async () => providerResponse({
            isExpense: true, isSingleExpense: true,
            description: text, amount: 500, date: null,
            categoryName, accountName: null, notes: null,
        }));
        const result = await parseExpenseText(userId, text);
        assert.equal(result.draft.categoryName, categoryName);
        assert.equal(result.draft.categoryId, null);
    }
});

test("HTTP endpoint requires auth, validates input, and accepts an omitted body", async () => {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/summaries/monthly`;
    mock.method(globalThis, "fetch", realFetch);
    try {
        const unauthorized = await fetch(url, { method: "POST" });
        assert.equal(unauthorized.status, 401);
        const headers = {
            Authorization: `Bearer ${generateToken(userId)}`,
            "Content-Type": "application/json",
        };
        const invalid = await fetch(url, { method: "POST", headers, body: '{"month":"2026-13"}' });
        assert.equal(invalid.status, 422);
        const response = await fetch(url, { method: "POST", headers });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.success, true);
        assert.equal(body.data.source, "none");
    } finally {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
});
