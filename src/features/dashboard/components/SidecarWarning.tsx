import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, X, RefreshCcw } from "lucide-react";
import type { SidecarStatusPayload } from "@/types/stats";

interface SidecarWarningProps {
  /** Sidecar status */
  status: SidecarStatusPayload | null;
  /** Human-readable message */
  message: string;
  /** Whether to show the warning */
  show: boolean;
  /** Callback to dismiss */
  onDismiss?: () => void;
  /** Callback to manually retry monitoring */
  onRetry?: () => Promise<void> | void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
}

/**
 * Warning banner for sidecar issues, optimized for Precision Telemetry Console
 */
export function SidecarWarning({
  status,
  message,
  show,
  onDismiss,
  onRetry,
  isRetrying = false,
}: SidecarWarningProps) {
  if (!status || !show) return null;

  // Determine variant based on status
  const isAdminIssue = status.status === "requires_admin";
  const isRestarting = status.status === "stopped" && status.can_restart;
  const showRetry = onRetry && !isAdminIssue;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          role="alert"
          className={`
            overflow-hidden border p-3 text-xs font-mono rounded-sm tracking-wide uppercase
            ${isAdminIssue 
              ? "border-amber-500/30 bg-amber-950/20 text-amber-200"
              : isRestarting
              ? "border-blue-500/30 bg-blue-950/20 text-blue-200"
              : "border-red-500/30 bg-red-950/20 text-red-200"
            }
          `}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {/* Icon */}
              {isRestarting ? (
                <RefreshCcw className="h-4 w-4 animate-spin shrink-0 text-blue-400" />
              ) : isAdminIssue ? (
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              )}
              
              {/* Message */}
              <span className="min-w-0 break-words font-semibold">{message.toUpperCase()}</span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {showRetry && (
                <button
                  onClick={() => void onRetry()}
                  disabled={isRetrying}
                  className="inline-flex min-h-7 items-center gap-1 rounded-sm border border-current px-2 py-0.5 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Retry temperature monitoring"
                >
                  <RefreshCcw className={`h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
                  <span>RETRY</span>
                </button>
              )}

              {/* Dismiss button */}
              {onDismiss && !isAdminIssue && (
                <button
                  onClick={onDismiss}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-transparent transition-colors hover:border-current"
                  aria-label="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Help text for admin issue */}
          {isAdminIssue && (
            <p className="mt-2 text-[10px] text-amber-400/80 leading-normal normal-case">
              * CLOSE THE APP AND RIGHT-CLICK &rarr; "RUN AS ADMINISTRATOR" TO ENABLE HARDWARE TEMPERATURE & CLOCK SENSORS.
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
