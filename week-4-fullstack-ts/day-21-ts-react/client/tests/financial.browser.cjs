/* Local browser regression checks. Every API response is mocked; other origins are blocked. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const base = process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 4186}`;
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname)) throw new Error("Use a local test server, never the deployed site.");
const all = ["property:write", "renter:write", "lease:write", "finance:read", "payment:write", "maintenance:write", "organization:manage", "members:manage"];
const organizations = [
    { id: 11, name: "Test Owner Workspace", role: "OWNER", permissions: all },
    { id: 22, name: "Test Staff Workspace", role: "STAFF", permissions: ["maintenance:write"] }
];
const renters = [{ id: 1100, name: "Test Tenant", email: "tenant@example.test", phone: "+256700000001" }];
const invoices = [
    { id: 51, number: "INV-51", leaseId: 61, renterId: 1100, renterName: "Test Tenant", propertyName: "Test Property", unitNumber: "A1", periodStart: "2026-11-01", dueDate: "2026-11-05", amount: 250000, currency: "UGX", paid: 50000, outstanding: 200000, status: "PARTIAL" },
    { id: 52, number: "INV-52", leaseId: 61, renterId: 1100, renterName: "Test Tenant", propertyName: "Test Property", unitNumber: "A1", periodStart: "2026-12-01", dueDate: "2026-12-05", amount: 100000, currency: "UGX", paid: 0, outstanding: 100000, status: "UNPAID" }
];
const payments = [{ id: 71, renterId: 1100, amount: 100000, paymentDate: "2026-11-03", source: "LEGACY", receiptNumber: null, allocatedAmount: 0, unallocatedAmount: 100000, voidedAt: null }];
const deliveries = [];
let billingSettings = { billingDay: 1, monthlyBillingEnabled: false, remindersEnabled: false, currency: "UGX", timeZone: "Africa/Kampala" };
let providerReady = false, emailReady = false, publicScenario = "pending", calls = [], delayedTenant = null, dashboardFixtures = true;
function applyAllocation(payment, invoice, amount) {
    payment.allocatedAmount += amount; payment.unallocatedAmount -= amount;
    invoice.paid += amount; invoice.outstanding -= amount; invoice.status = invoice.outstanding === 0 ? "PAID" : "PARTIAL";
}
(async function() {
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Los_Angeles" });
        await context.addCookies([{ name: "fixture-session", value: "must-not-reach-public-status", url: base }]);
        const page = await context.newPage(); const runtimeErrors = [];
        await page.clock.install({ time: new Date("2026-11-11T09:00:00Z") });
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        await page.route("**/*", async function(route) {
            const request = route.request(), url = new URL(request.url());
            if (url.origin !== new URL(base).origin) return route.abort("blockedbyclient");
            if (!url.pathname.startsWith("/api/")) return route.continue();
            const endpoint = url.pathname.slice(4), method = request.method(), org = request.headers()["x-organization-id"];
            const body = method === "GET" ? {} : request.postDataJSON() || {};
            calls.push({ endpoint, method, org, body, headers: request.headers() });
            let status = 200, data = { data: [] }, headers = {};
            if (endpoint.startsWith("/payment-status/")) {
                assert.equal(org, undefined); assert.equal(request.headers().authorization, undefined); assert.equal(request.headers().cookie, undefined);
                if (endpoint.endsWith("/confirm")) {
                    if (publicScenario === "mismatch") { status = 400; data = { error: "Transaction does not match this payment reference." }; }
                    else if (publicScenario === "cooldown") { status = 429; headers["Retry-After"] = "10"; data = { error: "Please wait before checking again." }; }
                    else data = { data: { status: "SUCCESS", amount: 200000, currency: "UGX" } };
                } else data = { data: { status: publicScenario === "recover" ? "FAILED" : "PENDING", amount: 200000, currency: "UGX" } };
            } else if (endpoint === "/auth/me") { assert.equal(org, undefined); data = { id: 1, email: "owner@example.test" }; }
            else if (endpoint === "/organizations") { assert.equal(org, undefined); data = { data: organizations }; }
            else {
                assert.ok(["11", "22"].includes(org), `Missing validated workspace for ${method} ${endpoint}`);
                if (org === "22") assert.ok(!/^\/(billing|payments|reports|leases|organization\/billing-settings)/.test(endpoint), `Staff made financial request: ${endpoint}`);
                if (endpoint === "/renters" && method === "GET") data = { data: org === "11" ? renters : [{ id: 2200, name: "Staff Tenant" }] };
                else if (endpoint === "/renters/1100" && method === "PATCH") { Object.assign(renters[0], body); data = { data: renters[0] }; }
                else if (endpoint === "/renters" && method === "POST") { await new Promise((resolve) => { delayedTenant = resolve; }); data = { data: { id: 1199, name: body.name } }; }
                else if (endpoint === "/properties") data = { data: [{ id: Number(org), name: org === "11" ? "Test Property" : "Staff Property" }] };
                else if (endpoint === "/units") data = { data: [{ id: 111, number: "A1", propertyId: Number(org) }] };
                else if (endpoint === "/maintenance") data = { data: [] };
                else if (endpoint === "/leases") data = { data: [{ id: 61, renterId: 1100, unitId: 111, monthlyRent: 250000, renter: { isArchived: false }, unit: { id: 111, number: "A1", propertyId: 11 } }, ...(dashboardFixtures ? [{ id: 62, renterId: 1198, monthlyRent: 999999, renter: { isArchived: true } }] : [])] };
                else if (endpoint === "/leases/61" && method === "PATCH") data = { data: { id: 61, ...body } };
                else if (endpoint === "/billing/invoices") data = { data: invoices };
                else if (endpoint === "/billing/invoices/generate") { assert.match(body.month, /^\d{4}-\d{2}$/); data = { data: { created: 1, existing: 1 } }; }
                else if (endpoint === "/billing/allocations") { applyAllocation(payments.find((item) => item.id === body.paymentId), invoices.find((item) => item.id === body.invoiceId), body.amount); data = { data: { id: 1, ...body } }; }
                else if (endpoint === "/payments" && method === "GET") data = { data: [...payments, ...(dashboardFixtures ? [{ id: 90, amount: 900000, paymentDate: "2026-11-02T12:00:00Z", voidedAt: "2026-11-03T12:00:00Z" }, { id: 91, amount: 70000, paymentDate: "2026-10-31T22:00:00Z", voidedAt: null }] : [])] };
                else if (endpoint === "/payments" && method === "POST") {
                    const payment = { id: 72, ...body, source: "MANUAL", receiptNumber: "RCP-72", allocatedAmount: 0, unallocatedAmount: body.amount, voidedAt: null };
                    if (body.invoiceId) applyAllocation(payment, invoices.find((item) => item.id === body.invoiceId), Math.min(body.amount, invoices.find((item) => item.id === body.invoiceId).outstanding));
                    payments.push(payment); data = { data: payment };
                } else if (endpoint === "/payments/72/void") {
                    const payment = payments.find((item) => item.id === 72), invoice = invoices[0];
                    invoice.paid -= payment.allocatedAmount; invoice.outstanding += payment.allocatedAmount; invoice.status = "PARTIAL";
                    payment.voidedAt = "2026-11-11T12:00:00Z"; payment.voidReason = body.reason; data = { data: payment };
                } else if (/\/payment-link$/.test(endpoint)) { assert.equal(providerReady, true); data = { data: { id: "test-reference", status: "PENDING", checkoutUrl: "https://checkout.flutterwave.com/fixture-only", amount: body.amount, currency: "UGX" } }; status = 201; }
                else if (endpoint === "/billing/payment-provider") data = { data: { configured: providerReady, settlementConfigured: providerReady, provider: "FLUTTERWAVE", networks: ["MTN", "Airtel"], message: providerReady ? "MTN and Airtel checkout is configured for this landlord." : "Provider keys and this landlord’s approved settlement account are not configured." } };
                else if (endpoint === "/organization/billing-settings") { if (method === "PATCH") billingSettings = { ...billingSettings, ...body }; data = { data: billingSettings }; }
                else if (endpoint === "/billing/deliveries") data = { data: deliveries };
                else if (/\/pdf$|receipt\.pdf$|financial\.pdf$/.test(endpoint)) return route.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4\nFixture PDF\n%%EOF") });
                else if (/\/send$|\/send-receipt$/.test(endpoint)) {
                    if (!emailReady) { status = 503; data = { error: "Email delivery is not configured. Contact the platform operator." }; }
                    else { const job = { id: "job-1", kind: "INVOICE", status: "SENT", recipient: body.email, attempts: 1 }; deliveries.push(job); data = { data: job }; }
                } else if (endpoint === "/reports/arrears") data = { data: [{ renter: "Test Tenant", property: "Test Property", unit: "A1", invoicedAmount: 350000, monthlyRent: 350000, totalPaid: 150000, arrears: 200000, overdueInvoiceCount: 2 }] };
                else throw new Error(`Unhandled mocked route ${method} ${endpoint}`);
            }
            await route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(data) });
        });
        async function switchWorkspace(name) { await page.locator(".workspace-selector > summary").click(); await page.locator(".workspace-option").filter({ hasText: name }).click(); }
        async function openBilling() { await page.getByRole("link", { name: "Invoices & Receipts", exact: true }).click(); await page.getByText("INV-51", { exact: true }).waitFor(); }
        await page.goto(`${base}/`);
        await page.getByRole("heading", { name: "Collected This Month (UGX)", exact: true }).waitFor();
        assert.equal(await page.locator(".card").filter({ has: page.getByRole("heading", { name: "Collected This Month (UGX)", exact: true }) }).locator("p").innerText(), "170,000");
        assert.equal(await page.locator(".card").filter({ has: page.getByRole("heading", { name: "Potential Rent (UGX)", exact: true }) }).locator("p").innerText(), "250,000");
        assert.equal(await page.locator(".card").filter({ has: page.getByRole("heading", { name: "Active Tenants", exact: true }) }).locator("p").innerText(), "1");
        dashboardFixtures = false;
        console.log("PASS dashboard excludes voided payments and archived leases, and uses Kampala month boundaries despite a different browser timezone");
        await openBilling();
        assert.equal(await page.getByRole("button", { name: "MTN / Airtel payment link", exact: true }).first().isDisabled(), true);
        await page.getByText(/Provider keys and this landlord/).waitFor();
        const screenshotDir = process.env.SCREENSHOT_DIR || os.tmpdir();
        await page.screenshot({ path: path.join(screenshotDir, "remote-phase2-billing-desktop.png"), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(screenshotDir, "remote-phase2-billing-mobile.png"), fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390); await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByLabel("Invoice month", { exact: true }).fill("2026-11"); await page.getByRole("button", { name: "Generate monthly invoices", exact: true }).click();
        await page.getByRole("status").filter({ hasText: "1 invoice(s) created" }).waitFor();
        let invoiceRow = page.locator(".financial-table tbody tr").filter({ hasText: "INV-51" });
        const download = page.waitForEvent("download"); await invoiceRow.getByRole("button", { name: "Download PDF", exact: true }).click(); assert.equal((await download).suggestedFilename(), "INV-51.pdf");
        await invoiceRow.getByRole("button", { name: "Email PDF", exact: true }).click(); await invoiceRow.getByRole("button", { name: "Send email", exact: true }).click(); await invoiceRow.getByRole("alert").filter({ hasText: "not configured" }).waitFor();
        emailReady = true; await invoiceRow.getByRole("button", { name: "Send email", exact: true }).click(); await invoiceRow.getByRole("status").filter({ hasText: "accepted by the email provider" }).waitFor();
        providerReady = true; await page.reload(); await page.getByText("INV-51", { exact: true }).waitFor(); invoiceRow = page.locator(".financial-table tbody tr").filter({ hasText: "INV-51" });
        await invoiceRow.getByRole("button", { name: "MTN / Airtel payment link", exact: true }).click(); await invoiceRow.getByRole("button", { name: "Create secure payment link", exact: true }).click();
        assert.equal(await invoiceRow.getByRole("link", { name: "Open secure checkout", exact: true }).getAttribute("href"), "https://checkout.flutterwave.com/fixture-only");
        await invoiceRow.getByRole("button", { name: "Apply existing credit", exact: true }).click(); await invoiceRow.getByLabel("Available payment credit", { exact: true }).selectOption("71");
        await invoiceRow.getByLabel(/Amount to apply/).fill("50000"); await invoiceRow.getByRole("button", { name: "Apply credit", exact: true }).click();
        console.log("PASS invoice generation, PDF download, missing sender gate, accurate accepted email status, checkout capability gate, hosted link, legacy credit allocation");
        await page.getByRole("link", { name: "Rent Collection", exact: true }).click(); await page.getByLabel("Tenant", { exact: true }).selectOption("1100");
        await page.getByLabel("Allocate to invoice (optional)", { exact: true }).selectOption("51"); await page.getByLabel("Amount (whole UGX)", { exact: true }).fill("200000"); await page.getByLabel("Payment date", { exact: true }).fill("2026-11-11");
        await page.getByRole("button", { name: "Record Payment", exact: true }).click(); await page.getByText("RCP-72", { exact: true }).waitFor();
        assert.equal(payments[1].unallocatedAmount, 50000);
        const paymentRow = page.locator(".financial-table tbody tr").filter({ hasText: "RCP-72" });
        await paymentRow.getByRole("button", { name: "Void manual / legacy payment", exact: true }).click(); await paymentRow.getByLabel("Reason for voiding", { exact: true }).fill("Duplicate manual record");
        await paymentRow.getByRole("button", { name: "Confirm void", exact: true }).click(); await paymentRow.getByText("VOID", { exact: true }).waitFor();
        await page.getByRole("link", { name: "Reports", exact: true }).click(); await page.getByRole("columnheader", { name: "Due invoices total", exact: true }).waitFor();
        await page.getByLabel("Report", { exact: true }).selectOption("collections"); const reportDownload = page.waitForEvent("download"); await page.getByRole("button", { name: "Download PDF", exact: true }).click(); assert.match((await reportDownload).suggestedFilename(), /collections/);
        console.log("PASS manual invoice allocation/overpayment credit, void reason/history, invoice-arrears labels and financial report download");
        await page.getByRole("link", { name: "Tenants", exact: true }).click(); await page.getByRole("button", { name: "Edit", exact: true }).click();
        await page.getByLabel("Email (optional)", { exact: true }).fill("updated@example.test"); await page.getByLabel("Phone (optional)", { exact: true }).fill("+256700000002"); await page.getByRole("button", { name: "Save Changes", exact: true }).click();
        await page.getByRole("cell").filter({ hasText: "updated@example.test" }).waitFor(); assert.equal(renters[0].phone, "+256700000002");
        await page.getByRole("link", { name: "Settings", exact: true }).click(); await page.getByLabel("Monthly billing / due day (1–28)", { exact: true }).fill("10");
        assert.equal(await page.getByLabel("Create monthly invoices automatically", { exact: true }).isChecked(), false);
        await page.getByLabel("Create monthly invoices automatically", { exact: true }).check(); await page.getByLabel("Send due and overdue reminders", { exact: true }).check(); await page.getByRole("button", { name: "Save billing settings", exact: true }).click();
        await page.getByRole("status").filter({ hasText: "Billing settings saved" }).waitFor(); assert.equal(billingSettings.billingDay, 10); assert.equal(billingSettings.monthlyBillingEnabled, true);
        console.log("PASS optional tenant contacts and owner billing/reminder opt-ins with saved settings");
        await page.getByRole("link", { name: "Tenants", exact: true }).click(); await page.getByLabel("Name", { exact: true }).fill("Unsent draft"); await switchWorkspace("Test Staff Workspace");
        await page.getByRole("cell", { name: "Staff Tenant", exact: true }).waitFor(); assert.equal(await page.getByLabel("Name", { exact: true }).count(), 0); assert.equal(await page.getByRole("link", { name: "Invoices & Receipts", exact: true }).count(), 0);
        calls = []; await page.getByRole("link", { name: "Dashboard", exact: true }).click(); await page.getByRole("heading", { name: "Tenants", exact: true }).waitFor(); assert.ok(!calls.some((call) => /^\/(billing|payments|reports|leases)/.test(call.endpoint)));
        await page.goto(`${base}/billing`); await page.getByRole("heading", { name: "Access restricted" }).waitFor(); await switchWorkspace("Test Owner Workspace"); await page.getByText("INV-51", { exact: true }).waitFor();
        await page.getByRole("link", { name: "Tenants", exact: true }).click(); assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "");
        console.log("PASS workspace draft reset, organization headers, staff financial-query suppression and direct-route permission guard");
        // A pending old-workspace tenant save must not start a lease write after switching.
        await page.getByLabel("Name", { exact: true }).fill("Pending tenant"); await page.getByLabel("Unit", { exact: true }).selectOption("111"); await page.getByLabel("Monthly Rent (UGX)", { exact: true }).fill("250000");
        await page.getByRole("button", { name: "Add Renter", exact: true }).click(); await page.locator('.renters-form button[type="submit"]').filter({ hasText: "Saving" }).waitFor();
        while (!delayedTenant) await new Promise((resolve) => setTimeout(resolve, 10));
        await switchWorkspace("Test Staff Workspace"); await page.getByRole("cell", { name: "Staff Tenant", exact: true }).waitFor(); const beforeRelease = calls.length; delayedTenant(); await page.waitForTimeout(100);
        assert.ok(!calls.slice(beforeRelease).some((call) => call.method === "POST" && call.endpoint === "/leases"));
        console.log("PASS stale async tenant/lease chain stops after workspace switch");
        const reference = "f0000000-1111-4222-8333-000000000001";
        publicScenario = "pending"; calls = []; await page.goto(`${base}/payment-return?reference=${reference}&status=successful`); await page.getByRole("status").filter({ hasText: "Awaiting confirmation" }).waitFor();
        assert.equal(await page.getByRole("heading", { name: "Payment confirmed", exact: true }).count(), 0); assert.ok(!calls.some((call) => call.endpoint.endsWith("/confirm"))); assert.equal(await page.locator(".sidebar").count(), 0);
        publicScenario = "recover"; await page.goto(`${base}/payment-return?reference=${reference}&transaction_id=555&status=failed`); await page.getByRole("heading", { name: "Payment confirmed", exact: true }).waitFor();
        assert.ok(calls.some((call) => call.endpoint.endsWith("/confirm") && call.body.transactionId === "555"));
        publicScenario = "mismatch"; await page.goto(`${base}/payment-return?reference=${reference}&transaction_id=999&status=successful`); await page.getByRole("alert").filter({ hasText: "does not match" }).waitFor(); assert.equal(await page.getByRole("heading", { name: "Payment confirmed", exact: true }).count(), 0);
        publicScenario = "cooldown"; await page.goto(`${base}/payment-return?reference=${reference}&transaction_id=777`); await page.getByRole("button", { name: /Check again in/ }).waitFor(); assert.equal(await page.getByRole("button", { name: /Check again in/ }).isDisabled(), true);
        await page.setViewportSize({ width: 320, height: 780 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320); assert.deepEqual(runtimeErrors, []);
        console.log("PASS public callback ignores query success, recovers FAILED via authoritative confirm, rejects mismatches, respects cooldown, omits cookies/org headers, and has no runtime errors");
    } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
