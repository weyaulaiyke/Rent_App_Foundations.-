export class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

export function positiveId(value: unknown, label = "ID"): number {
    if (typeof value !== "string" && typeof value !== "number") {
        throw new HttpError(400, `Invalid ${label}`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 2147483647) {
        throw new HttpError(400, `Invalid ${label}`);
    }
    return parsed;
}
