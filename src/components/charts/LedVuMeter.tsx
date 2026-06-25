import { useMemo } from "react";

interface LedVuMeterProps {
  /** Value from 0 to 100 */
  value: number;
  /** Accessible label for the meter */
  label: string;
  /** Max segments (default: 20) */
  maxSegments?: number;
  /** Force specific color active mode: 'normal' | 'warning' | 'critical' | 'fps' */
  mode?: "normal" | "warning" | "critical" | "fps";
}

export function LedVuMeter({ value, label, maxSegments = 20, mode }: LedVuMeterProps) {
  const segmentCount = Math.max(1, Math.floor(maxSegments));
  const percentage = Math.min(Math.max(value, 0), 100);
  const roundedPercentage = Math.round(percentage);
  const activeSegments = Math.round((percentage / 100) * segmentCount);

  const segments = useMemo(() => {
    return Array.from({ length: segmentCount }).map((_, idx) => {
      const isActive = idx < activeSegments;
      let segmentMode = mode;

      if (!segmentMode) {
        const segPercent = (idx / segmentCount) * 100;
        if (segPercent >= 85) {
          segmentMode = "critical";
        } else if (segPercent >= 65) {
          segmentMode = "warning";
        } else {
          segmentMode = "normal";
        }
      }

      return {
        isActive,
        className: isActive
          ? segmentMode === "critical"
            ? "active-critical"
            : segmentMode === "warning"
            ? "active-warning"
            : segmentMode === "fps"
            ? "active-fps"
            : "active-normal"
          : "",
      };
    });
  }, [activeSegments, segmentCount, mode]);

  return (
    <div
      className="led-bar"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={roundedPercentage}
      aria-valuetext={`${percentage.toFixed(1)}%`}
    >
      {segments.map((seg, idx) => (
        <div
          key={idx}
          className={`led-segment ${seg.className}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
