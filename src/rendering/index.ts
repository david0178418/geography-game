import { DEFAULT_CONFIG } from "./types.ts";
import type { GlobeContext, GlobeState, GlobeHighlight, CountryCallback } from "./types.ts";
import { createProjection, applyState, createPathGenerator } from "./projection.ts";
import { renderGlobe } from "./globe.ts";
import { setupDragRotation, setupScrollZoom, setupClickHandler, setupHoverHandler } from "./interactions.ts";

interface GlobeHandle {
	readonly globe: GlobeContext;
	readonly redraw: (highlight?: GlobeHighlight) => void;
	readonly cleanup: () => void;
	readonly onCountryClick: (cb: CountryCallback) => void;
	readonly onCountryHover: (cb: CountryCallback) => void;
}

function scaleFromDimensions(width: number, height: number): number {
	return Math.min(width, height) / 2.5;
}

function createInitialState(canvas: HTMLCanvasElement): GlobeState {
	return {
		rotation: [0, -20] as const,
		scale: scaleFromDimensions(canvas.width, canvas.height),
		width: canvas.width,
		height: canvas.height,
	};
}

function initGlobe(canvas: HTMLCanvasElement): GlobeHandle {
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Could not get 2D canvas context");

	function resize(): void {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	resize();

	const initialState = createInitialState(canvas);
	const globe: GlobeContext = {
		canvas,
		ctx,
		projection: createProjection(initialState),
		config: DEFAULT_CONFIG,
		state: initialState,
	};

	const pathGenerator = createPathGenerator(globe.projection, globe.ctx);

	let currentHighlight: GlobeHighlight = {
		selectedCountryId: null,
		hoveredCountryId: null,
		factionControlMap: new Map(),
	};

	function redraw(highlight?: GlobeHighlight): void {
		if (highlight) {
			currentHighlight = highlight;
		}
		applyState(globe.projection, globe.state);
		renderGlobe(globe, pathGenerator, currentHighlight);
	}

	let resizeFrameId = 0;
	function onResize(): void {
		cancelAnimationFrame(resizeFrameId);
		resizeFrameId = requestAnimationFrame(() => {
			resize();
			globe.state = {
				...globe.state,
				width: canvas.width,
				height: canvas.height,
				scale: scaleFromDimensions(canvas.width, canvas.height),
			};
			redraw();
		});
	}

	window.addEventListener("resize", onResize);

	const { cleanup: cleanupDrag, dragState } = setupDragRotation(globe, redraw);
	const cleanupZoom = setupScrollZoom(globe, redraw);

	const cleanupFns: Array<() => void> = [
		() => {
			cancelAnimationFrame(resizeFrameId);
			window.removeEventListener("resize", onResize);
		},
		cleanupDrag,
		cleanupZoom,
	];

	redraw();

	return {
		globe,
		redraw,
		cleanup: () => cleanupFns.forEach((fn) => fn()),
		onCountryClick: (cb: CountryCallback) => {
			cleanupFns.push(setupClickHandler(globe, dragState, cb));
		},
		onCountryHover: (cb: CountryCallback) => {
			cleanupFns.push(setupHoverHandler(globe, cb));
		},
	};
}

export { initGlobe };
export type { GlobeHandle };
