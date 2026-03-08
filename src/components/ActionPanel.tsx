import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";
import { getAvailableInfluenceBudget } from "@/ecs/influenceBudget.ts";
import { chooseAction, setAmount, enterTargetSelection, adjustAmount, goBack, cycleActionType } from "@/ecs/interaction-state.ts";
import type { Order } from "@/types/ecs.ts";
import { useInputAction } from "@/input/input-hooks.ts";
import { useCallback } from "react";

function orderToId(order: Order): string {
	return `${order.type}-${order.sourceCountryId}-${order.targetCountryId}`;
}

function ActionPanel() {
	const world = useGameWorld();
	const currentPhase = useEcsResource("currentPhase");
	const factions = useEcsResource("factions");
	const countryEntityMap = useEcsResource("countryEntityMap");
	const pendingOrders = useEcsResource("pendingOrders");
	const influenceBudgets = useEcsResource("influenceBudgets");
	const interactionState = useEcsResource("interactionState");

	const playerFaction = factions.find((f) => f.isPlayer);

	const countryId = interactionState.mode !== 'idle' ? interactionState.countryId : null;

	const entityId = countryId ? countryEntityMap.get(countryId) : undefined;
	const entity = entityId !== undefined ? world.getEntity(entityId) : null;

	const control = entity?.components.control;
	const troops = entity?.components.troops;

	const isPlayerCountry = control?.factionId === playerFaction?.id;
	const playerFactionId = playerFaction?.id ?? '';

	const ordersForCountry = countryId
		? [...pendingOrders.values()].filter((o) => o.sourceCountryId === countryId)
		: [];

	const committedTroops = ordersForCountry
		.filter((o) => o.type === "move" || o.type === "attack")
		.reduce((sum, o) => sum + o.amount, 0);

	const availableTroops = (troops?.count ?? 0) - committedTroops;
	const availableBudget = playerFactionId
		? getAvailableInfluenceBudget(playerFactionId, pendingOrders, influenceBudgets)
		: 0;

	const maxAmount = interactionState.mode === 'settingAmount' || interactionState.mode === 'selectingTarget'
		? (interactionState.actionType === 'move' ? availableTroops : availableBudget)
		: 1;

	const handleBack = useCallback(() => {
		world.setResource("interactionState", goBack(interactionState));
		if (interactionState.mode === 'countrySelected' || interactionState.mode === 'idle') {
			world.setResource("selectedCountryId", null);
		}
	}, [world, interactionState]);

	const handleIncrement = useCallback(() => {
		if (interactionState.mode === 'settingAmount') {
			world.setResource("interactionState", adjustAmount(interactionState, 1, 1, maxAmount));
		}
	}, [world, interactionState, maxAmount]);

	const handleDecrement = useCallback(() => {
		if (interactionState.mode === 'settingAmount') {
			world.setResource("interactionState", adjustAmount(interactionState, -1, 1, maxAmount));
		}
	}, [world, interactionState, maxAmount]);

	const handleConfirm = useCallback(() => {
		if (interactionState.mode === 'countrySelected' && isPlayerCountry && currentPhase === 'planning') {
			// Enter choosing action, default to 'move' if troops available, otherwise 'influence'
			const defaultAction = availableTroops > 0 ? 'move' as const : 'influence' as const;
			const next = chooseAction(interactionState, defaultAction);
			world.setResource("interactionState", next);
			return;
		}
		if (interactionState.mode === 'choosingAction') {
			// Confirm the chosen action type → move to setting amount
			world.setResource("interactionState", setAmount(interactionState, 1));
			return;
		}
		if (interactionState.mode === 'settingAmount') {
			world.setResource("interactionState", enterTargetSelection(interactionState));
			return;
		}
	}, [world, interactionState, isPlayerCountry, currentPhase, availableTroops]);

	const handleCycleAction = useCallback(() => {
		if (interactionState.mode === 'choosingAction') {
			world.setResource("interactionState", cycleActionType(interactionState));
		}
	}, [world, interactionState]);

	useInputAction('BACK', handleBack);
	useInputAction('INCREMENT', handleIncrement);
	useInputAction('DECREMENT', handleDecrement);
	useInputAction('CONFIRM', handleConfirm);
	useInputAction('CYCLE_ACTION', handleCycleAction);

	function cancelOrder(orderId: string) {
		world.updateResource("pendingOrders", (orders) => {
			const next = new Map(orders);
			next.delete(orderId);
			return next;
		});
	}

	function handleChooseAction(actionType: 'move' | 'influence') {
		const next = chooseAction(interactionState, actionType);
		world.setResource("interactionState", setAmount(next, 1));
	}

	function handleSetAmount(amount: number) {
		world.setResource("interactionState", setAmount(interactionState, amount));
	}

	const showPanel = countryId && currentPhase === "planning" && playerFaction && isPlayerCountry;
	if (!showPanel) {
		return ordersForCountry.length > 0 ? (
			<div className="action-panel">
				<h3>Queued Orders</h3>
				<div className="action-section">
					{ordersForCountry.map((order) => {
						const id = orderToId(order);
						return (
							<div key={id} className="queued-order">
								<span>{order.type} {order.amount} → {order.targetCountryId}</span>
								<button className="cancel-order-btn" onClick={() => cancelOrder(id)}>Cancel</button>
							</div>
						);
					})}
				</div>
			</div>
		) : null;
	}

	return (
		<div className="action-panel">
			<h3>Actions</h3>

			{interactionState.mode === 'countrySelected' && (
				<div className="action-section">
					<button
						onClick={() => handleChooseAction('move')}
						disabled={availableTroops <= 0}
					>
						Move Troops ({availableTroops} available)
					</button>
					<button
						onClick={() => handleChooseAction('influence')}
						disabled={availableBudget <= 0}
					>
						Spend Influence ({availableBudget} available)
					</button>
				</div>
			)}

			{interactionState.mode === 'choosingAction' && (
				<div className="action-section">
					<h4>
						{interactionState.actionType === 'move' ? 'Move Troops' : 'Spend Influence'}
					</h4>
					<p style={{ opacity: 0.5, fontSize: '0.75rem', margin: '0.25rem 0' }}>
						Press Confirm to proceed, or Cycle to switch action type
					</p>
					<button onClick={handleConfirm}>Confirm</button>
					<button onClick={handleCycleAction}>
						Switch to {interactionState.actionType === 'move' ? 'Influence' : 'Move'}
					</button>
					<button onClick={handleBack}>Back</button>
				</div>
			)}

			{interactionState.mode === 'settingAmount' && (
				<div className="action-section">
					<h4>
						{interactionState.actionType === 'move' ? 'Move Troops' : 'Spend Influence'}
					</h4>
					<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
						<button onClick={() => handleSetAmount(Math.max(1, interactionState.amount - 1))}>-</button>
						<span style={{ minWidth: '2rem', textAlign: 'center' }}>{interactionState.amount}</span>
						<button onClick={() => handleSetAmount(Math.min(maxAmount, interactionState.amount + 1))}>+</button>
					</div>
					<input
						type="range"
						min={1}
						max={Math.max(1, maxAmount)}
						value={interactionState.amount}
						onChange={(e) => handleSetAmount(Number(e.target.value))}
					/>
					<button onClick={handleConfirm}>Select Target on Map</button>
					<button onClick={handleBack}>Back</button>
				</div>
			)}

			{interactionState.mode === 'selectingTarget' && (
				<div className="action-section">
					<h4>Select Target</h4>
					<p style={{ opacity: 0.7, margin: '0.25rem 0' }}>
						Click an adjacent country on the map
					</p>
					<p style={{ opacity: 0.5, fontSize: '0.75rem', margin: '0.25rem 0' }}>
						{interactionState.actionType === 'move' ? 'Moving' : 'Influencing'} {interactionState.amount} from {countryId}
					</p>
					<button onClick={handleBack}>Back</button>
				</div>
			)}

			{ordersForCountry.length > 0 && (
				<div className="action-section">
					<h4>Queued Orders</h4>
					{ordersForCountry.map((order) => {
						const id = orderToId(order);
						return (
							<div key={id} className="queued-order">
								<span>{order.type} {order.amount} → {order.targetCountryId}</span>
								<button className="cancel-order-btn" onClick={() => cancelOrder(id)}>Cancel</button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

export { ActionPanel };
