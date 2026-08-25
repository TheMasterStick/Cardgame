import React from "react";
import ReactDOM from "react-dom/client";
import { CARD_DEFINITIONS } from "../data/cards";
import { migrateStoredCardBuilderArtPaths, resolveCardDefinitionArtPaths } from "../card-rendering/artAsset";
import { CardBuilderApp } from "./CardBuilderApp";
import "./font-preview.css";
import "./card-builder.css";
import "./art-guide.css";
import "./resource-icons.css";

const root = document.getElementById("card-builder-root");
if (!root) throw new Error("Missing #card-builder-root");

async function bootstrap() {
  await resolveCardDefinitionArtPaths(CARD_DEFINITIONS);
  await migrateStoredCardBuilderArtPaths();

  ReactDOM.createRoot(root!).render(
    <React.StrictMode>
      <CardBuilderApp />
    </React.StrictMode>,
  );
}

void bootstrap();
