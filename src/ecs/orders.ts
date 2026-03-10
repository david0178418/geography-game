import type { Order } from "@/types/ecs.ts";
import type { GameWorld } from "./world.ts";
import type { InteractionState } from "./interaction-state.ts";
import { selectCountry } from "./interaction-state.ts";

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

function submitNewOrder(
	world: GameWorld,
	interactionState: Extract<InteractionState, { readonly mode: 'selectingTarget' }>,
	targetCountryId: string,
	factionId: string,
): void {
	const order: Order = {
		type: interactionState.actionType === 'move' ? 'move' : 'influence',
		sourceCountryId: interactionState.countryId,
		targetCountryId,
		amount: interactionState.amount,
		factionId,
	};
	const orderId = orderToId(order);
	world.updateResource("pendingOrders", (orders) => {
		const next = new Map(orders);
		next.set(orderId, order);
		return next;
	});
	world.eventBus.publish("orderSubmitted", { order });
	world.setResource("interactionState", selectCountry(interactionState.countryId));
}

export { orderToId, removeOrder, submitNewOrder };
