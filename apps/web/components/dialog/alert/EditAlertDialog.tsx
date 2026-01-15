"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, X } from "lucide-react";
import { AlertType } from "@bullstudio/prisma/browser";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bullstudio/ui/components/select";
import { Field, FieldError, FieldLabel } from "@bullstudio/ui/components/field";
import { toast } from "@bullstudio/ui/components/sonner";
import { trpc } from "@/lib/trpc";
import { useDialogContext } from "../DialogProvider";

const ALERT_TYPE_OPTIONS = [
  { value: AlertType.FailureRate, label: "Failure Rate" },
  { value: AlertType.BacklogExceeded, label: "Backlog Exceeded" },
  { value: AlertType.ProcessingTimeAvg, label: "Avg Processing Time" },
  { value: AlertType.ProcessingTimeP95, label: "P95 Processing Time" },
  { value: AlertType.ProcessingTimeP99, label: "P99 Processing Time" },
  { value: AlertType.MissingWorkers, label: "Missing Workers" },
];

const editAlertSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  type: z.nativeEnum(AlertType),
  threshold: z.number().min(0),
  timeWindowMinutes: z.number().min(1).max(60).optional(),
  resolveThreshold: z.number().min(0).optional(),
  recipients: z.array(z.string().email()).min(1),
  cooldownMinutes: z.number().min(1).max(1440),
  enabled: z.boolean(),
});

type EditAlertFormValues = z.infer<typeof editAlertSchema>;

export type EditAlertDialogProps = {
  alertId: string;
};

export function EditAlertDialog({ alertId }: EditAlertDialogProps) {
  const { open, onOpenChange } = useDialogContext();
  const utils = trpc.useUtils();
  const [recipientInput, setRecipientInput] = useState("");

  const { data: alert, isLoading } = trpc.alert.get.useQuery(
    { id: alertId, includeHistory: false },
    { enabled: !!alertId && open }
  );

  const { control, handleSubmit, formState, setValue, watch, reset } =
    useForm<EditAlertFormValues>({
      resolver: zodResolver(editAlertSchema),
      defaultValues: {
        name: "",
        description: "",
        type: AlertType.FailureRate,
        threshold: 5,
        timeWindowMinutes: 15,
        cooldownMinutes: 15,
        recipients: [],
        enabled: true,
      },
      mode: "onChange",
    });

  useEffect(() => {
    if (alert) {
      const config = alert.config as Record<string, unknown>;
      reset({
        name: alert.name,
        description: alert.description,
        type: alert.type,
        threshold: (config.threshold as number) ?? 0,
        timeWindowMinutes: (config.timeWindowMinutes as number) ?? 15,
        resolveThreshold: config.resolveThreshold as number | undefined,
        recipients: alert.recipients,
        cooldownMinutes: alert.cooldownMinutes,
        enabled: alert.enabled,
      });
    }
  }, [alert, reset]);

  const alertType = watch("type");
  const recipients = watch("recipients");

  const needsTimeWindow =
    alertType === AlertType.FailureRate ||
    alertType === AlertType.ProcessingTimeAvg ||
    alertType === AlertType.ProcessingTimeP95 ||
    alertType === AlertType.ProcessingTimeP99;

  const updateAlert = trpc.alert.update.useMutation({
    onSuccess: () => {
      toast.success("Alert updated successfully");
      utils.alert.list.invalidate();
      utils.alert.get.invalidate({ id: alertId });
      onOpenChange?.(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addRecipient = () => {
    const email = recipientInput.trim();
    if (email && !recipients.includes(email)) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(email)) {
        setValue("recipients", [...recipients, email]);
        setRecipientInput("");
      } else {
        toast.error("Invalid email address");
      }
    }
  };

  const removeRecipient = (email: string) => {
    setValue(
      "recipients",
      recipients.filter((r) => r !== email)
    );
  };

  const onSubmit = (data: EditAlertFormValues) => {
    const config: Record<string, unknown> = {
      threshold: data.threshold,
    };

    if (needsTimeWindow && data.timeWindowMinutes) {
      config.timeWindowMinutes = data.timeWindowMinutes;
    }

    if (data.resolveThreshold !== undefined) {
      config.resolveThreshold = data.resolveThreshold;
    }

    updateAlert.mutate({
      id: alertId,
      name: data.name,
      description: data.description,
      type: data.type,
      config,
      recipients: data.recipients,
      cooldownMinutes: data.cooldownMinutes,
      enabled: data.enabled,
    });
  };

  const getThresholdLabel = () => {
    switch (alertType) {
      case AlertType.FailureRate:
        return "Failure Rate (%)";
      case AlertType.BacklogExceeded:
        return "Max Backlog (jobs)";
      case AlertType.ProcessingTimeAvg:
      case AlertType.ProcessingTimeP95:
      case AlertType.ProcessingTimeP99:
        return "Max Time (ms)";
      default:
        return "Threshold";
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Alert</DialogTitle>
          <DialogDescription>
            Modify alert settings and thresholds
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Controller
            name="enabled"
            control={control}
            render={({ field }) => (
              <Field>
                <div className="flex items-center justify-between">
                  <div>
                    <FieldLabel className="mb-0">Enabled</FieldLabel>
                    <p className="text-xs text-muted-foreground">
                      Enable or disable this alert
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

          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Alert Name</FieldLabel>
                <Input {...field} />
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Description (optional)</FieldLabel>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  className="h-20 resize-none"
                />
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="type"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Alert Type</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          {alertType !== AlertType.MissingWorkers && (
            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="threshold"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>{getThresholdLabel()}</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step={alertType === AlertType.FailureRate ? 0.1 : 1}
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="resolveThreshold"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Resolve Threshold</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step={alertType === AlertType.FailureRate ? 0.1 : 1}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined
                        )
                      }
                      placeholder="Same as threshold"
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          )}

          {needsTimeWindow && (
            <Controller
              name="timeWindowMinutes"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Time Window (minutes)</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={field.value ?? 15}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 15)
                    }
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}

          <Controller
            name="cooldownMinutes"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Cooldown (minutes)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(parseInt(e.target.value) || 15)
                  }
                />
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Field>
            <FieldLabel>Recipients</FieldLabel>
            <div className="flex gap-2">
              <Input
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                placeholder="email@example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addRecipient}>
                <Plus className="size-4" />
              </Button>
            </div>
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recipients.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-1 bg-zinc-800 text-zinc-200 px-2 py-1 rounded text-sm"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {formState.errors.recipients && (
              <p className="text-sm text-destructive mt-1">
                {formState.errors.recipients.message}
              </p>
            )}
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={formState.isSubmitting || !formState.isValid}
            >
              {updateAlert.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
