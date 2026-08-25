import Phaser from "phaser";
import { CARD_DEFINITIONS } from "../../data/cards";
import { STARTER_DECKS } from "../../data/decks";
import { runAiTurn } from "../../engine/ai";
import { activateBuildingAbility } from "../../engine/building";
import {
  canAttack,
  declareCreatureAttack,
  declareHeroAttack,
  getEffectiveCreatureAttack,
  getHeroAttack,
  heroCanAttack,
  type AttackTarget,
} from "../../engine/combat";
import { assignEquipment } from "../../engine/equipment";
import type { EffectTargetRef } from "../../engine/effects";
import { createInitialGameState } from "../../engine/factory";
import {
  activateSlotCard,
  endTurn,
  getHandCardPlayability,
  playCardFromHand,
  startGame,
  type PlayCardOptions,
} from "../../engine/game";
import { activateHeroPower, activateHeroSignature } from "../../engine/hero";
import type {
  BuildingDefinition,
  CardArchetype,
  CardDefinition,
  CardEffect,
  CardInstance,
  EquipmentDefinition,
  GameState,
  HeroCardDefinition,
  PlayerId,
} from "../../engine/types";
import {
  effectHasLegalTarget,
  effectNeedsExplicitTarget,
  effectTargetCategory,
  isEffectTargetable,
} from "../../ui/targeting";
import { createPhaserCardFace, preloadCardFaceAssets } from "../cardFace";

const FIELD_CENTER_X = 960;
const SLOT_WIDTH = 88;
const SLOT_HEIGHT = 124;
const HERO_WIDTH = 92;
const HERO_HEIGHT = 132;
const COLUMN_GAP = 36;
const FIELD_COLUMNS = 5;
const CARD_WIDTH = SLOT_WIDTH;
const CARD_HEIGHT = SLOT_HEIGHT;
const HAND_BASE_Y = 1065;
const HAND_HOVER_Y = 930;

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
const ENEMY_HERO_Y = 245;
const PLAYER_HERO_Y = 795;
const TURN_BUTTON_X = 1360;
const TURN_BUTTON_Y = 540;
const HAND_COUNT_Y = 958;

const ROWS = {
  enemyBuildings: 205,
  enemySupport: 335,
  enemyVanguard: 465,
  playerVanguard: 615,
  playerSupport: 745,
  playerBuildings: 875,
};

type BoardRow = "vanguard" | "support";
type SlotKind = "vanguard" | "support" | "building" | "equipment" | "spell";

type SlotRef = {
  owner: PlayerId;
  kind: SlotKind;
  index: number;
  rect: Phaser.GameObjects.Rectangle;
};

type Point = { x: number; y: number };

type PendingTarget =
  | {
      kind: "play";
      instanceId: string;
      options: PlayCardOptions;
      effect: CardEffect;
      sourceArchetype?: CardArchetype;
      ghost?: { x: number; y: number; width: number; height: number; defId: string };
    }
  | {
      kind: "activate";
      slotIndex: number;
      effect: CardEffect;
      sourceArchetype?: CardArchetype;
      source: Point;
    }
  | {
      kind: "building";
      slotIndex: number;
      effect: CardEffect;
      sourceArchetype?: CardArchetype;
      source: Point;
    }
  | {
      kind: "heroPower";
      effect: CardEffect;
      sourceArchetype?: CardArchetype;
      source: Point;
    }
  | {
      kind: "signature";
      effect: CardEffect;
      sourceArchetype?: CardArchetype;
      source: Point;
    };

type CardRenderRef = {
  instanceId: string;
  owner: PlayerId;
  archetype: CardArchetype;
  x: number;
  y: number;
  row?: BoardRow | "buildings";
};

const SLOT_COLORS: Record<SlotKind, number> = {
  vanguard: 0xc8a66a,
  support: 0x8da9c4,
  building: 0x9a8569,
  equipment: 0xb38bc7,
  spell: 0x6fa6c7,
};

export class EngineBattleScene extends Phaser.Scene {
  private state!: GameState;

  private selectedHandId: string | null = null;
  private selectedAttacker: string | "hero" | null = null;
  private selectedEquipmentSlot: number | null = null;
  private pendingTarget: PendingTarget | null = null;
  private hoveredHandId: string | null = null;
  private statusMessage = "";

  private arrow!: Phaser.GameObjects.Graphics;
  private handViews = new Map<string, Phaser.GameObjects.Container>();
  private boardRefs = new Map<string, CardRenderRef>();
  private playerSlots: SlotRef[] = [];
  private enemySlots: SlotRef[] = [];
  private tooltip: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("EngineBattleScene");
  }

  preload() {
    preloadCardFaceAssets(this);
  }

  create() {
    this.state = createInitialGameState(
      "fighter",
      STARTER_DECKS.fighter,
      "mage",
      STARTER_DECKS.mage,
      "player",
    );
    startGame(this.state);

    this.input.keyboard?.on("keydown-ESC", () => {
      this.cancelPending();
      this.renderScene();
    });

    this.input.on("dragstart", (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const id = gameObject.getData("handInstanceId") as string | undefined;
      if (!id || this.state.activePlayer !== "player") return;
      gameObject.setData("wasDragged", true);
      const container = gameObject as Phaser.GameObjects.Container;
      container.setDepth(4500).setAngle(0).setScale(1.08);
      this.selectedHandId = id;
    });

    this.input.on(
      "drag",
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
        const id = gameObject.getData("handInstanceId") as string | undefined;
        if (!id) return;
        (gameObject as Phaser.GameObjects.Container).setPosition(dragX, dragY);
      },
    );

    this.input.on("dragend", (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const id = gameObject.getData("handInstanceId") as string | undefined;
      if (!id) return;
      gameObject.setData("wasDragged", false);
      const handled = this.handleHandDrop(id, pointer.worldX, pointer.worldY);
      if (!handled) this.layoutHand(true);
    });

    this.renderScene();
  }

  update() {
    this.drawTargetingArrow();
  }

  private columnX(index: number) {
    const totalWidth = SLOT_WIDTH * FIELD_COLUMNS + COLUMN_GAP * (FIELD_COLUMNS - 1);
    const left = FIELD_CENTER_X - totalWidth / 2 + SLOT_WIDTH / 2;
    return left + index * (SLOT_WIDTH + COLUMN_GAP);
  }

  private renderScene() {
    this.tooltip = null;
    this.children.removeAll(true);
    this.handViews.clear();
    this.boardRefs.clear();
    this.playerSlots = [];
    this.enemySlots = [];

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 4, width, height / 2, 0x221b1b, 0.42);
    this.add.rectangle(width / 2, (height * 3) / 4, width, height / 2, 0x18211c, 0.42);

    this.add
      .text(width / 2, 18, "PHASER — REAL ENGINE BRIDGE", {
        fontFamily: "Georgia, serif",
        fontSize: "25px",
        color: "#f4ead6",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        48,
        "Fighter starter deck vs Mage AI • legality, combat, resources and effects come from src/engine",
        { fontFamily: "Arial, sans-serif", fontSize: "13px", color: "#aaa69f" },
      )
      .setOrigin(0.5);

    this.renderLaneDivider();
    this.renderBoard();
    this.renderHeroHud("opponent");
    this.renderHeroHud("player");
    this.renderEquipmentRack("opponent", ENEMY_HERO_Y);
    this.renderEquipmentRack("player", PLAYER_HERO_Y);
    this.renderManaBar("opponent", ENEMY_HERO_Y);
    this.renderManaBar("player", PLAYER_HERO_Y);
    this.renderSpellRack("opponent", ENEMY_HERO_Y);
    this.renderSpellRack("player", PLAYER_HERO_Y);
    this.renderDecksAndPiles();
    this.renderHand();
    this.renderTurnButton();
    this.renderPendingGhost();

    this.arrow = this.add.graphics().setDepth(6000);

    if (this.statusMessage) {
      this.add
        .text(FIELD_CENTER_X, 985, this.statusMessage, {
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          color: "#e1cf92",
          backgroundColor: "#151515cc",
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(6500);
    }

    if (this.state.winner) {
      this.add
        .text(FIELD_CENTER_X, 540, this.state.winner === "player" ? "VICTORY" : "DEFEAT", {
          fontFamily: "Georgia, serif",
          fontSize: "54px",
          color: this.state.winner === "player" ? "#e8d58a" : "#d78585",
          stroke: "#111111",
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth(8000);
    }
  }

  private renderLaneDivider() {
    for (let i = 0; i < FIELD_COLUMNS; i += 1) {
      this.add
        .text(this.columnX(i), 540, String(i + 1), {
          fontFamily: "Arial, sans-serif",
          fontSize: "17px",
          color: "#8f8f8f",
        })
        .setOrigin(0.5);
    }

    const divider = this.add.graphics();
    divider.lineStyle(2, 0x777777, 0.5);
    divider.lineBetween(430, 540, 1490, 540);

    this.add.text(560, 526, "OPPONENT", { fontFamily: "Arial", fontSize: "14px", color: "#ad7e7e" }).setOrigin(0.5, 1);
    this.add.text(560, 554, "YOU", { fontFamily: "Arial", fontSize: "14px", color: "#7fa987" }).setOrigin(0.5, 0);
  }

  private renderBoard() {
    this.renderBoardRow("opponent", "buildings", ROWS.enemyBuildings, "BUILDINGS");
    this.renderBoardRow("opponent", "support", ROWS.enemySupport, "BACKLINE");
    this.renderBoardRow("opponent", "vanguard", ROWS.enemyVanguard, "VANGUARD");
    this.renderBoardRow("player", "vanguard", ROWS.playerVanguard, "VANGUARD");
    this.renderBoardRow("player", "support", ROWS.playerSupport, "BACKLINE");
    this.renderBoardRow("player", "buildings", ROWS.playerBuildings, "BUILDINGS");
  }

  private renderBoardRow(owner: PlayerId, row: BoardRow | "buildings", y: number, label: string) {
    this.add
      .text(600, y, label, {
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        color: owner === "opponent" ? "#a58b8b" : "#8fa593",
      })
      .setOrigin(1, 0.5);

    const kind: SlotKind = row === "buildings" ? "building" : row;
    const boardRow = this.state.players[owner].board[row];

    for (let i = 0; i < boardRow.length; i += 1) {
      const rect = this.createSlot(this.columnX(i), y, kind, i + 1);
      const ref: SlotRef = { owner, kind, index: i, rect };
      if (owner === "player") this.playerSlots.push(ref);
      else this.enemySlots.push(ref);

      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => this.onSlotClick(ref));
    }

    const rendered = new Set<string>();
    for (let i = 0; i < boardRow.length; i += 1) {
      const card = boardRow[i];
      if (!card || rendered.has(card.instanceId)) continue;
      rendered.add(card.instanceId);

      const indices: number[] = [];
      boardRow.forEach((candidate, index) => {
        if (candidate?.instanceId === card.instanceId) indices.push(index);
      });
      const first = Math.min(...indices);
      const last = Math.max(...indices);
      const x = (this.columnX(first) + this.columnX(last)) / 2;
      const width = SLOT_WIDTH + (last - first) * (SLOT_WIDTH + COLUMN_GAP);
      this.renderBoardCard(owner, card, x, y, width, row);
    }
  }

  private renderBoardCard(
    owner: PlayerId,
    card: CardInstance,
    x: number,
    y: number,
    width: number,
    row: BoardRow | "buildings",
  ) {
    const def = CARD_DEFINITIONS[card.defId];
    const selected = this.selectedAttacker === card.instanceId;
    const hitArea = this.add
      .rectangle(x, y, width, CARD_HEIGHT, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
      .setDepth(702);

    const faceWidth = Math.min(width, (CARD_HEIGHT * 2) / 3);
    let attack: number | null = null;
    let health: number | null = null;
    let badge = "";
    if (def.archetype === "creature") {
      attack = getEffectiveCreatureAttack(this.state, owner, card);
      health = card.currentHp ?? def.hp;
      const statusText = card.statuses.map((status) => `${status.type}:${status.turnsRemaining ?? "∞"}`).join(" ");
      const exhausted = card.hasAttackedThisTurn ? "EXHAUSTED" : card.summonedTurn === this.state.turnNumber ? "SUMMONING" : "";
      badge = [statusText, exhausted].filter(Boolean).join(" • ");
    } else if (def.archetype === "building") {
      health = card.currentHp ?? def.hp;
    }
    const face = createPhaserCardFace(this, def, {
      width: faceWidth,
      height: CARD_HEIGHT,
      attack,
      health,
      selected,
      badge,
    }).setPosition(x, y).setDepth(700);

    this.boardRefs.set(card.instanceId, { instanceId: card.instanceId, owner, archetype: card.archetype, x, y, row });

    hitArea.on("pointerdown", () => this.onBoardCardClick(owner, card, row));
    hitArea.on("pointerover", () => this.showCardTooltip(card, x + (owner === "player" ? 130 : -130), y));
    hitArea.on("pointerout", () => this.hideTooltip());
    face.setData("boardCardInstanceId", card.instanceId);
  }

  private createSlot(x: number, y: number, kind: SlotKind, number: number, width = SLOT_WIDTH, height = SLOT_HEIGHT) {
    const color = SLOT_COLORS[kind];
    const rect = this.add.rectangle(x, y, width, height, color, 0.055).setStrokeStyle(2, color, 0.68);
    this.add
      .text(x, y, String(number), { fontFamily: "Arial", fontSize: "12px", color: "#8f8a83" })
      .setOrigin(0.5);
    return rect;
  }

  private renderHeroHud(owner: PlayerId) {
    const player = this.state.players[owner];
    const y = owner === "player" ? PLAYER_HERO_Y : ENEMY_HERO_Y;
    const def = CARD_DEFINITIONS[player.hero.defId] as HeroCardDefinition;
    const selected = owner === "player" && this.selectedAttacker === "hero";

    const heroRect = this.add
      .rectangle(HERO_X, y, HERO_WIDTH, HERO_HEIGHT, 0x2b2925, 0.98)
      .setStrokeStyle(selected ? 5 : 3, selected ? 0xf0d270 : 0xe5d8b0, 0.95)
      .setInteractive({ useHandCursor: true })
      .setDepth(500);

    const attack = getHeroAttack(this.state, owner);
    this.add
      .text(HERO_X, y, `${def.name}\n\n${attack} ATK\nGuard ${player.guard.current}/${player.guard.max}\nHP ${player.hero.currentHp}/${player.hero.maxHp}`, {
        align: "center",
        fontFamily: "Georgia, serif",
        fontSize: "11px",
        color: "#eee4d0",
      })
      .setOrigin(0.5)
      .setDepth(501);

    heroRect.on("pointerdown", () => this.onHeroClick(owner));
    heroRect.on("pointerover", () => this.showHeroTooltip(owner, HERO_X + 155, y));
    heroRect.on("pointerout", () => this.hideTooltip());

    if (owner === "player") {
      this.resourcePill(HERO_X, y + 88, `ENERGY   ${player.energy.current} / ${player.energy.cap}`, 0xd8b35f, owner);
      this.resourcePill(HERO_X, y + 116, `RESOURCES   ${player.resources.current} / ${player.resources.cap}  (+${player.resources.income ?? 1})`, 0xb57b4b, owner);
    } else {
      this.resourcePill(HERO_X, y - 116, `ENERGY   ${player.energy.current} / ${player.energy.cap}`, 0xd8b35f, owner);
      this.resourcePill(HERO_X, y - 88, `RESOURCES   ${player.resources.current} / ${player.resources.cap}`, 0xb57b4b, owner);
    }

    const spec = def.specializations.find((s) => s.id === player.hero.chosenSpecializationId) ?? def.specializations[0];
    const passiveY = owner === "player" ? y - 102 : y + 102;
    this.hoverPanel(HERO_X, passiveY, 132, 42, `PASSIVE\n${spec.name}`, 0x75634e, spec.name, spec.text);

    if (def.signature) {
      const sigY = y - 34;
      const uses = player.hero.signatureUsesRemaining ?? 0;
      this.hoverPanel(
        HERO_X + 100,
        sigY,
        82,
        58,
        `SIGNATURE\n${uses} left`,
        0x73577f,
        "Signature Ability",
        `${def.signature.text ?? this.effectSummary(def.signature.effect)}\nCost: ${def.signature.activateCost} Energy`,
        owner === "player" ? () => this.beginHeroAbility("signature") : undefined,
      );
    }

    if (def.heroPower) {
      const powerY = y + 34;
      const used = player.hero.heroPowerUsedThisTurn ? "USED" : `${def.heroPower.activateCost} E`;
      this.hoverPanel(
        HERO_X + 100,
        powerY,
        82,
        58,
        `POWER\n${used}`,
        0x556f7f,
        "Hero Power",
        def.heroPower.text ?? this.effectSummary(def.heroPower.effect),
        owner === "player" ? () => this.beginHeroAbility("heroPower") : undefined,
      );
    }
  }

  private resourcePill(x: number, y: number, label: string, color: number, owner: PlayerId) {
    this.add.rectangle(x, y, 142, 22, color, 0.13).setStrokeStyle(1, color, 0.8);
    this.add
      .text(x, y, label, {
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        color: owner === "opponent" ? "#cababa" : "#d8ddd9",
      })
      .setOrigin(0.5);
  }

  private renderEquipmentRack(owner: PlayerId, centerY: number) {
    const zone = this.state.players[owner].board.equipment;
    const spacing = 96;
    const startY = centerY - (spacing * 3) / 2;

    for (let i = 0; i < zone.length; i += 1) {
      const y = startY + i * spacing;
      const rect = this.createSlot(EQUIPMENT_X, y, "equipment", i + 1, 68, 84);
      const ref: SlotRef = { owner, kind: "equipment", index: i, rect };
      if (owner === "player") this.playerSlots.push(ref);
      else this.enemySlots.push(ref);
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => this.onSlotClick(ref));

      const card = zone[i];
      if (!card) continue;
      const def = CARD_DEFINITIONS[card.defId] as EquipmentDefinition;
      const selected = owner === "player" && this.selectedEquipmentSlot === i;
      const bearer = card.equipmentBearer?.kind === "hero" ? "Hero" : card.equipmentBearer?.kind === "creature" ? "Armiger" : "Unassigned";
      const item = createPhaserCardFace(this, def, {
        width: 52,
        height: 78,
        selected,
        badge: bearer,
      })
        .setPosition(EQUIPMENT_X, y)
        .setInteractive({ useHandCursor: true })
        .setDepth(650);
      item.on("pointerdown", () => this.onEquipmentClick(owner, i));
      item.on("pointerover", () => this.showCardTooltip(card, EQUIPMENT_X + 160, y));
      item.on("pointerout", () => this.hideTooltip());
      this.boardRefs.set(card.instanceId, { instanceId: card.instanceId, owner, archetype: card.archetype, x: EQUIPMENT_X, y });
    }

    this.add.text(EQUIPMENT_X, centerY + 205, "EQUIPMENT", { fontFamily: "Arial", fontSize: "15px", color: owner === "player" ? "#8fa593" : "#a58b8b" }).setOrigin(0.5);
  }

  private renderManaBar(owner: PlayerId, centerY: number) {
    const mana = this.state.players[owner].mana;
    const spacing = 20;
    const startY = centerY - (spacing * 9) / 2;
    const endY = startY + spacing * 9;

    for (let i = 0; i < 10; i += 1) {
      const active = owner === "player" ? i >= 10 - mana.current : i < mana.current;
      this.add
        .rectangle(MANA_X, startY + i * spacing, 12, 12, active ? 0x57b7ff : 0x24445c, active ? 0.95 : 0.35)
        .setStrokeStyle(2, active ? 0x9bd8ff : 0x4e7189, active ? 1 : 0.55)
        .setAngle(45);
    }

    const countY = owner === "opponent" ? startY - 28 : endY + 28;
    this.add
      .text(MANA_X, countY, `${mana.current} / ${mana.cap}`, { fontFamily: "Arial", fontSize: "13px", color: "#a9c9e2" })
      .setOrigin(0.5);
  }

  private renderSpellRack(owner: PlayerId, centerY: number) {
    const zone = this.state.players[owner].board.spellAbilitySlots;
    const spacing = 102;
    const startY = centerY - (spacing * (zone.length - 1)) / 2;

    for (let i = 0; i < zone.length; i += 1) {
      const y = startY + i * spacing;
      const rect = this.createSlot(SPELL_X, y, "spell", i + 1, 68, 92);
      const ref: SlotRef = { owner, kind: "spell", index: i, rect };
      if (owner === "player") this.playerSlots.push(ref);
      else this.enemySlots.push(ref);
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => this.onSlotClick(ref));

      const card = zone[i];
      if (!card) continue;
      const def = CARD_DEFINITIONS[card.defId];
      const charges = card.chargesRemaining === undefined ? "∞" : String(card.chargesRemaining);
      const item = createPhaserCardFace(this, def, {
        width: 57,
        height: 86,
        badge: `${charges} charges`,
      })
        .setPosition(SPELL_X, y)
        .setInteractive({ useHandCursor: true })
        .setDepth(650);
      item.on("pointerdown", () => this.onSpellSlotClick(owner, i));
      item.on("pointerover", () => this.showCardTooltip(card, SPELL_X - 180, y));
      item.on("pointerout", () => this.hideTooltip());
      this.boardRefs.set(card.instanceId, { instanceId: card.instanceId, owner, archetype: card.archetype, x: SPELL_X, y });
    }

    this.add.text(SPELL_X, centerY + 220, "SPELL / ABILITY", { fontFamily: "Arial", fontSize: "15px", color: owner === "player" ? "#8fa593" : "#a58b8b" }).setOrigin(0.5);
  }

  private renderDecksAndPiles() {
    const enemy = this.state.players.opponent;
    const player = this.state.players.player;

    this.deckPile(DECK_X, ENEMY_DECK_Y, "ENEMY\nDECK", `${enemy.deck.length} cards\nHand ${enemy.hand.length}`, false);
    this.deckPile(DECK_X, PLAYER_DECK_Y, "YOUR\nDECK", `${player.deck.length} cards`, true);

    this.pile(GRAVEYARD_X, ENEMY_GRAVEYARD_Y, "ENEMY\nGRAVEYARD", `${enemy.graveyard.length} cards\nDiscard ${enemy.discard.length}`);
    this.pile(GRAVEYARD_X, PLAYER_GRAVEYARD_Y, "YOUR\nGRAVEYARD", `${player.graveyard.length} cards\nDiscard ${player.discard.length}`);
  }

  private deckPile(x: number, y: number, label: string, count: string, interactive: boolean) {
    const rect = this.add.rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, 0x25202d).setStrokeStyle(4, 0x9a7ab0).setDepth(400);
    this.add.text(x, y - 14, label, { align: "center", fontFamily: "Georgia", fontSize: "14px", color: "#eee5f2" }).setOrigin(0.5).setDepth(401);
    this.add.text(x, y + 32, count, { align: "center", fontFamily: "Arial", fontSize: "10px", color: "#cfc1d6" }).setOrigin(0.5).setDepth(401);
    if (interactive) {
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => this.setStatus("Manual draw is disabled in the real match. Draws come from engine effects and turn start."));
    }
  }

  private pile(x: number, y: number, label: string, count: string) {
    this.add.rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, 0x191919).setStrokeStyle(3, 0x777777, 0.8);
    this.add.text(x, y - 12, label, { align: "center", fontFamily: "Georgia", fontSize: "12px", color: "#b7b0aa" }).setOrigin(0.5);
    this.add.text(x, y + 34, count, { align: "center", fontFamily: "Arial", fontSize: "10px", color: "#8f8f8f" }).setOrigin(0.5);
  }

  private renderHand() {
    const hand = this.state.players.player.hand;
    const hiddenPendingId = this.pendingTarget?.kind === "play" && this.pendingTarget.ghost ? this.pendingTarget.instanceId : null;

    this.add
      .text(FIELD_CENTER_X, HAND_COUNT_Y, `HAND  ${hand.length} / 10`, { fontFamily: "Arial", fontSize: "13px", color: "#c9c2b5" })
      .setOrigin(0.5);

    for (const card of hand) {
      if (card.instanceId === hiddenPendingId) continue;
      const def = CARD_DEFINITIONS[card.defId];
      const container = this.add.container(FIELD_CENTER_X, HAND_BASE_Y).setDepth(1000);
      const selected = this.selectedHandId === card.instanceId;
      const playability = getHandCardPlayability(this.state, "player", card.instanceId);
      const face = createPhaserCardFace(this, def, {
        width: (CARD_HEIGHT * 2) / 3,
        height: CARD_HEIGHT,
        playable: playability.playable,
        selected,
      });
      container.add(face);
      container.setSize(CARD_WIDTH, CARD_HEIGHT);
      container.setInteractive({ useHandCursor: true });
      container.setData("handInstanceId", card.instanceId);
      this.input.setDraggable(container);

      container.on("pointerover", () => {
        if (container.getData("wasDragged")) return;
        this.hoveredHandId = card.instanceId;
        this.layoutHand(true);
        this.showCardTooltip(card, container.x + 150, 850, playability.reason);
      });
      container.on("pointerout", () => {
        if (this.hoveredHandId === card.instanceId) this.hoveredHandId = null;
        this.layoutHand(true);
        this.hideTooltip();
      });
      container.on("pointerdown", () => {
        if (container.getData("wasDragged")) return;
        this.onHandCardClick(card.instanceId);
      });
      this.handViews.set(card.instanceId, container);
    }

    this.layoutHand(false);
  }

  private layoutHand(animated: boolean) {
    const visible = this.state.players.player.hand.filter((card) => this.handViews.has(card.instanceId));
    const count = visible.length;
    if (count === 0) return;
    const middle = (count - 1) / 2;
    const spacing = count <= 1 ? 0 : Math.min(58, 500 / (count - 1));

    visible.forEach((card, index) => {
      const view = this.handViews.get(card.instanceId);
      if (!view || view.getData("wasDragged")) return;
      const normalized = middle === 0 ? 0 : (index - middle) / middle;
      const lifted = this.hoveredHandId === card.instanceId || this.selectedHandId === card.instanceId;
      const x = FIELD_CENTER_X + (index - middle) * spacing;
      const y = lifted ? HAND_HOVER_Y : HAND_BASE_Y + Math.abs(normalized) * 12;
      const angle = lifted ? 0 : normalized * 9;
      const scale = lifted ? 1.55 : 1;
      view.setDepth(lifted ? 3000 : 1000 + index);
      if (animated) {
        this.tweens.killTweensOf(view);
        this.tweens.add({ targets: view, x, y, angle, scaleX: scale, scaleY: scale, duration: 140, ease: "Sine.easeOut" });
      } else {
        view.setPosition(x, y).setAngle(angle).setScale(scale);
      }
    });
  }

  private renderTurnButton() {
    const active = this.state.activePlayer === "player" && !this.state.winner;
    const button = this.add
      .rectangle(TURN_BUTTON_X, TURN_BUTTON_Y, 150, 48, active ? 0x594b34 : 0x3b3333, 0.94)
      .setStrokeStyle(2, active ? 0xd6bd7a : 0x7d6262, 0.95)
      .setDepth(800);
    this.add
      .text(TURN_BUTTON_X, TURN_BUTTON_Y, active ? "END TURN" : "OPPONENT", {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: active ? "#f2dfb5" : "#c89595",
      })
      .setOrigin(0.5)
      .setDepth(801);
    this.add
      .text(TURN_BUTTON_X, TURN_BUTTON_Y - 38, `Turn ${this.state.turnNumber} • ${this.state.phase}`, {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#aaa69f",
      })
      .setOrigin(0.5)
      .setDepth(801);

    if (active) {
      button.setInteractive({ useHandCursor: true });
      button.on("pointerdown", () => this.finishPlayerTurn());
    }
  }

  private onHandCardClick(instanceId: string) {
    if (!this.isPlayerActionTime()) return;
    if (this.pendingTarget) this.cancelPending();

    const card = this.state.players.player.hand.find((candidate) => candidate.instanceId === instanceId);
    if (!card) return;
    const def = CARD_DEFINITIONS[card.defId];
    const playability = getHandCardPlayability(this.state, "player", instanceId);
    if (!playability.playable) {
      this.setStatus(playability.reason ?? `${def.name} cannot be played right now.`);
      return;
    }

    const instant =
      (def.archetype === "spell" && def.spellForm === "instant") ||
      (def.archetype === "ability" && def.abilityForm === "instant");

    if (instant && (def.archetype === "spell" || def.archetype === "ability")) {
      if (this.needsTarget(def.effect) && effectHasLegalTarget(this.state, def.effect, def.archetype)) {
        this.selectedHandId = instanceId;
        this.pendingTarget = {
          kind: "play",
          instanceId,
          options: {},
          effect: def.effect,
          sourceArchetype: def.archetype,
        };
        this.statusMessage = `Choose a target for ${def.name}.`;
        this.renderScene();
      } else {
        this.resolveResult(playCardFromHand(this.state, "player", instanceId), `${def.name} cast.`);
      }
      return;
    }

    this.selectedHandId = this.selectedHandId === instanceId ? null : instanceId;
    this.selectedAttacker = null;
    this.selectedEquipmentSlot = null;
    this.statusMessage = this.selectedHandId ? `Choose a valid slot for ${def.name}.` : "";
    this.renderScene();
  }

  private onSlotClick(slot: SlotRef) {
    if (!this.isPlayerActionTime()) return;

    if (this.pendingTarget && effectTargetCategory(this.pendingTarget.effect) === "targetRow" && slot.owner === "opponent") {
      if (slot.kind === "vanguard" || slot.kind === "support") {
        this.resolvePendingTarget({ kind: "row", owner: "opponent", row: slot.kind });
      }
      return;
    }

    if (slot.owner !== "player" || !this.selectedHandId) return;
    if (this.slotIsOccupied(slot)) {
      this.setStatus("That slot is already occupied.");
      return;
    }

    const card = this.state.players.player.hand.find((candidate) => candidate.instanceId === this.selectedHandId);
    if (!card) return;
    const def = CARD_DEFINITIONS[card.defId];

    if (def.archetype === "creature" && (slot.kind === "vanguard" || slot.kind === "support")) {
      this.preparePlacement(card, { row: slot.kind, slotIndex: slot.index }, slot);
      return;
    }
    if (def.archetype === "building" && slot.kind === "building") {
      this.preparePlacement(card, { slotIndex: slot.index }, slot);
      return;
    }
    if (def.archetype === "equipment" && slot.kind === "equipment") {
      this.resolveResult(playCardFromHand(this.state, "player", card.instanceId, { slotIndex: slot.index }), `${def.name} entered Equipment slot ${slot.index + 1} Unassigned.`);
      return;
    }
    if ((def.archetype === "spell" || def.archetype === "ability") && slot.kind === "spell") {
      this.resolveResult(playCardFromHand(this.state, "player", card.instanceId, { slotIndex: slot.index }), `${def.name} entered Spell/Ability slot ${slot.index + 1}.`);
      return;
    }

    this.setStatus(`${def.name} cannot be played into that slot.`);
  }

  private preparePlacement(card: CardInstance, options: PlayCardOptions, slot: SlotRef) {
    const def = CARD_DEFINITIONS[card.defId];
    const trigger = def.archetype === "creature" || def.archetype === "building"
      ? def.triggers.find((candidate) => candidate.on === "onPlay")
      : undefined;

    if (trigger && this.needsTarget(trigger.effect) && effectHasLegalTarget(this.state, trigger.effect, undefined)) {
      this.pendingTarget = {
        kind: "play",
        instanceId: card.instanceId,
        options,
        effect: trigger.effect,
        ghost: { x: slot.rect.x, y: slot.rect.y, width: SLOT_WIDTH, height: SLOT_HEIGHT, defId: card.defId },
      };
      this.selectedHandId = null;
      this.statusMessage = `${def.name} placement chosen. Now choose its On Play target.`;
      this.renderScene();
      return;
    }

    this.resolveResult(playCardFromHand(this.state, "player", card.instanceId, options), `${def.name} played.`);
  }

  private handleHandDrop(instanceId: string, x: number, y: number) {
    if (!this.isPlayerActionTime()) return false;
    const card = this.state.players.player.hand.find((candidate) => candidate.instanceId === instanceId);
    if (!card) return false;
    const def = CARD_DEFINITIONS[card.defId];
    const playability = getHandCardPlayability(this.state, "player", instanceId);
    if (!playability.playable) {
      this.setStatus(playability.reason ?? `${def.name} cannot be played right now.`);
      return true;
    }

    const matching = this.playerSlots.find((slot) => {
      if (this.slotIsOccupied(slot) || !Phaser.Geom.Rectangle.Contains(slot.rect.getBounds(), x, y)) return false;
      if (def.archetype === "creature") return slot.kind === "vanguard" || slot.kind === "support";
      if (def.archetype === "building") return slot.kind === "building";
      if (def.archetype === "equipment") return slot.kind === "equipment";
      if (def.archetype === "spell" || def.archetype === "ability") return slot.kind === "spell";
      return false;
    });
    if (!matching) return false;
    this.selectedHandId = instanceId;
    this.onSlotClick(matching);
    return true;
  }

  private onBoardCardClick(owner: PlayerId, card: CardInstance, row: BoardRow | "buildings") {
    if (this.pendingTarget) {
      if (effectTargetCategory(this.pendingTarget.effect) === "targetRow" && owner === "opponent" && row !== "buildings") {
        this.resolvePendingTarget({ kind: "row", owner, row });
        return;
      }
      const side = row === "buildings" ? "building" : "creature";
      if (isEffectTargetable(this.pendingTarget.effect, side, owner, card, this.pendingTarget.sourceArchetype)) {
        this.resolvePendingTarget({ kind: "card", owner, instanceId: card.instanceId });
      }
      return;
    }

    if (owner === "player" && this.selectedEquipmentSlot !== null && row !== "buildings") {
      const result = assignEquipment(this.state, "player", this.selectedEquipmentSlot, { kind: "creature", instanceId: card.instanceId });
      this.resolveResult(result, `Equipment assigned to ${CARD_DEFINITIONS[card.defId].name}.`);
      return;
    }

    if (owner === "player" && card.archetype === "creature") {
      this.selectAttacker(card.instanceId);
      return;
    }

    if (owner === "player" && row === "buildings") {
      const index = this.state.players.player.board.buildings.findIndex((candidate) => candidate?.instanceId === card.instanceId);
      if (index >= 0) this.beginBuildingAbility(index, card);
      return;
    }

    if (owner === "opponent" && this.selectedAttacker) {
      const target: AttackTarget = row === "buildings"
        ? { type: "building", instanceId: card.instanceId }
        : { type: "creature", instanceId: card.instanceId };
      this.resolveAttack(target);
    }
  }

  private onHeroClick(owner: PlayerId) {
    if (this.pendingTarget) {
      if (isEffectTargetable(this.pendingTarget.effect, "portrait", owner, undefined, this.pendingTarget.sourceArchetype)) {
        this.resolvePendingTarget({ kind: "player", owner });
      }
      return;
    }

    if (owner === "player" && this.selectedEquipmentSlot !== null) {
      this.resolveResult(assignEquipment(this.state, "player", this.selectedEquipmentSlot, { kind: "hero" }), "Equipment assigned to your Hero.");
      return;
    }

    if (owner === "player") {
      this.selectAttacker("hero");
      return;
    }

    if (owner === "opponent" && this.selectedAttacker) {
      this.resolveAttack({ type: "player" });
    }
  }

  private selectAttacker(attackerId: string | "hero") {
    if (!this.isPlayerActionTime()) return;
    const targets = this.legalAttackTargets(attackerId);
    if (targets.length === 0) {
      const reason = attackerId === "hero" && !heroCanAttack(this.state, "player")
        ? "Hero cannot attack right now (a Weapon must be assigned, and it must not already be exhausted/frozen)."
        : "This creature has no legal attack right now (summoning sickness, row/reach, Taunt or exhaustion may be blocking it).";
      this.setStatus(reason);
      return;
    }
    this.selectedAttacker = this.selectedAttacker === attackerId ? null : attackerId;
    this.selectedHandId = null;
    this.selectedEquipmentSlot = null;
    this.statusMessage = this.selectedAttacker ? "Choose a highlighted legal attack target." : "";
    this.renderScene();
  }

  private legalAttackTargets(attackerId: string | "hero") {
    const targets: AttackTarget[] = [];
    const seen = new Set<string>();
    const enemyBoard = this.state.players.opponent.board;

    for (const card of [...enemyBoard.vanguard, ...enemyBoard.support]) {
      if (card && !seen.has(card.instanceId)) {
        seen.add(card.instanceId);
        const target: AttackTarget = { type: "creature", instanceId: card.instanceId };
        if (canAttack(this.state, "player", attackerId, target)) targets.push(target);
      }
    }
    for (const card of enemyBoard.buildings) {
      if (card && !seen.has(card.instanceId)) {
        seen.add(card.instanceId);
        const target: AttackTarget = { type: "building", instanceId: card.instanceId };
        if (canAttack(this.state, "player", attackerId, target)) targets.push(target);
      }
    }
    const playerTarget: AttackTarget = { type: "player" };
    if (canAttack(this.state, "player", attackerId, playerTarget)) targets.push(playerTarget);
    return targets;
  }

  private resolveAttack(target: AttackTarget) {
    const attacker = this.selectedAttacker;
    if (!attacker) return;
    if (!canAttack(this.state, "player", attacker, target)) {
      this.setStatus("The engine rejected that attack target.");
      return;
    }

    const result = attacker === "hero"
      ? declareHeroAttack(this.state, "player", target)
      : declareCreatureAttack(this.state, "player", attacker, target);
    this.selectedAttacker = null;
    this.resolveResult(result, "Attack resolved by the real combat engine.");
  }

  private onEquipmentClick(owner: PlayerId, slotIndex: number) {
    if (owner !== "player" || !this.isPlayerActionTime()) return;
    const card = this.state.players.player.board.equipment[slotIndex];
    if (!card) return;
    this.selectedEquipmentSlot = this.selectedEquipmentSlot === slotIndex ? null : slotIndex;
    this.selectedHandId = null;
    this.selectedAttacker = null;
    this.statusMessage = this.selectedEquipmentSlot === null
      ? ""
      : "Equipment selected. Choose your Hero or an Armiger creature (assignment costs 1 Energy).";
    this.renderScene();
  }

  private onSpellSlotClick(owner: PlayerId, slotIndex: number) {
    if (owner !== "player" || !this.isPlayerActionTime()) return;
    const card = this.state.players.player.board.spellAbilitySlots[slotIndex];
    if (!card) return;
    const def = CARD_DEFINITIONS[card.defId];
    if (def.archetype !== "spell" && def.archetype !== "ability") return;

    if (this.needsTarget(def.effect) && effectHasLegalTarget(this.state, def.effect, def.archetype)) {
      const ref = this.boardRefs.get(card.instanceId);
      this.pendingTarget = {
        kind: "activate",
        slotIndex,
        effect: def.effect,
        sourceArchetype: def.archetype,
        source: { x: ref?.x ?? SPELL_X, y: ref?.y ?? PLAYER_HERO_Y },
      };
      this.statusMessage = `Choose a target to activate ${def.name}.`;
      this.renderScene();
    } else {
      this.resolveResult(activateSlotCard(this.state, "player", slotIndex), `${def.name} activated.`);
    }
  }

  private beginBuildingAbility(slotIndex: number, card: CardInstance) {
    if (!this.isPlayerActionTime()) return;
    const def = CARD_DEFINITIONS[card.defId] as BuildingDefinition;
    if (!def.ability) {
      this.setStatus(`${def.name} has no activated ability.`);
      return;
    }
    if (this.needsTarget(def.ability.effect) && effectHasLegalTarget(this.state, def.ability.effect, undefined)) {
      const ref = this.boardRefs.get(card.instanceId);
      this.pendingTarget = {
        kind: "building",
        slotIndex,
        effect: def.ability.effect,
        source: { x: ref?.x ?? FIELD_CENTER_X, y: ref?.y ?? ROWS.playerBuildings },
      };
      this.statusMessage = `Choose a target for ${def.name}.`;
      this.renderScene();
    } else {
      this.resolveResult(activateBuildingAbility(this.state, "player", slotIndex), `${def.name}'s ability activated.`);
    }
  }

  private beginHeroAbility(kind: "heroPower" | "signature") {
    if (!this.isPlayerActionTime()) return;
    const heroDef = CARD_DEFINITIONS[this.state.players.player.hero.defId] as HeroCardDefinition;
    const ability = kind === "heroPower" ? heroDef.heroPower : heroDef.signature;
    if (!ability) return;
    const source = { x: HERO_X + 100, y: PLAYER_HERO_Y + (kind === "heroPower" ? 34 : -34) };

    if (this.needsTarget(ability.effect) && effectHasLegalTarget(this.state, ability.effect, undefined)) {
      this.pendingTarget = { kind, effect: ability.effect, source };
      this.statusMessage = `Choose a target for ${kind === "heroPower" ? "Hero Power" : "Signature Ability"}.`;
      this.renderScene();
    } else {
      const result = kind === "heroPower"
        ? activateHeroPower(this.state, "player")
        : activateHeroSignature(this.state, "player");
      this.resolveResult(result, `${kind === "heroPower" ? "Hero Power" : "Signature Ability"} activated.`);
    }
  }

  private resolvePendingTarget(target: EffectTargetRef) {
    const pending = this.pendingTarget;
    if (!pending) return;

    let result: { ok: boolean; reason?: string };
    if (pending.kind === "play") {
      result = playCardFromHand(this.state, "player", pending.instanceId, { ...pending.options, target });
    } else if (pending.kind === "activate") {
      result = activateSlotCard(this.state, "player", pending.slotIndex, target);
    } else if (pending.kind === "building") {
      result = activateBuildingAbility(this.state, "player", pending.slotIndex, target);
    } else if (pending.kind === "heroPower") {
      result = activateHeroPower(this.state, "player", target);
    } else {
      result = activateHeroSignature(this.state, "player", target);
    }

    this.pendingTarget = null;
    this.selectedHandId = null;
    this.resolveResult(result, "Targeted effect resolved by the engine.");
  }

  private needsTarget(effect: CardEffect) {
    return effectNeedsExplicitTarget(effect) || effectTargetCategory(effect) === "targetRow";
  }

  private finishPlayerTurn() {
    if (!this.isPlayerActionTime()) return;
    this.cancelPending();
    const logStart = this.state.log.length;
    endTurn(this.state);
    if (!this.state.winner && this.state.activePlayer === "opponent") {
      runAiTurn(this.state);
    }
    this.statusMessage = "Opponent turn resolved using Claude's existing AI and engine rules.";
    this.renderScene();
    this.animateRecentBurns(logStart);
  }

  private isPlayerActionTime() {
    return !this.state.winner && this.state.activePlayer === "player";
  }

  private resolveResult(result: { ok: boolean; reason?: string }, success: string) {
    this.cancelPending();
    this.statusMessage = result.ok ? success : result.reason ?? "Action rejected by the engine.";
    this.renderScene();
  }

  private cancelPending() {
    this.selectedHandId = null;
    this.selectedAttacker = null;
    this.selectedEquipmentSlot = null;
    this.pendingTarget = null;
    this.hoveredHandId = null;
    this.hideTooltip();
  }

  private setStatus(message: string) {
    this.statusMessage = message;
    this.renderScene();
  }

  private renderPendingGhost() {
    const ghost = this.pendingTarget?.kind === "play" ? this.pendingTarget.ghost : undefined;
    if (!ghost) return;
    const def = CARD_DEFINITIONS[ghost.defId];
    createPhaserCardFace(this, def, {
      width: (ghost.height * 2) / 3,
      height: ghost.height,
      selected: true,
      badge: "CHOOSE TARGET",
    }).setPosition(ghost.x, ghost.y).setAlpha(0.82).setDepth(1600);
  }

  private drawTargetingArrow() {
    if (!this.arrow) return;
    this.arrow.clear();
    const source = this.selectionSource();
    if (!source) return;

    const pointer = this.input.activePointer;
    const snap = this.arrowTargetAt(pointer.worldX, pointer.worldY);
    const endX = snap?.x ?? pointer.worldX;
    const endY = snap?.y ?? pointer.worldY;
    const color = snap?.valid ? 0x8be38b : 0xe3c76c;
    const angle = Math.atan2(endY - source.y, endX - source.x);
    const head = 20;

    this.arrow.lineStyle(5, color, 0.92);
    this.arrow.beginPath();
    this.arrow.moveTo(source.x, source.y);
    this.arrow.lineTo(endX, endY);
    this.arrow.strokePath();
    this.arrow.beginPath();
    this.arrow.moveTo(endX, endY);
    this.arrow.lineTo(endX - Math.cos(angle - Math.PI / 6) * head, endY - Math.sin(angle - Math.PI / 6) * head);
    this.arrow.moveTo(endX, endY);
    this.arrow.lineTo(endX - Math.cos(angle + Math.PI / 6) * head, endY - Math.sin(angle + Math.PI / 6) * head);
    this.arrow.strokePath();
  }

  private selectionSource(): Point | null {
    if (this.pendingTarget) {
      if (this.pendingTarget.kind === "play") {
        if (this.pendingTarget.ghost) return { x: this.pendingTarget.ghost.x, y: this.pendingTarget.ghost.y };
        const view = this.handViews.get(this.pendingTarget.instanceId);
        if (view) return { x: view.x, y: view.y - CARD_HEIGHT * view.scaleY * 0.4 };
      } else {
        return this.pendingTarget.source;
      }
    }
    if (this.selectedAttacker) {
      if (this.selectedAttacker === "hero") return { x: HERO_X, y: PLAYER_HERO_Y };
      const ref = this.boardRefs.get(this.selectedAttacker);
      if (ref) return { x: ref.x, y: ref.y };
    }
    if (this.selectedEquipmentSlot !== null) {
      const spacing = 96;
      const y = PLAYER_HERO_Y - (spacing * 3) / 2 + this.selectedEquipmentSlot * spacing;
      return { x: EQUIPMENT_X, y };
    }
    if (this.selectedHandId) {
      const view = this.handViews.get(this.selectedHandId);
      if (view) return { x: view.x, y: view.y - CARD_HEIGHT * view.scaleY * 0.4 };
    }
    return null;
  }

  private arrowTargetAt(x: number, y: number): { x: number; y: number; valid: boolean } | null {
    if (this.pendingTarget) {
      if (effectTargetCategory(this.pendingTarget.effect) === "targetRow") {
        const slot = this.enemySlots.find((candidate) => (candidate.kind === "vanguard" || candidate.kind === "support") && Phaser.Geom.Rectangle.Contains(candidate.rect.getBounds(), x, y));
        return slot ? { x: slot.rect.x, y: slot.rect.y, valid: true } : null;
      }
      for (const ref of this.boardRefs.values()) {
        const card = this.findInstance(ref.owner, ref.instanceId);
        if (!card) continue;
        const bounds = new Phaser.Geom.Rectangle(ref.x - CARD_WIDTH / 2, ref.y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
        if (!Phaser.Geom.Rectangle.Contains(bounds, x, y)) continue;
        const side = ref.row === "buildings" ? "building" : "creature";
        const valid = isEffectTargetable(this.pendingTarget.effect, side, ref.owner, card, this.pendingTarget.sourceArchetype);
        return { x: ref.x, y: ref.y, valid };
      }
      const heroOwner = this.heroAt(x, y);
      if (heroOwner) {
        const hy = heroOwner === "player" ? PLAYER_HERO_Y : ENEMY_HERO_Y;
        const valid = isEffectTargetable(this.pendingTarget.effect, "portrait", heroOwner, undefined, this.pendingTarget.sourceArchetype);
        return { x: HERO_X, y: hy, valid };
      }
      return null;
    }

    if (this.selectedAttacker) {
      for (const ref of this.boardRefs.values()) {
        if (ref.owner !== "opponent" || (ref.archetype !== "creature" && ref.archetype !== "building")) continue;
        const bounds = new Phaser.Geom.Rectangle(ref.x - CARD_WIDTH / 2, ref.y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
        if (!Phaser.Geom.Rectangle.Contains(bounds, x, y)) continue;
        const target: AttackTarget = ref.archetype === "building"
          ? { type: "building", instanceId: ref.instanceId }
          : { type: "creature", instanceId: ref.instanceId };
        return { x: ref.x, y: ref.y, valid: canAttack(this.state, "player", this.selectedAttacker, target) };
      }
      if (this.heroAt(x, y) === "opponent") {
        return { x: HERO_X, y: ENEMY_HERO_Y, valid: canAttack(this.state, "player", this.selectedAttacker, { type: "player" }) };
      }
      return null;
    }

    if (this.selectedEquipmentSlot !== null) {
      if (this.heroAt(x, y) === "player") return { x: HERO_X, y: PLAYER_HERO_Y, valid: true };
      for (const ref of this.boardRefs.values()) {
        if (ref.owner !== "player" || ref.archetype !== "creature") continue;
        const bounds = new Phaser.Geom.Rectangle(ref.x - CARD_WIDTH / 2, ref.y - CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
        if (Phaser.Geom.Rectangle.Contains(bounds, x, y)) return { x: ref.x, y: ref.y, valid: true };
      }
      return null;
    }

    if (this.selectedHandId) {
      const card = this.state.players.player.hand.find((candidate) => candidate.instanceId === this.selectedHandId);
      if (!card) return null;
      const def = CARD_DEFINITIONS[card.defId];
      const slot = this.playerSlots.find((candidate) => {
        if (this.slotIsOccupied(candidate) || !Phaser.Geom.Rectangle.Contains(candidate.rect.getBounds(), x, y)) return false;
        if (def.archetype === "creature") return candidate.kind === "vanguard" || candidate.kind === "support";
        if (def.archetype === "building") return candidate.kind === "building";
        if (def.archetype === "equipment") return candidate.kind === "equipment";
        if (def.archetype === "spell" || def.archetype === "ability") return candidate.kind === "spell";
        return false;
      });
      return slot ? { x: slot.rect.x, y: slot.rect.y, valid: true } : null;
    }

    return null;
  }

  private slotIsOccupied(slot: SlotRef) {
    const board = this.state.players[slot.owner].board;
    if (slot.kind === "vanguard") return board.vanguard[slot.index] !== null;
    if (slot.kind === "support") return board.support[slot.index] !== null;
    if (slot.kind === "building") return board.buildings[slot.index] !== null;
    if (slot.kind === "equipment") return board.equipment[slot.index] !== null;
    return board.spellAbilitySlots[slot.index] !== null;
  }

  private heroAt(x: number, y: number): PlayerId | null {
    const playerBounds = new Phaser.Geom.Rectangle(HERO_X - HERO_WIDTH / 2, PLAYER_HERO_Y - HERO_HEIGHT / 2, HERO_WIDTH, HERO_HEIGHT);
    const enemyBounds = new Phaser.Geom.Rectangle(HERO_X - HERO_WIDTH / 2, ENEMY_HERO_Y - HERO_HEIGHT / 2, HERO_WIDTH, HERO_HEIGHT);
    if (Phaser.Geom.Rectangle.Contains(playerBounds, x, y)) return "player";
    if (Phaser.Geom.Rectangle.Contains(enemyBounds, x, y)) return "opponent";
    return null;
  }

  private findInstance(owner: PlayerId, instanceId: string) {
    const player = this.state.players[owner];
    return [
      ...player.board.vanguard,
      ...player.board.support,
      ...player.board.buildings,
      ...player.board.equipment,
      ...player.board.spellAbilitySlots,
    ].find((card) => card?.instanceId === instanceId) ?? null;
  }

  private showCardTooltip(card: CardInstance, x: number, y: number, restriction?: string) {
    const def = CARD_DEFINITIONS[card.defId];
    const text = def.text ?? this.effectTextFromDefinition(def);
    const body = [text || "No rules text.", restriction ? `Cannot play: ${restriction}` : ""].filter(Boolean).join("\n\n");
    this.showTooltip(x, y, def.name, body);
  }

  private showHeroTooltip(owner: PlayerId, x: number, y: number) {
    const hero = this.state.players[owner].hero;
    const def = CARD_DEFINITIONS[hero.defId] as HeroCardDefinition;
    this.showTooltip(x, y, def.name, `${def.class.toUpperCase()} Hero\nAttack ${getHeroAttack(this.state, owner)} • HP ${hero.currentHp}/${hero.maxHp}`);
  }

  private hoverPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    title: string,
    body: string,
    onClick?: () => void,
  ) {
    const panel = this.add.rectangle(x, y, width, height, color, 0.2).setStrokeStyle(2, color, 0.95).setInteractive({ useHandCursor: Boolean(onClick) }).setDepth(610);
    this.add.text(x, y, label, { align: "center", fontFamily: "Arial", fontSize: "10px", color: "#e0d8ce", wordWrap: { width: width - 8 } }).setOrigin(0.5).setDepth(611);
    panel.on("pointerover", () => {
      panel.setFillStyle(color, 0.36).setStrokeStyle(3, color, 1);
      this.showTooltip(x + 165, y, title, body);
    });
    panel.on("pointerout", () => {
      panel.setFillStyle(color, 0.2).setStrokeStyle(2, color, 0.95);
      this.hideTooltip();
    });
    if (onClick) panel.on("pointerdown", onClick);
  }

  private showTooltip(x: number, y: number, titleText: string, bodyText: string) {
    this.hideTooltip();
    const safeX = Phaser.Math.Clamp(x, 160, 1760);
    const safeY = Phaser.Math.Clamp(y, 90, 990);
    const bg = this.add.rectangle(0, 0, 300, 112, 0x111111, 0.97).setStrokeStyle(2, 0xd0b77a, 0.95);
    const title = this.add.text(-136, -44, titleText, { fontFamily: "Georgia", fontSize: "15px", color: "#f2dfb5" }).setOrigin(0, 0.5);
    const body = this.add.text(-136, -19, bodyText, { fontFamily: "Arial", fontSize: "11px", color: "#d0d0d0", wordWrap: { width: 270 } }).setOrigin(0, 0);
    this.tooltip = this.add.container(safeX, safeY, [bg, title, body]).setDepth(9000);
  }

  private hideTooltip() {
    this.tooltip?.destroy(true);
    this.tooltip = null;
  }

  private effectTextFromDefinition(def: CardDefinition) {
    if (def.archetype === "spell" || def.archetype === "ability") return this.effectSummary(def.effect);
    if (def.archetype === "building" && def.ability) return def.ability.text ?? this.effectSummary(def.ability.effect);
    if (def.archetype === "equipment") return `${def.category}: +${def.attackBonus} Attack, ${def.damageReduction} damage reduction.`;
    return "";
  }

  private effectSummary(effect: CardEffect): string {
    switch (effect.kind) {
      case "damage": return `Deal ${effect.amount} damage (${effect.target}).`;
      case "heal": return `Heal ${effect.amount} (${effect.target}).`;
      case "applyStatus": return `Apply ${effect.status} ${effect.amount}${effect.duration ? ` for ${effect.duration} turns` : ""} (${effect.target}).`;
      case "buff": return `Buff ${effect.attackDelta ?? 0} Attack / ${effect.hpDelta ?? 0} Health (${effect.target}).`;
      case "drawCard": return `Draw ${effect.amount} card(s).`;
      case "drawCreature": return `Draw ${effect.amount} creature(s).`;
      case "gainGuard": return `Gain ${effect.amount} Guard.`;
      case "gainCap": return `Gain ${effect.amount} ${effect.pool} cap.`;
      case "gainIncome": return `Gain ${effect.amount} Resource income.`;
      case "summonCreature": return `Summon ${effect.count ?? 1} ${effect.creatureId}.`;
      case "consume": return "Consume an allied creature.";
      case "transform": return `Transform a creature into ${effect.creatureId}.`;
      case "garrison": return "Garrison an allied creature.";
      case "devour": return "Devour a target creature.";
      case "multi": return effect.effects.map((subEffect) => this.effectSummary(subEffect)).join(" ");
    }
  }

  private animateRecentBurns(logStart: number) {
    const burns = this.state.log.slice(logStart).filter((line) => line.includes("burned and destroyed"));
    if (burns.length === 0) return;
    const card = this.add
      .rectangle(DECK_X, PLAYER_DECK_Y - 120, CARD_WIDTH, CARD_HEIGHT, 0x33231e, 0.95)
      .setStrokeStyle(5, 0xffa347, 1)
      .setDepth(8500);
    this.tweens.add({
      targets: card,
      y: PLAYER_DECK_Y - 230,
      alpha: 0,
      scaleX: 0.55,
      scaleY: 0.55,
      angle: Phaser.Math.Between(-12, 12),
      duration: 950,
      ease: "Quad.easeIn",
      onComplete: () => card.destroy(),
    });
  }
}
