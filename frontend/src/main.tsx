// main.tsx — app entry point
// Finds <div id="root"> in index.html and mounts <App /> inside it.
// All UI rendering is handled in JavaScript after this — no full page reloads needed.
//
// StrictMode adds extra development checks; it has no effect in production.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
