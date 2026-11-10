import mongoose from "mongoose";
import { z } from "zod";
import { AppError } from "./AppError.js";

export function parseGoalInput<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
        throw new AppError(
            "Validation failed",
            400,
            "VALIDATION_ERROR",
            result.error.flatten()
        );
    }
    return result.data;
}

export function validateGoalObjectId(value: string, label: string): void {
    if (!mongoose.isValidObjectId(value)) {
        throw new AppError(`Invalid ${label}`, 400, "VALIDATION_ERROR");
    }
}

export function toCalendarDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
}
