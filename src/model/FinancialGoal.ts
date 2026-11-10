import mongoose, { Schema } from "mongoose";

export const FINANCIAL_GOAL_CATEGORIES = [
    "EMERGENCY_FUND",
    "TRAVEL",
    "GADGETS",
    "VEHICLE",
    "EDUCATION",
    "HOME",
    "WEDDING",
    "DEBT_REPAYMENT",
    "OTHER",
] as const;

export type FinancialGoalCategory = (typeof FINANCIAL_GOAL_CATEGORIES)[number];
export type FinancialGoalPriority = "HIGH" | "MEDIUM" | "LOW";
export type FinancialGoalStoredStatus = "ACTIVE" | "PAUSED";

export interface IFinancialGoal {
    name: string;
    category: FinancialGoalCategory;
    targetAmount: number;
    targetDate: Date;
    monthlyContribution?: number;
    priority: FinancialGoalPriority;
    status: FinancialGoalStoredStatus;
    userId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const financialGoalSchema = new Schema<IFinancialGoal>(
    {
        name: { type: String, required: true, trim: true, maxlength: 100 },
        category: {
            type: String,
            required: true,
            enum: FINANCIAL_GOAL_CATEGORIES,
        },
        targetAmount: { type: Number, required: true, min: 0.01 },
        targetDate: { type: Date, required: true },
        monthlyContribution: { type: Number, min: 0.01 },
        priority: {
            type: String,
            enum: ["HIGH", "MEDIUM", "LOW"],
            default: "MEDIUM",
            required: true,
        },
        status: {
            type: String,
            enum: ["ACTIVE", "PAUSED"],
            default: "ACTIVE",
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

financialGoalSchema.index({ userId:  1, createdAt: -1 });
financialGoalSchema.index({ userId: 1, status: 1, targetDate: 1 });

export const FinancialGoalModel = mongoose.model<IFinancialGoal>(
    "FinancialGoal",
    financialGoalSchema
);
