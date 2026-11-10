import assert from "node:assert/strict";
import { once } from "node:events";
import { Server } from "node:http";
import { test } from "node:test";
import app from "../src/app.js";
import {
    createFinancialGoalSchema,
    goalPlanPreviewSchema,
} from "../src/schemas/financial-goal.schema.js";
import { createGoalContributionSchema } from "../src/schemas/goal-contribution.schema.js";

test("goal and contribution schemas reject client-supplied user IDs", () => {
    const goal = createFinancialGoalSchema.safeParse({
        name: "Emergency fund",
        category: "EMERGENCY_FUND",
        targetAmount: 100_000,
        targetDate: "2099-12-31",
        userId: "507f1f77bcf86cd799439011",
    });
    assert.equal(goal.success, false);

    const contribution = createGoalContributionSchema.safeParse({
        amount: 100,
        contributionDate: "2020-01-01",
        userId: "507f1f77bcf86cd799439011",
    });
    assert.equal(contribution.success, false);
});

test("savings plan preview accepts a zero monthly contribution", () => {
    const result = goalPlanPreviewSchema.safeParse({
        targetAmount: 100,
        currentSavedAmount: 0,
        targetDate: "2099-12-31",
        monthlyContribution: 0,
    });
    assert.equal(result.success, true);
});

test("all financial goal endpoints require authentication", async () => {
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api/goals`;

    try {
        const responses = await Promise.all([
            fetch(baseUrl),
            fetch(`${baseUrl}/plan-preview`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    targetAmount: 100,
                    currentSavedAmount: 0,
                    targetDate: "2099-12-31",
                }),
            }),
        ]);
        assert.deepEqual(responses.map((response) => response.status), [401, 401]);
        const unauthorized = await responses[0].json() as { success: boolean };
        assert.equal(unauthorized.success, false);
    } finally {
        await new Promise<void>((resolve, reject) => {
            (server as Server).close((error) => error ? reject(error) : resolve());
        });
    }
});
