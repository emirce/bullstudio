"use client";

import { useEffect } from "react";
import { Check, X, Loader2, Server, Zap, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bullstudio/ui/components/dialog";
import { Button } from "@bullstudio/ui/components/button";
import { trpc } from "@/lib/trpc";
import { useDialogContext } from "../DialogProvider";

export type TestConnectionDialogProps = {
  connectionId: string;
  connectionName: string;
  host: string;
  port: number;
  database: number;
  tls: boolean;
};

export function TestConnectionDialog({
  connectionId,
  connectionName,
  host,
  port,
  database,
  tls,
}: TestConnectionDialogProps) {
  const { open, onOpenChange } = useDialogContext();
  const utils = trpc.useUtils();

  const testConnection = trpc.redisConnection.test.useMutation({
    onSuccess: () => {
      utils.redisConnection.list.invalidate();
    },
  });

  useEffect(() => {
    if (open) {
      testConnection.mutate({
        connectionId,
        host,
        port,
        database,
        tls,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isPending = testConnection.isPending;
  const isSuccess = testConnection.isSuccess;
  const isError = testConnection.isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Test Connection</DialogTitle>
          <DialogDescription>
            Testing connection to {connectionName}
          </DialogDescription>
        </DialogHeader>

        <div className="py-8">
          {isPending && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                <div className="relative flex items-center justify-center size-20 rounded-full bg-primary/10 border border-primary/20">
                  <Loader2 className="size-10 text-primary animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-medium">Testing connection...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Connecting to {host}:{port}
                </p>
              </div>
            </div>
          )}

          {isSuccess && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full" />
                <div className="relative flex items-center justify-center size-20 rounded-full bg-green-500/10 border border-green-500/20">
                  <Check className="size-10 text-green-500" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-medium text-green-600 dark:text-green-400">
                  Connection Successful
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Redis server is reachable
                </p>
              </div>

              <div className="w-full grid grid-cols-3 gap-3 mt-4">
                <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 border">
                  <Server className="size-4 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Host</span>
                  <span className="text-sm font-mono font-medium truncate max-w-full">
                    {host}
                  </span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 border">
                  <Zap className="size-4 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Latency</span>
                  <span className="text-sm font-mono font-medium">
                    {testConnection.data?.latency}ms
                  </span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 border">
                  <Clock className="size-4 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Status</span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    Online
                  </span>
                </div>
              </div>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-destructive/20 blur-xl rounded-full" />
                <div className="relative flex items-center justify-center size-20 rounded-full bg-destructive/10 border border-destructive/20">
                  <X className="size-10 text-destructive" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-medium text-destructive">Connection Failed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Unable to connect to Redis server
                </p>
              </div>

              <div className="w-full p-4 rounded-lg bg-destructive/5 border border-destructive/20 mt-2">
                <p className="text-sm text-destructive font-mono break-all">
                  {testConnection.error?.message || "Unknown error occurred"}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {(isSuccess || isError) && (
            <Button
              variant="outline"
              onClick={() => {
                testConnection.reset();
                testConnection.mutate({
                  connectionId,
                  host,
                  port,
                  database,
                  tls,
                });
              }}
            >
              Test Again
            </Button>
          )}
          <Button onClick={() => onOpenChange?.(false)}>
            {isPending ? "Cancel" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
