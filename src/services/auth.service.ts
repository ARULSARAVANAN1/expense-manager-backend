import bcrypt from "bcryptjs";
import { generateToken } from "../utils/jwt.js";
import { UserModel } from "../model/User.js";
import { AppError } from "../utils/AppError.js";
import { OAuth2Client } from "google-auth-library";
import { AuthIdentityModel } from "../model/AuthIdentity.js";

const googleOAuthClient = new OAuth2Client();

interface RegisterInput {
    name: string;
    email: string;
    password: string;
}

interface LoginInput {
    email: string;
    password: string;
}

export async function registerUser(data: RegisterInput) {
    const existingUser = await UserModel.findOne({
        email: data.email.toLowerCase(),
    });

    if (existingUser) {
        throw new AppError("User already exists", 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await UserModel.create({
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
    });

    const token = generateToken(user.id, user.sessionVersion);

    return {
        token,
        user: userInfo(user),
    };
}

export async function loginUser(data: LoginInput) {
    const user = await UserModel
        .findOne({ email: data.email.toLowerCase() })
        .select("+passwordHash");

    if (!user || !user.passwordHash) {
        throw new AppError("Invalid email or password", 401);
    }

    const passwordMatches = await bcrypt.compare(
        data.password,
        user.passwordHash
    );

    if (!passwordMatches) {
        throw new AppError("Invalid email or password", 401);
    }

    const token = generateToken(user.id, user.sessionVersion);

    return {
        token,
        user: userInfo(user),
    };
}

export async function loginWithGoogle(credential: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        throw new AppError(
            "Google sign-in is not configured",
            503,
            "GOOGLE_AUTH_NOT_CONFIGURED"
        );
    }

    let payload;
    try {
        const ticket = await googleOAuthClient.verifyIdToken({
            idToken: credential,
            audience: clientId,
        });
        payload = ticket.getPayload();
    } catch {
        throw new AppError(
            "Google credential is invalid or expired",
            401,
            "INVALID_GOOGLE_CREDENTIAL"
        );
    }

    if (
        !payload?.sub ||
        !payload.email ||
        payload.email_verified !== true
    ) {
        throw new AppError(
            "Google account must have a verified email",
            401,
            "UNVERIFIED_GOOGLE_ACCOUNT"
        );
    }

    const email = payload.email.trim().toLowerCase();
    const identity = await AuthIdentityModel.findOne({
        provider: "google",
        providerSubject: payload.sub,
    });

    if (identity) {
        const user = await UserModel.findById(identity.userId).select("+passwordHash");
        if (!user) {
            throw new AppError(
                "Google identity is not linked to an active account",
                404,
                "GOOGLE_ACCOUNT_NOT_FOUND"
            );
        }
        return authResult(user);
    }

    if (await UserModel.exists({ email })) {
        throw new AppError(
            "This email already has an account. Sign in with that method before linking Google.",
            409,
            "GOOGLE_ACCOUNT_LINK_REQUIRED"
        );
    }

    const user = await UserModel.create({
        name: payload.name?.trim() || email.split("@")[0],
        email,
        passwordHash: null,
    });

    try {
        await AuthIdentityModel.create({
            userId: user._id,
            provider: "google",
            providerSubject: payload.sub,
        });
    } catch (error) {
        await user.deleteOne();

        if (isDuplicateKeyError(error)) {
            const existingIdentity = await AuthIdentityModel.findOne({
                provider: "google",
                providerSubject: payload.sub,
            });
            if (existingIdentity) {
                const existingUser = await UserModel.findById(
                    existingIdentity.userId
                ).select("+passwordHash");
                if (existingUser) return authResult(existingUser);
            }

            if (await UserModel.exists({ email })) {
                throw new AppError(
                    "This email already has an account. Sign in with that method before linking Google.",
                    409,
                    "GOOGLE_ACCOUNT_LINK_REQUIRED"
                );
            }
        }

        throw error;
    }

    return authResult(user);
}

export async function getCurrentUser(userId: string) {
    const user = await UserModel.findById(userId).select("+passwordHash");

    if (!user) {
        throw new AppError("User not found", 404);
    }

    return userInfo(user);
}

export async function updateCurrentUser(
    userId: string,
    data: { name?: string; preferredCurrency?: string }
) {
    const user = await UserModel.findByIdAndUpdate(
        userId,
        { $set: data },
        { new: true, runValidators: true }
    ).select("+passwordHash");

    if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    return userInfo(user);
}

export async function changePassword(
    userId: string,
    data: { currentPassword: string; newPassword: string }
) {
    const user = await UserModel.findById(userId).select("+passwordHash");

    if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    if (!user.passwordHash) {
        throw new AppError(
            "Password is not configured for this account",
            409,
            "PASSWORD_NOT_CONFIGURED"
        );
    }

    if (!(await bcrypt.compare(data.currentPassword, user.passwordHash))) {
        throw new AppError("Current password is incorrect", 401, "INVALID_PASSWORD");
    }

    user.passwordHash = await bcrypt.hash(data.newPassword, 10);
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();

    return { reauthenticate: true };
}

export async function logoutUser(userId: string) {
    const result = await UserModel.updateOne(
        { _id: userId },
        { $inc: { sessionVersion: 1 } }
    );

    if (result.matchedCount === 0) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
}

function userInfo(user: {
    id: string;
    name: string;
    email: string;
    preferredCurrency?: string;
    timezone?: string;
    passwordHash?: string | null;
}) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        preferredCurrency: user.preferredCurrency ?? "INR",
        timezone: user.timezone ?? "Asia/Kolkata",
        hasPassword: Boolean(user.passwordHash),
    };
}

function authResult(user: {
    id: string;
    name: string;
    email: string;
    preferredCurrency?: string;
    timezone?: string;
    sessionVersion?: number;
    passwordHash?: string | null;
}) {
    return {
        token: generateToken(user.id, user.sessionVersion ?? 0),
        user: userInfo(user),
    };
}

function isDuplicateKeyError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
    );
}