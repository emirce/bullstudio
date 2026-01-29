export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function formatThroughput(jobsPerHour: number): string {
  if (jobsPerHour < 1) return `${(jobsPerHour * 60).toFixed(1)}/min`;
  if (jobsPerHour >= 1000) return `${(jobsPerHour / 1000).toFixed(1)}k/h`;
  return `${jobsPerHour.toFixed(1)}/h`;
}

export function formatMs(value: number): string {
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)}s`;
  return `${(value / 60000).toFixed(1)}m`;
}

export function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}
