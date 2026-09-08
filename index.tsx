import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { SmileMapV4Demo } from "./components/SmileMapV4Demo";
import { SmileMapV5Demo } from "./components/SmileMapV5Demo";
import { SmileFocusV6Demo } from "./components/SmileFocusV6Demo";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
const demoParam = new URLSearchParams(window.location.search).get("demo");
const hostname = window.location.hostname.toLowerCase();

const isSmileFocusV6PreviewHost =
  hostname.includes("--smile-focus-v6-review-")
  || hostname.includes("--smile-focus-v6-");

const isSmileMapV5PreviewHost =
  hostname.includes("--smile-map-v5-review-")
  || hostname.includes("--smile-map-v5-");

const isSmileMapV4PreviewHost =
  hostname.includes("--smile-map-v4-review-")
  || hostname.includes("--smile-map-v4-");

const isSmileFocusV6Demo =
  isSmileFocusV6PreviewHost
  || normalizedPath === "/demo/smile-focus-v6"
  || demoParam === "smile-focus-v6";

const isSmileMapV5Demo =
  !isSmileFocusV6Demo
  && (
    isSmileMapV5PreviewHost
    || normalizedPath === "/demo/smile-map-v5"
    || demoParam === "smile-map-v5"
  );

const isSmileMapV4Demo =
  !isSmileFocusV6Demo
  && !isSmileMapV5Demo
  && (
    isSmileMapV4PreviewHost
    || normalizedPath === "/demo/smile-map-v4"
    || demoParam === "smile-map-v4"
  );

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      {isSmileFocusV6Demo ? (
        <SmileFocusV6Demo />
      ) : isSmileMapV5Demo ? (
        <SmileMapV5Demo />
      ) : isSmileMapV4Demo ? (
        <SmileMapV4Demo />
      ) : (
        <App />
      )}
    </AppErrorBoundary>
  </React.StrictMode>,
);
