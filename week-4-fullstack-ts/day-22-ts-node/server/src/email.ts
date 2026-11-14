type VerificationEmailInput = {
    recipientEmail: string;
    verificationToken: string;
};

export async function sendVerificationEmail({
    recipientEmail,
    verificationToken
}: VerificationEmailInput) {
    const apiKey =process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || "REMOTE";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    if (!apiKey || !senderEmail) {
        throw new Error(
            "Email delivery environment variables are missing"
        );
    }

    const verificationUrl = new URL(
        "/verify-email",
        frontendUrl
    );

    verificationUrl.searchParams.set(
        "token",
        verificationToken
    );

    const response = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
            method: "POST",
            headers: {
                accept: "application/json",
                "api-key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sender: {
                    name: senderEmail,
                    email: senderEmail
                },
                to: [
                    {
                        email: recipientEmail
                    }
                ],
                subject: "Verify your REMOTE email address",
                textContent: `Verify your REMOTE address by opening this link:\n\n`+
                              verificationUrl.toString()+
                              `\n\nThis link expires in 30 minutes.`,
                htmlContent: `
                    <div style= "font-family: Arial, sans-serif;line-height:1.6;color:#153f37">
                    <h1>Verify your REMOTE email</h1>
                    <p>Confirm your email address to activate your account.</p>
                    <p>
                       <a
                            href="${verificationUrl.toString()}"
                            style="display:inline-block;padding:12px 20px;background:#236452;color:#ffffff;text-decoration:none;border-radius:8px">
                            Verify email
                        </a>
                            </p>
                            <p>This link expires in 30 minutes.</p>
                            <p>If you did not create this account, you can ignore this email.</p>
                    </div>
                    `
            })
        }
    );

    if(!response.ok){
        const responseText = await response.text();

        console.error(
            "Brevo email request failed:",
            response.status,
            responseText.slice(0, 500)
        );

        throw new Error("Could not send verification Email");
    }
}

type VerificationCodeEmailInput = {
    recipientEmail: string;
    verificationCode: string;
};

export async function sendVerificationCodeEmail({
    recipientEmail,
    verificationCode
}: VerificationCodeEmailInput) {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName =
        process.env.BREVO_SENDER_NAME || "REMOTE";

    if (!apiKey || !senderEmail) {
        throw new Error(
            "Email delivery environment variables are missing"
        );
    }

    const response = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
            method: "POST",
            headers: {
                accept: "application/json",
                "api-key": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sender: {
                    name: senderName,
                    email: senderEmail
                },
                to: [
                    {
                        email: recipientEmail
                    }
                ],
                subject: "Your REMOTE verification code",
                textContent:
                    `Your REMOTE verification code is: ${verificationCode}\n\n` +
                    "This code expires in 10 minutes.",
                htmlContent: `
                    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#153f37">
                        <h1>Verify your REMOTE email</h1>
                        <p>Enter this code on the verification page:</p>
                        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">
                            ${verificationCode}
                        </p>
                        <p>This code expires in 10 minutes.</p>
                        <p>If you did not create this account, you can ignore this email.</p>
                    </div>
                `
            })
        }
    );

    if (!response.ok) {
        const responseText = await response.text();

        console.error(
            "Brevo verification-code email failed:",
            response.status,
            responseText.slice(0, 500)
        );

        throw new Error(
            "Could not send verification code"
        );
    }
}