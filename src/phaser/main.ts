import Phaser from "phaser";
import { CARD_DEFINITIONS } from "../data/cards";
import { migrateStoredCardBuilderArtPaths, resolveCardDefinitionArtPaths } from "../card-rendering/artAsset";
import { EngineBattleScene } from "./scenes/EngineBattleScene";

const root = document.getElementById("phaser-test-root");
if (!root) throw new Error("Missing #phaser-test-root");

async function bootstrap() {
  await resolveCardDefinitionArtPaths(CARD_DEFINITIONS);
  await migrateStoredCardBuilderArtPaths();

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: root,
    width: 1920,
    height: 1080,
    backgroundColor: "#171717",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [EngineBattleScene],
  });
}

void bootstrap();
