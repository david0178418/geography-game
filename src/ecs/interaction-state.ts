export type InteractionState =
	| { readonly mode: 'idle' }
	| { readonly mode: 'countrySelected'; readonly countryId: string }
	| { readonly mode: 'choosingAction'; readonly countryId: string; readonly actionType: 'move' | 'influence' }
	| { readonly mode: 'settingAmount'; readonly countryId: string; readonly actionType: 'move' | 'influence'; readonly amount: number }
	| { readonly mode: 'selectingTarget'; readonly countryId: string; readonly actionType: 'move' | 'influence'; readonly amount: number };

function selectCountry(countryId: string): InteractionState {
	return { mode: 'countrySelected', countryId };
}

function chooseAction(state: InteractionState, actionType: 'move' | 'influence'): InteractionState {
	if (state.mode !== 'countrySelected') return state;
	return { mode: 'choosingAction', countryId: state.countryId, actionType };
}

function setAmount(state: InteractionState, amount: number): InteractionState {
	if (state.mode !== 'choosingAction' && state.mode !== 'settingAmount') return state;
	return { mode: 'settingAmount', countryId: state.countryId, actionType: state.actionType, amount };
}

function enterTargetSelection(state: InteractionState): InteractionState {
	if (state.mode !== 'settingAmount') return state;
	return { mode: 'selectingTarget', countryId: state.countryId, actionType: state.actionType, amount: state.amount };
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
		choosingAction: (s) => ('countryId' in s ? { mode: 'countrySelected', countryId: s.countryId } : { mode: 'idle' }),
		settingAmount: (s) => ('countryId' in s ? { mode: 'countrySelected', countryId: s.countryId } : { mode: 'idle' }),
		selectingTarget: (s) => {
			if (s.mode !== 'selectingTarget') return { mode: 'idle' };
			return { mode: 'settingAmount', countryId: s.countryId, actionType: s.actionType, amount: s.amount };
		},
	};

	const transition = backTransitions[state.mode];
	return transition ? transition(state) : { mode: 'idle' };
}

function cycleActionType(state: InteractionState): InteractionState {
	if (state.mode !== 'choosingAction') return state;
	const nextType = state.actionType === 'move' ? 'influence' as const : 'move' as const;
	return { ...state, actionType: nextType };
}

export { selectCountry, chooseAction, setAmount, enterTargetSelection, adjustAmount, goBack, cycleActionType };
