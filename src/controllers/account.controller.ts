import { NextFunction, Request, Response } from "express";
import {
    createAccount,
    deleteAccount,
    getAccounts,
    updateAccount,
} from "../services/account.service.js";
import { AppError } from "../utils/AppError.js";
import { parseInput } from "../utils/validation.js";
import {
    createAccountSchema,
    patchAccountSchema,
} from "../schemas/account.schema.js";
import { validateObjectId } from "../services/category.service.js";
import { getStringParam } from "../utils/routeParams.js";

function userId(req: Request): string {
    if (!req.user) {
        throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }
    return req.user.id;
}

export async function getAccountsController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        res.status(200).json({
            success: true,
            data: await getAccounts(userId(req)),
        });
    } catch (error) {
        next(error);
    }
}

export async function createAccountController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const input = parseInput(createAccountSchema, req.body);
        const account = await createAccount(userId(req), input);
        res.status(201).json({ success: true, data: account });
    } catch (error) {
        next(error);
    }
}

export async function updateAccountController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const id = getStringParam(req, "id");
        validateObjectId(id, "account ID");
        const input = parseInput(patchAccountSchema, req.body);
        const account = await updateAccount(userId(req), id, input);
        res.status(200).json({ success: true, data: account });
    } catch (error) {
        next(error);
    }
}

export async function deleteAccountController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const id = getStringParam(req, "id");
        validateObjectId(id, "account ID");
        const result = await deleteAccount(userId(req), id);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}
