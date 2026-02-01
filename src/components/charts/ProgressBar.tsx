import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ProgressBarProps {
  /** Current value (0-100) */
  value: number;
  /** Color of the progress bar */
  color?: string;
  /** Height of the bar */
  height?: number;
  /** Whether to show the percentage text */
  showValue?: boolean;
  /** Additional className */
  className?: string;
  /** Animate changes */
  animate?: boolean;
}

/**
 * Animated progress bar for displaying usage percentages
 */
export function ProgressBar({
  value,
  color = "hsl(var(--primary))",
  height = 8,
  showValue = false,
  className,
  animate = true,
}: ProgressBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(100, Math.max(0, value));

  // Determine color based on usage level
  const getStatusColor = (val: number): string => {
    if (color !== "hsl(var(--primary))") return color;
    if (val >= 90) return "hsl(var(--destructive))";
    if (val >= 70) return "hsl(38 92% 50%)"; // Warning orange
    return color;
  };

  const barColor = getStatusColor(clampedValue);

  return (
    <div className={cn("w-full", className)}>
      <div
        className="w-full overflow-hidden rounded-full bg-secondary"
        style={{ height }}
      >
        {animate ? (
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: barColor }}
            initial={{ width: 0 }}
            animate={{ width: `${clampedValue}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        ) : (
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${clampedValue}%`,
              backgroundColor: barColor,
            }}
          />
        )}
      </div>
      {showValue && (
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {clampedValue.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

/**
 * Circular progress indicator
 */
export function CircularProgress({
  value,
  size = 60,
  strokeWidth = 6,
  color = "hsl(var(--primary))",
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedValue / 100) * circumference;

  // Determine color based on usage level
  const getStatusColor = (val: number): string => {
    if (color !== "hsl(var(--primary))") return color;
    if (val >= 90) return "hsl(var(--destructive))";
    if (val >= 70) return "hsl(38 92% 50%)";
    return color;
  };

  return (
    <div className={cn("relative inline-flex", className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getStatusColor(clampedValue)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold">{Math.round(clampedValue)}%</span>
      </div>
    </div>
  );
}
