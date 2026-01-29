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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@bullstudio/ui/components/tooltip";
import { Badge } from "@bullstudio/ui/components/badge";
import dayjs from "@bullstudio/dayjs";
import type { OverviewMetricsResponse } from "@/integrations/trpc/routers/overview";

type FailingJobType = OverviewMetricsResponse["failingJobTypes"][number];

type FailingJobTypesTableProps = {
  jobTypes: FailingJobType[];
};

export function FailingJobTypesTable({ jobTypes }: FailingJobTypesTableProps) {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Most Failing Job Types</CardTitle>
        <CardDescription className="text-zinc-500">
          Jobs grouped by name with highest failure counts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jobTypes.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            No failed jobs in this time range
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Job Type</TableHead>
                <TableHead className="text-zinc-400">Queue</TableHead>
                <TableHead className="text-zinc-400 text-right">
                  Failures
                </TableHead>
                <TableHead className="text-zinc-400 text-right">
                  Last Failed
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobTypes.map((jobType) => (
                <TableRow
                  key={`${jobType.queueName}:${jobType.name}`}
                  className="border-zinc-800"
                >
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-zinc-100 cursor-help">
                            {jobType.name}
                          </span>
                        </TooltipTrigger>
                        {jobType.lastFailedReason && (
                          <TooltipContent
                            side="top"
                            className="max-w-xs bg-zinc-800 border-zinc-700"
                          >
                            <p className="text-xs font-mono break-all text-zinc-300">
                              {jobType.lastFailedReason}
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-zinc-400">
                      {jobType.queueName}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="destructive" className="font-mono">
                      {jobType.failureCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm text-zinc-500">
                      {dayjs(jobType.lastFailedAt).fromNow()}
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
