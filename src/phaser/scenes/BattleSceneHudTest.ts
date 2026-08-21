import Phaser from "phaser";
import { BattleScene } from "./BattleScene";

const HERO_X = 365;
const ENEMY_HERO_Y = 245;
const PLAYER_HERO_Y = 795;
const SIGNATURE_X = 465;
const EQUIPMENT_COLOR = 0xb38bc7;

type TooltipSpec = {
  title: string;
  body: string;
};

type SandboxCard = {
  data: {
    name: string;
    kind: "creature" | "equipment" | "spell";
    cost: number;
  };
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  zone: string;
  dragging: boolean;
  slot: SandboxSlot | null;
  assignedToHero?: boolean;
};

type SandboxSlot = {
  lane: number;
  rect: Phaser.GameObjects.Rectangle;
  occupied: SandboxCard | null;
};

type SandboxInternals = {
  hand: SandboxCard[];
  playerEquipmentSlots: SandboxSlot[];
  selectedHandCard: SandboxCard | null;
  playerHeroRect: Phaser.GameObjects.Rectangle;
  playerResources: number;
  playerEnergy: number;
  playerTurn: boolean;
  targetingArrow: Phaser.GameObjects.Graphics;
  removeFromHand(card: SandboxCard): void;
  layoutHand(animated: boolean): void;
  updateHud(): void;
  showStatus(message: string): void;
  equipSelectedCard(): void;
};

export class BattleSceneHudTest extends BattleScene {
  private tooltip: Phaser.GameObjects.Container | null = null;
  private selectedEquipment: SandboxCard | null = null;
  private equipmentArrow!: Phaser.GameObjects.Graphics;

  create() {
    super.create();

    this.createHeroAbilityHud("enemy");
    this.createHeroAbilityHud("player");
    this.configureRealEquipmentTestFlow();

    this.equipmentArrow = this.add.graphics().setDepth(1950);
  }

  update() {
    super.update();
    this.drawEquipmentTargetingArrow();
  }

  private sandbox(): SandboxInternals {
    return this as unknown as SandboxInternals;
  }

  private configureRealEquipmentTestFlow() {
    const sandbox = this.sandbox();

    // The real engine flow is: hand -> Equipment zone (Resources), then
    // Equipment zone -> Hero assignment (1 Energy). Disable the old sandbox
    // shortcut that jumped straight from the hand onto the Hero.
    sandbox.equipSelectedCard = () => {
      sandbox.layoutHand(true);
      sandbox.showStatus("Place Equipment into an Equipment slot first.");
    };

    for (const slot of sandbox.playerEquipmentSlots) {
      slot.rect.setInteractive({ useHandCursor: true });
      slot.rect.on("pointerdown", () => {
        const card = sandbox.selectedHandCard;
        if (card?.data.kind === "equipment") this.playEquipmentIntoSlot(card, slot);
      });
    }

    // The base Hero only used pointerdown for the old direct-from-hand test.
    // Replace it with the real second step: assign an Equipment-zone item.
    sandbox.playerHeroRect.removeAllListeners("pointerdown");
    sandbox.playerHeroRect.on("pointerdown", () => this.assignSelectedEquipmentToHero());

    // Base drag/drop already handles creatures and Spells. This extra listener
    // adds Equipment-slot drops after the base listener has rejected them.
    this.input.on(
      "dragend",
      (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
        const card = sandbox.hand.find((entry) => entry.container === gameObject);
        if (!card || card.zone !== "hand" || card.data.kind !== "equipment") return;

        const slot = sandbox.playerEquipmentSlots.find(
          (candidate) =>
            !candidate.occupied && Phaser.Geom.Rectangle.Contains(candidate.rect.getBounds(), pointer.worldX, pointer.worldY),
        );
        if (slot) this.playEquipmentIntoSlot(card, slot);
      },
    );

    this.input.on(
      "pointerdown",
      (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length === 0) this.clearEquipmentSelection();
      },
    );

    this.input.keyboard?.on("keydown-ESC", () => this.clearEquipmentSelection());
  }

  private playEquipmentIntoSlot(card: SandboxCard, slot: SandboxSlot) {
    const sandbox = this.sandbox();
    if (!sandbox.playerTurn || card.zone !== "hand" || card.data.kind !== "equipment" || slot.occupied) return;

    if (sandbox.playerResources < card.data.cost) {
      sandbox.showStatus("Not enough Resources for that Equipment.");
      sandbox.layoutHand(true);
      return;
    }

    sandbox.playerResources -= card.data.cost;
    sandbox.removeFromHand(card);

    card.zone = "equipment";
    card.slot = slot;
    card.assignedToHero = false;
    slot.occupied = card;
    card.dragging = false;
    this.input.setDraggable(card.container, false);

    card.container.removeAllListeners("pointerdown");
    card.container.setInteractive({ useHandCursor: true });
    card.container.on("pointerdown", () => this.selectEquipment(card));

    card.label.setText(`${card.data.name}\n\nUNASSIGNED\nClick, then Hero`);

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

    sandbox.updateHud();
    sandbox.showStatus(`${card.data.name} entered Equipment slot ${slot.lane} Unassigned. Click it, then click your Hero.`);
  }

  private selectEquipment(card: SandboxCard) {
    if (card.zone !== "equipment") return;

    if (this.selectedEquipment === card) {
      this.clearEquipmentSelection();
      return;
    }

    this.clearEquipmentSelection();
    this.selectedEquipment = card;
    card.frame.setStrokeStyle(5, 0xf0d270, 1);
    this.sandbox().showStatus(card.assignedToHero ? `${card.data.name} is already equipped to your Hero.` : "Now click your Hero to assign it for 1 Energy.");
  }

  private assignSelectedEquipmentToHero() {
    const sandbox = this.sandbox();
    const card = this.selectedEquipment;
    if (!card || card.zone !== "equipment") return;

    if (card.assignedToHero) {
      this.clearEquipmentSelection();
      return;
    }

    if (sandbox.playerEnergy < 1) {
      sandbox.showStatus("Not enough Energy to assign Equipment.");
      return;
    }

    sandbox.playerEnergy -= 1;
    card.assignedToHero = true;
    card.label.setText(`${card.data.name}\n\nEQUIPPED\nTO HERO`);
    card.frame.setStrokeStyle(3, EQUIPMENT_COLOR, 1);
    this.selectedEquipment = null;
    sandbox.updateHud();
    sandbox.showStatus(`${card.data.name} assigned to your Hero for 1 Energy.`);
  }

  private clearEquipmentSelection() {
    if (this.selectedEquipment) {
      this.selectedEquipment.frame.setStrokeStyle(3, EQUIPMENT_COLOR, 1);
    }
    this.selectedEquipment = null;
    this.equipmentArrow?.clear();
  }

  private drawEquipmentTargetingArrow() {
    if (!this.equipmentArrow) return;
    this.equipmentArrow.clear();

    const sandbox = this.sandbox();
    const handEquipment = sandbox.selectedHandCard?.data.kind === "equipment" ? sandbox.selectedHandCard : null;
    const pointer = this.input.activePointer;

    if (handEquipment?.zone === "hand" && !handEquipment.dragging) {
      // Remove the base scene's old "Equipment -> Hero" arrow and replace it
      // with Equipment -> open Equipment slot targeting.
      sandbox.targetingArrow.clear();

      const slot = sandbox.playerEquipmentSlots.find(
        (candidate) =>
          !candidate.occupied && Phaser.Geom.Rectangle.Contains(candidate.rect.getBounds(), pointer.worldX, pointer.worldY),
      );
      this.drawArrow(
        handEquipment.container.x,
        handEquipment.container.y,
        slot?.rect.x ?? pointer.worldX,
        slot?.rect.y ?? pointer.worldY,
        Boolean(slot),
      );
      return;
    }

    if (this.selectedEquipment && !this.selectedEquipment.assignedToHero) {
      const overHero = Phaser.Geom.Rectangle.Contains(sandbox.playerHeroRect.getBounds(), pointer.worldX, pointer.worldY);
      this.drawArrow(
        this.selectedEquipment.container.x,
        this.selectedEquipment.container.y,
        overHero ? sandbox.playerHeroRect.x : pointer.worldX,
        overHero ? sandbox.playerHeroRect.y : pointer.worldY,
        overHero,
      );
    }
  }

  private drawArrow(startX: number, startY: number, endX: number, endY: number, valid: boolean) {
    const angle = Math.atan2(endY - startY, endX - startX);
    const headLength = 18;
    const color = valid ? 0x8be38b : 0xe3c76c;

    this.equipmentArrow.lineStyle(5, color, 0.92);
    this.equipmentArrow.beginPath();
    this.equipmentArrow.moveTo(startX, startY);
    this.equipmentArrow.lineTo(endX, endY);
    this.equipmentArrow.strokePath();

    this.equipmentArrow.beginPath();
    this.equipmentArrow.moveTo(endX, endY);
    this.equipmentArrow.lineTo(
      endX - Math.cos(angle - Math.PI / 6) * headLength,
      endY - Math.sin(angle - Math.PI / 6) * headLength,
    );
    this.equipmentArrow.moveTo(endX, endY);
    this.equipmentArrow.lineTo(
      endX - Math.cos(angle + Math.PI / 6) * headLength,
      endY - Math.sin(angle + Math.PI / 6) * headLength,
    );
    this.equipmentArrow.strokePath();
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
}
