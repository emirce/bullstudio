import type { JobCounts } from "@bullstudio/connect-types";
import { Button } from "@bullstudio/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@bullstudio/ui/components/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Separator } from "@bullstudio/ui/components/separator";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { FailingJobTypesTable } from "@/components/overview/FailingJobTypesTable";
import { JobStateCards } from "@/components/overview/JobStateCards";
import { MetricCardsGrid } from "@/components/overview/MetricCardsGrid";
import { ProcessingTimeChart } from "@/components/overview/ProcessingTimeChart";
import { QueueCard } from "@/components/overview/QueueCard";
import { SlowestJobsTable } from "@/components/overview/SlowestJobsTable";
import { ThroughputChart } from "@/components/overview/ThroughputChart";
import { usePolling } from "@/components/PollingProvider";
import { useQueueSearch } from "@/components/QueueSearchProvider";
import { useTRPC } from "@/integrations/trpc/react";
import { queueRouteParam } from "@/lib/queue-key";
import { queueMatchesQuery } from "@/lib/queue-search";
import { TIME_RANGES } from "@/lib/time-ranges";

export const Route = createFileRoute("/")({ component: OverviewPage });

const EMPTY_COUNTS: JobCounts = {
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  paused: 0,
  prioritized: 0,
  waitingChildren: 0,
};

const JOB_COUNT_KEYS = Object.keys(EMPTY_COUNTS) as (keyof JobCounts)[];

const JOB_STATE_SKELETON_KEYS = [
  "state-1",
  "state-2",
  "state-3",
  "state-4",
  "state-5",
  "state-6",
];

const QUEUE_CARD_SKELETON_KEYS = [
  "queue-1",
  "queue-2",
  "queue-3",
  "queue-4",
  "queue-5",
  "queue-6",
];

const PERF_SKELETON_KEYS = ["perf-1", "perf-2", "perf-3", "perf-4"];

/**
 * Home dashboard aggregating every queue: a combined job-state snapshot, a grid
 * of per-queue cards grouped by prefix, and global performance metrics over a
 * selectable time range.
 */
function OverviewPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { enabled: pollEnabled, interval: pollInterval } = usePolling();
  const { query } = useQueueSearch();
  const [timeRange, setTimeRange] = useState<number>(5 / 60);

  const isFetching = useIsFetching() > 0;
  const refreshAll = () => queryClient.invalidateQueries();

  const { data: queues, isLoading: loadingQueues } = useQuery(
    trpc.queues.list.queryOptions(undefined, {
      refetchInterval: pollEnabled ? pollInterval : false,
    }),
  );

  // No queueName/prefix → the backend aggregates metrics across every queue.
  const { data: metrics, isLoading: loadingMetrics } = useQuery(
    trpc.overview.metrics.queryOptions(
      { timeRangeHours: timeRange },
      { refetchInterval: pollEnabled ? pollInterval : false },
    ),
  );

  const queueList = queues ?? [];

  if (queues && queueList.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No queues found</EmptyTitle>
          <EmptyDescription>
            It seems that you have not added any queues or we could not find
            them in your Redis. Connect some queues to get started.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="lg">
            <a
              href="https://bullstudio.dev/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              View docs <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  // Sum every queue's live counts into a single aggregate snapshot.
  const aggregatedCounts = queueList.reduce<JobCounts>(
    (acc, queue) => {
      if (!queue.jobCounts) return acc;
      for (const key of JOB_COUNT_KEYS) {
        acc[key] += queue.jobCounts[key] ?? 0;
      }
      return acc;
    },
    { ...EMPTY_COUNTS },
  );

  // The queue grid honors the shared search term (name or prefix); the
  // aggregate snapshot and performance metrics above stay global.
  const filteredQueues = queueList.filter((queue) =>
    queueMatchesQuery(queue, query),
  );
  const noMatches = query.trim().length > 0 && filteredQueues.length === 0;

  // Bucket queues by prefix, preserving backend order. When more than one
  // prefix exists each becomes its own labelled section (mirrors the sidebar).
  const queuesByPrefix = new Map<string, typeof filteredQueues>();
  for (const queue of filteredQueues) {
    const bucket = queuesByPrefix.get(queue.prefix ?? "");
    if (bucket) {
      bucket.push(queue);
    } else {
      queuesByPrefix.set(queue.prefix ?? "", [queue]);
    }
  }
  const hasMultiplePrefixes = queuesByPrefix.size > 1;

  const renderQueueCard = (queue: (typeof queueList)[number]) => {
    const routeParam = queueRouteParam(queue);
    return (
      <QueueCard
        key={routeParam}
        name={queue.name}
        queueParam={routeParam}
        counts={queue.jobCounts}
        isPaused={queue.isPaused}
      />
    );
  };

  return (
    <div className="flex flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold text-foreground">Overview</h1>
          <span className="text-xs text-muted-foreground">
            {queueList.length} {queueList.length === 1 ? "queue" : "queues"}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          disabled={isFetching}
          className="ml-auto bg-card"
        >
          <RefreshCw
            className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh page
        </Button>
      </header>

      <div className="space-y-6 pt-2">
        {/* Live job-state snapshot aggregated across all queues. */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Jobs distribution
          </h2>
          {loadingQueues ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {JOB_STATE_SKELETON_KEYS.map((key) => (
                <Skeleton key={key} className="h-20 w-full bg-zinc-800/50" />
              ))}
            </div>
          ) : (
            <JobStateCards counts={aggregatedCounts} />
          )}
        </section>

        <Separator />

        {/* All queues at a glance. */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Queues</h2>
          {loadingQueues ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {QUEUE_CARD_SKELETON_KEYS.map((key) => (
                <Skeleton key={key} className="h-32 w-full bg-zinc-800/50" />
              ))}
            </div>
          ) : noMatches ? (
            <p className="py-4 text-sm text-muted-foreground">
              No queues match “{query.trim()}”.
            </p>
          ) : hasMultiplePrefixes ? (
            <div className="space-y-6">
              {Array.from(queuesByPrefix, ([prefix, prefixQueues]) => (
                <div key={prefix} className="space-y-3">
                  <h3 className="font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                    {prefix}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {prefixQueues.map(renderQueueCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredQueues.map(renderQueueCard)}
            </div>
          )}
        </section>

        <Separator />

        {/* Performance metrics aggregated across all queues. */}
        <div className="flex w-full items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Performance
          </h2>
          <Select
            value={String(timeRange)}
            onValueChange={(value) => setTimeRange(Number(value))}
          >
            <SelectTrigger className="w-[150px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loadingMetrics ? (
          <PerformanceSkeleton />
        ) : metrics ? (
          <>
            <section className="space-y-3">
              <MetricCardsGrid
                summary={metrics.summary}
                timeSeries={metrics.timeSeries}
                timeRange={timeRange}
                nativeMetrics={metrics.nativeMetrics}
              />
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <ThroughputChart
                data={metrics.timeSeries}
                timeRange={timeRange}
                nativeMetrics={metrics.nativeMetrics}
              />
              <ProcessingTimeChart
                data={metrics.timeSeries}
                timeRange={timeRange}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SlowestJobsTable jobs={metrics.slowestJobs} queues={queueList} />
              <FailingJobTypesTable jobTypes={metrics.failingJobTypes} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Loading placeholder for the performance section (metric cards + charts). */
function PerformanceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PERF_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-32 w-full bg-zinc-800/50" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 w-full bg-zinc-800/50" />
        <Skeleton className="h-80 w-full bg-zinc-800/50" />
      </div>
    </div>
  );
}
