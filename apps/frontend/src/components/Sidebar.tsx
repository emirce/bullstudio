"use client";

import { Input } from "@bullstudio/ui/components/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@bullstudio/ui/components/sidebar";
import { cn } from "@bullstudio/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { Database, LayoutDashboard, LogOut, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { JobDistributionPie } from "@/components/overview/JobDistributionPie";
import { usePolling } from "@/components/PollingProvider";
import { useQueueSearch } from "@/components/QueueSearchProvider";
import { SettingsDialog } from "@/components/SettingsDialog";
import { VERSION } from "@/const";
import { useTRPC } from "@/integrations/trpc/react";
import { queueRouteParam } from "@/lib/queue-key";
import { queueMatchesQuery } from "@/lib/queue-search";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";
import {
  getAssetUrl,
  getAuthUrl,
  getBasePath,
  getDashboardIdentity,
} from "@/lib/runtime-config";

interface AuthSessionResponse {
  authEnabled?: boolean;
}

// lucide-react dropped brand/logo icons in v1, so these are inlined here.
function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="GitHub"
      {...props}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function TwitterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Twitter"
      {...props}
    >
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

/**
 * Dashboard sidebar: an overview link plus the queue list, grouped by prefix
 * when more than one is present, and a live Redis/queue-source connection
 * indicator.
 */
export function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const trpc = useTRPC();
  const dashboardIdentity = getDashboardIdentity();
  const dashboardLogo = dashboardIdentity?.logo;
  const dashboardTitle = dashboardIdentity?.title ?? "bullstudio";
  const { enabled: pollEnabled, interval: pollInterval } = usePolling();
  const { query, setQuery } = useQueueSearch();
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleSearch = () => {
    setSearchOpen((open) => {
      // Closing the search clears the active filter.
      if (open) setQuery("");
      return !open;
    });
  };

  const { data: connectionInfo, isError: connectionError } = useQuery(
    // Poll so the connection indicator reflects Redis going down/recovering
    // instead of staying frozen on the last successful fetch. Honors the
    // user's polling preference so we don't keep hitting Redis when disabled.
    trpc.connection.info.queryOptions(undefined, {
      refetchInterval: pollEnabled ? pollInterval : false,
    }),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;

  // If the status query itself fails the API is unreachable; treat that as the
  // worst case so the indicator never shows a stale "connected" state.
  const connectionStatus = connectionError
    ? "unavailable"
    : (queueSource?.status ?? null);

  const queueBasePath = (queueName: string) => `/queues/${queueName}`;

  const isQueueActive = (queueName: string) => {
    const base = queueBasePath(queueName);
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const queues = useQuery(trpc.queues.list.queryOptions());

  const queueList = queues.data ?? [];
  const filteredQueues = queueList.filter((queue) =>
    queueMatchesQuery(queue, query),
  );

  // Bucket queues by prefix so each Redis prefix can render as its own labelled
  // subsection. Insertion order is preserved (the backend already returns
  // queues grouped by prefix), and queue names are unique within a prefix.
  const queuesByPrefix = new Map<string, typeof filteredQueues>();
  for (const queue of filteredQueues) {
    const bucket = queuesByPrefix.get(queue.prefix ?? "");
    if (bucket) {
      bucket.push(queue);
    } else {
      queuesByPrefix.set(queue.prefix ?? "", [queue]);
    }
  }

  // Group by prefix whenever more than one is present. Derived from the queue
  // list itself (not queueSource.prefixes, which is empty in embedded mode) so
  // prefix headers show in both standalone and embedded dashboards.
  const hasMultiplePrefixes = queuesByPrefix.size > 1;

  const renderQueueItem = (queue: (typeof queueList)[number]) => {
    const routeParam = queueRouteParam(queue);
    const queueActive = isQueueActive(routeParam);

    return (
      <SidebarMenuItem key={routeParam}>
        <SidebarMenuButton
          asChild
          isActive={queueActive}
          tooltip={queue.name}
          className="h-9"
        >
          <Link
            to="/queues/$queueName"
            params={{ queueName: routeParam }}
            className="h-9"
          >
            {queue.jobCounts && (
              <JobDistributionPie
                counts={queue.jobCounts}
                className="group-data-[collapsible=icon]:hidden"
              />
            )}
            <span className="font-mono text-sm">{queue.name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="none" className="sticky top-0 h-svh border-r-0">
      {/* Header with Logo */}
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border px-4">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src={dashboardLogo?.src ?? getAssetUrl("/logo.svg")}
              alt={dashboardLogo?.alt ?? "bullstudio"}
              className="size-8 shrink-0"
            />
            <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold text-sm text-sidebar-foreground">
                {dashboardTitle}
              </span>
              <span className="text-[10px] text-sidebar-foreground/55 uppercase tracking-wider">
                {dashboardIdentity ? "Embedded" : "Standalone"}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={toggleSearch}
            aria-label="Search queues"
            aria-pressed={searchOpen}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50 group-data-[collapsible=icon]:hidden",
              searchOpen && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <Search className="size-4" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {searchOpen && (
          <div className="px-2 pt-2 group-data-[collapsible=icon]:hidden">
            <div className="relative">
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter queues…"
                className="h-9 bg-card pr-8 font-mono text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
        {/* Aggregate overview across all queues */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/"}
                  tooltip="Overview"
                  className="h-9"
                >
                  <Link to="/" className="h-9">
                    <LayoutDashboard className="size-4" />
                    <span className="text-sm">Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {query.trim() && filteredQueues.length === 0 ? (
          <div className="px-4 py-3 text-xs text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">
            No queues match “{query.trim()}”.
          </div>
        ) : hasMultiplePrefixes ? (
          Array.from(queuesByPrefix, ([prefix, prefixQueues]) => (
            <SidebarGroup key={prefix}>
              <SidebarGroupLabel className="font-mono">
                {prefix}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{prefixQueues.map(renderQueueItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Queues</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{filteredQueues.map(renderQueueItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Redis Connection Info */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <div className="px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
              <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:justify-center">
                <Database
                  className={cn(
                    "size-3.5 shrink-0",
                    connectionStatus === "healthy"
                      ? "text-emerald-500"
                      : connectionStatus === "degraded"
                        ? "text-amber-500"
                        : "text-destructive",
                  )}
                />
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-sidebar-foreground/80 font-medium">
                      {queueSource?.title ?? "Queue source"}
                    </span>
                    {queueSource?.providerLabel && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground uppercase">
                        {queueSource.providerLabel}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      connectionStatus === "degraded"
                        ? "text-amber-500"
                        : connectionStatus === "unavailable"
                          ? "text-destructive"
                          : "text-sidebar-foreground/60",
                    )}
                  >
                    {connectionStatus === "degraded"
                      ? "reconnecting…"
                      : connectionStatus === "unavailable"
                        ? "disconnected"
                        : queueSource?.detail || "connecting…"}
                  </span>
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="shrink-0 gap-3 border-t border-sidebar-border p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <SettingsDialog />
          <LogoutButton />
        </div>
        <div className="flex items-center justify-between text-xs text-sidebar-foreground/55 group-data-[collapsible=icon]:justify-center">
          <span className="group-data-[collapsible=icon]:hidden">
            {VERSION}
          </span>
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <a
              href="https://github.com/emirce/bullstudio"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sidebar-foreground transition-colors"
            >
              <GithubIcon className="size-4" />
            </a>
            <a
              href="https://x.com/emirthedev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sidebar-foreground transition-colors"
            >
              <TwitterIcon className="size-4" />
            </a>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function LogoutButton() {
  const [authEnabled, setAuthEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(getAuthUrl("/api/auth/session"), {
      credentials: "same-origin",
    })
      .then((response) => response.json())
      .then((session: AuthSessionResponse) => {
        if (!cancelled) {
          setAuthEnabled(session.authEnabled === true);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    await fetch(getAuthUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);

    window.location.assign(`${getBasePath()}/login`);
  };

  if (!authEnabled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={logout}
      title="Log out"
      className="flex h-8 flex-1 items-center justify-center gap-2 rounded-md text-sidebar-foreground/60 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none"
    >
      <LogOut className="size-4" />
      <span className="group-data-[collapsible=icon]:hidden">Log out</span>
    </button>
  );
}
