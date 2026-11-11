import { prisma } from "../prisma";
import { runJobsOnce } from "./index";

async function main() {
    try {
        const result = await runJobsOnce();
        const outcomes = result.deliveries.reduce<Record<string, number>>((counts, job) => {
            counts[job.status] = (counts[job.status] ?? 0) + 1;
            return counts;
        }, {});
        console.log(JSON.stringify({ scheduled: result.scheduled, deliveryOutcomes: outcomes }));
        if (result.scheduled.organizationErrors) process.exitCode = 1;
    } catch {
        console.error("The billing/document job could not complete. Check database access and server configuration.");
        process.exitCode = 1;
    } finally { await prisma.$disconnect(); }
}
if (require.main === module) void main();
