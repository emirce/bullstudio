"use client";

import { cn } from "../lib/utils";

export type JobStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "paused"
  | "prioritized"
  | "waiting-children";

const statusConfig: Record<
  JobStatus,
  { label: string; className: string; dotClassName: string }
> = {
  waiting: {
    label: "Waiting",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dotClassName: "bg-amber-400",
  },
  active: {
    label: "Active",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dotClassName: "bg-blue-400 animate-pulse",
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dotClassName: "bg-emerald-400",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    dotClassName: "bg-red-400",
  },
  delayed: {
    label: "Delayed",
    className: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    dotClassName: "bg-violet-400",
  },
  paused: {
    label: "Paused",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    dotClassName: "bg-zinc-400",
  },
  prioritized: {
    label: "Prioritized",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    dotClassName: "bg-orange-400",
  },
  "waiting-children": {
    label: "Waiting",
    className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    dotClassName: "bg-cyan-400",
  },
};

interface JobStatusBadgeProps {
  status: JobStatus;
  size?: "sm" | "md" | "lg";
  showDot?: boolean;
  className?: string;
}

export function JobStatusBadge({
  status,
  size = "md",
  showDot = true,
  className,
}: JobStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.waiting;

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-1 gap-1.5",
    lg: "text-sm px-3 py-1.5 gap-2",
  };

  const dotSizes = {
    sm: "size-1.5",
    md: "size-2",
    lg: "size-2.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-medium rounded-md border uppercase tracking-wider",
        sizeClasses[size],
        config.className,
        className
      )}
    >
      {showDot && (
        <span
          className={cn("rounded-full", dotSizes[size], config.dotClassName)}
        />
      )}
      {config.label}
    </span>
  );
}

export function getStatusColor(status: JobStatus): string {
  const colors: Record<JobStatus, string> = {
    waiting: "#f59e0b",
    active: "#3b82f6",
    completed: "#10b981",
    failed: "#ef4444",
    delayed: "#8b5cf6",
    paused: "#71717a",
    prioritized: "#f97316",
    "waiting-children": "#06b6d4",
  };
  return colors[status] ?? colors.waiting;
}
