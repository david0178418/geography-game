import type { Order } from "@/types/ecs.ts";
import type { GameWorld } from "./world.ts";

function orderToId(order: Order): string {
	return `${order.type}-${order.sourceCountryId}-${order.targetCountryId}`;
}

function removeOrder(world: GameWorld, orderId: string): void {
	world.updateResource("pendingOrders", (orders) => {
		const next = new Map(orders);
		next.delete(orderId);
		return next;
	});
}

function popLastOrder(world: GameWorld): Order | null {
	const orders = world.getResource("pendingOrders");
	const values = [...orders.values()];
	const last = values.at(-1);
	if (!last) return null;
	removeOrder(world, orderToId(last));
	return last;
}

function submitOrder(
	world: GameWorld,
	actionType: 'move' | 'influence',
	sourceCountryId: string,
	targetCountryId: string,
	amount: number,
	factionId: string,
): void {
	const order: Order = {
		type: actionType === 'move' ? 'move' : 'influence',
		sourceCountryId,
		targetCountryId,
		amount,
		factionId,
	};
	const orderId = orderToId(order);
	world.updateResource("pendingOrders", (orders) => {
		const next = new Map(orders);
		next.set(orderId, order);
		return next;
	});
	world.eventBus.publish("orderSubmitted", { order });
}

export { orderToId, removeOrder, popLastOrder, submitOrder };
