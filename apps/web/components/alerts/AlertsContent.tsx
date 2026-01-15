"use client";

import { useState } from "react";
import { Bell, Plus, Database } from "lucide-react";
import { AlertStatus, AlertType } from "@bullstudio/prisma/browser";
import { Button } from "@bullstudio/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { trpc } from "@/lib/trpc";
import { useWorkspaceContext } from "@/components/providers/WorkspaceProvider";
import { useDialogStore } from "@/components/dialog/store";
import { CreateAlertDialog } from "@/components/dialog/registry";
import { AlertsList } from "./AlertsList";

const ALL_VALUE = "__all__";

const ALERT_TYPE_OPTIONS = [
  { value: ALL_VALUE, label: "All Types" },
  { value: AlertType.FailureRate, label: "Failure Rate" },
  { value: AlertType.BacklogExceeded, label: "Backlog Exceeded" },
  { value: AlertType.ProcessingTimeAvg, label: "Avg Processing Time" },
  { value: AlertType.ProcessingTimeP95, label: "P95 Processing Time" },
  { value: AlertType.ProcessingTimeP99, label: "P99 Processing Time" },
  { value: AlertType.MissingWorkers, label: "Missing Workers" },
];

const STATUS_OPTIONS = [
  { value: ALL_VALUE, label: "All Statuses" },
  { value: AlertStatus.Triggered, label: "Triggered" },
  { value: AlertStatus.OK, label: "OK" },
];

export function AlertsContent() {
  const { workspaceId } = useWorkspaceContext();
  const trigger = useDialogStore((s) => s.trigger);
  const [connectionId, setConnectionId] = useState<string>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);
  const [typeFilter, setTypeFilter] = useState<string>(ALL_VALUE);

  const { data: connections, isLoading: loadingConnections } =
    trpc.redisConnection.list.useQuery({ workspaceId });

  const { data: alerts, isLoading: loadingAlerts } = trpc.alert.list.useQuery({
    workspaceId,
    connectionId: connectionId !== ALL_VALUE ? connectionId : undefined,
    status:
      statusFilter !== ALL_VALUE ? (statusFilter as AlertStatus) : undefined,
    type: typeFilter !== ALL_VALUE ? (typeFilter as AlertType) : undefined,
  });

  const handleCreateAlert = () => {
    if (!connections || connections.length === 0) return;
    const selectedConnectionId =
      connectionId !== ALL_VALUE ? connectionId : connections[0]?.id;
    if (selectedConnectionId) {
      trigger({
        component: CreateAlertDialog,
        props: { connectionId: selectedConnectionId, workspaceId },
      });
    }
  };

  const triggeredCount = alerts?.filter(
    (a) => a.status === AlertStatus.Triggered
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={connectionId}
            onValueChange={setConnectionId}
            disabled={loadingConnections}
          >
            <SelectTrigger className="w-[200px] bg-zinc-900/50 border-zinc-800">
              <Database className="size-4 mr-2 text-zinc-500" />
              <SelectValue placeholder="All connections" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value={ALL_VALUE} className="text-zinc-100">
                All connections
              </SelectItem>
              {connections?.map((connection) => (
                <SelectItem
                  key={connection.id}
                  value={connection.id}
                  className="text-zinc-100"
                >
                  {connection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-zinc-900/50 border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              {STATUS_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-zinc-100"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] bg-zinc-900/50 border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              {ALERT_TYPE_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-zinc-100"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {triggeredCount !== undefined && triggeredCount > 0 && (
            <span className="text-sm bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
              {triggeredCount} triggered
            </span>
          )}
        </div>

        <Button
          onClick={handleCreateAlert}
          disabled={!connections || connections.length === 0}
        >
          <Plus className="size-4 mr-2" />
          Create Alert
        </Button>
      </div>

      {loadingAlerts ? (
        <AlertsSkeleton />
      ) : alerts && alerts.length > 0 ? (
        <AlertsList alerts={alerts} />
      ) : (
        <EmptyState
          hasConnections={!!connections && connections.length > 0}
          onCreateAlert={handleCreateAlert}
        />
      )}
    </div>
  );
}

function EmptyState({
  hasConnections,
  onCreateAlert,
}: {
  hasConnections: boolean;
  onCreateAlert: () => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 border-dashed bg-zinc-900/30 p-12">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="text-zinc-600 mb-4">
          <Bell className="size-12" />
        </div>
        <h3 className="text-lg font-medium text-zinc-300">No alerts found</h3>
        <p className="mt-1 text-sm text-zinc-500 max-w-sm">
          {hasConnections
            ? "Create an alert to monitor queue health and receive notifications"
            : "Add a Redis connection first to create alerts"}
        </p>
        {hasConnections && (
          <Button onClick={onCreateAlert} className="mt-4">
            <Plus className="size-4 mr-2" />
            Create Alert
          </Button>
        )}
      </div>
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-48 w-full bg-zinc-800/50" />
      ))}
    </div>
  );
}
