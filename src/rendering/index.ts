import { DEFAULT_CONFIG } from "./types.ts";
import type { GlobeContext, GlobeState } from "./types.ts";
import { createProjection, applyState, createPathGenerator } from "./projection.ts";
import { renderGlobe } from "./globe.ts";
import { setupDragRotation, setupScrollZoom } from "./interactions.ts";

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

	const pathGenerator = createPathGenerator(globe.projection, globe.ctx);

	function redraw(): void {
		applyState(globe.projection, globe.state);
		renderGlobe(globe, pathGenerator);
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

	const cleanupDrag = setupDragRotation(globe, redraw);
	const cleanupZoom = setupScrollZoom(globe, redraw);

	redraw();

	return () => {
		cancelAnimationFrame(resizeFrameId);
		window.removeEventListener("resize", onResize);
		cleanupDrag();
		cleanupZoom();
	};
}
