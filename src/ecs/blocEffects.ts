import type { GameWorld } from "./world.ts";
import { getBlocsForCountry, hasSharedBloc } from "@/data/blocs.ts";
import { COMBAT_STABILITY_LOSS, CONQUEST_STABILITY_LOSS, MIN_STABILITY } from "./stabilityModifiers.ts";

const STABILITY_RIPPLE_FACTOR = 0.5;
const SOLIDARITY_PENALTY = 5;

function applyStabilityRipple(world: GameWorld, sourceCountryId: string, delta: number): void {
	const rippleDelta = Math.floor(delta * STABILITY_RIPPLE_FACTOR);
	if (rippleDelta === 0) return;

	if (getBlocsForCountry(sourceCountryId).length === 0) return;

	const entities = world.getEntitiesWithQuery(["country", "stability"]);

	entities
		.filter((e) => e.components.country.countryId !== sourceCountryId)
		.filter((e) => hasSharedBloc(sourceCountryId, e.components.country.countryId))
		.forEach((entity) => {
			const { stability } = entity.components;
			const newCurrent = Math.max(MIN_STABILITY, Math.min(stability.base, stability.current + rippleDelta));
			if (newCurrent === stability.current) return;
			world.entityManager.addComponent(entity.id, "stability", {
				base: stability.base,
				current: newCurrent,
			});
		});
}

function applySolidarityPenalty(
	world: GameWorld,
	conqueredCountryId: string,
	conquerorFactionId: string,
): void {
	if (getBlocsForCountry(conqueredCountryId).length === 0) return;

	const entities = world.getEntitiesWithQuery(["country", "influence"]);

	entities
		.filter((e) => e.components.country.countryId !== conqueredCountryId)
		.filter((e) => hasSharedBloc(conqueredCountryId, e.components.country.countryId))
		.forEach((entity) => {
			const { influence } = entity.components;
			const currentInfluence = influence.factionInfluence[conquerorFactionId];
			if (currentInfluence === undefined || currentInfluence <= 0) return;

			world.entityManager.addComponent(entity.id, "influence", {
				factionInfluence: {
					...influence.factionInfluence,
					[conquerorFactionId]: Math.max(0, currentInfluence - SOLIDARITY_PENALTY),
				},
			});
		});
}

function registerBlocHandlers(world: GameWorld): void {
	world.on("combatResolved", ({ countryId, winnerId, conquered }) => {
		if (winnerId === null) return;

		applyStabilityRipple(world, countryId, -COMBAT_STABILITY_LOSS);

		if (conquered) {
			applyStabilityRipple(world, countryId, -CONQUEST_STABILITY_LOSS);
			applySolidarityPenalty(world, countryId, winnerId);
		}
	});
}

export { applyStabilityRipple, applySolidarityPenalty, registerBlocHandlers };
