import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const splash = document.getElementById("app-splash");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App/></React.StrictMode>
);

window.requestAnimationFrame(() => {
  window.setTimeout(() => {
    splash?.classList.add("hide");
    window.setTimeout(() => splash?.remove(), 260);
  }, 450);
});
