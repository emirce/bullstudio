import { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../init";
import { getQueueProvider } from "../connection";
import type { Queue } from "@bullstudio/connect-types";

export const queueRouter = {
  list: publicProcedure.query(async (): Promise<Queue[]> => {
    const provider = await getQueueProvider();
    return provider.getQueues();
  }),

  get: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }): Promise<Queue | null> => {
      const provider = await getQueueProvider();
      return provider.getQueue(input.name);
    }),

  pause: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const provider = await getQueueProvider();
      await provider.pauseQueue(input.name);
      return { success: true };
    }),

  resume: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input }) => {
      const provider = await getQueueProvider();
      await provider.resumeQueue(input.name);
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
