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
}

/**
 * Warning banner for sidecar issues
 * Shows appropriate icon and message based on status type
 */
export function SidecarWarning({ status, message, show, onDismiss }: SidecarWarningProps) {
  if (!status || !show) return null;

  // Determine variant based on status
  const isAdminIssue = status.status === "requires_admin";
  const isRestarting = status.status === "stopped" && status.can_restart;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={`
            rounded-lg border px-4 py-3 text-sm
            ${isAdminIssue 
              ? "border-amber-500/50 bg-amber-500/10 text-amber-200" 
              : isRestarting
              ? "border-blue-500/50 bg-blue-500/10 text-blue-200"
              : "border-red-500/50 bg-red-500/10 text-red-200"
            }
          `}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Icon */}
              {isRestarting ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : isAdminIssue ? (
                <ShieldAlert className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              
              {/* Message */}
              <span>{message}</span>
            </div>

            {/* Dismiss button (only for non-critical) */}
            {onDismiss && !isAdminIssue && (
              <button
                onClick={onDismiss}
                className="rounded p-1 hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Help text for admin issue */}
          {isAdminIssue && (
            <p className="mt-2 text-xs opacity-75">
              Close the app and right-click → "Run as administrator" to enable CPU/GPU temperature monitoring.
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
