export class AppError extends Error {
    statusCode: number;
    code: string;
    errors?: unknown;

    constructor(
        message: string,
        statusCode: number,
        code = "REQUEST_FAILED",
        errors?: unknown
    ) {
        super(message);

        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.errors = errors;
    }
}