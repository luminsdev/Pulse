import { motion } from "framer-motion";

interface SkeletonLoaderProps {
  label: string;
  lines?: number;
}

export function SkeletonLoader({ label, lines = 3 }: SkeletonLoaderProps) {
  const lineCount = Math.max(0, Math.floor(lines));
  const lineWidths = Array.from(
    { length: lineCount },
    (_, index) => `${72 - ((index * 11) % 28)}%`
  );

  return (
    <div className="flex h-32 w-full flex-col justify-center space-y-3 font-mono text-xs">
      <div className="flex items-center gap-2">
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="h-2 w-2 bg-[#8a8a8a]"
        />
        <span className="text-[#8a8a8a] tracking-widest uppercase">[{label}]</span>
      </div>

      <div className="space-y-2">
        {lineWidths.map((width, i) => (
          <motion.div
            key={i}
            className="h-2 bg-[#1a1a1a] rounded-sm"
            style={{ width }}
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}
