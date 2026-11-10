import mongoose, { ClientSession } from "mongoose";
import { FinancialGoalModel, IFinancialGoal } from "../model/FinancialGoal.js";
import { GoalContributionModel } from "../model/GoalContribution.js";
import { AppError } from "../utils/AppError.js";
import { toCalendarDate, validateGoalObjectId } from "../utils/goal-helpers.js";
import {
    calculateEstimatedCompletionDate,
    calculateGoalProgress,
    calculateGoalStatus,
    calculateRemainingAmount,
    calculateSavingsPlan,
} from "./goal-calculation.service.js";

type CreateGoalInput = {
    name: string;
    category: IFinancialGoal["category"];
    targetAmount: number;
    targetDate: string;
    initialSavedAmount?: number;
    monthlyContribution?: number;
    priority: IFinancialGoal["priority"];
};
type PatchGoalInput = Partial<Omit<CreateGoalInput, "initialSavedAmount">>;
type ContributionInput = {
    amount: number;
    contributionDate: string;
    description?: string;
};
type PatchContributionInput = Partial<ContributionInput>;
type ListGoalsQuery = {
    status?: "ACTIVE" | "PAUSED" | "COMPLETED";
    category?: IFinancialGoal["category"];
    priority?: IFinancialGoal["priority"];
    page: number;
    limit: number;
    sortBy: "createdAt" | "targetDate" | "targetAmount" | "name";
    sortOrder: "asc" | "desc";
};
type ListContributionsQuery = {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
};

function unsupportedTransactions(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    const message = "message" in error && typeof error.message === "string"
        ? error.message
        : "";
    return /transaction numbers are only allowed|transaction support is not available|transactions are not supported|does not support transactions/i.test(message);
}

async function withOptionalTransaction<T>(
    work: (session?: ClientSession) => Promise<T>
): Promise<T> {
    const session = await mongoose.startSession();
    try {
        try {
            let result!: T;
            await session.withTransaction(async () => {
                result = await work(session);
            });
            return result;
        } catch (error) {
            if (!unsupportedTransactions(error)) throw error;
            return await work();
        }
    } finally {
        await session.endSession();
    }
}

async function savedAmounts(userId: string, goalIds: mongoose.Types.ObjectId[]) {
    const rows = await GoalContributionModel.aggregate<{
        _id: mongoose.Types.ObjectId;
        total: number;
    }>([
        { $match: { userId: new mongoose.Types.ObjectId(userId), goalId: { $in: goalIds } } },
        { $group: { _id: "$goalId", total: { $sum: "$amount" } } },
    ]);
    return new Map(rows.map((row) => [row._id.toString(), row.total]));
}

function goalDto(goal: {
    _id: mongoose.Types.ObjectId;
    name: string;
    category: string;
    targetAmount: number;
    targetDate: Date;
    monthlyContribution?: number;
    priority: string;
    status: "ACTIVE" | "PAUSED";
    currentSavedAmount: number;
    createdAt?: Date;
    updatedAt?: Date;
}) {
    const currentSavedAmount = goal.currentSavedAmount ?? 0;
    const calculation = {
        targetAmount: goal.targetAmount,
        currentSavedAmount,
        targetDate: goal.targetDate,
        monthlyContribution: goal.monthlyContribution,
        status: goal.status,
    } as const;
    return {
        id: goal._id.toString(),
        name: goal.name,
        category: goal.category,
        targetAmount: goal.targetAmount,
        currentSavedAmount,
        remainingAmount: calculateRemainingAmount(goal.targetAmount, currentSavedAmount),
        progressPercentage: calculateGoalProgress(goal.targetAmount, currentSavedAmount),
        monthlyContribution: goal.monthlyContribution ?? null,
        targetDate: goal.targetDate,
        priority: goal.priority,
        status: currentSavedAmount >= goal.targetAmount
            ? "COMPLETED"
            : goal.status,
        progressStatus: calculateGoalStatus(calculation),
        estimatedCompletionDate: goal.status === "PAUSED" &&
            currentSavedAmount < goal.targetAmount
            ? null
            : calculateEstimatedCompletionDate(
                goal.targetAmount,
                currentSavedAmount,
                goal.monthlyContribution
            ),
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
    };
}

async function findOwnedGoal(userId: string, goalId: string, session?: ClientSession) {
    validateGoalObjectId(goalId, "goal ID");
    return FinancialGoalModel.findOne({
        _id: goalId,
        userId,
    }).session(session ?? null);
}

async function goalWithSavedAmount(
    goal: IFinancialGoal & { _id: mongoose.Types.ObjectId },
    userId: string
) {
    const totals = await savedAmounts(userId, [goal._id]);
    return goalDto({
        _id: goal._id,
        name: goal.name,
        category: goal.category,
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        monthlyContribution: goal.monthlyContribution,
        priority: goal.priority,
        status: goal.status,
        currentSavedAmount: totals.get(goal._id.toString()) ?? 0,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
    });
}

async function goalSummary(userId: string, goalId: string) {
    const goal = await findOwnedGoal(userId, goalId);
    if (!goal) throw new AppError("Financial goal not found", 404, "GOAL_NOT_FOUND");
    return goalWithSavedAmount(goal, userId);
}

export async function createFinancialGoal(userId: string, input: CreateGoalInput) {
    return withOptionalTransaction(async (session) => {
        const [goal] = await FinancialGoalModel.create([{
            name: input.name,
            category: input.category,
            targetAmount: input.targetAmount,
            targetDate: toCalendarDate(input.targetDate),
            monthlyContribution: input.monthlyContribution,
            priority: input.priority,
            userId,
        }], session ? { session } : undefined);

        if (input.initialSavedAmount && input.initialSavedAmount > 0) {
            await GoalContributionModel.create([{
                goalId: goal._id,
                userId,
                amount: input.initialSavedAmount,
                contributionDate: new Date(),
                description: "Initial savings",
            }], session ? { session } : undefined);
        }
        return goalDto({
            _id: goal._id,
            name: goal.name,
            category: goal.category,
            targetAmount: goal.targetAmount,
            targetDate: goal.targetDate,
            monthlyContribution: goal.monthlyContribution,
            priority: goal.priority,
            status: goal.status,
            currentSavedAmount: input.initialSavedAmount ?? 0,
            createdAt: goal.createdAt,
            updatedAt: goal.updatedAt,
        });
    });
}

export async function listFinancialGoals(userId: string, query: ListGoalsQuery) {
    const match: Record<string, unknown> = {
        userId: new mongoose.Types.ObjectId(userId),
        ...(query.category ? { category: query.category } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.status && query.status !== "COMPLETED" ? { status: query.status } : {}),
    };
    const sortDirection = query.sortOrder === "asc" ? 1 : -1;
    const pipeline: mongoose.PipelineStage[] = [
        { $match: match },
        {
            $lookup: {
                from: "goalcontributions",
                let: { goalId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $and: [
                        { $eq: ["$goalId", "$$goalId"] },
                        { $eq: ["$userId", new mongoose.Types.ObjectId(userId)] },
                    ] } } },
                    { $group: { _id: null, total: { $sum: "$amount" } } },
                ],
                as: "contributionTotals",
            },
        },
        {
            $addFields: {
                currentSavedAmount: {
                    $ifNull: [{ $arrayElemAt: ["$contributionTotals.total", 0] }, 0],
                },
            },
        },
    ];
    if (query.status === "COMPLETED") {
        pipeline.push({ $match: { $expr: { $gte: ["$currentSavedAmount", "$targetAmount"] } } });
    } else if (query.status) {
        pipeline.push({ $match: { $expr: { $lt: ["$currentSavedAmount", "$targetAmount"] } } });
    }
    pipeline.push(
        {
            $facet: {
                records: [
                    { $sort: { [query.sortBy]: sortDirection, _id: sortDirection } },
                    { $skip: (query.page - 1) * query.limit },
                    { $limit: query.limit },
                ],
                total: [{ $count: "count" }],
            },
        }
    );
    const [result] = await FinancialGoalModel.aggregate<{
        records: Array<{
            _id: mongoose.Types.ObjectId;
            name: string;
            category: string;
            targetAmount: number;
            targetDate: Date;
            monthlyContribution?: number;
            priority: string;
            status: "ACTIVE" | "PAUSED";
            currentSavedAmount: number;
            createdAt: Date;
            updatedAt: Date;
        }>;
        total: Array<{ count: number }>;
    }>(pipeline);
    const totalRecords = result?.total[0]?.count ?? 0;
    const [summaryRow] = await FinancialGoalModel.aggregate<{
        totalTarget: number;
        totalSaved: number;
        monthlyCommitment: number;
        activeGoals: number;
    }>([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
            $lookup: {
                from: "goalcontributions",
                let: { goalId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $and: [
                        { $eq: ["$goalId", "$$goalId"] },
                        { $eq: ["$userId", new mongoose.Types.ObjectId(userId)] },
                    ] } } },
                    { $group: { _id: null, total: { $sum: "$amount" } } },
                ],
                as: "contributionTotals",
            },
        },
        {
            $addFields: {
                currentSavedAmount: {
                    $ifNull: [{ $arrayElemAt: ["$contributionTotals.total", 0] }, 0],
                },
            },
        },
        {
            $group: {
                _id: null,
                totalTarget: { $sum: "$targetAmount" },
                totalSaved: { $sum: "$currentSavedAmount" },
                monthlyCommitment: {
                    $sum: { $cond: [
                        { $and: [
                            { $eq: ["$status", "ACTIVE"] },
                            { $lt: ["$currentSavedAmount", "$targetAmount"] },
                        ] },
                        { $ifNull: ["$monthlyContribution", 0] },
                        0,
                    ] },
                },
                activeGoals: {
                    $sum: { $cond: [
                        { $and: [
                            { $eq: ["$status", "ACTIVE"] },
                            { $lt: ["$currentSavedAmount", "$targetAmount"] },
                        ] },
                        1,
                        0,
                    ] },
                },
            },
        },
    ]);

    return {
        data: (result?.records ?? []).map(goalDto),
        pagination: {
            page: query.page,
            limit: query.limit,
            totalRecords,
            totalPages: Math.ceil(totalRecords / query.limit),
        },
        summary: {
            totalSaved: summaryRow?.totalSaved ?? 0,
            totalTarget: summaryRow?.totalTarget ?? 0,
            activeGoals: summaryRow?.activeGoals ?? 0,
            monthlyCommitment: summaryRow?.monthlyCommitment ?? 0,
        },
    };
}

export async function getFinancialGoal(userId: string, goalId: string) {
    const goal = await findOwnedGoal(userId, goalId);
    if (!goal) throw new AppError("Financial goal not found", 404, "GOAL_NOT_FOUND");
    const summary = await goalWithSavedAmount(goal, userId);
    const latestContributions = await GoalContributionModel.find({ userId, goalId })
        .sort({ contributionDate: -1, _id: -1 })
        .limit(5)
        .lean();
    return {
        ...summary,
        latestContributions: latestContributions.map(contributionDto),
    };
}

export async function updateFinancialGoal(
    userId: string,
    goalId: string,
    input: PatchGoalInput
) {
    const goal = await findOwnedGoal(userId, goalId);
    if (!goal) throw new AppError("Financial goal not found", 404, "GOAL_NOT_FOUND");
    if (input.name !== undefined) goal.name = input.name;
    if (input.category !== undefined) goal.category = input.category;
    if (input.targetAmount !== undefined) goal.targetAmount = input.targetAmount;
    if (input.targetDate !== undefined) goal.targetDate = toCalendarDate(input.targetDate);
    if (input.monthlyContribution !== undefined) {
        goal.monthlyContribution = input.monthlyContribution;
    } else if ("monthlyContribution" in input) {
        goal.monthlyContribution = undefined;
    }
    if (input.priority !== undefined) goal.priority = input.priority;
    await goal.save();
    return goalSummary(userId, goalId);
}

export async function updateFinancialGoalStatus(
    userId: string,
    goalId: string,
    status: "ACTIVE" | "PAUSED"
) {
    const goal = await findOwnedGoal(userId, goalId);
    if (!goal) throw new AppError("Financial goal not found", 404, "GOAL_NOT_FOUND");
    goal.status = status;
    await goal.save();
    return goalSummary(userId, goalId);
}

export async function deleteFinancialGoal(userId: string, goalId: string) {
    return withOptionalTransaction(async (session) => {
        const goal = await findOwnedGoal(userId, goalId, session);
        if (!goal) throw new AppError("Financial goal not found", 404, "GOAL_NOT_FOUND");
        await GoalContributionModel.deleteMany(
            { userId, goalId: goal._id },
            session ? { session } : undefined
        );
        await goal.deleteOne(session ? { session } : undefined);
        return { success: true, message: "Financial goal deleted successfully" };
    });
}

async function currentTotal(
    userId: string,
    goalId: mongoose.Types.ObjectId,
    session?: ClientSession
) {
    const [result] = await GoalContributionModel.aggregate<{ total: number }>([
        { $match: { userId: new mongoose.Types.ObjectId(userId), goalId } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).session(session ?? null);
    return result?.total ?? 0;
}

function contributionDto(contribution: {
    _id: mongoose.Types.ObjectId;
    amount: number;
    contributionDate: Date;
    description?: string;
    createdAt?: Date;
    updatedAt?: Date;
}) {
    return {
        id: contribution._id.toString(),
        amount: contribution.amount,
        contributionDate: contribution.contributionDate,
        description: contribution.description ?? null,
        createdAt: contribution.createdAt,
        updatedAt: contribution.updatedAt,
    };
}

export async function addGoalContribution(
    userId: string,
    goalId: string,
    input: ContributionInput
) {
    const goal = await findOwnedGoal(userId, goalId);
    if (!goal) throw new AppError("Financial goal not found", 404, "GOAL_NOT_FOUND");
    const saved = await currentTotal(userId, goal._id);
    if (input.amount > calculateRemainingAmount(goal.targetAmount, saved)) {
        throw new AppError(
            "Contribution exceeds the remaining goal amount",
            409,
            "CONTRIBUTION_EXCEEDS_TARGET"
        );
    }
    const [contribution] = await GoalContributionModel.create([{
        userId,
        goalId: goal._id,
        amount: input.amount,
        contributionDate: toCalendarDate(input.contributionDate),
        description: input.description,
    }]);
    return {
        contribution: contributionDto(contribution),
        goal: await goalSummary(userId, goalId),
    };
}

export async function listGoalContributions(
    userId: string,
    goalId: string,
    query: ListContributionsQuery
) {
    const goal = await findOwnedGoal(userId, goalId);
    if (!goal) throw new AppError("Financial goal not found", 404, "GOAL_NOT_FOUND");
    const filter = { userId, goalId: goal._id };
    const [contributions, totalRecords] = await Promise.all([
        GoalContributionModel.find(filter)
            .sort({ contributionDate: query.sortOrder === "asc" ? 1 : -1, _id: -1 })
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),
        GoalContributionModel.countDocuments(filter),
    ]);
    return {
        data: contributions.map(contributionDto),
        pagination: {
            page: query.page,
            limit: query.limit,
            totalRecords,
            totalPages: Math.ceil(totalRecords / query.limit),
        },
    };
}

export async function updateGoalContribution(
    userId: string,
    goalId: string,
    contributionId: string,
    input: PatchContributionInput
) {
    validateGoalObjectId(contributionId, "contribution ID");
    const goal = await findOwnedGoal(userId, goalId);
    if (!goal) throw new AppError("Financial goal not found", 404, "GOAL_NOT_FOUND");
    const contribution = await GoalContributionModel.findOne({
        _id: contributionId,
        userId,
        goalId: goal._id,
    });
    if (!contribution) {
        throw new AppError("Goal contribution not found", 404, "CONTRIBUTION_NOT_FOUND");
    }
    const revisedAmount = input.amount ?? contribution.amount;
    const saved = await currentTotal(userId, goal._id);
    if (saved - contribution.amount + revisedAmount > goal.targetAmount) {
        throw new AppError(
            "Contribution exceeds the remaining goal amount",
            409,
            "CONTRIBUTION_EXCEEDS_TARGET"
        );
    }
    if (input.amount !== undefined) contribution.amount = input.amount;
    if (input.contributionDate !== undefined) {
        contribution.contributionDate = toCalendarDate(input.contributionDate);
    }
    if (input.description !== undefined) contribution.description = input.description;
    else if ("description" in input) contribution.description = undefined;
    await contribution.save();
    return {
        contribution: contributionDto(contribution),
        goal: await goalSummary(userId, goalId),
    };
}

export async function deleteGoalContribution(
    userId: string,
    goalId: string,
    contributionId: string
) {
    validateGoalObjectId(contributionId, "contribution ID");
    const goal = await findOwnedGoal(userId, goalId);
    if (!goal) throw new AppError("Financial goal not found", 404, "GOAL_NOT_FOUND");
    const contribution = await GoalContributionModel.findOneAndDelete({
        _id: contributionId,
        userId,
        goalId: goal._id,
    });
    if (!contribution) {
        throw new AppError("Goal contribution not found", 404, "CONTRIBUTION_NOT_FOUND");
    }
    return {
        success: true,
        message: "Goal contribution deleted successfully",
        goal: await goalSummary(userId, goalId),
    };
}

export async function getFinancialGoalSavingsPlan(userId: string, goalId: string) {
    const goal = await findOwnedGoal(userId, goalId);
    if (!goal) throw new AppError("Financial goal not found", 404, "GOAL_NOT_FOUND");
    const totals = await savedAmounts(userId, [goal._id]);
    return calculateSavingsPlan({
        targetAmount: goal.targetAmount,
        currentSavedAmount: totals.get(goal._id.toString()) ?? 0,
        targetDate: goal.targetDate,
        monthlyContribution: goal.monthlyContribution,
        status: goal.status,
    });
}

export function previewFinancialGoalSavingsPlan(input: {
    targetAmount: number;
    currentSavedAmount: number;
    targetDate: string;
    monthlyContribution?: number;
}) {
    return calculateSavingsPlan({
        ...input,
        targetDate: toCalendarDate(input.targetDate),
    });
}
