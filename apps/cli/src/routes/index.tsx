import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTRPC } from "@/integrations/trpc/react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Button } from "@bullstudio/ui/components/button";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { RefreshCw, Layers, Database } from "lucide-react";
import { EmptyState } from "@bullstudio/ui/shared";
import { MetricCardsGrid } from "@/components/overview/MetricCardsGrid";
import { ThroughputChart } from "@/components/overview/ThroughputChart";
import { ProcessingTimeChart } from "@/components/overview/ProcessingTimeChart";
import { SlowestJobsTable } from "@/components/overview/SlowestJobsTable";
import { FailingJobTypesTable } from "@/components/overview/FailingJobTypesTable";
import dayjs from "@bullstudio/dayjs";

export const Route = createFileRoute("/")({ component: OverviewPage });

const TIME_RANGES = [
  { value: "1", label: "Last 1h" },
  { value: "6", label: "Last 6h" },
  { value: "24", label: "Last 24h" },
  { value: "72", label: "Last 3d" },
  { value: "168", label: "Last 7d" },
];

const ALL_QUEUES_VALUE = "__all__";

function OverviewPage() {
  const trpc = useTRPC();
  const [queueName, setQueueName] = useState<string>("");
  const [timeRange, setTimeRange] = useState<number>(24);

  const { data: queues, isLoading: loadingQueues } = useQuery(
    trpc.queues.list.queryOptions()
  );

  const {
    data: metrics,
    isLoading: loadingMetrics,
    refetch,
    isFetching,
  } = useQuery(
    trpc.overview.metrics.queryOptions({
      timeRangeHours: timeRange,
      queueName: queueName || undefined,
    })
  );

  return (
    <div className="space-y-6">
      <Header title="Overview" />

      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={queueName || ALL_QUEUES_VALUE}
            onValueChange={(value) =>
              setQueueName(value === ALL_QUEUES_VALUE ? "" : value)
            }
            disabled={loadingQueues}
          >
            <SelectTrigger className="w-[200px] bg-zinc-900/50 border-zinc-800">
              <Layers className="size-4 mr-2 text-zinc-500" />
              <SelectValue placeholder="Select queue" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value={ALL_QUEUES_VALUE} className="text-zinc-100">
                All queues
              </SelectItem>
              {queues?.map((queue) => (
                <SelectItem
                  key={queue.name}
                  value={queue.name}
                  className="text-zinc-100 font-mono"
                >
                  {queue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(timeRange)}
            onValueChange={(value) => setTimeRange(Number(value))}
          >
            <SelectTrigger className="w-[130px] bg-zinc-900/50 border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              {TIME_RANGES.map((range) => (
                <SelectItem
                  key={range.value}
                  value={range.value}
                  className="text-zinc-100"
                >
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          {metrics?.lastUpdated && (
            <span className="text-xs text-zinc-500">
              Updated {dayjs(metrics.lastUpdated).fromNow()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800"
          >
            <RefreshCw
              className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      {loadingMetrics ? (
        <OverviewSkeleton />
      ) : queues && queues.length === 0 ? (
        <EmptyState
          icon={<Database className="size-12" />}
          title="No queues found"
          description="No BullMQ queues were found in the connected Redis instance. Make sure you have queues set up."
        />
      ) : metrics ? (
        <>
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
            <SlowestJobsTable jobs={metrics.slowestJobs} />
            <FailingJobTypesTable jobTypes={metrics.failingJobTypes} />
          </div>
        </>
      ) : null}
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
