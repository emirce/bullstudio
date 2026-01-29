import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@bullstudio/ui/components/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@bullstudio/ui/components/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import dayjs from "@bullstudio/dayjs";
import type { OverviewMetricsResponse } from "@/integrations/trpc/routers/overview";
import { formatMs } from "@bullstudio/ui/shared";

type TimeSeriesDataPoint = OverviewMetricsResponse["timeSeries"][number];

type ProcessingTimeChartProps = {
  data: TimeSeriesDataPoint[];
  timeRange: number;
};

const chartConfig: ChartConfig = {
  processingTime: {
    label: "Processing Time",
    color: "hsl(217, 91%, 60%)",
  },
  queueDelay: {
    label: "Queue Delay",
    color: "hsl(45, 93%, 47%)",
  },
};

export function ProcessingTimeChart({
  data,
  timeRange,
}: ProcessingTimeChartProps) {
  const formattedData = data.map((point) => ({
    time: dayjs(point.timestamp).format(timeRange <= 24 ? "HH:mm" : "MMM D"),
    processingTime: Math.round(point.avgProcessingTimeMs),
    queueDelay: Math.round(point.avgDelayMs),
  }));

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Processing Performance</CardTitle>
        <CardDescription className="text-zinc-500">
          Average processing time and queue delay over the last {timeRange}h
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart data={formattedData} accessibilityLayer>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={(value: number) => formatMs(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatMs(value as number)}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="processingTime"
              stroke="var(--color-processingTime)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="queueDelay"
              stroke="var(--color-queueDelay)"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
