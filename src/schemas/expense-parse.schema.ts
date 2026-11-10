import { z } from "zod";

export const expenseParseSchema = z.object({
    text: z.string().trim().min(1).max(1000),
}).strict();

export const aiExpenseDraftSchema = z.object({
    isExpense: z.boolean(),
    isSingleExpense: z.boolean(),
    description: z.string().nullable(),
    amount: z.number().finite().nullable(),
    date: z.string().nullable(),
    categoryName: z.string().nullable(),
    accountName: z.string().nullable(),
    notes: z.string().nullable(),
}).strict();
