import type { GameWorld } from "./world.ts";

export type InteractionState =
	| { readonly mode: 'idle' }
	| { readonly mode: 'countrySelected'; readonly countryId: string }
	| { readonly mode: 'settingAmount'; readonly countryId: string; readonly actionType: 'move' | 'influence'; readonly amount: number }
	| { readonly mode: 'selectingTarget'; readonly countryId: string; readonly actionType: 'move' | 'influence'; readonly amount: number; readonly focusedTargetIndex: number };

function selectCountry(countryId: string): InteractionState {
	return { mode: 'countrySelected', countryId };
}

function focusCountry(world: GameWorld, countryId: string): void {
	world.setResource("selectedCountryId", countryId);
	world.setResource("interactionState", selectCountry(countryId));
}

function startSettingAmount(state: InteractionState, actionType: 'move' | 'influence', amount: number): InteractionState {
	if (state.mode !== 'countrySelected' && state.mode !== 'settingAmount') return state;
	return { mode: 'settingAmount', countryId: state.countryId, actionType, amount };
}

function enterTargetSelection(state: InteractionState): InteractionState {
	if (state.mode !== 'settingAmount') return state;
	return { mode: 'selectingTarget', countryId: state.countryId, actionType: state.actionType, amount: state.amount, focusedTargetIndex: 0 };
}

function navigateTargetList(state: InteractionState, delta: number, listLength: number): InteractionState {
	if (state.mode !== 'selectingTarget') return state;
	if (listLength === 0) return state;
	const newIndex = ((state.focusedTargetIndex + delta) % listLength + listLength) % listLength;
	return { ...state, focusedTargetIndex: newIndex };
}

function adjustAmount(state: InteractionState, delta: number, min: number, max: number): InteractionState {
	if (state.mode !== 'settingAmount') return state;
	const newAmount = Math.max(min, Math.min(max, state.amount + delta));
	return { ...state, amount: newAmount };
}

function goBack(state: InteractionState): InteractionState {
	const backTransitions: Record<string, (s: InteractionState) => InteractionState> = {
		idle: () => ({ mode: 'idle' }),
		countrySelected: () => ({ mode: 'idle' }),
		settingAmount: (s) => ('countryId' in s ? { mode: 'countrySelected', countryId: s.countryId } : { mode: 'idle' }),
		selectingTarget: (s) => {
			if (s.mode !== 'selectingTarget') return { mode: 'idle' };
			return { mode: 'settingAmount', countryId: s.countryId, actionType: s.actionType, amount: s.amount };
		},
	};

	const transition = backTransitions[state.mode];
	return transition ? transition(state) : { mode: 'idle' };
}

export { selectCountry, focusCountry, startSettingAmount, enterTargetSelection, navigateTargetList, adjustAmount, goBack };
