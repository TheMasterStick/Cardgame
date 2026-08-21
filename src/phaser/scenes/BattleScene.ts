import Phaser from "phaser";

export class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, 54, "PHASER BATTLEFIELD TEST", {
        fontFamily: "Georgia, serif",
        fontSize: "34px",
        color: "#f4ead6",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 96, "Drag the card around. The existing React battlefield is untouched.", {
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        color: "#c8c8c8",
      })
      .setOrigin(0.5);

    const card = this.add
      .rectangle(width / 2, height / 2, 190, 290, 0x2b2b2b)
      .setStrokeStyle(5, 0xc8a66a)
      .setInteractive({ draggable: true, useHandCursor: true });

    const label = this.add
      .text(card.x, card.y, "TEST CARD\n\n7     9", {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "25px",
        color: "#f4ead6",
      })
      .setOrigin(0.5);

    card.on("pointerover", () => {
      this.tweens.add({
        targets: [card, label],
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 120,
      });
    });

    card.on("pointerout", () => {
      this.tweens.add({
        targets: [card, label],
        scaleX: 1,
        scaleY: 1,
        duration: 120,
      });
    });

    this.input.on(
      "drag",
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        if (gameObject !== card) return;
        card.setPosition(dragX, dragY);
        label.setPosition(dragX, dragY);
      },
    );
  }
}
