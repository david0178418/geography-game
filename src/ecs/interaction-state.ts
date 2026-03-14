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
		const actionType = availableActions[0];
		if (!actionType) return { mode: 'focusing', countryId };
		return {
			mode: 'settingAmount',
			countryId,
			actionType,
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
		if (!resolved) return null;
		return {
			outcome: 'complete',
			state: { mode: 'focusing', countryId: state.countryId },
			sourceCountryId: role === 'source' ? resolved : sourceCountryId,
			targetCountryId: role === 'target' ? resolved : (targetCountryId ?? sourceCountryId),
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
