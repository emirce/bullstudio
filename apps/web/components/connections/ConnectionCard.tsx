"use client";

import { Activity, Pencil, Trash2, Lock, Clock, Server } from "lucide-react";
import { Button } from "@bullstudio/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bullstudio/ui/components/card";
import { Badge } from "@bullstudio/ui/components/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@bullstudio/ui/components/tooltip";
import { RedisConnectionStatus } from "@bullstudio/prisma/browser";
import { useDialogStore } from "@/components/dialog/store";
import {
  EditConnectionDialog,
  DeleteConnectionDialog,
  TestConnectionDialog,
} from "@/components/dialog/registry";

type Connection = {
  id: string;
  name: string;
  host: string;
  port: number;
  database: number;
  tls: boolean;
  username: string | null;
  status: RedisConnectionStatus;
  lastConnectedAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ConnectionCardProps = {
  connection: Connection;
};

const statusConfig: Record<
  RedisConnectionStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string; dotClass: string }
> = {
  [RedisConnectionStatus.Pending]: {
    variant: "outline",
    label: "Pending",
    dotClass: "bg-muted-foreground",
  },
  [RedisConnectionStatus.Connected]: {
    variant: "default",
    label: "Connected",
    dotClass: "bg-green-500 animate-pulse",
  },
  [RedisConnectionStatus.Failed]: {
    variant: "destructive",
    label: "Failed",
    dotClass: "bg-destructive",
  },
  [RedisConnectionStatus.Disconnected]: {
    variant: "secondary",
    label: "Disconnected",
    dotClass: "bg-muted-foreground",
  },
};

function formatLastConnected(date: Date | null): string {
  if (!date) return "Never";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function ConnectionCard({ connection }: ConnectionCardProps) {
  const dialogStore = useDialogStore();
  const config = statusConfig[connection.status];

  const handleTest = () => {
    dialogStore.trigger({
      id: `test-connection-${connection.id}`,
      component: TestConnectionDialog,
      props: {
        connectionId: connection.id,
        connectionName: connection.name,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        tls: connection.tls,
      },
    });
  };

  const handleEdit = () => {
    dialogStore.trigger({
      id: `edit-connection-${connection.id}`,
      component: EditConnectionDialog,
      props: {
        connection,
      },
    });
  };

  const handleDelete = () => {
    dialogStore.trigger({
      id: `delete-connection-${connection.id}`,
      component: DeleteConnectionDialog,
      props: {
        connectionId: connection.id,
        connectionName: connection.name,
      },
    });
  };

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20">
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.02] to-transparent pointer-events-none" />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center size-10 rounded-lg bg-red-500/10 shrink-0">
              <Server className="size-5 text-red-500" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                {connection.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs text-muted-foreground font-mono truncate">
                  {connection.host}:{connection.port}
                </code>
                {connection.tls && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Lock className="size-3 text-green-500" />
                      </TooltipTrigger>
                      <TooltipContent>TLS Enabled</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
          <Badge variant={config.variant} className="shrink-0">
            <span className={`size-1.5 rounded-full mr-1.5 ${config.dotClass}`} />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Database</p>
            <p className="font-mono font-medium">{connection.database}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Last Connected</p>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3 text-muted-foreground" />
              <p className="font-medium text-sm">
                {formatLastConnected(connection.lastConnectedAt)}
              </p>
            </div>
          </div>
        </div>

        {connection.lastError && connection.status === RedisConnectionStatus.Failed && (
          <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive font-mono truncate">
              {connection.lastError}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={handleTest}
                >
                  <Activity className="size-4 mr-1.5" />
                  Test
                </Button>
              </TooltipTrigger>
              <TooltipContent>Test connection</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" onClick={handleEdit}>
                  <Pencil className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit connection</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleDelete}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete connection</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
