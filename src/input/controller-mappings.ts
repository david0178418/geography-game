import { ControllerType, GamepadButton, InputAction } from './input-types.ts';

/**
 * Mapping of gamepad buttons to input actions for each controller type
 */
export const ControllerMappings: Record<ControllerType, Partial<Record<GamepadButton, InputAction>>> = {
	[ControllerType.XBOX]: {
		[GamepadButton.A]: InputAction.CONFIRM,
		[GamepadButton.B]: InputAction.BACK,
		[GamepadButton.Y]: InputAction.END_TURN,
		[GamepadButton.LB]: InputAction.DECREMENT,
		[GamepadButton.RB]: InputAction.INCREMENT,
		[GamepadButton.START]: InputAction.CYCLE_ACTION,
		[GamepadButton.D_UP]: InputAction.NAVIGATE_UP,
		[GamepadButton.D_DOWN]: InputAction.NAVIGATE_DOWN,
		[GamepadButton.D_LEFT]: InputAction.NAVIGATE_LEFT,
		[GamepadButton.D_RIGHT]: InputAction.NAVIGATE_RIGHT,
	},
	[ControllerType.PLAYSTATION]: {
		[GamepadButton.A]: InputAction.CONFIRM,
		[GamepadButton.B]: InputAction.BACK,
		[GamepadButton.Y]: InputAction.END_TURN,
		[GamepadButton.LB]: InputAction.DECREMENT,
		[GamepadButton.RB]: InputAction.INCREMENT,
		[GamepadButton.START]: InputAction.CYCLE_ACTION,
		[GamepadButton.D_UP]: InputAction.NAVIGATE_UP,
		[GamepadButton.D_DOWN]: InputAction.NAVIGATE_DOWN,
		[GamepadButton.D_LEFT]: InputAction.NAVIGATE_LEFT,
		[GamepadButton.D_RIGHT]: InputAction.NAVIGATE_RIGHT,
	},
	[ControllerType.NINTENDO_SWITCH]: {
		[GamepadButton.B]: InputAction.CONFIRM,
		[GamepadButton.A]: InputAction.BACK,
		[GamepadButton.X]: InputAction.END_TURN,
		[GamepadButton.LB]: InputAction.DECREMENT,
		[GamepadButton.RB]: InputAction.INCREMENT,
		[GamepadButton.START]: InputAction.CYCLE_ACTION,
		[GamepadButton.D_UP]: InputAction.NAVIGATE_UP,
		[GamepadButton.D_DOWN]: InputAction.NAVIGATE_DOWN,
		[GamepadButton.D_LEFT]: InputAction.NAVIGATE_LEFT,
		[GamepadButton.D_RIGHT]: InputAction.NAVIGATE_RIGHT,
	},
	[ControllerType.STEAMDECK]: {
		[GamepadButton.A]: InputAction.CONFIRM,
		[GamepadButton.B]: InputAction.BACK,
		[GamepadButton.Y]: InputAction.END_TURN,
		[GamepadButton.LB]: InputAction.DECREMENT,
		[GamepadButton.RB]: InputAction.INCREMENT,
		[GamepadButton.SELECT]: InputAction.CYCLE_ACTION,
		[GamepadButton.D_UP]: InputAction.NAVIGATE_UP,
		[GamepadButton.D_DOWN]: InputAction.NAVIGATE_DOWN,
		[GamepadButton.D_LEFT]: InputAction.NAVIGATE_LEFT,
		[GamepadButton.D_RIGHT]: InputAction.NAVIGATE_RIGHT,
	},
	[ControllerType.GENERIC]: {
		[GamepadButton.A]: InputAction.CONFIRM,
		[GamepadButton.B]: InputAction.BACK,
		[GamepadButton.Y]: InputAction.END_TURN,
		[GamepadButton.LB]: InputAction.DECREMENT,
		[GamepadButton.RB]: InputAction.INCREMENT,
		[GamepadButton.START]: InputAction.CYCLE_ACTION,
		[GamepadButton.D_UP]: InputAction.NAVIGATE_UP,
		[GamepadButton.D_DOWN]: InputAction.NAVIGATE_DOWN,
		[GamepadButton.D_LEFT]: InputAction.NAVIGATE_LEFT,
		[GamepadButton.D_RIGHT]: InputAction.NAVIGATE_RIGHT,
	},
	[ControllerType.KEYBOARD]: {},
};

/**
 * Keyboard key mappings to input actions
 */
export const KeyboardMappings: Record<string, InputAction> = {
	Enter: InputAction.CONFIRM,
	' ': InputAction.CONFIRM,
	Escape: InputAction.BACK,

	// Navigation - Arrow keys
	ArrowUp: InputAction.NAVIGATE_UP,
	ArrowDown: InputAction.NAVIGATE_DOWN,
	ArrowLeft: InputAction.NAVIGATE_LEFT,
	ArrowRight: InputAction.NAVIGATE_RIGHT,

	// Game actions
	e: InputAction.END_TURN,
	E: InputAction.END_TURN,
	Tab: InputAction.CYCLE_ACTION,

	// Zoom
	q: InputAction.ZOOM_IN,
	Q: InputAction.ZOOM_IN,
	z: InputAction.ZOOM_OUT,
	Z: InputAction.ZOOM_OUT,

	// Amount adjustment
	'=': InputAction.INCREMENT,
	'+': InputAction.INCREMENT,
	'-': InputAction.DECREMENT,
};

/**
 * Keyboard mappings for Shift+Arrow → rotation
 */
export const ShiftKeyboardMappings: Record<string, InputAction> = {
	ArrowUp: InputAction.ROTATE_UP,
	ArrowDown: InputAction.ROTATE_DOWN,
	ArrowLeft: InputAction.ROTATE_LEFT,
	ArrowRight: InputAction.ROTATE_RIGHT,
};

/**
 * Display labels for controller buttons
 */
export const ControllerButtonLabels: Record<ControllerType, Partial<Record<InputAction, string>>> = {
	[ControllerType.XBOX]: {
		[InputAction.CONFIRM]: 'A',
		[InputAction.BACK]: 'B',
		[InputAction.END_TURN]: 'Y',
		[InputAction.CYCLE_ACTION]: 'Start',
		[InputAction.INCREMENT]: 'RB',
		[InputAction.DECREMENT]: 'LB',
		[InputAction.NAVIGATE_UP]: 'D-Pad \u2191',
		[InputAction.NAVIGATE_DOWN]: 'D-Pad \u2193',
		[InputAction.NAVIGATE_LEFT]: 'D-Pad \u2190',
		[InputAction.NAVIGATE_RIGHT]: 'D-Pad \u2192',
		[InputAction.ZOOM_IN]: 'RT',
		[InputAction.ZOOM_OUT]: 'LT',
	},
	[ControllerType.PLAYSTATION]: {
		[InputAction.CONFIRM]: '\u2715',
		[InputAction.BACK]: '\u25CB',
		[InputAction.END_TURN]: '\u25B3',
		[InputAction.CYCLE_ACTION]: 'Options',
		[InputAction.INCREMENT]: 'R1',
		[InputAction.DECREMENT]: 'L1',
		[InputAction.NAVIGATE_UP]: 'D-Pad \u2191',
		[InputAction.NAVIGATE_DOWN]: 'D-Pad \u2193',
		[InputAction.NAVIGATE_LEFT]: 'D-Pad \u2190',
		[InputAction.NAVIGATE_RIGHT]: 'D-Pad \u2192',
		[InputAction.ZOOM_IN]: 'R2',
		[InputAction.ZOOM_OUT]: 'L2',
	},
	[ControllerType.NINTENDO_SWITCH]: {
		[InputAction.CONFIRM]: 'B',
		[InputAction.BACK]: 'A',
		[InputAction.END_TURN]: 'X',
		[InputAction.CYCLE_ACTION]: '+',
		[InputAction.INCREMENT]: 'R',
		[InputAction.DECREMENT]: 'L',
		[InputAction.NAVIGATE_UP]: 'D-Pad \u2191',
		[InputAction.NAVIGATE_DOWN]: 'D-Pad \u2193',
		[InputAction.NAVIGATE_LEFT]: 'D-Pad \u2190',
		[InputAction.NAVIGATE_RIGHT]: 'D-Pad \u2192',
		[InputAction.ZOOM_IN]: 'ZR',
		[InputAction.ZOOM_OUT]: 'ZL',
	},
	[ControllerType.STEAMDECK]: {
		[InputAction.CONFIRM]: 'A',
		[InputAction.BACK]: 'B',
		[InputAction.END_TURN]: 'Y',
		[InputAction.CYCLE_ACTION]: 'View',
		[InputAction.INCREMENT]: 'R1',
		[InputAction.DECREMENT]: 'L1',
		[InputAction.NAVIGATE_UP]: 'D-Pad \u2191',
		[InputAction.NAVIGATE_DOWN]: 'D-Pad \u2193',
		[InputAction.NAVIGATE_LEFT]: 'D-Pad \u2190',
		[InputAction.NAVIGATE_RIGHT]: 'D-Pad \u2192',
		[InputAction.ZOOM_IN]: 'R2',
		[InputAction.ZOOM_OUT]: 'L2',
	},
	[ControllerType.KEYBOARD]: {
		[InputAction.CONFIRM]: 'Enter',
		[InputAction.BACK]: 'Esc',
		[InputAction.END_TURN]: 'E',
		[InputAction.CYCLE_ACTION]: 'Tab',
		[InputAction.INCREMENT]: '+',
		[InputAction.DECREMENT]: '-',
		[InputAction.NAVIGATE_UP]: '\u2191',
		[InputAction.NAVIGATE_DOWN]: '\u2193',
		[InputAction.NAVIGATE_LEFT]: '\u2190',
		[InputAction.NAVIGATE_RIGHT]: '\u2192',
		[InputAction.ROTATE_UP]: 'Shift+\u2191',
		[InputAction.ROTATE_DOWN]: 'Shift+\u2193',
		[InputAction.ROTATE_LEFT]: 'Shift+\u2190',
		[InputAction.ROTATE_RIGHT]: 'Shift+\u2192',
		[InputAction.ZOOM_IN]: 'Q',
		[InputAction.ZOOM_OUT]: 'Z',
	},
	[ControllerType.GENERIC]: {
		[InputAction.CONFIRM]: 'A',
		[InputAction.BACK]: 'B',
		[InputAction.END_TURN]: 'Y',
		[InputAction.CYCLE_ACTION]: 'Start',
		[InputAction.INCREMENT]: 'RB',
		[InputAction.DECREMENT]: 'LB',
		[InputAction.NAVIGATE_UP]: 'D-Pad \u2191',
		[InputAction.NAVIGATE_DOWN]: 'D-Pad \u2193',
		[InputAction.NAVIGATE_LEFT]: 'D-Pad \u2190',
		[InputAction.NAVIGATE_RIGHT]: 'D-Pad \u2192',
		[InputAction.ZOOM_IN]: 'RT',
		[InputAction.ZOOM_OUT]: 'LT',
	},
};

/**
 * Detect controller type from gamepad id string
 */
export function detectControllerType(gamepadId: string): ControllerType {
	const id = gamepadId.toLowerCase();

	const detectors: ReadonlyArray<readonly [ReadonlyArray<string>, ControllerType]> = [
		[['xbox', 'xinput', '045e'], ControllerType.XBOX],
		[['playstation', 'dualshock', 'dualsense', '054c', 'ps3', 'ps4', 'ps5'], ControllerType.PLAYSTATION],
		[['nintendo', 'switch', 'joy-con', 'joycon', '057e'], ControllerType.NINTENDO_SWITCH],
		[['steamdeck', 'steam deck', 'valve', '28de'], ControllerType.STEAMDECK],
	];

	const match = detectors.find(([keywords]) => keywords.some((kw) => id.includes(kw)));
	return match ? match[1] : ControllerType.GENERIC;
}
