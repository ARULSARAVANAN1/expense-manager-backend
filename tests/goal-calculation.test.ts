import assert from "node:assert/strict";
import { test } from "node:test";
import {
    calculateEstimatedCompletionDate,
    calculateGoalProgress,
    calculateGoalStatus,
    calculateMonthsRemaining,
    calculateRemainingAmount,
    calculateRequiredMonthlySavings,
    calculateSavingsPlan,
} from "../src/services/goal-calculation.service.js";

const today = new Date("2026-11-10T12:00:00.000Z");

test("calculates remaining months by inclusive calendar saving periods", () => {
    assert.equal(calculateMonthsRemaining("2027-06-30T00:00:00.000Z", today), 8);
    assert.equal(calculateMonthsRemaining("2026-11-30T00:00:00.000Z", today), 1);
    assert.equal(calculateMonthsRemaining("2026-10-31T00:00:00.000Z", today), 0);
    assert.equal(calculateMonthsRemaining("not-a-date", today), 0);
});

test("calculates progress and rounds required monthly savings upward", () => {
    assert.equal(calculateGoalProgress(80_000, 20_000), 25);
    assert.equal(calculateGoalProgress(80_000, 90_000), 100);
    assert.equal(calculateRemainingAmount(80_000, 90_000), 0);
    assert.equal(calculateRequiredMonthlySavings(60_001, 8), 7_501);
});

test("handles completed and impossible plans deterministically", () => {
    assert.deepEqual(calculateSavingsPlan({
        targetAmount: 80_000,
        currentSavedAmount: 80_000,
        targetDate: "2026-10-01",
        now: today,
    }), {
        targetAmount: 80_000,
        currentSavedAmount: 80_000,
        remainingAmount: 0,
        monthsRemaining: 0,
        requiredMonthlyContribution: 0,
        currentMonthlyContribution: 0,
        isMonthlyContributionSufficient: true,
    });
    assert.equal(calculateRequiredMonthlySavings(100, 0), null);
    assert.equal(calculateSavingsPlan({
        targetAmount: 100,
        currentSavedAmount: 0,
        targetDate: "2026-10-01",
        now: today,
    }).isMonthlyContributionSufficient, false);
});

test("classifies paused, completed, behind, on-track, and at-risk goals", () => {
    const base = {
        targetAmount: 80_000,
        currentSavedAmount: 20_000,
        targetDate: "2027-06-30",
        now: today,
    };
    assert.equal(calculateGoalStatus({ ...base, status: "PAUSED" }), "PAUSED");
    assert.equal(calculateGoalStatus({ ...base, currentSavedAmount: 80_000 }), "COMPLETED");
    assert.equal(calculateGoalStatus({ ...base, targetDate: "2026-10-01" }), "BEHIND");
    assert.equal(calculateGoalStatus({ ...base, monthlyContribution: 7_500 }), "ON_TRACK");
    assert.equal(calculateGoalStatus({ ...base, monthlyContribution: 5_000 }), "AT_RISK");
});

test("estimates completion only when a positive contribution is available", () => {
    assert.equal(calculateEstimatedCompletionDate(80_000, 20_000, undefined, today), null);
    assert.deepEqual(
        calculateEstimatedCompletionDate(80_000, 20_000, 20_000, today),
        new Date("2027-01-31T00:00:00.000Z")
    );
});
