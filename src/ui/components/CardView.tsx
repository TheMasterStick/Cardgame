import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CARD_DEFINITIONS } from "../../data/cards";
import { ELEMENT_LABELS, RACE_LABELS, STATUS_ICONS } from "../../data/taxonomy";
import type { CardDefinition, CardInstance, CreatureDefinition, HeroCardDefinition } from "../../engine/types";

interface CardViewProps {
  instance: CardInstance;
  onClick?: () => void;
  highlighted?: boolean;
  /** Renders this definition instead of looking `instance.defId` up in CARD_DEFINITIONS — for previewing a card that hasn't been saved yet (e.g. the admin form). */
  defOverride?: CardDefinition;
  /** Live Attack including Flank/Formation bonuses (DESIGN.md §5) — pass this for creatures actually sitting on a board row. Falls back to the plain attack+attackDelta when omitted (hand/collection/off-board previews, where positional bonuses don't apply). */
  attackOverride?: number;
  /** Set while the AI's turn is replaying and this card is the one acting, or the one being acted on — drives a highlight/flash effect. */
  acting?: "actor" | "target";
  /**
   * "compact" (default): art plus attack/health only, Hearthstone-minion
   * style — used on the board, collection, deck builder, and packs, where a
   * whole row of cards needs to stay readable at a glance. "full": the same
   * detailed layout the hover-zoom popup uses, rendered inline instead of
   * on hover — used for the hand, where you need to read cost/text/keywords
   * before deciding whether to play a card.
   */
  variant?: "compact" | "full";
}

const ZOOM_WIDTH = 240;
const ZOOM_HEIGHT = Math.round((ZOOM_WIDTH * 776) / 512);
const ZOOM_MARGIN = 12;
const HOVER_DELAY_MS = 400;

/** Viewport size, excluding scrollbars — more reliable than window.innerWidth/Height for clamping a fixed-position element. */
function viewportSize(): { width: number; height: number } {
  return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
}

function computeZoomPosition(rect: DOMRect): { top: number; left: number } {
  const { width: vw, height: vh } = viewportSize();

  let left = rect.right + ZOOM_MARGIN;
  if (left + ZOOM_WIDTH > vw - ZOOM_MARGIN) {
    left = rect.left - ZOOM_WIDTH - ZOOM_MARGIN;
  }
  left = Math.max(ZOOM_MARGIN, Math.min(left, vw - ZOOM_WIDTH - ZOOM_MARGIN));

  let top = rect.top + rect.height / 2 - ZOOM_HEIGHT / 2;
  top = Math.max(ZOOM_MARGIN, Math.min(top, vh - ZOOM_HEIGHT - ZOOM_MARGIN));

  return { top, left };
}

export function CardView({
  instance,
  onClick,
  highlighted,
  defOverride,
  attackOverride,
  acting,
  variant = "compact",
}: CardViewProps) {
  const def = defOverride ?? CARD_DEFINITIONS[instance.defId];
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const [zoomPos, setZoomPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  // Scrolling invalidates the fixed-position popup's anchor — close it rather than let it drift.
  useEffect(() => {
    if (!zoomPos) return;
    const close = () => setZoomPos(null);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [zoomPos]);

  function handleMouseEnter() {
    hoverTimer.current = window.setTimeout(() => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect) setZoomPos(computeZoomPosition(rect));
    }, HOVER_DELAY_MS);
  }

  function handleMouseLeave() {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setZoomPos(null);
  }

  // The card art is the card now (per the Neutral Core Set art pass): every
  // archetype's image already bakes in its own name/cost/rarity/type/text/
  // stats, so CardView never draws a name/cost/rules-text overlay for
  // anything except Hero — Hero art is deliberately bare character art with
  // no stats baked in (Guard/Health/Attack come from Equipment), so it's
  // the one archetype that still needs a text layout here. Every other
  // archetype, at every size (compact/full/zoom), shows only *live* state
  // that isn't and can't be baked into a static image: current Attack/HP,
  // status effects, and (for Spell/Ability) charges remaining.
  const isHero = def.archetype === "hero";

  const baseClasses = ["card", `card--${def.archetype}`, `card--rarity-${def.rarity}`];
  if (highlighted) baseClasses.push("card--highlight");
  if (onClick) baseClasses.push("card--clickable");
  if (def.art) baseClasses.push("card--has-art");
  if (acting) baseClasses.push(`card--ai-${acting}`);

  if (variant === "full") baseClasses.push("card--full");
  const zoomClasses = [...baseClasses.filter((c) => c !== "card--full"), "card--zoom"];

  const art = def.art && (
    <div className="card__art" style={{ backgroundImage: `url("${def.art}")` }} aria-hidden="true" />
  );
  const rarityDot = <span className="card__rarity-dot" aria-hidden="true" />;

  const compactAttack =
    def.archetype === "creature"
      ? attackOverride ?? (def as CreatureDefinition).attack + instance.attackDelta
      : def.archetype === "hero"
        ? (def as HeroCardDefinition).attack
        : null;
  const compactRightKind: "hp" | "charges" | null =
    def.archetype === "creature" || def.archetype === "building" || def.archetype === "hero"
      ? "hp"
      : def.archetype === "spell" || def.archetype === "ability"
        ? "charges"
        : null;
  const compactRightStat =
    compactRightKind === "hp"
      ? def.archetype === "hero"
        ? (def as HeroCardDefinition).hp
        : instance.currentHp
      : compactRightKind === "charges"
        ? instance.chargesRemaining === "unlimited"
          ? "∞"
          : instance.chargesRemaining
        : null;

  const statuses = instance.statuses.length > 0 && (
    <>
      {instance.statuses.map((s, i) => (
        <span key={i} className={`status status--${s.type}`}>
          {STATUS_ICONS[s.type]}
          {s.amount}
        </span>
      ))}
    </>
  );

  let detailedContent: ReactNode;
  if (isHero) {
    const metaParts: string[] = [];
    if (def.race) metaParts.push(RACE_LABELS[def.race]);
    if (def.element) metaParts.push(ELEMENT_LABELS[def.element]);
    const topRow = (
      <div className="card__top">
        <div className="card__name">{def.name}</div>
      </div>
    );

    detailedContent = (
      <>
        {art}
        {rarityDot}
        {topRow}
        {metaParts.length > 0 && <div className="card__meta">{metaParts.join(" · ")}</div>}
        {def.text && <div className="card__text">{def.text}</div>}
        <div className="card__spacer" />
        <div className="card__bottom">
          <span className="stat stat--attack">{(def as HeroCardDefinition).attack}</span>
          <span className="stat stat--hp">{(def as HeroCardDefinition).hp}</span>
        </div>
        {statuses && <div className="card__statuses">{statuses}</div>}
      </>
    );
  } else {
    // Same live-state-only content as the compact face, just rendered
    // bigger by the card--full/card--zoom CSS sizing — see compactContent.
    detailedContent = (
      <>
        {art}
        {rarityDot}
        {compactAttack !== null && <span className="card__corner-stat card__corner-stat--left">{compactAttack}</span>}
        {compactRightStat !== null && (
          <span className={`card__corner-stat card__corner-stat--right card__corner-stat--${compactRightKind}`}>
            {compactRightStat}
          </span>
        )}
        {statuses && <div className="card__statuses card__statuses--compact">{statuses}</div>}
      </>
    );
  }

  const compactContent = (
    <>
      {art}
      {rarityDot}
      {compactAttack !== null && <span className="card__corner-stat card__corner-stat--left">{compactAttack}</span>}
      {compactRightStat !== null && (
        <span className={`card__corner-stat card__corner-stat--right card__corner-stat--${compactRightKind}`}>
          {compactRightStat}
        </span>
      )}
      {statuses && <div className="card__statuses card__statuses--compact">{statuses}</div>}
    </>
  );

  return (
    <>
      <div
        ref={cardRef}
        className={baseClasses.join(" ")}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={def.name}
      >
        {variant === "full" ? detailedContent : compactContent}
      </div>
      {/* Even "full" hand cards are too small to read comfortably at their inline width, so hovering still zooms further. */}
      {zoomPos &&
        createPortal(
          <div
            className={zoomClasses.join(" ")}
            style={{
              position: "fixed",
              top: zoomPos.top,
              left: zoomPos.left,
              width: ZOOM_WIDTH,
            }}
          >
            {detailedContent}
          </div>,
          document.body,
        )}
    </>
  );
}
