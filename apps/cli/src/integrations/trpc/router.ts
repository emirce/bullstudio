import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "./init";

import type { TRPCRouterRecord } from "@trpc/server";
import { jobRouter } from "./routers/job";
import { queueRouter } from "./routers/queue";

const todos = [
  { id: 1, name: "Get groceries" },
  { id: 2, name: "Buy a new phone" },
  { id: 3, name: "Finish the project" },
];

const todosRouter = {
  list: publicProcedure.query(() => {
    return todos;
  }),
  add: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input }) => {
      const newTodo = { id: todos.length + 1, name: input.name };
      todos.push(newTodo);
      return newTodo;
    }),
} satisfies TRPCRouterRecord;

export const trpcRouter = createTRPCRouter({
  todos: todosRouter,
  jobs: jobRouter,
  queues: queueRouter,
});
export type TRPCRouter = typeof trpcRouter;
