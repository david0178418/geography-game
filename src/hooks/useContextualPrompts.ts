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

const countrySelectedPrompts: ReadonlyArray<Prompt> = [
	{ action: 'NAVIGATE_UP', label: 'Navigate' },
	{ action: 'CONFIRM', label: 'Action' },
	{ action: 'BACK', label: 'Deselect' },
	{ action: 'END_TURN', label: 'End Turn' },
];

const settingAmountPrompts: ReadonlyArray<Prompt> = [
	{ action: 'INCREMENT', label: 'More' },
	{ action: 'DECREMENT', label: 'Less' },
	{ action: 'CONFIRM', label: 'Confirm' },
	{ action: 'BACK', label: 'Back' },
];

const selectingTargetPrompts: ReadonlyArray<Prompt> = [
	{ action: 'NAVIGATE_UP', label: 'Navigate' },
	{ action: 'CONFIRM', label: 'Select Target' },
	{ action: 'BACK', label: 'Back' },
];

const choosingActionPrompts: ReadonlyArray<Prompt> = [
	{ action: 'CONFIRM', label: 'Confirm' },
	{ action: 'CYCLE_ACTION', label: 'Switch Type' },
	{ action: 'BACK', label: 'Back' },
];

const promptsByMode: Record<InteractionState['mode'], ReadonlyArray<Prompt>> = {
	idle: idlePrompts,
	countrySelected: countrySelectedPrompts,
	choosingAction: choosingActionPrompts,
	settingAmount: settingAmountPrompts,
	selectingTarget: selectingTargetPrompts,
};

function useContextualPrompts(interactionState: InteractionState): ReadonlyArray<Prompt> {
	return promptsByMode[interactionState.mode];
}

export { useContextualPrompts };
export type { Prompt };
