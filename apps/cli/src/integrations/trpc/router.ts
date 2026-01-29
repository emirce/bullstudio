import { createTRPCRouter } from "./init";
import { jobRouter } from "./routers/job";
import { queueRouter } from "./routers/queue";
import { overviewRouter } from "./routers/overview";
import { connectionRouter } from "./routers/connection";

export const trpcRouter = createTRPCRouter({
  jobs: jobRouter,
  queues: queueRouter,
  overview: overviewRouter,
  connection: connectionRouter,
});

export type TRPCRouter = typeof trpcRouter;
