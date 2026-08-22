import React from "react";
import ReactDOM from "react-dom/client";
import { CardBuilderApp } from "./CardBuilderApp";
import "./card-builder.css";
import "./art-guide.css";

const root = document.getElementById("card-builder-root");
if (!root) throw new Error("Missing #card-builder-root");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <CardBuilderApp />
  </React.StrictMode>,
);
