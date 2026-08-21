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
const TURN_BUTTON_X = 1360;
const TURN_BUTTON_Y = 540;

const ROWS = {
  enemyBuildings: 205,
  enemyBackline: 335,
  enemyVanguard: 465,
  playerVanguard: 615,
  playerBackline: 745,
  playerBuildings: 875,
};

type Owner = "player" | "enemy";
type CardKind = "creature" | "equipment" | "spell";
type SlotKind = "vanguard" | "backline" | "building" | "hero" | "equipment" | "spell";

type TestCardData = {
  id: number;
  name: string;
  kind: CardKind;
  cost: number;
  attack?: number;
  health?: number;
  damage?: number;
};

type CardZone = "hand" | "board" | "equipment" | "spell" | "graveyard";

type TestCardView = {
  data: TestCardData;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  owner: Owner;
  zone: CardZone;
  dragging: boolean;
  currentHp: number;
  hasAttacked: boolean;
  slot: BoardSlot | null;
};

type BoardSlot = {
  owner: Owner;
  kind: "vanguard" | "backline" | "equipment" | "spell";
  lane: number;
  rect: Phaser.GameObjects.Rectangle;
  occupied: TestCardView | null;
};

type EnemyTarget =
  | { type: "creature"; card: TestCardView }
  | { type: "hero"; rect: Phaser.GameObjects.Rectangle };

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
  private allBoardCards: TestCardView[] = [];

  private playerCreatureSlots: BoardSlot[] = [];
  private enemyCreatureSlots: BoardSlot[] = [];
  private playerEquipmentSlots: BoardSlot[] = [];
  private playerSpellSlots: BoardSlot[] = [];

  private selectedHandCard: TestCardView | null = null;
  private selectedAttacker: TestCardView | null = null;
  private activeSpell: TestCardView | null = null;
  private hoveredCard: TestCardView | null = null;

  private targetingArrow!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private deckCountText!: Phaser.GameObjects.Text;
  private playerHandCountText!: Phaser.GameObjects.Text;
  private playerGraveyardCountText!: Phaser.GameObjects.Text;
  private enemyGraveyardCountText!: Phaser.GameObjects.Text;

  private playerHeroRect!: Phaser.GameObjects.Rectangle;
  private enemyHeroRect!: Phaser.GameObjects.Rectangle;
  private playerHeroText!: Phaser.GameObjects.Text;
  private enemyHeroText!: Phaser.GameObjects.Text;

  private playerEnergyText!: Phaser.GameObjects.Text;
  private playerResourcesText!: Phaser.GameObjects.Text;
  private playerManaText!: Phaser.GameObjects.Text;
  private playerManaCrystals: Phaser.GameObjects.Rectangle[] = [];

  private turnButton!: Phaser.GameObjects.Rectangle;
  private turnButtonText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;

  private burned = 0;
  private playerGraveyard = 0;
  private enemyGraveyard = 0;
  private playerTurn = true;

  private playerEnergy = 5;
  private playerResources = 5;
  private playerMana = 5;
  private readonly resourceCap = 10;

  private enemyGuard = 12;
  private enemyHp = 20;
  private playerGuard = 12;
  private playerHp = 20;

  constructor() {
    super("BattleScene");
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 4, width, height / 2, 0x221b1b, 0.42);
    this.add.rectangle(width / 2, (height * 3) / 4, width, height / 2, 0x18211c, 0.42);

    this.add
      .text(width / 2, 20, "PHASER BATTLEFIELD INTERACTION LAB", {
        fontFamily: "Georgia, serif",
        fontSize: "27px",
        color: "#f4ead6",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        50,
        "Play cards • Attack enemy targets • Equip Hero • Cast Firebolt • Kill cards into Graveyard • Test turn flow",
        {
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          color: "#aaa69f",
        },
      )
      .setOrigin(0.5);

    this.createLaneLabels();
    this.createFieldRows();
    this.createSideHud();
    this.createDeckAndGraveyardPiles();
    this.createTurnControls();

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
    this.spawnStartingBoard();
    this.updateHud();

    for (let i = 0; i < 5; i += 1) {
      this.time.delayedCall(180 * i, () => this.drawCard());
    }

    this.bindDragEvents();

    this.input.on(
      "pointerdown",
      (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length === 0) this.cancelSelections();
      },
    );

    this.input.keyboard?.on("keydown-ESC", () => this.cancelSelections());
  }

  update() {
    this.drawTargetingArrow();
  }

  private createLaneLabels() {
    const { height } = this.scale;

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
  }

  private columnX(index: number) {
    const totalWidth = SLOT_WIDTH * FIELD_COLUMNS + COLUMN_GAP * (FIELD_COLUMNS - 1);
    const left = FIELD_CENTER_X - totalWidth / 2 + SLOT_WIDTH / 2;
    return left + index * (SLOT_WIDTH + COLUMN_GAP);
  }

  private createFieldRows() {
    const rows: Array<{ y: number; label: string; kind: SlotKind; owner: Owner }> = [
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

        if (row.kind === "vanguard" || row.kind === "backline") {
          const slot: BoardSlot = {
            owner: row.owner,
            kind: row.kind,
            lane: i + 1,
            rect,
            occupied: null,
          };

          if (row.owner === "player") this.playerCreatureSlots.push(slot);
          else this.enemyCreatureSlots.push(slot);

          this.configureCreatureSlot(slot);
        }
      }
    }
  }

  private createSideHud() {
    this.createEquipmentRack(ENEMY_HUD_Y, "enemy");
    this.createEquipmentRack(PLAYER_HUD_Y, "player");

    this.createHeroPanel(HERO_X, ENEMY_HUD_Y, "enemy");
    this.createHeroPanel(HERO_X, PLAYER_HUD_Y, "player");

    this.createManaBar(MANA_X, ENEMY_HUD_Y, "enemy");
    this.createManaBar(MANA_X, PLAYER_HUD_Y, "player");

    this.createSpellRack(ENEMY_HUD_Y, "enemy");
    this.createSpellRack(PLAYER_HUD_Y, "player");
  }

  private createEquipmentRack(centerY: number, owner: Owner) {
    const spacing = 96;
    const startY = centerY - (spacing * 3) / 2;

    for (let i = 0; i < 4; i += 1) {
      const rect = this.createSlot(EQUIPMENT_X, startY + i * spacing, "equipment", String(i + 1), 68, 84);
      if (owner === "player") {
        this.playerEquipmentSlots.push({ owner, kind: "equipment", lane: i + 1, rect, occupied: null });
      }
    }

    this.add
      .text(EQUIPMENT_X, centerY + 205, "EQUIPMENT", {
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        color: owner === "enemy" ? "#a58b8b" : "#8fa593",
      })
      .setOrigin(0.5);
  }

  private createHeroPanel(x: number, y: number, owner: Owner) {
    const rect = this.createSlot(x, y, "hero", "", HERO_WIDTH, HERO_HEIGHT);
    rect.setInteractive({ useHandCursor: true });

    const text = this.add
      .text(x, y, "", {
        align: "center",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        color: "#d8d2c7",
      })
      .setOrigin(0.5)
      .setDepth(121);

    if (owner === "enemy") {
      this.enemyHeroRect = rect;
      this.enemyHeroText = text;
      this.createResourcePill(x, y - 116, "ENERGY", "5 / 10", 0xd8b35f, owner);
      this.createResourcePill(x, y - 88, "RESOURCES", "5 / 10", 0xb57b4b, owner);

      rect.on("pointerdown", () => {
        if (this.selectedAttacker) this.resolveAttack({ type: "hero", rect });
        else if (this.activeSpell) this.resolveSpellTarget({ type: "hero", rect });
      });
    } else {
      this.playerHeroRect = rect;
      this.playerHeroText = text;

      this.playerEnergyText = this.createResourcePill(x, y + 88, "ENERGY", "", 0xd8b35f, owner);
      this.playerResourcesText = this.createResourcePill(x, y + 116, "RESOURCES", "", 0xb57b4b, owner);

      rect.on("pointerdown", () => {
        if (this.selectedHandCard?.data.kind === "equipment") this.equipSelectedCard();
      });
    }
  }

  private createResourcePill(
    x: number,
    y: number,
    label: string,
    value: string,
    color: number,
    owner: Owner,
  ) {
    this.add.rectangle(x, y, 132, 22, color, 0.13).setStrokeStyle(1, color, 0.8).setDepth(120);

    return this.add
      .text(x, y, `${label}   ${value}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: owner === "enemy" ? "#cababa" : "#d8ddd9",
      })
      .setOrigin(0.5)
      .setDepth(121);
  }

  private createManaBar(x: number, centerY: number, owner: Owner) {
    const spacing = 20;
    const startY = centerY - (spacing * 9) / 2;
    const endY = startY + spacing * 9;
    const crystals: Phaser.GameObjects.Rectangle[] = [];

    for (let i = 0; i < 10; i += 1) {
      const active = owner === "player" ? i >= 5 : i < 5;
      const crystal = this.add
        .rectangle(x, startY + i * spacing, 12, 12, active ? 0x57b7ff : 0x24445c, active ? 0.95 : 0.35)
        .setStrokeStyle(2, active ? 0x9bd8ff : 0x4e7189, active ? 1 : 0.55)
        .setAngle(45);
      crystals.push(crystal);
    }

    const countY = owner === "enemy" ? startY - 28 : endY + 28;
    const text = this.add
      .text(x, countY, "5 / 10", {
        fontFamily: "Arial, sans-serif",
        fontSize: "13px",
        color: owner === "enemy" ? "#9fb9d0" : "#a9c9e2",
      })
      .setOrigin(0.5);

    if (owner === "player") {
      this.playerManaCrystals = crystals;
      this.playerManaText = text;
    }
  }

  private createSpellRack(centerY: number, owner: Owner) {
    const spacing = 102;
    const startY = centerY - (spacing * 3) / 2;

    for (let i = 0; i < 4; i += 1) {
      const rect = this.createSlot(SPELL_X, startY + i * spacing, "spell", String(i + 1), 68, 92);
      if (owner === "player") {
        const slot: BoardSlot = { owner, kind: "spell", lane: i + 1, rect, occupied: null };
        this.playerSpellSlots.push(slot);
        rect.setInteractive({ useHandCursor: true });
        rect.on("pointerdown", () => {
          if (this.selectedHandCard?.data.kind === "spell") this.playSpellToSlot(this.selectedHandCard, slot);
        });
      }
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

    if (label) {
      this.add
        .text(x, y, label, {
          align: "center",
          fontFamily: "Arial, sans-serif",
          fontSize: kind === "hero" ? "13px" : "12px",
          color: "#aaa69f",
        })
        .setOrigin(0.5);
    }

    return slot;
  }

  private configureCreatureSlot(slot: BoardSlot) {
    slot.rect.setInteractive({ useHandCursor: true });

    slot.rect.on("pointerdown", () => {
      if (slot.owner !== "player" || slot.occupied) return;
      if (this.selectedHandCard?.data.kind === "creature") this.playCreatureToSlot(this.selectedHandCard, slot);
    });
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
    this.add.rectangle(DECK_X, ENEMY_DECK_Y, CARD_WIDTH, CARD_HEIGHT, 0x25202d).setStrokeStyle(4, 0x9a7ab0).setDepth(400);
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

    deckBack.on("pointerdown", () => {
      if (this.playerTurn) this.drawCard();
    });
  }

  private createEnemyGraveyardPile() {
    this.add.rectangle(GRAVEYARD_X, ENEMY_GRAVEYARD_Y, CARD_WIDTH, CARD_HEIGHT, 0x191919).setStrokeStyle(3, 0x777777, 0.8);
    this.add
      .text(GRAVEYARD_X, ENEMY_GRAVEYARD_Y - 10, "ENEMY\nGRAVEYARD", {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "13px",
        color: "#b7b0aa",
      })
      .setOrigin(0.5);
    this.enemyGraveyardCountText = this.add
      .text(GRAVEYARD_X, ENEMY_GRAVEYARD_Y + 30, "0 cards", {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: "#8f8f8f",
      })
      .setOrigin(0.5);
  }

  private createPlayerGraveyardPile() {
    this.add.rectangle(GRAVEYARD_X, PLAYER_GRAVEYARD_Y, CARD_WIDTH, CARD_HEIGHT, 0x191919).setStrokeStyle(3, 0x777777, 0.8);
    this.add
      .text(GRAVEYARD_X, PLAYER_GRAVEYARD_Y - 10, "YOUR\nGRAVEYARD", {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "13px",
        color: "#b7b0aa",
      })
      .setOrigin(0.5);
    this.playerGraveyardCountText = this.add
      .text(GRAVEYARD_X, PLAYER_GRAVEYARD_Y + 30, "0 cards", {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        color: "#8f8f8f",
      })
      .setOrigin(0.5);
  }

  private createTurnControls() {
    this.turnButton = this.add
      .rectangle(TURN_BUTTON_X, TURN_BUTTON_Y, 150, 48, 0x594b34, 0.9)
      .setStrokeStyle(2, 0xd6bd7a, 0.95)
      .setInteractive({ useHandCursor: true })
      .setDepth(800);

    this.turnButtonText = this.add
      .text(TURN_BUTTON_X, TURN_BUTTON_Y, "END TURN", {
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        color: "#f2dfb5",
      })
      .setOrigin(0.5)
      .setDepth(801);

    this.turnText = this.add
      .text(TURN_BUTTON_X, TURN_BUTTON_Y - 38, "YOUR TURN", {
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        color: "#9fc8a5",
      })
      .setOrigin(0.5)
      .setDepth(801);

    this.turnButton.on("pointerdown", () => this.toggleTurn());
  }

  private buildTestDeck() {
    const opening: TestCardData[] = [
      { id: 1, name: "TEST RECRUIT", kind: "creature", cost: 1, attack: 2, health: 3 },
      { id: 2, name: "TEST SWORD", kind: "equipment", cost: 2 },
      { id: 3, name: "FIREBOLT", kind: "spell", cost: 2, damage: 3 },
      { id: 4, name: "TEST BRUISER", kind: "creature", cost: 3, attack: 4, health: 6 },
      { id: 5, name: "TEST ARCHER", kind: "creature", cost: 3, attack: 3, health: 4 },
    ];

    const rest = Array.from({ length: 15 }, (_, index): TestCardData => ({
      id: index + 6,
      name: `TEST CARD ${String(index + 6).padStart(2, "0")}`,
      kind: "creature",
      cost: (index % 5) + 1,
      attack: 2 + (index % 5),
      health: 3 + ((index * 2) % 6),
    }));

    this.deck = [...opening, ...rest].reverse();
  }

  private spawnStartingBoard() {
    const friendlySlot = this.playerCreatureSlots.find((slot) => slot.kind === "vanguard" && slot.lane === 3);
    const enemySlotA = this.enemyCreatureSlots.find((slot) => slot.kind === "vanguard" && slot.lane === 2);
    const enemySlotB = this.enemyCreatureSlots.find((slot) => slot.kind === "vanguard" && slot.lane === 4);

    if (friendlySlot) {
      this.spawnBoardCard({ id: 90, name: "TEST KNIGHT", kind: "creature", cost: 0, attack: 3, health: 6 }, "player", friendlySlot);
    }
    if (enemySlotA) {
      this.spawnBoardCard({ id: 91, name: "ENEMY GUARD", kind: "creature", cost: 0, attack: 2, health: 5 }, "enemy", enemySlotA);
    }
    if (enemySlotB) {
      this.spawnBoardCard({ id: 92, name: "ENEMY RAIDER", kind: "creature", cost: 0, attack: 3, health: 4 }, "enemy", enemySlotB);
    }
  }

  private bindDragEvents() {
    this.input.on(
      "dragstart",
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
        const card = this.hand.find((entry) => entry.container === gameObject);
        if (!card || card.zone !== "hand" || !this.playerTurn) return;

        card.dragging = true;
        this.selectHandCard(card);
        card.container.setDepth(2500).setAngle(0).setScale(1.08);
      },
    );

    this.input.on(
      "drag",
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
        const card = this.hand.find((entry) => entry.container === gameObject);
        if (!card || card.zone !== "hand" || !card.dragging) return;
        card.container.setPosition(dragX, dragY);
      },
    );

    this.input.on(
      "dragend",
      (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
        const card = this.hand.find((entry) => entry.container === gameObject);
        if (!card || card.zone !== "hand") return;

        card.dragging = false;
        const handled = this.tryDropHandCard(card, pointer.worldX, pointer.worldY);
        if (!handled) this.layoutHand(true);
      },
    );
  }

  private drawCard() {
    if (this.deck.length === 0) {
      this.showStatus("Deck is empty.");
      return;
    }

    const data = this.deck.pop()!;

    if (this.hand.length >= HAND_MAX) {
      this.burned += 1;
      this.animateBurn(data);
      this.showStatus(`${data.name} burned and is permanently destroyed for this match.`);
      this.updateHud();
      return;
    }

    const card = this.createCardView(data, "player", "hand", DECK_X, PLAYER_DECK_Y);
    this.hand.push(card);
    this.updateHud();
    this.layoutHand(true);
  }

  private createCardView(data: TestCardData, owner: Owner, zone: CardZone, x: number, y: number): TestCardView {
    const container = this.add.container(x, y).setDepth(1000);
    const frameColor = this.cardColor(data.kind, owner);
    const frame = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x2b2b2b).setStrokeStyle(3, frameColor);
    const label = this.add
      .text(0, 0, this.cardText(data, data.health ?? 0), {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "12px",
        color: "#f4ead6",
        wordWrap: { width: CARD_WIDTH - 8 },
      })
      .setOrigin(0.5);

    container.add([frame, label]);
    container.setSize(CARD_WIDTH, CARD_HEIGHT);

    const card: TestCardView = {
      data,
      container,
      frame,
      label,
      owner,
      zone,
      dragging: false,
      currentHp: data.health ?? 0,
      hasAttacked: false,
      slot: null,
    };

    if (zone === "hand") this.configureHandCard(card);
    return card;
  }

  private configureHandCard(card: TestCardView) {
    card.container.setInteractive({ useHandCursor: true });
    this.input.setDraggable(card.container);

    card.container.on("pointerover", () => {
      if (card.zone !== "hand" || card.dragging) return;
      this.hoveredCard = card;
      this.layoutHand(true);
    });

    card.container.on("pointerout", () => {
      if (this.hoveredCard === card) this.hoveredCard = null;
      if (!card.dragging) this.layoutHand(true);
    });

    card.container.on("pointerdown", () => {
      if (!this.playerTurn || card.zone !== "hand" || card.dragging) return;
      this.selectHandCard(this.selectedHandCard === card ? null : card);
    });
  }

  private cardColor(kind: CardKind, owner: Owner) {
    if (owner === "enemy") return 0xb56e6e;
    if (kind === "equipment") return 0xb38bc7;
    if (kind === "spell") return 0x6fa6c7;
    return 0xc8a66a;
  }

  private cardText(data: TestCardData, currentHp: number) {
    if (data.kind === "equipment") return `${data.name}\n\n${data.cost} RESOURCES\n\nEQUIPMENT`;
    if (data.kind === "spell") return `${data.name}\n\n${data.cost} MANA\n\n${data.damage ?? 0} DAMAGE`;
    return `${data.name}\n\n${data.cost} ENERGY\n\n${data.attack ?? 0}     ${currentHp}`;
  }

  private layoutHand(animated: boolean) {
    const count = this.hand.length;
    if (count === 0) return;

    const middle = (count - 1) / 2;
    const spacing = count <= 1 ? 0 : Math.min(58, 500 / (count - 1));

    this.hand.forEach((card, index) => {
      if (card.zone !== "hand" || card.dragging) return;

      const normalized = middle === 0 ? 0 : (index - middle) / middle;
      const lifted = this.hoveredCard === card || this.selectedHandCard === card;
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

    this.updateSelectionFrames();
  }

  private selectHandCard(card: TestCardView | null) {
    if (card && card.zone !== "hand") return;
    this.selectedAttacker = null;
    this.activeSpell = null;
    this.selectedHandCard = card;
    this.layoutHand(true);
    this.updateSelectionFrames();
  }

  private tryDropHandCard(card: TestCardView, x: number, y: number) {
    if (!this.playerTurn) return false;

    if (card.data.kind === "creature") {
      const slot = this.findSlotAt(this.playerCreatureSlots, x, y);
      if (slot) {
        this.playCreatureToSlot(card, slot);
        return true;
      }
    }

    if (card.data.kind === "equipment" && Phaser.Geom.Rectangle.Contains(this.playerHeroRect.getBounds(), x, y)) {
      this.selectHandCard(card);
      this.equipSelectedCard();
      return true;
    }

    if (card.data.kind === "spell") {
      const slot = this.findSlotAt(this.playerSpellSlots, x, y);
      if (slot) {
        this.playSpellToSlot(card, slot);
        return true;
      }
    }

    return false;
  }

  private playCreatureToSlot(card: TestCardView, slot: BoardSlot) {
    if (slot.occupied || card.data.kind !== "creature") return;
    if (this.playerEnergy < card.data.cost) {
      this.showStatus("Not enough Energy for that test creature.");
      this.layoutHand(true);
      return;
    }

    this.playerEnergy -= card.data.cost;
    this.removeFromHand(card);
    this.moveCardToBoard(card, slot);
    this.showStatus(`${card.data.name} placed in ${slot.kind} lane ${slot.lane}. Click it to attack.`);
    this.updateHud();
  }

  private equipSelectedCard() {
    const card = this.selectedHandCard;
    if (!card || card.data.kind !== "equipment") return;

    const slot = this.playerEquipmentSlots.find((candidate) => !candidate.occupied);
    if (!slot) {
      this.showStatus("No free Equipment slot.");
      return;
    }
    if (this.playerResources < card.data.cost) {
      this.showStatus("Not enough Resources for that Equipment.");
      return;
    }

    this.playerResources -= card.data.cost;
    this.removeFromHand(card);
    card.zone = "equipment";
    card.slot = slot;
    slot.occupied = card;
    this.input.setDraggable(card.container, false);
    card.container.disableInteractive();

    this.tweens.killTweensOf(card.container);
    card.container.setDepth(700).setAngle(0);
    this.tweens.add({
      targets: card.container,
      x: slot.rect.x,
      y: slot.rect.y,
      scaleX: 0.72,
      scaleY: 0.72,
      duration: 260,
      ease: "Back.easeOut",
    });

    this.showStatus(`${card.data.name} attached to your Hero and moved into Equipment slot ${slot.lane}.`);
    this.updateHud();
  }

  private playSpellToSlot(card: TestCardView, slot: BoardSlot) {
    if (slot.occupied || card.data.kind !== "spell") return;
    if (this.playerMana < card.data.cost) {
      this.showStatus("Not enough Mana for that Spell.");
      this.layoutHand(true);
      return;
    }

    this.playerMana -= card.data.cost;
    this.removeFromHand(card);
    card.zone = "spell";
    card.slot = slot;
    slot.occupied = card;
    this.input.setDraggable(card.container, false);

    this.tweens.killTweensOf(card.container);
    card.container.setDepth(900).setAngle(0).setScale(0.72);
    this.tweens.add({
      targets: card.container,
      x: slot.rect.x,
      y: slot.rect.y,
      duration: 220,
      ease: "Back.easeOut",
      onComplete: () => {
        card.container.setInteractive({ useHandCursor: true });
        card.container.on("pointerdown", () => {
          if (card.zone === "spell" && this.playerTurn) {
            this.selectedHandCard = null;
            this.selectedAttacker = null;
            this.activeSpell = this.activeSpell === card ? null : card;
            this.updateSelectionFrames();
          }
        });
        this.activeSpell = card;
        this.showStatus(`${card.data.name} is primed. Aim the arrow at an enemy creature or Hero.`);
      },
    });

    this.updateHud();
  }

  private removeFromHand(card: TestCardView) {
    const index = this.hand.indexOf(card);
    if (index >= 0) this.hand.splice(index, 1);
    if (this.hoveredCard === card) this.hoveredCard = null;
    if (this.selectedHandCard === card) this.selectedHandCard = null;
    card.dragging = false;
    this.layoutHand(true);
  }

  private moveCardToBoard(card: TestCardView, slot: BoardSlot) {
    card.zone = "board";
    card.slot = slot;
    slot.occupied = card;
    card.owner = slot.owner;
    this.input.setDraggable(card.container, false);
    card.container.disableInteractive();

    this.tweens.killTweensOf(card.container);
    card.container.setDepth(700).setAngle(0).setScale(1);
    this.tweens.add({
      targets: card.container,
      x: slot.rect.x,
      y: slot.rect.y,
      duration: 200,
      ease: "Sine.easeOut",
      onComplete: () => this.configureBoardCreature(card),
    });

    if (!this.allBoardCards.includes(card)) this.allBoardCards.push(card);
  }

  private spawnBoardCard(data: TestCardData, owner: Owner, slot: BoardSlot) {
    const card = this.createCardView(data, owner, "board", slot.rect.x, slot.rect.y);
    card.slot = slot;
    slot.occupied = card;
    card.container.setDepth(700);
    this.allBoardCards.push(card);
    this.configureBoardCreature(card);
    return card;
  }

  private configureBoardCreature(card: TestCardView) {
    card.container.setInteractive({ useHandCursor: true });
    card.frame.setStrokeStyle(3, this.cardColor("creature", card.owner), 1);

    card.container.on("pointerdown", () => {
      if (card.zone !== "board") return;

      if (card.owner === "player") {
        if (!this.playerTurn || card.hasAttacked || this.activeSpell) return;
        this.selectedHandCard = null;
        this.selectedAttacker = this.selectedAttacker === card ? null : card;
        this.updateSelectionFrames();
      } else {
        const target: EnemyTarget = { type: "creature", card };
        if (this.selectedAttacker) this.resolveAttack(target);
        else if (this.activeSpell) this.resolveSpellTarget(target);
      }
    });
  }

  private resolveAttack(target: EnemyTarget) {
    const attacker = this.selectedAttacker;
    if (!attacker || attacker.zone !== "board" || attacker.owner !== "player") return;

    this.selectedAttacker = null;
    attacker.hasAttacked = true;
    this.updateSelectionFrames();

    const targetX = target.type === "creature" ? target.card.container.x : target.rect.x;
    const targetY = target.type === "creature" ? target.card.container.y : target.rect.y;
    const startX = attacker.container.x;
    const startY = attacker.container.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const lunge = 42;

    this.tweens.add({
      targets: attacker.container,
      x: startX + (dx / distance) * lunge,
      y: startY + (dy / distance) * lunge,
      duration: 120,
      yoyo: true,
      ease: "Quad.easeOut",
      onYoyo: () => {
        this.flashImpact(targetX, targetY);
        const attackDamage = attacker.data.attack ?? 0;

        if (target.type === "creature") {
          const defender = target.card;
          const retaliation = defender.data.attack ?? 0;
          this.applyDamageToCreature(defender, attackDamage);
          this.applyDamageToCreature(attacker, retaliation);
          this.showStatus(`${attacker.data.name} struck for ${attackDamage}; retaliation dealt ${retaliation}.`);
        } else {
          this.applyDamageToEnemyHero(attackDamage);
          this.showStatus(`${attacker.data.name} hit the enemy Hero for ${attackDamage}.`);
        }
      },
    });
  }

  private resolveSpellTarget(target: EnemyTarget) {
    const spell = this.activeSpell;
    if (!spell || spell.zone !== "spell") return;
    this.activeSpell = null;
    this.updateSelectionFrames();

    const targetX = target.type === "creature" ? target.card.container.x : target.rect.x;
    const targetY = target.type === "creature" ? target.card.container.y : target.rect.y;
    const damage = spell.data.damage ?? 0;

    const startX = spell.container.x;
    const startY = spell.container.y;

    this.tweens.add({
      targets: spell.container,
      x: targetX,
      y: targetY,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 220,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.flashImpact(targetX, targetY, 0x6fbfff);
        if (target.type === "creature") this.applyDamageToCreature(target.card, damage);
        else this.applyDamageToEnemyHero(damage);

        if (spell.slot) spell.slot.occupied = null;
        this.sendCardToGraveyard(spell);
        this.showStatus(`${spell.data.name} dealt ${damage} damage and went to the Graveyard.`);
      },
    });
  }

  private applyDamageToCreature(card: TestCardView, amount: number) {
    if (card.zone !== "board" || amount <= 0) return;

    card.currentHp -= amount;
    this.floatDamage(card.container.x, card.container.y, amount);
    this.cameras.main.shake(90, 0.0015);
    card.label.setText(this.cardText(card.data, Math.max(0, card.currentHp)));

    this.tweens.add({ targets: card.container, alpha: 0.45, duration: 70, yoyo: true, repeat: 1 });

    if (card.currentHp <= 0) this.time.delayedCall(180, () => this.killCreature(card));
  }

  private killCreature(card: TestCardView) {
    if (card.zone !== "board") return;
    if (card.slot) card.slot.occupied = null;
    card.slot = null;
    if (this.selectedAttacker === card) this.selectedAttacker = null;
    this.sendCardToGraveyard(card);
  }

  private sendCardToGraveyard(card: TestCardView) {
    if (card.zone === "graveyard") return;

    const owner = card.owner;
    card.zone = "graveyard";
    card.container.disableInteractive();

    if (owner === "player") this.playerGraveyard += 1;
    else this.enemyGraveyard += 1;
    this.updateHud();

    const targetY = owner === "player" ? PLAYER_GRAVEYARD_Y : ENEMY_GRAVEYARD_Y;
    this.tweens.killTweensOf(card.container);
    this.tweens.add({
      targets: card.container,
      x: GRAVEYARD_X,
      y: targetY,
      angle: Phaser.Math.Between(-15, 15),
      scaleX: 0.35,
      scaleY: 0.35,
      alpha: 0.15,
      duration: 520,
      ease: "Quad.easeIn",
      onComplete: () => card.container.destroy(true),
    });
  }

  private applyDamageToEnemyHero(amount: number) {
    let remaining = amount;
    if (this.enemyGuard > 0) {
      const absorbed = Math.min(this.enemyGuard, remaining);
      this.enemyGuard -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) this.enemyHp = Math.max(0, this.enemyHp - remaining);

    this.floatDamage(this.enemyHeroRect.x, this.enemyHeroRect.y, amount);
    this.tweens.add({ targets: this.enemyHeroRect, alpha: 0.35, duration: 80, yoyo: true, repeat: 1 });
    this.updateHud();
  }

  private flashImpact(x: number, y: number, color = 0xffd06b) {
    const flash = this.add.circle(x, y, 12, color, 0.95).setDepth(2600);
    this.tweens.add({
      targets: flash,
      scale: 4,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  private floatDamage(x: number, y: number, amount: number) {
    const text = this.add
      .text(x, y - 25, `-${amount}`, {
        fontFamily: "Georgia, serif",
        fontSize: "24px",
        color: "#ff8d78",
        stroke: "#211111",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(2700);

    this.tweens.add({
      targets: text,
      y: y - 90,
      alpha: 0,
      scale: 1.3,
      duration: 700,
      ease: "Quad.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  private animateBurn(data: TestCardData) {
    const container = this.add.container(DECK_X, PLAYER_DECK_Y).setDepth(2800);
    const frame = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, 0x2b2b2b).setStrokeStyle(4, 0xc8a66a, 1);
    const glow = this.add.rectangle(0, 0, CARD_WIDTH - 8, CARD_HEIGHT - 8, 0xe56a24, 0);
    const label = this.add
      .text(0, 0, this.cardText(data, data.health ?? 0), {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "12px",
        color: "#f4ead6",
      })
      .setOrigin(0.5);
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

  private findSlotAt(slots: BoardSlot[], x: number, y: number) {
    return slots.find((slot) => !slot.occupied && Phaser.Geom.Rectangle.Contains(slot.rect.getBounds(), x, y)) ?? null;
  }

  private findEnemyTargetAt(x: number, y: number): EnemyTarget | null {
    const card = this.allBoardCards.find(
      (candidate) =>
        candidate.owner === "enemy" &&
        candidate.zone === "board" &&
        Phaser.Geom.Rectangle.Contains(candidate.container.getBounds(), x, y),
    );
    if (card) return { type: "creature", card };

    if (Phaser.Geom.Rectangle.Contains(this.enemyHeroRect.getBounds(), x, y)) return { type: "hero", rect: this.enemyHeroRect };
    return null;
  }

  private updateSelectionFrames() {
    for (const card of this.hand) {
      card.frame.setStrokeStyle(card === this.selectedHandCard ? 5 : 3, card === this.selectedHandCard ? 0xf0d270 : this.cardColor(card.data.kind, card.owner), 1);
    }

    for (const card of this.allBoardCards) {
      if (card.zone !== "board") continue;
      if (card === this.selectedAttacker) card.frame.setStrokeStyle(5, 0xf0d270, 1);
      else if (card.hasAttacked && card.owner === "player") card.frame.setStrokeStyle(3, 0x6d6658, 0.7);
      else card.frame.setStrokeStyle(3, this.cardColor("creature", card.owner), 1);
    }

    for (const slot of this.playerSpellSlots) {
      if (slot.occupied === this.activeSpell) slot.rect.setStrokeStyle(5, 0x79c9ff, 1);
      else slot.rect.setStrokeStyle(2, SLOT_COLORS.spell, 0.68);
    }
  }

  private drawTargetingArrow() {
    this.targetingArrow.clear();

    let sourceX: number | null = null;
    let sourceY: number | null = null;
    let valid = false;
    let snapX: number | null = null;
    let snapY: number | null = null;
    const pointer = this.input.activePointer;

    if (this.selectedHandCard?.zone === "hand" && !this.selectedHandCard.dragging) {
      const card = this.selectedHandCard;
      sourceX = card.container.x;
      sourceY = card.container.y - (CARD_HEIGHT * card.container.scaleY) / 2 + 8;

      if (card.data.kind === "creature") {
        const slot = this.findSlotAt(this.playerCreatureSlots, pointer.worldX, pointer.worldY);
        if (slot) {
          valid = true;
          snapX = slot.rect.x;
          snapY = slot.rect.y;
        }
      } else if (card.data.kind === "equipment") {
        if (Phaser.Geom.Rectangle.Contains(this.playerHeroRect.getBounds(), pointer.worldX, pointer.worldY)) {
          valid = true;
          snapX = this.playerHeroRect.x;
          snapY = this.playerHeroRect.y;
        }
      } else {
        const slot = this.findSlotAt(this.playerSpellSlots, pointer.worldX, pointer.worldY);
        if (slot) {
          valid = true;
          snapX = slot.rect.x;
          snapY = slot.rect.y;
        }
      }
    } else if (this.selectedAttacker?.zone === "board") {
      sourceX = this.selectedAttacker.container.x;
      sourceY = this.selectedAttacker.container.y;
      const target = this.findEnemyTargetAt(pointer.worldX, pointer.worldY);
      if (target) {
        valid = true;
        snapX = target.type === "creature" ? target.card.container.x : target.rect.x;
        snapY = target.type === "creature" ? target.card.container.y : target.rect.y;
      }
    } else if (this.activeSpell?.zone === "spell") {
      sourceX = this.activeSpell.container.x;
      sourceY = this.activeSpell.container.y;
      const target = this.findEnemyTargetAt(pointer.worldX, pointer.worldY);
      if (target) {
        valid = true;
        snapX = target.type === "creature" ? target.card.container.x : target.rect.x;
        snapY = target.type === "creature" ? target.card.container.y : target.rect.y;
      }
    }

    if (sourceX === null || sourceY === null) return;

    const endX = snapX ?? pointer.worldX;
    const endY = snapY ?? pointer.worldY;
    const angle = Math.atan2(endY - sourceY, endX - sourceX);
    const headLength = 20;
    const color = valid ? 0x8be38b : 0xe3c76c;

    this.targetingArrow.lineStyle(5, color, 0.92);
    this.targetingArrow.beginPath();
    this.targetingArrow.moveTo(sourceX, sourceY);
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

  private toggleTurn() {
    this.cancelSelections();

    if (this.playerTurn) {
      this.playerTurn = false;
      this.turnText.setText("OPPONENT TURN").setColor("#c89595");
      this.turnButtonText.setText("SIMULATE ENEMY END");
      this.turnButton.setFillStyle(0x4a3333, 0.9).setStrokeStyle(2, 0xc27a7a, 0.95);
      this.showStatus("Opponent turn test: player cards are temporarily inactive.");
    } else {
      this.playerTurn = true;
      this.playerEnergy = 5;
      this.playerResources = 5;
      this.playerMana = 5;
      for (const card of this.allBoardCards) {
        if (card.owner === "player" && card.zone === "board") card.hasAttacked = false;
      }
      this.turnText.setText("YOUR TURN").setColor("#9fc8a5");
      this.turnButtonText.setText("END TURN");
      this.turnButton.setFillStyle(0x594b34, 0.9).setStrokeStyle(2, 0xd6bd7a, 0.95);
      this.drawCard();
      this.showStatus("Your turn: resources refilled to 5, attacks reset, one card drawn.");
    }

    this.updateSelectionFrames();
    this.updateHud();
  }

  private cancelSelections() {
    this.selectedHandCard = null;
    this.selectedAttacker = null;
    this.activeSpell = null;
    this.layoutHand(true);
    this.updateSelectionFrames();
  }

  private updateHud() {
    if (this.deckCountText) this.deckCountText.setText(`${this.deck.length} cards`);
    if (this.playerHandCountText) this.playerHandCountText.setText(`HAND  ${this.hand.length} / ${HAND_MAX}`);
    if (this.playerGraveyardCountText) this.playerGraveyardCountText.setText(`${this.playerGraveyard} cards`);
    if (this.enemyGraveyardCountText) this.enemyGraveyardCountText.setText(`${this.enemyGraveyard} cards`);

    if (this.playerEnergyText) this.playerEnergyText.setText(`ENERGY   ${this.playerEnergy} / ${this.resourceCap}`);
    if (this.playerResourcesText) this.playerResourcesText.setText(`RESOURCES   ${this.playerResources} / ${this.resourceCap}`);
    if (this.playerManaText) this.playerManaText.setText(`${this.playerMana} / ${this.resourceCap}`);

    if (this.playerHeroText) this.playerHeroText.setText(`YOUR HERO\nGuard ${this.playerGuard}\nHP ${this.playerHp}`);
    if (this.enemyHeroText) this.enemyHeroText.setText(`ENEMY HERO\nGuard ${this.enemyGuard}\nHP ${this.enemyHp}`);

    this.refreshManaCrystals();
  }

  private refreshManaCrystals() {
    if (this.playerManaCrystals.length !== 10) return;

    for (let i = 0; i < 10; i += 1) {
      const activeFromBottom = i >= 10 - this.playerMana;
      this.playerManaCrystals[i]
        .setFillStyle(activeFromBottom ? 0x57b7ff : 0x24445c, activeFromBottom ? 0.95 : 0.35)
        .setStrokeStyle(2, activeFromBottom ? 0x9bd8ff : 0x4e7189, activeFromBottom ? 1 : 0.55);
    }
  }

  private showStatus(message: string) {
    if (!this.statusText) return;
    this.statusText.setText(message);
    this.time.delayedCall(2400, () => {
      if (this.statusText.text === message) this.statusText.setText("");
    });
  }
}
