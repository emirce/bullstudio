"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Activity, Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bullstudio/ui/components/dialog";
import { Button } from "@bullstudio/ui/components/button";
import { Input } from "@bullstudio/ui/components/input";
import { Textarea } from "@bullstudio/ui/components/textarea";
import { Switch } from "@bullstudio/ui/components/switch";
import { Field, FieldError, FieldLabel } from "@bullstudio/ui/components/field";
import { toast } from "@bullstudio/ui/components/sonner";
import { trpc } from "@/lib/trpc";
import { useDialogContext } from "../DialogProvider";

const editConnectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  host: z.string().min(1, "Host is required"),
  port: z.number().int().min(1).max(65535),
  database: z.number().int().min(0).max(15),
  username: z.string().optional(),
  password: z.string().optional(),
  tls: z.boolean(),
  tlsCert: z.string().optional(),
});

type EditConnectionFormValues = z.infer<typeof editConnectionSchema>;

type Connection = {
  id: string;
  name: string;
  host: string;
  port: number;
  database: number;
  tls: boolean;
  username: string | null;
};

export type EditConnectionDialogProps = {
  connection: Connection;
};

export function EditConnectionDialog({ connection }: EditConnectionDialogProps) {
  const { open, onOpenChange } = useDialogContext();
  const utils = trpc.useUtils();
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency?: number;
    error?: string;
  } | null>(null);

  const { control, handleSubmit, formState, watch, getValues } =
    useForm<EditConnectionFormValues>({
      resolver: zodResolver(editConnectionSchema),
      defaultValues: {
        name: connection.name,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username || "",
        password: "",
        tls: connection.tls,
        tlsCert: "",
      },
      mode: "onChange",
    });

  const tls = watch("tls");

  const testConnectionMutation = trpc.redisConnection.test.useMutation({
    onSuccess: (data) => {
      setTestResult({ success: true, latency: data.latency });
    },
    onError: (error) => {
      setTestResult({ success: false, error: error.message });
    },
  });

  const updateConnection = trpc.redisConnection.update.useMutation({
    onSuccess: () => {
      toast.success("Connection updated successfully");
      utils.redisConnection.list.invalidate();
      onOpenChange?.(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleTest = () => {
    setTestResult(null);
    const values = getValues();
    testConnectionMutation.mutate({
      connectionId: connection.id,
      host: values.host,
      port: values.port,
      database: values.database,
      username: values.username || undefined,
      password: values.password || undefined,
      tls: values.tls,
      tlsCert: values.tlsCert || undefined,
    });
  };

  const onSubmit = (data: EditConnectionFormValues) => {
    updateConnection.mutate({
      connectionId: connection.id,
      name: data.name,
      host: data.host,
      port: data.port,
      database: data.database,
      username: data.username || null,
      password: data.password || null,
      tls: data.tls,
      tlsCert: data.tlsCert || null,
    });
  };

  const canTest =
    watch("host")?.length > 0 &&
    watch("port") > 0 &&
    !testConnectionMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Connection</DialogTitle>
          <DialogDescription>
            Update your Redis connection settings
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Connection Name</FieldLabel>
                <Input {...field} placeholder="Production Redis" />
                {fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid grid-cols-3 gap-3">
            <Controller
              name="host"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="col-span-2">
                  <FieldLabel>Host</FieldLabel>
                  <Input
                    {...field}
                    placeholder="localhost"
                    className="font-mono text-sm"
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="port"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Port</FieldLabel>
                  <Input
                    type="number"
                    value={field.value}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 6379)}
                    className="font-mono text-sm"
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <Controller
            name="database"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Database</FieldLabel>
                <Input
                  type="number"
                  value={field.value}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  min={0}
                  max={15}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Redis database index (0-15)
                </p>
                {fieldState.error && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="username"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Username (optional)</FieldLabel>
                  <Input
                    {...field}
                    placeholder="default"
                    className="font-mono text-sm"
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Password (optional)</FieldLabel>
                  <Input
                    {...field}
                    type="password"
                    placeholder="••••••••"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to keep existing
                  </p>
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <Controller
            name="tls"
            control={control}
            render={({ field }) => (
              <Field>
                <div className="flex items-center justify-between">
                  <div>
                    <FieldLabel className="mb-0">Enable TLS</FieldLabel>
                    <p className="text-xs text-muted-foreground">
                      Use encrypted connection
                    </p>
                  </div>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              </Field>
            )}
          />

          {tls && (
            <Controller
              name="tlsCert"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>CA Certificate (optional)</FieldLabel>
                  <Textarea
                    {...field}
                    placeholder="-----BEGIN CERTIFICATE-----"
                    className="font-mono text-xs h-24 resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to keep existing
                  </p>
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}

          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                testResult.success
                  ? "bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400"
                  : "bg-destructive/10 border border-destructive/20 text-destructive"
              }`}
            >
              {testResult.success ? (
                <>
                  <Check className="size-4" />
                  <span>Connection successful ({testResult.latency}ms)</span>
                </>
              ) : (
                <>
                  <X className="size-4" />
                  <span className="truncate">{testResult.error}</span>
                </>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={!canTest}
              className="w-full sm:w-auto"
            >
              {testConnectionMutation.isPending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Activity className="size-4 mr-2" />
              )}
              Test Connection
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange?.(false)}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formState.isSubmitting || !formState.isValid}
                className="flex-1 sm:flex-none"
              >
                {updateConnection.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
