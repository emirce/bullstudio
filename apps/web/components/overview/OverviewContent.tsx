"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useWorkspaceContext } from "@/components/providers/WorkspaceProvider";
import { OverviewHeader } from "./OverviewHeader";
import { MetricCardsGrid } from "./metrics/MetricCardsGrid";
import { ThroughputChart } from "./charts/ThroughputChart";
import { ProcessingTimeChart } from "./charts/ProcessingTimeChart";
import { SlowestJobsTable } from "./tables/SlowestJobsTable";
import { FailingJobTypesTable } from "./tables/FailingJobTypesTable";
import { AlertsActivityCard } from "./ActiveAlertsCard";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { Database } from "lucide-react";

export function OverviewContent() {
  const { workspaceId } = useWorkspaceContext();
  const [connectionId, setConnectionId] = useState<string>("");
  const [queueName, setQueueName] = useState<string>("");
  const [timeRange, setTimeRange] = useState<number>(24);

  const { data: connections, isLoading: loadingConnections } =
    trpc.redisConnection.list.useQuery({ workspaceId });

  const { data: queues, isLoading: loadingQueues } = trpc.queue.list.useQuery(
    { connectionId },
    { enabled: !!connectionId }
  );

  const {
    data: metrics,
    isLoading: loadingMetrics,
    refetch,
    isFetching,
  } = trpc.queue.overviewMetrics.useQuery(
    {
      connectionId,
      timeRangeHours: timeRange,
      queueName: queueName || undefined,
    },
    { enabled: !!connectionId, refetchInterval: 30000 }
  );

  useEffect(() => {
    if (connections && connections.length > 0 && !connectionId) {
      const firstConnection = connections[0];
      if (firstConnection) {
        setConnectionId(firstConnection.id);
      }
    }
  }, [connections, connectionId]);

  const handleConnectionChange = (newConnectionId: string) => {
    setConnectionId(newConnectionId);
    setQueueName("");
  };

  if (!connectionId || (connections && connections.length === 0)) {
    return (
      <div className="space-y-6">
        <OverviewHeader
          connections={connections ?? []}
          loadingConnections={loadingConnections}
          connectionId={connectionId}
          onConnectionChange={handleConnectionChange}
          queues={queues ?? []}
          loadingQueues={loadingQueues}
          queueName={queueName}
          onQueueChange={setQueueName}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          onRefresh={() => refetch()}
        />
        <EmptyState hasConnections={connections && connections.length > 0} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OverviewHeader
        connections={connections ?? []}
        loadingConnections={loadingConnections}
        connectionId={connectionId}
        onConnectionChange={handleConnectionChange}
        queues={queues ?? []}
        loadingQueues={loadingQueues}
        queueName={queueName}
        onQueueChange={setQueueName}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onRefresh={() => refetch()}
        lastUpdated={metrics?.lastUpdated}
        isRefreshing={isFetching}
      />

      {loadingMetrics ? (
        <OverviewSkeleton />
      ) : metrics ? (
        <>
          <AlertsActivityCard connectionId={connectionId} timeRangeHours={timeRange} />

          <MetricCardsGrid
            summary={metrics.summary}
            timeSeries={metrics.timeSeries}
            timeRange={timeRange}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <ThroughputChart data={metrics.timeSeries} timeRange={timeRange} />
            <ProcessingTimeChart
              data={metrics.timeSeries}
              timeRange={timeRange}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SlowestJobsTable
              jobs={metrics.slowestJobs}
              connectionId={connectionId}
            />
            <FailingJobTypesTable jobTypes={metrics.failingJobTypes} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function EmptyState({ hasConnections }: { hasConnections?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 border-dashed bg-zinc-900/30 p-12">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="text-zinc-600 mb-4">
          <Database className="size-12" />
        </div>
        <h3 className="text-lg font-medium text-zinc-300">
          {hasConnections ? "Select a connection" : "No connections found"}
        </h3>
        <p className="mt-1 text-sm text-zinc-500 max-w-sm">
          {hasConnections
            ? "Choose a Redis connection to view queue metrics and performance data"
            : "Add a Redis connection to start monitoring your queues"}
        </p>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full bg-zinc-800/50" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 w-full bg-zinc-800/50" />
        <Skeleton className="h-80 w-full bg-zinc-800/50" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 w-full bg-zinc-800/50" />
        <Skeleton className="h-96 w-full bg-zinc-800/50" />
      </div>
    </div>
  );
}
