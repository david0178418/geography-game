import type { GlobeContext } from './types.ts';
import type { Direction } from './navigation.ts';
import { applyRotationDelta, applyZoomDelta } from './interactions.ts';
import { screenToCountryId } from './hitDetection.ts';
import { findNeighborInDirection } from './navigation.ts';

type RedrawFn = () => void;

interface GlobeControllerOptions {
	readonly adjacencyMap: Readonly<Record<string, ReadonlyArray<string>>>;
	readonly capitalCoords: ReadonlyMap<string, readonly [number, number]>;
}

export interface GlobeControllerHandle {
	readonly applyAnalogRotation: (stickX: number, stickY: number) => void;
	readonly hopToNeighbor: (currentCountryId: string, direction: Direction) => string | null;
	readonly centerOnCountry: (lon: number, lat: number) => void;
	readonly centerOnCountryById: (countryId: string) => void;
	readonly applyZoom: (triggerValue: number) => void;
	readonly getAutoFocusedCountry: () => string | null;
	readonly update: () => void;
	readonly cleanup: () => void;
}

const ROTATION_SPEED = 3;
const ZOOM_SPEED = 5;
const CENTER_DURATION_MS = 300;

function createGlobeController(
	globe: GlobeContext,
	redraw: RedrawFn,
	options: GlobeControllerOptions,
): GlobeControllerHandle {
	let centerAnimationId: number | null = null;
	let autoFocusedCountry: string | null = null;

	function cancelCenterAnimation(): void {
		if (centerAnimationId !== null) {
			cancelAnimationFrame(centerAnimationId);
			centerAnimationId = null;
		}
	}

	function lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	const handle: GlobeControllerHandle = {
		applyAnalogRotation(stickX: number, stickY: number) {
			if (Math.abs(stickX) < 0.01 && Math.abs(stickY) < 0.01) return;
			cancelCenterAnimation();
			applyRotationDelta(globe, stickX * ROTATION_SPEED, stickY * ROTATION_SPEED);

			const centerX = globe.state.width / 2;
			const centerY = globe.state.height / 2;
			autoFocusedCountry = screenToCountryId(globe.projection, centerX, centerY);

			redraw();
		},

		hopToNeighbor(currentCountryId: string, direction: Direction) {
			const neighborId = findNeighborInDirection(
				currentCountryId,
				direction,
				options.adjacencyMap,
				options.capitalCoords,
			);
			if (!neighborId) return null;

			const coords = options.capitalCoords.get(neighborId);
			if (coords) {
				handle.centerOnCountry(coords[0], coords[1]);
			}
			return neighborId;
		},

		centerOnCountryById(countryId: string) {
			const coords = options.capitalCoords.get(countryId);
			if (coords) handle.centerOnCountry(coords[0], coords[1]);
		},

		centerOnCountry(lon: number, lat: number) {
			cancelCenterAnimation();

			const startRotation = [...globe.state.rotation] as const;
			const targetRotation = [-lon, -lat] as const;
			const startTime = performance.now();

			function animate() {
				const elapsed = performance.now() - startTime;
				const t = Math.min(1, elapsed / CENTER_DURATION_MS);
				const eased = t * (2 - t); // ease-out quad

				const newLon = lerp(startRotation[0], targetRotation[0], eased);
				const newLat = lerp(startRotation[1], targetRotation[1], eased);

				globe.state = {
					...globe.state,
					rotation: [newLon, newLat] as const,
				};
				redraw();

				if (t < 1) {
					centerAnimationId = requestAnimationFrame(animate);
				} else {
					centerAnimationId = null;
				}
			}

			centerAnimationId = requestAnimationFrame(animate);
		},

		applyZoom(triggerValue: number) {
			if (Math.abs(triggerValue) < 0.01) return;
			applyZoomDelta(globe, triggerValue * ZOOM_SPEED);
			redraw();
		},

		getAutoFocusedCountry() {
			return autoFocusedCountry;
		},

		update() {
			// called each frame if needed for continuous updates
		},

		cleanup() {
			cancelCenterAnimation();
		},
	};

	return handle;
}

export { createGlobeController };
