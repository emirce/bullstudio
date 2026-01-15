"use client";

import { useMemo } from "react";
import { AlertTriangle, Bell, CheckCircle, ChevronRight } from "lucide-react";
import { AlertType } from "@bullstudio/prisma/browser";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bullstudio/ui/components/card";
import { Button } from "@bullstudio/ui/components/button";
import dayjs from "@bullstudio/dayjs";
import Link from "next/link";
import { useWorkspaceContext } from "@/components/providers/WorkspaceProvider";
import { trpc } from "@/lib/trpc";

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  [AlertType.FailureRate]: "Failure Rate",
  [AlertType.BacklogExceeded]: "Backlog",
  [AlertType.ProcessingTimeAvg]: "Avg Time",
  [AlertType.ProcessingTimeP95]: "P95 Time",
  [AlertType.ProcessingTimeP99]: "P99 Time",
  [AlertType.MissingWorkers]: "No Workers",
};

type AlertActivity = {
  id: string;
  alertId: string;
  name: string;
  queueName: string;
  type: AlertType;
  status: "triggered" | "resolved";
  timestamp: Date;
  value: number | null;
};

type AlertsActivityCardProps = {
  connectionId: string;
  timeRangeHours: number;
};

export function AlertsActivityCard({
  connectionId,
  timeRangeHours,
}: AlertsActivityCardProps) {
  const { workspaceId, workspaceSlug } = useWorkspaceContext();

  const { data: alerts } = trpc.alert.list.useQuery(
    {
      workspaceId,
      connectionId,
    },
    { refetchInterval: 30000 }
  );

  const alertActivity = useMemo(() => {
    if (!alerts) return [];

    const cutoffTime = dayjs().subtract(timeRangeHours, "hours");
    const activity: AlertActivity[] = [];

    for (const alert of alerts) {
      if (
        alert.lastTriggeredAt &&
        dayjs(alert.lastTriggeredAt).isAfter(cutoffTime)
      ) {
        activity.push({
          id: `${alert.id}-triggered`,
          alertId: alert.id,
          name: alert.name,
          queueName: alert.queueName,
          type: alert.type,
          status: "triggered",
          timestamp: new Date(alert.lastTriggeredAt),
          value: alert.lastValue,
        });
      }

      if (
        alert.lastResolvedAt &&
        dayjs(alert.lastResolvedAt).isAfter(cutoffTime)
      ) {
        activity.push({
          id: `${alert.id}-resolved`,
          alertId: alert.id,
          name: alert.name,
          queueName: alert.queueName,
          type: alert.type,
          status: "resolved",
          timestamp: new Date(alert.lastResolvedAt),
          value: alert.lastValue,
        });
      }
    }

    return activity.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }, [alerts, timeRangeHours]);

  const triggeredCount = alertActivity.filter(
    (a) => a.status === "triggered"
  ).length;
  const resolvedCount = alertActivity.filter(
    (a) => a.status === "resolved"
  ).length;

  if (alertActivity.length === 0) {
    return null;
  }

  const hasActiveAlerts = triggeredCount > 0;

  return (
    <Card
      className={
        hasActiveAlerts
          ? "bg-red-500/5 border-red-500/20"
          : "bg-emerald-500/5 border-emerald-500/20"
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle
            className={`text-base flex items-center gap-2 ${hasActiveAlerts ? "text-red-400" : "text-emerald-400"}`}
          >
            <Bell className="size-4" />
            Alert Activity
            {triggeredCount > 0 && (
              <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                {triggeredCount} triggered
              </span>
            )}
            {resolvedCount > 0 && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                {resolvedCount} resolved
              </span>
            )}
          </CardTitle>
          <Link href={`/${workspaceSlug}/alerts`}>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 ${hasActiveAlerts ? "text-red-400" : "text-emerald-400"}`}
            >
              View All
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {alertActivity.slice(0, 5).map((activity) => (
            <div
              key={activity.id}
              className={`flex items-center justify-between py-2 border-b last:border-0 ${
                activity.status === "triggered"
                  ? "border-red-500/10"
                  : "border-emerald-500/10"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {activity.status === "triggered" ? (
                    <AlertTriangle className="size-3.5 text-red-400 shrink-0" />
                  ) : (
                    <CheckCircle className="size-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-sm text-zinc-200 truncate">
                    {activity.name}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      activity.status === "triggered"
                        ? "text-red-400/70 bg-red-500/10"
                        : "text-emerald-400/70 bg-emerald-500/10"
                    }`}
                  >
                    {ALERT_TYPE_LABELS[activity.type]}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 pl-5">
                  <span className="font-mono">{activity.queueName}</span>
                  <span>
                    {" "}
                    • {activity.status} {dayjs(activity.timestamp).fromNow()}
                  </span>
                </div>
              </div>
              {activity.value !== null && activity.status === "triggered" && (
                <span className="text-sm font-mono text-red-400 ml-2">
                  {formatValue(activity.type, activity.value)}
                </span>
              )}
            </div>
          ))}
          {alertActivity.length > 5 && (
            <div
              className={`text-xs text-center pt-1 ${hasActiveAlerts ? "text-red-400/70" : "text-emerald-400/70"}`}
            >
              +{alertActivity.length - 5} more events
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatValue(type: AlertType, value: number): string {
  switch (type) {
    case AlertType.FailureRate:
      return `${value.toFixed(1)}%`;
    case AlertType.BacklogExceeded:
      return `${Math.round(value)}`;
    case AlertType.ProcessingTimeAvg:
    case AlertType.ProcessingTimeP95:
    case AlertType.ProcessingTimeP99:
      if (value < 1000) return `${Math.round(value)}ms`;
      if (value < 60000) return `${(value / 1000).toFixed(1)}s`;
      return `${(value / 60000).toFixed(1)}m`;
    case AlertType.MissingWorkers:
      return `${Math.round(value)}`;
    default:
      return String(value);
  }
}
