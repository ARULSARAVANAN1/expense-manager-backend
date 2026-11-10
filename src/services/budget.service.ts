import mongoose from "mongoose";
import { BudgetModel } from "../model/Budget.js";
import { CategoryModel } from "../model/Category.js";
import { TransactionModel } from "../model/Transaction.js";
import { AppError } from "../utils/AppError.js";
import { paiseToRupees, toPaise, transactionPaise } from "../utils/money.js";
import { validateObjectId } from "./category.service.js";

type BudgetInput = {
    categoryId: string;
    month: string;
    amount: number;
};

function monthBounds(month: string) {
    const [year, monthNumber] = month.split("-").map(Number);
    return {
        start: new Date(Date.UTC(year, monthNumber - 1, 1)),
        end: new Date(Date.UTC(year, monthNumber, 1)),
    };
}

async function validateCategory(userId: string, categoryId: string) {
    validateObjectId(categoryId, "category ID");
    const category = await CategoryModel.findOne({
        _id: categoryId,
        userId,
        type: "EXPENSE",
    });
    if (!category) {
        throw new AppError(
            "An owned expense category is required",
            422,
            "INVALID_BUDGET_CATEGORY"
        );
    }
    return category;
}

async function spentAmountPaise(
    userId: string,
    categoryId: string,
    month: string
) {
    const { start, end } = monthBounds(month);
    const transactions = await TransactionModel.find({
        userId,
        type: "EXPENSE",
        categoryId,
        transactionDate: { $gte: start, $lt: end },
    }).select("amount amountPaise").lean();

    return transactions.reduce(
        (total, transaction) => total + transactionPaise(transaction),
        0
    );
}

async function budgetDto(
    budget: {
        _id: mongoose.Types.ObjectId;
        categoryId: mongoose.Types.ObjectId;
        month: string;
        amount: number;
        amountPaise?: number;
    },
    userId: string
) {
    const category = await CategoryModel.findOne({
        _id: budget.categoryId,
        userId,
    }).select("name").lean();
    const budgetPaise = budget.amountPaise ?? toPaise(budget.amount);
    const spentPaise = await spentAmountPaise(
        userId,
        budget.categoryId.toString(),
        budget.month
    );
    return {
        id: budget._id.toString(),
        categoryId: budget.categoryId.toString(),
        categoryName: category?.name ?? "",
        month: budget.month,
        amount: paiseToRupees(budgetPaise),
        spent: paiseToRupees(spentPaise),
        remaining: paiseToRupees(budgetPaise - spentPaise),
        percent: budgetPaise === 0 ? 0 : (spentPaise / budgetPaise) * 100,
    };
}

export async function listBudgets(
    userId: string,
    query: { month?: string; page: number; pageSize: number }
) {
    const filter = { userId, ...(query.month ? { month: query.month } : {}) };
    const [budgets, total] = await Promise.all([
        BudgetModel.find(filter)
            .sort({ month: -1, createdAt: -1, _id: 1 })
            .skip((query.page - 1) * query.pageSize)
            .limit(query.pageSize)
            .lean(),
        BudgetModel.countDocuments(filter),
    ]);

    return {
        items: await Promise.all(
            budgets.map((budget) => budgetDto(budget, userId))
        ),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
    };
}

export async function createBudget(userId: string, input: BudgetInput) {
    await validateCategory(userId, input.categoryId);
    const amountPaise = toPaise(input.amount);
    const budget = await BudgetModel.create({
        userId,
        categoryId: input.categoryId,
        month: input.month,
        amount: input.amount,
        amountPaise,
    });
    return budgetDto(budget, userId);
}

export async function updateBudget(
    userId: string,
    budgetId: string,
    input: Partial<BudgetInput>
) {
    validateObjectId(budgetId, "budget ID");
    const budget = await BudgetModel.findOne({ _id: budgetId, userId });
    if (!budget) {
        throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
    }

    if (input.categoryId) {
        await validateCategory(userId, input.categoryId);
        budget.categoryId = new mongoose.Types.ObjectId(input.categoryId);
    }
    if (input.month) budget.month = input.month;
    if (input.amount !== undefined) {
        const amountPaise = toPaise(input.amount);
        budget.amount = input.amount;
        budget.amountPaise = amountPaise;
    }
    await budget.save();
    return budgetDto(budget, userId);
}

export async function deleteBudget(userId: string, budgetId: string) {
    validateObjectId(budgetId, "budget ID");
    const budget = await BudgetModel.findOneAndDelete({ _id: budgetId, userId });
    if (!budget) {
        throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
    }
    return { id: budgetId };
}
