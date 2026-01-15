"use client";

import { AlertStatus } from "@bullstudio/prisma/browser";
import { cn } from "@bullstudio/ui/lib/utils";

type AlertStatusBadgeProps = {
  status: AlertStatus;
  className?: string;
};

export function AlertStatusBadge({ status, className }: AlertStatusBadgeProps) {
  const isTriggered = status === AlertStatus.Triggered;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        isTriggered
          ? "bg-red-500/10 text-red-500 border border-red-500/20"
          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isTriggered ? "bg-red-500 animate-pulse" : "bg-emerald-500"
        )}
      />
      {isTriggered ? "Triggered" : "OK"}
    </span>
  );
}
