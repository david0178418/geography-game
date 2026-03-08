import type { InputEvent, InputListener } from './input-types.ts';
import { ControllerType } from './input-types.ts';
import { KeyboardMappings, ShiftKeyboardMappings } from './controller-mappings.ts';

export interface KeyboardManagerHandle {
	readonly init: () => KeyboardManagerHandle;
	readonly destroy: () => void;
	readonly addListener: (listener: InputListener) => KeyboardManagerHandle;
	readonly removeListener: (listener: InputListener) => void;
	readonly setEnabled: (enabled: boolean) => void;
	readonly isEnabled: () => boolean;
}

function createKeyboardManager(): KeyboardManagerHandle {
	const listeners: InputListener[] = [];
	const pressedKeys = new Set<string>();
	let enabled = true;

	function handleKeyDown(event: KeyboardEvent): void {
		if (!enabled) return;

		const target = event.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		const key = event.key;
		if (pressedKeys.has(key)) return;

		pressedKeys.add(key);

		const action = event.shiftKey
			? (ShiftKeyboardMappings[key] ?? KeyboardMappings[key])
			: KeyboardMappings[key];

		if (action) {
			event.preventDefault();
			const inputEvent: InputEvent = {
				action,
				source: ControllerType.KEYBOARD,
				timestamp: Date.now(),
			};
			listeners.forEach((listener) => listener(inputEvent));
		}
	}

	function handleKeyUp(event: KeyboardEvent): void {
		pressedKeys.delete(event.key);
	}

	const handle: KeyboardManagerHandle = {
		init() {
			window.addEventListener('keydown', handleKeyDown);
			window.addEventListener('keyup', handleKeyUp);
			return handle;
		},
		destroy() {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
			listeners.length = 0;
			pressedKeys.clear();
		},
		addListener(listener: InputListener) {
			listeners.push(listener);
			return handle;
		},
		removeListener(listener: InputListener) {
			const idx = listeners.indexOf(listener);
			if (idx >= 0) listeners.splice(idx, 1);
		},
		setEnabled(value: boolean) {
			enabled = value;
			if (!value) pressedKeys.clear();
		},
		isEnabled() {
			return enabled;
		},
	};

	return handle;
}

// Singleton
let instance: KeyboardManagerHandle | null = null;

function getKeyboardManager(): KeyboardManagerHandle {
	if (!instance) {
		instance = createKeyboardManager();
	}
	return instance;
}

export { createKeyboardManager, getKeyboardManager };
