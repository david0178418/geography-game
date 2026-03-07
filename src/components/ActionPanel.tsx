import { useState } from "react";
import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";
import type { Order } from "@/types/ecs.ts";

function orderToId(order: Order): string {
	return `${order.type}-${order.sourceCountryId}-${order.targetCountryId}`;
}

function ActionPanel() {
	const world = useGameWorld();
	const selectedCountryId = useEcsResource("selectedCountryId");
	const currentPhase = useEcsResource("currentPhase");
	const factions = useEcsResource("factions");
	const countryEntityMap = useEcsResource("countryEntityMap");
	const pendingOrders = useEcsResource("pendingOrders");

	const [moveTarget, setMoveTarget] = useState<string | null>(null);
	const [moveAmount, setMoveAmount] = useState(1);
	const [influenceTarget, setInfluenceTarget] = useState<string | null>(null);
	const [influenceAmount, setInfluenceAmount] = useState(1);

	const playerFaction = factions.find((f) => f.isPlayer);

	if (!selectedCountryId || currentPhase !== "planning" || !playerFaction) return null;

	const entityId = countryEntityMap.get(selectedCountryId);
	if (entityId === undefined) return null;

	const entities = world.getEntitiesWithQuery(
		["country", "control", "troops", "adjacency"],
	);
	const entity = entities.find((e) => e.id === entityId);
	if (!entity) return null;

	const { control, troops, adjacency } = entity.components;

	if (control.factionId !== playerFaction.id) return null;

	const ordersForCountry = [...pendingOrders.values()].filter(
		(o) => o.sourceCountryId === selectedCountryId,
	);

	const committedTroops = ordersForCountry
		.filter((o) => o.type === "move" || o.type === "attack")
		.reduce((sum, o) => sum + o.amount, 0);

	const availableTroops = troops.count - committedTroops;

	function queueOrder(order: Order) {
		const orderId = orderToId(order);
		world.updateResource("pendingOrders", (orders) => {
			const next = new Map(orders);
			next.set(orderId, order);
			return next;
		});
		world.eventBus.publish("orderSubmitted", { order });
	}

	function cancelOrder(orderId: string) {
		world.updateResource("pendingOrders", (orders) => {
			const next = new Map(orders);
			next.delete(orderId);
			return next;
		});
	}

	function handleMoveTroops() {
		if (!moveTarget || moveAmount <= 0 || moveAmount > availableTroops) return;
		queueOrder({
			type: "move",
			sourceCountryId: selectedCountryId,
			targetCountryId: moveTarget,
			amount: moveAmount,
		});
		setMoveTarget(null);
		setMoveAmount(1);
	}

	function handleSpendInfluence() {
		if (!influenceTarget || influenceAmount <= 0) return;
		queueOrder({
			type: "influence",
			sourceCountryId: selectedCountryId,
			targetCountryId: influenceTarget,
			amount: influenceAmount,
		});
		setInfluenceTarget(null);
		setInfluenceAmount(1);
	}

	return (
		<div className="action-panel">
			<h3>Actions</h3>

			<div className="action-section">
				<h4>Move Troops ({availableTroops} available)</h4>
				<select
					value={moveTarget ?? ""}
					onChange={(e) => setMoveTarget(e.target.value || null)}
				>
					<option value="">Select target...</option>
					{adjacency.neighbors.map((n) => (
						<option key={n} value={n}>{n}</option>
					))}
				</select>
				<input
					type="range"
					min={1}
					max={Math.max(1, availableTroops)}
					value={moveAmount}
					onChange={(e) => setMoveAmount(Number(e.target.value))}
					disabled={availableTroops <= 0}
				/>
				<span>{moveAmount}</span>
				<button
					onClick={handleMoveTroops}
					disabled={!moveTarget || moveAmount <= 0 || moveAmount > availableTroops}
				>
					Move
				</button>
			</div>

			<div className="action-section">
				<h4>Spend Influence</h4>
				<select
					value={influenceTarget ?? ""}
					onChange={(e) => setInfluenceTarget(e.target.value || null)}
				>
					<option value="">Select target...</option>
					{adjacency.neighbors.map((n) => (
						<option key={n} value={n}>{n}</option>
					))}
				</select>
				<input
					type="number"
					min={1}
					value={influenceAmount}
					onChange={(e) => setInfluenceAmount(Number(e.target.value))}
				/>
				<button
					onClick={handleSpendInfluence}
					disabled={!influenceTarget || influenceAmount <= 0}
				>
					Assign
				</button>
			</div>

			{ordersForCountry.length > 0 && (
				<div className="action-section">
					<h4>Queued Orders</h4>
					{ordersForCountry.map((order) => {
						const orderId = orderToId(order);
						return (
							<div key={orderId} className="queued-order">
								<span>
									{order.type} {order.amount} → {order.targetCountryId}
								</span>
								<button
									className="cancel-order-btn"
									onClick={() => cancelOrder(orderId)}
								>
									Cancel
								</button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

export { ActionPanel };
