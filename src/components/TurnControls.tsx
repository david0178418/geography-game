import { useCallback } from "react";
import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";
import { ButtonGlyphMap } from "@/components/button-prompts/button-glyph-map.ts";
import type { ControllerType } from "@/input/input-types.ts";

function TurnControls() {
	const world = useGameWorld();
	const turnNumber = useEcsResource("turnNumber");
	const currentPhase = useEcsResource("currentPhase");
	const activeInputMethod = useEcsResource("activeInputMethod");

	const handleEndTurn = useCallback(() => {
		world.eventBus.publish("endTurn", undefined);
	}, [world]);

	const showGlyph = activeInputMethod && activeInputMethod !== 'mouse' && activeInputMethod !== 'touch';
	const EndTurnGlyph = showGlyph
		? ButtonGlyphMap[activeInputMethod as ControllerType]?.['END_TURN']
		: null;

	return (
		<div className="turn-controls">
			<span className="turn-counter">Turn {turnNumber}</span>
			<span className="phase-indicator">{currentPhase}</span>
			<button
				className="end-turn-btn"
				onClick={handleEndTurn}
				disabled={currentPhase !== "planning"}
			>
				{EndTurnGlyph && (
					<EndTurnGlyph
						width={20}
						height={20}
						viewBox="0 0 64 64"
						style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}
					/>
				)}
				End Turn
			</button>
		</div>
	);
}

export { TurnControls };
