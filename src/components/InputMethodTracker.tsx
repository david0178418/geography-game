import { useEffect } from "react";
import { useGameWorld } from "@/contexts/GameContext.ts";
import { useActiveInputMethod } from "@/input/input-hooks.ts";

/**
 * Bridges the useActiveInputMethod hook to the ECS activeInputMethod resource.
 * Renders nothing — exists solely to sync input method detection into the world.
 */
function InputMethodTracker() {
	const world = useGameWorld();
	const activeMethod = useActiveInputMethod();

	useEffect(() => {
		world.setResource("activeInputMethod", activeMethod);
	}, [world, activeMethod]);

	return null;
}

export { InputMethodTracker };
