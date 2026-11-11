import { z } from "zod";
import { HttpError } from "./http";

export type EmailAttachment = { name: string; content: Buffer };
export type TransactionalEmail = {
    recipient: string;
    subject: string;
    html: string;
    idempotencyKey: string;
    attachments?: EmailAttachment[];
};

export function assertMailConfigured(): void {
    if (!process.env.BREVO_API_KEY?.trim() || !z.email().safeParse(process.env.EMAIL_FROM).success) {
        throw new HttpError(503, "Email delivery is not configured. Ask the account administrator to configure the verified sender.");
    }
}

export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]!));
}

export async function sendTransactionalEmail(message: TransactionalEmail): Promise<void> {
    assertMailConfigured();
    if (!z.email().safeParse(message.recipient).success) throw new Error("The recipient email is invalid");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            signal: controller.signal,
            headers: {
                "api-key": process.env.BREVO_API_KEY!,
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({
                sender: { name: "REMOTE", email: process.env.EMAIL_FROM! },
                to: [{ email: message.recipient }],
                subject: message.subject,
                htmlContent: message.html,
                headers: { idempotencyKey: message.idempotencyKey },
                ...(message.attachments?.length ? {
                    attachment: message.attachments.map(attachment => ({
                        name: attachment.name,
                        content: attachment.content.toString("base64")
                    }))
                } : {})
            })
        });
        if (response.ok) return;
        // Brevo reports a reused idempotency key as duplicate_parameter. It has
        // already accepted that exact durable job; do not send another copy.
        const result: unknown = await response.json().catch(() => null);
        if (response.status === 400 && typeof result === "object" && result !== null &&
            "code" in result && result.code === "duplicate_parameter" &&
            "message" in result && typeof result.message === "string" &&
            /email for the idempotency key has already been processed/i.test(result.message)) return;
        throw new Error("The email provider did not accept the message");
    } finally {
        clearTimeout(timeout);
    }
}
