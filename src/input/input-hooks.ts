import { useEffect, useRef, useCallback, useState } from 'react';
import { getGamepadManager } from './gamepad-manager.ts';
import { getKeyboardManager } from './keyboard-manager.ts';
import type { AnalogState, InputAction, InputEvent, InputMethod } from './input-types.ts';

type InputListener = (event: InputEvent) => void;

let gamepadInitCount = 0;
let keyboardInitCount = 0;

/**
 * Hook to manage gamepad input with automatic lifecycle handling.
 * Reference-counted init/destroy across multiple consumers.
 */
export function useGamepadInput(listener: InputListener): void {
	const listenerRef = useRef(listener);

	useEffect(() => {
		listenerRef.current = listener;
	}, [listener]);

	const stableListener = useCallback((event: InputEvent) => {
		listenerRef.current(event);
	}, []);

	useEffect(() => {
		const manager = getGamepadManager();

		if (!gamepadInitCount) manager.init();
		gamepadInitCount++;

		manager.addListener(stableListener);

		return () => {
			manager.removeListener(stableListener);
			gamepadInitCount--;
			if (!gamepadInitCount) manager.destroy();
		};
	}, [stableListener]);
}

/**
 * Hook to manage keyboard input with automatic lifecycle handling.
 * Reference-counted init/destroy across multiple consumers.
 */
export function useKeyboardInput(listener: InputListener): void {
	const listenerRef = useRef(listener);

	useEffect(() => {
		listenerRef.current = listener;
	}, [listener]);

	const stableListener = useCallback((event: InputEvent) => {
		listenerRef.current(event);
	}, []);

	useEffect(() => {
		const manager = getKeyboardManager();

		if (!keyboardInitCount) manager.init();
		keyboardInitCount++;

		manager.addListener(stableListener);

		return () => {
			manager.removeListener(stableListener);
			keyboardInitCount--;
			if (!keyboardInitCount) manager.destroy();
		};
	}, [stableListener]);
}

/**
 * Hook that fires a callback when a specific input action is triggered,
 * from either gamepad or keyboard.
 */
export function useInputAction(action: InputAction, callback: () => void): void {
	const handler = useCallback((event: InputEvent) => {
		if (event.action === action) {
			callback();
		}
	}, [action, callback]);

	useGamepadInput(handler);
	useKeyboardInput(handler);
}

/**
 * Hook to track the currently active input method.
 * Updates when the user interacts via gamepad, keyboard, mouse, or touch.
 */
export function useActiveInputMethod(): InputMethod | null {
	const [method, setMethod] = useState<InputMethod | null>(null);

	useEffect(() => {
		function handleMouseMove() { setMethod('mouse'); }
		function handleTouchStart() { setMethod('touch'); }

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('touchstart', handleTouchStart);

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('touchstart', handleTouchStart);
		};
	}, []);

	const handleInput = useCallback((event: InputEvent) => {
		setMethod(event.source);
	}, []);

	useGamepadInput(handleInput);
	useKeyboardInput(handleInput);

	return method;
}

/**
 * Hook to get the current analog state from the gamepad manager.
 * Returns a stable reference that updates each frame.
 */
export function useAnalogState(): AnalogState {
	const [state, setState] = useState<AnalogState>({
		rightStickX: 0,
		rightStickY: 0,
		leftTrigger: 0,
		rightTrigger: 0,
	});

	useEffect(() => {
		const manager = getGamepadManager();
		if (!gamepadInitCount) manager.init();
		gamepadInitCount++;

		let frameId: number;
		function poll() {
			setState(manager.getAnalogState());
			frameId = requestAnimationFrame(poll);
		}
		frameId = requestAnimationFrame(poll);

		return () => {
			cancelAnimationFrame(frameId);
			gamepadInitCount--;
			if (!gamepadInitCount) manager.destroy();
		};
	}, []);

	return state;
}
