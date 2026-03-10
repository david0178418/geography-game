import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";
import { getAvailableInfluenceBudget } from "@/ecs/influenceBudget.ts";
import { getBlocsForCountry } from "@/data/blocs.ts";
import { getControlStateForCountry } from "@/ecs/controlStates.ts";
import { startSettingAmount, enterTargetSelection, navigateTargetList, adjustAmount, goBack } from "@/ecs/interaction-state.ts";
import { orderToId, removeOrder, submitNewOrder } from "@/ecs/orders.ts";
import type { Order } from "@/types/ecs.ts";
import type { GlobeHandle } from "@/rendering/index.ts";
import { useInputAction } from "@/input/input-hooks.ts";
import { useGlobeProjection } from "@/hooks/useGlobeProjection.ts";

interface TargetInfo {
	readonly countryId: string;
	readonly name: string;
	readonly troops: number;
	readonly controllerName: string | null;
	readonly controllerColor: string | null;
	readonly influenceLevels: ReadonlyArray<{ readonly factionName: string; readonly factionColor: string; readonly value: number }>;
}

const CARD_WIDTH = 280;
const CARD_MARGIN = 16;
const CARD_OFFSET_X = 30;
const CARD_OFFSET_Y = -20;

interface CountryCardProps {
	readonly globeHandle: GlobeHandle | null;
}

function CountryCard({ globeHandle }: CountryCardProps) {
	const world = useGameWorld();
	const selectedCountryId = useEcsResource("selectedCountryId");
	const currentPhase = useEcsResource("currentPhase");
	const factions = useEcsResource("factions");
	const countryEntityMap = useEcsResource("countryEntityMap");
	const pendingOrders = useEcsResource("pendingOrders");
	const influenceBudgets = useEcsResource("influenceBudgets");
	const interactionState = useEcsResource("interactionState");

	const entityId = selectedCountryId ? countryEntityMap.get(selectedCountryId) : undefined;
	const entity = entityId !== undefined ? world.getEntity(entityId) : null;
	const capitalCoords = entity?.components.country?.capitalCoordinates ?? null;

	const cardPos = useGlobeProjection(globeHandle, capitalCoords, {
		cardWidth: CARD_WIDTH,
		margin: CARD_MARGIN,
		offsetX: CARD_OFFSET_X,
		offsetY: CARD_OFFSET_Y,
	});

	const playerFaction = factions.find((f) => f.isPlayer);

	const ordersForCountry = useMemo(() =>
		selectedCountryId
			? [...pendingOrders.values()].filter((o) => o.sourceCountryId === selectedCountryId)
			: [],
		[pendingOrders, selectedCountryId],
	);

	const handleCancelOrder = useCallback((orderId: string) => {
		removeOrder(world, orderId);
	}, [world]);

	if (!selectedCountryId || !entity) return null;

	const { country, control, troops, stability, influence, adjacency } = entity.components;
	if (!country || !control || !troops || !stability || !influence || !adjacency) return null;

	const controllingFaction = factions.find((f) => f.id === control.factionId);
	const isPlayerCountry = control.factionId === playerFaction?.id;
	const playerFactionId = playerFaction?.id ?? '';
	const blocs = getBlocsForCountry(country.countryId);
	const controlState = getControlStateForCountry(influence.factionInfluence, stability.current);

	const influenceEntries = Object.entries(influence.factionInfluence)
		.filter(([, value]) => value > 0)
		.sort(([, a], [, b]) => b - a);

	const committedTroops = ordersForCountry
		.filter((o) => o.type === "move" || o.type === "attack")
		.reduce((sum, o) => sum + o.amount, 0);
	const availableTroops = troops.count - committedTroops;
	const availableBudget = playerFactionId
		? getAvailableInfluenceBudget(playerFactionId, pendingOrders, influenceBudgets)
		: 0;
	const showActions = currentPhase === "planning" && playerFaction && isPlayerCountry;

	const cardStyle: React.CSSProperties = {
		transform: `translate(${cardPos.x}px, ${cardPos.y}px)`,
		opacity: cardPos.visible ? 1 : 0,
	};

	return (
		<div className="country-card" style={cardStyle}>
			<CountryInfoSection
				countryName={country.name}
				capitalName={country.capitalName}
				controllingFaction={controllingFaction ?? null}
				controlState={controlState}
				troops={troops.count}
				stability={stability.current}
				influenceEntries={influenceEntries}
				blocs={blocs}
				factions={factions}
			/>

			{showActions && (
				<ActionSection
					countryId={selectedCountryId}
					availableTroops={availableTroops}
					availableBudget={availableBudget}
					ordersForCountry={ordersForCountry}
				/>
			)}

			{!showActions && ordersForCountry.length > 0 && (
				<OrdersList
					orders={ordersForCountry}
					focusedIndex={-1}
					onCancel={handleCancelOrder}
					onFocus={() => {}}
				/>
			)}

			{interactionState.mode !== 'selectingTarget' && (
				<div className="card-section">
					<h4>Adjacent</h4>
					<div className="adjacent-list">
						{adjacency.neighbors.map((neighborId) => (
							<button
								key={neighborId}
								className="adjacent-btn"
								onClick={() => world.setResource("selectedCountryId", neighborId)}
							>
								{neighborId}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

// --- Sub-components ---

interface CountryInfoSectionProps {
	readonly countryName: string;
	readonly capitalName: string;
	readonly controllingFaction: { readonly name: string; readonly color: string } | null;
	readonly controlState: ReturnType<typeof getControlStateForCountry>;
	readonly troops: number;
	readonly stability: number;
	readonly influenceEntries: ReadonlyArray<readonly [string, number]>;
	readonly blocs: ReadonlyArray<string>;
	readonly factions: ReadonlyArray<{ readonly id: string; readonly name: string; readonly color: string }>;
}

function CountryInfoSection({
	countryName,
	capitalName,
	controllingFaction,
	controlState,
	troops,
	stability,
	influenceEntries,
	blocs,
	factions,
}: CountryInfoSectionProps) {
	return (
		<>
			<h3 className="card-title">{countryName}</h3>
			<div className="card-info-grid">
				<span className="info-label">Capital</span>
				<span>{capitalName}</span>
				<span className="info-label">Controller</span>
				<span>
					{controllingFaction ? (
						<>
							<span className="faction-swatch" style={{ backgroundColor: controllingFaction.color }} />
							{controllingFaction.name}
						</>
					) : "Uncontrolled"}
				</span>
				{controlState.dominantFactionId && (
					<>
						<span className="info-label">Influence</span>
						<span>
							{controlState.state} ({factions.find((f) => f.id === controlState.dominantFactionId)?.name ?? controlState.dominantFactionId})
						</span>
					</>
				)}
				<span className="info-label">Troops</span>
				<span>{troops}</span>
				<span className="info-label">Stability</span>
				<div className="stability-bar-container">
					<div className="stability-bar-fill" style={{ width: `${stability}%` }} />
					<span className="stability-bar-text">{stability}</span>
				</div>
			</div>

			{influenceEntries.length > 0 && (
				<div className="card-section">
					<h4>Influence</h4>
					{influenceEntries.map(([factionId, value]) => {
						const faction = factions.find((f) => f.id === factionId);
						return (
							<div key={factionId} className="influence-row">
								<span className="faction-swatch" style={{ backgroundColor: faction?.color ?? "#888" }} />
								<span>{faction?.name ?? factionId}</span>
								<span className="influence-value">{value}</span>
							</div>
						);
					})}
				</div>
			)}

			{blocs.length > 0 && (
				<div className="card-section">
					<h4>Regional Blocs</h4>
					<div className="blocs-list">
						{blocs.map((bloc) => (
							<span key={bloc} className="bloc-tag">{bloc}</span>
						))}
					</div>
				</div>
			)}
		</>
	);
}

interface ActionSectionProps {
	readonly countryId: string;
	readonly availableTroops: number;
	readonly availableBudget: number;
	readonly ordersForCountry: ReadonlyArray<Order>;
}

function ActionSection({
	countryId,
	availableTroops,
	availableBudget,
	ordersForCountry,
}: ActionSectionProps) {
	const world = useGameWorld();
	const interactionState = useEcsResource("interactionState");
	const factions = useEcsResource("factions");
	const countryEntityMap = useEcsResource("countryEntityMap");
	const playerFaction = factions.find((f) => f.isPlayer);

	const [focusedOrderIndex, setFocusedOrderIndex] = useState(-1);
	const prevModeRef = useRef(interactionState.mode);
	const prevOrderCountRef = useRef(ordersForCountry.length);

	// Reset order focus synchronously when mode or order count changes
	if (prevModeRef.current !== interactionState.mode || prevOrderCountRef.current !== ordersForCountry.length) {
		prevModeRef.current = interactionState.mode;
		prevOrderCountRef.current = ordersForCountry.length;
		if (focusedOrderIndex !== -1) {
			setFocusedOrderIndex(-1);
		}
	}

	const maxAmount = interactionState.mode === 'settingAmount' || interactionState.mode === 'selectingTarget'
		? (interactionState.actionType === 'move' ? availableTroops : availableBudget)
		: 1;

	const selectingCountryId = interactionState.mode === 'selectingTarget' ? interactionState.countryId : null;

	const validTargets: ReadonlyArray<TargetInfo> = useMemo(() => {
		if (!selectingCountryId) return [];
		const sourceEntityId = countryEntityMap.get(selectingCountryId);
		if (sourceEntityId === undefined) return [];
		const sourceEntity = world.getEntity(sourceEntityId);
		if (!sourceEntity) return [];
		const neighbors = sourceEntity.components.adjacency?.neighbors ?? [];

		return neighbors.flatMap((neighborId) => {
			const nEntityId = countryEntityMap.get(neighborId);
			if (nEntityId === undefined) return [];
			const nEntity = world.getEntity(nEntityId);
			if (!nEntity) return [];
			const { country: nCountry, control: nControl, troops: nTroops, influence: nInfluence } = nEntity.components;
			if (!nCountry) return [];

			const controllerFaction = nControl?.factionId
				? factions.find((f) => f.id === nControl.factionId)
				: null;

			const influenceLevels = nInfluence
				? Object.entries(nInfluence.factionInfluence)
					.filter(([, value]) => value > 0)
					.sort(([, a], [, b]) => b - a)
					.map(([fId, value]) => {
						const f = factions.find((faction) => faction.id === fId);
						return { factionName: f?.name ?? fId, factionColor: f?.color ?? "#888", value };
					})
				: [];

			return [{
				countryId: neighborId,
				name: nCountry.name,
				troops: nTroops?.count ?? 0,
				controllerName: controllerFaction?.name ?? null,
				controllerColor: controllerFaction?.color ?? null,
				influenceLevels,
			}];
		});
	}, [selectingCountryId, countryEntityMap, world, factions]);

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

	const handleSubmitOrder = useCallback((targetCountryId: string) => {
		if (interactionState.mode !== 'selectingTarget') return;
		if (!playerFaction) return;
		submitNewOrder(world, interactionState, targetCountryId, playerFaction.id);
	}, [world, interactionState, playerFaction]);

	const handleConfirm = useCallback(() => {
		if (interactionState.mode === 'countrySelected') {
			const defaultAction = availableTroops > 0 ? 'move' as const : 'influence' as const;
			const hasResource = defaultAction === 'move' ? availableTroops > 0 : availableBudget > 0;
			if (!hasResource) return;
			world.setResource("interactionState", startSettingAmount(interactionState, defaultAction, 1));
			return;
		}
		if (interactionState.mode === 'settingAmount') {
			world.setResource("interactionState", enterTargetSelection(interactionState));
			return;
		}
		if (interactionState.mode === 'selectingTarget' && validTargets.length > 0) {
			const target = validTargets[interactionState.focusedTargetIndex];
			if (target) {
				handleSubmitOrder(target.countryId);
			}
		}
	}, [world, interactionState, validTargets, handleSubmitOrder, availableTroops, availableBudget]);

	const handleNavigateUp = useCallback(() => {
		if (interactionState.mode === 'selectingTarget') {
			world.setResource("interactionState", navigateTargetList(interactionState, -1, validTargets.length));
			return;
		}
		if (interactionState.mode === 'countrySelected' && ordersForCountry.length > 0) {
			setFocusedOrderIndex((prev) =>
				prev <= 0 ? ordersForCountry.length - 1 : prev - 1
			);
		}
	}, [world, interactionState, validTargets.length, ordersForCountry.length]);

	const handleNavigateDown = useCallback(() => {
		if (interactionState.mode === 'selectingTarget') {
			world.setResource("interactionState", navigateTargetList(interactionState, 1, validTargets.length));
			return;
		}
		if (interactionState.mode === 'countrySelected' && ordersForCountry.length > 0) {
			setFocusedOrderIndex((prev) =>
				prev >= ordersForCountry.length - 1 ? 0 : prev + 1
			);
		}
	}, [world, interactionState, validTargets.length, ordersForCountry.length]);

	const handleCancelOrder = useCallback(() => {
		if (focusedOrderIndex < 0 || focusedOrderIndex >= ordersForCountry.length) return;
		const order = ordersForCountry[focusedOrderIndex];
		if (!order) return;
		removeOrder(world, orderToId(order));
		setFocusedOrderIndex((prev) => Math.min(prev, ordersForCountry.length - 2));
	}, [focusedOrderIndex, ordersForCountry, world]);

	const handleSwitchActionType = useCallback(() => {
		if (interactionState.mode !== 'settingAmount') return;
		const nextType = interactionState.actionType === 'move' ? 'influence' as const : 'move' as const;
		const hasResource = nextType === 'move' ? availableTroops > 0 : availableBudget > 0;
		if (!hasResource) return;
		world.setResource("interactionState", startSettingAmount(interactionState, nextType, 1));
	}, [world, interactionState, availableTroops, availableBudget]);

	useInputAction('BACK', handleBack);
	useInputAction('INCREMENT', handleIncrement);
	useInputAction('DECREMENT', handleDecrement);
	useInputAction('CONFIRM', handleConfirm);
	useInputAction('CANCEL_ORDER', handleCancelOrder);
	useInputAction('NAVIGATE_UP', handleNavigateUp);
	useInputAction('NAVIGATE_DOWN', handleNavigateDown);
	useInputAction('NAVIGATE_LEFT', handleSwitchActionType);
	useInputAction('NAVIGATE_RIGHT', handleSwitchActionType);

	const handleClickCancel = useCallback((orderId: string) => {
		removeOrder(world, orderId);
	}, [world]);

	function handleChooseAction(actionType: 'move' | 'influence') {
		world.setResource("interactionState", startSettingAmount(interactionState, actionType, 1));
	}

	function handleSetAmount(amount: number) {
		if (interactionState.mode !== 'settingAmount') return;
		world.setResource("interactionState", startSettingAmount(interactionState, interactionState.actionType, amount));
	}

	return (
		<div className="card-section card-actions">
			<h4>Actions</h4>

			{interactionState.mode === 'countrySelected' && (
				<div className="action-buttons">
					<button
						onClick={() => handleChooseAction('move')}
						disabled={availableTroops <= 0}
					>
						Move Troops ({availableTroops})
					</button>
					<button
						onClick={() => handleChooseAction('influence')}
						disabled={availableBudget <= 0}
					>
						Spend Influence ({availableBudget})
					</button>
				</div>
			)}

			{interactionState.mode === 'settingAmount' && (
				<div className="action-buttons">
					<h4 className="action-type-label">
						{interactionState.actionType === 'move' ? 'Move Troops' : 'Spend Influence'}
					</h4>
					<div className="amount-stepper">
						<button onClick={() => handleSetAmount(Math.max(1, interactionState.amount - 1))}>-</button>
						<span className="amount-value">{interactionState.amount}</span>
						<button onClick={() => handleSetAmount(Math.min(maxAmount, interactionState.amount + 1))}>+</button>
					</div>
					<input
						type="range"
						min={1}
						max={Math.max(1, maxAmount)}
						value={interactionState.amount}
						onChange={(e) => handleSetAmount(Number(e.target.value))}
					/>
					<button onClick={() => world.setResource("interactionState", enterTargetSelection(interactionState))}>
						Select Target
					</button>
					<button onClick={handleBack}>Back</button>
				</div>
			)}

			{interactionState.mode === 'selectingTarget' && (
				<div className="action-buttons">
					<p className="action-summary">
						{interactionState.actionType === 'move' ? 'Moving' : 'Influencing'} {interactionState.amount} from {countryId}
					</p>
					<div className="target-list">
						{validTargets.map((target, index) => (
							<button
								key={target.countryId}
								className={`target-list-item${index === interactionState.focusedTargetIndex ? ' focused' : ''}`}
								onClick={() => handleSubmitOrder(target.countryId)}
							>
								<div className="target-list-item-header">
									<span className="target-name">{target.name}</span>
									{interactionState.actionType === 'move' && (
										<span className="target-troops">{target.troops} troops</span>
									)}
								</div>
								<div className="target-list-item-details">
									{target.controllerName && (
										<span className="target-controller">
											<span className="faction-swatch" style={{ backgroundColor: target.controllerColor ?? '#888' }} />
											{target.controllerName}
										</span>
									)}
									{interactionState.actionType === 'influence' && target.influenceLevels.length > 0 && (
										<span className="target-influence">
											{target.influenceLevels.map((il) => (
												<span key={il.factionName} className="target-influence-entry">
													<span className="faction-swatch" style={{ backgroundColor: il.factionColor }} />
													{il.value}
												</span>
											))}
										</span>
									)}
								</div>
							</button>
						))}
					</div>
					<button onClick={handleBack}>Back</button>
				</div>
			)}

			{ordersForCountry.length > 0 && (
				<OrdersList
					orders={ordersForCountry}
					focusedIndex={focusedOrderIndex}
					onCancel={handleClickCancel}
					onFocus={setFocusedOrderIndex}
				/>
			)}
		</div>
	);
}

interface OrdersListProps {
	readonly orders: ReadonlyArray<Order>;
	readonly focusedIndex: number;
	readonly onCancel: (orderId: string) => void;
	readonly onFocus: Dispatch<SetStateAction<number>>;
}

function OrdersList({ orders, focusedIndex, onCancel, onFocus }: OrdersListProps) {
	return (
		<div className="card-section">
			<h4>Queued Orders</h4>
			{orders.map((order, index) => {
				const id = orderToId(order);
				return (
					<div
						key={id}
						className={`queued-order${index === focusedIndex ? ' focused' : ''}`}
						onMouseEnter={() => onFocus(index)}
						onMouseLeave={() => onFocus(-1)}
					>
						<span>{order.type} {order.amount} → {order.targetCountryId}</span>
						<button className="cancel-order-btn" onClick={() => onCancel(id)}>Cancel</button>
					</div>
				);
			})}
		</div>
	);
}

export { CountryCard };
