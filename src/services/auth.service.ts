import bcrypt from "bcryptjs";
import { generateToken } from "../utils/jwt.js";
import { UserModel } from "../model/User.js";
import { AppError } from "../utils/AppError.js";

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
        email: data.email,
    });

    if (existingUser) {
        throw new AppError("User already exists", 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await UserModel.create({
        name: data.name,
        email: data.email,
        passwordHash,
    });

    const token = generateToken(user.id);

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
        },
    };
}

export async function loginUser(data: LoginInput) {
    const user = await UserModel
        .findOne({ email: data.email })
        .select("+passwordHash");

    if (!user) {
        throw new AppError("Invalid email or password", 401);
    }

    const passwordMatches = await bcrypt.compare(
        data.password,
        user.passwordHash
    );

    if (!passwordMatches) {
        throw new AppError("Invalid email or password", 401);
    }

    const token = generateToken(user.id);

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
        },
    };
}

export async function getCurrentUser(userId: string) {
    const user = await UserModel.findById(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    return {
        id: user.id,
        name: user.name,
        email: user.email,
    };
}