import { TRPCRouterRecord } from "@trpc/server";
import { publicProcedure } from "../init";
import { getQueueProvider } from "../connection";
export const queueRouter = {
  list: publicProcedure.query(async () => {
    const provider = await getQueueProvider();
    const queues = await provider.getQueues();
    return queues;
  }),
} satisfies TRPCRouterRecord;
