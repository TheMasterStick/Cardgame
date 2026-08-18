import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cardFrameUrl } from "../../data/cardFrames";
import { CARD_DEFINITIONS } from "../../data/cards";
import {
  ARCHETYPE_LABELS,
  costPoolIcon,
  ELEMENT_LABELS,
  FACTION_LABELS,
  KEYWORD_ICONS,
  KEYWORD_LABELS,
  RACE_LABELS,
  RARITY_LABELS,
} from "../../data/taxonomy";
import type { CardDefinition, CardInstance, CreatureDefinition, HeroCardDefinition, Keyword } from "../../engine/types";

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

export function CardView({ instance, onClick, highlighted, defOverride, attackOverride, acting }: CardViewProps) {
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

  const frameUrl = cardFrameUrl(def.archetype);

  const classes = ["card", `card--${def.archetype}`, `card--rarity-${def.rarity}`];
  if (highlighted) classes.push("card--highlight");
  if (onClick) classes.push("card--clickable");
  if (def.art) classes.push("card--has-art");
  if (acting) classes.push(`card--ai-${acting}`);
  if (frameUrl) classes.push("card--framed");

  const keywords: Keyword[] = def.archetype === "creature" ? def.keywords : [];
  const statuses = instance.statuses.length > 0 && (
    <div className="card__statuses">
      {instance.statuses.map((s, i) => (
        <span key={i} className={`status status--${s.type}`}>
          {s.type === "burn" ? "🔥" : "☠"}
          {s.amount}
        </span>
      ))}
    </div>
  );

  if (frameUrl) {
    const cost = "cost" in def ? def.cost : null;
    const metaBarParts = [RARITY_LABELS[def.rarity]];
    if (def.faction) metaBarParts.push(FACTION_LABELS[def.faction]);
    metaBarParts.push(def.race ? RACE_LABELS[def.race] : ARCHETYPE_LABELS[def.archetype]);

    const attackValue =
      def.archetype === "creature" ? attackOverride ?? (def as CreatureDefinition).attack + instance.attackDelta : null;
    const rightStat =
      def.archetype === "creature" || def.archetype === "building"
        ? instance.currentHp
        : instance.chargesRemaining === "unlimited"
          ? "∞"
          : instance.chargesRemaining;

    const framedContent = (
      <>
        <div className="frame__name">{def.name}</div>
        {cost !== null && <div className="frame__cost">{cost}</div>}
        <div className="frame__pool-icon" aria-hidden="true">
          {costPoolIcon(def.archetype)}
        </div>
        {def.art && <div className="frame__art" style={{ backgroundImage: `url("${def.art}")` }} aria-hidden="true" />}
        <div className="frame__meta-bar">{metaBarParts.join(" ◆ ")}</div>
        <div className="frame__text">
          {keywords.length > 0 && (
            <div className="card__keyword-icons">
              {keywords.map((k) => (
                <span key={k} className="card__keyword-icon" title={KEYWORD_LABELS[k]}>
                  {KEYWORD_ICONS[k]}
                </span>
              ))}
            </div>
          )}
          {def.text}
        </div>
        {attackValue !== null && <div className="frame__stat frame__stat--left">{attackValue}</div>}
        <div className="frame__stat frame__stat--right">{rightStat}</div>
        {statuses}
      </>
    );

    return (
      <>
        <div
          ref={cardRef}
          className={classes.join(" ")}
          style={{ backgroundImage: `url("${frameUrl}")` }}
          onClick={onClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-label={def.name}
        >
          {framedContent}
        </div>
        {zoomPos &&
          createPortal(
            <div
              className={[...classes, "card--zoom"].join(" ")}
              style={{
                position: "fixed",
                top: zoomPos.top,
                left: zoomPos.left,
                width: ZOOM_WIDTH,
                backgroundImage: `url("${frameUrl}")`,
              }}
            >
              {framedContent}
            </div>,
            document.body,
          )}
      </>
    );
  }

  const metaParts: string[] = [];
  if (def.race) metaParts.push(RACE_LABELS[def.race]);
  if (def.element) metaParts.push(ELEMENT_LABELS[def.element]);

  const art = def.art && (
    <div className="card__art" style={{ backgroundImage: `url("${def.art}")` }} aria-hidden="true" />
  );
  const rarityDot = <span className="card__rarity-dot" aria-hidden="true" />;
  const topRow = (
    <div className="card__top">
      {"cost" in def && def.archetype !== "hero" && <div className="card__cost">{def.cost}</div>}
      <div className="card__name">{def.name}</div>
    </div>
  );
  // Only Hero and Equipment ever reach this plain layout (cardFrameUrl covers
  // every other archetype) — Equipment has no stats surfaced here today.
  const statsRow = (
    <div className="card__bottom">
      {def.archetype === "hero" && (
        <>
          <span className="stat stat--attack">{(def as HeroCardDefinition).attack}</span>
          <span className="stat stat--hp">{(def as HeroCardDefinition).hp}</span>
        </>
      )}
    </div>
  );

  return (
    <>
      <div
        ref={cardRef}
        className={classes.join(" ")}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={def.name}
      >
        {art}
        {rarityDot}
        {topRow}
        <div className="card__spacer" />
        {statsRow}
        {statuses}
      </div>
      {zoomPos &&
        createPortal(
          <div
            className={[...classes, "card--zoom"].join(" ")}
            style={{ position: "fixed", top: zoomPos.top, left: zoomPos.left, width: ZOOM_WIDTH }}
          >
            {art}
            {rarityDot}
            {topRow}
            {metaParts.length > 0 && <div className="card__meta">{metaParts.join(" · ")}</div>}
            {def.text && <div className="card__text">{def.text}</div>}
            <div className="card__spacer" />
            {statsRow}
            {statuses}
          </div>,
          document.body,
        )}
    </>
  );
}
