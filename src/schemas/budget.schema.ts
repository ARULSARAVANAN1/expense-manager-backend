import { z } from "zod";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const budgetFields = {
    categoryId: z.string().min(1),
    month: monthSchema,
    amount: z.number().finite().positive(),
};

export const createBudgetSchema = z.object(budgetFields).strict();
export const patchBudgetSchema = z.object({
    categoryId: budgetFields.categoryId.optional(),
    month: budgetFields.month.optional(),
    amount: budgetFields.amount.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
    message: "At least one budget field is required",
});

export const budgetListQuerySchema = z.object({
    month: monthSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
