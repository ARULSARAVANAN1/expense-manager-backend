import { AccountModel } from "../model/Account.js";
import { TransactionModel } from "../model/Transaction.js";
import { AppError } from "../utils/AppError.js";

type AccountType = "BANK" | "CASH" | "CREDIT_CARD" | "WALLET";

function accountDto(account: {
    id: string;
    name: string;
    type?: AccountType;
}) {
    return {
        id: account.id,
        name: account.name,
        type: account.type ?? "WALLET",
    };
}

export async function getAccounts(userId: string) {
    const accounts = await AccountModel.find({ userId }).sort({ name: 1, _id: 1 });
    return accounts.map(accountDto);
}

export async function createAccount(
    userId: string,
    input: { name: string; type?: AccountType }
) {
    const duplicate = await AccountModel.exists({
        userId,
        name: new RegExp(`^${escapeRegex(input.name.trim())}$`, "i"),
    });
    if (duplicate) {
        throw new AppError("Account name already exists", 409, "DUPLICATE_ACCOUNT");
    }

    const account = await AccountModel.create({
        ...input,
        normalizedName: input.name.trim().toLocaleLowerCase("en"),
        userId,
    });
    return accountDto(account);
}

export async function updateAccount(
    userId: string,
    accountId: string,
    input: { name: string; type?: AccountType }
) {
    const duplicate = await AccountModel.exists({
        _id: { $ne: accountId },
        userId,
        name: new RegExp(`^${escapeRegex(input.name.trim())}$`, "i"),
    });
    if (duplicate) {
        throw new AppError("Account name already exists", 409, "DUPLICATE_ACCOUNT");
    }

    const account = await AccountModel.findOne({ _id: accountId, userId });
    if (!account) {
        throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
    }

    account.name = input.name;
    account.normalizedName = input.name.trim().toLocaleLowerCase("en");
    if (input.type) account.type = input.type;
    await account.save();
    return accountDto(account);
}

export async function deleteAccount(userId: string, accountId: string) {
    const account = await AccountModel.findOne({ _id: accountId, userId });
    if (!account) {
        throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
    }

    const transaction = await TransactionModel.exists({ userId, accountId });
    if (transaction) {
        throw new AppError(
            "Account is referenced by transactions",
            409,
            "ACCOUNT_IN_USE"
        );
    }

    await account.deleteOne();
    return { id: account.id };
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
