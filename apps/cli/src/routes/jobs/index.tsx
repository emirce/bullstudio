import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Input } from "@bullstudio/ui/components/input";
import { Button } from "@bullstudio/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@bullstudio/ui/components/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import {
  Search,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Inbox,
  RefreshCw,
} from "lucide-react";
import dayjs from "@bullstudio/dayjs";
import { JobStatusBadge, type JobStatus, EmptyState } from "@bullstudio/ui/shared";
import type { Job } from "@bullstudio/connect-types";

export const Route = createFileRoute("/jobs/")({ component: JobsPage });

type SortField = "name" | "queueName" | "status" | "timestamp" | "duration";
type SortOrder = "asc" | "desc";

type FilterableStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "paused"
  | "waiting-children";

const STATUS_TABS: { value: FilterableStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "delayed", label: "Delayed" },
];

const ALL_QUEUES_VALUE = "__all__";

function JobsPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();

  const [queueName, setQueueName] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<FilterableStatus | "all">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Fetch queues
  const { data: queues, isLoading: loadingQueues } = useQuery(
    trpc.queues.list.queryOptions()
  );

  // Fetch jobs
  const {
    data: jobs,
    isLoading: loadingJobs,
    refetch: refetchJobs,
  } = useQuery(
    trpc.jobs.list.queryOptions({
      queueName: queueName || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      limit: 500,
    })
  );

  // Client-side filtering and sorting
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = jobs ?? [];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((job) => {
        const searchableFields = [
          job.name,
          job.id,
          job.failedReason,
          JSON.stringify(job.data),
          JSON.stringify(job.returnValue),
        ];
        return searchableFields.some(
          (field) => field && String(field).toLowerCase().includes(query)
        );
      });
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "queueName":
          aVal = a.queueName.toLowerCase();
          bVal = b.queueName.toLowerCase();
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "timestamp":
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case "duration":
          aVal = a.finishedOn
            ? a.finishedOn - a.timestamp
            : a.processedOn
              ? Date.now() - a.processedOn
              : 0;
          bVal = b.finishedOn
            ? b.finishedOn - b.timestamp
            : b.processedOn
              ? Date.now() - b.processedOn
              : 0;
          break;
        default:
          aVal = a.timestamp;
          bVal = b.timestamp;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [jobs, searchQuery, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3.5 text-zinc-600" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="size-3.5 text-zinc-300" />
    ) : (
      <ArrowDown className="size-3.5 text-zinc-300" />
    );
  };

  const formatDuration = (job: Job) => {
    if (job.finishedOn) {
      const ms = job.finishedOn - (job.processedOn ?? job.timestamp);
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      return `${(ms / 60000).toFixed(1)}m`;
    }
    if (job.processedOn || job.status === "active") {
      return (
        <span className="text-blue-400 flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
          In progress
        </span>
      );
    }
    return <span className="text-zinc-600">—</span>;
  };

  const navigateToJob = (jobId: string, jobQueueName: string) => {
    navigate({
      to: "/jobs/$jobId",
      params: { jobId },
      search: { queueName: jobQueueName },
    });
  };

  return (
    <div className="space-y-6">
      <Header title="Jobs" />

      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Queue Selector */}
          <Select
            value={queueName || ALL_QUEUES_VALUE}
            onValueChange={(value) =>
              setQueueName(value === ALL_QUEUES_VALUE ? "" : value)
            }
            disabled={loadingQueues}
          >
            <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-800">
              <Layers className="size-4 mr-2 text-zinc-500" />
              <SelectValue placeholder="Select queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_QUEUES_VALUE}>All queues</SelectItem>
              {loadingQueues ? (
                <div className="p-2">
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : queues?.length === 0 ? (
                <div className="p-4 text-center text-sm text-zinc-500">
                  No queues found
                </div>
              ) : (
                queues?.map((queue) => (
                  <SelectItem key={queue.name} value={queue.name}>
                    <span className="font-mono">{queue.name}</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchJobs()}
            className="border-zinc-800 hover:bg-zinc-800"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as FilterableStatus | "all")}
      >
        <TabsList className="bg-zinc-900 border border-zinc-800">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:bg-zinc-800"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Jobs Table */}
      {loadingJobs ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : filteredAndSortedJobs.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-12" />}
          title="No jobs found"
          description={
            searchQuery
              ? "Try adjusting your search query"
              : "No jobs matching your filters"
          }
        />
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead
                  className="cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    Job
                    <SortIcon field="name" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("queueName")}
                >
                  <div className="flex items-center gap-2">
                    Queue
                    <SortIcon field="queueName" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-2">
                    Status
                    <SortIcon field="status" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("timestamp")}
                >
                  <div className="flex items-center gap-2">
                    Queued At
                    <SortIcon field="timestamp" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-white transition-colors text-right"
                  onClick={() => handleSort("duration")}
                >
                  <div className="flex items-center justify-end gap-2">
                    Duration
                    <SortIcon field="duration" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedJobs.map((job) => (
                <TableRow
                  key={`${job.queueName}-${job.id}`}
                  className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => navigateToJob(job.id, job.queueName)}
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
                  <TableCell>
                    <JobStatusBadge status={job.status as JobStatus} size="sm" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm text-zinc-300">
                        {dayjs(job.timestamp).fromNow()}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {dayjs(job.timestamp).format("MMM D, HH:mm:ss")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatDuration(job)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Results Count */}
          <div className="px-4 py-3 border-t border-zinc-800 text-sm text-zinc-500">
            Showing {filteredAndSortedJobs.length} of {jobs?.length ?? 0} jobs
          </div>
        </div>
      )}
    </div>
  );
}
