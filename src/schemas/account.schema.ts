import { z } from "zod";

const accountType = z.enum(["BANK", "CASH", "CREDIT_CARD", "WALLET"]);

export const createAccountSchema = z.object({
    name: z.string().trim().min(1).max(100),
    type: accountType.optional(),
}).strict();

export const patchAccountSchema = z.object({
    name: z.string().trim().min(1).max(100),
    type: accountType.optional(),
}).strict();
