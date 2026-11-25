import type { JobSummary } from "@bullstudio/connect-types";
import dayjs from "@bullstudio/dayjs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@bullstudio/ui/components/alert-dialog";
import { Button } from "@bullstudio/ui/components/button";
import { Input } from "@bullstudio/ui/components/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@bullstudio/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bullstudio/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@bullstudio/ui/components/tabs";
import {
  EmptyState,
  type JobStatus,
  JobStatusBadge,
} from "@bullstudio/ui/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { JobDetail } from "@/components/jobs/JobDetail";
import { useTRPC } from "@/integrations/trpc/react";
import {
  FilterableStatus,
  type JobSortField,
  jobsSearchSchema,
} from "@/lib/jobs";
import { queueNameFromParam, resolveQueueFromParam } from "@/lib/queue-key";
import { getQueueSourceViewModel } from "@/lib/queue-source-status";

export const Route = createFileRoute("/queues/$queueName/jobs")({
  component: QueueJobsPage,
  validateSearch: (search: Record<string, unknown>) =>
    jobsSearchSchema.parse(search),
});

const BASE_STATUS_TABS: { value: FilterableStatus | "all"; label: string }[] = [
  { value: FilterableStatus.All, label: "All" },
  { value: FilterableStatus.Waiting, label: "Waiting" },
  { value: FilterableStatus.Active, label: "Active" },
  { value: FilterableStatus.Completed, label: "Completed" },
  { value: FilterableStatus.Failed, label: "Failed" },
  { value: FilterableStatus.Delayed, label: "Delayed" },
];

const SEARCH_DEBOUNCE_MS = 300;
const JOBS_SKELETON_KEYS = ["job-1", "job-2", "job-3", "job-4", "job-5"];
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function QueueJobsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const { queueName: queueParam } = Route.useParams();
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [confirmRetryAll, setConfirmRetryAll] = useState(false);

  const { statusFilter, q, selected, page, pageSize, sortField, sortOrder } =
    Route.useSearch();

  const [expandedJobId, setExpandedJobId] = useState<string | null>(
    selected ?? null,
  );
  const [searchQuery, setSearchQuery] = useState(q ?? "");
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  const { data: connectionInfo } = useQuery(
    trpc.connection.info.queryOptions(),
  );
  const queueSource = connectionInfo?.queueSource
    ? getQueueSourceViewModel(connectionInfo.queueSource)
    : null;

  const { data: queues } = useQuery(trpc.queues.list.queryOptions());
  const queue = resolveQueueFromParam(queueParam, queues);
  const queueName = queue?.name ?? queueNameFromParam(queueParam);
  const prefix = queue?.prefix;

  const statusCounts = {
    waiting: queue?.jobCounts?.waiting ?? 0,
    active: queue?.jobCounts?.active ?? 0,
    completed: queue?.jobCounts?.completed ?? 0,
    failed: queue?.jobCounts?.failed ?? 0,
    delayed: queue?.jobCounts?.delayed ?? 0,
    paused: queue?.jobCounts?.paused ?? 0,
    waitingChildren: queue?.jobCounts?.waitingChildren ?? 0,
    prioritized: queue?.jobCounts?.prioritized ?? 0,
  };

  const getStatusCount = (status: FilterableStatus | "all") => {
    if (!queue?.jobCounts) {
      return null;
    }

    switch (status) {
      case FilterableStatus.All:
        return (
          statusCounts.waiting +
          statusCounts.active +
          statusCounts.completed +
          statusCounts.failed +
          statusCounts.delayed +
          statusCounts.paused +
          statusCounts.waitingChildren +
          statusCounts.prioritized
        );
      case FilterableStatus.Waiting:
        return statusCounts.waiting;
      case FilterableStatus.Active:
        return statusCounts.active;
      case FilterableStatus.Completed:
        return statusCounts.completed;
      case FilterableStatus.Failed:
        return statusCounts.failed;
      case FilterableStatus.Delayed:
        return statusCounts.delayed;
      case FilterableStatus.Paused:
        return statusCounts.paused;
      case FilterableStatus.WaitingChildren:
        return statusCounts.waitingChildren;
    }
  };

  const statusTabs = queueSource?.features.flows.visible
    ? [
        ...BASE_STATUS_TABS,
        {
          value: "waiting-children" as FilterableStatus,
          label: "Waiting Children",
        },
      ]
    : BASE_STATUS_TABS;

  const {
    data: jobsResponse,
    isLoading: loadingJobs,
    isFetching: fetchingJobs,
    refetch: refetchJobs,
  } = useQuery(
    trpc.jobs.listSummary.queryOptions({
      queueName,
      prefix,
      status: statusFilter !== "all" ? statusFilter : undefined,
      search: q,
      sortField,
      sortOrder,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
  );

  const retryAllMutation = useMutation(
    trpc.jobs.retryAllFailed.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message, {
          description: `${data.workerCount} worker(s) available to process`,
        });
        queryClient.invalidateQueries({ queryKey: [["jobs"]] });
        queryClient.invalidateQueries({ queryKey: [["queues"]] });
        setConfirmRetryAll(false);
      },
      onError: (error) => {
        toast.error("Failed to retry jobs", { description: error.message });
        setConfirmRetryAll(false);
      },
    }),
  );

  const hasJobsResponse = jobsResponse !== undefined;
  const jobs = jobsResponse?.items ?? [];
  const totalJobs = jobsResponse?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalJobs / pageSize));
  const firstVisibleJob = totalJobs === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastVisibleJob = Math.min(page * pageSize, totalJobs);

  useEffect(() => {
    setSearchQuery(q ?? "");
  }, [q]);

  // Consume the `selected` deep-link param: expand its row, then strip it from
  // the URL so it no longer reopens on subsequent navigations.
  useEffect(() => {
    if (!selected) {
      return;
    }
    setExpandedJobId(selected);
    navigate({
      search: (prev) => ({ ...prev, selected: undefined }),
      replace: true,
    });
  }, [selected, navigate]);

  useEffect(() => {
    const nextQuery = debouncedSearchQuery.trim() || undefined;
    if (nextQuery === q) {
      return;
    }

    navigate({
      search: (prev) => ({
        ...prev,
        q: nextQuery,
        page: 1,
      }),
      replace: true,
    });
  }, [debouncedSearchQuery, navigate, q]);

  useEffect(() => {
    if (hasJobsResponse && page > totalPages) {
      navigate({
        search: (prev) => ({
          ...prev,
          page: totalPages,
        }),
        replace: true,
      });
    }
  }, [hasJobsResponse, navigate, page, totalPages]);

  const scrollTableToTop = () => tableScrollRef.current?.scrollTo({ top: 0 });

  const handleSort = (field: JobSortField) => {
    if (sortField === field) {
      navigate({
        search: (prev) => ({
          ...prev,
          sortOrder: sortOrder === "asc" ? "desc" : "asc",
          page: 1,
        }),
      });
    } else {
      navigate({
        search: (prev) => ({
          ...prev,
          sortField: field,
          sortOrder: "desc",
          page: 1,
        }),
      });
    }
  };

  const navigateToPage = (nextPage: number) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);
    scrollTableToTop();
    navigate({
      search: (prev) => ({
        ...prev,
        page: boundedPage,
      }),
    });
  };

  const renderSortIcon = (field: JobSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3.5 text-zinc-600" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="size-3.5 text-zinc-300" />
    ) : (
      <ArrowDown className="size-3.5 text-zinc-300" />
    );
  };

  const formatDuration = (job: JobSummary) => {
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
    return <span className="text-muted-foreground">—</span>;
  };

  const toggleJob = (jobId: string) => {
    setExpandedJobId((current) => (current === jobId ? null : jobId));
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Controls: status tabs + search live on one row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(v) =>
            navigate({
              search: (prev) => ({
                ...prev,
                statusFilter: v as FilterableStatus,
                page: 1,
              }),
            })
          }
          className="min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsList className="w-max border border-border">
            {statusTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="group data-[state=active]:bg-background"
              >
                <span>{tab.label}</span>
                {getStatusCount(tab.value) !== null && (
                  <span className="ml-1.5 rounded-sm border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground tabular-nums group-data-[state=active]:border-border group-data-[state=active]:bg-background group-data-[state=active]:text-foreground">
                    {getStatusCount(tab.value)?.toLocaleString()}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex shrink-0 items-center gap-3">
          {statusCounts.failed > 0 &&
            queueSource?.features.jobRetry.visible && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRetryAll(true)}
                disabled={
                  retryAllMutation.isPending ||
                  !queueSource.features.jobRetry.enabled
                }
                className="bg-card shrink-0 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
              >
                <RotateCcw
                  className={`size-4 ${retryAllMutation.isPending ? "animate-spin" : ""}`}
                />
                Retry All Failed
              </Button>
            )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchJobs()}
            disabled={fetchingJobs}
            className="bg-card shrink-0"
          >
            <RefreshCw
              className={`size-4 ${fetchingJobs ? "animate-spin" : ""}`}
            />
          </Button>

          <div className="relative w-full lg:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card"
            />
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      {loadingJobs ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
          <div className="p-8 space-y-4">
            {JOBS_SKELETON_KEYS.map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={<Inbox className="size-12" />}
            title="No jobs found"
            description={
              searchQuery
                ? "Try adjusting your search query"
                : "No jobs matching your filters"
            }
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
          <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="sticky top-0 z-10 cursor-pointer bg-card hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-2">
                      Job
                      {renderSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 cursor-pointer bg-card hover:text-foreground transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {renderSortIcon("status")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 cursor-pointer bg-card hover:text-foreground transition-colors"
                    onClick={() => handleSort("timestamp")}
                  >
                    <div className="flex items-center gap-2">
                      Queued At
                      {renderSortIcon("timestamp")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="sticky top-0 z-10 cursor-pointer bg-card hover:text-foreground transition-colors text-right"
                    onClick={() => handleSort("duration")}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Duration
                      {renderSortIcon("duration")}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const isExpanded = expandedJobId === job.id;
                  return (
                    <Fragment
                      key={`${job.prefix ?? ""}-${job.queueName}-${job.id}`}
                    >
                      <TableRow
                        className={`cursor-pointer transition-colors ${
                          isExpanded
                            ? "bg-muted/60 hover:bg-muted/60"
                            : "hover:bg-muted/60"
                        }`}
                        onClick={() => toggleJob(job.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                                isExpanded ? "" : "-rotate-90"
                              }`}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">
                                {job.name}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {job.id}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <JobStatusBadge
                            status={job.status as JobStatus}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground">
                              {dayjs(job.timestamp).fromNow()}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {dayjs(job.timestamp).format("MMM D, HH:mm:ss")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatDuration(job)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={4}
                            className="border-b bg-muted/20 p-0"
                          >
                            <JobDetail
                              jobId={job.id}
                              queueName={queueName}
                              prefix={job.prefix ?? prefix}
                              queueKey={queue?.key}
                              onRemoved={() => setExpandedJobId(null)}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="shrink-0 flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
            <div>
              Showing {firstVisibleJob.toLocaleString()}-
              {lastVisibleJob.toLocaleString()} of {totalJobs.toLocaleString()}{" "}
              jobs
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span>Rows</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    scrollTableToTop();
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        pageSize: Number(value),
                        page: 1,
                      }),
                    });
                  }}
                >
                  <SelectTrigger className="h-8 w-[82px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Pagination className="mx-0 w-auto justify-start">
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Go to first page"
                      disabled={page === 1}
                      onClick={() => navigateToPage(1)}
                    >
                      <ChevronsLeft className="size-4" />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 px-2.5 sm:pl-2.5"
                      disabled={page === 1}
                      onClick={() => navigateToPage(page - 1)}
                    >
                      <ChevronLeft className="size-4" />
                      <span className="hidden sm:block">Previous</span>
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-24 cursor-default"
                      aria-current="page"
                    >
                      {page.toLocaleString()} / {totalPages.toLocaleString()}
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 px-2.5 sm:pr-2.5"
                      disabled={page >= totalPages}
                      onClick={() => navigateToPage(page + 1)}
                    >
                      <span className="hidden sm:block">Next</span>
                      <ChevronRight className="size-4" />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Go to last page"
                      disabled={page >= totalPages}
                      onClick={() => navigateToPage(totalPages)}
                    >
                      <ChevronsRight className="size-4" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={confirmRetryAll} onOpenChange={setConfirmRetryAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry all failed jobs?</AlertDialogTitle>
            <AlertDialogDescription>
              This re-enqueues {statusCounts.failed.toLocaleString()} failed job
              {statusCounts.failed === 1 ? "" : "s"} in "{queueName}". They will
              be processed again by available workers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                retryAllMutation.mutate({
                  queueKey: queue?.key,
                  queueName,
                  prefix,
                })
              }
              disabled={retryAllMutation.isPending}
            >
              Retry {statusCounts.failed.toLocaleString()} job
              {statusCounts.failed === 1 ? "" : "s"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
