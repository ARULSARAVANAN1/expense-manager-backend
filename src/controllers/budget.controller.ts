import { NextFunction, Request, Response } from "express";
import {
    createBudget,
    deleteBudget,
    listBudgets,
    updateBudget,
} from "../services/budget.service.js";
import {
    budgetListQuerySchema,
    createBudgetSchema,
    patchBudgetSchema,
} from "../schemas/budget.schema.js";
import { AppError } from "../utils/AppError.js";
import { parseInput } from "../utils/validation.js";
import { getStringParam } from "../utils/routeParams.js";

function userId(req: Request): string {
    if (!req.user) {
        throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }
    return req.user.id;
}

export async function listBudgetsController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const query = parseInput(budgetListQuerySchema, req.query);
        res.status(200).json({
            success: true,
            data: await listBudgets(userId(req), query),
        });
    } catch (error) {
        next(error);
    }
}

export async function createBudgetController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const input = parseInput(createBudgetSchema, req.body);
        const budget = await createBudget(userId(req), input);
        res.status(201).json({ success: true, data: budget });
    } catch (error) {
        next(error);
    }
}

export async function updateBudgetController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const input = parseInput(patchBudgetSchema, req.body);
        const budget = await updateBudget(userId(req), getStringParam(req, "id"), input);
        res.status(200).json({ success: true, data: budget });
    } catch (error) {
        next(error);
    }
}

export async function deleteBudgetController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const result = await deleteBudget(userId(req), getStringParam(req, "id"));
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}
