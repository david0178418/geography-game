import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";
import { getBlocsForCountry } from "@/data/blocs.ts";
import { getControlStateForCountry } from "@/ecs/controlStates.ts";

function CountryInfoPanel() {
	const world = useGameWorld();
	const interactionState = useEcsResource("interactionState");
	const factions = useEcsResource("factions");
	const countryEntityMap = useEcsResource("countryEntityMap");

	if (interactionState.mode === 'idle') return null;

	const countryId = interactionState.countryId;
	const entityId = countryEntityMap.get(countryId);
	if (entityId === undefined) return null;

	const entity = world.getEntity(entityId);
	if (!entity) return null;

	const { country, control, troops, stability, influence } = entity.components;
	if (!country || !control || !troops || !stability || !influence) return null;

	const controllingFaction = factions.find((f) => f.id === control.factionId);
	const blocs = getBlocsForCountry(country.countryId);
	const controlState = getControlStateForCountry(influence.factionInfluence, stability.current);

	const influenceEntries = Object.entries(influence.factionInfluence)
		.filter(([, value]) => value > 0)
		.sort(([, a], [, b]) => b - a);

	return (
		<div className="country-info-panel">
			<h3 className="card-title">{country.name}</h3>
			<div className="card-info-grid">
				<span className="info-label">Capital</span>
				<span>{country.capitalName}</span>
				<span className="info-label">Controller</span>
				<span>
					{controllingFaction ? (
						<>
							<span className="faction-swatch" style={{ backgroundColor: controllingFaction.color }} />
							{controllingFaction.name}
						</>
					) : "Uncontrolled"}
				</span>
				{controlState.dominantFactionId && (
					<>
						<span className="info-label">Influence</span>
						<span>
							{controlState.state} ({factions.find((f) => f.id === controlState.dominantFactionId)?.name ?? controlState.dominantFactionId})
						</span>
					</>
				)}
				<span className="info-label">Troops</span>
				<span>{troops.count}</span>
				<span className="info-label">Stability</span>
				<div className="stability-bar-container">
					<div className="stability-bar-fill" style={{ width: `${stability.current}%` }} />
					<span className="stability-bar-text">{stability.current}</span>
				</div>
			</div>

			{influenceEntries.length > 0 && (
				<div className="card-section">
					<h4>Influence</h4>
					{influenceEntries.map(([factionId, value]) => {
						const faction = factions.find((f) => f.id === factionId);
						return (
							<div key={factionId} className="influence-row">
								<span className="faction-swatch" style={{ backgroundColor: faction?.color ?? "#888" }} />
								<span>{faction?.name ?? factionId}</span>
								<span className="influence-value">{value}</span>
							</div>
						);
					})}
				</div>
			)}

			{blocs.length > 0 && (
				<div className="card-section">
					<h4>Regional Blocs</h4>
					<div className="blocs-list">
						{blocs.map((bloc) => (
							<span key={bloc} className="bloc-tag">{bloc}</span>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export { CountryInfoPanel };
