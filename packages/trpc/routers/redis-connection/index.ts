import { authedProcedure, router } from "../../init";
import { listRedisConnectionsSchema } from "./list.schema";
import { listRedisConnectionsHandler } from "./list.handler";
import { createRedisConnectionSchema } from "./create.schema";
import { createRedisConnectionHandler } from "./create.handler";
import { getRedisConnectionSchema } from "./get.schema";
import { getRedisConnectionHandler } from "./get.handler";
import { updateRedisConnectionSchema } from "./update.schema";
import { updateRedisConnectionHandler } from "./update.handler";
import { deleteRedisConnectionSchema } from "./delete.schema";
import { deleteRedisConnectionHandler } from "./delete.handler";
import { testRedisConnectionSchema } from "./test.schema";
import { testRedisConnectionHandler } from "./test.handler";

export const redisConnectionRouter = router({
  list: authedProcedure
    .input(listRedisConnectionsSchema)
    .query(({ ctx, input }) => listRedisConnectionsHandler({ ctx, input })),

  get: authedProcedure
    .input(getRedisConnectionSchema)
    .query(({ ctx, input }) => getRedisConnectionHandler({ ctx, input })),

  create: authedProcedure
    .input(createRedisConnectionSchema)
    .mutation(({ ctx, input }) => createRedisConnectionHandler({ ctx, input })),

  update: authedProcedure
    .input(updateRedisConnectionSchema)
    .mutation(({ ctx, input }) => updateRedisConnectionHandler({ ctx, input })),

  delete: authedProcedure
    .input(deleteRedisConnectionSchema)
    .mutation(({ ctx, input }) => deleteRedisConnectionHandler({ ctx, input })),

  test: authedProcedure
    .input(testRedisConnectionSchema)
    .mutation(({ ctx, input }) => testRedisConnectionHandler({ ctx, input })),
});
