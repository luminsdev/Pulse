import { useId, useMemo } from "react";

interface SparklineProps {
  data: number[]; // Array of values from 0 to 100
  color: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color, width = 75, height = 14 }: SparklineProps) {
  const reactId = useId();

  const pathData = useMemo(() => {
    if (!data || data.length < 2) return "";
    
    const maxPoints = 60;
    const visibleData = data.slice(-maxPoints);

    const stepX = width / (visibleData.length - 1);
    
    return visibleData.map((val, i) => {
      // SVG Y is inverted (0 is top)
      const x = i * stepX;
      // Value is 0-100, scale to height
      const y = height - (Math.min(100, Math.max(0, val)) / 100) * height;
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(" ");
  }, [data, width, height]);

  if (!pathData) {
    return <svg width={width} height={height} aria-hidden="true" focusable="false" />;
  }

  const gradId = `sparkline-${reactId.replace(/:/g, "")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      <path
        d={`${pathData} L ${width},${height} L 0,${height} Z`}
        fill={`url(#${gradId})`}
        opacity="0.2"
      />
    </svg>
  );
}
