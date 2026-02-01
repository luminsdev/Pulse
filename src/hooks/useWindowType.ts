import { useState, useEffect } from "react";

export type WindowType = "main" | "mini";

/**
 * Hook to detect current window type from URL query parameter
 * In Tauri multi-window setup, each window can have a different URL
 * We use ?window=mini to identify the mini window
 */
export function useWindowType(): WindowType {
  const [windowType, setWindowType] = useState<WindowType>("main");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("window");
    
    if (type === "mini") {
      setWindowType("mini");
    } else {
      setWindowType("main");
    }
  }, []);

  return windowType;
}
