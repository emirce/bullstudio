"use client";

import { Plus, Database, ServerCrash } from "lucide-react";
import { Button } from "@bullstudio/ui/components/button";
import { Skeleton } from "@bullstudio/ui/components/skeleton";
import { trpc } from "@/lib/trpc";
import { useDialogStore } from "@/components/dialog/store";
import { CreateConnectionDialog } from "@/components/dialog/registry";
import { ConnectionCard } from "@/components/connections/ConnectionCard";

type ConnectionsContentProps = {
  workspaceSlug: string;
};

export function ConnectionsContent({ workspaceSlug }: ConnectionsContentProps) {
  const dialogStore = useDialogStore();

  const { data: organizations, isLoading: isLoadingOrgs } =
    trpc.organization.list.useQuery();

  const currentOrganization = organizations?.[0];

  const { data: workspace, isLoading: isLoadingWorkspace } =
    trpc.workspace.get.useQuery(
      {
        organizationId: currentOrganization?.id ?? "",
        slug: workspaceSlug,
      },
      { enabled: !!currentOrganization?.id }
    );

  const {
    data: connections,
    isLoading: isLoadingConnections,
    error,
  } = trpc.redisConnection.list.useQuery(
    { workspaceId: workspace?.id ?? "" },
    { enabled: !!workspace?.id }
  );

  const handleAddConnection = () => {
    if (!workspace) return;
    dialogStore.trigger({
      id: "create-connection",
      component: CreateConnectionDialog,
      props: {
        workspaceId: workspace.id,
      },
    });
  };

  if (isLoadingOrgs || isLoadingWorkspace || isLoadingConnections) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <ServerCrash className="size-12 text-muted-foreground" />
        <p className="text-muted-foreground">Failed to load connections</p>
      </div>
    );
  }

  if (!connections || connections.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Connect your Redis instances to start monitoring queues
          </p>
          <Button onClick={handleAddConnection}>
            <Plus className="size-4 mr-2" />
            Add Connection
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-xl bg-muted/20">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full" />
            <div className="relative flex items-center justify-center size-20 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20">
              <Database className="size-10 text-red-500/70" />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Add your first Redis connection to start monitoring your BullMQ
            queues, track job status, and manage your queue infrastructure.
          </p>
          <Button onClick={handleAddConnection} size="lg">
            <Plus className="size-4 mr-2" />
            Add Your First Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {connections.length} connection{connections.length !== 1 ? "s" : ""}{" "}
          configured
        </p>
        <Button onClick={handleAddConnection}>
          <Plus className="size-4 mr-2" />
          Add Connection
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((connection) => (
          <ConnectionCard key={connection.id} connection={connection} />
        ))}
      </div>
    </div>
  );
}
