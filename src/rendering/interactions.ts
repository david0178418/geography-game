import type { GlobeContext, CountryCallback } from "./types.ts";
import { screenToCountryId } from "./hitDetection.ts";

type RedrawFn = () => void;

const ROTATION_SENSITIVITY = 0.3;
const ZOOM_SENSITIVITY = 0.5;
const MOUSE_DRAG_THRESHOLD = 5;
const TOUCH_DRAG_THRESHOLD = 10;
const HOVER_THROTTLE_MS = 50;
const PINCH_ZOOM_SENSITIVITY = 1.5;

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

function touchDistance(t1: Touch, t2: Touch): number {
	const dx = t1.clientX - t2.clientX;
	const dy = t1.clientY - t2.clientY;
	return Math.sqrt(dx * dx + dy * dy);
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

	// Pinch-to-zoom state
	let isPinching = false;
	let lastPinchDistance = 0;

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
		if (totalDx > MOUSE_DRAG_THRESHOLD || totalDy > MOUSE_DRAG_THRESHOLD) {
			didDrag = true;
		}

		applyRotationDelta(globe, dx, dy);
		scheduledRedraw();
	}

	function onMouseUp(): void {
		isDragging = false;
	}

	function onTouchStart(e: TouchEvent): void {
		if (e.touches.length === 2) {
			// Start pinch-to-zoom
			isPinching = true;
			isDragging = false;
			didDrag = true; // Prevent tap-to-select during pinch
			const t0 = e.touches[0];
			const t1 = e.touches[1];
			if (t0 && t1) {
				lastPinchDistance = touchDistance(t0, t1);
			}
			e.preventDefault();
			return;
		}
		if (e.touches.length !== 1) return;
		const touch = e.touches[0];
		if (!touch) return;
		isDragging = true;
		isPinching = false;
		didDrag = false;
		lastX = touch.clientX;
		lastY = touch.clientY;
		startX = touch.clientX;
		startY = touch.clientY;
		e.preventDefault();
	}

	function onTouchMove(e: TouchEvent): void {
		if (isPinching && e.touches.length === 2) {
			const t0 = e.touches[0];
			const t1 = e.touches[1];
			if (!t0 || !t1) return;
			const distance = touchDistance(t0, t1);
			const delta = (distance - lastPinchDistance) * PINCH_ZOOM_SENSITIVITY;
			lastPinchDistance = distance;

			applyZoomDelta(globe, delta);
			scheduledRedraw();
			e.preventDefault();
			return;
		}

		if (!isDragging || e.touches.length !== 1) return;
		const touch = e.touches[0];
		if (!touch) return;
		const dx = touch.clientX - lastX;
		const dy = touch.clientY - lastY;
		lastX = touch.clientX;
		lastY = touch.clientY;

		const totalDx = Math.abs(touch.clientX - startX);
		const totalDy = Math.abs(touch.clientY - startY);
		if (totalDx > TOUCH_DRAG_THRESHOLD || totalDy > TOUCH_DRAG_THRESHOLD) {
			didDrag = true;
		}

		applyRotationDelta(globe, dx, dy);
		scheduledRedraw();
		e.preventDefault();
	}

	function onTouchEnd(e: TouchEvent): void {
		if (e.touches.length === 0) {
			isPinching = false;
			isDragging = false;
		} else if (e.touches.length === 1) {
			// Went from 2 fingers to 1 — resume single-finger drag
			isPinching = false;
			isDragging = true;
			didDrag = true; // Still prevent tap
			const touch = e.touches[0];
			if (touch) {
				lastX = touch.clientX;
				lastY = touch.clientY;
			}
		}
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
		applyZoomDelta(globe, -e.deltaY * ZOOM_SENSITIVITY);
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
	let handledByTouch = false;

	function onCanvasClick(e: MouseEvent): void {
		if (handledByTouch) {
			handledByTouch = false;
			return;
		}
		if (dragState.wasDrag()) return;
		const countryId = screenToCountryId(globe.projection, e.clientX, e.clientY);
		onClick(countryId);
	}

	function onTouchEnd(e: TouchEvent): void {
		if (dragState.wasDrag()) return;
		if (e.touches.length !== 0) return;
		const touch = e.changedTouches[0];
		if (!touch) return;
		handledByTouch = true;
		const countryId = screenToCountryId(globe.projection, touch.clientX, touch.clientY);
		onClick(countryId);
	}

	canvas.addEventListener("click", onCanvasClick);
	canvas.addEventListener("touchend", onTouchEnd);
	return () => {
		canvas.removeEventListener("click", onCanvasClick);
		canvas.removeEventListener("touchend", onTouchEnd);
	};
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

function applyZoomDelta(globe: GlobeContext, delta: number): void {
	const newScale = Math.max(
		globe.config.minScale,
		Math.min(globe.config.maxScale, globe.state.scale + delta),
	);
	globe.state = { ...globe.state, scale: newScale };
}

export { setupDragRotation, setupScrollZoom, setupClickHandler, setupHoverHandler, applyRotationDelta, applyZoomDelta };
