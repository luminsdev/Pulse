import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Check if we're in mini mode and set transparent background
const isMiniMode = new URLSearchParams(window.location.search).get("window") === "mini";
if (isMiniMode) {
  document.documentElement.style.backgroundColor = "transparent";
  document.body.style.backgroundColor = "transparent";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
