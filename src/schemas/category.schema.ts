import { z } from "zod";

const categoryTypeSchema = z
    .enum(["expense", "income", "EXPENSE", "INCOME"])
    .transform((type) => type.toUpperCase() as "EXPENSE" | "INCOME");

export const createCategorySchema = z.object({
    name: z.string().trim().min(1).max(100),
    type: categoryTypeSchema,
    icon: z.string().trim().min(1).max(32).default("tag"),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#808080"),
}).strict();

export const patchCategorySchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    type: categoryTypeSchema.optional(),
    icon: z.string().trim().min(1).max(32).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
    message: "At least one category field is required",
});
