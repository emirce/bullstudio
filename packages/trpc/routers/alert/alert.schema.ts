import { z } from "zod";
import { AlertType, AlertStatus } from "@bullstudio/prisma";

// Config schemas for each alert type
const failureRateConfigSchema = z.object({
  threshold: z.number().min(0).max(100),
  timeWindowMinutes: z.number().min(1).max(60),
  resolveThreshold: z.number().min(0).max(100).optional(),
});

const backlogConfigSchema = z.object({
  threshold: z.number().min(1),
  resolveThreshold: z.number().min(0).optional(),
});

const processingTimeConfigSchema = z.object({
  threshold: z.number().min(1),
  timeWindowMinutes: z.number().min(1).max(60),
  resolveThreshold: z.number().min(0).optional(),
});

const missingWorkersConfigSchema = z.object({
  gracePeriodMinutes: z.number().min(0).optional(),
});

// Union of all config types
const alertConfigSchema = z.union([
  failureRateConfigSchema,
  backlogConfigSchema,
  processingTimeConfigSchema,
  missingWorkersConfigSchema,
]);

// Create alert schema
export const createAlertSchema = z.object({
  connectionId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  queueName: z.string().min(1),
  type: z.nativeEnum(AlertType),
  config: alertConfigSchema,
  recipients: z.array(z.string().email()).min(1),
  cooldownMinutes: z.number().min(1).max(1440).default(15),
  enabled: z.boolean().default(true),
});

export type CreateAlertInput = z.infer<typeof createAlertSchema>;

// Update alert schema
export const updateAlertSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  queueName: z.string().min(1).optional(),
  type: z.nativeEnum(AlertType).optional(),
  config: alertConfigSchema.optional(),
  recipients: z.array(z.string().email()).min(1).optional(),
  cooldownMinutes: z.number().min(1).max(1440).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;

// Delete alert schema
export const deleteAlertSchema = z.object({
  id: z.string(),
});

export type DeleteAlertInput = z.infer<typeof deleteAlertSchema>;

// List alerts schema
export const listAlertsSchema = z.object({
  workspaceId: z.string(),
  connectionId: z.string().optional(),
  queueName: z.string().optional(),
  status: z.nativeEnum(AlertStatus).optional(),
  type: z.nativeEnum(AlertType).optional(),
  enabled: z.boolean().optional(),
});

export type ListAlertsInput = z.infer<typeof listAlertsSchema>;

// Get alert schema
export const getAlertSchema = z.object({
  id: z.string(),
  includeHistory: z.boolean().default(false),
  historyLimit: z.number().min(1).max(100).default(50),
});

export type GetAlertInput = z.infer<typeof getAlertSchema>;

// Test alert schema
export const testAlertSchema = z.object({
  id: z.string(),
});

export type TestAlertInput = z.infer<typeof testAlertSchema>;

// Config type exports for type-safe access
export type FailureRateConfig = z.infer<typeof failureRateConfigSchema>;
export type BacklogConfig = z.infer<typeof backlogConfigSchema>;
export type ProcessingTimeConfig = z.infer<typeof processingTimeConfigSchema>;
export type MissingWorkersConfig = z.infer<typeof missingWorkersConfigSchema>;
export type AlertConfig = z.infer<typeof alertConfigSchema>;
