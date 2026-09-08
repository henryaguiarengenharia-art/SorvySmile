import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { SmileMapV4Demo } from "./components/SmileMapV4Demo";
import { SmileMapV5Demo } from "./components/SmileMapV5Demo";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
const demoParam = new URLSearchParams(window.location.search).get("demo");
const hostname = window.location.hostname.toLowerCase();

const isSmileMapV5PreviewHost =
  hostname.includes("--smile-map-v5-review-")
  || hostname.includes("--smile-map-v5-");

const isSmileMapV4PreviewHost =
  hostname.includes("--smile-map-v4-review-")
  || hostname.includes("--smile-map-v4-");

const isSmileMapV5Demo =
  isSmileMapV5PreviewHost
  || normalizedPath === "/demo/smile-map-v5"
  || demoParam === "smile-map-v5";

const isSmileMapV4Demo =
  !isSmileMapV5Demo
  && (
    isSmileMapV4PreviewHost
    || normalizedPath === "/demo/smile-map-v4"
    || demoParam === "smile-map-v4"
  );

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      {isSmileMapV5Demo ? (
        <SmileMapV5Demo />
      ) : isSmileMapV4Demo ? (
        <SmileMapV4Demo />
      ) : (
        <App />
      )}
    </AppErrorBoundary>
  </React.StrictMode>,
);
