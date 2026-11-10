import { z } from "zod";

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
    (value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(date.valueOf()) &&
            date.toISOString().slice(0, 10) === value;
    },
    "Enter a valid calendar date"
);

const nonFutureDate = calendarDate.refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    "Contribution date cannot be in the future"
);

const contributionFields = {
    amount: z.number().finite().positive(),
    contributionDate: nonFutureDate,
    description: z.string().trim().max(500).optional(),
};

export const createGoalContributionSchema = z.object(contributionFields).strict();

export const patchGoalContributionSchema = z.object({
    amount: contributionFields.amount.optional(),
    contributionDate: contributionFields.contributionDate.optional(),
    description: contributionFields.description,
}).strict().refine((value) => Object.keys(value).length > 0, {
    message: "At least one contribution field is required",
});

export const goalContributionListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();
