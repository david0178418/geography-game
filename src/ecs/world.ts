import ECSpresso from "ecspresso";
import type { GameComponents, GameEvents, GameResources } from "@/types/ecs.ts";
import { getDefaultFactions } from "./factions.ts";

function createWorld() {
	return ECSpresso.create()
		.withComponentTypes<GameComponents>()
		.withEventTypes<GameEvents>()
		.withResourceTypes<GameResources>()
		.withResource("turnNumber", 1)
		.withResource("currentPhase", "planning")
		.withResource("factions", getDefaultFactions())
		.withResource("selectedCountryId", null)
		.withResource("pendingOrders", new Map())
		.withResource("countryEntityMap", new Map())
		.withResource("influenceBudgets", new Map())
		.build();
}

type GameWorld = ReturnType<typeof createWorld>;

export { createWorld };
export type { GameWorld };
