import { useCallback, useEffect, useRef } from "react";
import { useGameWorld } from "@/contexts/GameContext.ts";
import { useInputAction } from "@/input/input-hooks.ts";
import { getGamepadManager } from "@/input/gamepad-manager.ts";
import { getKeyboardManager } from "@/input/keyboard-manager.ts";
import { focusCountry, focusSecondaryOptionByCountryId } from "@/ecs/interaction-state.ts";
import type { InteractionState } from "@/ecs/interaction-state.ts";
import { screenToCountryId } from "@/rendering/hitDetection.ts";
import { applyZoomDelta } from "@/rendering/interactions.ts";
import type { GlobeHandle } from "@/rendering/index.ts";
import type { GlobeControllerHandle } from "@/rendering/globe-controller.ts";
import type { Direction } from "@/rendering/navigation.ts";

interface GlobeInputHandlerProps {
	readonly globeHandle: GlobeHandle | null;
	readonly globeController: GlobeControllerHandle | null;
}

/** Apply rotation in degrees (not mouse pixels — bypasses ROTATION_SENSITIVITY). */
function applyRotation(globeHandle: GlobeHandle, dx: number, dy: number): void {
	globeHandle.globe.state = {
		...globeHandle.globe.state,
		rotation: [
			globeHandle.globe.state.rotation[0] + dx,
			Math.max(-90, Math.min(90, globeHandle.globe.state.rotation[1] - dy)),
		] as const,
	};
	globeHandle.redraw();
}

function applyZoomStep(globeHandle: GlobeHandle, delta: number): void {
	applyZoomDelta(globeHandle.globe, delta);
	globeHandle.redraw();
}

function getCenterCountry(
	globeController: GlobeControllerHandle,
	globeHandle: GlobeHandle,
): string | null {
	const focused = globeController.getAutoFocusedCountry();
	if (focused) return focused;

	const { projection, state } = globeHandle.globe;
	return screenToCountryId(projection, state.width / 2, state.height / 2);
}

/** Rotation, zoom, and WASD are allowed in idle, focusing, and secondarySelection. */
function isGlobeRotationAllowed(mode: InteractionState['mode']): boolean {
	return mode === 'idle' || mode === 'focusing' || mode === 'secondarySelection';
}

/** D-pad / arrow key country-hopping is only allowed in idle and focusing. */
function isGlobeNavigationAllowed(mode: InteractionState['mode']): boolean {
	return mode === 'idle' || mode === 'focusing';
}

/** Update focus based on center country — either secondarySelection index or normal focus. */
function applyFocusFromCenter(world: Parameters<typeof focusCountry>[0], countryId: string): void {
	const state = world.getResource("interactionState");
	if (state.mode === 'secondarySelection') {
		const next = focusSecondaryOptionByCountryId(state, countryId);
		if (next !== state) world.setResource("interactionState", next);
	} else {
		focusCountry(world, countryId);
	}
}

function GlobeInputHandler({ globeHandle, globeController }: GlobeInputHandlerProps) {
	const world = useGameWorld();

	// Continuous analog polling for right stick rotation and trigger zoom
	const globeHandleRef = useRef(globeHandle);
	const globeControllerRef = useRef(globeController);
	const worldRef = useRef(world);
	globeHandleRef.current = globeHandle;
	globeControllerRef.current = globeController;
	worldRef.current = world;

	useEffect(() => {
		let frameId: number;
		let lastFocused: string | null = null;

		const KEYBOARD_ROTATION_SPEED = 2.5;

		function updateCenterFocus() {
			const handle = globeHandleRef.current;
			const controller = globeControllerRef.current;
			if (!handle || !controller) return;
			const focused = getCenterCountry(controller, handle);
			if (focused && focused !== lastFocused) {
				lastFocused = focused;
				applyFocusFromCenter(worldRef.current, focused);
			}
		}

		function pollContinuousInputs() {
			const handle = globeHandleRef.current;
			const controller = globeControllerRef.current;

			if (handle && controller) {
				const currentState = worldRef.current.getResource("interactionState");
				const rotationAllowed = isGlobeRotationAllowed(currentState.mode);

				if (rotationAllowed) {
					// Gamepad right stick → globe rotation
					const gamepad = getGamepadManager();
					const analog = gamepad.getAnalogState();
					const isStickRotating = Math.abs(analog.rightStickX) > 0.01 || Math.abs(analog.rightStickY) > 0.01;

					controller.applyAnalogRotation(analog.rightStickX, analog.rightStickY);

					if (isStickRotating) {
						updateCenterFocus();
					}

					// Gamepad triggers → zoom
					const zoomDelta = analog.rightTrigger - analog.leftTrigger;
					controller.applyZoom(zoomDelta);

					// WASD → continuous globe rotation
					const kb = getKeyboardManager();
					const kbDx = (kb.isKeyPressed('d') ? 1 : 0) - (kb.isKeyPressed('a') ? 1 : 0);
					const kbDy = (kb.isKeyPressed('s') ? 1 : 0) - (kb.isKeyPressed('w') ? 1 : 0);

					if (kbDx !== 0 || kbDy !== 0) {
						applyRotation(handle, kbDx * KEYBOARD_ROTATION_SPEED, kbDy * KEYBOARD_ROTATION_SPEED);
						updateCenterFocus();
					}
				}
			}

			frameId = requestAnimationFrame(pollContinuousInputs);
		}

		frameId = requestAnimationFrame(pollContinuousInputs);
		return () => cancelAnimationFrame(frameId);
	}, []);

	// Left stick / d-pad / arrow key navigation
	// Only active in idle/focusing modes — ControlBar handles navigation in other modes
	const handleNavigate = useCallback((direction: Direction) => {
		if (!globeController || !globeHandle) return;

		const currentInteraction = world.getResource("interactionState");
		if (!isGlobeNavigationAllowed(currentInteraction.mode)) return;

		const currentId = world.getResource("selectedCountryId");
		if (!currentId) {
			const centered = getCenterCountry(globeController, globeHandle);
			if (centered) {
				focusCountry(world, centered);
			}
			return;
		}

		const neighborId = globeController.hopToNeighbor(currentId, direction);
		if (neighborId) {
			focusCountry(world, neighborId);
			world.eventBus.publish("countryClicked", { countryId: neighborId });
		}
	}, [globeController, globeHandle, world]);

	useInputAction('NAVIGATE_UP', useCallback(() => handleNavigate('up'), [handleNavigate]));
	useInputAction('NAVIGATE_DOWN', useCallback(() => handleNavigate('down'), [handleNavigate]));
	useInputAction('NAVIGATE_LEFT', useCallback(() => handleNavigate('left'), [handleNavigate]));
	useInputAction('NAVIGATE_RIGHT', useCallback(() => handleNavigate('right'), [handleNavigate]));

	// Globe rotation (Shift+arrows) with auto-focus on center country
	const handleRotate = useCallback((dx: number, dy: number) => {
		if (!globeHandle || !globeController) return;
		const currentInteraction = world.getResource("interactionState");
		if (!isGlobeRotationAllowed(currentInteraction.mode)) return;
		applyRotation(globeHandle, dx, dy);
		const centered = getCenterCountry(globeController, globeHandle);
		if (centered) {
			applyFocusFromCenter(world, centered);
		}
	}, [globeHandle, globeController, world]);

	useInputAction('ROTATE_UP', useCallback(() => handleRotate(0, -10), [handleRotate]));
	useInputAction('ROTATE_DOWN', useCallback(() => handleRotate(0, 10), [handleRotate]));
	useInputAction('ROTATE_LEFT', useCallback(() => handleRotate(-10, 0), [handleRotate]));
	useInputAction('ROTATE_RIGHT', useCallback(() => handleRotate(10, 0), [handleRotate]));

	// Keyboard-only zoom (Q/Z)
	useInputAction('ZOOM_IN', useCallback(() => {
		if (!globeHandle) return;
		const currentInteraction = world.getResource("interactionState");
		if (!isGlobeRotationAllowed(currentInteraction.mode)) return;
		applyZoomStep(globeHandle, 30);
	}, [globeHandle, world]));

	useInputAction('ZOOM_OUT', useCallback(() => {
		if (!globeHandle) return;
		const currentInteraction = world.getResource("interactionState");
		if (!isGlobeRotationAllowed(currentInteraction.mode)) return;
		applyZoomStep(globeHandle, -30);
	}, [globeHandle, world]));

	// CONFIRM only handles idle mode (focus center country).
	// ControlBar handles CONFIRM for focusing and beyond.
	useInputAction('CONFIRM', useCallback(() => {
		const currentInteraction = world.getResource("interactionState");
		if (currentInteraction.mode === 'idle' && globeController && globeHandle) {
			const centered = getCenterCountry(globeController, globeHandle);
			if (centered) {
				focusCountry(world, centered);
				world.eventBus.publish("countryClicked", { countryId: centered });
			}
		}
	}, [globeController, globeHandle, world]));

	return null;
}

export { GlobeInputHandler };
