/**
 * Unified input action types for controller and keyboard
 */
export const InputAction = {
	CONFIRM: 'CONFIRM',
	BACK: 'BACK',
	END_TURN: 'END_TURN',
	CYCLE_ACTION: 'CYCLE_ACTION',
	NAVIGATE_UP: 'NAVIGATE_UP',
	NAVIGATE_DOWN: 'NAVIGATE_DOWN',
	NAVIGATE_LEFT: 'NAVIGATE_LEFT',
	NAVIGATE_RIGHT: 'NAVIGATE_RIGHT',
	ROTATE_UP: 'ROTATE_UP',
	ROTATE_DOWN: 'ROTATE_DOWN',
	ROTATE_LEFT: 'ROTATE_LEFT',
	ROTATE_RIGHT: 'ROTATE_RIGHT',
	ZOOM_IN: 'ZOOM_IN',
	ZOOM_OUT: 'ZOOM_OUT',
	INCREMENT: 'INCREMENT',
	DECREMENT: 'DECREMENT',
} as const;
export type InputAction = (typeof InputAction)[keyof typeof InputAction];

/**
 * Controller types supported by the application
 */
export const ControllerType = {
	XBOX: 'xbox',
	PLAYSTATION: 'playstation',
	NINTENDO_SWITCH: 'switch',
	STEAMDECK: 'steamdeck',
	KEYBOARD: 'keyboard',
	GENERIC: 'generic',
} as const;
export type ControllerType = (typeof ControllerType)[keyof typeof ControllerType];

/**
 * Input method includes controller types plus mouse/touch
 */
export type InputMethod = ControllerType | 'mouse' | 'touch';

/**
 * Input event emitted when a button/key is pressed
 */
export interface InputEvent {
	readonly action: InputAction;
	readonly source: ControllerType;
	readonly timestamp: number;
}

/**
 * Analog stick state for continuous polling
 */
export interface AnalogState {
	readonly rightStickX: number;
	readonly rightStickY: number;
	readonly leftTrigger: number;
	readonly rightTrigger: number;
}

/**
 * Input listener callback type
 */
export type InputListener = (event: InputEvent) => void;

/**
 * Gamepad button indices (standard mapping)
 */
export const GamepadButton = {
	A: 0,
	B: 1,
	X: 2,
	Y: 3,
	LB: 4,
	RB: 5,
	LT: 6,
	RT: 7,
	SELECT: 8,
	START: 9,
	L_STICK: 10,
	R_STICK: 11,
	D_UP: 12,
	D_DOWN: 13,
	D_LEFT: 14,
	D_RIGHT: 15,
} as const;
export type GamepadButton = (typeof GamepadButton)[keyof typeof GamepadButton];

/**
 * Gamepad axis indices
 */
export const GamepadAxis = {
	LEFT_STICK_X: 0,
	LEFT_STICK_Y: 1,
	RIGHT_STICK_X: 2,
	RIGHT_STICK_Y: 3,
} as const;
export type GamepadAxis = (typeof GamepadAxis)[keyof typeof GamepadAxis];
