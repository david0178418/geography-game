import { useCallback, useMemo } from "react";
import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";
import { useInputAction } from "@/input/input-hooks.ts";
import {
	selectForAction,
	chooseAction,
	navigateActionMenu,
	adjustAmount,
	setAmount,
	confirmAmount,
	navigateSecondarySelection,
	confirmSecondarySelection,
	goBack,
} from "@/ecs/interaction-state.ts";
import type { InteractionState, ActionType, SelectContext } from "@/ecs/interaction-state.ts";
import { submitOrder, popLastOrder } from "@/ecs/orders.ts";
import { getAvailableInfluenceBudget } from "@/ecs/influenceBudget.ts";
import { ButtonGlyphMap } from "@/components/button-prompts/button-glyph-map.ts";
import { ButtonPromptsBar } from "@/components/button-prompts/index.tsx";
import { useContextualPrompts } from "@/hooks/useContextualPrompts.ts";
import type { ControllerType } from "@/input/input-types.ts";
import type { Order } from "@/types/ecs.ts";
import type { Faction } from "@/types/ecs.ts";
import type { GameWorld } from "@/ecs/world.ts";

function getAvailableActionsForCountry(
	world: GameWorld,
	countryId: string,
	factions: ReadonlyArray<Faction>,
	pendingOrders: ReadonlyMap<string, Order>,
	influenceBudgets: ReadonlyMap<string, number>,
): { actions: ReadonlyArray<ActionType>; sourceCountryId: string; targetCountryId: string | null } {
	const countryEntityMap = world.getResource("countryEntityMap");
	const playerFaction = factions.find((f) => f.isPlayer);
	if (!playerFaction) return { actions: [], sourceCountryId: countryId, targetCountryId: null };

	const entityId = countryEntityMap.get(countryId);
	if (entityId === undefined) return { actions: [], sourceCountryId: countryId, targetCountryId: null };
	const entity = world.getEntity(entityId);
	if (!entity) return { actions: [], sourceCountryId: countryId, targetCountryId: null };

	const { control, troops, adjacency } = entity.components;
	if (!control || !troops || !adjacency) return { actions: [], sourceCountryId: countryId, targetCountryId: null };

	const isPlayerCountry = control.factionId === playerFaction.id;

	if (isPlayerCountry) {
		// Player's own country: source is this country, target unknown
		const actions: ActionType[] = [];

		const committedTroops = [...pendingOrders.values()]
			.filter((o) => o.sourceCountryId === countryId && (o.type === "move" || o.type === "attack"))
			.reduce((sum, o) => sum + o.amount, 0);
		const availableTroops = troops.count - committedTroops;
		if (availableTroops > 0) actions.push('move');

		const availableBudget = getAvailableInfluenceBudget(playerFaction.id, pendingOrders, influenceBudgets);
		const hasNonPlayerAdjacent = adjacency.neighbors.some((nId) => {
			const nEntityId = countryEntityMap.get(nId);
			if (nEntityId === undefined) return false;
			const nEntity = world.getEntity(nEntityId);
			return nEntity?.components.control?.factionId !== playerFaction.id;
		});
		if (availableBudget > 0 && hasNonPlayerAdjacent) actions.push('influence');

		return { actions, sourceCountryId: countryId, targetCountryId: null };
	}

	// Adjacent non-player country: target is this country
	const playerAdjacent = adjacency.neighbors.filter((nId) => {
		const nEntityId = countryEntityMap.get(nId);
		if (nEntityId === undefined) return false;
		const nEntity = world.getEntity(nEntityId);
		return nEntity?.components.control?.factionId === playerFaction.id;
	});

	if (playerAdjacent.length === 0) return { actions: [], sourceCountryId: countryId, targetCountryId: null };

	const actions: ActionType[] = [];

	const hasAvailableTroops = playerAdjacent.some((pId) => {
		const pEntityId = countryEntityMap.get(pId);
		if (pEntityId === undefined) return false;
		const pEntity = world.getEntity(pEntityId);
		if (!pEntity?.components.troops) return false;
		const committed = [...pendingOrders.values()]
			.filter((o) => o.sourceCountryId === pId && (o.type === "move" || o.type === "attack"))
			.reduce((sum, o) => sum + o.amount, 0);
		return pEntity.components.troops.count - committed > 0;
	});
	if (hasAvailableTroops) actions.push('move');

	const availableBudget = getAvailableInfluenceBudget(playerFaction.id, pendingOrders, influenceBudgets);
	if (availableBudget > 0) actions.push('influence');

	// If only one player territory is adjacent, source is known.
	// If multiple, source is '' — will trigger secondarySelection for source resolution.
	return {
		actions,
		sourceCountryId: (playerAdjacent.length === 1 && playerAdjacent[0]) ? playerAdjacent[0] : '',
		targetCountryId: countryId,
	};
}

/**
 * Returns the list of valid options for the unknown side (target or source).
 * If both sides are known, returns empty (action completes immediately).
 * If source is '' (unknown), returns valid source countries.
 * If target is null (unknown), returns valid target countries.
 */
function getValidOptionsForAmount(
	world: GameWorld,
	state: Extract<InteractionState, { readonly mode: 'settingAmount' }>,
): ReadonlyArray<string> {
	const countryEntityMap = world.getResource("countryEntityMap");
	const factions = world.getResource("factions");
	const playerFaction = factions.find((f) => f.isPlayer);
	const pendingOrders = world.getResource("pendingOrders");

	// Source unknown — find player-controlled countries adjacent to target
	if (state.sourceCountryId === '' && state.targetCountryId !== null) {
		const targetEntityId = countryEntityMap.get(state.targetCountryId);
		if (targetEntityId === undefined) return [];
		const targetEntity = world.getEntity(targetEntityId);
		if (!targetEntity?.components.adjacency) return [];
		return targetEntity.components.adjacency.neighbors.filter((nId) => {
			const nEntityId = countryEntityMap.get(nId);
			if (nEntityId === undefined) return false;
			const nEntity = world.getEntity(nEntityId);
			if (nEntity?.components.control?.factionId !== playerFaction?.id) return false;
			if (state.actionType === 'move') {
				const committed = [...pendingOrders.values()]
					.filter((o) => o.sourceCountryId === nId && (o.type === "move" || o.type === "attack"))
					.reduce((sum, o) => sum + o.amount, 0);
				return (nEntity?.components.troops?.count ?? 0) - committed > 0;
			}
			return true;
		});
	}

	// Target unknown — find valid targets adjacent to source
	if (state.targetCountryId === null) {
		const entityId = countryEntityMap.get(state.sourceCountryId);
		if (entityId === undefined) return [];
		const entity = world.getEntity(entityId);
		if (!entity?.components.adjacency) return [];
		return entity.components.adjacency.neighbors.filter((nId) => {
			if (state.actionType === 'influence') {
				const nEntityId = countryEntityMap.get(nId);
				if (nEntityId === undefined) return false;
				const nEntity = world.getEntity(nEntityId);
				return nEntity?.components.control?.factionId !== playerFaction?.id;
			}
			return true;
		});
	}

	// Both known
	return [];
}

function ControlBar() {
	const world = useGameWorld();
	const interactionState = useEcsResource("interactionState");
	const currentPhase = useEcsResource("currentPhase");
	const factions = useEcsResource("factions");
	const pendingOrders = useEcsResource("pendingOrders");
	const influenceBudgets = useEcsResource("influenceBudgets");
	const turnNumber = useEcsResource("turnNumber");
	const activeInputMethod = useEcsResource("activeInputMethod");
	const prompts = useContextualPrompts(interactionState);
	const playerFaction = factions.find((f) => f.isPlayer);

	const isActionable = useMemo(() => {
		if (interactionState.mode !== 'focusing' || currentPhase !== 'planning') return false;
		const { actions } = getAvailableActionsForCountry(
			world, interactionState.countryId, factions, pendingOrders, influenceBudgets,
		);
		return actions.length > 0;
	}, [interactionState, currentPhase, world, factions, pendingOrders, influenceBudgets]);

	const maxAmount = useMemo(() => {
		if (interactionState.mode !== 'settingAmount') return 1;
		if (interactionState.actionType === 'move') {
			const committedTroops = [...pendingOrders.values()]
				.filter((o) => o.sourceCountryId === interactionState.sourceCountryId && (o.type === "move" || o.type === "attack"))
				.reduce((sum, o) => sum + o.amount, 0);
			const countryEntityMap = world.getResource("countryEntityMap");
			const entityId = countryEntityMap.get(interactionState.sourceCountryId);
			if (entityId === undefined) return 1;
			const entity = world.getEntity(entityId);
			return Math.max(1, (entity?.components.troops?.count ?? 0) - committedTroops);
		}
		if (!playerFaction) return 1;
		return Math.max(1, getAvailableInfluenceBudget(playerFaction.id, pendingOrders, influenceBudgets));
	}, [interactionState, pendingOrders, world, playerFaction, influenceBudgets]);

	// --- Input handlers ---

	const handleConfirm = useCallback(() => {
		if (interactionState.mode === 'focusing' && currentPhase === 'planning') {
			const { actions, sourceCountryId, targetCountryId } = getAvailableActionsForCountry(
				world, interactionState.countryId, factions, pendingOrders, influenceBudgets,
			);
			if (actions.length === 0) return;
			const context: SelectContext = { availableActions: actions, sourceCountryId, targetCountryId };
			world.setResource("interactionState", selectForAction(interactionState.countryId, context));
			return;
		}

		if (interactionState.mode === 'actionMenu') {
			const actionType = interactionState.availableActions[interactionState.focusedIndex];
			if (!actionType) return;
			const { sourceCountryId, targetCountryId } = getAvailableActionsForCountry(
				world, interactionState.countryId, factions, pendingOrders, influenceBudgets,
			);
			world.setResource("interactionState", chooseAction(interactionState, actionType, sourceCountryId, targetCountryId));
			return;
		}

		if (interactionState.mode === 'settingAmount') {
			const validOptions = getValidOptionsForAmount(world, interactionState);
			const result = confirmAmount(interactionState, validOptions);
			if (!result) return;
			if (result.outcome === 'complete') {
				if (!playerFaction) return;
				submitOrder(world, interactionState.actionType, result.sourceCountryId, result.targetCountryId, interactionState.amount, playerFaction.id);
				world.setResource("interactionState", { mode: 'focusing', countryId: interactionState.countryId });
				return;
			}
			// secondarySelection
			world.setResource("interactionState", result.state);
			return;
		}

		if (interactionState.mode === 'secondarySelection') {
			const result = confirmSecondarySelection(interactionState);
			if (!result || !playerFaction) return;
			submitOrder(world, interactionState.actionType, result.sourceCountryId, result.targetCountryId, interactionState.amount, playerFaction.id);
			world.setResource("interactionState", { mode: 'focusing', countryId: interactionState.countryId });
			return;
		}
	}, [world, interactionState, currentPhase, factions, pendingOrders, influenceBudgets, playerFaction]);

	const handleBack = useCallback(() => {
		if (interactionState.mode === 'focusing') {
			const popped = popLastOrder(world);
			if (popped) return; // Stay in focusing
			// No orders — deselect
			world.setResource("selectedCountryId", null);
			world.setResource("interactionState", { mode: 'idle' });
			return;
		}
		world.setResource("interactionState", goBack(interactionState, pendingOrders.size));
	}, [world, interactionState, pendingOrders]);

	const handleNavigateUp = useCallback(() => {
		if (interactionState.mode === 'actionMenu') {
			world.setResource("interactionState", navigateActionMenu(interactionState, -1));
			return;
		}
		if (interactionState.mode === 'secondarySelection') {
			world.setResource("interactionState", navigateSecondarySelection(interactionState, -1));
		}
	}, [world, interactionState]);

	const handleNavigateDown = useCallback(() => {
		if (interactionState.mode === 'actionMenu') {
			world.setResource("interactionState", navigateActionMenu(interactionState, 1));
			return;
		}
		if (interactionState.mode === 'secondarySelection') {
			world.setResource("interactionState", navigateSecondarySelection(interactionState, 1));
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

	const handleEndTurn = useCallback(() => {
		if (currentPhase === "planning" && (interactionState.mode === 'idle' || interactionState.mode === 'focusing')) {
			world.eventBus.publish("endTurn", undefined);
		}
	}, [world, currentPhase, interactionState.mode]);

	// Register input actions
	useInputAction('CONFIRM', handleConfirm);
	useInputAction('BACK', handleBack);
	useInputAction('NAVIGATE_UP', handleNavigateUp);
	useInputAction('NAVIGATE_DOWN', handleNavigateDown);
	useInputAction('INCREMENT', handleIncrement);
	useInputAction('DECREMENT', handleDecrement);
	useInputAction('END_TURN', handleEndTurn);

	// --- Render ---

	const showEndTurn = interactionState.mode === 'idle' || interactionState.mode === 'focusing';
	const showGlyph = activeInputMethod && activeInputMethod !== 'mouse' && activeInputMethod !== 'touch';
	const EndTurnGlyph = showGlyph
		? ButtonGlyphMap[activeInputMethod as ControllerType]?.['END_TURN']
		: null;

	return (
		<div className="control-bar">
			<div className="control-bar-content">
				{showEndTurn && (
					<div className="control-bar-turn">
						<span className="turn-counter">Turn {turnNumber}</span>
						<span className="phase-indicator">{currentPhase}</span>
						<button
							className="end-turn-btn"
							onClick={handleEndTurn}
							disabled={currentPhase !== "planning"}
						>
							{EndTurnGlyph && (
								<EndTurnGlyph
									width={20}
									height={20}
									viewBox="0 0 64 64"
									style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}
								/>
							)}
							End Turn
						</button>
					</div>
				)}

				{interactionState.mode === 'focusing' && isActionable && (
					<button className="control-bar-btn primary" onClick={handleConfirm}>
						Select
					</button>
				)}

				{interactionState.mode === 'actionMenu' && (
					<div className="control-bar-actions">
						{interactionState.availableActions.map((action, index) => (
							<button
								key={action}
								className={`control-bar-btn${index === interactionState.focusedIndex ? ' focused' : ''}`}
								onClick={() => {
									const { sourceCountryId, targetCountryId } = getAvailableActionsForCountry(
										world, interactionState.countryId, factions, pendingOrders, influenceBudgets,
									);
									world.setResource("interactionState", chooseAction(interactionState, action, sourceCountryId, targetCountryId));
								}}
							>
								{action === 'move' ? 'Move Troops' : 'Influence'}
							</button>
						))}
						<button className="control-bar-btn" onClick={handleBack}>Back</button>
					</div>
				)}

				{interactionState.mode === 'settingAmount' && (
					<div className="control-bar-actions">
						<span className="action-type-label">
							{interactionState.actionType === 'move' ? 'Move Troops' : 'Spend Influence'}
						</span>
						<div className="amount-stepper">
							<button onClick={() => world.setResource("interactionState", adjustAmount(interactionState, -1, 1, maxAmount))}>-</button>
							<span className="amount-value">{interactionState.amount}</span>
							<button onClick={() => world.setResource("interactionState", adjustAmount(interactionState, 1, 1, maxAmount))}>+</button>
						</div>
						<input
							type="range"
							min={1}
							max={Math.max(1, maxAmount)}
							value={interactionState.amount}
							onChange={(e) => world.setResource("interactionState", setAmount(interactionState, Number(e.target.value), 1, maxAmount))}
						/>
						<button className="control-bar-btn primary" onClick={handleConfirm}>Confirm</button>
						<button className="control-bar-btn" onClick={handleBack}>Back</button>
					</div>
				)}

				{interactionState.mode === 'secondarySelection' && (
					<div className="control-bar-actions">
						<span className="action-type-label">
							{interactionState.role === 'target' ? 'Select Target' : 'Select Source'}
						</span>
						<div className="secondary-selection-list">
							{interactionState.validOptions.map((optionId, index) => {
								const countryEntityMap = world.getResource("countryEntityMap");
								const optEntityId = countryEntityMap.get(optionId);
								const optEntity = optEntityId !== undefined ? world.getEntity(optEntityId) : null;
								const name = optEntity?.components.country?.name ?? optionId;
								return (
									<button
										key={optionId}
										className={`control-bar-btn${index === interactionState.focusedIndex ? ' focused' : ''}`}
										onClick={() => {
											const result = confirmSecondarySelection({
												...interactionState,
												focusedIndex: index,
											});
											if (!result || !playerFaction) return;
											submitOrder(world, interactionState.actionType, result.sourceCountryId, result.targetCountryId, interactionState.amount, playerFaction.id);
											world.setResource("interactionState", { mode: 'focusing', countryId: interactionState.countryId });
										}}
									>
										{name}
									</button>
								);
							})}
						</div>
						<button className="control-bar-btn" onClick={handleBack}>Back</button>
					</div>
				)}
			</div>

			{showGlyph && (
				<div className="control-bar-prompts">
					<ButtonPromptsBar
						controllerType={activeInputMethod as ControllerType}
						prompts={[...prompts]}
					/>
				</div>
			)}
		</div>
	);
}

export { ControlBar };
