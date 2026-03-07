import { useCallback } from "react";
import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";

function TurnControls() {
	const world = useGameWorld();
	const turnNumber = useEcsResource("turnNumber");
	const currentPhase = useEcsResource("currentPhase");

	const handleEndTurn = useCallback(() => {
		world.eventBus.publish("endTurn", undefined);
	}, [world]);

	return (
		<div className="turn-controls">
			<span className="turn-counter">Turn {turnNumber}</span>
			<span className="phase-indicator">{currentPhase}</span>
			<button
				className="end-turn-btn"
				onClick={handleEndTurn}
				disabled={currentPhase !== "planning"}
			>
				End Turn
			</button>
		</div>
	);
}

export { TurnControls };
