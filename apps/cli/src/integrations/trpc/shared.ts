import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { type TRPCRouter } from "./router";

export type RouterInput = inferRouterInputs<TRPCRouter>;
export type RouterOutput = inferRouterOutputs<TRPCRouter>;
