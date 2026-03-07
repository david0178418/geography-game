import type { GameWorld } from "./world.ts";
import type { Order } from "@/types/ecs.ts";

function computeInfluenceBudgets(
	world: Pick<GameWorld, "getEntitiesWithQuery" | "getResource">,
): Map<string, number> {
	const entities = world.getEntitiesWithQuery(["country", "control", "stability"]);
	const factions = world.getResource("factions");

	const budgets = new Map<string, number>();
	factions.forEach((faction) => {
		budgets.set(faction.id, 0);
	});

	entities.forEach((entity) => {
		const factionId = entity.components.control.factionId;
		if (factionId === null) return;
		const points = Math.floor(entity.components.stability.current / 25);
		budgets.set(factionId, (budgets.get(factionId) ?? 0) + points);
	});

	return budgets;
}

function getAvailableInfluenceBudget(
	factionId: string,
	pendingOrders: ReadonlyMap<string, Order>,
	budgets: ReadonlyMap<string, number>,
): number {
	const total = budgets.get(factionId) ?? 0;
	const spent = [...pendingOrders.values()]
		.filter((o) => o.type === "influence" && o.factionId === factionId)
		.reduce((sum, o) => sum + o.amount, 0);
	return total - spent;
}

export { computeInfluenceBudgets, getAvailableInfluenceBudget };
