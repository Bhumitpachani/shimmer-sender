import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

// After a new deploy, a tab left open from before still references old chunk
// filenames. Navigating to a route whose chunk no longer exists on the CDN
// fails silently (the URL/sidebar update but the page content gets stuck) —
// force a reload so the tab picks up the current build instead of hanging.
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
