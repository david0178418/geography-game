import type { GameWorld } from "./world.ts";

function calculateSupplyDistances(
	world: Pick<GameWorld, "getEntitiesWithQuery" | "getResource">,
): ReadonlyMap<string, ReadonlyMap<string, number>> {
	const entities = world.getEntitiesWithQuery(["country", "control", "adjacency"]);
	const factions = world.getResource("factions");

	const controlledBy = new Map<string, string | null>(
		entities.map((e) => [e.components.country.countryId, e.components.control.factionId]),
	);

	const adjacencyMap = new Map<string, ReadonlyArray<string>>(
		entities.map((e) => [e.components.country.countryId, e.components.adjacency.neighbors]),
	);

	const annexedCapitals = new Map<string, ReadonlyArray<string>>(
		factions.map((f) => {
			const capitals = entities
				.filter((e) =>
					e.components.control.factionId === f.id &&
					e.components.control.annexed,
				)
				.map((e) => e.components.country.countryId);
			return [f.id, capitals];
		}),
	);

	const result = new Map<string, ReadonlyMap<string, number>>();

	factions.forEach((faction) => {
		const distances = new Map<string, number>();
		const startNodes = annexedCapitals.get(faction.id) ?? [];
		const queue: Array<string> = [];

		startNodes.forEach((nodeId) => {
			distances.set(nodeId, 0);
			queue.push(nodeId);
		});

		let head = 0;
		while (head < queue.length) {
			const current = queue[head] as string;
			head++;
			const currentDist = distances.get(current) ?? 0;
			const neighbors = adjacencyMap.get(current) ?? [];

			neighbors
				.filter((n) => !distances.has(n) && controlledBy.get(n) === faction.id)
				.forEach((neighbor) => {
					distances.set(neighbor, currentDist + 1);
					queue.push(neighbor);
				});
		}

		result.set(faction.id, distances);
	});

	return result;
}

function getSupplyMultiplier(distance: number): number {
	if (distance <= 2) return 1.0;
	if (distance <= 4) return 0.75;
	if (distance <= 6) return 0.5;
	if (distance !== Infinity) return 0.25;
	return 0.1;
}

export { calculateSupplyDistances, getSupplyMultiplier };
