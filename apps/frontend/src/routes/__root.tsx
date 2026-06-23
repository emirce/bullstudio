import {
  SidebarInset,
  SidebarProvider,
} from "@bullstudio/ui/components/sidebar";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { Toaster } from "sonner";
import { AppSidebar } from "@/components/Sidebar";
import type { TRPCRouter } from "@/integrations/trpc/router";
import { getAssetUrl, getDocumentIdentity } from "@/lib/runtime-config";
import appCss from "../styles.css?url";

import "../styles.css";
import { PollingProvider } from "@/components/PollingProvider";
import { QueueSearchProvider } from "@/components/QueueSearchProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

interface MyRouterContext {
  queryClient: QueryClient;
  trpc: TRPCOptionsProxy<TRPCRouter>;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: getDocumentIdentity()?.title ?? "bullstudio - Queue dashboard",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: getAssetUrl(appCss),
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: getDocumentIdentity()?.favicon ?? getAssetUrl("/logo.svg"),
      },
    ],
  }),

  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  return (
    <>
      <HeadContent />
      <ThemeProvider defaultTheme="dark">
        <PollingProvider>
          {isLogin ? (
            children
          ) : (
            <QueueSearchProvider>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset className="h-svh overflow-hidden">
                  <main className="flex flex-1 flex-col overflow-y-auto p-6">
                    {children}
                  </main>
                </SidebarInset>
              </SidebarProvider>
            </QueueSearchProvider>
          )}
          <Toaster theme="dark" position="bottom-right" richColors />
        </PollingProvider>
      </ThemeProvider>
    </>
  );
}
