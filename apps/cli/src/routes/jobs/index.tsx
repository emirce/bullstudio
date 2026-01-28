import { useTRPC } from "@/integrations/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { JobsTable } from "@bullstudio/ui/shared/JobsTable";
import Header from "@/components/Header";

export const Route = createFileRoute("/jobs/")({ component: JobsPage });

function JobsPage() {
  const trpc = useTRPC();
  const { data: jobs, refetch } = useQuery(trpc.jobs.list.queryOptions());
  const { data: queues } = useQuery(trpc.queues.list.queryOptions());
  return (
    <div className="space-y-2">
      <Header title="Jobs" />
      <JobsTable
        queues={queues || []}
        jobs={jobs || []}
        onRefetchJobs={refetch}
      />
    </div>
  );
}
