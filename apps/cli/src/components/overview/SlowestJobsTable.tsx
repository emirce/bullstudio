import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@bullstudio/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table";
import { useNavigate } from "@tanstack/react-router";
import type { OverviewMetricsResponse } from "@/integrations/trpc/routers/overview";
import { formatDuration } from "@bullstudio/ui/shared";

type SlowJob = OverviewMetricsResponse["slowestJobs"][number];

type SlowestJobsTableProps = {
  jobs: SlowJob[];
};

export function SlowestJobsTable({ jobs }: SlowestJobsTableProps) {
  const navigate = useNavigate();

  const handleJobClick = (job: SlowJob) => {
    navigate({
      to: "/jobs/$jobId",
      params: { jobId: job.id },
      search: { queueName: job.queueName },
    });
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Slowest Jobs</CardTitle>
        <CardDescription className="text-zinc-500">
          Top 10 jobs by processing time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            No completed jobs in this time range
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Job</TableHead>
                <TableHead className="text-zinc-400">Queue</TableHead>
                <TableHead className="text-zinc-400 text-right">
                  Duration
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50"
                  onClick={() => handleJobClick(job)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-100">
                        {job.name}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {job.id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-zinc-400">
                      {job.queueName}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm text-amber-500">
                      {formatDuration(job.processingTimeMs)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
