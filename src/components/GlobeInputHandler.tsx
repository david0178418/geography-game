import { useCallback, useEffect, useRef } from "react";
import { useGameWorld } from "@/contexts/GameContext.ts";
import { useEcsResource } from "@/hooks/useEcsResource.ts";
import { useInputAction } from "@/input/input-hooks.ts";
import { getGamepadManager } from "@/input/gamepad-manager.ts";
import { selectCountry } from "@/ecs/interaction-state.ts";
import type { GlobeHandle } from "@/rendering/index.ts";
import type { GlobeControllerHandle } from "@/rendering/globe-controller.ts";
import type { Direction } from "@/rendering/navigation.ts";

interface GlobeInputHandlerProps {
	readonly globeHandle: GlobeHandle | null;
	readonly globeController: GlobeControllerHandle | null;
}

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
	const { config, state } = globeHandle.globe;
	globeHandle.globe.state = {
		...state,
		scale: Math.max(config.minScale, Math.min(config.maxScale, state.scale + delta)),
	};
	globeHandle.redraw();
}

function GlobeInputHandler({ globeHandle, globeController }: GlobeInputHandlerProps) {
	const world = useGameWorld();
	const interactionState = useEcsResource("interactionState");
	const selectedCountryId = useEcsResource("selectedCountryId");
	const currentPhase = useEcsResource("currentPhase");

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

		function pollAnalog() {
			const handle = globeHandleRef.current;
			const controller = globeControllerRef.current;
			const w = worldRef.current;

			if (handle && controller) {
				const manager = getGamepadManager();
				const analog = manager.getAnalogState();

				const isRotating = Math.abs(analog.rightStickX) > 0.01 || Math.abs(analog.rightStickY) > 0.01;

				// Right stick → globe rotation
				controller.applyAnalogRotation(analog.rightStickX, analog.rightStickY);

				// Auto-select center country while rotating
				if (isRotating) {
					const focused = controller.getAutoFocusedCountry();
					if (focused && focused !== lastFocused) {
						lastFocused = focused;
						w.setResource("selectedCountryId", focused);
						w.setResource("interactionState", selectCountry(focused));
					}
				}

				// Triggers → zoom (RT zooms in, LT zooms out)
				const zoomDelta = analog.rightTrigger - analog.leftTrigger;
				controller.applyZoom(zoomDelta);
			}

			frameId = requestAnimationFrame(pollAnalog);
		}

		frameId = requestAnimationFrame(pollAnalog);
		return () => cancelAnimationFrame(frameId);
	}, []);

	// Left stick / d-pad navigation (edge-triggered via useInputAction)
	const handleNavigate = useCallback((direction: Direction) => {
		if (!globeController) return;

		const currentId = selectedCountryId;
		if (!currentId) {
			const focused = globeController.getAutoFocusedCountry();
			if (focused) {
				world.setResource("selectedCountryId", focused);
				world.setResource("interactionState", selectCountry(focused));
			}
			return;
		}

		const neighborId = globeController.hopToNeighbor(currentId, direction);
		if (neighborId) {
			world.setResource("selectedCountryId", neighborId);
			world.setResource("interactionState", selectCountry(neighborId));
			world.eventBus.publish("countryClicked", { countryId: neighborId });
		}
	}, [globeController, selectedCountryId, world]);

	useInputAction('NAVIGATE_UP', useCallback(() => handleNavigate('up'), [handleNavigate]));
	useInputAction('NAVIGATE_DOWN', useCallback(() => handleNavigate('down'), [handleNavigate]));
	useInputAction('NAVIGATE_LEFT', useCallback(() => handleNavigate('left'), [handleNavigate]));
	useInputAction('NAVIGATE_RIGHT', useCallback(() => handleNavigate('right'), [handleNavigate]));

	// Keyboard-only rotation (Shift+arrows)
	useInputAction('ROTATE_UP', useCallback(() => {
		if (globeHandle) applyRotation(globeHandle, 0, -10);
	}, [globeHandle]));

	useInputAction('ROTATE_DOWN', useCallback(() => {
		if (globeHandle) applyRotation(globeHandle, 0, 10);
	}, [globeHandle]));

	useInputAction('ROTATE_LEFT', useCallback(() => {
		if (globeHandle) applyRotation(globeHandle, -10, 0);
	}, [globeHandle]));

	useInputAction('ROTATE_RIGHT', useCallback(() => {
		if (globeHandle) applyRotation(globeHandle, 10, 0);
	}, [globeHandle]));

	// Keyboard-only zoom (Q/Z)
	useInputAction('ZOOM_IN', useCallback(() => {
		if (globeHandle) applyZoomStep(globeHandle, 30);
	}, [globeHandle]));

	useInputAction('ZOOM_OUT', useCallback(() => {
		if (globeHandle) applyZoomStep(globeHandle, -30);
	}, [globeHandle]));

	useInputAction('END_TURN', useCallback(() => {
		if (currentPhase === "planning") {
			world.eventBus.publish("endTurn", undefined);
		}
	}, [world, currentPhase]));

	useInputAction('CONFIRM', useCallback(() => {
		if (interactionState.mode === 'idle' && globeController) {
			const focused = globeController.getAutoFocusedCountry();
			if (focused) {
				world.setResource("selectedCountryId", focused);
				world.setResource("interactionState", selectCountry(focused));
				world.eventBus.publish("countryClicked", { countryId: focused });
			}
		}
	}, [interactionState, globeController, world]));

	return null;
}

export { GlobeInputHandler };
