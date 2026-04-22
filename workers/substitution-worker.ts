import { SUBSTITUTION_QUEUE, createWorker } from "@/lib/queue";
import { runSubstitutions, type SubstitutionInput } from "@/lib/substitution";

export function startSubstitutionWorker() {
  const worker = createWorker<SubstitutionInput>(SUBSTITUTION_QUEUE, async (job) => {
    await runSubstitutions(job.data);
  });

  worker.on("failed", (job, err) => {
    console.error(`[substitution-worker] Job ${job?.id} failed:`, err);
  });

  console.log("[substitution-worker] Started");

  return worker;
}
