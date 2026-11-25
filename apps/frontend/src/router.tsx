import { createRouter } from "@tanstack/react-router";
import { getBasePath } from "@/lib/runtime-config";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
  const rqContext = TanstackQuery.getContext();

  const router = createRouter({
    routeTree,
    basepath: getBasePath(),
    context: { ...rqContext },
    defaultPreload: "intent",
    // The `$queueName` param carries a prefix-qualified composite key
    // (`prefix::name`, see queueRouteParam). Allow ":" through unencoded so the
    // URL stays readable and string-based active-route checks in the sidebar
    // match the live pathname instead of a percent-encoded "%3A%3A".
    pathParamsAllowedCharacters: [":"],
    // biome-ignore lint/correctness/noComponentHookFactories: getRouter runs once per app start, so Wrap keeps a stable identity; it closes over the query context created above.
    Wrap: (props: { children: React.ReactNode }) => {
      return (
        <TanstackQuery.Provider {...rqContext}>
          {props.children}
        </TanstackQuery.Provider>
      );
    },
  });

  return router;
};
