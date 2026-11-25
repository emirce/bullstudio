import type { OverviewMetricsResponse } from "@bullstudio/private-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bullstudio/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table";
import { formatDuration } from "@bullstudio/ui/shared";
import { useNavigate } from "@tanstack/react-router";
import { DEFAULT_JOBS_SEARCH } from "@/lib/jobs";
import { queueRouteParam } from "@/lib/queue-key";

type SlowJob = OverviewMetricsResponse["slowestJobs"][number];

type SlowestJobsTableProps = {
  jobs: SlowJob[];
  /**
   * Prefix-qualified route param when the table is scoped to a single queue.
   * Omit it on the global overview and pass `queues` instead so each row links
   * to the queue the job actually belongs to.
   */
  queueParam?: string;
  /**
   * Queue list used to resolve a row's destination by job `queueName` when the
   * table spans multiple queues (global overview). Ignored when `queueParam`
   * is provided.
   */
  queues?: ReadonlyArray<{ name: string; prefix?: string }>;
};

/**
 * Table of the slowest jobs by processing time. Rows link to the originating
 * queue's job view — scoped to a single queue via `queueParam`, or resolved
 * per row from `queues` when rendered on the global overview.
 *
 * @param jobs - Slowest jobs to render, already sorted by processing time.
 * @param queueParam - Fixed queue route param when the table is scoped to one queue.
 * @param queues - Queue list used to resolve a row's queue by name in global (multi-queue) mode.
 */
export function SlowestJobsTable({
  jobs,
  queueParam,
  queues,
}: SlowestJobsTableProps) {
  const navigate = useNavigate();

  // Single-queue mode uses the fixed param; global mode resolves per row from
  // the job's queueName (jobs only carry the bare name, so the first matching
  // prefix wins when names collide across prefixes).
  const resolveQueueParam = (job: SlowJob): string | undefined => {
    if (queueParam) return queueParam;
    const match = queues?.find((queue) => queue.name === job.queueName);
    return match ? queueRouteParam(match) : undefined;
  };

  const handleJobClick = (job: SlowJob) => {
    const targetParam = resolveQueueParam(job);
    if (!targetParam) return;
    navigate({
      to: "/queues/$queueName/jobs",
      params: { queueName: targetParam },
      search: { ...DEFAULT_JOBS_SEARCH, selected: job.id },
    });
  };

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>Slowest Jobs</CardTitle>
        <CardDescription>Top 10 jobs by processing time</CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No completed jobs in this time range
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Job</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const navigable = Boolean(resolveQueueParam(job));
                return (
                  <TableRow
                    // Job ids are per-queue counters, so the same id appears
                    // in several queues on the global overview.
                    key={`${job.queueName}:${job.id}:${job.timestamp}`}
                    className={
                      navigable ? "cursor-pointer hover:bg-muted/60" : undefined
                    }
                    onClick={navigable ? () => handleJobClick(job) : undefined}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {job.name}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {job.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">
                        {job.queueName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm text-amber-500">
                        {formatDuration(job.processingTimeMs)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
