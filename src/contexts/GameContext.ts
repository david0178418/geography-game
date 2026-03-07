import { createContext, useContext } from "react";
import type { GameWorld } from "@/ecs/world.ts";

const GameContext = createContext<GameWorld | null>(null);

function useGameWorld(): GameWorld {
	const world = useContext(GameContext);
	if (!world) throw new Error("useGameWorld must be used within a GameContext.Provider");
	return world;
}

export { GameContext, useGameWorld };
