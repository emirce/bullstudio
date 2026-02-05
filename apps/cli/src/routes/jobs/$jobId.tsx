"use client";

import { useState, useMemo, memo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTRPC } from "@/integrations/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/Header";
import { Button } from "@bullstudio/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bullstudio/ui/components/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@bullstudio/ui/components/tabs";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import dayjs from "@bullstudio/dayjs";
import {
  JobStatusBadge,
  type JobStatus,
  formatDuration,
} from "@bullstudio/ui/shared";
import { z } from "zod";

const searchSchema = z.object({
  queueName: z.string(),
});

export const Route = createFileRoute("/jobs/$jobId")({
  component: JobDetailPage,
  validateSearch: searchSchema,
});

function JobDetailPage() {
  const { jobId } = Route.useParams();
  const { queueName } = Route.useSearch();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    data: job,
    isLoading,
    refetch,
    isFetching,
  } = useQuery(
    trpc.jobs.get.queryOptions(
      {
        queueName,
        jobId,
      },
      {
        refetchInterval(query) {
          const jobStatus = query.state.data?.status;
          const isTerminal =
            jobStatus === "completed" || jobStatus === "failed";
          return isTerminal ? false : 2000;
        },
      },
    ),
  );

  const retryMutation = useMutation(
    trpc.jobs.retry.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message, {
          description: `${data.workerCount} worker(s) available to process`,
        });
        queryClient.invalidateQueries({ queryKey: [["jobs"]] });
        refetch();
      },
      onError: (error) => {
        toast.error("Failed to retry job", {
          description: error.message,
        });
      },
    }),
  );

  const removeMutation = useMutation(
    trpc.jobs.remove.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: [["jobs"]] });
        navigate({ to: "/jobs" });
      },
      onError: (error) => {
        toast.error("Failed to remove job", {
          description: error.message,
        });
      },
    }),
  );

  const goBack = () => {
    navigate({ to: "/jobs" });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header title="Job Details" />
        <Skeleton className="h-64 w-full bg-zinc-800/50" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <Header title="Job Not Found" />
        <div className="text-center py-12">
          <AlertTriangle className="size-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-300">Job not found</h3>
          <p className="text-sm text-zinc-500 mt-1">
            The job may have been removed or the ID is incorrect.
          </p>
          <Button variant="outline" className="mt-4" onClick={goBack}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  const StatusIcon = () => {
    switch (job.status) {
      case "completed":
        return <CheckCircle className="size-5 text-emerald-400" />;
      case "failed":
        return <XCircle className="size-5 text-red-400" />;
      case "active":
        return <Clock className="size-5 text-blue-400 animate-pulse" />;
      default:
        return <Clock className="size-5 text-zinc-400" />;
    }
  };

  const handleRetry = () => {
    retryMutation.mutate({ queueName, jobId });
  };

  const handleRemove = () => {
    removeMutation.mutate({ queueName, jobId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <Header title={job.name} />
          <p className="text-xs text-zinc-500 font-mono pl-4 -mt-2">{job.id}</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <JobStatusBadge status={job.status as JobStatus} size="lg" />

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="border-zinc-800 hover:bg-zinc-800"
        >
          <RefreshCw
            className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>

        {job.status === "failed" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={retryMutation.isPending}
            className="border-zinc-800 hover:bg-zinc-800 text-amber-400 hover:text-amber-300"
          >
            <RotateCcw
              className={`size-4 mr-2 ${retryMutation.isPending ? "animate-spin" : ""}`}
            />
            {retryMutation.isPending ? "Retrying..." : "Retry"}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleRemove}
          disabled={removeMutation.isPending}
          className="border-zinc-800 hover:bg-red-900/20 text-red-400 hover:text-red-300"
        >
          <Trash2 className="size-4 mr-2" />
          {removeMutation.isPending ? "Removing..." : "Remove"}
        </Button>
      </div>

      {/* Metadata Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetadataCard
          title="Queue"
          value={job.queueName}
          icon={<StatusIcon />}
        />
        <MetadataCard
          title="Created"
          value={dayjs(job.timestamp).format("MMM D, HH:mm:ss")}
          subtitle={dayjs(job.timestamp).fromNow()}
        />
        <MetadataCard
          title="Attempts"
          value={`${job.attemptsMade} / ${job.attemptsLimit}`}
        />
        <MetadataCard
          title="Duration"
          value={
            job.finishedOn && job.processedOn
              ? formatDuration(job.finishedOn - job.processedOn)
              : job.processedOn
                ? "In progress"
                : "Pending"
          }
        />
      </div>

      {/* Tabs for Data, Return Value, Error */}
      <Tabs defaultValue="data" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="data" className="data-[state=active]:bg-zinc-800">
            Input Data
          </TabsTrigger>
          <TabsTrigger
            value="result"
            className="data-[state=active]:bg-zinc-800"
          >
            Result
          </TabsTrigger>
          {job.status === "failed" && (
            <TabsTrigger
              value="error"
              className="data-[state=active]:bg-zinc-800"
            >
              Error
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="data" className="mt-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-400">
                Input Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <JsonViewer data={job.data} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="result" className="mt-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm text-zinc-400">
                Return Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              {job.returnValue ? (
                <JsonViewer data={job.returnValue} />
              ) : (
                <p className="text-zinc-500 text-sm">No return value</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {job.status === "failed" && (
          <TabsContent value="error" className="mt-4">
            <Card className="bg-red-900/10 border-red-900/30">
              <CardHeader>
                <CardTitle className="text-sm text-red-400">
                  Error Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {job.failedReason && (
                  <div>
                    <h4 className="text-xs text-zinc-500 mb-1">Message</h4>
                    <p className="text-sm text-red-300 font-mono">
                      {job.failedReason}
                    </p>
                  </div>
                )}
                {job.stacktrace && job.stacktrace.length > 0 && (
                  <div>
                    <h4 className="text-xs text-zinc-500 mb-1">Stack Trace</h4>
                    <pre className="text-xs text-zinc-400 font-mono bg-zinc-900 p-4 rounded-lg overflow-x-auto">
                      {job.stacktrace.join("\n")}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function MetadataCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500">{title}</p>
            <p className="text-sm font-medium text-zinc-100 mt-1 font-mono">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

const TRUNCATION_THRESHOLD = 50 * 1024; // 50KB

const JsonViewer = memo(function JsonViewer({ data }: { data: unknown }) {
  const [showFull, setShowFull] = useState(false);

  const { formatted, isTruncated, fullSize } = useMemo(() => {
    const full = JSON.stringify(data, null, 2);
    const size = full.length;
    const shouldTruncate = size > TRUNCATION_THRESHOLD && !showFull;

    return {
      formatted: shouldTruncate ? full.slice(0, TRUNCATION_THRESHOLD) : full,
      isTruncated: shouldTruncate,
      fullSize: size,
    };
  }, [data, showFull]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <pre className="text-sm text-zinc-300 font-mono bg-zinc-900 p-4 rounded-lg overflow-x-auto max-h-[600px] overflow-y-auto">
        {formatted}
        {isTruncated && (
          <span className="text-zinc-500">
            {"\n\n... (truncated)"}
          </span>
        )}
      </pre>
      {(isTruncated || showFull) && fullSize > TRUNCATION_THRESHOLD && (
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            Size: {formatSize(fullSize)}
          </span>
          <button
            onClick={() => setShowFull(!showFull)}
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            {showFull ? "Show less" : "Show full data"}
          </button>
        </div>
      )}
    </div>
  );
});
