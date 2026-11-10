import assert from "node:assert/strict";
import { once } from "node:events";
import { Server } from "node:http";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import sharp from "sharp";
import app from "../src/app.js";
import { AccountModel } from "../src/model/Account.js";
import { CategoryModel } from "../src/model/Category.js";
import { TransactionModel } from "../src/model/Transaction.js";
import { UserModel } from "../src/model/User.js";
import { billImageDataUrl, MAX_BILL_IMAGE_BYTES } from "../src/utils/billImage.js";
import { generateToken } from "../src/utils/jwt.js";

const userId = "507f1f77bcf86cd799439011";
const categoryId = "507f1f77bcf86cd799439012";
const realFetch = globalThis.fetch;
const environment = { ...process.env };
let server: Server;
let endpoint: string;
let png: Buffer;
let providerCalls: number;
let output: Record<string, unknown>;

before(async () => {
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    endpoint = `http://127.0.0.1:${address.port}/api/expenses/parse`;
    png = await sharp({
        create: { width: 20, height: 20, channels: 3, background: "#ffffff" },
    }).png().toBuffer();
});

after(async () => {
    await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
});

beforeEach(() => {
    process.env.JWT_SECRET = "test-session-secret";
    process.env.GROQ_API_KEY = "test-key-not-a-real-credential";
    process.env.AI_PROVIDER = "groq";
    process.env.AI_MODEL = "text-only-test-model";
    process.env.AI_VISION_MODEL = "vision-test-model";
    process.env.AI_PARSE_REQUESTS_PER_HOUR = "1000";
    delete process.env.AI_TIMEOUT_MS;
    providerCalls = 0;
    output = {
        isExpense: true, isSingleExpense: true, description: "Restaurant dinner",
        amount: 525.5, date: "2026-11-10", categoryName: "Food",
        accountName: null, notes: null, currency: "INR",
    };
    mock.method(UserModel, "findById", () => ({
        select: () => ({ lean: async () => ({ timezone: "Asia/Kolkata", sessionVersion: 0 }) }),
    }));
    mock.method(CategoryModel, "find", (filter: Record<string, unknown>) => {
        assert.deepEqual(filter, { userId, type: "EXPENSE" });
        return {
            select: () => ({ sort: () => ({ limit: () => ({
                lean: async () => [{ _id: categoryId, name: "Food" }],
            }) }) }),
        };
    });
    mock.method(AccountModel, "find", () => ({
        select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }),
    }));
    mock.method(TransactionModel, "create", () => {
        assert.fail("Image parsing must never create a transaction");
    });
    mock.method(CategoryModel, "create", () => {
        assert.fail("Image parsing must never create a category");
    });
    mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url) !== "https://api.groq.com/openai/v1/chat/completions") {
            return realFetch(url, init);
        }
        providerCalls += 1;
        const request = JSON.parse(String(init?.body));
        assert.equal(request.model, "vision-test-model");
        const parts = request.messages[1].content;
        assert.equal(parts.length, 2);
        assert.equal(parts[0].type, "text");
        assert.deepEqual(JSON.parse(parts[0].text).allowedExpenseCategories, ["Food"]);
        assert.equal(parts[1].type, "image_url");
        assert.match(parts[1].image_url.url, /^data:image\/jpeg;base64,/);
        assert.equal(JSON.stringify(request).includes(categoryId), false);
        assert.match(request.messages[0].content, /final payable grand total/);
        assert.match(request.messages[0].content, /Multiple line items on the SAME bill are one expense/);
        assert.match(request.messages[0].content, /untrusted data/);
        return new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify(output) } }],
        }));
    });
});

afterEach(() => {
    mock.restoreAll();
    for (const key of Object.keys(process.env)) {
        if (!(key in environment)) delete process.env[key];
    }
    Object.assign(process.env, environment);
});

function formForImage(bytes: Uint8Array = new Uint8Array(png), type = "image/png") {
    const form = new FormData();
    form.append("image", new Blob([bytes], { type }), "receipt.png");
    return form;
}

async function post(form: FormData) {
    return fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${generateToken(userId)}` },
        body: form,
    });
}

test("one bill image returns one reviewable draft with total and owned category", async () => {
    const response = await post(formForImage());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.draft.amount, 525.5);
    assert.equal(body.data.draft.categoryId, categoryId);
    assert.equal(body.data.draft.date, "2026-11-10");
    assert.deepEqual(body.data.needsClarification, []);
    assert.equal(providerCalls, 1);
});

test("JPEG, PNG, and WebP are decoded and normalized", async () => {
    for (const [type, bytes] of [
        ["image/jpeg", await sharp(png).jpeg().toBuffer()],
        ["image/png", png],
        ["image/webp", await sharp(png).webp().toBuffer()],
    ] as const) {
        const response = await post(formForImage(new Uint8Array(bytes), type));
        assert.equal(response.status, 200);
    }
    assert.equal(providerCalls, 3);
});

test("missing bill date or unclear total stays null with clarification", async () => {
    output.date = null;
    output.amount = null;
    const response = await post(formForImage());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.draft.date, null);
    assert.equal(body.data.draft.amount, null);
    assert.deepEqual(body.data.needsClarification.map((item: { field: string }) => item.field), ["amount", "date"]);
});

test("multiple bills, non-bills, foreign currency, and unclear currency are explicit errors", async () => {
    const valid = { ...output };
    for (const [changes, code] of [
        [{ isSingleExpense: false }, "MULTIPLE_EXPENSES_NOT_SUPPORTED"],
        [{ isExpense: false, currency: "UNKNOWN" }, "INVALID_EXPENSE_QUERY"],
        [{ currency: "NON_INR" }, "UNSUPPORTED_CURRENCY"],
        [{ currency: "UNKNOWN" }, "BILL_CURRENCY_UNCLEAR"],
    ] as const) {
        output = { ...valid, ...changes };
        const response = await post(formForImage());
        assert.equal(response.status, 422);
        assert.equal((await response.json()).code, code);
    }
});

test("rejects two files, wrong file field, and mixed text/image input before AI", async () => {
    const twoFiles = formForImage();
    twoFiles.append("image", new Blob([new Uint8Array(png)], { type: "image/png" }), "second.png");
    const wrongField = new FormData();
    wrongField.append("bill", new Blob([new Uint8Array(png)], { type: "image/png" }), "receipt.png");
    const mixed = formForImage();
    mixed.append("text", "500 for dinner");
    for (const form of [twoFiles, wrongField, mixed]) {
        const response = await post(form);
        assert.equal(response.status, 422);
        assert.equal((await response.json()).code, "INVALID_BILL_UPLOAD");
    }
    const missing = await post(new FormData());
    assert.equal(missing.status, 422);
    assert.equal((await missing.json()).code, "BILL_IMAGE_REQUIRED");
    assert.equal(providerCalls, 0);
});

test("rejects oversized, corrupt, unsupported, or mislabeled image uploads", async () => {
    for (const [form, status, code] of [
        [formForImage(new Uint8Array(MAX_BILL_IMAGE_BYTES + 1)), 413, "BILL_IMAGE_TOO_LARGE"],
        [formForImage(new Uint8Array([1, 2, 3])), 422, "INVALID_BILL_IMAGE"],
        [formForImage(new Uint8Array(png), "image/jpeg"), 422, "INVALID_BILL_IMAGE"],
        [formForImage(new Uint8Array(png), "application/pdf"), 422, "UNSUPPORTED_BILL_IMAGE"],
    ] as const) {
        const response = await post(form);
        assert.equal(response.status, status);
        assert.equal((await response.json()).code, code);
    }
    assert.equal(providerCalls, 0);
});

test("limits decoded pixels, including compact highly compressed images", async () => {
    const large = await sharp({
        create: { width: 4001, height: 4000, channels: 3, background: "#ffffff" },
    }).png().toBuffer();
    await assert.rejects(billImageDataUrl(large, "image/png"), { code: "INVALID_BILL_IMAGE" });
});

test("requires authentication and explicit vision configuration", async () => {
    const unauthorized = await fetch(endpoint, { method: "POST", body: formForImage() });
    assert.equal(unauthorized.status, 401);
    delete process.env.AI_VISION_MODEL;
    const unconfigured = await post(formForImage());
    assert.equal(unconfigured.status, 503);
    assert.equal((await unconfigured.json()).code, "AI_VISION_NOT_CONFIGURED");
    assert.equal(providerCalls, 0);
});

test("image provider failures never return a success-shaped draft", async () => {
    mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url) !== "https://api.groq.com/openai/v1/chat/completions") return realFetch(url, init);
        return new Response("", { status: 429 });
    });
    const response = await post(formForImage());
    assert.equal(response.status, 429);
    assert.equal((await response.json()).code, "AI_PROVIDER_RATE_LIMITED");
});
