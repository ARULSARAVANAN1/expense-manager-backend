import { NextFunction, Request, Response } from "express";
import { expenseParseSchema } from "../schemas/expense-parse.schema.js";
import { parseExpenseText } from "../services/expense-parse.service.js";
import { AppError } from "../utils/AppError.js";
import { parseInput } from "../utils/validation.js";

export async function parseExpenseController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.user) {
            throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
        }

        const { text } = parseInput(expenseParseSchema, req.body);
        const data = await parseExpenseText(req.user.id, text);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}
