import { z } from "zod";
import { FINANCIAL_GOAL_CATEGORIES } from "../model/FinancialGoal.js";

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.valueOf()) &&
            date.toISOString().slice(0, 10) === value;
    },
    "Enter a valid calendar date"
);

const futureCalendarDate = calendarDate.refine(
    (value) => value > new Date().toISOString().slice(0, 10),
    "Target date must be in the future"
);

const goalFields = {
    name: z.string().trim().min(1).max(100),
    category: z.enum(FINANCIAL_GOAL_CATEGORIES),
    targetAmount: z.number().finite().positive(),
    targetDate: futureCalendarDate,
    monthlyContribution: z.number().finite().positive().optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
};

export const createFinancialGoalSchema = z.object({
    ...goalFields,
    initialSavedAmount: z.number().finite().nonnegative().optional(),
}).strict();

export const patchFinancialGoalSchema = z.object({
    name: goalFields.name.optional(),
    category: goalFields.category.optional(),
    targetAmount: goalFields.targetAmount.optional(),
    targetDate: futureCalendarDate.optional(),
    monthlyContribution: goalFields.monthlyContribution,
    priority: goalFields.priority.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
    message: "At least one goal field is required",
});

export const updateFinancialGoalStatusSchema = z.object({
    status: z.enum(["ACTIVE", "PAUSED"]),
}).strict();

export const financialGoalListQuerySchema = z.object({
    status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).optional(),
    category: z.enum(FINANCIAL_GOAL_CATEGORIES).optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["createdAt", "targetDate", "targetAmount", "name"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export const goalPlanPreviewSchema = z.object({
    targetAmount: z.number().finite().positive(),
    currentSavedAmount: z.number().finite().nonnegative(),
    targetDate: calendarDate,
    monthlyContribution: z.number().finite().nonnegative().optional(),
}).strict();
