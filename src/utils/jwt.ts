import jwt from "jsonwebtoken";

interface JwtPayload {
    userId: string;
}

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not defined");
    }

    return secret;
}

export function generateToken(userId: string): string {
    return jwt.sign(
        { userId },
        getJwtSecret(),
        {
            expiresIn: "1d",
        }
    );
}

export function verifyToken(token: string): JwtPayload {
    const decoded = jwt.verify(
        token,
        getJwtSecret()
    );

    if (
        typeof decoded === "string" ||
        typeof decoded.userId !== "string"
    ) {
        throw new Error("Invalid token");
    }

    return {
        userId: decoded.userId,
    };
}
