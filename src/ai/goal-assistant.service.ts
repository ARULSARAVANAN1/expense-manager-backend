import type { IFinancialGoal } from "../model/FinancialGoal.js";
import type { IGoalContribution } from "../model/GoalContribution.js";

export interface GoalAssistantContext {
    goal: Pick<
        IFinancialGoal,
        "name" | "category" | "targetAmount" | "targetDate" |
        "monthlyContribution" | "priority" | "status"
    > & { currentSavedAmount: number };
    contributionHistory: ReadonlyArray<
        Pick<IGoalContribution, "amount" | "contributionDate" | "description">
    >;
    monthlyIncomeSummary: Readonly<Record<string, number>>;
    monthlyExpenseSummary: Readonly<Record<string, number>>;
    existingSavingsCommitments: ReadonlyArray<{
        name: string;
        monthlyAmount: number;
    }>;
}

export interface GoalAssistantRecommendation {
    message: string;
    isSuggestion: true;
}

export interface GoalAssistantService {
    generateRecommendations(
        context: GoalAssistantContext
    ): Promise<ReadonlyArray<GoalAssistantRecommendation>>;
}
