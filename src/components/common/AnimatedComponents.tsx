import { motion, HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated Card wrapper with hover effects
 * Wraps content with subtle scale and shadow animations on hover
 */
export const AnimatedCard = forwardRef<
  HTMLDivElement,
  HTMLMotionProps<"div"> & { enableHover?: boolean }
>(({ className, enableHover = true, children, ...props }, ref) => (
  <motion.div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      enableHover && "cursor-pointer",
      className
    )}
    whileHover={enableHover ? { 
      scale: 1.01, 
      boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12)",
      transition: { duration: 0.2 }
    } : undefined}
    whileTap={enableHover ? { 
      scale: 0.99,
      transition: { duration: 0.1 }
    } : undefined}
    {...props}
  >
    {children}
  </motion.div>
));
AnimatedCard.displayName = "AnimatedCard";

/**
 * Animated button wrapper with press feedback
 */
export const AnimatedButton = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<"button">
>(({ className, children, ...props }, ref) => (
  <motion.button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
      "ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2",
      "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    {...props}
  >
    {children}
  </motion.button>
));
AnimatedButton.displayName = "AnimatedButton";

/**
 * Icon button with rotation animation on hover
 */
export const AnimatedIconButton = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<"button"> & { rotateOnHover?: boolean }
>(({ className, rotateOnHover = false, children, ...props }, ref) => (
  <motion.button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-md p-2",
      "hover:bg-accent hover:text-accent-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      className
    )}
    whileHover={{ 
      scale: 1.1,
      rotate: rotateOnHover ? 90 : 0 
    }}
    whileTap={{ scale: 0.9 }}
    transition={{ type: "spring", stiffness: 400, damping: 17 }}
    {...props}
  >
    {children}
  </motion.button>
));
AnimatedIconButton.displayName = "AnimatedIconButton";

/**
 * Staggered list container for animating children sequentially
 */
export const StaggerContainer = forwardRef<
  HTMLDivElement,
  HTMLMotionProps<"div"> & { staggerDelay?: number }
>(({ className, staggerDelay = 0.1, children, ...props }, ref) => (
  <motion.div
    ref={ref}
    className={className}
    initial="hidden"
    animate="visible"
    variants={{
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: staggerDelay,
        },
      },
    }}
    {...props}
  >
    {children}
  </motion.div>
));
StaggerContainer.displayName = "StaggerContainer";

/**
 * Stagger item - use inside StaggerContainer
 */
export const StaggerItem = forwardRef<
  HTMLDivElement,
  HTMLMotionProps<"div">
>(({ className, children, ...props }, ref) => (
  <motion.div
    ref={ref}
    className={className}
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.3, ease: "easeOut" }
      },
    }}
    {...props}
  >
    {children}
  </motion.div>
));
StaggerItem.displayName = "StaggerItem";

/**
 * Pulse animation for attention-grabbing elements
 */
export const PulseIndicator = ({ 
  className,
  color = "bg-green-500" 
}: { 
  className?: string;
  color?: string;
}) => (
  <span className={cn("relative flex h-3 w-3", className)}>
    <span className={cn(
      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
      color
    )} />
    <span className={cn(
      "relative inline-flex rounded-full h-3 w-3",
      color
    )} />
  </span>
);

/**
 * Fade in animation wrapper
 */
export const FadeIn = forwardRef<
  HTMLDivElement,
  HTMLMotionProps<"div"> & { delay?: number; duration?: number }
>(({ className, delay = 0, duration = 0.3, children, ...props }, ref) => (
  <motion.div
    ref={ref}
    className={className}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration, ease: "easeOut" }}
    {...props}
  >
    {children}
  </motion.div>
));
FadeIn.displayName = "FadeIn";

/**
 * Shimmer loading effect
 */
export const Shimmer = ({ className }: { className?: string }) => (
  <div className={cn(
    "animate-pulse rounded-md bg-muted",
    className
  )} />
);

/**
 * Number counter animation
 */
export const AnimatedNumber = ({ 
  value, 
  duration = 0.5,
  className 
}: { 
  value: number; 
  duration?: number;
  className?: string;
}) => (
  <motion.span
    className={className}
    key={value}
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration }}
  >
    {value}
  </motion.span>
);
