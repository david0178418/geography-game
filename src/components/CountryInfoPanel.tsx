import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";
import { getBlocsForCountry } from "@/data/blocs.ts";

function CountryInfoPanel() {
	const world = useGameWorld();
	const selectedCountryId = useEcsResource("selectedCountryId");
	const factions = useEcsResource("factions");
	const countryEntityMap = useEcsResource("countryEntityMap");

	if (!selectedCountryId) return null;

	const entityId = countryEntityMap.get(selectedCountryId);
	if (entityId === undefined) return null;

	const entities = world.getEntitiesWithQuery(
		["country", "control", "troops", "stability", "influence", "adjacency"],
	);
	const entity = entities.find((e) => e.id === entityId);
	if (!entity) return null;

	const { country, control, troops, stability, influence, adjacency } = entity.components;
	const controllingFaction = factions.find((f) => f.id === control.factionId);
	const blocs = getBlocsForCountry(country.countryId);

	function handleAdjacentClick(neighborId: string) {
		world.updateResource("selectedCountryId", () => neighborId);
	}

	const influenceEntries = Object.entries(influence.factionInfluence)
		.filter(([, value]) => value > 0)
		.sort(([, a], [, b]) => b - a);

	return (
		<div className="country-info-panel">
			<h2>{country.name}</h2>
			<div className="info-row">
				<span className="info-label">Capital</span>
				<span>{country.capitalName}</span>
			</div>
			<div className="info-row">
				<span className="info-label">Controller</span>
				<span>
					{controllingFaction ? (
						<>
							<span
								className="faction-swatch"
								style={{ backgroundColor: controllingFaction.color }}
							/>
							{controllingFaction.name}
						</>
					) : (
						"Uncontrolled"
					)}
				</span>
			</div>
			<div className="info-row">
				<span className="info-label">Troops</span>
				<span>{troops.count}</span>
			</div>
			<div className="info-row">
				<span className="info-label">Stability</span>
				<div className="stability-bar-container">
					<div
						className="stability-bar-fill"
						style={{ width: `${stability.current}%` }}
					/>
					<span className="stability-bar-text">{stability.current}</span>
				</div>
			</div>

			{influenceEntries.length > 0 && (
				<div className="info-section">
					<h3>Influence</h3>
					{influenceEntries.map(([factionId, value]) => {
						const faction = factions.find((f) => f.id === factionId);
						return (
							<div key={factionId} className="influence-row">
								<span
									className="faction-swatch"
									style={{ backgroundColor: faction?.color ?? "#888" }}
								/>
								<span>{faction?.name ?? factionId}</span>
								<span className="influence-value">{value}</span>
							</div>
						);
					})}
				</div>
			)}

			{blocs.length > 0 && (
				<div className="info-section">
					<h3>Regional Blocs</h3>
					<div className="blocs-list">
						{blocs.map((bloc) => (
							<span key={bloc} className="bloc-tag">{bloc}</span>
						))}
					</div>
				</div>
			)}

			<div className="info-section">
				<h3>Adjacent Countries</h3>
				<div className="adjacent-list">
					{adjacency.neighbors.map((neighborId) => (
						<button
							key={neighborId}
							className="adjacent-btn"
							onClick={() => handleAdjacentClick(neighborId)}
						>
							{neighborId}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

export { CountryInfoPanel };
