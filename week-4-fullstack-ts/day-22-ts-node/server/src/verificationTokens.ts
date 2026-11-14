import crypto = require("crypto");

function getVerificationSecret() {
    const secret =
        process.env.VERIFICATION_CODE_SECRET ||
        process.env.JWT_SECRET;

    if (!secret) {
        throw new Error(
            "Verification code secret is missing"
        );
    }

    return secret;
}

export function createVerificationCode(email: string) {
    const code = crypto
        .randomInt(0, 1_000_000)
        .toString()
        .padStart(6, "0");

    return {
        code,
        codeHash: hashVerificationCode(email, code)
    };
}

export function hashVerificationCode(
    email: string,
    code: string
) {
    return crypto
        .createHmac("sha256", getVerificationSecret())
        .update(`${email.trim().toLowerCase()}:${code}`)
        .digest("hex");
}

export function verificationCodeMatches(
    email: string,
    code: string,
    storedHash: string
) {
    const suppliedHash = Buffer.from(
        hashVerificationCode(email, code),
        "hex"
    );

    const expectedHash = Buffer.from(
        storedHash,
        "hex"
    );

    return (
        suppliedHash.length === expectedHash.length &&
        crypto.timingSafeEqual(
            suppliedHash,
            expectedHash
        )
    );
}