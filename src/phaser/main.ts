import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene";

const root = document.getElementById("phaser-test-root");
if (!root) throw new Error("Missing #phaser-test-root");

new Phaser.Game({
  type: Phaser.AUTO,
  parent: root,
  width: 1280,
  height: 720,
  backgroundColor: "#171717",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BattleScene],
});
