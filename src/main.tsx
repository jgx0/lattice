import React from "react";
import { createRoot } from "react-dom/client";
import site from "virtual:published-site";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import "katex/dist/katex.min.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App site={site} />
    </ErrorBoundary>
  </React.StrictMode>,
);
