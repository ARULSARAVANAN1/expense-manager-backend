import { z } from "zod";

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.valueOf()) &&
            date.toISOString().slice(0, 10) === value;
    },
    "Enter a valid calendar date"
);

const transactionFields = {
    description: z.string().trim().min(1).max(200),
    amount: z.number().finite().positive(),
    categoryId: z.string().min(1),
    accountId: z.string().min(1).nullable().optional(),
    date: calendarDate,
    notes: z.string().trim().max(2000).nullable().optional(),
};

export const createTransactionSchema = z.object(transactionFields).strict();

export const patchTransactionSchema = z.object({
    description: transactionFields.description.optional(),
    amount: transactionFields.amount.optional(),
    categoryId: transactionFields.categoryId.optional(),
    accountId: transactionFields.accountId,
    date: transactionFields.date.optional(),
    notes: transactionFields.notes,
}).strict().refine((value) => Object.keys(value).length > 0, {
    message: "At least one transaction field is required",
});

export const transactionListQuerySchema = z.object({
    search: z.string().trim().max(200).optional(),
    categoryId: z.string().optional(),
    accountId: z.string().optional(),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    sort: z.enum(["newest", "oldest", "highest", "lowest"]).default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(
    (query) => !query.from || !query.to || query.from <= query.to,
    { message: "'from' must not be after 'to'" }
);
