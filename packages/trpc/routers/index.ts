import { router } from "../init";
import { onboardingRouter } from "./onboarding";
import { organizationRouter } from "./organization";
import { redisConnectionRouter } from "./redis-connection";
import { workspaceRouter } from "./workspace";

export const appRouter = router({
  onboarding: onboardingRouter,
  organization: organizationRouter,
  redisConnection: redisConnectionRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
