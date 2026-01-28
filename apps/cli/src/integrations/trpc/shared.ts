import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { TRPCRouter } from "./router";

export type RouterInput = inferRouterInputs<TRPCRouter>;
export type RouterOutput = inferRouterOutputs<TRPCRouter>;
