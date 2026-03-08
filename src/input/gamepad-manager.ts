import type { AnalogState, InputAction, InputListener } from './input-types.ts';
import { ControllerType, GamepadAxis, GamepadButton } from './input-types.ts';
import { ControllerMappings, detectControllerType } from './controller-mappings.ts';

const ANALOG_THRESHOLD = 0.5;
const ANALOG_DEADZONE = 0.15;
const TRIGGER_DEADZONE = 0.1;

export interface GamepadManagerHandle {
	readonly init: () => GamepadManagerHandle;
	readonly destroy: () => void;
	readonly addListener: (listener: InputListener) => GamepadManagerHandle;
	readonly removeListener: (listener: InputListener) => void;
	readonly getControllerType: () => ControllerType | null;
	readonly getAnalogState: () => AnalogState;
	readonly setOnControllerConnected: (cb: (type: ControllerType) => void) => void;
	readonly setOnControllerDisconnected: (cb: () => void) => void;
}

function createGamepadManager(): GamepadManagerHandle {
	const listeners: InputListener[] = [];
	const previousButtonStates = new Map<number, boolean[]>();
	const previousAxisStates = new Map<number, { x: boolean; y: boolean }>();
	let animationFrameId: number | null = null;
	let connectedGamepad: Gamepad | null = null;
	let controllerType: ControllerType = ControllerType.GENERIC;
	let onControllerConnected: ((type: ControllerType) => void) | null = null;
	let onControllerDisconnected: (() => void) | null = null;
	let currentAnalogState: AnalogState = {
		rightStickX: 0,
		rightStickY: 0,
		leftTrigger: 0,
		rightTrigger: 0,
	};

	function emitInputEvent(action: InputAction): void {
		const event = {
			action,
			source: controllerType,
			timestamp: Date.now(),
		} as const;
		listeners.forEach((listener) => listener(event));
	}

	function applyDeadzone(value: number, deadzone: number): number {
		return Math.abs(value) < deadzone ? 0 : value;
	}

	function processButtons(gamepad: Gamepad): void {
		const previousStates = previousButtonStates.get(gamepad.index) ?? [];
		const mapping = ControllerMappings[controllerType];

		gamepad.buttons.forEach((button, index) => {
			const wasPressed = previousStates[index] ?? false;
			if (button.pressed && !wasPressed) {
				const action = mapping[index as GamepadButton];
				if (action) {
					emitInputEvent(action);
				}
			}
			previousStates[index] = button.pressed;
		});

		previousButtonStates.set(gamepad.index, previousStates);
	}

	function processAnalogStick(gamepad: Gamepad): void {
		const axes = gamepad.axes;
		if (axes.length < 2) return;

		const previousState = previousAxisStates.get(gamepad.index) ?? { x: false, y: false };

		const xAxis = axes[GamepadAxis.LEFT_STICK_X];
		if (typeof xAxis === 'undefined') return;

		const xPressed = Math.abs(xAxis) > ANALOG_DEADZONE && Math.abs(xAxis) > ANALOG_THRESHOLD;
		if (xPressed && !previousState.x) {
			emitInputEvent(xAxis < 0 ? 'NAVIGATE_LEFT' : 'NAVIGATE_RIGHT');
		}

		const yAxis = axes[GamepadAxis.LEFT_STICK_Y];
		if (typeof yAxis === 'undefined') return;

		const yPressed = Math.abs(yAxis) > ANALOG_DEADZONE && Math.abs(yAxis) > ANALOG_THRESHOLD;
		if (yPressed && !previousState.y) {
			emitInputEvent(yAxis < 0 ? 'NAVIGATE_UP' : 'NAVIGATE_DOWN');
		}

		previousAxisStates.set(gamepad.index, { x: xPressed, y: yPressed });
	}

	function processRightStickAndTriggers(gamepad: Gamepad): void {
		const axes = gamepad.axes;
		const rightX = axes[GamepadAxis.RIGHT_STICK_X];
		const rightY = axes[GamepadAxis.RIGHT_STICK_Y];

		const ltButton = gamepad.buttons[GamepadButton.LT];
		const rtButton = gamepad.buttons[GamepadButton.RT];

		currentAnalogState = {
			rightStickX: typeof rightX === 'number' ? applyDeadzone(rightX, ANALOG_DEADZONE) : 0,
			rightStickY: typeof rightY === 'number' ? applyDeadzone(rightY, ANALOG_DEADZONE) : 0,
			leftTrigger: ltButton ? applyDeadzone(ltButton.value, TRIGGER_DEADZONE) : 0,
			rightTrigger: rtButton ? applyDeadzone(rtButton.value, TRIGGER_DEADZONE) : 0,
		};
	}

	function poll(): void {
		if (!connectedGamepad) return;

		const gamepads = navigator.getGamepads();
		const gamepad = gamepads[connectedGamepad.index];

		if (gamepad) {
			processButtons(gamepad);
			processAnalogStick(gamepad);
			processRightStickAndTriggers(gamepad);
		}

		animationFrameId = requestAnimationFrame(poll);
	}

	function startPolling(): void {
		if (animationFrameId === null) {
			poll();
		}
	}

	function stopPolling(): void {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
	}

	function handleGamepadConnected(event: GamepadEvent): void {
		connectedGamepad = event.gamepad;
		controllerType = detectControllerType(event.gamepad.id);
		previousButtonStates.set(event.gamepad.index, new Array(event.gamepad.buttons.length).fill(false) as boolean[]);
		previousAxisStates.set(event.gamepad.index, { x: false, y: false });
		startPolling();
		onControllerConnected?.(controllerType);
	}

	function handleGamepadDisconnected(event: GamepadEvent): void {
		if (connectedGamepad && connectedGamepad.index === event.gamepad.index) {
			connectedGamepad = null;
			previousButtonStates.delete(event.gamepad.index);
			previousAxisStates.delete(event.gamepad.index);
			stopPolling();
			onControllerDisconnected?.();
		}
	}

	const handle: GamepadManagerHandle = {
		init() {
			window.addEventListener('gamepadconnected', handleGamepadConnected);
			window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

			const gamepads = navigator.getGamepads();
			for (const gamepad of gamepads) {
				if (gamepad) {
					handleGamepadConnected({ gamepad } as GamepadEvent);
					break;
				}
			}
			return handle;
		},
		destroy() {
			window.removeEventListener('gamepadconnected', handleGamepadConnected);
			window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
			stopPolling();
			listeners.length = 0;
		},
		addListener(listener: InputListener) {
			listeners.push(listener);
			return handle;
		},
		removeListener(listener: InputListener) {
			const idx = listeners.indexOf(listener);
			if (idx >= 0) listeners.splice(idx, 1);
		},
		getControllerType() {
			return connectedGamepad ? controllerType : null;
		},
		getAnalogState() {
			return currentAnalogState;
		},
		setOnControllerConnected(cb) {
			onControllerConnected = cb;
		},
		setOnControllerDisconnected(cb) {
			onControllerDisconnected = cb;
		},
	};

	return handle;
}

// Singleton
let instance: GamepadManagerHandle | null = null;

function getGamepadManager(): GamepadManagerHandle {
	if (!instance) {
		instance = createGamepadManager();
	}
	return instance;
}

export { createGamepadManager, getGamepadManager };
