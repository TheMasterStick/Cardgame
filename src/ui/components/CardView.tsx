import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CARD_DEFINITIONS } from "../../data/cards";
import { ELEMENT_LABELS, KEYWORD_ICONS, KEYWORD_LABELS, RACE_LABELS } from "../../data/taxonomy";
import type { CardDefinition, CardInstance, CreatureDefinition, HeroCardDefinition, Keyword } from "../../engine/types";

interface CardViewProps {
  instance: CardInstance;
  onClick?: () => void;
  highlighted?: boolean;
  /** Renders this definition instead of looking `instance.defId` up in CARD_DEFINITIONS — for previewing a card that hasn't been saved yet (e.g. the admin form). */
  defOverride?: CardDefinition;
  /** Live Attack including Flank/Formation bonuses (DESIGN.md §5) — pass this for creatures actually sitting on a board row. Falls back to the plain attack+attackDelta when omitted (hand/collection/off-board previews, where positional bonuses don't apply). */
  attackOverride?: number;
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

export function CardView({ instance, onClick, highlighted, defOverride, attackOverride }: CardViewProps) {
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

  const classes = ["card", `card--${def.archetype}`, `card--rarity-${def.rarity}`];
  if (highlighted) classes.push("card--highlight");
  if (onClick) classes.push("card--clickable");
  if (def.art) classes.push("card--has-art");

  const metaParts: string[] = [];
  if (def.race) metaParts.push(RACE_LABELS[def.race]);
  if (def.element) metaParts.push(ELEMENT_LABELS[def.element]);
  const keywords: Keyword[] = def.archetype === "creature" ? def.keywords : [];

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
  const statsRow = (
    <div className="card__bottom">
      {def.archetype === "creature" && (
        <>
          <span className="stat stat--attack">{attackOverride ?? (def as CreatureDefinition).attack + instance.attackDelta}</span>
          <span className="stat stat--hp">{instance.currentHp}</span>
        </>
      )}
      {def.archetype === "hero" && (
        <>
          <span className="stat stat--attack">{(def as HeroCardDefinition).attack}</span>
          <span className="stat stat--hp">{(def as HeroCardDefinition).hp}</span>
        </>
      )}
      {def.archetype === "building" && <span className="stat stat--hp">{instance.currentHp}</span>}
      {(def.archetype === "spell" || def.archetype === "ability") && (
        <span className="stat stat--charges">
          {instance.chargesRemaining === "unlimited" ? "∞" : `${instance.chargesRemaining}x`}
        </span>
      )}
    </div>
  );
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
        {keywords.length > 0 && (
          <div className="card__keyword-icons">
            {keywords.map((k) => (
              <span key={k} className="card__keyword-icon" title={KEYWORD_LABELS[k]}>
                {KEYWORD_ICONS[k]}
              </span>
            ))}
          </div>
        )}
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
            {keywords.length > 0 && (
              <div className="card__keywords">
                {keywords.map((k) => (
                  <span key={k} className="card__keyword-tag">
                    {KEYWORD_ICONS[k]} {KEYWORD_LABELS[k]}
                  </span>
                ))}
              </div>
            )}
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
