import type { TurnPhase, TroopsComponent, ControlComponent } from "@/types/ecs.ts";
import type { GameWorld } from "./world.ts";
import { calculateSupplyDistances, getSupplyMultiplier } from "./supplyLines.ts";

const phaseTransitions: Readonly<Record<TurnPhase, TurnPhase>> = {
	planning: "resolution",
	resolution: "notification",
	notification: "planning",
} as const;

function resolveMovement(world: GameWorld): void {
	const phase = world.getResource("currentPhase");
	if (phase !== "resolution") return;

	const pendingOrders = world.getResource("pendingOrders");
	const countryEntityMap = world.getResource("countryEntityMap");
	const moveOrders = [...pendingOrders.values()].filter((o) => o.type === "move");

	const entities = world.getEntitiesWithQuery(["country", "control", "troops"]);
	const entityById = new Map(entities.map((e) => [e.id, e]));

	// Accumulate troop deltas rather than mutating entities mid-loop
	const troopDeltas = new Map<number, { countDelta: number; contestedAdds: Record<string, number> }>();

	function getDelta(entityId: number) {
		const existing = troopDeltas.get(entityId);
		if (existing) return existing;
		const delta = { countDelta: 0, contestedAdds: {} as Record<string, number> };
		troopDeltas.set(entityId, delta);
		return delta;
	}

	moveOrders.forEach((order) => {
		const sourceEntityId = countryEntityMap.get(order.sourceCountryId);
		const destEntityId = countryEntityMap.get(order.targetCountryId);
		if (sourceEntityId === undefined || destEntityId === undefined) return;

		const sourceEntity = entityById.get(sourceEntityId);
		if (!sourceEntity) return;

		// Validate source is controlled by ordering faction
		if (sourceEntity.components.control.factionId !== order.factionId) return;

		// Validate source has enough troops (accounting for prior deltas)
		const sourceDelta = getDelta(sourceEntityId);
		const availableTroops = sourceEntity.components.troops.count + sourceDelta.countDelta;
		if (availableTroops < order.amount) return;

		// Deduct from source
		sourceDelta.countDelta -= order.amount;

		// Determine destination
		const destEntity = entityById.get(destEntityId);
		if (!destEntity) return;

		const destDelta = getDelta(destEntityId);

		if (destEntity.components.control.factionId === order.factionId) {
			// Friendly territory: add to count
			destDelta.countDelta += order.amount;
		} else {
			// Enemy or uncontrolled: add to contestedTroops
			destDelta.contestedAdds[order.factionId] =
				(destDelta.contestedAdds[order.factionId] ?? 0) + order.amount;
		}
	});

	// Apply deltas
	troopDeltas.forEach((delta, entityId) => {
		const entity = entityById.get(entityId);
		if (!entity) return;

		const currentTroops = entity.components.troops;
		const newContested = { ...currentTroops.contestedTroops };

		Object.entries(delta.contestedAdds).forEach(([fId, amount]) => {
			newContested[fId] = (newContested[fId] ?? 0) + amount;
		});

		const updatedTroops: TroopsComponent = {
			count: currentTroops.count + delta.countDelta,
			contestedTroops: newContested,
		};

		world.entityManager.addComponent(entityId, "troops", updatedTroops);
	});
}

interface Combatant {
	readonly factionId: string;
	readonly troops: number;
	readonly isDefender: boolean;
}

function rollHits(troopCount: number, hitChance: number): number {
	let hits = 0;
	for (let i = 0; i < troopCount; i++) {
		if (Math.random() < hitChance) hits++;
	}
	return hits;
}

function runCombatRound(
	combatants: ReadonlyArray<Combatant>,
	totalTroops: number,
	supplyDistances: ReadonlyMap<string, ReadonlyMap<string, number>>,
	countryId: string,
	stabilityCurrent: number,
): ReadonlyArray<Combatant> {
	const activeCombatants = combatants.filter((c) => c.troops > 0);
	if (activeCombatants.length < 2) return combatants;

	// Calculate hits for each combatant simultaneously
	const hits = combatants.map((combatant) => {
		if (combatant.troops <= 0) return 0;

		const supplyDist = supplyDistances.get(combatant.factionId)?.get(countryId) ?? Infinity;
		const supplyMult = getSupplyMultiplier(supplyDist);

		const ratio = combatant.troops / totalTroops;
		const ratioBonus = Math.min(0.15, Math.max(-0.15, (ratio - 0.5) * 0.3));

		const defenderBonus = combatant.isDefender ? 0.1 : 0;
		const stabilityPenalty = combatant.isDefender ? 0 : -(0.05 + 0.1 * (1 - stabilityCurrent / 100));

		const baseHitChance = 0.5;
		const hitChance = Math.max(0.05, Math.min(0.95,
			(baseHitChance + ratioBonus + defenderBonus + stabilityPenalty) * supplyMult,
		));

		return rollHits(combatant.troops, hitChance);
	});

	// Distribute each combatant's hits across enemies proportionally
	const casualties = combatants.map((_c, targetIdx) =>
		hits.reduce((totalDamage, attackerHits, attackerIdx) => {
			if (attackerIdx === targetIdx || attackerHits === 0) return totalDamage;
			const targets = combatants
				.map((c, j) => ({ troops: Math.max(0, c.troops), idx: j }))
				.filter((t) => t.idx !== attackerIdx && t.troops > 0);
			const targetTotal = targets.reduce((sum, t) => sum + t.troops, 0);
			if (targetTotal <= 0) return totalDamage;
			const thisCombatant = targets.find((t) => t.idx === targetIdx);
			if (!thisCombatant) return totalDamage;
			return totalDamage + Math.round(attackerHits * (thisCombatant.troops / targetTotal));
		}, 0),
	);

	return combatants.map((combatant, i) => ({
		...combatant,
		troops: Math.max(0, combatant.troops - (casualties[i] ?? 0)),
	}));
}

function resolveCombat(world: GameWorld): void {
	const phase = world.getResource("currentPhase");
	if (phase !== "resolution") return;

	const entities = world.getEntitiesWithQuery(["country", "control", "troops", "stability"]);
	const supplyDistances = calculateSupplyDistances(world);

	entities
		.filter((e) => Object.keys(e.components.troops.contestedTroops).length > 0)
		.forEach((entity) => {
			const { country, control, troops, stability } = entity.components;

			// Build combatant list: defender + all attackers
			const initialCombatants: ReadonlyArray<Combatant> = [
				...(control.factionId !== null && troops.count > 0
					? [{ factionId: control.factionId, troops: troops.count, isDefender: true }]
					: []),
				...Object.entries(troops.contestedTroops)
					.filter(([, count]) => count > 0)
					.map(([factionId, count]) => ({ factionId, troops: count, isDefender: false })),
			];

			if (initialCombatants.length < 2) {
				finalizeCombat(world, entity.id, country.countryId, initialCombatants, control);
				return;
			}

			const totalTroops = initialCombatants.reduce((sum, c) => sum + c.troops, 0);

			// Run up to 3 combat rounds via reduce
			const finalCombatants = [0, 1, 2].reduce(
				(combatants) => runCombatRound(combatants, totalTroops, supplyDistances, country.countryId, stability.current),
				initialCombatants,
			);

			finalizeCombat(world, entity.id, country.countryId, finalCombatants, control);
		});
}

function finalizeCombat(
	world: GameWorld,
	entityId: number,
	countryId: string,
	combatants: ReadonlyArray<Combatant>,
	currentControl: ControlComponent,
): void {
	const survivors = combatants.filter((c) => c.troops > 0);

	if (survivors.length === 0) {
		// Everyone wiped out
		world.entityManager.addComponent(entityId, "troops", { count: 0, contestedTroops: {} });
		world.entityManager.addComponent(entityId, "control", {
			factionId: null,
			annexed: false,
		});
		world.eventBus.publish("combatResolved", { countryId, winnerId: null });
		return;
	}

	if (survivors.length === 1) {
		// Clear winner
		const [winner] = survivors;
		if (!winner) return;
		world.entityManager.addComponent(entityId, "troops", {
			count: winner.troops,
			contestedTroops: {},
		});
		world.entityManager.addComponent(entityId, "control", {
			factionId: winner.factionId,
			annexed: currentControl.factionId === winner.factionId ? currentControl.annexed : false,
		});
		world.eventBus.publish("combatResolved", { countryId, winnerId: winner.factionId });
		return;
	}

	// Multiple survivors — remains contested
	const defender = survivors.find((c) => c.isDefender);
	const newCount = defender?.troops ?? 0;
	const newContested: Record<string, number> = {};

	survivors
		.filter((c) => !c.isDefender)
		.forEach((c) => {
			newContested[c.factionId] = c.troops;
		});

	// If there's no defender, the controlling faction's troops are 0
	world.entityManager.addComponent(entityId, "troops", {
		count: newCount,
		contestedTroops: newContested,
	});
	world.eventBus.publish("combatResolved", { countryId, winnerId: null });
}

function resolveReinforcement(world: GameWorld): void {
	const phase = world.getResource("currentPhase");
	if (phase !== "resolution") return;

	const factions = world.getResource("factions");
	const countryEntityMap = world.getResource("countryEntityMap");
	const allEntities = world.getEntitiesWithQuery(["country", "control", "troops", "stability"]);

	// Pre-group entities by faction to avoid repeated full queries
	const entitiesByFaction = allEntities.reduce((map, e) => {
		const fId = e.components.control.factionId;
		if (fId === null) return map;
		const existing = map.get(fId) ?? [];
		map.set(fId, [...existing, e]);
		return map;
	}, new Map<string, typeof allEntities>());

	factions.forEach((faction) => {
		const factionEntities = entitiesByFaction.get(faction.id) ?? [];

		// Calculate income inline from pre-queried entities
		const reinforcements = factionEntities.reduce(
			(sum, e) => sum + Math.floor(e.components.stability.current / 20), 0,
		);
		if (reinforcements <= 0) return;

		const annexedEntities = factionEntities.filter((e) => e.components.control.annexed);
		if (annexedEntities.length === 0) return;

		const perCapital = Math.floor(reinforcements / annexedEntities.length);
		const remainder = reinforcements % annexedEntities.length;

		const homeEntityId = countryEntityMap.get(faction.homeCountryId);

		annexedEntities.forEach((entity) => {
			const bonus = entity.id === homeEntityId ? remainder : 0;
			const addedTroops = perCapital + bonus;
			if (addedTroops <= 0) return;

			const currentTroops = entity.components.troops;
			world.entityManager.addComponent(entity.id, "troops", {
				count: currentTroops.count + addedTroops,
				contestedTroops: currentTroops.contestedTroops,
			});
		});
	});
}

function registerTurnSystems(world: GameWorld): void {
	// Movement system (priority 40)
	world.addSystem("resolution:movement")
		.setPriority(40)
		.runWhenEmpty()
		.setProcess(() => resolveMovement(world));

	// Combat system (priority 30)
	world.addSystem("resolution:combat")
		.setPriority(30)
		.runWhenEmpty()
		.setProcess(() => resolveCombat(world));

	// Influence system (priority 20) - stub for now
	world.addSystem("resolution:influence")
		.setPriority(20)
		.runWhenEmpty()
		.setProcess(({ ecs }) => {
			const phase = ecs.getResource("currentPhase");
			if (phase !== "resolution") return;
		});

	// Reinforcement system (priority 10)
	world.addSystem("resolution:reinforcement")
		.setPriority(10)
		.runWhenEmpty()
		.setProcess(() => resolveReinforcement(world));

	// Phase transition system - runs after all resolution systems
	world.addSystem("phaseTransition")
		.setPriority(0)
		.runWhenEmpty()
		.setProcess(({ ecs }) => {
			const phase = ecs.getResource("currentPhase");
			if (phase === "resolution") {
				advancePhase(ecs);
			}
		});

	// Handle endTurn event: transition from planning to resolution
	world.on("endTurn", () => {
		const phase = world.getResource("currentPhase");
		if (phase !== "planning") return;
		advancePhase(world);
	});

	// Handle notification -> planning transition
	// Guard on "notification" prevents re-entry when this publishes "planning"
	world.on("phaseChanged", ({ phase }) => {
		if (phase !== "notification") return;

		const turnNumber = world.getResource("turnNumber");
		world.eventBus.publish("turnResolved", { turnNumber });

		world.updateResource("turnNumber", (n) => n + 1);
		world.updateResource("currentPhase", () => "planning" as TurnPhase);
		world.updateResource("pendingOrders", () => new Map());
		world.eventBus.publish("phaseChanged", { phase: "planning" });
	});
}

function advancePhase(world: GameWorld): void {
	const current = world.getResource("currentPhase");
	const next = phaseTransitions[current];
	world.updateResource("currentPhase", () => next);
	world.eventBus.publish("phaseChanged", { phase: next });
}

export { registerTurnSystems };
