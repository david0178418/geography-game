import type { Faction } from "@/types/ecs.ts";
import type { GameWorld } from "./world.ts";

const defaultFactions: ReadonlyArray<Faction> = [
	{
		id: "USA",
		name: "United States",
		color: "#3b82f6",
		isPlayer: true,
		homeCountryId: "USA",
	},
	{
		id: "CHN",
		name: "China",
		color: "#ef4444",
		isPlayer: false,
		homeCountryId: "CHN",
	},
	{
		id: "RUS",
		name: "Russia",
		color: "#8b5cf6",
		isPlayer: false,
		homeCountryId: "RUS",
	},
	{
		id: "BRA",
		name: "Brazil",
		color: "#22c55e",
		isPlayer: false,
		homeCountryId: "BRA",
	},
	{
		id: "NGA",
		name: "Nigeria",
		color: "#f59e0b",
		isPlayer: false,
		homeCountryId: "NGA",
	},
] as const;

function getDefaultFactions(): ReadonlyArray<Faction> {
	return defaultFactions;
}

interface IncomeResult {
	readonly reinforcements: number;
	readonly influencePoints: number;
}

function calculateFactionIncome(
	factionId: string,
	world: Pick<GameWorld, "getEntitiesWithQuery">,
): IncomeResult {
	const controlled = world.getEntitiesWithQuery(
		["country", "control", "troops", "stability"],
	);

	const factionCountries = controlled.filter(
		(e) => e.components.control.factionId === factionId,
	);

	return factionCountries.reduce(
		(acc, e) => {
			const stability = e.components.stability.current;
			return {
				reinforcements: acc.reinforcements + Math.floor(stability / 20),
				influencePoints: acc.influencePoints + Math.floor(stability / 25),
			};
		},
		{ reinforcements: 0, influencePoints: 0 } as IncomeResult,
	);
}

export { getDefaultFactions, calculateFactionIncome };
export type { IncomeResult };
