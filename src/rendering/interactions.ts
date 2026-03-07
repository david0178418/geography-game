import type { GlobeContext, CountryCallback } from "./types.ts";
import { screenToCountryId } from "./hitDetection.ts";

type RedrawFn = () => void;

const ROTATION_SENSITIVITY = 0.3;
const ZOOM_SENSITIVITY = 0.5;
const DRAG_THRESHOLD = 5;
const HOVER_THROTTLE_MS = 50;

function applyRotationDelta(globe: GlobeContext, dx: number, dy: number): void {
	globe.state = {
		...globe.state,
		rotation: [
			globe.state.rotation[0] + dx * ROTATION_SENSITIVITY,
			Math.max(-90, Math.min(90, globe.state.rotation[1] - dy * ROTATION_SENSITIVITY)),
		] as const,
	};
}

function createScheduledRedraw(redraw: RedrawFn): () => void {
	let frameId = 0;
	return () => {
		cancelAnimationFrame(frameId);
		frameId = requestAnimationFrame(() => redraw());
	};
}

interface DragState {
	readonly wasDrag: () => boolean;
}

function setupDragRotation(globe: GlobeContext, redraw: RedrawFn): { cleanup: () => void; dragState: DragState } {
	const canvas = globe.canvas;
	const scheduledRedraw = createScheduledRedraw(redraw);
	let isDragging = false;
	let lastX = 0;
	let lastY = 0;
	let startX = 0;
	let startY = 0;
	let didDrag = false;

	function onMouseDown(e: MouseEvent): void {
		isDragging = true;
		didDrag = false;
		lastX = e.clientX;
		lastY = e.clientY;
		startX = e.clientX;
		startY = e.clientY;
	}

	function onMouseMove(e: MouseEvent): void {
		if (!isDragging) return;
		const dx = e.clientX - lastX;
		const dy = e.clientY - lastY;
		lastX = e.clientX;
		lastY = e.clientY;

		const totalDx = Math.abs(e.clientX - startX);
		const totalDy = Math.abs(e.clientY - startY);
		if (totalDx > DRAG_THRESHOLD || totalDy > DRAG_THRESHOLD) {
			didDrag = true;
		}

		applyRotationDelta(globe, dx, dy);
		scheduledRedraw();
	}

	function onMouseUp(): void {
		isDragging = false;
	}

	function onTouchStart(e: TouchEvent): void {
		if (e.touches.length !== 1) return;
		const touch = e.touches[0];
		if (!touch) return;
		isDragging = true;
		didDrag = false;
		lastX = touch.clientX;
		lastY = touch.clientY;
		startX = touch.clientX;
		startY = touch.clientY;
		e.preventDefault();
	}

	function onTouchMove(e: TouchEvent): void {
		if (!isDragging || e.touches.length !== 1) return;
		const touch = e.touches[0];
		if (!touch) return;
		const dx = touch.clientX - lastX;
		const dy = touch.clientY - lastY;
		lastX = touch.clientX;
		lastY = touch.clientY;

		const totalDx = Math.abs(touch.clientX - startX);
		const totalDy = Math.abs(touch.clientY - startY);
		if (totalDx > DRAG_THRESHOLD || totalDy > DRAG_THRESHOLD) {
			didDrag = true;
		}

		applyRotationDelta(globe, dx, dy);
		scheduledRedraw();
		e.preventDefault();
	}

	function onTouchEnd(): void {
		isDragging = false;
	}

	canvas.addEventListener("mousedown", onMouseDown);
	window.addEventListener("mousemove", onMouseMove);
	window.addEventListener("mouseup", onMouseUp);
	canvas.addEventListener("touchstart", onTouchStart, { passive: false });
	window.addEventListener("touchmove", onTouchMove, { passive: false });
	window.addEventListener("touchend", onTouchEnd);

	return {
		cleanup: () => {
			canvas.removeEventListener("mousedown", onMouseDown);
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
			canvas.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
		},
		dragState: {
			wasDrag: () => didDrag,
		},
	};
}

function setupScrollZoom(globe: GlobeContext, redraw: RedrawFn): () => void {
	const scheduledRedraw = createScheduledRedraw(redraw);

	function onWheel(e: WheelEvent): void {
		e.preventDefault();
		const delta = -e.deltaY * ZOOM_SENSITIVITY;
		const newScale = Math.max(
			globe.config.minScale,
			Math.min(globe.config.maxScale, globe.state.scale + delta),
		);

		globe.state = {
			...globe.state,
			scale: newScale,
		};
		scheduledRedraw();
	}

	globe.canvas.addEventListener("wheel", onWheel, { passive: false });

	return () => {
		globe.canvas.removeEventListener("wheel", onWheel);
	};
}

function setupClickHandler(
	globe: GlobeContext,
	dragState: DragState,
	onClick: CountryCallback,
): () => void {
	const canvas = globe.canvas;

	function onCanvasClick(e: MouseEvent): void {
		if (dragState.wasDrag()) return;
		const countryId = screenToCountryId(globe.projection, e.clientX, e.clientY);
		onClick(countryId);
	}

	canvas.addEventListener("click", onCanvasClick);
	return () => canvas.removeEventListener("click", onCanvasClick);
}

function setupHoverHandler(
	globe: GlobeContext,
	onHover: CountryCallback,
): () => void {
	const canvas = globe.canvas;
	let lastHovered: string | null = null;
	let lastTime = 0;

	function onMouseMove(e: MouseEvent): void {
		const now = Date.now();
		if (now - lastTime < HOVER_THROTTLE_MS) return;
		lastTime = now;

		const countryId = screenToCountryId(globe.projection, e.clientX, e.clientY);
		if (countryId === lastHovered) return;
		lastHovered = countryId;
		onHover(countryId);
	}

	function onMouseLeave(): void {
		if (lastHovered === null) return;
		lastHovered = null;
		onHover(null);
	}

	canvas.addEventListener("mousemove", onMouseMove);
	canvas.addEventListener("mouseleave", onMouseLeave);
	return () => {
		canvas.removeEventListener("mousemove", onMouseMove);
		canvas.removeEventListener("mouseleave", onMouseLeave);
	};
}

export { setupDragRotation, setupScrollZoom, setupClickHandler, setupHoverHandler };
