export interface GoalCalculationInput {
    targetAmount: number;
    currentSavedAmount: number;
    targetDate: Date | string;
    monthlyContribution?: number;
    status?: "ACTIVE" | "PAUSED";
    now?: Date;
}

export interface SavingsPlan {
    targetAmount: number;
    currentSavedAmount: number;
    remainingAmount: number;
    monthsRemaining: number;
    requiredMonthlyContribution: number | null;
    currentMonthlyContribution: number;
    isMonthlyContributionSufficient: boolean;
}

function utcMonthNumber(date: Date): number {
    return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function isValidDate(date: Date): boolean {
    return !Number.isNaN(date.valueOf());
}

export function calculateGoalProgress(
    targetAmount: number,
    currentSavedAmount: number
): number {
    if (targetAmount <= 0) return 0;
    return Math.min(100, Math.max(0, (currentSavedAmount / targetAmount) * 100));
}

export function calculateRemainingAmount(
    targetAmount: number,
    currentSavedAmount: number
): number {
    return Math.max(0, targetAmount - currentSavedAmount);
}

export function calculateMonthsRemaining(
    targetDate: Date | string,
    now = new Date()
): number {
    const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
    if (!isValidDate(target) || !isValidDate(now)) return 0;
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (target < today) return 0;
    return Math.max(1, utcMonthNumber(target) - utcMonthNumber(today) + 1);
}

export function calculateRequiredMonthlySavings(
    remainingAmount: number,
    monthsRemaining: number
): number | null {
    if (remainingAmount <= 0) return 0;
    if (monthsRemaining <= 0) return null;
    return Math.ceil(remainingAmount / monthsRemaining);
}

export function calculateEstimatedCompletionDate(
    targetAmount: number,
    currentSavedAmount: number,
    monthlyContribution: number | undefined,
    now = new Date()
): Date | null {
    const remaining = calculateRemainingAmount(targetAmount, currentSavedAmount);
    if (remaining === 0) return new Date(now);
    if (!monthlyContribution || monthlyContribution <= 0 || !isValidDate(now)) {
        return null;
    }
    const periods = Math.ceil(remaining / monthlyContribution);
    return new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + periods,
        0
    ));
}

export function calculateGoalStatus(input: GoalCalculationInput):
    "ON_TRACK" | "AT_RISK" | "BEHIND" | "COMPLETED" | "PAUSED" {
    if (input.currentSavedAmount >= input.targetAmount) return "COMPLETED";
    if (input.status === "PAUSED") return "PAUSED";

    const now = input.now ?? new Date();
    const target = typeof input.targetDate === "string"
        ? new Date(input.targetDate)
        : input.targetDate;
    if (!isValidDate(target) || !isValidDate(now)) return "BEHIND";
    const targetDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (targetDay < today) return "BEHIND";

    const required = calculateRequiredMonthlySavings(
        calculateRemainingAmount(input.targetAmount, input.currentSavedAmount),
        calculateMonthsRemaining(target, now)
    );
    if (required !== null && input.monthlyContribution !== undefined &&
        input.monthlyContribution >= required) {
        return "ON_TRACK";
    }
    return "AT_RISK";
}

export function calculateSavingsPlan(
    input: GoalCalculationInput
): SavingsPlan {
    const remainingAmount = calculateRemainingAmount(
        input.targetAmount,
        input.currentSavedAmount
    );
    const now = input.now ?? new Date();
    const monthsRemaining = calculateMonthsRemaining(input.targetDate, now);
    const requiredMonthlyContribution = calculateRequiredMonthlySavings(
        remainingAmount,
        monthsRemaining
    );
    const currentMonthlyContribution = input.monthlyContribution ?? 0;

    return {
        targetAmount: input.targetAmount,
        currentSavedAmount: input.currentSavedAmount,
        remainingAmount,
        monthsRemaining,
        requiredMonthlyContribution,
        currentMonthlyContribution,
        isMonthlyContributionSufficient:
            remainingAmount === 0 ||
            (requiredMonthlyContribution !== null &&
                currentMonthlyContribution >= requiredMonthlyContribution),
    };
}
