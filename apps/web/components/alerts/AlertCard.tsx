"use client";

import { AlertType, AlertStatus } from "@bullstudio/prisma/browser";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bullstudio/ui/components/card";
import { Button } from "@bullstudio/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bullstudio/ui/components/dropdown-menu";
import {
  MoreVertical,
  Pencil,
  Trash2,
  Play,
  Pause,
  Activity,
} from "lucide-react";
import dayjs from "@bullstudio/dayjs";
import { AlertStatusBadge } from "./AlertStatusBadge";
import { useDialogStore } from "@/components/dialog/store";
import {
  EditAlertDialog,
  DeleteAlertDialog,
} from "@/components/dialog/registry";
import { trpc } from "@/lib/trpc";
import { toast } from "@bullstudio/ui/components/sonner";

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  [AlertType.FailureRate]: "Failure Rate",
  [AlertType.BacklogExceeded]: "Backlog Exceeded",
  [AlertType.ProcessingTimeAvg]: "Avg Processing Time",
  [AlertType.ProcessingTimeP95]: "P95 Processing Time",
  [AlertType.ProcessingTimeP99]: "P99 Processing Time",
  [AlertType.MissingWorkers]: "Missing Workers",
};

type AlertCardProps = {
  alert: {
    id: string;
    name: string;
    description: string | null;
    queueName: string;
    type: AlertType;
    config: unknown;
    recipients: string[];
    cooldownMinutes: number;
    enabled: boolean;
    status: AlertStatus;
    lastTriggeredAt: Date | null;
    lastResolvedAt: Date | null;
    lastCheckedAt: Date | null;
    lastValue: number | null;
    connection: {
      id: string;
      name: string;
    };
  };
};

export function AlertCard({ alert }: AlertCardProps) {
  const trigger = useDialogStore((s) => s.trigger);
  const utils = trpc.useUtils();

  const toggleEnabled = trpc.alert.update.useMutation({
    onSuccess: () => {
      toast.success(
        alert.enabled ? "Alert disabled" : "Alert enabled"
      );
      utils.alert.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const testAlert = trpc.alert.test.useMutation({
    onSuccess: (data) => {
      const result = data.evaluation;
      if (result.wouldTrigger) {
        toast.warning(`Alert would trigger: ${result.message}`);
      } else {
        toast.success(`Alert OK: ${result.message}`);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleEdit = () => {
    trigger({ component: EditAlertDialog, props: { alertId: alert.id } });
  };

  const handleDelete = () => {
    trigger({
      component: DeleteAlertDialog,
      props: { alertId: alert.id, alertName: alert.name },
    });
  };

  const handleToggle = () => {
    toggleEnabled.mutate({ id: alert.id, enabled: !alert.enabled });
  };

  const handleTest = () => {
    testAlert.mutate({ id: alert.id });
  };

  const config = alert.config as Record<string, unknown>;

  return (
    <Card
      className={`bg-zinc-900/50 border-zinc-800 ${!alert.enabled ? "opacity-60" : ""}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base text-zinc-100 truncate">
                {alert.name}
              </CardTitle>
              <AlertStatusBadge status={alert.status} />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="font-mono">{alert.queueName}</span>
              <span>•</span>
              <span>{alert.connection.name}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleTest}>
                <Activity className="size-4 mr-2" />
                Test Alert
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggle}>
                {alert.enabled ? (
                  <>
                    <Pause className="size-4 mr-2" />
                    Disable
                  </>
                ) : (
                  <>
                    <Play className="size-4 mr-2" />
                    Enable
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEdit}>
                <Pencil className="size-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">Type</span>
            <span className="text-zinc-300">
              {ALERT_TYPE_LABELS[alert.type]}
            </span>
          </div>

          {config.threshold !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Threshold</span>
              <span className="text-zinc-300 font-mono">
                {formatThreshold(alert.type, config.threshold as number)}
              </span>
            </div>
          )}

          {alert.lastValue !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Current Value</span>
              <span className="text-zinc-300 font-mono">
                {formatThreshold(alert.type, alert.lastValue)}
              </span>
            </div>
          )}

          {alert.lastCheckedAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Last Checked</span>
              <span className="text-zinc-400">
                {dayjs(alert.lastCheckedAt).fromNow()}
              </span>
            </div>
          )}

          {alert.status === AlertStatus.Triggered && alert.lastTriggeredAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Triggered</span>
              <span className="text-red-400">
                {dayjs(alert.lastTriggeredAt).fromNow()}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatThreshold(type: AlertType, value: number): string {
  switch (type) {
    case AlertType.FailureRate:
      return `${value.toFixed(1)}%`;
    case AlertType.BacklogExceeded:
      return `${Math.round(value)} jobs`;
    case AlertType.ProcessingTimeAvg:
    case AlertType.ProcessingTimeP95:
    case AlertType.ProcessingTimeP99:
      return formatMs(value);
    case AlertType.MissingWorkers:
      return `${Math.round(value)} workers`;
    default:
      return String(value);
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
