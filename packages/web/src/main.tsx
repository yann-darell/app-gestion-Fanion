import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Enregistrement du Service Worker PWA sur navigateur compatible
if ("serviceWorker" in navigator && process.env.NODE_ENV !== "test") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[PWA] Service Worker enregistré avec succès, scope:", reg.scope);
      })
      .catch((err) => {
        console.error("[PWA] Échec enregistrement Service Worker:", err);
      });
  });
}

