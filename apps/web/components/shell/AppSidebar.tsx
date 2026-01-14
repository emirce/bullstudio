"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Database, LayoutDashboard, ListTodo } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@bullstudio/ui/components/sidebar";
import { Logo } from "./Logo";
import { UserNav } from "./UserNav";
import { WorkspaceSelector } from "./WorkspaceSelector";

export function AppSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const workspaceSlug = params.workspace as string | undefined;

  const navItems = [
    {
      title: "Overview",
      href: workspaceSlug ? `/${workspaceSlug}` : "/",
      icon: LayoutDashboard,
    },
    {
      title: "Jobs",
      href: workspaceSlug ? `/${workspaceSlug}/jobs` : "/jobs",
      icon: ListTodo,
    },
    {
      title: "Connections",
      href: workspaceSlug ? `/${workspaceSlug}/connections` : "/connections",
      icon: Database,
    },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Header with Logo */}
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
        <Logo />
      </SidebarHeader>

      {/* Workspace Selector */}
      <SidebarContent>
        <SidebarGroup className="py-2">
          <WorkspaceSelector />
        </SidebarGroup>

        <SidebarSeparator className="mx-0" />

        {/* Main Navigation */}
        <SidebarGroup className="py-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" &&
                    item.href !== `/${workspaceSlug}` &&
                    pathname.startsWith(item.href));

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className="h-10 transition-colors"
                    >
                      <Link href={item.href}>
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
      </SidebarContent>

      {/* Footer with User Nav */}
      <SidebarFooter>
        <SidebarSeparator className="mx-0 w-full" />
        <UserNav />
      </SidebarFooter>

      {/* Rail for resizing */}
      <SidebarRail />
    </Sidebar>
  );
}
