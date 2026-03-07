import ECSpresso from "ecspresso";
import type { GameComponents, GameEvents, GameResources, TurnPhase } from "@/types/ecs.ts";
import { getDefaultFactions } from "./factions.ts";

function createWorld() {
	return ECSpresso.create()
		.withComponentTypes<GameComponents>()
		.withEventTypes<GameEvents>()
		.withResource("turnNumber" as const, 1)
		.withResource("currentPhase" as const, "planning" as TurnPhase)
		.withResource("factions" as const, getDefaultFactions())
		.withResource("selectedCountryId" as const, null as string | null)
		.withResource("pendingOrders" as const, new Map() as GameResources["pendingOrders"])
		.withResource("countryEntityMap" as const, new Map() as GameResources["countryEntityMap"])
		.build();
}

type GameWorld = ReturnType<typeof createWorld>;

export { createWorld };
export type { GameWorld };
