"use client";

import { LayoutDashboard, ListTodo } from "lucide-react";
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
} from "@bullstudio/ui/components/sidebar";

import { Link, useLocation } from "@tanstack/react-router";

export function AppSidebar() {
  const { pathname } = { pathname: "test" };

  const isActive = (href: string) => {
    return pathname.startsWith(href);
  };

  const navItems = [
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

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Header with Logo */}
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
        bullstudio
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
      </SidebarContent>

      {/* Rail for resizing */}
      <SidebarRail />
    </Sidebar>
  );
}
