import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { SmileMapV4Demo } from "./components/SmileMapV4Demo";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
const demoParam = new URLSearchParams(window.location.search).get("demo");
const isSmileMapV4Demo =
  normalizedPath === "/demo/smile-map-v4"
  || demoParam === "smile-map-v4";

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      {isSmileMapV4Demo ? <SmileMapV4Demo /> : <App />}
    </AppErrorBoundary>
  </React.StrictMode>,
);
