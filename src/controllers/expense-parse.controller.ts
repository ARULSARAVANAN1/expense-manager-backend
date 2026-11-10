import { NextFunction, Request, Response } from "express";
import { billUploadFieldsSchema, expenseParseSchema } from "../schemas/expense-parse.schema.js";
import { parseExpenseImage, parseExpenseText } from "../services/expense-parse.service.js";
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

        let data;
        if (req.is("multipart/form-data")) {
            parseInput(billUploadFieldsSchema, req.body);
            if (!req.file) {
                throw new AppError("Upload one bill image in the image field", 422, "BILL_IMAGE_REQUIRED");
            }
            data = await parseExpenseImage(req.user.id, req.file.buffer, req.file.mimetype);
        } else {
            const { text } = parseInput(expenseParseSchema, req.body);
            data = await parseExpenseText(req.user.id, text);
        }
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}
