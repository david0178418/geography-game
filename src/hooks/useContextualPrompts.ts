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
