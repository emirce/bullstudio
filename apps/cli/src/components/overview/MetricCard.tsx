import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bullstudio/ui/components/card";
import { ChartContainer } from "@bullstudio/ui/components/chart";
import { Area, AreaChart } from "recharts";
import { cn } from "@bullstudio/ui/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  sparklineData?: { value: number }[];
  sparklineColor?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
};

export function MetricCard({
  title,
  value,
  subtitle,
  sparklineData,
  sparklineColor = "hsl(var(--chart-1))",
  trend,
  icon,
}: MetricCardProps) {
  const TrendIcon =
    trend?.direction === "up"
      ? TrendingUp
      : trend?.direction === "down"
        ? TrendingDown
        : Minus;

  const trendColorClass =
    trend?.direction === "neutral"
      ? "text-zinc-500"
      : trend?.isPositive
        ? "text-emerald-500"
        : "text-red-500";

  const gradientId = `gradient-${title.replace(/\s+/g, "-")}`;

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-zinc-100">{value}</div>
            {subtitle && (
              <div className="text-xs text-zinc-500">{subtitle}</div>
            )}
          </div>
          {trend && trend.direction !== "neutral" && (
            <div
              className={cn("flex items-center gap-1 text-sm", trendColorClass)}
            >
              <TrendIcon className="size-4" />
              <span>{trend.value}%</span>
            </div>
          )}
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="h-12 mt-2">
            <ChartContainer
              config={{ value: { color: sparklineColor } }}
              className="h-full w-full"
            >
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={sparklineColor}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor={sparklineColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
