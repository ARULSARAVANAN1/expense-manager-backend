import { NextFunction, Request, Response } from "express";
import {
    addGoalContribution,
    createFinancialGoal,
    deleteFinancialGoal,
    deleteGoalContribution,
    getFinancialGoal,
    getFinancialGoalSavingsPlan,
    listFinancialGoals,
    listGoalContributions,
    previewFinancialGoalSavingsPlan,
    updateFinancialGoal,
    updateFinancialGoalStatus,
    updateGoalContribution,
} from "../services/financial-goal.service.js";
import {
    createFinancialGoalSchema,
    financialGoalListQuerySchema,
    goalPlanPreviewSchema,
    patchFinancialGoalSchema,
    updateFinancialGoalStatusSchema,
} from "../schemas/financial-goal.schema.js";
import {
    createGoalContributionSchema,
    goalContributionListQuerySchema,
    patchGoalContributionSchema,
} from "../schemas/goal-contribution.schema.js";
import { AppError } from "../utils/AppError.js";
import { getStringParam } from "../utils/routeParams.js";
import { parseGoalInput } from "../utils/goal-helpers.js";

function authenticatedUserId(req: Request): string {
    if (!req.user) {
        throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }
    return req.user.id;
}

export async function listFinancialGoalsController(req: Request, res: Response, next: NextFunction) {
    try {
        res.status(200).json({
            success: true,
            ...(await listFinancialGoals(
                authenticatedUserId(req),
                parseGoalInput(financialGoalListQuerySchema, req.query)
            )),
        });
    } catch (error) { next(error); }
}

export async function createFinancialGoalController(req: Request, res: Response, next: NextFunction) {
    try {
        const data = await createFinancialGoal(
            authenticatedUserId(req),
            parseGoalInput(createFinancialGoalSchema, req.body)
        );
        res.status(201).json({
            success: true,
            message: "Financial goal created successfully",
            data,
        });
    } catch (error) { next(error); }
}

export async function getFinancialGoalController(req: Request, res: Response, next: NextFunction) {
    try {
        res.status(200).json({
            success: true,
            data: await getFinancialGoal(authenticatedUserId(req), getStringParam(req, "goalId")),
        });
    } catch (error) { next(error); }
}

export async function updateFinancialGoalController(req: Request, res: Response, next: NextFunction) {
    try {
        res.status(200).json({
            success: true,
            data: await updateFinancialGoal(
                authenticatedUserId(req),
                getStringParam(req, "goalId"),
                parseGoalInput(patchFinancialGoalSchema, req.body)
            ),
        });
    } catch (error) { next(error); }
}

export async function updateFinancialGoalStatusController(req: Request, res: Response, next: NextFunction) {
    try {
        const input = parseGoalInput(updateFinancialGoalStatusSchema, req.body);
        res.status(200).json({
            success: true,
            data: await updateFinancialGoalStatus(
                authenticatedUserId(req),
                getStringParam(req, "goalId"),
                input.status
            ),
        });
    } catch (error) { next(error); }
}

export async function deleteFinancialGoalController(req: Request, res: Response, next: NextFunction) {
    try {
        res.status(200).json(
            await deleteFinancialGoal(authenticatedUserId(req), getStringParam(req, "goalId"))
        );
    } catch (error) { next(error); }
}

export async function addGoalContributionController(req: Request, res: Response, next: NextFunction) {
    try {
        res.status(201).json({
            success: true,
            data: await addGoalContribution(
                authenticatedUserId(req),
                getStringParam(req, "goalId"),
                parseGoalInput(createGoalContributionSchema, req.body)
            ),
        });
    } catch (error) { next(error); }
}

export async function listGoalContributionsController(req: Request, res: Response, next: NextFunction) {
    try {
        res.status(200).json({
            success: true,
            ...(await listGoalContributions(
                authenticatedUserId(req),
                getStringParam(req, "goalId"),
                parseGoalInput(goalContributionListQuerySchema, req.query)
            )),
        });
    } catch (error) { next(error); }
}

export async function updateGoalContributionController(req: Request, res: Response, next: NextFunction) {
    try {
        res.status(200).json({
            success: true,
            data: await updateGoalContribution(
                authenticatedUserId(req),
                getStringParam(req, "goalId"),
                getStringParam(req, "contributionId"),
                parseGoalInput(patchGoalContributionSchema, req.body)
            ),
        });
    } catch (error) { next(error); }
}

export async function deleteGoalContributionController(req: Request, res: Response, next: NextFunction) {
    try {
        res.status(200).json(
            await deleteGoalContribution(
                authenticatedUserId(req),
                getStringParam(req, "goalId"),
                getStringParam(req, "contributionId")
            )
        );
    } catch (error) { next(error); }
}

export async function financialGoalSavingsPlanController(req: Request, res: Response, next: NextFunction) {
    try {
        res.status(200).json({
            success: true,
            data: await getFinancialGoalSavingsPlan(
                authenticatedUserId(req),
                getStringParam(req, "goalId")
            ),
        });
    } catch (error) { next(error); }
}

export async function financialGoalPlanPreviewController(req: Request, res: Response, next: NextFunction) {
    try {
        res.status(200).json({
            success: true,
            data: previewFinancialGoalSavingsPlan(
                parseGoalInput(goalPlanPreviewSchema, req.body)
            ),
        });
    } catch (error) { next(error); }
}
