import { useEffect, useRef, useCallback } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

/**
 * Custom hook to listen to Tauri events
 * Automatically cleans up listener on unmount
 *
 * @param eventName - The name of the Tauri event to listen to
 * @param handler - Callback function to handle the event payload
 *
 * @example
 * ```tsx
 * useTauriEvent<SystemStats>("system-stats", (stats) => {
 *   console.log("Received stats:", stats);
 *   setStats(stats);
 * });
 * ```
 */
export function useTauriEvent<T>(
  eventName: string,
  handler: (payload: T) => void
): void {
  // Use ref to avoid re-subscribing when handler changes
  const handlerRef = useRef(handler);

  // Update ref when handler changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let mounted = true;

    const setupListener = async () => {
      try {
        unlisten = await listen<T>(eventName, (event) => {
          if (mounted) {
            handlerRef.current(event.payload);
          }
        });
      } catch (error) {
        console.error(`Failed to listen to event "${eventName}":`, error);
      }
    };

    setupListener();

    // Cleanup function
    return () => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName]);
}

/**
 * Hook that returns a stable callback for the event handler
 * Useful when you need to pass dependencies but don't want to re-subscribe
 */
export function useTauriEventCallback<T>(
  eventName: string,
  handler: (payload: T) => void,
  deps: React.DependencyList
): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableHandler = useCallback(handler, deps);
  useTauriEvent(eventName, stableHandler);
}
