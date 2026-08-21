import { useState } from "react";
import { pickAiSpecialization } from "../../engine/ai";
import type { HeroCardDefinition, HeroSpecialization } from "../../engine/types";

export interface PendingMatch {
  heroDefId: string;
  deckIds: string[];
  aiHeroId: string;
  aiDeckIds: string[];
}

interface SpecializationSelectProps {
  heroDef: HeroCardDefinition;
  aiHeroDef: HeroCardDefinition;
  onConfirm: (playerSpecializationId: string, aiSpecializationId: string) => void;
  onBack: () => void;
}

/**
 * DESIGN.md §19 (Phase P): a Hero's fixed Hero Power is unaffected by
 * anything here — this only picks which of the three Specializations
 * (built from the same PassiveEffect templates a single `passive` field
 * used to hold) is active for the match. The AI's pick is computed only
 * once the player has already locked theirs in — via pickAiSpecialization,
 * which deliberately never receives the player's choice — so it can't
 * become a counter-pick even by accident; both are then shown together,
 * matching the "reveal after both lock in, before the match really
 * begins" recommendation (an explicit Open default, not finalized canon).
 */
export function SpecializationSelect({ heroDef, aiHeroDef, onConfirm, onBack }: SpecializationSelectProps) {
  const [revealed, setRevealed] = useState<{ playerSpec: HeroSpecialization; aiSpec: HeroSpecialization } | null>(null);

  function pick(spec: HeroSpecialization) {
    const aiSpecId = pickAiSpecialization(aiHeroDef);
    const aiSpec = aiHeroDef.specializations.find((s) => s.id === aiSpecId) ?? aiHeroDef.specializations[0];
    setRevealed({ playerSpec: spec, aiSpec });
  }

  if (revealed) {
    return (
      <div className="screen">
        <div className="screen__header">
          <h2>Specializations Chosen</h2>
        </div>
        <div className="specialization-reveal">
          <div className="specialization-reveal__side">
            <h3>{heroDef.name} (you)</h3>
            <strong>{revealed.playerSpec.name}</strong>
            <p>{revealed.playerSpec.text}</p>
          </div>
          <div className="specialization-reveal__side">
            <h3>{aiHeroDef.name} (opponent)</h3>
            <strong>{revealed.aiSpec.name}</strong>
            <p>{revealed.aiSpec.text}</p>
          </div>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => onConfirm(revealed.playerSpec.id, revealed.aiSpec.id)}
        >
          Begin Match
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <h2>Choose Your Specialization</h2>
      </div>
      <p className="screen__blurb">
        Facing {aiHeroDef.name}. Choose one of {heroDef.name}&rsquo;s three Specializations for this match —
        your opponent is choosing theirs at the same time, without seeing yours.
      </p>
      <div className="specialization-grid">
        {heroDef.specializations.map((spec) => (
          <button key={spec.id} className="specialization-card" onClick={() => pick(spec)}>
            <strong>{spec.name}</strong>
            <p>{spec.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
