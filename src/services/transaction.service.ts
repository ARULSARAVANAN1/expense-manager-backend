import mongoose from "mongoose";
import { AccountModel } from "../model/Account.js";
import { CategoryModel } from "../model/Category.js";
import { ITransaction, TransactionModel } from "../model/Transaction.js";
import { AppError } from "../utils/AppError.js";
import { paiseToRupees, toPaise, transactionPaise } from "../utils/money.js";
import { validateObjectId } from "./category.service.js";

type FinanceType = "EXPENSE" | "INCOME";
type TransactionInput = {
    description: string;
    amount: number;
    categoryId: string;
    accountId?: string | null;
    date: string;
    notes?: string | null;
};

type TransactionDto = {
    id: string;
    description: string;
    amount: number;
    categoryId: string;
    categoryName: string;
    accountId: string | null;
    accountName: string | null;
    date: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
};

type TransactionRecord = ITransaction & {
    _id: mongoose.Types.ObjectId;
};

function parseDate(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
}

function dateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function validateReferences(
    userId: string,
    categoryId: string,
    accountId: string | null | undefined,
    type: FinanceType
) {
    validateObjectId(categoryId, "category ID");
    if (accountId) validateObjectId(accountId, "account ID");

    const [category, account] = await Promise.all([
        CategoryModel.findOne({ _id: categoryId, userId }),
        accountId ? AccountModel.exists({ _id: accountId, userId }) : null,
    ]);

    if (!category) {
        throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
    }
    if (category.type !== type) {
        throw new AppError(
            "Category type does not match this transaction",
            422,
            "CATEGORY_TYPE_MISMATCH"
        );
    }
    if (accountId && !account) {
        throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
    }
}

async function serializeTransactions(
    records: TransactionRecord[],
    userId: string
): Promise<TransactionDto[]> {
    const categoryIds = [...new Set(records.map((record) => record.categoryId.toString()))];
    const accountIds = [...new Set(
        records
            .map((record) => record.accountId?.toString())
            .filter((id): id is string => Boolean(id))
    )];
    const [categories, accounts] = await Promise.all([
        CategoryModel.find({ _id: { $in: categoryIds }, userId }).select("name").lean(),
        AccountModel.find({ _id: { $in: accountIds }, userId }).select("name").lean(),
    ]);
    const categoryNames = new Map(categories.map((item) => [item._id.toString(), item.name]));
    const accountNames = new Map(accounts.map((item) => [item._id.toString(), item.name]));

    return records.map((record) => {
        const categoryId = record.categoryId.toString();
        const accountId = record.accountId?.toString() ?? null;
        return {
            id: record._id.toString(),
            description: record.description,
            amount: paiseToRupees(transactionPaise(record)),
            categoryId,
            categoryName: categoryNames.get(categoryId) ?? "",
            accountId,
            accountName: accountId ? accountNames.get(accountId) ?? null : null,
            date: dateOnly(record.transactionDate),
            ...(record.notes ? { notes: record.notes } : {}),
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        };
    });
}

export async function listTransactions(
    userId: string,
    type: FinanceType,
    query: {
        search?: string;
        categoryId?: string;
        accountId?: string;
        from?: string;
        to?: string;
        sort: "newest" | "oldest" | "highest" | "lowest";
        page: number;
        pageSize: number;
    }
) {
    const filter: Record<string, unknown> = { userId, type };
    if (query.categoryId) {
        validateObjectId(query.categoryId, "category ID");
        const category = await CategoryModel.exists({
            _id: query.categoryId,
            userId,
            type,
        });
        if (!category) {
            throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
        }
        filter.categoryId = query.categoryId;
    }
    if (query.accountId) {
        validateObjectId(query.accountId, "account ID");
        const account = await AccountModel.exists({
            _id: query.accountId,
            userId,
        });
        if (!account) {
            throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
        }
        filter.accountId = query.accountId;
    }
    if (query.from || query.to) {
        const transactionDate: Record<string, Date> = {};
        if (query.from) transactionDate.$gte = parseDate(query.from);
        if (query.to) {
            const exclusiveEnd = parseDate(query.to);
            exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
            transactionDate.$lt = exclusiveEnd;
        }
        filter.transactionDate = transactionDate;
    }
    if (query.search) {
        const search = new RegExp(escapeRegex(query.search), "i");
        const accounts = await AccountModel.find({
            userId,
            name: search,
        }).select("_id").lean();
        filter.$or = [
            { description: search },
            { notes: search },
            { accountId: { $in: accounts.map((account) => account._id) } },
        ];
    }

    const sort: Record<string, 1 | -1> =
        query.sort === "newest" ? { transactionDate: -1, _id: -1 } :
        query.sort === "oldest" ? { transactionDate: 1, _id: 1 } :
        query.sort === "highest" ? { amount: -1, _id: -1 } :
        { amount: 1, _id: 1 };
    const [records, total] = await Promise.all([
        TransactionModel.find(filter)
            .sort(sort)
            .skip((query.page - 1) * query.pageSize)
            .limit(query.pageSize)
            .lean(),
        TransactionModel.countDocuments(filter),
    ]);

    return {
        items: await serializeTransactions(records as TransactionRecord[], userId),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
    };
}

export async function getTransaction(
    userId: string,
    type: FinanceType,
    transactionId: string
) {
    validateObjectId(transactionId, "transaction ID");
    const record = await TransactionModel.findOne({
        _id: transactionId,
        userId,
        type,
    }).lean();
    if (!record) {
        throw new AppError("Transaction not found", 404, "TRANSACTION_NOT_FOUND");
    }
    return (await serializeTransactions([record as TransactionRecord], userId))[0];
}

export async function createTransaction(
    userId: string,
    type: FinanceType,
    input: TransactionInput
) {
    await validateReferences(userId, input.categoryId, input.accountId, type);
    const amountPaise = toPaise(input.amount);
    const record = await TransactionModel.create({
        amount: input.amount,
        amountPaise,
        type,
        description: input.description,
        notes: input.notes ?? undefined,
        transactionDate: parseDate(input.date),
        userId,
        categoryId: input.categoryId,
        ...(input.accountId ? { accountId: input.accountId } : {}),
    });
    return (await serializeTransactions([record as TransactionRecord], userId))[0];
}

export async function updateTransaction(
    userId: string,
    type: FinanceType,
    transactionId: string,
    input: Partial<TransactionInput>
) {
    validateObjectId(transactionId, "transaction ID");
    const record = await TransactionModel.findOne({
        _id: transactionId,
        userId,
        type,
    });
    if (!record) {
        throw new AppError("Transaction not found", 404, "TRANSACTION_NOT_FOUND");
    }

    const categoryId = input.categoryId ?? record.categoryId.toString();
    const accountId = Object.hasOwn(input, "accountId")
        ? input.accountId ?? null
        : record.accountId?.toString() ?? null;
    await validateReferences(userId, categoryId, accountId, type);

    if (input.amount !== undefined) {
        record.amountPaise = toPaise(input.amount);
        record.amount = input.amount;
    }
    if (input.description !== undefined) record.description = input.description;
    if (input.notes !== undefined) record.notes = input.notes ?? undefined;
    if (input.date !== undefined) record.transactionDate = parseDate(input.date);
    if (input.categoryId !== undefined) {
        record.categoryId = new mongoose.Types.ObjectId(input.categoryId);
    }
    if (input.accountId !== undefined) {
        record.accountId = input.accountId
            ? new mongoose.Types.ObjectId(input.accountId)
            : null;
    } else if (Object.hasOwn(input, "accountId")) {
        record.accountId = null;
    }
    await record.save();
    return (await serializeTransactions([record as TransactionRecord], userId))[0];
}

export async function deleteTransaction(
    userId: string,
    type: FinanceType,
    transactionId: string
) {
    validateObjectId(transactionId, "transaction ID");
    const record = await TransactionModel.findOneAndDelete({
        _id: transactionId,
        userId,
        type,
    });
    if (!record) {
        throw new AppError("Transaction not found", 404, "TRANSACTION_NOT_FOUND");
    }
    return { id: transactionId };
}
