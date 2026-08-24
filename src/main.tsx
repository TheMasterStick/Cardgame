import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CARD_DEFINITIONS } from "./data/cards";
import { resolveCardDefinitionArtPaths } from "./card-rendering/artAsset";
import { AuthProvider } from "./lib/AuthProvider";
import "./ui/styles.css";

async function bootstrap() {
  await resolveCardDefinitionArtPaths(CARD_DEFINITIONS);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>,
  );
}

void bootstrap();
