# Interaction Rework Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the game's interaction flow from mouse-centric to controller-friendly, separating info display from action controls with context-aware auto-skipping.

**Architecture:** Replace the current 4-mode state machine with a 5-mode version (idle, focusing, actionMenu, settingAmount, secondarySelection). Split the monolithic CountryCard into a pure info panel (top-left) and a unified ControlBar (bottom). Globe rotation/zoom locked outside idle/focusing modes.

**Tech Stack:** React 19, TypeScript, ecspresso (ECS), d3-geo

**Spec:** `docs/superpowers/specs/2026-03-14-interaction-rework-design.md`

**Validation:** `npm run check:types` (tsc --noEmit) after each task. No test framework is configured.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/ecs/interaction-state.ts` | 5-mode state machine, pure transition functions, auto-skip logic | Rewrite |
| `src/ecs/orders.ts` | Order helpers: create, remove, pop last, submit | Modify |
| `src/input/input-types.ts` | Input action constants | Modify (remove CANCEL_ORDER) |
| `src/input/controller-mappings.ts` | Gamepad/keyboard → action mappings | Modify (remove CANCEL_ORDER) |
| `src/components/button-prompts/button-glyph-map.ts` | Controller button → SVG glyph | Modify (remove CANCEL_ORDER) |
| `src/hooks/useContextualPrompts.ts` | Mode → prompt list mapping | Rewrite for 5 modes |
| `src/components/CountryInfoPanel.tsx` | Pure info display, fixed top-left | Create (replaces CountryCard) |
| `src/components/ControlBar.tsx` | Unified bottom bar: turn info, actions, prompts, input handling | Create (replaces TurnControls + PromptBar) |
| `src/components/GlobeInputHandler.tsx` | Globe navigation, rotation, zoom with mode guards | Modify |
| `src/App.tsx` | Root composition | Modify (swap components) |
| `src/App.css` | Styles | Modify (replace card styles, add control-bar, remove old) |
| `src/components/CountryCard.tsx` | Old monolithic card | Delete |
| `src/components/TurnControls.tsx` | Old turn controls | Delete |
| `src/components/PromptBar.tsx` | Old prompt bar | Delete |
| `src/hooks/useGlobeProjection.ts` | Old globe→screen projection hook | Delete |

---

## Chunk 1: State Machine & Data Layer

### Task 1: Rewrite interaction-state.ts

**Files:**
- Rewrite: `src/ecs/interaction-state.ts`

The new state machine has 5 modes. All transition functions are pure (return new state, no mutations). The auto-skip logic for actionMenu and secondarySelection lives here.

- [ ] **Step 1: Replace the InteractionState type and transition functions**

Replace the entire contents of `src/ecs/interaction-state.ts` with:

```typescript
import type { GameWorld } from "./world.ts";

type ActionType = 'move' | 'influence';

type InteractionState =
	| { readonly mode: 'idle' }
	| { readonly mode: 'focusing'; readonly countryId: string }
	| {
		readonly mode: 'actionMenu';
		readonly countryId: string;
		readonly availableActions: ReadonlyArray<ActionType>;
		readonly focusedIndex: number;
	}
	| {
		readonly mode: 'settingAmount';
		readonly countryId: string;
		readonly actionType: ActionType;
		readonly amount: number;
		readonly sourceCountryId: string;
		readonly targetCountryId: string | null;
		readonly skippedActionMenu: boolean;
	}
	| {
		readonly mode: 'secondarySelection';
		readonly countryId: string;
		readonly actionType: ActionType;
		readonly amount: number;
		readonly sourceCountryId: string | null;
		readonly targetCountryId: string | null;
		readonly role: 'target' | 'source';
		readonly validOptions: ReadonlyArray<string>;
		readonly focusedIndex: number;
		readonly skippedActionMenu: boolean;
	};

function focusCountry(world: GameWorld, countryId: string): void {
	world.setResource("selectedCountryId", countryId);
	world.setResource("interactionState", { mode: 'focusing', countryId });
}

interface SelectContext {
	readonly availableActions: ReadonlyArray<ActionType>;
	readonly sourceCountryId: string;
	readonly targetCountryId: string | null;
}

/**
 * Transition from focusing → actionMenu or settingAmount (with auto-skip).
 * The caller computes availableActions and resolves source/target based on
 * which country was selected and what the player controls.
 */
function selectForAction(countryId: string, context: SelectContext): InteractionState {
	const { availableActions, sourceCountryId, targetCountryId } = context;
	if (availableActions.length === 0) return { mode: 'focusing', countryId };
	if (availableActions.length === 1) {
		return {
			mode: 'settingAmount',
			countryId,
			actionType: availableActions[0],
			amount: 1,
			sourceCountryId,
			targetCountryId,
			skippedActionMenu: true,
		};
	}
	return {
		mode: 'actionMenu',
		countryId,
		availableActions,
		focusedIndex: 0,
	};
}

/**
 * Transition from actionMenu → settingAmount after choosing an action.
 * Caller provides source/target context.
 */
function chooseAction(
	state: Extract<InteractionState, { readonly mode: 'actionMenu' }>,
	actionType: ActionType,
	sourceCountryId: string,
	targetCountryId: string | null,
): InteractionState {
	return {
		mode: 'settingAmount',
		countryId: state.countryId,
		actionType,
		amount: 1,
		sourceCountryId,
		targetCountryId,
		skippedActionMenu: false,
	};
}

function navigateActionMenu(state: InteractionState, delta: number): InteractionState {
	if (state.mode !== 'actionMenu') return state;
	const len = state.availableActions.length;
	if (len === 0) return state;
	const newIndex = ((state.focusedIndex + delta) % len + len) % len;
	return { ...state, focusedIndex: newIndex };
}

function adjustAmount(state: InteractionState, delta: number, min: number, max: number): InteractionState {
	if (state.mode !== 'settingAmount') return state;
	const newAmount = Math.max(min, Math.min(max, state.amount + delta));
	return { ...state, amount: newAmount };
}

function setAmount(state: InteractionState, amount: number, min: number, max: number): InteractionState {
	if (state.mode !== 'settingAmount') return state;
	return { ...state, amount: Math.max(min, Math.min(max, amount)) };
}

type ConfirmAmountResult =
	| {
		readonly outcome: 'complete';
		readonly state: InteractionState;
		readonly sourceCountryId: string;
		readonly targetCountryId: string;
	}
	| {
		readonly outcome: 'secondarySelection';
		readonly state: InteractionState;
	};

/**
 * Transition from settingAmount → order complete or secondarySelection.
 * validOptions: the list of countries that need to be chosen from.
 * If target is already known and source is known, action completes.
 * If one side is unknown and has 1 option, auto-select.
 * If one side is unknown and has 2+ options, enter secondarySelection.
 */
function confirmAmount(
	state: Extract<InteractionState, { readonly mode: 'settingAmount' }>,
	validOptions: ReadonlyArray<string>,
): ConfirmAmountResult | null {
	const { sourceCountryId, targetCountryId } = state;

	// Both known — complete immediately
	if (sourceCountryId !== '' && targetCountryId !== null) {
		return {
			outcome: 'complete',
			state: { mode: 'focusing', countryId: state.countryId },
			sourceCountryId,
			targetCountryId,
		};
	}

	// Determine which side is unknown
	const role: 'target' | 'source' = targetCountryId === null ? 'target' : 'source';

	if (validOptions.length === 0) return null;
	if (validOptions.length === 1) {
		const resolved = validOptions[0];
		return {
			outcome: 'complete',
			state: { mode: 'focusing', countryId: state.countryId },
			sourceCountryId: role === 'source' ? resolved : sourceCountryId,
			targetCountryId: role === 'target' ? resolved : targetCountryId!,
		};
	}

	return {
		outcome: 'secondarySelection',
		state: {
			mode: 'secondarySelection',
			countryId: state.countryId,
			actionType: state.actionType,
			amount: state.amount,
			sourceCountryId: role === 'source' ? null : sourceCountryId,
			targetCountryId: role === 'target' ? null : targetCountryId,
			role,
			validOptions,
			focusedIndex: 0,
			skippedActionMenu: state.skippedActionMenu,
		},
	};
}

function navigateSecondarySelection(state: InteractionState, delta: number): InteractionState {
	if (state.mode !== 'secondarySelection') return state;
	const len = state.validOptions.length;
	if (len === 0) return state;
	const newIndex = ((state.focusedIndex + delta) % len + len) % len;
	return { ...state, focusedIndex: newIndex };
}

interface SecondarySelectionResult {
	readonly sourceCountryId: string;
	readonly targetCountryId: string;
}

function confirmSecondarySelection(
	state: Extract<InteractionState, { readonly mode: 'secondarySelection' }>,
): SecondarySelectionResult | null {
	const selected = state.validOptions[state.focusedIndex];
	if (!selected) return null;

	if (state.role === 'target') {
		if (!state.sourceCountryId) return null;
		return { sourceCountryId: state.sourceCountryId, targetCountryId: selected };
	}
	if (!state.targetCountryId) return null;
	return { sourceCountryId: selected, targetCountryId: state.targetCountryId };
}

function goBack(state: InteractionState, pendingOrderCount: number): InteractionState {
	const backTransitions: Record<string, (s: InteractionState) => InteractionState> = {
		idle: () => ({ mode: 'idle' }),
		focusing: () => {
			// Undo logic handled by caller (pop last order).
			// If no orders, deselect.
			if (pendingOrderCount > 0) return state;
			return { mode: 'idle' };
		},
		actionMenu: (s) => {
			if (s.mode !== 'actionMenu') return { mode: 'idle' };
			return { mode: 'focusing', countryId: s.countryId };
		},
		settingAmount: (s) => {
			if (s.mode !== 'settingAmount') return { mode: 'idle' };
			if (s.skippedActionMenu) {
				return { mode: 'focusing', countryId: s.countryId };
			}
			// Return to focusing — user re-presses Select to re-enter actionMenu.
			// We cannot reconstruct the actionMenu's availableActions from here
			// without world access (pure function), so we return to focusing.
			return { mode: 'focusing', countryId: s.countryId };
		},
		secondarySelection: (s) => {
			if (s.mode !== 'secondarySelection') return { mode: 'idle' };
			return {
				mode: 'settingAmount',
				countryId: s.countryId,
				actionType: s.actionType,
				amount: s.amount,
				sourceCountryId: s.sourceCountryId ?? s.countryId,
				targetCountryId: s.targetCountryId,
				skippedActionMenu: s.skippedActionMenu,
			};
		},
	};

	const transition = backTransitions[state.mode];
	return transition ? transition(state) : { mode: 'idle' };
}

export type { InteractionState, ActionType, SelectContext, ConfirmAmountResult, SecondarySelectionResult };
export {
	focusCountry,
	selectForAction,
	chooseAction,
	navigateActionMenu,
	adjustAmount,
	setAmount,
	confirmAmount,
	navigateSecondarySelection,
	confirmSecondarySelection,
	goBack,
};
```

- [ ] **Step 2: Run type check**

Run: `npm run check:types`
Expected: Errors in files that import old exports (`selectCountry`, `startSettingAmount`, `enterTargetSelection`, `navigateTargetList`). These are expected — they'll be fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/ecs/interaction-state.ts
git commit -m "Rewrite interaction state machine: 5 modes with auto-skip logic"
```

---

### Task 2: Update orders.ts

**Files:**
- Modify: `src/ecs/orders.ts`

Update `submitNewOrder` to accept explicit source/target instead of extracting from the old `selectingTarget` state. Add `popLastOrder` for undo.

- [ ] **Step 1: Rewrite orders.ts**

Replace entire contents:

```typescript
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
```

- [ ] **Step 2: Run type check**

Run: `npm run check:types`
Expected: Errors in files importing old `submitNewOrder`. Expected — fixed later.

- [ ] **Step 3: Commit**

```bash
git add src/ecs/orders.ts
git commit -m "Update orders.ts: add popLastOrder, simplify submitOrder signature"
```

---

### Task 3: Remove CANCEL_ORDER from input layer

**Files:**
- Modify: `src/input/input-types.ts`
- Modify: `src/input/controller-mappings.ts`
- Modify: `src/components/button-prompts/button-glyph-map.ts`

- [ ] **Step 1: Remove CANCEL_ORDER from input-types.ts**

Remove the `CANCEL_ORDER: 'CANCEL_ORDER',` line from the `InputAction` object.

- [ ] **Step 2: Remove CANCEL_ORDER from controller-mappings.ts**

Remove all `CANCEL_ORDER` entries from every controller mapping object and the keyboard mapping. Also remove it from display label maps.

- [ ] **Step 3: Remove CANCEL_ORDER from button-glyph-map.ts**

Remove all `CANCEL_ORDER` entries from every controller type's glyph map.

- [ ] **Step 4: Run type check**

Run: `npm run check:types`
Expected: Errors in `useContextualPrompts.ts` and `CountryCard.tsx` referencing `CANCEL_ORDER`. Expected — fixed later.

- [ ] **Step 5: Commit**

```bash
git add src/input/input-types.ts src/input/controller-mappings.ts src/components/button-prompts/button-glyph-map.ts
git commit -m "Remove CANCEL_ORDER input action (replaced by back-to-undo)"
```

---

### Task 4: Update useContextualPrompts for 5 modes

**Files:**
- Rewrite: `src/hooks/useContextualPrompts.ts`

- [ ] **Step 1: Rewrite useContextualPrompts.ts**

```typescript
import type { InputAction } from "@/input/input-types.ts";
import type { InteractionState } from "@/ecs/interaction-state.ts";

interface Prompt {
	readonly action: InputAction;
	readonly label: string;
}

const idlePrompts: ReadonlyArray<Prompt> = [
	{ action: 'NAVIGATE_UP', label: 'Navigate' },
	{ action: 'CONFIRM', label: 'Select' },
	{ action: 'END_TURN', label: 'End Turn' },
];

const focusingPrompts: ReadonlyArray<Prompt> = [
	{ action: 'NAVIGATE_UP', label: 'Navigate' },
	{ action: 'CONFIRM', label: 'Select' },
	{ action: 'BACK', label: 'Back' },
	{ action: 'END_TURN', label: 'End Turn' },
];

const actionMenuPrompts: ReadonlyArray<Prompt> = [
	{ action: 'NAVIGATE_UP', label: 'Navigate' },
	{ action: 'CONFIRM', label: 'Select' },
	{ action: 'BACK', label: 'Back' },
];

const settingAmountPrompts: ReadonlyArray<Prompt> = [
	{ action: 'INCREMENT', label: 'More' },
	{ action: 'DECREMENT', label: 'Less' },
	{ action: 'CONFIRM', label: 'Confirm' },
	{ action: 'BACK', label: 'Back' },
];

const secondarySelectionPrompts: ReadonlyArray<Prompt> = [
	{ action: 'NAVIGATE_UP', label: 'Navigate' },
	{ action: 'CONFIRM', label: 'Select' },
	{ action: 'BACK', label: 'Back' },
];

const promptsByMode: Record<InteractionState['mode'], ReadonlyArray<Prompt>> = {
	idle: idlePrompts,
	focusing: focusingPrompts,
	actionMenu: actionMenuPrompts,
	settingAmount: settingAmountPrompts,
	secondarySelection: secondarySelectionPrompts,
};

function useContextualPrompts(interactionState: InteractionState): ReadonlyArray<Prompt> {
	return promptsByMode[interactionState.mode];
}

export { useContextualPrompts };
export type { Prompt };
```

- [ ] **Step 2: Run type check**

Run: `npm run check:types`
Expected: Should compile (this file is self-contained). Remaining errors from CountryCard/App are expected.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useContextualPrompts.ts
git commit -m "Update contextual prompts for 5-mode interaction state"
```

---

## Chunk 2: UI Components

### Task 5: Create CountryInfoPanel

**Files:**
- Create: `src/components/CountryInfoPanel.tsx`

Extract the info-only display from CountryCard into a pure component. Fixed position at top-left. No input handling, no actions, no orders list.

- [ ] **Step 1: Create CountryInfoPanel.tsx**

```typescript
import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";
import { getBlocsForCountry } from "@/data/blocs.ts";
import { getControlStateForCountry } from "@/ecs/controlStates.ts";

function CountryInfoPanel() {
	const world = useGameWorld();
	const interactionState = useEcsResource("interactionState");
	const factions = useEcsResource("factions");
	const countryEntityMap = useEcsResource("countryEntityMap");

	if (interactionState.mode === 'idle') return null;

	const countryId = interactionState.countryId;
	const entityId = countryEntityMap.get(countryId);
	if (entityId === undefined) return null;

	const entity = world.getEntity(entityId);
	if (!entity) return null;

	const { country, control, troops, stability, influence } = entity.components;
	if (!country || !control || !troops || !stability || !influence) return null;

	const controllingFaction = factions.find((f) => f.id === control.factionId);
	const blocs = getBlocsForCountry(country.countryId);
	const controlState = getControlStateForCountry(influence.factionInfluence, stability.current);

	const influenceEntries = Object.entries(influence.factionInfluence)
		.filter(([, value]) => value > 0)
		.sort(([, a], [, b]) => b - a);

	return (
		<div className="country-info-panel">
			<h3 className="card-title">{country.name}</h3>
			<div className="card-info-grid">
				<span className="info-label">Capital</span>
				<span>{country.capitalName}</span>
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
				<span>{troops.count}</span>
				<span className="info-label">Stability</span>
				<div className="stability-bar-container">
					<div className="stability-bar-fill" style={{ width: `${stability.current}%` }} />
					<span className="stability-bar-text">{stability.current}</span>
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
		</div>
	);
}

export { CountryInfoPanel };
```

- [ ] **Step 2: Run type check**

Run: `npm run check:types`
Expected: This file should compile. CountryCard errors still expected.

- [ ] **Step 3: Commit**

```bash
git add src/components/CountryInfoPanel.tsx
git commit -m "Add CountryInfoPanel: pure info display at top-left"
```

---

### Task 6: Create ControlBar

**Files:**
- Create: `src/components/ControlBar.tsx`

This is the largest new component. It replaces TurnControls + PromptBar and adds all action UI. It handles all action-related input (CONFIRM, BACK, INCREMENT, DECREMENT, NAVIGATE_* for menus/lists) and delegates to state machine transition functions.

- [ ] **Step 1: Create ControlBar.tsx**

```typescript
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

function getAvailableActionsForCountry(
	world: ReturnType<typeof useGameWorld>,
	countryId: string,
	factions: ReadonlyArray<{ readonly id: string; readonly isPlayer: boolean }>,
	pendingOrders: ReadonlyMap<string, import("@/types/ecs.ts").Order>,
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

		// Compute available troops (minus committed move orders)
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

	// Check if any adjacent player country has available troops
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
		sourceCountryId: playerAdjacent.length === 1 ? playerAdjacent[0] : '',
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
	world: ReturnType<typeof useGameWorld>,
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
				// Must have available troops
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
			// Need to resolve source/target for chosen action
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
			submitOrder(
				world,
				interactionState.actionType,
				result.sourceCountryId,
				result.targetCountryId,
				interactionState.amount,
				playerFaction.id,
			);
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
											submitOrder(
												world,
												interactionState.actionType,
												result.sourceCountryId,
												result.targetCountryId,
												interactionState.amount,
												playerFaction.id,
											);
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
```

- [ ] **Step 2: Run type check**

Run: `npm run check:types`
Expected: ControlBar should compile. Old component errors still expected.

- [ ] **Step 3: Commit**

```bash
git add src/components/ControlBar.tsx
git commit -m "Add ControlBar: unified bottom bar with mode-aware actions and prompts"
```

---

## Chunk 3: Integration & Cleanup

### Task 7: Update GlobeInputHandler with globe lock guards

**Files:**
- Modify: `src/components/GlobeInputHandler.tsx`

Add mode guards to prevent rotation, zoom, and navigation when mode is not `idle` or `focusing`. Remove the CONFIRM handler for idle (ControlBar now owns confirm for focusing; GlobeInputHandler only handles confirm in idle to focus center country).

- [ ] **Step 1: Add globe-lock guards**

In the `pollContinuousInputs` function, wrap the gamepad stick rotation, trigger zoom, and keyboard rotation sections with a mode check:

```typescript
const currentInteraction = worldRef.current.getResource("interactionState");
const globeUnlocked = currentInteraction.mode === 'idle' || currentInteraction.mode === 'focusing';
```

Only execute the analog rotation, zoom, and keyboard rotation blocks when `globeUnlocked` is true.

In the edge-triggered handlers (`handleRotate`, `ZOOM_IN`, `ZOOM_OUT`), add the same guard:

```typescript
const currentInteraction = world.getResource("interactionState");
if (currentInteraction.mode !== 'idle' && currentInteraction.mode !== 'focusing') return;
```

Update `handleNavigate` to also guard against all modes except `idle` and `focusing` (it already guards `selectingTarget` and `settingAmount`, but now needs to use the new mode names).

Update the CONFIRM handler: only handle `idle` mode (focus center country). The ControlBar handles CONFIRM for `focusing` and beyond.

Remove the `focusCountry` import usage for the CONFIRM handler's `countrySelected` case — it no longer calls `selectCountry`, just `focusCountry`.

Remove the `END_TURN` handler from GlobeInputHandler — ControlBar now owns it.

Update imports: remove `selectCountry` if no longer used, update `InteractionState` references.

- [ ] **Step 2: Run type check**

Run: `npm run check:types`
Expected: GlobeInputHandler should compile with updated imports.

- [ ] **Step 3: Commit**

```bash
git add src/components/GlobeInputHandler.tsx
git commit -m "Add globe lock guards: disable rotation/zoom outside idle/focusing"
```

---

### Task 8: Update App.tsx and clean up old components

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/CountryCard.tsx`
- Delete: `src/components/TurnControls.tsx`
- Delete: `src/components/PromptBar.tsx`
- Delete: `src/hooks/useGlobeProjection.ts`

- [ ] **Step 1: Update App.tsx imports and component tree**

Replace imports:
- Remove: `CountryCard`, `TurnControls`, `PromptBar`
- Add: `CountryInfoPanel`, `ControlBar`
- Remove: `submitNewOrder` import (no longer used here)
- Remove: `selectCountry` import if present

In the JSX, replace:
```tsx
<CountryCard globeHandle={globeHandle} />
<PromptBar />
<TurnControls />
```
with:
```tsx
<CountryInfoPanel />
<ControlBar />
```

In the `onCountryClick` handler, update the interaction state references:
- Replace `{ mode: 'idle' as const }` with `{ mode: 'idle' as const }`
- Remove the `selectingTarget` click handler (ControlBar handles order submission now)
- Update `focusCountry` calls — these remain the same

Remove the `submitNewOrder` usage from the click handler.

In the `redrawWithHighlight` closure, update `interactionState.mode === 'selectingTarget'` to `interactionState.mode === 'secondarySelection' && interactionState.role === 'target'`. This preserves the valid-target globe highlighting during target selection.

Remove the `selectingTarget` click handler block from `onCountryClick` — ControlBar handles order submission now. Keep the click-to-focus behavior for all other modes.

- [ ] **Step 2: Delete old files**

Delete:
- `src/components/CountryCard.tsx`
- `src/components/TurnControls.tsx`
- `src/components/PromptBar.tsx`
- `src/hooks/useGlobeProjection.ts`

- [ ] **Step 3: Run type check**

Run: `npm run check:types`
Expected: Clean compile. All old references should be resolved.

- [ ] **Step 4: Fix any remaining type errors**

Address any type errors from the integration. Common issues:
- Import paths that reference deleted files
- Old interaction state mode names (`countrySelected`, `selectingTarget`) in App.tsx click handlers
- `submitNewOrder` calls that need to be replaced with `submitOrder` or removed

- [ ] **Step 5: Commit**

```bash
git add -u
git add src/components/CountryInfoPanel.tsx src/components/ControlBar.tsx
git commit -m "Integrate new components: CountryInfoPanel + ControlBar, remove old CountryCard/TurnControls/PromptBar"
```

---

### Task 9: Update App.css

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Replace `.country-card` with `.country-info-panel`**

The `.country-info-panel` should be:
- Fixed position at top-left
- Below the faction summary bar (`top: 3rem`)
- No `will-change: transform` or `transition: opacity` (no longer animated)
- Same styling for info content (card-title, card-info-grid, etc.)

```css
.country-info-panel {
	position: fixed;
	top: 3rem;
	left: 1rem;
	width: 260px;
	max-height: calc(100vh - 6rem);
	overflow-y: auto;
	padding: 0.75rem;
	background: rgba(0, 0, 0, 0.8);
	backdrop-filter: blur(8px);
	border-radius: 8px;
	border: 1px solid rgba(255, 255, 255, 0.1);
	color: #e0e0e0;
	z-index: 10;
	font-size: 0.85rem;
}
```

- [ ] **Step 2: Replace `.turn-controls` and `.prompt-bar` with `.control-bar`**

```css
.control-bar {
	position: fixed;
	bottom: 1rem;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	z-index: 10;
	pointer-events: none;
}

.control-bar-content {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.5rem 1.5rem;
	background: rgba(0, 0, 0, 0.7);
	backdrop-filter: blur(4px);
	border-radius: 8px;
	color: #e0e0e0;
	pointer-events: auto;
}

.control-bar-turn {
	display: flex;
	align-items: center;
	gap: 1rem;
}

.control-bar-actions {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.control-bar-btn {
	padding: 0.4rem 1rem;
	background: rgba(255, 255, 255, 0.1);
	color: white;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 4px;
	cursor: pointer;
	font-size: 0.85rem;
	pointer-events: auto;
}

.control-bar-btn:hover {
	background: rgba(255, 255, 255, 0.2);
}

.control-bar-btn.primary {
	background: #3b82f6;
	border-color: #3b82f6;
}

.control-bar-btn.primary:hover {
	background: #2563eb;
}

.control-bar-btn.focused {
	background: rgba(34, 211, 238, 0.15);
	border-color: rgba(34, 211, 238, 0.6);
}

.control-bar-prompts {
	pointer-events: none;
}

.secondary-selection-list {
	display: flex;
	gap: 0.3rem;
}
```

- [ ] **Step 3: Remove old styles**

Remove these CSS blocks that are no longer used:
- `.country-card` (replaced by `.country-info-panel`)
- `.card-actions`
- `.action-buttons` and children
- `.action-type-label` (moved to control-bar context)
- `.action-summary`
- `.adjacent-list`, `.adjacent-btn` (no longer in info panel)
- `.queued-order`, `.cancel-order-btn`, `.queued-order.focused`
- `.target-list` and all `.target-list-item*` styles
- `.turn-controls` (replaced by `.control-bar`)
- `.prompt-bar` (replaced by `.control-bar-prompts`)

Keep: `.card-title`, `.card-info-grid`, `.info-label`, `.card-section`, `.card-section h4`, `.stability-*`, `.influence-*`, `.blocs-*`, `.faction-swatch`, `.amount-stepper`, `.amount-value` — these are still used.

- [ ] **Step 4: Run type check**

Run: `npm run check:types`
Expected: Clean compile.

- [ ] **Step 5: Commit**

```bash
git add src/App.css
git commit -m "Update styles: add country-info-panel and control-bar, remove old card/action styles"
```

---

### Task 10: Smoke test and final verification

- [ ] **Step 1: Run full type check**

Run: `npm run check:types`
Expected: Clean compile with zero errors.

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`

Manual verification checklist:
- Globe renders and rotates freely in idle mode
- Navigating to a country shows info panel at top-left
- Actionable countries show Select button in bottom bar
- Pressing Select enters action flow (menu → amount → target selection)
- Globe rotation is locked during action flow
- Back button steps through states correctly
- Back in focusing mode undoes last order
- Back with no orders deselects country
- End Turn only available in idle/focusing
- Controller prompts update per mode

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "Fix integration issues from interaction rework"
```
