import jwt from "jsonwebtoken";

interface JwtPayload {
    userId: string;
    sessionVersion: number;
}

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not defined");
    }

    return secret;
}

export function generateToken(
    userId: string,
    sessionVersion = 0
): string {
    return jwt.sign(
        { userId, sessionVersion },
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

    if (typeof decoded === "string" || typeof decoded.userId !== "string") {
        throw new Error("Invalid token");
    }

    return {
        userId: decoded.userId,
        sessionVersion:
            typeof decoded.sessionVersion === "number"
                ? decoded.sessionVersion
                : 0,
    };
}
