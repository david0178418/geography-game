import type { GlobeContext } from "./types.ts";

type RedrawFn = () => void;

const ROTATION_SENSITIVITY = 0.3;
const ZOOM_SENSITIVITY = 0.5;

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
		frameId = requestAnimationFrame(redraw);
	};
}

export function setupDragRotation(globe: GlobeContext, redraw: RedrawFn): () => void {
	const canvas = globe.canvas;
	const scheduledRedraw = createScheduledRedraw(redraw);
	let isDragging = false;
	let lastX = 0;
	let lastY = 0;

	function onMouseDown(e: MouseEvent): void {
		isDragging = true;
		lastX = e.clientX;
		lastY = e.clientY;
	}

	function onMouseMove(e: MouseEvent): void {
		if (!isDragging) return;
		const dx = e.clientX - lastX;
		const dy = e.clientY - lastY;
		lastX = e.clientX;
		lastY = e.clientY;
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
		lastX = touch.clientX;
		lastY = touch.clientY;
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

	return () => {
		canvas.removeEventListener("mousedown", onMouseDown);
		window.removeEventListener("mousemove", onMouseMove);
		window.removeEventListener("mouseup", onMouseUp);
		canvas.removeEventListener("touchstart", onTouchStart);
		window.removeEventListener("touchmove", onTouchMove);
		window.removeEventListener("touchend", onTouchEnd);
	};
}

export function setupScrollZoom(globe: GlobeContext, redraw: RedrawFn): () => void {
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
