import { authedProcedure, router } from "../../init";
import {
  createAlertSchema,
  updateAlertSchema,
  deleteAlertSchema,
  listAlertsSchema,
  getAlertSchema,
  testAlertSchema,
} from "./alert.schema";
import { createAlertHandler } from "./create.handler";
import { updateAlertHandler } from "./update.handler";
import { deleteAlertHandler } from "./delete.handler";
import { listAlertsHandler } from "./list.handler";
import { getAlertHandler } from "./get.handler";
import { testAlertHandler } from "./test.handler";

export const alertRouter = router({
  create: authedProcedure
    .input(createAlertSchema)
    .mutation(({ ctx, input }) => createAlertHandler({ ctx, input })),

  update: authedProcedure
    .input(updateAlertSchema)
    .mutation(({ ctx, input }) => updateAlertHandler({ ctx, input })),

  delete: authedProcedure
    .input(deleteAlertSchema)
    .mutation(({ ctx, input }) => deleteAlertHandler({ ctx, input })),

  list: authedProcedure
    .input(listAlertsSchema)
    .query(({ ctx, input }) => listAlertsHandler({ ctx, input })),

  get: authedProcedure
    .input(getAlertSchema)
    .query(({ ctx, input }) => getAlertHandler({ ctx, input })),

  test: authedProcedure
    .input(testAlertSchema)
    .mutation(({ ctx, input }) => testAlertHandler({ ctx, input })),
});
