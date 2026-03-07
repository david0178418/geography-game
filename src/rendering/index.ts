import { DEFAULT_CONFIG } from "./types.ts";
import type { GlobeContext, GlobeState } from "./types.ts";
import { createProjection, updateProjection, createPathGenerator } from "./projection.ts";
import { renderGlobe } from "./globe.ts";
import { setupDragRotation, setupScrollZoom } from "./interactions.ts";

function createInitialState(canvas: HTMLCanvasElement): GlobeState {
	return {
		rotation: [0, -20] as const,
		scale: Math.min(canvas.width, canvas.height) / 2.5,
		width: canvas.width,
		height: canvas.height,
	};
}

export function initGlobe(canvas: HTMLCanvasElement): () => void {
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

	function redraw(): void {
		updateProjection(globe.projection, globe.state);
		const pathGenerator = createPathGenerator(globe.projection, globe.ctx);
		renderGlobe(globe, pathGenerator);
	}

	function onResize(): void {
		resize();
		globe.state = {
			...globe.state,
			width: canvas.width,
			height: canvas.height,
			scale: Math.min(canvas.width, canvas.height) / 2.5,
		};
		redraw();
	}

	window.addEventListener("resize", onResize);

	const cleanupDrag = setupDragRotation(globe, redraw);
	const cleanupZoom = setupScrollZoom(globe, redraw);

	redraw();

	return () => {
		window.removeEventListener("resize", onResize);
		cleanupDrag();
		cleanupZoom();
	};
}
