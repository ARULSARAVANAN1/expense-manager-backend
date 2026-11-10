import { NextFunction, Request, Response } from "express";
import { monthlySummarySchema } from "../schemas/monthly-summary.schema.js";
import { generateMonthlySummary } from "../services/monthly-summary.service.js";
import { AppError } from "../utils/AppError.js";
import { parseInput } from "../utils/validation.js";

export async function monthlySummaryController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user) {
            throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
        }
        const { month } = parseInput(
            monthlySummarySchema,
            req.body === undefined ? {} : req.body
        );
        const data = await generateMonthlySummary(req.user.id, month);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}
