import Phaser from "phaser";

const FIELD_CENTER_X = 960;
const SLOT_WIDTH = 92;
const SLOT_HEIGHT = 132;
const COLUMN_GAP = 38;
const FIELD_COLUMNS = 5;

const ROWS = {
  enemyHero: 60,
  enemyBuildings: 175,
  enemyBackline: 325,
  enemyVanguard: 475,
  playerVanguard: 605,
  playerBackline: 755,
  playerBuildings: 905,
  playerHero: 1020,
};

type SlotKind = "vanguard" | "backline" | "building" | "hero" | "equipment" | "spell";

const SLOT_COLORS: Record<SlotKind, number> = {
  vanguard: 0xc8a66a,
  backline: 0x8da9c4,
  building: 0x9a8569,
  hero: 0xe5d8b0,
  equipment: 0xb38bc7,
  spell: 0x6fa6c7,
};

export class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 4, width, height / 2, 0x221b1b, 0.42);
    this.add.rectangle(width / 2, (height * 3) / 4, width, height / 2, 0x18211c, 0.42);

    this.add
      .text(width / 2, 24, "PHASER BATTLEFIELD LAYOUT TEST", {
        fontFamily: "Georgia, serif",
        fontSize: "28px",
        color: "#f4ead6",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2, "1        2        3        4        5", {
        fontFamily: "Arial, sans-serif",
        fontSize: "17px",
        color: "#8f8f8f",
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    const divider = this.add.graphics();
    divider.lineStyle(2, 0x777777, 0.5);
    divider.lineBetween(430, height / 2, 1490, height / 2);

    this.add
      .text(510, height / 2 - 14, "OPPONENT", {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#ad7e7e",
      })
      .setOrigin(0.5, 1);

    this.add
      .text(510, height / 2 + 14, "YOU", {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#7fa987",
      })
      .setOrigin(0.5, 0);

    this.createFieldRows();
    this.createHeroSlots();
    this.createSideRacks();
    this.createDraggableScaleCard();
  }

  private columnX(index: number) {
    const totalWidth = SLOT_WIDTH * FIELD_COLUMNS + COLUMN_GAP * (FIELD_COLUMNS - 1);
    const left = FIELD_CENTER_X - totalWidth / 2 + SLOT_WIDTH / 2;
    return left + index * (SLOT_WIDTH + COLUMN_GAP);
  }

  private createFieldRows() {
    const rows: Array<{ y: number; label: string; kind: SlotKind; owner: "enemy" | "player" }> = [
      { y: ROWS.enemyBuildings, label: "BUILDINGS", kind: "building", owner: "enemy" },
      { y: ROWS.enemyBackline, label: "BACKLINE", kind: "backline", owner: "enemy" },
      { y: ROWS.enemyVanguard, label: "VANGUARD", kind: "vanguard", owner: "enemy" },
      { y: ROWS.playerVanguard, label: "VANGUARD", kind: "vanguard", owner: "player" },
      { y: ROWS.playerBackline, label: "BACKLINE", kind: "backline", owner: "player" },
      { y: ROWS.playerBuildings, label: "BUILDINGS", kind: "building", owner: "player" },
    ];

    for (const row of rows) {
      this.add
        .text(560, row.y, row.label, {
          fontFamily: "Arial, sans-serif",
          fontSize: "15px",
          color: row.owner === "enemy" ? "#a58b8b" : "#8fa593",
        })
        .setOrigin(1, 0.5);

      for (let i = 0; i < FIELD_COLUMNS; i += 1) {
        this.createSlot(this.columnX(i), row.y, row.kind, String(i + 1));
      }
    }
  }

  private createHeroSlots() {
    this.createSlot(FIELD_CENTER_X, ROWS.enemyHero, "hero", "ENEMY HERO", 126, 78);
    this.createSlot(FIELD_CENTER_X, ROWS.playerHero, "hero", "YOUR HERO", 126, 78);
  }

  private createSideRacks() {
    this.createRack(260, 195, "EQUIPMENT", "equipment", "enemy");
    this.createRack(1660, 195, "SPELL / ABILITY", "spell", "enemy");
    this.createRack(260, 785, "EQUIPMENT", "equipment", "player");
    this.createRack(1660, 785, "SPELL / ABILITY", "spell", "player");
  }

  private createRack(
    x: number,
    centerY: number,
    title: string,
    kind: "equipment" | "spell",
    owner: "enemy" | "player",
  ) {
    this.add
      .text(x, owner === "enemy" ? centerY - 230 : centerY + 230, title, {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        color: owner === "enemy" ? "#a58b8b" : "#8fa593",
      })
      .setOrigin(0.5);

    const spacing = 108;
    const startY = centerY - (spacing * 3) / 2;
    for (let i = 0; i < 4; i += 1) {
      this.createSlot(x, startY + i * spacing, kind, String(i + 1), 68, 92);
    }
  }

  private createSlot(
    x: number,
    y: number,
    kind: SlotKind,
    label: string,
    width = SLOT_WIDTH,
    height = SLOT_HEIGHT,
  ) {
    const color = SLOT_COLORS[kind];
    const slot = this.add.rectangle(x, y, width, height, color, 0.055).setStrokeStyle(2, color, 0.68);

    this.add
      .text(x, y, label, {
        align: "center",
        fontFamily: "Arial, sans-serif",
        fontSize: kind === "hero" ? "15px" : "13px",
        color: "#aaa69f",
      })
      .setOrigin(0.5);

    return slot;
  }

  private createDraggableScaleCard() {
    const startX = 405;
    const startY = 540;

    this.add
      .text(startX, 423, "DRAGGABLE CARD\n(scale reference)", {
        align: "center",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#bdbdbd",
      })
      .setOrigin(0.5);

    const card = this.add
      .rectangle(startX, startY, SLOT_WIDTH, SLOT_HEIGHT, 0x2b2b2b)
      .setStrokeStyle(4, 0xc8a66a)
      .setInteractive({ draggable: true, useHandCursor: true });

    const label = this.add
      .text(card.x, card.y, "TEST\nCARD\n\n7     9", {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "17px",
        color: "#f4ead6",
      })
      .setOrigin(0.5);

    card.on("pointerover", () => {
      this.tweens.add({ targets: [card, label], scale: 1.08, duration: 100 });
    });

    card.on("pointerout", () => {
      this.tweens.add({ targets: [card, label], scale: 1, duration: 100 });
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
