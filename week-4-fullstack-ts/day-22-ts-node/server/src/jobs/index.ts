import { scheduleBillingAndReminders } from "./scheduler";
import { processDeliveryQueue } from "./worker";
export { scheduleBillingAndReminders } from "./scheduler";
export { processDeliveryQueue, runDeliveryJob, queueDocumentDelivery } from "./worker";

export async function runJobsOnce(now = new Date()) {
    const scheduled = await scheduleBillingAndReminders(now);
    const deliveries = await processDeliveryQueue(25, now);
    return { scheduled, deliveries };
}
