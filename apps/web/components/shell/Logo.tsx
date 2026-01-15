"use client";

import { cn } from "@bullstudio/ui/lib/utils";
import { useSidebar } from "@bullstudio/ui/components/sidebar";
import Image from "next/image";

interface LogoProps {
  className?: string;
  collapsed?: boolean;
}

export function Logo({ className, collapsed: collapsedProp }: LogoProps) {
  const sidebar = useSidebarSafe();
  const isCollapsed = collapsedProp ?? sidebar?.state === "collapsed";

  return (
    <div className="flex items-center gap-2.5 w-full">
      <Image src={"/logo.svg"} height={35} width={35} alt="Bullstudio Logo" />
      <span>bullstudio</span>
    </div>
  );
}

// Safe hook that doesn't throw if used outside SidebarProvider
function useSidebarSafe() {
  try {
    // This is a workaround since we can't conditionally call hooks
    // We use the exported useSidebar but catch the error
    const context = useSidebar();
    return context;
  } catch {
    return null;
  }
}
