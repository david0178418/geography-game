import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";

function FactionSummaryBar() {
	const world = useGameWorld();
	const factions = useEcsResource("factions");

	const controlled = world.getEntitiesWithQuery(["control"]);
	const territoryCounts = Object.fromEntries(
		Array.from(
			controlled.reduce((map, entity) => {
				const factionId = entity.components.control.factionId;
				if (factionId === null) return map;
				map.set(factionId, (map.get(factionId) ?? 0) + 1);
				return map;
			}, new Map<string, number>()),
		),
	);

	return (
		<div className="faction-summary-bar">
			{factions.map((faction) => (
				<div key={faction.id} className="faction-summary-item">
					<span
						className="faction-swatch"
						style={{ backgroundColor: faction.color }}
					/>
					<span className="faction-name">{faction.name}</span>
					<span className="faction-territory-count">
						{territoryCounts[faction.id] ?? 0}
					</span>
				</div>
			))}
		</div>
	);
}

export { FactionSummaryBar };
