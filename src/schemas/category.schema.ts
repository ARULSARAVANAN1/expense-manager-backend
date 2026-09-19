import { z } from "zod";

export const createCategorySchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Category name is required"),

    type: z.enum(["INCOME", "EXPENSE"]),

    userId: z
        .string()
        .min(1, "User ID is required"),
});