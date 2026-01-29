import { MetricCard } from "./MetricCard";
import { Activity, AlertTriangle, Clock, TimerIcon } from "lucide-react";
import type { OverviewMetricsResponse } from "@/integrations/trpc/routers/overview";
import { formatDuration, formatThroughput } from "@bullstudio/ui/shared";

type MetricCardsGridProps = {
  summary: OverviewMetricsResponse["summary"];
  timeSeries: OverviewMetricsResponse["timeSeries"];
  timeRange: number;
};

function calculateTrend(
  data: number[]
): { value: number; direction: "up" | "down" | "neutral" } {
  if (data.length < 4) return { value: 0, direction: "neutral" };

  const midpoint = Math.floor(data.length / 2);
  const recentData = data.slice(midpoint);
  const previousData = data.slice(0, midpoint);

  const recent = recentData.reduce((a, b) => a + b, 0) / recentData.length;
  const previous =
    previousData.reduce((a, b) => a + b, 0) / previousData.length;

  if (previous === 0) return { value: 0, direction: "neutral" };

  const change = ((recent - previous) / previous) * 100;
  return {
    value: Math.abs(Math.round(change)),
    direction: change > 5 ? "up" : change < -5 ? "down" : "neutral",
  };
}

export function MetricCardsGrid({
  summary,
  timeSeries,
  timeRange,
}: MetricCardsGridProps) {
  const throughputSparkline = timeSeries.map((point) => ({
    value: point.completed + point.failed,
  }));

  const failureSparkline = timeSeries.map((point) => {
    const total = point.completed + point.failed;
    return {
      value: total > 0 ? (point.failed / total) * 100 : 0,
    };
  });

  const processingTimeSparkline = timeSeries.map((point) => ({
    value: point.avgProcessingTimeMs,
  }));

  const delaySparkline = timeSeries.map((point) => ({
    value: point.avgDelayMs,
  }));

  const throughputTrend = calculateTrend(
    throughputSparkline.map((d) => d.value)
  );
  const failureTrend = calculateTrend(failureSparkline.map((d) => d.value));
  const processingTimeTrend = calculateTrend(
    processingTimeSparkline.map((d) => d.value)
  );
  const delayTrend = calculateTrend(delaySparkline.map((d) => d.value));

  const totalJobs = summary.totalCompleted + summary.totalFailed;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Throughput"
        value={formatThroughput(summary.avgThroughputPerHour)}
        subtitle={`${totalJobs.toLocaleString()} jobs in ${timeRange}h`}
        icon={<Activity className="size-4" />}
        sparklineData={throughputSparkline}
        sparklineColor="hsl(142, 76%, 36%)"
        trend={{
          ...throughputTrend,
          isPositive: throughputTrend.direction === "up",
        }}
      />

      <MetricCard
        title="Failure Rate"
        value={`${summary.failureRate.toFixed(1)}%`}
        subtitle={`${summary.totalFailed.toLocaleString()} failed jobs`}
        icon={<AlertTriangle className="size-4" />}
        sparklineData={failureSparkline}
        sparklineColor="hsl(0, 84%, 60%)"
        trend={{
          ...failureTrend,
          isPositive: failureTrend.direction === "down",
        }}
      />

      <MetricCard
        title="Processing Time"
        value={formatDuration(summary.avgProcessingTimeMs)}
        subtitle="avg per job"
        icon={<Clock className="size-4" />}
        sparklineData={processingTimeSparkline}
        sparklineColor="hsl(217, 91%, 60%)"
        trend={{
          ...processingTimeTrend,
          isPositive: processingTimeTrend.direction === "down",
        }}
      />

      <MetricCard
        title="Queue Delay"
        value={formatDuration(summary.avgDelayMs)}
        subtitle="avg wait time"
        icon={<TimerIcon className="size-4" />}
        sparklineData={delaySparkline}
        sparklineColor="hsl(45, 93%, 47%)"
        trend={{
          ...delayTrend,
          isPositive: delayTrend.direction === "down",
        }}
      />
    </div>
  );
}
