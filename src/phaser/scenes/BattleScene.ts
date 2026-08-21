import Phaser from "phaser";

const FIELD_CENTER_X = 960;
const SLOT_WIDTH = 88;
const SLOT_HEIGHT = 124;
const HERO_WIDTH = 92;
const HERO_HEIGHT = 132;
const COLUMN_GAP = 36;
const FIELD_COLUMNS = 5;

const CARD_WIDTH = SLOT_WIDTH;
const CARD_HEIGHT = SLOT_HEIGHT;
const HAND_MAX = 10;
const HAND_BASE_Y = 1065;
const HAND_HOVER_Y = 945;

const EQUIPMENT_X = 175;
const HERO_X = 365;
const DECK_X = 1435;
const MANA_X = 1518;
const SPELL_X = 1575;
const GRAVEYARD_X = 1770;
const ENEMY_DECK_Y = 115;
const PLAYER_DECK_Y = 985;
const ENEMY_GRAVEYARD_Y = 155;
const PLAYER_GRAVEYARD_Y = 925;
const ENEMY_HUD_Y = 245;
const PLAYER_HUD_Y = 795;
const HAND_COUNT_Y = 958;

const ROWS = {
  enemyBuildings: 205,
  enemyBackline: 335,
  enemyVanguard: 465,
  playerVanguard: 615,
  playerBackline: 745,
  playerBuildings: 875,
};

type SlotKind = "vanguard" | "backline" | "building" | "hero" | "equipment" | "spell";

type TestCardData = {
  id: number;
  cost: number;
  attack: number;
  health: number;
};

type TestCardView = {
  data: TestCardData;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  inHand: boolean;
  dragging: boolean;
};

type CreatureSlot = {
  kind: "vanguard" | "backline";
  lane: number;
  rect: Phaser.GameObjects.Rectangle;
  occupied: TestCardView | null;
};

const SLOT_COLORS: Record<SlotKind, number> = {
  vanguard: 0xc8a66a,
  backline: 0x8da9c4,
  building: 0x9a8569,
  hero: 0xe5d8b0,
  equipment: 0xb38bc7,
  spell: 0x6fa6c7,
};

export class BattleScene extends Phaser.Scene {
  private deck: TestCardData[] = [];
  private hand: TestCardView[] = [];
  private playerCreatureSlots: CreatureSlot[] = [];
  private selectedCard: TestCardView | null = null;
  private hoveredCard: TestCardView | null = null;
  private hoveredSlot: CreatureSlot | null = null;
  private targetingArrow!: Phaser.GameObjects.Graphics;
  private deckCountText!: Phaser.GameObjects.Text;
  private graveyardCountText!: Phaser.GameObjects.Text;
  private playerHandCountText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private burned = 0;

  constructor() {
    super("BattleScene");
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 4, width, height / 2, 0x221b1b, 0.42);
    this.add.rectangle(width / 2, (height * 3) / 4, width, height / 2, 0x18211c, 0.42);

    this.add
      .text(width / 2, 20, "PHASER BATTLEFIELD INTERACTION TEST", {
        fontFamily: "Georgia, serif",
        fontSize: "27px",
        color: "#f4ead6",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        50,
        "Click deck to draw • Hover to inspect • Click card then slot, or drag/drop • Click empty space / Esc to cancel",
        {
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          color: "#aaa69f",
        },
      )
      .setOrigin(0.5);

    for (let i = 0; i < FIELD_COLUMNS; i += 1) {
      this.add
        .text(this.columnX(i), height / 2, String(i + 1), {
          fontFamily: "Arial, sans-serif",
          fontSize: "17px",
          color: "#8f8f8f",
        })
        .setOrigin(0.5);
    }

    const divider = this.add.graphics();
    divider.lineStyle(2, 0x777777, 0.5);
    divider.lineBetween(430, height / 2, 1490, height / 2);

    this.add
      .text(560, height / 2 - 14, "OPPONENT", {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#ad7e7e",
      })
      .setOrigin(0.5, 1);

    this.add
      .text(560, height / 2 + 14, "YOU", {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#7fa987",
      })
      .setOrigin(0.5, 0);

    this.createFieldRows();
    this.createSideHud();
    this.createDeckAndGraveyardPiles();

    this.targetingArrow = this.add.graphics().setDepth(1900);

    this.statusText = this.add
      .text(FIELD_CENTER_X, 985, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        color: "#d8c68d",
      })
      .setOrigin(0.5)
      .setDepth(3000);

    this.buildTestDeck();
    this.updateDeckLabels();

    for (let i = 0; i < 5; i += 1) {
      this.time.delayedCall(180 * i, () => this.drawCard());
    }

    this.input.on(
      "dragstart",
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
        const card = this.hand.find((entry) => entry.container === gameObject);
        if (!card || !card.inHand) return;

        card.dragging = true;
        this.selectCard(card);
        card.container.setDepth(2500).setAngle(0).setScale(1.08);
      },
    );

    this.input.on(
      "drag",
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        const card = this.hand.find((entry) => entry.container === gameObject);
        if (!card || !card.inHand) return;
        card.container.setPosition(dragX, dragY);
      },
    );

    this.input.on(
      "dragend",
      (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
        const card = this.hand.find((entry) => entry.container === gameObject);
        if (!card || !card.inHand) return;

        card.dragging = false;
        const slot = this.findOpenSlotAt(pointer.worldX, pointer.worldY);

        if (slot) {
          this.placeCard(card, slot);
        } else {
          this.layoutHand(true);
        }
      },
    );

    this.input.on(
      "pointerdown",
      (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length === 0 && this.selectedCard) this.selectCard(null);
      },
    );

    this.input.keyboard?.on("keydown-ESC", () => this.selectCard(null));
  }

  update() {
    this.drawTargetingArrow();
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
        .text(600, row.y, row.label, {
          fontFamily: "Arial, sans-serif",
          fontSize: "15px",
          color: row.owner === "enemy" ? "#a58b8b" : "#8fa593",
        })
        .setOrigin(1, 0.5);

      for (let i = 0; i < FIELD_COLUMNS; i += 1) {
        const rect = this.createSlot(this.columnX(i), row.y, row.kind, String(i + 1));

        if (row.owner === "player" && (row.kind === "vanguard" || row.kind === "backline")) {
          this.registerCreatureSlot(row.kind, i + 1, rect);
        }
      }
    }
  }

  private createSideHud() {
    this.createEquipmentRack(ENEMY_HUD_Y, "enemy");
    this.createEquipmentRack(PLAYER_HUD_Y, "player");

    this.createHeroPanel(HERO_X, ENEMY_HUD_Y, "ENEMY HERO", "enemy");
    this.createHeroPanel(HERO_X, PLAYER_HUD_Y, "YOUR HERO", "player");

    this.createManaBar(MANA_X, ENEMY_HUD_Y, "enemy");
    this.createManaBar(MANA_X, PLAYER_HUD_Y, "player");

    this.createSpellRack(ENEMY_HUD_Y, "enemy");
    this.createSpellRack(PLAYER_HUD_Y, "player");
  }

  private createEquipmentRack(centerY: number, owner: "enemy" | "player") {
    const spacing = 96;
    const startY = centerY - (spacing * 3) / 2;

    for (let i = 0; i < 4; i += 1) {
      this.createSlot(EQUIPMENT_X, startY + i * spacing, "equipment", String(i + 1), 68, 84);
    }

    this.add
      .text(EQUIPMENT_X, centerY + 205, "EQUIPMENT", {
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        color: owner === "enemy" ? "#a58b8b" : "#8fa593",
      })
      .setOrigin(0.5);
  }

  private createHeroPanel(x: number, y: number, label: string, owner: "enemy" | "player") {
    this.createSlot(x, y, "hero", label, HERO_WIDTH, HERO_HEIGHT);

    if (owner === "enemy") {
      this.createResourcePill(x, y - 116, "ENERGY", "5 / 10", 0xd8b35f, owner);
      this.createResourcePill(x, y - 88, "RESOURCES", "5 / 10", 0xb57b4b, owner);
    } else {
      this.createResourcePill(x, y + 88, "ENERGY", "5 / 10", 0xd8b35f, owner);
      this.createResourcePill(x, y + 116, "RESOURCES", "5 / 10", 0xb57b4b, owner);
    }
  }

  private createResourcePill(
    x: number,
    y: number,
    label: string,
    value: string,
    color: number,
    owner: "enemy" | "player",
  ) {
    const panel = this.add.rectangle(x, y, 132, 22, color, 0.13).setStrokeStyle(1, color, 0.8);
    panel.setDepth(120);

    this.add
      .text(x, y, `${label}   ${value}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: owner === "enemy" ? "#cababa" : "#d8ddd9",
      })
      .setOrigin(0.5)
      .setDepth(121);
  }

  private createManaBar(x: number, centerY: number, owner: "enemy" | "player") {
    const spacing = 20;
    const startY = centerY - (spacing * 9) / 2;
    const endY = startY + spacing * 9;

    for (let i = 0; i < 10; i += 1) {
      const active = owner === "player" ? i >= 5 : i < 5;
      this.add
        .rectangle(x, startY + i * spacing, 12, 12, active ? 0x57b7ff : 0x24445c, active ? 0.95 : 0.35)
        .setStrokeStyle(2, active ? 0x9bd8ff : 0x4e7189, active ? 1 : 0.55)
        .setAngle(45);
    }

    const countY = owner === "enemy" ? startY - 28 : endY + 28;

    this.add
      .text(x, countY, "5 / 10", {
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        color: owner === "enemy" ? "#9fb9d0" : "#a9c9e2",
      })
      .setOrigin(0.5);
  }

  private createSpellRack(centerY: number, owner: "enemy" | "player") {
    const spacing = 102;
    const startY = centerY - (spacing * 3) / 2;

    for (let i = 0; i < 4; i += 1) {
      this.createSlot(SPELL_X, startY + i * spacing, "spell", String(i + 1), 68, 92);
    }

    this.add
      .text(SPELL_X, centerY + 220, "SPELL / ABILITY", {
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        color: owner === "enemy" ? "#a58b8b" : "#8fa593",
      })
      .setOrigin(0.5);
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
        fontSize: kind === "hero" ? "13px" : "12px",
        color: "#aaa69f",
      })
      .setOrigin(0.5);

    return slot;
  }

  private registerCreatureSlot(
    kind: "vanguard" | "backline",
    lane: number,
    rect: Phaser.GameObjects.Rectangle,
  ) {
    const slot: CreatureSlot = { kind, lane, rect, occupied: null };
    this.playerCreatureSlots.push(slot);

    rect.setInteractive({ useHandCursor: true });

    rect.on("pointerover", () => {
      this.hoveredSlot = slot;
      this.updateSlotHighlights();
    });

    rect.on("pointerout", () => {
      if (this.hoveredSlot === slot) this.hoveredSlot = null;
      this.updateSlotHighlights();
    });

    rect.on("pointerdown", () => {
      if (!this.selectedCard || slot.occupied) return;
      this.placeCard(this.selectedCard, slot);
    });
  }

  private buildTestDeck() {
    this.deck = Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      cost: (index % 5) + 1,
      attack: 2 + (index % 6),
      health: 3 + ((index * 2) % 7),
    })).reverse();
  }

  private createDeckAndGraveyardPiles() {
    this.createEnemyDeckPile();
    this.createPlayerDeckPile();
    this.createEnemyGraveyardPile();
    this.createPlayerGraveyardPile();

    this.playerHandCountText = this.add
      .text(FIELD_CENTER_X, HAND_COUNT_Y, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        color: "#c9c2b5",
      })
      .setOrigin(0.5)
      .setDepth(1800);
  }

  private createEnemyDeckPile() {
    this.add
      .rectangle(DECK_X, ENEMY_DECK_Y, CARD_WIDTH, CARD_HEIGHT, 0x25202d)
      .setStrokeStyle(4, 0x9a7ab0)
      .setDepth(400);

    this.add
      .text(DECK_X, ENEMY_DECK_Y - 12, "ENEMY\nDECK", {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        color: "#eee5f2",
      })
      .setOrigin(0.5)
      .setDepth(401);

    this.add
      .text(DECK_X, ENEMY_DECK_Y + 29, "15 cards", {
        align: "center",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        color: "#cfc1d6",
      })
      .setOrigin(0.5)
      .setDepth(401);
  }

  private createPlayerDeckPile() {
    const deckBack = this.add
      .rectangle(DECK_X, PLAYER_DECK_Y, CARD_WIDTH, CARD_HEIGHT, 0x25202d)
      .setStrokeStyle(4, 0x9a7ab0)
      .setInteractive({ useHandCursor: true })
      .setDepth(400);

    this.add
      .text(DECK_X, PLAYER_DECK_Y - 14, "YOUR\nDECK", {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        color: "#eee5f2",
      })
      .setOrigin(0.5)
      .setDepth(401);

    this.deckCountText = this.add
      .text(DECK_X, PLAYER_DECK_Y + 28, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        color: "#cfc1d6",
      })
      .setOrigin(0.5)
      .setDepth(401);

    deckBack.on("pointerdown", () => this.drawCard());
  }

  private createEnemyGraveyardPile() {
    this.add
      .rectangle(GRAVEYARD_X, ENEMY_GRAVEYARD_Y, CARD_WIDTH, CARD_HEIGHT, 0x191919)
      .setStrokeStyle(3, 0x777777, 0.8)
      .setDepth(350);

    this.add
      .text(GRAVEYARD_X, ENEMY_GRAVEYARD_Y - 10, "ENEMY\nGRAVEYARD", {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "13px",
        color: "#b7b0aa",
      })
      .setOrigin(0.5)
      .setDepth(351);

    this.add
      .text(GRAVEYARD_X, ENEMY_GRAVEYARD_Y + 30, "0 cards", {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: "#8f8f8f",
      })
      .setOrigin(0.5)
      .setDepth(351);
  }

  private createPlayerGraveyardPile() {
    this.add
      .rectangle(GRAVEYARD_X, PLAYER_GRAVEYARD_Y, CARD_WIDTH, CARD_HEIGHT, 0x191919)
      .setStrokeStyle(3, 0x777777, 0.8)
      .setDepth(350);

    this.add
      .text(GRAVEYARD_X, PLAYER_GRAVEYARD_Y - 10, "YOUR\nGRAVEYARD", {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "13px",
        color: "#b7b0aa",
      })
      .setOrigin(0.5)
      .setDepth(351);

    this.graveyardCountText = this.add
      .text(GRAVEYARD_X, PLAYER_GRAVEYARD_Y + 30, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: "#a68e88",
      })
      .setOrigin(0.5)
      .setDepth(351);
  }

  private drawCard() {
    if (this.deck.length === 0) {
      this.showStatus("Deck is empty.");
      return;
    }

    const data = this.deck.pop()!;

    if (this.hand.length >= HAND_MAX) {
      this.burned += 1;
      this.updateDeckLabels();
      this.animateBurn(data);
      this.showStatus(`TEST CARD ${String(data.id).padStart(2, "0")} burned — hand is full.`);
      return;
    }

    const card = this.createHandCard(data);
    this.hand.push(card);
    this.updateDeckLabels();
    this.layoutHand(true);
  }

  private createHandCard(data: TestCardData): TestCardView {
    const container = this.add.container(DECK_X, PLAYER_DECK_Y).setDepth(1000);
    const frame = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x2b2b2b).setStrokeStyle(3, 0xc8a66a);
    const label = this.createCardLabel(data, 0, 0, 13);

    container.add([frame, label]);
    container.setSize(CARD_WIDTH, CARD_HEIGHT);
    container.setInteractive({ useHandCursor: true });
    this.input.setDraggable(container);

    const card: TestCardView = {
      data,
      container,
      frame,
      label,
      inHand: true,
      dragging: false,
    };

    container.on("pointerover", () => {
      if (!card.inHand || card.dragging) return;
      this.hoveredCard = card;
      this.layoutHand(true);
    });

    container.on("pointerout", () => {
      if (this.hoveredCard === card) this.hoveredCard = null;
      if (!card.dragging) this.layoutHand(true);
    });

    container.on("pointerdown", () => {
      if (!card.inHand || card.dragging) return;
      this.selectCard(this.selectedCard === card ? null : card);
    });

    return card;
  }

  private createCardLabel(data: TestCardData, x: number, y: number, fontSize: number) {
    return this.add
      .text(
        x,
        y,
        `TEST CARD ${String(data.id).padStart(2, "0")}\n\n${data.cost} ENERGY\n\n${data.attack}     ${data.health}`,
        {
          align: "center",
          fontFamily: "Georgia, serif",
          fontSize: `${fontSize}px`,
          color: "#f4ead6",
        },
      )
      .setOrigin(0.5);
  }

  private animateBurn(data: TestCardData) {
    const container = this.add.container(DECK_X, PLAYER_DECK_Y).setDepth(2800);
    const frame = this.add
      .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x2b2b2b)
      .setStrokeStyle(4, 0xc8a66a, 1);
    const glow = this.add.rectangle(0, 0, CARD_WIDTH - 8, CARD_HEIGHT - 8, 0xe56a24, 0);
    const label = this.createCardLabel(data, 0, 0, 13);
    container.add([frame, glow, label]);

    this.tweens.add({
      targets: container,
      y: PLAYER_DECK_Y - 165,
      scaleX: 1.12,
      scaleY: 1.12,
      angle: Phaser.Math.Between(-4, 4),
      duration: 320,
      ease: "Back.easeOut",
      onComplete: () => {
        frame.setStrokeStyle(5, 0xffb347, 1);
        this.tweens.add({ targets: glow, alpha: 0.78, duration: 160, yoyo: true, repeat: 1 });

        for (let i = 0; i < 12; i += 1) {
          const ember = this.add
            .circle(
              container.x + Phaser.Math.Between(-CARD_WIDTH / 2, CARD_WIDTH / 2),
              container.y + Phaser.Math.Between(10, CARD_HEIGHT / 2),
              Phaser.Math.Between(2, 5),
              i % 2 === 0 ? 0xffb347 : 0xd94d20,
              0.95,
            )
            .setDepth(2799);

          this.tweens.add({
            targets: ember,
            x: ember.x + Phaser.Math.Between(-42, 42),
            y: ember.y - Phaser.Math.Between(45, 125),
            alpha: 0,
            scale: 0.2,
            duration: Phaser.Math.Between(420, 760),
            ease: "Sine.easeOut",
            onComplete: () => ember.destroy(),
          });
        }

        this.time.delayedCall(180, () => {
          this.tweens.add({
            targets: container,
            y: container.y - 85,
            alpha: 0,
            scaleX: 0.72,
            scaleY: 0.72,
            angle: container.angle + Phaser.Math.Between(-8, 8),
            duration: 650,
            ease: "Quad.easeIn",
            onComplete: () => container.destroy(true),
          });
        });
      },
    });
  }

  private layoutHand(animated: boolean) {
    const count = this.hand.length;
    if (count === 0) return;

    const middle = (count - 1) / 2;
    const spacing = count <= 1 ? 0 : Math.min(58, 500 / (count - 1));

    this.hand.forEach((card, index) => {
      if (!card.inHand || card.dragging) return;

      const normalized = middle === 0 ? 0 : (index - middle) / middle;
      const lifted = this.hoveredCard === card || this.selectedCard === card;
      const targetX = FIELD_CENTER_X + (index - middle) * spacing;
      const targetY = lifted ? HAND_HOVER_Y : HAND_BASE_Y + Math.abs(normalized) * 12;
      const targetAngle = lifted ? 0 : normalized * 9;
      const targetScale = lifted ? 1.55 : 1;
      const targetDepth = lifted ? 2100 : 1000 + index;

      card.container.setDepth(targetDepth);

      if (animated) {
        this.tweens.killTweensOf(card.container);
        this.tweens.add({
          targets: card.container,
          x: targetX,
          y: targetY,
          angle: targetAngle,
          scaleX: targetScale,
          scaleY: targetScale,
          duration: 150,
          ease: "Sine.easeOut",
        });
      } else {
        card.container.setPosition(targetX, targetY).setAngle(targetAngle).setScale(targetScale);
      }
    });

    this.updateCardFrames();
  }

  private selectCard(card: TestCardView | null) {
    if (card && !card.inHand) return;
    this.selectedCard = card;
    this.hoveredSlot = null;
    this.layoutHand(true);
    this.updateSlotHighlights();
  }

  private placeCard(card: TestCardView, slot: CreatureSlot) {
    if (!card.inHand || slot.occupied) return;

    slot.occupied = card;
    card.inHand = false;
    card.dragging = false;
    this.input.setDraggable(card.container, false);

    const index = this.hand.indexOf(card);
    if (index >= 0) this.hand.splice(index, 1);

    if (this.hoveredCard === card) this.hoveredCard = null;
    if (this.selectedCard === card) this.selectedCard = null;
    this.hoveredSlot = null;

    this.tweens.killTweensOf(card.container);
    card.container.setDepth(500).setAngle(0).setScale(1);
    this.tweens.add({
      targets: card.container,
      x: slot.rect.x,
      y: slot.rect.y,
      duration: 170,
      ease: "Sine.easeOut",
    });

    card.frame.setStrokeStyle(3, SLOT_COLORS[slot.kind], 0.95);
    this.layoutHand(true);
    this.updateSlotHighlights();
    this.updateDeckLabels();
    this.showStatus(`Placed TEST CARD ${String(card.data.id).padStart(2, "0")} in ${slot.kind} lane ${slot.lane}.`);
  }

  private findOpenSlotAt(x: number, y: number) {
    return (
      this.playerCreatureSlots.find(
        (slot) => !slot.occupied && Phaser.Geom.Rectangle.Contains(slot.rect.getBounds(), x, y),
      ) ?? null
    );
  }

  private updateCardFrames() {
    for (const card of this.hand) {
      if (card === this.selectedCard) {
        card.frame.setStrokeStyle(5, 0xf0d270, 1);
      } else {
        card.frame.setStrokeStyle(3, 0xc8a66a, 1);
      }
    }
  }

  private updateSlotHighlights() {
    for (const slot of this.playerCreatureSlots) {
      const baseColor = SLOT_COLORS[slot.kind];

      if (slot.occupied) {
        slot.rect.setStrokeStyle(2, baseColor, 0.3);
      } else if (this.selectedCard && this.hoveredSlot === slot) {
        slot.rect.setStrokeStyle(5, 0x8be38b, 1);
      } else if (this.selectedCard) {
        slot.rect.setStrokeStyle(3, 0xd7c56f, 0.95);
      } else {
        slot.rect.setStrokeStyle(2, baseColor, 0.68);
      }
    }
  }

  private drawTargetingArrow() {
    this.targetingArrow.clear();

    const card = this.selectedCard;
    if (!card || !card.inHand || card.dragging) return;

    const pointer = this.input.activePointer;
    const startX = card.container.x;
    const startY = card.container.y - (CARD_HEIGHT * card.container.scaleY) / 2 + 8;

    const hoveredOpenSlot = this.findOpenSlotAt(pointer.worldX, pointer.worldY);
    const endX = hoveredOpenSlot?.rect.x ?? pointer.worldX;
    const endY = hoveredOpenSlot?.rect.y ?? pointer.worldY;

    const angle = Math.atan2(endY - startY, endX - startX);
    const headLength = 20;

    this.targetingArrow.lineStyle(5, hoveredOpenSlot ? 0x8be38b : 0xe3c76c, 0.92);
    this.targetingArrow.beginPath();
    this.targetingArrow.moveTo(startX, startY);
    this.targetingArrow.lineTo(endX, endY);
    this.targetingArrow.strokePath();

    this.targetingArrow.beginPath();
    this.targetingArrow.moveTo(endX, endY);
    this.targetingArrow.lineTo(
      endX - Math.cos(angle - Math.PI / 6) * headLength,
      endY - Math.sin(angle - Math.PI / 6) * headLength,
    );
    this.targetingArrow.moveTo(endX, endY);
    this.targetingArrow.lineTo(
      endX - Math.cos(angle + Math.PI / 6) * headLength,
      endY - Math.sin(angle + Math.PI / 6) * headLength,
    );
    this.targetingArrow.strokePath();
  }

  private updateDeckLabels() {
    if (!this.deckCountText || !this.graveyardCountText || !this.playerHandCountText) return;
    this.deckCountText.setText(`${this.deck.length} cards`);
    this.playerHandCountText.setText(`HAND  ${this.hand.length} / ${HAND_MAX}`);
    this.graveyardCountText.setText(`${this.burned} cards`);
  }

  private showStatus(message: string) {
    if (!this.statusText) return;
    this.statusText.setText(message);
    this.time.delayedCall(1800, () => {
      if (this.statusText.text === message) this.statusText.setText("");
    });
  }
}
