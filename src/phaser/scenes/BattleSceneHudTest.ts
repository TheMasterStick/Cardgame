import Phaser from "phaser";
import { BattleScene } from "./BattleScene";

const HERO_X = 365;
const ENEMY_HERO_Y = 245;
const PLAYER_HERO_Y = 795;
const SIGNATURE_X = 465;
const GRAVEYARD_X = 1770;
const PLAYER_GRAVEYARD_COUNT_Y = 955;

type TooltipSpec = {
  title: string;
  body: string;
};

export class BattleSceneHudTest extends BattleScene {
  private tooltip: Phaser.GameObjects.Container | null = null;

  create() {
    super.create();

    this.createHeroAbilityHud("enemy");
    this.createHeroAbilityHud("player");
    this.keepBurnedCardsOutOfGraveyardDisplay();
  }

  private createHeroAbilityHud(owner: "enemy" | "player") {
    const heroY = owner === "enemy" ? ENEMY_HERO_Y : PLAYER_HERO_Y;
    const passiveY = owner === "enemy" ? heroY + 98 : heroY - 98;

    this.createHoverPanel(
      HERO_X,
      passiveY,
      132,
      44,
      "PASSIVE\nTest Passive",
      0x75634e,
      {
        title: "Test Passive",
        body: "Placeholder passive effect.\nHover behavior and positioning test only.",
      },
    );

    this.createHoverPanel(
      SIGNATURE_X,
      heroY,
      82,
      66,
      "SIGNATURE\nTest Ability",
      0x73577f,
      {
        title: "Test Signature Ability",
        body: "Placeholder signature ability.\nThis panel will eventually show the Hero's real signature effect.",
      },
    );
  }

  private createHoverPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    tooltip: TooltipSpec,
  ) {
    const panel = this.add
      .rectangle(x, y, width, height, color, 0.18)
      .setStrokeStyle(2, color, 0.95)
      .setInteractive({ useHandCursor: true })
      .setDepth(600);

    this.add
      .text(x, y, label, {
        align: "center",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: "#e0d8ce",
      })
      .setOrigin(0.5)
      .setDepth(601);

    panel.on("pointerover", () => {
      panel.setFillStyle(color, 0.34).setStrokeStyle(3, color, 1);
      this.showTooltip(x + 165, y, tooltip);
    });

    panel.on("pointerout", () => {
      panel.setFillStyle(color, 0.18).setStrokeStyle(2, color, 0.95);
      this.hideTooltip();
    });
  }

  private showTooltip(x: number, y: number, spec: TooltipSpec) {
    this.hideTooltip();

    const background = this.add
      .rectangle(0, 0, 285, 92, 0x111111, 0.96)
      .setStrokeStyle(2, 0xd0b77a, 0.95);

    const title = this.add
      .text(-128, -34, spec.title, {
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        color: "#f2dfb5",
      })
      .setOrigin(0, 0.5);

    const body = this.add
      .text(-128, -7, spec.body, {
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        color: "#d0d0d0",
        wordWrap: { width: 255 },
      })
      .setOrigin(0, 0);

    this.tooltip = this.add.container(x, y, [background, title, body]).setDepth(5000);
  }

  private hideTooltip() {
    this.tooltip?.destroy(true);
    this.tooltip = null;
  }

  private keepBurnedCardsOutOfGraveyardDisplay() {
    // In this sandbox overdrawn cards are removed from the deck and never stored
    // in a graveyard collection. Cover the legacy test counter that previously
    // displayed the burn count as if it were a graveyard count.
    this.add
      .rectangle(GRAVEYARD_X, PLAYER_GRAVEYARD_COUNT_Y, 74, 24, 0x191919, 1)
      .setDepth(352);

    this.add
      .text(GRAVEYARD_X, PLAYER_GRAVEYARD_COUNT_Y, "0 cards", {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: "#8f8f8f",
      })
      .setOrigin(0.5)
      .setDepth(353);
  }
}
