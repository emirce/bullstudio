"use client";

import { AlertTriangle } from "lucide-react";
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
import { toast } from "@bullstudio/ui/components/sonner";
import { trpc } from "@/lib/trpc";
import { useDialogContext } from "../DialogProvider";

export type DeleteConnectionDialogProps = {
  connectionId: string;
  connectionName: string;
};

export function DeleteConnectionDialog({
  connectionId,
  connectionName,
}: DeleteConnectionDialogProps) {
  const { open, onOpenChange } = useDialogContext();
  const utils = trpc.useUtils();

  const deleteConnection = trpc.redisConnection.delete.useMutation({
    onSuccess: () => {
      toast.success("Connection deleted successfully");
      utils.redisConnection.list.invalidate();
      onOpenChange?.(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = () => {
    deleteConnection.mutate({ connectionId });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-full bg-destructive/10">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle>Delete Connection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this connection?
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="p-4 rounded-lg bg-muted/50 border">
          <p className="font-medium">{connectionName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            This action cannot be undone. All queue data associated with this
            connection will become inaccessible.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteConnection.isPending}
          >
            {deleteConnection.isPending ? "Deleting..." : "Delete Connection"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
