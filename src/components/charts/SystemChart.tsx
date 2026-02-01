import { useMemo } from "react";
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

export interface ChartDataPoint {
  timestamp: number;
  value: number;
}

interface SystemChartProps {
  /** Data points to display */
  data: ChartDataPoint[];
  /** Color for the area fill (CSS color) */
  color?: string;
  /** Height of the chart */
  height?: number;
  /** Whether to show axes */
  showAxes?: boolean;
  /** Whether to animate on data change */
  animate?: boolean;
  /** Additional className */
  className?: string;
  /** Label for tooltip */
  label?: string;
  /** Gradient ID (unique per chart instance) */
  gradientId?: string;
}

/**
 * Realtime area chart for system metrics
 * Optimized for smooth updates at 1 second intervals
 */
export function SystemChart({
  data,
  color = "hsl(var(--primary))",
  height = 80,
  showAxes = false,
  animate = false,
  className,
  label = "Usage",
  gradientId = "chartGradient",
}: SystemChartProps) {
  // Format data for Recharts - reverse so newest is on the right
  const chartData = useMemo(() => {
    return data.map((point, index) => ({
      index,
      value: point.value,
      time: `${data.length - index}s ago`,
    }));
  }, [data]);

  // Generate unique gradient ID to avoid conflicts
  const uniqueGradientId = `${gradientId}-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart
          data={chartData}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={uniqueGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {showAxes && (
            <>
              <XAxis
                dataKey="index"
                axisLine={false}
                tickLine={false}
                tick={false}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                width={30}
              />
            </>
          )}

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-md border bg-popover px-3 py-1.5 text-xs shadow-md">
                    <span className="text-muted-foreground">{label}: </span>
                    <span className="font-medium">
                      {Number(payload[0].value).toFixed(1)}%
                    </span>
                  </div>
                );
              }
              return null;
            }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${uniqueGradientId})`}
            isAnimationActive={animate}
            animationDuration={300}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Mini sparkline version of the chart
 * For use in compact card headers
 */
export function SparklineChart({
  data,
  color = "hsl(var(--primary))",
  className,
}: {
  data: ChartDataPoint[];
  color?: string;
  className?: string;
}) {
  return (
    <SystemChart
      data={data}
      color={color}
      height={40}
      showAxes={false}
      animate={false}
      className={className}
      gradientId="sparkline"
    />
  );
}
