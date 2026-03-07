import type { GameWorld } from "./world.ts";
import type { InfluenceComponent } from "@/types/ecs.ts";
import { calculateDiplomaticRange, isInDiplomaticRange } from "./diplomaticRange.ts";
import { getDominantFaction, getControlState } from "./controlStates.ts";
import { hasSharedBloc } from "@/data/blocs.ts";

const INFLUENCE_DECAY = 2;

function resolveInfluence(world: GameWorld): void {
	const phase = world.getResource("currentPhase");
	if (phase !== "resolution") return;

	const pendingOrders = world.getResource("pendingOrders");
	const countryEntityMap = world.getResource("countryEntityMap");
	const influenceOrders = [...pendingOrders.values()].filter((o) => o.type === "influence");

	const entities = world.getEntitiesWithQuery(["country", "control", "influence", "stability"]);

	// Accumulate influence deltas per entity: entityId -> factionId -> delta
	const influenceDeltas = new Map<number, Map<string, number>>();

	// Only compute budget validation and diplomatic range if there are orders
	if (influenceOrders.length > 0) {
		const budgets = world.getResource("influenceBudgets");
		const range = calculateDiplomaticRange(world);
		const spending = new Map<string, number>();

		influenceOrders.forEach((order) => {
			const factionBudget = budgets.get(order.factionId) ?? 0;
			const spent = spending.get(order.factionId) ?? 0;
			if (spent + order.amount > factionBudget) return;
			if (!isInDiplomaticRange(range, order.factionId, order.targetCountryId)) return;

			spending.set(order.factionId, spent + order.amount);

			const targetEntityId = countryEntityMap.get(order.targetCountryId);
			if (targetEntityId === undefined) return;

			const entityDeltas = influenceDeltas.get(targetEntityId) ?? new Map<string, number>();
			influenceDeltas.set(targetEntityId, entityDeltas);

			const currentDelta = entityDeltas.get(order.factionId) ?? 0;
			entityDeltas.set(order.factionId, currentDelta + order.amount);

			// Bloc bonus: +1 if source and target share a bloc (free, not counted against budget)
			if (hasSharedBloc(order.sourceCountryId, order.targetCountryId)) {
				entityDeltas.set(order.factionId, (entityDeltas.get(order.factionId) ?? 0) + 1);
			}
		});
	}

	// Apply influence changes: accumulate, decay, clamp, and check control transitions
	entities.forEach((entity) => {
		const { influence, stability, control } = entity.components;
		const entityDeltas = influenceDeltas.get(entity.id);

		// Build set of all faction IDs that have current influence or incoming deltas
		const allFactionIds = new Set([
			...Object.keys(influence.factionInfluence),
			...(entityDeltas ? [...entityDeltas.keys()] : []),
		]);

		// Compute new influence: current + delta - decay, clamped to [0, 100]
		const newInfluence = Object.fromEntries(
			[...allFactionIds]
				.map((factionId) => {
					const current = influence.factionInfluence[factionId] ?? 0;
					const added = entityDeltas?.get(factionId) ?? 0;
					const value = Math.min(100, Math.max(0, current + added - INFLUENCE_DECAY));
					return [factionId, value] as const;
				})
				.filter(([, value]) => value > 0),
		);

		const updatedInfluence: InfluenceComponent = { factionInfluence: newInfluence };
		world.entityManager.addComponent(entity.id, "influence", updatedInfluence);

		// Control state transitions based on influence
		const dominant = getDominantFaction(newInfluence);

		if (dominant && getControlState(dominant.value, stability.current) === "annexed") {
			if (control.factionId !== dominant.factionId || !control.annexed) {
				world.entityManager.addComponent(entity.id, "control", {
					factionId: dominant.factionId,
					annexed: true,
				});
			}
		} else if (control.annexed && control.factionId) {
			const controllerInfluence = newInfluence[control.factionId] ?? 0;
			if (getControlState(controllerInfluence, stability.current) !== "annexed") {
				world.entityManager.addComponent(entity.id, "control", {
					factionId: control.factionId,
					annexed: false,
				});
			}
		}
	});
}

export { resolveInfluence };
