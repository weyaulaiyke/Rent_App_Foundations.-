import "./AuthPage.css";

export default function RenterPaymentPage() {
    return (
        <main className="remote-auth-page">
            <section className="remote-auth-card" aria-labelledby="rent-payment-heading">
                <div className="remote-auth-brand">
                    <span className="remote-auth-brand-mark" aria-hidden="true">R</span>
                    <div>
                        <div className="remote-auth-brand-name">REMOTE</div>
                        <div className="remote-auth-brand-caption">Property Management</div>
                    </div>
                </div>

                <h1 id="rent-payment-heading" className="remote-auth-heading">
                    Rent payments
                </h1>

                <h2>Payment options</h2>
                <p className="remote-auth-intro">
                    Online payments are coming soon. For now, use the payment
                    instructions your landlord shared with you.
                </p>

                <ul>
                    <li>MTN Mobile Money</li>
                    <li>Airtel Money</li>
                    <li>Bank transfer</li>
                </ul>
            </section>
        </main>
    );
}