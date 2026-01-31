export const APP_NAME = "Hardware Monitor";

export const REFRESH_INTERVAL_MS = 1000; // 1 second polling

export const CHART_DATA_POINTS = 60; // Show last 60 seconds of data

export const COLORS = {
  cpu: {
    primary: "hsl(221.2 83.2% 53.3%)",
    gradient: ["hsl(221.2 83.2% 53.3%)", "hsl(221.2 83.2% 43.3%)"],
  },
  ram: {
    primary: "hsl(142.1 76.2% 36.3%)",
    gradient: ["hsl(142.1 76.2% 36.3%)", "hsl(142.1 76.2% 26.3%)"],
  },
  gpu: {
    primary: "hsl(47.9 95.8% 53.1%)",
    gradient: ["hsl(47.9 95.8% 53.1%)", "hsl(47.9 95.8% 43.1%)"],
  },
} as const;
