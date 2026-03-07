import { getCountryData } from "@/data/index.ts";
import type { GameWorld } from "./world.ts";

const STARTING_TROOPS = 10;
const HOME_INFLUENCE = 80;

function spawnCountries(world: GameWorld): void {
	const countries = getCountryData();
	const factions = world.getResource("factions");
	const factionByHomeCountry = new Map(
		factions.map((f) => [f.homeCountryId, f]),
	);

	const countryEntityMap = new Map<string, number>();

	countries.forEach((c) => {
		const controllingFaction = factionByHomeCountry.get(c.id);
		const isHomeCountry = !!controllingFaction;

		const factionInfluence = Object.fromEntries(
			factions.map((f) => [f.id, f.homeCountryId === c.id ? HOME_INFLUENCE : 0]),
		);

		const entity = world.spawn({
			country: {
				countryId: c.id,
				name: c.name,
				capitalName: c.capital.name,
				capitalCoordinates: c.capital.coordinates,
			},
			adjacency: {
				neighbors: c.adjacency,
			},
			control: {
				factionId: controllingFaction?.id ?? null,
				annexed: isHomeCountry,
			},
			troops: {
				count: isHomeCountry ? STARTING_TROOPS : 0,
				contestedTroops: {},
			},
			influence: {
				factionInfluence,
			},
			stability: {
				base: c.stability,
				current: c.stability,
			},
		});

		countryEntityMap.set(c.id, entity.id);
	});

	world.updateResource("countryEntityMap", () => countryEntityMap);
}

export { spawnCountries };
