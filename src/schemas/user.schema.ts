import { z } from "zod";

const currencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"] as const;

export const updateUserSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    preferredCurrency: z.enum(currencies).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field is required",
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
}).strict().refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must differ from the current password",
});
