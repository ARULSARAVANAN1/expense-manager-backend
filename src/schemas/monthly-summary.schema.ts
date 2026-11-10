import { z } from "zod";

export const monthlySummarySchema = z.object({
    month: z.string().regex(
        /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/,
        "Enter a valid month as YYYY-MM"
    ).optional(),
}).strict();

const insightText = {
    title: z.string().trim().min(1).max(100),
    message: z.string().trim().min(1).max(500),
};

export const monthlyInsightsSchema = z.tuple([
    z.object({ type: z.literal("trend"), ...insightText }).strict(),
    z.object({ type: z.literal("saving"), ...insightText }).strict(),
    z.object({ type: z.literal("progress"), ...insightText }).strict(),
]);

export const aiMonthlySummarySchema = z.object({
    summary: z.string().trim().min(1).max(2000),
    highlights: z.array(z.string().trim().min(1).max(500)).max(5),
    savingSuggestions: z.array(z.string().trim().min(1).max(500)).max(5),
    insights: monthlyInsightsSchema,
}).strict();
