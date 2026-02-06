"use client";

import { LayoutDashboard, ListTodo, Github, Database, Workflow } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
} from "@bullstudio/ui/components/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import { useTRPC } from "@/integrations/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { VERSION } from "@/const";

export function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const trpc = useTRPC();

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions()
  );

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  // Build navigation items based on provider capabilities
  const baseNavItems = [
    {
      title: "Overview",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Jobs",
      href: "/jobs",
      icon: ListTodo,
    },
  ];

  // Only show Flows for providers that support it (BullMQ)
  const navItems = connectionInfo?.capabilities?.supportsFlows
    ? [
        ...baseNavItems,
        {
          title: "Flows",
          href: "/flows",
          icon: Workflow,
        },
      ]
    : baseNavItems;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Header with Logo */}
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="bullstudio"
            className="size-8 shrink-0"
          />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm text-zinc-100">
              bullstudio
            </span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              CLI
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup className="py-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-10 transition-colors"
                    >
                      <Link to={item.href}>
                        <item.icon className="size-4" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Redis Connection Info */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <div className="px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
              <div className="flex items-center gap-2 text-xs text-zinc-500 group-data-[collapsible=icon]:justify-center">
                <Database className="size-3.5 shrink-0 text-emerald-500" />
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-medium">Redis</span>
                    {connectionInfo?.providerType && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase">
                        {connectionInfo.providerType}
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-500 font-mono text-[11px]">
                    {connectionInfo?.displayUrl || "connecting..."}
                  </span>
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between text-xs text-zinc-500 group-data-[collapsible=icon]:justify-center">
          <span className="group-data-[collapsible=icon]:hidden">
            {VERSION}
          </span>
          <a
            href="https://github.com/emirce/bullstudio"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300 transition-colors"
          >
            <Github className="size-4" />
          </a>
        </div>
      </SidebarFooter>

      {/* Rail for resizing */}
      <SidebarRail />
    </Sidebar>
  );
}
