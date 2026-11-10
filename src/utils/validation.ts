import { z } from "zod";
import { AppError } from "./AppError.js";

export function parseInput<T>(
    schema: z.ZodType<T>,
    input: unknown
): T {
    const result = schema.safeParse(input);

    if (!result.success) {
        throw new AppError(
            "Validation failed",
            422,
            "VALIDATION_ERROR",
            result.error.flatten()
        );
    }

    return result.data;
}
