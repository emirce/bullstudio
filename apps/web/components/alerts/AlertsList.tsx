"use client";

import { AlertCard } from "./AlertCard";
import type { RouterOutput } from "@/lib/trpc";

type Alert = RouterOutput["alert"]["list"][number];

type AlertsListProps = {
  alerts: Alert[];
};

export function AlertsList({ alerts }: AlertsListProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  );
}
