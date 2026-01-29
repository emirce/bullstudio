"use client";

import { cn } from "../lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-800 border-dashed bg-zinc-900/30 p-12",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <div className="text-zinc-600 mb-4">{icon}</div>
        <h3 className="text-lg font-medium text-zinc-300">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500 max-w-sm">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
