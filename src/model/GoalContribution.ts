import mongoose, { Schema } from "mongoose";

export interface IGoalContribution {
    goalId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    amount: number;
    contributionDate: Date;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}

const goalContributionSchema = new Schema<IGoalContribution>(
    {
        goalId: {
            type: Schema.Types.ObjectId,
            ref: "FinancialGoal",
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        amount: { type: Number, required: true, min: 0.01 },
        contributionDate: { type: Date, required: true },
        description: { type: String, trim: true, maxlength: 500 },
    },
    { timestamps: true }
);

goalContributionSchema.index({ userId: 1 });
goalContributionSchema.index({ goalId: 1 });
goalContributionSchema.index({ goalId: 1, contributionDate: -1 });
goalContributionSchema.index({ userId: 1, goalId: 1, contributionDate: -1 });

export const GoalContributionModel = mongoose.model<IGoalContribution>(
    "GoalContribution",
    goalContributionSchema
);
