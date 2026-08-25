import Phaser from "phaser";
import {
  CARD_BASE_ASSETS,
  LOCAL_CARD_BASE_FALLBACK,
  getRuntimeCardPresentation,
  resourceIconUrl,
  type CardBaseKey,
  type ResourceKind,
} from "../card-rendering/presentation";
import { CARD_DEFINITIONS } from "../data/cards";
import type { CardDefinition, CreatureDefinition } from "../engine/types";

const DESIGN_WIDTH = 384;

function artTextureKey(defId: string): string {
  return `card-face-art:${defId}`;
}

function baseTextureKey(baseKey: Exclude<CardBaseKey, "">): string {
  return `card-face-base:${baseKey}`;
}

function resourceTextureKey(kind: ResourceKind, defId?: string): string {
  return defId ? `card-face-resource:${defId}` : `card-face-resource:${kind}`;
}

export function preloadCardFaceAssets(scene: Phaser.Scene): void {
  scene.load.image("card-face-base:fallback", LOCAL_CARD_BASE_FALLBACK);
  for (const [baseKey, asset] of Object.entries(CARD_BASE_ASSETS)) {
    scene.load.image(baseTextureKey(baseKey as Exclude<CardBaseKey, "">), asset.url);
  }
  for (const kind of ["energy", "mana", "resource"] as const) {
    scene.load.image(resourceTextureKey(kind), resourceIconUrl(kind));
  }

  for (const def of Object.values(CARD_DEFINITIONS)) {
    if (def.archetype === "hero") continue;
    const runtime = getRuntimeCardPresentation(def);
    if (runtime.art) scene.load.image(artTextureKey(def.id), runtime.art);
    if (runtime.presentation.resourceIcon) {
      scene.load.image(resourceTextureKey(runtime.playPool, def.id), runtime.presentation.resourceIcon);
    }
  }
}

interface FaceOptions {
  width: number;
  height: number;
  attack?: number | null;
  health?: number | null;
  playable?: boolean;
  selected?: boolean;
  badge?: string;
}

function effectDamage(def: CardDefinition): number | null {
  if (def.archetype !== "spell" && def.archetype !== "ability") return null;
  if (def.effect.kind === "damage") return def.effect.amount;
  if (def.effect.kind === "multi") {
    const damage = def.effect.effects.find((effect) => effect.kind === "damage");
    return damage?.kind === "damage" ? damage.amount : null;
  }
  return null;
}

function elementCenter(
  width: number,
  height: number,
  left: number,
  top: number,
  elementWidth: number,
  elementHeight: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  return {
    x: -width / 2 + ((left + elementWidth / 2) / 100) * width + (offsetX / 100) * ((elementWidth / 100) * width),
    y: -height / 2 + ((top + elementHeight / 2) / 100) * height + (offsetY / 100) * ((elementHeight / 100) * height),
  };
}

function addCenteredText(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  value: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  fontFamily: string,
  color: string,
  depth = 20,
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, value, {
    align: "center",
    color,
    fontFamily,
    fontSize: `${Math.max(4, fontSize)}px`,
    fontStyle: "bold",
    wordWrap: { width, useAdvancedWrap: true },
    stroke: "#000000",
    strokeThickness: Math.max(1, fontSize * 0.08),
  }).setOrigin(0.5).setDepth(depth);
  container.add(text);
  return text;
}

/** Builds the same art/frame/text stack as the Card Builder inside Phaser. */
export function createPhaserCardFace(
  scene: Phaser.Scene,
  def: CardDefinition,
  options: FaceOptions,
): Phaser.GameObjects.Container {
  const { width, height } = options;
  const runtime = getRuntimeCardPresentation(def);
  const presentation = runtime.presentation;
  const scale = width / DESIGN_WIDTH;
  const container = scene.add.container(0, 0);
  const playable = options.playable ?? true;

  const outlineColor = options.selected ? 0xf0d270 : playable ? 0x63d88a : 0x8a4444;
  const outlineAlpha = options.selected || options.playable !== undefined ? 0.95 : 0.35;
  container.add(
    scene.add.rectangle(0, 0, width + 4, height + 4, 0x171717, 0.001)
      .setStrokeStyle(options.selected ? 4 : 2, outlineColor, outlineAlpha),
  );

  const artWidth = width * 0.872;
  const artHeight = height * 0.585;
  const artX = -width / 2 + width * (0.064 + 0.872 / 2) + (presentation.artX / 100) * artWidth;
  const artY = -height / 2 + height * (0.128 + 0.585 / 2) + (presentation.artY / 100) * artHeight;
  const artKey = artTextureKey(def.id);
  if (scene.textures.exists(artKey)) {
    const art = scene.add.image(artX, artY, artKey)
      .setDisplaySize(artWidth * presentation.artScale, artHeight * presentation.artScale);
    const maskShape = scene.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff).fillRect(
      -width / 2 + width * 0.064,
      -height / 2 + height * 0.128,
      artWidth,
      artHeight,
    );
    container.add(maskShape);
    art.setMask(maskShape.createGeometryMask());
    container.add(art);
  }

  const baseKey = presentation.baseKey ? baseTextureKey(presentation.baseKey) : "card-face-base:fallback";
  const resolvedBaseKey = scene.textures.exists(baseKey) ? baseKey : "card-face-base:fallback";
  if (scene.textures.exists(resolvedBaseKey)) {
    const base = scene.add.image(0, 0, resolvedBaseKey).setDisplaySize(width, height).setDepth(10);
    container.add(base);
    if (resolvedBaseKey === "card-face-base:fallback") container.sendToBack(base);
  }

  const namePosition = elementCenter(width, height, 8, 4.15, 64, 6.5, presentation.layout.nameX, presentation.layout.nameY);
  addCenteredText(
    scene,
    container,
    def.name,
    namePosition.x,
    namePosition.y,
    width * 0.64,
    presentation.nameSize * scale,
    presentation.titleFont,
    "#e6d4b4",
  );

  const costPosition = elementCenter(width, height, 74.1, 4.05, 15.5, 10.4, presentation.layout.costX, presentation.layout.costY);
  addCenteredText(
    scene,
    container,
    String(def.cost),
    costPosition.x,
    costPosition.y,
    width * 0.155,
    presentation.costSize * scale,
    presentation.titleFont,
    playable ? "#f0dfbd" : "#ff4f4f",
  );

  const resourcePosition = elementCenter(width, height, 88.1, 4.05, 10.2, 9.2, presentation.layout.resourceX, presentation.layout.resourceY);
  const customResourceKey = resourceTextureKey(runtime.playPool, def.id);
  const resourceKey = scene.textures.exists(customResourceKey) ? customResourceKey : resourceTextureKey(runtime.playPool);
  if (scene.textures.exists(resourceKey)) {
    const icon = scene.add.image(resourcePosition.x, resourcePosition.y, resourceKey)
      .setDisplaySize(width * 0.072, width * 0.072)
      .setDepth(20);
    if (!playable) icon.setTint(0xff5555);
    container.add(icon);
  }

  const categoriesPosition = elementCenter(width, height, 8.5, 70.65, 83, 3.5, presentation.layout.categoriesX, presentation.layout.categoriesY);
  addCenteredText(
    scene,
    container,
    presentation.categories.filter(Boolean).join(" • "),
    categoriesPosition.x,
    categoriesPosition.y,
    width * 0.83,
    presentation.categorySize * scale,
    presentation.titleFont,
    "#d8c7aa",
  );

  const rulesPosition = elementCenter(width, height, 10, 76.3, 80, 15.5, presentation.layout.rulesX, presentation.layout.rulesY);
  addCenteredText(
    scene,
    container,
    def.text ?? "",
    rulesPosition.x,
    rulesPosition.y,
    width * 0.78,
    presentation.rulesSize * scale,
    presentation.bodyFont,
    "#2d2118",
  ).setStroke("#000000", 0);

  const printedAttack = def.archetype === "creature"
    ? options.attack ?? (def as CreatureDefinition).attack
    : null;
  const printedHealth = def.archetype === "creature" || def.archetype === "building"
    ? options.health ?? def.hp
    : null;
  const damage = effectDamage(def);
  const statSize = presentation.statSize * scale;

  if (printedAttack !== null) {
    const position = elementCenter(width, height, 1.6, 88.5, 14, 9.4, presentation.layout.attackX, presentation.layout.attackY);
    addCenteredText(scene, container, String(printedAttack), position.x, position.y, width * 0.14, statSize, presentation.titleFont, "#eee4cf");
  }
  if (printedHealth !== null || (def.archetype === "spell" && damage !== null)) {
    const position = elementCenter(width, height, 84.3, 88.5, 14, 9.4, presentation.layout.healthX, presentation.layout.healthY);
    addCenteredText(
      scene,
      container,
      String(printedHealth ?? damage),
      position.x,
      position.y,
      width * 0.14,
      statSize,
      presentation.titleFont,
      "#eee4cf",
    );
  }

  if (options.badge) {
    const badge = scene.add.text(0, -height / 2 + 7, options.badge, {
      align: "center",
      backgroundColor: "#111111dd",
      color: "#f4ead6",
      fontFamily: "Arial, sans-serif",
      fontSize: `${Math.max(5, width * 0.075)}px`,
      padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 0).setDepth(30);
    container.add(badge);
  }

  if (!playable) container.setAlpha(0.58);
  container.setSize(width, height);
  return container;
}
