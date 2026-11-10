import { NextFunction, Request, Response } from "express";
import {
    createTransaction,
    deleteTransaction,
    getTransaction,
    listTransactions,
    updateTransaction,
} from "../services/transaction.service.js";
import {
    createTransactionSchema,
    patchTransactionSchema,
    transactionListQuerySchema,
} from "../schemas/transaction.schema.js";
import { AppError } from "../utils/AppError.js";
import { parseInput } from "../utils/validation.js";
import { getStringParam } from "../utils/routeParams.js";

type FinanceType = "EXPENSE" | "INCOME";

export function transactionControllers(type: FinanceType) {
    function userId(req: Request): string {
        if (!req.user) {
            throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
        }
        return req.user.id;
    }

    return {
        list: async (req: Request, res: Response, next: NextFunction) => {
            try {
                const query = parseInput(transactionListQuerySchema, req.query);
                const data = await listTransactions(userId(req), type, query);
                res.status(200).json({ success: true, data });
            } catch (error) {
                next(error);
            }
        },
        create: async (req: Request, res: Response, next: NextFunction) => {
            try {
                const input = parseInput(createTransactionSchema, req.body);
                const data = await createTransaction(userId(req), type, input);
                res.status(201).json({ success: true, data });
            } catch (error) {
                next(error);
            }
        },
        get: async (req: Request, res: Response, next: NextFunction) => {
            try {
                const data = await getTransaction(userId(req), type, getStringParam(req, "id"));
                res.status(200).json({ success: true, data });
            } catch (error) {
                next(error);
            }
        },
        update: async (req: Request, res: Response, next: NextFunction) => {
            try {
                const input = parseInput(patchTransactionSchema, req.body);
                const data = await updateTransaction(
                    userId(req),
                    type,
                    getStringParam(req, "id"),
                    input
                );
                res.status(200).json({ success: true, data });
            } catch (error) {
                next(error);
            }
        },
        delete: async (req: Request, res: Response, next: NextFunction) => {
            try {
                const data = await deleteTransaction(userId(req), type, getStringParam(req, "id"));
                res.status(200).json({ success: true, data });
            } catch (error) {
                next(error);
            }
        },
    };
}
