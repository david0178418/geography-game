import type { GameWorld } from "./world.ts";

const COMBAT_STABILITY_LOSS = 5;
const CONQUEST_STABILITY_LOSS = 15;
const PEACE_RECOVERY_RATE = 2;
const MIN_STABILITY = 5;

function applyStabilityLoss(world: GameWorld, countryId: string, amount: number): void {
	const countryEntityMap = world.getResource("countryEntityMap");
	const entityId = countryEntityMap.get(countryId);
	if (entityId === undefined) return;

	const entity = world.getEntity(entityId);
	if (!entity) return;

	const { stability } = entity.components;
	if (!stability) return;

	world.entityManager.addComponent(entityId, "stability", {
		base: stability.base,
		current: Math.max(MIN_STABILITY, stability.current - amount),
	});
}

function resolveStabilityRecovery(world: GameWorld): void {
	const phase = world.getResource("currentPhase");
	if (phase !== "resolution") return;

	const entities = world.getEntitiesWithQuery(["country", "stability", "troops"]);

	entities
		.filter((e) => Object.keys(e.components.troops.contestedTroops).length === 0)
		.filter((e) => e.components.stability.current < e.components.stability.base)
		.forEach((entity) => {
			const { stability } = entity.components;
			world.entityManager.addComponent(entity.id, "stability", {
				base: stability.base,
				current: Math.min(stability.base, stability.current + PEACE_RECOVERY_RATE),
			});
		});
}

function registerStabilityHandlers(world: GameWorld): void {
	world.on("combatResolved", ({ countryId, conquered }) => {
		const totalLoss = conquered
			? COMBAT_STABILITY_LOSS + CONQUEST_STABILITY_LOSS
			: COMBAT_STABILITY_LOSS;
		applyStabilityLoss(world, countryId, totalLoss);
	});
}

export {
	applyStabilityLoss,
	resolveStabilityRecovery,
	registerStabilityHandlers,
	COMBAT_STABILITY_LOSS,
	CONQUEST_STABILITY_LOSS,
	MIN_STABILITY,
};
