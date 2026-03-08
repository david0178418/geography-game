export {
	InputAction,
	ControllerType,
	GamepadButton,
	GamepadAxis,
} from './input-types.ts';
export type {
	InputMethod,
	InputEvent,
	AnalogState,
	InputListener,
} from './input-types.ts';

export {
	ControllerMappings,
	KeyboardMappings,
	ShiftKeyboardMappings,
	ControllerButtonLabels,
	detectControllerType,
} from './controller-mappings.ts';

export { createGamepadManager, getGamepadManager } from './gamepad-manager.ts';
export type { GamepadManagerHandle } from './gamepad-manager.ts';

export { createKeyboardManager, getKeyboardManager } from './keyboard-manager.ts';
export type { KeyboardManagerHandle } from './keyboard-manager.ts';

export {
	useGamepadInput,
	useKeyboardInput,
	useInputAction,
	useActiveInputMethod,
	useAnalogState,
} from './input-hooks.ts';
