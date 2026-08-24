import React from "react";
import ReactDOM from "react-dom/client";
import { CARD_DEFINITIONS } from "../data/cards";
import { resolveCardArtPath, resolveCardDefinitionArtPaths } from "../card-rendering/artAsset";
import { CardBuilderApp } from "./CardBuilderApp";
import "./font-preview.css";
import "./card-builder.css";
import "./art-guide.css";
import "./resource-icons.css";

const root = document.getElementById("card-builder-root");
if (!root) throw new Error("Missing #card-builder-root");

async function migrateStoredDraftArtPaths() {
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(
    (key): key is string => Boolean(key?.startsWith("card-builder:draft:")),
  );

  await Promise.all(
    keys.map(async (key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const draft = JSON.parse(raw) as { art?: unknown };
        if (typeof draft.art !== "string" || !draft.art) return;
        const resolved = await resolveCardArtPath(draft.art);
        if (resolved === draft.art) return;
        draft.art = resolved;
        localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        // Leave malformed/legacy drafts alone; CardBuilderApp already handles invalid JSON on selection.
      }
    }),
  );
}

async function bootstrap() {
  await resolveCardDefinitionArtPaths(CARD_DEFINITIONS);
  await migrateStoredDraftArtPaths();

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <CardBuilderApp />
    </React.StrictMode>,
  );
}

void bootstrap();
