import type { GameWorld } from "./world.ts";

function calculateDiplomaticRange(
	world: Pick<GameWorld, "getEntitiesWithQuery" | "getResource">,
	maxHops: number = 4,
): ReadonlyMap<string, ReadonlySet<string>> {
	const entities = world.getEntitiesWithQuery(["country", "control", "adjacency"]);
	const factions = world.getResource("factions");

	const adjacencyMap = new Map<string, ReadonlyArray<string>>(
		entities.map((e) => [e.components.country.countryId, e.components.adjacency.neighbors]),
	);

	const result = new Map<string, ReadonlySet<string>>();

	factions.forEach((faction) => {
		const reachable = new Set<string>();
		const queue: Array<{ readonly countryId: string; readonly depth: number }> = [];

		// Start from annexed capitals
		entities
			.filter((e) =>
				e.components.control.factionId === faction.id &&
				e.components.control.annexed,
			)
			.forEach((e) => {
				const cid = e.components.country.countryId;
				reachable.add(cid);
				queue.push({ countryId: cid, depth: 0 });
			});

		let head = 0;
		while (head < queue.length) {
			const current = queue[head];
			if (!current) break;
			head++;

			if (current.depth >= maxHops) continue;

			const neighbors = adjacencyMap.get(current.countryId) ?? [];
			neighbors
				.filter((n) => !reachable.has(n))
				.forEach((n) => {
					reachable.add(n);
					queue.push({ countryId: n, depth: current.depth + 1 });
				});
		}

		result.set(faction.id, reachable);
	});

	return result;
}

function isInDiplomaticRange(
	range: ReadonlyMap<string, ReadonlySet<string>>,
	factionId: string,
	countryId: string,
): boolean {
	const factionRange = range.get(factionId);
	if (!factionRange) return false;
	return factionRange.has(countryId);
}

export { calculateDiplomaticRange, isInDiplomaticRange };
