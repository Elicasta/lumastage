import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DisplayOutputView } from "./DisplayOutputView";
import "./styles.css";
import "./luma-foundation.css";

const params = new URLSearchParams(window.location.search);
const Root = params.get("output") === "display" ? DisplayOutputView : App;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
