import { TRPCRouterRecord } from "@trpc/server";
import { publicProcedure } from "../init";
import { getQueueProvider } from "../connection";
export const jobRouter = {
  list: publicProcedure.query(async () => {
    const provider = await getQueueProvider();
    const jobs = await provider.getJobs("printQueue", { limit: 5 });
    return jobs;
  }),
} satisfies TRPCRouterRecord;
