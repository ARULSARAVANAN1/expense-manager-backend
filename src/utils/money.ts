import { AppError } from "./AppError.js";

const MAX_PAISE = Number.MAX_SAFE_INTEGER;

export function toPaise(amount: number): number {
    if (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        throw new AppError(
            "Amount must be a positive finite number",
            422,
            "INVALID_AMOUNT"
        );
    }

    const decimal = amount.toString();
    if (!/^\d+(?:\.\d{1,2})?$/.test(decimal)) {
        throw new AppError(
            "Amount must have at most two decimal places",
            422,
            "INVALID_AMOUNT"
        );
    }

    const [rupees, fraction = ""] = decimal.split(".");
    const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));

    if (!Number.isSafeInteger(paise) || paise > MAX_PAISE) {
        throw new AppError(
            "Amount exceeds the supported range",
            422,
            "INVALID_AMOUNT"
        );
    }

    return paise;
}

export function paiseToRupees(paise: number): number {
    if (!Number.isSafeInteger(paise)) {
        throw new AppError(
            "Stored amount exceeds the supported range",
            500,
            "INVALID_STORED_AMOUNT"
        );
    }

    return paise / 100;
}

export function transactionPaise(transaction: {
    amountPaise?: number | null;
    amount: number;
}): number {
    return transaction.amountPaise ?? Math.round(transaction.amount * 100);
}
