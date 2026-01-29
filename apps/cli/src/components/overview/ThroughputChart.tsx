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
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import dayjs from "@bullstudio/dayjs";
import type { OverviewMetricsResponse } from "@/integrations/trpc/routers/overview";

type TimeSeriesDataPoint = OverviewMetricsResponse["timeSeries"][number];

type ThroughputChartProps = {
  data: TimeSeriesDataPoint[];
  timeRange: number;
};

const chartConfig: ChartConfig = {
  completed: {
    label: "Completed",
    color: "hsl(142, 76%, 36%)",
  },
  failed: {
    label: "Failed",
    color: "hsl(0, 84%, 60%)",
  },
};

export function ThroughputChart({ data, timeRange }: ThroughputChartProps) {
  const formattedData = data.map((point) => ({
    ...point,
    time: dayjs(point.timestamp).format(timeRange <= 24 ? "HH:mm" : "MMM D"),
  }));

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Job Throughput</CardTitle>
        <CardDescription className="text-zinc-500">
          Completed vs failed jobs over the last {timeRange}h
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={formattedData} accessibilityLayer>
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
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="completed"
              fill="var(--color-completed)"
              radius={[4, 4, 0, 0]}
              stackId="stack"
            />
            <Bar
              dataKey="failed"
              fill="var(--color-failed)"
              radius={[4, 4, 0, 0]}
              stackId="stack"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
