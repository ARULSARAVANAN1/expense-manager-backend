import { z } from "zod";
import { AppError } from "../utils/AppError.js";

export function configuredInteger(
    name: string,
    defaultValue: number,
    minimum: number,
    maximum: number
): number {
    const raw = process.env[name];
    if (raw === undefined || raw === "") return defaultValue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
        throw new AppError(
            `${name} must be an integer between ${minimum} and ${maximum}`,
            503,
            "AI_CONFIGURATION_INVALID"
        );
    }
    return value;
}

export function todayInTimeZone(timezone: string): string {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(new Date());
        const values = new Map(parts.map((part) => [part.type, part.value]));
        return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
    } catch {
        throw new AppError("The account timezone is invalid", 503, "USER_TIMEZONE_INVALID");
    }
}

export function aiConfiguration(feature: "parser" | "summary") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new AppError(
            `AI ${feature === "parser" ? "expense parsing" : "monthly summary"} is not configured`,
            503,
            feature === "parser" ? "AI_PARSER_NOT_CONFIGURED" : "AI_SUMMARY_NOT_CONFIGURED"
        );
    }
    if ((process.env.AI_PROVIDER ?? "groq").toLowerCase() !== "groq") {
        throw new AppError(
            `AI_PROVIDER must be set to groq for the configured ${feature}`,
            503,
            "AI_PROVIDER_NOT_SUPPORTED"
        );
    }
    return {
        apiKey,
        model: process.env.AI_MODEL?.trim() || "openai/gpt-oss-120b",
        timeoutMs: configuredInteger("AI_TIMEOUT_MS", 10000, 1000, 30000),
    };
}

export function createAiRateLimiter(
    environmentName: string,
    message: string
) {
    const buckets = new Map<string, { startedAt: number; count: number }>();
    return (userId: string): void => {
        const limit = configuredInteger(environmentName, 20, 1, 1000);
        const now = Date.now();
        for (const [key, bucket] of buckets) {
            if (now - bucket.startedAt >= 60 * 60 * 1000) buckets.delete(key);
        }
        const bucket = buckets.get(userId);
        if (bucket) {
            if (bucket.count >= limit) {
                throw new AppError(message, 429, "AI_RATE_LIMITED");
            }
            bucket.count += 1;
        } else {
            buckets.set(userId, { startedAt: now, count: 1 });
        }
    };
}

const providerContentSchema = z.object({
    choices: z.array(z.object({
        message: z.object({ content: z.string().max(20000) }),
    })).min(1).max(1),
}).passthrough();

export async function requestAiJson<T>(input: {
    apiKey: string;
    model: string;
    timeoutMs: number;
    operation: string;
    maxTokens: number;
    system: string;
    data: unknown;
    schema: z.ZodType<T>;
}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
    let responseText: string;
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${input.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: input.model,
                temperature: 0,
                max_completion_tokens: input.maxTokens,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: input.system },
                    { role: "user", content: JSON.stringify(input.data) },
                ],
            }),
        });
        if (!response.ok) throw providerError(response.status);
        responseText = await readBoundedResponse(response);
    } catch (error) {
        if (error instanceof AppError) throw error;
        if (controller.signal.aborted) {
            throw new AppError(`AI ${input.operation} timed out`, 503, "AI_PROVIDER_TIMEOUT");
        }
        throw new AppError(`AI ${input.operation} service is unavailable`, 503, "AI_PROVIDER_UNAVAILABLE");
    } finally {
        clearTimeout(timeout);
    }

    let responseBody: unknown;
    try {
        responseBody = JSON.parse(responseText);
    } catch {
        throw new AppError("AI provider returned an invalid response", 502, "AI_PROVIDER_INVALID_RESPONSE");
    }
    const content = providerContentSchema.safeParse(responseBody);
    if (!content.success) {
        throw new AppError("AI provider returned an invalid response", 502, "AI_PROVIDER_INVALID_RESPONSE");
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(content.data.choices[0].message.content);
    } catch {
        throw new AppError("AI provider returned invalid JSON", 502, "AI_PROVIDER_INVALID_JSON");
    }
    const result = input.schema.safeParse(parsed);
    if (!result.success) {
        throw new AppError("AI provider returned data in an unexpected format", 502, "AI_PROVIDER_INVALID_OUTPUT");
    }
    return result.data;
}

function providerError(status: number): AppError {
    if (status === 401 || status === 403) {
        return new AppError(
            "Groq rejected the API key. Check GROQ_API_KEY and its access permissions.",
            503, "AI_PROVIDER_AUTH_FAILED"
        );
    }
    if (status === 404) {
        return new AppError(
            "The configured AI model was not found. Set AI_MODEL to an active Groq model.",
            503, "AI_MODEL_UNAVAILABLE"
        );
    }
    if (status === 429) {
        return new AppError("AI provider quota or rate limit reached", 429, "AI_PROVIDER_RATE_LIMITED");
    }
    if (status >= 500) {
        return new AppError("AI provider is temporarily unavailable", 503, "AI_PROVIDER_UNAVAILABLE");
    }
    return new AppError(
        "Groq rejected the model or request. Check AI_MODEL and the Groq model documentation.",
        502, "AI_PROVIDER_REQUEST_REJECTED"
    );
}

async function readBoundedResponse(response: Response): Promise<string> {
    if (!response.body) {
        throw new AppError("AI provider returned an empty response", 502, "AI_PROVIDER_INVALID_RESPONSE");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > 65536) {
                await reader.cancel();
                throw new AppError("AI provider returned an oversized response", 502, "AI_PROVIDER_INVALID_RESPONSE");
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    const combined = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(combined);
}
