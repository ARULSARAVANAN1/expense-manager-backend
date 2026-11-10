import { NextFunction, Request, Response } from "express";
import {
    changePassword,
    updateCurrentUser,
} from "../services/auth.service.js";
import { AppError } from "../utils/AppError.js";
import { parseInput } from "../utils/validation.js";
import {
    changePasswordSchema,
    updateUserSchema,
} from "../schemas/user.schema.js";

function authenticatedUserId(req: Request): string {
    if (!req.user) {
        throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }

    return req.user.id;
}

export async function updateUserController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const input = parseInput(updateUserSchema, req.body);
        const user = await updateCurrentUser(authenticatedUserId(req), input);
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
}

export async function changePasswordController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const input = parseInput(changePasswordSchema, req.body);
        const result = await changePassword(authenticatedUserId(req), input);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}
