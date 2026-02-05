export type JobStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "paused"
  | "waiting-children";

export interface Job {
  id: string;
  name: string;
  queueName: string;
  data: unknown;
  status: JobStatus;
  progress: number | object;
  attemptsMade: number;
  attemptsLimit: number;
  failedReason?: string;
  stacktrace?: string[];
  returnValue?: unknown;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  delay?: number;
  priority?: number;
  parentId?: string;
  repeatJobKey?: string;
}

export interface JobFilter {
  status?: JobStatus | JobStatus[];
  name?: string;
  start?: number;
  end?: number;
}

export interface JobSort {
  field: "timestamp" | "processedOn" | "finishedOn" | "progress";
  order: "asc" | "desc";
}

export interface JobQueryOptions {
  filter?: JobFilter;
  sort?: JobSort;
  limit?: number;
  offset?: number;
}

/**
 * Lightweight job summary for list views.
 * Excludes heavy payload fields (data, returnValue, stacktrace, failedReason)
 * to improve performance when displaying large job lists.
 */
export interface JobSummary {
  id: string;
  name: string;
  queueName: string;
  status: JobStatus;
  progress: number | object;
  attemptsMade: number;
  attemptsLimit: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  delay?: number;
  priority?: number;
  parentId?: string;
  repeatJobKey?: string;
  // Size hints for UI indicators
  hasData: boolean;
  dataSize?: number;
  hasReturnValue: boolean;
  hasStacktrace: boolean;
  hasFailedReason: boolean;
  // Included for failed job tracking in overview metrics
  failedReason?: string;
}
